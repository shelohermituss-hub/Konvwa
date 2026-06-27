import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, LogOut, LayoutDashboard, ShoppingBag, Ship, MessageSquare, User, Wallet, HelpCircle, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'

import IconAccueil       from 'flat-color-icons/svg/home.svg'
import IconCommandes     from 'flat-color-icons/svg/briefcase.svg'
import IconExpeditions   from 'flat-color-icons/svg/shipped.svg'
import IconNotifications from 'flat-color-icons/svg/comments.svg'
import IconProfil        from 'flat-color-icons/svg/contacts.svg'

const NAV_ITEMS = [
  { label: 'Accueil',     icon: IconAccueil,       lucide: LayoutDashboard, path: '/dashboard' },
  { label: 'Commandes',   icon: IconCommandes,     lucide: ShoppingBag,     path: '/orders' },
  { label: 'Expéditions', icon: IconExpeditions,   lucide: Ship,            path: '/shipments' },
  { label: 'Notifs',      icon: IconNotifications, lucide: MessageSquare,   path: '/notifications' },
  { label: 'Profil',      icon: IconProfil,        lucide: User,            path: '/profile' },
]

const SIDEBAR_EXTRAS = [
  { label: 'Soumettre',   lucide: Send,       path: '/submit' },
  { label: 'Portefeuille', lucide: Wallet,    path: '/wallet' },
  { label: 'Support',     lucide: HelpCircle, path: '/support' },
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

function DesktopSidebar({ unread }: { unread: number }) {
  const { profile, user, signOut } = useAuth()
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
              <img
                src={item.icon}
                alt=""
                className={cn('h-5 w-5 object-contain shrink-0 transition-opacity', isActive ? 'opacity-100' : 'opacity-60')}
              />
              <span className="text-sm">{item.label}</span>
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
            const Icon = item.lucide
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
            title="Déconnexion"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function TopHeader({ unread }: { unread: number }) {
  const { profile } = useAuth()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-white/95 backdrop-blur-md px-5 border-b border-gray-100 shadow-sm">
      <Link to="/dashboard">
        <KonvwaLogo size={30} />
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <Bell className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
        <Link to="/profile">
          <Avatar className="h-8 w-8 ring-2 ring-border shadow-sm">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}

function BottomNav({ unread }: { unread: number }) {
  const location = useLocation()

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
                  src={item.icon}
                  alt={item.label}
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
                {item.label}
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

      <div className="flex-1 flex flex-col lg:ml-[240px] xl:ml-[260px] min-h-screen">
        {/* Mobile top header */}
        <div className="lg:hidden">
          <TopHeader unread={unread} />
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
