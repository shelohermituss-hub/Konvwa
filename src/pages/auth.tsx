import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Eye, EyeOff, Package, Wallet, Ship, Star } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const registerSchema = z.object({
  fullName: z.string().min(2, 'Nom complet requis (min. 2 caractères)'),
  email: z.string().email('Adresse e-mail invalide'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine((v) => v === true, { message: 'Vous devez accepter les conditions' }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

const FEATURES = [
  {
    icon: Package,
    title: 'Importation simplifiée',
    desc: 'Alibaba, Shein, Temu — on commande pour vous',
  },
  {
    icon: Wallet,
    title: 'Paiement local',
    desc: 'MonCash & NatCash acceptés, en HTG',
  },
  {
    icon: Ship,
    title: 'Suivi en temps réel',
    desc: 'De la Chine à votre porte, étape par étape',
  },
]

function PasswordInput({ id, placeholder, className, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function LoginTab({ onSwitch }: { onSwitch: () => void }) {
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
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Bon retour !</h2>
        <p className="text-sm text-muted-foreground mt-1">Connectez-vous à votre compte KONVWA</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Adresse e-mail</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="votre@email.com"
            autoComplete="email"
            {...register('email')}
            className={cn('h-11 rounded-xl', errors.email && 'border-destructive focus-visible:ring-destructive')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Mot de passe</Label>
            <Link to="#" className="text-xs text-primary hover:underline font-medium">
              Mot de passe oublié ?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
            className={cn('h-11 rounded-xl', errors.password && 'border-destructive')}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl font-semibold mt-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Se connecter
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Pas encore de compte ?{' '}
        <button onClick={onSwitch} className="text-primary font-semibold hover:underline">
          Créer un compte
        </button>
      </p>
    </div>
  )
}

function RegisterTab({ onSwitch }: { onSwitch: () => void }) {
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
      toast.error("Inscription échouée", { description: error.message })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await Promise.all([
        supabase.from('profiles').insert({
          user_id: user.id,
          full_name: values.fullName,
          phone: values.phone || null,
          role: 'client',
        }),
        supabase.from('wallets').insert({
          user_id: user.id,
          available_balance: 0,
          blocked_balance: 0,
        }),
      ])
    }

    toast.success('Compte créé avec succès !')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Créer un compte</h2>
        <p className="text-sm text-muted-foreground mt-1">Rejoignez KONVWA gratuitement aujourd'hui</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">Nom complet</Label>
          <Input
            id="reg-name"
            type="text"
            placeholder="Jean Dupont"
            autoComplete="name"
            {...register('fullName')}
            className={cn('h-11 rounded-xl', errors.fullName && 'border-destructive')}
          />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">E-mail</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="votre@email.com"
              autoComplete="email"
              {...register('email')}
              className={cn('h-11 rounded-xl', errors.email && 'border-destructive')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-phone">
              Téléphone <span className="text-muted-foreground text-[10px]">(optionnel)</span>
            </Label>
            <Input
              id="reg-phone"
              type="tel"
              placeholder="+509 1234-5678"
              autoComplete="tel"
              {...register('phone')}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Mot de passe</Label>
            <PasswordInput
              id="reg-password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password')}
              className={cn('h-11 rounded-xl', errors.password && 'border-destructive')}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm">Confirmer</Label>
            <PasswordInput
              id="reg-confirm"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className={cn('h-11 rounded-xl', errors.confirmPassword && 'border-destructive')}
            />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <div className="flex items-start gap-3 pt-1">
          <Checkbox
            id="terms"
            checked={!!acceptTerms}
            onCheckedChange={(checked) => setValue('acceptTerms', checked as boolean, { shouldValidate: true })}
            className={cn(errors.acceptTerms && 'border-destructive')}
          />
          <Label htmlFor="terms" className="text-sm leading-normal cursor-pointer font-normal">
            J'accepte les{' '}
            <span className="text-primary font-medium">conditions d'utilisation</span>
            {' '}et la{' '}
            <span className="text-primary font-medium">politique de confidentialité</span>
          </Label>
        </div>
        {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>}

        <Button type="submit" className="w-full h-11 rounded-xl font-semibold mt-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Créer mon compte
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Déjà un compte ?{' '}
        <button onClick={onSwitch} className="text-primary font-semibold hover:underline">
          Se connecter
        </button>
      </p>
    </div>
  )
}

export function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')

  return (
    <div className="min-h-[100dvh] flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex w-[480px] xl:w-[540px] shrink-0 flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0A1628 0%, #0F2040 60%, #1A1035 100%)' }}>

        {/* Decorative orbs */}
        <div className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #F05A28 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-[300px] h-[300px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F05A28 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-xl"
              style={{ background: 'linear-gradient(135deg, #F05A28, #AF3E12)' }}>
              K
            </div>
            <div>
              <span className="font-bold text-xl text-white tracking-tight">KONVWA</span>
              <p className="text-[10px] text-white/40 uppercase tracking-widest leading-none mt-0.5">Importation · Haïti</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16 xl:mt-20">
            <h1 className="text-4xl xl:text-[42px] font-bold text-white leading-[1.15] tracking-tight">
              Importez depuis<br />
              <span style={{ color: '#F05A28' }}>la Chine.</span><br />
              Payez en HTG.
            </h1>
            <p className="mt-4 text-white/60 text-base leading-relaxed max-w-sm">
              La plateforme d'importation haïtienne. Des produits du monde entier livrés chez vous, simplement.
            </p>
          </div>

          {/* Feature cards */}
          <div className="mt-10 space-y-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="flex items-center gap-4 rounded-2xl p-4 border border-white/8 backdrop-blur-sm"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(240,90,40,0.2)' }}>
                    <Icon className="h-5 w-5" style={{ color: '#F05A28' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{f.title}</p>
                    <p className="text-white/50 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Testimonial */}
          <div className="mt-auto pt-8">
            <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed italic">
                "KONVWA m'a permis de commander des produits depuis Alibaba et de payer directement avec MonCash. Livraison rapide et suivi parfait !"
              </p>
              <div className="flex items-center gap-3 mt-4">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #F05A28, #AF3E12)' }}>
                  M
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">Marie-Claire J.</p>
                  <p className="text-white/40 text-[10px]">Commerçante, Port-au-Prince</p>
                </div>
              </div>
            </div>

            <p className="text-white/25 text-xs mt-6 text-center">
              © {new Date().getFullYear()} KONVWA · Tous droits réservés
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col min-h-[100dvh] bg-[#F7F8FA]">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center justify-center gap-3 pt-8 pb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg, #F05A28, #AF3E12)' }}>
            K
          </div>
          <span className="font-bold text-xl tracking-tight">KONVWA</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-md">
            {/* Tab switcher */}
            <div className="flex rounded-2xl bg-white border border-border shadow-sm p-1 mb-5">
              {(['login', 'register'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200',
                    tab === t
                      ? 'text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={tab === t ? { background: 'linear-gradient(135deg, #F05A28, #AF3E12)' } : {}}
                >
                  {t === 'login' ? 'Se connecter' : 'Créer un compte'}
                </button>
              ))}
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-border bg-white shadow-sm p-6 sm:p-8">
              {tab === 'login' ? (
                <LoginTab onSwitch={() => setTab('register')} />
              ) : (
                <RegisterTab onSwitch={() => setTab('login')} />
              )}
            </div>

            {/* Back to onboarding */}
            <div className="text-center mt-5">
              <Link
                to="/onboarding"
                onClick={() => localStorage.removeItem('konvwa_onboarding_done')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Revoir la présentation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
