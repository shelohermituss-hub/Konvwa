import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Smartphone, Loader2, Eye, EyeOff } from 'lucide-react'
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

const TX_CONFIG: Record<string, { label: string; color: string; sign: '+' | '-' }> = {
  deposit: { label: 'Dépôt', color: 'text-success', sign: '+' },
  refund: { label: 'Remboursement', color: 'text-success', sign: '+' },
  unblock: { label: 'Débloqué', color: 'text-success', sign: '+' },
  withdrawal: { label: 'Retrait', color: 'text-destructive', sign: '-' },
  payment: { label: 'Paiement', color: 'text-destructive', sign: '-' },
  block: { label: 'Bloqué', color: 'text-warning', sign: '-' },
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
  const blocked = wallet?.blocked_balance ?? 0

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portefeuille</h1>
          <p className="text-sm text-muted-foreground">Gérez votre solde</p>
        </div>
        <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full gap-1.5">
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
                    <span className="font-semibold">{parseFloat(topupAmount).toLocaleString()} HTG</span>
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

      {/* Wallet Card */}
      <div className="px-4 pb-5">
        <div className="wallet-card-gradient rounded-2xl p-5 text-white glow-wallet relative overflow-hidden">
          {/* Reflection overlay */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }} />
          {/* Decorative blob */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-2xl opacity-25 pointer-events-none animate-pulse-slow"
            style={{ background: 'radial-gradient(circle, rgba(240,90,40,0.7) 0%, transparent 70%)' }} />
          <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-white">Portefeuille HTG</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setBalanceVisible((v) => !v)} className="rounded-full p-1.5 hover:bg-white/10 transition-colors">
                {balanceVisible ? <Eye className="h-4 w-4 text-white/60" /> : <EyeOff className="h-4 w-4 text-white/60" />}
              </button>
              <div className="rounded-lg bg-white/15 px-2.5 py-1">
                <span className="text-xs font-bold text-white">HTG</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-white/60 uppercase tracking-widest font-medium">Solde disponible</p>
            {loading ? (
              <Skeleton className="h-10 w-40 bg-white/20 mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1">
                {balanceVisible ? `${balance.toLocaleString()} HTG` : '••••••'}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-widest">Bloqué</p>
              <p className="text-sm font-semibold text-white/80">
                {balanceVisible ? `${blocked.toLocaleString()} HTG` : '••••'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/50 uppercase tracking-widest">Total</p>
              <p className="text-sm font-semibold text-white/80">
                {balanceVisible ? `${(balance + blocked).toLocaleString()} HTG` : '••••'}
              </p>
            </div>
          </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <ArrowDownLeft className="h-5 w-5 text-success mb-2" />
          <p className="text-xs text-muted-foreground">Total rechargé</p>
          {loading ? <Skeleton className="h-6 w-24 mt-1" /> : (
            <p className="text-lg font-bold text-success mt-1">
              +{transactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + t.amount, 0).toLocaleString()}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <ArrowUpRight className="h-5 w-5 text-destructive mb-2" />
          <p className="text-xs text-muted-foreground">Total dépensé</p>
          {loading ? <Skeleton className="h-6 w-24 mt-1" /> : (
            <p className="text-lg font-bold text-destructive mt-1">
              -{transactions.filter(t => t.type === 'payment' && t.status === 'completed').reduce((s, t) => s + t.amount, 0).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="px-5 pb-6">
        <h2 className="text-base font-bold mb-3">Transactions</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Aucune transaction</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border">
            {transactions.map((tx) => {
              const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
              const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', isCredit ? 'bg-success/10' : 'bg-destructive/10')}>
                    {isCredit
                      ? <ArrowDownLeft className="h-5 w-5 text-success" />
                      : <ArrowUpRight className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{config.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{tx.description || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-bold text-sm', config.color)}>
                      {config.sign}{tx.amount.toLocaleString()} HTG
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('fr-HT')}
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
