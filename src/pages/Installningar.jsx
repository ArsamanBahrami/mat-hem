import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const APP_VERSION = '0.1.0'

export default function Installningar({ profile }) {
  const navigate   = useNavigate()
  const [inviteCode, setInviteCode] = useState(profile?.households?.invite_code ?? null)
  const [copied,     setCopied]     = useState(false)

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
      {/* ── Header ── */}
      <div className="bg-forest-600 text-white px-5 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-forest-500 flex items-center justify-center active:bg-forest-400 transition flex-shrink-0"
            aria-label="Tillbaka"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Inställningar</h1>
        </div>
      </div>
      <div className="bg-forest-600 h-6 relative">
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-sand-50 rounded-t-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 bg-sand-50 px-5 py-5 flex flex-col gap-4 pb-8">

        {/* Profil-kort */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Profil</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-forest-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-forest-700">
                {(profile?.display_name ?? '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{profile?.display_name}</p>
              <p className="text-sm text-gray-400 truncate">{profile?.households?.name || 'Hushåll'}</p>
            </div>
          </div>
        </div>

        {/* Inbjudningskod */}
        {inviteCode && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Inbjudningskod</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold text-forest-700 tracking-widest flex-1">
                {inviteCode}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-forest-50 text-forest-700 text-xs font-semibold rounded-xl border border-forest-100 active:bg-forest-100 transition"
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

        {/* Konto */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Konto</p>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-red-500 font-medium text-sm flex items-center gap-2 border-t border-gray-50 active:bg-red-50 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Logga ut
          </button>
        </div>

        {/* App-info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">App</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Version</p>
            <p className="text-sm font-semibold text-gray-800">{APP_VERSION}</p>
          </div>
        </div>

      </div>
    </div>
  )
}
