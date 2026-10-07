import { Outlet, Link, useLocation } from 'react-router-dom'
import { Flag } from '@/components/shared/flag'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useScrollManager } from '@/lib/use-scroll-manager'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { LanguageToggle } from '@/components/shared/language-toggle'

import { tr } from '@/lib/i18n'
import { CurrencyToggle } from '@/components/shared/currency-toggle'
const SEO: Record<string, { title: string; description: string }> = {
  '/': {
    title: tr('KONVWA — Importez depuis Alibaba, Shein et Temu en Haïti'),
    description: tr('KONVWA vous aide à importer des produits d\'Alibaba, Shein et Temu vers Haïti. Devis clair, paiement par MonCash ou NatCash, suivi de commande et d\'expédition en gourdes (HTG).'),
  },
  '/how-it-works': {
    title: tr('Comment ça marche — KONVWA'),
    description: tr('Envoyez votre lien produit, recevez un devis en gourdes, payez par MonCash ou NatCash et suivez votre colis jusqu\'en Haïti.'),
  },
  '/prices': {
    title: tr('Tarifs — KONVWA'),
    description: tr('Tarifs d\'importation et d\'expédition vers Haïti : frais de service, transport maritime et aérien, calculés en gourdes (HTG).'),
  },
  '/faq': {
    title: tr('Questions fréquentes — KONVWA'),
    description: tr('Délais, paiements MonCash et NatCash, frais d\'expédition, suivi de colis : les réponses aux questions sur l\'importation avec KONVWA.'),
  },
  '/contact': {
    title: tr('Contact — KONVWA'),
    description: tr('Contactez l\'équipe KONVWA pour vos importations depuis Alibaba, Shein et Temu vers Haïti.'),
  },
  '/terms': {
    title: tr('Conditions d\'utilisation — KONVWA'),
    description: tr('Conditions d\'utilisation du service d\'importation KONVWA.'),
  },
  '/privacy': {
    title: tr('Confidentialité — KONVWA'),
    description: tr('Comment KONVWA collecte, utilise et protège vos données personnelles.'),
  },
}

/** Per-page title, description and canonical URL for the public pages (the SPA ships one index.html). */
function usePageSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
    const seo = SEO[path] ?? SEO['/']
    document.title = seo.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://konvwa.shop${path === '/' ? '/' : path}`)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', seo.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', seo.description)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', `https://konvwa.shop${path === '/' ? '/' : path}`)
  }, [pathname])
}

function Header() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full transition-all duration-300',
      scrolled
        ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-sm'
        : 'bg-transparent border-b border-transparent'
    )}>
      <nav className="container flex h-16 items-center justify-between px-4 mx-auto lg:px-8">
        <Link to="/">
          <KonvwaLogo size={34} />
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {[
            [tr('Boutique'), '/products'],
            [tr('Comment ça marche'), '/how-it-works'],
            [tr('Tarifs'), '/prices'],
            ['FAQ', '/faq'],
            [tr('Contact'), '/contact'],
          ].map(([label, path]) => (
            <Link key={path} to={path} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <CurrencyToggle />
          <LanguageToggle />
          {user ? (
            <Button asChild className="rounded-full">
              <Link to="/dashboard">{tr('Tableau de bord')}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="rounded-full">
                <Link to="/auth">{tr('Connexion')}</Link>
              </Button>
              <Button asChild className="btn-gradient rounded-full px-6">
                <Link to="/auth">{tr('S\'inscrire')}</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <CurrencyToggle />
          <LanguageToggle />
          <button
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={tr('Menu')}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="container px-4 py-4 mx-auto space-y-3">
            {[
              [tr('Boutique'), '/products'],
              [tr('Comment ça marche'), '/how-it-works'],
              [tr('Tarifs'), '/prices'],
              ['FAQ', '/faq'],
              [tr('Contact'), '/contact'],
            ].map(([label, path]) => (
              <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1 transition-colors">
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border flex gap-3">
              {user ? (
                <Button asChild className="w-full rounded-xl">
                  <Link to="/dashboard">{tr('Tableau de bord')}</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="flex-1 rounded-xl">
                    <Link to="/auth">{tr('Connexion')}</Link>
                  </Button>
                  <Button asChild className="flex-1 rounded-xl btn-gradient">
                    <Link to="/auth">{tr('S\'inscrire')}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container px-4 py-12 mx-auto lg:px-8">
        <div className="grid gap-8 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/">
              <KonvwaLogo size={34} />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tr('Importez des produits d\'Alibaba, Shein et Temu en Haïti sans carte bancaire.')}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-widest text-muted-foreground">{tr('Services')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Soumettre un lien')}</Link></li>
              <li><Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Comment ça marche')}</Link></li>
              <li><Link to="/prices" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Tarifs')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-widest text-muted-foreground">{tr('Aide')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">{tr('FAQ')}</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Contact')}</Link></li>
              <li><Link to="/support" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Support')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-widest text-muted-foreground">{tr('Légal')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Conditions d\'utilisation')}</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">{tr('Confidentialité')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()}{' '}{tr('KONVWA. Tous droits réservés.')}</p>
          <p className="inline-flex items-center gap-1.5">{tr('Fait avec soin pour Haïti')} <Flag code="HT" /></p>
        </div>
      </div>
    </footer>
  )
}

export function PublicLayout() {
  usePageSeo()
  // this layout scrolls the window itself: the manager only needs a (never scrolled) container
  useScrollManager(useRef<HTMLElement>(null))
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
