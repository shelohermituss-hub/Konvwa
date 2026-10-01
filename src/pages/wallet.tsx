import { useEffect, useState, useMemo, useCallback } from 'react'
import { haptics } from '@/lib/haptic'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, ArrowDownLeft, ArrowUpRight, CreditCard, Loader2, Eye, EyeOff, X, Copy, CheckCheck, Bitcoin, Wallet, Upload, Search } from 'lucide-react'
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
  proof_url: string | null
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
  moncash:  'MonCash',
  natcash:  'NatCash',
  wallet:   'Portefeuille',
  virement: 'Virement BUH',
  btc:      'Bitcoin (BTC)',
  usdt:     'USDT TRC20',
  eth:      'Ethereum (ETH)',
}

const CRYPTO_ADDRESS: Record<string, { address: string; network: string; coin: string }> = {
  btc:  { address: '0x0dff06e9fe0665e4379a80a9a033a78d9c8a860e', network: 'ERC20', coin: 'BTC' },
  usdt: { address: 'THgK5YWMdmvfPnFycjp7RyHJShKZ9NcriA',        network: 'TRC20', coin: 'USDT' },
  eth:  { address: '0x0dff06e9fe0665e4379a80a9a033a78d9c8a860e', network: 'ERC20', coin: 'ETH' },
}

function ProofUpload({
  preview,
  required,
  onFile,
  onRemove,
}: {
  preview: string | null
  required: boolean
  onFile: (file: File, preview: string) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        Preuve de paiement{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-emerald-200">
          <img src={preview} alt="Preuve" className="w-full h-36 object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm"
          >
            <X className="h-3.5 w-3.5 text-foreground" />
          </button>
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-emerald-600/90 rounded-full px-2 py-0.5">
            <CheckCheck className="h-3 w-3 text-white" />
            <span className="text-[10px] text-white font-semibold">Preuve ajoutée</span>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-[#F8F8FA] py-5 cursor-pointer hover:border-primary/40 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm">
            <Upload className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-foreground">Appuyez pour ajouter une preuve</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Capture d'écran ou photo · PNG, JPG · max 5 Mo</p>
          </div>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              onFile(file, URL.createObjectURL(file))
            }}
          />
        </label>
      )}
    </div>
  )
}

function ReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
  const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
  const badge = STATUS_BADGE[tx.status] ?? STATUS_BADGE.pending

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      haptics.copy()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const rows: { label: string; value: string; copyable?: boolean }[] = [
    { label: 'Statut',      value: badge.label },
    { label: 'Type',        value: config.label },
    ...(tx.payment_method ? [{ label: 'Méthode', value: METHOD_LABEL[tx.payment_method] ?? tx.payment_method }] : []),
    ...(tx.reference ? [{ label: 'Référence', value: tx.reference, copyable: true }] : []),
    ...(tx.proof_url ? [{ label: 'Preuve', value: 'Soumise ✓' }] : []),
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
  const [topupMethod, setTopupMethod] = useState<'moncash' | 'natcash' | 'virement' | 'btc' | 'usdt' | 'eth'>('moncash')
  const [topupOpen, setTopupOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null)
  const [txHashInput, setTxHashInput] = useState('')
  const [addrCopied, setAddrCopied] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  async function loadData() {
    if (!user) return
    const walletRes = await supabase.from('wallets').select('id, available_balance, blocked_balance').eq('user_id', user.id).maybeSingle()
    if (walletRes.data) {
      setWallet(walletRes.data)
      const txRes = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, status, payment_method, description, reference, proof_url, created_at')
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
    if (topupMethod === 'virement' || topupMethod === 'btc' || topupMethod === 'usdt' || topupMethod === 'eth') {
      await handleManualDeposit()
      return
    }
    setSubmitting(true)
    const amount = parseFloat(topupAmount)
    try {
      const result = await createPayment({ amount, method: topupMethod as 'moncash' | 'natcash', wallet_id: wallet.id })
      sessionStorage.setItem('konvwa_pay_ref', result.reference_id)
      haptics.success()
      toast.success('Redirection vers ' + (topupMethod === 'moncash' ? 'MonCash' : 'NatCash') + '…')
      setTopupOpen(false)
      window.location.href = result.url
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || 'Erreur lors de l\'initialisation du paiement.'
      toast.error(msg)
    }
    setSubmitting(false)
  }

  async function handleManualDeposit() {
    if (!topupAmount || parseFloat(topupAmount) < 100 || !wallet || !user) return
    const isCrypto = topupMethod !== 'virement'
    if (isCrypto && !proofFile) return
    setSubmitting(true)
    try {
      const amount = parseFloat(topupAmount)

      // Upload proof image if provided
      let proofStoragePath: string | null = null
      if (proofFile) {
        const ext = proofFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const contentType = proofFile.type || 'image/jpeg'
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(path, proofFile, { contentType, upsert: false })
        if (uploadError) {
          const msg = typeof uploadError.message === 'string'
            ? uploadError.message
            : JSON.stringify(uploadError)
          throw new Error('Téléversement impossible : ' + msg)
        }
        proofStoragePath = path
      }

      const { error } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'deposit',
        amount,
        status: 'pending',
        payment_method: topupMethod,
        description: isCrypto
          ? `Dépôt crypto ${topupMethod.toUpperCase()}`
          : 'Virement bancaire BUH DOLLAR',
        reference: txHashInput.trim() || null,
        proof_url: proofStoragePath,
      })
      if (error) {
        const msg = typeof error.message === 'string'
          ? error.message
          : JSON.stringify(error)
        throw new Error('Enregistrement impossible : ' + msg)
      }
      haptics.success()
      toast.success('Dépôt soumis — en attente de confirmation.')
      setTopupOpen(false)
      setTopupAmount('')
      setTxHashInput('')
      setProofFile(null)
      setProofPreview(null)
      loadData()
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : typeof e === 'string'
          ? e
          : JSON.stringify(e)
      toast.error(msg || 'Erreur inconnue.')
    }
    setSubmitting(false)
  }

  const filteredTx = useMemo(() => {
    return transactions.filter(tx => {
      const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
      const matchSearch = !search ||
        config.label.toLowerCase().includes(search.toLowerCase()) ||
        (tx.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (tx.reference ?? '').toLowerCase().includes(search.toLowerCase())
      const matchType = !filterType || tx.type === filterType
      const matchStatus = !filterStatus || tx.status === filterStatus
      return matchSearch && matchType && matchStatus
    })
  }, [transactions, search, filterType, filterStatus])

  const groupedTx = useMemo(() => {
    const groups: { label: string; total: number; items: Transaction[] }[] = []
    const map: Record<string, number> = {}
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    for (const tx of filteredTx) {
      const d = new Date(tx.created_at)
      let key: string
      if (d.toDateString() === today.toDateString()) key = "Aujourd'hui"
      else if (d.toDateString() === yesterday.toDateString()) key = 'Hier'
      else key = d.toLocaleDateString('fr-HT', { day: 'numeric', month: 'long' })
      if (map[key] === undefined) { map[key] = groups.length; groups.push({ label: key, total: 0, items: [] }) }
      groups[map[key]].items.push(tx)
      const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
      groups[map[key]].total += isCredit ? tx.amount : -tx.amount
    }
    return groups
  }, [filteredTx])

  const handleTap = useCallback(() => haptics.tap(), [])

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
      <div className="flex items-center justify-between px-5 pt-5 pb-4 animate-fade-in-up delay-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portefeuille</h1>
          <p className="text-sm text-muted-foreground">Gérez votre solde HTG</p>
        </div>
        <Dialog open={topupOpen} onOpenChange={(open) => {
          setTopupOpen(open)
          if (!open) { setProofFile(null); setProofPreview(null); setTxHashInput('') }
        }}>
          <DialogTrigger asChild>
            <button
              onClick={handleTap}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm pressable"
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
                <Label>Méthode de paiement</Label>
                <RadioGroup
                  value={topupMethod}
                  onValueChange={(v) => { setTopupMethod(v as typeof topupMethod); setTxHashInput('') }}
                  className="grid grid-cols-2 gap-2.5"
                >
                  {/* MonCash */}
                  <div className="relative">
                    <RadioGroupItem value="moncash" id="moncash" className="peer sr-only" />
                    <Label htmlFor="moncash" className="flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors">
                      <img src="/moncash-logo.jpg" alt="MonCash" className="h-7 object-contain mb-1" />
                      <span className="text-[10px] text-muted-foreground">Digicel</span>
                    </Label>
                  </div>
                  {/* NatCash */}
                  <div className="relative">
                    <RadioGroupItem value="natcash" id="natcash" className="peer sr-only" />
                    <Label htmlFor="natcash" className="flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors">
                      <img src="/natcash-logo.png" alt="NatCash" className="h-7 object-contain mb-1" />
                      <span className="text-[10px] text-muted-foreground">Natcom</span>
                    </Label>
                  </div>
                  {/* Virement */}
                  <div className="relative">
                    <RadioGroupItem value="virement" id="virement" className="peer sr-only" />
                    <Label htmlFor="virement" className="flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-colors">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 mb-1">
                        <Wallet className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Virement</span>
                    </Label>
                  </div>
                  {/* Crypto */}
                  <div className="relative">
                    <RadioGroupItem value="btc" id="crypto-tab" className="peer sr-only" />
                    <Label
                      htmlFor="crypto-tab"
                      onClick={() => setTopupMethod(m => (m === 'btc' || m === 'usdt' || m === 'eth') ? m : 'btc')}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer hover:border-orange-400 transition-colors',
                        (topupMethod === 'btc' || topupMethod === 'usdt' || topupMethod === 'eth')
                          ? 'border-orange-400 bg-orange-50'
                          : ''
                      )}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 mb-1">
                        <Bitcoin className="h-4 w-4 text-orange-500" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Crypto</span>
                    </Label>
                  </div>
                </RadioGroup>

                {/* Crypto coin selector */}
                {(topupMethod === 'btc' || topupMethod === 'usdt' || topupMethod === 'eth') && (
                  <div className="flex gap-2 pt-1">
                    {(['btc', 'usdt', 'eth'] as const).map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => setTopupMethod(coin)}
                        className={cn(
                          'flex-1 rounded-xl py-1.5 text-xs font-bold border transition-colors',
                          topupMethod === coin
                            ? 'border-orange-400 bg-orange-500 text-white'
                            : 'border-gray-200 bg-white text-foreground hover:border-orange-300'
                        )}
                      >
                        {coin.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Virement bancaire details */}
              {topupMethod === 'virement' && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Coordonnées bancaires</p>
                    {[
                      ['Banque', 'BUH DOLLAR'],
                      ['N° Compte', '55000146737'],
                      ['Titulaire', 'HERMITUS SHELO'],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{label}</span>
                        <span className="font-semibold text-xs text-foreground">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Numéro de référence du virement</Label>
                    <Input
                      placeholder="Ex: VIR-20260930-XXX"
                      value={txHashInput}
                      onChange={(e) => setTxHashInput(e.target.value)}
                      className="h-10 rounded-xl bg-[#F0F1F5] border-0 text-sm"
                    />
                  </div>
                  <ProofUpload
                    preview={proofPreview}
                    required={false}
                    onFile={(f, p) => { setProofFile(f); setProofPreview(p) }}
                    onRemove={() => { setProofFile(null); setProofPreview(null) }}
                  />
                </div>
              )}

              {/* Crypto deposit address */}
              {(topupMethod === 'btc' || topupMethod === 'usdt' || topupMethod === 'eth') && (() => {
                const info = CRYPTO_ADDRESS[topupMethod]
                return (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">
                          {info.coin} — Réseau {info.network}
                        </p>
                        <span className="text-[9px] font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">DÉPÔT</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Adresse de dépôt</p>
                        <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-orange-100">
                          <p className="text-[11px] font-mono text-foreground flex-1 break-all leading-relaxed">{info.address}</p>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(info.address)
                              haptics.copy()
                              setAddrCopied(true)
                              setTimeout(() => setAddrCopied(false), 2000)
                            }}
                            className="shrink-0 p-1 rounded hover:bg-orange-50 transition-colors"
                          >
                            {addrCopied
                              ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-orange-700">
                        Envoyez uniquement des {info.coin} sur le réseau {info.network}. Tout autre envoi sera perdu.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hash de la transaction (optionnel)</Label>
                      <Input
                        placeholder="0x... ou TXid..."
                        value={txHashInput}
                        onChange={(e) => setTxHashInput(e.target.value)}
                        className="h-10 rounded-xl bg-[#F0F1F5] border-0 text-sm font-mono"
                      />
                    </div>
                    <ProofUpload
                      preview={proofPreview}
                      required={true}
                      onFile={(f, p) => { setProofFile(f); setProofPreview(p) }}
                      onRemove={() => { setProofFile(null); setProofPreview(null) }}
                    />
                  </div>
                )
              })()}
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
                onClick={() => { handleTap(); handleTopup() }}
                disabled={
                  !topupAmount || parseFloat(topupAmount) < 100 || submitting ||
                  ((topupMethod === 'btc' || topupMethod === 'usdt' || topupMethod === 'eth') && !proofFile)
                }
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity pressable"
                style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Wallet Card ── */}
      <div className="px-4 pb-5 animate-fade-in-up delay-2">
        <div
          className="rounded-3xl text-white relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0A1628 0%, #162340 55%, #1C2F50 100%)',
            boxShadow: '0 12px 40px rgba(10,22,40,0.45)',
            aspectRatio: '1.586',
          }}
        >
          {/* Subtle orange glow top-right */}
          <div
            className="absolute"
            style={{
              top: '-40%', right: '-20%',
              width: '55%', paddingTop: '55%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(240,90,40,0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div className="absolute inset-0 flex flex-col justify-between p-5">
            {/* Top row: brand + eye toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-base tracking-widest">KONVWA</span>
                <span
                  className="text-[9px] font-bold tracking-widest rounded-sm px-1.5 py-0.5"
                  style={{ background: 'rgba(240,90,40,0.22)', color: '#F97B50' }}
                >
                  PAY
                </span>
              </div>
              <button
                onClick={() => setBalanceVisible(v => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                {balanceVisible
                  ? <Eye className="h-3.5 w-3.5 text-white/60" />
                  : <EyeOff className="h-3.5 w-3.5 text-white/60" />}
              </button>
            </div>

            {/* Center: balance */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold mb-1">
                Solde disponible
              </p>
              {loading ? (
                <Skeleton className="h-8 w-40 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <p className="text-[2rem] font-bold tracking-tight leading-none text-white">
                  {balanceVisible ? `${balance.toLocaleString('fr-HT')} HTG` : '••••• HTG'}
                </p>
              )}
            </div>

            {/* Bottom row: name + account number */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-0.5">Titulaire</p>
                <p className="text-[13px] font-semibold text-white/80 tracking-wider uppercase">
                  {profile?.full_name || user?.email?.split('@')[0] || '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-0.5">N° Compte</p>
                <p className="text-[11px] font-mono font-semibold text-white/60 tracking-widest">{cardNumber}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-5 animate-fade-in-up delay-3">
        <div className="flex gap-3">
          <button
            onClick={() => { handleTap(); setTopupOpen(true) }}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity pressable"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
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
      <div className="px-4 pb-5 grid grid-cols-2 gap-3 animate-fade-in-up delay-4">
        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 mb-2">
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
      <div className="px-4 pb-8 animate-fade-in-up delay-5">
        <h2 className="text-base font-bold mb-3 px-1">Dernières transactions</h2>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher des transactions"
            className="w-full rounded-2xl bg-white border border-gray-100 shadow-sm pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
          {[
            { key: 'type',   label: 'Type',    value: filterType,   options: [['deposit','Dépôt'],['payment','Paiement'],['withdrawal','Retrait']] as [string,string][], set: setFilterType },
            { key: 'status', label: 'Statut',  value: filterStatus, options: [['completed','Complété'],['pending','En attente'],['failed','Échoué']] as [string,string][], set: setFilterStatus },
          ].map(({ key, label, value, options, set }) => (
            <div key={key} className="flex gap-1.5 shrink-0">
              {value ? (
                <button
                  onClick={() => { haptics.light(); set(null) }}
                  className="flex items-center gap-1 rounded-full border border-[#0A1628] bg-[#0A1628] px-3 py-1.5 text-xs font-semibold text-white pressable"
                >
                  {options.find(([v]) => v === value)?.[1] ?? label}
                  <X className="h-3 w-3" />
                </button>
              ) : (
                options.map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => { haptics.light(); set(v) }}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:border-gray-400 transition-colors pressable"
                  >
                    {l}
                  </button>
                ))
              )}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : groupedTx.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Aucune transaction</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTx.map((group) => (
              <div key={group.label}>
                {/* Date header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
                  <span className={cn('text-xs font-semibold', group.total >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                    {group.total >= 0 ? '+' : ''}{group.total.toLocaleString('fr-HT')} HTG
                  </span>
                </div>
                {/* Rows */}
                <div className="rounded-2xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                  {group.items.map((tx) => {
                    const config = TX_CONFIG[tx.type] || TX_CONFIG.payment
                    const isCredit = tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'unblock'
                    const badge = STATUS_BADGE[tx.status] ?? STATUS_BADGE.pending
                    return (
                      <button
                        key={tx.id}
                        onClick={() => { haptics.light(); setReceiptTx(tx) }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-gray-100">
                          {isCredit
                            ? <ArrowDownLeft className="h-5 w-5 text-gray-500" />
                            : <ArrowUpRight className="h-5 w-5 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{config.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(tx.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                            {tx.payment_method ? ` · ${METHOD_LABEL[tx.payment_method] ?? tx.payment_method}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('font-bold text-sm', isCredit ? 'text-emerald-600' : 'text-foreground')}>
                            {isCredit ? '+' : '-'}{tx.amount.toLocaleString('fr-HT')} HTG
                          </p>
                          <p className={cn('text-[11px] font-medium mt-0.5', badge.className.includes('emerald') ? 'text-emerald-600' : badge.className.includes('red') ? 'text-red-500' : badge.className.includes('amber') ? 'text-amber-500' : 'text-gray-400')}>
                            {badge.label}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
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
