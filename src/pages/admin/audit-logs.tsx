import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
interface AuditRow {
  id: string
  actor_id: string | null
  actor_role: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown>
  created_at: string
}

type Change = { from: string | null; to: string | null }

const PAGE_SIZE = 20

const RESOURCES: { value: string; label: string }[] = [
  { value: 'all', label: tr('Tout') },
  { value: 'wallet_transactions', label: tr('Dépôts') },
  { value: 'wallets', label: tr('Portefeuilles') },
  { value: 'orders', label: tr('Commandes') },
  { value: 'product_requests', label: tr('Demandes') },
  { value: 'shipments', label: tr('Expéditions') },
  { value: 'profiles', label: tr('Rôles') },
]

const RESOURCE_LABEL: Record<string, string> = {
  wallet_transactions: tr('Transaction'),
  wallets: tr('Portefeuille'),
  orders: tr('Commande'),
  product_requests: tr('Demande'),
  shipments: tr('Expédition'),
  profiles: tr('Utilisateur'),
}

const FIELD_LABEL: Record<string, string> = {
  role: tr('Rôle'),
  status: tr('Statut'),
  payment_status: tr('Paiement'),
  available_balance: tr('Solde disponible'),
  blocked_balance: tr('Solde bloqué'),
  paid_amount_htg: tr('Montant payé'),
  quoted_amount_htg: tr('Montant du devis'),
  shipment_id: tr('Expédition assignée'),
}

const MONEY_FIELDS = new Set(['available_balance', 'blocked_balance', 'paid_amount_htg', 'quoted_amount_htg'])
const BADGE_FIELDS = new Set(['status', 'payment_status'])
const STAFF_ROLES = ['admin', 'manager', 'agent']

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', agent: 'Agent', client: tr('Client') }
const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive',
  manager: 'bg-primary/10 text-primary',
  agent: 'bg-blue-50 text-blue-700',
  client: 'bg-muted text-muted-foreground',
}

function isChange(value: unknown): value is Change {
  return typeof value === 'object' && value !== null && 'from' in value && 'to' in value
}

function formatValue(field: string, value: string | null) {
  if (value === null || value === '') return <span className="text-muted-foreground">—</span>
  if (BADGE_FIELDS.has(field)) return <StatusBadge status={value} />
  if (field === 'role') {
    return (
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_BADGE[value] ?? 'bg-muted')}>
        {ROLE_LABEL[value] ?? value}
      </span>
    )
  }
  if (MONEY_FIELDS.has(field)) {
    const n = Number(value)
    return <span className="font-semibold tabular-nums">{Number.isFinite(n) ? n.toLocaleString(LOCALE_TAG) : value} HTG</span>
  }
  if (field === 'shipment_id') return <span className="font-mono text-xs">{value.slice(0, 8)}</span>
  return <span>{value}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(DATE_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function AdminAuditLogsPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [resource, setResource] = useState('all')
  const [staffOnly, setStaffOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)

    let query = supabase
      .from('audit_logs')
      .select('id, actor_id, actor_role, action, resource_type, resource_id, details, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (resource !== 'all') query = query.eq('resource_type', resource)
    if (staffOnly) query = query.in('actor_role', STAFF_ROLES)

    const { data, count, error: queryError } = await query
    if (queryError || !data) {
      setError(true)
      setLoading(false)
      return
    }

    const list = data as AuditRow[]
    const ids = new Set<string>()
    for (const r of list) {
      if (r.actor_id) ids.add(r.actor_id)
      const owner = r.details?.owner_user_id
      if (typeof owner === 'string') ids.add(owner)
    }
    if (ids.size > 0) {
      const { data: people } = await supabase.from('profiles').select('user_id, full_name').in('user_id', [...ids])
      setNames(Object.fromEntries((people ?? []).map((p) => [p.user_id as string, p.full_name as string])))
    }

    setRows(list)
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, resource, staffOnly])

  useEffect(() => { void load() }, [load])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  function pickResource(value: string) {
    setResource(value)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tr('Journal d\'audit')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tr('Chaque changement de rôle, de solde ou de statut, avec son auteur. Ce journal ne peut ni être modifié ni être effacé.')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {RESOURCES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => pickResource(r.value)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                resource === r.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-white text-muted-foreground hover:border-primary/40',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={staffOnly}
            onChange={(e) => { setStaffOnly(e.target.checked); setPage(0) }}
            className="h-4 w-4 rounded border-gray-300 accent-[#F05A28]"
          />
          {tr('Actions de l\'équipe seulement (sans les clients)')}
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {tr('Impossible de charger le journal.')}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>{tr('Réessayer')}</Button>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <ScrollText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">{tr('Aucune entrée')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tr('Les prochaines actions apparaîtront ici.')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const changes = Object.entries(r.details ?? {}).filter((entry): entry is [string, Change] => isChange(entry[1]))
            const owner = typeof r.details?.owner_user_id === 'string' ? names[r.details.owner_user_id] : null
            const actor = r.actor_id ? names[r.actor_id] ?? tr('Utilisateur inconnu') : tr('Système')
            return (
              <li key={r.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{actor}</span>
                      {r.actor_role && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', ROLE_BADGE[r.actor_role] ?? 'bg-muted')}>
                          {ROLE_LABEL[r.actor_role] ?? r.actor_role}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {RESOURCE_LABEL[r.resource_type] ?? r.resource_type}
                      {r.resource_id ? ` · ${r.resource_id.slice(0, 8)}` : ''}
                      {owner ? ` · ${owner}` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={r.created_at}>{formatDate(r.created_at)}</time>
                </div>

                {changes.length > 0 && (
                  <dl className="mt-3 space-y-2 rounded-xl bg-muted/40 px-3 py-2.5">
                    {changes.map(([field, change]) => (
                      <div key={field} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <dt className="w-36 shrink-0 text-xs text-muted-foreground">{FIELD_LABEL[field] ?? field}</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                          {formatValue(field, change.from)}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {formatValue(field, change.to)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!error && total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)} className="gap-1 rounded-xl">
            <ChevronLeft className="h-4 w-4" />{' '}{tr('Précédent')}
          </Button>
          <span className="text-xs text-muted-foreground">{tr('Page')}{' '}{page + 1} / {pageCount} · {total}{' '}{tr('entrées')}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((p) => p + 1)} className="gap-1 rounded-xl">
            {tr('Suivant')}{' '}<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
