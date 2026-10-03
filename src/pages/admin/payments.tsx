import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, CheckCircle2, XCircle, CreditCard, Smartphone, Clock, TrendingUp, ImageOff, ExternalLink, Undo2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'
interface WalletTx {
  id: string
  type: string
  amount: number
  status: string
  payment_method: string | null
  description: string | null
  reference: string | null
  proof_url: string | null
  created_at: string
  wallet_id: string
  refund_of: string | null
  customer_name?: string
  customer_phone?: string
}

const TX_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: tr('En attente'), bg: 'bg-amber-50',      text: 'text-amber-700' },
  completed: { label: tr('Validé'),     bg: 'bg-emerald-50',    text: 'text-emerald-700' },
  failed:    { label: tr('Échoué'),     bg: 'bg-destructive/10', text: 'text-destructive' },
  cancelled: { label: tr('Refusé'),     bg: 'bg-muted',          text: 'text-muted-foreground' },
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  moncash: <Smartphone className="h-3.5 w-3.5" style={{ color: '#ff6600' }} />,
  natcash: <Smartphone className="h-3.5 w-3.5" style={{ color: '#00a651' }} />,
  wallet:  <CreditCard className="h-3.5 w-3.5 text-primary" />,
}

const TYPE_LABELS: Record<string, string> = {
  deposit: tr('Dépôt'), withdrawal: tr('Retrait'), payment: tr('Paiement'), refund: tr('Remboursement'), block: tr('Bloqué'), unblock: tr('Débloqué'),
}

const STATUS_FILTERS = [
  { value: 'pending',   label: tr('En attente') },
  { value: 'completed', label: tr('Confirmés') },
  { value: 'cancelled', label: tr('Refusés') },
  { value: 'all',       label: tr('Tous') },
]

