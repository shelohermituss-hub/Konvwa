import { useCallback, useEffect, useRef, useState } from 'react'
import { ProductFeed } from '@/components/shared/product-feed'
import { VerifiedBadge } from '@/components/shared/verified-badge'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ChevronDown, ChevronLeft, Headset, Loader2, Lock, MessageCircle, Minus, Package,
  Play, Plus, Search, Share2, ShieldCheck, ShoppingCart, Star, Store, Truck, Wallet, Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart-context'
import { useI18n } from '@/lib/i18n-context'
import { CATALOG_DETAIL_SELECT, CATALOG_LIST_SELECT, localizeProduct, resellerPriced, sortVariants, variantLabel, type CatalogProduct, type ProductVariant } from '@/lib/catalog'
import { useAuth } from '@/lib/auth-context'
import { formatHtg, tierRows, unitPriceFor, variantUnitPrice } from '@/lib/product-pricing'
import { ProductCard } from '@/components/shared/product-card'
import { ProductReviews } from '@/components/shared/product-reviews'
import { WishlistButton } from '@/components/shared/wishlist-button'
import { ImageViewer } from '@/components/shared/image-viewer'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { tr, LOCALE_TAG } from '@/lib/i18n'
import { currencyLabel } from '@/lib/currency'
import { Flag } from '@/components/shared/flag'
type TabId = 'overview' | 'details' | 'related'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: tr('Aperçu') },
  { id: 'details', label: tr('Détails') },
  { id: 'related', label: tr('Autres produits') },
]

const PROTECTIONS = [
  { icon: ShieldCheck, label: tr('Paiements sécurisés') },
  { icon: Truck, label: tr('Suivi de commande') },
  { icon: Headset, label: tr('Service client') },
  { icon: Lock, label: tr('Confidentialité des données') },
]

