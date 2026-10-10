import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"

import "./index.css"
import { router } from "./router"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n-context"
import { CartProvider } from "@/lib/cart-context"
import { Toaster, toast } from "sonner"
import { trServer, tr, LANG } from "@/lib/i18n"
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt"
import { AuthErrorToast } from "@/components/shared/auth-error-toast"
import { StepUpProvider } from '@/lib/step-up'
import { WishlistProvider } from '@/lib/wishlist-context'
import { installErrorReporting } from '@/lib/error-reporter'
import { supabase } from '@/lib/supabase'
import { saveUsdRate } from '@/lib/currency'
import { initPixel, trackPixel } from '@/lib/meta-pixel'
import { UpdateBanner } from "@/components/shared/update-banner"
import { OfflineBanner } from "@/components/shared/offline-banner"

// The USD display rate follows the site setting; it is kept for the next page load so prices never change while the page is open
void supabase.from('app_settings').select('value').eq('key', 'usd_to_htg_rate').maybeSingle().then(({ data }) => saveUsdRate(data?.value), () => {})

// Server errors (RPC) are written in French: show them in the user's language
const originalToastError = toast.error.bind(toast)
toast.error = ((message: Parameters<typeof toast.error>[0], data?: Parameters<typeof toast.error>[1]) =>
  originalToastError(
    typeof message === 'string' ? trServer(message) : message,
    data && typeof data.description === 'string' ? { ...data, description: trServer(data.description) } : data,
  )) as typeof toast.error

// Pages other than the public ones keep the generic title: follow the language
if (LANG === 'en') document.title = tr('KONVWA — Importez depuis Alibaba, Shein et Temu en Haïti')

installErrorReporting()

// Meta Pixel (only when its id is configured): one PageView per page of the app
initPixel()
let lastPixelPath = window.location.pathname
router.subscribe((state) => {
  if (state.location.pathname !== lastPixelPath) { lastPixelPath = state.location.pathname; trackPixel('PageView') }
})

// A friend's referral link (?ref=CODE) is remembered until the new account exists
try {
  const ref = new URLSearchParams(window.location.search).get('ref')
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) localStorage.setItem('konvwa-ref', ref.toUpperCase())
} catch { /* storage unavailable */ }

// Chrome fires this once, possibly before React mounts: keep it for the install popup.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__installPrompt = e as Window['__installPrompt']
  window.dispatchEvent(new Event('konvwa:installable'))
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// once the first screen is idle, fetch the code of the screens a visitor opens next (product page, cart) so they open instantly
const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2500))
window.addEventListener('load', () => idle(() => { void import('@/pages/product-detail'); void import('@/pages/auth'); void import('@/pages/cart') }))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="haiti-import-theme">
      <I18nProvider>
        <AuthProvider>
          <CartProvider>
            <StepUpProvider>
              <WishlistProvider>
              <RouterProvider router={router} />
              <Toaster richColors position="top-center" />
              <PwaInstallPrompt />
              <AuthErrorToast />
              <UpdateBanner />
              <OfflineBanner />
              </WishlistProvider>
            </StepUpProvider>
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
)
