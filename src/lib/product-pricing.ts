import { currencyLabel, moneyAmount } from '@/lib/currency'
import { tr } from '@/lib/i18n'

export interface PriceTier {
  min_qty: number
  price_htg: number
  /** 'sync': an offer of the supplier ("2 for $40") kept up to date by the nightly price follow-up: it disappears with the offer.
   *  `min_qty` is then the size of a PACK and `price_htg` the unit price inside a pack. */
  src?: 'sync'
  /** Supplier offers only: "N for a total price" (multi_buy) or "buy N, get M free / at a discount" (free_item). */
  kind?: 'multi_buy' | 'free_item'
  buy?: number
  free?: number
  off?: number
}

export interface PricedProduct {
  price_htg: number
  moq: number
  price_tiers?: unknown
}

const positive = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined)

/** Keeps only well-formed tiers, sorted by quantity (the database stores free-form JSON). */
export function normalizeTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t): PriceTier => {
      const o = (t ?? {}) as PriceTier
      const base = { min_qty: Number(o.min_qty), price_htg: Number(o.price_htg) }
      if (o.src !== 'sync') return base
      return {
        ...base, src: 'sync',
        ...(o.kind === 'multi_buy' || o.kind === 'free_item' ? { kind: o.kind } : {}),
        ...(positive(o.buy) ? { buy: positive(o.buy) } : {}),
        ...(positive(o.free) ? { free: positive(o.free) } : {}),
        ...(positive(o.off) ? { off: positive(o.off) } : {}),
      }
    })
    .filter((t) => Number.isFinite(t.min_qty) && t.min_qty > 0 && Number.isFinite(t.price_htg) && t.price_htg > 0)
    .sort((a, b) => a.min_qty - b.min_qty)
}

/** The tiers set by hand (admin or Alibaba import): from some quantity on, EVERY unit costs less. */
export const manualTiers = (raw: unknown): PriceTier[] => normalizeTiers(raw).filter((t) => t.src !== 'sync')

/** The supplier's offers: packs of `min_qty` units, each unit costing `price_htg` inside a pack. */
export const offerTiers = (raw: unknown): PriceTier[] => normalizeTiers(raw).filter((t) => t.src === 'sync')

/**
 * Unit price for a quantity, outside any offer (hand-made tiers only). Mirrors the database function `tier_price`, which is the
 * one that actually prices the order: this copy is only used to display what the order will cost.
 */
export function unitPriceFor(product: PricedProduct, quantity: number): number {
  const tier = [...manualTiers(product.price_tiers)].reverse().find((t) => t.min_qty <= quantity)
  return tier ? tier.price_htg : product.price_htg
}

export interface PricedVariant {
  price_htg: number
}

type WithReseller = PricedProduct & { reseller_price?: boolean; reseller_discount_pct?: number }

/**
 * Unit price of a variant for a quantity, outside any offer: its own regular price, with the same % discount as the hand-made
 * quantity tier of the product, then the reseller discount. Mirrors `create_product_order` (display only).
 * `product` may already carry the reseller prices (see `resellerPriced`): the tier ratio is the same, so only the
 * variant price needs the reseller discount.
 */
export function variantUnitPrice(product: WithReseller, variant: PricedVariant, quantity: number): number {
  const pct = product.reseller_price ? (product.reseller_discount_pct ?? 0) : 0
  const ratio = product.price_htg > 0 ? unitPriceFor(product, quantity) / product.price_htg : 1
  const tiered = Math.round(variant.price_htg * ratio * 100) / 100
  return pct > 0 ? Math.round(tiered * (1 - pct / 100) * 100) / 100 : tiered
}

/** An offer belongs to the base option of a product: a variant with its own price is not part of it. */
function onBaseOption(product: WithReseller, variant?: PricedVariant | null): boolean {
  if (!variant) return true
  const pct = product.reseller_price ? (product.reseller_discount_pct ?? 0) : 0
  const baseBeforeReseller = pct > 0 ? product.price_htg / (1 - pct / 100) : product.price_htg
  return Math.abs(variant.price_htg - baseBeforeReseller) < 0.5
}

/**
 * What a line of `quantity` units costs. The supplier's offers are PACKS: with "2 for $40", 3 units cost one pack plus one unit at the
 * regular price, 4 units cost two packs. Mirrors `create_product_order` (display only, the database prices the order).
 */
export function lineTotal(product: WithReseller, quantity: number, variant?: PricedVariant | null): number {
  const unit = variant ? variantUnitPrice(product, variant, quantity) : unitPriceFor(product, quantity)
  const flat = unit * quantity
  const offers = offerTiers(product.price_tiers).sort((a, b) => b.min_qty - a.min_qty)
  if (offers.length === 0 || !onBaseOption(product, variant)) return Math.round(flat * 100) / 100
  let rest = quantity
  let plan = 0
  for (const o of offers) {
    const packs = Math.floor(rest / o.min_qty)
    plan += packs * o.min_qty * o.price_htg
    rest -= packs * o.min_qty
  }
  plan += rest * unit
  return Math.round(Math.min(flat, plan) * 100) / 100
}

/** Average price of one unit in the line (the total divided by the quantity), unrounded so that unit × quantity gives the total back. */
export function effectiveUnitPrice(product: WithReseller, quantity: number, variant?: PricedVariant | null): number {
  return quantity > 0 ? lineTotal(product, quantity, variant) / quantity : 0
}

/** Lowest and highest unit price of a product: its own price and its hand-made tiers (supplier offers are shown apart). */
export function priceRange(product: PricedProduct): { min: number; max: number } {
  const prices = [product.price_htg, ...manualTiers(product.price_tiers).map((t) => t.price_htg)]
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export interface TierRow {
  from: number
  to: number | null
  price: number
}

/** Rows shown in the "price by quantity" block, starting at the minimum order quantity (hand-made tiers only). */
export function tierRows(product: PricedProduct): TierRow[] {
  const starts = [product.moq, ...manualTiers(product.price_tiers).map((t) => t.min_qty).filter((q) => q > product.moq)]
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

/** The offer to announce on a card or a page: the one with the lowest unit price; none when the chosen variant is not part of the offers. */
export function bestOffer(product: WithReseller, variant?: PricedVariant | null): PriceTier | null {
  if (!onBaseOption(product, variant)) return null
  return offerTiers(product.price_tiers).sort((a, b) => a.price_htg - b.price_htg)[0] ?? null
}

/** The offer named for customers: "2 for $48", "1 bought, 1 free", "buy 1, the next one 50% off". */
export function offerLabel(offer: PriceTier): string {
  if (offer.kind === 'free_item' && offer.buy && offer.free) {
    const off = offer.off ?? 100
    if (off >= 100) return tr('{0} acheté, {1} offert', offer.buy, offer.free)
    return offer.free === 1 ? tr('{0} acheté, le suivant à -{1} %', offer.buy, off) : tr('{0} achetés, {1} à -{2} %', offer.buy, offer.free, off)
  }
  const pack = offer.min_qty * offer.price_htg
  return tr('{0} pour {1}', offer.min_qty, `${formatHtg(pack)} ${currencyLabel()}`)
}
