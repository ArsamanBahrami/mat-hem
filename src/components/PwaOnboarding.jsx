import { useEffect, useRef, useState } from 'react'

const SEEN_KEY = 'pwa_onboarding_seen'

function detectDevice() {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// ── Steg-innehåll ─────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-20 h-20 bg-forest-600 rounded-3xl flex items-center justify-center shadow-lg">
        <img src="/icon-192.png" alt="Matvis" className="w-14 h-14 rounded-2xl" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Välkommen till Matvis!</h2>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Innan du börjar — installera appen på din hemskärm för bästa upplevelse.
          Då fungerar appen offline och startar blixtsnabbt.
        </p>
      </div>
    </div>
  )
}

function StepInstallIos() {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Installera på hemskärmen</h2>
        <p className="text-gray-400 text-xs mt-1">Kräver Safari — fungerar ej i Chrome</p>
      </div>
      <ol className="flex flex-col gap-4">
        <li className="flex items-start gap-4">
          <span className="w-8 h-8 bg-forest-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">Tryck på dela-ikonen i Safari</p>
            <div className="mt-2 flex items-center justify-center w-12 h-12 bg-blue-50 rounded-xl border border-blue-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M8.684 8.316L12 5l3.316 3.316M12 5v10.5" />
                <path d="M5.5 12.5v5A1.5 1.5 0 007 19h10a1.5 1.5 0 001.5-1.5v-5" />
              </svg>
            </div>
          </div>
        </li>
        <li className="flex items-start gap-4">
          <span className="w-8 h-8 bg-forest-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</span>
          <p className="text-sm font-medium text-gray-800 mt-1">Scrolla ned och tryck <span className="font-semibold text-gray-900">"Lägg till på hemskärmen"</span></p>
        </li>
        <li className="flex items-start gap-4">
          <span className="w-8 h-8 bg-forest-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">3</span>
          <p className="text-sm font-medium text-gray-800 mt-1">Tryck <span className="font-semibold text-gray-900">"Lägg till"</span> uppe till höger</p>
        </li>
      </ol>
    </div>
  )
}

function StepInstallAndroid({ onInstall, hasPrompt }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Installera på hemskärmen</h2>
      </div>
      {hasPrompt ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-16 h-16 bg-forest-50 border border-forest-200 rounded-2xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-8 h-8 text-forest-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 text-center">
            Tryck på knappen nedan så läggs Matvis till på din hemskärm direkt.
          </p>
          <button
            onClick={onInstall}
            className="w-full py-3.5 bg-forest-600 text-white font-semibold rounded-2xl text-sm shadow"
          >
            Installera Matvis
          </button>
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          <li className="flex items-start gap-4">
            <span className="w-8 h-8 bg-forest-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</span>
            <div className="flex-1 mt-1">
              <p className="text-sm font-medium text-gray-800">Tryck på menyn <span className="font-mono font-bold">⋮</span> i Chrome</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <span className="w-8 h-8 bg-forest-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</span>
            <p className="text-sm font-medium text-gray-800 mt-1">Välj <span className="font-semibold text-gray-900">"Lägg till på startskärmen"</span></p>
          </li>
        </ol>
      )}
    </div>
  )
}

function StepInstallOther() {
  return (
    <div className="flex flex-col gap-4 text-center">
      <h2 className="text-xl font-bold text-gray-900">Installera på hemskärmen</h2>
      <p className="text-sm text-gray-500 leading-relaxed">
        I din webbläsares meny finns ofta alternativet
        <span className="font-semibold text-gray-700"> "Lägg till på hemskärmen"</span> eller
        <span className="font-semibold text-gray-700"> "Installera app"</span>.
      </p>
    </div>
  )
}

function StepDone() {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-20 h-20 bg-forest-50 border-2 border-forest-200 rounded-3xl flex items-center justify-center">
        <span className="text-4xl">🎉</span>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Du är redo!</h2>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Öppna alltid Matvis från hemskärmen för bästa upplevelse — då fungerar
          även offline-läget och allt laddar snabbare.
        </p>
      </div>
    </div>
  )
}

// ── Huvudkomponent ─────────────────────────────────────────────

export default function PwaOnboarding() {
  const [visible, setVisible]   = useState(false)
  const [step, setStep]         = useState(0)
  const deferredPrompt          = useRef(null)
  const device                  = detectDevice()
  const TOTAL_STEPS             = 3

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) || isStandalone()) return
    localStorage.setItem(SEEN_KEY, '1')
    setVisible(true)

    const onPrompt = e => {
      e.preventDefault()
      deferredPrompt.current = e
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function next() {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1)
    else dismiss()
  }

  function dismiss() {
    setVisible(false)
  }

  async function handleInstall() {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt()
      await deferredPrompt.current.userChoice
      deferredPrompt.current = null
    }
    next()
  }

  if (!visible) return null

  const isLastStep = step === TOTAL_STEPS - 1
  const isInstallStep = step === 1
  const hasPrompt = Boolean(deferredPrompt.current)

  // On install step with Android + prompt, the install button is inside the step content
  const hideNextButton = isInstallStep && device === 'android' && hasPrompt

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60">
      <div className="w-full max-w-mobile bg-white rounded-t-3xl px-6 pt-6 pb-10 flex flex-col gap-6">

        {/* Steg-indikatorer */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 h-2 bg-forest-600'
                  : i < step
                  ? 'w-2 h-2 bg-forest-300'
                  : 'w-2 h-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Steg-innehåll */}
        <div className="min-h-[220px] flex flex-col justify-center">
          {step === 0 && <StepWelcome />}
          {step === 1 && device === 'ios'     && <StepInstallIos />}
          {step === 1 && device === 'android' && <StepInstallAndroid onInstall={handleInstall} hasPrompt={hasPrompt} />}
          {step === 1 && device === 'other'   && <StepInstallOther />}
          {step === 2 && <StepDone />}
        </div>

        {/* Knappar */}
        <div className="flex flex-col gap-2">
          {!hideNextButton && (
            <button
              onClick={isLastStep ? dismiss : next}
              className="w-full py-4 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-2xl transition shadow-sm text-sm"
            >
              {isLastStep ? 'Kom igång' : 'Nästa'}
            </button>
          )}
          {!isLastStep && (
            <button
              onClick={dismiss}
              className="w-full py-2 text-gray-400 text-sm"
            >
              Skippa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