export function AdminPaymentsPage() {
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [approveDialog, setApproveDialog] = useState<WalletTx | null>(null)
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refundDialog, setRefundDialog] = useState<WalletTx | null>(null)
  const [refundReason, setRefundReason] = useState('')

  async function loadTransactions() {
    const { data: txData } = await supabase
      .from('wallet_transactions')
      .select('id, type, amount, status, payment_method, description, reference, proof_url, created_at, wallet_id, refund_of')
      .order('created_at', { ascending: false })
      .limit(200)

    if (!txData) { setLoading(false); return }

    const walletIds = [...new Set(txData.map(t => t.wallet_id))]
    const { data: wallets } = await supabase.from('wallets').select('id, user_id').in('id', walletIds)
    const userIds = [...new Set((wallets || []).map(w => w.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds)

    const walletToUser = Object.fromEntries((wallets || []).map(w => [w.id, w.user_id]))
    const userToProfile = Object.fromEntries((profiles || []).map(p => [p.user_id, p]))

    setTransactions(txData.map(t => {
      const uid = walletToUser[t.wallet_id]
      const profile = userToProfile[uid]
      return { ...(t as unknown as WalletTx), customer_name: profile?.full_name || '—', customer_phone: profile?.phone || '—' }
    }))
    setLoading(false)
  }

  useEffect(() => { loadTransactions() }, [])

  async function openApproveDialog(tx: WalletTx) {
    setApproveDialog(tx)
    setProofSignedUrl(null)
    if (tx.proof_url) {
      const { data } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(tx.proof_url, 3600)
      setProofSignedUrl(data?.signedUrl ?? null)
    }
  }

  async function reviewDeposit(tx: WalletTx, approve: boolean) {
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_review_deposit', { p_tx_id: tx.id, p_approve: approve })
    setSaving(false)
    const result = data as { success?: boolean; error?: string; status?: string } | null
    if (error || !result?.success) {
      toast.error(result?.error ?? error?.message ?? tr('Action impossible.'))
      return false
    }
    toast.success(approve ? tr('Paiement approuvé et portefeuille crédité.') : tr('Transaction refusée.'))
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: approve ? 'completed' : 'cancelled' } : t))
    return true
  }

  const refundedIds = new Set(transactions.map(t => t.refund_of).filter(Boolean) as string[])

  async function submitRefund() {
    if (!refundDialog) return
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_refund_transaction', { p_tx_id: refundDialog.id, p_reason: refundReason })
    setSaving(false)
    const result = data as { success?: boolean; error?: string } | null
    if (error || !result?.success) {
      toast.error(result?.error ?? error?.message ?? tr('Action impossible.'))
      return
    }
    toast.success(tr('Remboursement effectué et portefeuille crédité.'))
    setRefundDialog(null)
    setRefundReason('')
    void loadTransactions()
  }

  async function handleApprove(tx: WalletTx) {
    if (await reviewDeposit(tx, true)) setApproveDialog(null)
  }

  async function handleReject(tx: WalletTx) {
    await reviewDeposit(tx, false)
  }

  const filtered = transactions.filter(t => {
    const matchSearch = (t.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const pendingTotal = transactions.filter(t => t.status === 'pending' && t.type === 'deposit').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tr('Gestion des paiements')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{tr('Validez les recharges MonCash/NatCash et consultez les transactions')}</p>
        <div className="mt-3">
          <ExportCsvButton
            filename="transactions"
            headers={['date', 'client', 'type', 'methode', 'montant_htg', 'statut', 'reference', 'description']}
            rows={() => filtered.map(t => [t.created_at, t.customer_name ?? '', t.type, t.payment_method ?? '', t.amount, t.status, t.reference ?? '', t.description ?? ''])}
            disabled={filtered.length === 0}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: tr('En attente'),       value: transactions.filter(t => t.status === 'pending').length,    icon: Clock,       bg: 'bg-amber-50',   iconColor: 'text-amber-600',   valueColor: 'text-amber-700' },
          { label: tr('Montant en attente'), value: `${pendingTotal.toLocaleString(LOCALE_TAG)} HTG`,                    icon: CreditCard,  bg: 'bg-amber-50',   iconColor: 'text-amber-600',   valueColor: 'text-amber-700' },
          { label: tr('Validés'),          value: transactions.filter(t => t.status === 'completed').length,  icon: CheckCircle2, bg: 'bg-emerald-50', iconColor: 'text-emerald-700', valueColor: 'text-emerald-700' },
          { label: tr('Total validé'),     value: `${transactions.filter(t => t.status === 'completed' && t.type === 'deposit').reduce((s, t) => s + t.amount, 0).toLocaleString(LOCALE_TAG)} HTG`, icon: TrendingUp, bg: 'bg-emerald-50', iconColor: 'text-emerald-700', valueColor: 'text-emerald-700' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-3', kpi.bg)}>
              <kpi.icon className={cn('h-5 w-5', kpi.iconColor)} />
            </div>
            <p className={cn('text-xl font-bold', kpi.valueColor)}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={tr('Rechercher par client ou description...')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">{tr('Aucune transaction')}</p>
            <p className="text-xs text-muted-foreground mt-1">{tr('Modifiez vos filtres de recherche')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Client')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">{tr('Type')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Méthode')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">{tr('Montant')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Statut')}</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">{tr('Date')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tx => {
                const cfg = TX_STATUS_CONFIG[tx.status] || TX_STATUS_CONFIG.pending
                return (
                  <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <p className="font-medium text-sm">{tx.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{tx.customer_phone}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {TYPE_LABELS[tx.type] || tx.type}
                    </TableCell>
                    <TableCell>
                      {tx.payment_method ? (
                        <div className="flex items-center gap-1.5">
                          {METHOD_ICON[tx.payment_method] || <CreditCard className="h-3.5 w-3.5" />}
                          <span className="text-xs capitalize">{tx.payment_method}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-sm">{tx.amount.toLocaleString(LOCALE_TAG)}</p>
                      <p className="text-[10px] text-muted-foreground">HTG</p>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-xs font-semibold rounded-full px-2.5 py-1', cfg.bg, cfg.text)}>{cfg.label}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      {tx.status === 'completed' && tx.type === 'payment' && !refundedIds.has(tx.id) && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg text-xs" onClick={() => { setRefundDialog(tx); setRefundReason('') }}>
                          <Undo2 className="h-3.5 w-3.5" />{tr('Rembourser')}
                        </Button>
                      )}
                      {tx.status === 'pending' && tx.type === 'deposit' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-44">
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => openApproveDialog(tx)}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-700" />{tr('Approuver')}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-destructive focus:text-destructive" onClick={() => handleReject(tx)}>
                              <XCircle className="mr-2 h-4 w-4" />{tr('Refuser')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Refund dialog */}
      <Dialog open={!!refundDialog} onOpenChange={o => { if (!o) setRefundDialog(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Rembourser ce paiement')}</DialogTitle>
            <DialogDescription>
              {tr('Le montant sera recrédité sur le portefeuille de')}{' '}<span className="font-semibold">{refundDialog?.customer_name}</span>{' '}
              {tr('et la commande liée sera annulée. Cette action est tracée dans le journal d\'audit.')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
            <p className="text-2xl font-bold text-amber-700">{refundDialog?.amount.toLocaleString(LOCALE_TAG)} HTG</p>
            <p className="mt-1 px-3 text-xs text-amber-700/80">{refundDialog?.description}</p>
          </div>
          <Textarea
            value={refundReason}
            onChange={e => setRefundReason(e.target.value)}
            maxLength={200}
            placeholder={tr('Motif du remboursement (obligatoire)')}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={() => void submitRefund()} disabled={saving || refundReason.trim().length < 3} className="rounded-xl">
              {saving ? tr('Remboursement...') : tr('Rembourser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm approve dialog */}
      <Dialog open={!!approveDialog} onOpenChange={o => { if (!o) { setApproveDialog(null); setProofSignedUrl(null) } }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Approuver le paiement')}</DialogTitle>
            <DialogDescription>
              {tr('Confirmer la réception et créditer le wallet de')}{' '}<span className="font-semibold">{approveDialog?.customer_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-3xl font-bold text-emerald-700">{approveDialog?.amount.toLocaleString(LOCALE_TAG)} HTG</p>
            <p className="text-sm text-emerald-700/80 mt-1 capitalize">{approveDialog?.payment_method}</p>
          </div>

          {/* Transaction hash / reference */}
          {approveDialog?.reference && (
            <div className="rounded-xl bg-muted/40 border border-muted px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{tr('Référence / Hash')}</p>
              <p className="text-xs font-mono break-all">{approveDialog.reference}</p>
            </div>
          )}

          {/* Proof image */}
          {approveDialog?.proof_url && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('Preuve de paiement')}</p>
              {proofSignedUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={proofSignedUrl}
                    alt={tr('Preuve de paiement')}
                    className="w-full max-h-64 object-contain"
                  />
                  <a
                    href={proofSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white hover:bg-black/80 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />{tr('Agrandir')}
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 h-20 text-muted-foreground text-xs">
                  <ImageOff className="h-4 w-4" />{tr('Chargement de la preuve…')}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button
              onClick={() => approveDialog && handleApprove(approveDialog)}
              disabled={saving}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {saving ? tr('Validation...') : tr('Approuver et créditer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
