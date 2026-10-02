import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

import {
  INSTALLED_KEY, OPEN_INSTALL_EVENT, isIos, isStandalone,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa'

const DISMISSED_KEY = 'konvwa_pwa_dismissed_at'
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 1500

function isSnoozed() {
  try {
    if (localStorage.getItem(INSTALLED_KEY)) return true
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return !!at && Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => window.__installPrompt ?? null,
  )
  const [ios] = useState(isIos)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [slideOut, setSlideOut] = useState(false)

  useEffect(() => {
    const onOpen = () => { setSlideOut(false); setVisible(true) }
    window.addEventListener(OPEN_INSTALL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, onOpen)
  }, [])

  useEffect(() => {
    const onInstallable = () => setDeferredPrompt(window.__installPrompt ?? null)
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* ignore */ }
      setVisible(false)
    }
    window.addEventListener('konvwa:installable', onInstallable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('konvwa:installable', onInstallable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canInstall = !!deferredPrompt || ios

  useEffect(() => {
    if (!canInstall || isStandalone() || isSnoozed()) return
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [canInstall])

  function dismiss() {
    setSlideOut(true)
    setTimeout(() => {
      setVisible(false)
      setSlideOut(false)
    }, 280)
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  async function install() {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* ignore */ }
        setSlideOut(true)
        setTimeout(() => setVisible(false), 280)
      } else {
        dismiss()
      }
    } finally {
      setInstalling(false)
      window.__installPrompt = undefined
      setDeferredPrompt(null)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex items-end justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none [body:has(nav.fixed.bottom-0)_&]:pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
      <div
        role="dialog"
        aria-label="Installer KONVWA"
        className={cn(
          'w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-4 pointer-events-auto',
          'transition-all duration-300',
          slideOut
            ? 'opacity-0 translate-y-4'
            : 'opacity-100 translate-y-0 animate-in slide-in-from-bottom-4'
        )}
        style={{ animationDuration: '320ms' }}
      >
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl shrink-0 shadow-sm flex items-center justify-center bg-white border border-gray-100 overflow-hidden p-1.5">
            <img src="/logo.svg" alt="KONVWA" className="w-full h-full object-contain" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <p className="font-bold text-[15px] text-foreground leading-tight">Installer KONVWA</p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
              Accès rapide, notifications, mode hors ligne
            </p>
          </div>

          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shrink-0 -mt-0.5"
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>

        {deferredPrompt ? (
          <button
            onClick={install}
            disabled={installing}
            className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-70 transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            <Download className="h-4 w-4" />
            {installing ? 'Installation…' : "Installer l'application"}
          </button>
        ) : ios ? (
          <ol className="mt-3.5 space-y-2 rounded-xl bg-gray-50 p-3 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Share className="h-3.5 w-3.5" />
              </span>
              Appuyez sur <strong>Partager</strong> dans Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SquarePlus className="h-3.5 w-3.5" />
              </span>
              Choisissez <strong>Sur l'écran d'accueil</strong>
            </li>
          </ol>
        ) : (
          <ol className="mt-3.5 space-y-2 rounded-xl bg-gray-50 p-3 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MoreVertical className="h-3.5 w-3.5" />
              </span>
              Ouvrez le <strong>menu ⋮</strong> de votre navigateur
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Download className="h-3.5 w-3.5" />
              </span>
              Choisissez <strong>Installer l'application</strong>
            </li>
          </ol>
        )}
      </div>
    </div>
  )
}
