import { useEffect, useRef, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['grönsaker', 'kött & fisk', 'mejeri & ägg', 'torrvaror & konserver', 'övrigt']
const CAT_STYLE = {
  'grönsaker':           { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  'kött & fisk':         { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  'mejeri & ägg':        { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'torrvaror & konserver':{ bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  'övrigt':              { bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400' },
}
const QUEUE_KEY = 'inkop_pending_sync'
const ALL_DAYS  = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

function isoWeek(dateStr) {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startW1 = new Date(jan4)
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  return Math.ceil(((d - startW1) / 86400000 + 1) / 7)
}

// ── Item row ────────────────────────────────────────────────────────────────
function ItemRow({ item, onToggle, onDelete }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 ${item.checked ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
          item.checked ? 'bg-forest-600 border-forest-600' : 'border-gray-300'
        }`}
      >
        {item.checked && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm text-gray-800 ${item.checked ? 'line-through text-gray-400' : ''}`}>
        {item.name}
      </span>
      {(item.quantity != null || item.unit) && (
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {item.quantity != null ? item.quantity : ''}{item.unit ? '\u00a0' + item.unit : ''}
        </span>
      )}
      <button type="button" onClick={() => onDelete(item.id)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Inkop() {
  const navigate = useNavigate()

  // Core state
  const [phase, setPhase]           = useState('loading') // loading | empty | list | create
  const [list, setList]             = useState(null)
  const [items, setItems]           = useState([])
  const [pendingSync, setPendingSync] = useState(false)

  // Create from menu
  const [menus, setMenus]           = useState([])
  const [recipes, setRecipes]       = useState([])
  const [selectedMenuId, setSelectedMenuId] = useState('')
  const [portions, setPortions]     = useState({})   // {day: number}
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState(null)

  // Add item manually
  const [addText, setAddText]       = useState('')

  // Delete list confirm
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Session
  const [session, setSession]       = useState(null)

  // Refs for stable closures
  const listRef     = useRef(null)
  const itemsRef    = useRef([])
  const pendingRef  = useRef(false)

  useEffect(() => { listRef.current  = list  }, [list])
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { pendingRef.current = pendingSync }, [pendingSync])

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/'); return }
      setSession(session)

      const { data } = await supabase.rpc('fetch_shopping_list', { p_user_id: session.user.id })
      if (data) {
        setList(data)
        setItems(data.items ?? [])
        setPhase('list')
      } else {
        setPhase('empty')
      }

      // Process any offline queue on load
      processQueue(session)
    }
    load()
  }, [])

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!list?.id) return

    const channel = supabase
      .channel(`shopping_list_${list.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shopping_lists',
        filter: `id=eq.${list.id}`,
      }, (payload) => {
        // Only accept remote update if we have no pending local changes
        if (!pendingRef.current) {
          setItems(payload.new?.items ?? [])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [list?.id])

  // ── Online event → flush queue ──────────────────────────────────────────
  useEffect(() => {
    async function handleOnline() {
      const sess = session
      if (!sess || !listRef.current || !pendingRef.current) return
      await processQueue(sess)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [session])

  async function processQueue(sess) {
    try {
      const pending = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? 'null')
      if (!pending) return
      await supabase.rpc('update_shopping_list_items', {
        p_user_id: sess.user.id,
        p_list_id: pending.listId,
        p_items:   pending.items,
      })
      localStorage.removeItem(QUEUE_KEY)
      setPendingSync(false)
    } catch {
      // stay pending until next retry
    }
  }

  // ── Toggle item (with offline support) ─────────────────────────────────
  async function toggleItem(itemId) {
    const newItems = items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
    setItems(newItems)

    if (!list) return
    if (navigator.onLine && session) {
      await supabase.rpc('update_shopping_list_items', {
        p_user_id: session.user.id,
        p_list_id: list.id,
        p_items:   newItems,
      })
    } else {
      localStorage.setItem(QUEUE_KEY, JSON.stringify({ listId: list.id, items: newItems }))
      setPendingSync(true)
    }
  }

  // ── Delete item ─────────────────────────────────────────────────────────
  async function deleteItem(itemId) {
    const newItems = items.filter(i => i.id !== itemId)
    setItems(newItems)
    if (list && session) {
      await supabase.rpc('update_shopping_list_items', {
        p_user_id: session.user.id,
        p_list_id: list.id,
        p_items:   newItems,
      })
    }
  }

  // ── Clear checked ───────────────────────────────────────────────────────
  async function clearChecked() {
    const newItems = items.filter(i => !i.checked)
    setItems(newItems)
    if (list && session) {
      await supabase.rpc('update_shopping_list_items', {
        p_user_id: session.user.id,
        p_list_id: list.id,
        p_items:   newItems,
      })
    }
  }

  // ── Add item manually ───────────────────────────────────────────────────
  async function addItem() {
    const name = addText.trim()
    if (!name) return
    const newItem = { id: crypto.randomUUID(), name, quantity: null, unit: '', category: 'övrigt', checked: false }
    const newItems = [...items, newItem]
    setItems(newItems)
    setAddText('')
    if (list && session) {
      await supabase.rpc('update_shopping_list_items', {
        p_user_id: session.user.id,
        p_list_id: list.id,
        p_items:   newItems,
      })
    }
  }

  // ── Create empty list ───────────────────────────────────────────────────
  async function createEmptyList() {
    if (!session) return
    const { data } = await supabase.rpc('save_shopping_list', {
      p_user_id: session.user.id,
      p_items:   [],
    })
    if (data) { setList(data); setItems([]); setPhase('list') }
  }

  // ── Delete shopping list ─────────────────────────────────────────────────
  async function deleteList() {
    if (!list || !session) return
    await supabase.rpc('delete_shopping_list', { p_user_id: session.user.id, p_list_id: list.id })
    localStorage.removeItem(QUEUE_KEY)
    setList(null)
    setItems([])
    setConfirmDelete(false)
    setPhase('empty')
  }

  // ── Open create-from-menu flow ──────────────────────────────────────────
  async function openCreateMenu() {
    setGenError(null)
    setConfirmDelete(false)
    setPhase('create')
    if (menus.length === 0) {
      const [menuRes, recipeRes] = await Promise.all([
        supabase.rpc('fetch_menu_history', { p_user_id: session.user.id, p_limit: 10 }),
        supabase.rpc('fetch_recipes',       { p_user_id: session.user.id }),
      ])
      const m = menuRes.data ?? []
      setMenus(m)
      setRecipes(recipeRes.data ?? [])
      if (m.length > 0) {
        setSelectedMenuId(m[0].id)
        initPortions(m[0])
      }
    }
  }

  function initPortions(menu) {
    const p = {}
    for (const day of Object.keys(menu.days ?? {})) p[day] = 4
    setPortions(p)
  }

  function handleMenuSelect(menuId) {
    setSelectedMenuId(menuId)
    const m = menus.find(m => m.id === menuId)
    if (m) initPortions(m)
  }

  // ── Generate shopping list from menu ────────────────────────────────────
  async function generateFromMenu() {
    const menu = menus.find(m => m.id === selectedMenuId)
    if (!menu || !session) return
    setGenerating(true)
    setGenError(null)

    try {
      // Fetch full recipe data for each day in parallel
      const days = ALL_DAYS.filter(d => d in menu.days && menu.days[d])
      const recipeIds = [...new Set(days.map(d => {
        const v = menu.days[d]
        return typeof v === 'string' ? v : v?.recipe_id
      }).filter(Boolean))]

      const recipeDetails = await Promise.all(
        recipeIds.map(rid =>
          supabase.rpc('fetch_recipe', { p_user_id: session.user.id, p_recipe_id: rid })
            .then(r => r.data)
        )
      )
      const recipeMap = Object.fromEntries(recipeDetails.filter(Boolean).map(r => [r.id, r]))

      // Build payload — one entry per day (same recipe may appear multiple times)
      const payload = days
        .map(d => {
          const v = menu.days[d]
          const rid = typeof v === 'string' ? v : v?.recipe_id
          const r = rid ? recipeMap[rid] : null
          if (!r) return null
          return {
            title:             r.title,
            ingredients:       r.ingredients ?? [],
            original_servings: r.servings ?? 4,
            desired_servings:  portions[d] ?? 4,
          }
        })
        .filter(Boolean)

      if (!payload.length) { setGenError('Menyn har inga recept med ingredienser.'); return }

      const res  = await fetch('/.netlify/functions/generate-shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes: payload }),
      })
      const json = await res.json()
      if (json.error) { setGenError(json.error); return }

      const { data } = await supabase.rpc('save_shopping_list', {
        p_user_id: session.user.id,
        p_items:   json,
        p_menu_id: menu.id,
      })
      if (!data) { setGenError('Kunde inte spara listan — försök igen.'); return }

      setList(data)
      setItems(json)
      setPhase('list')
    } catch (err) {
      setGenError(err.message ?? 'Något gick fel — försök igen.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Grouped items ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const g = Object.fromEntries(CATEGORIES.map(c => [c, []]))
    for (const item of items) {
      const cat = CATEGORIES.includes(item.category) ? item.category : 'övrigt'
      g[cat].push(item)
    }
    for (const cat of CATEGORIES) {
      g[cat].sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0))
    }
    return g
  }, [items])

  const hasChecked = items.some(i => i.checked)

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col bg-sand-50 min-h-full pb-8">
      {/* Header */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold">Inköpslista</h1>
      </div>
      <div className="bg-forest-600 h-4 relative">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-sand-50 rounded-t-3xl" />
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Pending sync banner */}
        {pendingSync && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 text-amber-500">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Du är offline — ändringar sparas när du är uppkopplad igen
          </div>
        )}

        {/* ── Tom state ── */}
        {phase === 'empty' && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
            <span className="text-6xl">🛒</span>
            <p className="text-gray-600 font-medium">Ingen aktiv inköpslista</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={openCreateMenu}
                className="w-full py-3.5 bg-forest-600 text-white font-semibold rounded-2xl shadow"
              >
                Skapa från veckomenyn
              </button>
              <button
                onClick={createEmptyList}
                className="w-full py-3.5 border-2 border-forest-600 text-forest-600 font-semibold rounded-2xl"
              >
                Tom lista
              </button>
            </div>
          </div>
        )}

        {/* ── Skapa från meny ── */}
        {phase === 'create' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Välj veckomeny</h2>
              <button onClick={() => { setPhase(list ? 'list' : 'empty'); setConfirmDelete(false) }} className="text-sm text-gray-400">Avbryt</button>
            </div>

            {menus.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">Inga sparade menyer hittades</p>
            ) : (
              <>
                <select
                  value={selectedMenuId}
                  onChange={e => handleMenuSelect(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest-400"
                >
                  {menus.map(m => (
                    <option key={m.id} value={m.id}>Vecka {isoWeek(m.week_start_date)}</option>
                  ))}
                </select>

                {selectedMenuId && (() => {
                  const menu = menus.find(m => m.id === selectedMenuId)
                  if (!menu) return null
                  const recipeMap = Object.fromEntries(recipes.map(r => [r.id, r]))
                  const days = ALL_DAYS.filter(d => {
                    const v = menu.days?.[d]
                    return v && (typeof v === 'string' ? v : v?.recipe_id)
                  })
                  return (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Portioner per dag</p>
                      {days.map(day => {
                        const v = menu.days[day]
                        const rid = typeof v === 'string' ? v : v?.recipe_id
                        const recipe = rid ? recipeMap[rid] : null
                        return (
                          <div key={day} className="flex items-center justify-between gap-3 bg-sand-50 rounded-xl px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-500 uppercase">{day.slice(0, 3)}</p>
                              <p className="text-sm text-gray-700 truncate">{recipe?.title ?? '—'}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button type="button" onClick={() => setPortions(p => ({ ...p, [day]: Math.max(1, (p[day] ?? 4) - 1) }))}
                                className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-full text-forest-600 font-bold text-lg leading-none">−</button>
                              <span className="text-sm font-semibold text-gray-700 w-5 text-center">{portions[day] ?? 4}</span>
                              <button type="button" onClick={() => setPortions(p => ({ ...p, [day]: (p[day] ?? 4) + 1 }))}
                                className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-full text-forest-600 font-bold text-lg leading-none">+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {genError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl">{genError}</p>}

                <button
                  onClick={generateFromMenu}
                  disabled={generating || !selectedMenuId}
                  className="w-full py-4 bg-forest-600 text-white font-semibold rounded-2xl shadow disabled:opacity-60 flex items-center justify-center gap-3 transition"
                >
                  {generating ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Genererar inköpslista…
                    </>
                  ) : 'Generera inköpslista'}
                </button>

                {list && (
                  <div className="border-t border-gray-100 pt-3">
                    {confirmDelete ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-500">Ta bort nuvarande inköpslista?</span>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-400 px-3 py-1.5">Avbryt</button>
                          <button onClick={deleteList} className="text-sm text-red-600 font-semibold px-3 py-1.5 bg-red-50 rounded-xl">Ja, ta bort</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full text-sm text-red-500 py-2 text-center"
                      >
                        Ta bort inköpslista
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Lista ── */}
        {phase === 'list' && (
          <>
            {CATEGORIES.map(cat => {
              const catItems = grouped[cat]
              if (!catItems.length) return null
              const s = CAT_STYLE[cat]
              return (
                <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className={`flex items-center gap-2 px-4 py-2.5 ${s.bg}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{cat}</span>
                    <span className={`text-xs ml-auto ${s.text} opacity-60`}>
                      {catItems.filter(i => !i.checked).length}/{catItems.length}
                    </span>
                  </div>
                  <div className="px-4">
                    {catItems.map(item => (
                      <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Lägg till vara */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex gap-2">
                <input
                  value={addText}
                  onChange={e => setAddText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  placeholder="Lägg till vara…"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest-400"
                />
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!addText.trim()}
                  className="px-4 py-2.5 bg-forest-600 text-white text-sm font-medium rounded-xl disabled:opacity-40"
                >
                  Lägg till
                </button>
              </div>
            </div>

            {/* Rensa avbockade + ny lista */}
            <div className="flex gap-3">
              {hasChecked && (
                <button
                  onClick={clearChecked}
                  className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm text-gray-500 font-medium"
                >
                  Rensa avbockade
                </button>
              )}
              <button
                onClick={openCreateMenu}
                className="flex-1 py-3 border border-forest-200 rounded-2xl text-sm text-forest-600 font-medium"
              >
                Ny lista
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
