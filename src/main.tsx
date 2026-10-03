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
import { UpdateBanner } from "@/components/shared/update-banner"

// Server errors (RPC) are written in French: show them in the user's language
const originalToastError = toast.error.bind(toast)
toast.error = ((message: Parameters<typeof toast.error>[0], data?: Parameters<typeof toast.error>[1]) =>
  originalToastError(
    typeof message === 'string' ? trServer(message) : message,
    data && typeof data.description === 'string' ? { ...data, description: trServer(data.description) } : data,
  )) as typeof toast.error

// Pages other than the public ones keep the generic title: follow the language
if (LANG === 'en') document.title = tr('KONVWA — Importez depuis Alibaba, Shein et Temu en Haïti')

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
              </WishlistProvider>
            </StepUpProvider>
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
)
