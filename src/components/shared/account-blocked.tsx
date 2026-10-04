import { Link } from 'react-router-dom'
import { LifeBuoy, LogOut, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { useAuth } from '@/lib/auth-context'
import { tr, DATE_LOCALE } from '@/lib/i18n'

/** Shown instead of the app to a suspended or banned customer. */
export function AccountBlocked({ kind, reason, until }: { kind: 'banned' | 'suspended'; reason: string | null; until: string | null }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#F4F5F7] px-6 text-center">
      <KonvwaLogo size={30} />
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-bold">{kind === 'banned' ? tr('Compte désactivé') : tr('Compte suspendu')}</h1>
        <p className="text-sm text-muted-foreground">
          {kind === 'banned'
            ? tr('Votre compte a été désactivé par notre équipe.')
            : until
              ? tr('Votre compte est suspendu jusqu\'au {0}.', new Date(until).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }))
              : tr('Votre compte est suspendu par notre équipe.')}
        </p>
        {reason && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
            <span className="font-semibold">{tr('Motif :')}</span> {reason}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {kind === 'suspended' && (
          <Button asChild className="h-11 rounded-xl gap-2"><Link to="/support"><LifeBuoy className="h-4 w-4" aria-hidden="true" />{tr('Contacter le support')}</Link></Button>
        )}
        <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" aria-hidden="true" />{tr('Se déconnecter')}
        </Button>
      </div>
    </div>
  )
}
