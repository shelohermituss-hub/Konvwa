import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, MessageSquare, Package, CreditCard, AlertCircle, Info, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'

interface NotifActivity {
  id: string
  title: string
  message: string
  type: string
  read_at: string | null
  created_at: string
  metadata?: Record<string, string>
}

const PAGE_SIZE = 10

function groupByDate(items: NotifActivity[]): Record<string, NotifActivity[]> {
  return items.reduce((acc, item) => {
    const d = new Date(item.created_at)
    let key: string
    if (isToday(d)) key = 'Today'
    else if (isYesterday(d)) key = 'Yesterday'
    else key = format(d, 'EEEE dd MMMM').toUpperCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, NotifActivity[]>)
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'order') return <Package className="h-4 w-4 text-primary" />
  if (type === 'payment') return <CreditCard className="h-4 w-4 text-emerald-500" />
  if (type === 'alert') return <AlertCircle className="h-4 w-4 text-amber-500" />
  if (type === 'message') return <MessageSquare className="h-4 w-4 text-blue-500" />
  return <Info className="h-4 w-4 text-muted-foreground" />
}

function iconBg(type: string) {
  if (type === 'order') return 'bg-primary/8'
  if (type === 'payment') return 'bg-emerald-50'
  if (type === 'alert') return 'bg-amber-50'
  if (type === 'message') return 'bg-blue-50'
  return 'bg-muted'
}

export function ActivityLogPage() {
  const { user, profile } = useAuth()
  const [activities, setActivities] = useState<NotifActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  async function load(pageNum: number, reset = false) {
    if (!user) return
    if (pageNum === 0) setLoading(true)
    else setLoadingMore(true)

    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, read_at, created_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (data) {
      if (reset) setActivities(data as NotifActivity[])
      else setActivities(prev => [...prev, ...data as NotifActivity[]])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => { load(0) }, [user])

  async function loadMore() {
    const next = page + 1
    setPage(next)
    await load(next)
  }

  const grouped = groupByDate(activities)
  const dateKeys = Object.keys(grouped)

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your recent account activity</p>
      </div>

      <div className="px-4 pb-6 space-y-5">
        {loading ? (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-12 text-center">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Your account activity will appear here</p>
          </div>
        ) : (
          <>
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 mb-2">
                  {dateKey}
                </p>
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden divide-y divide-border/40">
                  {grouped[dateKey].map((item) => (
                    <div key={item.id}>
                      <div
                        className="flex items-start gap-3 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      >
                        {/* Avatar circle */}
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full shrink-0 mt-0.5', iconBg(item.type))}>
                          <ActivityIcon type={item.type} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight">{item.title}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!item.read_at && (
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                              <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.message}</p>
                        </div>

                        {item.message && item.message.length > 80 && (
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 transition-transform', expanded === item.id && 'rotate-180')} />
                        )}
                      </div>

                      {/* Expanded comment block */}
                      {expanded === item.id && (
                        <div className="px-5 pb-4 ml-12">
                          <div className="rounded-xl bg-[#F4F5F7] border border-border/50 p-3.5">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold">
                                {initials}
                              </div>
                              <span className="text-xs font-semibold">{profile?.full_name || 'You'}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(item.created_at), 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed italic">"{item.message}"</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-2xl border border-border bg-white py-3.5 text-sm font-semibold text-muted-foreground hover:bg-muted/20 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Load More
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
