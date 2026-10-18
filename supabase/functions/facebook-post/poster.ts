/// <reference lib="dom" />
// The poster drawing (1080x1350, the 4:5 feed format): pure canvas 2D code, no DOM and no i18n, so that the SAME code draws the poster in the browser
// (src/lib/facebook-card.ts, native canvas) and on the server (supabase/functions/facebook-post, CanvasKit) for the daily automatic posts.
// supabase/functions/facebook-post/poster.ts is a verbatim copy of this file (a test checks it), because an Edge Function cannot import from src/.

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
  /** The selling price in US dollars (converted with the site's rate), shown next to the gourde price. */
  priceUsd: number | null
  /** The platform the product comes from (Amazon, Alibaba…), shown as a badge. */
  source: string | null
  /** Layout 0-2; random when omitted. */
  style?: number
}

export const CARD_STYLES = ['Studio', 'Bandeau', 'Cadre'] as const
export const CARD_W = 1080
export const CARD_H = 1350

const W = CARD_W
const H = CARD_H
const INK = '#14181f'
const MUTED = '#5b6472'
const ORANGE = '#F05A28'
const NAVY = '#0A1628'
let FONT = 'Poppins, system-ui, sans-serif'
let tr: (s: string) => string = (s) => s

// the French thousands separator is a narrow no-break space, missing from many fonts: a plain space is used
const plain = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ')
const htg = (n: number) => `${plain(Math.round(n).toLocaleString('fr-FR'))} HTG`
const usd = (n: number) => `${plain(n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} USD`

export type Ctx = CanvasRenderingContext2D
/** What the drawing needs to know about a decoded picture (a browser Image and a CanvasKit image both fit). */
export interface Pic { naturalWidth: number; naturalHeight: number }

const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath()
  if (typeof c.roundRect === 'function') { c.roundRect(x, y, w, h, r); return }
  const k = Math.min(r, w / 2, h / 2)
  c.moveTo(x + k, y); c.arcTo(x + w, y, x + w, y + h, k); c.arcTo(x + w, y + h, x, y + h, k); c.arcTo(x, y + h, x, y, k); c.arcTo(x, y, x + w, y, k); c.closePath()
}

function text(c: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') {
  // aligned by hand (CanvasKit ignores textAlign), so that the browser and the server lay the text out the same way
  c.font = font; c.fillStyle = color; c.textAlign = 'left'; c.textBaseline = 'alphabetic'
  const w = align === 'left' ? 0 : c.measureText(s).width
  c.fillText(s, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y)
}

