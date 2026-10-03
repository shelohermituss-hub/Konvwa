import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, Store, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Row {
  user_id: string
  business_name: string
  activity: string
  monthly_volume_htg: number
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reject_reason: string | null
  full_name?: string
  phone?: string | null
}

const FILTERS = [
  { value: 'pending', label: tr('À examiner') },
  { value: 'approved', label: tr('Revendeurs') },
  { value: 'rejected', label: tr('Refusés') },
]

export function AdminResellersPage() {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('reseller_applications').select('*').eq('status', status).order('submitted_at', { ascending: true }).limit(100)
    const list = (data ?? []) as Row[]
    const ids = list.map((r) => r.user_id)
    const { data: people } = ids.length ? await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', ids) : { data: [] }
    const by = Object.fromEntries((people ?? []).map((p) => [p.user_id as string, p]))
    setRows(list.map((r) => ({ ...r, full_name: by[r.user_id]?.full_name ?? '—', phone: by[r.user_id]?.phone ?? null })))
    setLoading(false)
  }, [status])

  useEffect(() => { void load() }, [load])

  async function review(r: Row, approve: boolean) {
    setBusy(r.user_id)
    const { data, error } = await supabase.rpc('admin_review_reseller', { p_user_id: r.user_id, p_approve: approve, p_reason: reasons[r.user_id] ?? null })
    setBusy(null)
    const res = data as { success?: boolean; error?: string } | null
    if (error || !res?.success) { toast.error(res?.error ?? tr('Action impossible.')); return }
    toast.success(approve ? tr('Revendeur approuvé.') : tr('Statut retiré.'))
    void load()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tr('Revendeurs')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Approuvez les demandes. Les prix revendeur se règlent produit par produit dans « Produits ».')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setStatus(f.value)}
            className={cn('rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors', status === f.value ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-muted-foreground hover:border-primary/40')}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">{tr('Aucune demande')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.user_id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{r.business_name}</p>
                  <p className="text-xs text-muted-foreground">{r.full_name} · {r.phone ?? '—'} · {tr('~{0} HTG / mois', Number(r.monthly_volume_htg).toLocaleString(LOCALE_TAG))}</p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={r.submitted_at}>{new Date(r.submitted_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}</time>
              </div>
              {r.activity && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.activity}</p>}
              <div className="mt-3 space-y-2">
                <Textarea value={reasons[r.user_id] ?? ''} onChange={(e) => setReasons((p) => ({ ...p, [r.user_id]: e.target.value }))} maxLength={200} placeholder={tr('Motif (obligatoire pour refuser ou retirer)')} className="rounded-xl" />
                <div className="flex gap-2">
                  {r.status !== 'approved' && (
                    <Button onClick={() => void review(r, true)} disabled={busy === r.user_id} className="gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                      {busy === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}{tr('Approuver')}
                    </Button>
                  )}
                  {r.status !== 'rejected' && (
                    <Button variant="outline" onClick={() => void review(r, false)} disabled={busy === r.user_id || !(reasons[r.user_id] ?? '').trim()} className="gap-1.5 rounded-xl text-destructive">
                      <XCircle className="h-4 w-4" />{r.status === 'approved' ? tr('Retirer le statut') : tr('Refuser')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
