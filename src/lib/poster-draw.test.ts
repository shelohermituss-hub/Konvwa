import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { drawInfoPoster, type InfoInput } from './poster-draw'

describe('poster drawing shared with the server', () => {
  it('the Edge Function copy is identical to the browser source', () => {
    // supabase/functions/facebook-post/poster.ts must be re-copied from src/lib/poster-draw.ts whenever the drawing changes
    const browser = readFileSync('src/lib/poster-draw.ts', 'utf8')
    const server = readFileSync('supabase/functions/facebook-post/poster.ts', 'utf8')
    expect(server).toBe(browser)
  })
})

/** A drawing context that records the text it is asked to draw (every other call does nothing). */
function recorder() {
  const texts: string[] = []
  const grad = { addColorStop() {} }
  const props: Record<string, unknown> = {}
  const c = new Proxy(props, {
    get: (t, k: string) => (k === 'measureText' ? (s: string) => ({ width: s.length * 16 })
      : k === 'fillText' ? (s: string) => { texts.push(s) }
      : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad
      : k in t ? t[k] : () => {}),
    set: (t, k: string, v) => { t[k] = v; return true },
  }) as unknown as CanvasRenderingContext2D
  return { c, texts }
}
const info = (over: Partial<InfoInput> = {}): InfoInput => ({ layout: 'photo', badge: 'Événement', headline: 'Fête du Drapeau', subline: 'Belle fête à Haïti.', bullets: [], numbered: false, ...over })
const PHOTO = { naturalWidth: 1100, naturalHeight: 1650 }

describe('information poster', () => {
  it('writes the badge in capitals, the title, the line of text and the order bar, in both layouts', () => {
    for (const layout of ['photo', 'studio'] as const) {
      const { c, texts } = recorder()
      drawInfoPoster(c, info({ layout }), PHOTO)
      const all = texts.join(' ')
      expect(all).toContain('ÉVÉNEMENT')
      expect(all).toContain('Fête du Drapeau')
      expect(all).toContain('Belle fête à Haïti.')
      expect(all).toContain('konvwa.shop')
      expect(all).toContain('Commander')
    }
  })
  it('numbers the steps of an explainer and keeps four bullets at most', () => {
    const { c, texts } = recorder()
    drawInfoPoster(c, info({ numbered: true, bullets: ['a1', 'b2', 'c3', 'd4', 'e5'] }), PHOTO)
    expect(['1', '2', '3', '4'].every((n) => texts.includes(n))).toBe(true)
    expect(texts).not.toContain('5')
    expect(texts).not.toContain('e5')
  })
  it('draws the photo, and a plain gradient when it is missing', () => {
    let images = 0
    const { c } = recorder()
    const draw = c.drawImage.bind(c)
    ;(c as unknown as { drawImage: () => void }).drawImage = () => { images++; void draw }
    drawInfoPoster(c, info(), PHOTO)
    expect(images).toBe(1)
    images = 0
    drawInfoPoster(c, info(), null)
    drawInfoPoster(c, info({ layout: 'studio' }), null)
    expect(images).toBe(0)
  })
  it('draws the *accent* words in the accent colour, without the stars', () => {
    const fills: Array<{ text: string; color: string }> = []
    const props: Record<string, unknown> = {}
    const c = new Proxy(props, {
      get: (t, k: string) => (k === 'measureText' ? (s: string) => ({ width: s.length * 16 })
        : k === 'fillText' ? (s: string) => { fills.push({ text: s, color: String(t.fillStyle) }) }
        : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} })
        : k in t ? t[k] : () => {}),
      set: (t, k: string, v) => { t[k] = v; return true },
    }) as unknown as CanvasRenderingContext2D
    drawInfoPoster(c, info({ badge: null, subline: null, headline: 'Joyeux *Noël* !' }), PHOTO)
    expect(fills.some((f) => f.text.includes('*'))).toBe(false)
    expect(fills.find((f) => f.text === 'Noël')?.color).toBe('#F05A28')
    expect(fills.find((f) => f.text === 'Joyeux')?.color).toBe('#0A1628')
    // the lone "!" sticks to the word before it (it is drawn with it, in the same colour)
    expect(fills.some((f) => f.text === '!')).toBe(true)
  })
  it('survives odd input: no badge, empty bullets, an unknown layout, a very long title', () => {
    const { c, texts } = recorder()
    expect(() => drawInfoPoster(c, info({ layout: 'nope' as InfoInput['layout'], badge: null, subline: null, bullets: ['', '  '], headline: 'Mot '.repeat(200) }), PHOTO)).not.toThrow()
    expect(texts.join(' ')).toContain('…')
    expect(() => drawInfoPoster(c, info({ headline: '*** ** *' }), null)).not.toThrow()
  })
})
