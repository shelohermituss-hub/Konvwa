// Finds trending / best-selling products: Amazon's public ranking pages, Alibaba searches, Muscle & Strength's "best of" pages and Neewer's own
// best-seller collections. Pure helpers (no Deno API): unit-tested with vitest.
// Only addresses built here are ever fetched (a fixed list of sources and departments), never an address typed by the user.

export const SOURCES = {
  movers: { label: 'Tendances du moment', path: 'gp/movers-and-shakers' },
  bestsellers: { label: 'Meilleures ventes', path: 'gp/bestsellers' },
  new: { label: 'Nouveautés populaires', path: 'gp/new-releases' },
} as const
export type SourceId = keyof typeof SOURCES

/** Precise product categories: search terms read on Amazon (best rated first) or Alibaba (best matches). '' = popular products. */
export const SEARCH_TOPICS: Record<string, string> = {
  '': 'Produits populaires',
  // Téléphones et accessoires
  "smartphone unlocked": "Smartphones",
  "iphone case": "Coques de téléphone",
  "phone charger fast charging": "Chargeurs de téléphone",
  "phone screen protector": "Protections d'écran",
  "power bank": "Batteries externes",
  "car phone mount": "Supports téléphone auto",
  "selfie stick tripod": "Perches et trépieds",
  // Ordinateurs et tablettes
  "laptop": "Laptops",
  "gaming laptop": "Laptops gaming",
  "chromebook": "Chromebooks",
  "tablet": "Tablettes",
  "kids tablet": "Tablettes enfants",
  "monitor": "Écrans d'ordinateur",
  "computer keyboard": "Claviers",
  "computer mouse": "Souris",
  "laptop backpack": "Sacs pour laptop",
  "external hard drive ssd": "Disques durs et SSD",
  "usb flash drive": "Clés USB",
  "webcam": "Webcams",
  "wifi router": "Routeurs Wi-Fi",
  "printer": "Imprimantes",
  // Audio et vidéo
  "wireless earbuds": "Écouteurs sans fil",
  "headphones": "Casques audio",
  "bluetooth speaker": "Haut-parleurs Bluetooth",
  "smart watch": "Montres connectées",
  "microphone": "Microphones",
  "smart tv": "Télévisions",
  "projector": "Projecteurs",
  "tv stick streaming": "Clés streaming TV",
  // Photo, drones et sécurité
  "security camera": "Caméras de surveillance",
  "action camera": "Caméras sport",
  "drone": "Drones",
  "ring light": "Ring lights",
  "doorbell camera": "Sonnettes connectées",
  // Jeux vidéo
  "gaming console": "Consoles de jeu",
  "game controller": "Manettes",
  "gaming headset": "Casques gaming",
  "gaming chair": "Chaises gaming",
  // Maison et cuisine
  "air fryer": "Friteuses à air",
  "blender": "Blenders",
  "coffee maker": "Cafetières",
  "electric kettle": "Bouilloires",
  "rice cooker": "Cuiseurs à riz",
  "vacuum cleaner": "Aspirateurs",
  "robot vacuum": "Aspirateurs robots",
  "fan": "Ventilateurs",
  "led strip lights": "Rubans LED",
  "solar light": "Lampes solaires",
  "portable generator": "Générateurs portables",
  "storage organizer": "Rangements",
  "bedding set": "Linge de lit",
  "water bottle": "Gourdes",
  // Beauté et soins
  "hair dryer": "Sèche-cheveux",
  "hair straightener": "Lisseurs",
  "electric shaver": "Rasoirs électriques",
  "beard trimmer": "Tondeuses barbe",
  "makeup brush set": "Pinceaux maquillage",
  "skincare serum": "Sérums visage",
  "perfume": "Parfums",
  "nail kit": "Manucure",
  // Mode et accessoires
  "women sneakers": "Baskets femme",
  "men sneakers": "Baskets homme",
  "backpack": "Sacs à dos",
  "handbag": "Sacs à main",
  "sunglasses": "Lunettes de soleil",
  "men watch": "Montres homme",
  "women jewelry": "Bijoux femme",
  // Bébé, animaux, sport
  "baby stroller": "Poussettes",
  "baby monitor": "Babyphones",
  "dog bed": "Lits pour chien",
  "cat litter box": "Litières",
  "yoga mat": "Tapis de yoga",
  "dumbbell set": "Haltères",
  "bicycle": "Vélos",
  // Auto, outils, jouets
  "car vacuum": "Aspirateurs auto",
  "dash cam": "Dashcams",
  "tool set": "Caisses à outils",
  "cordless drill": "Perceuses",
  "lego": "Jouets de construction",
  "rc car": "Voitures télécommandées",
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
  wireless: 'Téléphones et accessoires',
  pc: 'Ordinateurs et accessoires',
  photo: 'Photo et caméras',
  appliances: 'Électroménager',
  'lawn-garden': 'Jardin et extérieur',
  jewelry: 'Bijoux',
  watches: 'Montres',
  shoes: 'Chaussures',
  luggage: 'Bagagerie',
  industrial: 'Industrie et sciences',
}

/** Muscle & Strength ranking pages of the store ('' = the top 50): the id is the page's address. */
export const MS_PAGES: Record<string, string> = {
  '': 'Top 50 des ventes',
  'best-protein-supplements': 'Protéines',
  'best-pre-workouts': 'Pré-workout',
  'best-creatine': 'Créatine',
  'best-bcaas': 'BCAA',
  'best-weight-gainers': 'Prise de masse',
  'best-protein-bars': 'Barres protéinées',
  'best-womens': 'Pour les femmes',
}

