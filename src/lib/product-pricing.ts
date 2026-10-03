
import { LOCALE_TAG } from '@/lib/i18n'

export interface PriceTier {
  min_qty: number
  price_htg: number
}

export interface PricedProduct {
  price_htg: number
  moq: number
  price_tiers?: unknown
}

/** Keeps only well-formed tiers, sorted by quantity (the database stores free-form JSON). */
export function normalizeTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => ({ min_qty: Number((t as PriceTier)?.min_qty), price_htg: Number((t as PriceTier)?.price_htg) }))
    .filter((t) => Number.isFinite(t.min_qty) && t.min_qty > 0 && Number.isFinite(t.price_htg) && t.price_htg > 0)
    .sort((a, b) => a.min_qty - b.min_qty)
}

/**
 * Unit price for a quantity. Mirrors the database function `tier_price`, which is the one that
 * actually prices the order: this copy is only used to display what the order will cost.
 */
export function unitPriceFor(product: PricedProduct, quantity: number): number {
  const tier = [...normalizeTiers(product.price_tiers)].reverse().find((t) => t.min_qty <= quantity)
  return tier ? tier.price_htg : product.price_htg
}

export function priceRange(product: PricedProduct): { min: number; max: number } {
  const prices = [product.price_htg, ...normalizeTiers(product.price_tiers).map((t) => t.price_htg)]
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export interface TierRow {
  from: number
  to: number | null
  price: number
}

/** Rows shown in the "price by quantity" block, starting at the minimum order quantity. */
export function tierRows(product: PricedProduct): TierRow[] {
  const starts = [product.moq, ...normalizeTiers(product.price_tiers).map((t) => t.min_qty).filter((q) => q > product.moq)]
  return starts.map((from, i) => ({
    from,
    to: i + 1 < starts.length ? starts[i + 1] - 1 : null,
    price: unitPriceFor(product, from),
  }))
}

export function formatHtg(value: number): string {
  return value.toLocaleString(LOCALE_TAG, { maximumFractionDigits: 2 })
}

export function formatPriceRange(product: PricedProduct): string {
  const { min, max } = priceRange(product)
  return min === max ? formatHtg(min) : `${formatHtg(min)} – ${formatHtg(max)}`
}
