import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Search, CheckCircle2, XCircle, CreditCard, Smartphone, Clock, TrendingUp, ImageOff, ExternalLink, Undo2, ChevronLeft, ChevronRight,
  Download, FileText, User, Wallet, ArrowDownLeft, ArrowUpRight, X,
} from 'lucide-react'
import { AdminUserSheet } from '@/components/shared/admin-user-sheet'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { downloadCsv } from '@/lib/csv'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { tr, trServer, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
import { currencyLabel, money, moneyAmount } from '@/lib/currency'

interface Tx {
  id: string; type: string; amount: number; status: string; payment_method: string | null; description: string | null
  reference: string | null; proof_url: string | null; plop_transaction_id: string | null; created_at: string
  wallet_id: string; refund_of: string | null; user_id: string
  customer_name: string | null; customer_phone: string | null; customer_email: string | null
  refunded: boolean; total_count: number
}
interface Stats {
  pending_count: number; pending_amount: number; deposits: number; deposits_count: number; payments: number; payments_count: number
  refunds: number; withdrawals: number; rejected_count: number; wallets_total: number
  by_method: Array<{ method: string; amount: number; count: number }>
}

const TX_STATUS: Record<string, { label: () => string; cls: string }> = {
  pending:   { label: () => tr('En attente'), cls: 'bg-amber-50 text-amber-700' },
  completed: { label: () => tr('Validé'),     cls: 'bg-emerald-50 text-emerald-700' },
  failed:    { label: () => tr('Échoué'),     cls: 'bg-destructive/10 text-destructive' },
  cancelled: { label: () => tr('Refusé'),     cls: 'bg-muted text-muted-foreground' },
}
const TYPE_LABEL: Record<string, () => string> = {
  deposit: () => tr('Dépôt'), withdrawal: () => tr('Retrait'), payment: () => tr('Paiement'), refund: () => tr('Remboursement'),
  block: () => tr('Bloqué'), unblock: () => tr('Débloqué'),
}
const METHOD_LABEL: Record<string, string> = {
  moncash: 'MonCash', natcash: 'NatCash', stripe: tr('Carte (Stripe)'), wallet: tr('Portefeuille'), virement: tr('Virement'), btc: 'Bitcoin', usdt: 'USDT', eth: 'Ethereum',
}
const STATUS_CHIPS = [
  { value: 'pending', label: () => tr('En attente') },
  { value: 'completed', label: () => tr('Validés') },
  { value: 'cancelled', label: () => tr('Refusés') },
  { value: 'all', label: () => tr('Tous') },
]
const PAGE_SIZE = 20

function fmt(n: number) { return Number(n).toLocaleString(LOCALE_TAG) }
function dateTime(iso: string) { return new Date(iso).toLocaleString(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) }
const isCredit = (t: Pick<Tx, 'type'>) => t.type === 'deposit' || t.type === 'refund' || t.type === 'unblock'

/** MonCash / NatCash payments are settled by the gateway alone: the team never validates them by hand. */
const isGateway = (tx: { payment_method: string | null }) => tx.payment_method === 'moncash' || tx.payment_method === 'natcash' || tx.payment_method === 'stripe'

export function AdminPaymentsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<Tx[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('pending')
  const [type, setType] = useState('all')
  const [method, setMethod] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<Tx | null>(null)
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Proof identifier typed by the team when it checks the proof (kept for good, a proof can be used only once)
  const [proofIdInput, setProofIdInput] = useState('')
  const [savedProofId, setSavedProofId] = useState<string | null>(null)
  const [refundOf, setRefundOf] = useState<Tx | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [adjSign, setAdjSign] = useState<'credit' | 'debit'>('credit')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(search); setPage(0) }, 300)
    return () => window.clearTimeout(t)
  }, [search])

  const filterArgs = useMemo(() => ({
    p_status: status, p_type: type, p_method: method, p_from: from || null, p_to: to || null, p_search: query || null,
  }), [status, type, method, from, to, query])

  const load = useCallback(async () => {
    const [list, st] = await Promise.all([
      supabase.rpc('admin_list_transactions', { ...filterArgs, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      supabase.rpc('admin_payment_stats', { p_from: from || null, p_to: to || null }),
    ])
    setRows(((list.data ?? []) as Tx[]).map((t) => ({ ...t, amount: Number(t.amount), total_count: Number(t.total_count) })))
    setStats((st.data as Stats) ?? null)
    setLoading(false)
  }, [filterArgs, page, from, to])
  useEffect(() => { void load() }, [load])

  const total = rows[0]?.total_count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function openTx(tx: Tx) {
    setOpen(tx); setProofUrl(null); setProofIdInput(tx.reference ?? ''); setSavedProofId(null); setAdjAmount(''); setAdjReason(''); setAdjSign('credit')
    if (tx.type === 'deposit') {
      const { data: p } = await supabase.from('wallet_transactions').select('proof_id').eq('id', tx.id).maybeSingle()
      setSavedProofId((p as { proof_id: string | null } | null)?.proof_id ?? null)
    }
    if (tx.proof_url) {
      const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(tx.proof_url, 3600)
      setProofUrl(data?.signedUrl ?? null)
    }
  }

  async function review(tx: Tx, approve: boolean) {
    if (!approve && !confirm(tr('Refuser cette transaction de {0} ?', money(tx.amount)))) return
    setBusy(true)
    const { data, error } = approve
      ? await supabase.rpc('admin_approve_manual_deposit', { p_tx_id: tx.id, p_proof_id: proofIdInput })
      : await supabase.rpc('admin_review_deposit', { p_tx_id: tx.id, p_approve: false })
    setBusy(false)
    const res = data as { success?: boolean; error?: string } | null
    if (error || !res?.success) { toast.error(res?.error ? trServer(res.error) : error?.message ?? tr('Action impossible.')); return }
    toast.success(approve ? tr('Paiement approuvé et portefeuille crédité.') : tr('Transaction refusée.'))
    setOpen(null)
    void load()
  }

  async function submitRefund() {
    if (!refundOf) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_refund_transaction', { p_tx_id: refundOf.id, p_reason: refundReason })
    setBusy(false)
    const res = data as { success?: boolean; error?: string } | null
    if (error || !res?.success) { toast.error(res?.error ? trServer(res.error) : error?.message ?? tr('Action impossible.')); return }
    toast.success(tr('Remboursement effectué et portefeuille crédité.'))
    setRefundOf(null); setRefundReason(''); setOpen(null)
    void load()
  }

  async function adjust(tx: Tx) {
    const amount = Number(adjAmount)
    if (!(amount > 0)) { toast.error(tr('Montant invalide.')); return }
    const signed = adjSign === 'credit' ? amount : -amount
    if (!confirm(tr('{0} {1} HTG sur le portefeuille de {2} ?', adjSign === 'credit' ? tr('Créditer') : tr('Débiter'), fmt(amount), tx.customer_name ?? ''))) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_adjust_wallet', { p_user: tx.user_id, p_amount: signed, p_reason: adjReason })
    setBusy(false)
    const res = data as { success?: boolean; error?: string; balance?: number } | null
    if (error || !res?.success) { toast.error(res?.error ? trServer(res.error) : error?.message ?? tr('Action impossible.')); return }
    toast.success(tr('Portefeuille ajusté. Nouveau solde : {0}', money(res.balance ?? 0)))
    setAdjAmount(''); setAdjReason('')
    void load()
  }

  async function receipt(tx: Tx) {
    const { downloadReceiptPDF } = await import('@/lib/pdf')
    await downloadReceiptPDF(
      { ...tx, description: tx.description ? trServer(tx.description) : null },
      { name: tx.customer_name ?? '', email: tx.customer_email },
      { type: (TYPE_LABEL[tx.type] ?? (() => tx.type))(), method: tx.payment_method ? (METHOD_LABEL[tx.payment_method] ?? tx.payment_method) : null, status: (TX_STATUS[tx.status]?.label() ?? tx.status) },
    )
  }

  async function exportAll() {
    const { data, error } = await supabase.rpc('admin_list_transactions', { ...filterArgs, p_limit: 5000, p_offset: 0 })
    if (error) { toast.error(tr('Action impossible.')); return }
    const list = (data ?? []) as Tx[]
    downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      ['date', 'client', 'email', 'telephone', 'type', 'methode', 'montant_htg', 'statut', 'reference', 'id_fournisseur', 'description'],
      list.map((t) => [t.created_at, t.customer_name ?? '', t.customer_email ?? '', t.customer_phone ?? '', t.type, t.payment_method ?? '', t.amount, t.status, t.reference ?? '', t.plop_transaction_id ?? '', t.description ?? '']))
  }

  const filtersActive = type !== 'all' || method !== 'all' || !!from || !!to || !!search
  function resetFilters() { setType('all'); setMethod('all'); setFrom(''); setTo(''); setSearch(''); setPage(0) }

  const kpis = stats ? [
    { label: tr('En attente'), value: String(stats.pending_count), sub: `${money(stats.pending_amount)}`, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-700' },
    { label: tr('Recharges validées'), value: `${money(stats.deposits)}`, sub: tr('{0} opérations', stats.deposits_count), icon: ArrowDownLeft, bg: 'bg-emerald-50', color: 'text-emerald-700' },
    { label: tr('Paiements clients'), value: `${money(stats.payments)}`, sub: tr('{0} opérations', stats.payments_count), icon: TrendingUp, bg: 'bg-primary/10', color: 'text-primary' },
    { label: tr('Remboursé'), value: `${money(stats.refunds)}`, sub: tr('{0} refusées / échouées', stats.rejected_count), icon: Undo2, bg: 'bg-sky-50', color: 'text-sky-700' },
    { label: tr('Soldes clients'), value: `${money(stats.wallets_total)}`, sub: tr('Total dans les portefeuilles'), icon: Wallet, bg: 'bg-indigo-50', color: 'text-indigo-700' },
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Gestion des paiements')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tr('Validez les recharges, remboursez, ajustez un portefeuille et consultez tout l\'historique')}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => void exportAll()} disabled={total === 0}>
          <Download className="h-3.5 w-3.5" />{tr('Exporter CSV')}
        </Button>
      </div>

      {/* KPIs (period = the date filter) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {!stats ? [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', k.bg)}><k.icon className={cn('h-4 w-4', k.color)} /></div>
            <p className={cn('text-lg font-bold tabular-nums', k.color)}>{k.value}</p>
            <p className="text-xs font-medium">{k.label}</p>
            <p className="text-[11px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>
      {stats && stats.by_method.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {stats.by_method.map((m) => (
            <span key={m.method} className="rounded-full border border-gray-100 bg-white px-3 py-1 shadow-sm">
              <span className="font-semibold">{METHOD_LABEL[m.method] ?? m.method}</span> · {money(m.amount)} · {m.count}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((c) => (
            <button key={c.value} type="button" onClick={() => { setStatus(c.value); setPage(0) }}
              className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                status === c.value ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground hover:bg-muted/50')}>
              {c.label()}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={tr('Client, téléphone, e-mail, référence...')} value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" aria-label={tr('Rechercher')} />
          </div>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(0) }}>
            <SelectTrigger className="rounded-xl" aria-label={tr('Type')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr('Tous les types')}</SelectItem>
              {['deposit', 'payment', 'refund', 'withdrawal'].map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]()}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(0) }}>
            <SelectTrigger className="rounded-xl" aria-label={tr('Méthode')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr('Toutes les méthodes')}</SelectItem>
              {Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} className="rounded-xl" aria-label={tr('Du')} />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} className="rounded-xl" aria-label={tr('Au')} />
          </div>
        </div>
        {filtersActive && (
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><X className="h-3 w-3" />{tr('Effacer les filtres')}</button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="font-semibold text-muted-foreground">{tr('Aucune transaction')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tr('Modifiez vos filtres de recherche')}</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('Client')}</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">{tr('Type')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('Méthode')}</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('Montant')}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr('Statut')}</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{tr('Date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tx) => {
                  const st = TX_STATUS[tx.status] ?? TX_STATUS.pending
                  const needsAction = tx.status === 'pending' && tx.type === 'deposit' && !isGateway(tx)
                  return (
                    <TableRow key={tx.id} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => void openTx(tx)}>
                      <TableCell>
                        <p className="text-sm font-medium">{tx.customer_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{tx.customer_phone ?? tx.customer_email ?? ''}</p>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        <span className="inline-flex items-center gap-1">
                          {isCredit(tx) ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />}
                          {(TYPE_LABEL[tx.type] ?? (() => tx.type))()}
                        </span>
                        {tx.refunded && <span className="ml-1 text-[10px] font-semibold text-sky-700">{tr('remboursé')}</span>}
                      </TableCell>
                      <TableCell>
                        {tx.payment_method ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            {tx.payment_method === 'wallet' ? <CreditCard className="h-3.5 w-3.5 text-primary" /> : <Smartphone className="h-3.5 w-3.5" style={{ color: tx.payment_method === 'natcash' ? '#00a651' : '#ff6600' }} />}
                            {METHOD_LABEL[tx.payment_method] ?? tx.payment_method}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{moneyAmount(tx.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{currencyLabel()}</p>
                      </TableCell>
                      <TableCell>
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', st.cls)}>{st.label()}</span>
                        {needsAction && <span className="ml-1.5 text-[10px] font-bold text-primary">{tr('À traiter')}</span>}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{new Date(tx.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-muted-foreground">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} {tr('sur')} {total}</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label={tr('Page précédente')} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="px-2 text-xs tabular-nums">{page + 1} / {pages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label={tr('Page suivante')} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transaction sheet */}
      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{(TYPE_LABEL[open.type] ?? (() => open.type))()} · {money(open.amount)}</SheetTitle>
                <SheetDescription>{dateTime(open.created_at)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8">
                <div className="flex items-center justify-between">
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', (TX_STATUS[open.status] ?? TX_STATUS.pending).cls)}>{(TX_STATUS[open.status] ?? TX_STATUS.pending).label()}</span>
                  {open.refunded && <span className="text-xs font-semibold text-sky-700">{tr('Remboursé')}</span>}
                </div>

                <dl className="space-y-2 rounded-xl bg-gray-50 p-3.5 text-sm">
                  {([
                    [tr('Méthode'), open.payment_method ? (METHOD_LABEL[open.payment_method] ?? open.payment_method) : null],
                    [tr('Description'), open.description ? trServer(open.description) : null],
                    [tr('Référence'), open.reference],
                    [tr('ID fournisseur'), open.plop_transaction_id],
                    [tr('Identifiant de la preuve'), savedProofId],
                    [tr('ID transaction'), open.id],
                  ] as Array<[string, string | null]>).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">{k}</dt><dd className="min-w-0 break-all text-xs font-medium">{v}</dd></div>
                  ))}
                </dl>

                <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{open.customer_name ?? '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{[open.customer_phone, open.customer_email].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setOpenUser(open.user_id); setOpen(null) }}>{tr('Gérer le client')}</Button>
                </div>

                {open.proof_url && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('Preuve de paiement')}</p>
                    {proofUrl ? (
                      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        <img src={proofUrl} alt={tr('Preuve de paiement')} className="max-h-72 w-full object-contain" />
                        <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white"><ExternalLink className="h-3 w-3" />{tr('Agrandir')}</a>
                      </div>
                    ) : (
                      <div className="flex h-20 items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-xs text-muted-foreground"><ImageOff className="h-4 w-4" />{tr('Chargement de la preuve…')}</div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {open.status === 'pending' && open.type === 'deposit' && isGateway(open) && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
                      {tr('En attente de la plateforme de paiement. Ce paiement sera crédité automatiquement dès que MonCash / NatCash le validera ; s\'il est annulé ou jamais validé, rien n\'est crédité.')}
                    </p>
                  )}
                  {open.status === 'pending' && open.type === 'deposit' && !isGateway(open) && (
                    <div className="space-y-2">
                      <Label htmlFor="proof-id" className="text-xs">{tr('Identifiant de la preuve (lu sur le reçu) *')}</Label>
                      <Input id="proof-id" value={proofIdInput} onChange={(e) => setProofIdInput(e.target.value)} maxLength={120} placeholder={tr('N° de transaction, de reçu ou hash')} className="h-10 rounded-xl" />
                      <p className="text-[11px] text-muted-foreground">{tr('Vérifiez la preuve ci-dessus puis recopiez son identifiant : il est conservé et ne pourra plus jamais être réutilisé pour un autre dépôt.')}</p>
                    </div>
                  )}
                  {open.status === 'pending' && open.type === 'deposit' && !isGateway(open) && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button disabled={busy || proofIdInput.trim().length < 4} onClick={() => void review(open, true)} className="h-11 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />{tr('Approuver et créditer')}</Button>
                      <Button disabled={busy} variant="outline" onClick={() => void review(open, false)} className="h-11 rounded-xl font-semibold text-destructive"><XCircle className="mr-2 h-4 w-4" />{tr('Refuser')}</Button>
                    </div>
                  )}
                  {open.status === 'completed' && open.type === 'payment' && !open.refunded && (
                    <Button variant="outline" className="h-10 w-full gap-2 rounded-xl" onClick={() => { setRefundOf(open); setRefundReason('') }}><Undo2 className="h-4 w-4" />{tr('Rembourser ce paiement')}</Button>
                  )}
                  {open.status === 'completed' && (
                    <Button variant="outline" className="h-10 w-full gap-2 rounded-xl" onClick={() => void receipt(open)}><FileText className="h-4 w-4" />{tr('Télécharger le reçu (PDF)')}</Button>
                  )}
                </div>

                {isAdmin && (
                  <section className="space-y-2.5 rounded-xl border border-gray-100 p-3.5">
                    <h3 className="text-sm font-bold">{tr('Ajuster le portefeuille du client')}</h3>
                    <p className="text-[11px] text-muted-foreground">{tr('Correction manuelle (espèces, erreur…). Un motif est obligatoire ; l\'opération apparaît dans l\'historique du client et dans le journal d\'audit.')}</p>
                    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={tr('Sens de l\'ajustement')}>
                      {([['credit', tr('Créditer')], ['debit', tr('Débiter')]] as const).map(([k, label]) => (
                        <button key={k} type="button" role="radio" aria-checked={adjSign === k} onClick={() => setAdjSign(k)}
                          className={cn('rounded-lg border py-2 text-xs font-semibold', adjSign === k ? (k === 'credit' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-rose-500 bg-rose-50 text-rose-700') : 'border-gray-200 text-muted-foreground')}>{label}</button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adj-amount" className="text-xs">{tr('Montant (HTG)')}</Label>
                      <Input id="adj-amount" type="number" min={1} inputMode="numeric" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className="h-10 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adj-reason" className="text-xs">{tr('Motif')}</Label>
                      <Textarea id="adj-reason" rows={2} maxLength={150} value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="rounded-xl" />
                    </div>
                    <Button className="h-10 w-full rounded-xl font-semibold" disabled={busy || !(Number(adjAmount) > 0) || adjReason.trim().length < 3} onClick={() => void adjust(open)}>{tr('Appliquer l\'ajustement')}</Button>
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Refund dialog */}
      <Dialog open={!!refundOf} onOpenChange={(o) => { if (!o) setRefundOf(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Rembourser ce paiement')}</DialogTitle>
            <DialogDescription>
              {tr('Le montant sera recrédité sur le portefeuille de')}{' '}<span className="font-semibold">{refundOf?.customer_name}</span>{' '}
              {tr('et la commande liée sera annulée. Cette action est tracée dans le journal d\'audit.')}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-100 bg-amber-50 py-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{refundOf ? money(refundOf.amount) : ''}</p>
            <p className="mt-1 px-3 text-xs text-amber-700/80">{refundOf?.description ? trServer(refundOf.description) : ''}</p>
          </div>
          <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} maxLength={200} placeholder={tr('Motif du remboursement (obligatoire)')} className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOf(null)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={() => void submitRefund()} disabled={busy || refundReason.trim().length < 3} className="rounded-xl">{busy ? tr('Remboursement...') : tr('Rembourser')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminUserSheet userId={openUser} onClose={() => setOpenUser(null)} onChanged={() => void load()} />
    </div>
  )
}
