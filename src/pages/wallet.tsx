import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Loader2, Eye, EyeOff, X, Copy, CheckCheck } from 'lucide-react'
import IconPieces       from 'flat-color-icons/svg/paid.svg'
import IconDistributeur from 'flat-color-icons/svg/currency_exchange.svg'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { createPayment } from '@/lib/payment-api'
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
  reference: string | null
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: 'Complété',  className: 'bg-emerald-50 text-emerald-700' },
  pending:   { label: 'En attente', className: 'bg-amber-50 text-amber-700' },
  failed:    { label: 'Échoué',    className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Annulé',   className: 'bg-gray-100 text-gray-500' },
}

const METHOD_LABEL: Record<string, string> = {
  moncash: 'MonCash',
  natcash: 'NatCash',
  wallet:  'Portefeuille',
}

function ReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
  const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
  const badge = STATUS_BADGE[tx.status] ?? STATUS_BADGE.pending

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const rows: { label: string; value: string; copyable?: boolean }[] = [
    { label: 'Statut',      value: badge.label },
    { label: 'Type',        value: config.label },
    ...(tx.payment_method ? [{ label: 'Méthode', value: METHOD_LABEL[tx.payment_method] ?? tx.payment_method }] : []),
    ...(tx.reference ? [{ label: 'Référence', value: tx.reference, copyable: true }] : []),
    { label: 'ID Transaction', value: tx.id.slice(0, 16) + '…', copyable: true },
    { label: 'Date', value: new Date(tx.created_at).toLocaleString('fr-HT', { dateStyle: 'medium', timeStyle: 'short' }) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #4F2A8F 0%, #6B3FAF 40%, #3B1F7A 100%)', opacity: 0.95 }} />

      <div
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        {/* Receipt card */}
        <div className="rounded-3xl bg-white overflow-hidden shadow-2xl">
          {/* Amount header */}
          <div className="px-6 pt-7 pb-6 text-center" style={{ background: 'linear-gradient(160deg, #4F2A8F, #6B3FAF)' }}>
            <p className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-2">
              {isCredit ? 'Montant crédité' : 'Montant débité'}
            </p>
            <p className={cn('text-4xl font-black', isCredit ? 'text-emerald-300' : 'text-white')}>
              {isCredit ? '+' : '-'}{tx.amount.toLocaleString('fr-HT')}
            </p>
            <p className="text-white/50 text-sm font-semibold mt-1">HTG</p>

            {/* Status pill */}
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: tx.status === 'completed' ? 'rgba(52,211,153,0.2)' : tx.status === 'failed' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)',
                color: tx.status === 'completed' ? '#34d399' : tx.status === 'failed' ? '#f87171' : '#fbbf24',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full"
                style={{ background: tx.status === 'completed' ? '#34d399' : tx.status === 'failed' ? '#f87171' : '#fbbf24' }}
              />
              {badge.label}
            </div>
          </div>

          {/* Jagged edge separator */}
          <div className="relative h-4 overflow-hidden" style={{ background: 'linear-gradient(160deg, #4F2A8F, #6B3FAF)' }}>
            <svg viewBox="0 0 360 16" preserveAspectRatio="none" className="absolute bottom-0 w-full h-4" fill="white">
              <path d="M0,16 L0,8 L18,16 L36,8 L54,16 L72,8 L90,16 L108,8 L126,16 L144,8 L162,16 L180,8 L198,16 L216,8 L234,16 L252,8 L270,16 L288,8 L306,16 L324,8 L342,16 L360,8 L360,16 Z" />
            </svg>
          </div>

          {/* Detail rows */}
          <div className="px-6 pt-3 pb-7 space-y-3.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground font-medium shrink-0">{row.label}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground text-right truncate max-w-[180px]">{row.value}</span>
                  {row.copyable && (
                    <button
                      onClick={() => copy(row.value)}
                      className="shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
                    >
                      {copied
                        ? <CheckCheck className="h-3 w-3 text-emerald-500" />
                        : <Copy className="h-3 w-3 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Divider */}
            <div className="border-t border-dashed border-border/60 pt-3">
              <p className="text-center text-[10px] text-muted-foreground/50 font-medium">
                Propulsé par MonCash & NatCash
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null)

  async function loadData() {
    if (!user) return
    const walletRes = await supabase.from('wallets').select('id, available_balance, blocked_balance').eq('user_id', user.id).maybeSingle()
    if (walletRes.data) {
      setWallet(walletRes.data)
      const txRes = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, status, payment_method, description, reference, created_at')
        .eq('wallet_id', walletRes.data.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (txRes.data) setTransactions(txRes.data as Transaction[])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user])

  async function handleTopup() {
    if (!topupAmount || parseFloat(topupAmount) < 100 || !wallet) return
    setSubmitting(true)
    const amount = parseFloat(topupAmount)
    try {
      const result = await createPayment({ amount, method: topupMethod, wallet_id: wallet.id })
      sessionStorage.setItem('konvwa_pay_ref', result.reference_id)
      toast.success('Redirection vers ' + (topupMethod === 'moncash' ? 'MonCash' : 'NatCash') + '…')
      setTopupOpen(false)
      window.location.href = result.url
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg || 'Erreur lors de l\'initialisation du paiement.')
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
    <div className="min-h-full bg-[#F4F5F7]">

      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 stagger-item">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portefeuille</h1>
          <p className="text-sm text-muted-foreground">Gérez votre solde HTG</p>
        </div>
        <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <Plus className="h-4 w-4" />
              Recharger
            </button>
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
                    <button
                      key={a}
                      onClick={() => setTopupAmount(a.toString())}
                      className={cn(
                        'rounded-xl py-2 text-sm font-semibold border transition-colors',
                        topupAmount === a.toString()
                          ? 'text-white border-transparent'
                          : 'border-gray-200 bg-white text-foreground hover:border-primary/40'
                      )}
                      style={topupAmount === a.toString() ? { background: 'linear-gradient(135deg, #F05A28, #D44E21)' } : undefined}
                    >
                      {(a / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="Montant personnalisé"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-2">
                <Label>Méthode</Label>
                <RadioGroup value={topupMethod} onValueChange={(v) => setTopupMethod(v as 'moncash' | 'natcash')} className="grid grid-cols-2 gap-3">
                  {([
                    ['moncash', '/moncash-logo.jpg', 'Digicel'],
                    ['natcash', '/natcash-logo.png', 'Natcom'],
                  ] as const).map(([val, logo, sub]) => (
                    <div key={val} className="relative">
                      <RadioGroupItem value={val} id={val} className="peer sr-only" />
                      <Label htmlFor={val} className="flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors">
                        <img src={logo} alt={val} className="h-8 object-contain mb-1.5" />
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
              <button onClick={() => setTopupOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors">Annuler</button>
              <button
                onClick={handleTopup}
                disabled={!topupAmount || parseFloat(topupAmount) < 100 || submitting}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Wallet Card — credit card proportions ── */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '60ms' }}>
        <div
          className="rounded-3xl text-white relative overflow-hidden shadow-[0_10px_40px_rgba(0,195,220,0.40)]"
          style={{
            background: 'linear-gradient(135deg, #00E5F5 0%, #00C3DC 40%, #0099B8 100%)',
            aspectRatio: '1.586',
          }}
        >
          {/* Decorative rings */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full border border-white/12" />
          <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full border border-white/8" />

          <div className="absolute inset-0 z-10 flex flex-col justify-between p-4">

            {/* Row 1: branding + contactless */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* 3-crates logo in white tones */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 72" fill="none" style={{ height: 22, width: 'auto' }} aria-hidden="true">
                  <rect x="0"  y="42" width="40" height="24" rx="6" fill="rgba(255,255,255,0.55)"/>
                  <rect x="0"  y="42" width="9"  height="24" rx="6" fill="rgba(255,255,255,0.35)"/>
                  <rect x="31" y="42" width="9"  height="24" rx="6" fill="rgba(255,255,255,0.35)"/>
                  <rect x="9" y="48"   width="22" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
                  <rect x="9" y="52.5" width="22" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
                  <rect x="9" y="57"   width="22" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
                  <rect x="34" y="26" width="40" height="24" rx="6" fill="rgba(255,255,255,0.70)"/>
                  <rect x="34" y="26" width="9"  height="24" rx="6" fill="rgba(255,255,255,0.45)"/>
                  <rect x="65" y="26" width="9"  height="24" rx="6" fill="rgba(255,255,255,0.45)"/>
                  <rect x="43" y="32"   width="22" height="2" rx="1" fill="rgba(255,255,255,0.30)"/>
                  <rect x="43" y="36.5" width="22" height="2" rx="1" fill="rgba(255,255,255,0.30)"/>
                  <rect x="43" y="41"   width="22" height="2" rx="1" fill="rgba(255,255,255,0.30)"/>
                  <rect x="68" y="10" width="40" height="24" rx="6" fill="rgba(255,255,255,0.90)"/>
                  <rect x="68" y="10" width="9"  height="24" rx="6" fill="rgba(255,255,255,0.60)"/>
                  <rect x="99" y="10" width="9"  height="24" rx="6" fill="rgba(255,255,255,0.60)"/>
                  <rect x="77" y="16"   width="22" height="2" rx="1" fill="rgba(255,255,255,0.40)"/>
                  <rect x="77" y="20.5" width="22" height="2" rx="1" fill="rgba(255,255,255,0.40)"/>
                  <rect x="77" y="25"   width="22" height="2" rx="1" fill="rgba(255,255,255,0.40)"/>
                </svg>
                <span className="font-bold text-white text-sm tracking-wide">KONVWA</span>
              </div>
              <svg width="28" height="24" viewBox="0 0 30 26" fill="none">
                <circle cx="4" cy="13" r="2.5" fill="white" opacity="0.9"/>
                <path d="M10 7C13.3 9.5 13.3 16.5 10 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
                <path d="M16 3.5C21.5 7.5 21.5 18.5 16 22.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
                <path d="M22 0.5C29.5 5.5 29.5 20.5 22 25.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.3"/>
              </svg>
            </div>

            {/* Row 2: chip + balance inline */}
            <div className="flex items-end gap-4">
              <svg width="40" height="30" viewBox="0 0 46 36" fill="none" className="shrink-0 mb-0.5">
                <rect width="46" height="36" rx="7" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <line x1="15" y1="0" x2="15" y2="36" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
                <line x1="31" y1="0" x2="31" y2="36" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
                <line x1="0" y1="12" x2="46" y2="12" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
                <line x1="0" y1="24" x2="46" y2="24" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
                <rect x="15" y="12" width="16" height="12" rx="2" fill="rgba(255,255,255,0.12)"/>
              </svg>
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/55 font-semibold mb-0.5">Solde disponible</p>
                {loading ? (
                  <Skeleton className="h-7 w-36 bg-white/15 rounded-lg" />
                ) : (
                  <p className="text-[1.6rem] font-bold tracking-tight leading-none">
                    {balanceVisible ? `${balance.toLocaleString('fr-HT')} HTG` : '• • • • • •'}
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: holder + number + eye + HTG */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[8px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-0.5">Titulaire</p>
                <p className="text-[13px] font-semibold text-white/85 tracking-wide uppercase leading-tight">
                  {profile?.full_name || user?.email?.split('@')[0] || '—'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBalanceVisible(v => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {balanceVisible
                    ? <Eye className="h-3 w-3 text-white/60" />
                    : <EyeOff className="h-3 w-3 text-white/60" />}
                </button>
                <div className="text-right">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-0.5">N° Compte</p>
                  <p className="text-[10px] font-mono font-semibold text-white/70 tracking-widest">{cardNumber}</p>
                </div>
                <div className="rounded-md bg-white/20 px-2 py-1 ml-1">
                  <span className="text-[11px] font-black text-white tracking-widest">HTG</span>
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
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity pressable"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
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
        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
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
        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
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
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Aucune transaction</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm divide-y divide-border/60">
            {transactions.map((tx) => {
              const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
              const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
              const badge = STATUS_BADGE[tx.status] ?? STATUS_BADGE.pending
              return (
                <button
                  key={tx.id}
                  onClick={() => setReceiptTx(tx)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', config.bg)}>
                    {isCredit
                      ? <ArrowDownLeft className={cn('h-5 w-5', config.color)} />
                      : <ArrowUpRight className={cn('h-5 w-5', config.color)} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{config.label}</p>
                    <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5', badge.className)}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-bold text-sm', config.color)}>
                      {config.sign}{tx.amount.toLocaleString('fr-HT')} HTG
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Receipt modal */}
      {receiptTx && (
        <ReceiptModal tx={receiptTx} onClose={() => setReceiptTx(null)} />
      )}
    </div>
  )
}
