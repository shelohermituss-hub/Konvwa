import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Plus, Smartphone, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface WalletData {
  available_balance: number
  blocked_balance: number
}

interface Transaction {
  id: string
  amount: number
  type: string
  status: string
  description: string
  created_at: string
  reference_code?: string
}

const PAYMENT_METHODS = [
  {
    id: 'moncash',
    name: 'MonCash',
    logo: '📱',
    color: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-700',
    desc: 'Digicel Mobile Money',
  },
  {
    id: 'natcash',
    name: 'NatCash',
    logo: '💳',
    color: 'bg-blue-50',
    border: 'border-blue-100',
    text: 'text-blue-700',
    desc: 'Natcom Mobile Money',
  },
]

function txStatusConfig(status: string) {
  if (status === 'completed' || status === 'success') return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completed' }
  if (status === 'pending') return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending' }
  if (status === 'failed') return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/8', label: 'Failed' }
  return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: status }
}

export function BillingPage() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState('moncash')

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('wallets').select('available_balance, blocked_balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions')
        .select('id, amount, type, status, description, created_at, reference_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([walletRes, txRes]) => {
      if (walletRes.data) setWallet(walletRes.data)
      if (txRes.data) setTransactions(txRes.data as Transaction[])
      setLoading(false)
    })
  }, [user])

  const balance = wallet?.available_balance ?? 0
  const blocked = wallet?.blocked_balance ?? 0

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your balance and payment methods</p>
      </div>

      <div className="px-4 pb-6 space-y-4">

        {/* Wallet balance card */}
        <div
          className="rounded-3xl text-white relative overflow-hidden shadow-[0_10px_40px_rgba(240,90,40,0.30)] p-5"
          style={{ background: 'linear-gradient(135deg, #F05A28 0%, #D44E21 60%, #B84018 100%)' }}
        >
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full border border-white/8" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm">KONVWA Wallet</span>
              </div>
              <span className="text-xs font-semibold bg-white/20 rounded-full px-3 py-1">HTG</span>
            </div>

            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold mb-1">Available Balance</p>
              {loading ? (
                <Skeleton className="h-10 w-40 bg-white/15 rounded-xl" />
              ) : (
                <p className="text-4xl font-bold tracking-tight">{balance.toLocaleString('fr-HT')}</p>
              )}
            </div>

            {blocked > 0 && (
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-white/70" />
                <p className="text-xs text-white/70">
                  <span className="font-semibold text-white">{blocked.toLocaleString('fr-HT')} HTG</span> held
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            onClick={() => {}}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Top Up
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-3.5 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors shadow-sm"
            onClick={() => {}}
          >
            <ArrowUpRight className="h-4 w-4" />
            Withdraw
          </button>
        </div>

        {/* Payment methods */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <p className="font-semibold text-sm">Payment Methods</p>
            </div>
            <button className="text-xs font-bold text-primary flex items-center gap-1 hover:text-primary/80 transition-colors">
              <Plus className="h-3.5 w-3.5" />Add
            </button>
          </div>

          <div className="p-4 space-y-2.5">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border p-3.5 transition-all',
                  selectedMethod === method.id
                    ? 'border-primary/30 bg-primary/4 shadow-sm'
                    : `${method.border} ${method.color} hover:opacity-80`
                )}
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-xl shrink-0', method.color)}>
                  {method.logo}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-foreground">{method.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{method.desc}</p>
                </div>
                {selectedMethod === method.id && (
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction history */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Transaction History</p>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-sm text-muted-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Top up your wallet to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {transactions.map((tx) => {
                const isCredit = tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'refund'
                const cfg = txStatusConfig(tx.status)
                const StatusIcon = cfg.icon

                return (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', isCredit ? 'bg-emerald-50' : 'bg-red-50')}>
                      {isCredit ? (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tx.description || (isCredit ? 'Deposit' : 'Debit')}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5', cfg.bg, cfg.color)}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), 'dd MMM, HH:mm')}
                        </span>
                      </div>
                    </div>
                    <p className={cn('font-bold text-sm shrink-0', isCredit ? 'text-emerald-600' : 'text-foreground')}>
                      {isCredit ? '+' : '-'}{Math.abs(tx.amount).toLocaleString('fr-HT')}
                      <span className="text-[10px] font-normal text-muted-foreground ml-0.5">HTG</span>
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
