import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Home, Package, Ship, Bell, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'

const NAV_ITEMS = [
  { label: 'Accueil',     icon: Home,    path: '/dashboard' },
  { label: 'Commandes',   icon: Package, path: '/orders' },
  { label: 'Expéditions', icon: Ship,    path: '/shipments' },
  { label: 'Notifs',      icon: Bell,    path: '/notifications' },
  { label: 'Profil',      icon: User,    path: '/profile' },
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
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-white/90 backdrop-blur-[16px] px-4 border-b border-border/70">
      <Link to="/dashboard">
        <KonvwaLogo size={30} />
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-all duration-150"
        >
          <Bell className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
        <Link to="/profile">
          <Avatar className="h-8 w-8 ring-2 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
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
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-[20px] border-t border-border/70 pb-safe">
      <div className="flex items-center h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
          const isNotif = item.path === '/notifications'

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-1 flex-col items-center justify-center gap-1"
            >
              {/* Active = filled primary rectangle · Inactive = icon only */}
              <div className={cn(
                'flex items-center justify-center transition-all duration-150 relative',
                isActive
                  ? 'bg-primary rounded-2xl px-4 h-9 min-w-[52px]'
                  : 'h-9 w-9'
              )}>
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-150',
                    isActive ? 'text-white' : 'text-muted-foreground'
                  )}
                  strokeWidth={1.8}
                />
                {isNotif && unread > 0 && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-[10px] font-semibold leading-none transition-colors duration-150',
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
