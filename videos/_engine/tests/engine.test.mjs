import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENGINE, M, RUNTIME_FILES } from '../lib/runtime.mjs'
import { estimateVo, loadBrief, validateBrief } from '../lib/brief.mjs'
import { hookReport, placeSfx, schedule } from '../lib/schedule.mjs'
import { emitProject } from '../lib/emit.mjs'
import * as pixabay from '../lib/pixabay.mjs'
import { cutout, libraryTarget, recordCredit, source } from '../lib/assets.mjs'

/** Source of a runtime file without its comments (a comment may talk about what the code must not do). */
const code = (f) => fs.readFileSync(path.join(ENGINE, 'runtime', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const demo = () => loadBrief(path.join(ENGINE, 'examples/demo.brief.json'))
const exists = (ref) => ref.startsWith('lib:') && fs.existsSync(path.join(ENGINE, 'library', ref.slice(4)))

describe('markup and layout', () => {
  it('keeps punctuation glued to the styled word before it', () => {
    const w = M.parse('Achetez *partout*.').filter((x) => x.t === 'w')
    expect(w.map((x) => x.s)).toEqual(['Achetez', 'partout.'])
    expect(w[1].k).toBe('a')
  })
  it('counts words without the markup', () => {
    expect(M.wordCount('Une _idée_ *forte* | deux')).toBe(4)
    expect(M.plain('Un *mot* | deux')).toBe('Un mot deux')
  })
  it('picks the biggest size that fits and balances the lines', () => {
    const big = M.layout('Achetez *partout*.|Recevez en Haïti.', 940, { max: 200, min: 70, maxLines: 4 })
    expect(big.size).toBeGreaterThan(150)
    expect(big.lines).toBeLessThanOrEqual(4)
    const t = M.layout('Le prix final, *en gourdes*', 940, { max: 120, min: 64, maxLines: 2 })
    expect(t.lines).toBe(2)
    expect(t.markup.split('|').map((s) => s.trim()).every(Boolean)).toBe(true)
  })
  it('never loses or reorders words', () => {
    const src = 'Vous voulez *tout* acheter en ligne ?'
    expect(M.plain(M.layout(src, 900, { max: 190, min: 70 }).markup)).toBe(M.plain(src))
  })
})

describe('runtime registry', () => {
  it('every scene type is well formed and its sounds exist', () => {
    expect(M.types().length).toBeGreaterThanOrEqual(18)
    const env = { vo: { start: 0.2, dur: 2 }, theme: 'light' }
    for (const t of M.types()) {
      const d = M.catalog[t]
      expect(['hook', 'scene', 'end']).toContain(d.kind)
      expect(d.min).toBeLessThanOrEqual(d.max)
      expect(typeof d.build).toBe('function')
      const spec = { text: 'Un *mot*', items: ['a', 'b'], labels: ['a', 'b'], steps: [{ title: 'a' }], images: ['x', 'y'], value: 5 }
      for (const c of d.sfx(spec, env)) {
        expect(M.CUES[c.cue], `${t} → ${c.cue}`).toBeTruthy()
        expect(c.t).toBeGreaterThanOrEqual(0)
      }
    }
    for (const t of M.types().filter(M.isHook)) expect(M.catalog[t].max).toBeLessThanOrEqual(M.HOOK.maxDur)
  })
  it('sound files of every cue are in the pack', () => {
    for (const [name, c] of Object.entries(M.CUES)) expect(fs.existsSync(path.join(ENGINE, 'sfx', c.file)), name).toBe(true)
  })
  it('stays deterministic: no clock, no Math.random', () => {
    for (const f of RUNTIME_FILES) {
      const src = code(f)
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|requestAnimationFrame|setTimeout|setInterval/)
    }
  })
  it('never writes a <br> into body text', () => {
    for (const f of RUNTIME_FILES) expect(code(f), f).not.toMatch(/<br\s*\/?>/)
  })
})

describe('brief validation (the 3-second law)', () => {
  it('accepts the demo brief', () => {
    const { brief } = demo()
    expect(validateBrief(brief, exists).errors).toEqual([])
  })
  it('refuses a video that does not open with a hook', () => {
    const { brief } = demo()
    brief.scenes.shift()
    expect(validateBrief(brief, exists).errors.join(' ')).toMatch(/hook/)
  })
  it('refuses a hook that is too long to read or to say', () => {
    const { brief } = demo()
    brief.scenes[0].text = 'Achetez tout ce que vous voulez partout dans le monde entier aujourd’hui'
    brief.scenes[0].vo = 'Achetez tout ce que vous voulez partout dans le monde entier aujourd’hui sans aucun stress'
    const e = validateBrief(brief, exists).errors.join(' ')
    expect(e).toMatch(/caractères/)
    expect(e).toMatch(/trop longue à dire/)
  })
  it('refuses unknown types, missing fields and missing images', () => {
    const { brief } = demo()
    brief.scenes[1] = { type: 'scene.nope' }
    brief.scenes[2] = { type: 'scene.product', images: ['lib:products/absent.jpg'] }
    brief.scenes[3] = { type: 'scene.route' }
    const e = validateBrief(brief, exists).errors.join('\n')
    expect(e).toMatch(/type inconnu/)
    expect(e).toMatch(/image introuvable/)
    expect(e).toMatch(/exige le champ "from"/)
  })
  it('estimates a spoken line from its words', () => {
    expect(estimateVo('')).toBe(0)
    expect(estimateVo('Achetez partout. Recevez en Haïti.')).toBeGreaterThan(1.5)
    expect(estimateVo('Achetez partout. Recevez en Haïti.')).toBeLessThan(3)
  })
})

describe('timeline', () => {
  const { brief } = demo()
  const tl = schedule(brief, {})
  it('overlaps each scene by exactly its transition and the hook stays under 3 s', () => {
    expect(tl.scenes[0].dur).toBeLessThanOrEqual(M.HOOK.maxDur)
    for (let i = 1; i < tl.scenes.length; i++) {
      const prev = tl.scenes[i - 1]
      const ov = tl.scenes[i].env.transIn ? tl.scenes[i].env.transIn.dur : 0
      expect(tl.scenes[i].start).toBeCloseTo(prev.start + prev.dur - ov, 2)
      expect(prev.env.transOut?.dur ?? 0).toBe(ov)
    }
    expect(tl.total).toBeCloseTo(tl.scenes.at(-1).start + tl.scenes.at(-1).dur, 2)
  })
  it('lets a real voice-over drive the length of the scene', () => {
    const longer = schedule(brief, { s02: 9 })
    expect(longer.scenes[1].dur).toBeGreaterThan(tl.scenes[1].dur)
    expect(longer.scenes[1].vo.measured).toBe(true)
    expect(longer.total).toBeGreaterThan(tl.total)
  })
  it('passes its own hook checklist', () => {
    const sfx = placeSfx(brief, tl)
    for (const it of hookReport(brief, tl, sfx)) expect(it.ok, it.label).toBe(true)
  })
  it('places sounds inside the video on tracks that never overlap', () => {
    const sfx = placeSfx(brief, tl)
    expect(sfx.length).toBeGreaterThan(10)
    const byTrack = {}
    for (const e of sfx) {
      expect(e.t + e.dur).toBeLessThanOrEqual(tl.total + 1e-6)
      expect(e.track).toBeGreaterThanOrEqual(20)
      ;(byTrack[e.track] ||= []).push(e)
    }
    for (const list of Object.values(byTrack)) for (let i = 1; i < list.length; i++) expect(list[i].t).toBeGreaterThanOrEqual(list[i - 1].t + list[i - 1].dur - 1e-6)
    expect(new Set(sfx.map((e) => e.id)).size).toBe(sfx.length)
  })
  it('is silent when asked to be', () => {
    const quiet = { ...brief, sfx: { level: 0 } }
    expect(placeSfx(quiet, tl)).toEqual([])
  })
})

describe('project generation', () => {
  it('writes a complete HyperFrames project', () => {
    const { brief, brand } = demo()
    const tl = schedule(brief, {})
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'))
    const r = emitProject({ brief, brand, tl, voDur: {}, projectDir: dir })
    const index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    for (const sc of tl.scenes) {
      expect(index).toContain(`data-composition-src="compositions/${sc.id}.html"`)
      const html = fs.readFileSync(path.join(dir, 'compositions', `${sc.id}.html`), 'utf8')
      expect(html).toContain(`window.__timelines["${sc.id}"]`)
      expect(html).toContain('data-composition-id')
    }
    expect(index).toContain(`data-duration="${tl.total}"`)
    expect(index).toContain('font-family: "Poppins"')
    const ids = [...index.matchAll(/<audio id="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBe(r.sfx.length)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of r.sfx) expect(fs.existsSync(path.join(dir, 'assets/sfx', e.file))).toBe(true)
    for (const f of RUNTIME_FILES) expect(fs.existsSync(path.join(dir, 'assets/engine', f))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'assets/lib/products/powerbeats.jpg'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'vo.json'), 'utf8')).lines.length).toBe(6)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('real assets (pixabay + library)', () => {
  const hit = (id, w, h, extra = {}) => ({ id, imageWidth: w, imageHeight: h, downloads: 10, largeImageURL: `https://x/${id}_1280.jpg`, pageURL: `https://pixabay.com/photos/${id}/`, user: 'u', user_id: 1, ...extra })
  it('builds a safe search URL, maps portrait to the API orientation and looks up by id', () => {
    const u = new URL(pixabay.searchUrl('K', 'delivery box', { type: 'illustration', orientation: 'portrait' }))
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ q: 'delivery box', safesearch: 'true', image_type: 'illustration', orientation: 'vertical' })
    const v = new URL(pixabay.searchUrl('K', '', { type: 'video', id: 42 }))
    expect(v.pathname).toBe('/api/videos/')
    expect(v.searchParams.get('id')).toBe('42')
    expect(v.searchParams.has('orientation')).toBe(false)
    expect(() => pixabay.searchUrl('K', 'x', { type: 'music' })).toThrow()
  })
  it('reports the size of the 1280 px file actually downloaded and keeps PNG for vectors', () => {
    expect(pixabay.normalize(hit(5, 3024, 4032))).toMatchObject({ ext: 'jpg', width: 960, height: 1280, author: 'u', authorUrl: 'https://pixabay.com/users/1/' })
    expect(pixabay.normalize(hit(6, 1920, 1920, { type: 'vector/svg', largeImageURL: 'https://x/6_1280.png' }))).toMatchObject({ type: 'vector', ext: 'png', width: 1280 })
    expect(pixabay.normalize({ id: 7, videos: { medium: { url: 'm.mp4', width: 1920, height: 1080 }, large: { url: 'l.mp4' } } }, 'video')).toMatchObject({ url: 'm.mp4', ext: 'mp4' })
    expect(pixabay.normalize({ id: 8, videos: {} }, 'video')).toBeNull()
  })
  it('drops AI-generated and low-quality media and prefers portrait for a 9:16 frame', () => {
    const items = [hit(1, 1600, 900), hit(2, 900, 1600), hit(3, 900, 1600, { isAiGenerated: true }), hit(4, 900, 1600, { isLowQuality: true })].map((h) => pixabay.normalize(h))
    expect(pixabay.rank(items).map((x) => x.id)).toEqual([2, 1])
    expect(pixabay.rank(items, { orientation: 'landscape' }).map((x) => x.id)).toEqual([1, 2])
  })
  it('refuses to run without a key or with a bad id', () => {
    expect(() => pixabay.search('sea', { key: '' })).toThrow(/PIXABAY_API_KEY/)
    expect(() => pixabay.byId('1;rm', { key: 'K' })).toThrow(/invalide/)
  })
  it('keeps downloads inside library/ with a lib: reference', () => {
    expect(libraryTarget('/L', 'library/illustrations/colis', 'png')).toEqual({ file: path.join('/L', 'illustrations/colis.png'), ref: 'lib:illustrations/colis.png' })
    for (const bad of ['../x', 'library/../x', '/etc/x', 'Photos/X', 'a b', '']) expect(() => libraryTarget('/L', bad, 'jpg')).toThrow(/destination/)
    expect(() => source('pexels')).toThrow(/source inconnue/)
  })
  it('records one credit line per file, replacing an older one', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-'))
    const item = { source: 'pixabay', type: 'vector', id: 1, page: 'https://p/1', author: 'a', authorUrl: 'https://u/1' }
    recordCredit(dir, 'lib:x/colis.png', item)
    recordCredit(dir, 'lib:x/colis.png', { ...item, id: 2, page: 'https://p/2' })
    recordCredit(dir, 'lib:x/avion.png', item)
    const lines = fs.readFileSync(path.join(dir, 'CREDITS.md'), 'utf8').split('\n').filter((l) => l.startsWith('- '))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('https://p/2')
    expect(fs.readFileSync(path.join(dir, 'CREDITS.md'), 'utf8')).toMatch(/obligatoire\)\.\n\n- /)
  })
  it('says how to install rembg when it is missing', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cut-')), 'a.jpg')
    fs.writeFileSync(f, 'x')
    const old = process.env.REMBG
    process.env.REMBG = '/nonexistent/rembg'
    try { expect(() => cutout(f)).toThrow(/rembg introuvable/) } finally { if (old === undefined) delete process.env.REMBG; else process.env.REMBG = old }
  })
})

