// The visual card posted on Facebook (1080x1350, the 4:5 feed format), drawn on a canvas in the browser from the product's own data.
// Light theme, four layouts (the shop picks one at random, or the admin chooses): same ingredients, different composition.
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
  /** Layout 0-3; random when omitted. */
  style?: number
}

export const CARD_STYLES = ['Studio', 'Cercle', 'Bandeau', 'Cadre'] as const

const W = 1080
const H = 1350
const INK = '#14181f'
const MUTED = '#5b6472'
const ORANGE = '#F05A28'
const NAVY = '#0A1628'
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

type Ctx = CanvasRenderingContext2D

const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r) }

function text(c: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') {
  c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic'
  c.fillText(s, x, y)
}

/** The picture centred and fully visible (never cropped) inside a box. `blend` makes a white photo background melt into the card. */
function contain(c: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, blend = false) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s; const dh = img.naturalHeight * s
  c.save()
  if (blend) c.globalCompositeOperation = 'multiply'
  c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  c.restore()
}

/** The largest font size (down to `min`) at which `s` fits `maxLines` lines of `width`; the lines, and a trailing ellipsis if it still does not fit. */
function fit(c: Ctx, s: string, width: number, maxLines: number, start: number, min: number, weight = 800): { lines: string[]; size: number } {
  const words = s.split(/\s+/).filter(Boolean)
  const lay = (size: number) => {
    c.font = `${weight} ${size}px ${FONT}`
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w
      if (c.measureText(next).width <= width || !cur) cur = next
      else { lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    return lines
  }
  for (let size = start; size >= min; size -= 4) {
    const lines = lay(size)
    if (lines.length <= maxLines && lines.every((l) => c.measureText(l).width <= width)) return { lines, size }
  }
  const lines = lay(min)
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1] ?? ''
  if (lines.length > maxLines || c.measureText(last).width > width) {
    while (last.length > 1 && c.measureText(`${last}…`).width > width) last = last.slice(0, -1)
    kept[kept.length - 1] = `${last.trimEnd()}…`
  }
  return { lines: kept, size: min }
}

function mark(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = ORANGE; rr(c, x, y, s, s, s * 0.26); c.fill()
  text(c, 'K', x + s / 2, y + s * 0.74, `800 ${Math.round(s * 0.62)}px ${FONT}`, '#fff', 'center')
}

/** Logo: orange mark + wordmark, centred on `x` or starting at it. */
function logo(c: Ctx, x: number, y: number, align: 'center' | 'left', size = 52) {
  c.font = `800 ${Math.round(size * 0.78)}px ${FONT}`
  const tw = c.measureText('KONVWA').width
  const total = size + 14 + tw
  const x0 = align === 'center' ? x - total / 2 : x
  mark(c, x0, y, size)
  text(c, 'KONVWA', x0 + size + 14, y + size * 0.76, `800 ${Math.round(size * 0.78)}px ${FONT}`, INK, 'left')
  text(c, tr('IMPORTATION HAÏTI'), align === 'center' ? x : x0, y + size + 28, `600 17px ${FONT}`, MUTED, align === 'center' ? 'center' : 'left')
}

function discountBadge(c: Ctx, cx: number, cy: number, r: number, pct: number) {
  c.save(); c.shadowColor = 'rgba(240,90,40,0.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8
  c.fillStyle = ORANGE; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.restore()
  text(c, `-${pct}%`, cx, cy + r * 0.3, `800 ${Math.round(r * 0.62)}px ${FONT}`, '#fff', 'center')
}

function features(i: CardInput): string[] {
  const f: string[] = []
  if (i.deliveryMin && i.deliveryMax) f.push(`${tr('Livraison')} ${i.deliveryMin}-${i.deliveryMax} ${tr('jours')}`)
  if (i.verified) f.push(tr('Fournisseur vérifié'))
  f.push('MonCash · NatCash')
  return f
}

