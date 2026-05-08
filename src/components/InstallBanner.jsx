import { useEffect, useRef, useState } from 'react'

const DISMISSED_KEY = 'pwa_install_dismissed_at'
const COOLDOWN_MS   = 7 * 24 * 60 * 60 * 1000 // 7 dagar

export default function InstallBanner() {
  const [visible, setVisible]     = useState(false)
  const deferredPrompt            = useRef(null)

  useEffect(() => {
    function isDismissed() {
      const ts = localStorage.getItem(DISMISSED_KEY)
      return ts && Date.now() - parseInt(ts) < COOLDOWN_MS
    }

    function maybeShow() {
      if (deferredPrompt.current && !isDismissed()) setVisible(true)
    }

    // Capture the browser's install prompt
    const onBeforeInstall = e => {
      e.preventDefault()
      deferredPrompt.current = e
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Show after 30 seconds
    const timer = setTimeout(maybeShow, 30_000)

    // Show shortly after first recipe is saved
    const onRecipeSaved = () => setTimeout(maybeShow, 1_500)
    window.addEventListener('recipe-saved', onRecipeSaved)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('recipe-saved', onRecipeSaved)
      clearTimeout(timer)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    setVisible(false)
    if (outcome === 'dismissed') {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-forest-100 p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-forest-600 rounded-xl flex-shrink-0 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
          <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
          <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">Lägg till Matvis på hemskärmen</p>
        <p className="text-xs text-gray-500 mt-0.5">Bästa upplevelsen som app</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-forest-600 text-white text-xs font-semibold rounded-xl"
        >
          Installera
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1 text-gray-400 text-xs"
        >
          Inte nu
        </button>
      </div>
    </div>
  )
}