describe('depth: cut-outs, decor, carried objects', () => {
  const env = { W: 1080, H: 1920, seed: 7, dur: 3 }
  it('places items on the slots, nearer = bigger, flags as stickers, entering from their own edge', () => {
    const its = M.placeItems(['lib:flags/haiti.png', { src: 'lib:x.png', depth: 0.1 }, { src: 'lib:y.png', x: 0.9, y: 0.9, size: 0.3 }], env, M.DECOR_SLOTS, [0.16, 0.2])
    expect(its[0]).toMatchObject({ sticker: true, dx: -1, dy: -1 })
    expect(its[1].size).toBeLessThan(M.placeItems(['lib:x.png'], env, [[0.5, 0.5, 1]], [0.16, 0.2])[0].size)
    expect(its[2]).toMatchObject({ size: 324, dx: 1, dy: 1 })
    expect(M.placeItems(Array(9).fill('lib:a.png'), env, M.COLLAGE_SLOTS, [0.2, 0.2])).toHaveLength(M.COLLAGE_SLOTS.length)
  })
  it('lists the images of decor, items and carry, but not the text items of chips', () => {
    expect(M.depthRefs({ decor: ['lib:a.png', { src: 'lib:b.jpg' }], items: ['Shein', 'lib:c.png'], carry: 'lib:d.png' })).toEqual(['lib:a.png', 'lib:b.jpg', 'lib:c.png', 'lib:d.png'])
    const brief = { ...demo().brief, scenes: [...demo().brief.scenes] }
    brief.scenes[1] = { ...brief.scenes[1], decor: ['lib:illustrations/absent.png'] }
    expect(validateBrief(brief, exists).errors.join('\n')).toMatch(/absent\.png/)
  })
  it('flies the carried object on one continuous path shared by the two scenes', () => {
    const a = M.carryAt(0, 1080, 1920)
    const z = M.carryAt(1, 1080, 1920)
    expect(a.x).toBeLessThan(0)
    expect(z.x).toBeGreaterThan(1080)
    const mid = M.carryAt(0.5, 1080, 1920)
    expect(mid.s).toBeGreaterThan(a.s)
    // the next scene picks the flight up where the previous one is when it gets covered (end minus the transition)
    const e = { ...env, transOut: { kind: 'whip', dur: 0.42 } }
    const uCovered = (e.dur - e.transOut.dur - M.carryStart(e)) / M.CARRY.span
    expect(uCovered).toBeCloseTo(M.CARRY.lead / M.CARRY.span, 6)
    expect(M.depthSfx({ carry: 'lib:a.png', decor: ['lib:b.png'] }, e).map((x) => x.cue)).toEqual(['whoosh', 'whooshBig'])
  })
  it('hands the carried object to the next scene and copies every depth image into the project', () => {
    const { brief, brand } = loadBrief({ name: 'carry-test', voice: { mode: 'music' }, scenes: [
      { type: 'hook.collage', text: 'Achetez *partout*', items: ['lib:products/cerave.jpg'], carry: 'lib:products/r36s.jpg' },
      { type: 'scene.photo', text: 'Une *photo*', image: 'lib:products/anua.jpg', decor: ['lib:products/cosrx.jpg'] },
      { type: 'scene.end' },
    ] })
    expect(validateBrief(brief, exists).errors).toEqual([])
    const tl = schedule(brief, {})
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carry-'))
    emitProject({ brief, brand, tl, voDur: {}, projectDir: dir })
    const s2 = fs.readFileSync(path.join(dir, 'compositions/s02.html'), 'utf8')
    expect(s2).toContain('"carryIn":"assets/lib/products/r36s.jpg"')
    for (const f of ['cerave.jpg', 'r36s.jpg', 'anua.jpg', 'cosrx.jpg']) expect(fs.existsSync(path.join(dir, 'assets/lib/products', f)), f).toBe(true)
    expect(placeSfx(brief, tl).some((e) => e.file === 'whoosh.mp3')).toBe(true)
  })
})
