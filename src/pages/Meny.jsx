import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tagStyle } from '../lib/tags'

const DAYS_ORDER = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

function isoWeek(dateStr) {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startW1 = new Date(jan4)
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  return Math.ceil(((d - startW1) / 86400000 + 1) / 7)
}

function formatDateRange(weekStartDate) {
  const start = new Date(weekStartDate)
  const end   = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = d => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

function getDayRecipeId(val) {
  if (!val) return null
  return typeof val === 'string' ? val : (val.recipe_id ?? null)
}
function getDayCook(val) {
  if (!val || typeof val === 'string') return null
  return val.cook ?? null
}

// ── Swap modal ────────────────────────────────────────────────────────────────
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
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
        onClick={onClose}
      />
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: '70vh', background: 'white', borderRadius: '24px 24px 0 0', zIndex: 51 }}>
        {/* Header */}
        <div style={{ height: '60px', flexShrink: 0, borderBottom: '1px solid #f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
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
        <div style={{ position: 'absolute', top: '113px', left: 0, right: 0, bottom: 0, overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}>
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

// ── Main component ────────────────────────────────────────────────────────────
export default function Meny() {
  const navigate = useNavigate()
  const [menu,    setMenu]    = useState(undefined)
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [swapDay, setSwapDay] = useState(null)
  const [swapOptions,    setSwapOptions]    = useState([])
  const [saving,         setSaving]         = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/'); return }

      const [menuRes, recipesRes] = await Promise.all([
        supabase.rpc('fetch_current_menu', { p_user_id: session.user.id }),
        supabase.rpc('fetch_recipes',       { p_user_id: session.user.id }),
      ])

      setMenu(menuRes.data ?? null)
      setRecipes(recipesRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const recipeMap = Object.fromEntries(recipes.map(r => [r.id, r]))

  function openSwap(day) {
    const currentId = getDayRecipeId(menu.days[day])
    setSwapOptions(recipes.filter(r => r.id !== currentId))
    setSwapDay(day)
  }

  async function applySwap(newRecipeId) {
    const updatedDays = {
      ...menu.days,
      [swapDay]: { ...(typeof menu.days[swapDay] === 'object' ? menu.days[swapDay] : {}), recipe_id: newRecipeId },
    }
    setMenu(prev => ({ ...prev, days: updatedDays }))
    setSwapDay(null)
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.rpc('save_menu', {
      p_user_id:         session.user.id,
      p_week_start_date: menu.week_start_date,
      p_days:            updatedDays,
      p_parameters:      menu.parameters ?? {},
    })
    setSaving(false)
  }

  async function deleteMenu() {
    setDeleting(true)
    await supabase.from('weekly_menus').delete().eq('id', menu.id)
    setMenu(null)
    setConfirmDelete(false)
    setDeleting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col bg-sand-50 min-h-full pb-8">
      {/* Header */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold">Veckomenyer</h1>
      </div>
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {!menu ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <span className="text-6xl">📅</span>
            <p className="text-gray-600 font-medium">Ingen meny skapad ännu</p>
            <button
              onClick={() => navigate('/meny/ny')}
              className="px-6 py-3 bg-forest-600 text-white font-semibold rounded-2xl shadow"
            >
              Generera din första meny
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            {/* Menu header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-800">Vecka {isoWeek(menu.week_start_date)}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateRange(menu.week_start_date)}</p>
              </div>
              <div className="flex items-center gap-3">
                {saving && (
                  <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                <button
                  onClick={() => navigate('/meny/historik')}
                  className="text-xs text-forest-600 font-medium"
                >
                  Historik
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 active:text-red-500 transition"
                  aria-label="Ta bort meny"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Recipe rows */}
            {DAYS_ORDER.filter(day => day in (menu.days ?? {})).map(day => {
              const recipeId = getDayRecipeId(menu.days[day])
              const cook     = getDayCook(menu.days[day])
              const recipe   = recipeId ? recipeMap[recipeId] : null
              const totalMin = recipe ? (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0) : 0

              return (
                <div key={day} className="flex gap-3 items-center py-3 border-b border-gray-50 last:border-0">
                  {/* Day label */}
                  <div className="flex-shrink-0 w-10 text-center">
                    <span className="text-xs font-semibold text-gray-400 uppercase">{day.slice(0, 3)}</span>
                    {cook && (
                      <span className={`block text-xs font-semibold mt-0.5 ${cook === 'Nikki' ? 'text-purple-500' : 'text-blue-500'}`}>{cook}</span>
                    )}
                  </div>

                  {recipe ? (
                    <>
                      {/* Clickable recipe area */}
                      <button
                        onClick={() => navigate(`/recept/${recipe.id}`)}
                        className="flex gap-3 items-center flex-1 min-w-0 text-left active:opacity-70 transition"
                      >
                        {recipe.image_url ? (
                          <img src={recipe.image_url} alt={recipe.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">🍽️</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{recipe.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {(recipe.tags ?? []).slice(0, 2).map(tag => (
                              <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${tagStyle(tag)}`}>{tag}</span>
                            ))}
                            {totalMin > 0 && <span className="text-xs text-gray-400">{totalMin} min</span>}
                          </div>
                        </div>
                      </button>

                      {/* Swap button */}
                      <button
                        onClick={() => openSwap(day)}
                        className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 active:bg-sand-100 transition"
                        aria-label={`Byt ut ${day}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M4 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C6.02 12.537 6 12.768 6 13c0 1.105.895 2 2 2h7a1 1 0 000-2H8.414l.993-.993A.997.997 0 009 12H7.414l-.305-1.222A1 1 0 006.119 10H5.119L4 3z" />
                          <path d="M16 16a2 2 0 11-4 0 2 2 0 014 0zM6 18a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                        <span className="text-xs font-medium">Byt</span>
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic flex-1">Ingen planerad</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-mobile bg-white rounded-t-3xl p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-gray-800 text-base">Ta bort menyn?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Vecka {isoWeek(menu?.week_start_date)} tas bort permanent. Recepten påverkas inte.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 border border-gray-200 rounded-2xl text-gray-700 font-semibold text-sm"
              >
                Avbryt
              </button>
              <button
                onClick={deleteMenu}
                disabled={deleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-semibold text-sm disabled:opacity-60"
              >
                {deleting ? 'Tar bort…' : 'Ta bort'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap modal */}
      {swapDay && (
        <SwapModal
          options={swapOptions}
          onSelect={applySwap}
          onClose={() => setSwapDay(null)}
        />
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/meny/ny')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-forest-600 hover:bg-forest-700 text-white rounded-full shadow-lg flex items-center justify-center transition active:scale-95 z-40"
        aria-label="Generera ny meny"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
          <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
