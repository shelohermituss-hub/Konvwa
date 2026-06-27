import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { Plus, Package, Eye, EyeOff, ArrowDownLeft, TrendingUp, ChevronRight, Wallet } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

import IconSoumettre    from '@/assets/icons/soumettre.png'
import IconCommandes    from '@/assets/icons/commandes.png'
import IconExpeditions  from '@/assets/icons/expeditions.png'
import IconSupport      from '@/assets/icons/support.png'
import IconBoite        from '@/assets/icons/boite.png'

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
  { label: 'Soumettre',   icon: IconSoumettre,   path: '/submit' },
  { label: 'Commandes',   icon: IconCommandes,   path: '/orders' },
  { label: 'Expéditions', icon: IconExpeditions, path: '/shipments' },
  { label: 'Support',     icon: IconSupport,     path: '/support' },
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
  const accountId = user?.id
    ? `${user.id.slice(0, 4).toUpperCase()} ${user.id.slice(4, 8).toUpperCase()}`
    : '— — — —'

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

      {/* ── Wallet Card — FamillyBill style ── */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '60ms' }}>
        <div
          className="rounded-3xl p-5 text-white relative overflow-hidden shadow-[0_8px_40px_rgba(10,22,40,0.28)]"
          style={{ background: 'linear-gradient(135deg, #1E5221 0%, #2E7D32 45%, #4CAF50 100%)' }}
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute top-10 -right-20 h-36 w-36 rounded-full bg-white/[0.03]" />

          <div className="relative z-10 flex flex-col gap-4">

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
                <div className="h-9 w-9 rounded-full bg-primary" style={{ opacity: 0.95 }} />
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
                  {balanceVisible ? `${balance.toLocaleString('fr-HT')} HTG` : '• • • • • •'}
                </p>
              )}
            </div>

            {/* ID + eye + HTG */}
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

      {/* Action buttons below the card — same layout as wallet page */}
      <div className="px-4 pb-5 stagger-item" style={{ animationDelay: '90ms' }}>
        <div className="flex gap-3">
          <Link to="/wallet" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-white py-3.5 text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors pressable">
              <ArrowDownLeft className="h-4 w-4" />
              Recharger
            </button>
          </Link>
          <Link to="/orders" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-white text-foreground py-3.5 text-sm font-semibold hover:bg-muted/30 transition-colors pressable shadow-sm">
              <TrendingUp className="h-4 w-4" />
              Historique
            </button>
          </Link>
        </div>
      </div>

      {/* Quick Actions — PNG icons */}
      <div className="px-5 pb-5 stagger-item" style={{ animationDelay: '120ms' }}>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.path} to={action.path} className="flex flex-col items-center gap-2 group">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-border/60 shadow-sm action-icon">
                <img src={action.icon} alt={action.label} className="h-8 w-8 object-contain" />
              </div>
              <span className="text-xs font-semibold text-foreground text-center leading-tight">
                {action.label}
              </span>
            </Link>
          ))}
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
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8 shrink-0">
                    <img src={IconBoite} alt="" className="h-7 w-7 object-contain" />
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
