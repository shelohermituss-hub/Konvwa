import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"

import "./index.css"
import { router } from "./router"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n-context"
import { Toaster } from "sonner"

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
          <RouterProvider router={router} />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
)
