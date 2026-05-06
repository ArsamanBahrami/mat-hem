import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TAG_GROUPS, tagStyle } from '../lib/tags'

const EMPTY_ING  = () => ({ name: '', quantity: '', unit: '' })
const EMPTY_STEP = (n) => ({ step: n, text: '' })

const UNITS = ['g', 'kg', 'ml', 'dl', 'l', 'msk', 'tsk', 'krm', 'st', 'näve', 'klyfta', 'burk', 'förp']

export default function ReceptFormulär() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const isEdit   = Boolean(id)

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [sourceUrl,   setSourceUrl]   = useState('')
  const [servings,    setServings]    = useState(4)
  const [prepTime,    setPrepTime]    = useState('')
  const [cookTime,    setCookTime]    = useState('')
  const [ingredients, setIngredients] = useState([EMPTY_ING()])
  const [steps,       setSteps]       = useState([EMPTY_STEP(1)])
  const [tags,        setTags]        = useState([])
  const [imageFile,   setImageFile]   = useState(null)
  const [imagePreview,setImagePreview]= useState(null)
  const [existingImg, setExistingImg] = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [parsing,     setParsing]     = useState(false)
  const [aiImported,  setAiImported]  = useState(false)
  const fileRef   = useRef()
  const aiFileRef = useRef()

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.rpc('fetch_recipe', {
        p_user_id: session.user.id,
        p_recipe_id: id,
      })
      if (!data) return
      setTitle(data.title ?? '')
      setDescription(data.description ?? '')
      setSourceUrl(data.source_url ?? '')
      setServings(data.servings ?? 4)
      setPrepTime(data.prep_time_min ?? '')
      setCookTime(data.cook_time_min ?? '')
      setIngredients(data.ingredients?.length ? data.ingredients : [EMPTY_ING()])
      setSteps(data.instructions?.length ? data.instructions : [EMPTY_STEP(1)])
      setTags(data.tags ?? [])
      setExistingImg(data.image_url ?? null)
      if (data.image_url) setImagePreview(data.image_url)
    }
    load()
  }, [id])

  // ── Ingredients ──────────────────────────────────────
  function updateIng(i, field, val) {
    setIngredients(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }
  function addIng()        { setIngredients(prev => [...prev, EMPTY_ING()]) }
  function removeIng(i)    { setIngredients(prev => prev.filter((_, idx) => idx !== i)) }

  // ── Steps ─────────────────────────────────────────────
  function updateStep(i, val) {
    setSteps(prev => prev.map((row, idx) => idx === i ? { ...row, text: val } : row))
  }
  function addStep() {
    setSteps(prev => [...prev, EMPTY_STEP(prev.length + 1)])
  }
  function removeStep(i) {
    setSteps(prev =>
      prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step: idx + 1 }))
    )
  }

  // ── Tags ──────────────────────────────────────────────
  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // ── Image ─────────────────────────────────────────────
  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(userId) {
    if (!imageFile) return existingImg ?? null
    const ext  = imageFile.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('recipe-images')
      .upload(path, imageFile, { upsert: true })
    if (error) { console.warn('Bilduppladdning misslyckades:', error.message); return existingImg ?? null }
    return supabase.storage.from('recipe-images').getPublicUrl(data.path).data.publicUrl
  }

  // ── AI-import ────────────────────────────────────────
  async function handleAiFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be selected again if needed
    e.target.value = ''

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
    setParsing(true)
    setAiImported(false)

    try {
      const imageBase64 = await fileToBase64(file)
      const mediaType   = file.type || 'image/jpeg'

      const res = await fetch('/.netlify/functions/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType }),
      })

      const json = await res.json()

      if (json.error) {
        setError('Kunde inte hitta ett recept i bilden. Försök med en tydligare bild eller lägg in manuellt.')
        return
      }

      if (json.title)         setTitle(json.title)
      if (json.description)   setDescription(json.description)
      if (json.servings)      setServings(json.servings)
      if (json.prep_time_min) setPrepTime(json.prep_time_min)
      if (json.cook_time_min) setCookTime(json.cook_time_min)
      if (json.ingredients?.length) {
        setIngredients(json.ingredients.map(i => ({
          name:     i.name     ?? '',
          quantity: i.quantity ?? '',
          unit:     i.unit     ?? '',
        })))
      }
      if (json.instructions?.length) {
        setSteps(json.instructions.map((s, idx) => ({
          step: s.step ?? idx + 1,
          text: s.text ?? '',
        })))
      }
      if (json.suggested_tags?.length) {
        setTags(json.suggested_tags.filter(t => t))
      }
      setAiImported(true)
    } catch (err) {
      setError('Något gick fel vid AI-tolkning — försök igen.')
      console.error('AI-import fel:', err)
    } finally {
      setParsing(false)
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ── Submit ────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Ange en titel'); return }
    setError(null)
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Inte inloggad'); return }

      const imageUrl = await uploadImage(session.user.id)

      const cleanIngredients = ingredients
        .filter(i => i.name.trim())
        .map(i => ({
          name:     i.name.trim(),
          quantity: i.quantity ? Number(i.quantity) : null,
          unit:     i.unit.trim() || null,
        }))

      const cleanSteps = steps
        .filter(s => s.text.trim())
        .map((s, idx) => ({ step: idx + 1, text: s.text.trim() }))

      const { data, error } = await supabase.rpc('upsert_recipe', {
        p_user_id:      session.user.id,
        p_title:        title.trim(),
        p_description:  description.trim() || null,
        p_image_url:    imageUrl,
        p_source_url:   sourceUrl.trim() || null,
        p_ingredients:  cleanIngredients,
        p_instructions: cleanSteps,
        p_servings:     Number(servings) || 4,
        p_prep_time:    prepTime ? Number(prepTime) : null,
        p_cook_time:    cookTime ? Number(cookTime) : null,
        p_tags:         tags,
        p_id:           isEdit ? id : null,
      })

      if (error) { setError(error.message); return }
      if (!data)  { setError('Receptet kunde inte sparas — försök igen.'); return }

      navigate(`/recept/${data.id}`)
    } catch (err) {
      console.error('handleSubmit fel:', err)
      setError(err.message ?? 'Något gick fel — försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col bg-sand-50 min-h-full">
      {/* Header */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-5 flex items-center gap-3">
        <button onClick={() => navigate(isEdit ? `/recept/${id}` : '/recept')} className="p-1 -ml-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Redigera recept' : 'Nytt recept'}</h1>
      </div>
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pt-4 pb-10">

        {/* Bild */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <p className="font-semibold text-gray-700">Bild</p>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="" className="w-full h-44 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); setExistingImg(null) }}
                className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-gray-600 text-sm shadow"
              >✕</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-sand-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-forest-400 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm">Ladda upp bild</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <button
            type="button"
            disabled={parsing}
            onClick={() => aiFileRef.current?.click()}
            className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2.5 transition font-medium ${
              parsing
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                : 'text-forest-700 bg-forest-50 border border-forest-200 active:bg-forest-100'
            }`}
          >
            {parsing ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Analyserar bild…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Importera från bild
              </>
            )}
          </button>
          <input
            ref={aiFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAiFileChange}
          />
        </div>

        {/* Grundinfo */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <p className="font-semibold text-gray-700">Grundinfo</p>
          <Field label="Titel *">
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="T.ex. Köttbullar med potatismos"
              className={inputCls}
            />
          </Field>
          <Field label="Beskrivning">
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Kort beskrivning…"
              className={inputCls + ' resize-none'}
            />
          </Field>
          <Field label="Källlänk (valfri)">
            <input
              type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Portioner">
              <input type="number" min={1} value={servings}
                onChange={e => setServings(e.target.value)}
                className={inputCls + ' text-center'} />
            </Field>
            <Field label="Förbered. (min)">
              <input type="number" min={0} value={prepTime}
                onChange={e => setPrepTime(e.target.value)}
                placeholder="—" className={inputCls + ' text-center'} />
            </Field>
            <Field label="Tillagn. (min)">
              <input type="number" min={0} value={cookTime}
                onChange={e => setCookTime(e.target.value)}
                placeholder="—" className={inputCls + ' text-center'} />
            </Field>
          </div>
        </div>

        {/* Ingredienser */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-2">
          <p className="font-semibold text-gray-700 mb-1">Ingredienser</p>
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                value={ing.name} onChange={e => updateIng(i, 'name', e.target.value)}
                placeholder="Ingrediens"
                className={inputCls + ' flex-[2]'}
              />
              <input
                type="number" min={0} step="any"
                value={ing.quantity} onChange={e => updateIng(i, 'quantity', e.target.value)}
                placeholder="Mängd"
                className={inputCls + ' w-16 text-center'}
              />
              <select
                value={ing.unit} onChange={e => updateIng(i, 'unit', e.target.value)}
                className={inputCls + ' flex-1'}
              >
                <option value="">enhet</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              {ingredients.length > 1 && (
                <button type="button" onClick={() => removeIng(i)}
                  className="w-8 h-10 flex items-center justify-center text-gray-400 hover:text-red-400 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addIng}
            className="flex items-center gap-2 text-forest-600 text-sm font-medium mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
            </svg>
            Lägg till ingrediens
          </button>
        </div>

        {/* Instruktioner */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-2">
          <p className="font-semibold text-gray-700 mb-1">Instruktioner</p>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 w-7 h-7 mt-1.5 bg-forest-100 text-forest-700 rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <textarea
                value={step.text}
                onChange={e => updateStep(i, e.target.value)}
                rows={2}
                placeholder={`Steg ${i + 1}…`}
                className={inputCls + ' flex-1 resize-none'}
              />
              {steps.length > 1 && (
                <button type="button" onClick={() => removeStep(i)}
                  className="w-8 flex items-center justify-center text-gray-400 hover:text-red-400 flex-shrink-0 mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addStep}
            className="flex items-center gap-2 text-forest-600 text-sm font-medium mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
            </svg>
            Lägg till steg
          </button>
        </div>

        {/* Taggar */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <p className="font-semibold text-gray-700">Taggar</p>
          {Object.entries(TAG_GROUPS).map(([group, groupTags]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group}</p>
              <div className="flex flex-wrap gap-2">
                {groupTags.map(tag => {
                  const active = tags.includes(tag)
                  return (
                    <button
                      key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`text-sm px-3 py-1 rounded-full border font-medium transition ${tagStyle(tag, active)}`}
                    >{tag}</button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {aiImported && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-amber-800 font-medium">Granskat av AI — kontrollera att allt stämmer innan du sparar</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-2xl transition shadow disabled:opacity-60"
        >
          {saving ? 'Sparar…' : isEdit ? 'Spara ändringar' : 'Spara recept'}
        </button>
      </form>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────
const inputCls = 'px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent w-full'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}
