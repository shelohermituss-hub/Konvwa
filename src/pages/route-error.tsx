import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Compass, RefreshCw } from 'lucide-react'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { reportError } from '@/lib/error-reporter'
import { tr } from '@/lib/i18n'

function Shell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F4F5F7] px-6 text-center">
      <KonvwaLogo size={28} />
      <Compass className="mt-8 h-12 w-12 text-primary/40" aria-hidden />
      <h1 className="mt-4 text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{text}</p>
      <div className="mt-6 flex gap-2">{children}</div>
    </div>
  )
}

const primary = 'inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white'
const secondary = 'inline-flex h-11 items-center gap-2 rounded-full border border-gray-300 bg-white px-6 text-sm font-bold'

export function NotFoundPage() {
  return (
    <Shell title={tr('Page introuvable')} text={tr('Le lien est peut-être incorrect ou la page a été déplacée.')}>
      <Link to="/" className={primary}>{tr('Retour à l\'accueil')}</Link>
    </Shell>
  )
}

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) reportError(error instanceof Error ? error : String(error), 'route')
  }, [error, notFound])

  if (notFound) return <NotFoundPage />
  return (
    <Shell title={tr('Une erreur est survenue')} text={tr('Nous en avons été informés. Rechargez la page ou revenez à l\'accueil.')}>
      <button type="button" onClick={() => window.location.reload()} className={primary}><RefreshCw className="h-4 w-4" />{tr('Recharger')}</button>
      <Link to="/" className={secondary}>{tr('Accueil')}</Link>
    </Shell>
  )
}
