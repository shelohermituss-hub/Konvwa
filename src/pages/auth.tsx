import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Eye, EyeOff } from 'lucide-react'
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

function PasswordInput({ id, placeholder, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function LoginTab() {
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
    // Role-based redirect is handled by AuthGuard after session loads
    navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Adresse e-mail</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="votre@email.com"
          autoComplete="email"
          {...register('email')}
          className={cn(errors.email && 'border-destructive')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Mot de passe</Label>
          <Link to="/login" className="text-xs text-primary hover:underline">Oublié ?</Link>
        </div>
        <PasswordInput
          id="login-password"
          placeholder="••••••••"
          autoComplete="current-password"
          {...register('password')}
          className={cn(errors.password && 'border-destructive')}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full h-11 rounded-xl" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Se connecter
      </Button>
    </form>
  )
}

function RegisterTab() {
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

    // Create profile + wallet (no DB trigger, done explicitly)
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="reg-name">Nom complet</Label>
        <Input
          id="reg-name"
          type="text"
          placeholder="Jean Dupont"
          autoComplete="name"
          {...register('fullName')}
          className={cn(errors.fullName && 'border-destructive')}
        />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-email">Adresse e-mail</Label>
        <Input
          id="reg-email"
          type="email"
          placeholder="votre@email.com"
          autoComplete="email"
          {...register('email')}
          className={cn(errors.email && 'border-destructive')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-phone">
          Téléphone <span className="text-muted-foreground text-xs">(optionnel)</span>
        </Label>
        <Input
          id="reg-phone"
          type="tel"
          placeholder="+509 1234-5678"
          autoComplete="tel"
          {...register('phone')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reg-password">Mot de passe</Label>
          <PasswordInput
            id="reg-password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
            className={cn(errors.password && 'border-destructive')}
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
            className={cn(errors.confirmPassword && 'border-destructive')}
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
        <Label htmlFor="terms" className="text-sm leading-normal cursor-pointer">
          J'accepte les{' '}
          <span className="text-primary">conditions d'utilisation</span>{' '}
          et la{' '}
          <span className="text-primary">politique de confidentialité</span>
        </Label>
      </div>
      {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>}

      <Button type="submit" className="w-full h-11 rounded-xl" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer mon compte
      </Button>
    </form>
  )
}

export function AuthPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Top brand bar */}
      <div className="flex items-center justify-center gap-3 pt-10 pb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
          K
        </div>
        <span className="font-bold text-xl tracking-tight">KONVWA</span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pb-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm p-6">
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6 rounded-xl">
              <TabsTrigger value="login" className="flex-1 rounded-lg">Se connecter</TabsTrigger>
              <TabsTrigger value="register" className="flex-1 rounded-lg">Créer un compte</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="mb-5">
                <h1 className="text-xl font-bold">Bon retour !</h1>
                <p className="text-sm text-muted-foreground mt-1">Connectez-vous à votre compte KONVWA</p>
              </div>
              <LoginTab />
            </TabsContent>

            <TabsContent value="register">
              <div className="mb-5">
                <h1 className="text-xl font-bold">Créer un compte</h1>
                <p className="text-sm text-muted-foreground mt-1">Rejoignez KONVWA gratuitement</p>
              </div>
              <RegisterTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Back to landing */}
      <div className="pb-8 text-center">
        <Link
          to="/onboarding"
          onClick={() => localStorage.removeItem('konvwa_onboarding_done')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Revoir la présentation
        </Link>
      </div>
    </div>
  )
}
