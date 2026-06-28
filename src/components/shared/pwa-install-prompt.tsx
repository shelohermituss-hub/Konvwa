import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'konvwa_pwa_dismissed'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [slideOut, setSlideOut] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed or running as installed PWA
    if (
      localStorage.getItem(DISMISSED_KEY) ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Slight delay so it doesn't pop up immediately on load
      setTimeout(() => setVisible(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setSlideOut(true)
    setTimeout(() => {
      setVisible(false)
      setSlideOut(false)
    }, 280)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  async function install() {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, '1')
        setSlideOut(true)
        setTimeout(() => setVisible(false), 280)
      }
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 inset-x-0 z-50 flex items-end justify-center px-4 pointer-events-none">
      <div
        className={cn(
          'w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-4 pointer-events-auto',
          'transition-all duration-280',
          slideOut
            ? 'opacity-0 translate-y-4'
            : 'opacity-100 translate-y-0 animate-in slide-in-from-bottom-4'
        )}
        style={{ animationDuration: '320ms' }}
      >
        <div className="flex items-start gap-3">
          {/* App icon */}
          <img
            src="/icon-192.png"
            alt="KONVWA"
            className="h-12 w-12 rounded-xl shrink-0 shadow-sm"
          />

          {/* Text */}
          <div className="flex-1 min-w-0 pr-1">
            <p className="font-bold text-[15px] text-foreground leading-tight">Installer KONVWA</p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
              Accès rapide, notifications, mode hors ligne
            </p>
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shrink-0 -mt-0.5"
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>

        {/* Install button */}
        <button
          onClick={install}
          disabled={installing}
          className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-70 transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
        >
          <Download className="h-4 w-4" />
          {installing ? 'Installation…' : "Installer l'application"}
        </button>
      </div>
    </div>
  )
}
