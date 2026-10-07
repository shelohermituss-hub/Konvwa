// Pure normalisation of what Firecrawl / the AI return (units, prices, text), unit-tested with vitest.

export interface Measure { value: number | string | null | undefined; unit?: string | null }
export interface Dims { length: number; width: number; height: number }

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

const KG_PER: Record<string, number> = {
  kg: 1, kgs: 1, kilogram: 1, kilograms: 1,
  g: 0.001, gram: 0.001, grams: 0.001,
  lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237,
  oz: 0.028349523, ounce: 0.028349523, ounces: 0.028349523,
}
const CM_PER: Record<string, number> = {
  cm: 1, centimeter: 1, centimeters: 1, centimetre: 1, centimetres: 1,
  mm: 0.1, millimeter: 0.1, millimeters: 0.1,
  m: 100, meter: 100, meters: 100,
  in: 2.54, inch: 2.54, inches: 2.54, '"': 2.54,
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.').trim()) : NaN
  return Number.isFinite(n) ? n : null
}

/** Weight in kg (3 decimals), or null when missing, unknown unit or absurd (≤ 0 or > 1000 kg). */
export function toKg(value: unknown, unit: unknown): number | null {
  const n = num(value)
  const f = KG_PER[String(unit ?? '').trim().toLowerCase().replace(/\.$/, '')]
  if (n === null || !f) return null
  const kg = round(n * f, 3)
  return kg > 0 && kg <= 1000 ? kg : null
}

/** Length in cm (1 decimal), or null when missing, unknown unit or absurd (≤ 0 or > 1000 cm). */
export function toCm(value: unknown, unit: unknown): number | null {
  const n = num(value)
  const f = CM_PER[String(unit ?? '').trim().toLowerCase().replace(/\.$/, '')]
  if (n === null || !f) return null
  const cm = round(n * f, 1)
  return cm > 0 && cm <= 1000 ? cm : null
}

/** "1.2 pounds", "350 g", "12.7 Ounces" -> kg. */
export function parseWeightText(text: unknown): number | null {
  if (typeof text !== 'string') return null
  const m = /(\d+(?:[.,]\d+)?)\s*(kilograms?|kgs?|grams?|g|pounds?|lbs?|ounces?|oz)\b/i.exec(text)
  return m ? toKg(m[1], m[2]) : null
}

/** "5.9 x 3.9 x 1.2 inches", "30 × 20 × 15 cm" -> cm. */
export function parseDimensionsText(text: unknown): Dims | null {
  if (typeof text !== 'string') return null
  const m = /(\d+(?:[.,]\d+)?)\s*(?:x|×|by)\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|by)\s*(\d+(?:[.,]\d+)?)\s*(centimet(?:er|re)s?|cm|millimeters?|mm|meters?|m|inch(?:es)?|in|")/i.exec(text)
  if (!m) return null
  const l = toCm(m[1], m[4]); const w = toCm(m[2], m[4]); const h = toCm(m[3], m[4])
  return l && w && h ? { length: l, width: w, height: h } : null
}

/** A weight given as {value, unit} or as free text. */
export function weightFrom(v: unknown): number | null {
  if (!v) return null
  if (typeof v === 'string') return parseWeightText(v)
  if (typeof v === 'object') { const o = v as Measure; return toKg(o.value, o.unit) ?? (typeof o.value === 'string' ? parseWeightText(o.value) : null) }
  return null
}

/** Dimensions given as {length,width,height,unit} or as free text. */
export function dimsFrom(v: unknown): Dims | null {
  if (!v) return null
  if (typeof v === 'string') return parseDimensionsText(v)
  if (typeof v === 'object') {
    const o = v as { length?: unknown; width?: unknown; height?: unknown; unit?: unknown; text?: unknown }
    const l = toCm(o.length, o.unit); const w = toCm(o.width, o.unit); const h = toCm(o.height, o.unit)
    if (l && w && h) return { length: l, width: w, height: h }
    return parseDimensionsText(o.text)
  }
  return null
}

/** Exchange rates to USD from the settings (USD itself is 1). A plain number is read as the EUR rate. */
export type Rates = number | { EUR?: number; CNY?: number }

/** Price in USD from a price and its currency (USD, EUR and CNY are converted, with the rates from the settings). */
export function priceToUsd(price: unknown, currency: unknown, rates: Rates): { usd: number | null; warning?: string } {
  const n = num(price)
  if (n === null || n <= 0 || n > 1_000_000) return { usd: null, warning: 'price_missing' }
  const c = String(currency ?? 'USD').trim().toUpperCase()
  const r = typeof rates === 'number' ? { EUR: rates } : rates
  if (c === 'USD' || c === '$' || c === 'US$') return { usd: round(n, 2) }
  if ((c === 'EUR' || c === '€') && r.EUR) return { usd: round(n * r.EUR, 2) }
  if ((c === 'CNY' || c === 'RMB' || c === '¥' || c === '￥' || c === 'CN¥') && r.CNY) return { usd: round(n * r.CNY, 2) }
  return { usd: null, warning: `currency_${c || 'unknown'}` }
}

export interface Ladder {
  /** Minimum order quantity read from the page (the first range of the ladder), or null. */
  moq: number | null
  /** Price of the first range: the regular unit price below the next range. */
  base_usd: number | null
  /** The following ranges: from `min_qty` units, a lower unit price. */
  tiers: Array<{ min_qty: number; price_usd: number }>
}

/**
 * Wholesale quantity ladder ("50-99 pcs $5.20, 100-499 pcs $4.80, 500+ pcs $4.20"): the first range gives the minimum order
 * and the base price, the others become price tiers. Only ranges whose price really goes down are kept.
 */
