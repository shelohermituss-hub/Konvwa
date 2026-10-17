/* KONVWA motion engine — body scenes and the closing card (browser build + pure sound cues).
 * A scene is a spec ({type, text, ...}) in the brief; its length comes from the voice-over (or `min`), never from hand-set timings. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  const { E } = M
  const strip = (s) => String(s || '').replace(/[*_]/g, '')
  const blur = (n) => 'blur(' + n + 'px)'

  /** A heading block (kicker + words) at the top of the content area. Returns {box, words, bottom}. */
  function heading(c, markup, o) {
    const { stage, tl, env, h, fx } = c
    const p = Object.assign({ top: env.safe.t, size: 104, max: 1.1, start: undefined, align: 'center' }, o)
    const lay = M.layout(markup, c.maxW, { max: p.size, min: 64, maxLines: 2 })
    const size = lay.size
    const t = h.text(stage, lay.markup, 'mo-h1 mo-head', { left: env.safe.l, width: c.maxW, top: p.top, fontSize: size })
    t.box.style.position = 'absolute'
    if (p.align === 'left') t.box.style.justifyContent = 'flex-start', t.box.style.textAlign = 'left'
    const times = c.times(markup, { start: p.start, cap: p.max, pace: 0.16 })
    fx.reveal(tl, t.words, times, { y: 44, blur: 14, dur: 0.55 })
    const ai = M.accentIndex(markup)
    if (ai >= 0) {
      const w = t.words[ai]
      w.style.position = 'relative'
      fx.mark(tl, t.words, times[ai] + 0.2, 0.45)
    }
    return { box: t.box, words: t.words, times, size, height: Math.round(lay.lines * size * 1.06), accentAt: ai >= 0 ? times[ai] : null }
  }
  const headSfx = (spec, env) => {
    const ai = M.accentIndex(spec.text || '')
    if (ai < 0) return []
    const t = M.timesFor(spec.text, env, { cap: 1.1, pace: 0.16 })
    return [{ t: M.r2((t[ai] || 0.3) + 0.12), cue: 'pop' }]
  }
  /** `n` moments spread over the voice (or a steady pace), starting at `from`. */
  const spread = (c, n, from, step) => {
    const start = Math.max(from, c.env.vo ? c.env.vo.start + 0.25 : from)
    const span = c.env.vo ? Math.max(0.5, c.env.vo.dur * 0.78 - (start - c.env.vo.start)) : Math.max(0.6, n * step)
    return Array.from({ length: n }, (_, i) => M.r2(start + (n === 1 ? 0 : (i * span) / (n - 1 + 0.35))))
  }
  const spreadPure = (env, n, from, step) => {
    const start = Math.max(from, env.vo ? env.vo.start + 0.25 : from)
    const span = env.vo ? Math.max(0.5, env.vo.dur * 0.78 - (start - env.vo.start)) : Math.max(0.6, n * step)
    return Array.from({ length: n }, (_, i) => M.r2(start + (n === 1 ? 0 : (i * span) / (n - 1 + 0.35))))
  }

  // ============ scene.kinetic — one idea, big words in sync with the voice ============
  M.register('scene.kinetic', {
    kind: 'scene', label: 'Une idée : gros mots synchronisés avec la voix, mot-clé surligné', min: 2.0, max: 6, words: [1, 14], needs: ['text'],
    sfx: (spec, env) => headSfx(spec, env),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, spec.bg || 'glow', env.theme)
      const wrap = h.box(stage, 'mo-center', { left: env.safe.l, width: c.maxW, top: env.safe.t, height: env.H - env.safe.t - env.safe.b })
      const stack = h.el('div', 'mo-stack', '', wrap)
      if (spec.icon) {
        const ic = h.el('div', 'mo-badge', h.icon(spec.icon, 76, '#fff', 2.1), stack)
        fx.pop(tl, ic, 0.05, { from: 0.4 })
      }
      if (spec.kicker) {
        const k = h.el('div', 'mo-cap', '', stack)
        k.textContent = spec.kicker
        fx.fadeUp(tl, k, 0.05, { y: 20, dur: 0.4 })
      }
      const lay = M.layout(spec.text, c.maxW, { max: 170, min: 66, maxLines: 4 })
      const size = lay.size
      const t = h.text(stack, lay.markup, 'mo-h1', { fontSize: size })
      const times = c.times(spec.text, { cap: 2.4, pace: 0.2 })
      fx.reveal(tl, t.words, times, { y: 48, blur: 16, dur: 0.58 })
      const ai = M.accentIndex(spec.text)
      if (ai >= 0) {
        const w = t.words[ai]
        w.style.position = 'relative'
        fx.mark(tl, t.words, times[ai] + 0.2, 0.5)
      }
      if (spec.sub) {
        const s = h.text(stack, spec.sub, 'mo-sub', { fontSize: Math.round(size * 0.4) })
        fx.reveal(tl, s.words, c.times(spec.sub, { start: times[times.length - 1] + 0.3, cap: 0.6 }), { y: 24, blur: 8, dur: 0.45 })
      }
      fx.breathe(tl, stack, 0.2, c.dur, 1.045)
    },
  })

  // ============ scene.chips — a list of benefits as pills, one lit after the other ============
  M.register('scene.chips', {
    kind: 'scene', label: 'Liste d’atouts en pilules : chacune s’allume au rythme de la voix', min: 2.6, max: 7, words: [1, 8], needs: ['items'],
    sfx: (spec, env) => spreadPure(env, (spec.items || []).length, 0.7, 0.45).map((t) => ({ t, cue: 'pop' })),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      h.bg(stage, env, 'glow', env.theme)
      const head = spec.text ? heading(c, spec.text, { top: env.safe.t + 10, size: 128 }) : null
      const items = spec.items.slice(0, 6)
      const top = head ? env.safe.t + 10 + head.height + 40 : env.safe.t + 120
      const wrap = h.box(stage, 'mo-chipwrap', { left: env.safe.l, width: c.maxW, top, height: env.H - env.safe.b - top })
      const times = spread(c, items.length, 0.7, 0.45)
      const chips = items.map((s, i) => {
        const chip = h.el('div', 'mo-chip', '', wrap)
        chip.innerHTML = '<i class="mo-chip-ic">' + h.icon(spec.icons && spec.icons[i] ? spec.icons[i] : 'check', 44, 'currentColor', 2.6) + '</i><span></span>'
        chip.querySelector('span').textContent = s
        fx.pop(tl, chip, times[i], { from: 0.55, y: 26, dur: 0.5 })
        // lit while current, outlined after
        tl.fromTo(chip, { backgroundColor: env.pal.card, color: env.pal.ink, borderColor: env.pal.line }, { backgroundColor: env.pal.accent, color: '#fff', borderColor: env.pal.accent, duration: 0.25, ease: 'power2.out', immediateRender: false }, times[i] + 0.1)
        if (i < items.length - 1) tl.to(chip, { backgroundColor: env.pal.card, color: env.pal.ink, borderColor: env.pal.line, duration: 0.3 }, times[i + 1] + 0.05)
        return chip
      })
      fx.breathe(tl, wrap, 0.2, c.dur, 1.03)
    },
  })

  // ============ scene.callouts — a central badge with labelled lines going out of it ============
  M.register('scene.callouts', {
    kind: 'scene', label: 'Pastille centrale (icône) avec 2 à 4 légendes reliées par des traits', min: 2.8, max: 7, words: [0, 8], needs: ['labels'],
    sfx: (spec, env) => [{ t: 0.2, cue: 'pop' }, ...spreadPure(env, (spec.labels || []).length, 0.9, 0.5).map((t) => ({ t, cue: 'tick' }))],
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'rings', env.theme)
      if (spec.text) heading(c, spec.text, { top: env.safe.t, size: 116 })
      const labels = spec.labels.slice(0, 4)
      const hexR = 190
      const hx = c.cx
      const hy = c.cy + 70
      const svg = h.box(stage, 'mo-lines', { left: 0, top: 0, width: env.W, height: env.H })
      const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      const times = spread(c, labels.length, 0.9, 0.5)
      let html = ''
      const anchors = labels.map((_, i) => {
        const [sx, sy] = pts[i]
        return { ax: hx + sx * (hexR + 150), ay: hy + sy * (hexR + 190), sx, sy }
      })
      anchors.forEach((a, i) => { html += '<path class="ln" d="M ' + Math.round(hx + a.sx * hexR * 0.7) + ' ' + Math.round(hy + a.sy * hexR * 0.6) + ' L ' + Math.round(a.ax) + ' ' + Math.round(a.ay) + '" stroke="var(--ink)" stroke-width="3" fill="none"/>' })
      svg.innerHTML = '<svg width="' + env.W + '" height="' + env.H + '" viewBox="0 0 ' + env.W + ' ' + env.H + '">' + html + '</svg>'
      const hex = h.box(stage, 'mo-hex', { left: hx - hexR, top: hy - hexR, width: hexR * 2, height: hexR * 2 })
      hex.innerHTML = '<svg viewBox="0 0 100 100" width="' + hexR * 2 + '" height="' + hexR * 2 + '"><polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill="var(--accent)" stroke="var(--ink)" stroke-width="2.4"/></svg><div class="mo-hexic">' + h.icon(spec.icon || 'package', 150, '#fff', 1.8) + '</div>'
      fx.pop(tl, hex, 0.15, { from: 0.3, dur: 0.6, ease: E.springHard })
      svg.querySelectorAll('.ln').forEach((p, i) => fx.draw(tl, p, times[i], 0.45, 'power2.out'))
      labels.forEach((s, i) => {
        const a = anchors[i]
        const lab = h.box(stage, 'mo-label', { left: a.sx < 0 ? env.safe.l : null, right: a.sx > 0 ? env.safe.r : null, top: a.sy < 0 ? a.ay - 74 : a.ay + 12, maxWidth: c.maxW * 0.46 })
        if (a.sx < 0) lab.style.left = env.safe.l + 'px'
        else lab.style.right = env.safe.r + 'px'
        lab.style.textAlign = a.sx < 0 ? 'left' : 'right'
        lab.textContent = s
        fx.fadeUp(tl, lab, times[i] + 0.25, { y: 24, dur: 0.5, blur: 8 })
      })
      fx.breathe(tl, hex, 0.8, c.dur, 1.05)
    },
  })

  // ============ scene.stat — a number and what it means ============
  M.register('scene.stat', {
    kind: 'scene', label: 'Un chiffre qui monte et sa légende', min: 2.4, max: 6, words: [0, 10], needs: ['value'],
    sfx: () => [{ t: 0.15, cue: 'riser' }, { t: 1.2, cue: 'impact' }],
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'glow', env.theme)
      const total = String(Math.round(spec.value)).length + (spec.suffix ? String(spec.suffix).length * 0.55 : 0) + (spec.prefix ? 0.4 : 0)
      const size = M.clamp(Math.round(c.maxW / (total * 0.66)), 140, 380)
      const wrap = h.box(stage, 'mo-center', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy - size * 0.9), height: Math.round(size * 1.15) })
      const num = h.el('div', 'mo-bignum', '', wrap)
      num.style.fontSize = size + 'px'
      h.el('span', 'mo-numpre', spec.prefix || '', num).style.fontSize = Math.round(size * 0.46) + 'px'
      const val = h.el('span', 'mo-numval', '0', num)
      h.el('span', 'mo-numsuf', spec.suffix || '', num).style.fontSize = Math.round(size * 0.46) + 'px'
      fx.count(tl, val, 0, spec.value, 0.2, 1.2, (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' '), 'power4.out')
      tl.fromTo(num, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: E.outX }, 0.1)
      tl.to(num, { scale: 1.06, duration: 0.14 }, 1.3)
      tl.to(num, { scale: 1, duration: 0.4, ease: E.spring }, 1.44)
      if (spec.kicker) { const k = h.box(stage, 'mo-cap mo-center-text', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy - size * 1.2) }); k.textContent = spec.kicker; fx.fadeUp(tl, k, 0.1, { y: 18 }) }
      if (spec.text) {
        const t = h.text(stage, spec.text, 'mo-sub mo-center-text', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy + size * 0.3), fontSize: 74 })
        t.box.style.position = 'absolute'
        fx.reveal(tl, t.words, c.times(spec.text, { start: 1.1, cap: 1.2 }), { y: 30, blur: 10, dur: 0.5 })
      }
    },
  })

  // ============ scene.product — real product photos on floating tiles with price tags ============
  M.register('scene.product', {
    kind: 'scene', label: 'Vraies photos produit sur des vignettes flottantes avec leurs prix', min: 2.8, max: 7, words: [0, 8], needs: ['images'],
    sfx: (spec, env) => spreadPure(env, (spec.images || []).length, 0.4, 0.4).map((t) => ({ t, cue: 'pop' })),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'glow', env.theme)
      const head = spec.text ? heading(c, spec.text, { top: env.safe.t, size: 120 }) : null
      const imgs = spec.images.slice(0, 3)
      const prices = spec.prices || []
      const times = spread(c, imgs.length, 0.5, 0.4)
      const big = Math.min(700, c.maxW * 0.74)
      const small = Math.round(big * 0.52)
      const cy = head ? (env.safe.t + head.height + 40 + (env.H - env.safe.b)) / 2 : c.cy
      const spots = [
        { x: c.cx - big / 2, y: cy - big / 2 + 20, s: big, r: -3 },
        { x: env.safe.l - 10, y: cy + big / 2 - 20, s: small, r: -7 },
        { x: env.W - env.safe.r - small + 10, y: cy - big / 2 - 60, s: small, r: 6 },
      ]
      const group = h.box(stage, '', { left: 0, top: 0, width: env.W, height: env.H })
      imgs.forEach((src, i) => {
        const sp = spots[i]
        const tile = h.box(group, 'mo-tile', { left: Math.round(sp.x), top: Math.round(sp.y), width: sp.s, height: Math.round(sp.s * 1.14) })
        const im = h.el('img', 'mo-tile-img', '', tile)
        im.src = src
        if (prices[i]) {
          const pr = h.el('span', 'mo-price', '', tile)
          pr.textContent = prices[i]
        }
        tl.fromTo(tile, { opacity: 0, scale: 0.55, y: 90, rotation: sp.r * 3 }, { opacity: 1, scale: 1, y: 0, rotation: sp.r, duration: 0.65, ease: E.springHard }, times[i])
      })
      fx.drift(tl, [group], 0.8, c.dur, 26, env.seed)
    },
  })

  // ============ scene.ui — interface cards (toast, card, button) appearing in a stack, a cursor taps the button ============
  M.register('scene.ui', {
    kind: 'scene', label: 'Éléments d’interface (notification, carte, bouton) empilés, un curseur appuie', min: 3.0, max: 8, words: [0, 8], needs: ['items'],
    sfx: (spec, env) => {
      const its = spec.items || []
      const t = spreadPure(env, its.length, 0.7, 0.55)
      return its.map((it, i) => ({ t: t[i], cue: it.kind === 'toast' ? 'notify' : 'pop' })).concat(its.some((i) => i.kind === 'button') ? [{ t: M.r2(t[t.length - 1] + 0.55), cue: 'click' }, { t: M.r2(t[t.length - 1] + 0.7), cue: 'chime' }] : [])
    },
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'glow', env.theme)
      const head = spec.text ? heading(c, spec.text, { top: env.safe.t, size: 112 }) : null
      const items = spec.items.slice(0, 5)
      const times = spread(c, items.length, 0.7, 0.55)
      const col = h.box(stage, 'mo-uicol', { left: env.safe.l, width: c.maxW, top: head ? env.safe.t + head.height + 90 : env.safe.t + 140 })
      let btn = null
      const free = (env.H - env.safe.b) - parseFloat(col.style.top)
      items.forEach((it, i) => {
        let el
        if (it.kind === 'toast') {
          el = h.el('div', 'mo-toast', '<i>' + h.icon(it.icon || 'bell', 38, '#fff', 2.4) + '</i><span></span>', col)
          el.querySelector('span').textContent = it.title
        } else if (it.kind === 'button') {
          el = h.el('div', 'mo-btn', '', col)
          el.textContent = it.title
          btn = el
        } else {
          el = h.el('div', 'mo-uicard', '<i>' + h.icon(it.icon || 'package', 44, 'var(--accent)', 2.1) + '</i><div><b></b><em></em></div><strong></strong>', col)
          el.querySelector('b').textContent = it.title
          el.querySelector('em').textContent = it.sub || ''
          el.querySelector('strong').textContent = it.value || ''
        }
        fx.pop(tl, el, times[i], { from: 0.7, y: 70, dur: 0.55 })
      })
      col.style.top = Math.round(parseFloat(col.style.top) + Math.max(0, (free - col.offsetHeight) / 2 - 30)) + 'px'
      if (btn && spec.cursor !== false) {
        const cur = h.cursor(stage, 74)
        const tt = times[items.indexOf(items.find((x) => x.kind === 'button'))] + 0.75
        // the button's real position (layout is known here: the stage is already in the page)
        const colTop = parseFloat(col.style.top) || 0
        const bx = Math.round(env.safe.l + btn.offsetLeft + btn.offsetWidth * 0.72)
        const by = Math.round(colTop + btn.offsetTop + btn.offsetHeight * 0.55)
        fx.pointer(tl, cur, [{ x: bx + 260, y: by + 420, t: tt - 0.55 }, { x: bx, y: by, t: tt, tap: true }])
        fx.ripple(stage, tl, bx, by, tt, env.pal.accent)
        tl.to(btn, { scale: 0.96, duration: 0.09, ease: 'power2.in' }, tt)
        tl.to(btn, { scale: 1, duration: 0.3, ease: E.spring }, tt + 0.09)
      }
    },
  })

  // ============ scene.route — two places, a dashed route and a parcel travelling along it ============
  M.register('scene.route', {
    kind: 'scene', label: 'Deux lieux reliés par un tracé en pointillés, un colis voyage dessus', min: 3.0, max: 7, words: [0, 8], needs: ['from', 'to'],
    sfx: () => [{ t: 0.3, cue: 'pop' }, { t: 0.7, cue: 'whoosh' }, { t: 2.05, cue: 'pop' }, { t: 2.2, cue: 'chime' }],
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      h.bg(stage, env, 'glow', env.theme)
      if (spec.text) heading(c, spec.text, { top: env.safe.t, size: 112 })
      const ax = env.safe.l + 170
      const ay = c.cy - 240 + (spec.text ? 170 : 0)
      const bx = env.W - env.safe.r - 200
      const by = c.cy + 450
      const mx = c.cx
      const my = (ay + by) / 2
      const d = 'M ' + ax + ' ' + ay + ' C ' + (ax + 560) + ' ' + (ay + 60) + ', ' + (mx - 520) + ' ' + (my + 40) + ', ' + mx + ' ' + my + ' S ' + (bx - 560) + ' ' + (by - 60) + ', ' + bx + ' ' + by
      const svg = h.box(stage, 'mo-lines', { left: 0, top: 0, width: env.W, height: env.H })
      svg.innerHTML = '<svg width="' + env.W + '" height="' + env.H + '" viewBox="0 0 ' + env.W + ' ' + env.H + '" fill="none"><path id="' + env.id + '-rt" d="' + d + '" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="2 24"/></svg>'
      const path = svg.querySelector('path')
      const L = path.getTotalLength()
      const pts = []
      for (let i = 0; i <= 120; i++) { const p = path.getPointAtLength((i / 120) * L); pts.push([Math.round(p.x), Math.round(p.y)]) }
      const mkNode = (n, x, y, i) => {
        const el = h.box(stage, 'mo-node', { left: x - 120, top: y - 120, width: 240, height: 240 })
        el.innerHTML = '<div class="mo-node-c">' + h.icon(n.icon || 'pin', 100, 'var(--accent)', 2) + '</div><div class="mo-node-l"></div>'
        el.querySelector('.mo-node-l').textContent = n.label
        fx.pop(tl, el, 0.2 + i * 0.25, { from: 0.4, dur: 0.6, ease: E.springHard })
      }
      mkNode(spec.from, ax, ay, 0)
      mkNode(spec.to, bx, by, 1)
      tl.fromTo(path, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.5)
      const par = h.box(stage, 'mo-parcel', { left: -60, top: -60, width: 120, height: 120 }, h.icon('package', 64, '#fff', 2))
      const o = { u: 0 }
      const t0 = 0.8
      const dur = Math.max(1.4, c.dur - 1.9)
      tl.set(par, { opacity: 0 }, 0)
      tl.to(par, { opacity: 1, duration: 0.15 }, t0)
      tl.to(o, { u: 1, duration: dur, ease: 'power1.inOut', onUpdate: () => { const p = pts[Math.round(o.u * 120)]; par.style.transform = 'translate(' + (p[0]) + 'px,' + (p[1]) + 'px)' } }, t0)
      if (spec.badge) {
        const bd = h.box(stage, 'mo-badge2', { left: env.safe.l, top: by + 20, width: 460 })
        bd.textContent = spec.badge
        fx.pop(tl, bd, t0 + dur * 0.45, { from: 0.6, dur: 0.5 })
      }
    },
  })

  // ============ scene.steps — numbered steps ("how it works") ============
  M.register('scene.steps', {
    kind: 'scene', label: 'Étapes numérotées (comment ça marche) reliées par un trait', min: 3.0, max: 8, words: [0, 8], needs: ['steps'],
    sfx: (spec, env) => spreadPure(env, (spec.steps || []).length, 0.8, 0.6).map((t) => ({ t, cue: 'click' })),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      h.bg(stage, env, 'glow', env.theme)
      const head = spec.text ? heading(c, spec.text, { top: env.safe.t, size: 116 }) : null
      const steps = spec.steps.slice(0, 4)
      const times = spread(c, steps.length, 0.8, 0.6)
      const top = head ? env.safe.t + head.height + 90 : env.safe.t + 120
      const gap = 250
      const spanH = gap * (steps.length - 1) + 122
      const col = h.box(stage, 'mo-steps', { left: env.safe.l, width: c.maxW, top: Math.round(top + Math.max(0, ((env.H - env.safe.b) - top - spanH) / 2 - 30)) })
      const line = h.box(col, 'mo-stepline', { left: 61, top: 60, width: 6, height: gap * (steps.length - 1) })
      tl.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: Math.max(0.6, times[times.length - 1] - times[0] + 0.3), ease: 'none', transformOrigin: '50% 0%' }, times[0])
      steps.forEach((s, i) => {
        const row = h.box(col, 'mo-step', { left: 0, top: i * gap, width: c.maxW })
        row.innerHTML = '<div class="mo-stepn">' + (i + 1) + '</div><div class="mo-stept"><b></b><em></em></div>'
        row.querySelector('b').textContent = s.title
        row.querySelector('em').textContent = s.sub || ''
        fx.slideIn(tl, row, times[i], { x: 110, dur: 0.6, blur: 12 })
        tl.fromTo(row.querySelector('.mo-stepn'), { backgroundColor: env.pal.card, color: env.pal.ink }, { backgroundColor: env.pal.accent, color: '#fff', duration: 0.3, immediateRender: false }, times[i] + 0.1)
      })
    },
  })

  // ============ scene.ghost — a giant ghost word behind a statement (editorial) ============
  M.register('scene.ghost', {
    kind: 'scene', label: 'Mot géant en filigrane derrière une phrase (style éditorial)', min: 2.2, max: 6, words: [1, 10], needs: ['text', 'ghost'],
    sfx: (spec, env) => [{ t: 0.15, cue: 'impact2' }, ...headSfx(spec, env)],
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      const gt = strip(spec.ghost)
      const gsz = M.clamp(Math.round((env.W * 0.96) / (gt.length * 0.7)), 200, 560)
      const ghost = h.box(stage, 'mo-ghost mo-ghost2', { left: 0, width: env.W, top: Math.round(c.cy - gsz * 0.62), fontSize: gsz })
      ghost.textContent = gt
      tl.fromTo(ghost, { opacity: 0, scale: 1.18, filter: blur(26) }, { opacity: 1, scale: 1, filter: blur(2), duration: 0.9, ease: 'expo.out' }, 0)
      fx.drift(tl, [ghost], 0.4, c.dur, 40, env.seed)
      const sq = h.box(stage, 'mo-sq', { left: env.safe.l, top: Math.round(c.cy - 360), width: 70, height: 70 })
      tl.fromTo(sq, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.5, ease: E.springHard }, 0.2)
      const lay = M.layout(spec.text, c.maxW, { max: 150, min: 66, maxLines: 3 })
      const size = lay.size
      const t = h.text(stage, lay.markup, 'mo-h1', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy - size * 0.55 * lay.lines), fontSize: size })
      t.box.style.position = 'absolute'
      const times = c.times(spec.text, { cap: 2.2, pace: 0.2 })
      fx.reveal(tl, t.words, times, { y: 50, blur: 18, dur: 0.6 })
      const ai = M.accentIndex(spec.text)
      if (ai >= 0) { const w = t.words[ai]; w.style.position = 'relative'; fx.mark(tl, t.words, times[ai] + 0.2, 0.45) }
    },
  })

  // ============ scene.end — brand lockup, tagline and call to action ============
  M.register('scene.end', {
    kind: 'end', label: 'Carte finale : logo, nom, slogan, bouton d’action et adresse', min: 2.6, max: 5, words: [0, 8], needs: [],
    sfx: () => [{ t: 0.1, cue: 'impact' }, { t: 0.9, cue: 'pop' }, { t: 1.2, cue: 'chime' }],
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'rings', env.theme)
      const logo = h.logo(stage, env, 330, { left: c.cx - 165, top: c.cy - 470 })
      tl.fromTo(logo, { opacity: 0, y: -520, rotation: -8 }, { opacity: 1, y: 0, rotation: 0, duration: 0.8, ease: 'bounce.out' }, 0.05)
      const nm = env.brand.name || ''
      const name = h.letters(stage, nm, 'mo-brandname mo-ink', { left: 0, width: env.W, top: c.cy - 150, fontSize: M.clamp(Math.round(c.maxW / (nm.length * 0.7)), 100, 180) })
      name.box.style.position = 'absolute'
      name.chars.forEach((ch, i) => tl.fromTo(ch, { opacity: 0, y: 80, rotationX: -70, transformPerspective: 700 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.5, ease: E.outX }, 0.3 + i * 0.05))
      const tag = spec.text || env.brand.tagline || ''
      if (tag) {
        const t = h.text(stage, tag, 'mo-sub mo-center-text mo-tag', { left: env.safe.l, width: c.maxW, top: c.cy + 40, fontSize: 82 })
        t.box.style.position = 'absolute'
        fx.reveal(tl, t.words, c.times(tag, { start: 0.85, cap: 0.8, pace: 0.2 }), { y: 34, blur: 10, dur: 0.5 })
      }
      const cta = spec.cta || env.brand.cta
      if (cta) {
        const b = h.box(stage, 'mo-cta', { left: c.cx - 400, top: c.cy + 250, width: 800 })
        b.textContent = cta
        fx.pop(tl, b, 1.35, { from: 0.6, dur: 0.55, ease: E.springHard })
        tl.to(b, { scale: 1.04, duration: 0.5, ease: E.soft, yoyo: true, repeat: 1 }, 2.0)
      }
      const handle = spec.handle || env.brand.handle
      if (handle) {
        const hd = h.box(stage, 'mo-handle mo-center-text', { left: env.safe.l, width: c.maxW, top: c.cy + 440 })
        hd.textContent = handle
        fx.fadeUp(tl, hd, 1.7, { y: 18, dur: 0.5 })
      }
      if (spec.audience) {
        const a = h.box(stage, 'mo-cap mo-center-text', { left: env.safe.l, width: c.maxW, top: c.cy + 520 })
        a.textContent = spec.audience
        fx.fadeUp(tl, a, 1.95, { y: 14, dur: 0.5 })
      }
    },
  })
})(typeof window !== 'undefined' ? window : globalThis)
