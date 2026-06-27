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
  Loader2, Eye, EyeOff, Mail, Lock,
  ArrowLeft, CheckCircle2, ShieldX,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'

type AuthView = 'login' | 'register' | 'forgot' | 'otp' | 'reset' | 'denied'

const INPUT = 'h-11 rounded-xl bg-muted border-transparent focus-visible:border-primary/60 focus-visible:bg-background font-medium transition-colors'
const CARD  = 'bg-white rounded-2xl border border-gray-100 shadow-sm'

// ── Schemas ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const registerSchema = z.object({
  fullName:        z.string().min(2, 'Nom complet requis (min. 2 caractères)'),
  email:           z.string().email('Adresse e-mail invalide'),
  phone:           z.string().optional(),
  password:        z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string(),
  acceptTerms:     z.boolean().refine((v) => v === true, { message: 'Vous devez accepter les conditions' }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

const forgotSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
})

const resetSchema = z.object({
  password:        z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
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
        aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
      Retour
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
        <span className="bg-white px-3 text-xs text-muted-foreground">ou</span>
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
              Importation · Haïti
            </p>
          </div>
        </div>
        {children}
      </div>
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
          {t === 'login' ? 'Se connecter' : 'Créer un compte'}
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

  async function onSubmit(values: LoginForm) {
    const { error } = await signIn(values.email, values.password)
    if (error) {
      toast.error('Connexion échouée', { description: error.message })
      return
    }
    toast.success('Connexion réussie !')
    navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Bon retour !</h2>
        <p className="text-sm text-muted-foreground mt-1">Connectez-vous à votre compte KONVWA</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="l-email" label="Adresse e-mail" error={errors.email?.message}>
          <Input
            id="l-email"
            type="email"
            placeholder="votre@email.com"
            autoComplete="email"
            {...register('email')}
            className={cn(INPUT, errors.email && 'border-destructive')}
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="l-password" className="text-sm font-semibold">Mot de passe</Label>
            <button
              type="button"
              onClick={onForgot}
              className="text-xs text-primary hover:underline font-semibold"
            >
              Mot de passe oublié ?
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

        <PrimaryBtn type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Se connecter
        </PrimaryBtn>
      </form>

      <Divider />

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <button type="button" onClick={onSwitch} className="text-primary font-bold hover:underline">
          Créer un compte
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

  async function onSubmit(values: RegisterForm) {
    const { error } = await signUp(values.email, values.password, values.fullName, values.phone)
    if (error) {
      toast.error('Inscription échouée', { description: error.message })
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
    toast.success('Compte créé avec succès !')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Créer un compte</h2>
        <p className="text-sm text-muted-foreground mt-1">Rejoignez KONVWA gratuitement aujourd'hui</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="r-name" label="Nom complet" error={errors.fullName?.message}>
          <Input
            id="r-name"
            type="text"
            placeholder="Jean Dupont"
            autoComplete="name"
            {...register('fullName')}
            className={cn(INPUT, errors.fullName && 'border-destructive')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="r-email" label="E-mail" error={errors.email?.message}>
            <Input
              id="r-email"
              type="email"
              placeholder="votre@email.com"
              autoComplete="email"
              {...register('email')}
              className={cn(INPUT, errors.email && 'border-destructive')}
            />
          </Field>
          <div className="space-y-1.5">
            <Label htmlFor="r-phone" className="text-sm font-semibold">
              Téléphone{' '}
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
            <Label htmlFor="r-password" className="text-sm font-semibold">Mot de passe</Label>
            <PasswordInput
              id="r-password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-confirm" className="text-sm font-semibold">Confirmer</Label>
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
            J'accepte les{' '}
            <span className="text-primary font-semibold">conditions d'utilisation</span>
            {' '}et la{' '}
            <span className="text-primary font-semibold">politique de confidentialité</span>
          </Label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>
        )}

        <PrimaryBtn type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Créer mon compte
        </PrimaryBtn>
      </form>

      <Divider />

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <button type="button" onClick={onSwitch} className="text-primary font-bold hover:underline">
          Se connecter
        </button>
      </p>
    </div>
  )
}

// ── Forgot password ───────────────────────────────────────────────────────────
function ForgotView({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  async function onSubmit(values: ForgotForm) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth?type=reset`,
    })
    if (error) {
      toast.error('Erreur', { description: error.message })
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
        <h2 className="text-xl font-bold mb-2">E-mail envoyé !</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
        </p>
        <button type="button" onClick={onBack} className="text-sm text-primary font-bold hover:underline">
          ← Retour à la connexion
        </button>
      </div>
    )
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <BackBtn onClick={onBack} />

      <div className="mb-6">
        <ViewIcon icon={Mail} />
        <h2 className="text-2xl font-bold tracking-tight">Mot de passe oublié ?</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Entrez votre e-mail et nous vous enverrons un lien de réinitialisation.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="f-email" label="Adresse e-mail" error={errors.email?.message}>
          <Input
            id="f-email"
            type="email"
            placeholder="votre@email.com"
            autoComplete="email"
            {...register('email')}
            className={cn(INPUT, errors.email && 'border-destructive')}
          />
        </Field>

        <PrimaryBtn type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Envoyer le lien
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
      toast.error('Code invalide', { description: error.message })
      return
    }
    toast.success('Vérification réussie !')
    navigate('/dashboard', { replace: true })
  }

  async function resend() {
    await supabase.auth.signInWithOtp({ email })
    toast.success('Code renvoyé !')
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <BackBtn onClick={onBack} />

      <div className="mb-6">
        <ViewIcon icon={Lock} />
        <h2 className="text-2xl font-bold tracking-tight">Vérification OTP</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Entrez le code à 6 chiffres envoyé à{' '}
          <span className="font-semibold text-foreground">{email || 'votre e-mail'}</span>
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
          Vérifier le code
        </PrimaryBtn>

        <p className="text-center text-sm text-muted-foreground">
          Pas reçu le code ?{' '}
          <button type="button" onClick={resend} className="text-primary font-bold hover:underline">
            Renvoyer
          </button>
        </p>
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
      toast.error('Erreur', { description: error.message })
      return
    }
    toast.success('Mot de passe mis à jour !')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className={cn(CARD, 'p-7')}>
      <BackBtn onClick={onBack} />

      <div className="mb-6">
        <ViewIcon icon={Lock} />
        <h2 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h2>
        <p className="text-sm text-muted-foreground mt-1">Choisissez un nouveau mot de passe sécurisé.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rs-password" className="text-sm font-semibold">Nouveau mot de passe</Label>
          <PasswordInput
            id="rs-password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
            className={errors.password ? 'border-destructive' : ''}
          />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rs-confirm" className="text-sm font-semibold">Confirmer le mot de passe</Label>
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
          Réinitialiser le mot de passe
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
      <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
      </p>
      <PrimaryBtn onClick={() => navigate('/dashboard', { replace: true })}>
        Retour à l'accueil
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
