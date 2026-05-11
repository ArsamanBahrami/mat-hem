import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tagStyle } from '../lib/tags'

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

export default function SamlingDetalj() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [recipes,  setRecipes]  = useState([])
  const [name,     setName]     = useState('')
  const [emoji,    setEmoji]    = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [colRes, recRes] = await Promise.all([
        supabase.rpc('fetch_collections', { p_user_id: session.user.id }),
        supabase.rpc('fetch_collection_recipes', {
          p_user_id:      session.user.id,
          p_collection_id: id,
        }),
      ])

      const col = (colRes.data ?? []).find(c => c.id === id)
      if (col) { setName(col.name); setEmoji(col.emoji ?? '') }
      setRecipes(recRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  return (
    <div className="flex flex-col bg-sand-50 min-h-full">
      {/* Header */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-5 flex items-center gap-3">
        <button onClick={() => navigate('/recept')} className="p-1 -ml-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-xl font-bold truncate">
          {emoji ? `${emoji} ${name}` : name || 'Samling'}
        </h1>
      </div>
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-sand-100 animate-pulse h-52" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📭</span>
            <p className="text-gray-600 font-medium">Inga recept i samlingen ännu</p>
            <p className="text-gray-400 text-sm mt-1">Lägg till från ett recepts detaljsida</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => navigate(`/recept/${recipe.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
