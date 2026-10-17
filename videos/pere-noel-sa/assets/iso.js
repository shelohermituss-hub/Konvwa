/* iso.js — moteur isométrique partagé (SVG) pour « Père Noël SA ».
 * Projection 30° : x vers le bas-droite, y vers le bas-gauche, z vers le haut.
 * Tout est déterministe : aucune horloge, aucun Math.random (PRNG à graine).
 */
(function () {
  const C = Math.cos(Math.PI / 6);
  const S = 0.5;
  const NAVY = "#0B1630";
  const r1 = (n) => Math.round(n * 10) / 10;

  function P(x, y, z) {
    return [(x - y) * C, (x + y) * S - (z || 0)];
  }
  function pts(list) {
    return list.map((p) => r1(p[0]) + "," + r1(p[1])).join(" ");
  }
  function poly(list, fill, extra) {
    return `<polygon points="${pts(list)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
  }
  function line(list, stroke, w, extra) {
    return `<polyline points="${pts(list)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${extra ? " " + extra : ""}/>`;
  }

  // ---------- couleurs ----------
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  function mix(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  // Lumière en haut à droite : dessus clair, face droite = base, face gauche sombre (teintée nuit).
  function shade(base) {
    if (typeof base === "object") return base;
    return { top: mix(base, "#ffffff", 0.2), right: base, left: mix(base, NAVY, 0.34) };
  }

  // ---------- PRNG à graine ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- volumes ----------
  function box(x, y, z, w, d, h, base, opts) {
    const c = shade(base);
    const o = opts || {};
    let s = "";
    if (o.shadow !== false && z <= 0.5) {
      // ombre portée douce vers le bas-gauche
      const k = o.shadowLen || Math.min(h * 0.6, 40);
      s += poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d + k, 0), P(x - 0, y + d + k, 0)], "rgba(11,22,48,0.18)");
    }
    s += poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], c.left);
    s += poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], c.right);
    s += poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], c.top);
    if (o.edge !== false) {
      s += line([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y, z + h)], mix(c.top, "#ffffff", 0.45), o.edgeW || 1.4, 'opacity="0.7"');
    }
    return s;
  }

  // Rectangle posé sur une face. face: "L" (plan y = const, face avant-gauche),
  // "R" (plan x = const, face avant-droite), "T" (dessus, z = const).
  function quad(face, k, a1, a2, b1, b2, fill, extra) {
    let q;
    if (face === "L") q = [P(a1, k, b1), P(a2, k, b1), P(a2, k, b2), P(a1, k, b2)];
    else if (face === "R") q = [P(k, a1, b1), P(k, a2, b1), P(k, a2, b2), P(k, a1, b2)];
    else q = [P(a1, b1, k), P(a2, b1, k), P(a2, b2, k), P(a1, b2, k)];
    return poly(q, fill, extra);
  }

  // Matrices SVG pour poser du dessin 2D (texte, carte…) sur un plan iso.
  function planeTop(x0, y0, z) {
    const o = P(x0, y0, z);
    return `matrix(${C},${S},${-C},${S},${r1(o[0])},${r1(o[1])})`;
  }
  function planeLeft(x0, y, zTop) {
    const o = P(x0, y, zTop);
    return `matrix(${C},${S},0,1,${r1(o[0])},${r1(o[1])})`;
  }
  function planeRight(x, yMax, zTop) {
    const o = P(x, yMax, zTop);
    return `matrix(${C},${-S},0,1,${r1(o[0])},${r1(o[1])})`;
  }

  // Île flottante enneigée (dessus neige, tranche glacée, dessous cristallin).
  function island(x, y, w, d, h, opts) {
    const o = opts || {};
    const top = o.top || "#D9E3F1";
    const side = o.side || "#27467A";
    const depth = o.depth || Math.min(w, d) * 0.55;
    const sc = shade(side);
    let s = "";
    const apex = P(x + w * 0.62, y + d * 0.62, -h - depth);
    s += poly([P(x, y + d, -h), P(x + w, y + d, -h), apex], mix(sc.left, NAVY, 0.25));
    s += poly([P(x + w, y, -h), P(x + w, y + d, -h), apex], mix(sc.right, NAVY, 0.15));
    // tranche
    s += poly([P(x, y + d, -h), P(x + w, y + d, -h), P(x + w, y + d, 0), P(x, y + d, 0)], sc.left);
    s += poly([P(x + w, y, -h), P(x + w, y + d, -h), P(x + w, y + d, 0), P(x + w, y, 0)], sc.right);
    // liseré de neige qui déborde sur la tranche
    const lip = o.lip || 7;
    s += poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, -lip), P(x, y + d, -lip)], mix(top, "#9FB4D3", 0.35));
    s += poly([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, -lip), P(x + w, y, -lip)], mix(top, "#B9CBE3", 0.25));
    s += poly([P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0)], top);
    return s;
  }

  // Maison à pignon. Faîtage le long de x. Retourne { svg, chimneyTop:[x,y,z] }.
  function house(o) {
    const { x, y, w, d, h } = o;
    const rh = o.rh || d * 0.42;
    const wall = shade(o.wall || "#C9533F");
    const roof = o.roof || "#E6EDF7";
    const trim = shade(o.trim || "#7A3B2E");
    const ov = 7;
    const t = 7;
    const yc = y + d / 2;
    const slope = rh / (d / 2);
    const eaveZ = h - ov * slope;
    let s = "";
    // ombre au sol
    s += poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w + 10, y + d + 46, 0), P(x - 6, y + d + 46, 0)], "rgba(11,22,48,0.16)");
    // murs
    s += box(x, y, 0, w, d, h, wall, { shadow: false, edge: false });
    // pignon (triangle sur la face droite)
    s += poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w, yc, h + rh)], wall.right);
    // fenêtres
    const lit = o.lit !== false;
    const glass = lit ? "#FFC857" : "#22355C";
    const frame = mix(wall.left, NAVY, 0.4);
    const nL = o.winL == null ? Math.max(1, Math.floor(w / 46)) : o.winL;
    for (let i = 0; i < nL; i++) {
      const cx = x + (w * (i + 0.5)) / nL;
      if (o.door && i === Math.floor(nL / 2) && nL > 1) continue;
      s += quad("L", y + d, cx - 9, cx + 9, h * 0.35, h * 0.72, frame);
      s += quad("L", y + d, cx - 7, cx + 7, h * 0.38, h * 0.69, glass, lit ? 'class="iso-win"' : "");
      s += quad("L", y + d, cx - 0.8, cx + 0.8, h * 0.38, h * 0.69, frame);
    }
    if (o.door) {
      const cx = x + w / 2;
      s += quad("L", y + d, cx - 9, cx + 9, 0, h * 0.62, mix(trim.left, NAVY, 0.2));
      s += quad("L", y + d, cx - 7, cx + 7, 0, h * 0.58, trim.right);
      if (o.wreath) {
        const p = P(cx, y + d, h * 0.42);
        s += `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="5" fill="none" stroke="#2F8F6B" stroke-width="3"/>`;
      }
    }
    const nR = o.winR == null ? Math.max(1, Math.floor(d / 46)) : o.winR;
    for (let i = 0; i < nR; i++) {
      const cy = y + (d * (i + 0.5)) / nR;
      s += quad("R", x + w, cy - 8, cy + 8, h * 0.35, h * 0.72, mix(wall.right, NAVY, 0.45));
      s += quad("R", x + w, cy - 6, cy + 6, h * 0.38, h * 0.69, glass, lit ? 'class="iso-win"' : "");
    }
    // pan arrière, pan avant (neige)
    s += poly([P(x - ov, y - ov, eaveZ), P(x + w + ov, y - ov, eaveZ), P(x + w + ov, yc, h + rh), P(x - ov, yc, h + rh)], mix(roof, "#C7D5EA", 0.35));
    const front = [P(x - ov, y + d + ov, eaveZ), P(x + w + ov, y + d + ov, eaveZ), P(x + w + ov, yc, h + rh), P(x - ov, yc, h + rh)];
    s += poly(front, roof);
    // tranche du toit côté pignon + bord avant
    s += poly(
      [P(x + w + ov, y + d + ov, eaveZ), P(x + w + ov, yc, h + rh), P(x + w + ov, y - ov, eaveZ), P(x + w + ov, y - ov, eaveZ - t), P(x + w + ov, yc, h + rh - t), P(x + w + ov, y + d + ov, eaveZ - t)],
      trim.right,
    );
    s += poly([P(x - ov, y + d + ov, eaveZ), P(x + w + ov, y + d + ov, eaveZ), P(x + w + ov, y + d + ov, eaveZ - t), P(x - ov, y + d + ov, eaveZ - t)], trim.left);
    // stalactites
    const ic = rng(o.seed || 7);
    for (let i = 0; i < Math.floor(w / 14); i++) {
      const ix = x - ov + 8 + i * 14 + ic() * 6;
      const len = 4 + ic() * 9;
      const a = P(ix - 2, y + d + ov, eaveZ - t);
      const b = P(ix + 2, y + d + ov, eaveZ - t);
      const c = P(ix, y + d + ov, eaveZ - t - len);
      s += poly([a, b, c], "#DDE9F7", 'opacity="0.85"');
    }
    s += line([P(x - ov, yc, h + rh), P(x + w + ov, yc, h + rh)], "#FFFFFF", 1.5, 'opacity="0.8"');
    let chimneyTop = null;
    if (o.chimney !== false) {
      const cw = 16;
      const cxp = x + (o.chimneyAt == null ? w * 0.68 : o.chimneyAt);
      const cy0 = y + d * 0.62;
      const cy1 = cy0 + 14;
      const zr = (yy) => h + rh * (1 - Math.abs(yy - yc) / (d / 2));
      const top = h + rh + 24;
      const brick = shade(o.brick || "#9A4A3A");
      s += poly([P(cxp, cy1, zr(cy1)), P(cxp + cw, cy1, zr(cy1)), P(cxp + cw, cy1, top), P(cxp, cy1, top)], brick.left);
      s += poly([P(cxp + cw, cy0, zr(cy0)), P(cxp + cw, cy1, zr(cy1)), P(cxp + cw, cy1, top), P(cxp + cw, cy0, top)], brick.right);
      s += box(cxp - 2, cy0 - 2, top, cw + 4, cy1 - cy0 + 4, 5, "#E9EFF8", { shadow: false, edgeW: 1 });
      s += poly([P(cxp + 1, cy0 + 1, top + 5), P(cxp + cw - 1, cy0 + 1, top + 5), P(cxp + cw - 1, cy1 - 1, top + 5), P(cxp + 1, cy1 - 1, top + 5)], "#1A1A24");
      chimneyTop = [cxp + cw / 2, (cy0 + cy1) / 2, top + 5];
    }
    return { svg: s, chimneyTop };
  }

  // Sapin à étages. (x,y,z) = pied du tronc.
  function tree(x, y, z, h, r, opts) {
    const o = opts || {};
    const g = shade(o.color || "#2F8F6B");
    const tiers = o.tiers || 3;
    const base = P(x, y, z);
    let s = "";
    s += `<ellipse cx="${r1(base[0] - r * 0.4)}" cy="${r1(base[1] + 4)}" rx="${r1(r * 1.25)}" ry="${r1(r * 0.55)}" fill="rgba(11,22,48,0.16)"/>`;
    s += box(x - 3, y - 3, z, 6, 6, h * 0.16, "#6B4430", { shadow: false, edge: false });
    for (let i = 0; i < tiers; i++) {
      const tb = z + h * 0.14 + i * h * 0.22;
      const tt = tb + h * 0.46 - i * h * 0.04;
      const rr = r * (1 - i * 0.24);
      const rx = rr * 1.2247;
      const ry = rr * 0.7071;
      const c = P(x, y, tb);
      const ap = P(x, y, tt);
      s += `<path d="M${r1(ap[0])},${r1(ap[1])} L${r1(c[0] - rx)},${r1(c[1])} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(c[0])},${r1(c[1] + ry)} Z" fill="${g.left}"/>`;
      s += `<path d="M${r1(ap[0])},${r1(ap[1])} L${r1(c[0])},${r1(c[1] + ry)} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(c[0] + rx)},${r1(c[1])} Z" fill="${g.top}"/>`;
      if (o.snow !== false) {
        const k = 0.42;
        s += `<path d="M${r1(ap[0])},${r1(ap[1])} L${r1(ap[0] + (c[0] + rx - ap[0]) * k)},${r1(ap[1] + (c[1] - ap[1]) * k)} L${r1(ap[0] + (c[0] - ap[0]) * k * 0.9)},${r1(ap[1] + (c[1] + ry - ap[1]) * k * 0.95)} Z" fill="#F4F8FD" opacity="0.92"/>`;
      }
    }
    if (o.star) {
      const tp = P(x, y, z + h * 0.14 + (tiers - 1) * h * 0.22 + h * 0.46 - (tiers - 1) * h * 0.04 + 6);
      s += star(tp[0], tp[1], 8, "#FFC857");
    }
    return s;
  }

  function star(cx, cy, R, fill, extra) {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? R * 0.45 : R;
      p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return poly(p, fill, extra);
  }

  // Cadeau : cube + ruban + nœud. (x,y,z) coin arrière.
  function gift(x, y, z, s, color, ribbon, opts) {
    const o = opts || {};
    const h = o.h || s * 0.85;
    const rb = ribbon || "#FFC857";
    const rc = shade(rb);
    const k = Math.max(2, s * 0.14);
    let out = box(x, y, z, s, s, h, color, { shadow: o.shadow, edgeW: 1 });
    out += quad("L", y + s, x + s / 2 - k / 2, x + s / 2 + k / 2, z, z + h, rc.left);
    out += quad("R", x + s, y + s / 2 - k / 2, y + s / 2 + k / 2, z, z + h, rc.right);
    out += quad("T", z + h, x + s / 2 - k / 2, x + s / 2 + k / 2, y, y + s, rc.top);
    out += quad("T", z + h, x, x + s, y + s / 2 - k / 2, y + s / 2 + k / 2, rc.top);
    if (o.bow !== false) {
      const c = P(x + s / 2, y + s / 2, z + h);
      const bw = s * 0.26;
      out += `<ellipse cx="${r1(c[0] - bw * 0.7)}" cy="${r1(c[1] - bw * 0.35)}" rx="${r1(bw * 0.75)}" ry="${r1(bw * 0.45)}" fill="${rc.right}" transform="rotate(-18 ${r1(c[0])} ${r1(c[1])})"/>`;
      out += `<ellipse cx="${r1(c[0] + bw * 0.7)}" cy="${r1(c[1] - bw * 0.35)}" rx="${r1(bw * 0.75)}" ry="${r1(bw * 0.45)}" fill="${rc.top}" transform="rotate(18 ${r1(c[0])} ${r1(c[1])})"/>`;
      out += `<circle cx="${r1(c[0])}" cy="${r1(c[1] - bw * 0.2)}" r="${r1(bw * 0.3)}" fill="${rc.left}"/>`;
    }
    return out;
  }

  // Lutin dessiné en espace écran, pieds à (0,0). dir = 1 regarde à droite, -1 à gauche.
  function elf(dir, opts) {
    const o = opts || {};
    const coat = o.coat || "#2F8F6B";
    const hat = o.hat || "#E23D3D";
    const sx = dir < 0 ? -1 : 1;
    return `<g transform="scale(${sx},1)">
      <ellipse cx="0" cy="1" rx="11" ry="4" fill="rgba(11,22,48,0.25)"/>
      <rect x="-6" y="-12" width="4.5" height="12" rx="2" fill="#3B2A2A"/>
      <rect x="1.5" y="-12" width="4.5" height="12" rx="2" fill="#2A1E1E"/>
      <path d="M-9,-11 Q-10,-30 0,-31 Q10,-30 9,-11 Z" fill="${coat}"/>
      <path d="M-9,-11 Q-10,-30 0,-31 L0,-11 Z" fill="${mix(coat, NAVY, 0.3)}"/>
      <rect x="-9" y="-18" width="18" height="3.5" fill="#3B2A2A"/>
      <rect x="-2" y="-18.5" width="4" height="4.5" fill="#FFC857"/>
      <circle cx="0" cy="-37" r="7" fill="#F5C9A8"/>
      <path d="M6.5,-38 L11,-41 L7,-35 Z" fill="#F5C9A8"/>
      <circle cx="2.8" cy="-37.5" r="1.1" fill="#2A1E1E"/>
      <path d="M-7.5,-40 Q0,-47 7.5,-40 L1,-58 Z" fill="${hat}"/>
      <path d="M-7.5,-40 Q-2,-45 1,-58 Z" fill="${mix(hat, NAVY, 0.3)}"/>
      <rect x="-8" y="-42" width="16" height="3.5" rx="1.7" fill="#F4F7FB"/>
      <circle cx="1" cy="-58" r="3" fill="#F4F7FB"/>
    </g>`;
  }

  // Traîneau du Père Noël, profil (avance vers +u), patins au y=0.
  function sleigh() {
    return `<g>
      <path d="M-70,0 L60,0 Q84,0 86,-14 Q88,-24 80,-26" fill="none" stroke="#FFC857" stroke-width="5" stroke-linecap="round"/>
      <rect x="-50" y="-12" width="5" height="12" fill="#C99A2E"/><rect x="30" y="-12" width="5" height="12" fill="#C99A2E"/>
      <path d="M-74,-14 L58,-14 Q74,-14 76,-30 L78,-52 Q60,-48 54,-36 L-46,-36 Q-60,-64 -82,-60 Q-80,-30 -74,-14 Z" fill="#E23D3D"/>
      <path d="M-74,-14 L58,-14 Q74,-14 76,-30 L-70,-30 Z" fill="#B82C30"/>
      <path d="M-46,-36 L54,-36" stroke="#FFC857" stroke-width="3"/>
      <path d="M-82,-60 Q-60,-64 -46,-36" fill="none" stroke="#FFC857" stroke-width="3"/>
      <path d="M-40,-36 Q-44,-86 -6,-84 Q20,-84 18,-36 Z" fill="#8A5A3C"/>
      <path d="M-40,-36 Q-44,-86 -6,-84 L-12,-36 Z" fill="#6E4630"/>
      <rect x="-26" y="-92" width="18" height="14" fill="#2F8F6B"/><rect x="-19" y="-92" width="4" height="14" fill="#FFC857"/>
      <rect x="-8" y="-96" width="16" height="16" fill="#E23D3D"/><rect x="-2" y="-96" width="4" height="16" fill="#FFC857"/>
      <g class="santa">
        <path d="M18,-36 Q16,-74 38,-76 Q58,-74 56,-36 Z" fill="#E23D3D"/>
        <path d="M18,-36 Q16,-74 38,-76 L34,-36 Z" fill="#B82C30"/>
        <rect x="18" y="-50" width="38" height="6" fill="#2A1E1E"/><rect x="33" y="-51" width="8" height="8" fill="#FFC857"/>
        <circle cx="42" cy="-86" r="11" fill="#F5C9A8"/>
        <path d="M30,-84 Q34,-62 46,-62 Q58,-64 56,-82 Q50,-76 42,-77 Q34,-77 30,-84 Z" fill="#F4F7FB"/>
        <path d="M30,-90 Q38,-110 58,-104 Q66,-100 72,-88 L56,-92 Q46,-98 30,-90 Z" fill="#E23D3D"/>
        <circle cx="72" cy="-87" r="4.5" fill="#F4F7FB"/>
        <rect x="28" y="-94" width="30" height="7" rx="3.5" fill="#F4F7FB"/>
        <path d="M54,-60 Q72,-56 84,-50" fill="none" stroke="#B82C30" stroke-width="8" stroke-linecap="round"/>
      </g>
    </g>`;
  }

  // Renne, profil vers +u. Les pattes sont dans des groupes .leg-a / .leg-b pour le galop.
  function reindeer(nose) {
    return `<g>
      <g class="leg-b"><path d="M-14,-24 L-20,0" stroke="#5E3B26" stroke-width="5" stroke-linecap="round"/><path d="M16,-24 L22,0" stroke="#5E3B26" stroke-width="5" stroke-linecap="round"/></g>
      <path d="M-24,-26 Q-26,-46 0,-46 L22,-46 Q34,-46 34,-32 Q32,-22 18,-22 L-14,-22 Q-24,-22 -24,-26 Z" fill="#9C6B45"/>
      <path d="M-24,-26 Q-22,-22 -14,-22 L18,-22 Q30,-22 33,-30 L-22,-32 Z" fill="#7C5134"/>
      <path d="M-14,-40 Q-6,-34 10,-36" fill="none" stroke="#E9D6BF" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <path d="M24,-44 L34,-64 Q38,-70 46,-68 L52,-62 Q56,-56 50,-54 L40,-56 L32,-38 Z" fill="#9C6B45"/>
      <path d="M38,-68 L32,-84 M34,-78 L26,-82 M36,-74 L42,-86" stroke="#D9B98A" stroke-width="3" stroke-linecap="round" fill="none"/>
      <circle cx="45" cy="-63" r="1.6" fill="#2A1E1E"/>
      <circle cx="${nose ? 54 : 53}" cy="-56" r="${nose ? 4.5 : 3}" fill="${nose ? "#FF4B3E" : "#3B2A2A"}"/>
      <path d="M-24,-34 L-32,-40" stroke="#E9D6BF" stroke-width="4" stroke-linecap="round"/>
      <g class="leg-a"><path d="M-8,-24 L-2,0" stroke="#7C5134" stroke-width="5" stroke-linecap="round"/><path d="M22,-24 L14,0" stroke="#7C5134" stroke-width="5" stroke-linecap="round"/></g>
      <path d="M-20,-42 L-74,-40" stroke="#C99A2E" stroke-width="2" opacity="0.8"/>
    </g>`;
  }

  // Matrice de profil : dessin 2D (u vers l'avant, y SVG vers le bas) posé sur le plan vertical
  // qui avance le long de -y (vers le haut-droite à l'écran) ou de +x (vers le bas-droite).
  function profileMatrix(dir, sx, sy) {
    if (dir === "up-right") return `matrix(${C},${-S},0,1,${r1(sx)},${r1(sy)})`;
    return `matrix(${C},${S},0,1,${r1(sx)},${r1(sy)})`;
  }

  // ---------- neige ----------
  // Retourne { svg, update(t) } : n flocons dans [x0,x1]×[y0,y1] en espace écran.
  function snowfall(prefix, n, seed, x0, y0, x1, y1) {
    const R = rng(seed);
    const flakes = [];
    let svg = `<g id="${prefix}-snow">`;
    for (let i = 0; i < n; i++) {
      const f = { x: x0 + R() * (x1 - x0), y: y0 + R() * (y1 - y0), r: 1.2 + R() * 2.6, v: 40 + R() * 70, sw: 8 + R() * 18, ph: R() * 6.28 };
      f.o = 0.45 + (f.r / 3.8) * 0.5;
      flakes.push(f);
      svg += `<circle id="${prefix}-f${i}" r="${r1(f.r)}" fill="#FFFFFF" opacity="${f.o.toFixed(2)}"/>`;
    }
    svg += "</g>";
    const H = y1 - y0;
    let els = null;
    function update(t) {
      if (!els) els = flakes.map((_, i) => document.getElementById(`${prefix}-f${i}`));
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        if (!els[i]) continue;
        const yy = y0 + ((((f.y - y0 + f.v * t) % H) + H) % H);
        const xx = f.x + Math.sin(f.ph + t * 1.3) * f.sw;
        els[i].setAttribute("cx", r1(xx));
        els[i].setAttribute("cy", r1(yy));
      }
    }
    return { svg, update };
  }

  // ---------- caméra par viewBox ----------
  // cam = { x, y, s } : centre monde (px) et zoom. Les ancres HTML suivent la caméra.
  function camera(svg, init) {
    const cam = Object.assign({ x: 0, y: 0, s: 1 }, init || {});
    const anchors = [];
    function apply() {
      const w = 1920 / cam.s;
      const h = 1080 / cam.s;
      svg.setAttribute("viewBox", `${(cam.x - w / 2).toFixed(3)} ${(cam.y - h / 2).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
      for (const a of anchors) {
        const sx = (a.wx - cam.x) * cam.s + 960;
        const sy = (a.wy - cam.y) * cam.s + 540;
        a.el.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`;
      }
    }
    function anchor(el, wx, wy) {
      anchors.push({ el, wx, wy });
    }
    apply();
    return { cam, apply, anchor };
  }

  // Dégradés partagés (un jeu par scène, ids préfixés).
  function defs(p) {
    return `<defs>
      <radialGradient id="${p}-glow"><stop offset="0" stop-color="#FFC857" stop-opacity="0.75"/><stop offset="0.45" stop-color="#FFB347" stop-opacity="0.22"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}-redglow"><stop offset="0" stop-color="#E23D3D" stop-opacity="0.6"/><stop offset="1" stop-color="#E23D3D" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}-white"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    </defs>`;
  }

  window.ISO = { C, S, NAVY, P, pts, poly, line, mix, shade, rng, box, quad, planeTop, planeLeft, planeRight, island, house, tree, star, gift, elf, sleigh, reindeer, profileMatrix, snowfall, camera, defs, r1 };
})();
