import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Plus, Package, Ship, Eye, EyeOff, ArrowDownLeft,
  TrendingUp, ChevronRight, Wallet, HelpCircle, Layers,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface DashboardOrder {
  id: string
  tracking_code: string
  status: string
  created_at: string
  quotes: { total: number; product_requests: { product_name: string } | null } | null
}

interface WalletData {
  available_balance: number
  blocked_balance: number
}

const QUICK_ACTIONS = [
  { label: 'Soumettre',   icon: Plus,        path: '/submit',    bg: 'bg-[#FFF0EB]', color: 'text-primary' },
  { label: 'Commandes',   icon: Package,     path: '/orders',    bg: 'bg-[#EBF3FF]', color: 'text-[#2563EB]' },
  { label: 'Expéditions', icon: Ship,        path: '/shipments', bg: 'bg-[#FFFBEB]', color: 'text-[#D97706]' },
  { label: 'Support',     icon: HelpCircle,  path: '/support',   bg: 'bg-[#F0FDF4]', color: 'text-[#16A34A]' },
]

export function DashboardPage() {
  const { profile, user } = useAuth()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('wallets')
        .select('available_balance, blocked_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('orders')
        .select('id, tracking_code, status, created_at, quotes(total, product_requests(product_name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4),
    ]).then(([walletRes, ordersRes]) => {
      if (walletRes.data) setWallet(walletRes.data)
      if (ordersRes.data) setOrders(ordersRes.data as unknown as DashboardOrder[])
      setLoading(false)
    })
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0] || 'Client'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const balance = wallet?.available_balance ?? 0
  const accountId = user?.id
    ? `${user.id.slice(0, 4).toUpperCase()} ${user.id.slice(4, 8).toUpperCase()}`
    : '— — — —'

  return (
    <div className="min-h-full bg-background px-4 pt-5 pb-8 space-y-5">

      {/* ── Greeting row ── */}
      <div className="flex items-center justify-between stagger-item">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-primary/20">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground font-medium leading-none mb-0.5">Bonjour,</p>
            <h1 className="text-lg font-bold text-foreground leading-none">{firstName}</h1>
          </div>
        </div>
        <Link to="/wallet">
          <div className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 hover:bg-muted transition-all duration-150">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
            <span className="text-xs font-semibold text-muted-foreground">Portefeuille</span>
          </div>
        </Link>
      </div>

      {/* ── Wallet Card (FamillyBill spec) ── */}
      <div className="stagger-item" style={{ animationDelay: '50ms' }}>
        <div className="wallet-card p-5 text-white">

          {/* Top: icon + label | overlapping circles */}
          <div className="relative z-10 flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Layers className="h-4.5 w-4.5 text-white" strokeWidth={1.8} />
              </div>
              <span className="text-sm font-semibold text-white/90">Portefeuille HTG</span>
            </div>
            {/* Mastercard-style circles */}
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-primary opacity-90" />
              <div className="h-8 w-8 rounded-full -ml-3.5 opacity-80" style={{ background: '#FF9B4E' }} />
            </div>
          </div>

          {/* Balance */}
          <div className="relative z-10 mb-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-1.5">
              Solde disponible
            </p>
            {loading ? (
              <Skeleton className="h-10 w-44 bg-white/15 rounded-xl" />
            ) : (
              <p className="text-[2rem] font-bold tracking-tight leading-none font-mono">
                {balanceVisible ? `${balance.toLocaleString('fr-HT')} HTG` : '• • • • • •'}
              </p>
            )}
          </div>

          {/* ID + eye + HTG */}
          <div className="relative z-10 flex items-end justify-between mb-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-0.5">
                ID Compte
              </p>
              <p className="text-sm font-mono font-semibold text-white/70 tracking-widest">
                {accountId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBalanceVisible(v => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-150"
                aria-label="Afficher le solde"
              >
                {balanceVisible
                  ? <Eye className="h-3.5 w-3.5 text-white/60" strokeWidth={1.8} />
                  : <EyeOff className="h-3.5 w-3.5 text-white/60" strokeWidth={1.8} />}
              </button>
              <div className="rounded-xl bg-white/15 px-3 py-1.5">
                <span className="text-xs font-bold text-white tracking-widest">HTG</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative z-10 h-px bg-white/10 mb-4" />

          {/* Action buttons at bottom of card */}
          <div className="relative z-10 flex gap-3">
            <Link to="/wallet" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-primary h-10 text-xs font-bold hover:bg-white/95 transition-all duration-150 pressable">
                <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
                Recharger
              </button>
            </Link>
            <Link to="/orders" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-white h-10 text-xs font-semibold hover:bg-white/20 transition-all duration-150 pressable">
                <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
                Historique
              </button>
            </Link>
          </div>

        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="stagger-item" style={{ animationDelay: '100ms' }}>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.path} to={action.path}>
                <div className="card-flat flex flex-col items-center gap-2 p-3 hover:shadow-md transition-all duration-150 pressable">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', action.bg)}>
                    <Icon className={cn('h-4.5 w-4.5', action.color)} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground text-center leading-tight">
                    {action.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Submit CTA ── */}
      <div className="stagger-item" style={{ animationDelay: '150ms' }}>
        <Link to="/submit">
          <div className="card-flat flex items-center justify-between p-4 hover:shadow-md transition-all duration-150 pressable">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Plus className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Nouveau produit ?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Devis reçu en moins de 24h</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.8} />
          </div>
        </Link>
      </div>

      {/* ── Recent Orders ── */}
      <div className="stagger-item" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Commandes récentes</h2>
          <Link to="/orders" className="flex items-center gap-0.5 text-xs font-semibold text-primary">
            Voir tout <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-[20px]" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="card-flat flex flex-col items-center py-10 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
              <Package className="h-6 w-6 text-muted-foreground" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-foreground">Aucune commande</p>
            <p className="text-xs text-muted-foreground mt-1">Soumettez votre premier produit</p>
            <Button asChild size="sm" className="mt-4 rounded-xl h-9">
              <Link to="/submit">
                <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                Soumettre
              </Link>
            </Button>
          </div>
        ) : (
          <div className="card-flat overflow-hidden divide-y divide-border/70">
            {orders.map((order) => (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-all duration-150">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Package className="h-4 w-4 text-primary" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {order.quotes?.product_requests?.product_name || 'Produit'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{order.tracking_code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{(order.quotes?.total ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">HTG</p>
                    <StatusBadge status={order.status} className="mt-1 text-[10px] py-0 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
