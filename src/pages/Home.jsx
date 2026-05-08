import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const quickLinks = [
  {
    to: '/recept',
    label: 'Recept',
    description: 'Bläddra bland recept',
    emoji: '📖',
    bg: 'bg-forest-50',
    border: 'border-forest-100',
    text: 'text-forest-700',
  },
  {
    to: '/meny',
    label: 'Meny',
    description: 'Planera veckan',
    emoji: '📅',
    bg: 'bg-sand-50',
    border: 'border-sand-200',
    text: 'text-sand-700',
  },
  {
    to: '/inkop',
    label: 'Inköp',
    description: 'Handlingslistan',
    emoji: '🛒',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-700',
  },
]

export default function Home({ profile }) {
  const navigate = useNavigate()
  const [copied,     setCopied]     = useState(false)
  const [inviteCode, setInviteCode] = useState(profile?.households?.invite_code ?? null)

  useEffect(() => {
    if (inviteCode) return
    supabase.rpc('ensure_household_invite_code', { p_user_id: profile.id })
      .then(({ data }) => { if (data) setInviteCode(data) })
  }, [])

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-forest-200 text-sm font-medium mb-1">
              {profile?.households?.name || 'Ditt hushåll'}
            </p>
            <h1 className="text-2xl font-bold">
              Hej, {profile?.display_name}! 👋
            </h1>
            <p className="text-forest-200 text-sm mt-1">
              Vad ska vi äta idag?
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-forest-200 hover:text-white transition p-1"
            title="Logga ut"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Wave divider */}
      <div className="bg-forest-600 h-6 relative">
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-sand-50 rounded-t-3xl" />
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-6 pb-4">
        <h2 className="text-base font-semibold text-gray-600 mb-4 uppercase tracking-wide text-xs">
          Snabbval
        </h2>

        <div className="flex flex-col gap-3">
          {quickLinks.map(({ to, label, description, emoji, bg, border, text }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`flex items-center gap-4 p-4 rounded-2xl border ${bg} ${border} text-left transition active:scale-[0.98] hover:shadow-sm`}
            >
              <div className="text-3xl w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm flex-shrink-0">
                {emoji}
              </div>
              <div>
                <p className={`font-semibold ${text}`}>{label}</p>
                <p className="text-gray-500 text-sm">{description}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>

        {/* Inbjudningskod */}
        {inviteCode && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Inbjudningskod
            </p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold text-forest-700 tracking-widest flex-1">
                {inviteCode}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-forest-50 text-forest-700 text-xs font-semibold rounded-xl border border-forest-100 transition active:bg-forest-100"
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    Kopierat
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                    </svg>
                    Kopiera
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Dela koden med någon för att bjuda in dem till hushållet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
