// Pixabay source for `motion assets`: photos, illustrations, vectors (as transparent PNG) and video clips.
// The key comes from PIXABAY_API_KEY only; it travels in the URL, so every error message is scrubbed of it.
import { run } from './media.mjs'

const API = { image: 'https://pixabay.com/api/', video: 'https://pixabay.com/api/videos/' }
export const TYPES = ['photo', 'illustration', 'vector', 'video']
const ORIENTATION = { portrait: 'vertical', landscape: 'horizontal' }
/** 1080p is the smallest clip that still fills a 9:16 frame once cropped; bigger ones only weigh more. */
const VIDEO_SIZES = ['medium', 'large', 'small', 'tiny']

function checkType(type) {
  if (!TYPES.includes(type)) throw new Error(`type inconnu : ${type} (${TYPES.join(' | ')})`)
}

/** Search URL, or lookup by id when `id` is given. orientation is portrait | landscape and only exists for images in the API. */
export function searchUrl(key, query, { type = 'photo', orientation, perPage = 20, id } = {}) {
  checkType(type)
  const p = new URLSearchParams({ key, safesearch: 'true' })
  if (id != null) p.set('id', String(id))
  else { p.set('q', query.slice(0, 100)); p.set('per_page', String(Math.min(200, Math.max(3, perPage)))) }
  if (type !== 'video') { p.set('image_type', type); if (ORIENTATION[orientation]) p.set('orientation', ORIENTATION[orientation]) }
  return `${type === 'video' ? API.video : API.image}?${p}`
}

/** One API hit in the shape every source returns: what to download, its real size and who to credit. */
export function normalize(hit, asked = 'photo') {
  // A lookup by id ignores image_type: trust what the API says the hit is ("vector/svg", "illustration", "film"…).
  const type = asked === 'video' ? 'video' : TYPES.find((t) => String(hit.type || '').startsWith(t)) || asked
  const base = { source: 'pixabay', id: hit.id, type, page: hit.pageURL, author: hit.user, authorUrl: `https://pixabay.com/users/${hit.user_id}/`, tags: hit.tags || '', downloads: hit.downloads || 0, rejected: Boolean(hit.isAiGenerated || hit.isLowQuality) }
  if (type === 'video') {
    const v = VIDEO_SIZES.map((s) => hit.videos?.[s]).find((x) => x?.url)
    return v ? { ...base, url: v.url, ext: 'mp4', width: v.width, height: v.height, duration: hit.duration } : null
  }
  // largeImageURL is the original scaled down to 1280 px on its longest side (PNG with transparency for vectors).
  const k = Math.min(1, 1280 / Math.max(hit.imageWidth, hit.imageHeight))
  const url = hit.largeImageURL || hit.webformatURL
  return { ...base, url, ext: /\.png$/i.test(url) ? 'png' : 'jpg', width: Math.round(hit.imageWidth * k), height: Math.round(hit.imageHeight * k) }
}

/** Best first: AI-generated and low-quality media dropped, then the most portrait (for a 9:16 frame) or landscape, then the most downloaded. */
export function rank(items, { orientation = 'portrait' } = {}) {
  const ratio = (x) => Math.min(x.height / x.width, 2)
  const sign = orientation === 'landscape' ? -1 : orientation === 'portrait' ? 1 : 0
  return items.filter((x) => x && !x.rejected).sort((a, b) => sign * (ratio(b) - ratio(a)) || b.downloads - a.downloads)
}

function request(url, key) {
  const r = run('curl', ['-sS', '--fail', '--max-time', '30', url])
  if (!r.ok) throw new Error(`Pixabay ne répond pas (${r.err.replaceAll(key, '***').trim()})`)
  try { return JSON.parse(r.out).hits || [] } catch { throw new Error('réponse Pixabay illisible') }
}

function keyOrThrow(key) {
  if (!key) throw new Error('PIXABAY_API_KEY absente de l’environnement')
  return key
}

export function search(query, { type = 'photo', orientation = 'portrait', perPage = 20, key = process.env.PIXABAY_API_KEY } = {}) {
  keyOrThrow(key)
  if (!query.trim()) throw new Error('recherche vide')
  return rank(request(searchUrl(key, query, { type, orientation, perPage }), key).map((h) => normalize(h, type)), { orientation })
}

export function byId(id, { type = 'photo', key = process.env.PIXABAY_API_KEY } = {}) {
  keyOrThrow(key)
  if (!/^\d+$/.test(String(id))) throw new Error(`identifiant Pixabay invalide : ${id}`)
  const hit = request(searchUrl(key, '', { type, id }), key)[0]
  if (!hit) throw new Error(`Pixabay ${type} ${id} introuvable (vérifiez --type)`)
  return normalize(hit, type)
}
