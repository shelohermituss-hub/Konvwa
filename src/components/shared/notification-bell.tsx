import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Bell, Check, Clock, CreditCard, Info, Package } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { resolveNotificationLink } from '@/lib/notification-link'
import { cn } from '@/lib/utils'
import { tr, pickLocalized } from '@/lib/i18n'

const CHANGED = 'konvwa:notifications-changed'

/** Number of UNREAD notifications of the signed-in user (live; refreshed when something marks one as read). */
export function useUnreadCount(userId: string | undefined): number {
  const [unread, setUnread] = useState(0)
  // several components read the count: every hook instance needs its own realtime channel (a channel cannot get listeners after subscribe)
  const instance = useId()

  const load = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false)
    setUnread(count ?? 0)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    void load()
    const channel = supabase
      .channel(`notif-badge-${userId}-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe()
    const onChanged = () => void load()
    const onVisible = () => { if (!document.hidden) void load() }
    window.addEventListener(CHANGED, onChanged)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener(CHANGED, onChanged)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, load, instance])

  return unread
}

/** Tell every badge to refresh (after a notification was read from another place). */
export function notifyNotificationsChanged() { window.dispatchEvent(new Event(CHANGED)) }

interface NotifItem {
  id: string; title: string; body: string; title_en: string | null; body_en: string | null
  type: string; read: boolean; created_at: string; link: string | null
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'order') return <Package className="h-4 w-4 text-primary" />
  if (type === 'payment' || type === 'success') return <CreditCard className="h-4 w-4 text-emerald-500" />
  if (type === 'alert' || type === 'warning' || type === 'error') return <AlertCircle className="h-4 w-4 text-amber-500" />
  return <Info className="h-4 w-4 text-blue-500" />
}

/** The bell: unread count, the latest notifications, a click opens the page of the action and marks it as read. */
export function NotificationBell({ allHref = '/notifications' }: { allHref?: string }) {
  const { user, profile } = useAuth()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const unread = useUnreadCount(user?.id)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadItems = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, title_en, body_en, type, read, created_at, link')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8)
    setItems((data ?? []) as NotifItem[])
    setLoading(false)
  }, [user])
  useEffect(() => { if (open) void loadItems() }, [open, loadItems])

  async function openNotif(n: NotifItem) {
    setOpen(false)
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      notifyNotificationsChanged()
    }
    navigate(resolveNotificationLink({ link: n.link, type: n.type, title: n.title }, profile?.role))
  }

  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    notifyNotificationsChanged()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={unread > 0 ? tr('Notifications ({0} non lues)', unread) : tr('Notifications')}
          className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Bell className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-white tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl border-gray-100 p-0 shadow-xl" sideOffset={8}>
        <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><Bell className="h-4 w-4 text-primary" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{tr('Notifications')}</p>
            <p className="text-xs text-muted-foreground">{unread > 0 ? `${unread} ${tr('non lue')}${unread > 1 ? 's' : ''}` : tr('Tout est lu')}</p>
          </div>
          {unread > 0 && (
            <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Check className="h-3 w-3" />{tr('Tout lire')}
            </button>
          )}
        </div>

        <div className="max-h-96 divide-y divide-border/40 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="p-6 text-center"><div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">{tr('Aucune notification')}</p>
            </div>
          ) : items.map((n) => (
            <button key={n.id} type="button" onClick={() => void openNotif(n)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30">
              <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', n.read ? 'bg-muted' : 'bg-primary/10')}><NotifIcon type={n.type} /></div>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm leading-tight', n.read ? 'font-medium text-muted-foreground' : 'font-semibold')}>{pickLocalized(n.title, n.title_en)}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{pickLocalized(n.body, n.body_en)}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: lang === 'fr' ? frLocale : undefined })}
                </p>
              </div>
              {!n.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className="border-t border-border/50 p-3">
          <Link to={allHref} onClick={() => setOpen(false)} className="block w-full rounded-xl py-2.5 text-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}>
            {tr('Voir toutes les notifications')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
