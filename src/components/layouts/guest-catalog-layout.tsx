import { useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { LanguageToggle } from '@/components/shared/language-toggle'
import { useScrollManager } from '@/lib/use-scroll-manager'
import { tr } from '@/lib/i18n'

/** The catalogue seen by a visitor who is not logged in: the shop without prices, with the way to log in always at hand. */
export function GuestCatalogLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useScrollManager(mainRef)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#F4F5F7]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-white px-4">
        <Link to="/" aria-label={tr('Accueil')}><KonvwaLogo size={30} /></Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button asChild variant="ghost" size="sm" className="rounded-full"><Link to="/auth" state={{ from: { pathname } }}>{tr('Connexion')}</Link></Button>
          <Button asChild size="sm" className="btn-gradient rounded-full px-4"><Link to="/auth" state={{ from: { pathname } }}>{tr('S\'inscrire')}</Link></Button>
        </div>
      </header>
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col [&>*]:flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