export function normalizeLadder(raw: unknown, moqRaw: unknown, fallbackCurrency: string, rates: Rates): Ladder {
  const rows = (Array.isArray(raw) ? raw : []).slice(0, 12).flatMap((t) => {
    const o = (t ?? {}) as Record<string, unknown>
    const min = num(o.min_qty)
    const usd = priceToUsd(o.price, o.currency || fallbackCurrency, rates).usd
    return min !== null && Number.isInteger(min) && min >= 1 && min <= 10_000_000 && usd !== null ? [{ min_qty: min, price_usd: usd }] : []
  }).sort((a, b) => a.min_qty - b.min_qty)
  const kept: typeof rows = []
  for (const r of rows) {
    const last = kept[kept.length - 1]
    if (!last) kept.push(r)
    else if (r.min_qty > last.min_qty && r.price_usd < last.price_usd) kept.push(r)
  }
  const m = num(moqRaw)
  const moqOwn = m !== null && Number.isInteger(m) && m >= 1 && m <= 10_000_000 ? m : null
  if (kept.length === 0) return { moq: moqOwn, base_usd: null, tiers: [] }
  return { moq: kept[0].min_qty, base_usd: kept[0].price_usd, tiers: kept.slice(1, 8) }
}

/** Control characters and invisible separators (zero-width, line/paragraph separators, BOM). */
const isJunk = (c: number) => c <= 8 || c === 11 || c === 12 || (c >= 14 && c <= 31) || c === 127 || (c >= 8203 && c <= 8207) || c === 8232 || c === 8233 || c === 65279

/** One-line/multi-line text without control characters or invisible junk, truncated. */
export function cleanText(v: unknown, max: number, keepNewlines = false): string {
  if (typeof v !== 'string') return ''
  let s = Array.from(v).filter((ch) => !isJunk(ch.charCodeAt(0))).join('')
  s = keepNewlines ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ')
  return s.trim().slice(0, max)
}

export interface Spec { name: string; value: string }
/** Specification table -> {name: value}, bounded in size. */
export function cleanSpecs(list: unknown, max = 30): Record<string, string> {
  const out: Record<string, string> = {}
  if (!Array.isArray(list)) return out
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const name = cleanText((item as Spec).name, 60)
    const value = cleanText((item as Spec).value, 200)
    if (name && value && !(name in out)) out[name] = value
    if (Object.keys(out).length >= max) break
  }
  return out
}

export interface AiResult {
  name_fr: string; name_en: string
  description_fr: string; description_en: string
  category: string | null
  tags_fr: string[]; tags_en: string[]
  estimated_package: { weight_kg: number; length_cm: number; width_cm: number; height_cm: number } | null
  /** Variant labels translated, keyed by the original label. */
  labels: Record<string, { fr: string; en: string }>
}

const strList = (v: unknown, n: number, len: number) =>
  (Array.isArray(v) ? v : []).map((x) => cleanText(x, len)).filter(Boolean).slice(0, n)

/** [{src, fr, en}] -> {src: {fr, en}}, bounded (the model output is untrusted). */
function cleanLabels(v: unknown): Record<string, { fr: string; en: string }> {
  const out: Record<string, { fr: string; en: string }> = {}
  if (!Array.isArray(v)) return out
  for (const item of v.slice(0, 120)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const src = cleanText(o.src, 120)
    const fr = cleanText(o.fr, 120); const en = cleanText(o.en, 120)
    if (src && (fr || en) && !(src in out)) out[src] = { fr: fr || en, en: en || fr }
  }
  return out
}

/** The model output is untrusted: keep only well-formed, bounded values. */
export function validateAi(raw: unknown, allowedCategories: string[]): AiResult | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name_fr = cleanText(o.name_fr, 200)
  const name_en = cleanText(o.name_en, 200)
  if (!name_fr && !name_en) return null
  const wanted = cleanText(o.category, 80).toLowerCase()
  const category = allowedCategories.find((c) => c.toLowerCase() === wanted) ?? null
  const p = o.estimated_package as Record<string, unknown> | null | undefined
  const w = toKg(p?.weight_kg, 'kg'); const l = toCm(p?.length_cm, 'cm'); const wi = toCm(p?.width_cm, 'cm'); const h = toCm(p?.height_cm, 'cm')
  return {
    name_fr: name_fr || name_en, name_en: name_en || name_fr,
    description_fr: cleanText(o.description_fr, 4000, true), description_en: cleanText(o.description_en, 4000, true),
    category,
    tags_fr: strList(o.tags_fr, 10, 40), tags_en: strList(o.tags_en, 10, 40),
    estimated_package: w && l && wi && h ? { weight_kg: w, length_cm: l, width_cm: wi, height_cm: h } : null,
    labels: cleanLabels(o.labels),
  }
}

/** The first JSON object found in a model reply (some models wrap it in ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{'); const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(body.slice(start, end + 1)) } catch { return null }
}

const tokens = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length >= 3))

/** Do two titles talk about the same product? True when they share at least one significant word (or one of them is empty). */
export function titlesAgree(a: string, b: string): boolean {
  const ta = tokens(a); const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return true
  for (const t of ta) if (tb.has(t)) return true
  return false
}

/** Titles of the pages shops show instead of a product: error, not found, robot check, sign-in. */
export function looksLikeErrorPage(title: string): boolean {
  const t = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return /\b(404|403|410|500|502|503)\b/.test(t)
    || /(page d'?erreur|error page|page not found|not found|introuvable|access denied|acces refuse|forbidden|captcha|are you a robot|verify you are human|unusual traffic|sign in|log in|se connecter|connexion requise|temporarily unavailable|oops)/.test(t)
}
