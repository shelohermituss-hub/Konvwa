import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useCallback, useRef } from 'react'
import { useScrollManager } from '@/lib/use-scroll-manager'
import { haptics } from '@/lib/haptic'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard, ShoppingBag, Ship, Bell, User, Wallet, HelpCircle, Send,
  Globe, ChevronDown, Check, LogOut, Settings, Activity, CreditCard,
  ShoppingCart, Package, Download, Boxes,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n, type Lang } from '@/lib/i18n-context'
import { useCart } from '@/lib/cart-context'
import { usePendingPayments } from '@/hooks/use-pending-payments'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { PwaExperience } from '@/components/shared/pwa-experience'
import { isStandalone, requestInstall } from '@/lib/pwa'
import { NotificationBell, useUnreadCount } from '@/components/shared/notification-bell'

import { ThemeQuickToggle } from '@/components/shared/theme-switch'
import { tr } from '@/lib/i18n'
import { CurrencyToggle } from '@/components/shared/currency-toggle'
const NAV_ITEMS = [
  { labelKey: 'nav.home',      Icon: LayoutDashboard, path: '/dashboard' },
  { labelKey: 'nav.orders',    Icon: ShoppingBag,     path: '/orders' },
  { labelKey: 'nav.shipments', Icon: Ship,            path: '/shipments' },
  { labelKey: 'nav.products',  Icon: Package,         path: '/products' },
  { labelKey: 'nav.profile',   Icon: User,            path: '/profile' },
]

// the bulk-sourcing shelf lives next to "Products" in the sidebar; on the phone it is reached from the Products page itself
const SIDEBAR_ITEMS = [
  ...NAV_ITEMS.slice(0, 4),
  { labelKey: 'nav.wholesale', Icon: Boxes, path: '/wholesale' },
  ...NAV_ITEMS.slice(4),
]



const SIDEBAR_EXTRAS = [
  { label: tr('Soumettre'),      Icon: Send,          path: '/submit' },
  { label: tr('Panier'),         Icon: ShoppingCart,  path: '/cart' },
  { label: tr('Portefeuille'),   Icon: Wallet,        path: '/wallet' },
  { label: tr('Notifications'),  Icon: Bell,          path: '/notifications' },
  { label: tr('Support'),        Icon: HelpCircle,    path: '/support' },
]

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
]

function ProfileMenu() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [canInstall] = useState(() => !isStandalone())

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <Avatar className="h-8 w-8 ring-2 ring-border shadow-sm">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-0 shadow-xl border-gray-100" sideOffset={8}>
        <div className="px-4 py-4 border-b border-border/50 flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{profile?.full_name || tr('Client')}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="p-1.5">
          <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2.5 gap-3" onClick={() => navigate('/profile')}>
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{t('nav.profile')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2.5 gap-3" onClick={() => navigate('/profile')}>
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{tr('Paramètres du compte')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2.5 gap-3" onClick={() => navigate('/activity-log')}>
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{t('activity.title')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2.5 gap-3" onClick={() => navigate('/billing')}>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{t('billing.title')}</span>
          </DropdownMenuItem>
          {canInstall && (
            <DropdownMenuItem
              className="rounded-xl cursor-pointer px-3 py-2.5 gap-3"
              onSelect={() => { void requestInstall() }}
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{tr('Installer l\'application')}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="mx-2 my-1" />
          <DropdownMenuItem
            className="rounded-xl cursor-pointer px-3 py-2.5 gap-3 text-destructive focus:text-destructive focus:bg-destructive/8"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium text-sm">{tr('Se déconnecter')}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Language / Langue" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 hover:bg-muted transition-colors text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase hidden sm:block">{current.code}</span>
          <ChevronDown className="h-3 w-3 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-gray-100" sideOffset={8}>
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            className="rounded-lg cursor-pointer px-3 py-2 gap-3"
            onClick={() => setLang(l.code)}
          >
            <span className="flex h-6 w-8 items-center justify-center rounded-md bg-muted text-[10px] font-bold uppercase text-muted-foreground">{l.code}</span>
            <span className="flex-1 text-sm font-medium">{t(`lang.${l.code}`)}</span>
            {lang === l.code && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DesktopSidebar({ unread }: { unread: number }) {
  const { profile, user, signOut } = useAuth()
  const { t } = useI18n()
  const location = useLocation()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-[240px] xl:w-[260px] border-r border-gray-100 bg-white z-40 shadow-sm">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-3">
          <KonvwaLogo size={32} />
          <div className="leading-none">
            <span className="font-bold text-base tracking-tight block">KONVWA</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{tr('Importation Haïti')}</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-2 space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pb-2">{tr('Navigation')}</p>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
          const { Icon } = item

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group',
                isActive
                  ? 'bg-primary/8 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
              )}
              <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} size={18} />
              <span className="text-sm">{t(item.labelKey)}</span>
            </Link>
          )
        })}

        <div className="pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pb-2">{tr('Actions')}</p>
          {SIDEBAR_EXTRAS.map((item) => {
            const isActive = location.pathname === item.path
            const isNotif = item.path === '/notifications'
            const { Icon } = item
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                  isActive
                    ? 'bg-primary/8 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
                <span className="text-sm">{item.label}</span>
                {isNotif && unread > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-none">{profile?.full_name || tr('Client')}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            title={tr('Se déconnecter')}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function CartBadge() {
  const { count } = useCart()
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/cart')}
      aria-label={tr('Panier')}
      className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
    >
      <ShoppingCart className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
      {count > 0 && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

function TopHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-white/95 backdrop-blur-md px-4 border-b border-gray-100 shadow-sm">
      <Link to="/dashboard">
        <KonvwaLogo size={30} />
      </Link>
      <div className="flex items-center gap-1">
        <CurrencyToggle compact className="mr-1" />
        <LanguageSwitcher />
        <ThemeQuickToggle />
        <CartBadge />
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  )
}

function BottomNav({ unread: _unread }: { unread: number }) {
  const location = useLocation()
  const { t } = useI18n()
  const handleNavTap = useCallback(() => haptics.nav(), [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 pb-safe shadow-[0_-1px_12px_rgba(10,22,40,0.06)]">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path)) ||
            (item.path === '/products' && location.pathname.startsWith('/wholesale'))
          const { Icon } = item

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavTap}
              className="flex flex-1 flex-col items-center justify-center gap-1 relative"
            >
              <div className={cn(
                'flex items-center justify-center rounded-2xl transition-all duration-200',
                isActive ? 'bg-primary/10 w-12 h-9' : 'w-11 h-9'
              )}>
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2.2 : 1.7}
                  className={cn(
                    'transition-colors duration-200',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <span className={cn(
                'text-[10px] font-semibold transition-colors leading-none',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {t(item.labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function ClientLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const unread = useUnreadCount(user?.id)
  const { refresh: refreshCart } = useCart()
  usePendingPayments(user?.id, () => { void refreshCart() })
  const mainRef = useRef<HTMLElement>(null)
  useScrollManager(mainRef)

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      <DesktopSidebar unread={unread} />

      <div className="flex-1 min-w-0 flex flex-col lg:ml-[240px] xl:ml-[260px] h-full min-h-0">
        <div className="lg:hidden">
          <TopHeader />
        </div>

        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
          <PwaExperience userId={user?.id} />
          <div key={location.pathname} className="page-enter flex min-h-full flex-col [&>*]:flex-1">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav unread={unread} />
      </div>
    </div>
  )
}