/** The picture centred and fully visible (never cropped) inside a box. `blend` makes a white photo background melt into the card. */
function contain(c: Ctx, img: Pic, x: number, y: number, w: number, h: number, blend = false) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s; const dh = img.naturalHeight * s
  c.save()
  if (blend) c.globalCompositeOperation = 'multiply'
  c.drawImage(img as unknown as CanvasImageSource, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
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

/** The KONVWA icon (three stacked crates), drawn from the same shapes as the site's logo; `h` is its height. Returns its width. */
function crates(c: Ctx, x: number, y: number, h: number): number {
  const k = h / 72
  const box = (bx: number, by: number, bw: number, bh: number, r: number, fill: string, alpha = 1) => {
    c.globalAlpha = alpha; c.fillStyle = fill; rr(c, x + bx * k, y + by * k, bw * k, bh * k, r * k); c.fill(); c.globalAlpha = 1
  }
  for (const [bx, by] of [[1, 45], [35, 29], [69, 13]]) box(bx, by, 40, 24, 6, '#000000', 0.1)
  const crate = (bx: number, by: number, body: string, side: string, slat: string, sx: number, sy: number) => {
    box(bx, by, 40, 24, 6, body); box(bx, by, 9, 24, 6, side); box(bx + 31, by, 9, 24, 6, side)
    for (const d of [0, 4.5, 9]) box(sx, sy + d, 22, 2.5, 1.2, slat)
  }
  crate(0, 42, '#8B2200', '#6B1800', '#7A1E00', 9, 48)
  crate(34, 26, '#E53D15', '#C23010', '#CC3510', 43, 32)
  crate(68, 10, '#FF7252', '#E05A3A', '#EE6040', 77, 16)
  return 110 * k
}

/** Logo: the crates icon + the wordmark, centred on `x` or starting at it, with the shop's tagline under it. */
function logo(c: Ctx, x: number, y: number, align: 'center' | 'left', size = 52, source: string | null = null, ink = INK, sub = MUTED) {
  const ih = Math.round(size * 1.45)
  const fs = Math.round(size * 0.92)
  c.font = `800 ${fs}px ${FONT}`
  const tw = c.measureText('KONVWA').width
  const iw = 110 * (ih / 72)
  const total = iw + 16 + tw
  const x0 = align === 'center' ? x - total / 2 : x
  crates(c, x0, y, ih)
  text(c, 'KONVWA', x0 + iw + 16, y + ih * 0.78, `800 ${fs}px ${FONT}`, ink, 'left')
  if (source) { sourcePill(c, align === 'center' ? x : x0, y + ih + 8, align, source); return }
  text(c, tr('IMPORTATION HAÏTI'), align === 'center' ? x : x0, y + ih + 28, `600 17px ${FONT}`, sub, align === 'center' ? 'center' : 'left')
}

/** "Source : Amazon" badge, under the logo. */
function sourcePill(c: Ctx, x: number, y: number, align: 'center' | 'left', source: string) {
  const label = `${tr('Source')} : ${source}`
  c.font = `700 22px ${FONT}`
  const w = c.measureText(label).width + 58; const h = 38
  const x0 = align === 'center' ? x - w / 2 : x
  c.fillStyle = '#ffffff'; rr(c, x0, y, w, h, 19); c.fill()
  c.strokeStyle = 'rgba(20,24,31,0.18)'; c.lineWidth = 2; rr(c, x0, y, w, h, 19); c.stroke()
  c.fillStyle = ORANGE; c.beginPath(); c.arc(x0 + 20, y + h / 2, 6, 0, Math.PI * 2); c.fill()
  text(c, label, x0 + 36, y + 27, `700 22px ${FONT}`, INK, 'left')
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

function thumbsRow(c: Ctx, imgs: Pic[], x: number, y: number, size: number, gap: number, dir: 'row' | 'col' = 'row') {
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
    c.save(); c.translate(x + 17, y + 17); c.scale(7 / 17, 1); c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.restore(); c.stroke()
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
function studio(c: Ctx, i: CardInput, main: Pic | null, thumbs: Pic[]) {
  lightBackground(c); decor(c)
  logo(c, W / 2, 56, 'center', 54, i.source)
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
  const ph = i.priceUsd ? 118 : 84
  c.save(); c.shadowColor = 'rgba(240,90,40,0.3)'; c.shadowBlur = 22; c.shadowOffsetY = 8
  c.fillStyle = ORANGE; rr(c, W - 60 - pw, bottom - ph, pw, ph, 42); c.fill(); c.restore()
  text(c, htg(i.priceHtg), W - 60 - pw / 2, bottom - ph + 58, `800 52px ${FONT}`, '#fff', 'center')
  if (i.priceUsd) text(c, `≈ ${usd(i.priceUsd)}`, W - 60 - pw / 2, bottom - 18, `600 27px ${FONT}`, 'rgba(255,255,255,0.92)', 'center')
  if (i.strikeHtg) {
    c.font = `500 28px ${FONT}`; const s = htg(i.strikeHtg); const sw = c.measureText(s).width
    text(c, s, W - 60 - pw / 2, bottom - ph - 16, `500 28px ${FONT}`, MUTED, 'center')
    c.strokeStyle = MUTED; c.lineWidth = 2.5; c.beginPath(); c.moveTo(W - 60 - pw / 2 - sw / 2, bottom - ph - 25); c.lineTo(W - 60 - pw / 2 + sw / 2, bottom - ph - 25); c.stroke()
  }
  contactBand(c, 1215)
}

// ── Layout 2: Bandeau ────────────────────────────────────────────────────────────────────────────────────────
function bandeau(c: Ctx, i: CardInput, main: Pic | null, thumbs: Pic[]) {
  lightBackground(c, '#f2f4f7')
  c.fillStyle = ORANGE
  c.beginPath(); c.moveTo(0, 560); c.lineTo(W, 380); c.lineTo(W, 900); c.lineTo(0, 1090); c.closePath(); c.fill()
  c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.moveTo(0, 640); c.lineTo(W, 460); c.lineTo(W, 520); c.lineTo(0, 700); c.closePath(); c.fill()
  logo(c, W / 2, 50, 'center', 50, i.source)
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
  price(c, i, W / 2, 1190, 'center', 74, ORANGE)
  if (i.priceUsd) text(c, `≈ ${usd(i.priceUsd)}`, W / 2, 1230, `700 30px ${FONT}`, MUTED, 'center')
  chips(c, features(i), W / 2, 1254, 940, 'center', '#fff', INK, '#d4d9e0')
}

// ── Layout 3: Cadre ──────────────────────────────────────────────────────────────────────────────────────────
function cadre(c: Ctx, i: CardInput, main: Pic | null, thumbs: Pic[]) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H)
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff7f3'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#f3f5f8')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  c.strokeStyle = ORANGE; c.lineWidth = 10; rr(c, 30, 30, W - 60, H - 60, 56); c.stroke()
  c.strokeStyle = 'rgba(240,90,40,0.25)'; c.lineWidth = 3; rr(c, 54, 54, W - 108, H - 108, 40); c.stroke()
  logo(c, W / 2, 82, 'center', 50, i.source)
  const t = fit(c, i.name, 880, 2, 72, 44)
  t.lines.forEach((l, n) => text(c, l, W / 2, 262 + n * t.size * 1.06, `800 ${t.size}px ${FONT}`, INK, 'center'))
  const top = 262 + (t.lines.length - 1) * t.size * 1.06 + 36
  if (main) contain(c, main, 130, top, 820, 930 - top, true)
  if (i.discountPct) discountBadge(c, 900, top + 60, 66, i.discountPct)
  if (thumbs.length) thumbsRow(c, thumbs, W / 2 - (thumbs.length * 84 + (thumbs.length - 1) * 12) / 2, 944, 84, 12, 'row')
  const py = 1122
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
  if (i.priceUsd) text(c, `≈ ${usd(i.priceUsd)}`, W / 2 - (i.strikeHtg ? 120 : 0), py + 46, `700 28px ${FONT}`, MUTED, 'center')
  chips(c, features(i), W / 2, 1172 + (i.priceUsd ? 22 : 8), 900, 'center', '#fff', INK, '#cfd5dd')
  text(c, 'konvwa.shop', W / 2, 1282, `700 28px ${FONT}`, MUTED, 'center')
}

