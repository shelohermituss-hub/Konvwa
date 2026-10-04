/** Selling price in HTG from a USD price: exchange rate, then the service margin, rounded up to the next 5 HTG. */
export function priceHtgFromUsd(usd: number, usdToHtg: number, marginPct: number): number {
  if (!(usd > 0) || !(usdToHtg > 0)) return 0
  const raw = usd * usdToHtg * (1 + Math.max(0, marginPct) / 100)
  return Math.ceil(raw / 5) * 5
}
