import type { FeedItem } from '@/lib/catalog'

/** One random seed per visit: the order is new each visit but stays the same while browsing (back button, filters, scroll restoration). */
const SEED = (() => {
  try {
    const saved = sessionStorage.getItem('konvwa-feed-seed')
    if (saved) return Number(saved) >>> 0
    const fresh = Math.floor(Math.random() * 2 ** 32) >>> 0
    sessionStorage.setItem('konvwa-feed-seed', String(fresh))
    return fresh
  } catch {
    return Math.floor(Math.random() * 2 ** 32) >>> 0
  }
})()

/** A number in [0, 1) that depends only on the seed and the text: the same card always gets the same one. */
export function seededUnit(seed: number, text: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0
  return ((h ^ (h >>> 15)) >>> 0) / 2 ** 32
}

/** Featured products get a head start: they tend to come first without being pinned. */
const FEATURED_BONUS = 0.35

/**
 * Keeps every card at least `gap` places away from another card of the same product when the list allows it.
 * Cards come in the given (random) order; a product only jumps the queue when its remaining cards would no longer fit.
 */
export function spreadSiblings<T>(items: T[], productOf: (item: T) => string, gap = 4): T[] {
  const rest = [...items]
  const left = new Map<string, number>()
  for (const item of rest) left.set(productOf(item), (left.get(productOf(item)) ?? 0) + 1)
  const out: T[] = []
  while (rest.length > 0) {
    const recent = new Set(out.slice(-gap).map(productOf))
    const free = (item: T) => !recent.has(productOf(item))
    // a product with n cards left needs (n - 1) * (gap + 1) + 1 places: when that is all that remains, it goes first
    const urgent = rest.findIndex((item) => free(item) && ((left.get(productOf(item)) ?? 1) - 1) * (gap + 1) + 1 >= rest.length && (left.get(productOf(item)) ?? 1) > 1)
    const at = urgent >= 0 ? urgent : rest.findIndex(free)
    const [next] = rest.splice(at < 0 ? 0 : at, 1)
    left.set(productOf(next), (left.get(productOf(next)) ?? 1) - 1)
    out.push(next)
  }
  return out
}

/** Random but stable order of the feed cards, the cards of one product being kept apart. */
export function feedOrder(items: FeedItem[], seed = SEED): FeedItem[] {
  const keyed = items.map((item) => ({ item, key: seededUnit(seed, item.feed_key) - (item.featured ? FEATURED_BONUS : 0) }))
  keyed.sort((a, b) => a.key - b.key)
  return spreadSiblings(keyed.map((k) => k.item), (item) => item.id)
}

/** Same as `feedOrder` for a list loaded page by page: each page is ordered on its own, so what is already on screen never moves. */
export function feedOrderByPage<T extends { id: string }>(
  products: T[], pageSize: number, expand: (page: T[]) => FeedItem[], seed = SEED,
): FeedItem[] {
  const out: FeedItem[] = []
  for (let i = 0; i < products.length; i += pageSize) out.push(...feedOrder(expand(products.slice(i, i + pageSize)), seed))
  return out
}
