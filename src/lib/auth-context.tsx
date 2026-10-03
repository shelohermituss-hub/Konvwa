import { detachPushFromThisDevice } from '@/hooks/use-push-notifications'
import { LANG, hasStoredLang, setLanguage } from '@/lib/i18n'
import { getDeviceId, deviceLabel } from '@/lib/device'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

import { tr } from '@/lib/i18n'
type UserRole = 'client' | 'agent' | 'manager' | 'admin'

interface Profile {
  id: string
  user_id: string
  full_name: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
  language?: 'fr' | 'en'
  is_reseller?: boolean
  onboarding_completed_at?: string | null
  onboarding_skipped?: string[]
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null; needsConfirmation?: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && data) {
      setProfile(data as Profile)
      setLoading(false)
      return
    }

    // Profile missing or RLS returned empty — wait briefly (trigger latency) then retry
    await new Promise(r => setTimeout(r, 800))
    const { data: retryData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (retryData) {
      setProfile(retryData as Profile)
      setLoading(false)
      return
    }

    // Still no profile — auto-create one (handles manual auth users or trigger failures)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const fullName =
      authUser?.user_metadata?.full_name ||
      authUser?.email?.split('@')[0] ||
      tr('Utilisateur')

    const { data: created } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, full_name: fullName, role: 'client' }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()

    if (created) setProfile(created as Profile)

    // Also ensure wallet exists
    await supabase
      .from('wallets')
      .upsert({ user_id: userId, available_balance: 0, blocked_balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

    setLoading(false)
  }

  async function signUp(email: string, password: string, fullName: string, phone?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
          phone: phone || null,
        }
      }
    })

    if (error) {
      return { error: new Error(error.message) }
    }

    // No session means "Confirm email" is on: the profile/wallet are created by the DB trigger
    if (!data.session) {
      return { error: null, needsConfirmation: true }
    }

    // Ensure profile + wallet exist (trigger may not have fired yet)
    if (data.user) {
      await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
        phone: phone || null,
        role: 'client',
      }, { onConflict: 'user_id', ignoreDuplicates: true })

      await supabase.from('wallets').upsert({
        user_id: data.user.id,
        available_balance: 0,
        blocked_balance: 0,
      }, { onConflict: 'user_id', ignoreDuplicates: true })
    }

    return { error: null }
  }

  async function signIn(email: string, password: string) {
    // Temporary lockout after repeated failures (counted in the database, per e-mail)
    const { data: locked } = await supabase.rpc('login_lock_seconds', { p_email: email })
    if (typeof locked === 'number' && locked > 0) {
      return { error: new Error(tr('Trop de tentatives. Réessayez dans {0} min.', Math.ceil(locked / 60))) }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      const { data: lockedNow } = await supabase.rpc('record_login_failure', { p_email: email })
      if (typeof lockedNow === 'number' && lockedNow > 0) {
        return { error: new Error(tr('Trop de tentatives. Réessayez dans {0} min.', Math.ceil(lockedNow / 60))) }
      }
      return { error: new Error(error.message) }
    }

    void supabase.rpc('clear_login_failures')
    return { error: null }
  }

  async function signOut() {
    // must run while the session is still valid (RLS only lets a user delete their own rows)
    if (user) await detachPushFromThisDevice(user.id)
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  // Remember this device; a device never seen before triggers a "new sign-in" notification (done by the database)
  useEffect(() => {
    if (!user?.id) return
    void supabase.rpc('register_device', { p_device_id: getDeviceId(), p_label: deviceLabel() })
  }, [user?.id])

  // Apply a referral code remembered from an invitation link (the database refuses it when it no longer qualifies)
  useEffect(() => {
    if (!user?.id) return
    let ref: string | null = null
    try { ref = localStorage.getItem('konvwa-ref') } catch { /* storage unavailable */ }
    if (!ref) return
    void supabase.rpc('apply_referral', { p_code: ref }).then(() => {
      try { localStorage.removeItem('konvwa-ref') } catch { /* storage unavailable */ }
    })
  }, [user?.id])

  // The account remembers its language (used for server-side notifications and across devices)
  useEffect(() => {
    if (!profile?.user_id) return
    if (profile.language && profile.language !== LANG) {
      if (hasStoredLang()) {
        void supabase.from('profiles').update({ language: LANG }).eq('user_id', profile.user_id)
      } else {
        setLanguage(profile.language) // first visit on this device: follow the account
      }
    }
  }, [profile?.user_id, profile?.language])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
