import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UserRole = 'client' | 'agent' | 'manager' | 'admin'

interface Profile {
  id: string
  user_id: string
  full_name: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>
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
      'Utilisateur'

    const { data: created } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, full_name: fullName, role: 'client' }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()

    if (created) setProfile(created as Profile)

    // Also ensure wallet exists
    await supabase
      .from('wallets')
      .upsert({ user_id: userId, available_balance: 0, blocked_balance: 0 }, { onConflict: 'user_id' })

    setLoading(false)
  }

  async function signUp(email: string, password: string, fullName: string, phone?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        }
      }
    })

    if (error) {
      return { error: new Error(error.message) }
    }

    // Ensure profile + wallet exist (trigger may not have fired yet)
    if (data.user) {
      await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
        phone: phone || null,
        role: 'client',
      }, { onConflict: 'user_id' })

      await supabase.from('wallets').upsert({
        user_id: data.user.id,
        available_balance: 0,
        blocked_balance: 0,
      }, { onConflict: 'user_id' })
    }

    return { error: null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { error: new Error(error.message) }
    }

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

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
