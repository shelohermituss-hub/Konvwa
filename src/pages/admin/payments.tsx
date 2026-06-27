import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, CheckCircle2, XCircle, CreditCard, Smartphone, Clock, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WalletTx {
  id: string
  type: string
  amount: number
  status: string
  payment_method: string | null
  description: string | null
  created_at: string
  wallet_id: string
  customer_name?: string
  customer_phone?: string
}

const TX_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'En attente', bg: 'bg-amber-50',      text: 'text-amber-700' },
  completed: { label: 'Validé',     bg: 'bg-emerald-50',    text: 'text-emerald-700' },
  failed:    { label: 'Échoué',     bg: 'bg-destructive/10', text: 'text-destructive' },
  cancelled: { label: 'Refusé',     bg: 'bg-muted',          text: 'text-muted-foreground' },
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  moncash: <Smartphone className="h-3.5 w-3.5" style={{ color: '#ff6600' }} />,
  natcash: <Smartphone className="h-3.5 w-3.5" style={{ color: '#00a651' }} />,
  wallet:  <CreditCard className="h-3.5 w-3.5 text-primary" />,
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Dépôt', withdrawal: 'Retrait', payment: 'Paiement', refund: 'Remboursement', block: 'Bloqué', unblock: 'Débloqué',
}

const STATUS_FILTERS = [
  { value: 'pending',   label: 'En attente' },
  { value: 'completed', label: 'Confirmés' },
  { value: 'cancelled', label: 'Refusés' },
  { value: 'all',       label: 'Tous' },
]

export function AdminPaymentsPage() {
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [approveDialog, setApproveDialog] = useState<WalletTx | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadTransactions() {
    const { data: txData } = await supabase
      .from('wallet_transactions')
      .select('id, type, amount, status, payment_method, description, created_at, wallet_id')
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

  async function handleApprove(tx: WalletTx) {
    setSaving(true)
    await supabase.from('wallet_transactions').update({ status: 'completed' }).eq('id', tx.id)
    const { data: wallet } = await supabase.from('wallets').select('available_balance').eq('id', tx.wallet_id).maybeSingle()
    if (wallet) {
      await supabase.from('wallets').update({ available_balance: wallet.available_balance + tx.amount, updated_at: new Date().toISOString() }).eq('id', tx.wallet_id)
    }
    const { data: walletRow } = await supabase.from('wallets').select('user_id').eq('id', tx.wallet_id).maybeSingle()
    if (walletRow) {
      await supabase.from('notifications').insert({
        user_id: walletRow.user_id,
        title: 'Recharge confirmée',
        message: `Votre recharge de ${tx.amount.toLocaleString()} HTG a été validée.`,
        type: 'success',
      })
    }
    toast.success('Paiement approuvé et wallet crédité.')
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'completed' } : t))
    setApproveDialog(null)
    setSaving(false)
  }

  async function handleReject(tx: WalletTx) {
    setSaving(true)
    await supabase.from('wallet_transactions').update({ status: 'cancelled' }).eq('id', tx.id)
    const { data: walletRow } = await supabase.from('wallets').select('user_id').eq('id', tx.wallet_id).maybeSingle()
    if (walletRow) {
      await supabase.from('notifications').insert({
        user_id: walletRow.user_id,
        title: 'Recharge refusée',
        message: `Votre demande de recharge de ${tx.amount.toLocaleString()} HTG a été refusée.`,
        type: 'warning',
      })
    }
    toast.success('Transaction refusée.')
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'cancelled' } : t))
    setSaving(false)
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
        <h1 className="text-2xl font-bold tracking-tight">Gestion des paiements</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Validez les recharges MonCash/NatCash et consultez les transactions</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'En attente',       value: transactions.filter(t => t.status === 'pending').length,    icon: Clock,       bg: 'bg-amber-50',   iconColor: 'text-amber-600',   valueColor: 'text-amber-700' },
          { label: 'Montant en attente', value: `${pendingTotal.toLocaleString()} HTG`,                    icon: CreditCard,  bg: 'bg-amber-50',   iconColor: 'text-amber-600',   valueColor: 'text-amber-700' },
          { label: 'Validés',          value: transactions.filter(t => t.status === 'completed').length,  icon: CheckCircle2, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
          { label: 'Total validé',     value: `${transactions.filter(t => t.status === 'completed' && t.type === 'deposit').reduce((s, t) => s + t.amount, 0).toLocaleString()} HTG`, icon: TrendingUp, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl bg-white border border-border/60 shadow-sm p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-3', kpi.bg)}>
              <kpi.icon className={cn('h-5 w-5', kpi.iconColor)} />
            </div>
            <p className={cn('text-xl font-bold', kpi.valueColor)}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + table */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par client ou description..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
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
            <p className="font-semibold text-muted-foreground">Aucune transaction</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Modifiez vos filtres de recherche</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Type</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Méthode</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Montant</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Statut</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</TableHead>
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
                      <p className="font-semibold text-sm">{tx.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">HTG</p>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-xs font-semibold rounded-full px-2.5 py-1', cfg.bg, cfg.text)}>{cfg.label}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      {tx.status === 'pending' && tx.type === 'deposit' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-44">
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setApproveDialog(tx)}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />Approuver
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-destructive focus:text-destructive" onClick={() => handleReject(tx)}>
                              <XCircle className="mr-2 h-4 w-4" />Refuser
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

      {/* Confirm approve dialog */}
      <Dialog open={!!approveDialog} onOpenChange={o => { if (!o) setApproveDialog(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Approuver le paiement</DialogTitle>
            <DialogDescription>
              Confirmer la réception et créditer le wallet de <span className="font-semibold">{approveDialog?.customer_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-3xl font-bold text-emerald-700">{approveDialog?.amount.toLocaleString()} HTG</p>
            <p className="text-sm text-emerald-600/80 mt-1 capitalize">{approveDialog?.payment_method}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)} className="rounded-xl">Annuler</Button>
            <Button
              onClick={() => approveDialog && handleApprove(approveDialog)}
              disabled={saving}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {saving ? 'Validation...' : 'Approuver et créditer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
