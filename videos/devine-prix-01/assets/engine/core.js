/* KONVWA motion engine — core (universal: runs in the browser AND in Node).
 * Pure data and helpers only: formats, text markup, word timing, sound cues, the scene registry and the rules the validators enforce.
 * No DOM access here, so the CLI (timeline, validation, sound placement) and the renderer share one source of truth. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  M.version = '1.0.0'

  /** Formats. Every side is >= 1080 so one design unit equals one pixel. `safe` = areas kept free of the platforms' own UI (TikTok / Reels / Shorts). */
  M.FORMATS = {
    '9:16': { W: 1080, H: 1920, safe: { t: 250, b: 440, l: 70, r: 70 } },
    '4:5': { W: 1080, H: 1350, safe: { t: 120, b: 150, l: 70, r: 70 } },
    '1:1': { W: 1080, H: 1080, safe: { t: 90, b: 90, l: 80, r: 80 } },
    '16:9': { W: 1920, H: 1080, safe: { t: 80, b: 80, l: 140, r: 140 } },
  }

  /** Easing vocabulary (GSAP names). Entrances decelerate hard, exits accelerate; UI uses a small overshoot. */
  M.E = {
    out: 'power3.out',
    outX: 'expo.out',
    inOut: 'power3.inOut',
    inOutX: 'expo.inOut',
    in: 'power2.in',
    spring: 'back.out(1.7)',
    springHard: 'back.out(2.6)',
    soft: 'sine.inOut',
  }

  /** Deterministic random numbers (mulberry32): never Math.random, a render must be identical every time. */
  M.rng = function (seed) {
    let a = (seed >>> 0) || 1
    return function () {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  M.clamp = (x, a, b) => Math.max(a, Math.min(b, x))
  M.r2 = (n) => Math.round(n * 100) / 100

  // ---------- text markup ----------
  // *accent word*  -> accent colour      _serif italic_ -> serif italic emphasis      |  -> line break
  const TOKEN = /(\*[^*]+\*|(?:^|(?<=\s))_[^_]+_(?=\s|$|[.,!?;:])|\|)/g

  /** Text with markup -> [{t:'w', s:'word', k:'' | 'a' | 's'}, {t:'br'}]. */
  M.parse = function (text) {
    const out = []
    let glue = false // the previous styled token is followed by punctuation with no space: "*partout*." stays one word
    const src = String(text ?? '').replace(/[ \t]+([?!:;»])/g, '\u00a0$1').replace(/(«)[ \t]+/g, '$1\u00a0')
    for (const part of src.split(TOKEN)) {
      if (!part) continue
      if (part === '|') { out.push({ t: 'br' }); glue = false; continue }
      let k = ''
      let s = part
      let styled = false
      if (/^\*[^*]+\*$/.test(part)) { k = 'a'; s = part.slice(1, -1); styled = true }
      else if (/^_[^_]+_$/.test(part)) { k = 's'; s = part.slice(1, -1); styled = true }
      else if (glue && /^[^ \t\r\n]/.test(s)) {
        const m = /^([^ \t\r\n]+)([\s\S]*)$/.exec(s)
        out[out.length - 1].s += m[1]
        s = m[2]
      }
      glue = styled
      for (const w of s.split(/[ \t\r\n]+/)) if (w) out.push({ t: 'w', s: w, k })
    }
    return out
  }
  /**
   * Largest font size at which `markup` fits `maxW` in at most `maxLines` lines, and the same text with line breaks (`|`) placed so the lines
   * are even (no orphan word). Pure estimate from character counts (Poppins ExtraBold ≈ 0.52 em per character): the browser wraps the same way.
   * Returns { size, lines, markup }.
   */
  M.layout = function (markup, maxW, o) {
    const p = Object.assign({ max: 150, min: 64, factor: 0.54, gap: 0.26, maxLines: 4, step: 4 }, o)
    const paras = [[]]
    for (const t of M.parse(markup)) { if (t.t === 'br') paras.push([]); else paras[paras.length - 1].push(t) }
    const wl = (w) => w.s.length * p.factor
    const greedy = (para, limit) => {
      const lines = []
      let cur = []
      let curW = 0
      for (const w of para) {
        const ww = wl(w)
        if (ww > limit) return null
        if (cur.length && curW + p.gap + ww > limit) { lines.push(cur); cur = [w]; curW = ww } else { curW += (cur.length ? p.gap : 0) + ww; cur.push(w) }
      }
      if (cur.length) lines.push(cur)
      return lines
    }
    let size = p.min
    let plan = null
    for (let s = p.max; s >= p.min; s -= p.step) {
      const limit = maxW / s
      const ls = paras.map((para) => (para.length ? greedy(para, limit) : []))
      if (ls.every(Boolean) && ls.reduce((a, l) => a + l.length, 0) <= p.maxLines) { size = s; plan = ls; break }
    }
    if (!plan) plan = paras.map((para) => (para.length ? greedy(para, Infinity) : []))
    const limit = maxW / size
    const out = []
    let lines = 0
    plan.forEach((ls, pi) => {
      const para = paras[pi]
      const n = ls.length
      let groups = ls
      if (n > 1) {
        // even lines: minimise the squared slack of every line
        const W = (a, b) => { let x = 0; for (let i = a; i < b; i++) x += wl(para[i]) + (i > a ? p.gap : 0); return x }
        const N = para.length
        const best = Array.from({ length: n + 1 }, () => Array(N + 1).fill(Infinity))
        const from = Array.from({ length: n + 1 }, () => Array(N + 1).fill(0))
        best[0][0] = 0
        for (let j = 1; j <= n; j++) for (let i = j; i <= N; i++) for (let k = j - 1; k < i; k++) {
          const w = W(k, i)
          if (w > limit || best[j - 1][k] === Infinity) continue
          const c = best[j - 1][k] + (limit - w) ** 2
          if (c < best[j][i]) { best[j][i] = c; from[j][i] = k }
        }
        if (best[n][N] !== Infinity) {
          groups = []
          for (let j = n, i = N; j > 0; j--) { const k = from[j][i]; groups.unshift(para.slice(k, i)); i = k }
        }
      }
      lines += groups.length
      out.push(groups.map((g) => g.map((w) => (w.k === 'a' ? '*' + w.s + '*' : w.k === 's' ? '_' + w.s + '_' : w.s)).join(' ')).join(' | '))
    })
    return { size, lines, markup: out.join(' | ') }
  }
  M.plain = (text) => M.parse(text).map((x) => (x.t === 'br' ? ' ' : x.s)).join(' ').replace(/\s+/g, ' ').trim()
  M.wordCount = (text) => M.parse(text).filter((x) => x.t === 'w').length

  /**
   * When each word of a line should appear, spread over `span` seconds from `start` and weighted by word length (longer words are spoken longer),
   * so the text follows the voice without needing word-level timestamps.
   */
  M.wordTimes = function (n, start, span) {
    if (n <= 0) return []
    if (n === 1) return [start]
    const out = []
    const step = span / n
    for (let i = 0; i < n; i++) out.push(M.r2(start + i * step))
    return out
  }
  M.wordTimesFor = function (text, start, span) {
    const words = M.parse(text).filter((x) => x.t === 'w')
    const total = words.reduce((a, w) => a + w.s.length + 2, 0) || 1
    let acc = 0
    return words.map((w) => { const t = M.r2(start + (acc / total) * span); acc += w.s.length + 2; return t })
  }

  /**
   * When each word of `markup` appears in a scene. Spread over the voice-over when there is one (env.vo = {start,dur}), else at a steady pace.
   * `o.cap` limits the span (a hook reveals its line fast whatever the voice does). Pure: the renderer and the sound placement both use it.
   */
  M.timesFor = function (markup, env, o) {
    const p = Object.assign({ start: env && env.vo ? env.vo.start : 0.2, cap: 99, pace: 0.2 }, o)
    const n = M.wordCount(markup)
    const span = env && env.vo ? Math.max(0.35, env.vo.dur * 0.8) : Math.max(0.45, n * p.pace)
    return M.wordTimesFor(markup, p.start, Math.min(span, p.cap))
  }
  /** Index of the first accented word (*like this*), or -1. */
  M.accentIndex = function (markup) {
    const words = M.parse(markup).filter((x) => x.t === 'w')
    return words.findIndex((w) => w.k === 'a')
  }

  // ---------- sound cues ----------
  /** Semantic cue -> file of the engine's sound pack (Pixabay licence, see sfx/CREDITS.md), mix level, file length and the longest we let it play. */
  M.CUES = {
    whoosh: { file: 'whoosh-short.mp3', vol: 0.34, dur: 0.57 },
    whooshBig: { file: 'whoosh.mp3', vol: 0.42, dur: 0.57 },
    cine: { file: 'whoosh-cinematic.mp3', vol: 0.4, dur: 5.54, max: 2.2 },
    pop: { file: 'pop.mp3', vol: 0.36, dur: 0.72 },
    click: { file: 'click.mp3', vol: 0.46, dur: 0.37 },
    tick: { file: 'click-soft.mp3', vol: 0.34, dur: 0.37 },
    type: { file: 'key-press.mp3', vol: 0.3, dur: 0.43 },
    ping: { file: 'ping.mp3', vol: 0.34, dur: 1.32 },
    chime: { file: 'chime.mp3', vol: 0.4, dur: 2.54 },
    sparkle: { file: 'sparkle.mp3', vol: 0.3, dur: 1.8 },
    impact: { file: 'impact-bass-1.mp3', vol: 0.5, dur: 2.12 },
    impact2: { file: 'impact-bass-2.mp3', vol: 0.5, dur: 2.59 },
    riser: { file: 'riser.mp3', vol: 0.34, dur: 10.03, max: 1.4 },
    glitch: { file: 'glitch-3.mp3', vol: 0.3, dur: 3.1, max: 1.0 },
    notify: { file: 'notification.mp3', vol: 0.34, dur: 2.46 },
  }

  // ---------- rules the validators enforce ----------
  /** The 3-second law: what the opening has to do to stop the scroll. */
  M.HOOK = {
    maxDur: 3.0,        // the hook scene never runs past 3 s
    minDur: 2.8,
    firstEventMax: 0.15, // something visible from the very first frames, never an empty opening
    legibleBy: 1.6,      // the main line is fully readable by then
    wordsMax: 7,
    charsMax: 48,
    voStartMax: 0.35,    // the voice starts at once
  }
  /** Fallback palette (the brand kit supplies the real one through env.pal): colours that GSAP has to tween must be real values, never var(). */
  M.PAL = { bg: '#FFFFFF', bg2: '#F4F5F7', ink: '#0A1628', mute: '#5B6474', accent: '#F05A28', accent2: '#FF7252', card: '#FFFFFF', line: '#E8E9EC' }
  M.PACE = { wordsPerSec: [2.2, 3.4], voEstimate: 2.7, sceneAvg: [1.8, 5.2], maxScene: 7.5 }
  M.LIMITS = { minTotal: 6, maxTotal: 75, sameTypeInRow: 2 }

  // ---------- scene registry ----------
  /**
   * Every scene type registers itself here with:
   *   kind    'hook' | 'scene' | 'end'
   *   label   one-line description (used by `motion types`)
   *   min,max seconds (max = the longest it stays interesting)
   *   words   [min,max] of words on screen for the main text, when it has one
   *   needs   spec fields that must be present
   *   sfx(spec, env) -> [{t, cue}]  sound cues, seconds from the scene start (pure: no DOM)
   *   legible(spec, env) -> seconds when the hook's main line is fully readable (hooks only; pure)
   *   build(ctx)     builds the DOM and the GSAP timeline in the browser
   */
  M.catalog = M.catalog || {}
  M.register = function (type, def) { M.catalog[type] = Object.assign({ type, kind: 'scene', min: 2, max: 6, needs: [], theme: null, sfx: () => [], legible: null }, def) }
  M.types = () => Object.keys(M.catalog)
  M.isHook = (type) => (M.catalog[type] || {}).kind === 'hook'
})(typeof window !== 'undefined' ? window : globalThis)
