// The visual card posted on Facebook / Instagram, drawn on a canvas in the browser (a JPEG: Instagram takes nothing else).
// The drawing itself is shared with the server (daily automatic posts): see poster-draw.ts.
import { tr } from '@/lib/i18n'
import { assetPath } from '@/lib/social-assets'
import { CARD_H, CARD_W, drawInfoPoster, drawPoster, type CardInput, type InfoInput } from '@/lib/poster-draw'

export { CARD_STYLES, INFO_LAYOUTS, type CardInput, type InfoInput, type InfoLayout } from '@/lib/poster-draw'

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

async function drawn(draw: (c: CanvasRenderingContext2D) => void | Promise<void>): Promise<Blob> {
  try { await Promise.all([document.fonts.load(`800 48px Poppins`), document.fonts.load(`700 28px Poppins`), document.fonts.load(`600 28px Poppins`), document.fonts.load(`500 28px Poppins`)]) } catch { /* the fallback font is fine */ }
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W; canvas.height = CARD_H
  const c = canvas.getContext('2d')
  if (!c) throw new Error('canvas')
  await draw(c)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.93))
}

export const renderProductCard = (i: CardInput): Promise<Blob> => drawn(async (c) => {
  const [main, ...rest] = await Promise.all(i.images.slice(0, 4).map(loadImage))
  drawPoster(c, i, main, rest.filter((t): t is HTMLImageElement => !!t), { tr })
})

/** The information poster (event, explainer, news, promo) of the editorial calendar over its stock photo `asset` (served by the site itself): the same drawing as the server's. */
export const renderInfoCard = (i: InfoInput, asset: string | null): Promise<Blob> => drawn(async (c) => {
  const photo = asset ? await loadImage(assetPath(asset)) : null
  drawInfoPoster(c, i, photo, { tr })
})
