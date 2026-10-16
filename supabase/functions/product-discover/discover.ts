// Finds trending / best-selling Amazon products from Amazon's public ranking pages. Pure helpers (no Deno API): unit-tested with vitest.
// Only addresses built here are ever fetched (a fixed list of sources and departments), never an address typed by the user.

export const SOURCES = {
  movers: { label: 'Tendances du moment', path: 'gp/movers-and-shakers' },
  bestsellers: { label: 'Meilleures ventes', path: 'gp/bestsellers' },
  new: { label: 'Nouveautés populaires', path: 'gp/new-releases' },
} as const
export type SourceId = keyof typeof SOURCES

/** Amazon.com departments (slug used in the ranking address). '' = all departments. */
export const DEPARTMENTS: Record<string, string> = {
  '': 'Tous les rayons',
  electronics: 'Électronique',
  beauty: 'Beauté',
  hpc: 'Santé et soins personnels',
  'home-garden': 'Maison et jardin',
  kitchen: 'Cuisine',
  'sporting-goods': 'Sports et plein air',
  'toys-and-games': 'Jouets et jeux',
  fashion: 'Mode',
  automotive: 'Auto et moto',
  'pet-supplies': 'Animaux',
  'baby-products': 'Bébé',
  'office-products': 'Bureau',
  hi: 'Bricolage et outils',
  videogames: 'Jeux vidéo',
  'arts-crafts': 'Loisirs créatifs',
  'musical-instruments': 'Instruments de musique',
}

export function discoverUrl(source: string, department: string): string | null {
  if (!Object.hasOwn(SOURCES, source) || !Object.hasOwn(DEPARTMENTS, department)) return null
  const base = `https://www.amazon.com/${SOURCES[source as SourceId].path}`
  return department ? `${base}/${department}` : base
}

export interface Candidate {
  asin: string
  /** Tracking-free product page. */
  url: string
  title: string | null
  rating: number | null
  reviews: number | null
  price_usd: number | null
  /** 1-based position on the ranking page. */
  rank: number
}

const ASIN_IN_LINK = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#]|$)/
const MIN_RATING = 4.0

/**
 * Candidates in ranking order: every distinct product address found on the page (`links`), enriched from the page text (`markdown`) with
 * title, stars, number of ratings and price when they can be read next to the product. Products rated below 4 stars are dropped.
 */
export function extractCandidates(links: unknown, markdown: unknown, max = 60): Candidate[] {
  const text = typeof markdown === 'string' ? markdown : ''
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const raw of Array.isArray(links) ? links : []) {
    if (typeof raw !== 'string') continue
    const asin = ASIN_IN_LINK.exec(raw.split('?')[0])?.[1]
    if (!asin || seen.has(asin)) continue
    seen.add(asin)
    // the product shows up several times on the page (picture, title, stars): the occurrence that carries the title is the one read
    let at = text.indexOf(`/dp/${asin}`)
    let title: string | null = null
    for (let from = at; from >= 0 && !title; from = text.indexOf(`/dp/${asin}`, from + 1)) {
      title = titleBefore(text, from)
      if (title) at = from
    }
    const near = at >= 0 ? text.slice(at, at + 700) : ''
    const rating = /(\d(?:\.\d)?) out of 5 stars/i.exec(near)?.[1]
    const reviews = /out of 5 stars[^\d]{0,60}([\d,]{1,9})/i.exec(near)?.[1]
    const price = /\$([\d,]+\.\d{2})/.exec(near)?.[1]
    out.push({
      asin, url: `https://www.amazon.com/dp/${asin}`, title,
      rating: rating ? Number(rating) : null,
      reviews: reviews ? Number(reviews.replace(/,/g, '')) : null,
      price_usd: price ? Number(price.replace(/,/g, '')) : null,
      rank: out.length + 1,
    })
    if (out.length >= max) break
  }
  return out.filter((c) => c.rating === null || c.rating >= MIN_RATING)
}

/** The text of the markdown link whose address holds `at` ("[Some product title](https://…/dp/ASIN…)"). */
function titleBefore(text: string, at: number): string | null {
  const open = text.lastIndexOf('](', at)
  if (open < 0 || at - open > 40) return null
  const start = text.lastIndexOf('[', open)
  if (start < 0 || open - start > 400 || text[start - 1] === '!') return null // an image's alt text is not a title
  const label = text.slice(start + 1, open).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  return label.length >= 8 && !/^(?:\d+(?:\.\d)? out of)/i.test(label) ? label.slice(0, 200) : null
}
