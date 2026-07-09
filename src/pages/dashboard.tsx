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
  const [loading, setLoading] = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [expandedTestimonial, setExpandedTestimonial] = useState<number | null>(null)
  const autoplay = useRef(Autoplay({ delay: 4000, stopOnInteraction: true }))

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('wallets').select('available_balance, blocked_balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('orders').select('id, tracking_code, status, created_at, quotes(total, product_requests(product_name))').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
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

      {/* ── Wallet Card ── */}
      <div className="px-4 pb-5">
        <div
          className="rounded-3xl text-white relative overflow-hidden shadow-[0_10px_40px_rgba(0,195,220,0.40)]"
          style={{
            background: 'linear-gradient(135deg, #00E5F5 0%, #00C3DC 40%, #0099B8 100%)',
            aspectRatio: '1.586',
          }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full border border-white/12" />
          <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full border border-white/8" />

          <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/25 backdrop-blur-sm">
                  <span className="text-[12px] font-black text-white">K</span>
                </div>
                <span className="font-bold text-white text-sm tracking-wide">KONVWA</span>
              </div>
              <svg width="28" height="24" viewBox="0 0 30 26" fill="none">
                <circle cx="4" cy="13" r="2.5" fill="white" opacity="0.9"/>
                <path d="M10 7C13.3 9.5 13.3 16.5 10 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
                <path d="M16 3.5C21.5 7.5 21.5 18.5 16 22.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
                <path d="M22 0.5C29.5 5.5 29.5 20.5 22 25.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.3"/>
              </svg>
            </div>

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
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/55 font-semibold mb-0.5">{t('dash.balance')}</p>
                {loading ? (
                  <Skeleton className="h-7 w-36 bg-white/15 rounded-lg" />
                ) : (
                  <p className="text-[1.6rem] font-bold tracking-tight leading-none">
                    {balanceVisible ? `${balance.toLocaleString('fr-HT')} HTG` : '• • • • • •'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-[8px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-0.5">Titulaire</p>
                <p className="text-[13px] font-semibold text-white/85 tracking-wide uppercase leading-tight">
                  {profile?.full_name || firstName}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBalanceVisible(v => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  {balanceVisible ? <Eye className="h-3 w-3 text-white/60" /> : <EyeOff className="h-3 w-3 text-white/60" />}
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

      {/* ── Action buttons ── */}
      <div className="px-4 pb-5">
        <div className="flex gap-3">
          <Link to="/wallet" className="flex-1">
            <button
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <ArrowDownLeft className="h-4 w-4" />
              {t('dash.topup')}
            </button>
          </Link>
          <Link to="/orders" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-white text-foreground py-3.5 text-sm font-semibold hover:bg-muted/30 transition-colors shadow-sm">
              <TrendingUp className="h-4 w-4" />
              {t('dash.history')}
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