const LAYOUTS = [studio, bandeau, cadre]

/** Draws the poster of `i` with the layout `style` (0-2, random when omitted). `labels` translates the fixed texts; `family` is the font stack. */
export function drawPoster(c: Ctx, i: CardInput, main: Pic | null, thumbs: Pic[], opts: { tr?: (s: string) => string; family?: string } = {}) {
  tr = opts.tr ?? ((s) => s)
  FONT = opts.family ?? 'Poppins, system-ui, sans-serif'
  const style = i.style !== undefined && i.style >= 0 && i.style < LAYOUTS.length ? i.style : Math.floor(Math.random() * LAYOUTS.length)
  LAYOUTS[style](c, i, main, thumbs)
}

// ── Information posters: an event, an explainer, a piece of news or a promo (no product, only words and a stock photo) ────────────────────────
export const INFO_LAYOUTS = ['photo', 'studio'] as const
export type InfoLayout = (typeof INFO_LAYOUTS)[number]

export interface InfoInput {
  /** `photo`: a photo at the top that melts into a white poster; `studio`: a product photo on a light background. */
  layout: InfoLayout
  /** Small label in a pill ("ÉVÉNEMENT · 18 MAI"). */
  badge: string | null
  /** The title; the words between *stars* are drawn in orange. */
  headline: string
  subline: string | null
  /** Up to 4 short lines: numbered steps for an explainer, ticks for the other kinds. */
  bullets: string[]
  /** Numbered steps (explainer) instead of ticks. */
  numbered: boolean
  /** Where the subject of the photo is (0-1), so that the crop keeps it. */
  focus?: { x: number; y: number }
  /** Studio photos: the colour of the photo's own background, which the poster continues around it. */
  bg?: string | null
}