/** A row of pill-shaped chips starting at x (or centred on x), wrapping nothing: chips that do not fit are dropped. */
function chips(c: Ctx, labels: string[], x: number, y: number, maxW: number, align: 'left' | 'center', fill: string, color: string, stroke?: string) {
  c.font = `600 26px ${FONT}`
  const widths = labels.map((l) => c.measureText(l).width + 40)
  const kept: number[] = []
  let total = 0
  widths.forEach((w, n) => { if (total + w + (kept.length ? 14 : 0) <= maxW) { kept.push(n); total += w + (kept.length > 1 ? 14 : 0) } })
  let cx = align === 'center' ? x - total / 2 : x
  for (const n of kept) {
    c.fillStyle = fill; rr(c, cx, y, widths[n], 56, 28); c.fill()
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; rr(c, cx, y, widths[n], 56, 28); c.stroke() }
    text(c, labels[n], cx + widths[n] / 2, y + 37, `600 26px ${FONT}`, color, 'center')
    cx += widths[n] + 14
  }
}

function price(c: Ctx, i: CardInput, x: number, y: number, align: CanvasTextAlign, size: number, color: string, strikeColor = MUTED) {
  text(c, htg(i.priceHtg), x, y, `800 ${size}px ${FONT}`, color, align)
  if (!i.strikeHtg) return
  const sz = Math.round(size * 0.46)
  c.font = `500 ${sz}px ${FONT}`
  const t = htg(i.strikeHtg); const tw = c.measureText(t).width
  c.font = `800 ${size}px ${FONT}`; const pw = c.measureText(htg(i.priceHtg)).width
  const sx = align === 'center' ? x + pw / 2 + 24 : align === 'right' ? x - pw - 24 - tw : x + pw + 24
  text(c, t, sx, y - size * 0.06, `500 ${sz}px ${FONT}`, strikeColor, 'left')
  c.strokeStyle = strikeColor; c.lineWidth = 3
  c.beginPath(); c.moveTo(sx, y - size * 0.06 - sz * 0.3); c.lineTo(sx + tw, y - size * 0.06 - sz * 0.3); c.stroke()
}

function thumbsRow(c: Ctx, imgs: HTMLImageElement[], x: number, y: number, size: number, gap: number, dir: 'row' | 'col' = 'row') {
  imgs.slice(0, 3).forEach((t, n) => {
    const tx = dir === 'row' ? x + n * (size + gap) : x; const ty = dir === 'row' ? y : y + n * (size + gap)
    c.save(); c.shadowColor = 'rgba(20,24,31,0.12)'; c.shadowBlur = 18; c.shadowOffsetY = 6
    c.fillStyle = '#fff'; rr(c, tx, ty, size, size, 22); c.fill(); c.restore()
    c.save(); rr(c, tx, ty, size, size, 22); c.clip(); contain(c, t, tx + 10, ty + 10, size - 20, size - 20); c.restore()
  })
}

