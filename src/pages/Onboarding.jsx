import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ onComplete, userId }) {
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Ingen aktiv session — försök logga in igen.')

      const { data: profile, error } = await supabase.rpc('setup_onboarding', {
        p_user_id:      session.user.id,
        p_household:    householdName.trim(),
        p_display_name: displayName.trim(),
      })

      if (error) throw error

      onComplete(profile)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand-50 px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-forest-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="text-2xl font-bold text-forest-700">Valkymen till Mat-hem!</h1>
          <p className="text-gray-500 mt-1 text-sm">Berätta lite om dig och ditt hushåll.</p>
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
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="T.ex. Arsi"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Vad heter ert hushåll?
              </label>
              <input
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="T.ex. Familjen Bahrami"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-xl transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Sparar...' : 'Kom igång!'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
