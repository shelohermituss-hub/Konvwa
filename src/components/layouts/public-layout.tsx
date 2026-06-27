import { Outlet, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

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
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-sm shadow-primary/30">
            K
          </div>
          <span className="font-bold text-xl tracking-tight">KONVWA</span>
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {[
            ['Comment ça marche', '/how-it-works'],
            ['Tarifs', '/prices'],
            ['FAQ', '/faq'],
            ['Contact', '/contact'],
          ].map(([label, path]) => (
            <Link key={path} to={path} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-4">
          {user ? (
            <Button asChild className="rounded-full">
              <Link to="/dashboard">Tableau de bord</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="rounded-full">
                <Link to="/auth">Connexion</Link>
              </Button>
              <Button asChild className="btn-gradient rounded-full px-6">
                <Link to="/auth">S'inscrire</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="container px-4 py-4 mx-auto space-y-3">
            {[
              ['Comment ça marche', '/how-it-works'],
              ['Tarifs', '/prices'],
              ['FAQ', '/faq'],
              ['Contact', '/contact'],
            ].map(([label, path]) => (
              <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1 transition-colors">
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border flex gap-3">
              {user ? (
                <Button asChild className="w-full rounded-xl">
                  <Link to="/dashboard">Tableau de bord</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="flex-1 rounded-xl">
                    <Link to="/auth">Connexion</Link>
                  </Button>
                  <Button asChild className="flex-1 rounded-xl btn-gradient">
                    <Link to="/auth">S'inscrire</Link>
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
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                K
              </div>
              <span className="font-bold text-xl tracking-tight">KONVWA</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Importez des produits d'Alibaba, Shein et Temu en Haïti sans carte bancaire.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-widest text-muted-foreground">Services</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">Soumettre un lien</Link></li>
              <li><Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">Comment ça marche</Link></li>
              <li><Link to="/prices" className="text-muted-foreground hover:text-foreground transition-colors">Tarifs</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-widest text-muted-foreground">Aide</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link to="/support" className="text-muted-foreground hover:text-foreground transition-colors">Support</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-widest text-muted-foreground">Légal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Conditions d'utilisation</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Confidentialité</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} KONVWA. Tous droits réservés.</p>
          <p>Fait avec soin pour Haïti 🇭🇹</p>
        </div>
      </div>
    </footer>
  )
}

export function PublicLayout() {
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
