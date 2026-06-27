import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Home, Package, Ship, Bell, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Accueil', icon: Home, path: '/dashboard' },
  { label: 'Commandes', icon: Package, path: '/orders' },
  { label: 'Expéditions', icon: Ship, path: '/shipments' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Profil', icon: User, path: '/profile' },
]

function TopHeader() {
  const { profile } = useAuth()
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-5">
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
          K
        </div>
        <span className="font-bold text-base tracking-tight">KONVWA</span>
      </Link>
      <Link to="/profile">
        <Avatar className="h-8 w-8 ring-2 ring-border">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-safe">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
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
                'relative flex items-center justify-center rounded-xl transition-all duration-200',
                isActive ? 'bg-primary w-10 h-8' : 'w-8 h-8'
              )}>
                <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} strokeWidth={isActive ? 2 : 1.8} />
                {isNotif && unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
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
