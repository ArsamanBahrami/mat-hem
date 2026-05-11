import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Recept from './pages/Recept'
import ReceptDetalj from './pages/ReceptDetalj'
import ReceptFormulär from './pages/ReceptFormulär'
import Meny from './pages/Meny'
import MenyNy from './pages/MenyNy'
import MenyHistorik from './pages/MenyHistorik'
import Inkop from './pages/Inkop'
import SamlingDetalj from './pages/SamlingDetalj'
import OfflineBanner from './components/OfflineBanner'
import InstallBanner from './components/InstallBanner'
import PwaOnboarding from './components/PwaOnboarding'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return

    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('profiles')
      .select('*, households(name, invite_code)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Profil-fetch fel:', error.message)
        setProfile(data)
        setLoading(false)
      })
  }, [session])

  if (loading || session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <OfflineBanner />
      <InstallBanner />
      {!session ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : !profile ? (
        <Routes>
          <Route path="*" element={<Onboarding onComplete={setProfile} userId={session.user.id} />} />
        </Routes>
      ) : (
        <>
        <PwaOnboarding />
        <Routes>
          <Route element={<Layout profile={profile} />}>
            <Route path="/" element={<Home profile={profile} />} />
            <Route path="/recept" element={<Recept />} />
            <Route path="/recept/ny" element={<ReceptFormulär />} />
            <Route path="/recept/:id" element={<ReceptDetalj />} />
            <Route path="/recept/:id/redigera" element={<ReceptFormulär />} />
            <Route path="/meny" element={<Meny />} />
            <Route path="/meny/ny" element={<MenyNy />} />
            <Route path="/meny/historik" element={<MenyHistorik />} />
            <Route path="/inkop" element={<Inkop />} />
            <Route path="/samlingar/:id" element={<SamlingDetalj />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </>
      )}
    </BrowserRouter>
  )
}
