import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import type { ReactNode } from 'react'
import { SplashScreen, useSplashHold } from '@/components/shared/splash-screen'

export function HomeGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  const hold = useSplashHold(loading)

  if (hold) {
    return <SplashScreen />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
