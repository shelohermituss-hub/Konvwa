import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'

import IconAccueil       from '@/assets/icons/accueil.png'
import IconCommandes     from '@/assets/icons/commandes.png'
import IconExpeditions   from '@/assets/icons/expeditions.png'
import IconNotifications from '@/assets/icons/notifications.png'
import IconProfil        from '@/assets/icons/profil.png'

const NAV_ITEMS = [
  { label: 'Accueil',     icon: IconAccueil,       path: '/dashboard' },
  { label: 'Commandes',   icon: IconCommandes,     path: '/orders' },
  { label: 'Expéditions', icon: IconExpeditions,   path: '/shipments' },
  { label: 'Notifs',      icon: IconNotifications, path: '/notifications' },
  { label: 'Profil',      icon: IconProfil,        path: '/profile' },
]

function TopHeader() {
  const { profile, user } = useAuth()
  const [unread, setUnread] = useState(0)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0))
  }, [user])

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-white/90 backdrop-blur-md px-5 border-b border-border/60 shadow-sm">
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

function BottomNav() {
  const location = useLocation()
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0))

    const channel = supabase
      .channel('notif-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('read_at', null)
          .then(({ count }) => setUnread(count ?? 0))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border/60 pb-safe shadow-[0_-1px_12px_rgba(10,22,40,0.06)]">
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
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopHeader />
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
