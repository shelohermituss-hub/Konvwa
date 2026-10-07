import { useEffect, useRef, useState, useCallback } from 'react'
import { ProductFeed } from '@/components/shared/product-feed'
import { haptics } from '@/lib/haptic'
import { Link, useNavigate } from 'react-router-dom'
import { AdBanners } from '@/components/shared/ad-banners'
import { SetupReminder } from '@/components/shared/setup-reminder'
import { ProductCard } from '@/components/shared/product-card'
import { CATALOG_CARD_SELECT, expandVariants, productPath, localizeProduct, resellerPriced, type CatalogProduct } from '@/lib/catalog'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Wallet, Eye, EyeOff, ArrowDownLeft, TrendingUp,
  Send, Ship, ShoppingBag, HelpCircle, Search, X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'

import { tr } from '@/lib/i18n'
import { currencyLabel, moneyAmount } from '@/lib/currency'

// Partner shops: the https links open the shop's app when it is installed (universal links), the website otherwise
const SHOPS = [
  { name: 'Alibaba', logo: '/brands/alibaba.png', href: 'https://www.alibaba.com' },
  { name: 'Shein', logo: '/brands/shein.png', href: 'https://www.shein.com' },
  { name: 'Amazon', logo: '/brands/amazon.png', href: 'https://www.amazon.com' },
  { name: 'Temu', logo: '/brands/temu.jpg', href: 'https://www.temu.com' },
]
interface WalletData {
  available_balance: number
  blocked_balance: number
}

const PAGE_SIZE = 12

const QUICK_ACTIONS = [
  { label: tr('Soumettre'), Icon: Send,        path: '/submit' },
  { label: tr('Commandes'), Icon: ShoppingBag, path: '/orders' },
  { label: tr('Expédition'), Icon: Ship,       path: '/shipments' },
  { label: tr('Support'),    Icon: HelpCircle, path: '/support' },
]

export function DashboardPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const isReseller = !!profile?.is_reseller
  const { t } = useI18n()

  const [wallet, setWallet]           = useState<WalletData | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [balanceVisible, setBalanceVisible] = useState(true)

  const [products, setProducts]       = useState<CatalogProduct[]>([])
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
      .select(CATALOG_CARD_SELECT)
      .eq('active', true)
      .eq('product_variants.active', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1)

    if (query) {
      q = q.ilike('name', `%${query}%`)
    }

    const { data, error } = await q
    if (error || !data) return

    const rows = (data as unknown as CatalogProduct[]).map(localizeProduct)
    setProducts(prev => pageIndex === 0 ? rows : [...prev, ...rows])
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

  const firstName = profile?.full_name?.split(' ')[0] || tr('Client')
  const initials  = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const balance = wallet?.available_balance ?? 0

  // Split products into two offset columns

  return (
    <div className="h-full bg-[#F4F5F7] w-full flex flex-col overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════════════
          FIXED HEADER (shrink-0 = never scrolls)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-[#F4F5F7] pt-5 pb-3 px-4 space-y-3 border-b border-gray-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">

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
              <h1 className="text-base font-bold tracking-tight text-foreground leading-none">{firstName}</h1>
            </div>
          </div>

          {/* Balance compact */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBalanceVisible(v => !v)}
              aria-label={balanceVisible ? tr('Masquer le solde') : tr('Afficher le solde')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            {walletLoading ? (
              <Skeleton className="h-6 w-20 rounded-lg" />
            ) : (
              <div className="text-right">
                <p className="text-xl font-extrabold tracking-tight text-foreground leading-none">
                  {balanceVisible ? moneyAmount(Math.floor(balance)) : '•••••'}
                  <span className="text-[10px] font-semibold text-muted-foreground ml-0.5">{currencyLabel()}</span>
                </p>
                {wallet && wallet.blocked_balance > 0 && balanceVisible && (
                  <p className="text-[10px] text-amber-500 font-semibold leading-none mt-0.5">
                    {moneyAmount(wallet.blocked_balance)}{' '}{tr('en attente')}
                  </p>
                )}
              </div>
            )}
            <Link
              to="/wallet"
              onClick={handleTap}
              aria-label={tr('Portefeuille')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm pressable"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <Wallet className="h-4 w-4" />
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
              {tr('Dépôt')}
            </button>
          </Link>
          <Link to="/wallet#transactions" className="flex-1">
            <button onClick={handleTap} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-[#0A1628] border-2 border-[#0A1628] bg-transparent hover:bg-[#0A1628]/5 transition-colors pressable">
              <TrendingUp className="h-3.5 w-3.5" />
              {tr('Historique')}
            </button>
          </Link>
        </div>

        {/* ── Search bar ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={tr('Rechercher un produit…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label={tr('Effacer la recherche')}
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28">
        <div className="mb-3 empty:hidden"><SetupReminder /></div>

        {/* Shops we import from: tap a logo to open the shop, then paste the product link in "Soumettre" */}
        {!query && (
          <section className="mb-5" aria-label={tr('Boutiques prises en charge')}>
            <h2 className="mb-2.5 text-balance text-sm font-bold text-foreground">{tr('Vos boutiques internationales, livrées en Haïti')}</h2>
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-pl-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SHOPS.map((shop) => (
                <li key={shop.name} className="snap-start shrink-0">
                  <a
                    href={shop.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tr('Ouvrir {0}', shop.name)}
                    onClick={() => haptics.tap()}
                    style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
                    className="pressable flex h-[56px] w-[120px] items-center justify-center rounded-2xl border px-3 py-2 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <img src={shop.logo} alt={shop.name} loading="lazy" className="h-full w-full object-contain" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Advertising cards configured in the admin */}
        {!query && <AdBanners />}

        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">
            {query ? tr('Résultats pour "{0}"', query) : tr('Catalogue')}
          </h2>
          {!query && (
            <Link to="/products" className="text-xs font-semibold text-primary">
              {tr('Voir tout')}
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
              {query ? tr('Aucun produit trouvé') : tr('Aucun produit disponible')}
            </p>
            {query && (
              <button onClick={() => setSearch('')} className="text-xs font-semibold text-primary">
                {tr('Effacer la recherche')}
              </button>
            )}
          </div>
        ) : (
          /* ── Staggered 2-column grid ── */
          <ProductFeed products={expandVariants(products.map((p) => resellerPriced(p, isReseller)))} render={(p) => (
            <ProductCard product={p} onPress={() => navigate(productPath(p))} />
          )} />
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
          <p className="text-center text-[11px] text-muted-foreground py-6 font-medium">
            {tr('— Fin du catalogue —')}
          </p>
        )}
      </div>
    </div>
  )
}
