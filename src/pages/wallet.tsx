import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Smartphone, Loader2, Eye, EyeOff } from 'lucide-react'
import IconPieces       from '@/assets/icons/pieces.png'
import IconDistributeur from '@/assets/icons/distributeur.png'
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
  const { user, profile } = useAuth()
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

  const cardNumber = user?.id
    ? `${user.id.slice(0, 4).toUpperCase()}  ${user.id.slice(9, 13).toUpperCase()}  ${user.id.slice(14, 18).toUpperCase()}  ${user.id.slice(19, 23).toUpperCase()}`
    : '——  ——  ——  ——'

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

      {/* ── Wallet Card — credit card style ── */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '60ms' }}>
        <div
          className="rounded-3xl text-white relative overflow-hidden shadow-[0_12px_48px_rgba(37,99,235,0.38)]"
          style={{ background: 'linear-gradient(135deg, #00B4D8 0%, #2563EB 52%, #7C3AED 100%)' }}
        >
          {/* Decorative rings */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full border border-white/8" />

          <div className="relative z-10 p-5 flex flex-col gap-4">

            {/* Row 1: branding + contactless */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <span className="text-[13px] font-black text-white tracking-tighter">K</span>
                </div>
                <span className="font-bold text-white text-sm tracking-wide">KONVWA</span>
              </div>
              <svg width="30" height="26" viewBox="0 0 30 26" fill="none">
                <circle cx="4" cy="13" r="2.5" fill="white" opacity="0.9"/>
                <path d="M10 7C13.3 9.5 13.3 16.5 10 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
                <path d="M16 3.5C21.5 7.5 21.5 18.5 16 22.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
                <path d="M22 0.5C29.5 5.5 29.5 20.5 22 25.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.3"/>
              </svg>
            </div>

            {/* Row 2: chip */}
            <svg width="46" height="36" viewBox="0 0 46 36" fill="none">
              <rect width="46" height="36" rx="7" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.28)" strokeWidth="1"/>
              <line x1="15" y1="0" x2="15" y2="36" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
              <line x1="31" y1="0" x2="31" y2="36" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
              <line x1="0" y1="12" x2="46" y2="12" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
              <line x1="0" y1="24" x2="46" y2="24" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
              <rect x="15" y="12" width="16" height="12" rx="2" fill="rgba(255,255,255,0.1)"/>
            </svg>

            {/* Row 3: balance */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/50 font-semibold mb-1">
                Solde disponible
              </p>
              {loading ? (
                <Skeleton className="h-9 w-44 bg-white/15 rounded-xl" />
              ) : (
                <p className="text-[1.85rem] font-bold tracking-tight leading-none">
                  {balanceVisible ? `${balance.toLocaleString('fr-HT')} HTG` : '• • • • • •'}
                </p>
              )}
            </div>

            {/* Row 4: holder + card number + HTG */}
            <div className="flex items-end justify-between pt-1">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-0.5">
                  Titulaire
                </p>
                <p className="text-sm font-semibold text-white/80 tracking-wide uppercase">
                  {profile?.full_name || user?.email?.split('@')[0] || '—'}
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
                <div>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-0.5 text-right">
                    N° Compte
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-white/70 tracking-widest">
                    {cardNumber}
                  </p>
                </div>
                <div className="rounded-lg bg-white/15 px-2.5 py-1.5 ml-1">
                  <span className="text-xs font-black text-white tracking-widest">HTG</span>
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
            <img src={IconDistributeur} alt="" className="h-5 w-5 object-contain" />
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 mb-2">
            <img src={IconPieces} alt="" className="h-6 w-6 object-contain" />
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/8 mb-2">
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
