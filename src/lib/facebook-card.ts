// The visual card posted on Facebook / Instagram, drawn on a canvas in the browser (a JPEG: Instagram takes nothing else).
// The drawing itself is shared with the server (daily automatic posts): see poster-draw.ts.
import { tr } from '@/lib/i18n'
import { CARD_H, CARD_W, drawPoster, type CardInput } from '@/lib/poster-draw'

export { CARD_STYLES, type CardInput } from '@/lib/poster-draw'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 15000)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); resolve(null) }
    img.src = src
  })
}

export async function renderProductCard(i: CardInput): Promise<Blob> {
  try { await Promise.all([document.fonts.load(`800 48px Poppins`), document.fonts.load(`700 28px Poppins`), document.fonts.load(`500 28px Poppins`)]) } catch { /* the fallback font is fine */ }
  const [main, ...rest] = await Promise.all(i.images.slice(0, 4).map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W; canvas.height = CARD_H
  const c = canvas.getContext('2d')
  if (!c) throw new Error('canvas')
  drawPoster(c, i, main, rest.filter((t): t is HTMLImageElement => !!t), { tr })
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.93))
}
