import { useCallback, useEffect, useState } from 'react'
import { Loader2, Monitor, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getDeviceId } from '@/lib/device'
import { STEP_UP_THRESHOLD_HTG } from '@/lib/step-up'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface DeviceRow { device_id: string; label: string; last_seen: string; first_seen: string }
type Enrollment = { factorId: string; qr: string; secret: string }

function CodeForm({ busy, error, onSubmit, submitLabel }: {
  busy: boolean; error: string; onSubmit: (code: string) => void; submitLabel: string
}) {
  const [code, setCode] = useState('')
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(code) }}>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label={tr('Code à 6 chiffres')}
        className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.4em]"
      />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full rounded-xl">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </form>
  )
}

export function SecuritySection() {
  const { user } = useAuth()
  const deviceId = getDeviceId()

  const [factorId, setFactorId] = useState<string | null>(null)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [confirmingOff, setConfirmingOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  const loadMfa = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactorId(data?.totp?.find((f) => f.status === 'verified')?.id ?? null)
    setMfaLoading(false)
  }, [])

  const loadDevices = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_devices')
      .select('device_id, label, last_seen, first_seen')
      .is('revoked_at', null)
      .order('last_seen', { ascending: false })
    setDevices((data ?? []) as DeviceRow[])
    setDevicesLoading(false)
  }, [user])

  useEffect(() => { void loadMfa() }, [loadMfa])
  useEffect(() => { void loadDevices() }, [loadDevices])

  async function startEnroll() {
    setBusy(true)
    setError('')
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'KONVWA' })
    setBusy(false)
    if (enrollError || !data) {
      toast.error(tr('Impossible d\'activer la double authentification pour le moment.'))
      return
    }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirmEnroll(code: string) {
    if (!enrollment) return
    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code })
    if (verifyError) {
      setBusy(false)
      setError(tr('Code invalide ou expiré. Réessayez.'))
      return
    }
    await supabase.auth.refreshSession()
    setBusy(false)
    setEnrollment(null)
    await loadMfa()
    toast.success(tr('Double authentification activée.'))
  }

  async function disableMfa() {
    if (!factorId) return
    setBusy(true)
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    setConfirmingOff(false)
    if (unenrollError) {
      toast.error(tr('Impossible de désactiver : reconnectez-vous puis réessayez.'))
      return
    }
    await supabase.auth.refreshSession()
    await loadMfa()
    toast.success(tr('Double authentification désactivée.'))
  }

  async function signOutOthers() {
    setSigningOut(true)
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
    if (!signOutError) await supabase.rpc('revoke_other_devices', { p_device_id: deviceId })
    setSigningOut(false)
    if (signOutError) {
      toast.error(tr('Impossible de déconnecter les autres appareils.'))
      return
    }
    await loadDevices()
    toast.success(tr('Les autres appareils ont été déconnectés.'))
  }

  const others = devices.filter((d) => d.device_id !== deviceId)
  const fmt = (iso: string) => new Date(iso).toLocaleString(DATE_LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mt-5 space-y-5 border-t border-border/50 pt-5">
      {/* Two-step verification */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {factorId ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
              {tr('Double authentification')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {factorId
                ? tr('Activée : un code de votre application est demandé à la connexion et pour les paiements de {0} HTG ou plus.', STEP_UP_THRESHOLD_HTG.toLocaleString(LOCALE_TAG))
                : tr('Ajoutez une protection : même avec votre mot de passe, personne ne pourra se connecter ou payer sans votre téléphone.')}
            </p>
          </div>
          {mfaLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : factorId ? (
            confirmingOff ? (
              <div className="flex shrink-0 gap-2">
                <button onClick={() => setConfirmingOff(false)} className="text-xs font-semibold text-muted-foreground">{tr('Annuler')}</button>
                <button onClick={() => void disableMfa()} disabled={busy} className="text-xs font-bold text-destructive">{tr('Confirmer')}</button>
              </div>
            ) : (
              <button onClick={() => setConfirmingOff(true)} className="shrink-0 text-xs font-bold text-destructive">{tr('Désactiver')}</button>
            )
          ) : (
            <button onClick={() => void startEnroll()} disabled={busy} className="shrink-0 text-xs font-bold text-primary">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tr('Activer')}
            </button>
          )}
        </div>
      </div>

      {/* Devices */}
      <div>
        <p className="text-sm font-semibold">{tr('Appareils connectés')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{tr('Les appareils sur lesquels votre compte a été ouvert.')}</p>
        <div className="mt-3 space-y-2">
          {devicesLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-muted/50" />
          ) : devices.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('Aucun appareil enregistré.')}</p>
          ) : devices.map((d) => {
            const Icon = /Android|iOS/.test(d.label) ? Smartphone : Monitor
            return (
              <div key={d.device_id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{tr('Dernière activité')} : {fmt(d.last_seen)}</p>
                </div>
                {d.device_id === deviceId && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{tr('Cet appareil')}</span>
                )}
              </div>
            )
          })}
        </div>
        {others.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => void signOutOthers()} disabled={signingOut} className="mt-3 rounded-xl">
            {signingOut && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {tr('Déconnecter tous les autres appareils')}
          </Button>
        )}
      </div>

      <Dialog open={!!enrollment} onOpenChange={(o) => { if (!o) { setEnrollment(null); setError('') } }}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr('Activer la double authentification')}</DialogTitle>
            <DialogDescription>
              {tr('Scannez ce code avec Google Authenticator, Authy ou 1Password, puis entrez le code à 6 chiffres.')}
            </DialogDescription>
          </DialogHeader>
          {enrollment && (
            <div className="flex flex-col items-center gap-2">
              <img src={enrollment.qr} alt={tr('Code QR à scanner')} className="h-44 w-44 rounded-xl border border-gray-100 bg-white p-2" />
              <p className="text-center text-xs text-muted-foreground">
                {tr('Ou saisissez cette clé :')} <span className="select-all font-mono font-semibold">{enrollment.secret}</span>
              </p>
            </div>
          )}
          <CodeForm busy={busy} error={error} onSubmit={(c) => void confirmEnroll(c)} submitLabel={tr('Valider')} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
