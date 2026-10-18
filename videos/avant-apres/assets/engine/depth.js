/* KONVWA motion engine — depth: real cut-out images stacked on several planes (browser build + pure placement / sound helpers).
 * - h.cutout: an image with its OWN shadow layer (the shadow is a sibling we scale, never a filter tweened on the object);
 * - M.decor: `decor` field of any scene, illustrated objects floating at several depths (parallax);
 * - M.carry: `carry` field, an object that crosses the screen from one scene into the next, on the composition root so the transition does not move it;
 * - scene types that are built around real images: hook.collage, scene.collage, scene.photo. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  const { E } = M
  const blur = (n) => 'blur(' + n + 'px)'
  const IMG = /\.(png|jpe?g|webp|svg|gif)$/i

  // ---------- pure placement ----------
  /** Free spots for decor, away from the centre where the text lives: [x, y, depth] in fractions of the frame (depth 0 = far, 1 = near). */
  M.DECOR_SLOTS = [[0.13, 0.15, 0.35], [0.87, 0.12, 0.75], [0.09, 0.6, 0.85], [0.91, 0.66, 0.3], [0.2, 0.9, 0.6], [0.8, 0.9, 0.95]]
  /** Spots around a central title for a collage (bigger, nearer). */
  M.COLLAGE_SLOTS = [[0.2, 0.16, 0.85], [0.8, 0.15, 0.5], [0.17, 0.8, 0.6], [0.82, 0.8, 1], [0.5, 0.9, 0.35], [0.5, 0.14, 0.25]]

  /**
   * Item → { src, x, y, depth, size (px), rot, sticker, dx, dy } where dx/dy point to the edge it enters from.
   * An item is "lib:…/x.png" or { src, x?, y?, depth?, size? (fraction of the width), rot?, sticker? }.
   */
  M.placeItems = function (items, env, slots, scale) {
    const R = M.rng((env.seed || 1) + 23)
    return (items || []).slice(0, slots.length).map((raw, i) => {
      const it = typeof raw === 'string' ? { src: raw } : Object.assign({}, raw)
      const s = slots[i]
      const x = it.x != null ? it.x : s[0]
      const y = it.y != null ? it.y : s[1]
      const depth = M.clamp(it.depth != null ? it.depth : s[2], 0, 1)
      const size = Math.round(env.W * (it.size || scale[0] + scale[1] * depth))
      const rot = it.rot != null ? it.rot : Math.round((R() - 0.5) * 24)
      const dx = x < 0.5 ? -1 : 1
      const dy = y < 0.5 ? -1 : 1
      return { src: it.src, x, y, depth, size, rot, sticker: !!it.sticker || /(^|[:/])flags\//.test(it.src || ''), outline: !!it.outline || /(^|[:/])people\//.test(it.src || ''), dx, dy }
    })
  }
  /** Every image path a spec references through decor / items / carry (for validation and copying). */
  M.depthRefs = function (spec) {
    const src = (v) => (typeof v === 'string' ? v : v && v.src)
    const list = [].concat(spec.decor || [], Array.isArray(spec.items) ? spec.items : [], spec.carry ? [spec.carry] : []).map(src)
    return list.filter((s) => typeof s === 'string' && IMG.test(s))
  }

  // ---------- carry: one flight shared by two scenes ----------
  M.CARRY = { span: 1.5, lead: 0.7 }
  /** Position of the carried object at progress u (0..1): enters bottom-left, crosses big through the middle, leaves top-right. */
  M.carryAt = function (u, W, H) {
    const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)
    const p0 = [-0.4 * W, 0.86 * H], p1 = [0.5 * W, 0.42 * H], p2 = [1.4 * W, 0.02 * H]
    const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e
    return { x: a * p0[0] + b * p1[0] + c * p2[0], y: a * p0[1] + b * p1[1] + c * p2[1], s: 0.75 + 0.75 * Math.sin(Math.PI * e), r: -24 + 38 * e }
  }
  /** Seconds (scene-local) at which the carried object starts in the scene that owns it. */
  M.carryStart = (env) => Math.max(0, env.dur - (env.transOut ? env.transOut.dur : 0) - M.CARRY.lead)

  /** Sounds the depth features add to any scene: decor arriving, an object flying across. */
  M.depthSfx = function (spec, env) {
    const out = []
    if (spec.decor && spec.decor.length) out.push({ t: 0.04, cue: 'whoosh' })
    if (spec.carry) out.push({ t: M.r2(M.carryStart(env) + 0.25), cue: 'whooshBig' })
    return out
  }

  // ---------- browser ----------
  const h = M.h

  /** A cut-out image centred on (x, y) with a separate soft shadow under it. Returns { wrap, img, shadow }. */
  h.cutout = function (parent, it, env) {
    const jpg = /\.jpe?g$/i.test(it.src || '')
    // a JPG on white melts into a light page: the blend sits on the wrapper, which the animation isolates anyway
    const wrap = h.box(parent, 'mo-cutout' + (jpg ? ' mo-cutjpg' : ''), { left: Math.round(it.x * env.W), top: Math.round(it.y * env.H), width: it.size })
    const shadow = h.el('div', 'mo-cutshadow', '', wrap)
    shadow.style.opacity = String(0.22 + 0.3 * it.depth)
    // tall objects never grow past the slot
    const img = h.el('img', 'mo-cutimg' + (it.sticker ? ' mo-sticker' : '') + (it.outline ? ' mo-outline' : ''), '', wrap)
    img.src = it.src
    img.style.maxHeight = Math.round(it.size * 1.15) + 'px'
    if (it.depth < 0.3) img.style.filter = blur(Math.round((0.3 - it.depth) * 12))
    g.gsap.set(wrap, { xPercent: -50, yPercent: -50, rotation: it.rot })
    return { wrap, img, shadow }
  }

  /** Entrance from the item's edge (fast, rotated, blurred by motion), then it floats: nearer = bigger moves. */
  function animateItem(c, o, it, at, strength) {
    const { tl, env } = c
    const k = strength || 1
    tl.fromTo(o.wrap, { x: it.dx * env.W * 0.55 * k, y: it.dy * env.H * 0.18 * k, rotation: it.rot + it.dx * 40, scale: 0.55, opacity: 0 }, { x: 0, y: 0, rotation: it.rot, scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, at)
    const start = at + 0.7
    const left = c.dur - start
    if (left <= 0.2) return
    const period = 1.1 + (1 - it.depth) * 0.9
    const reps = Math.max(0, Math.ceil(left / period) - 1)
    const amp = 10 + 28 * it.depth
    tl.to(o.img, { y: -amp, rotation: it.dx * 3, duration: period, ease: 'sine.inOut', yoyo: true, repeat: reps }, start)
    tl.to(o.shadow, { scale: 0.78, opacity: 0.12 + 0.2 * it.depth, duration: period, ease: 'sine.inOut', yoyo: true, repeat: reps }, start)
    // parallax: near objects drift further than far ones
    tl.to(o.wrap, { x: -it.dx * (14 + 50 * it.depth), y: -(10 + 30 * it.depth), duration: left, ease: 'none' }, start)
  }

  /** `decor` of any scene: objects at several depths, far ones behind the content, near ones in front. Called by M.mount. */
  M.decor = function (c, items) {
    const { stage, env } = c
    M.placeItems(items, env, M.DECOR_SLOTS, [0.16, 0.2]).forEach((it, i) => {
      const o = h.cutout(stage, it, env)
      if (it.depth < 0.5) stage.insertBefore(o.wrap, stage.firstChild)
      else o.wrap.style.zIndex = '6'
      animateItem(c, o, it, 0.02 + i * 0.07, 0.7)
    })
  }

  /** The object this scene throws into the next one (`carry`), or receives from the previous one (env.carryIn). */
  M.carry = function (c, src, from, until) {
    const { root, tl, env } = c
    const el = h.box(root, 'mo-carry', { left: 0, top: 0, width: Math.round(env.W * 0.42) })
    el.style.zIndex = '20'
    const img = h.el('img', 'mo-cutimg', '', el)
    img.src = typeof src === 'string' ? src : src.src
    const shadow = h.box(root, 'mo-carryshadow', { left: 0, top: 0, width: Math.round(env.W * 0.3), height: 60 })
    shadow.style.zIndex = '19'
    for (const e of [el, shadow]) for (const a of ['overflow', 'overlap', 'occlusion']) e.setAttribute('data-layout-allow-' + a, '')
    const S = M.CARRY.span
    const place = (u) => {
      const p = M.carryAt(M.clamp(u, 0, 1), env.W, env.H)
      g.gsap.set(el, { x: p.x, y: p.y, xPercent: -50, yPercent: -50, scale: p.s, rotation: p.r })
      g.gsap.set(shadow, { x: p.x + 40, y: p.y + env.H * 0.16, xPercent: -50, yPercent: -50, scale: p.s })
    }
    const o = { u: from }
    const t0 = from === 0 ? M.carryStart(env) : 0
    const u1 = Math.min(1, from + (until - t0) / S)
    place(from)
    tl.set([el, shadow], { opacity: from === 0 ? 0 : 1 }, 0)
    if (from === 0) tl.set([el, shadow], { opacity: 1 }, t0)
    tl.to(o, { u: u1, duration: Math.max(0.01, until - t0), ease: 'none', onUpdate: () => place(o.u) }, t0)
    if (u1 >= 1) tl.set([el, shadow], { opacity: 0 }, t0 + (1 - from) * S)
  }

  // ---------- collage (hook and body) ----------
  function collage(c, o) {
    const { stage, tl, env, fx, spec } = c
    const hook = o.hook
    const discD = Math.round(env.W * (hook ? 0.94 : 0.82))
    const disc = h.box(stage, 'mo-bigdisc', { left: Math.round(c.cx - discD / 2), top: Math.round(c.cy - discD / 2), width: discD, height: discD })
    tl.fromTo(disc, { scale: hook ? 0.15 : 0.4, opacity: hook ? 1 : 0 }, { scale: 1, opacity: 1, duration: hook ? 0.55 : 0.6, ease: E.outX }, 0)
    const items = M.placeItems(spec.items, env, M.COLLAGE_SLOTS, [0.24, 0.2])
    const placed = items.map((it, i) => {
      const ob = h.cutout(stage, it, env)
      if (it.depth < 0.5) stage.insertBefore(ob.wrap, disc)
      else ob.wrap.style.zIndex = '3'
      animateItem(c, ob, it, (hook ? 0.0 : 0.15) + i * (hook ? 0.06 : 0.1), hook ? 1.2 : 0.9)
      return ob
    })
    // the text sits on the disc: white words, navy key word (the accent tone's colours)
    const box = h.box(stage, 'mo-center mo-tone-accent mo-ondisc', { left: env.safe.l + 30, width: c.maxW - 60, top: Math.round(c.cy - discD * 0.36), height: Math.round(discD * 0.72) })
    box.style.zIndex = '7' // the message is never covered
    const stack = h.el('div', 'mo-stack', '', box)
    const lay = M.layout(spec.text, c.maxW - 120, { max: hook ? 150 : 128, min: 66, maxLines: 4 })
    const t = h.text(stack, lay.markup, 'mo-h1', { fontSize: lay.size })
    const times = hook ? c.times(spec.text, { start: 0.22, cap: 0.95, pace: 0.16 }) : c.times(spec.text, { cap: 1.4, pace: 0.18 })
    fx.text(tl, t.words, times, spec.anim || (hook ? 'pop' : 'mask'), { y: 50, blur: 16, dur: 0.55 })
    const ai = M.accentIndex(spec.text)
    if (ai >= 0) {
      const ta = times[ai]
      fx.mark(tl, t.words, ta + 0.18, 0.45)
      // the hit: everything around jumps once
      placed.forEach((ob, i) => { tl.to(ob.img, { scale: 1.1, duration: 0.12, ease: 'power2.out' }, ta + 0.1 + i * 0.02); tl.to(ob.img, { scale: 1, duration: 0.4, ease: E.spring }, ta + 0.22 + i * 0.02) })
      tl.to(disc, { scale: 1.05, duration: 0.12, ease: 'power2.out' }, ta + 0.1)
      tl.to(disc, { scale: 1, duration: 0.45, ease: E.spring }, ta + 0.22)
    }
    if (spec.sub) {
      const s = h.text(stack, spec.sub, 'mo-sub', { fontSize: Math.round(lay.size * 0.4) })
      fx.reveal(tl, s.words, c.times(spec.sub, { start: times[times.length - 1] + 0.3, cap: 0.5 }), { y: 24, blur: 8, dur: 0.45 })
    }
    fx.breathe(tl, stack, 0.3, c.dur, 1.04)
    return times
  }
  const collageSfx = (spec, env, hook) => {
    const t = hook ? M.timesFor(spec.text, env, { start: 0.22, cap: 0.95, pace: 0.16 }) : M.timesFor(spec.text, env, { cap: 1.4, pace: 0.18 })
    const ai = M.accentIndex(spec.text || '')
    const n = Math.min((spec.items || []).length, M.COLLAGE_SLOTS.length)
    const out = hook ? [{ t: 0.0, cue: 'whooshBig' }, { t: 0.02, cue: 'impact2' }] : [{ t: 0.15, cue: 'whoosh' }]
    for (let i = 1; i < n; i += 2) out.push({ t: M.r2((hook ? 0 : 0.15) + i * (hook ? 0.06 : 0.1) + 0.3), cue: 'pop' })
    if (ai >= 0) out.push({ t: M.r2(t[ai] + 0.1), cue: 'impact' })
    return out
  }

  M.register('hook.collage', {
    kind: 'hook', label: 'Objets détourés qui jaillissent en profondeur autour d’un grand disque, phrase choc au centre', min: 2.8, max: 3.0, words: [1, 7], needs: ['text', 'items'],
    sfx: (spec, env) => collageSfx(spec, env, true),
    legible: (spec, env) => { const t = M.timesFor(spec.text, env, { start: 0.22, cap: 0.95, pace: 0.16 }); return M.r2((t[t.length - 1] || 0) + 0.6) },
    build(c) { collage(c, { hook: true }) },
  })
  M.register('scene.collage', {
    kind: 'scene', label: 'Titre sur un disque, entouré d’objets détourés à plusieurs profondeurs (parallaxe)', min: 2.4, max: 6, words: [1, 10], needs: ['text', 'items'],
    sfx: (spec, env) => collageSfx(spec, env, false),
    build(c) { collage(c, { hook: false }) },
  })

  // ---------- scene.photo ----------
  M.register('scene.photo', {
    kind: 'scene', label: 'Vraie photo plein cadre, zoom lent, texte blanc par-dessus', min: 2.2, max: 6, words: [1, 10], needs: ['image', 'text'],
    sfx: (spec, env) => {
      const ai = M.accentIndex(spec.text || '')
      const t = M.timesFor(spec.text, env, { cap: 1.4, pace: 0.18 })
      return [{ t: 0.05, cue: 'cine' }].concat(ai >= 0 ? [{ t: M.r2(t[ai] + 0.12), cue: 'pop' }] : [])
    },
    build(c) {
      const { stage, tl, env, fx, spec } = c
      const ph = h.box(stage, 'mo-photo', { left: 0, top: 0, width: env.W, height: env.H })
      const img = h.el('img', 'mo-photo-img', '', ph)
      img.src = spec.image
      if (spec.focus) img.style.objectPosition = spec.focus
      // Ken Burns: one long move, from closer to wider, drifting sideways
      tl.fromTo(img, { scale: 1.2, x: env.W * 0.03 }, { scale: 1.04, x: -env.W * 0.03, duration: c.dur, ease: 'none' }, 0)
      h.box(stage, 'mo-photo-shade', { left: 0, top: 0, width: env.W, height: env.H })
      const lay = M.layout(spec.text, c.maxW, { max: 140, min: 66, maxLines: 3 })
      const bottom = env.H - env.safe.b - 40
      const t = h.text(stage, lay.markup, 'mo-h1 mo-onphoto', { left: env.safe.l, width: c.maxW, top: Math.round(bottom - lay.lines * lay.size * 1.06), fontSize: lay.size })
      t.box.style.position = 'absolute'
      t.box.style.justifyContent = 'flex-start'
      t.box.style.textAlign = 'left'
      const times = c.times(spec.text, { cap: 1.4, pace: 0.18 })
      fx.text(tl, t.words, times, spec.anim || 'mask', { y: 50, blur: 16, dur: 0.55 })
      fx.mark(tl, t.words, (times[Math.max(0, M.accentIndex(spec.text))] || 0.4) + 0.2, 0.45)
      if (spec.kicker) {
        const k = h.box(stage, 'mo-cap mo-onphoto-cap', { left: env.safe.l, top: Math.round(bottom - lay.lines * lay.size * 1.06 - 70) })
        k.textContent = spec.kicker
        fx.fadeUp(tl, k, 0.1, { y: 20, dur: 0.45 })
      }
    },
  })

  // ---------- « Devinez le prix » : produit → compte à rebours → révélation ----------
  /** Product on centre stage, one floating object (a "card" item). */
  const product = (c, src, x, y, size) => h.cutout(c.stage, { src, x, y, depth: 0.9, size: Math.round(c.env.W * size), rot: 0, sticker: false, outline: false, dx: 0, dy: 1 }, c.env)
  const fmtPrice = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ')

  M.register('scene.guess', {
    kind: 'scene', label: 'Devinez le prix : le produit en grand, son nom, des « ? » qui surgissent, autocollant « votre prix en commentaire »', min: 2.4, max: 6, words: [0, 8], needs: ['image'],
    sfx: () => [{ t: 0.05, cue: 'whooshBig' }, { t: 0.6, cue: 'pop' }, { t: 0.95, cue: 'ping' }, { t: 1.5, cue: 'pop' }],
    build(c) {
      const { stage, tl, env, fx, spec } = c
      h.bg(stage, env, spec.bg || 'dots', env.theme)
      if (spec.kicker) { const k = h.box(stage, 'mo-cap mo-center-text', { left: env.safe.l, width: c.maxW, top: env.safe.t }); k.textContent = spec.kicker; fx.fadeUp(tl, k, 0.05, { y: 18, dur: 0.4 }) }
      if (spec.text) {
        const lay = M.layout(spec.text, c.maxW, { max: 92, min: 56, maxLines: 2 })
        const t = h.text(stage, lay.markup, 'mo-h1', { left: env.safe.l, width: c.maxW, top: env.safe.t + 60, fontSize: lay.size })
        t.box.style.position = 'absolute'
        fx.text(tl, t.words, c.times(spec.text, { start: 0.15, cap: 0.6, pace: 0.12 }), spec.anim || 'mask')
      }
      const p = product(c, spec.image, 0.5, 0.53, spec.size || 0.6)
      p.wrap.style.zIndex = '3'
      tl.fromTo(p.wrap, { y: env.H * 0.45, rotation: -14, scale: 0.6, opacity: 0 }, { y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.75, ease: 'back.out(1.6)' }, 0.05)
      tl.to(p.img, { y: -22, rotation: 2.5, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: Math.max(0, Math.ceil((c.dur - 0.8) / 1.1) - 1) }, 0.8)
      // question marks bursting around the product
      const R = M.rng(env.seed + 3)
      const spots = [[0.16, 0.36, -18], [0.84, 0.32, 16], [0.12, 0.66, 10], [0.88, 0.62, -12]]
      spots.forEach(([x, y, r], i) => {
        const q = h.box(stage, 'mo-qmark', { left: Math.round(x * env.W) - 80, top: Math.round(y * env.H) - 110, width: 160, fontSize: Math.round(170 + R() * 80) })
        q.textContent = '?'
        tl.fromTo(q, { opacity: 0, scale: 0.2, rotation: r * 3 }, { opacity: 1, scale: 1, rotation: r, duration: 0.45, ease: 'back.out(2.4)' }, 0.85 + i * 0.09)
        tl.to(q, { y: -18, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: Math.max(0, Math.ceil((c.dur - 1.4) / 0.6) - 1) }, 1.35 + i * 0.09)
      })
      if (spec.sticker) {
        const st = h.box(stage, 'mo-comment', { left: env.safe.l + 40, width: c.maxW - 80, top: env.H - env.safe.b - 150 }, '<i>' + h.icon('user', 44, '#fff', 2.4) + '</i><span></span>')
        st.querySelector('span').textContent = spec.sticker
        st.style.zIndex = '8' // above the near decor (z 6)
        tl.fromTo(st, { opacity: 0, y: 80, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 1.45)
        tl.to(st, { rotation: -2.5, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 2.0)
      }
    },
  })

  /** Seconds at which each number of the countdown lands: on the words of the voice when there is one. */
  M.countdownTimes = function (env, n) {
    const start = env.vo ? env.vo.start : 0.25
    const span = env.vo ? env.vo.dur * 0.9 : n * 0.75
    return Array.from({ length: n }, (_, i) => M.r2(start + (i * span) / n))
  }
  M.register('scene.countdown', {
    kind: 'scene', label: 'Compte à rebours géant 3-2-1 (calé sur la voix) sous le produit, prix caché « ??? HTG » qui tremble', min: 2.2, max: 4.5, words: [0, 4], needs: ['image'],
    sfx: (spec, env) => [{ t: 0.0, cue: 'riser' }, ...M.countdownTimes(env, spec.from || 3).map((t) => ({ t, cue: 'tick' }))],
    build(c) {
      const { stage, tl, env, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      const n = spec.from || 3
      const times = M.countdownTimes(env, n)
      const p = product(c, spec.image, 0.5, 0.27, 0.36)
      tl.fromTo(p.wrap, { scale: 1.3, y: env.H * 0.18, opacity: 0.6 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'expo.out' }, 0)
      tl.to(p.img, { rotation: 3, duration: 0.09, yoyo: true, repeat: Math.max(1, Math.round((c.dur - 0.5) / 0.09)), ease: 'sine.inOut' }, 0.5)
      const tag = h.box(stage, 'mo-pricetag mo-center-text', { left: c.cx - 300, width: 600, top: Math.round(env.H * 0.45) })
      tag.innerHTML = '<span class="mo-blurprice">??? </span><b>' + (spec.currency || 'HTG') + '</b>'
      tl.fromTo(tag, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0.25)
      const ringD = 560
      const ring = h.box(stage, 'mo-cdring', { left: c.cx - ringD / 2, top: Math.round(env.H * 0.71) - ringD / 2, width: ringD, height: ringD })
      ring.innerHTML = '<svg viewBox="0 0 100 100" width="' + ringD + '" height="' + ringD + '"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" stroke-width="3"/><circle class="arc" cx="50" cy="50" r="46" fill="none" stroke="var(--brand)" stroke-width="3.4" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg>'
      const arc = ring.querySelector('.arc')
      const L = 2 * Math.PI * 46
      arc.style.strokeDasharray = L + ' ' + L
      tl.fromTo(arc, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: Math.max(0.5, c.dur - times[0]), ease: 'none' }, times[0])
      for (let i = 0; i < n; i++) {
        const d = h.box(stage, 'mo-cdnum mo-center-text', { left: c.cx - 300, width: 600, top: Math.round(env.H * 0.71) - 220, fontSize: 400 })
        d.textContent = String(n - i)
        if (i === n - 1) d.classList.add('mo-cdlast')
        tl.fromTo(d, { opacity: 0, scale: 2.6, filter: 'blur(18px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.22, ease: 'expo.out' }, times[i])
        tl.to(stage, { x: i % 2 ? 12 : -12, duration: 0.04 }, times[i] + 0.18)
        tl.to(stage, { x: 0, duration: 0.12, ease: 'power2.out' }, times[i] + 0.22)
        if (i < n - 1) tl.to(d, { opacity: 0, scale: 0.5, filter: 'blur(8px)', duration: 0.14, ease: 'power2.in' }, times[i + 1] - 0.06)
      }
    },
  })

  M.register('scene.reveal', {
    kind: 'scene', label: 'Révélation du prix : il défile et se fige, confettis, visages qui réagissent, mention « livraison en plus »', min: 2.6, max: 6, words: [0, 8], needs: ['image', 'price'],
    sfx: () => [{ t: 0.0, cue: 'whoosh' }, { t: 0.15, cue: 'type' }, { t: 1.05, cue: 'impact' }, { t: 1.1, cue: 'chime' }, { t: 1.3, cue: 'pop' }, { t: 1.55, cue: 'pop' }],
    build(c) {
      const { stage, tl, env, fx, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      const p = product(c, spec.image, 0.5, 0.25, 0.34)
      tl.fromTo(p.wrap, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'expo.out' }, 0)
      tl.to(p.wrap, { scale: 1.12, duration: 0.12, ease: 'power2.out' }, 1.05)
      tl.to(p.wrap, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, 1.17)
      if (spec.kicker) { const k = h.box(stage, 'mo-cap mo-center-text', { left: env.safe.l, width: c.maxW, top: Math.round(env.H * 0.43) }); k.textContent = spec.kicker; fx.fadeUp(tl, k, 0.1, { y: 16, dur: 0.4 }) }
      const total = fmtPrice(spec.price).length + 0.6 * String(spec.currency || 'HTG').length
      const size = M.clamp(Math.round(c.maxW / (total * 0.6)), 120, 260)
      const box = h.box(stage, 'mo-bigprice mo-center-text', { left: 0, width: env.W, top: Math.round(env.H * 0.47), fontSize: size })
      const val = h.el('span', 'mo-numval', '0', box)
      h.el('span', 'mo-pricecur', ' ' + (spec.currency || 'HTG'), box).style.fontSize = Math.round(size * 0.42) + 'px'
      tl.fromTo(box, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' }, 0.1)
      fx.count(tl, val, 0, spec.price, 0.15, 0.9, fmtPrice, 'power4.out')
      tl.to(box, { scale: 1.12, duration: 0.1, ease: 'power2.out' }, 1.05)
      tl.to(box, { scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, 1.15)
      // confetti in the brand colours, burst from the price then falling
      const R = M.rng(env.seed + 9)
      const cols = [env.pal.accent, env.pal.accent2, env.pal.ink, '#FFB020']
      const py = Math.round(env.H * 0.47 + size * 0.5)
      for (let i = 0; i < 40; i++) {
        const w = 14 + Math.round(R() * 14)
        const pc = h.box(stage, 'mo-confetti', { left: c.cx - w / 2, top: py, width: w, height: Math.round(w * (1.4 + R())) })
        pc.style.background = cols[i % cols.length]
        const a = R() * Math.PI * 2
        const dist = 260 + R() * 420
        const dx = Math.cos(a) * dist
        const dy = Math.sin(a) * dist * 0.7 - 260
        tl.fromTo(pc, { x: 0, y: 0, scale: 0, rotation: 0, opacity: 1 }, { x: dx, y: dy, scale: 1, rotation: R() * 360, duration: 0.5, ease: 'power3.out' }, 1.05)
        tl.to(pc, { y: dy + env.H * 0.55, x: dx * 1.15, rotation: R() * 900, opacity: 0, duration: 1.6 + R() * 0.6, ease: 'power1.in' }, 1.55)
      }
      if (spec.note) {
        const n = h.box(stage, 'mo-pricenote mo-center-text', { left: env.safe.l, width: c.maxW, top: Math.round(env.H * 0.47 + size * 1.15) })
        n.textContent = spec.note
        fx.fadeUp(tl, n, 1.4, { y: 20, dur: 0.45 })
      }
      if (spec.date) {
        const d = h.box(stage, 'mo-pricedate mo-center-text', { left: env.safe.l, width: c.maxW, top: Math.round(env.H * 0.47 + size * 1.15) + 70 })
        d.textContent = spec.date
        fx.fadeUp(tl, d, 1.6, { y: 12, dur: 0.4 })
      }
      // faces that react: they jump in from the bottom corners on the hit
      const faces = (spec.reactions || []).slice(0, 2)
      faces.forEach((src, i) => {
        const left = i === 0
        const it = { src, x: left ? 0.2 : 0.8, y: 0.86, depth: 1, size: Math.round(env.W * 0.38), rot: left ? -8 : 8, sticker: false, outline: true, dx: left ? -1 : 1, dy: 1 }
        const o = h.cutout(stage, it, env)
        o.wrap.style.zIndex = '6'
        tl.fromTo(o.wrap, { y: env.H * 0.3, rotation: it.rot * 3, opacity: 0 }, { y: 0, rotation: it.rot, opacity: 1, duration: 0.5, ease: 'back.out(1.8)' }, 1.25 + i * 0.25)
        tl.to(o.img, { rotation: left ? -4 : 4, y: -10, duration: 0.16, yoyo: true, repeat: Math.max(1, Math.round((c.dur - 1.9) / 0.16)), ease: 'sine.inOut' }, 1.75 + i * 0.25)
      })
    },
  })

  // ---------- « Avant / Après » : l'écran coupé en deux ----------
  /** Grey "before" half on the left, the orange cut line, and the two small labels. Returns the layers so a scene can animate them. */
  function splitFrame(c, o) {
    const { stage, tl, env } = c
    const half = env.W / 2
    const left = h.box(stage, 'mo-split-left', { left: 0, top: 0, width: half, height: env.H })
    const line = h.box(stage, 'mo-split-line', { left: half - 5, top: 0, width: 10, height: env.H })
    line.style.zIndex = '9'
    const tags = []
    if (o.tags !== false) {
      const a = h.box(stage, 'mo-split-tag mo-split-tag-before', { left: 0, width: half, top: env.safe.t - 40 })
      a.textContent = o.before || 'Avant'
      const b = h.box(stage, 'mo-split-tag mo-split-tag-after', { left: half, width: half, top: env.safe.t - 40 })
      b.textContent = o.after || 'Avec KONVWA'
      tags.push(a, b)
    }
    return { left, line, tags, half }
  }
  /** The "before" side never sits still: a nervous little shake. */
  const jitter = (tl, el, from, to) => {
    const n = Math.max(1, Math.round((to - from) / 0.5))
    for (let i = 0; i < n; i++) {
      const t = from + i * 0.5
      tl.to(el, { x: i % 2 ? 5 : -5, rotation: i % 2 ? 0.6 : -0.6, duration: 0.05, ease: 'none' }, t)
      tl.to(el, { x: 0, rotation: 0, duration: 0.08, ease: 'none' }, t + 0.05)
    }
  }

  M.register('hook.split', {
    kind: 'hook', label: 'Une ligne orange coupe l’écran en deux : « AVANT » gris qui tremble à gauche, « AVEC KONVWA » net à droite', min: 2.8, max: 3.0, words: [1, 7], needs: ['left', 'right'],
    sfx: () => [{ t: 0.0, cue: 'whooshBig' }, { t: 0.3, cue: 'impact' }, { t: 0.62, cue: 'glitch' }, { t: 0.95, cue: 'pop' }],
    legible: () => 1.4,
    build(c) {
      const { stage, tl, env, fx, spec } = c
      const f = splitFrame(c, { tags: false })
      tl.fromTo(f.line, { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'power4.out', transformOrigin: '50% 0%' }, 0)
      tl.fromTo(f.left, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'expo.out', transformOrigin: '100% 50%' }, 0.28)
      const word = (markup, x, cls, at) => {
        const lay = M.layout(markup, f.half - 70, { max: 140, min: 64, factor: 0.8, maxLines: 3 })
        const t = h.text(stage, lay.markup, 'mo-split-word ' + cls, { left: x + 35, width: f.half - 70, top: Math.round(c.cy - lay.lines * lay.size * 0.55), fontSize: lay.size })
        t.box.style.position = 'absolute'
        t.box.style.zIndex = '4'
        fx.text(tl, t.words, t.words.map((_, i) => at + i * 0.12), 'letters')
        return t
      }
      const a = word(spec.left, 0, 'mo-split-before', 0.35)
      const b = word(spec.right, f.half, 'mo-split-after', 0.75)
      // the cut lands with a white flash and a punch-in of the whole frame
      const flash = h.box(stage, 'mo-flash', { left: 0, top: 0, width: env.W, height: env.H })
      flash.style.cssText += ';background:#fff;z-index:20'
      tl.fromTo(flash, { opacity: 0.9 }, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 0.28)
      tl.fromTo(stage, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: 'power3.out' }, 0.28)
      tl.to(stage, { scale: 1.05, duration: Math.max(0.5, c.dur - 0.9), ease: 'none' }, 0.85)
      // the old way glitches non-stop, the new one beats
      for (let t = 0.9, i = 0; t < c.dur - 0.1; t += 0.18, i++) {
        tl.to(a.box, { x: [34, -26, 18, -40][i % 4], skewX: i % 2 ? 12 : -12, opacity: i % 3 === 2 ? 0.45 : 1, duration: 0.05, ease: 'none' }, t)
        tl.to(a.box, { x: 0, skewX: 0, opacity: 1, duration: 0.06, ease: 'none' }, t + 0.06)
      }
      for (let t = 1.1; t < c.dur - 0.3; t += 0.42) {
        tl.to(b.box, { scale: 1.16, rotation: -3, duration: 0.1, ease: 'power2.out' }, t)
        tl.to(b.box, { scale: 1, rotation: 0, duration: 0.28, ease: 'back.out(2.4)' }, t + 0.1)
      }
      // second hit when the tick lands
      tl.to(stage, { x: -18, duration: 0.04, ease: 'none' }, 1.1)
      tl.to(stage, { x: 12, duration: 0.05, ease: 'none' }, 1.14)
      tl.to(stage, { x: 0, duration: 0.14, ease: 'power2.out' }, 1.19)
      // a red cross over the old way, an orange tick on the new one
      const mk = (x, cls, icon, at) => {
        const b = h.box(stage, 'mo-split-badge ' + cls, { left: Math.round(x - 75), top: Math.round(c.cy + 230), width: 150, height: 150 }, h.icon(icon, 84, '#fff', 3.2))
        tl.fromTo(b, { opacity: 0, scale: 0.2, rotation: -40 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(2.6)' }, at)
        tl.to(b, { rotation: cls === 'mo-split-bad' ? -25 : 25, scale: 1.12, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: Math.max(1, Math.round((c.dur - at - 0.5) / 0.35)) }, at + 0.5)
      }
      mk(f.half / 2, 'mo-split-bad', 'x', 0.62)
      mk(f.half * 1.5, 'mo-split-good', 'check', 0.95)
      if (spec.sub) {
        const s = h.text(stage, spec.sub, 'mo-sub mo-center-text mo-split-banner', { left: Math.round(c.cx - 330), width: 660, top: env.safe.t, fontSize: 50 })
        s.box.style.position = 'absolute'
        s.box.style.zIndex = '10'
        fx.text(tl, s.words, c.times(spec.sub, { start: 0.1, cap: 0.5 }), 'mask')
      }
    },
  })

  /** One side's content: a phone showing a real screen, a cut-out, chat bubbles or an icon, with a caption under it. */
  function splitSide(c, side, it, cx, at) {
    const { stage, tl, env, fx } = c
    const before = side === 'before'
    const colW = env.W / 2 - 60
    let bottom = Math.round(env.H * 0.66)
    if (it.screen) {
      const pw = Math.round(colW * 0.98)
      const ph = Math.round(pw * 1.85)
      const phone = h.box(stage, 'mo-phone', { left: Math.round(cx - pw / 2), top: Math.round(env.H * 0.47 - ph / 2), width: pw, height: ph })
      const img = h.el('img', 'mo-phone-screen', '', phone)
      img.src = it.screen
      phone.style.zIndex = '3'
      tl.fromTo(phone, { opacity: 0, y: 180, rotation: before ? -8 : 8, scale: 0.85 }, { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, at)
      if (it.scroll) tl.fromTo(img, { yPercent: 0 }, { yPercent: -it.scroll, duration: Math.max(0.6, c.dur - at - 1.0), ease: 'power1.inOut', immediateRender: false }, at + 0.7)
      if (it.tap) {
        const tx = Math.round(cx - pw / 2 + it.tap[0] * pw)
        const ty = Math.round(env.H * 0.47 - ph / 2 + it.tap[1] * ph)
        const cur = h.cursor(stage, 70)
        cur.style.zIndex = '8'
        fx.pointer(tl, cur, [{ x: tx + 120, y: ty + 260, t: at + 0.6 }, { x: tx, y: ty, t: at + 1.1, tap: true }])
        fx.ripple(stage, tl, tx, ty, at + 1.1, env.pal.accent).style.zIndex = '7'
      }
      bottom = Math.round(env.H * 0.47 + ph / 2 + 30)
    } else if (it.image) {
      const o = h.cutout(stage, { src: it.image, x: cx / env.W, y: 0.46, depth: 0.9, size: Math.round(colW * (it.size || 0.95)), rot: 0, sticker: false, outline: !before, dx: before ? -1 : 1, dy: 1 }, env)
      if (before) o.img.classList.add('mo-desat')
      o.wrap.style.zIndex = '3'
      tl.fromTo(o.wrap, { opacity: 0, y: 160, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, at)
      if (before) jitter(tl, o.img, at + 0.7, c.dur)
      else tl.to(o.img, { y: -14, duration: 1, ease: 'sine.inOut', yoyo: true, repeat: Math.max(0, Math.ceil((c.dur - at - 0.7) / 1) - 1) }, at + 0.7)
    } else if (it.bubbles) {
      const col = h.box(stage, 'mo-bubbles', { left: Math.round(cx - colW / 2), width: colW, top: Math.round(env.H * 0.24) })
      col.style.zIndex = '3'
      it.bubbles.slice(0, 4).forEach((txt, i) => {
        const b = h.el('div', 'mo-bubble' + (i % 2 ? ' mo-bubble-r' : ''), '', col)
        b.textContent = String(txt).replace(/ ([?!:;])/g, '\u00a0$1') // French spacing: the mark never starts a line
        tl.fromTo(b, { opacity: 0, scale: 0.6, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(2.2)' }, at + i * 0.35)
      })
      jitter(tl, col, at + 0.5, c.dur)
    } else {
      const b = h.box(stage, 'mo-split-badge ' + (before ? 'mo-split-bad' : 'mo-split-good'), { left: Math.round(cx - 110), top: Math.round(env.H * 0.4), width: 220, height: 220 }, h.icon(it.icon || (before ? 'x' : 'check'), 120, '#fff', 3))
      tl.fromTo(b, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.6)' }, at)
    }
    if (it.text) {
      const lay = M.layout(it.text, colW, { max: 66, min: 40, maxLines: 3 })
      const t = h.text(stage, lay.markup, 'mo-split-caption ' + (before ? 'mo-split-before' : 'mo-split-after'), { left: Math.round(cx - colW / 2), width: colW, top: Math.max(bottom, Math.round(env.H * 0.7)), fontSize: lay.size })
      t.box.style.position = 'absolute'
      t.box.style.zIndex = '5'
      fx.text(tl, t.words, t.words.map((_, i) => at + 0.3 + i * 0.07), before ? 'type' : 'mask')
      if (before) {
        const strike = h.box(stage, 'mo-split-strike', { left: Math.round(cx - colW / 2), width: colW, top: Math.max(bottom, Math.round(env.H * 0.7)) + Math.round(lay.size * 0.55), height: 8 })
        strike.style.zIndex = '6'
        // crossing the words out is the point
        strike.setAttribute('data-layout-allow-occlusion', '')
        for (const e of [t.box, ...t.box.querySelectorAll('*')]) e.setAttribute('data-layout-allow-occlusion', '')
        tl.fromTo(strike, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power3.out', transformOrigin: '0% 50%' }, M.splitTimes(c.env).after - 0.15)
      } else fx.mark(tl, t.words, at + 0.6, 0.4)
    }
  }
  /** The old way appears first, the new one at the middle of the voice. */
  M.splitTimes = function (env) {
    const start = env.vo ? env.vo.start : 0.3
    const dur = env.vo ? env.vo.dur : 3
    return { before: M.r2(start), after: M.r2(start + dur * 0.45) }
  }
  M.register('scene.split', {
    kind: 'scene', label: 'Écran coupé en deux : l’ancienne galère à gauche (gris, ça tremble, barré), KONVWA à droite (vraie capture d’app dans un téléphone, image ou icône)', min: 3.0, max: 6.5, words: [0, 12], needs: ['left', 'right'],
    sfx: (spec, env) => { const t = M.splitTimes(env); return [{ t: t.before, cue: 'glitch' }, { t: M.r2(t.after - 0.15), cue: 'whoosh' }, { t: t.after, cue: 'pop' }, ...(spec.right && spec.right.tap ? [{ t: M.r2(t.after + 1.1), cue: 'click' }] : [])] },
    build(c) {
      const { tl, env } = c
      const f = splitFrame(c, { before: c.spec.before, after: c.spec.after })
      f.tags.forEach((el, i) => tl.fromTo(el, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.35, ease: 'expo.out' }, 0.05 + i * 0.1))
      const t = M.splitTimes(env)
      splitSide(c, 'before', c.spec.left, f.half / 2, t.before)
      splitSide(c, 'after', c.spec.right, f.half * 1.5, t.after)
    },
  })
})(typeof window !== 'undefined' ? window : globalThis)
