import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tagStyle } from '../lib/tags'

const ALL_DAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
const DAY_SHORT = { måndag: 'mån', tisdag: 'tis', onsdag: 'ons', torsdag: 'tor', fredag: 'fre', lördag: 'lör', söndag: 'sön' }

function getThisMonday() {
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Step indicators ──────────────────────────────────────────────────────────
function Steps({ current }) {
  return (
    <div className="flex items-center gap-2 px-5 pb-4">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
            current >= s ? 'bg-white text-forest-700' : 'bg-forest-500/40 text-white'
          }`}>{s}</div>
          {s < 3 && <div className={`h-px w-6 ${current > s ? 'bg-white' : 'bg-forest-500/40'}`} />}
        </div>
      ))}
      <span className="text-white/80 text-xs ml-1">
        {current === 1 ? 'Dagar' : current === 2 ? 'Preferenser' : 'Detaljer'}
      </span>
    </div>
  )
}

// ── Result: recipe mini-card ─────────────────────────────────────────────────
function MiniCard({ recipe, onSwap }) {
  const totalMin = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  return (
    <div className="flex gap-3 items-center bg-sand-50 rounded-xl p-3">
      {recipe.image_url ? (
        <img src={recipe.image_url} alt={recipe.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🍽️</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{recipe.title}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {(recipe.tags ?? []).slice(0, 2).map(tag => (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${tagStyle(tag)}`}>{tag}</span>
          ))}
          {totalMin > 0 && <span className="text-xs text-gray-400">{totalMin} min</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onSwap}
        className="flex-shrink-0 text-xs text-forest-600 font-medium border border-forest-200 rounded-lg px-2.5 py-1.5"
      >
        Byt ut
      </button>
    </div>
  )
}

