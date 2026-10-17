import { X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { router } from '@/router'
import { tr } from '@/lib/i18n'
import { useWhatsAppChannel } from '@/lib/whatsapp-channel'

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

/** WhatsApp logo (glyph only, drawn in the bubble's white). */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.41 9.41 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2.01.52 3.97 1.52 5.69L.55 23.6l6.04-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z" />
    </svg>
  )
}

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
