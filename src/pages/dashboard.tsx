import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { Plus, Package, Ship, Eye, EyeOff, ArrowDownLeft, HelpCircle, ChevronRight, Wallet, TrendingUp } from 'lucide-react'
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
  {
    label: 'Soumettre',
    icon: Plus,
    path: '/submit',
    bg: 'bg-[#FFF0EB]',
    iconBg: 'bg-primary',
    iconColor: 'text-white',
  },
  {
    label: 'Commandes',
    icon: Package,
    path: '/orders',
    bg: 'bg-[#EBF3FF]',
    iconBg: 'bg-[#2563EB]',
    iconColor: 'text-white',
  },
  {
    label: 'Expéditions',
    icon: Ship,
    path: '/shipments',
    bg: 'bg-[#FFFBEB]',
    iconBg: 'bg-[#F59E0B]',
    iconColor: 'text-white',
  },
  {
    label: 'Support',
    icon: HelpCircle,
    path: '/support',
    bg: 'bg-[#F0FDF4]',
    iconBg: 'bg-[#16A34A]',
    iconColor: 'text-white',
  },
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
      supabase
        .from('wallets')
        .select('available_balance, blocked_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('orders')
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
  const totalBalance = (wallet?.available_balance ?? 0) + (wallet?.blocked_balance ?? 0)

  return (
    <div className="min-h-full bg-background">

      {/* Greeting row */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 stagger-item">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-primary/20 shadow-sm">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Bonjour,</p>
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">{firstName}</h1>
          </div>
        </div>
        <Link to="/wallet">
          <div className="flex items-center gap-1.5 rounded-full bg-primary/8 border border-primary/15 px-3 py-1.5 hover:bg-primary/12 transition-colors">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Portefeuille</span>
          </div>
        </Link>
      </div>

      {/* Wallet Balance Card */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '60ms' }}>
        <div className="wallet-card-credit rounded-3xl p-5 text-white shadow-[0_8px_40px_rgba(10,22,40,0.35)] relative">
          <div className="relative z-10">

            {/* Card top row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/50 font-medium">Solde disponible</p>
              </div>
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Afficher/masquer le solde"
              >
                {balanceVisible
                  ? <Eye className="h-4 w-4 text-white/70" />
                  : <EyeOff className="h-4 w-4 text-white/70" />}
              </button>
            </div>

            {/* Balance amount */}
            {loading ? (
              <Skeleton className="h-11 w-48 bg-white/20 mb-5" />
            ) : (
              <p className="text-4xl font-bold tracking-tight mb-1">
                {balanceVisible ? `${balance.toLocaleString('fr-HT')}` : '• • • • • •'}
              </p>
            )}
            <p className="text-sm font-medium text-white/60 mb-5">HTG</p>

            {/* Divider */}
            <div className="h-px bg-white/10 mb-4" />

            {/* Card bottom row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Total compte</p>
                <p className="text-sm font-semibold text-white/80">
                  {balanceVisible ? `${totalBalance.toLocaleString('fr-HT')} HTG` : '••••••'}
                </p>
              </div>

              <div className="flex gap-2">
                <Link to="/wallet">
                  <button className="flex items-center gap-1.5 rounded-full bg-white text-primary px-4 py-2 text-xs font-bold shadow-sm hover:bg-white/95 transition-colors pressable">
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Recharger
                  </button>
                </Link>
                <Link to="/orders">
                  <button className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 text-white px-4 py-2 text-xs font-semibold hover:bg-white/20 transition-colors pressable">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Historique
                  </button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 pb-5 stagger-item" style={{ animationDelay: '120ms' }}>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.path} to={action.path} className="flex flex-col items-center gap-2 group">
                <div className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm action-icon',
                  action.iconBg
                )}>
                  <Icon className={cn('h-6 w-6', action.iconColor)} strokeWidth={2} />
                </div>
                <span className="text-xs font-semibold text-foreground text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Submit CTA Banner */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '160ms' }}>
        <Link to="/submit">
          <div className="flex items-center justify-between rounded-2xl bg-white border border-border/60 p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all pressable">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Nouveau produit ?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Devis reçu en moins de 24h</p>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/8">
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="px-5 pb-8 stagger-item" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Commandes récentes</h2>
          <Link to="/orders" className="text-xs font-semibold text-primary flex items-center gap-0.5">
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center shadow-sm">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Aucune commande</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Soumettez votre premier produit</p>
            <Button asChild size="sm" className="mt-4 rounded-full">
              <Link to="/submit">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Soumettre
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((order) => (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <div className="flex items-center gap-3 rounded-2xl bg-white border border-border/60 p-4 shadow-sm hover:border-primary/25 hover:shadow-md transition-all pressable">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground">
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
