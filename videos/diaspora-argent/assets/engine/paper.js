/* KONVWA motion engine — « papier quadrillé » pack (reference I, docs/REFERENCES.md).
 * Light grey graph paper with the brand mark pinned top-left; stacked lines of mixed sizes that appear letter by letter with the voice;
 * an orange bar born from a small square; photo cut-outs thrown in with motion blur and a long soft shadow; duotone people; a chart card,
 * a fanned deck of cards, a person stepping out of a card, a button born from a square, a contact end card. Every scene redraws the same
 * paper and mark, so the hard cuts between them read as one continuous shot. Orange shades only (brand `shades`), ink is a neutral black. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  const { E } = M
  const blur = (n) => 'blur(' + n + 'px)'
  const r2 = (n) => M.r2(n)

  M.DECO += ',.mo-pp-grid,.mo-pp-vignette,.mo-pp-obj,.mo-pp-circle,.mo-pp-arrow,.mo-pp-chart,.mo-pp-deck,.mo-pp-frame,.mo-pp-defs,.mo-pp-chip,.mo-barcode,.mo-pp-end'

  // ---------- pure: lines, timing, sounds (shared by the CLI and the renderer) ----------
  M.PAPER_SIZES = { xs: 40, s: 56, m: 80, l: 108, xl: 150 }
  /** Lines of a paper scene: a string is a small ink line, an object is { t, s, c, i, bar, circle, outline, arrow, align, dx }. */
  M.paperLines = (lines) => (Array.isArray(lines) ? lines : []).map((l) => (typeof l === 'string' ? { t: l } : Object.assign({}, l))).filter((l) => l && l.t)
  /** Markup of all the lines, for the hook rules and word timing. */
  M.paperText = (lines) => M.paperLines(lines).map((l) => l.t).join(' ')
  /**
   * When each line starts and when its last word is due. Words are spread over 80 % of the voice (`span` = another fraction, when the lines
   * only cover the start of what is said); a hook reveals its lines within the first second whatever the voice does.
   */
  M.paperTimes = function (spec, env, hook) {
    const ls = M.paperLines(spec.lines)
    if (!ls.length) return []
    const cap = spec.span && env && env.vo ? Math.max(0.4, env.vo.dur * spec.span) : 2.6
    const wt = M.timesFor(M.paperText(ls), env, hook ? { start: 0.05, cap: 0.95, pace: 0.15 } : { cap, pace: 0.2 })
    let k = 0
    return ls.map((l) => {
      const n = Math.max(1, M.wordCount(l.t))
      const t = { at: wt[k] != null ? wt[k] : 0.2, end: wt[Math.min(wt.length - 1, k + n - 1)] != null ? wt[Math.min(wt.length - 1, k + n - 1)] : 0.2 }
      k += n
      return t
    })
  }
  /** Letter rhythm of one line: when its first letter starts (after the bar opens), the gap between letters, when it is fully readable. */
  M.paperLetters = function (l, t) {
    const n = M.parse(l.t).reduce((a, x) => a + (x.t === 'w' ? Array.from(x.s).length : 0), 0)
    const t0 = l.bar ? t.at + 0.14 : t.at
    const per = M.clamp(Math.max(0.28, t.end - t.at + 0.32) / Math.max(1, n), 0.016, 0.042)
    return { t0, per, done: r2(t0 + n * per + 0.25) }
  }
  /** Image paths a paper spec references (for validation and copying). */
  M.paperRefs = function (spec) {
    const src = (v) => (typeof v === 'string' ? v : v && v.src)
    return [].concat((spec.objects || []).map(src), spec.frame ? [src(spec.frame.image)] : []).filter((s) => typeof s === 'string')
  }
  /** Bars and circles are the punctuation of a line: their sound cues. */
  function lineSfx(spec, env, hook) {
    const ls = M.paperLines(spec.lines)
    const t = M.paperTimes(spec, env, hook)
    const out = []
    ls.forEach((l, i) => {
      if (l.bar) out.push({ t: r2(Math.max(0, t[i].at - 0.12)), cue: 'pop' }, { t: r2(t[i].at + 0.02), cue: 'whoosh' })
      if (l.circle) out.push({ t: r2(M.paperLetters(l, t[i]).done - 0.1), cue: 'tick' })
      if (l.arrow) out.push({ t: r2(t[i].end + 0.2), cue: 'click' })
    })
    return out
  }
  const objectsSfx = (spec) => ((spec.objects || []).length ? [{ t: r2(Math.max(0, (spec.objects[0].at != null ? spec.objects[0].at : 0.05))), cue: 'whooshBig' }] : [])

  // ---------- browser ----------
  const h = M.h
  const set = (el, v) => g.gsap.set(el, v)

  /** The page: graph paper, a soft vignette and the brand mark top-left (static: identical in every scene). */
  function paper(c, o) {
    const { stage, env } = c
    stage.classList.add('mo-paper')
    h.box(stage, 'mo-pp-grid', { left: 0, top: 0, width: env.W, height: env.H })
    h.box(stage, 'mo-pp-vignette', { left: 0, top: 0, width: env.W, height: env.H })
    return o && o.mark === false ? null : mark(c)
  }
  function mark(c) {
    const m = h.box(c.stage, 'mo-pp-mark', { left: 58, top: 86 })
    h.el('div', 'mo-pp-logo', c.env.brand.logo || '', m)
    const n = h.el('div', 'mo-pp-name', '', m)
    h.el('b', '', null, n).textContent = c.env.brand.name || ''
    h.el('i', '', null, n).textContent = c.env.brand.tagline || ''
    return m
  }
  /** A small barcode under the mark (editorial detail of the reference's first shot). */
  function barcode(c) {
    const b = h.box(c.stage, 'mo-barcode', { left: 64, top: 250, width: 120, height: 46 })
    const R = M.rng(c.env.seed + 5)
    let x = 0
    while (x < 116) { const w = 1 + Math.round(R() * 4); const i = h.el('i', '', '', b); i.style.left = x + 'px'; i.style.width = w + 'px'; x += w + 2 + Math.round(R() * 3) }
    return b
  }

  /** Duotone filter (shadows → highlights), one per stage so ids never clash between scenes. */
  const DUO = { orange: ['#4A1000', '#FF9466'], deep: ['#1C0500', '#C8502C'], light: ['#8B2200', '#FFE1D2'] }
  function duo(c, kind) {
    const pair = DUO[kind] || DUO.orange
    const id = 'mo-duo-' + kind + '-' + (c.env.id || 's') + '-' + Math.round(c.env.seed)
    if (!c.stage.querySelector('#' + id)) {
      const rgb = (hx) => [1, 3, 5].map((i) => (parseInt(hx.slice(i, i + 2), 16) / 255).toFixed(3))
      const [a, b] = [rgb(pair[0]), rgb(pair[1])]
      const fn = (ch, i) => '<feFunc' + ch + ' type="table" tableValues="' + a[i] + ' ' + b[i] + '"/>'
      const d = h.el('div', 'mo-abs mo-pp-defs', '<svg width="0" height="0"><filter id="' + id + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/><feComponentTransfer>' + fn('R', 0) + fn('G', 1) + fn('B', 2) + '</feComponentTransfer></filter></svg>', c.stage)
      d.style.cssText += ';left:0;top:0;width:0;height:0;overflow:hidden'
    }
    return 'url(#' + id + ')'
  }

  /**
   * Stacked lines (top-left by default), each letter arriving blurred → sharp, left to right, when its words are said.
   * `o` = { x, y (fractions), align: left | center }. Returns the rows with their timing.
   */
  function lines(c, o) {
    const { stage, tl, env } = c
    const p = Object.assign({ x: 0.075, y: 0.2, align: 'left', hook: false }, o)
    const ls = M.paperLines(c.spec.lines)
    const times = M.paperTimes(c.spec, env, p.hook)
    const box = h.box(stage, 'mo-pp-lines mo-pp-' + p.align, { left: Math.round(p.x * env.W), top: Math.round(p.y * env.H) })
    if (p.align === 'center') set(box, { xPercent: -50 })
    const maxW = p.align === 'center' ? c.maxW : env.W - p.x * env.W - env.safe.r
    const rows = ls.map((l, i) => {
      let size = M.PAPER_SIZES[l.s] || (typeof l.s === 'number' ? l.s : M.PAPER_SIZES.s)
      const est = (n) => M.plain(l.t).length * 0.58 * n + (l.bar ? 0.6 * n : 0) + (l.arrow ? 0.8 * n : 0)
      while (est(size) > maxW && size > 30) size -= 2
      const cls = ['mo-pp-line', 'mo-pp-' + (l.c || (l.bar ? 'white' : 'ink'))]
      if (l.i) cls.push('mo-pp-i')
      if (l.outline) cls.push('mo-pp-outline')
      if (l.bar) cls.push('mo-pp-barrow')
      const row = h.el('div', cls.join(' '), '', box)
      row.style.fontSize = size + 'px'
      if (l.align) row.style.alignSelf = { left: 'flex-start', center: 'center', right: 'flex-end' }[l.align] || 'auto'
      if (l.dx) row.style.marginLeft = Math.round(l.dx) + 'px'
      const bar = l.bar ? h.el('span', 'mo-pp-bar' + (l.bar === 'deep' ? ' mo-pp-bar-deep' : ''), '', row) : null
      const txt = h.el('span', 'mo-pp-txt', '', row)
      const chars = []
      for (const tk of M.parse(l.t)) {
        if (tk.t === 'br') continue
        const w = h.el('span', 'mo-pp-w' + (tk.k === 'a' ? ' mo-pp-a' : ''), '', txt)
        for (const ch of Array.from(tk.s)) { const s = h.el('span', 'mo-ch', '', w); s.textContent = ch; chars.push(s) }
      }
      const t = times[i]
      const { t0, per, done } = M.paperLetters(l, t)
      if (bar) {
        // a small square lands, then stretches into the bar; the letters come once it is open
        const H = Math.round(size * 1.3)
        set(bar, { maxWidth: H, transformOrigin: Math.round(H / 2) + 'px 50%' })
        tl.fromTo(bar, { scale: 0, rotation: -12 }, { scale: 1, rotation: 0, duration: 0.2, ease: 'back.out(2.4)' }, Math.max(0, t.at - 0.14))
        tl.to(bar, { maxWidth: Math.round(est(size) + size * 1.2), duration: 0.5, ease: 'expo.out' }, Math.max(0.06, t.at + 0.04))
      }
      chars.forEach((ch, j) => tl.fromTo(ch, { opacity: 0, y: size * 0.2, filter: blur(Math.round(size * 0.16)) }, { opacity: 1, y: 0, filter: blur(0), duration: 0.4, ease: 'power2.out' }, r2(t0 + j * per)))
      if (l.circle) {
        // around the *accent* word when the line has one (the reference circles one word), else around the whole line
        const s = h.el('span', 'mo-pp-circle', '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path pathLength="1" d="M86 9 C70 -1 18 1 7 15 C-3 29 38 39 70 34 C96 30 103 14 79 6 C68 2 52 2 42 4"/></svg>', row.querySelector('.mo-pp-a') || row)
        // hidden until it starts: a round cap would otherwise leave a dot where the stroke begins
        tl.set(s, { opacity: 1 }, r2(done - 0.1))
        tl.fromTo(s.querySelector('path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' }, r2(done - 0.1))
      }
      if (l.arrow) {
        const up = l.arrow === 'up'
        const s = h.el('span', 'mo-pp-arrow', '<svg viewBox="0 0 20 50"><path pathLength="1" d="' + (up ? 'M10 48 L10 4 M2 13 L10 3 L18 13' : 'M10 2 L10 46 M2 37 L10 47 L18 37') + '"/></svg>', row)
        tl.set(s, { opacity: 1 }, r2(t.end + 0.2))
        tl.fromTo(s.querySelector('path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, r2(t.end + 0.2))
      }
      return { row, chars, at: t.at, end: t.end, done, size }
    })
    return { box, rows }
  }

  /**
   * Photo cut-outs thrown in from an edge (or from a point) with motion blur, then a slow drift. The long shadow and the duotone are static
   * filters on the image; only the wrapper moves. Item: { src, x, y, w, rot, from: right|left|top|bottom|none|[x,y], at, dur, dof, back, duo, flip, move }.
   */
  function objects(c, list) {
    const { stage, tl, env } = c
    return (list || []).map((raw, i) => {
      const o = Object.assign({ x: 0.5, y: 0.62, w: 0.5, rot: 0, from: 'right', at: 0.04 + i * 0.1, dur: 0.75, dof: 0, drift: 1 }, typeof raw === 'string' ? { src: raw } : raw)
      const wrap = h.box(stage, 'mo-pp-obj' + (o.back ? ' mo-pp-back' : ''), { left: Math.round(o.x * env.W), top: Math.round(o.y * env.H), width: Math.round(o.w * env.W) })
      const img = h.el('img', 'mo-pp-img', '', wrap)
      img.src = o.src
      const f = [o.duo ? duo(c, o.duo) : '', o.dof ? blur(o.dof) : '', o.shadow === false ? '' : 'drop-shadow(' + Math.round(26 * (1 - o.dof / 20)) + 'px 38px 26px rgba(70, 24, 4, 0.3))'].filter(Boolean).join(' ')
      if (f) img.style.filter = f
      if (o.flip) img.style.transform = 'scaleX(-1)'
      set(wrap, { xPercent: -50, yPercent: -50, rotation: o.rot })
      const dir = { right: [1, 0.15], left: [-1, 0.15], top: [0.1, -1], bottom: [0.1, 1] }[o.from]
      const from = { rotation: o.rot, scale: 1, opacity: 0, filter: blur(22) }
      if (dir) { from.x = dir[0] * env.W * 0.85; from.y = dir[1] * env.H * 0.42; from.rotation = o.rot + (dir[0] || dir[1]) * 28 }
      else if (Array.isArray(o.from)) { from.x = (o.from[0] - o.x) * env.W; from.y = (o.from[1] - o.y) * env.H; from.scale = 0.25; from.rotation = o.rot - 30 }
      else { from.scale = 0.7; from.filter = blur(14) }
      tl.fromTo(wrap, from, { x: 0, y: 0, rotation: o.rot, scale: 1, opacity: 1, filter: blur(0), duration: o.dur, ease: 'expo.out' }, o.at)
      const settle = o.at + o.dur
      const until = o.move ? o.move.at : c.dur
      if (until - settle > 0.2 && o.drift) tl.to(wrap, { y: -26 * o.drift, rotation: o.rot + 2.5 * o.drift, duration: until - settle, ease: 'none' }, settle)
      if (o.move) {
        const mv = o.move
        tl.to(wrap, { x: ((mv.x != null ? mv.x : o.x) - o.x) * env.W, y: ((mv.y != null ? mv.y : o.y) - o.y) * env.H, scale: mv.s != null ? mv.s : 1, rotation: mv.rot != null ? mv.rot : o.rot, opacity: mv.fade ? 0 : 1, filter: blur(mv.fade ? 10 : 0), duration: mv.dur || 0.6, ease: mv.ease || 'power3.in' }, mv.at)
      }
      return wrap
    })
  }

  /** Every paper scene: page, mark, objects, its own module, then the lines on top. */
  function build(c, module, o) {
    const { spec } = c
    const p = Object.assign({ hook: false }, o)
    paper(c)
    if (p.hook) barcode(c)
    objects(c, spec.objects)
    const ctx = module ? module(c) : {}
    const at = Object.assign({ x: 0.075, y: 0.2, align: 'left' }, ctx.lines, spec.at)
    const ls = lines(c, Object.assign(at, { hook: p.hook }))
    c.fx.drift(c.tl, [ls.box], 0, c.dur, 18, c.env.seed)
    if (ctx.after) ctx.after(ls)
    return ls
  }

  // ---------- modules ----------
  /** Orange chart card: axes, a line that draws itself down to an arrowhead (reference: ad spend up, leads down). */
  function chart(c) {
    const { stage, tl, env, spec } = c
    const k = Object.assign({ x: 0.5, y: 0.52, w: 0.78, h: 0.27, at: 0.15, points: [[0.02, 0.06], [0.24, 0.46], [0.37, 0.32], [0.62, 0.5], [0.96, 0.92]] }, spec.chart)
    const W = Math.round(k.w * env.W)
    const H = Math.round(k.h * env.H)
    const card = h.box(stage, 'mo-pp-chart', { left: Math.round(k.x * env.W - W / 2), top: Math.round(k.y * env.H - H / 2), width: W, height: H })
    const pad = 0.09
    const pts = k.points.map(([x, y]) => [Math.round((pad + x * (1 - 2 * pad)) * W), Math.round((pad + y * (1 - 2 * pad)) * H)])
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    const ang = (Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180) / Math.PI
    card.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><path class="mo-pp-axis" pathLength="1" d="M' + Math.round(pad * W) + ' ' + Math.round(pad * H * 0.6) + ' L' + Math.round(pad * W) + ' ' + Math.round((1 - pad) * H) + ' L' + Math.round((1 - pad * 0.6) * W) + ' ' + Math.round((1 - pad) * H) + '"/><path class="mo-pp-curve" pathLength="1" d="M' + pts.map((q) => q.join(' ')).join(' L') + '"/><path class="mo-pp-head" d="M-26 -17 L0 0 L-26 17" transform="translate(' + last[0] + ' ' + last[1] + ') rotate(' + r2(ang) + ')"/></svg>'
    tl.fromTo(card, { opacity: 0, y: 120, scale: 0.86, rotation: -4, filter: blur(16) }, { opacity: 1, y: 0, scale: 1, rotation: 0, filter: blur(0), duration: 0.6, ease: 'expo.out' }, k.at)
    tl.fromTo(card.querySelector('.mo-pp-axis'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, k.at + 0.25)
    const draw = k.draw || 1.3
    tl.fromTo(card.querySelector('.mo-pp-curve'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: draw, ease: 'power1.inOut' }, k.at + 0.4)
    tl.fromTo(card.querySelector('.mo-pp-head'), { opacity: 0 }, { opacity: 1, duration: 0.12 }, k.at + 0.4 + draw - 0.08)
    c.fx.drift(tl, [card], k.at + 0.6, c.dur - k.at - 0.6, 14, c.env.seed + 3)
    return {}
  }
  const chartSfx = (spec) => { const at = (spec.chart && spec.chart.at) || 0.15; return [{ t: r2(at), cue: 'whoosh' }, { t: r2(at + 0.4 + ((spec.chart && spec.chart.draw) || 1.3)), cue: 'tick' }] }

  /** A deck of cards that slows down… then bursts open, one card per destination of the money: 2 or 3 fan out like a hand, 4 spread on a grid. */
  function deck(c) {
    const { stage, tl, env, spec } = c
    const k = Object.assign({ x: 0.5, y: 0.6, w: 0.4, at: 0.1 }, spec.deck)
    const items = (k.items || []).slice(0, 4)
    const n = items.length
    const grid = n >= 4
    const W = Math.round(k.w * env.W)
    const H = Math.round(W * (grid ? 1.05 : 1.3))
    const box = h.box(stage, 'mo-pp-deck', { left: Math.round(k.x * env.W - W / 2), top: Math.round(k.y * env.H - H / 2), width: W, height: H })
    const fanAt = k.fan != null ? k.fan : fanTime(spec, env)
    const cards = items.map((it, i) => {
      const card = h.el('div', 'mo-pp-card', '', box)
      const ic = h.el('div', 'mo-pp-cardic', h.icon(it.icon || 'sparkles', 64, '#fff', 2.2), card)
      ic.setAttribute('aria-hidden', 'true')
      const lab = h.el('div', 'mo-pp-brush', '<i></i>', card)
      h.el('span', '', null, lab).textContent = it.label || ''
      const j = i - (n - 1) / 2
      set(card, { transformOrigin: '50% 130%', x: j * 6, y: -i * 7, rotation: j * 1.5 })
      // grid: two columns, a small tilt each; hand: spread angle and a step sideways, the middle cards a little higher
      const to = grid
        ? { rotation: [-5, 4, 3, -4][i], x: ((i % 2) - 0.5) * (W + 44), y: (Math.floor(i / 2) - 0.5) * (H + 44) }
        : { rotation: j * 22, x: j * W * 0.3, y: -Math.abs(j) * 6 - 20 }
      tl.to(card, Object.assign(to, { duration: 0.6, ease: 'back.out(1.5)' }), r2(fanAt + i * 0.03))
      return card
    })
    tl.fromTo(box, { opacity: 0, y: env.H * 0.4, rotationX: 40, rotationZ: -14, transformPerspective: 1600, filter: blur(20) }, { opacity: 1, y: 0, rotationX: 14, rotationZ: -4, filter: blur(0), duration: 0.8, ease: 'expo.out' }, k.at)
    // the tension before the burst
    tl.to(box, { scale: 1.05, rotationZ: -1, duration: Math.max(0.2, fanAt - k.at - 0.8), ease: 'sine.inOut' }, k.at + 0.8)
    tl.to(box, { scale: 1, rotationX: 6, rotationZ: 0, duration: 0.6, ease: 'back.out(1.4)' }, fanAt)
    c.fx.drift(tl, [box], fanAt + 0.6, Math.max(0.2, c.dur - fanAt - 0.6), 16, c.env.seed + 9)
    return { cards }
  }
  /** The deck opens once the circled line (else the last one) is written and its circle drawn. */
  function fanTime(spec, env) {
    const ls = M.paperLines(spec.lines)
    const t = M.paperTimes(spec, env, false)
    if (!ls.length) return 0.8
    const i = Math.max(0, ls.findIndex((l) => l.circle))
    return r2(M.paperLetters(ls[i], t[i]).done + (ls[i].circle ? 0.4 : 0.1))
  }
  const deckSfx = (spec, env) => { const f = spec.deck && spec.deck.fan != null ? spec.deck.fan : fanTime(spec, env); return [{ t: r2((spec.deck && spec.deck.at) || 0.1), cue: 'whoosh' }, { t: r2(f), cue: 'whooshBig' }, { t: r2(f + 0.12), cue: 'pop' }] }

  /** A duotone person (or object) rising from the bottom of the frame, icon chips popping around it. */
  function rise(c) {
    const { stage, tl, env, spec } = c
    const k = Object.assign({ x: 0.5, w: 0.96, bottom: 0, at: 0.05, duo: 'orange' }, spec.rise)
    const W = Math.round(k.w * env.W)
    const wrap = h.box(stage, 'mo-pp-obj mo-pp-rise', { left: Math.round(k.x * env.W - W / 2), bottom: Math.round(k.bottom * env.H), width: W })
    const img = h.el('img', 'mo-pp-img', '', wrap)
    img.src = spec.image
    img.style.filter = [k.duo ? duo(c, k.duo) : '', 'drop-shadow(30px 40px 30px rgba(70, 24, 4, 0.28))'].filter(Boolean).join(' ')
    tl.fromTo(wrap, { y: env.H * 0.45, opacity: 0, filter: blur(18) }, { y: 0, opacity: 1, filter: blur(0), duration: 0.9, ease: 'expo.out' }, k.at)
    tl.to(wrap, { y: -30, scale: 1.03, duration: Math.max(0.3, c.dur - k.at - 0.9), ease: 'none' }, k.at + 0.9)
    return {
      lines: { x: 0.5, y: 0.17, align: 'center' },
      after(ls) {
        const icons = spec.icons || []
        const slots = [[0.14, 0.43], [0.86, 0.4], [0.1, 0.62], [0.9, 0.6], [0.5, 0.36]]
        const last = ls.rows.length ? ls.rows[ls.rows.length - 1].at + 0.35 : 1
        icons.slice(0, slots.length).forEach((ic, i) => {
          const d = 150
          const chip = h.box(stage, 'mo-pp-chip', { left: Math.round(slots[i][0] * env.W - d / 2), top: Math.round(slots[i][1] * env.H - d / 2), width: d, height: d }, h.icon(typeof ic === 'string' ? ic : ic.icon, 74, 'currentColor', 2.1))
          const at = r2(Math.min(c.dur - 0.7, last + i * 0.14))
          tl.fromTo(chip, { opacity: 0, scale: 0.3, rotation: i % 2 ? 20 : -20, filter: blur(10) }, { opacity: 1, scale: 1, rotation: 0, filter: blur(0), duration: 0.45, ease: E.spring }, at)
          tl.to(chip, { y: -24, duration: Math.max(0.3, c.dur - at - 0.45), ease: 'sine.inOut' }, r2(at + 0.45))
        })
      },
    }
  }
  const riseSfx = (spec, env) => {
    const t = M.paperTimes(spec, env, false)
    const last = t.length ? t[t.length - 1].at + 0.35 : 1
    return [{ t: 0.04, cue: 'whoosh' }, ...(spec.icons || []).slice(0, 5).map((_, i) => ({ t: r2(last + 0.05 + i * 0.14), cue: i % 2 ? 'tick' : 'pop' }))]
  }

  /** A person stepping out of a rounded orange card (the head breaks the frame), a notification falling on the card. */
  function frame(c) {
    const { stage, tl, env, spec } = c
    const k = Object.assign({ x: 0.5, y: 0.62, w: 0.84, h: 0.4, at: 0.06, scale: 1.3 }, spec.frame)
    const W = Math.round(k.w * env.W)
    const H = Math.round(k.h * env.H)
    const box = h.box(stage, 'mo-pp-frame', { left: Math.round(k.x * env.W - W / 2), top: Math.round(k.y * env.H - H / 2), width: W, height: H })
    const bg = h.el('div', 'mo-pp-framebg', '', box)
    const cut = h.el('div', 'mo-pp-framecut', '', box)
    const img = h.el('img', 'mo-pp-frameimg', '', cut)
    img.src = typeof k.image === 'string' ? k.image : k.image.src
    img.style.height = Math.round(H * k.scale) + 'px'
    set(img, { xPercent: -100 * (k.focus != null ? k.focus : 0.5) })
    tl.fromTo(bg, { scale: 0.2, opacity: 0, rotation: -6, filter: blur(14) }, { scale: 1, opacity: 1, rotation: 0, filter: blur(0), duration: 0.55, ease: 'expo.out' }, k.at)
    tl.fromTo(img, { y: H * 0.7 }, { y: 0, duration: 0.8, ease: 'expo.out' }, k.at + 0.12)
    tl.to(box, { y: -22, duration: Math.max(0.3, c.dur - k.at - 0.8), ease: 'none' }, k.at + 0.8)
    return {
      lines: { x: 0.5, y: 0.19, align: 'center' },
      after(ls) {
        if (!k.pill) return
        const at = r2(ls.rows.length ? ls.rows[ls.rows.length - 1].done - 0.1 : 1.2)
        const p = h.box(stage, 'mo-toast mo-pp-pill', { left: Math.round(k.x * env.W - W * 0.44), top: Math.round(k.y * env.H + H * 0.5 - 70) })
        p.innerHTML = '<i>' + h.icon(k.pill.icon || 'check', 44, '#fff', 2.6) + '</i><span></span>'
        p.querySelector('span').textContent = k.pill.text || ''
        tl.fromTo(p, { opacity: 0, y: -60, scale: 0.7, filter: blur(10) }, { opacity: 1, y: 0, scale: 1, filter: blur(0), duration: 0.5, ease: E.spring }, Math.min(c.dur - 0.5, at))
      },
    }
  }
  const frameSfx = (spec, env) => {
    const t = M.paperTimes(spec, env, false)
    const out = [{ t: r2((spec.frame && spec.frame.at) || 0.06), cue: 'whoosh' }]
    if (spec.frame && spec.frame.pill) out.push({ t: r2((t.length ? t[t.length - 1].end : 1) + 0.15), cue: 'notify' })
    return out
  }

  /** A button born from a square: it stretches, its icon lands, its label types in, a small line follows under it. */
  function button(c) {
    const { stage, tl, env, spec } = c
    const k = Object.assign({ y: 0.5, at: null, icon: 'wallet' }, spec.button)
    const t = M.paperTimes(spec, env, false)
    const at = k.at != null ? k.at : r2(t.length ? t[t.length - 1].end + 0.35 : 0.3)
    const text = k.text || ''
    const fs = 54
    const Hb = 132
    const full = Math.round(Array.from(text).length * fs * 0.58 + 44 * 2 + 30 + 64 + 10)
    const btn = h.box(stage, 'mo-pp-btn', { left: Math.round(env.W / 2 - full / 2), top: Math.round(k.y * env.H - Hb / 2), height: Hb })
    const ic = h.el('i', 'mo-pp-btnic', h.icon(k.icon, 64, '#fff', 2.2), btn)
    const lab = h.letters(btn, text, 'mo-pp-btntext')
    set(btn, { maxWidth: Hb, transformOrigin: Math.round(Hb / 2) + 'px 50%' })
    tl.fromTo(btn, { scale: 0, rotation: -15, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.24, ease: 'back.out(2.2)' }, at)
    tl.to(btn, { maxWidth: full + 20, duration: 0.6, ease: 'expo.out' }, at + 0.22)
    tl.fromTo(ic, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: E.spring }, at + 0.3)
    lab.chars.forEach((ch, j) => tl.fromTo(ch, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: 'none' }, r2(at + 0.5 + j * 0.035)))
    const typed = at + 0.5 + lab.chars.length * 0.035
    let sub = null
    if (k.sub) {
      sub = h.box(stage, 'mo-pp-sub', { left: Math.round(env.W / 2 - full / 2) + 10, top: Math.round(k.y * env.H + Hb / 2 + 34) })
      const chars = h.letters(sub, k.sub, '').chars
      chars.forEach((ch, j) => tl.fromTo(ch, { opacity: 0, y: 10, filter: blur(8) }, { opacity: 1, y: 0, filter: blur(0), duration: 0.35, ease: 'power2.out' }, r2(typed + 0.15 + j * 0.022)))
    }
    tl.to([btn, sub].filter(Boolean), { y: -40, duration: Math.max(0.3, c.dur - typed), ease: 'sine.inOut' }, typed)
    return { lines: { x: 0.5, y: Math.max(0.16, k.y - 0.17), align: 'center' } }
  }
  const buttonSfx = (spec, env) => {
    const t = M.paperTimes(spec, env, false)
    const k = spec.button || {}
    const at = k.at != null ? k.at : r2(t.length ? t[t.length - 1].end + 0.35 : 0.3)
    return [{ t: r2(at), cue: 'pop' }, { t: r2(at + 0.22), cue: 'whoosh' }, { t: r2(at + 0.5), cue: 'type' }, { t: r2(at + 0.5 + Array.from(k.text || '').length * 0.035), cue: 'click' }]
  }

  // ---------- registry ----------
  const scene = (type, label, module, needs, sfx, extra) =>
    M.register(type, Object.assign({
      kind: 'scene', label, min: 1.6, max: 6.5, words: [1, 16], needs,
      sfx: (spec, env) => [...objectsSfx(spec), ...(sfx ? sfx(spec, env) : []), ...lineSfx(spec, env, false)],
      build(c) { build(c, module) },
    }, extra))

  M.register('hook.paper', {
    kind: 'hook', label: 'Papier quadrillé : lignes lettre par lettre, barre orange qui naît d’un carré, objets photo lancés avec flou de mouvement', min: 2.8, max: 3.0, words: [1, 7], needs: ['lines'],
    sfx: (spec, env) => [{ t: 0.02, cue: 'whoosh' }, ...objectsSfx(spec), ...lineSfx(spec, env, true)],
    legible(spec, env) { const t = M.paperTimes(spec, env, true); const n = M.plain(M.paperText(spec.lines)).length; return r2((t.length ? t[t.length - 1].end : 0) + Math.min(0.5, 0.15 + n * 0.006)) },
    build(c) { build(c, c.spec.chart ? chart : null, { hook: true }) },
  })
  scene('scene.paper', 'Papier quadrillé : lignes de tailles mêlées lettre par lettre (barre, cercle à la main, flèche, contour) et objets photo', null, ['lines'])
  scene('scene.chart', 'Papier quadrillé : carte orange où une courbe descend en se dessinant, objets photo, lignes au-dessus', chart, ['lines', 'chart'], chartSfx)
  scene('scene.deck', 'Papier quadrillé : pile de cartes qui ralentit puis s’évente (une carte par destination), mot entouré à la main', deck, ['lines', 'deck'], deckSfx)
  scene('scene.rise', 'Papier quadrillé : personne détourée en bichromie orange qui monte du bas, pictos autour', rise, ['lines', 'image'], riseSfx)
  scene('scene.frame', 'Papier quadrillé : personne qui sort d’une carte orange (la tête dépasse), notification qui tombe', frame, ['lines', 'frame'], frameSfx)
  scene('scene.button', 'Papier quadrillé : bouton qui naît d’un carré, s’allonge, texte tapé, petite ligne dessous', button, ['button'], buttonSfx)

  /** End card on the same paper: big mark, orange card, dark pill, deep-orange box of outlined pills; it folds back to the bare page (loop). */
  M.register('scene.contact', {
    kind: 'end', label: 'Papier quadrillé : carte finale (logo, carte orange, pilule, encadré de contacts) qui se replie sur la page vide pour boucler', min: 2.2, max: 5, words: [0, 12], needs: [],
    sfx: () => [{ t: 0.06, cue: 'whoosh' }, { t: 0.3, cue: 'pop' }, { t: 0.5, cue: 'pop' }, { t: 0.75, cue: 'chime' }],
    build(c) {
      const { stage, tl, env, spec } = c
      paper(c, { mark: false })
      const col = h.box(stage, 'mo-pp-end', { left: 0, top: Math.round(env.H * 0.15), width: env.W })
      const head = h.el('div', 'mo-pp-endlogo', '', col)
      h.el('div', 'mo-pp-logo', env.brand.logo || '', head)
      h.el('b', '', null, head).textContent = env.brand.name || ''
      h.el('i', '', null, head).textContent = env.brand.tagline || ''
      const card = h.el('div', 'mo-pp-endcard', '', col)
      for (const line of String(spec.text || env.brand.audience || '').split('|')) h.el('div', '', null, card).textContent = line.trim()
      const pill = h.el('div', 'mo-pp-endpill', null, col)
      pill.textContent = spec.cta || env.brand.cta || ''
      const box = h.el('div', 'mo-pp-endbox', '', col)
      for (const p of spec.pills || [env.brand.handle].filter(Boolean)) {
        const s = h.el('span', '', h.icon(p.icon || 'check', 34, '#fff', 2.4), box)
        h.el('em', '', null, s).textContent = typeof p === 'string' ? p : p.text
      }
      const parts = [head, card, pill, box]
      parts.forEach((el, i) => tl.fromTo(el, { opacity: 0, y: 60, scale: 0.92, filter: blur(16) }, { opacity: 1, y: 0, scale: 1, filter: blur(0), duration: 0.55, ease: 'expo.out' }, r2(0.06 + i * 0.2)))
      c.fx.drift(tl, [col], 0.6, Math.max(0.3, c.dur - 1.2), 14, env.seed)
      // fold back: the blocks leave, the corner mark returns: the last frame is the hook's first one
      const out = Math.max(1.6, c.dur - 0.55)
      tl.to(parts.slice().reverse(), { opacity: 0, y: -40, filter: blur(12), duration: 0.32, ease: E.in, stagger: 0.05 }, out)
      const m = mark(c)
      tl.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, out + 0.2)
    },
  })
})(typeof window !== 'undefined' ? window : globalThis)
