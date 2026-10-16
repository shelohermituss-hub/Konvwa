// Finds trending / best-selling Amazon products from Amazon's public ranking pages. Pure helpers (no Deno API): unit-tested with vitest.
// Only addresses built here are ever fetched (a fixed list of sources and departments), never an address typed by the user.

export const SOURCES = {
  movers: { label: 'Tendances du moment', path: 'gp/movers-and-shakers' },
  bestsellers: { label: 'Meilleures ventes', path: 'gp/bestsellers' },
  new: { label: 'Nouveautés populaires', path: 'gp/new-releases' },
} as const
export type SourceId = keyof typeof SOURCES

/** Alibaba has no public ranking: the best-matching products of a fixed list of popular searches are proposed instead. */
export const ALIBABA_TOPICS: Record<string, string> = {
  '': 'Produits populaires',
  'phone accessories': 'Accessoires téléphone',
  'led lights': 'Lampes et LED',
  'smart watch': 'Montres connectées',
  'earbuds': 'Écouteurs',
  'beauty tools': 'Beauté',
  'kitchen gadgets': 'Cuisine',
  'sports fitness': 'Sport et fitness',
  'pet products': 'Animaux',
  'baby products': 'Bébé',
  'car accessories': 'Auto et moto',
  'bags': 'Sacs',
  'jewelry': 'Bijoux',
  'toys': 'Jouets',
  'home decor': 'Décoration',
  'tools': 'Outils',
}

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
  if (source === 'alibaba') {
    if (!Object.hasOwn(ALIBABA_TOPICS, department)) return null
    const q = encodeURIComponent(department || 'hot selling products')
    return `https://www.alibaba.com/trade/search?SearchText=${q}&IndexArea=product_en&tab=all&viewtype=G`
  }
  if (!Object.hasOwn(SOURCES, source) || !Object.hasOwn(DEPARTMENTS, department)) return null
  const base = `https://www.amazon.com/${SOURCES[source as SourceId].path}`
  return department ? `${base}/${department}` : base
}

export interface Candidate {
  /** Amazon ASIN, or Alibaba product number: the key used to avoid proposing a product that is already in the shop. */
  asin: string
  platform: 'amazon' | 'alibaba'
  /** Tracking-free product page. */
  url: string
  title: string | null
  image: string | null
  rating: number | null
  reviews: number | null
  price_usd: number | null
  /** 1-based position on the page. */
  rank: number
}

/** Product details read by the page-understanding step (Firecrawl `json` format), matched to links by product number. */
export interface Structured { url?: unknown; title?: unknown; image_url?: unknown; price_usd?: unknown; rating?: unknown; reviews?: unknown }

const AMAZON_ID = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#]|$)/
const ALIBABA_ID = /^(?:https?:)?\/\/(?:[a-z]{2,10}\.)?alibaba\.com\/product-detail\/[^?#]*?_(\d{8,})\.html/i
const MIN_RATING = 4.0

function productRef(raw: string): { id: string; platform: Candidate['platform']; url: string } | null {
  const clean = raw.split('?')[0].split('#')[0]
  const am = AMAZON_ID.exec(clean)?.[1]
  if (am) return { id: am, platform: 'amazon', url: `https://www.amazon.com/dp/${am}` }
  const al = ALIBABA_ID.exec(clean)?.[1]
  if (al) return { id: al, platform: 'alibaba', url: clean.startsWith('//') ? `https:${clean}` : clean.replace(/^http:/, 'https:') }
  return null
}

const str = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}
const imageUrl = (v: unknown) => {
  const u = str(v, 600)?.replace(/^\/\//, 'https://')
  return u && /^https:\/\/[^\s]+$/.test(u) ? u : null
}

/**
 * Candidates in page order: every distinct product address found on the page (`links`), enriched with title, picture, stars, number of ratings
 * and price. Details come from `structured` (reliable) first, then from the page text (`markdown`). Amazon products rated below 4 stars are dropped.
 */
export function extractCandidates(links: unknown, markdown: unknown, max = 60, structured: unknown = []): Candidate[] {
  const text = typeof markdown === 'string' ? markdown : ''
  const byId = new Map<string, Structured>()
  const order: string[] = []
  for (const it of Array.isArray(structured) ? structured as Structured[] : []) {
    const ref = typeof it?.url === 'string' ? productRef(it.url) : null
    if (ref && !byId.has(ref.id)) { byId.set(ref.id, it); order.push(ref.url) }
  }
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const raw of [...(Array.isArray(links) ? links : []), ...order]) {
    if (typeof raw !== 'string') continue
    const ref = productRef(raw)
    if (!ref || seen.has(ref.id)) continue
    seen.add(ref.id)
    const s = byId.get(ref.id)
    // the product shows up several times on the page (picture, title, stars): read around every occurrence
    const spots: number[] = []
    for (let i = text.indexOf(ref.id); i >= 0 && spots.length < 6; i = text.indexOf(ref.id, i + 1)) spots.push(i)
    let title: string | null = null
    let at = spots[0] ?? -1
    for (const sp of spots) { title = titleBefore(text, sp); if (title) { at = sp; break } }
    let image: string | null = null
    for (const sp of spots) { image = imageAround(text, sp); if (image) break }
    const near = at >= 0 ? text.slice(at, at + 700) : ''
    const rating = num(s?.rating) ?? num(/(\d(?:\.\d)?) out of 5 stars/i.exec(near)?.[1])
    const reviews = num(s?.reviews) ?? num(/out of 5 stars[^\d]{0,60}([\d,]{1,9})/i.exec(near)?.[1]?.replace(/,/g, ''))
    const price = num(s?.price_usd) ?? num(/\$([\d,]+\.\d{2})/.exec(near)?.[1])
    out.push({
      asin: ref.id, platform: ref.platform, url: ref.url,
      title: str(s?.title, 200) ?? title ?? altAround(text, spots),
      image: imageUrl(s?.image_url) ?? image,
      rating: rating && rating <= 5 ? rating : null, reviews, price_usd: price, rank: out.length + 1,
    })
    if (out.length >= max) break
  }
  return out.filter((c) => c.platform !== 'amazon' || c.rating === null || c.rating >= MIN_RATING)
}

const IMG = /!\[[^\]]*\]\(\s*((?:https?:)?\/\/[^)\s]+?\.(?:jpe?g|png|webp)[^)\s]*)/i

/** The picture closest to a product's address in the page text. */
function imageAround(text: string, at: number): string | null {
  const m = IMG.exec(text.slice(Math.max(0, at - 450), at + 450))
  return m ? imageUrl(m[1]) : null
}

/** A readable picture caption near the product (ranking pages often use the product name as the picture's alt text). */
function altAround(text: string, spots: number[]): string | null {
  for (const at of spots) {
    const m = /!\[([^\]]{8,200})\]\(/.exec(text.slice(Math.max(0, at - 450), at + 450))
    const label = m?.[1].replace(/\s+/g, ' ').trim()
    if (label && !/^(?:image|photo|picture|product)\b/i.test(label)) return label
  }
  return null
}

/** The text of the markdown link whose address holds `at` ("[Some product title](https://…/dp/ASIN…)"). */
function titleBefore(text: string, at: number): string | null {
  const open = text.lastIndexOf('](', at)
  if (open < 0 || at - open > 120) return null
  const start = text.lastIndexOf('[', open)
  if (start < 0 || open - start > 400 || text[start - 1] === '!') return null // an image's alt text is not a title
  const label = text.slice(start + 1, open).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  return label.length >= 8 && !/^(?:\d+(?:\.\d)? out of)/i.test(label) ? label.slice(0, 200) : null
}
