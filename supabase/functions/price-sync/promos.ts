// Quantity offers shown on a supplier page ("2 for $40", "buy 1 get 1 free") turned into price tiers. Pure: unit-tested with vitest.

export interface Tier { min_qty: number; unit_usd: number }

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
 * Offers of the page -> tiers ("from `min_qty` units, each costs `unit_usd`").
 *  - multi_buy : `qty` items for `total_price` in total ("2 for $40" -> 2 units at $20)
 *  - free_item : buy `qty`, get `free_qty` free ("buy 1 get 1 free" -> 2 units at half price)
 * Anything else (percent off, free gift, free shipping…) is ignored. Only offers that really lower the unit price are kept, at most 4.
 */
export function promoTiers(baseUsd: number, raw: unknown): Tier[] {
  if (!(baseUsd > 0) || !Array.isArray(raw)) return []
  const found: Tier[] = []
  for (const item of raw.slice(0, 12)) {
    const o = (item ?? {}) as Record<string, unknown>
    if (o.kind === 'multi_buy') {
      const n = int(o.qty, 2, 50); const total = money(o.total_price)
      if (n && total) found.push({ min_qty: n, unit_usd: round2(total / n) })
    } else if (o.kind === 'free_item') {
      const buy = int(o.qty, 1, 20); const free = int(o.free_qty, 1, 20)
      if (buy && free) found.push({ min_qty: buy + free, unit_usd: round2((baseUsd * buy) / (buy + free)) })
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
