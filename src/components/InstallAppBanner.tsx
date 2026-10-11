import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isIosDevice, isStandaloneDisplay } from '../lib/pwa'
import { Button } from './ui/Button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'kd-install-dismissed'

export function InstallAppBanner() {
  const location = useLocation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandaloneDisplay() || localStorage.getItem(STORAGE_KEY) === '1') return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isIosDevice()) {
      setIosHint(true)
      setHidden(false)
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setHidden(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    setDeferred(null)
    dismiss()
  }

  if (hidden || location.pathname === '/login') return null

  return (
    <div className="fixed right-3 bottom-32 left-3 z-40 mx-auto max-w-lg rounded-2xl border border-sand-100 bg-white p-3 shadow-lg md:bottom-4">
      <p className="text-sm font-semibold text-ink-950">Use FacilityOS as an app</p>
      <p className="mt-1 text-xs text-ink-600">
        {iosHint
          ? 'On iPhone: tap Share, then Add to Home Screen. Check-in GPS works better from the icon.'
          : 'Install on this phone for one-tap check-in, tasks, and patrols — no browser tabs.'}
      </p>
      <div className="mt-3 flex gap-2">
        {deferred ? (
          <Button full onClick={() => void install()}>
            Install
          </Button>
        ) : null}
        <Button full variant={deferred ? 'secondary' : 'primary'} onClick={dismiss}>
          {deferred ? 'Not now' : 'Got it'}
        </Button>
      </div>
    </div>
  )
}
