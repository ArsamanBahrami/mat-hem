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

function SamlingarTab({ userId }) {
  const navigate         = useNavigate()
  const [collections,    setCollections]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [showCreate,     setShowCreate]     = useState(false)
  const [newName,        setNewName]        = useState('')
  const [newEmoji,       setNewEmoji]       = useState('')
  const [saving,         setSaving]         = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.rpc('fetch_collections', { p_user_id: userId })
    setCollections(data ?? [])
    setLoading(false)
  }

  async function createCollection() {
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase.rpc('create_collection', {
      p_user_id: userId,
      p_name:    newName.trim(),
      p_emoji:   newEmoji.trim() || null,
    })
    if (data && !data.error) {
      setCollections(prev => [data, ...prev])
      setNewName('')
      setNewEmoji('')
      setShowCreate(false)
    }
    setSaving(false)
  }

  async function deleteCollection(id) {
    await supabase.rpc('delete_collection', { p_user_id: userId, p_collection_id: id })
    setCollections(prev => prev.filter(c => c.id !== id))
    setConfirmDeleteId(null)
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {collections.length} {collections.length === 1 ? 'samling' : 'samlingar'}
        </p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-forest-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
          </svg>
          Ny samling
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-sand-200">
          <p className="font-semibold text-gray-700 text-sm">Ny samling</p>
          <div className="flex gap-2">
            <input
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              placeholder="🍽️"
              maxLength={2}
              className="w-14 text-center text-xl px-2 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCollection()}
              placeholder="T.ex. Favoritrecept"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewEmoji('') }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium"
            >
              Avbryt
            </button>
            <button
              onClick={createCollection}
              disabled={!newName.trim() || saving}
              className="flex-1 py-2.5 bg-forest-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Sparar…' : 'Skapa'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-sand-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-3">📚</span>
          <p className="text-gray-500 text-sm">Inga samlingar ännu — skapa din första!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {collections.map(col => (
            <div key={col.id}>
              {confirmDeleteId === col.id ? (
                <div className="bg-red-50 rounded-2xl p-4 flex flex-col gap-3 border border-red-100">
                  <p className="text-sm text-red-700">
                    Ta bort <span className="font-bold">{col.name}</span>?
                    Recepten tas inte bort.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={() => deleteCollection(col.id)}
                      className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => navigate(`/samlingar/${col.id}`)}
                    className="w-full pr-12 p-4 flex items-center gap-3 text-left active:bg-sand-50 transition"
                  >
                    <span className="text-2xl w-10 flex-shrink-0 text-center">
                      {col.emoji || '📁'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{col.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {col.recipe_count} recept
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 flex-shrink-0">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(col.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Recept() {
  const navigate = useNavigate()
  const [recipes,    setRecipes]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [ingSearch,  setIngSearch]  = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [userId,     setUserId]     = useState(null)
  const [view,       setView]       = useState('recept') // 'recept' | 'samlingar'

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
    if (ingSearch.trim()) {
      const terms = ingSearch.toLowerCase().split(/\s+/).filter(Boolean)
      list = list.filter(r =>
        terms.every(term =>
          (r.ingredients ?? []).some(ing =>
            (ing.name ?? '').toLowerCase().includes(term)
          )
        )
      )
    }
    if (activeTags.length) {
      list = list.filter(r =>
        activeTags.every(t => (r.tags ?? []).includes(t))
      )
    }
    return list
  }, [recipes, search, ingSearch, activeTags])

  const ingSearchActive = ingSearch.trim().length > 0

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

      {/* Rounded top */}
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-gray-100 px-4">
        {['recept', 'samlingar'].map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition capitalize ${
              view === tab
                ? 'border-forest-600 text-forest-700'
                : 'border-transparent text-gray-400'
            }`}
          >
            {tab === 'recept' ? 'Recept' : 'Samlingar'}
          </button>
        ))}
      </div>

      {view === 'samlingar' ? (
        userId && <SamlingarTab userId={userId} />
      ) : (
        <>
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

          {/* Ingredient search */}
          <div className="px-4 pt-2 pb-3">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM14 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
              </svg>
              <input
                type="search"
                placeholder="Ingredienser du har hemma, t.ex. kyckling pasta…"
                value={ingSearch}
                onChange={e => setIngSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
              />
              {ingSearchActive && (
                <button
                  onClick={() => setIngSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
            {ingSearchActive && (
              <p className="text-xs text-forest-700 font-medium mt-1.5 px-1">
                {filtered.length} {filtered.length === 1 ? 'recept matchar' : 'recept matchar'} dina ingredienser
              </p>
            )}
          </div>

          {/* Grid */}
          <div className="flex-1 px-4 pb-4">
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
        </>
      )}

      {/* FAB (only in recept view) */}
      {view === 'recept' && (
        <button
          onClick={() => navigate('/recept/ny')}
          className="fixed bottom-24 right-4 w-14 h-14 bg-forest-600 hover:bg-forest-700 text-white rounded-full shadow-lg flex items-center justify-center transition active:scale-95 z-40"
          aria-label="Lägg till recept"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  )
}
