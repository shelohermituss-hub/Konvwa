// Quantity offers shown on a supplier page ("2 for $40", "buy 1 get 1 free") turned into price tiers. Pure: unit-tested with vitest.

/** One offer as a price tier: `min_qty` units in a pack, each costing `unit_usd`; the kind and numbers let the shop name the offer. */
export interface Tier { min_qty: number; unit_usd: number; kind?: 'multi_buy' | 'free_item'; buy?: number; free?: number; off?: number }

const round2 = (n: number) => Math.round(n * 100) / 100
const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
const money = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null
}

/**
 * Offers of the page -> tiers ("from `min_qty` units, each costs `unit_usd`"). The kinds follow Muscle & Strength's own offer filters:
 *  - multi_buy     : `qty` items for `total_price` in total ("2 Pack Deal", "2 for $40" -> 2 units at $20)
 *  - free_item     : buy `qty`, get `free_qty` free ("Buy 1 Get 1 Free", "Buy X Get Y Free") or at `discount_percent` off ("Buy 1 Get 1 50% Off")
 * "Limited Time Price Cut" is the price itself (read as the current price) and "In Cart Discount" is handled by `cartDiscountedPrice`.
 * Anything else is ignored. Only offers that really lower the unit price are kept, at most 4.
 */
export function promoTiers(baseUsd: number, raw: unknown): Tier[] {
  if (!(baseUsd > 0) || !Array.isArray(raw)) return []
  const found: Tier[] = []
  for (const item of raw.slice(0, 12)) {
    const o = (item ?? {}) as Record<string, unknown>
    if (o.kind === 'multi_buy') {
      const n = int(o.qty, 2, 50); const total = money(o.total_price)
      if (n && total) found.push({ min_qty: n, unit_usd: round2(total / n), kind: 'multi_buy', buy: n })
    } else if (o.kind === 'free_item') {
      const buy = int(o.qty, 1, 20); const free = int(o.free_qty, 1, 20)
      const off = int(o.discount_percent, 1, 100) ?? 100
      if (buy && free) found.push({ min_qty: buy + free, unit_usd: round2((baseUsd * (buy + (free * (100 - off)) / 100)) / (buy + free)), kind: 'free_item', buy, free, off })
    }
  }
  // sorted by quantity; per quantity the cheapest offer; the unit price must go down as the quantity goes up
  found.sort((a, b) => a.min_qty - b.min_qty || a.unit_usd - b.unit_usd)
  const out: Tier[] = []
  for (const t of found) {
    const last = out[out.length - 1]
    if (t.unit_usd <= 0 || t.unit_usd >= baseUsd || t.unit_usd < baseUsd * 0.2) continue
    if (last && (t.min_qty === last.min_qty || t.unit_usd >= last.unit_usd)) continue
    out.push(t)
  }
  return out.slice(0, 4)
}

/** "In Cart Discount": a percentage taken off the product when it is in the cart. The best one (at most 50 %) lowers the unit price. */
export function cartDiscountedPrice(price: number, raw: unknown): number {
  if (!(price > 0) || !Array.isArray(raw)) return price
  let best = 0
  for (const item of raw.slice(0, 12)) {
    const o = (item ?? {}) as Record<string, unknown>
    const pct = o.kind === 'cart_discount' ? int(o.percent, 1, 50) : null
    if (pct && pct > best) best = pct
  }
  return best > 0 ? round2(price * (1 - best / 100)) : price
}

/** A supplier price moved by more than this share waits for the admin instead of being applied alone. */
export const REVIEW_THRESHOLD = 0.15

/** Does the change need a human look? (no reference price yet = first check = nothing to compare) */
export function needsReview(oldUsd: number | null, newUsd: number): boolean {
  return oldUsd !== null && oldUsd > 0 && Math.round(Math.abs(newUsd / oldUsd - 1) * 10000) / 10000 > REVIEW_THRESHOLD
}

/** The supplier price (USD) a shop price corresponds to: the shop price divided by the exchange rate and the service margin. */
export function impliedUsd(priceHtg: number, usdToHtg: number, marginPct: number): number {
  if (!(priceHtg > 0) || !(usdToHtg > 0)) return 0
  return Math.round((priceHtg / (usdToHtg * (1 + Math.max(0, marginPct) / 100))) * 100) / 100
}
