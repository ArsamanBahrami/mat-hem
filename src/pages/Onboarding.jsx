import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ onComplete, userId }) {
  const [mode,          setMode]          = useState('create') // 'create' | 'join'
  const [displayName,   setDisplayName]   = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode,    setInviteCode]    = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Ingen aktiv session — försök logga in igen.')

      let profile

      if (mode === 'create') {
        const { data, error } = await supabase.rpc('setup_onboarding', {
          p_user_id:      session.user.id,
          p_household:    householdName.trim(),
          p_display_name: displayName.trim(),
        })
        if (error) throw error
        profile = data
      } else {
        const { data, error } = await supabase.rpc('join_household_by_code', {
          p_user_id:      session.user.id,
          p_code:         inviteCode.trim().toUpperCase(),
          p_display_name: displayName.trim(),
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        profile = data
      }

      onComplete(profile)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand-50 px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-forest-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="text-2xl font-bold text-forest-700">Välkommen till Matvis!</h1>
          <p className="text-gray-500 mt-1 text-sm">Berätta lite om dig och ditt hushåll.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-sand-100 rounded-xl p-1 mb-5">
          <button
            type="button"
            onClick={() => { setMode('create'); setError(null) }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
              mode === 'create' ? 'bg-white text-forest-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Skapa hushåll
          </button>
          <button
            type="button"
            onClick={() => { setMode('join'); setError(null) }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
              mode === 'join' ? 'bg-white text-forest-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Gå med
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-sand-200 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Vad heter du?
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="T.ex. Nikki"
                className={inputCls}
              />
            </div>

            {mode === 'create' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vad heter ert hushåll?
                </label>
                <input
                  type="text"
                  required
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  placeholder="T.ex. Familjen Bahrami"
                  className={inputCls}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Inbjudningskod
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="T.ex. ABC123"
                  maxLength={6}
                  className={inputCls + ' tracking-widest font-mono text-center text-lg uppercase'}
                  autoCapitalize="characters"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Be den som skapat hushållet om deras 6-teckens kod.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-xl transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading
                ? 'Sparar...'
                : mode === 'create' ? 'Skapa hushåll' : 'Gå med i hushållet'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
