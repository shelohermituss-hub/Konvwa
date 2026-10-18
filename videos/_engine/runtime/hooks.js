/* KONVWA motion engine — the 3-second hooks (browser build + pure sound cues).
 * Rules every hook follows: something is on screen from the first frames, the main line is readable by ~1.5 s, a clear "hit" lands on the key word,
 * and the scene ends on a gesture that the next scene's transition can take over. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  const { E } = M
  const blur = (n) => 'blur(' + n + 'px)'
  const strip = (s) => String(s || '').replace(/[*_]/g, '')

  // ============ hook.statement — a big line, the key word in colour, glyphs flying off it ============
  M.register('hook.statement', {
    kind: 'hook', label: 'Phrase choc : mots qui jaillissent, mot-clé en couleur, glyphes qui s’envolent', min: 2.8, max: 3.0, words: [1, 7], needs: ['text'],
    sfx(spec, env) {
      const t = M.timesFor(spec.text, env, { start: 0.04, cap: 1.15, pace: 0.17 })
      const a = Math.max(0, M.accentIndex(spec.text))
      const ta = t[a] != null ? t[a] : 0.5
      return [{ t: 0.02, cue: 'whoosh' }, { t: M.r2(ta + 0.08), cue: 'impact' }, { t: M.r2(ta + 0.1), cue: 'pop' }, ...(spec.sub ? [{ t: 1.55, cue: 'tick' }] : [])]
    },
    legible: (spec, env) => { const t = M.timesFor(spec.text, env, { start: 0.04, cap: 1.15, pace: 0.17 }); return M.r2((t[t.length - 1] || 0) + 0.6) },
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      const deco = h.bg(stage, env, spec.bg || 'rings', env.theme)
      deco.forEach((d, i) => fx.drift(tl, [d], 0, c.dur, 36 + i * 10, env.seed + i))
      const lay = M.layout(spec.text, c.maxW, { max: 200, min: 78, maxLines: 4 })
      const size = lay.size
      const wrap = h.box(stage, 'mo-center', { left: env.safe.l, width: c.maxW, top: env.safe.t, height: env.H - env.safe.t - env.safe.b })
      const stack = h.el('div', 'mo-stack', '', wrap)
      const t = h.text(stack, lay.markup, 'mo-h1', { fontSize: size })
      const times = c.times(spec.text, { start: 0.04, cap: 1.15, pace: 0.17 })
      fx.reveal(tl, t.words, times, { y: 54, blur: 18, dur: 0.6 })
      const ai = Math.max(0, M.accentIndex(spec.text))
      const aw = t.words[ai]
      const ta = times[ai] != null ? times[ai] : 0.5
      if (aw && M.accentIndex(spec.text) >= 0) {
        aw.style.position = 'relative'
        fx.mark(tl, t.words, ta + 0.18, 0.5)
        tl.to(aw, { scale: 1.08, duration: 0.16, ease: 'power2.out' }, ta + 0.42)
        tl.to(aw, { scale: 1, duration: 0.34, ease: E.spring }, ta + 0.58)
        const glyphs = spec.glyphs || ['✦']
        const R = M.rng(env.seed + 11)
        for (let i = 0; i < 6; i++) {
          const gl = h.el('i', 'mo-glyph', '', aw)
          gl.textContent = glyphs[i % glyphs.length]
          gl.style.left = Math.round(R() * 92) + '%'
          gl.style.top = Math.round(-30 + R() * 120) + '%'
          gl.style.fontSize = Math.round(size * (0.26 + R() * 0.2)) + 'px'
          const rise = -46 - R() * 40
          tl.fromTo(gl, { opacity: 0, y: 24, scale: 0.3, rotation: -20 }, { opacity: 0.95, y: rise, scale: 1, rotation: R() * 24 - 12, duration: 0.55, ease: E.out }, ta + 0.16 + i * 0.07)
          tl.to(gl, { opacity: 0, y: rise - 70, duration: 0.6, ease: 'power1.in' }, ta + 0.8 + i * 0.05)
        }
      }
      const ring = h.box(stage, 'mo-ringwave', { left: c.cx - 360, top: c.cy - 360, width: 720, height: 720 })
      fx.wave(tl, ring, ta + 0.1, { to: 2.4, dur: 0.8 })
      if (spec.sub) {
        const sub = h.text(stack, spec.sub, 'mo-sub', { fontSize: Math.round(size * 0.42) })
        fx.reveal(tl, sub.words, c.times(spec.sub, { start: 1.4, cap: 0.5 }), { y: 26, blur: 8, dur: 0.45 })
      }
      fx.breathe(tl, stack, 0.15, c.dur, 1.05)
    },
  })

  // ============ hook.impact — kinetic typography: each block of words slams full-frame, the screen shakes, then everything stacks into the title ============
  /** Blocks of the hook (`|` separates them) and the second each one lands. */
  const impactBeats = (spec) => String(spec.text || '').split('|').map((s) => s.trim()).filter(Boolean)
  const impactTimes = (n) => { const step = Math.min(0.42, 1.15 / Math.max(1, n)); return Array.from({ length: n }, (_, i) => M.r2(i * step)) }
  const impactStack = (n) => { const t = impactTimes(n); return M.r2(t[n - 1] + 0.34) }
  M.register('hook.impact', {
    kind: 'hook', label: 'Typo cinétique : chaque bloc de mots claque plein cadre (l’écran tremble), mot-clé orange, puis tout se range en titre', min: 2.8, max: 3.0, words: [1, 7], needs: ['text'],
    sfx(spec) {
      const beats = impactBeats(spec)
      const t = impactTimes(beats.length)
      const ai = beats.findIndex((b) => /\*/.test(b))
      return [{ t: 0.0, cue: 'whooshBig' }, ...t.map((x, i) => ({ t: M.r2(x + 0.1), cue: i === 0 ? 'impact2' : i === ai ? 'impact' : 'pop' })), { t: M.r2(impactStack(beats.length) - 0.05), cue: 'whoosh' }]
    },
    legible: (spec) => M.r2(impactStack(impactBeats(spec).length) + 0.3),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, spec.bg || 'dots', env.theme)
      const cam = h.box(stage, 'mo-impact-cam', { left: 0, top: 0, width: env.W, height: env.H })
      const beats = impactBeats(spec)
      const n = beats.length
      const times = impactTimes(n)
      const tStack = impactStack(n)
      // final title: one block per line, as big as the width allows, stacked around the centre
      const lays = beats.map((b) => M.layout(b, c.maxW, { max: 340, min: 84, factor: 0.72, maxLines: 1 }))
      const heights = lays.map((l) => Math.round(l.lines * l.size * 1.02))
      const gap = 34 // room for capital accents (À, É)
      let y = Math.round(c.cy - (heights.reduce((a, x) => a + x, 0) + gap * (n - 1)) / 2)
      const blocks = lays.map((lay, i) => {
        const t = h.text(cam, lay.markup, 'mo-impact', { left: env.safe.l, width: c.maxW, top: y, fontSize: lay.size })
        t.box.style.position = 'absolute'
        const dy = Math.round(c.cy - (y + heights[i] / 2))
        y += heights[i] + gap
        // how big it may land in the middle: almost the full width, never more than 1.6× its final size
        const big = Math.min(1.6, (env.W * 0.96) / Math.max(1, M.plain(beats[i]).length * 0.72 * lay.size))
        return { t, dy, big, accent: /\*/.test(beats[i]) }
      })
      blocks.forEach((b, i) => {
        const el = b.t.box
        const at = times[i]
        // slam: from behind the camera, blurred, to a bigger-than-final size in the middle of the frame
        tl.fromTo(el, { opacity: 0, scale: 4.2, y: b.dy, rotation: i % 2 ? 4 : -4, filter: 'blur(26px)' }, { opacity: 1, scale: Math.max(1, b.big), y: b.dy, rotation: 0, filter: 'blur(0px)', duration: 0.2, ease: 'expo.out' }, at)
        // the camera takes the hit
        const k = b.accent ? 1.6 : 1
        tl.to(cam, { x: -16 * k, y: 10 * k, duration: 0.04, ease: 'none' }, at + 0.17)
        tl.to(cam, { x: 10 * k, y: -7 * k, duration: 0.05, ease: 'none' }, at + 0.21)
        tl.to(cam, { x: 0, y: 0, duration: 0.14, ease: 'power2.out' }, at + 0.26)
        if (b.accent) {
          // impact lines bursting out of the key word
          for (let j = 0; j < 12; j++) {
            const a = (j / 12) * 360 + (j % 2 ? 9 : 0)
            const ln = h.box(cam, 'mo-burst', { left: c.cx, top: c.cy - 5, width: 150 + (j % 3) * 50, height: 10 })
            g.gsap.set(ln, { rotation: a, transformOrigin: '0% 50%', x: 0 })
            tl.fromTo(ln, { opacity: 1, scaleX: 0, x: 120 }, { opacity: 0, scaleX: 1, x: 330, duration: 0.45, ease: 'power3.out' }, at + 0.14)
          }
        }
        // make room for the next block, then come back into the title
        if (i < n - 1) tl.to(el, { opacity: 0, scale: 0.7, filter: 'blur(10px)', duration: 0.12, ease: 'power2.in' }, times[i + 1] - 0.04)
        tl.to(el, { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.34, ease: 'power4.out' }, tStack + (i < n - 1 ? i * 0.05 : 0))
      })
      tl.to(cam, { scale: 1.06, duration: Math.max(0.3, c.dur - tStack - 0.3), ease: 'none' }, tStack + 0.3)
      const accentWords = blocks.flatMap((b) => b.t.words)
      fx.mark(tl, accentWords, tStack + 0.35, 0.4)
      if (spec.sub) {
        const s = h.text(stage, spec.sub, 'mo-sub mo-center-text', { left: env.safe.l, width: c.maxW, top: y + 30, fontSize: 58 })
        s.box.style.position = 'absolute'
        fx.text(tl, s.words, c.times(spec.sub, { start: tStack + 0.35, cap: 0.4 }), 'mask')
      }
    },
  })

  // ============ hook.pulse — a radial pulse collapses into a dot that morphs into a pill (UI-style) ============
  M.register('hook.pulse', {
    kind: 'hook', label: 'Pulsation radiale qui devient une pilule (style interface iOS) avec le message', min: 2.8, max: 3.0, words: [1, 5], needs: ['text'],
    sfx: () => [{ t: 0.0, cue: 'riser' }, { t: 0.1, cue: 'pop' }, { t: 0.5, cue: 'whoosh' }, { t: 0.85, cue: 'ping' }],
    legible: (spec, env) => { const t = M.timesFor(spec.text, env, { start: 0.7, cap: 0.6, pace: 0.14 }); return M.r2((t[t.length - 1] || 0.7) + 0.4) },
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      const D = 176
      const P = Math.min(c.maxW, 900)
      const side = (((P - D) / 2) / P) * 100
      const circ = 'inset(0% ' + side.toFixed(2) + '% 0% ' + side.toFixed(2) + '% round 999px)'
      const pill = 'inset(0% 0% 0% 0% round 999px)'
      h.bg(stage, env, 'glow', env.theme)
      const halo = h.box(stage, 'mo-halo', { left: c.cx - 560, top: c.cy - 560, width: 1120, height: 1120 })
      tl.fromTo(halo, { opacity: 1, scale: 0.12 }, { opacity: 0, scale: 1.25, duration: 0.9, ease: 'power3.out' }, 0)
      for (let i = 0; i < 2; i++) {
        const w = h.box(stage, 'mo-ringwave', { left: c.cx - 300, top: c.cy - 300, width: 600, height: 600 })
        fx.wave(tl, w, 0.2 + i * 0.18, { to: 2.2, dur: 0.8 })
      }
      const glow = h.box(stage, 'mo-pillglow', { left: c.cx - P / 2, top: c.cy - D / 2, width: P, height: D })
      tl.fromTo(glow, { opacity: 0, scale: 0.4 }, { opacity: 0.85, scale: 1, duration: 0.6, ease: E.out }, 0.45)
      const el = h.box(stage, 'mo-pill', { left: c.cx - P / 2, top: c.cy - D / 2, width: P, height: D })
      const icon = h.box(el, 'mo-pill-ic', { left: 30, top: 28, width: 120, height: 120 }, h.icon(spec.icon || 'sparkles', 60, '#fff', 2.2))
      const txt = h.text(el, spec.text, 'mo-pilltext', { left: 176, right: 40, top: 0, bottom: 0, fontSize: M.clamp(Math.round((P - 220) / (strip(spec.text).length * 0.52)), 44, 66) })
      txt.box.style.position = 'absolute'
      tl.fromTo(el, { clipPath: circ, opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: E.spring }, 0.06)
      tl.to(el, { clipPath: pill, duration: 0.5, ease: 'expo.inOut' }, 0.45)
      tl.fromTo(icon, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.4, ease: E.spring }, 0.6)
      fx.reveal(tl, txt.words, c.times(spec.text, { start: 0.7, cap: 0.6, pace: 0.14 }), { y: 22, blur: 8, dur: 0.4 })
      if (spec.sub) {
        const sub = h.text(stage, spec.sub, 'mo-sub mo-center-text', { left: env.safe.l, width: c.maxW, top: c.cy + D / 2 + 70, fontSize: 64 })
        sub.box.style.position = 'absolute'
        fx.reveal(tl, sub.words, c.times(spec.sub, { start: 1.2, cap: 0.5 }), { y: 26, blur: 8, dur: 0.45 })
      }
      tl.to(el, { y: -10, duration: 1.4, ease: E.soft }, 1.1)
    },
  })

  // ============ hook.pixel — text assembling out of mosaic squares (dark, glowing) ============
  M.register('hook.pixel', {
    kind: 'hook', theme: 'dark', label: 'Texte qui se forme à partir de carrés pixel (look tech, lueur)', min: 2.8, max: 3.0, words: [1, 5], needs: ['text'],
    sfx: () => [{ t: 0.0, cue: 'glitch' }, { t: 0.25, cue: 'type' }, { t: 0.55, cue: 'type' }, { t: 0.9, cue: 'ping' }, { t: 1.5, cue: 'sparkle' }],
    legible: (spec) => M.r2(0.12 + Math.max(0, strip(spec.text).replace(/[|\s]/g, '').length - 1) * 0.045 + 0.34),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'glow', 'dark')
      const text = strip(spec.text).replace(/\s*\|\s*/g, '|')
      const lay = M.layout(text, c.maxW, { max: 190, min: 84, factor: 0.62, maxLines: 4 })
      const size = lay.size
      const wrap = h.box(stage, 'mo-center', { left: env.safe.l, width: c.maxW, top: env.safe.t, height: env.H - env.safe.t - env.safe.b })
      const stack = h.el('div', 'mo-stack', '', wrap)
      const L = h.letters(stack, lay.markup, 'mo-h1 mo-px', { fontSize: size })
      const R = M.rng(env.seed + 5)
      const cell = Math.round(size * 0.42)
      for (let i = 0; i < 16; i++) {
        const sq = h.box(stage, 'mo-pxcell', { left: Math.round(env.safe.l + R() * (c.maxW - cell)), top: Math.round(c.cy - size * 1.4 + R() * size * 2.8), width: cell * (0.5 + R() * 0.6), height: cell * (0.5 + R() * 0.6) })
        const t0 = R() * 0.7
        tl.fromTo(sq, { opacity: 0 }, { opacity: 0.55 + R() * 0.4, duration: 0.07, ease: 'none' }, t0)
        tl.to(sq, { opacity: 0, duration: 0.12 }, t0 + 0.1 + R() * 0.25)
        tl.to(sq, { opacity: 0.7, duration: 0.05 }, t0 + 0.42)
        tl.to(sq, { opacity: 0, duration: 0.15 }, t0 + 0.5)
      }
      L.chars.forEach((ch, i) => {
        tl.fromTo(ch, { opacity: 0, color: env.pal.accent, y: i % 2 ? 22 : -22, filter: blur(6) }, { opacity: 1, color: env.pal.ink, y: 0, filter: blur(0), duration: 0.34, ease: 'power2.out' }, 0.12 + i * 0.045)
      })
      tl.fromTo(L.box, { textShadow: '0 0 0 rgba(0,0,0,0)' }, { textShadow: '0 0 38px ' + env.pal.accent, duration: 0.5, ease: 'power2.out' }, 0.9)
      const scan = h.box(stage, 'mo-scan', { left: -300, top: 0, width: 260, height: env.H })
      tl.fromTo(scan, { x: 0 }, { x: env.W + 400, duration: 0.9, ease: 'power2.inOut' }, 1.5)
      if (spec.sub) {
        const sub = h.text(stack, spec.sub, 'mo-sub', { fontSize: Math.round(size * 0.4) })
        fx.reveal(tl, sub.words, c.times(spec.sub, { start: 1.35, cap: 0.5 }), { y: 24, blur: 8, dur: 0.45 })
      }
      fx.breathe(tl, stack, 0.2, c.dur, 1.045)
    },
  })

  // ============ hook.logo — the brand mark slams in on the brand colour, then the colours flip ============
  M.register('hook.logo', {
    kind: 'hook', label: 'Logo qui claque sur fond de marque, puis bascule de couleurs et slogan', min: 2.8, max: 3.0, words: [0, 5], needs: [],
    sfx: () => [{ t: 0.04, cue: 'impact' }, { t: 0.06, cue: 'whooshBig' }, { t: 1.18, cue: 'whoosh' }, { t: 1.75, cue: 'pop' }],
    legible: (spec, env) => M.r2(0.4 + Math.max(0, String((env.brand && env.brand.name) || 'KONVWA').length - 1) * 0.05 + 0.5),
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      const mk = (dark) => {
        const layer = h.box(null, dark ? 'mo-layer' : 'mo-layer', { left: 0, top: 0, width: env.W, height: env.H })
        const logo = h.logo(layer, env, 330, { left: c.cx - 165, top: c.cy - 330 })
        const name = h.letters(layer, env.brand.name || '', 'mo-brandname', { left: 0, width: env.W, top: c.cy - 40, fontSize: M.clamp(Math.round(c.maxW / ((env.brand.name || 'X').length * 0.72)), 90, 170) })
        name.box.style.position = 'absolute'
        return { layer, logo, name }
      }
      stage.style.background = 'var(--accent)'
      stage.classList.add('mo-onaccent')
      const a = mk(false)
      stage.appendChild(a.layer)
      a.layer.classList.add('mo-white')
      const flip = h.box(stage, 'mo-flip', { left: 0, top: 0, width: env.W, height: env.H })
      const b = mk(true)
      flip.appendChild(b.layer)
      const tagBox = h.box(flip, 'mo-center-text', { left: env.safe.l, width: c.maxW, top: c.cy + 150 })
      const R = Math.ceil(Math.hypot(env.W, env.H))
      tl.set(flip, { clipPath: 'circle(0px at ' + c.cx + 'px ' + (c.cy - 170) + 'px)' }, 0)
      for (const x of [a, b]) {
        fx.slam(tl, x.logo, 0.02, { from: 2.4, blur: 30, rot: -16, dur: 0.7, ease: 'expo.out' })
        x.name.chars.forEach((ch, i) => tl.fromTo(ch, { opacity: 0, y: 70, filter: blur(10) }, { opacity: 1, y: 0, filter: blur(0), duration: 0.5, ease: E.outX }, 0.4 + i * 0.05))
      }
      tl.to(flip, { clipPath: 'circle(' + R + 'px at ' + c.cx + 'px ' + (c.cy - 170) + 'px)', duration: 0.62, ease: 'power3.inOut' }, 1.15)
      if (spec.text) {
        const t = h.text(tagBox, spec.text, 'mo-sub mo-tag', { fontSize: 76 })
        fx.reveal(tl, t.words, c.times(spec.text, { start: 1.75, cap: 0.6, pace: 0.16 }), { y: 34, blur: 10, dur: 0.5 })
      }
      fx.breathe(tl, flip, 1.2, c.dur, 1.03)
    },
  })

  // ============ hook.product — a real product photo flies in, ribbon sweep, caps + serif typography ============
  M.register('hook.product', {
    kind: 'hook', label: 'Produit en vol avec ombre, ruban qui balaie, cercle pointillé, titre en capitales', min: 2.8, max: 3.0, words: [0, 6], needs: ['image'],
    sfx: () => [{ t: 0.0, cue: 'cine' }, { t: 0.55, cue: 'impact2' }, { t: 0.9, cue: 'whoosh' }, { t: 1.55, cue: 'pop' }, { t: 1.8, cue: 'pop' }],
    legible: (spec, env) => { if (!spec.title) return 0.9; const t = M.timesFor(spec.title, env, { start: 0.6, cap: 0.5, pace: 0.12 }); return M.r2((t[t.length - 1] || 0.6) + 0.5) },
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      const R = M.rng(env.seed + 3)
      stage.style.background = 'var(--bg)'
      const blobs = []
      for (let i = 0; i < 3; i++) {
        const d = 420 + Math.round(R() * 360)
        const b = h.box(stage, 'mo-dapple', { left: Math.round(R() * env.W - d / 2), top: Math.round(R() * env.H - d / 2), width: d, height: d })
        blobs.push(b)
      }
      fx.drift(tl, blobs, 0, c.dur, 60, env.seed)
      const pw = Math.min(680, c.maxW * 0.86)
      const px = c.cx
      const py = c.cy - 10
      const svg = h.box(stage, 'mo-ribbon', { left: 0, top: 0, width: env.W, height: env.H })
      svg.innerHTML = '<svg width="' + env.W + '" height="' + env.H + '" viewBox="0 0 ' + env.W + ' ' + env.H + '" fill="none"><path class="rb" d="M -60 ' + Math.round(py + 330) + ' C 260 ' + Math.round(py + 150) + ', 640 ' + Math.round(py + 470) + ', ' + (env.W + 60) + ' ' + Math.round(py + 270) + '" stroke="var(--accent)" stroke-width="64" stroke-linecap="round"/></svg>'
      fx.draw(tl, svg.querySelector('.rb'), 0.55, 0.8, 'power3.inOut')
      const ring = h.box(stage, 'mo-dotring', { left: px - pw * 0.66, top: py - pw * 0.66, width: pw * 1.32, height: pw * 1.32 })
      tl.fromTo(ring, { opacity: 0, scale: 0.8, rotation: -50 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.8, ease: E.outX }, 1.2)
      const img = h.el('img', 'mo-abs mo-prod', '', stage)
      img.src = spec.image
      img.style.cssText += ';left:' + Math.round(px - pw / 2) + 'px;top:' + Math.round(py - pw / 2) + 'px;width:' + Math.round(pw) + 'px;height:' + Math.round(pw) + 'px'
      tl.fromTo(img, { x: -env.W * 0.75, y: -env.H * 0.34, rotation: -42, scale: 0.55, opacity: 0, filter: blur(14) }, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, filter: blur(0), duration: 0.85, ease: 'expo.out' }, 0.02)
      if (spec.image2) {
        const i2 = h.el('img', 'mo-abs mo-prod mo-prod2', '', stage)
        i2.src = spec.image2
        i2.style.cssText += ';left:' + Math.round(env.W - env.safe.r - 300) + 'px;top:' + Math.round(py + pw * 0.5) + 'px;width:300px;height:300px'
        tl.fromTo(i2, { x: 300, y: 300, rotation: 38, opacity: 0, filter: blur(14) }, { x: 0, y: 0, rotation: 14, opacity: 1, filter: blur(2), duration: 0.9, ease: 'expo.out' }, 0.3)
      }
      if (spec.kicker) {
        const k = h.text(stage, spec.kicker, 'mo-kicker', { right: env.safe.r, top: env.safe.t + 10, fontSize: 56 })
        k.box.style.position = 'absolute'
        fx.reveal(tl, k.words, [0.5, 0.58, 0.66, 0.74].slice(0, k.words.length), { y: 20, blur: 8, dur: 0.45 })
      }
      if (spec.title) {
        const t = h.text(stage, spec.title, 'mo-caps', { right: env.safe.r, top: env.safe.t + 76, fontSize: M.clamp(Math.round(c.maxW / (strip(spec.title).length * 0.62)), 64, 120) })
        t.box.style.position = 'absolute'
        fx.reveal(tl, t.words, c.times(spec.title, { start: 0.6, cap: 0.5, pace: 0.12 }), { y: 40, blur: 12, dur: 0.5 })
      }
      if (spec.kicker2 || spec.title2) {
        const base = py + pw * 0.62
        if (spec.kicker2) { const k2 = h.text(stage, spec.kicker2, 'mo-kicker', { left: env.safe.l, top: base, fontSize: 56 }); k2.box.style.position = 'absolute'; fx.reveal(tl, k2.words, [1.5], { y: 20, blur: 8, dur: 0.45 }) }
        if (spec.title2) { const t2 = h.text(stage, spec.title2, 'mo-caps', { left: env.safe.l, top: base + 62, maxWidth: 560, fontSize: M.clamp(Math.round(560 / (strip(spec.title2).length * 0.64)), 52, 112) }); t2.box.style.position = 'absolute'; fx.reveal(tl, t2.words, c.times(spec.title2, { start: 1.62, cap: 0.4, pace: 0.12 }), { y: 40, blur: 12, dur: 0.5 }) }
      }
      fx.breathe(tl, img, 0.9, c.dur, 1.05)
    },
  })

  // ============ hook.poster — editorial poster: grayscale cut-out, one accent circle, micro-typography, giant ghost word ============
  M.register('hook.poster', {
    kind: 'hook', label: 'Affiche éditoriale : photo détourée en noir et blanc, cercle d’accent, micro-typo, mot géant', min: 2.8, max: 3.0, words: [1, 6], needs: ['image', 'text'],
    sfx: () => [{ t: 0.0, cue: 'whooshBig' }, { t: 0.5, cue: 'tick' }, { t: 0.75, cue: 'tick' }, { t: 1.0, cue: 'tick' }, { t: 1.25, cue: 'impact' }],
    legible: (spec, env) => { const t = M.timesFor(spec.text, env, { start: 0.5, cap: 1.2, pace: 0.18 }); return M.r2((t[t.length - 1] || 0.5) + 0.6) },
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      const R = M.rng(env.seed + 9)
      stage.classList.add('mo-poster')
      const circ = Math.round(c.maxW * 0.86)
      const cc = h.box(stage, 'mo-pcircle', { left: Math.round(c.cx - circ * 0.62), top: Math.round(c.cy - circ * 0.78), width: circ, height: circ })
      tl.fromTo(cc, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: E.outX }, 0)
      const dot = h.box(stage, 'mo-pdot', { left: Math.round(env.W - env.safe.r - 120), top: Math.round(c.cy + circ * 0.4), width: 54, height: 54 })
      tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.5, ease: E.spring }, 0.5)
      const ring = h.box(stage, 'mo-dotring mo-dotring-thin', { left: Math.round(c.cx - circ * 0.62), top: Math.round(c.cy - circ * 0.62), width: Math.round(circ * 1.24), height: Math.round(circ * 1.24) })
      tl.fromTo(ring, { opacity: 0, rotation: -60 }, { opacity: 1, rotation: 0, duration: 1.0, ease: E.outX }, 0.2)
      const ghostText = strip(spec.ghost || spec.text.split(/\s+/).pop())
      const ghost = h.box(stage, 'mo-ghost', { left: 0, width: env.W, top: env.H - env.safe.b - 120, fontSize: M.clamp(Math.round((env.W * 0.96) / (ghostText.length * 0.7)), 200, 520) })
      ghost.textContent = ghostText
      tl.fromTo(ghost, { y: 260, opacity: 0, filter: blur(22) }, { y: 0, opacity: 1, filter: blur(3), duration: 0.9, ease: 'expo.out' }, 0.45)
      const imgW = Math.round(env.W * 0.98)
      const img = h.el('img', 'mo-abs mo-cut', '', stage)
      img.src = spec.image
      img.style.cssText += ';left:' + Math.round((env.W - imgW) / 2) + 'px;top:' + Math.round(c.cy - imgW * 0.5) + 'px;width:' + imgW + 'px;height:' + imgW + 'px'
      tl.fromTo(img, { scale: 1.16, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0)
      fx.breathe(tl, img, 0.85, c.dur, 1.05)
      // micro typography: tiny labels, a QR-like block and a barcode
      const micro = spec.micro || [env.brand.name || '', env.brand.handle || '']
      const m1 = h.box(stage, 'mo-micro', { left: env.safe.l, top: env.safe.t - 30 }, micro.slice(0, 2).map((s) => '<b>' + s + '</b>').join(''))
      tl.fromTo(m1, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3)
      let cells = ''
      for (let r = 0; r < 9; r++) for (let q = 0; q < 9; q++) if (R() > 0.46) cells += '<i style="left:' + q * 9 + 'px;top:' + r * 9 + 'px"></i>'
      const qr = h.box(stage, 'mo-qr', { right: env.safe.r + 20, top: Math.round(c.cy - 60), width: 82, height: 82 }, cells)
      tl.fromTo(qr, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: E.spring }, 0.7)
      let bars = ''
      let x = 0
      for (let i = 0; i < 26; i++) { const w = 2 + Math.round(R() * 5); bars += '<i style="left:' + x + 'px;width:' + w + 'px"></i>'; x += w + 2 + Math.round(R() * 3) }
      const bc = h.box(stage, 'mo-barcode', { left: env.safe.l + 10, top: Math.round(c.cy + circ * 0.5), width: x, height: 46 }, bars)
      tl.fromTo(bc, { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.5, ease: E.outX, transformOrigin: '0% 50%' }, 0.8)
      // the line, big and white, word by word over the picture
      const lay = M.layout(spec.text, c.maxW, { max: 160, min: 84, maxLines: 3 })
      const size = lay.size
      const t = h.text(stage, lay.markup, 'mo-h1 mo-poster-text', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy - size * 0.1), fontSize: size })
      t.box.style.position = 'absolute'
      fx.reveal(tl, t.words, c.times(spec.text, { start: 0.5, cap: 1.2, pace: 0.18 }), { y: 60, blur: 22, dur: 0.6, scale: 1.04 })
    },
  })

  // ============ hook.number — one huge number counting up ============
  M.register('hook.number', {
    kind: 'hook', label: 'Un chiffre géant qui monte, avec une légende', min: 2.8, max: 3.0, words: [0, 6], needs: ['value'],
    sfx: () => [{ t: 0.0, cue: 'riser' }, { t: 1.1, cue: 'impact' }, { t: 1.12, cue: 'pop' }, { t: 1.55, cue: 'tick' }],
    legible: () => 1.35,
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'glow', env.theme)
      const disc = Math.round(c.maxW * 0.98)
      const d = h.box(stage, 'mo-disc', { left: Math.round(c.cx - disc / 2), top: Math.round(c.cy - disc / 2 - 80), width: disc, height: disc })
      tl.fromTo(d, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: E.outX }, 0)
      const total = String(Math.round(spec.value)).length + (spec.suffix ? String(spec.suffix).length * 0.55 : 0) + (spec.prefix ? 0.4 : 0)
      const size = M.clamp(Math.round(c.maxW / (total * 0.66)), 150, 420)
      const wrap = h.box(stage, 'mo-center', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy - size * 0.95), height: Math.round(size * 1.2) })
      const num = h.el('div', 'mo-bignum', '', wrap)
      num.style.fontSize = size + 'px'
      const pre = h.el('span', 'mo-numpre', spec.prefix || '', num)
      const val = h.el('span', 'mo-numval', '0', num)
      const suf = h.el('span', 'mo-numsuf', spec.suffix || '', num)
      pre.style.fontSize = suf.style.fontSize = Math.round(size * 0.46) + 'px'
      const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')
      fx.count(tl, val, 0, spec.value, 0.08, 1.05, fmt, 'power4.out')
      tl.fromTo(num, { scale: 0.92 }, { scale: 1, duration: 1.1, ease: 'power4.out' }, 0.08)
      tl.to(num, { scale: 1.07, duration: 0.14, ease: 'power2.out' }, 1.12)
      tl.to(num, { scale: 1, duration: 0.4, ease: E.spring }, 1.26)
      if (spec.text) {
        const t = h.text(stage, spec.text, 'mo-sub mo-center-text', { left: env.safe.l, width: c.maxW, top: Math.round(c.cy + size * 0.28), fontSize: 78 })
        t.box.style.position = 'absolute'
        fx.reveal(tl, t.words, c.times(spec.text, { start: 1.2, cap: 0.7, pace: 0.16 }), { y: 34, blur: 10, dur: 0.5 })
      }
    },
  })

  // ============ hook.question — a question that flips in word by word, the key word highlighted ============
  M.register('hook.question', {
    kind: 'hook', label: 'Question qui se retourne mot par mot, mot-clé surligné', min: 2.8, max: 3.0, words: [2, 7], needs: ['text'],
    sfx(spec, env) {
      const t = M.timesFor(spec.text, env, { start: 0.1, cap: 1.1, pace: 0.16 })
      return [{ t: 0.0, cue: 'whoosh' }, ...t.slice(0, 4).map((x) => ({ t: M.r2(x + 0.05), cue: 'tick' })), { t: M.r2((t[t.length - 1] || 1) + 0.25), cue: 'pop' }]
    },
    legible: (spec, env) => { const t = M.timesFor(spec.text, env, { start: 0.1, cap: 1.1, pace: 0.16 }); return M.r2((t[t.length - 1] || 0.1) + 0.55) },
    build(c) {
      const { stage, tl, env, h, fx, spec } = c
      h.bg(stage, env, 'dots', env.theme)
      h.bg(stage, env, 'glow', env.theme)
      const lay = M.layout(spec.text, c.maxW, { max: 190, min: 80, maxLines: 4 })
      const size = lay.size
      const wrap = h.box(stage, 'mo-center', { left: env.safe.l, width: c.maxW, top: env.safe.t, height: env.H - env.safe.t - env.safe.b })
      const t = h.text(wrap, lay.markup, 'mo-h1 mo-flip3d', { fontSize: size })
      const times = c.times(spec.text, { start: 0.1, cap: 1.1, pace: 0.16 })
      t.words.forEach((w, i) => tl.fromTo(w, { opacity: 0, rotationX: -88, y: 30, filter: blur(10), transformOrigin: '50% 100%' }, { opacity: 1, rotationX: 0, y: 0, filter: blur(0), duration: 0.55, ease: 'back.out(1.5)' }, times[i]))
      const ai = M.accentIndex(spec.text)
      if (ai >= 0) {
        const aw = t.words[ai]
        aw.style.position = 'relative'
        fx.mark(tl, t.words, times[ai] + 0.3, 0.45)
      }
      fx.breathe(tl, wrap, 0.2, c.dur, 1.04)
    },
  })
})(typeof window !== 'undefined' ? window : globalThis)
