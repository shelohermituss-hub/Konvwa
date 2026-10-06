import { Check, Package } from 'lucide-react'
import { VerifiedBadge } from '@/components/shared/verified-badge'
import { useI18n } from '@/lib/i18n-context'
import { formatPriceRange } from '@/lib/product-pricing'
import type { CatalogProduct } from '@/lib/catalog'
import { WishlistButton } from '@/components/shared/wishlist-button'
import { flagFor, supplierLogo } from '@/lib/supplier-badges'

import { tr, LOCALE_TAG } from '@/lib/i18n'
/** The single most persuasive fact we have about the product, shown under the supplier line. */
function highlight(p: CatalogProduct): string | null {
  if (p.repurchase_rate != null) return tr('Taux de réachat de {0} %', p.repurchase_rate)
  if (p.tags.length > 0) return p.tags[0]
  if (p.sold_count > 0) return tr('{0} vendus', p.sold_count.toLocaleString(LOCALE_TAG))
  if (p.processing_days) return tr('Expédition sous {0} jours', p.processing_days)
  return null
}

export function ProductCard({ product, onPress }: { product: CatalogProduct; onPress: () => void }) {
  const { t } = useI18n()
  const extra = highlight(product)
  const logo = supplierLogo(product.supplier_name)
  const flag = flagFor(product.supplier_country)
  const supplierMeta = [
    product.supplier_years ? `${product.supplier_years} ${product.supplier_years > 1 ? 'ans' : 'an'}` : null,
    product.supplier_country,
  ].filter(Boolean).join(' · ')

  return (
    <div className="relative mb-3 break-inside-avoid">
    <button
      type="button"
      onClick={onPress}
      className="block w-full overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-transform duration-100 active:scale-[0.98]"
    >
      <div className="relative min-h-32 bg-gray-50">
        {product.images.length > 0 ? (
          <img src={product.images[0]} alt={product.name} loading="lazy" className="block h-auto w-full" />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm">
              <Package className="h-5 w-5 text-primary/40" strokeWidth={1.5} />
            </div>
            {product.category && (
              <span className="px-2 text-center text-[9px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
                {tr(product.category)}
              </span>
            )}
          </div>
        )}
        {product.featured && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{tr('Vedette')}</span>
        )}
        {product.reseller_price && (
          <span className="absolute bottom-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-white">{tr('Prix revendeur')}</span>
        )}
        {(logo || flag) && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {logo && (
              <span className="flex h-6 items-center rounded-full border border-black/5 bg-white px-1.5 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                <img src={logo.src} alt={logo.name} loading="lazy" className="h-4 w-auto max-w-[44px] object-contain" />
              </span>
            )}
            {flag && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/5 bg-white shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                <img src={flag.src} alt={flag.code} loading="lazy" className="h-4 w-4 rounded-full object-cover" />
              </span>
            )}
          </div>
        )}
        {!product.stock_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full border border-destructive/20 bg-white/90 px-2 py-1 text-[10px] font-bold text-destructive">
              {t('products.out_of_stock')}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-[13px] leading-snug text-foreground">{product.name}</p>

        <p className="flex flex-wrap items-baseline gap-x-1.5 text-base font-extrabold leading-tight tracking-tight text-foreground">
          <span className="whitespace-nowrap">
            {formatPriceRange(product)}
            <span className="ml-1 text-[11px] font-semibold text-muted-foreground">HTG</span>
          </span>
          <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">{tr('MOQ :')}{' '}{product.moq}</span>
        </p>

        {(product.supplier_verified || supplierMeta) && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
            {product.supplier_verified && (
              <span className="inline-flex items-center gap-0.5 font-bold text-sky-700">
                <VerifiedBadge className="h-3.5 w-3.5" />
                {tr('Vérifié')}
              </span>
            )}
            {supplierMeta && <span>{supplierMeta}</span>}
          </p>
        )}

        {extra && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Check className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden />
            <span className="truncate">{extra}</span>
          </p>
        )}
      </div>
    </button>
    <WishlistButton productId={product.id} className="absolute right-2 top-2" />
    </div>
  )
}
