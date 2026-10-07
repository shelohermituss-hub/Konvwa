import { useAuth } from '@/lib/auth-context'
import { ClientLayout } from '@/components/layouts/client-layout'
import { GuestCatalogLayout } from '@/components/layouts/guest-catalog-layout'
import { MfaGate } from '@/components/shared/mfa-gate'
import { AuthGuard, SetupGate } from '@/components/shared/auth-guard'
import { SplashScreen, useSplashHold } from '@/components/shared/splash-screen'

/** The catalogue pages: the full app shell for a logged-in customer, the price-free guest shell for a visitor (same addresses). */
export function CatalogShell() {
  const { user, loading } = useAuth()
  const hold = useSplashHold(loading)
  if (hold) return <SplashScreen />
  if (!user) return <GuestCatalogLayout />
  return (
    <AuthGuard>
      <MfaGate enroll={false}><SetupGate><ClientLayout /></SetupGate></MfaGate>
    </AuthGuard>
  )
}
