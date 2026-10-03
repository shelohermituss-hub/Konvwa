import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { tr } from '@/lib/i18n'

const KEY = 'konvwa_setup_reminder_hidden'

/** Home-page nudge for the optional setup items the user skipped and has not done since. */
export function SetupReminder() {
  const { user, profile } = useAuth()
  const [todo, setTodo] = useState<string[]>([])
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } })

  useEffect(() => {
    const skipped = profile?.onboarding_skipped ?? []
    if (!user || hidden || !profile?.onboarding_completed_at || skipped.length === 0) return
    void (async () => {
      const left: string[] = []
      if (skipped.includes('passkey')) { const { data } = await supabase.auth.passkey.list(); if (!data?.length) left.push(tr('Empreinte / Face ID')) }
      if (skipped.includes('mfa')) { const { data } = await supabase.auth.mfa.listFactors(); if (!data?.totp?.some((f) => f.status === 'verified')) left.push(tr('Double authentification')) }
      if (skipped.includes('kyc')) { const { data } = await supabase.from('kyc_submissions').select('status').eq('user_id', user.id).maybeSingle(); if (!data) left.push(tr('Vérification d\'identité')) }
      if (skipped.includes('address')) { const { count } = await supabase.from('delivery_addresses').select('id', { count: 'exact', head: true }).eq('user_id', user.id); if (!count) left.push(tr('Adresse de livraison')) }
      setTodo(left)
    })()
  }, [user, profile, hidden])

  if (hidden || todo.length === 0) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">{tr('Terminez la configuration de votre compte')}</p>
        <p className="mt-0.5 text-xs text-amber-800">{todo.join(' · ')}</p>
        <div className="mt-2 flex items-center gap-4">
          <Link to="/profile?section=security" className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-900">{tr('Compléter')}<ChevronRight className="h-3.5 w-3.5" /></Link>
          <button type="button" onClick={() => { try { sessionStorage.setItem(KEY, '1') } catch { /* ignore */ } setHidden(true) }} className="text-xs font-semibold text-amber-800">{tr('Plus tard')}</button>
        </div>
      </div>
    </div>
  )
}
