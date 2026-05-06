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

// Stödjer både gammalt format {dag: "uuid"} och nytt {dag: {recipe_id, cook}}
function getDayRecipeId(val) {
  if (!val) return null
  return typeof val === 'string' ? val : (val.recipe_id ?? null)
}
function getDayCook(val) {
  if (!val || typeof val === 'string') return null
  return val.cook ?? null
}

function RecipeCard({ recipe, day, cook, onClick }) {
  const totalMin = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  return (
    <button onClick={onClick} className="flex gap-3 items-center py-3 border-b border-gray-50 last:border-0 w-full text-left active:bg-sand-50 transition rounded-xl -mx-1 px-1">
      <div className="flex-shrink-0 w-12 text-center">
        <span className="text-xs font-semibold text-gray-400 uppercase">{day.slice(0, 3)}</span>
        {cook && (
          <span className={`block text-xs font-semibold mt-0.5 ${
            cook === 'Nikki' ? 'text-purple-500' : 'text-blue-500'
          }`}>{cook}</span>
        )}
      </div>
      {recipe.image_url ? (
        <img src={recipe.image_url} alt={recipe.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🍽️</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{recipe.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {(recipe.tags ?? []).slice(0, 2).map(tag => (
            <span key={tag} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagStyle(tag)}`}>
              {tag}
            </span>
          ))}
          {totalMin > 0 && (
            <span className="text-xs text-gray-400">{totalMin} min</span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function Meny() {
  const navigate = useNavigate()
  const [menu,    setMenu]    = useState(undefined)   // undefined = loading, null = no menu
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

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
          /* ── Tom state ── */
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
          /* ── Aktuell meny ── */
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-800">Vecka {isoWeek(menu.week_start_date)}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateRange(menu.week_start_date)}</p>
              </div>
              <button
                onClick={() => navigate('/meny/historik')}
                className="text-xs text-forest-600 font-medium"
              >
                Historik
              </button>
            </div>

            {DAYS_ORDER.filter(day => day in (menu.days ?? {})).map(day => {
              const recipeId = getDayRecipeId(menu.days[day])
              const cook     = getDayCook(menu.days[day])
              const recipe   = recipeId ? recipeMap[recipeId] : null
              return recipe ? (
                <RecipeCard key={day} recipe={recipe} day={day} cook={cook} onClick={() => navigate(`/recept/${recipe.id}`)} />
              ) : (
                <div key={day} className="flex gap-3 items-center py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className="text-xs font-semibold text-gray-400 uppercase">{day.slice(0, 3)}</span>
                  </div>
                  <p className="text-sm text-gray-400 italic">Ingen planerad</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
