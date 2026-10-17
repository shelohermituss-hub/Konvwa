/* KONVWA motion engine — timeline primitives (browser only). Every function adds tweens to a paused GSAP timeline and never reads a clock:
 * a render is identical every time. An element gets ONE fromTo (its entrance); anything after that is a plain `to`. */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})
  const E = M.E
  const fx = (M.fx = {})
  const blur = (n) => 'blur(' + n + 'px)'

  /** Words (or any element list) appear one after the other: rise + de-blur. `times` = start of each, in seconds. */
  fx.reveal = function (tl, els, times, o) {
    const p = Object.assign({ y: 46, x: 0, blur: 16, scale: 1, dur: 0.55, ease: E.outX }, o)
    els.forEach((el, i) => {
      const from = { opacity: 0, y: p.y, x: p.x, filter: blur(p.blur) }
      const to = { opacity: 1, y: 0, x: 0, filter: blur(0), duration: p.dur, ease: p.ease }
      if (p.scale !== 1) { from.scale = p.scale; to.scale = 1 }
      tl.fromTo(el, from, to, times[i])
    })
  }
  /** Hard entrance: big and blurry, lands with a hit. */
  fx.slam = function (tl, el, at, o) {
    const p = Object.assign({ from: 1.45, blur: 18, dur: 0.5, ease: E.outX, rot: 0 }, o)
    tl.fromTo(el, { opacity: 0, scale: p.from, rotation: p.rot, filter: blur(p.blur) }, { opacity: 1, scale: 1, rotation: 0, filter: blur(0), duration: p.dur, ease: p.ease }, at)
  }
  /** Soft pop with a small overshoot (UI elements, chips, badges). */
  fx.pop = function (tl, el, at, o) {
    const p = Object.assign({ from: 0.6, dur: 0.45, ease: E.spring, y: 0 }, o)
    tl.fromTo(el, { opacity: 0, scale: p.from, y: p.y }, { opacity: 1, scale: 1, y: 0, duration: p.dur, ease: p.ease }, at)
  }
  fx.fadeUp = function (tl, el, at, o) {
    const p = Object.assign({ y: 34, dur: 0.5, ease: E.out, blur: 8 }, o)
    tl.fromTo(el, { opacity: 0, y: p.y, filter: blur(p.blur) }, { opacity: 1, y: 0, filter: blur(0), duration: p.dur, ease: p.ease }, at)
  }
  fx.slideIn = function (tl, el, at, o) {
    const p = Object.assign({ x: 140, dur: 0.6, ease: E.outX, blur: 14 }, o)
    tl.fromTo(el, { opacity: 0, x: p.x, filter: blur(p.blur) }, { opacity: 1, x: 0, filter: blur(0), duration: p.dur, ease: p.ease }, at)
  }
  /** Marker stroke under an accent word: the word's own background grows from the left (no extra element, nothing to stack). */
  fx.highlight = function (tl, el, at, dur) {
    tl.fromTo(el, { backgroundSize: '0% 36%' }, { backgroundSize: '100% 36%', duration: dur || 0.5, ease: E.outX, immediateRender: false }, at)
  }
  /** The marker under every accent word of a line, one after the other. */
  fx.mark = function (tl, words, at, dur) {
    words.filter((w) => w.classList.contains('mo-a')).forEach((w, i) => fx.highlight(tl, w, at + i * 0.12, dur))
  }
  /** Leaves: up, blurred, gone. */
  fx.out = function (tl, els, at, o) {
    const p = Object.assign({ y: -34, dur: 0.32, ease: E.in, blur: 10, stagger: 0 }, o)
    tl.to(els, { opacity: 0, y: p.y, filter: blur(p.blur), duration: p.dur, ease: p.ease, stagger: p.stagger }, at)
  }
  /** Very slow push-in so a held frame never looks frozen. */
  fx.breathe = function (tl, el, at, dur, to) {
    tl.fromTo(el, { scale: 1 }, { scale: to || 1.045, duration: dur, ease: 'none', immediateRender: false }, at)
  }
  /** A stroke that draws itself (SVG path / circle). */
  fx.draw = function (tl, path, at, dur, ease) {
    const L = Math.ceil(path.getTotalLength ? path.getTotalLength() : 600) + 2
    path.style.strokeDasharray = L + ' ' + L
    tl.fromTo(path, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: ease || 'power2.inOut' }, at)
    return L
  }
  /** A ring wave: grows and fades. */
  fx.wave = function (tl, el, at, o) {
    const p = Object.assign({ from: 0.2, to: 3.2, dur: 0.9, ease: 'power2.out' }, o)
    tl.set(el, { opacity: 0 }, 0)
    tl.fromTo(el, { opacity: 0.9, scale: p.from }, { opacity: 0, scale: p.to, duration: p.dur, ease: p.ease, immediateRender: false }, at)
  }
  /** Number that counts up; `fmt(n)` returns the text. The text is always a pure function of the tween's progress. */
  fx.count = function (tl, el, from, to, at, dur, fmt, ease) {
    const o = { v: from }
    const f = fmt || ((n) => String(Math.round(n)))
    el.textContent = f(from)
    tl.to(o, { v: to, duration: dur, ease: ease || 'power3.out', onUpdate: () => { el.textContent = f(o.v) } }, at)
  }
  /** Elements drift upward / sideways while visible, each at its own pace (deterministic). */
  fx.drift = function (tl, els, at, dur, amp, seed) {
    const R = M.rng(seed || 3)
    els.forEach((el) => {
      const dy = -amp * (0.5 + R())
      const dx = (R() - 0.5) * amp * 0.9
      tl.fromTo(el, { y: 0, x: 0 }, { y: dy, x: dx, duration: dur, ease: 'none', immediateRender: false }, at)
    })
  }
  /** Pointer moves through steps [{x,y,t,tap}] and taps where asked. */
  fx.pointer = function (tl, cur, steps) {
    const f = steps[0]
    tl.set(cur, { x: f.x, y: f.y, opacity: 0 }, 0)
    tl.to(cur, { opacity: 1, duration: 0.2 }, Math.max(0, f.t - 0.25))
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (i > 0) tl.to(cur, { x: s.x, y: s.y, duration: Math.max(0.25, s.t - steps[i - 1].t - 0.05), ease: E.inOut }, steps[i - 1].t + 0.05)
      if (s.tap) {
        tl.to(cur, { scale: 0.8, duration: 0.09, ease: 'power2.in' }, s.t)
        tl.to(cur, { scale: 1, duration: 0.18, ease: 'power2.out' }, s.t + 0.09)
      }
    }
  }
  /** Ripple under a tap point (a ring that grows and fades). */
  fx.ripple = function (parent, tl, x, y, at, color) {
    const r = M.h.box(parent, 'mo-ripple', { left: x - 48, top: y - 48, width: 96, height: 96 })
    if (color) r.style.borderColor = color
    tl.fromTo(r, { opacity: 0.8, scale: 0.2 }, { opacity: 0, scale: 1.5, duration: 0.55, ease: 'power2.out' }, at)
    return r
  }
})(typeof window !== 'undefined' ? window : globalThis)
