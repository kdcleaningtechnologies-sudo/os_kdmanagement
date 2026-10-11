type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallListener = (event: BeforeInstallPromptEvent | null) => void

let deferredInstall: BeforeInstallPromptEvent | null = null
const listeners = new Set<InstallListener>()

function notify() {
  for (const listener of listeners) listener(deferredInstall)
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

export function initPwaInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstall = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredInstall = null
    localStorage.setItem('kd-app-installed', '1')
    notify()
  })
}

export function subscribeInstallPrompt(listener: InstallListener) {
  listeners.add(listener)
  listener(deferredInstall)
  return () => {
    listeners.delete(listener)
  }
}

export async function promptInstall() {
  if (!deferredInstall) return false
  await deferredInstall.prompt()
  const { outcome } = await deferredInstall.userChoice
  deferredInstall = null
  notify()
  return outcome === 'accepted'
}

export function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

export function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isAndroidDevice() {
  return /android/i.test(navigator.userAgent)
}

export function isMobileDevice() {
  return isIosDevice() || isAndroidDevice() || window.matchMedia('(max-width: 768px)').matches
}
