import type { ReactNode } from 'react'
import { MasonryGrid } from '@/components/shared/masonry-grid'
import { SponsoredCard, useFeedAds } from '@/components/shared/sponsored-card'
import { withSponsored, type FeedEntry } from '@/lib/sponsored'
import type { Ad } from '@/components/shared/ad-banners'

/** The two-column product feed, with sponsored cards (same look as the products) mixed in. */
export function ProductFeed<T extends { id: string }>({ products, render }: { products: T[]; render: (product: T) => ReactNode }) {
  const ads = useFeedAds()
  const entries = withSponsored(products, ads)
  return (
    <MasonryGrid<FeedEntry<T, Ad>>
      items={entries}
      getKey={(e) => (e.kind === 'ad' ? `ad-${e.ad.id}-${e.slot}` : e.item.id)}
      render={(e) => (e.kind === 'ad' ? <SponsoredCard ad={e.ad} /> : render(e.item))}
    />
  )
}
