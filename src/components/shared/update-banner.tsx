import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { tr } from '@/lib/i18n'
const CHECK_EVERY_MS = 5 * 60 * 1000
const BUNDLE_RE = /\/assets\/index-[^"']+\.js/

/** Path of the main bundle the running page was loaded with (null in dev). */
function currentBundle(): string | null {
  const el = Array.from(document.scripts).find((s) => BUNDLE_RE.test(s.src))
  return el ? new URL(el.src).pathname : null
}

/**
 * Tells the user when a newer deployment is live. Every build gives the main bundle a new
 * hashed name, so a different name in the freshly fetched index.html means "new version".
 */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const loaded = currentBundle()
    if (!loaded) return

    let stopped = false
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
        if (!res.ok) return
        const latest = (await res.text()).match(BUNDLE_RE)?.[0]
        if (latest && latest !== loaded) setAvailable(true)
      } catch {
        /* offline: try again later */
      }
    }

    const timer = window.setInterval(check, CHECK_EVERY_MS)
    window.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    void check()

    return () => {
      stopped = true
      window.clearInterval(timer)
      window.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!available) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#0A1628] px-4 py-3 text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
        <RefreshCw className="size-4 shrink-0 text-[#F05A28]" aria-hidden />
        <p className="flex-1 text-sm font-medium leading-snug">{tr('Une nouvelle version de KONVWA est disponible.')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-xl bg-[#F05A28] px-3 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          {tr('Actualiser')}
        </button>
      </div>
    </div>
  )
}