const LIGHT = '#f4f2ee'

/** A word of a title: the pieces of it and whether each is an accent (orange) one. */
type Unit = Array<{ t: string; a: boolean }>

/**
 * The words of a title, `Joyeux *Noël* !` giving Joyeux, Noël (accent) and `!`. A word cut by an accent mark (`l’*Indépendance*`) stays one word,
 * and a lone punctuation mark (`!`, `?`, `:`…) sticks to the word before it, so that a line never starts with one.
 */
function marked(s: string): Unit[] {
  const units: Unit[] = []
  let open = false // the last character seen was not a space: the next piece continues the last word
  s.split('*').forEach((seg, n) => {
    for (const tok of seg.split(/(\s+)/)) {
      if (tok === '') continue
      if (/^\s+$/.test(tok)) { open = false; continue }
      if (open && units.length) units[units.length - 1].push({ t: tok, a: n % 2 === 1 })
      else units.push([{ t: tok, a: n % 2 === 1 }])
      open = true
    }
  })
  const out: Unit[] = []
  for (const u of units) {
    const word = u.map((p) => p.t).join('')
    if (out.length && /^[!?:;,.»)]+$/.test(word)) out[out.length - 1].push(...u.map((p) => ({ t: p.t, a: out[out.length - 1][out[out.length - 1].length - 1].a })))
    else out.push(u)
  }
  return out
}
const unitText = (u: Unit) => u.map((p) => p.t).join('')

/** The picture filling a box (cropped around the point `fx`, `fy` of the subject, 0-1). */
function cover(c: Ctx, img: Pic, x: number, y: number, w: number, h: number, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s; const dh = img.naturalHeight * s
  c.save()
  c.beginPath(); c.rect(x, y, w, h); c.clip()
  c.drawImage(img as unknown as CanvasImageSource, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh)
  c.restore()
}

