import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard, ShoppingBag, Ship, Bell, User, Wallet, HelpCircle, Send,
  Globe, ChevronDown, Check, LogOut, Settings, Activity, CreditCard,
  Store, Phone, MessageCircle, Star, MapPin,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n, type Lang } from '@/lib/i18n-context'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'

import IconHome      from 'flat-color-icons/svg/home.svg'
import IconOrders    from 'flat-color-icons/svg/briefcase.svg'
import IconShipments from 'flat-color-icons/svg/shipped.svg'
import IconNotifs    from 'flat-color-icons/svg/comments.svg'
import IconProfile   from 'flat-color-icons/svg/contacts.svg'

const NAV_ITEMS = [
  { labelKey: 'nav.home',      Icon: LayoutDashboard, flatIcon: IconHome,      path: '/dashboard' },
  { labelKey: 'nav.orders',    Icon: ShoppingBag,     flatIcon: IconOrders,    path: '/orders' },
  { labelKey: 'nav.shipments', Icon: Ship,            flatIcon: IconShipments, path: '/shipments' },
  { labelKey: 'nav.notifs',    Icon: Bell,            flatIcon: IconNotifs,    path: '/notifications' },
  { labelKey: 'nav.profile',   Icon: User,            flatIcon: IconProfile,   path: '/profile' },
]

const SIDEBAR_EXTRAS = [
  { label: 'Submit',  Icon: Send,       path: '/submit' },
  { label: 'Wallet',  Icon: Wallet,     path: '/wallet' },
  { label: 'Support', Icon: HelpCircle, path: '/support' },
]

const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇺🇸' },
]

function useUnread(userId: string | undefined) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!userId) return
    const fetch = () =>
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .then(({ count }) => setUnread(count ?? 0))

    fetch()

    const channel = supabase
      .channel('notif-badge-' + userId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return unread
}

function SuppliersPopover() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors">
          <Store className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0 rounded-2xl shadow-xl border-gray-100" sideOffset={8}>
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border/50 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm">{t('suppliers.title')}</p>
            <p className="text-xs text-muted-foreground">{t('suppliers.subtitle')}</p>
          </div>
        </div>

        {/* Supplier list */}
        <div className="divide-y divide-border/40 max-h-[380px] overflow-y-auto">
          {SUPPLIERS.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              {/* Avatar */}
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm"
                style={{ background: s.coverGradient }}
              >
                {s.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{s.name}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.specialty}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-semibold">{s.rating}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{s.location}</span>
                  </div>
                </div>
              </div>

              {/* Contact + Profile buttons */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => { navigate(`/suppliers/${s.id}`); setOpen(false) }}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
                >
                  Profil
                </button>
                <a
                  href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="h-2.5 w-2.5" />
                  WA
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer contact info for first supplier on display */}
        <div className="p-3 border-t border-border/50 flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            {SUPPLIERS[0].phone}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ProfileMenu() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()

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
        {/* Header */}
        <div className="px-4 py-4 border-b border-border/50 flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{profile?.full_name || 'Client'}</p>
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
            <span className="font-medium text-sm">Account Setting</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2.5 gap-3" onClick={() => navigate('/activity-log')}>
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{t('activity.title')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-xl cursor-pointer px-3 py-2.5 gap-3" onClick={() => navigate('/billing')}>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{t('billing.title')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-2 my-1" />
          <DropdownMenuItem
            className="rounded-xl cursor-pointer px-3 py-2.5 gap-3 text-destructive focus:text-destructive focus:bg-destructive/8"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium text-sm">Sign Out</span>
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
        <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 hover:bg-muted transition-colors text-muted-foreground">
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
            <span className="text-base">{l.flag}</span>
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
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-3">
          <KonvwaLogo size={32} />
          <div className="leading-none">
            <span className="font-bold text-base tracking-tight block">KONVWA</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Importation Haïti</span>
          </div>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-2 space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pb-2">Navigation</p>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
          const isNotif = item.path === '/notifications'
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
              {isNotif && unread > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )
        })}

        <div className="pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pb-2">Actions</p>
          {SIDEBAR_EXTRAS.map((item) => {
            const isActive = location.pathname === item.path
            const { Icon } = item
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                  isActive
                    ? 'bg-primary/8 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Profile + signout */}
      <div className="px-3 py-3 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-none">{profile?.full_name || 'Client'}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function TopHeader({ unread: _unread, userId: _userId }: { unread: number; userId?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-white/95 backdrop-blur-md px-4 border-b border-gray-100 shadow-sm">
      <Link to="/dashboard">
        <KonvwaLogo size={30} />
      </Link>
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <SuppliersPopover />
        <ProfileMenu />
      </div>
    </header>
  )
}

function BottomNav({ unread }: { unread: number }) {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 pb-safe shadow-[0_-1px_12px_rgba(10,22,40,0.06)]">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
          const isNotif = item.path === '/notifications'

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-1 flex-col items-center justify-center gap-1 relative"
            >
              <div className={cn(
                'relative flex items-center justify-center rounded-2xl transition-all duration-200',
                isActive ? 'bg-primary/12 w-12 h-11' : 'w-11 h-10'
              )}>
                <img
                  src={item.flatIcon}
                  alt={t(item.labelKey)}
                  className={cn(
                    'h-6 w-6 object-contain transition-all duration-200',
                    isActive ? 'opacity-100 scale-105' : 'opacity-55'
                  )}
                />
                {isNotif && unread > 0 && !isActive && (
                  <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
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
  const unread = useUnread(user?.id)

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar unread={unread} />

      <div className="flex-1 min-w-0 flex flex-col lg:ml-[240px] xl:ml-[260px] min-h-screen">
        {/* Mobile top header */}
        <div className="lg:hidden">
          <TopHeader unread={unread} userId={user?.id} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <BottomNav unread={unread} />
      </div>
    </div>
  )
}