function icon(c: Ctx, kind: 'globe' | 'card', x: number, y: number) {
  c.strokeStyle = INK; c.lineWidth = 3
  if (kind === 'globe') {
    c.beginPath(); c.arc(x + 17, y + 17, 17, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.ellipse(x + 17, y + 17, 7, 17, 0, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.moveTo(x, y + 17); c.lineTo(x + 34, y + 17); c.stroke()
  } else {
    rr(c, x, y + 3, 38, 28, 6); c.stroke()
    c.beginPath(); c.moveTo(x, y + 12); c.lineTo(x + 38, y + 12); c.stroke()
    c.beginPath(); c.moveTo(x + 6, y + 23); c.lineTo(x + 16, y + 23); c.stroke()
  }
}

/** The bottom band of the model: a grey label pill, then the contact line with its icons. */
function contactBand(c: Ctx, y: number) {
  c.fillStyle = '#4a4f57'; rr(c, W / 2 - 230, y, 460, 48, 24); c.fill()
  text(c, tr('Commandez maintenant sur'), W / 2, y + 32, `500 24px ${FONT}`, '#fff', 'center')
  icon(c, 'globe', 150, y + 74)
  text(c, 'konvwa.shop', 202, y + 102, `700 34px ${FONT}`, INK, 'left')
  icon(c, 'card', 620, y + 76)
  text(c, 'MonCash · NatCash', 672, y + 102, `700 34px ${FONT}`, INK, 'left')
}

function lightBackground(c: Ctx, tint = '#f6f7f9') {
  c.fillStyle = tint; c.fillRect(0, 0, W, H)
  const g = c.createRadialGradient(W / 2, 620, 40, W / 2, 620, 820)
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
}

/** Faint film-strip bands and soft corner discs, like the model's decorative background. */
function decor(c: Ctx) {
  const strip = (cx: number, cy: number, rot: number, w: number, len: number, col: string) => {
    c.save(); c.translate(cx, cy); c.rotate(rot)
    c.fillStyle = col; rr(c, -w / 2, -len / 2, w, len, 34); c.fill()
    c.fillStyle = '#f6f7f9'
    for (let k = -len / 2 + 50; k < len / 2 - 40; k += 78) { rr(c, -w / 2 + 16, k, 26, 38, 8); c.fill(); rr(c, w / 2 - 42, k, 26, 38, 8); c.fill() }
    c.restore()
  }
  strip(780, 760, -0.42, 230, 1500, 'rgba(225,229,235,0.75)')
  strip(150, 1000, 0.3, 200, 1100, 'rgba(232,235,240,0.6)')
  c.fillStyle = 'rgba(214,219,226,0.7)'; c.beginPath(); c.arc(40, 30, 120, 0, Math.PI * 2); c.fill()
  c.fillStyle = 'rgba(214,219,226,0.55)'; c.beginPath(); c.arc(W - 10, 640, 130, 0, Math.PI * 2); c.fill()
}

const headLabel = (i: CardInput) => (i.discountPct ? `${tr('Promo')} -${i.discountPct}%` : tr('Nouveau sur KONVWA'))

// ── Layout 1: Studio (the model) ─────────────────────────────────────────────────────────────────────────────
function studio(c: Ctx, i: CardInput, main: HTMLImageElement | null, thumbs: HTMLImageElement[]) {
  lightBackground(c); decor(c)
  logo(c, W / 2, 56, 'center', 54)
  text(c, headLabel(i), W / 2, 252, `700 54px ${FONT}`, INK, 'center')
  const t = fit(c, i.name, 940, 2, 96, 52)
  t.lines.forEach((l, n) => text(c, l, W / 2, 340 + n * t.size * 1.04, `800 ${t.size}px ${FONT}`, INK, 'center'))
  const endY = 340 + (t.lines.length - 1) * t.size * 1.04
  // the model's outlined service pill with its coloured label on the border
  const y0 = endY + 62; const h = 104
  c.fillStyle = 'rgba(255,255,255,0.92)'; rr(c, 110, y0, 860, h, 52); c.fill()
  c.strokeStyle = INK; c.lineWidth = 2.5; rr(c, 110, y0, 860, h, 52); c.stroke()
  c.fillStyle = ORANGE; rr(c, W / 2 - 120, y0 - 26, 240, 52, 26); c.fill()
  text(c, tr('Notre sélection'), W / 2, y0 + 9, `700 25px ${FONT}`, '#fff', 'center')
  const f = features(i)
  text(c, f.slice(0, 2).join('   |   '), W / 2, y0 + 56, `700 27px ${FONT}`, INK, 'center')
  text(c, f.length > 2 ? f[2] : 'konvwa.shop', W / 2, y0 + 91, `600 27px ${FONT}`, MUTED, 'center')
  // product
  const top = y0 + h + 24; const bottom = 1195
  if (main) contain(c, main, 130, top, 820, bottom - top, true)
  if (i.discountPct) discountBadge(c, 930, top + 70, 72, i.discountPct)
  thumbsRow(c, thumbs, 60, bottom - 3 * 108, 98, 10, 'col')
  const pw = (() => { c.font = `800 52px ${FONT}`; return c.measureText(htg(i.priceHtg)).width + 56 })()
  c.save(); c.shadowColor = 'rgba(240,90,40,0.3)'; c.shadowBlur = 22; c.shadowOffsetY = 8
  c.fillStyle = ORANGE; rr(c, W - 60 - pw, bottom - 84, pw, 84, 42); c.fill(); c.restore()
  text(c, htg(i.priceHtg), W - 60 - pw / 2, bottom - 26, `800 52px ${FONT}`, '#fff', 'center')
  if (i.strikeHtg) {
    c.font = `500 28px ${FONT}`; const s = htg(i.strikeHtg); const sw = c.measureText(s).width
    text(c, s, W - 60 - pw / 2, bottom - 100, `500 28px ${FONT}`, MUTED, 'center')
    c.strokeStyle = MUTED; c.lineWidth = 2.5; c.beginPath(); c.moveTo(W - 60 - pw / 2 - sw / 2, bottom - 109); c.lineTo(W - 60 - pw / 2 + sw / 2, bottom - 109); c.stroke()
  }
  contactBand(c, 1215)
}

// ── Layout 2: Cercle ─────────────────────────────────────────────────────────────────────────────────────────
function cercle(c: Ctx, i: CardInput, main: HTMLImageElement | null, thumbs: HTMLImageElement[]) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H)
  c.fillStyle = '#fff1ea'; c.beginPath(); c.arc(720, 820, 470, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#ffe3d7'; c.beginPath(); c.arc(720, 820, 340, 0, Math.PI * 2); c.fill()
  c.fillStyle = 'rgba(240,90,40,0.18)'
  for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) { c.beginPath(); c.arc(70 + a * 26, 1010 + b * 26, 4, 0, Math.PI * 2); c.fill() }
  logo(c, 60, 56, 'left', 54)
  text(c, headLabel(i).toUpperCase(), 60, 262, `700 34px ${FONT}`, ORANGE, 'left')
  const t = fit(c, i.name, 960, 3, 84, 48)
  t.lines.forEach((l, n) => text(c, l, 60, 340 + n * t.size * 1.08, `800 ${t.size}px ${FONT}`, INK, 'left'))
  if (main) contain(c, main, 400, 520, 640, 640, true)
  if (i.discountPct) discountBadge(c, 960, 560, 70, i.discountPct)
  // left column: price and chips
  let y = 640
  if (i.strikeHtg) {
    c.font = `500 30px ${FONT}`; const s = htg(i.strikeHtg); const sw = c.measureText(s).width
    text(c, s, 60, y, `500 30px ${FONT}`, MUTED, 'left')
    c.strokeStyle = MUTED; c.lineWidth = 2.5; c.beginPath(); c.moveTo(60, y - 10); c.lineTo(60 + sw, y - 10); c.stroke()
    y += 62
  } else y += 20
  text(c, htg(i.priceHtg).replace(' HTG', ''), 60, y, `800 76px ${FONT}`, ORANGE, 'left')
  text(c, 'HTG', 60, y + 44, `700 34px ${FONT}`, INK, 'left')
  y += 100
  features(i).forEach((f) => {
    c.font = `600 24px ${FONT}`; const w = Math.min(330, c.measureText(f).width + 36)
    c.fillStyle = '#f1f3f6'; rr(c, 60, y, w, 50, 25); c.fill()
    text(c, f, 60 + w / 2, y + 33, `600 24px ${FONT}`, INK, 'center')
    y += 62
  })
  thumbsRow(c, thumbs, 60, y + 10, 96, 12, 'row')
  c.fillStyle = INK; rr(c, 60, 1240, W - 120, 74, 37); c.fill()
  text(c, tr('Commandez sur konvwa.shop'), W / 2, 1288, `700 32px ${FONT}`, '#fff', 'center')
}

