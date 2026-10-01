import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Plus, Eye, EyeOff, ArrowDownLeft, TrendingUp, ChevronRight, Package,
  Send, Ship, ShoppingBag, HelpCircle, Star,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import Autoplay from 'embla-carousel-autoplay'
import { IllustrationDeliveryHero } from '@/components/shared/illustrations'

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

interface TrendingProduct {
  id: string
  name: string
  price_htg: number
  moq: number
  unit: string
  category: string | null
  supplier_name: string | null
  images: string[]
  stock_available: boolean
  featured: boolean
  delivery_days_min: number | null
  delivery_days_max: number | null
}

const QUICK_ACTION_KEYS = [
  { labelKey: 'dash.q_submit',   Icon: Send,       path: '/submit' },
  { labelKey: 'dash.q_orders',   Icon: ShoppingBag, path: '/orders' },
  { labelKey: 'dash.q_shipping', Icon: Ship,        path: '/shipments' },
  { labelKey: 'dash.q_support',  Icon: HelpCircle,  path: '/support' },
]


const TESTIMONIALS = [
  {
    id: 1,
    initials: 'MP',
    name: 'Marie Pierre',
    location: 'Port-au-Prince',
    rating: 5,
    short: 'Excellent service, livraison parfaite !',
    text: 'Excellent service ! Ma commande est arrivée en parfait état depuis la Chine. Le suivi en temps réel est vraiment pratique.',
    color: 'bg-primary',
  },
  {
    id: 2,
    initials: 'JB',
    name: 'Jean Baptiste',
    location: 'Cap-Haïtien',
    rating: 5,
    short: "Prix imbattables, équipements en parfait état.",
    text: "KONVWA m'a permis d'importer des équipements pour mon atelier à un prix imbattable. Livraison rapide, service client au top !",
    color: 'bg-blue-500',
  },
  {
    id: 3,
    initials: 'SC',
    name: 'Sophie Charles',
    location: 'Les Cayes',
    rating: 4,
    short: 'Simple, transparent, MonCash accepté.',
    text: "Je recommande vivement. Le processus est simple et les prix transparents. MonCash accepté, c'est parfait pour Haïti.",
    color: 'bg-emerald-500',
  },
  {
    id: 4,
    initials: 'PR',
    name: 'Paul Richard',
    location: 'Pétion-Ville',
    rating: 5,
    short: "Commande reçue en 3 semaines, impeccable !",
    text: "Incroyable ! J'ai commandé depuis Alibaba et reçu mes produits en moins de 3 semaines. Packaging soigné et prix honnêtes.",
    color: 'bg-purple-500',
  },
]

