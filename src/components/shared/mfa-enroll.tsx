import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

/** Authenticator-app (TOTP) enrolment, inline, for the account setup. The profile page has the full management UI. */
export function MfaEnroll({ onChange }: { onChange?: (enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    const on = !!data?.totp?.some((f) => f.status === 'verified')
    setEnabled(on)
    onChange?.(on)
  }, [onChange])
  useEffect(() => { void load() }, [load])

  async function start() {
    setBusy(true); setError('')
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'KONVWA' })
    setBusy(false)
    if (e || !data) { toast.error(tr('Impossible d\'activer la double authentification pour le moment.')); return }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollment) return
    setBusy(true); setError('')
    const { error: v } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code })
    if (v) { setBusy(false); setError(tr('Code invalide ou expiré. Réessayez.')); setCode(''); return }
    await supabase.auth.refreshSession()
    setBusy(false); setEnrollment(null); setCode('')
    await load()
    toast.success(tr('Double authentification activée.'))
  }

  if (enabled === null) return <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />

  if (enabled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <p className="text-sm font-medium text-emerald-800">{tr('Double authentification activée.')}</p>
      </div>
    )
  }

  if (!enrollment) {
    return (
      <Button onClick={() => void start()} disabled={busy} className="h-12 w-full gap-2 rounded-2xl">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        {tr('Activer la double authentification')}
      </Button>
    )
  }

  return (
    <form onSubmit={(e) => void confirm(e)} className="space-y-3">
      <div className="flex flex-col items-center gap-2">
        <img src={enrollment.qr} alt={tr('Code QR à scanner')} className="h-44 w-44 rounded-xl border border-gray-100 bg-white p-2" />
        <p className="text-center text-xs text-muted-foreground">
          {tr('Ou saisissez cette clé :')} <span className="select-all font-mono font-semibold">{enrollment.secret}</span>
        </p>
      </div>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label={tr('Code à 6 chiffres')}
        className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.4em]"
      />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full rounded-xl">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Valider')}
      </Button>
    </form>
  )
}
