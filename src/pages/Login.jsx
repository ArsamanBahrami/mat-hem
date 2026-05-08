import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Kolla din e-post och bekrafta kontot, sedan kan du logga in.')
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand-50 px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-forest-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold text-forest-700 tracking-tight">Matvis</h1>
          <p className="text-gray-500 mt-1 text-sm">Familjens matplanering</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-sand-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">
            {mode === 'login' ? 'Logga in' : 'Skapa konto'}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                E-postadress
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@email.se"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Losenord
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            {success && (
              <p className="text-sm text-forest-700 bg-forest-50 px-3 py-2 rounded-lg">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-xl transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Laddar...' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {mode === 'login' ? (
              <>
                Inget konto?{' '}
                <button
                  onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
                  className="text-forest-600 font-medium hover:underline"
                >
                  Registrera dig
                </button>
              </>
            ) : (
              <>
                Har du redan ett konto?{' '}
                <button
                  onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                  className="text-forest-600 font-medium hover:underline"
                >
                  Logga in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