export function DashboardPage() {
  const { profile, user } = useAuth()
  const { t } = useI18n()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [expandedTestimonial, setExpandedTestimonial] = useState<number | null>(null)
  const autoplay = useRef(Autoplay({ delay: 4000, stopOnInteraction: true }))
  const autoplayProducts = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }))

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('wallets').select('available_balance, blocked_balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('orders').select('id, tracking_code, status, created_at, quotes(total, product_requests(product_name))').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('products').select('id, name, price_htg, moq, unit, category, supplier_name, images, stock_available, featured, delivery_days_min, delivery_days_max').eq('active', true).order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(8),
    ]).then(([walletRes, ordersRes, productsRes]) => {
      if (walletRes.data) setWallet(walletRes.data)
      if (ordersRes.data) setOrders(ordersRes.data as unknown as DashboardOrder[])
      if (productsRes.data) setTrendingProducts(productsRes.data as TrendingProduct[])
      setLoading(false)
    })
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0] || 'Client'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const balance = wallet?.available_balance ?? 0

  return (
    <div className="min-h-full bg-[#F4F5F7] w-full">

      {/* ── Greeting ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-black/8 shadow-sm">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{t('dash.greeting')},</p>
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">{firstName} 👋</h1>
          </div>
        </div>
        <Link to="/submit">
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('common.new')}
          </button>
        </Link>
      </div>

      {/* ── Wallet Cards (compact 2-col) ── */}
      <div className="px-4 pb-4">
        <div className="flex gap-3">
          {/* Solde principal */}
          <Link to="/wallet" className="flex-1">
            <div className="rounded-2xl bg-[#F0F1F5] p-4 relative overflow-hidden">
              {/* Amount row */}
              <div className="flex items-baseline gap-1 mb-1">
                {loading ? (
                  <Skeleton className="h-8 w-32 rounded-lg" />
                ) : (
                  <>
                    <span className="text-[1.75rem] font-extrabold tracking-tight text-foreground leading-none">
                      {balanceVisible
                        ? Math.floor(balance).toLocaleString('fr-HT')
                        : '•••••'}
                    </span>
                    {balanceVisible && (
                      <span className="text-sm font-semibold text-muted-foreground">
                        .{String(Math.round((balance % 1) * 100)).padStart(2, '0')}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); setBalanceVisible(v => !v) }}
                      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {balanceVisible
                        ? <Eye className="h-4 w-4" />
                        : <EyeOff className="h-4 w-4" />}
                    </button>
                  </>
                )}
              </div>
              {/* Label row */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Solde en <span className="font-bold text-foreground">HTG</span>
                </span>
                <span className="rounded-full bg-[#F05A28] px-2.5 py-0.5 text-[10px] font-bold text-white">
                  KONVWA
                </span>
              </div>
              {/* Flag */}
              <div className="absolute top-4 right-4 h-9 w-9 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                <img
                  src="https://flagcdn.com/w80/ht.png"
                  alt="Haïti"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </Link>

          {/* En attente */}
          <Link to="/wallet" className="w-[38%]">
            <div className="rounded-2xl bg-[#F0F1F5] p-4 h-full flex flex-col justify-between">
              <div className="flex items-baseline gap-0.5 mb-1">
                {loading ? (
                  <Skeleton className="h-8 w-16 rounded-lg" />
                ) : (
                  <>
                    <span className="text-[1.75rem] font-extrabold tracking-tight text-amber-500 leading-none">
                      {balanceVisible
                        ? Math.floor(wallet?.blocked_balance ?? 0).toLocaleString('fr-HT')
                        : '•••'}
                    </span>
                    {balanceVisible && (
                      <span className="text-sm font-semibold text-amber-400">
                        .{String(Math.round(((wallet?.blocked_balance ?? 0) % 1) * 100)).padStart(2, '0')}
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="text-sm text-muted-foreground">En attente</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="px-4 pb-5">
        <div className="flex gap-3">
          <Link to="/wallet" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white bg-[#0A1628] hover:bg-[#0d1e38] transition-colors shadow-sm">
              <ArrowDownLeft className="h-4 w-4" />
              Dépôt
            </button>
          </Link>
          <Link to="/orders" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-[#0A1628] border-2 border-[#0A1628] bg-transparent hover:bg-[#0A1628]/5 transition-colors">
              <TrendingUp className="h-4 w-4" />
              Historique
            </button>
          </Link>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTION_KEYS.map((action) => {
            const { Icon } = action
            return (
              <Link key={action.path} to={action.path} className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm group-hover:border-primary/20 group-hover:shadow-md transition-all">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.6} />
                </div>
                <span className="text-xs font-semibold text-foreground text-center leading-tight">
                  {t(action.labelKey)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Submit CTA ── */}
      <div className="px-4 pb-5">
        <Link to="/submit">
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary/8 to-primary/4 border border-primary/15 p-4 shadow-sm hover:border-primary/25 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{t('dash.import')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('dash.quote_time')}</p>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Trending Products Carousel ── */}
      <div className="pb-5">
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="text-base font-bold text-foreground">Produits tendance</h2>
          <Link to="/products" className="text-xs font-semibold text-primary flex items-center gap-0.5">
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 px-4">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="aspect-square w-full rounded-2xl" />
          </div>
        ) : trendingProducts.length === 0 ? null : (
          <Carousel
            opts={{ loop: true, align: 'start', slidesToScroll: 2 }}
            plugins={[autoplayProducts.current]}
            className="w-full px-4"
          >
            <CarouselContent className="-ml-2">
              {trendingProducts.map((product) => (
                <CarouselItem key={product.id} className="pl-2 basis-1/2">
                  <Link
                    to={`/products/${product.id}`}
                    className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform duration-100 h-full"
                  >
                    {/* Image */}
                    <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center gap-1.5 w-full h-full"
                          style={{ background: 'linear-gradient(140deg, #F4F5F7 0%, #EEF0F3 100%)' }}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm">
                            <Package className="h-5 w-5 text-primary/40" strokeWidth={1.5} />
                          </div>
                          {product.category && (
                            <span className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-2 text-center leading-tight">
                              {product.category}
                            </span>
                          )}
                        </div>
                      )}
                      {product.featured && (
                        <span className="absolute top-2 left-2 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          Vedette
                        </span>
                      )}
                      {!product.stock_available && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-destructive bg-white/90 px-2 py-1 rounded-full border border-destructive/20">
                            Rupture
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-2.5 flex flex-col gap-1 flex-1">
                      <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">{product.name}</p>
                      {product.supplier_name && (
                        <p className="text-[10px] text-muted-foreground truncate">{product.supplier_name}</p>
                      )}
                      <div className="mt-auto pt-1.5 flex items-end justify-between gap-1">
                        <div>
                          <p className="text-sm font-black text-primary leading-none">
                            {product.price_htg.toLocaleString('fr-HT')}
                            <span className="text-[10px] font-semibold text-muted-foreground"> HTG</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Min. {product.moq} {product.unit}
                          </p>
                        </div>
                        {product.delivery_days_min && (
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {product.delivery_days_min}–{product.delivery_days_max ?? product.delivery_days_min}j
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}
      </div>

      {/* ── Testimonials Carousel — 2 cards per view, equal height, click-to-expand ── */}
      <div className="pb-5 px-4">
        <Carousel
          opts={{ loop: true, align: 'start', slidesToScroll: 2 }}
          plugins={[autoplay.current]}
          className="w-full"
        >
          <CarouselContent className="-ml-2 items-stretch">
            {TESTIMONIALS.map((testimonial) => {
              const isOpen = expandedTestimonial === testimonial.id
              return (
                <CarouselItem key={testimonial.id} className="pl-2 basis-1/2 flex">
                  <button
                    className="w-full text-left flex flex-col flex-1"
                    onClick={() => setExpandedTestimonial(isOpen ? null : testimonial.id)}
                  >
                    <div className={cn(
                      'rounded-2xl bg-white border shadow-sm p-3 flex flex-col gap-2 transition-all duration-200 flex-1',
                      isOpen ? 'border-primary/20 shadow-md' : 'border-gray-100'
                    )}>
                      {/* Author */}
                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0', testimonial.color)}>
                          {testimonial.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate leading-none">{testimonial.name}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{testimonial.location}</p>
                        </div>
                      </div>
                      {/* Stars */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn('h-2.5 w-2.5', i < testimonial.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20')} />
                        ))}
                      </div>
                      {/* Text */}
                      <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                        {isOpen ? `"${testimonial.text}"` : testimonial.short}
                      </p>
                      {/* Tap hint pinned to bottom */}
                      {!isOpen && (
                        <p className="text-[9px] text-primary font-semibold">Appuyer pour lire</p>
                      )}
                    </div>
                  </button>
                </CarouselItem>
              )
            })}
          </CarouselContent>
        </Carousel>
      </div>

      {/* ── Recent Orders ── */}
      <div className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">{t('dash.recent')}</h2>
          <Link to="/orders" className="text-xs font-semibold text-primary flex items-center gap-0.5">
            {t('common.see_all')} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white pt-6 pb-8 px-6 text-center shadow-sm">
            <IllustrationDeliveryHero className="w-48 h-auto mx-auto mb-2 opacity-80" />
            <p className="text-sm font-bold text-foreground/70">{t('dash.no_orders')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">{t('dash.submit_first')}</p>
            <Link
              to="/submit"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('common.submit')}
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
            {orders.map((order, idx) => (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors',
                  idx < orders.length - 1 && 'border-b border-border/50'
                )}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 shrink-0">
                    <Package className="h-5 w-5 text-primary" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground">
                      {order.quotes?.product_requests?.product_name || 'Produit'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{order.tracking_code}</p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <StatusBadge status={order.status} className="text-[10px]" />
                    <p className="text-sm font-bold text-foreground">{(order.quotes?.total ?? 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">HTG</span></p>
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