// ── Swap modal ───────────────────────────────────────────────────────────────
function SwapModal({ options, onSelect, onClose }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.ingredients ?? []).some(ing => ing.name?.toLowerCase().includes(q))
      )
    : options

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
        onClick={onClose}
      />
      {/* Modal box */}
      <div
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: '70vh', background: 'white', borderRadius: '24px 24px 0 0', zIndex: 51 }}
      >
        {/* Header */}
        <div
          style={{ height: '60px', flexShrink: 0, borderBottom: '1px solid #f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}
        >
          <h3 className="font-bold text-gray-800">Välj ett alternativ</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        {/* Search */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0ede8' }}>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök recept eller ingrediens…"
            className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none placeholder-gray-400"
          />
        </div>
        {/* Scroll container */}
        <div
          style={{ position: 'absolute', top: '113px', left: 0, right: 0, bottom: 0, overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}
        >
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm italic text-center py-4 px-5">Inga recept matchar sökningen</p>
          ) : (
            <div className="flex flex-col gap-3 p-5">
              {filtered.map(recipe => {
                const totalMin = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onSelect(recipe.id)}
                    className="flex gap-3 items-center bg-sand-50 rounded-xl p-3 text-left active:bg-sand-100 transition"
                  >
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🍽️</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{recipe.title}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {(recipe.tags ?? []).slice(0, 2).map(tag => (
                          <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${tagStyle(tag)}`}>{tag}</span>
                        ))}
                        {totalMin > 0 && <span className="text-xs text-gray-400">{totalMin} min</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MenyNy() {
  const navigate = useNavigate()

  // Wizard state
  const [step, setStep]               = useState(1)
  const [selectedDays, setSelectedDays] = useState(['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag'])
  const [budget, setBudget]           = useState('vardag')
  const [cook, setCook]               = useState('båda')
  const [nikkiDays, setNikkiDays]     = useState(1)
  const [avoid, setAvoid]             = useState('')

  // Data
  const [recipes, setRecipes]         = useState([])
  const [recentIds, setRecentIds]     = useState([])
  const [session, setSession]         = useState(null)

  // Generation state
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState(null)
  const [generatedMenu, setGeneratedMenu] = useState(null)  // {måndag: uuid|null, ...}

  // Swap modal state
  const [swapDay, setSwapDay]         = useState(null)
  const [swapOptions, setSwapOptions] = useState([])

  // Save state
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/'); return }
      setSession(session)

      const [recipesRes, recentRes] = await Promise.all([
        supabase.rpc('fetch_recipes', { p_user_id: session.user.id }),
        supabase.rpc('fetch_recent_menu_recipe_ids', { p_user_id: session.user.id, p_weeks: 2 }),
      ])
      setRecipes(recipesRes.data ?? [])
      setRecentIds(recentRes.data ?? [])
    }
    load()
  }, [])

  const recipeMap = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes])

  function toggleDay(day) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/.netlify/functions/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipes: recipes.map(r => ({
            id: r.id, title: r.title, tags: r.tags ?? [],
            prep_time_min: r.prep_time_min, cook_time_min: r.cook_time_min,
          })),
          recent_recipe_ids: recentIds,
          parameters: { days: selectedDays, budget, cook, avoid, nikkiDays },
        }),
      })
      const json = await res.json()
      if (json.error) { setGenError(json.error); return }
      setGeneratedMenu(json)
      setStep('result')
    } catch (err) {
      setGenError('Något gick fel — försök igen.')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  function openSwap(day) {
    const currentId = generatedMenu[day]?.recipe_id
    const pool = recipes.filter(r => r.id !== currentId)
    setSwapOptions(shuffle(pool))
    setSwapDay(day)
  }

  function applySwap(newRecipeId) {
    setGeneratedMenu(prev => ({
      ...prev,
      [swapDay]: { ...prev[swapDay], recipe_id: newRecipeId },
    }))
    setSwapDay(null)
  }

  async function saveMenu() {
    if (!session) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('save_menu', {
        p_user_id:         session.user.id,
        p_week_start_date: getThisMonday(),
        p_days:            generatedMenu,
        p_parameters:      { days: selectedDays, budget, cook, avoid, nikkiDays },
      })
      if (error) { setGenError(error.message); return }
      navigate('/meny')
    } catch (err) {
      setGenError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Result view ─────────────────────────────────────────────────────────────
  if (step === 'result') {
    const daysInMenu = ALL_DAYS.filter(d => d in (generatedMenu ?? {}))
    return (
      <div className="flex flex-col bg-sand-50 min-h-full pb-8">
        <div className="bg-forest-600 text-white px-5 pt-12 pb-5 flex items-center gap-3">
          <button onClick={() => setStep(3)} className="p-1 -ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Din veckonymeny</h1>
        </div>
        <div className="bg-forest-600 h-4 relative">
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
        </div>

        <div className="px-4 pt-4 flex flex-col gap-3">
          {daysInMenu.map(day => {
            const dayData  = generatedMenu[day]
            const recipeId = dayData?.recipe_id ?? null
            const dayCook  = dayData?.cook ?? null
            const recipe   = recipeId ? recipeMap.get(recipeId) : null
            return (
              <div key={day} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-forest-600 uppercase tracking-wide">
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </p>
                  {dayCook && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      dayCook === 'Nikki'
                        ? 'bg-purple-50 text-purple-600 border border-purple-200'
                        : dayCook === 'Arsi'
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>{dayCook}</span>
                  )}
                </div>
                {recipe ? (
                  <MiniCard recipe={recipe} onSwap={() => openSwap(day)} />
                ) : (
                  <div className="flex items-center justify-between bg-sand-50 rounded-xl p-3">
                    <p className="text-sm text-gray-400 italic">Inget recept valt</p>
                    <button
                      type="button"
                      onClick={() => openSwap(day)}
                      className="text-xs text-forest-600 font-medium border border-forest-200 rounded-lg px-2.5 py-1.5"
                    >
                      Välj recept
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {genError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{genError}</p>
          )}

          <button
            onClick={saveMenu}
            disabled={saving}
            className="w-full py-4 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-2xl shadow transition disabled:opacity-60"
          >
            {saving ? 'Sparar…' : 'Spara meny'}
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full py-3.5 border-2 border-forest-600 text-forest-600 font-semibold rounded-2xl transition disabled:opacity-60"
          >
            {generating ? 'Genererar…' : 'Generera igen'}
          </button>
        </div>

        {swapDay && (
          <SwapModal
            options={swapOptions}
            onSelect={applySwap}
            onClose={() => setSwapDay(null)}
          />
        )}
      </div>
    )
  }

  // ── Wizard view ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-sand-50 min-h-full pb-8">
      <div className="bg-forest-600 text-white px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => step === 1 ? navigate('/meny') : setStep(s => s - 1)} className="p-1 -ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Ny meny</h1>
        </div>
        <Steps current={step} />
      </div>
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      <div className="px-4 pt-5 flex flex-col gap-5">

        {/* ── Steg 1: Dagar ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
            <h2 className="font-bold text-gray-800">Vilka dagar ska planeras?</h2>
            <div className="grid grid-cols-4 gap-2">
              {ALL_DAYS.map(day => {
                const active = selectedDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition ${
                      active
                        ? 'bg-forest-600 text-white border-forest-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {DAY_SHORT[day]}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 text-center">
              {selectedDays.length} {selectedDays.length === 1 ? 'dag' : 'dagar'} valda
            </p>
          </div>
        )}

        {/* ── Steg 2: Budget + kock ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h2 className="font-bold text-gray-800">Budget / stil</h2>
              <div className="grid grid-cols-3 gap-2">
                {['budget', 'vardag', 'festlig'].map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition ${
                      budget === b
                        ? 'bg-forest-600 text-white border-forest-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="font-bold text-gray-800">Vem lagar?</h2>
              <div className="grid grid-cols-3 gap-2">
                {['Arsi', 'Nikki', 'båda'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCook(c)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition ${
                      cook === c
                        ? 'bg-forest-600 text-white border-forest-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>

              {cook === 'Nikki' && (
                <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 mt-1">
                  <span className="text-sm text-purple-800 font-medium">Hur många dagar lagar Nikki?</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNikkiDays(n => Math.max(1, n - 1))}
                      className="w-7 h-7 flex items-center justify-center bg-white border border-purple-200 rounded-full text-purple-600 font-bold text-lg leading-none"
                    >−</button>
                    <span className="text-sm font-bold text-purple-800 w-4 text-center">{nikkiDays}</span>
                    <button
                      type="button"
                      onClick={() => setNikkiDays(n => Math.min(selectedDays.length, n + 1))}
                      className="w-7 h-7 flex items-center justify-center bg-white border border-purple-200 rounded-full text-purple-600 font-bold text-lg leading-none"
                    >+</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Steg 3: Undvika + generera ── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
            <h2 className="font-bold text-gray-800">Vill du undvika något?</h2>
            <textarea
              value={avoid}
              onChange={e => setAvoid(e.target.value)}
              rows={3}
              placeholder="T.ex. kyckling, fisk, laktosfritt… (valfritt)"
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest-400 resize-none"
            />
            <div className="bg-sand-50 rounded-xl p-3 flex flex-col gap-1.5 text-xs text-gray-500">
              <p><span className="font-semibold">Dagar:</span> {selectedDays.join(', ')}</p>
              <p><span className="font-semibold">Budget:</span> {budget}</p>
              <p><span className="font-semibold">Lagar:</span> {
                cook === 'Nikki'
                  ? `Nikki ${nikkiDays} ${nikkiDays === 1 ? 'dag' : 'dagar'}, Arsi resten`
                  : cook
              }</p>
            </div>
          </div>
        )}

        {genError && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{genError}</p>
        )}

        {/* Navigation */}
        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && selectedDays.length === 0}
            className="w-full py-4 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-2xl shadow transition disabled:opacity-40"
          >
            Nästa
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={generating || selectedDays.length === 0}
            className="w-full py-4 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-2xl shadow transition disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Skapar din meny…
              </>
            ) : 'Generera meny'}
          </button>
        )}
      </div>
    </div>
  )
}
