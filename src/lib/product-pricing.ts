

import { moneyAmount } from '@/lib/currency'

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

export interface PricedVariant {
  price_htg: number
}

/**
 * Unit price of a variant for a quantity: its own regular price, with the same % discount as the quantity tier of the
 * product, then the reseller discount. Mirrors `create_product_order` (display only, the database prices the order).
 * `product` may already carry the reseller prices (see `resellerPriced`): the tier ratio is the same, so only the
 * variant price needs the reseller discount.
 */
export function variantUnitPrice(
  product: PricedProduct & { reseller_price?: boolean; reseller_discount_pct?: number },
  variant: PricedVariant,
  quantity: number,
): number {
  const ratio = product.price_htg > 0 ? unitPriceFor(product, quantity) / product.price_htg : 1
  const tiered = Math.round(variant.price_htg * ratio * 100) / 100
  const pct = product.reseller_price ? (product.reseller_discount_pct ?? 0) : 0
  return pct > 0 ? Math.round(tiered * (1 - pct / 100) * 100) / 100 : tiered
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

/** A price in the display currency (HTG, or USD converted with the site's rate): the number only, the unit is shown apart. */
export function formatHtg(value: number): string {
  return moneyAmount(value)
}

export function formatPriceRange(product: PricedProduct): string {
  const { min, max } = priceRange(product)
  return min === max ? formatHtg(min) : `${formatHtg(min)} – ${formatHtg(max)}`
}

/** Lowest and highest unit price of a variant across the quantity tiers of its product (display only). */
export function variantPriceRange(
  product: PricedProduct & { reseller_price?: boolean; reseller_discount_pct?: number },
  variant: PricedVariant,
): { min: number; max: number } {
  const tiers = normalizeTiers(product.price_tiers)
  const top = tiers.length > 0 ? tiers[tiers.length - 1].min_qty : product.moq
  const first = variantUnitPrice(product, variant, product.moq)
  const last = variantUnitPrice(product, variant, top)
  return { min: Math.min(first, last), max: Math.max(first, last) }
}
