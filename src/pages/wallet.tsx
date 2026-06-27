import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone, Loader2, Eye, EyeOff, Package } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WalletData {
  id: string
  available_balance: number
  blocked_balance: number
}

interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'block' | 'unblock'
  amount: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  payment_method: string | null
  description: string | null
  created_at: string
}

const TX_CONFIG: Record<string, { label: string; color: string; bg: string; sign: '+' | '-' }> = {
  deposit:    { label: 'Dépôt',          color: 'text-emerald-600', bg: 'bg-emerald-50',    sign: '+' },
  refund:     { label: 'Remboursement',  color: 'text-emerald-600', bg: 'bg-emerald-50',    sign: '+' },
  unblock:    { label: 'Débloqué',       color: 'text-emerald-600', bg: 'bg-emerald-50',    sign: '+' },
  withdrawal: { label: 'Retrait',        color: 'text-destructive', bg: 'bg-destructive/8', sign: '-' },
  payment:    { label: 'Paiement',       color: 'text-destructive', bg: 'bg-destructive/8', sign: '-' },
  block:      { label: 'Bloqué',         color: 'text-warning',     bg: 'bg-warning/10',    sign: '-' },
}

export function WalletPage() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupMethod, setTopupMethod] = useState<'moncash' | 'natcash'>('moncash')
  const [topupOpen, setTopupOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    if (!user) return
    const [walletRes, txRes] = await Promise.all([
      supabase.from('wallets').select('id, available_balance, blocked_balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions').select('id, type, amount, status, payment_method, description, created_at').order('created_at', { ascending: false }).limit(30),
    ])
    if (walletRes.data) setWallet(walletRes.data)
    if (txRes.data) setTransactions(txRes.data as Transaction[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user])

  async function handleTopup() {
    if (!topupAmount || parseFloat(topupAmount) < 100 || !wallet) return
    setSubmitting(true)
    const amount = parseFloat(topupAmount)
    const { error } = await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      type: 'deposit',
      amount,
      status: 'pending',
      payment_method: topupMethod,
      description: `Recharge ${topupMethod === 'moncash' ? 'MonCash' : 'NatCash'}`,
    })
    if (error) {
      toast.error('Erreur lors de la recharge.')
    } else {
      toast.success('Demande soumise. Elle sera traitée sous peu.')
      setTopupOpen(false)
      setTopupAmount('')
      await loadData()
    }
    setSubmitting(false)
  }

  const balance = wallet?.available_balance ?? 0

  const accountId = user?.id
    ? `${user.id.slice(0, 4).toUpperCase()} ${user.id.slice(4, 8).toUpperCase()}`
    : '— — — —'

  const totalDeposited = transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0)
  const totalSpent = transactions
    .filter(t => t.type === 'payment' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-full bg-background">

      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 stagger-item">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portefeuille</h1>
          <p className="text-sm text-muted-foreground">Gérez votre solde HTG</p>
        </div>
        <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Recharger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recharger le portefeuille</DialogTitle>
              <DialogDescription>Choisissez le montant et la méthode</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label>Montant (HTG)</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 5000, 10000, 25000].map((a) => (
                    <Button
                      key={a}
                      variant={topupAmount === a.toString() ? 'default' : 'outline'}
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setTopupAmount(a.toString())}
                    >
                      {(a / 1000).toFixed(0)}k
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="Montant personnalisé"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Méthode</Label>
                <RadioGroup value={topupMethod} onValueChange={(v) => setTopupMethod(v as 'moncash' | 'natcash')} className="grid grid-cols-2 gap-3">
                  {([['moncash', 'MonCash', 'Digicel', '#ff6600'], ['natcash', 'NatCash', 'Natcom', '#00a651']] as const).map(([val, name, sub, color]) => (
                    <div key={val} className="relative">
                      <RadioGroupItem value={val} id={val} className="peer sr-only" />
                      <Label htmlFor={val} className="flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors">
                        <Smartphone className="h-6 w-6 mb-1.5" style={{ color }} />
                        <span className="font-semibold text-sm">{name}</span>
                        <span className="text-xs text-muted-foreground">{sub}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              {topupAmount && parseFloat(topupAmount) >= 100 && (
                <div className="rounded-xl bg-muted p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">À créditer</span>
                    <span className="font-semibold">{parseFloat(topupAmount).toLocaleString('fr-HT')} HTG</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTopupOpen(false)} className="rounded-xl">Annuler</Button>
              <Button onClick={handleTopup} disabled={!topupAmount || parseFloat(topupAmount) < 100 || submitting} className="rounded-xl">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── FamillyBill-style Wallet Card ── */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '60ms' }}>
        <div
          className="rounded-3xl p-5 text-white relative overflow-hidden shadow-[0_8px_40px_rgba(10,22,40,0.28)]"
          style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0F1E50 55%, #161044 100%)', minHeight: 200 }}
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute top-10 -right-20 h-36 w-36 rounded-full bg-white/[0.03]" />

          <div className="relative z-10 flex flex-col gap-5">

            {/* Top row: icon + label | overlapping circles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">Portefeuille HTG</span>
              </div>
              {/* Mastercard-style overlapping circles */}
              <div className="relative flex items-center h-9">
                <div className="h-9 w-9 rounded-full bg-primary shadow-sm" style={{ opacity: 0.95 }} />
                <div className="h-9 w-9 rounded-full -ml-4" style={{ background: '#FF9B4E', opacity: 0.85 }} />
              </div>
            </div>

            {/* Balance */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-1">
                Solde disponible
              </p>
              {loading ? (
                <Skeleton className="h-10 w-48 bg-white/15 rounded-xl" />
              ) : (
                <p className="text-[2rem] font-bold tracking-tight leading-none">
                  {balanceVisible
                    ? `${balance.toLocaleString('fr-HT')} HTG`
                    : '• • • • • •'}
                </p>
              )}
            </div>

            {/* Bottom row: ID | eye + HTG badge */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-semibold mb-0.5">
                  ID Compte
                </p>
                <p className="text-sm font-mono font-semibold text-white/75 tracking-widest">
                  {accountId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBalanceVisible(v => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {balanceVisible
                    ? <Eye className="h-3.5 w-3.5 text-white/60" />
                    : <EyeOff className="h-3.5 w-3.5 text-white/60" />}
                </button>
                <div className="rounded-xl bg-white/15 px-3 py-1.5">
                  <span className="text-xs font-bold text-white tracking-widest">HTG</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '100ms' }}>
        <div className="flex gap-3">
          <button
            onClick={() => setTopupOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary text-white py-3.5 text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors pressable"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Recharger
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border bg-white text-foreground py-3.5 text-sm font-semibold hover:bg-muted/30 transition-colors pressable shadow-sm">
            <ArrowUpRight className="h-4 w-4" />
            Retirer
          </button>
        </div>
      </div>

      {/* Stats mini cards */}
      <div className="px-4 pb-5 grid grid-cols-2 gap-3 stagger-item" style={{ animationDelay: '140ms' }}>
        <div className="rounded-2xl bg-white border border-border/60 p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 mb-2">
            <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Total rechargé</p>
          {loading ? <Skeleton className="h-6 w-24 mt-1" /> : (
            <p className="text-lg font-bold text-emerald-600 mt-0.5">
              +{totalDeposited.toLocaleString('fr-HT')}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">HTG</p>
        </div>
        <div className="rounded-2xl bg-white border border-border/60 p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/8 mb-2">
            <ArrowUpRight className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Total dépensé</p>
          {loading ? <Skeleton className="h-6 w-24 mt-1" /> : (
            <p className="text-lg font-bold text-destructive mt-0.5">
              -{totalSpent.toLocaleString('fr-HT')}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">HTG</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-5 pb-8 stagger-item" style={{ animationDelay: '180ms' }}>
        <h2 className="text-base font-bold mb-3">Transactions</h2>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center shadow-sm">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Aucune transaction</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-border/60 overflow-hidden shadow-sm divide-y divide-border/60">
            {transactions.map((tx) => {
              const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
              const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', config.bg)}>
                    {isCredit
                      ? <ArrowDownLeft className={cn('h-5 w-5', config.color)} />
                      : <ArrowUpRight className={cn('h-5 w-5', config.color)} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{config.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{tx.description || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-bold text-sm', config.color)}>
                      {config.sign}{tx.amount.toLocaleString('fr-HT')} HTG
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