/** `#rrggbb` as an rgba() colour (a transparent version of a colour, for a gradient). */
const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`

function vgrad(c: Ctx, y0: number, y1: number, stops: Array<[number, string]>) {
  const g = c.createLinearGradient(0, y0, 0, y1)
  for (const [at, col] of stops) g.addColorStop(at, col)
  c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0)
}

/** The tick drawn in front of a bullet of a non-numbered poster. */
function tick(c: Ctx, cx: number, cy: number, color: string, k = 1) {
  c.strokeStyle = color; c.lineWidth = 6 * k; c.lineCap = 'round'; c.lineJoin = 'round'
  c.beginPath(); c.moveTo(cx - 10 * k, cy + 1 * k); c.lineTo(cx - 3 * k, cy + 8 * k); c.lineTo(cx + 11 * k, cy - 8 * k); c.stroke()
}

/** Fits the title (accent pieces kept) and draws it from the top `y`; returns the y under it. */
function title(c: Ctx, words: Unit[], x: number, y: number, width: number, maxLines: number, start: number, min: number, ink: string, accent: string): number {
  const f = fit(c, words.map(unitText).join(' '), width, maxLines, start, min, 800)
  const font = `800 ${f.size}px ${FONT}`
  let n = 0
  f.lines.forEach((line, li) => {
    c.font = font
    let cx = x
    const sp = c.measureText(' ').width
    for (const w of line.split(' ')) {
      const u = words[n++]
      if (u && unitText(u) === w) {
        for (const p of u) { text(c, p.t, cx, y + f.size * 0.9 + li * f.size * 1.04, font, p.a ? accent : ink, 'left'); cx += c.measureText(p.t).width }
      } else { text(c, w, cx, y + f.size * 0.9 + li * f.size * 1.04, font, ink, 'left'); cx += c.measureText(w).width }
      cx += sp
    }
  })
  return y + f.lines.length * f.size * 1.04
}

function subline(c: Ctx, s: string, x: number, y: number, width: number, maxLines: number, color: string, start = 36): number {
  const f = fit(c, s, width, maxLines, start, 26, 500)
  f.lines.forEach((l, n) => text(c, l, x, y + f.size * 0.95 + n * f.size * 1.3, `500 ${f.size}px ${FONT}`, color, 'left'))
  return y + f.lines.length * f.size * 1.3
}

/** One bullet as a white pill with a round orange mark (the tick, or its number). */
function bulletPill(c: Ctx, s: string, n: number, numbered: boolean, x: number, y: number, h: number, maxW: number, ink: string, line: string): number {
  const size = h >= 72 ? 31 : 27
  c.font = `700 ${size}px ${FONT}`
  const tw = Math.min(c.measureText(s).width, maxW - h - 36)
  const w = h + tw + 36
  c.fillStyle = '#ffffff'; rr(c, x, y, w, h, h / 2); c.fill()
  c.strokeStyle = line; c.lineWidth = 2; rr(c, x, y, w, h, h / 2); c.stroke()
  const r = h / 2 - 9
  c.fillStyle = ORANGE; c.beginPath(); c.arc(x + h / 2, y + h / 2, r, 0, Math.PI * 2); c.fill()
  if (numbered) text(c, String(n + 1), x + h / 2, y + h / 2 + size * 0.36, `800 ${size}px ${FONT}`, '#ffffff', 'center')
  else tick(c, x + h / 2, y + h / 2, '#ffffff', h / 76)
  const t = fit(c, s, maxW - h - 36, 1, size, 22, 700)
  text(c, t.lines[0] ?? s, x + h + 6, y + h / 2 + t.size * 0.35, `700 ${t.size}px ${FONT}`, ink, 'left')
  return w
}

/** The bottom bar: where to order and how to pay, with the button. */
function ctaBar(c: Ctx, dark: boolean) {
  const y = 1166; const h = 124
  c.fillStyle = 'rgba(0,0,0,0.22)'; rr(c, 52, y + 8, W - 104, h, h / 2); c.fill()
  c.fillStyle = dark ? NAVY : '#ffffff'; rr(c, 48, y, W - 96, h, h / 2); c.fill()
  c.fillStyle = ORANGE; c.beginPath(); c.arc(48 + h / 2, y + h / 2, 38, 0, Math.PI * 2); c.fill()
  // a globe: circle, meridian and equator
  c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.lineCap = 'round'
  const gx = 48 + h / 2; const gy = y + h / 2
  c.beginPath(); c.arc(gx, gy, 18, 0, Math.PI * 2); c.stroke()
  c.save(); c.translate(gx, gy); c.scale(8 / 18, 1); c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.restore(); c.stroke()
  c.beginPath(); c.moveTo(gx - 18, gy); c.lineTo(gx + 18, gy); c.stroke()
  text(c, 'konvwa.shop', 48 + h + 6, y + 60, `800 44px ${FONT}`, dark ? '#ffffff' : NAVY, 'left')
  text(c, 'MonCash · NatCash', 48 + h + 6, y + 94, `600 24px ${FONT}`, dark ? 'rgba(255,255,255,0.7)' : MUTED, 'left')
  const label = tr('Commander')
  c.font = `800 32px ${FONT}`
  const tw = c.measureText(label).width
  const bw = 34 + tw + 16 + 24 + 30
  const bx = W - 48 - 24 - bw
  c.fillStyle = ORANGE; rr(c, bx, y + 24, bw, h - 48, (h - 48) / 2); c.fill()
  text(c, label, bx + 34, y + h / 2 + 11, `800 32px ${FONT}`, '#ffffff', 'left')
  // the arrow
  const ax = bx + 34 + tw + 16
  c.strokeStyle = '#ffffff'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'
  c.beginPath(); c.moveTo(ax, y + h / 2); c.lineTo(ax + 22, y + h / 2); c.moveTo(ax + 12, y + h / 2 - 10); c.lineTo(ax + 22, y + h / 2); c.lineTo(ax + 12, y + h / 2 + 10); c.stroke()
}

function badgePill(c: Ctx, label: string, right: number, y: number, fill: string, ink: string) {
  c.font = `800 26px ${FONT}`
  const w = c.measureText(label).width + 56
  c.fillStyle = fill; rr(c, right - w, y, w, 54, 27); c.fill()
  text(c, label, right - w / 2, y + 36, `800 26px ${FONT}`, ink, 'center')
}

/** A thin orange wave, the poster's signature. */
function swoosh(c: Ctx, y: number) {
  c.fillStyle = ORANGE
  c.beginPath(); c.moveTo(0, y + 30); c.bezierCurveTo(300, y - 30, 700, y + 70, W, y - 10); c.lineTo(W, y + 8); c.bezierCurveTo(700, y + 88, 300, y - 10, 0, y + 50); c.closePath(); c.fill()
}

function photoPoster(c: Ctx, i: InfoInput, photo: Pic | null) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H)

  // the text block grows upwards from the bar; the photo above it melts into the white where the text starts
  const X = 64; const TW = W - 128
  const bullets = i.bullets.filter((b) => b.trim()).slice(0, 4)
  const words = marked(i.headline)
  const sub = i.subline?.trim() ?? ''
  const PILL = bullets.length > 3 ? 68 : 76; const GAP = 12
  const bulletsH = bullets.length ? bullets.length * PILL + (bullets.length - 1) * GAP : 0
  const maxLines = bullets.length ? 2 : 4
  const start = bullets.length ? 96 : 128
  const hf = fit(c, words.map(unitText).join(' '), TW, maxLines, start, 56, 800)
  const sf = sub ? fit(c, sub, TW, bullets.length ? 2 : 3, 36, 26, 500) : null
  const headH = hf.lines.length * hf.size * 1.04
  const subH = sf ? sf.lines.length * sf.size * 1.3 : 0
  const total = headH + (sf ? 22 + subH : 0) + (bulletsH ? 30 + bulletsH : 0)
  const top = Math.max(300, 1110 - total)

  const PH = Math.min(1010, top + 90)
  if (photo) {
    cover(c, photo, 0, 0, W, PH, i.focus?.x ?? 0.5, i.focus?.y ?? 0.4)
    vgrad(c, Math.max(0, PH - 380), PH, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0.86)'], [1, '#ffffff']])
  } else {
    const glow = c.createRadialGradient(W - 140, 240, 20, W - 140, 240, 760); glow.addColorStop(0, 'rgba(240,90,40,0.28)'); glow.addColorStop(1, 'rgba(240,90,40,0)')
    c.fillStyle = glow; c.fillRect(0, 0, W, H)
    c.strokeStyle = 'rgba(10,22,40,0.06)'; c.lineWidth = 3
    for (const r of [330, 250]) { c.beginPath(); c.arc(W - 40, 280, r, 0, Math.PI * 2); c.stroke() }
  }

  // the logo on a white plate, so that it reads over any photo
  c.font = `800 46px ${FONT}`
  const plate = 110 + 16 + c.measureText('KONVWA').width + 56
  c.fillStyle = 'rgba(255,255,255,0.93)'; rr(c, 36, 34, plate, 112, 30); c.fill()
  logo(c, 62, 46, 'left', 50, null, NAVY, MUTED)
  const badge = i.badge?.trim() ? i.badge.trim().toUpperCase() : null
  if (badge) badgePill(c, badge, W - 56, 62, ORANGE, '#ffffff')

  let y = top
  swoosh(c, y - 46)
  y = title(c, words, X, y, TW, maxLines, start, 56, NAVY, ORANGE)
  if (sf) y = subline(c, sub, X, y + 22, TW, bullets.length ? 2 : 3, MUTED)
  if (bullets.length) {
    y += 30
    bullets.forEach((b, n) => { bulletPill(c, b, n, i.numbered, X, y + n * (PILL + GAP), PILL, TW, NAVY, 'rgba(10,22,40,0.14)') })
  }
  ctaBar(c, true)
}

function studioPoster(c: Ctx, i: InfoInput, photo: Pic | null) {
  const bg = i.bg && /^#[0-9a-f]{6}$/i.test(i.bg) ? i.bg : LIGHT
  c.fillStyle = bg; c.fillRect(0, 0, W, H)
  const BY = 96; const BH = 730
  if (photo) {
    // the photo is shown whole, and its edges melt into the poster's background (the same colour as the photo's own)
    const k = Math.min(W / photo.naturalWidth, BH / photo.naturalHeight)
    const dw = photo.naturalWidth * k; const dh = photo.naturalHeight * k
    const dx = (W - dw) / 2; const dy = BY + (BH - dh) / 2
    c.drawImage(photo as unknown as CanvasImageSource, dx, dy, dw, dh)
    const F = 150
    const fade = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, bg); g.addColorStop(1, rgba(bg, 0))
      c.fillStyle = g; c.fillRect(rx, ry, rw, rh)
    }
    if (dx > 2) { fade(dx - 1, 0, dx + F, 0, dx - 1, dy, F + 1, dh); fade(dx + dw + 1, 0, dx + dw - F, 0, dx + dw - F, dy, F + 1, dh) }
    fade(0, dy - 1, 0, dy + F, dx, dy - 1, dw, F + 1)
    fade(0, dy + dh + 1, 0, dy + dh - F, dx, dy + dh - F, dw, F + 1)
  } else {
    const glow = c.createRadialGradient(W / 2, 400, 20, W / 2, 400, 520); glow.addColorStop(0, 'rgba(240,90,40,0.35)'); glow.addColorStop(1, 'rgba(240,90,40,0)')
    c.fillStyle = glow; c.fillRect(0, 0, W, BY + BH)
  }
  logo(c, 56, 48, 'left', 50, null, NAVY, MUTED)
  const badge = i.badge?.trim() ? i.badge.trim().toUpperCase() : null
  if (badge) badgePill(c, badge, W - 56, 62, NAVY, '#ffffff')

  const X = 64; const TW = W - 128
  const words = marked(i.headline)
  const bullets = i.bullets.filter((b) => b.trim()).slice(0, 3)
  const hf = fit(c, words.map(unitText).join(' '), TW, 2, 92, 52, 800)
  const sub = i.subline?.trim() ?? ''
  const sf = sub ? fit(c, sub, TW, bullets.length ? 1 : 2, 34, 26, 500) : null
  const total = hf.lines.length * hf.size * 1.04 + (sf ? 18 + sf.lines.length * sf.size * 1.3 : 0) + (bullets.length ? 24 + 62 : 0)
  let y = Math.max(BY + BH - 80, 1110 - total)
  y = title(c, words, X, y, TW, 2, 92, 52, NAVY, ORANGE)
  if (sf) y = subline(c, sub, X, y + 18, TW, bullets.length ? 1 : 2, MUTED, 34)
  if (bullets.length) {
    y += 24
    let x = X
    // only the bullets that fit on the line, whole
    for (const [n, b] of bullets.entries()) {
      c.font = `700 27px ${FONT}`
      const w = 62 + c.measureText(b).width + 36
      if (x + w > W - 64) break
      bulletPill(c, b, n, i.numbered, x, y, 62, w, NAVY, 'rgba(10,22,40,0.14)')
      x += w + 12
    }
  }
  swoosh(c, 1128)
  ctaBar(c, true)
}

/** Draws an information poster over the stock photo `photo` (null: a plain gradient). */
export function drawInfoPoster(c: Ctx, i: InfoInput, photo: Pic | null, opts: { tr?: (s: string) => string; family?: string } = {}) {
  tr = opts.tr ?? ((s) => s)
  FONT = opts.family ?? 'Poppins, system-ui, sans-serif'
  if (i.layout === 'studio') studioPoster(c, i, photo)
  else photoPoster(c, i, photo)
}
