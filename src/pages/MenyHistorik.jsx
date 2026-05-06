import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ALL_DAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

function isoWeek(dateStr) {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startW1 = new Date(jan4)
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  return Math.ceil(((d - startW1) / 86400000 + 1) / 7)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MenyHistorik() {
  const navigate = useNavigate()
  const [menus,   setMenus]   = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/'); return }

      const [menuRes, recipesRes] = await Promise.all([
        supabase.rpc('fetch_menu_history', { p_user_id: session.user.id, p_limit: 20 }),
        supabase.rpc('fetch_recipes', { p_user_id: session.user.id }),
      ])
      setMenus(menuRes.data ?? [])
      setRecipes(recipesRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const recipeMap = Object.fromEntries(recipes.map(r => [r.id, r]))

  return (
    <div className="flex flex-col bg-sand-50 min-h-full pb-8">
      <div className="bg-forest-600 text-white px-5 pt-12 pb-5 flex items-center gap-3">
        <button onClick={() => navigate('/meny')} className="p-1 -ml-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Menyhistorik</h1>
      </div>
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : menus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-5xl">📋</span>
            <p className="text-gray-500">Inga sparade menyer ännu</p>
          </div>
        ) : (
          menus.map(menu => {
            const daysInMenu = ALL_DAYS.filter(d => d in (menu.days ?? {}))
            return (
              <div key={menu.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="font-bold text-gray-800">Vecka {isoWeek(menu.week_start_date)}</h2>
                  <span className="text-xs text-gray-400">{formatDate(menu.week_start_date)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {daysInMenu.map(day => {
                    const recipe = menu.days[day] ? recipeMap[menu.days[day]] : null
                    return (
                      <div key={day} className="flex gap-3 items-center">
                        <span className="text-xs font-semibold text-gray-400 w-8 uppercase">{day.slice(0, 3)}</span>
                        <span className="text-sm text-gray-700 truncate">
                          {recipe ? recipe.title : <span className="text-gray-400 italic">Inget</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
