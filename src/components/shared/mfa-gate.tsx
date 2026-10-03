import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { tr } from '@/lib/i18n'

type Step =
  | { kind: 'loading' }
  | { kind: 'ok' }
  | { kind: 'challenge'; factorId: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'unavailable'; reason: string }

/**
 * Requires a verified TOTP code (aal2) before the admin area is shown.
 * The database enforces the same rule once the `staff_mfa_required` setting is "true".
 */
export function MfaGate({ children, enroll = true }: { children: ReactNode; enroll?: boolean }) {
  const { signOut } = useAuth()
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bypass, setBypass] = useState(false)

  const evaluate = useCallback(async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal2') return setStep({ kind: 'ok' })

    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = factors?.totp?.find((f) => f.status === 'verified')
    if (verified) return setStep({ kind: 'challenge', factorId: verified.id })

    if (!enroll) return setStep({ kind: 'ok' })  // optional MFA (clients): only challenge those who enabled it

    // Remove abandoned enrolments so a new one can be started
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'KONVWA' })
    if (enrollError || !data) return setStep({ kind: 'unavailable', reason: enrollError?.message ?? '' })
    setStep({ kind: 'enroll', factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }, [enroll])

  useEffect(() => {
    evaluate().catch((e: unknown) => {
      if (!enroll) return setStep({ kind: 'ok' })
      setStep({ kind: 'unavailable', reason: e instanceof Error ? e.message : '' })
    })
  }, [evaluate, enroll])

  async function verify(factorId: string) {
    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    setBusy(false)
    if (verifyError) {
      setError(tr('Code invalide ou expiré. Réessayez.'))
      setCode('')
      return
    }
    await supabase.auth.refreshSession()
    window.location.reload()  // the new session (aal2) must be used by every request
  }

  if (step.kind === 'ok' || bypass) return <>{children}</>

  if (step.kind === 'loading') {
    return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F4F5F7] p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <KonvwaLogo size={26} />
        </div>
        <div className="mb-1 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">
            {step.kind === 'challenge' ? tr('Vérification en deux étapes') : tr('Sécurisez votre compte')}
          </h1>
        </div>

        {step.kind === 'unavailable' ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr('La double authentification n\'est pas disponible pour le moment. Activez le TOTP (MFA) dans Supabase → Authentication.')}
            </p>
            {step.reason && <p className="mt-2 text-xs text-muted-foreground/70">{step.reason}</p>}
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setBypass(true)}>{tr('Continuer sans')}</Button>
              <Button variant="ghost" className="rounded-xl" onClick={() => void signOut()}>{tr('Se déconnecter')}</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {step.kind === 'challenge'
                ? tr('Entrez le code à 6 chiffres de votre application d\'authentification.')
                : tr('Les comptes de l\'équipe doivent utiliser une application d\'authentification (Google Authenticator, Authy, 1Password…). Scannez ce code, puis entrez le code à 6 chiffres.')}
            </p>

            {step.kind === 'enroll' && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <img src={step.qr} alt={tr('Code QR à scanner')} className="h-44 w-44 rounded-xl border border-gray-100 bg-white p-2" />
                <p className="text-center text-xs text-muted-foreground">
                  {tr('Ou saisissez cette clé :')} <span className="select-all font-mono font-semibold">{step.secret}</span>
                </p>
              </div>
            )}

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => { e.preventDefault(); void verify(step.factorId) }}
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
                aria-label={tr('Code à 6 chiffres')}
                className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.4em]"
              />
              {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
              <Button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full rounded-xl">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Valider')}
              </Button>
            </form>
            <button type="button" onClick={() => void signOut()} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              {tr('Se déconnecter')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
