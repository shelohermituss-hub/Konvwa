import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Plus, Package, Ship, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, HelpCircle, ChevronRight } from 'lucide-react'
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
  { label: 'Soumettre', icon: Plus, path: '/submit', color: 'bg-primary/10 text-primary' },
  { label: 'Commandes', icon: Package, path: '/orders', color: 'bg-accent/10 text-accent' },
  { label: 'Expéditions', icon: Ship, path: '/shipments', color: 'bg-warning/10 text-warning' },
  { label: 'Support', icon: HelpCircle, path: '/support', color: 'bg-secondary text-secondary-foreground' },
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
  const balance = wallet?.available_balance ?? 0
  const totalBalance = (wallet?.available_balance ?? 0) + (wallet?.blocked_balance ?? 0)

  return (
    <div className="min-h-full bg-background">
      {/* Greeting */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-sm text-muted-foreground">Bonjour,</p>
        <h1 className="text-2xl font-bold tracking-tight">{firstName}</h1>
      </div>

      {/* Wallet Balance Card */}
      <div className="px-4 pb-5">
        <div className="wallet-card-gradient rounded-2xl p-5 text-white glow-wallet relative overflow-hidden">
          {/* Reflection overlay */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }} />
          {/* Decorative blob */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-2xl opacity-30 pointer-events-none animate-pulse-slow"
            style={{ background: 'radial-gradient(circle, rgba(240,90,40,0.7) 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-white/70">Solde disponible</p>
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                className="rounded-full p-1 hover:bg-white/10 transition-colors"
              >
                {balanceVisible ? <Eye className="h-4 w-4 text-white/70" /> : <EyeOff className="h-4 w-4 text-white/70" />}
              </button>
            </div>
            {loading ? (
              <Skeleton className="h-10 w-40 bg-white/20 mt-1" />
            ) : (
              <p className="text-3xl font-bold tracking-tight mt-1">
                {balanceVisible ? `${balance.toLocaleString()} HTG` : '••••••'}
              </p>
            )}
            <p className="text-xs text-white/50 mt-1">
              Total: {balanceVisible ? `${totalBalance.toLocaleString()} HTG` : '••••••'}
            </p>

            <div className="flex gap-3 mt-5">
              <Link to="/wallet" className="flex-1">
                <button className="w-full flex items-center justify-center gap-2 rounded-full bg-white text-primary px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-white/95 transition-colors">
                  <ArrowDownLeft className="h-4 w-4" />
                  Recharger
                </button>
              </Link>
              <Link to="/orders" className="flex-1">
                <button className="w-full flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/20 transition-colors">
                  <ArrowUpRight className="h-4 w-4" />
                  Historique
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.path} to={action.path} className="flex flex-col items-center gap-2">
                <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm', action.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-foreground text-center leading-tight">{action.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Submit CTA */}
      <div className="px-4 pb-5">
        <Link to="/submit">
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Nouveau produit ?</p>
                <p className="text-xs text-muted-foreground">Devis reçu en moins de 24h</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="px-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">Commandes récentes</h2>
          <Link to="/orders" className="text-xs font-medium text-primary flex items-center gap-1">
            Voir tout <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Aucune commande</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Soumettez votre premier produit</p>
            <Button asChild size="sm" className="mt-4 rounded-full">
              <Link to="/submit">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Soumettre
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/20 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {order.quotes?.product_requests?.product_name || 'Produit'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{order.tracking_code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{(order.quotes?.total ?? 0).toLocaleString()}</p>
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
