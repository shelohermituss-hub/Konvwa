import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  Loader2, Fingerprint, Eye, EyeOff, Mail, Lock,
  ArrowLeft, CheckCircle2, ShieldX,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'

import { tr } from '@/lib/i18n'
import { isCancelled, passkeysSupported } from '@/lib/passkeys'
import { useCaptcha } from '@/components/shared/captcha'
import { LanguageToggle } from '@/components/shared/language-toggle'
type AuthView = 'login' | 'register' | 'forgot' | 'otp' | 'reset' | 'denied'

const INPUT = 'h-11 rounded-xl bg-muted border-transparent focus-visible:border-primary/60 focus-visible:bg-background font-medium transition-colors'
const CARD  = 'bg-white rounded-2xl border border-gray-100 shadow-sm'

// ── Schemas ───────────────────────────────────────────────────────────────────
const newPassword = z.string()
  .min(10, tr('Minimum 10 caractères'))
  .regex(/[a-zA-Z]/, tr('Ajoutez au moins une lettre'))
  .regex(/\d/, tr('Ajoutez au moins un chiffre'))

const loginSchema = z.object({
  email:    z.string().email(tr('Adresse e-mail invalide')),
  password: z.string().min(1, tr('Mot de passe requis')),
})

const registerSchema = z.object({
  fullName:        z.string().min(2, tr('Nom complet requis (min. 2 caractères)')),
  email:           z.string().email(tr('Adresse e-mail invalide')),
  phone:           z.string().optional(),
  password:        newPassword,
  confirmPassword: z.string(),
  acceptTerms:     z.boolean().refine((v) => v === true, { message: tr('Vous devez accepter les conditions') }),
}).refine((d) => d.password === d.confirmPassword, {
  message: tr('Les mots de passe ne correspondent pas'),
  path: ['confirmPassword'],
})

const forgotSchema = z.object({
  email: z.string().email(tr('Adresse e-mail invalide')),
})

const resetSchema = z.object({
  password:        newPassword,
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: tr('Les mots de passe ne correspondent pas'),
  path: ['confirmPassword'],
})

type LoginForm    = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>
type ForgotForm   = z.infer<typeof forgotSchema>
type ResetForm    = z.infer<typeof resetSchema>

// ── Primitives ────────────────────────────────────────────────────────────────
function PasswordInput({ id, placeholder, className, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className={cn(INPUT, 'pr-10', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? tr('Masquer le mot de passe') : tr('Afficher le mot de passe')}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function Field({ id, label, error, children }: { id?: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

function PrimaryBtn({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn('w-full h-11 rounded-xl font-semibold text-white', className)}
      style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
    >
      {children}
    </Button>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors group"
    >
      <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
      {tr('Retour')}
    </button>
  )
}

function ViewIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
      style={{ background: 'rgba(240,90,40,0.10)' }}
    >
      <Icon className="h-6 w-6" style={{ color: '#F05A28' }} />
    </div>
  )
}

function Divider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-xs text-muted-foreground">{tr('ou')}</span>
      </div>
    </div>
  )
}

// ── Layout wrapper ────────────────────────────────────────────────────────────
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#F4F5F7] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] space-y-5">
        {/* Brand */}
        <div className="flex flex-col items-center gap-1.5">
          <KonvwaLogo iconOnly size={44} />
          <div className="text-center leading-none mt-1">
            <p className="font-bold text-xl tracking-tight">KONVWA</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
              {tr('Importation · Haïti')}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Social sign-in (Google / Facebook via Supabase OAuth) ─────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

function SocialButtons() {
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null)

  async function signInWith(provider: 'google' | 'facebook') {
    setLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) {
      setLoading(null)
      toast.error(tr('Connexion impossible'), {
        description: tr('Connexion {0} indisponible pour le moment.', provider === 'google' ? 'Google' : 'Facebook'),
      })
    }
  }

  const base = 'flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-foreground transition-colors hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60'

  return (
    <div className="space-y-2.5">
      <button type="button" onClick={() => signInWith('google')} disabled={loading !== null} className={base}>
        {loading === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
        {tr('Continuer avec Google')}
      </button>
      <button type="button" onClick={() => signInWith('facebook')} disabled={loading !== null} className={base}>
        {loading === 'facebook' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FacebookIcon />}
        {tr('Continuer avec Facebook')}
      </button>
    </div>
  )
}