/** Neewer collections kept by the shop itself ('' = its daily top sellers): the id is the collection's handle. */
export const NEEWER_COLLECTIONS: Record<string, string> = {
  '': 'Top ventes du jour',
  'best-selling': 'Meilleures ventes',
  'top-50-products': 'Top produits',
  'hot-sale-1': 'Promos du moment',
  'new-releases': 'Nouveautés',
  'featured-products': 'Produits vedettes',
}

export function discoverUrl(source: string, department: string): string | null {
  if (source === 'muscle_strength') return Object.hasOwn(MS_PAGES, department) ? `https://www.muscleandstrength.com/store/${department || 'top-sellers'}` : null
  // any collection of the shop: its handle (letters, digits, dashes) is the only part taken from the caller
  if (source === 'neewer') return /^(?:[a-z0-9][a-z0-9-]{0,79})?$/.test(department) ? `https://neewer.com/collections/${department || 'top-daily-seller'}/products.json?limit=60` : null
  if (source === 'alibaba' || source === 'amazon_search') {
    if (!Object.hasOwn(SEARCH_TOPICS, department)) return null
    if (source === 'alibaba') return `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(department || 'hot selling products')}&IndexArea=product_en&tab=all&viewtype=G`
    // Amazon search: 4 stars & up (p_72), most popular first
    return `https://www.amazon.com/s?k=${encodeURIComponent(department || 'best sellers')}&rh=p_72%3A1248879011&s=exact-aware-popularity-rank`
  }
  if (!Object.hasOwn(SOURCES, source) || !Object.hasOwn(DEPARTMENTS, department)) return null
  const base = `https://www.amazon.com/${SOURCES[source as SourceId].path}`
  return department ? `${base}/${department}` : base
}

export interface Candidate {
  /** Amazon ASIN, Alibaba product number, Muscle & Strength page name or Neewer handle: the key used to avoid proposing a product that is already in the shop. */
  asin: string
  platform: 'amazon' | 'alibaba' | 'muscle_strength' | 'neewer'
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
const MS_ID = /^https?:\/\/(?:www\.)?muscleandstrength\.com\/store\/([a-z0-9][a-z0-9-]*)\.html$/i
const MIN_RATING = 4.0

function productRef(raw: string): { id: string; platform: Candidate['platform']; url: string } | null {
  const clean = raw.split('?')[0].split('#')[0]
  const am = AMAZON_ID.exec(clean)?.[1]
  if (am) return { id: am, platform: 'amazon', url: `https://www.amazon.com/dp/${am}` }
  const al = ALIBABA_ID.exec(clean)?.[1]
  if (al) return { id: al, platform: 'alibaba', url: clean.startsWith('//') ? `https:${clean}` : clean.replace(/^http:/, 'https:') }
  // a product page of the store is /store/<name>.html; categories, brands and reviews have more path segments
  const ms = MS_ID.exec(clean)?.[1]?.toLowerCase()
  if (ms) return { id: ms, platform: 'muscle_strength', url: `https://www.muscleandstrength.com/store/${ms}.html` }
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

/**
 * Neewer (Shopify): the products of one of its collections (`/collections/<handle>/products.json`), in the shop's own order.
 * Products with no variant in stock are dropped; the price is the lowest one of the variants in stock.
 */
export function neewerCandidates(raw: unknown, max = 60): Candidate[] {
  const out: Candidate[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    const p = (item ?? {}) as Record<string, unknown>
    const handle = typeof p.handle === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(p.handle) ? p.handle : null
    const inStock = (Array.isArray(p.variants) ? p.variants : []).filter((v) => (v as Record<string, unknown> | null)?.available === true)
    if (!handle || inStock.length === 0) continue
    const prices = inStock.map((v) => num((v as Record<string, unknown>).price)).filter((n): n is number => n !== null)
    const first = Array.isArray(p.images) ? (p.images[0] as Record<string, unknown> | undefined) : undefined
    out.push({
      asin: handle, platform: 'neewer', url: `https://neewer.com/products/${handle}`,
      title: str(p.title, 200), image: imageUrl(first?.src), rating: null, reviews: null,
      price_usd: prices.length ? Math.min(...prices) : null, rank: out.length + 1,
    })
    if (out.length >= max) break
  }
  return out
}

/** SQL `ilike` pattern that finds the shop product coming from this candidate (by its source address). A shorter name must not match a longer one (mutant-whey / mutant-whey-isolate). */
export function knownPattern(c: Candidate): string {
  return c.platform === 'muscle_strength' ? `%/store/${c.asin}.html` : c.platform === 'neewer' ? `%/products/${c.asin}` : `%${c.asin}%`
}

/** Is this source address the one of the candidate? (same rule as `knownPattern`) */
export function isKnown(sourceUrl: string | null, c: Candidate): boolean {
  if (!sourceUrl) return false
  const u = sourceUrl.toLowerCase()
  return c.platform === 'muscle_strength' ? u.endsWith(`/store/${c.asin}.html`) : c.platform === 'neewer' ? u.endsWith(`/products/${c.asin}`) : sourceUrl.includes(c.asin)
}
