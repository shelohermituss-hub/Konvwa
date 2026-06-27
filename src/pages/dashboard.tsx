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
  const cardNumber = user?.id
    ? `${user.id.slice(0, 4).toUpperCase()}  ${user.id.slice(9, 13).toUpperCase()}  ${user.id.slice(14, 18).toUpperCase()}  ${user.id.slice(19, 23).toUpperCase()}`
    : '——  ——  ——  ——'

  return (
    <div className="min-h-full bg-background">

      {/* Greeting row */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 stagger-item">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-black/8 shadow-sm">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Bonjour,</p>
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">{firstName}</h1>
          </div>
        </div>
        <Link to="/wallet">
          <div className="flex items-center gap-1.5 rounded-full bg-black/5 border border-black/8 px-3 py-1.5 hover:bg-black/8 transition-colors">
            <Wallet className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">Portefeuille</span>
          </div>
        </Link>
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
              {/* Contactless arcs */}
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

            {/* Row 4: holder + card number + HTG badge */}
            <div className="flex items-end justify-between pt-1">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-0.5">
                  Titulaire
                </p>
                <p className="text-sm font-semibold text-white/80 tracking-wide uppercase">
                  {profile?.full_name || firstName}
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
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                <Plus className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Nouveau produit ?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Devis reçu en moins de 24h</p>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5">
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="px-5 pb-8 stagger-item" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Commandes récentes</h2>
          <Link to="/orders" className="text-xs font-semibold text-foreground flex items-center gap-0.5">
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
                <div className="flex items-center gap-3 rounded-2xl bg-white border border-border/60 p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all pressable">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 shrink-0">
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