const SPEC_PREVIEW = 6
const OPTION_PREVIEW = 3

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { addItem, count } = useCart()
  const { profile } = useAuth()
  const isReseller = !!profile?.is_reseller
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [related, setRelated] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [titleOpen, setTitleOpen] = useState(false)
  const [allSpecs, setAllSpecs] = useState(false)
  const [allOptions, setAllOptions] = useState(false)
  const [tab, setTab] = useState<TabId>('overview')
  const galleryRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('products')
      .select(CATALOG_DETAIL_SELECT)
      .eq('id', id)
      .eq('active', true)
      .eq('product_variants.active', true)
      .maybeSingle()
      .then(({ data }) => {
        const raw = data as unknown as CatalogProduct | null
        const p = raw ? resellerPriced(localizeProduct(raw), isReseller) : null
        setProduct(p)
        if (p) setQuantity(p.moq)
        setActiveImg(0)
        setVariantId(null)
        setLoading(false)
        window.scrollTo?.({ top: 0 })
      })
  }, [id, isReseller])

  useEffect(() => {
    if (!product?.category) { setRelated([]); return }
    supabase
      .from('products')
      .select(CATALOG_LIST_SELECT)
      .eq('active', true)
      .eq('category', product.category)
      .neq('id', product.id)
      .limit(8)
      .then(({ data }) => setRelated(((data ?? []) as unknown as CatalogProduct[]).map(localizeProduct).map(r => resellerPriced(r, isReseller))))
  }, [product?.id, product?.category, isReseller])

  const goToImage = useCallback((index: number) => {
    const el = galleryRef.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  function goToSection(target: TabId) {
    setTab(target)
    document.getElementById(`section-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function pickVariant(v: ProductVariant, gallery: string[]) {
    setVariantId(v.id)
    const at = v.image ? gallery.indexOf(v.image) : -1
    if (at >= 0) goToImage(at)
  }

  async function handleAddToCart() {
    if (!product) return
    if (variants.length > 0 && !chosen) {
      toast.error(tr('Choisissez une option avant d\'ajouter au panier.'))
      document.getElementById('section-variants')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setAdding(true)
    await addItem(product.id, quantity, chosen?.id)
    setAdding(false)
    toast.success(t('products.added'), {
      description: `${quantity} × ${product.name}${chosen ? ` (${variantLabel(chosen)})` : ''}`,
      action: { label: tr('Voir panier'), onClick: () => navigate('/cart') },
    })
  }

  // "Buy": straight to the checkout with this product only (the cart is left untouched)
  function handleBuyNow() {
    if (!product) return
    if (variants.length > 0 && !chosen) {
      toast.error(tr('Choisissez une option avant d\'acheter.'))
      document.getElementById('section-variants')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    navigate('/checkout', { state: { buyNow: { product_id: product.id, variant_id: chosen?.id ?? null, quantity } } })
  }

  async function handleShare() {
    if (!product) return
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success(tr('Lien copié'))
      }
    } catch {
      /* the user closed the share sheet */
    }
  }

  function handleWhatsApp() {
    if (!product) return
    const text = tr('Regarde ce produit sur KONVWA : {0}', `${product.name} — ${window.location.href}`)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F5F7]">
        <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F5F7] px-8 text-center">
        <Package className="h-12 w-12 text-muted-foreground/30" />
        <p className="font-semibold">{tr('Produit introuvable')}</p>
        <button onClick={() => navigate('/products')} className="text-sm font-medium text-primary">
          {tr('Retour aux produits')}
        </button>
      </div>
    )
  }

  const variants = sortVariants(product.product_variants)
  const chosen = variants.find((v) => v.id === variantId) ?? null
  const cheapest = variants.reduce<ProductVariant | null>((m, v) => (!m || v.price_htg < m.price_htg ? v : m), null)
  const priced = chosen ?? cheapest
  // The gallery also holds the variant photos, so choosing a variant can show its own picture.
  const gallery = [...product.images, ...variants.map((v) => v.image).filter((u): u is string => !!u && !product.images.includes(u))]
    .filter((u, i, all) => all.indexOf(u) === i)
  const groups = variants.reduce<Array<{ name: string; items: ProductVariant[] }>>((acc, v) => {
    const name = v.group_name?.trim() ?? ''
    const g = acc.find((x) => x.name === name)
    if (g) g.items.push(v)
    else acc.push({ name, items: [v] })
    return acc
  }, [])
  const rows = tierRows(product).map((r) => (priced ? { ...r, price: variantUnitPrice(product, priced, r.from) } : r))
  const unitPrice = priced ? variantUnitPrice(product, priced, quantity) : unitPriceFor(product, quantity)
  const subtotal = unitPrice * quantity
  const specs = Object.entries(product.specifications ?? {})
  const shownSpecs = allSpecs ? specs : specs.slice(0, SPEC_PREVIEW)
  const shownOptions = allOptions ? product.customization_options : product.customization_options.slice(0, OPTION_PREVIEW)
  const supplierMeta = [
    product.supplier_years ? `${product.supplier_years} ${product.supplier_years > 1 ? 'ans' : 'an'}` : null,
    product.supplier_country,
  ].filter(Boolean).join(' · ')
  const delivery = product.delivery_days_min
    ? tr('{0}–{1} jours', product.delivery_days_min, product.delivery_days_max ?? product.delivery_days_min)
    : null

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-36">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-3">
          <button
            onClick={() => navigate(-1)}
            aria-label={tr('Retour')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate('/products')}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-primary/60 bg-white px-3 text-left"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">{product.category ? tr(product.category) : tr('Rechercher un produit')}</span>
          </button>
          <WishlistButton productId={product.id} className="h-11 w-11 shrink-0 bg-transparent shadow-none hover:bg-muted" />
          <button
            onClick={handleWhatsApp}
            aria-label={tr('Partager sur WhatsApp')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-emerald-700 transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <button
            onClick={handleShare}
            aria-label={tr('Partager')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Share2 className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <button
            onClick={() => navigate('/cart')}
            aria-label={tr('Panier')}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={1.8} />
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        </div>
        <div className="flex gap-6 px-4" role="tablist">
          {TABS.filter((tb) => tb.id !== 'related' || related.length > 0).map((tb) => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => goToSection(tb.id)}
              className={cn(
                'relative h-11 text-sm transition-colors',
                tab === tb.id ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
              )}
            >
              {tb.label}
              {tab === tb.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" />}
            </button>
          ))}
        </div>
      </div>

      <div id="section-overview" className="scroll-mt-28">
        {/* Gallery */}
        <div className="bg-white">
          <div className="relative">
            <div
              ref={galleryRef}
              onScroll={(e) => {
                const el = e.currentTarget
                const at = Math.round(el.scrollLeft / el.clientWidth)
                setActiveImg(at)
                // the product video is the last slide: it stops as soon as another slide is shown
                if (at !== gallery.length) videoRef.current?.pause()
              }}
              className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto bg-gray-50 scrollbar-none"
            >
              {gallery.length > 0 ? (
                gallery.map((img, i) => (
                  <img
                    key={img + i}
                    src={img}
                    alt={i === 0 ? product.name : ''}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    onClick={() => setViewer(i)}
                    className="h-full w-full shrink-0 cursor-zoom-in snap-center object-cover"
                  />
                ))
              ) : !product.video_url && (
                <div className="flex h-full w-full shrink-0 items-center justify-center">
                  <Package className="h-20 w-20 text-muted-foreground/20" />
                </div>
              )}
              {product.video_url && (
                <video
                  ref={videoRef}
                  src={product.video_url}
                  poster={gallery[0]}
                  controls playsInline preload="metadata"
                  aria-label={tr('Vidéo du produit')}
                  className="h-full w-full shrink-0 snap-center bg-black object-contain"
                />
              )}
            </div>
            {product.video_url && activeImg !== gallery.length && (
              <button
                type="button"
                onClick={() => goToImage(gallery.length)}
                className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm active:scale-95"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />{tr('Vidéo')}
              </button>
            )}
            {gallery.length + (product.video_url ? 1 : 0) > 1 && (
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {activeImg === gallery.length && product.video_url ? tr('Vidéo') : `${tr('Photos')} ${activeImg + 1}/${gallery.length}`}
              </span>
            )}
          </div>
          {gallery.length + (product.video_url ? 1 : 0) > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
              {gallery.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => goToImage(i)}
                  aria-label={tr('Photo {0}', i + 1)}
                  className={cn(
                    'h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                    activeImg === i ? 'border-foreground' : 'border-gray-100',
                  )}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {product.video_url && (
                <button
                  type="button"
                  onClick={() => goToImage(gallery.length)}
                  aria-label={tr('Vidéo du produit')}
                  className={cn(
                    'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-black transition-colors',
                    activeImg === gallery.length ? 'border-foreground' : 'border-gray-100',
                  )}
                >
                  {gallery[0] && <img src={gallery[0]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
                  <Play className="relative h-5 w-5 fill-white text-white" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 px-3 pt-3">
          {/* Title + social proof */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setTitleOpen((o) => !o)}
              aria-expanded={titleOpen}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <h1 className={cn('text-[17px] font-bold leading-snug', !titleOpen && 'line-clamp-2')}>{product.name}</h1>
              <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform', titleOpen && 'rotate-180')} />
            </button>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {product.sold_count > 0 && <span>{product.sold_count.toLocaleString(LOCALE_TAG)}{' '}{tr('vendus')}</span>}
              {product.rating != null && (
                <span className="inline-flex items-center gap-1">
                  {product.sold_count > 0 && <span aria-hidden>·</span>}
                  {tr('Note :')}{' '}<strong className="text-foreground">{String(product.rating).replace('.', ',')}</strong>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  {product.review_count > 0 && <span className="underline">({product.review_count})</span>}
                </span>
              )}
              {!product.stock_available && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">{tr('Rupture de stock')}</span>
              )}
            </p>

            {/* Variants: size, colour… each with its own regular price and photo */}
            {variants.length > 0 && (
              <div id="section-variants" className="mt-3 space-y-3 scroll-mt-28">
                {groups.map((g) => (
                  <div key={g.name || 'options'}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.name || tr('Options')}
                      {chosen && g.items.some((v) => v.id === chosen.id) && <span className="ml-1.5 normal-case text-foreground">· {variantLabel(chosen)}</span>}
                    </p>
                    <div role="radiogroup" aria-label={g.name || tr('Options')} className="flex flex-wrap gap-2">
                      {g.items.map((v) => {
                        const on = v.id === variantId
                        return (
                          <button
                            key={v.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={!v.stock_available}
                            onClick={() => pickVariant(v, gallery)}
                            className={cn(
                              'flex min-h-11 items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-left text-sm transition-colors active:scale-[0.98]',
                              on ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300',
                              !v.stock_available && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            {v.image && <img src={v.image} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
                            <span className="min-w-0">
                              <span className={cn('block max-w-[11rem] truncate font-semibold', !v.stock_available && 'line-through')}>{variantLabel(v)}</span>
                              <span className="block text-xs tabular-nums text-muted-foreground">
                                {v.stock_available ? `${formatHtg(variantUnitPrice(product, v, quantity))} ${currencyLabel()}` : tr('Rupture de stock')}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {!chosen && <p className="text-sm text-muted-foreground">{tr('Choisissez une option pour continuer.')}</p>}
              </div>
            )}

            {product.sale_type === 'wholesale' && (
              <p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-foreground/80">
                <span className="font-bold text-primary">{tr('Achat en gros')}</span>{' · '}
                {tr('commande minimale de {0} {1}. Plus la quantité est grande, plus le prix unitaire baisse.', product.moq.toLocaleString(LOCALE_TAG), product.unit)}
              </p>
            )}

            {/* Price by quantity */}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 rounded-xl bg-muted/50 p-3" aria-label={tr('Prix selon la quantité')}>
              {rows.map((r) => {
                const active = quantity >= r.from && (r.to === null || quantity <= r.to)
                return (
                  <div key={r.from}>
                    <p className={cn('text-xl font-extrabold tabular-nums tracking-tight', active ? 'text-primary' : 'text-foreground')}>
                      {variants.length > 0 && !chosen && <span className="mr-1 text-xs font-semibold text-muted-foreground">{tr('dès')}</span>}{formatHtg(r.price)} <span className="text-xs font-semibold text-muted-foreground">{currencyLabel()}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rows.length > 1 && r === rows[0]
                        ? tr('Commande minimale : {0} {1}', r.from, product.unit)
                        : r.to === null ? `≥ ${r.from} ${product.unit}` : `${r.from}–${r.to} ${product.unit}`}
                    </p>
                  </div>
                )
              })}
            </div>
            {rows.length === 1 && (
              <p className="mt-2 text-sm text-muted-foreground">{tr('Commande minimale :')}{' '}{product.moq} {product.unit}</p>
            )}

            {/* Quantity */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('Quantité')}</p>
                <p className="text-sm text-muted-foreground">
                  {formatHtg(unitPrice)} {currencyLabel()} / {product.unit}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(product.moq, q - 1))}
                  disabled={quantity <= product.moq}
                  aria-label={tr('Diminuer la quantité')}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={product.moq}
                  value={quantity}
                  aria-label={tr('Quantité')}
                  onChange={(e) => setQuantity(Math.max(product.moq, Math.floor(Number(e.target.value)) || product.moq))}
                  className="h-10 w-16 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label={tr('Augmenter la quantité')}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Delivery + customization tiles */}
          {(delivery || product.customization_options.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {delivery ? (
                <div className={cn('rounded-xl bg-white p-3 shadow-sm', product.customization_options.length === 0 && 'col-span-2')}>
                  <p className="flex items-center gap-1.5 font-bold"><Flag code="HT" className="text-base" />{tr('Livraison en Haïti')}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{tr('Estimée :')}{' '}{delivery}</p>
                </div>
              ) : <span />}
              {product.customization_options.length > 0 && (
                <button
                  type="button"
                  onClick={() => document.getElementById('section-custom')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="rounded-xl bg-white p-3 text-left shadow-sm"
                >
                  <p className="font-bold">{tr('Personnalisation')}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{product.customization_options.slice(0, 2).join(', ')}</p>
                </button>
              )}
            </div>
          )}

          {product.certifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.certifications.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-sm text-amber-800 shadow-sm">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> {c}
                </span>
              ))}
            </div>
          )}

          {/* Protection */}
          <Section title={tr('Protection des commandes KONVWA')}>
            <p className="-mt-1 mb-3 text-sm text-muted-foreground">
              {tr('Payez avec votre portefeuille KONVWA, rechargé par MonCash, NatCash ou virement.')}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {PROTECTIONS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
                  <Icon className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                  <span className="text-sm leading-tight">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" aria-hidden />{' '}{tr('Paiements pris en charge : Portefeuille · MonCash · NatCash')}
            </p>
          </Section>
        </div>
      </div>

      <div id="section-details" className="scroll-mt-28 space-y-3 px-3 pt-3">
        {/* Characteristics */}
        {specs.length > 0 && (
          <Section title={tr('Caractéristiques')}>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-gray-100">
              {shownSpecs.map(([key, val]) => (
                <div key={key} className="bg-muted/40 p-3">
                  <dd className="line-clamp-2 text-[15px] font-semibold leading-snug">{val}</dd>
                  <dt className="mt-0.5 text-xs text-muted-foreground">{key}</dt>
                </div>
              ))}
            </dl>
            {specs.length > SPEC_PREVIEW && (
              <button onClick={() => setAllSpecs((v) => !v)} className="mt-3 h-11 w-full text-sm font-semibold text-primary">
                {allSpecs ? tr('Réduire') : tr('Voir les {0} caractéristiques', specs.length)}
              </button>
            )}
          </Section>
        )}

        {/* Customization */}
        {product.customization_options.length > 0 && (
          <Section id="section-custom" title={tr('Options de personnalisation')}>
            <ul className="space-y-2.5">
              {shownOptions.map((o) => (
                <li key={o} className="flex items-center gap-2.5 text-[15px]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
                  {o}
                </li>
              ))}
            </ul>
            {product.customization_options.length > OPTION_PREVIEW && (
              <button onClick={() => setAllOptions((v) => !v)} className="mt-2 h-11 text-sm text-muted-foreground">
                {allOptions ? tr('Réduire') : tr('+{0} options supplémentaires', product.customization_options.length - OPTION_PREVIEW)}
              </button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {tr('Pour une personnalisation, utilisez « Discuter ici » avant de commander.')}
            </p>
          </Section>
        )}

        {/* Processing time */}
        {(product.processing_days || delivery) && (
          <Section title={tr('Délais')}>
            <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
              {product.processing_days && (
                <p className="flex justify-between gap-3"><span className="text-muted-foreground">{tr('Temps de traitement')}</span><strong>{product.processing_days}{' '}{tr('jours')}</strong></p>
              )}
              {delivery && (
                <p className="flex justify-between gap-3"><span className="text-muted-foreground">{tr('Livraison estimée')}</span><strong>{delivery}</strong></p>
              )}
            </div>
          </Section>
        )}

        {/* Supplier */}
        {product.supplier_name && (
          <Section title={tr('Fournisseur')}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Store className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{product.supplier_name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {product.supplier_verified && (
                    <span className="inline-flex items-center gap-0.5 font-bold text-sky-700">
                      <VerifiedBadge className="h-4 w-4" />{' '}{tr('Vérifié')}
                    </span>
                  )}
                  {supplierMeta && <span>{supplierMeta}</span>}
                </p>
              </div>
            </div>
          </Section>
        )}

        {product.description && (
          <Section title={tr('Description')}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          </Section>
        )}

        <ProductReviews productId={product.id} />
      </div>

      {related.length > 0 && (
        <div id="section-related" className="scroll-mt-28 px-3 pt-4">
          <h2 className="mb-3 px-1 text-base font-bold tracking-tight">{tr('Autres produits')}</h2>
          <ProductFeed products={related} render={(p) => (
            <ProductCard product={p} onPress={() => navigate(`/products/${p.id}`)} />
          )} />
        </div>
      )}

      {viewer !== null && (
        <ImageViewer
          images={gallery} index={viewer} alt={product.name}
          onIndexChange={setViewer}
          onClose={() => { goToImage(viewer); setViewer(null) }}
        />
      )}

      {/* Bottom action bar — z-[60] to sit above the bottom nav (z-50) */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-gray-100 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-4px_20px_rgba(10,22,40,0.08)] backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(`/products?q=${encodeURIComponent(product.supplier_name ?? '')}`)}
            className="flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 text-foreground"
            aria-label={tr('Voir la boutique du fournisseur')}
          >
            <Store className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[11px]">{tr('Magasin')}</span>
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!product.stock_available}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-foreground bg-white text-sm font-bold transition-opacity active:scale-[0.98] disabled:opacity-50"
          >
            <Zap className="h-4 w-4" aria-hidden />
            {tr('Acheter')}
          </button>
          <button
            onClick={handleAddToCart}
            disabled={adding || !product.stock_available}
            aria-disabled={variants.length > 0 && !chosen}
            className="flex h-12 flex-[1.3] items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="truncate">{variants.length > 0 && !chosen ? tr('Choisir une option') : `${t('products.add_to_cart')} · ${formatHtg(subtotal)}`}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

