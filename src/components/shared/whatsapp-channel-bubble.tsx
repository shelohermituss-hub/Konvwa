import { X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { router } from '@/router'
import { tr } from '@/lib/i18n'
import { useWhatsAppChannel } from '@/lib/whatsapp-channel'
import { WhatsAppGlyph } from '@/components/shared/whatsapp-glyph'

/** Set once the visitor has opened the channel from the bubble: it never shows again in this browser. */
const CLICKED_KEY = 'konvwa-whatsapp-bubble-clicked'
/** The hint next to the bubble was closed: it stays closed for this visit (the bubble itself stays). */
const HINT_KEY = 'konvwa-whatsapp-bubble-hint-closed'
/** Screens where a floating button would get in the way (back office, sign-in, payment, a support conversation). */
const HIDDEN_ON = /^\/(?:admin|auth|setup|checkout|payment|support\/[^/]+)(?:\/|$)/

const read = (store: Storage, key: string) => { try { return store.getItem(key) === '1' } catch { return false } }
const write = (store: Storage, key: string) => { try { store.setItem(key, '1') } catch { /* storage unavailable: hidden for this page only */ } }

const pathname = () => router.state.location.pathname
const subscribe = (cb: () => void) => router.subscribe(cb)

/**
 * Floating WhatsApp bubble (bottom right) that leads to the KONVWA channel. It stays on every page until the visitor
 * opens the channel once from it, then never shows again in this browser. A hint invites to follow the channel; closing
 * the hint keeps the bubble. Nothing is shown while the admin has not set the channel link (Paramètres).
 */
export function WhatsAppChannelBubble() {
  const url = useWhatsAppChannel()
  const path = useSyncExternalStore(subscribe, pathname, pathname)
  const [clicked, setClicked] = useState(() => read(localStorage, CLICKED_KEY))
  const [hintClosed, setHintClosed] = useState(() => read(sessionStorage, HINT_KEY))
  // the hint comes in a moment after the page, so it does not compete with the first look at the page
  const [hintReady, setHintReady] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setHintReady(true), 1800)
    return () => window.clearTimeout(t)
  }, [])

  if (!url || clicked || HIDDEN_ON.test(path)) return null

  const showHint = hintReady && !hintClosed
  // removed on the next tick so the browser still follows the link it was clicked for
  const opened = () => { write(localStorage, CLICKED_KEY); window.setTimeout(() => setClicked(true), 0) }
  return (
    // .kv-wa-dock (index.css) lifts it above the app's bottom bar and the sticky "add to cart / pay" bars
    <div className="kv-wa-dock pointer-events-none fixed right-4 z-[55] flex items-end gap-3">
      {showHint && (
        <div className="kv-wa-hint pointer-events-auto relative mb-2 max-w-[220px] rounded-2xl rounded-br-md bg-[#0A1628] px-4 py-3 text-white shadow-xl">
          {/* the hint is a second (mouse/touch) target for the same link; keyboard and screen readers use the bubble */}
          <a href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden onClick={opened} className="block">
            <p className="text-sm font-semibold leading-snug">{tr('Suivez notre chaîne WhatsApp')}</p>
            <p className="mt-0.5 text-xs leading-snug text-white/75">{tr('Promos et nouveaux arrivages en premier.')}</p>
          </a>
          <button
            type="button"
            aria-label={tr('Fermer')}
            onClick={() => { setHintClosed(true); write(sessionStorage, HINT_KEY) }}
            className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0A1628] shadow-md ring-1 ring-black/5 transition-transform duration-150 ease-out after:absolute after:-inset-2 active:scale-95"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={tr('Suivre notre chaîne WhatsApp (nouvel onglet)')}
        onClick={opened}
        className="kv-wa-bubble pointer-events-auto relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_28px_rgba(18,140,74,0.45)] ring-4 ring-white transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-[#0A1628]"
      >
        <WhatsAppGlyph className="h-8 w-8" />
        {/* orange KONVWA dot: an invitation not opened yet */}
        <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full border-2 border-white bg-[#F05A28]" aria-hidden />
      </a>
    </div>
  )
}
