import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, Check, Trash2, Info, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PushSettingsRow } from '@/components/shared/pwa-experience'

import IconValide from 'flat-color-icons/svg/ok.svg'

import { tr, pickLocalized } from '@/lib/i18n'
interface Notification {
  id: string
  title: string
  title_en?: string | null
  body_en?: string | null
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  link: string | null
  created_at: string
}

type IconConfig = {
  icon?: typeof Info
  imgSrc?: string
  iconBg: string
  iconColor: string
  dotColor: string
}

const TYPE_CONFIG: Record<string, IconConfig> = {
  info: { icon: Info, iconBg: 'bg-primary/10', iconColor: 'text-primary', dotColor: 'bg-primary' },
  success: { imgSrc: IconValide, iconBg: 'bg-emerald-50', iconColor: '', dotColor: 'bg-success' },
  warning: { icon: AlertTriangle, iconBg: 'bg-warning/10', iconColor: 'text-warning', dotColor: 'bg-warning' },
  error: { icon: Bell, iconBg: 'bg-destructive/10', iconColor: 'text-destructive', dotColor: 'bg-destructive' },
}

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('id, title, title_en, message:body, body_en, type, read, created_at, link')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setNotifications(data as Notification[])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success(tr('Toutes les notifications lues.'))
  }

  async function open(n: Notification) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    }
    if (n.link) navigate(n.link)
  }

  async function deleteOne(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const unread = notifications.filter((n) => !n.read)

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return tr('il y a {0}j', d)
    if (h > 0) return tr('il y a {0}h', h)
    return tr('À l\'instant')
  }

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Notifications')}</h1>
          {unread.length > 0 && (
            <p className="text-sm text-muted-foreground">{unread.length}{' '}{tr('non lue')}{unread.length > 1 ? 's' : ''}</p>
          )}
        </div>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary bg-primary/8 hover:bg-primary/15 transition-colors">
            <Check className="h-3.5 w-3.5" />
            {tr('Tout lire')}
          </button>
        )}
      </div>

      {/* Push settings */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <PushSettingsRow userId={user?.id} />
        </div>
      </div>

      <div className="px-4 pb-6 space-y-2">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">{tr('Aucune notification')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{tr('Vous serez notifié des mises à jour ici')}</p>
          </div>
        ) : (
          <>
            {unread.length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">{tr('Non lues')}</p>
            )}
            {notifications.map((n, i) => {
              const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
              const Icon = config.icon
              const isUnread = !n.read
              const imgSrc = config.imgSrc
              const showReadHeader = i > 0 && !notifications[i - 1].read && !isUnread && notifications.some((x) => !x.read)
              return (
                <div key={n.id}>
                  {showReadHeader && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1 pt-3">{tr('Lues')}</p>
                  )}
                  <div className={cn(
                    'relative flex gap-3 rounded-2xl p-4 transition-colors',
                    n.link && 'cursor-pointer',
                    isUnread ? 'bg-white border border-gray-100 shadow-sm' : 'bg-white/60 border border-transparent'
                  )} onClick={() => open(n)}>
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', config.iconBg)}>
                      {imgSrc
                        ? <img src={imgSrc} alt="" className="h-6 w-6 object-contain" />
                        : Icon && <Icon className={cn('h-5 w-5', config.iconColor)} />}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm leading-tight">{pickLocalized(n.title, n.title_en)}</p>
                        {isUnread && <span className={cn('h-2 w-2 rounded-full shrink-0', config.dotColor)} />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pickLocalized(n.message, n.body_en)}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">{timeAgo(n.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