// ── Layout 3: Bandeau ────────────────────────────────────────────────────────────────────────────────────────
function bandeau(c: Ctx, i: CardInput, main: HTMLImageElement | null, thumbs: HTMLImageElement[]) {
  lightBackground(c, '#f2f4f7')
  c.fillStyle = ORANGE
  c.beginPath(); c.moveTo(0, 560); c.lineTo(W, 380); c.lineTo(W, 900); c.lineTo(0, 1090); c.closePath(); c.fill()
  c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.moveTo(0, 640); c.lineTo(W, 460); c.lineTo(W, 520); c.lineTo(0, 700); c.closePath(); c.fill()
  logo(c, W / 2, 50, 'center', 50)
  text(c, headLabel(i), W / 2, 232, `700 40px ${FONT}`, ORANGE, 'center')
  const t = fit(c, i.name, 940, 2, 80, 46)
  t.lines.forEach((l, n) => text(c, l, W / 2, 312 + n * t.size * 1.06, `800 ${t.size}px ${FONT}`, INK, 'center'))
  // product card over the band
  const cy = 420; const ch = 560
  c.save(); c.shadowColor = 'rgba(20,24,31,0.28)'; c.shadowBlur = 50; c.shadowOffsetY = 22
  c.fillStyle = '#fff'; rr(c, 120, cy, 840, ch, 44); c.fill(); c.restore()
  if (main) { c.save(); rr(c, 120, cy, 840, ch, 44); c.clip(); contain(c, main, 150, cy + 30, 780, ch - 60); c.restore() }
  if (i.discountPct) discountBadge(c, 130, cy + 10, 70, i.discountPct)
  if (thumbs.length) thumbsRow(c, thumbs, W / 2 - (thumbs.length * 84 + (thumbs.length - 1) * 14) / 2, cy + ch + 20, 84, 14, 'row')
  price(c, i, W / 2, 1200, 'center', 74, ORANGE)
  chips(c, features(i), W / 2, 1236, 940, 'center', '#fff', INK, '#d4d9e0')
}

