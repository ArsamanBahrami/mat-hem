import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tagStyle } from '../lib/tags'

function formatQty(n) {
  if (n === Math.floor(n)) return String(n)
  // nice fractions
  const fracs = [[1,4,'¼'],[1,3,'⅓'],[1,2,'½'],[2,3,'⅔'],[3,4,'¾']]
  const whole = Math.floor(n)
  const rem = n - whole
  for (const [num, den, sym] of fracs) {
    if (Math.abs(rem - num / den) < 0.05)
      return (whole > 0 ? whole + '\u200a' : '') + sym
  }
  return n.toFixed(1).replace(/\.0$/, '')
}

export default function ReceptDetalj() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [recipe, setRecipe]       = useState(null)
  const [servings, setServings]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [imageOpen, setImageOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/'); return }

      const { data, error } = await supabase.rpc('fetch_recipe', {
        p_user_id: session.user.id,
        p_recipe_id: id,
      })
      if (error) { setError(error.message); setLoading(false); return }
      if (!data)  { setError('Receptet hittades inte'); setLoading(false); return }

      setRecipe(data)
      setServings(data.servings)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <p className="text-gray-600">{error}</p>
      <button onClick={() => navigate('/recept')} className="text-forest-600 font-medium">← Tillbaka</button>
    </div>
  )

  const scale    = servings / recipe.servings
  const totalMin = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)

  return (
    <div className="flex flex-col bg-sand-50 min-h-full pb-8">
      {/* Image / hero */}
      <div className="relative">
        {recipe.image_url ? (
          <button type="button" onClick={() => setImageOpen(true)} className="w-full">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-56 object-cover" />
          </button>
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-forest-100 to-sand-200 flex items-center justify-center">
            <span className="text-6xl">🍽️</span>
          </div>
        )}
        {/* Back button */}
        <button
          onClick={() => navigate('/recept')}
          className="absolute top-12 left-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-700">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        {/* Edit button */}
        <button
          onClick={() => navigate(`/recept/${id}/redigera`)}
          className="absolute top-12 right-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-700">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
          </svg>
        </button>
      </div>

      {/* Content card */}
      <div className="mx-4 -mt-5 bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        {/* Title + tags */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-gray-500 text-sm mt-1">{recipe.description}</p>
          )}
          {(recipe.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {recipe.tags.map(tag => (
                <span key={tag} className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${tagStyle(tag)}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Meta row */}
        {(totalMin > 0 || recipe.prep_time_min || recipe.cook_time_min) && (
          <div className="flex gap-4 text-sm text-gray-600 border-t border-b border-gray-100 py-3">
            {recipe.prep_time_min > 0 && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-400">Förberedelse</span>
                <span className="font-semibold">{recipe.prep_time_min} min</span>
              </div>
            )}
            {recipe.cook_time_min > 0 && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-400">Tillagning</span>
                <span className="font-semibold">{recipe.cook_time_min} min</span>
              </div>
            )}
            {totalMin > 0 && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-400">Totalt</span>
                <span className="font-semibold">{totalMin} min</span>
              </div>
            )}
          </div>
        )}

        {/* Portionsjustering */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Ingredienser</h2>
            <div className="flex items-center gap-3 bg-sand-50 rounded-xl px-3 py-1.5">
              <button
                onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-6 h-6 flex items-center justify-center text-forest-600 font-bold text-lg leading-none"
              >−</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[4ch] text-center">
                {servings} port
              </span>
              <button
                onClick={() => setServings(s => s + 1)}
                className="w-6 h-6 flex items-center justify-center text-forest-600 font-bold text-lg leading-none"
              >+</button>
            </div>
          </div>

          {(recipe.ingredients ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm italic">Inga ingredienser angivna</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recipe.ingredients.map((ing, i) => {
                const qty = ing.quantity ? ing.quantity * scale : null
                return (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700 text-sm">{ing.name}</span>
                    {qty !== null && (
                      <span className="text-sm font-medium text-gray-500 whitespace-nowrap shrink-0">
                        {formatQty(qty)}{ing.unit ? '\u00a0' + ing.unit : ''}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Instruktioner */}
        {(recipe.instructions ?? []).length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Instruktioner</h2>
            <ol className="flex flex-col gap-4">
              {recipe.instructions.map((ins, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-forest-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {ins.step ?? i + 1}
                  </span>
                  <p className="text-gray-700 text-sm leading-relaxed pt-0.5">{ins.text}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Source URL */}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-forest-600 text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
              <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
            </svg>
            Originalrecept
          </a>
        )}
      </div>

      {/* Lightbox */}
      {imageOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setImageOpen(false)}
        >
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-12 right-4 w-9 h-9 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"
            onClick={() => setImageOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
