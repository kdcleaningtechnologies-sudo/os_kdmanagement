import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import {
  isIosDevice,
  isMobileDevice,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstallPrompt,
} from '../lib/pwa'
import { Button } from './ui/Button'

const SKIP_KEY = 'kd-install-skipped'

export function InstallAppCard({ className = '' }: { className?: string }) {
  const [canPrompt, setCanPrompt] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const [androidHelp, setAndroidHelp] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandaloneDisplay() || localStorage.getItem('kd-app-installed') === '1') return
    if (sessionStorage.getItem(SKIP_KEY) === '1') return

    const unsubscribe = subscribeInstallPrompt((event) => {
      setCanPrompt(Boolean(event))
      if (event || isMobileDevice()) setHidden(false)
    })
    if (isMobileDevice()) setHidden(false)
    return unsubscribe
  }, [])

  if (hidden) return null

  function skip() {
    sessionStorage.setItem(SKIP_KEY, '1')
    setHidden(true)
    setIosHelp(false)
    setAndroidHelp(false)
  }

  async function install() {
    if (canPrompt) {
      const accepted = await promptInstall()
      if (accepted) {
        localStorage.setItem('kd-app-installed', '1')
        setHidden(true)
      }
      return
    }
    if (isIosDevice()) {
      setIosHelp(true)
      return
    }
    setAndroidHelp(true)
  }

  return (
    <div className={`rounded-2xl border border-tide-100 bg-white p-4 shadow-lg ${className}`}>
      <div className="flex items-start gap-3">
        <img src="/pwa-192.png" alt="" className="h-12 w-12 rounded-xl object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-950">Install FacilityOS</p>
          <p className="mt-0.5 text-xs text-ink-600">
            Add the app to your home screen. Check-in, tasks, and patrols open in one tap.
          </p>
        </div>
      </div>

      {iosHelp ? (
        <ol className="mt-3 space-y-2 text-xs text-ink-700">
          <li className="flex gap-2">
            <Share size={14} className="mt-0.5 shrink-0" />
            Tap the Share button in Safari
          </li>
          <li className="flex gap-2">
            <SquarePlus size={14} className="mt-0.5 shrink-0" />
            Then tap Add to Home Screen
          </li>
        </ol>
      ) : null}

      {androidHelp ? (
        <p className="mt-3 text-xs text-ink-700">
          Open the Chrome menu (⋮) and tap <span className="font-semibold">Install app</span> or{' '}
          <span className="font-semibold">Add to Home screen</span>.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button type="button" full onClick={() => void install()}>
          <Download size={16} />
          Install App
        </Button>
        <Button type="button" full variant="secondary" onClick={skip}>
          Not now
        </Button>
      </div>
    </div>
  )
}

export function InstallAppBanner() {
  const location = useLocation()
  const onAuth = location.pathname === '/login' || location.pathname === '/signup'

  if (onAuth) return null

  return (
    <div className="fixed right-3 bottom-32 left-3 z-40 mx-auto max-w-lg md:bottom-4">
      <InstallAppCard />
    </div>
  )
}
