import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { SplashScreen, useSplashHold } from '@/components/shared/splash-screen'

/** There is no landing page: a visitor lands on the product feed, a customer on the dashboard. */
export function HomeGuard() {
  const { user, loading } = useAuth()

  const hold = useSplashHold(loading)

  if (hold) {
    return <SplashScreen />
  }

  return <Navigate to={user ? '/dashboard' : '/products'} replace />
}
