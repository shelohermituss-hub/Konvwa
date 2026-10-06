/** One slot of a product feed: a product or a sponsored card. */
export type FeedEntry<T, A> = { kind: 'item'; item: T } | { kind: 'ad'; ad: A; slot: number }

/**
 * Sponsored cards among the products: one at the position `first`, then one every `every` products, each ad appearing only once in the feed
 * (when the ads run out, the rest of the feed is products only).
 * A slot depends only on the position of the product it precedes, so loading more products never moves what is already shown.
 */
export function withSponsored<T, A>(items: T[], ads: A[], every = 6, first = 3): Array<FeedEntry<T, A>> {
  const out: Array<FeedEntry<T, A>> = []
  items.forEach((item, i) => {
    if (i >= first && (i - first) % every === 0) {
      const slot = (i - first) / every
      if (slot < ads.length) out.push({ kind: 'ad', ad: ads[slot], slot })
    }
    out.push({ kind: 'item', item })
  })
  return out
}
