/** Selling price in HTG from a USD price: exchange rate, then the service margin, rounded up to the next 5 HTG. */
export function priceHtgFromUsd(usd: number, usdToHtg: number, marginPct: number): number {
  if (!(usd > 0) || !(usdToHtg > 0)) return 0
  const raw = usd * usdToHtg * (1 + Math.max(0, marginPct) / 100)
  return Math.ceil(raw / 5) * 5
}

/** Delivery window (days) and trust badge prefilled on an imported product: US stock ships in 15-35 days, everything else (China) in 45-70. */
export function importDefaults(country: string | null | undefined) {
  const us = (country ?? '').toUpperCase() === 'US'
  return { delivery_days_min: us ? 15 : 45, delivery_days_max: us ? 35 : 70, supplier_verified: true }
}
