import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import type { ReactNode } from 'react'
import { SplashScreen, useSplashHold } from '@/components/shared/splash-screen'
import { AccountBlocked } from '@/components/shared/account-blocked'
import { accountBlock } from '@/lib/account-access'

interface AuthGuardProps {
  children: ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function AuthGuard({ children, requireAuth = true, redirectTo = '/auth' }: AuthGuardProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const hold = useSplashHold(loading)

  if (hold) {
    return <SplashScreen />
  }

  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Suspended / banned customers only see the explanation (a suspended one may still write to support)
  const blocked = requireAuth ? accountBlock(profile) : null
  if (blocked && !(blocked === 'suspended' && location.pathname.startsWith('/support'))) {
    return <AccountBlocked kind={blocked} reason={profile?.status_reason ?? null} until={profile?.status_until ?? null} />
  }

  if (!requireAuth && user) {
    const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}

interface AdminGuardProps {
  children: ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { profile, loading } = useAuth()
  const location = useLocation()
  const hold = useSplashHold(loading)

  if (hold) {
    return <SplashScreen />
  }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />
  }

  return <>{children}</>
}

/** Pages reserved for full administrators (managers are sent back to the dashboard). */
export function SuperAdminGuard({ children }: AdminGuardProps) {
  const { profile, loading } = useAuth()
  const hold = useSplashHold(loading)
  if (hold) return <SplashScreen />
  if (profile?.role !== 'admin') return <Navigate to="/admin" replace />
  return <>{children}</>
}

/** New clients go through the account setup once (staff and finished accounts are never redirected). */
export function SetupGate({ children }: AdminGuardProps) {
  const { profile, loading } = useAuth()
  const hold = useSplashHold(loading)
  if (hold) return <SplashScreen />
  if (profile && profile.role === 'client' && !profile.onboarding_completed_at) return <Navigate to="/setup" replace />
  return <>{children}</>
}
