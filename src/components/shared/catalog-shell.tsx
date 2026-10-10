import { useAuth } from '@/lib/auth-context'
import { page } from '@/lib/lazy-page'
import { GuestCatalogLayout } from '@/components/layouts/guest-catalog-layout'
import { AuthGuard, SetupGate } from '@/components/shared/auth-guard'
import { SplashScreen, useSplashHold } from '@/components/shared/splash-screen'

// the customer shell is only downloaded for a logged-in customer; a visitor never pays for it
const ClientLayout = page(() => import('@/components/layouts/client-layout'), 'ClientLayout')
const MfaGate = page<{ enroll?: boolean; children?: React.ReactNode }>(() => import('@/components/shared/mfa-gate'), 'MfaGate')

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
