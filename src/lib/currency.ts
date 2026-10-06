import { LOCALE_TAG } from '@/lib/i18n'

/**
 * Display currency. Everything is stored and computed in HTG (gourdes) by the database; USD is only a way of showing amounts,
 * converted with the site's rate (the usd_to_htg_rate setting). Like the language, the choice is fixed per page load: changing it reloads.
 */
export type Currency = 'HTG' | 'USD'

export const CURRENCY_STORAGE_KEY = 'konvwa-currency'
const RATE_STORAGE_KEY = 'konvwa-usd-rate'
const DEFAULT_RATE = 140

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function detectCurrency(): Currency {
  return read(CURRENCY_STORAGE_KEY) === 'USD' ? 'USD' : 'HTG'
}

function detectRate(): number {
  const n = Number(read(RATE_STORAGE_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RATE
}

export const CURRENCY: Currency = detectCurrency()
/** HTG per 1 USD, from the last value saved by the app (the setting is refreshed in the background, see `refreshUsdRate`). */
export const USD_RATE: number = detectRate()

export function setCurrency(c: Currency): void {
  try { localStorage.setItem(CURRENCY_STORAGE_KEY, c) } catch { /* blocked storage: the choice just does not persist */ }
  window.location.reload()
}

/** Keeps the latest rate for the next page load (the current page keeps the one it started with, so prices never change under the user's eyes). */
export function saveUsdRate(rate: unknown): void {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) return
  try { localStorage.setItem(RATE_STORAGE_KEY, String(n)) } catch { /* ignore */ }
}

/** An HTG amount converted to the display currency (USD rounded to cents). */
export function toDisplay(htg: number, currency: Currency = CURRENCY, rate: number = USD_RATE): number {
  return currency === 'USD' ? Math.round((htg / rate) * 100) / 100 : htg
}

/** Number part only ("12 500" or "89.29"), for layouts that show the unit apart. */
export function moneyAmount(htg: number, currency: Currency = CURRENCY, rate: number = USD_RATE, locale: string = LOCALE_TAG): string {
  const v = toDisplay(Number.isFinite(htg) ? htg : 0, currency, rate)
  return currency === 'USD'
    ? v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString(locale, { maximumFractionDigits: 2 })
}

/** The unit shown next to `moneyAmount`. */
export const currencyLabel = (currency: Currency = CURRENCY): string => (currency === 'USD' ? 'USD' : 'HTG')

/** A full amount for the display currency: "12 500 HTG" or "89.29 USD". */
export function money(htg: number, currency: Currency = CURRENCY, rate: number = USD_RATE, locale: string = LOCALE_TAG): string {
  return `${moneyAmount(htg, currency, rate, locale)} ${currencyLabel(currency)}`
}

/** Compact amount for tiles: "12k HTG" or "0.1k USD" -> "89.3k USD". */
export function moneyCompact(htg: number, currency: Currency = CURRENCY, rate: number = USD_RATE): string {
  const v = toDisplay(Number.isFinite(htg) ? htg : 0, currency, rate) / 1000
  return `${v.toFixed(currency === 'USD' ? 1 : 0)}k ${currencyLabel(currency)}`
}
