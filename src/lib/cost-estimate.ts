/** Landed-cost estimate shown to the customer. The official quote is always set by the team. */

export interface Rates {
  usdToHtg: number
  freightPerKgUsd: number
  dutyPct: number
  servicePct: number
  cnyToUsd: number
  eurToUsd: number
}

export const DEFAULT_RATES: Rates = { usdToHtg: 140, freightPerKgUsd: 11, dutyPct: 20, servicePct: 15, cnyToUsd: 0.14, eurToUsd: 1.08 }

/** Typical unit weight (kg) per category, used until the customer enters a real one. */
export const DEFAULT_WEIGHT_KG: Record<string, number> = {
  clothing: 0.4, electronics: 0.5, cosmetics: 0.3, home: 1, toys: 0.6, auto: 2, sport: 0.8, other: 0.5,
}

export interface Estimate {
  productUsd: number
  freightUsd: number
  dutyUsd: number
  serviceUsd: number
  totalUsd: number
  totalHtg: number
  perUnitHtg: number
}

export function estimateCost(input: { priceUsd: number; quantity: number; weightKg: number }, rates: Rates): Estimate {
  const quantity = Math.max(1, Math.floor(input.quantity))
  const productUsd = input.priceUsd * quantity
  const freightUsd = input.weightKg * quantity * rates.freightPerKgUsd
  const dutyUsd = (productUsd + freightUsd) * (rates.dutyPct / 100)
  const subtotal = productUsd + freightUsd + dutyUsd
  const serviceUsd = subtotal * (rates.servicePct / 100)
  const totalUsd = subtotal + serviceUsd
  const totalHtg = totalUsd * rates.usdToHtg
  return { productUsd, freightUsd, dutyUsd, serviceUsd, totalUsd, totalHtg, perUnitHtg: totalHtg / quantity }
}

/** Converts a price read on a shop page; unknown currencies return null (the customer types the price). */
export function toUsd(price: number, currency: string | null, rates: Rates): number | null {
  switch ((currency ?? 'USD').toUpperCase()) {
    case 'USD': return price
    case 'CNY': case 'RMB': return price * rates.cnyToUsd
    case 'EUR': return price * rates.eurToUsd
    default: return null
  }
}

const CATEGORY_WORDS: Array<[string, RegExp]> = [
  ['cosmetics', /\b(lipstick|mascara|makeup|make-up|skincare|serum|perfume|nail|cosmetic|beauty|hair|wig)\b/i],
  ['electronics', /\b(phone|charger|cable|earbud|headphone|speaker|led|usb|battery|camera|smart ?watch|power ?bank|bluetooth|tablet)\b/i],
  ['toys', /\b(toy|doll|puzzle|lego|plush|game|kids? car)\b/i],
  ['auto', /\b(car|motorcycle|motor|auto|tire|tyre|brake|engine|helmet)\b/i],
  ['home', /\b(kitchen|home|lamp|curtain|bedding|pillow|storage|furniture|decor|mug|bottle)\b/i],
  ['clothing', /\b(shirt|t-?shirt|dress|jeans|pants|socks?|shoes?|sneakers?|jacket|hoodie|coat|skirt|bag|handbag|hat|cap|underwear|bra|swimsuit)\b/i],
  ['sport', /\b(sport|fitness|gym|yoga|bike|cycling|football|running|outdoor|camping)\b/i],
]

/** Best-effort category from a product name; null when nothing matches (the customer chooses). */
export function guessCategory(name: string): string | null {
  return CATEGORY_WORDS.find(([, re]) => re.test(name))?.[0] ?? null
}

export interface QuoteSuggestion {
  unitPriceHtg: number
  shippingHtg: number
  customsHtg: number
  serviceHtg: number
  totalHtg: number
}

/** First estimate for the team's quote form (everything in HTG, rounded to the gourde). The team adjusts it. */
export function suggestQuote(input: { unitPriceUsd: number; quantity: number; totalWeightKg: number }, rates: Rates): QuoteSuggestion {
  const quantity = Math.max(1, Math.floor(input.quantity))
  const productUsd = input.unitPriceUsd * quantity
  const freightUsd = input.totalWeightKg * rates.freightPerKgUsd
  const dutyUsd = (productUsd + freightUsd) * (rates.dutyPct / 100)
  const serviceUsd = (productUsd + freightUsd + dutyUsd) * (rates.servicePct / 100)
  const htg = (usd: number) => Math.round(usd * rates.usdToHtg)
  const unitPriceHtg = Math.round(input.unitPriceUsd * rates.usdToHtg)
  const shippingHtg = htg(freightUsd)
  const customsHtg = htg(dutyUsd)
  const serviceHtg = htg(serviceUsd)
  return { unitPriceHtg, shippingHtg, customsHtg, serviceHtg, totalHtg: unitPriceHtg * quantity + shippingHtg + customsHtg + serviceHtg }
}
