import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flag } from '@/components/shared/flag'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BadgeCheck, Bell, Camera, Check, CheckCircle2, Download, Loader2, MapPin, ShieldCheck, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { LanguageToggle } from '@/components/shared/language-toggle'
import { AddressSection } from '@/components/shared/address-section'
import { KycSection } from '@/components/shared/kyc-section'
import { MfaEnroll } from '@/components/shared/mfa-enroll'
import { PasskeysSection } from '@/components/shared/passkeys-section'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { INSTALLED_KEY, inviteInstall, isStandalone, requestInstall } from '@/lib/pwa'
import { passkeysSupported } from '@/lib/passkeys'
import { STEPS, canContinue, skippedItems, validName, validPhone, type SetupState, type StepId } from '@/lib/setup-steps'
import { trServer } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

const REQUIRED_BADGE = 'rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary'
const OPTIONAL_BADGE = 'rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground'

function StepHeader({ Icon, title, body, required }: { Icon: typeof User; title: string; body: string; required: boolean }) {
  return (
    <div className="mb-5">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <span className={required ? REQUIRED_BADGE : OPTIONAL_BADGE}>{required ? tr('Obligatoire') : tr('Facultatif')}</span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

/** One line of the access card: what we ask, why, and its state. */
function AccessRow({ Icon, title, why, required, done, action, hint }: {
  Icon: typeof Bell; title: string; why: string; required: boolean; done: boolean; action: React.ReactNode; hint?: string
}) {
  return (
    <div className={cn('rounded-2xl border p-4', done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-white')}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-emerald-100' : 'bg-primary/10')}>
          {done ? <Check className="h-5 w-5 text-emerald-700" aria-hidden="true" /> : <Icon className="h-5 w-5 text-primary" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{title}</p>
            <span className={required ? REQUIRED_BADGE : OPTIONAL_BADGE}>{required ? tr('Obligatoire') : tr('Facultatif')}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{why}</p>
          {hint && !done && <p className="mt-1.5 text-xs font-medium text-amber-700">{hint}</p>}
        </div>
      </div>
      {!done && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function SetupPage() {
  const { user, profile, refreshProfile, loading } = useAuth()
  const navigate = useNavigate()
  const push = usePushNotifications(user?.id)

  const [step, setStep] = useState<StepId>('profile')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [cameraOk, setCameraOk] = useState(false)
  const [installed, setInstalled] = useState(() => { try { return isStandalone() || !!localStorage.getItem(INSTALLED_KEY) } catch { return false } })
  const [passkeys, setPasskeys] = useState(0)
  const [addresses, setAddresses] = useState(0)
  const [mfa, setMfa] = useState(false)
  const [kyc, setKyc] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [notifBusy, setNotifBusy] = useState(false)

  // prefill from what we already know (sign-up form, social login)
  useEffect(() => {
    if (!profile) return
    const parts = (profile.full_name ?? '').trim().split(/\s+/).filter(Boolean)
    setFirstName((v) => v || parts[0] || '')
    setLastName((v) => v || parts.slice(1).join(' '))
    setPhone((v) => v || (profile.phone ?? '').replace(/^\+509\s?/, ''))
    if (validName(profile.full_name ?? '') && validPhone(profile.phone ?? '')) setProfileSaved(true)
  }, [profile])

  useEffect(() => {
    if (!user) return
    void supabase.from('kyc_submissions').select('status').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setKyc(data?.status === 'approved' || data?.status === 'pending'))
    if ('permissions' in navigator) {
      void navigator.permissions.query({ name: 'camera' as PermissionName }).then((r) => setCameraOk(r.state === 'granted')).catch(() => undefined)
    }
  }, [user])

  const notificationsUnsupported = !push.isSupported
  const state: SetupState = useMemo(() => ({
    profile: profileSaved,
    notifications: push.subscribed && push.permission === 'granted',
    notificationsUnsupported,
    passkey: passkeys > 0,
    camera: cameraOk,
    installed,
    address: addresses > 0,
    mfa,
    kyc,
  }), [profileSaved, push.subscribed, push.permission, notificationsUnsupported, passkeys, cameraOk, installed, addresses, mfa, kyc])

  const onPasskeys = useCallback((n: number) => setPasskeys(n), [])
  const onAddresses = useCallback((n: number) => setAddresses(n), [])
  const onMfa = useCallback((on: boolean) => setMfa(on), [])

  if (loading || !profile) return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  // staff and finished accounts have nothing to set up
  if (profile.role !== 'client' || profile.onboarding_completed_at) return <Navigate to={profile.role === 'client' ? '/dashboard' : '/admin'} replace />

  const index = STEPS.findIndex((s) => s.id === step)
  const current = STEPS[index]
  const total = STEPS.length - 1  // "done" is not counted as a step
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)].id)
  const back = () => setStep(STEPS[Math.max(index - 1, 0)].id)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    if (!validName(firstName) || !validName(fullName)) { toast.error(tr('Renseignez votre prénom et votre nom.')); return }
    if (!validPhone(phone)) { toast.error(tr('Renseignez un numéro de téléphone valide (8 chiffres).')); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: `+509 ${phone.trim()}`, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    setSaving(false)
    if (error) { toast.error(tr('Erreur lors de la mise à jour.')); return }
    await refreshProfile()
    setProfileSaved(true)
    // the registration is done: the best moment to offer the install (once; the pop-up stays quiet if installed or dismissed lately)
    inviteInstall(600)
    next()
  }

  async function enableNotifications() {
    setNotifBusy(true)
    const ok = await push.subscribe()
    setNotifBusy(false)
    if (!ok && Notification.permission !== 'denied') toast.error(tr('Impossible d\'activer les notifications pour le moment. Réessayez.'))
  }

  async function allowCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      setCameraOk(true)
    } catch {
      toast.error(tr('Accès à la caméra refusé. Vous pourrez l\'autoriser plus tard dans les réglages du navigateur.'))
    }
  }

  async function install() {
    const r = await requestInstall()
    if (r === 'accepted') setInstalled(true)
  }

  async function finish() {
    setFinishing(true)
    const { data, error } = await supabase.rpc('complete_onboarding', { p_skipped: skippedItems(state), p_notifications_unsupported: notificationsUnsupported })
    if (error || !data?.success) {
      setFinishing(false)
      toast.error(trServer(data?.error ?? error?.message ?? 'Erreur'))
      if (data?.code === 'notifications') setStep('access')
      else if (data?.code === 'name' || data?.code === 'phone') setStep('profile')
      return
    }
    await refreshProfile()
    navigate('/dashboard', { replace: true })
  }

  const denied = push.permission === 'denied'

  return (
    <div className="flex min-h-dvh flex-col bg-[#F4F5F7]">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <KonvwaLogo size={22} />
          <LanguageToggle />
        </div>
        {step !== 'done' && (
          <div className="mx-auto mt-3 max-w-md">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{tr('Étape {0} sur {1}', index + 1, total)}</span>
              <span>{tr('Configuration de votre compte')}</span>
            </div>
            <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-label={tr('Progression de la configuration')}>
              {STEPS.slice(0, total).map((s, i) => (
                <span key={s.id} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-200', i <= index ? 'bg-primary' : 'bg-gray-200')} />
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-6">
        {step === 'profile' && (
          <form id="profile-form" onSubmit={(e) => void saveProfile(e)}>
            <StepHeader Icon={User} required title={tr('Faisons connaissance')} body={tr('Votre nom et votre numéro nous servent à vous joindre pour vos commandes et vos livraisons.')} />
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-first" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('Prénom')}</Label>
                  <Input id="s-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="h-11 rounded-xl bg-[#F0F1F5] border-0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-last" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('Nom')}</Label>
                  <Input id="s-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="h-11 rounded-xl bg-[#F0F1F5] border-0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('Téléphone')}</Label>
                <div className="flex gap-2">
                  <div className="flex h-11 shrink-0 select-none items-center gap-1.5 rounded-xl bg-[#F0F1F5] px-3 text-sm font-semibold text-muted-foreground"><Flag code="HT" /> +509</div>
                  <Input id="s-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XXXX-XXXX" className="h-11 flex-1 rounded-xl bg-[#F0F1F5] border-0" />
                </div>
                <p className="text-xs text-muted-foreground">{tr('Idéalement le numéro de votre compte MonCash ou NatCash.')}</p>
              </div>
            </div>
          </form>
        )}

        {step === 'access' && (
          <>
            <StepHeader Icon={ShieldCheck} required={false} title={tr('Autorisations de l\'application')} body={tr('Pour bien fonctionner, KONVWA a besoin de quelques accès sur votre téléphone. Vous gardez le contrôle et pouvez les modifier à tout moment.')} />
            <div className="space-y-3">
              <AccessRow
                Icon={Bell} required={false} done={state.notifications || notificationsUnsupported}
                title={tr('Notifications')}
                why={notificationsUnsupported
                  ? tr('Indisponibles sur ce navigateur. Installez l\'application sur votre écran d\'accueil pour les recevoir.')
                  : tr('Soyez prévenu quand votre devis est prêt, que votre colis arrive ou qu\'un paiement est confirmé.')}
                hint={denied ? tr('Vous avez refusé les notifications. Vous pourrez les autoriser plus tard dans les réglages du navigateur.') : undefined}
                action={
                  <Button onClick={() => void enableNotifications()} disabled={notifBusy} className="h-11 w-full gap-2 rounded-xl">
                    {notifBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
                    {denied ? tr('Réessayer') : tr('Autoriser les notifications')}
                  </Button>
                }
              />

              <div className={cn('rounded-2xl border p-4', passkeys > 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-white')}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={OPTIONAL_BADGE}>{tr('Facultatif')}</span>
                  {passkeys > 0 && <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><Check className="h-3.5 w-3.5" aria-hidden="true" />{tr('Activé')}</span>}
                </div>
                {passkeysSupported() ? <PasskeysSection compact onChange={onPasskeys} /> : (
                  <p className="text-xs text-muted-foreground">{tr('Ce navigateur ne gère pas les passkeys. Essayez Chrome ou Safari à jour.')}</p>
                )}
              </div>

              <AccessRow
                Icon={Camera} required={false} done={state.camera}
                title={tr('Caméra')}
                why={tr('Pour photographier votre pièce d\'identité et scanner des codes, sans passer par vos fichiers.')}
                action={<Button variant="outline" onClick={() => void allowCamera()} className="h-11 w-full gap-2 rounded-xl"><Camera className="h-4 w-4" aria-hidden="true" />{tr('Autoriser la caméra')}</Button>}
              />

              <AccessRow
                Icon={Download} required={false} done={state.installed}
                title={tr('Installer l\'application')}
                why={tr('Ouvrez KONVWA depuis votre écran d\'accueil, en plein écran, comme une vraie application.')}
                action={<Button variant="outline" onClick={() => void install()} className="h-11 w-full gap-2 rounded-xl"><Download className="h-4 w-4" aria-hidden="true" />{tr('Installer')}</Button>}
              />
            </div>
          </>
        )}

        {step === 'address' && (
          <>
            <StepHeader Icon={MapPin} required={false} title={tr('Où livrer vos colis ?')} body={tr('Ajoutez une adresse maintenant pour commander plus vite. Vous pourrez en ajouter d\'autres plus tard.')} />
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><AddressSection onChange={onAddresses} /></div>
          </>
        )}

        {step === 'mfa' && (
          <>
            <StepHeader Icon={ShieldCheck} required={false} title={tr('Protégez votre argent')} body={tr('La double authentification ajoute un code de votre téléphone pour les gros paiements et les recharges. Même avec votre mot de passe, personne ne peut déplacer votre argent à votre place.')} />
            <MfaEnroll onChange={onMfa} />
          </>
        )}

        {step === 'kyc' && (
          <>
            <StepHeader Icon={BadgeCheck} required={false} title={tr('Vérifiez votre identité')} body={tr('Une pièce d\'identité et un selfie débloquent les gros montants et le badge « Vérifié ». L\'équipe examine votre dossier rapidement.')} />
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><KycSection /></div>
          </>
        )}

        {step === 'done' && (
          <div>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" /></div>
              <h1 className="text-xl font-bold tracking-tight">{tr('Votre compte est prêt !')}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{tr('Voici le récapitulatif. Ce que vous avez passé reste disponible dans Profil.')}</p>
            </div>
            <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {([
                [tr('Informations personnelles'), state.profile, true],
                [tr('Notifications'), state.notifications || notificationsUnsupported, false],
                [tr('Empreinte / Face ID'), state.passkey, false],
                [tr('Caméra'), state.camera, false],
                [tr('Adresse de livraison'), state.address, false],
                [tr('Double authentification'), state.mfa, false],
                [tr('Vérification d\'identité'), state.kyc, false],
              ] as Array<[string, boolean, boolean]>).map(([label, done, required]) => (
                <li key={label} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                    {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{done ? tr('Fait') : required ? tr('Requis') : tr('Plus tard')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          {index > 0 && step !== 'done' && (
            <Button type="button" variant="outline" onClick={back} aria-label={tr('Retour')} className="h-12 w-12 shrink-0 rounded-2xl p-0"><ArrowLeft className="h-4 w-4" /></Button>
          )}
          {step === 'profile' ? (
            <Button type="submit" form="profile-form" disabled={saving} className="h-12 flex-1 rounded-2xl text-sm font-bold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Continuer')}
            </Button>
          ) : step === 'done' ? (
            <>
              <Button type="button" variant="outline" onClick={back} className="h-12 rounded-2xl">{tr('Retour')}</Button>
              <Button type="button" onClick={() => void finish()} disabled={finishing} className="h-12 flex-1 rounded-2xl text-sm font-bold">
                {finishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Accéder à mon compte')}
              </Button>
            </>
          ) : (
            <>
              {!current.required && (
                <Button type="button" variant="ghost" onClick={next} className="h-12 rounded-2xl text-muted-foreground">{tr('Passer')}</Button>
              )}
              <Button type="button" onClick={next} disabled={!canContinue(step, state)} className="h-12 flex-1 rounded-2xl text-sm font-bold">{tr('Continuer')}</Button>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
