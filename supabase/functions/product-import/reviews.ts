// Customer reviews read from the supplier page (Amazon, Muscle & Strength) turned into clean rows. Pure: unit-tested with vitest.

export interface ImportedReview { author: string; rating: number; title: string; text: string; date: string | null }

const MAX_REVIEWS = 20

const clean = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v : '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** An ISO date (yyyy-mm-dd) when the page gave a real past date, null otherwise. */
function isoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const t = Date.parse(v)
  if (!Number.isFinite(t) || t > Date.now()) return null
  const d = new Date(t)
  return d.getUTCFullYear() < 2000 ? null : d.toISOString().slice(0, 10)
}

/** Keeps only well-formed reviews: a rating from 1 to 5 and a text or a title; no markup; no duplicate; at most 20. */
export function normalizeReviews(raw: unknown): ImportedReview[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ImportedReview[] = []
  for (const item of raw.slice(0, 60)) {
    const o = (item ?? {}) as Record<string, unknown>
    const rating = Math.round(Number(o.rating))
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue
    const title = clean(o.title, 160)
    const text = clean(o.text, 1500)
    if (!text && !title) continue
    const author = clean(o.author, 80) || 'Client'
    const key = `${author.toLowerCase()}|${(text || title).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ author, rating, title, text, date: isoDate(o.date) })
    if (out.length >= MAX_REVIEWS) break
  }
  return out
}
