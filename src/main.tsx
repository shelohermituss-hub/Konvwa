import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"

import "./index.css"
import { router } from "./router"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n-context"
import { CartProvider } from "@/lib/cart-context"
import { Toaster } from "sonner"
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt"
import { AuthErrorToast } from "@/components/shared/auth-error-toast"
import { UpdateBanner } from "@/components/shared/update-banner"

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
            <RouterProvider router={router} />
            <Toaster richColors position="top-center" />
            <PwaInstallPrompt />
            <AuthErrorToast />
            <UpdateBanner />
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
)
