import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/shared/status-badge'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Entry { id: string; status: string; created_at: string }

/** Dated list of every status the order went through (filled by a database trigger). */
export function OrderHistory({ orderId }: { orderId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])

  useEffect(() => {
    let cancelled = false
    void supabase.from('order_status_history').select('id, status, created_at')
      .eq('order_id', orderId).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (!cancelled) setEntries((data ?? []) as Entry[]) })
    return () => { cancelled = true }
  }, [orderId])

  if (entries.length === 0) return null
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-4">
      <p className="mb-3 text-sm font-bold">{tr('Historique')}</p>
      <ol className="space-y-2.5">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3">
            <StatusBadge status={e.status} />
            <time className="text-xs text-muted-foreground" dateTime={e.created_at}>
              {new Date(e.created_at).toLocaleString(DATE_LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </time>
          </li>
        ))}
      </ol>
    </div>
  )
}
