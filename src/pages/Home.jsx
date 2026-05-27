import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const WEEKDAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

function getDayRecipeId(val) {
  if (!val) return null
  return typeof val === 'string' ? val : (val.recipe_id ?? null)
}

export default function Home({ profile }) {
  const navigate = useNavigate()
  const [menu,        setMenu]        = useState(undefined)
  const [recipes,     setRecipes]     = useState([])
  const [collections, setCollections] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      const [menuRes, recipesRes, colRes] = await Promise.all([
        supabase.rpc('fetch_current_menu',  { p_user_id: uid }),
        supabase.rpc('fetch_recipes',       { p_user_id: uid }),
        supabase.rpc('fetch_collections',   { p_user_id: uid }),
      ])
      setMenu(menuRes.data ?? null)
      setRecipes(recipesRes.data ?? [])
      setCollections(colRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const recipeMap     = Object.fromEntries(recipes.map(r => [r.id, r]))
  const today         = WEEKDAYS[new Date().getDay()]
  const todayRecipeId = menu?.days ? getDayRecipeId(menu.days[today]) : null
  const todayRecipe   = todayRecipeId ? recipeMap[todayRecipeId] : null
  const todayStr      = (() => {
    const s = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })()

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ── */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-forest-200 text-sm">{todayStr}</p>
            <h1 className="text-2xl font-bold mt-0.5">
              Hej, {profile?.display_name}! 👋
            </h1>
          </div>
          <button
            onClick={() => navigate('/installningar')}
            className="w-9 h-9 rounded-full bg-forest-500 flex items-center justify-center mt-1 active:bg-forest-400 transition"
            aria-label="Inställningar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Wave */}
      <div className="bg-forest-600 h-6 relative">
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-sand-50 rounded-t-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 bg-sand-50 pb-6 flex flex-col gap-6 pt-5">

        {/* Sektion 1 — Dagens mat */}
        <div className="px-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dagens mat</h2>
          {loading ? (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
              </div>
            </div>
          ) : todayRecipe ? (
            <button
              onClick={() => navigate(`/recept/${todayRecipe.id}`)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex gap-3 p-3 text-left active:bg-sand-50 transition"
            >
              {todayRecipe.image_url ? (
                <img src={todayRecipe.image_url} alt={todayRecipe.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🍽️</span>
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="font-semibold text-gray-800 truncate">{todayRecipe.title}</p>
                {((todayRecipe.prep_time_min ?? 0) + (todayRecipe.cook_time_min ?? 0)) > 0 && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                    </svg>
                    {(todayRecipe.prep_time_min ?? 0) + (todayRecipe.cook_time_min ?? 0)} min
                  </p>
                )}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 flex-shrink-0 self-center">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => navigate('/meny/ny')}
              className="w-full bg-white rounded-2xl border-2 border-dashed border-forest-200 p-4 flex items-center gap-3 text-left active:bg-forest-50 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-forest-50 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-forest-600">
                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5H3.75a.75.75 0 010-1.5h5.5V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-forest-700 text-sm">Planera veckans mat</p>
                <p className="text-xs text-gray-400 mt-0.5">Generera en veckomeny med AI</p>
              </div>
            </button>
          )}
        </div>

        {/* Sektion 2 — Dina samlingar */}
        <div>
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dina samlingar</h2>
            <button onClick={() => navigate('/recept')} className="text-xs text-forest-600 font-semibold">Visa alla</button>
          </div>

          {!loading && collections.length === 0 ? (
            <div className="px-5">
              <button
                onClick={() => navigate('/recept')}
                className="w-full bg-white rounded-2xl border-2 border-dashed border-gray-200 p-4 flex items-center gap-3 active:bg-gray-50 transition"
              >
                <span className="text-2xl">📚</span>
                <p className="text-sm font-medium text-gray-500">Skapa din första samling</p>
              </button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
              {collections.map(col => (
                <button
                  key={col.id}
                  onClick={() => navigate(`/samlingar/${col.id}`)}
                  className="flex-shrink-0 w-36 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left active:bg-sand-50 transition"
                >
                  <span className="text-3xl">{col.emoji || '📁'}</span>
                  <p className="font-semibold text-sm text-gray-800 mt-2 truncate">{col.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{col.recipe_count} recept</p>
                </button>
              ))}
              <button
                onClick={() => navigate('/recept')}
                className="flex-shrink-0 w-36 bg-white rounded-2xl p-4 shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 active:bg-gray-50 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5H3.75a.75.75 0 010-1.5h5.5V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-400 text-center">Ny samling</p>
              </button>
            </div>
          )}
        </div>

        {/* Sektion 3 — Snabbval */}
        <div className="px-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Snabbval</h2>
          <div className="flex gap-2">
            {[
              { to: '/recept', label: 'Recept', emoji: '📖' },
              { to: '/meny',   label: 'Meny',   emoji: '📅' },
              { to: '/inkop',  label: 'Inköp',  emoji: '🛒' },
            ].map(({ to, label, emoji }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex-1 bg-white rounded-2xl py-3 flex flex-col items-center gap-1 shadow-sm border border-gray-100 active:bg-sand-50 transition"
              >
                <span className="text-xl">{emoji}</span>
                <p className="text-xs font-semibold text-gray-700">{label}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
