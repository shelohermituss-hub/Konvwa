import { useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { chromeIntentUrl, isAndroid, isInAppBrowser } from '@/lib/in-app-browser'
import { tr } from '@/lib/i18n'

const KEY = 'konvwa_inapp_banner_hidden'

/** Shown only inside the embedded browser of Facebook / Instagram…: asks to open the page in the real browser (install, notifications and Google sign-in work there). */
export function InAppBrowserBanner() {
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } })
  if (hidden || !isInAppBrowser()) return null
  const android = isAndroid()
  const intent = android ? chromeIntentUrl(window.location.href) : null
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5" role="status">
      <ExternalLink className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs leading-snug text-amber-900">
        {android
          ? tr('Pour installer l\'application et recevoir vos notifications, ouvrez KONVWA dans Chrome.')
          : tr('Pour installer l\'application, touchez ⋯ puis « Ouvrir dans Safari ».')}
      </p>
      {intent && (
        <a href={intent} className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">{tr('Ouvrir dans Chrome')}</a>
      )}
      <button type="button" aria-label={tr('Fermer')} onClick={() => { try { sessionStorage.setItem(KEY, '1') } catch { /* ignore */ } setHidden(true) }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-800 hover:bg-amber-100"><X className="h-4 w-4" /></button>
    </div>
  )
}
