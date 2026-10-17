// Draws a poster on the server: the SAME drawing code as the browser (poster.ts), run on CanvasKit (Skia compiled to WebAssembly), then encoded as a JPEG.
// The WebAssembly file and the Poppins fonts are fetched once per warm instance and kept.
import CanvasKitInit from 'npm:canvaskit-wasm@0.39.1/full'
import { CARD_H, CARD_W, drawPoster, type CardInput, type Pic } from './poster.ts'

const CK = '0.39.1'
const WASM = [`https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CK}/bin/full/canvaskit.wasm`, `https://unpkg.com/canvaskit-wasm@${CK}/bin/full/canvaskit.wasm`]
const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/poppins@0.4.1'
const FONTS: Array<[weight: string, dir: string]> = [['500', '500Medium'], ['600', '600SemiBold'], ['700', '700Bold'], ['800', '800ExtraBold']]

// the parts of CanvasKit this file uses
interface Canvas {
  getContext(kind: '2d'): CanvasRenderingContext2D
  loadFont(data: ArrayBuffer, desc: { family: string; weight: string; style: string }): void
  decodeImage(data: ArrayBuffer | Uint8Array): { width: number | (() => number); height: number | (() => number) } | null
  toDataURL(type: string, quality?: number): string
  dispose?: () => void
}
interface Kit { MakeCanvas(w: number, h: number): Canvas }

async function bytes(urls: string[]): Promise<ArrayBuffer> {
  let last = ''
  for (const u of urls) {
    const res = await fetch(u, { signal: AbortSignal.timeout(30000) }).catch((e) => { last = String(e); return null })
    if (res?.ok) return await res.arrayBuffer()
    if (res) last = `${res.status} ${u}`
  }
  throw new Error(`download failed: ${last}`)
}

let ready: Promise<{ kit: Kit; fonts: ArrayBuffer[] }> | null = null
function load() {
  ready ??= (async () => {
    const [wasm, ...fonts] = await Promise.all([bytes(WASM), ...FONTS.map(([, d]) => bytes([`${FONT_BASE}/${d}/Poppins_${d}.ttf`]))])
    // the WebAssembly file is handed over directly: the loader then never tries to find it on disk
    const kit = await (CanvasKitInit as unknown as (o: { wasmBinary: ArrayBuffer }) => Promise<Kit>)({ wasmBinary: wasm })
    return { kit, fonts }
  })().catch((e) => { ready = null; throw e })
  return ready
}

const num = (v: number | (() => number)) => (typeof v === 'function' ? v() : v)

/** The poster of `input` as a JPEG; `photos` are the product pictures (JPEG / PNG / WebP bytes): the first is the big one, the next ones are thumbnails. */
export async function renderPosterJpeg(input: CardInput, photos: Uint8Array[]): Promise<Uint8Array> {
  const { kit, fonts } = await load()
  const canvas = kit.MakeCanvas(CARD_W, CARD_H)
  FONTS.forEach(([weight], i) => canvas.loadFont(fonts[i], { family: 'Poppins', weight, style: 'normal' }))
  const pics: Pic[] = []
  for (const b of photos.slice(0, 4)) {
    try {
      const img = canvas.decodeImage(b)
      if (img) pics.push(Object.assign(img, { naturalWidth: num(img.width), naturalHeight: num(img.height) }))
    } catch { /* an unreadable picture is skipped */ }
  }
  drawPoster(canvas.getContext('2d'), input, pics[0] ?? null, pics.slice(1, 4), { family: 'Poppins' })
  // CanvasKit takes the JPEG quality as 0-100
  const url = canvas.toDataURL('image/jpeg', 93)
  const raw = atob(url.slice(url.indexOf(',') + 1))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  canvas.dispose?.()
  return out
}
