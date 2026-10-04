import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, PackageSearch } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cargoStatusLabel } from '@/lib/cargo-tracking'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Cargo {
  id: string; status: string; user_id: string; created_at: string; tracking_status: string | null
  package_count: number | null; payment_plan: string | null
  warehouse: { code: string | null } | null
  customer: string | null
}

const GROUPS: Array<{ key: string; label: () => string; match: (c: Cargo) => boolean; tone: string }> = [
  { key: 'todo', label: () => tr('À traiter'), match: (c) => c.status === 'submitted' || c.status === 'reviewing', tone: 'bg-amber-50 text-amber-700' },
  { key: 'received', label: () => tr('Colis reçus'), match: (c) => c.status === 'received', tone: 'bg-sky-50 text-sky-700' },
  { key: 'quoted', label: () => tr('Devis envoyés'), match: (c) => c.status === 'quoted', tone: 'bg-indigo-50 text-indigo-700' },
  { key: 'paid', label: () => tr('Payées, à expédier'), match: (c) => (c.status === 'invoiced' || c.status === 'deposit_paid') && c.tracking_status !== 'delivered', tone: 'bg-emerald-50 text-emerald-700' },
]

/**
 * Cargos = simple shipping requests: the customer gets a warehouse address and sends their own goods.
 * (Cargos opened by an order are managed from that order.)
 */
export function AdminCargoSection() {
  const [rows, setRows] = useState<Cargo[] | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('product_requests')
        .select('id, status, user_id, created_at, tracking_status, package_count, payment_plan, warehouse:warehouses(code)')
        .eq('request_type', 'shipping').is('source_order_kind', null).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(100)
      const list = (data ?? []) as unknown as Array<Omit<Cargo, 'customer'>>
      const ids = Array.from(new Set(list.map((r) => r.user_id)))
      const { data: profs } = ids.length ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ids) : { data: [] }
      const names = new Map((profs ?? []).map((p) => [p.user_id as string, p.full_name as string | null]))
      setRows(list.map((r) => ({ ...r, customer: names.get(r.user_id) ?? null })))
    })()
  }, [])

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold"><PackageSearch className="h-4 w-4 text-primary" />{tr('Cargaisons')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{tr('Clients qui envoient leur propre marchandise à nos entrepôts')}</p>
        </div>
        <Link to="/admin/shipping-requests" className="flex items-center gap-1 text-xs font-semibold text-primary">
          {tr('Tout voir')}<ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows === null ? (
        <div className="p-5"><Skeleton className="h-24 rounded-xl" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            {GROUPS.map((g) => (
              <Link key={g.key} to="/admin/shipping-requests" className={cn('rounded-xl p-3.5 transition-opacity hover:opacity-90', g.tone)}>
                <p className="text-2xl font-bold">{rows.filter(g.match).length}</p>
                <p className="text-xs font-medium opacity-80">{g.label()}</p>
              </Link>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">{tr('Aucune cargaison pour le moment.')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {rows.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/shipping-requests?open=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.customer ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.warehouse?.code ?? '—'}{c.package_count != null && ` · ${tr('{0} colis', c.package_count)}`} · {new Date(c.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">{cargoStatusLabel(c)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
