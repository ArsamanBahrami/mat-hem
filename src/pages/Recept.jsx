import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TAG_GROUPS, tagStyle } from '../lib/tags'

function RecipeCard({ recipe, onClick }) {
  const totalMin = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  const visibleTags = (recipe.tags ?? []).slice(0, 3)

  return (
    <button
      onClick={onClick}
      className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm active:scale-[0.98] transition text-left"
    >
      {recipe.image_url ? (
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="w-full h-36 object-cover bg-sand-100"
        />
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-forest-50 to-sand-100 flex items-center justify-center">
          <span className="text-4xl">🍽️</span>
        </div>
      )}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">
          {recipe.title}
        </h3>
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {visibleTags.map(tag => (
            <span
              key={tag}
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagStyle(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
        {totalMin > 0 && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
            {totalMin} min
          </p>
        )}
      </div>
    </button>
  )
}

export default function Recept() {
  const navigate = useNavigate()
  const [recipes, setRecipes]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [userId, setUserId]         = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      const { data, error } = await supabase.rpc('fetch_recipes', {
        p_user_id: session.user.id,
      })
      if (error) console.error('fetch_recipes:', error.message)
      else setRecipes(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function toggleTag(tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const filtered = useMemo(() => {
    let list = recipes
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.title.toLowerCase().includes(q))
    }
    if (activeTags.length) {
      list = list.filter(r =>
        activeTags.every(t => (r.tags ?? []).includes(t))
      )
    }
    return list
  }, [recipes, search, activeTags])

  return (
    <div className="flex flex-col min-h-full bg-sand-50">
      {/* Header */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold mb-4">Receptbank</h1>
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            placeholder="Sök recept…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
        </div>
      </div>

      {/* Rounded top of sand bg */}
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      {/* Tag filters */}
      <div className="px-4 pt-3 pb-1 flex flex-col gap-2">
        {Object.entries(TAG_GROUPS).map(([group, tags]) => (
          <div key={group}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group}</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => {
                const active = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition ${tagStyle(tag, active)}`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {activeTags.length > 0 && (
          <button
            onClick={() => setActiveTags([])}
            className="text-xs text-forest-600 font-medium self-start mt-0.5"
          >
            Rensa filter ×
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-sand-100 animate-pulse h-52" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📖</span>
            <p className="text-gray-600 font-medium">
              {recipes.length === 0
                ? 'Inga recept ännu\u00a0— lägg till ditt första!'
                : 'Inga recept matchar filtret'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => navigate(`/recept/${recipe.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/recept/ny')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-forest-600 hover:bg-forest-700 text-white rounded-full shadow-lg flex items-center justify-center transition active:scale-95 z-40"
        aria-label="Lägg till recept"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
          <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
