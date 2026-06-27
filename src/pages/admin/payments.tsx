import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Search, MoreHorizontal, CheckCircle2, XCircle, CreditCard, Smartphone } from 'lucide-react'
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

const TX_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  failed: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  moncash: <Smartphone className="h-3.5 w-3.5" style={{ color: '#ff6600' }} />,
  natcash: <Smartphone className="h-3.5 w-3.5" style={{ color: '#00a651' }} />,
  wallet: <CreditCard className="h-3.5 w-3.5 text-primary" />,
}

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
    // Update transaction status
    await supabase.from('wallet_transactions').update({ status: 'completed' }).eq('id', tx.id)
    // Credit wallet
    const { data: wallet } = await supabase.from('wallets').select('available_balance').eq('id', tx.wallet_id).maybeSingle()
    if (wallet) {
      await supabase.from('wallets').update({ available_balance: wallet.available_balance + tx.amount, updated_at: new Date().toISOString() }).eq('id', tx.wallet_id)
    }
    // Get user_id for notification
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

  const STATUS_FILTERS = [
    { value: 'pending', label: 'En attente' },
    { value: 'completed', label: 'Confirmés' },
    { value: 'cancelled', label: 'Refusés' },
    { value: 'all', label: 'Tous' },
  ]

  const pendingTotal = transactions.filter(t => t.status === 'pending' && t.type === 'deposit').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des paiements" description="Validez les recharges MonCash/NatCash et consultez les transactions" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'En attente', value: transactions.filter(t => t.status === 'pending').length, color: 'text-warning' },
          { label: 'Montant en attente', value: `${pendingTotal.toLocaleString()} HTG`, color: 'text-warning' },
          { label: 'Validés ce mois', value: transactions.filter(t => t.status === 'completed').length, color: 'text-success' },
          { label: 'Total validé', value: `${transactions.filter(t => t.status === 'completed' && t.type === 'deposit').reduce((s, t) => s + t.amount, 0).toLocaleString()} HTG`, color: 'text-success' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <p className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CreditCard} title="Aucune transaction" description="Aucune transaction ne correspond à votre filtre." />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(tx => {
                    const color = TX_STATUS_COLOR[tx.status] || TX_STATUS_COLOR.pending
                    const statusLabel = { pending: 'En attente', completed: 'Validé', failed: 'Échoué', cancelled: 'Refusé' }[tx.status] || tx.status
                    const typeLabel = { deposit: 'Dépôt', withdrawal: 'Retrait', payment: 'Paiement', refund: 'Remboursement', block: 'Bloqué', unblock: 'Débloqué' }[tx.type] || tx.type
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{tx.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{tx.customer_phone}</p>
                        </TableCell>
                        <TableCell className="text-sm">{typeLabel}</TableCell>
                        <TableCell>
                          {tx.payment_method ? (
                            <div className="flex items-center gap-1.5">
                              {METHOD_ICON[tx.payment_method] || <CreditCard className="h-3.5 w-3.5" />}
                              <span className="text-xs capitalize">{tx.payment_method}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="font-semibold">{tx.amount.toLocaleString()} HTG</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', color)}>{statusLabel}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString('fr-HT')}
                        </TableCell>
                        <TableCell>
                          {tx.status === 'pending' && tx.type === 'deposit' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setApproveDialog(tx)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4 text-success" />Approuver
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleReject(tx)}>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm approve dialog */}
      <Dialog open={!!approveDialog} onOpenChange={o => { if (!o) setApproveDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver le paiement</DialogTitle>
            <DialogDescription>
              Confirmer la réception et créditer le wallet de {approveDialog?.customer_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 rounded-xl bg-muted/40 text-center">
            <p className="text-3xl font-bold text-success">{approveDialog?.amount.toLocaleString()} HTG</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{approveDialog?.payment_method}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Annuler</Button>
            <Button onClick={() => approveDialog && handleApprove(approveDialog)} disabled={saving} className="bg-success text-success-foreground hover:bg-success/90">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {saving ? 'Validation...' : 'Approuver et créditer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