// ── Layout 4: Cadre ──────────────────────────────────────────────────────────────────────────────────────────
function cadre(c: Ctx, i: CardInput, main: HTMLImageElement | null, thumbs: HTMLImageElement[]) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H)
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff7f3'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#f3f5f8')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  c.strokeStyle = ORANGE; c.lineWidth = 10; rr(c, 30, 30, W - 60, H - 60, 56); c.stroke()
  c.strokeStyle = 'rgba(240,90,40,0.25)'; c.lineWidth = 3; rr(c, 54, 54, W - 108, H - 108, 40); c.stroke()
  logo(c, W / 2, 82, 'center', 50)
  const t = fit(c, i.name, 880, 2, 72, 44)
  t.lines.forEach((l, n) => text(c, l, W / 2, 262 + n * t.size * 1.06, `800 ${t.size}px ${FONT}`, INK, 'center'))
  const top = 262 + (t.lines.length - 1) * t.size * 1.06 + 36
  if (main) contain(c, main, 130, top, 820, 950 - top, true)
  if (i.discountPct) discountBadge(c, 900, top + 60, 66, i.discountPct)
  if (thumbs.length) thumbsRow(c, thumbs, W / 2 - (thumbs.length * 84 + (thumbs.length - 1) * 12) / 2, 962, 84, 12, 'row')
  const py = 1150
  c.font = `800 62px ${FONT}`
  const tw = c.measureText(htg(i.priceHtg)).width + 70
  c.fillStyle = NAVY; rr(c, W / 2 - tw / 2 - (i.strikeHtg ? 120 : 0), py - 76, tw, 96, 48); c.fill()
  text(c, htg(i.priceHtg), W / 2 - (i.strikeHtg ? 120 : 0), py - 8, `800 62px ${FONT}`, '#fff', 'center')
  if (i.strikeHtg) {
    c.font = `500 34px ${FONT}`; const s = htg(i.strikeHtg); const sw = c.measureText(s).width
    const sx = W / 2 - 120 + tw / 2 + 22
    text(c, s, sx, py - 14, `500 34px ${FONT}`, MUTED, 'left')
    c.strokeStyle = MUTED; c.lineWidth = 3; c.beginPath(); c.moveTo(sx, py - 26); c.lineTo(sx + sw, py - 26); c.stroke()
  }
  chips(c, features(i), W / 2, 1180, 900, 'center', '#fff', INK, '#cfd5dd')
  text(c, 'konvwa.shop', W / 2, 1272, `700 28px ${FONT}`, MUTED, 'center')
}

const LAYOUTS = [studio, cercle, bandeau, cadre]

export async function renderProductCard(i: CardInput): Promise<Blob> {
  try { await Promise.all([document.fonts.load(`800 48px Poppins`), document.fonts.load(`700 28px Poppins`), document.fonts.load(`500 28px Poppins`)]) } catch { /* the fallback font is fine */ }
  const [main, ...rest] = await Promise.all(i.images.slice(0, 4).map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')
  if (!c) throw new Error('canvas')
  const style = i.style !== undefined && i.style >= 0 && i.style < LAYOUTS.length ? i.style : Math.floor(Math.random() * LAYOUTS.length)
  LAYOUTS[style](c, i, main, rest.filter((t): t is HTMLImageElement => !!t))
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}
