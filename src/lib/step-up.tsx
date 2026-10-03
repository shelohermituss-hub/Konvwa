import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { tr, LOCALE_TAG } from '@/lib/i18n'

/** Same value as the `mfa_payment_threshold_htg` setting; the database is the one that enforces it. */
export const STEP_UP_THRESHOLD_HTG = 20_000
const FRESH_SECONDS = 600

type StepUp = {
  /** Resolves true when the payment may go ahead (no code needed, or the code was just verified). */
  confirmPayment: (amountHtg: number) => Promise<boolean>
}

const StepUpContext = createContext<StepUp>({ confirmPayment: async () => true })
export const useStepUp = () => useContext(StepUpContext)

function lastTotpAt(accessToken: string | undefined): number {
  try {
    const payload = JSON.parse(atob((accessToken ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      amr?: Array<{ method: string; timestamp: number }>
    }
    return Math.max(0, ...(payload.amr ?? []).filter((a) => a.method === 'totp').map((a) => a.timestamp))
  } catch {
    return 0
  }
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(0)
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const finish = useCallback((ok: boolean) => {
    setOpen(false)
    setCode('')
    setError('')
    resolver.current?.(ok)
    resolver.current = null
  }, [])

  const confirmPayment = useCallback(async (amountHtg: number) => {
    if (amountHtg < STEP_UP_THRESHOLD_HTG) return true
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = factors?.totp?.find((f) => f.status === 'verified')
    if (!verified) return true  // MFA not enabled: nothing to confirm with

    const { data: sess } = await supabase.auth.getSession()
    if (Date.now() / 1000 - lastTotpAt(sess.session?.access_token) < FRESH_SECONDS - 30) return true

    setAmount(amountHtg)
    setFactorId(verified.id)
    setOpen(true)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  async function verify() {
    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    if (verifyError) {
      setBusy(false)
      setCode('')
      setError(tr('Code invalide ou expiré. Réessayez.'))
      return
    }
    await supabase.auth.refreshSession()
    setBusy(false)
    finish(true)
  }

  return (
    <StepUpContext.Provider value={{ confirmPayment }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false) }}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />{tr('Confirmez le paiement')}</DialogTitle>
            <DialogDescription>
              {tr('Pour un paiement de {0} HTG, entrez le code à 6 chiffres de votre application d\'authentification.', amount.toLocaleString(LOCALE_TAG))}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verify() }}>
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Confirmer')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </StepUpContext.Provider>
  )
}
