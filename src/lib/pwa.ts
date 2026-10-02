export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __installPrompt?: BeforeInstallPromptEvent
  }
}

export const INSTALLED_KEY = 'konvwa_pwa_installed'
export const OPEN_INSTALL_EVENT = 'konvwa:open-install'

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIos() {
  const ua = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

// Starts the native install flow when the browser offered it; otherwise asks the popup to show manual steps.
export async function requestInstall(): Promise<'accepted' | 'dismissed' | 'help'> {
  const evt = window.__installPrompt
  if (!evt) {
    window.dispatchEvent(new Event(OPEN_INSTALL_EVENT))
    return 'help'
  }
  await evt.prompt()
  const { outcome } = await evt.userChoice
  window.__installPrompt = undefined
  if (outcome === 'accepted') {
    try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* ignore */ }
  }
  return outcome
}
