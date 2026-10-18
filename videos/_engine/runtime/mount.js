/* KONVWA motion engine — transitions and mount (browser only).
 * Scenes overlap by the transition's duration. The ENTERING scene is always on top and carries the transition (it slides / wipes / scales in);
 * the leaving scene only gets a light push so the two read as one gesture. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  const E = M.E
  const blur = (n) => 'blur(' + n + 'px)'

  /** Purely decorative layers (glows, rings, ghosts…): allowed to bleed past the frame and sit behind other things. */
  M.DECO = '.mo-glow,.mo-rings,.mo-ringwave,.mo-halo,.mo-dotring,.mo-ribbon,.mo-dapple,.mo-pcircle,.mo-pdot,.mo-pxcell,.mo-scan,.mo-ghost,.mo-glyph,.mo-dots,.mo-lines,.mo-pillglow,.mo-disc,.mo-flash,.mo-sq,.mo-hex,.mo-cutout,.mo-carry,.mo-carryshadow,.mo-bigdisc,.mo-photo,.mo-photo-shade,.mo-gobo,.mo-medring,.mo-burst,.mo-qmark,.mo-confetti,.mo-cdring'

  M.TRANSITIONS = {
    cut: { dur: 0, sfx: null, in() {}, out() {} },
    whip: {
      dur: 0.42, sfx: 'whoosh',
      in(tl, stage, env, d) { tl.fromTo(stage, { x: env.W * 0.62, filter: blur(28), scaleX: 1.1 }, { x: 0, filter: blur(0), scaleX: 1, duration: d, ease: 'expo.out' }, 0) },
      out(tl, stage, env, at, d) { tl.to(stage, { x: -env.W * 0.14, filter: blur(10), duration: d, ease: 'power2.in' }, at) },
    },
    up: {
      dur: 0.46, sfx: 'whoosh',
      in(tl, stage, env, d) { tl.fromTo(stage, { y: env.H * 0.5, filter: blur(26), scaleY: 1.1 }, { y: 0, filter: blur(0), scaleY: 1, duration: d, ease: 'expo.out' }, 0) },
      out(tl, stage, env, at, d) { tl.to(stage, { y: -env.H * 0.1, filter: blur(10), duration: d, ease: 'power2.in' }, at) },
    },
    circle: {
      dur: 0.55, sfx: 'whooshBig',
      in(tl, stage, env, d) {
        const R = Math.ceil(Math.hypot(env.W, env.H))
        const at = env.origin || [env.W / 2, env.H * 0.58]
        tl.fromTo(stage, { clipPath: 'circle(0px at ' + at[0] + 'px ' + at[1] + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + at[0] + 'px ' + at[1] + 'px)', duration: d, ease: 'power3.inOut' }, 0)
      },
      out(tl, stage, env, at, d) { tl.to(stage, { scale: 1.07, filter: blur(6), duration: d, ease: 'power2.in' }, at) },
    },
    scale: {
      dur: 0.5, sfx: 'whooshBig',
      in(tl, stage, env, d) { tl.fromTo(stage, { scale: 0.8, opacity: 0, filter: blur(18) }, { scale: 1, opacity: 1, filter: blur(0), duration: d, ease: E.outX }, 0) },
      out(tl, stage, env, at, d) { tl.to(stage, { scale: 1.14, filter: blur(10), duration: d, ease: 'power2.in' }, at) },
    },
    flash: {
      dur: 0.36, sfx: 'impact',
      in(tl, stage, env, d) {
        const f = M.h.el('div', 'mo-abs mo-flash', '', stage)
        f.style.cssText += ';left:0;top:0;right:0;bottom:0;z-index:50;background:var(--flash,#fff)'
        tl.fromTo(f, { opacity: 1 }, { opacity: 0, duration: d * 1.5, ease: 'power2.out' }, 0)
        tl.fromTo(stage, { scale: 1.07 }, { scale: 1, duration: d * 1.5, ease: 'power3.out' }, 0)
      },
      out() {},
    },
    fade: {
      dur: 0.4, sfx: null,
      in(tl, stage, env, d) { tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: d, ease: 'power1.inOut' }, 0) },
      out() {},
    },
  }

  /**
   * Build one scene into its composition root and register its paused timeline (the caller registers it on window.__timelines).
   * env: { W,H,safe,dur,seed,theme,brand,vo:{start,dur}|null,transIn:{kind,dur}|null,transOut:{kind,dur}|null,origin? }
   */
  M.mount = function (root, tl, spec, env) {
    const def = M.catalog[spec.type]
    if (!def) throw new Error('Scène inconnue : ' + spec.type)
    env.pal = env.pal || M.PAL
    const stage = M.h.el('div', 'mo-stage mo-' + (env.theme || 'light') + (spec.tone ? ' mo-tone-' + spec.tone : ''), '', root)
    const ctx = {
      root, stage, tl, spec, env, h: M.h, fx: M.fx, E, W: env.W, H: env.H, S: env.safe, dur: env.dur,
      cx: env.W / 2, cy: (env.safe.t + env.H - env.safe.b) / 2, // centre of the safe area
      maxW: env.W - env.safe.l - env.safe.r,
      /** When each word of `markup` should appear: spread over the voice-over when there is one, else at a steady pace. */
      times(markup, o) { return M.timesFor(markup, env, o) },
      /** Second at which the voice starts (or the given default). */
      voAt(d) { return env.vo ? env.vo.start : d == null ? 0.2 : d },
    }
    def.build(ctx)
    // depth features any scene can have: floating decor, an object thrown into the next scene, the one caught from the previous scene
    if (spec.decor && spec.decor.length) M.decor(ctx, spec.decor)
    if (spec.carry) M.carry(ctx, spec.carry, 0, env.dur)
    if (env.carryIn) { const u0 = M.CARRY.lead / M.CARRY.span; M.carry(ctx, env.carryIn, u0, (1 - u0) * M.CARRY.span) }
    // Transitions put two scenes on screen at once and the designs layer shapes behind text on purpose: tell the layout checker.
    stage.setAttribute('data-layout-allow-overlap', '')
    stage.setAttribute('data-layout-allow-occlusion', '')
    stage.querySelectorAll(M.DECO).forEach((e) => { e.setAttribute('data-layout-allow-overflow', ''); e.setAttribute('data-layout-allow-overlap', ''); e.setAttribute('data-layout-allow-occlusion', '') })
    const tin = env.transIn
    if (tin && M.TRANSITIONS[tin.kind]) M.TRANSITIONS[tin.kind].in(tl, stage, env, tin.dur)
    const tout = env.transOut
    if (tout && M.TRANSITIONS[tout.kind]) M.TRANSITIONS[tout.kind].out(tl, stage, env, Math.max(0, env.dur - tout.dur), tout.dur)
    return tl
  }
})(typeof window !== 'undefined' ? window : globalThis)
