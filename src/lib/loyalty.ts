export type Tier = 'bronze' | 'silver' | 'gold'

export interface Loyalty {
  tier: Tier
  orders: number
  discount_pct: number
  next_at: number | null
  silver_pct: number
  gold_pct: number
  silver_at: number
  gold_at: number
}

/** Progress towards the next tier, 0–100 (100 once the top tier is reached). */
export function tierProgress(l: Pick<Loyalty, 'tier' | 'orders' | 'silver_at' | 'gold_at'>): number {
  if (l.tier === 'gold') return 100
  const from = l.tier === 'silver' ? l.silver_at : 0
  const to = l.tier === 'silver' ? l.gold_at : l.silver_at
  if (to <= from) return 100
  return Math.max(0, Math.min(100, Math.round(((l.orders - from) / (to - from)) * 100)))
}

/** Service fee after the loyalty discount (the team applies it when quoting). */
export function discountedFee(fee: number, pct: number): number {
  return Math.round(fee * (1 - Math.max(0, Math.min(100, pct)) / 100))
}
