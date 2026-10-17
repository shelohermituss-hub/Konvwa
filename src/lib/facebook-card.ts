// The visual card posted on Facebook (1080x1350, the 4:5 feed format), drawn on a canvas in the browser from the product's own data.
import { tr } from '@/lib/i18n'

export interface CardInput {
  name: string
  priceHtg: number
  /** Old (struck) price, when the product has a discount. */
  strikeHtg: number | null
  discountPct: number | null
  /** Product pictures: the first is the big one, the next ones (up to 3) are shown as thumbnails. */
  images: string[]
  deliveryMin: number | null
  deliveryMax: number | null
  verified: boolean
}

const W = 1080
const H = 1350
const NAVY = '#0A1628'
const ORANGE = '#F05A28'
const FONT = 'Poppins, system-ui, sans-serif'

const htg = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} HTG`

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

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect(x, y, w, h, r)
}

/** The picture centred and fully visible (never cropped) inside a box. */
function drawContain(c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s; const dh = img.naturalHeight * s
  c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/** At most `maxLines` lines of `text` that fit `width`; the last one ends with an ellipsis when the text is longer. */
function wrap(c: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]
    if (c.measureText(next).width <= width || !cur) { cur = next; continue }
    lines.push(cur); cur = words[i]
    if (lines.length === maxLines - 1) { cur = words.slice(i).join(' '); break }
  }
  if (cur) lines.push(cur)
  const last = lines[maxLines - 1]
  if (lines.length === maxLines && last) {
    let t = last
    while (t.length > 1 && c.measureText(`${t}…`).width > width && (lines[maxLines - 1] !== t || c.measureText(t).width > width)) t = t.slice(0, -1)
    lines[maxLines - 1] = c.measureText(last).width > width || words.join(' ') !== lines.join(' ') ? `${t.trimEnd()}…` : last
  }
  return lines.slice(0, maxLines)
}

export async function renderProductCard(i: CardInput): Promise<Blob> {
  try { await Promise.all([document.fonts.load(`700 48px Poppins`), document.fonts.load(`500 28px Poppins`)]) } catch { /* the fallback font is fine */ }
  const [main, ...rest] = await Promise.all(i.images.slice(0, 4).map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')
  if (!c) throw new Error('canvas')

  // background: navy with a warm glow
  const bg = c.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#12233f'); bg.addColorStop(1, NAVY)
  c.fillStyle = bg; c.fillRect(0, 0, W, H)
  const glow = c.createRadialGradient(W - 80, 60, 10, W - 80, 60, 520)
  glow.addColorStop(0, 'rgba(240,90,40,0.38)'); glow.addColorStop(1, 'rgba(240,90,40,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)

  // header
  c.textBaseline = 'alphabetic'
  c.fillStyle = ORANGE; c.font = `700 46px ${FONT}`; c.textAlign = 'left'
  c.fillText('KONVWA', 60, 96)
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `500 26px ${FONT}`; c.textAlign = 'right'
  c.fillText(tr('Importation Haïti'), W - 60, 94)

  // photo panel
  const px = 60; const py = 130; const pw = W - 120; const ph = 620
  c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 40; c.shadowOffsetY = 16
  c.fillStyle = '#ffffff'; roundRect(c, px, py, pw, ph, 36); c.fill(); c.restore()
  if (main) {
    c.save(); roundRect(c, px, py, pw, ph, 36); c.clip()
    drawContain(c, main, px + 28, py + 28, pw - 56, ph - 56)
    c.restore()
  }
  if (i.discountPct) {
    c.fillStyle = ORANGE; c.beginPath(); c.arc(px + 100, py + 100, 74, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `700 48px ${FONT}`
    c.fillText(`-${i.discountPct}%`, px + 100, py + 118)
  }

  // thumbnails of the other pictures
  const thumbs = rest.filter((t): t is HTMLImageElement => !!t).slice(0, 3)
  if (thumbs.length > 0) {
    const ts = 112; const gap = 18
    thumbs.forEach((t, n) => {
      const tx = px + n * (ts + gap); const ty = py + ph + 20
      c.fillStyle = '#ffffff'; roundRect(c, tx, ty, ts, ts, 22); c.fill()
      c.save(); roundRect(c, tx, ty, ts, ts, 22); c.clip(); drawContain(c, t, tx + 10, ty + 10, ts - 20, ts - 20); c.restore()
    })
  }

  // title
  const titleY = py + ph + (thumbs.length > 0 ? 20 + 112 + 58 : 72)
  c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.font = `700 48px ${FONT}`
  const lines = wrap(c, i.name, W - 120, 2)
  lines.forEach((l, n) => c.fillText(l, 60, titleY + n * 58))

  // price
  const priceY = titleY + (lines.length - 1) * 58 + 104
  c.fillStyle = ORANGE; c.font = `700 80px ${FONT}`
  c.fillText(htg(i.priceHtg), 60, priceY)
  if (i.strikeHtg) {
    const w = c.measureText(htg(i.priceHtg)).width
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = `500 38px ${FONT}`
    const t = htg(i.strikeHtg)
    c.fillText(t, 60 + w + 28, priceY - 4)
    const tw = c.measureText(t).width
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3
    c.beginPath(); c.moveTo(60 + w + 28, priceY - 16); c.lineTo(60 + w + 28 + tw, priceY - 16); c.stroke()
  }

  // chips
  const chips: string[] = []
  if (i.deliveryMin && i.deliveryMax) chips.push(`${tr('Livraison')} ${i.deliveryMin}-${i.deliveryMax} ${tr('jours')}`)
  if (i.verified) chips.push(tr('Fournisseur vérifié'))
  chips.push('MonCash · NatCash')
  c.font = `500 26px ${FONT}`
  let cx = 60; const cy = priceY + 36
  for (const label of chips) {
    const w = c.measureText(label).width + 36
    if (cx + w > W - 60) break
    c.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(c, cx, cy, w, 58, 29); c.fill()
    c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.fillText(label, cx + 18, cy + 38)
    cx += w + 14
  }

  // footer
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `500 28px ${FONT}`; c.textAlign = 'center'
  c.fillText('konvwa.shop', W / 2, H - 44)

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}