// ── Tab switcher (login / register only) ──────────────────────────────────────
function AuthTabs({ view, onChange }: { view: 'login' | 'register'; onChange: (v: 'login' | 'register') => void }) {
  return (
    <div className="flex rounded-2xl bg-white border border-gray-100 shadow-sm p-1">
      {(['login', 'register'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200',
            view === t ? 'text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          style={view === t ? { background: 'linear-gradient(135deg, #F05A28, #D44E21)' } : {}}
        >
          {t === 'login' ? tr('Se connecter') : tr('Créer un compte')}
        </button>
      ))}
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginView({ onSwitch, onForgot }: { onSwitch: () => void; onForgot: () => void }) {
  const { signIn, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const captcha = useCaptcha()
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  async function signInWithPasskey() {
    // Supabase Auth applies the captcha protection to passkey sign-in too (no exemption possible): ask for the tick first
    const usedToken = captcha.token
    if (!usedToken) {
      toast.info(tr('Cochez d\'abord « Je suis un humain », puis touchez de nouveau « Se connecter avec une passkey ».'))
      document.getElementById('login-captcha')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setPasskeyBusy(true)
    const { error } = await supabase.auth.signInWithPasskey({ options: { captchaToken: usedToken } })
    setPasskeyBusy(false)
    if (usedToken) captcha.reset()
    if (error) {
      if (!isCancelled(error)) { console.error('passkey sign-in', error); toast.error(tr('Connexion par passkey impossible'), { description: `${error.message} — ${tr('Connectez-vous avec votre mot de passe, puis ajoutez-en une dans Profil > Confidentialité & sécurité.')}` }) }
      return
    }
    toast.success(tr('Connexion réussie !'))
    navigate('/dashboard', { replace: true })
  }

  async function onSubmit(values: LoginForm) {
    const { error } = await signIn(values.email, values.password, captcha.token)
    captcha.reset()
    if (error) {
      toast.error(tr('Connexion échouée'), { description: error.message })
      return
    }
    toast.success(tr('Connexion réussie !'))
    navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">{tr('Bon retour !')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{tr('Connectez-vous à votre compte KONVWA')}</p>
      </div>

      {passkeysSupported() && (
        <button
          type="button"
          onClick={() => void signInWithPasskey()}
          disabled={passkeyBusy}
          className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          {passkeyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" aria-hidden="true" />}
          {tr('Se connecter avec une passkey')}
        </button>
      )}

      <SocialButtons />
      <Divider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="l-email" label={tr('Adresse e-mail')} error={errors.email?.message}>
          <Input
            id="l-email"
            type="email"
            placeholder={tr('votre@email.com')}
            autoComplete="email"
            {...register('email')}
            className={cn(INPUT, errors.email && 'border-destructive')}
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="l-password" className="text-sm font-semibold">{tr('Mot de passe')}</Label>
            <button
              type="button"
              onClick={onForgot}
              className="text-xs text-primary hover:underline font-semibold"
            >
              {tr('Mot de passe oublié ?')}
            </button>
          </div>
          <PasswordInput
            id="l-password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
            className={errors.password ? 'border-destructive' : ''}
          />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        </div>

        <div id="login-captcha">{captcha.widget}</div>

        <PrimaryBtn type="submit" disabled={isSubmitting || !captcha.ready} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr('Se connecter')}
        </PrimaryBtn>
      </form>

      <Divider />

      <p className="text-center text-sm text-muted-foreground">
        {tr('Pas encore de compte ?')}{' '}
        <button type="button" onClick={onSwitch} className="text-primary font-bold hover:underline">
          {tr('Créer un compte')}
        </button>
      </p>
    </div>
  )
}

// ── Register ──────────────────────────────────────────────────────────────────
function RegisterView({ onSwitch }: { onSwitch: () => void }) {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptTerms: false },
  })
  const acceptTerms = watch('acceptTerms')
  const captcha = useCaptcha()

  async function onSubmit(values: RegisterForm) {
    const { error, needsConfirmation } = await signUp(values.email, values.password, values.fullName, values.phone, captcha.token)
    captcha.reset()
    if (error) {
      toast.error(tr('Inscription échouée'), { description: error.message })
      return
    }
    if (needsConfirmation) {
      toast.success(tr('Compte créé !'), {
        description: tr('Un e-mail de confirmation a été envoyé à {0}. Cliquez sur le lien pour activer votre compte.', values.email),
        duration: 10000,
      })
      onSwitch()
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await Promise.all([
        supabase.from('profiles').insert({
          user_id:   user.id,
          full_name: values.fullName,
          phone:     values.phone || null,
          role:      'client',
        }),
        supabase.from('wallets').insert({
          user_id:           user.id,
          available_balance: 0,
          blocked_balance:   0,
        }),
      ])
    }
    toast.success(tr('Compte créé avec succès !'))
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">{tr('Créer un compte')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{tr('Rejoignez KONVWA gratuitement aujourd\'hui')}</p>
      </div>

      <SocialButtons />
      <Divider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="r-name" label={tr('Nom complet')} error={errors.fullName?.message}>
          <Input
            id="r-name"
            type="text"
            placeholder={tr('Jean Dupont')}
            autoComplete="name"
            {...register('fullName')}
            className={cn(INPUT, errors.fullName && 'border-destructive')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="r-email" label={tr('E-mail')} error={errors.email?.message}>
            <Input
              id="r-email"
              type="email"
              placeholder={tr('votre@email.com')}
              autoComplete="email"
              {...register('email')}
              className={cn(INPUT, errors.email && 'border-destructive')}
            />
          </Field>
          <div className="space-y-1.5">
            <Label htmlFor="r-phone" className="text-sm font-semibold">
              {tr('Téléphone')}{' '}
              <span className="text-muted-foreground font-normal text-[10px]">(opt.)</span>
            </Label>
            <Input
              id="r-phone"
              type="tel"
              placeholder="+509 1234-5678"
              autoComplete="tel"
              {...register('phone')}
              className={INPUT}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-password" className="text-sm font-semibold">{tr('Mot de passe')}</Label>
            <PasswordInput
              id="r-password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{tr('10 caractères minimum, avec des lettres et des chiffres.')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-confirm" className="text-sm font-semibold">{tr('Confirmer')}</Label>
            <PasswordInput
              id="r-confirm"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-destructive' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 pt-1">
          <Checkbox
            id="terms"
            checked={!!acceptTerms}
            onCheckedChange={(v) => setValue('acceptTerms', v as boolean, { shouldValidate: true })}
            className={cn(errors.acceptTerms && 'border-destructive')}
          />
          <Label htmlFor="terms" className="text-sm leading-normal cursor-pointer font-normal">
            {tr('J\'accepte les')}{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">{tr('conditions d\'utilisation')}</a>
            {' '}{tr('et la')}{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">{tr('politique de confidentialité')}</a>
          </Label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>
        )}

        {captcha.widget}

        <PrimaryBtn type="submit" disabled={isSubmitting || !captcha.ready} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr('Créer mon compte')}
        </PrimaryBtn>
      </form>

      <Divider />

      <p className="text-center text-sm text-muted-foreground">
        {tr('Déjà un compte ?')}{' '}
        <button type="button" onClick={onSwitch} className="text-primary font-bold hover:underline">
          {tr('Se connecter')}
        </button>
      </p>
    </div>
  )
}

// ── Forgot password ───────────────────────────────────────────────────────────
function ForgotView({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false)
  const captcha = useCaptcha()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  async function onSubmit(values: ForgotForm) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth?type=reset`,
      captchaToken: captcha.token,
    })
    captcha.reset()
    if (error) {
      toast.error(tr('Erreur'), { description: error.message })
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className={cn(CARD, 'p-8 text-center')}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">{tr('E-mail envoyé !')}</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {tr('Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.')}
        </p>
        <button type="button" onClick={onBack} className="text-sm text-primary font-bold hover:underline">
          {tr('← Retour à la connexion')}
        </button>
      </div>
    )
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <BackBtn onClick={onBack} />

      <div className="mb-6">
        <ViewIcon icon={Mail} />
        <h2 className="text-2xl font-bold tracking-tight">{tr('Mot de passe oublié ?')}</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {tr('Entrez votre e-mail et nous vous enverrons un lien de réinitialisation.')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="f-email" label={tr('Adresse e-mail')} error={errors.email?.message}>
          <Input
            id="f-email"
            type="email"
            placeholder={tr('votre@email.com')}
            autoComplete="email"
            {...register('email')}
            className={cn(INPUT, errors.email && 'border-destructive')}
          />
        </Field>

        {captcha.widget}

        <PrimaryBtn type="submit" disabled={isSubmitting || !captcha.ready} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr('Envoyer le lien')}
        </PrimaryBtn>
      </form>
    </div>
  )
}

// ── OTP Verification ──────────────────────────────────────────────────────────
function OtpView({ email, onBack }: { email: string; onBack: () => void }) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onVerify() {
    if (otp.length < 6) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    setLoading(false)
    if (error) {
      toast.error(tr('Code invalide'), { description: error.message })
      return
    }
    toast.success(tr('Vérification réussie !'))
    navigate('/dashboard', { replace: true })
  }

  const captcha = useCaptcha()
  async function resend() {
    if (!captcha.ready) { toast.error(tr('Validez d\'abord le captcha.')); return }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { captchaToken: captcha.token } })
    captcha.reset()
    if (error) { toast.error(tr('Erreur'), { description: error.message }); return }
    toast.success(tr('Code renvoyé !'))
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <BackBtn onClick={onBack} />

      <div className="mb-6">
        <ViewIcon icon={Lock} />
        <h2 className="text-2xl font-bold tracking-tight">{tr('Vérification OTP')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tr('Entrez le code à 6 chiffres envoyé à')}{' '}
          <span className="font-semibold text-foreground">{email || tr('votre e-mail')}</span>
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-10 rounded-xl bg-muted border-0 shadow-none first:rounded-xl last:rounded-xl text-base font-bold"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <PrimaryBtn onClick={onVerify} disabled={otp.length < 6 || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr('Vérifier le code')}
        </PrimaryBtn>

        <p className="text-center text-sm text-muted-foreground">
          {tr('Pas reçu le code ?')}{' '}
          <button type="button" onClick={resend} disabled={!captcha.ready} className="text-primary font-bold hover:underline disabled:opacity-50 disabled:no-underline">
            {tr('Renvoyer')}
          </button>
        </p>
        {captcha.widget}
      </div>
    </div>
  )
}

// ── Reset password ────────────────────────────────────────────────────────────
function ResetView({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  })

  async function onSubmit(values: ResetForm) {
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      toast.error(tr('Erreur'), { description: error.message })
      return
    }
    toast.success(tr('Mot de passe mis à jour !'))
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <BackBtn onClick={onBack} />

      <div className="mb-6">
        <ViewIcon icon={Lock} />
        <h2 className="text-2xl font-bold tracking-tight">{tr('Nouveau mot de passe')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{tr('Choisissez un nouveau mot de passe sécurisé.')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rs-password" className="text-sm font-semibold">{tr('Nouveau mot de passe')}</Label>
          <PasswordInput
            id="rs-password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
            className={errors.password ? 'border-destructive' : ''}
          />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{tr('10 caractères minimum, avec des lettres et des chiffres.')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rs-confirm" className="text-sm font-semibold">{tr('Confirmer le mot de passe')}</Label>
          <PasswordInput
            id="rs-confirm"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={errors.confirmPassword ? 'border-destructive' : ''}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <PrimaryBtn type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr('Réinitialiser le mot de passe')}
        </PrimaryBtn>
      </form>
    </div>
  )
}

// ── Access denied ─────────────────────────────────────────────────────────────
function DeniedView() {
  const navigate = useNavigate()

  return (
    <div className={cn(CARD, 'p-8 text-center')}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-4">
        <ShieldX className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">{tr('Accès refusé')}</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        {tr('Vous n\'avez pas les permissions nécessaires pour accéder à cette page.')}
      </p>
      <PrimaryBtn onClick={() => navigate('/dashboard', { replace: true })}>
        {tr('Retour à l\'accueil')}
      </PrimaryBtn>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AuthPage() {
  const [view, setView] = useState<AuthView>('login')
  const [otpEmail] = useState('')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const type = searchParams.get('type')
    if (type === 'reset')  setView('reset')
    if (type === 'otp')    setView('otp')
    if (type === 'denied') setView('denied')
  }, [searchParams])

  const isTabView = view === 'login' || view === 'register'

  return (
    <AuthLayout>
      <div className="mb-4 flex justify-end">
        <LanguageToggle />
      </div>
      {isTabView && (
        <AuthTabs
          view={view as 'login' | 'register'}
          onChange={setView}
        />
      )}

      {view === 'login'    && <LoginView    onSwitch={() => setView('register')} onForgot={() => setView('forgot')} />}
      {view === 'register' && <RegisterView onSwitch={() => setView('login')} />}
      {view === 'forgot'   && <ForgotView   onBack={() => setView('login')} />}
      {view === 'otp'      && <OtpView      email={otpEmail} onBack={() => setView('login')} />}
      {view === 'reset'    && <ResetView    onBack={() => setView('login')} />}
      {view === 'denied'   && <DeniedView />}
    </AuthLayout>
  )
}
