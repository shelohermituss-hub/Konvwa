import { useEffect, useRef, useState, useCallback } from 'react'
import { haptics } from '@/lib/haptic'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Plus, Eye, EyeOff, ArrowDownLeft, TrendingUp,
  Send, Ship, ShoppingBag, HelpCircle, Search, X, Package,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface WalletData {
  available_balance: number
  blocked_balance: number
}

interface Product {
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

const PAGE_SIZE = 12

const QUICK_ACTIONS = [
  { label: 'Soumettre', Icon: Send,        path: '/submit' },
  { label: 'Commandes', Icon: ShoppingBag, path: '/orders' },
  { label: 'Expédition', Icon: Ship,       path: '/shipments' },
  { label: 'Support',    Icon: HelpCircle, path: '/support' },
]

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform duration-100"
    >
      <div className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden relative">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-1.5 w-full h-full"
            style={{ background: 'linear-gradient(140deg, #F4F5F7 0%, #EEF0F3 100%)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm">
              <Package className="h-5 w-5 text-primary/40" strokeWidth={1.5} />
            </div>
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
      <div className="p-2.5 flex flex-col gap-1">
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
  )
}

export function DashboardPage() {
  const { profile, user } = useAuth()
  const { t } = useI18n()

  const [wallet, setWallet]           = useState<WalletData | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)

  const [products, setProducts]       = useState<Product[]>([])
  const [page, setPage]               = useState(0)
  const [hasMore, setHasMore]         = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch]           = useState('')
  const [query, setQuery]             = useState('')

  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = useCallback(() => haptics.tap(), [])

  // ── Load wallet ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase
      .from('wallets')
      .select('available_balance, blocked_balance')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setWallet(data)
        setWalletLoading(false)
      })
  }, [user])

  // ── Debounce search → query ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setQuery(search.trim()), 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [search])

  // ── Reset + reload when query changes ───────────────────────────────────────
  useEffect(() => {
    setProducts([])
    setPage(0)
    setHasMore(true)
    setLoadingInitial(true)
  }, [query])

  // ── Fetch a page of products ─────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageIndex: number) => {
    let q = supabase
      .from('products')
      .select('id, name, price_htg, moq, unit, category, supplier_name, images, stock_available, featured, delivery_days_min, delivery_days_max')
      .eq('active', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1)

    if (query) {
      q = q.ilike('name', `%${query}%`)
    }

    const { data, error } = await q
    if (error || !data) return

    setProducts(prev => pageIndex === 0 ? (data as Product[]) : [...prev, ...(data as Product[])])
    setHasMore(data.length === PAGE_SIZE)
    setLoadingInitial(false)
    setLoadingMore(false)
  }, [query])

  // ── Initial load (page 0) ────────────────────────────────────────────────────
  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  // ── Infinite scroll via IntersectionObserver ─────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingInitial) {
          setLoadingMore(true)
          const nextPage = page + 1
          setPage(nextPage)
          fetchPage(nextPage)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadingInitial, page, fetchPage])

  const firstName = profile?.full_name?.split(' ')[0] || 'Client'
  const initials  = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const balance = wallet?.available_balance ?? 0

  // Split products into two offset columns
  const leftCol  = products.filter((_, i) => i % 2 === 0)
  const rightCol = products.filter((_, i) => i % 2 === 1)

  return (
    <div className="min-h-full bg-[#F4F5F7] w-full flex flex-col">

      {/* ═══════════════════════════════════════════════════════════════════════
          STICKY HEADER
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-10 bg-[#F4F5F7] pt-5 pb-3 px-4 space-y-3 border-b border-gray-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">

        {/* ── Greeting row ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-black/8 shadow-sm shrink-0">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-slate-100 text-slate-700 text-sm font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium leading-none mb-0.5">{t('dash.greeting')}</p>
              <h1 className="text-base font-bold tracking-tight text-foreground leading-none">{firstName} 👋</h1>
            </div>
          </div>

          {/* Balance compact */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBalanceVisible(v => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            {walletLoading ? (
              <Skeleton className="h-6 w-20 rounded-lg" />
            ) : (
              <div className="text-right">
                <p className="text-base font-extrabold tracking-tight text-foreground leading-none">
                  {balanceVisible ? Math.floor(balance).toLocaleString('fr-HT') : '•••••'}
                  <span className="text-[10px] font-semibold text-muted-foreground ml-0.5">HTG</span>
                </p>
                {wallet && wallet.blocked_balance > 0 && balanceVisible && (
                  <p className="text-[10px] text-amber-500 font-semibold leading-none mt-0.5">
                    {wallet.blocked_balance.toLocaleString('fr-HT')} en attente
                  </p>
                )}
              </div>
            )}
            <Link to="/submit" onClick={handleTap}>
              <button
                className="flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm pressable"
                style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              >
                <Plus className="h-3 w-3" />
                {t('common.new')}
              </button>
            </Link>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const { Icon } = action
            return (
              <Link key={action.path} to={action.path} onClick={handleTap} className="flex flex-col items-center gap-1.5 group pressable">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm group-hover:border-primary/20 group-hover:shadow-md transition-all">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.6} />
                </div>
                <span className="text-[10px] font-semibold text-foreground text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* ── Action bar ── */}
        <div className="flex gap-2">
          <Link to="/wallet" className="flex-1">
            <button onClick={handleTap} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white bg-[#0A1628] hover:bg-[#0d1e38] transition-colors shadow-sm pressable">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Dépôt
            </button>
          </Link>
          <Link to="/orders" className="flex-1">
            <button onClick={handleTap} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-[#0A1628] border-2 border-[#0A1628] bg-transparent hover:bg-[#0A1628]/5 transition-colors pressable">
              <TrendingUp className="h-3.5 w-3.5" />
              Historique
            </button>
          </Link>
        </div>

        {/* ── Search bar ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SCROLLABLE PRODUCTS GRID
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 px-4 pt-4 pb-28">

        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">
            {query ? `Résultats pour "${query}"` : 'Catalogue'}
          </h2>
          {!query && (
            <Link to="/products" className="text-xs font-semibold text-primary">
              Voir tout
            </Link>
          )}
        </div>

        {/* Initial loading skeletons */}
        {loadingInitial ? (
          <div className="flex gap-3">
            <div className="flex-1 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="w-full aspect-[4/3] rounded-2xl" />)}
            </div>
            <div className="flex-1 space-y-3 mt-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="w-full aspect-[4/3] rounded-2xl" />)}
            </div>
          </div>
        ) : products.length === 0 ? (
          /* Empty state */
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm">
              <Search className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-bold text-foreground/70">
              {query ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
            </p>
            {query && (
              <button onClick={() => setSearch('')} className="text-xs font-semibold text-primary">
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          /* ── Staggered 2-column grid ── */
          <div className="flex gap-3">
            {/* Left column */}
            <div className="flex-1 flex flex-col gap-3">
              {leftCol.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
            {/* Right column — offset by mt-6 for stagger effect */}
            <div className="flex-1 flex flex-col gap-3 mt-6">
              {rightCol.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {/* Load more spinner */}
        {loadingMore && (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* End of list */}
        {!hasMore && products.length > 0 && (
          <p className="text-center text-[11px] text-muted-foreground/50 py-6 font-medium">
            — Fin du catalogue —
          </p>
        )}
      </div>
    </div>
  )
}
