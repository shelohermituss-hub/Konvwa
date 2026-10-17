/* KONVWA motion engine — DOM helpers (browser only; nothing here runs at load time). */
;(function (g) {
  const M = (g.MOTION = g.MOTION || {})

  /** Lucide icon paths (24x24 viewBox, stroke icons). */
  const ICONS = {
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    ship: '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
    box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5.5 21a7 7 0 0 1 13 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  }
  M.ICONS = ICONS

  const h = (M.h = {})

  /** Create an element (class string, inner HTML, parent). */
  h.el = function (tag, cls, html, parent) {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (html != null) e.innerHTML = html
    if (parent) parent.appendChild(e)
    return e
  }
  /** Absolutely positioned box with inline styles (numbers become px). */
  h.box = function (parent, cls, st, html) {
    const e = h.el('div', 'mo-abs' + (cls ? ' ' + cls : ''), html, parent)
    for (const k in st || {}) e.style[k] = typeof st[k] === 'number' && !/opacity|zIndex|fontWeight|lineHeight|flex/.test(k) ? st[k] + 'px' : st[k]
    return e
  }
  /** Inline SVG icon. */
  h.icon = function (name, size, color, sw) {
    const p = ICONS[name] || ICONS.sparkles
    return '<svg class="mo-ic" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'
  }

  /**
   * A line of text built from markup, one inline-block span per word so every word can be animated alone.
   * Returns { box, words:[spans] }. Line breaks come from `|` in the markup (flex-basis 100%, no <br>).
   */
  h.text = function (parent, markup, cls, st) {
    const box = h.el('div', 'mo-text ' + (cls || ''), '', parent)
    for (const k in st || {}) box.style[k] = typeof st[k] === 'number' && !/opacity|zIndex|fontWeight|lineHeight/.test(k) ? st[k] + 'px' : st[k]
    const words = []
    for (const tk of M.parse(markup)) {
      if (tk.t === 'br') { h.el('span', 'mo-br', '', box); continue }
      const w = h.el('span', 'mo-w' + (tk.k === 'a' ? ' mo-a' : tk.k === 's' ? ' mo-s' : ''), '', box)
      w.textContent = tk.s
      words.push(w)
    }
    return { box, words }
  }

  /** Per-letter spans (for pixel / typed effects), one flex row per line (`|` = new line) so spaces never push a line off-centre. */
  h.letters = function (parent, text, cls, st) {
    const box = h.el('div', 'mo-text mo-letters ' + (cls || ''), '', parent)
    for (const k in st || {}) box.style[k] = typeof st[k] === 'number' && !/opacity|zIndex|fontWeight|lineHeight/.test(k) ? st[k] + 'px' : st[k]
    const chars = []
    for (const line of String(text).split('|')) {
      const row = h.el('div', 'mo-line', '', box)
      for (const ch of Array.from(line.trim())) {
        const s = h.el('span', ch === ' ' ? 'mo-ch mo-sp' : 'mo-ch', '', row)
        s.textContent = ch === ' ' ? '\u00a0' : ch
        chars.push(s)
      }
    }
    return { box, chars }
  }

  /** Decorative background layers. Returns the elements so a scene can animate them. kinds: plain | glow | rings | dots */
  h.bg = function (stage, env, kind, tone) {
    const out = []
    const W = env.W
    const H = env.H
    const R = M.rng(env.seed + 7)
    if (kind === 'dots') {
      out.push(h.box(stage, 'mo-dots', { left: 0, top: 0, width: W, height: H }))
    }
    if (kind === 'glow' || kind === 'rings') {
      const blobs = [
        { x: 0.3 + R() * 0.15, y: 0.34 + R() * 0.1, s: 0.95, c: 'var(--accent)', a: 0.17 },
        { x: 0.74 + R() * 0.1, y: 0.66 + R() * 0.1, s: 0.8, c: 'var(--accent2)', a: 0.13 },
      ]
      for (const b of blobs) {
        const d = Math.round(Math.max(W, H) * b.s * 0.72)
        const e = h.box(stage, 'mo-glow', { left: Math.round(W * b.x - d / 2), top: Math.round(H * b.y - d / 2), width: d, height: d, opacity: 1 })
        e.style.background = 'radial-gradient(circle, ' + b.c + ' 0%, transparent 66%)'
        e.style.opacity = String(b.a * (tone === 'dark' ? 1.5 : 1))
        out.push(e)
      }
    }
    if (kind === 'rings') {
      const svg = h.el('div', 'mo-abs mo-rings', '', stage)
      svg.style.cssText += ';left:0;top:0;width:' + W + 'px;height:' + H + 'px'
      const arcs = [
        { cx: W * 0.02, cy: H * 0.12, r: W * 0.34 },
        { cx: W * 1.0, cy: H * 0.9, r: W * 0.4 },
        { cx: W * 0.96, cy: H * 0.18, r: W * 0.18 },
      ]
      svg.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" fill="none">' + arcs.map((a) => '<circle cx="' + Math.round(a.cx) + '" cy="' + Math.round(a.cy) + '" r="' + Math.round(a.r) + '" stroke="var(--accent)" stroke-opacity="0.34" stroke-width="3"/>').join('') + '</svg>'
      out.push(svg)
    }
    return out
  }

  /** The brand mark (inline SVG supplied by the brand kit). */
  h.logo = function (parent, env, size, st) {
    const e = h.box(parent, 'mo-logo', Object.assign({ width: size, height: Math.round(size * 0.655) }, st || {}), env.brand.logo || '')
    return e
  }

  /** A mouse / finger pointer. */
  h.cursor = function (parent, size) {
    const e = h.box(parent, 'mo-cursor', { left: 0, top: 0, width: size, height: size })
    e.innerHTML = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"><path d="M5 3l14 7.2-6 1.9-2.2 6.2z" fill="#0A1628" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    return e
  }
})(typeof window !== 'undefined' ? window : globalThis)
