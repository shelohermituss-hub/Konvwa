// rbx.js: tiny deterministic engine for Roblox-style story shorts (9:16, 1080x1920). See API.md.
// A scene file imports this module, declares everything up front (avatars, sets, keys, shots, captions),
// then the runtime calls renderAt(t) for every frame. No clocks, no Math.random: same t = same frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

export { THREE };
export const W = 1080, H = 1920;
const D2R = Math.PI / 180;
const ENGINE_URL = new URL('./', import.meta.url);

// ---------------------------------------------------------------- state
const S = {
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(50, W / H, 0.1, 400),
  avatars: [], shots: [], shakes: [], flashes: [], lines: [], frameFns: [], captions: [], loads: [],
  duration: 0, videoUrl: null, light: null, faceCache: new Map(), fades: [],
};
export const scene = S.scene, camera = S.camera;

// deterministic rng
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const EASE = { linear: clamp, smooth, inOut: easeInOut, in: x => clamp(x) ** 2, out: x => 1 - (1 - clamp(x)) ** 2 };
const lerp = (a, b, w) => a + (b - a) * w;
const col = c => new THREE.Color(c);

// ---------------------------------------------------------------- textures (canvas)
const texCache = new Map();
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  const k = key + repeat.join('x');
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 8;
  texCache.set(k, t); return t;
}
function speckle(g, w, h, base, n, cols, size = 2, seed = 7) {
  g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rng(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = .35 + r() * .5; g.fillRect(r() * w, r() * h, size, size); }
  g.globalAlpha = 1;
}
export const TEX = {
  carpet: (rep, base = '#c9bfae') => canvasTex('carpet' + base, 256, 256, (g, w, h) => speckle(g, w, h, base, 9000, ['#ffffff', '#8d8475', '#b3a893', '#e2dccd'], 2, 3), rep),
  wood: (rep, base = '#7a4a2a') => canvasTex('wood' + base, 512, 512, (g, w, h) => {
    const r = rng(11), b = col(base);
    for (let i = 0; i < 8; i++) { const k = .85 + r() * .25; g.fillStyle = `rgb(${b.r * 255 * k | 0},${b.g * 255 * k | 0},${b.b * 255 * k | 0})`; g.fillRect(0, i * h / 8, w, h / 8);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * h / 8, w, 3); g.fillRect(((i * 0.37) % 1) * w, i * h / 8, 3, h / 8);
      for (let j = 0; j < 40; j++) { g.fillStyle = `rgba(0,0,0,${r() * .08})`; g.fillRect(0, i * h / 8 + r() * h / 8, w, 1 + r() * 2); } }
  }, rep),
  tile: (rep, a = '#f3f5f8', b = '#9fb8d8') => canvasTex('tile' + a + b, 256, 256, (g, w, h) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * w / 2, y * h / 2, w / 2, h / 2); }
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); }
  }, rep),
  grass: (rep) => canvasTex('grass', 256, 256, (g, w, h) => speckle(g, w, h, '#5e9a3c', 7000, ['#4d8530', '#74b04c', '#3f7426', '#86c25a'], 3, 5), rep),
  concrete: (rep) => canvasTex('concrete', 256, 256, (g, w, h) => { speckle(g, w, h, '#b9b9b4', 5000, ['#a5a5a0', '#cfcfca', '#9a9a95'], 2, 9); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }, rep),
  brick: (rep) => canvasTex('brick', 256, 256, (g, w, h) => {
    g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, w, h); const r = rng(4), bh = h / 8;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) { const k = .85 + r() * .25; g.fillStyle = `rgb(${170 * k | 0},${74 * k | 0},${52 * k | 0})`; g.fillRect(x * w / 4 + (y % 2) * w / 8 + 3, y * bh + 3, w / 4 - 6, bh - 6); }
  }, rep),
  wall: (rep, base = '#e8e2d6') => canvasTex('wall' + base, 128, 128, (g, w, h) => speckle(g, w, h, base, 900, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.2)'], 2, 13), rep),
  ceiling: (rep) => canvasTex('ceil', 256, 256, (g, w, h) => { speckle(g, w, h, '#ecebe6', 3000, ['#d6d5cf', '#f8f8f4'], 2, 17); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }, rep),
  sky: (night) => canvasTex('sky' + !!night, 64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (night) { gr.addColorStop(0, '#060b24'); gr.addColorStop(1, '#1b2b5c'); } else { gr.addColorStop(0, '#3d8ff0'); gr.addColorStop(.7, '#9ccaf7'); gr.addColorStop(1, '#dcedfb'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (night) { const r = rng(2); g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h * .7, 1, 1); }
    else { g.fillStyle = 'rgba(255,255,255,.85)'; const r = rng(5); for (let i = 0; i < 5; i++) { const x = r() * w, y = 40 + r() * 120; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(x + j * 5, y + (j % 2) * 3, 9, 5, 0, 0, 7); g.fill(); } } }
  }),
  vents: (base) => canvasTex('vents' + base, 128, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.45)';
    for (let i = 0; i < 6; i++) g.fillRect(w * .2, h * .06 + i * 14, w * .6, 6);
    for (let i = 0; i < 6; i++) g.fillRect(w * .2, h * .78 + i * 14, w * .6, 6);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(w * .72, h * .45, w * .08, h * .1); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  }),
};

// ---------------------------------------------------------------- materials / mesh helpers
const matCache = new Map();
export function mat(color, o = {}) {
  const k = JSON.stringify([color, o.rough, o.metal, o.emissive, o.map && o.map.uuid, o.ei]);
  if (!o.noCache && matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color: col(color), roughness: o.rough ?? .55, metalness: o.metal ?? 0, map: o.map || null,
    emissive: o.emissive ? col(o.emissive) : col(0), emissiveIntensity: o.ei ?? 1 });
  matCache.set(k, m); return m;
}
const geoCache = new Map();
function rbox(w, h, d, r = .08) { const k = [w, h, d, r].join(); if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001))); return geoCache.get(k); }
/** box(w,h,d,color|material,[x,y,z],{r, rotY, map, shadow}) -> mesh, y = bottom of the box */
export function box(w, h, d, c, p = [0, 0, 0], o = {}) {
  const g = o.r ? rbox(w, h, d, o.r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, c && c.isMaterial ? c : mat(c ?? '#ccc', o));
  m.position.set(p[0], p[1] + h / 2, p[2]); if (o.rotY) m.rotation.y = o.rotY * D2R;
  m.castShadow = o.cast ?? true; m.receiveShadow = true; (o.parent || S.scene).add(m); return m;
}
function cyl(rt, rb, h, c, p, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20), c && c.isMaterial ? c : mat(c, o));
  m.position.set(p[0], p[1] + h / 2, p[2]); m.castShadow = true; m.receiveShadow = true; (o.parent || S.scene).add(m); return m;
}
function ball(r, c, p, o = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), c && c.isMaterial ? c : mat(c, o));
  m.position.set(p[0], p[1], p[2]); m.castShadow = true; m.receiveShadow = true; (o.parent || S.scene).add(m); return m;
}
function plane(w, h, material, p, rot = [0, 0, 0], parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.position.set(...p); m.rotation.set(rot[0] * D2R, rot[1] * D2R, rot[2] * D2R);
  m.receiveShadow = true; (parent || S.scene).add(m); return m;
}

// ---------------------------------------------------------------- faces
export const FACE_NAMES = ['smile', 'happy', 'grin', 'smug', 'worried', 'scared', 'shocked', 'cry', 'sob', 'angry', 'furious', 'sad', 'sleepy', 'neutral', 'surprised', 'evil', 'monster'];
function placeholderFace(name) {
  return canvasTex('face_' + name, 256, 256, (g) => {
    g.clearRect(0, 0, 256, 256); g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineWidth = 12; g.lineCap = 'round';
    const big = /scared|shocked|surprised|worried/.test(name);
    g.beginPath(); g.ellipse(88, 105, big ? 18 : 12, big ? 26 : 20, 0, 0, 7); g.ellipse(168, 105, big ? 18 : 12, big ? 26 : 20, 0, 0, 7); g.fill();
    g.beginPath();
    if (/sad|cry|sob|worried/.test(name)) g.arc(128, 200, 40, Math.PI * 1.15, Math.PI * 1.85);
    else if (/shocked|scared|surprised/.test(name)) { g.ellipse(128, 180, 22, 30, 0, 0, 7); g.fill(); }
    else if (/angry|furious|evil/.test(name)) { g.moveTo(60, 70); g.lineTo(110, 88); g.moveTo(196, 70); g.lineTo(146, 88); g.moveTo(95, 185); g.lineTo(161, 185); }
    else if (/neutral|sleepy/.test(name)) { g.moveTo(98, 180); g.lineTo(158, 180); }
    else g.arc(128, 140, 50, Math.PI * .2, Math.PI * .8);
    g.stroke();
  });
}
function loadFace(name) {
  if (S.faceCache.has(name)) return S.faceCache.get(name);
  const entry = { tex: placeholderFace(name) }; S.faceCache.set(name, entry);
  S.loads.push(new Promise(res => new THREE.TextureLoader().load(new URL(`faces/${name}.png`, ENGINE_URL).href,
    t => { t.colorSpace = THREE.SRGBColorSpace; let an = 16; try { if (renderer) an = renderer.capabilities.getMaxAnisotropy(); } catch (e) {} t.anisotropy = an;
      t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.premultiplyAlpha = true;
      entry.tex = t; res(); }, undefined, () => { console.warn('face missing, placeholder:', name); res(); })));
  return entry;
}

// ---------------------------------------------------------------- poses (R6)
// each pose(t, lt) -> joint angles (radians). la/ra/ll/rl/hd = [x,y,z] rotations; by = body drop, bx/bz = torso tilt about the hips,
// tilt/lift = whole-body tip about the feet (faint). Avatar faces +z; arm rot.x < 0 swings forward; +z moves the left (+x) arm out.
const Z3 = [0, 0, 0];
const P = {
  idle: (t) => ({ la: [.04 * Math.sin(t * 1.7), 0, .05], ra: [-.04 * Math.sin(t * 1.7), 0, -.05], hd: [0, .04 * Math.sin(t * .7), 0] }),
  talk: (t) => ({ la: [-.15 + .12 * Math.sin(t * 3.1), 0, .12], ra: [-.35 + .2 * Math.sin(t * 2.3 + 1), 0, -.15], hd: [.04 * Math.sin(t * 4), .08 * Math.sin(t * 1.3), 0] }),
  walk: (t) => { const s = Math.sin(t * Math.PI * 2 * 1.6), A = .8; return { la: [A * s, 0, .03], ra: [-A * s, 0, -.03], ll: [-A * s, 0, 0], rl: [A * s, 0, 0], by: .05 * Math.abs(Math.sin(t * Math.PI * 2 * 1.6)) }; },
  run: (t) => { const s = Math.sin(t * Math.PI * 2 * 2.4), A = 1.15; return { la: [A * s, 0, .05], ra: [-A * s, 0, -.05], ll: [-A * s, 0, 0], rl: [A * s, 0, 0], bx: .12, by: .1 * Math.abs(Math.sin(t * Math.PI * 2 * 2.4)) }; },
  jump: () => ({ la: [-2.9, 0, .15], ra: [-2.9, 0, -.15], ll: [-.25, 0, 0], rl: [.15, 0, 0] }),
  float: (t) => ({ la: [-.25 + .15 * Math.sin(t * 1.3), 0, .55 + .12 * Math.sin(t * 1.1)], ra: [-.25 + .15 * Math.sin(t * 1.3 + 2), 0, -.55 - .12 * Math.sin(t * 1.1 + 1)],
    ll: [.25 * Math.sin(t * 1.2), 0, .06], rl: [-.22 * Math.sin(t * 1.2 + 1), 0, -.06], by: .15 * Math.sin(t * 1.7), hd: [-.08, 0, .05 * Math.sin(t)] }),
  fall: (t) => ({ la: [-2.7 + .45 * Math.sin(t * 9), 0, .4], ra: [-2.7 + .45 * Math.sin(t * 9 + 2), 0, -.4], ll: [.5 * Math.sin(t * 8), 0, .2], rl: [-.5 * Math.sin(t * 8), 0, -.2], hd: [-.2, 0, 0] }),
  flail: (t) => ({ la: [-1.5 + 1.2 * Math.sin(t * 13), 0, .5], ra: [-1.5 + 1.2 * Math.sin(t * 13 + Math.PI), 0, -.5], ll: [.35 * Math.sin(t * 11), 0, .1], rl: [-.35 * Math.sin(t * 11), 0, -.1], hd: [0, 0, .15 * Math.sin(t * 7)] }),
  sit: () => ({ la: [-.35, 0, .05], ra: [-.35, 0, -.05], ll: [-1.5708, 0, .04], rl: [-1.5708, 0, -.04], by: -.5 }),
  crouch: () => ({ la: [-.9, 0, .1], ra: [-.9, 0, -.1], ll: [-.75, 0, .08], rl: [.35, 0, -.08], bx: .3, by: -.55, hd: [-.25, 0, 0] }),
  point: (t) => ({ la: [.03 * Math.sin(t * 1.7), 0, .05], ra: [-1.55, 0, -.05], hd: [0, 0, 0] }),
  armsUp: (t) => ({ la: [-2.95, 0, .2 + .05 * Math.sin(t * 6)], ra: [-2.95, 0, -.2 - .05 * Math.sin(t * 6)] }),
  faint: (t, lt) => { const k = EASE.in(lt / .45); return { la: [0, 0, .4 * k], ra: [0, 0, -.4 * k], ll: [0, 0, .08 * k], rl: [0, 0, -.08 * k], tilt: -1.5708 * k, lift: .5 * k }; },
  lie: () => ({ la: [0, 0, .15], ra: [0, 0, -.15], tilt: -1.5708, lift: .5 }),
  hug: () => ({ la: [-1.35, 0, -.4], ra: [-1.35, 0, .4], hd: [.1, 0, 0] }),
  cry: (t) => ({ la: [-2.2, 0, -.55], ra: [-2.2, 0, .55], hd: [.35, 0, 0], by: .03 * Math.sin(t * 14), bx: .1 }),
  wave: (t) => ({ la: [.03 * Math.sin(t * 1.7), 0, .05], ra: [-.15, 0, -2.5 + .35 * Math.sin(t * 9)], hd: [0, 0, .06] }),
  shove: (t, lt) => { const k = EASE.out(lt / .18); return { la: [lerp(-.5, -1.6, k), 0, -.1], ra: [lerp(-.5, -1.6, k), 0, .1], ll: [-.3 * k, 0, 0], rl: [.3 * k, 0, 0], bx: .2 * k }; },
  scared: (t) => ({ la: [-1.9, 0, -.35], ra: [-1.9, 0, .35], ll: [0, 0, .12], rl: [0, 0, -.12], bx: -.14, by: .02 * Math.sin(t * 38), hd: [-.1, 0, .03 * Math.sin(t * 30)] }),
  shrug: () => ({ la: [-.4, 0, .9], ra: [-.4, 0, -.9], hd: [0, 0, .15] }),
  facepalm: () => ({ la: [.03, 0, .05], ra: [-2.4, 0, .5], hd: [.3, 0, 0] }),
  sleep: (t) => ({ la: [-.2, 0, .05], ra: [-.2, 0, -.05], hd: [.45, 0, .25], by: .03 * Math.sin(t * 2) }),
};
export const POSES = Object.keys(P);
const JOINTS = ['la', 'ra', 'll', 'rl', 'hd'];
function evalPose(name, t, lt) {
  const p = (P[name] || P.idle)(t, lt);
  const o = { by: p.by || 0, bx: p.bx || 0, bz: p.bz || 0, tilt: p.tilt || 0, lift: p.lift || 0 };
  for (const j of JOINTS) o[j] = p[j] || Z3; return o;
}
function mixPose(a, b, w) {
  const o = {}; for (const k of ['by', 'bx', 'bz', 'tilt', 'lift']) o[k] = lerp(a[k], b[k], w);
  for (const j of JOINTS) o[j] = [0, 1, 2].map(i => lerp(a[j][i], b[j][i], w)); return o;
}

// ---------------------------------------------------------------- hair / hats (built in head space; head is 1.25 x 1.2 x 1.2 centred on 0)
function buildHair(kind, color, g, hatColor) {
  const m = mat(color, { rough: .7 }), hm = mat(hatColor || color, { rough: .6 });
  const r = rng(kind.length * 31 + 7);
  const cap = (h = .42, y = .48, ext = .08) => box(1.25 + ext * 2, h, 1.2 + ext * 2, m, [0, y, -.02], { r: .18, parent: g });
  if (kind === 'bald') return;
  if (kind === 'messy') { cap(); for (let i = 0; i < 9; i++) { const b = box(.42, .3, .42, m, [(r() - .5) * 1.1, .72 + r() * .1, (r() - .5) * 1.0], { r: .1, parent: g }); b.rotation.set((r() - .5) * .8, r() * 3, (r() - .5) * .8); }
    for (let i = 0; i < 4; i++) { const b = box(.34, .32, .2, m, [-.45 + i * .3, .4, .62], { r: .08, parent: g }); b.rotation.set(-.3, 0, (r() - .5) * .6); }
    box(1.33, .7, .3, m, [0, -.05, -.55], { r: .12, parent: g }); }
  if (kind === 'spiky') { cap(.36, .5); for (let i = 0; i < 11; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.22, .62, 4), m); const a = i / 11 * Math.PI * 2;
    c.position.set(Math.cos(a) * .42 * (i % 2 ? 1 : .5), .95, Math.sin(a) * .4 * (i % 2 ? 1 : .5)); c.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); c.castShadow = true; g.add(c); } }
  if (kind === 'bun') { cap(.38, .5); ball(.33, m, [0, .82, -.42], { parent: g }); box(1.33, .55, .25, m, [0, .05, -.56], { r: .1, parent: g }); }
  if (kind === 'long') { cap(.4, .5); box(1.38, 1.5, .32, m, [0, -.65, -.52], { r: .14, parent: g }); box(.22, 1.3, .9, m, [.7, -.5, -.08], { r: .08, parent: g }); box(.22, 1.3, .9, m, [-.7, -.5, -.08], { r: .08, parent: g });
    box(1.3, .25, .2, m, [0, .38, .6], { r: .08, parent: g }); }
  if (kind === 'curly') { for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, rr = .25 + r() * .45; ball(.17 + r() * .06, m, [Math.cos(a) * rr * 1.1, .6 + r() * .25, Math.sin(a) * rr - .1], { parent: g }); }
    for (let i = 0; i < 8; i++) ball(.17, m, [(i - 3.5) * .17, .32 + r() * .1, -.62], { parent: g }); }
  if (kind === 'cap') { cyl(.68, .7, .42, hm, [0, .42, 0], { parent: g }); ball(.66, hm, [0, .8, 0], { parent: g }).scale.set(1, .35, 1); box(1.0, .07, .65, hm, [0, .42, .75], { r: .03, parent: g }); box(1.2, .3, .3, m, [0, .2, -.5], { r: .1, parent: g }); }
  if (kind === 'fedora') { cyl(.95, .95, .06, hm, [0, .5, 0], { seg: 28, parent: g }); cyl(.55, .64, .62, hm, [0, .54, 0], { parent: g }); cyl(.65, .65, .14, '#c9222a', [0, .56, 0], { parent: g }); }
  if (HAIR_EXTRA[kind]) HAIR_EXTRA[kind]({ g, m, hm, r, cap });
}
// 2026-10-31 (engine generality): more hair / hats. Built in head space (head 1.25 x 1.2 x 1.2 centred on 0, face at z +.6).
const HAIR_EXTRA = {
  pigtails: ({ g, m, cap }) => { cap(.4, .5); box(1.33, .5, .25, m, [0, .05, -.56], { r: .1, parent: g });
    for (const s of [1, -1]) { ball(.3, m, [s * .86, .25, -.2], { parent: g }); box(.34, .95, .34, m, [s * .9, -.75, -.22], { r: .15, parent: g }); } },
  ponytail: ({ g, m, cap }) => { cap(.4, .5); box(1.33, .5, .25, m, [0, .05, -.56], { r: .1, parent: g }); const t = box(.38, 1.2, .38, m, [0, -.75, -.82], { r: .16, parent: g }); t.rotation.x = .25; },
  quiff: ({ g, m, cap }) => { cap(.34, .5); const a = box(1.15, .5, .7, m, [0, .78, .18], { r: .2, parent: g }); a.rotation.x = -.45;
    const b = box(.9, .35, .5, m, [.1, 1.02, .42], { r: .15, parent: g }); b.rotation.set(-.7, 0, -.15); box(1.33, .6, .25, m, [0, -.05, -.56], { r: .1, parent: g }); },
  afro: ({ g, m }) => { ball(.98, m, [0, .5, -.18], { parent: g }).scale.set(1.05, .82, 1); },
  mohawk: ({ g, m, cap }) => { cap(.12, .54, .02); for (let i = 0; i < 6; i++) box(.24, .55 - Math.abs(i - 2.5) * .06, .26, m, [0, .72, .45 - i * .2], { r: .06, parent: g }); },
  buzz: ({ cap }) => { cap(.2, .52, .03); },
  tophat: ({ g, hm }) => { cyl(1.0, 1.0, .07, hm, [0, .52, 0], { seg: 28, parent: g }); cyl(.6, .6, 1.35, hm, [0, .56, 0], { parent: g }); cyl(.62, .62, .2, '#c9222a', [0, .6, 0], { parent: g }); },
  cowboy: ({ g, hm }) => { const b = cyl(1.25, 1.25, .07, hm, [0, .48, 0], { seg: 28, parent: g }); b.scale.set(1, 1, .85); cyl(.58, .66, .7, hm, [0, .52, 0], { parent: g }); cyl(.67, .67, .12, '#5a3418', [0, .56, 0], { parent: g }); },
  beanie: ({ g, hm }) => { box(1.38, .62, 1.32, hm, [0, .3, -.02], { r: .26, parent: g }); box(1.44, .24, 1.38, hm, [0, .26, -.02], { r: .1, parent: g }); ball(.2, '#ffffff', [0, 1.02, 0], { parent: g }); },
  hood: ({ g, hm }) => { box(1.5, .32, 1.42, hm, [0, .5, -.08], { r: .14, parent: g }); for (const s of [1, -1]) box(.16, 1.25, 1.3, hm, [s * .72, -.62, -.08], { r: .07, parent: g });
    box(1.5, 1.35, .18, hm, [0, -.75, -.7], { r: .08, parent: g }); },
  helmet: ({ g, hm }) => { box(1.46, .78, 1.42, hm, [0, .1, -.04], { r: .36, parent: g }); box(1.3, .12, .3, '#222', [0, .3, .62], { parent: g }); },
  chef: ({ g }) => { cyl(.66, .66, .4, '#ffffff', [0, .45, 0], { parent: g }); ball(.78, '#ffffff', [0, 1.2, 0], { parent: g }).scale.set(1, .6, 1); },
  party: ({ g, hm }) => { const c = new THREE.Mesh(new THREE.ConeGeometry(.45, 1.2, 16), mat(hm.color.getStyle ? '#' + hm.color.getHexString() : '#e8467c')); c.position.set(.1, 1.15, 0); c.rotation.z = -.15; c.castShadow = true; g.add(c); ball(.14, '#ffffff', [.19, 1.75, 0], { parent: g }); },
  crown: ({ g, m, cap }) => { cap(); crownMesh(g, .62); },
  long_straight: ({ g, m, cap }) => { cap(.4, .5); box(1.38, 2.0, .3, m, [0, -1.15, -.52], { r: .12, parent: g }); for (const s of [1, -1]) box(.2, 1.9, .9, m, [s * .7, -1.05, -.08], { r: .08, parent: g }); },
};
function crownMesh(g, y) { const gold = mat('#f2c21a', { metal: .6, rough: .3 }); cyl(.62, .62, .35, gold, [0, y, 0], { parent: g });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(.14, .38, 4), gold); c.position.set(Math.cos(a) * .55, y + .52, Math.sin(a) * .55); g.add(c); } }
// accessories: avatar({ accessory: 'glasses' | ['beard', { kind: 'cape', color: '#c00' }] }). head = head space, body = hips space (torso y 0..2, front z +.5)
const ACCESSORIES = {
  glasses: (a, c) => box(1.0, .08, .05, c || '#111', [0, .02, .63], { parent: a.head }),
  sunglasses: (a, c) => { const k = mat(c || '#111', { rough: .2, metal: .3 }); box(.46, .3, .06, k, [.27, -.06, .63], { parent: a.head, r: .06 }); box(.46, .3, .06, k, [-.27, -.06, .63], { parent: a.head, r: .06 }); box(1.2, .07, .05, k, [0, .2, .63], { parent: a.head }); },
  beard: (a, c) => { const k = mat(c || a.o.hairColor || '#3b2416', { rough: .8 }); box(1.32, .5, .4, k, [0, -.82, .45], { parent: a.head, r: .14 }); for (const s of [1, -1]) box(.18, .7, .9, k, [s * .62, -.6, .15], { parent: a.head, r: .06 }); box(.62, .14, .06, k, [0, -.22, .63], { parent: a.head, r: .04 }); },
  moustache: (a, c) => box(.62, .14, .06, c || a.o.hairColor || '#3b2416', [0, -.22, .63], { parent: a.head, r: .04 }),
  mask: (a, c) => { box(1.3, .62, .1, c || '#e9f1f7', [0, -.62, .6], { parent: a.head, cast: false }); box(1.3, .06, .12, '#b9c7d2', [0, -.05, .6], { parent: a.head, cast: false }); },
  headphones: (a, c) => { const k = c || '#222'; box(1.5, .16, .3, k, [0, .62, 0], { parent: a.head, r: .06 }); for (const s of [1, -1]) { box(.12, .9, .3, k, [s * .74, -.1, 0], { parent: a.head }); box(.24, .55, .55, k, [s * .72, -.45, 0], { parent: a.head, r: .12 }); } },
  crown: (a) => crownMesh(a.head, .6),
  halo: (a) => { const t = new THREE.Mesh(new THREE.TorusGeometry(.55, .07, 8, 28), mat('#ffe680', { emissive: '#ffd84a', ei: 1.2 })); t.rotation.x = Math.PI / 2; t.position.y = 1.15; a.head.add(t); },
  horns: (a, c) => { for (const s of [1, -1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 10), mat(c || '#c9241e')); h.position.set(s * .42, .82, 0); h.rotation.z = -s * .35; a.head.add(h); } },
  backpack: (a, c) => { box(1.6, 1.7, .6, c || '#d14a2b', [0, .3, -.8], { parent: a.body, r: .18 }); box(1.2, .7, .25, c || '#d14a2b', [0, .45, -1.15], { parent: a.body, r: .1 }); },
  cape: (a, c) => box(2.0, 3.4, .1, mat(c || '#c9241e', { rough: .7 }), [0, -1.3, -.6], { parent: a.body, cast: true }),
  scarf: (a, c) => { box(2.1, .4, 1.15, c || '#c9241e', [0, 1.72, 0], { parent: a.body, r: .12 }); box(.4, 1.1, .12, c || '#c9241e', [.5, .7, .55], { parent: a.body, r: .06 }); },
  bowtie: (a, c) => { box(.3, .25, .12, c || '#c9241e', [.17, 1.68, .52], { parent: a.body }); box(.3, .25, .12, c || '#c9241e', [-.17, 1.68, .52], { parent: a.body }); },
  necklace: (a, c) => { box(1.2, .08, .05, c || '#f2c21a', [0, 1.6, .51], { parent: a.body }); ball(.12, c || '#f2c21a', [0, 1.45, .55], { parent: a.body }); },
  tail: (a, c) => { const t = box(.3, .3, 1.6, c || a.o.hairColor || '#8a5a34', [0, .5, -1.2], { parent: a.body, r: .12 }); t.rotation.x = -.4; },
  wings: (a, c) => { for (const s of [1, -1]) { const w = box(.12, 2.2, 1.6, mat(c || '#ffffff', { rough: .8 }), [s * .7, .1, -1.1], { parent: a.body, r: .1 }); w.rotation.set(.2, s * .5, s * .35); } },
};
export const HAIR_NAMES = ['bald', 'messy', 'spiky', 'bun', 'long', 'curly', 'cap', 'fedora', ...Object.keys(HAIR_EXTRA)];
export const ACCESSORY_NAMES = Object.keys(ACCESSORIES);

// ---------------------------------------------------------------- avatar
const SHIRT_PATTERNS = {
  plain: () => null,
  stripes: (c) => canvasTex('stripes' + c, 64, 64, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 4, w, 7); }),
  hoodie: (c) => canvasTex('hoodie' + c, 128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(24, 76, 80, 34);
    g.strokeStyle = '#eee'; g.lineWidth = 4; g.beginPath(); g.moveTo(54, 6); g.lineTo(50, 52); g.moveTo(74, 6); g.lineTo(78, 52); g.stroke(); }),
  suit: (c) => canvasTex('suit' + c, 128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(64, 70); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(58, 8); g.lineTo(70, 8); g.lineTo(68, 64); g.lineTo(64, 72); g.lineTo(60, 64); g.fill(); }),
  tie: (c) => canvasTex('tie' + c, 128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#b81d24'; g.beginPath(); g.moveTo(58, 4); g.lineTo(70, 4); g.lineTo(72, 80); g.lineTo(64, 92); g.lineTo(56, 80); g.fill(); }),
  logo: (c) => canvasTex('logo' + c, 128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.beginPath(); g.moveTo(70, 30); g.lineTo(52, 66); g.lineTo(66, 66); g.lineTo(58, 98); g.lineTo(80, 56); g.lineTo(66, 56); g.lineTo(74, 30); g.fill(); }),
  torn: (c) => canvasTex('torn' + c, 128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.85)'; g.beginPath(); g.moveTo(0, 104); for (let x = 0; x <= 128; x += 16) g.lineTo(x, 100 + (x % 32 ? 14 : -4)); g.lineTo(128, 128); g.lineTo(0, 128); g.fill(); }),
  // text print: shirt: { color, text: 'I LIED', textColor: '#fff' } (up to ~3 short lines; '\n' breaks)
  text: (c, s = {}) => canvasTex('shirttext' + c + s.text + s.textColor, 256, 256, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h);
    const ls = String(s.text || '').toUpperCase().split('\n'); let fs = 92; g.font = `900 ${fs}px Nunito, sans-serif`;
    const widest = () => Math.max(...ls.map(l => g.measureText(l).width)); while (fs > 20 && (widest() > w * .84 || ls.length * fs * 1.0 > h * .7)) { fs -= 4; g.font = `900 ${fs}px Nunito, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = fs * .14; g.strokeStyle = s.textOutline || 'rgba(0,0,0,.55)'; g.fillStyle = s.textColor || '#ffffff';
    ls.forEach((l, i) => { const y = h * .46 + (i - (ls.length - 1) / 2) * fs * 1.0; g.strokeText(l, w / 2, y); g.fillText(l, w / 2, y); }); }),
};
class Avatar {
  constructor(o) {
    this.isAvatar = true; this.keys = []; this.o = o;
    { const m = [...(new Error().stack || '').matchAll(/scene\.js[^:]*:(\d+):\d+/g)].pop(); this.srcLine = m ? +m[1] : 0; } // outermost scene.js line, for tools/check.mjs names
    const skin = o.skin || '#f2c99b', sc = o.scale || 1;
    const shirt = typeof o.shirt === 'string' ? { color: o.shirt } : (o.shirt || { color: '#2b62d9' });
    const pants = typeof o.pants === 'string' ? { color: o.pants } : (o.pants || { color: '#1d1f2a' });
    const sm = mat(skin, { rough: .5 }), shm = mat(shirt.color, { rough: .6 }), pm = mat(pants.color, { rough: .6 });
    const pat = (SHIRT_PATTERNS[shirt.text ? 'text' : (shirt.pattern || 'plain')] || SHIRT_PATTERNS.plain)(shirt.color, shirt);
    const front = pat ? mat('#ffffff', { map: pat, rough: .6 }) : shm;
    this.root = new THREE.Group(); this.root.scale.setScalar(sc);
    this.tiltG = new THREE.Group(); this.root.add(this.tiltG);
    this.body = new THREE.Group(); this.body.position.y = 2; this.tiltG.add(this.body); // pivot = hips
    // torso 2x2x1 (front face gets the pattern)
    const torso = new THREE.Mesh(rbox(2, 2, 1, .1), [shm, shm, shm, shm, front, shm]); torso.position.y = 1; torso.castShadow = torso.receiveShadow = true; this.body.add(torso);
    this.torso = torso;
    const limb = (x, y, parent, upper, lower, split, top = 0) => { // limb 1x2x1 hanging from its pivot; split = length of the upper colour
      const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g);
      if (split >= 2) { box(1, 2, 1, upper, [0, top - 2, 0], { r: .08, parent: g }); }
      else { box(1, split, 1, upper, [0, top - split, 0], { r: .08, parent: g }); box(.98, 2 - split, .98, lower, [0, top - 2, 0], { r: .08, parent: g }); }
      return g;
    };
    const sleeve = shirt.sleeves === 'none' ? 0 : shirt.sleeves === 'long' ? 1.75 : .8;
    this.la = limb(1.5, 1.5, this.body, shm, sm, sleeve || .001, .5); this.ra = limb(-1.5, 1.5, this.body, shm, sm, sleeve || .001, .5);
    if (!sleeve) { this.la.children.forEach(c => c.material = sm); this.ra.children.forEach(c => c.material = sm); }
    const shoes = pants.shoes ? mat(pants.shoes) : pm;
    this.ll = limb(.5, 0, this.body, pm, shoes, pants.shoes ? 1.65 : 2); this.rl = limb(-.5, 0, this.body, pm, shoes, pants.shoes ? 1.65 : 2);
    this.ll.position.y = 0; this.rl.position.y = 0;
    // head
    this.neck = new THREE.Group(); this.neck.position.y = 2; this.body.add(this.neck);
    this.head = new THREE.Group(); this.head.position.y = .62; this.neck.add(this.head);
    box(1.25, 1.2, 1.2, sm, [0, -.6, 0], { r: .3, parent: this.head });
    this.faceMat = new THREE.MeshStandardMaterial({ transparent: true, premultipliedAlpha: true, alphaTest: .01, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.08), this.faceMat); fp.position.set(0, -.02, .606); this.head.add(fp); this.facePlane = fp;
    buildHair(o.hair || 'messy', o.hairColor || '#3b2416', this.head, o.hatColor);
    for (const acc of [].concat(o.accessory || [])) { const k = typeof acc === 'string' ? acc : acc.kind, f = ACCESSORIES[k];
      if (f) f(this, typeof acc === 'string' ? o.accessoryColor : acc.color); else console.warn('unknown accessory', k); }
    this.defaultFace = o.face || 'smile'; loadFace(this.defaultFace); this.setFace(this.defaultFace);
    this.pos = new THREE.Vector3(...(o.pos || [0, 0, 0])); this.root.position.copy(this.pos); this.root.rotation.y = (o.rotY || 0) * D2R;
    S.scene.add(this.root); S.avatars.push(this);
    if (o.opacity !== undefined) this._ownMaterials();
  }
  setFace(name) { const e = loadFace(name); if (this.faceMat.map !== e.tex) { this.faceMat.map = e.tex; this.faceMat.needsUpdate = true; } }
  /** a.at(t, {pos, rotY, pose, face, ease, visible}) */
  at(t, k) { if (k.face) loadFace(k.face); if (k.opacity !== undefined) this._ownMaterials(); this.keys.push({ t, ...k }); this.keys.sort((a, b) => a.t - b.t); return this; }
  /** a.fadeTo(t0, t1, opacity): ghost / vanish over t0..t1 (opacity 0..1) */
  fadeTo(t0, t1, op) { const [a] = this._track('opacity', t0); return this.at(t0, { opacity: a ? a.opacity : (this.o.opacity ?? 1) }).at(t1, { opacity: op }); }
  _ownMaterials() { if (this._mats) return; this._mats = [];
    this.root.traverse(o => { if (!o.isMesh || o === this.facePlane) return; o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      for (const m of [].concat(o.material)) { m.transparent = true; this._mats.push(m); } });
    this._mats.push(this.faceMat); }
  _opacity(t) { const [a, b] = this._track('opacity', t); if (!a) return this.o.opacity ?? 1; if (b) return lerp(a.opacity, b.opacity, clamp((t - a.t) / (b.t - a.t))); return a.opacity; }
  face(name, t = 0) { return this.at(t, { face: name }); }
  pose(name, t = 0) { return this.at(t, { pose: name }); }
  hide(t) { return this.at(t, { visible: false }); }
  show(t) { return this.at(t, { visible: true }); }
  _track(prop, t) { // previous + next key that set prop
    let a = null, b = null; for (const k of this.keys) { if (k[prop] === undefined) continue; if (k.t <= t) a = k; else { b = k; break; } } return [a, b];
  }
  apply(t) {
    // position + facing
    const [pa, pb] = this._track('pos', t);
    if (pa && pb) { const e = EASE[pb.ease || (/walk|run/.test(this._poseAt(pa.t)) ? 'linear' : 'inOut')] || EASE.inOut, w = e((t - pa.t) / (pb.t - pa.t));
      this.root.position.set(lerp(pa.pos[0], pb.pos[0], w), lerp(pa.pos[1], pb.pos[1], w), lerp(pa.pos[2], pb.pos[2], w)); }
    else if (pa || pb) this.root.position.set(...(pa || pb).pos); else this.root.position.copy(this.pos);
    const [ra, rb] = this._track('rotY', t);
    if (ra && rb) { const span = Math.min(.35, rb.t - ra.t), w = EASE.inOut((t - (rb.t - span)) / span); this.root.rotation.y = lerp(ra.rotY, rb.rotY, w) * D2R; }
    else if (ra || rb) this.root.rotation.y = (ra || rb).rotY * D2R; else this.root.rotation.y = (this.o.rotY || 0) * D2R;
    const [va] = this._track('visible', t); this.root.visible = va ? va.visible : true;
    const [fa] = this._track('face', t); this.setFace(fa ? fa.face : this.defaultFace);
    // pose with blending
    let cur = null, prev = null; for (const k of this.keys) { if (k.pose === undefined || k.t > t) continue; prev = cur; cur = k; }
    const curName = cur ? cur.pose : 'idle', st = cur ? cur.t : -99;
    let p = evalPose(curName, t, t - st);
    const bw = smooth((t - st) / (cur && cur.blend !== undefined ? cur.blend : .22));
    if (bw < 1) { const pn = prev ? prev.pose : 'idle', ps = prev ? prev.t : -99; p = mixPose(evalPose(pn, t, t - ps), p, bw); }
    { const [sk] = this._track('sit', t); if (sk && sk.sit) { p.ll = [-1.5708, 0, .04]; p.rl = [-1.5708, 0, -.04]; p.by = sk.sit === 'floor' ? -1.5 : -.5; p.tilt = 0; p.lift = 0; } } // 2026-10-31: { sit:true } keeps the legs seated under any upper-body pose
    this.la.rotation.set(...p.la); this.ra.rotation.set(...p.ra); this.ll.rotation.set(...p.ll); this.rl.rotation.set(...p.rl); this.neck.rotation.set(...p.hd);
    this.body.position.y = 2 + p.by; this.body.rotation.set(p.bx, 0, p.bz); this.tiltG.rotation.x = p.tilt; this.tiltG.position.y = p.lift;
    // 2026-10-31 additive: head pitch / yaw keys (deg; pitch + = looks up, yaw + = turns to his left), turn over 0.3 s before the key
    for (const [prop, axis, sign] of [['headPitch', 'x', -1], ['headYaw', 'y', 1]]) { const [ka, kb] = this._track(prop, t); if (!ka && !kb) continue;
      let v; if (ka && kb) { const span = Math.min(.3, kb.t - ka.t); v = lerp(ka[prop], kb[prop], EASE.inOut((t - (kb.t - span)) / span)); } else v = ka ? ka[prop] : 0;
      this.neck.rotation[axis] += sign * v * D2R; }
    if (this._mats) { const op = this._opacity(t); for (const m of this._mats) { m.opacity = op; m.depthWrite = op > .98 && m !== this.faceMat; } if (op <= .01) this.root.visible = false; }
    if (this.o.ceiling !== false && this.root.visible) keepUnderCeiling(this, t);
  }
  _poseAt(t) { let n = 'idle', s = false; for (const k of this.keys) { if (k.t > t) continue; if (k.pose !== undefined) n = k.pose; if (k.sit !== undefined) s = k.sit; } return s ? 'sit:' + n : n; }
  /** world position of the head centre (for camera look) */
  headPos(off = [0, 0, 0]) { this.root.updateMatrixWorld(true); return this.head.localToWorld(new THREE.Vector3(off[0], off[1], off[2])); }
}
export function avatar(o = {}) { return new Avatar(o); }

// relative points: rel(a, [dx,dy,dz]) -> function(t) giving a point in a's local frame (x = its left, z = its front)
export function rel(a, off = [0, 0, 0]) {
  return () => { const v = new THREE.Vector3(...off); v.multiplyScalar(a.root.scale.x); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), a.root.rotation.y); return v.add(a.root.position); };
}
export function head(a, off = [0, 0, 0]) { return () => a.headPos(off); }

// ---------------------------------------------------------------- props
const PROPS = {
  locker: (o) => { const g = new THREE.Group(), c = o.color || '#3a6fd8'; box(1.9, 6.4, 1.6, mat('#fff', { map: TEX.vents(c), rough: .45, metal: .2 }), [0, 0, 0], { parent: g }); return g; },
  lockers: (o) => { const g = new THREE.Group(), n = o.n || 4, cols = o.colors || [o.color || '#3a6fd8'];
    for (let i = 0; i < n; i++) { const l = PROPS.locker({ color: cols[i % cols.length] }); l.position.x = (i - (n - 1) / 2) * 2; g.add(l); } return g; },
  desk: (o) => { const g = new THREE.Group(); const top = o.color || '#8a5a34'; box(3.2, .2, 2, mat('#fff', { map: TEX.wood([1, 1], top) }), [0, 2.4, 0], { parent: g });
    for (const [x, z] of [[-1.45, -.85], [1.45, -.85], [-1.45, .85], [1.45, .85]]) box(.15, 2.4, .15, '#9aa0a8', [x, 0, z], { parent: g, metal: .5, rough: .4 });
    box(2.9, .5, 1.7, '#7d838c', [0, 1.85, 0], { parent: g, metal: .4 }); return g; },
  chair: (o) => { const g = new THREE.Group(), c = o.color || '#2f6fd0'; box(1.8, .2, 1.8, c, [0, 1.5, 0], { parent: g, r: .05 }); box(1.8, 1.8, .2, c, [0, 1.7, -.8], { parent: g, r: .05 });
    for (const [x, z] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) box(.12, 1.5, .12, '#9aa0a8', [x, 0, z], { parent: g, metal: .5 }); return g; },
  door: (o) => { const g = new THREE.Group(), c = o.color || '#9a6a3c'; box(3.6, 7.4, .5, '#e9e4da', [0, 0, -.05], { parent: g });
    const d = box(3, 7, .3, mat('#fff', { map: TEX.wood([1, 1], c) }), [0, 0, 0], { parent: g }); ball(.13, '#d6b24a', [1.15, 3.4, .25], { parent: g, metal: .7, rough: .3 });
    if (o.window !== false) box(1, 1.6, .05, mat('#bfe1ff', { rough: .1, emissive: '#5c7a99', ei: .4 }), [0, 4.4, .16], { parent: g, cast: false }); g.userData.door = d; return g; },
  bed: (o) => { const g = new THREE.Group(), c = o.color || '#3d6fb8'; box(4.4, 1.2, 8, mat('#fff', { map: TEX.wood([1, 1], '#6e4326') }), [0, 0, 0], { parent: g });
    box(4.2, .8, 7.8, '#f3f3f3', [0, 1.2, 0], { parent: g, r: .2 }); box(4.3, .5, 5.4, c, [0, 1.9, 1.2], { parent: g, r: .2 }); box(2.6, .5, 1.2, '#ffffff', [0, 2, -3.1], { parent: g, r: .25 });
    box(4.4, 3.4, .4, mat('#fff', { map: TEX.wood([1, 1], '#6e4326') }), [0, 0, -4.1], { parent: g }); return g; },
  bunkbed: (o) => { const g = new THREE.Group(), wood = mat('#fff', { map: TEX.wood([1, 1], '#7b4a28') }); const c = o.color || '#4f8f3e';
    for (const [x, z] of [[-2.2, -4], [2.2, -4], [-2.2, 4], [2.2, 4]]) box(.4, 10, .4, wood, [x, 0, z], { parent: g });
    for (const y of [1.2, 6]) { box(4.4, .5, 8, wood, [0, y, 0], { parent: g }); box(4.1, .7, 7.7, c, [0, y + .5, 0], { parent: g, r: .2 }); box(2.4, .45, 1.1, '#fff', [0, y + 1.2, -3.2], { parent: g, r: .2 }); }
    for (let i = 0; i < 4; i++) box(4.4, .25, .3, wood, [0, 7.6 + i * .6, 4], { parent: g }); return g; },
  table: (o) => { const g = new THREE.Group(); box(5, .3, 3.2, mat('#fff', { map: TEX.wood([1, 1], o.color || '#8a5a34') }), [0, 2.6, 0], { parent: g });
    for (const [x, z] of [[-2.2, -1.3], [2.2, -1.3], [-2.2, 1.3], [2.2, 1.3]]) box(.3, 2.6, .3, '#6b4024', [x, 0, z], { parent: g }); return g; },
  cookie: () => { const g = new THREE.Group(); cyl(.35, .35, .1, '#c58a45', [0, 0, 0], { parent: g }); for (let i = 0; i < 5; i++) ball(.06, '#3b2112', [Math.cos(i * 1.3) * .2, .1, Math.sin(i * 1.3) * .2], { parent: g }); return g; },
  phone: () => { const g = new THREE.Group(); box(.5, .9, .08, '#151515', [0, 0, 0], { parent: g, r: .04 }); box(.44, .8, .02, mat('#7fb7ff', { emissive: '#3a76d0', ei: .8 }), [0, .05, .045], { parent: g, cast: false }); return g; },
  flower: (o) => { const g = new THREE.Group(); cyl(.05, .05, 1.2, '#3f8a2c', [0, 0, 0], { parent: g }); const c = o.color || '#e8467c';
    for (let i = 0; i < 6; i++) ball(.18, c, [Math.cos(i * 1.047) * .22, 1.3, Math.sin(i * 1.047) * .22], { parent: g }); ball(.15, '#f6d23c', [0, 1.32, 0], { parent: g }); return g; },
  tree: (o) => { const g = new THREE.Group(); cyl(.5, .7, 5, '#6b4a2b', [0, 0, 0], { parent: g }); const c = o.color || '#3f8f37';
    ball(3, c, [0, 7, 0], { parent: g }); ball(2.2, c, [1.6, 6, .8], { parent: g }); ball(2.2, c, [-1.5, 6.2, -.6], { parent: g }); return g; },
  lamp: () => { const g = new THREE.Group(); cyl(.6, .7, .2, '#333', [0, 0, 0], { parent: g }); cyl(.08, .08, 5, '#333', [0, .2, 0], { parent: g }); cyl(.5, .9, 1, mat('#fff4d6', { emissive: '#ffe2a0', ei: .9 }), [0, 5, 0], { parent: g }); return g; },
  ceiling_light: () => { const g = new THREE.Group(); box(3, .2, 1.4, mat('#ffffff', { emissive: '#ffffff', ei: 1.6 }), [0, -.2, 0], { parent: g, cast: false }); return g; },
  bench: (o) => { const g = new THREE.Group(), w = mat('#fff', { map: TEX.wood([1, 1], o.color || '#8a5a34') }); for (let i = 0; i < 3; i++) box(6, .2, .5, w, [0, 1.6, -.6 + i * .6], { parent: g });
    for (let i = 0; i < 2; i++) box(6, .5, .2, w, [0, 2.4 + i * .7, -1], { parent: g }); for (const x of [-2.6, 2.6]) { box(.3, 1.6, 1.8, '#333', [x, 0, 0], { parent: g }); box(.3, 2.2, .3, '#333', [x, 1.6, -1.05], { parent: g }); } return g; },
  couch: (o) => { const g = new THREE.Group(), c = o.color || '#6a5a8c'; box(8, 1.6, 3, c, [0, 0, 0], { parent: g, r: .2 }); box(8, 2.4, .8, c, [0, 1.4, -1.1], { parent: g, r: .3 });
    box(.8, 2.2, 3, c, [-3.6, 0, 0], { parent: g, r: .3 }); box(.8, 2.2, 3, c, [3.6, 0, 0], { parent: g, r: .3 }); for (const x of [-1.6, 1.6]) box(3.1, .6, 2.4, c, [x, 1.6, .2], { parent: g, r: .25 }); return g; },
  tv: () => { const g = new THREE.Group(); box(5, 1.6, 1.6, mat('#fff', { map: TEX.wood([1, 1], '#3b2a1c') }), [0, 0, 0], { parent: g }); box(6, 3.5, .25, '#111', [0, 1.8, 0], { parent: g, r: .05 });
    box(5.7, 3.2, .05, mat('#222b3d', { emissive: '#22324f', ei: .6, rough: .2 }), [0, 1.95, .13], { parent: g, cast: false }); return g; },
  fridge: () => { const g = new THREE.Group(); box(3, 7.5, 2.6, '#e8ecf0', [0, 0, 0], { parent: g, r: .15, metal: .2, rough: .3 }); box(.15, 1.6, .15, '#999', [1.1, 4.6, 1.35], { parent: g, metal: .7 });
    box(.15, 1.6, .15, '#999', [1.1, 2.0, 1.35], { parent: g, metal: .7 }); box(2.9, .05, .05, '#bbb', [0, 4.2, 1.31], { parent: g }); return g; },
  counter: (o) => { const g = new THREE.Group(), w = o.w || 8; box(w, 3, 2.2, o.color || '#f2efe8', [0, 0, 0], { parent: g }); box(w + .2, .25, 2.5, '#3a3a3e', [0, 3, .1], { parent: g, rough: .3 });
    for (let i = 0; i < w / 2; i++) box(.6, .1, .08, '#888', [-w / 2 + 1 + i * 2, 2.4, 1.12], { parent: g, metal: .7 }); return g; },
  whiteboard: (o) => { const g = new THREE.Group(); box(o.w || 12, 4.5, .2, '#d0d4d8', [0, 0, 0], { parent: g }); box((o.w || 12) - .4, 4.1, .05, mat('#fafafa', { rough: .25 }), [0, .2, .12], { parent: g, cast: false }); return g; },
  window: (o) => { const g = new THREE.Group(), w = o.w || 6, h = o.h || 5; plane(w, h, new THREE.MeshBasicMaterial({ map: TEX.sky(o.night), fog: false }), [0, h / 2, 0], [0, 0, 0], g);
    const f = o.frame || '#ffffff'; box(w + .4, .3, .5, f, [0, -.3, 0], { parent: g }); box(w + .4, .3, .5, f, [0, h, 0], { parent: g }); box(.3, h, .5, f, [-w / 2 - .05, 0, 0], { parent: g }); box(.3, h, .5, f, [w / 2 + .05, 0, 0], { parent: g });
    box(.15, h, .3, f, [0, 0, 0], { parent: g }); return g; },
  plant: () => { const g = new THREE.Group(); cyl(.7, .5, 1.2, '#b8643a', [0, 0, 0], { parent: g }); ball(1, '#3f8f37', [0, 2, 0], { parent: g }); ball(.7, '#4ea443', [.4, 2.6, .2], { parent: g }); return g; },
  wardrobe: (o) => { const g = new THREE.Group(), w = mat('#fff', { map: TEX.wood([1, 1], o.color || '#7b4a28') }); box(4, 8, 2, w, [0, 0, 0], { parent: g }); box(.05, 7.6, .05, '#3a2414', [0, .2, 1.01], { parent: g }); return g; },
  rug: (o) => { const g = new THREE.Group(); box(o.w || 8, .05, o.d || 6, o.color || '#b8434b', [0, 0, 0], { parent: g, cast: false, r: .02 }); return g; },
  trashcan: () => { const g = new THREE.Group(); cyl(.7, .6, 2, '#5f6b74', [0, 0, 0], { parent: g, metal: .5 }); return g; },
  sign: (o) => { const g = new THREE.Group(); const t = canvasTex('sign' + o.text, 512, 128, (c, w, h) => { c.fillStyle = o.bg || '#1f3f8f'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 64px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.text || 'CLASS 8B', w / 2, h / 2 + 4); });
    box(4, 1, .15, mat('#fff', { map: t }), [0, 0, 0], { parent: g }); return g; },
};
export const PROP_NAMES = Object.keys(PROPS);
/** prop(name, {pos, rotY, scale, color, ...}) -> THREE.Group (added to the scene) */
export function prop(name, o = {}) {
  const f = PROPS[name]; if (!f) { console.warn('unknown prop', name); return new THREE.Group(); }
  const g = f(o); g.userData.prop = name; g.position.set(...(o.pos || [0, 0, 0])); g.rotation.y = (o.rotY || 0) * D2R; if (o.scale) g.scale.setScalar(o.scale);
  (o.parent || S.scene).add(g); return g;
}

// ---------------------------------------------------------------- lighting + sets
function lighting(o) {
  const L = S.light = S.light || {};
  if (!L.hemi) { L.hemi = new THREE.HemisphereLight(); L.sun = new THREE.DirectionalLight(); L.amb = new THREE.AmbientLight(); S.scene.add(L.hemi, L.sun, L.sun.target, L.amb);
    L.sun.castShadow = true; L.sun.shadow.mapSize.set(2048, 2048); L.sun.shadow.bias = -.0004; L.sun.shadow.normalBias = .03; L.sun.shadow.radius = 4; }
  L.hemi.color.set(o.sky); L.hemi.groundColor.set(o.ground); L.hemi.intensity = o.hemi;
  L.sun.color.set(o.sunColor || '#fff6e8'); L.sun.intensity = o.sun; L.amb.color.set(o.amb || '#ffffff'); L.amb.intensity = o.ambI ?? .35;
  const c = o.center || [0, 0, 0], sd = o.sunDir || [12, 30, 16]; L.sun.position.set(c[0] + sd[0], c[1] + sd[1], c[2] + sd[2]); L.sun.target.position.set(...c);
  const r = o.shadowR || 30, sc = L.sun.shadow.camera; sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.near = 1; sc.far = 120; sc.updateProjectionMatrix();
  S.scene.background = col(o.bg || '#9ccaf7'); S.scene.fog = o.fog ? new THREE.Fog(o.fog[0], o.fog[1], o.fog[2]) : null;
  S.exposure = o.exposure ?? 1;
}
export const LIGHT = {
  day: { sky: '#dfeeff', ground: '#8a7a64', hemi: 1.25, sun: 2.4, ambI: .4, exposure: 1.05 },
  indoor: { sky: '#fffaf0', ground: '#9a8c78', hemi: 1.35, sun: 1.6, ambI: .5, exposure: 1.05 },
  night: { sky: '#5a6fb0', ground: '#1a1d2e', hemi: .55, sun: .5, sunColor: '#9fb4ff', ambI: .2, bg: '#0a1030', exposure: 1.0 },
};
export function light(preset, extra = {}) { lighting({ ...(LIGHT[preset] || LIGHT.indoor), ...extra }); }

function _room({ w, d, h, floor, wall, ceiling = SO.ceiling ?? true, x0 = 0, z0 = 0, baseboard = '#ffffff', wallLow }) {
  const g = new THREE.Group(); S.scene.add(g);
  const fl = plane(w, d, mat('#fff', { map: floor, rough: .7 }), [x0, 0, z0], [-90, 0, 0], g);
  const wm = mat('#fff', { map: TEX.wall([w / 8, h / 8], wall), rough: .9 }), wmz = mat('#fff', { map: TEX.wall([d / 8, h / 8], wall), rough: .9 });
  plane(w, h, wm, [x0, h / 2, z0 - d / 2], [0, 0, 0], g); plane(w, h, wm, [x0, h / 2, z0 + d / 2], [0, 180, 0], g);
  plane(d, h, wmz, [x0 - w / 2, h / 2, z0], [0, 90, 0], g); plane(d, h, wmz, [x0 + w / 2, h / 2, z0], [0, -90, 0], g);
  if (wallLow) { const lm = mat(wallLow, { rough: .8 }); box(w, 2.6, .1, lm, [x0, 0, z0 - d / 2 + .06], { parent: g, cast: false }); box(w, 2.6, .1, lm, [x0, 0, z0 + d / 2 - .06], { parent: g, cast: false });
    box(.1, 2.6, d, lm, [x0 - w / 2 + .06, 0, z0], { parent: g, cast: false }); box(.1, 2.6, d, lm, [x0 + w / 2 - .06, 0, z0], { parent: g, cast: false }); }
  else if (baseboard) { box(w, .4, .12, baseboard, [x0, 0, z0 - d / 2 + .06], { parent: g, cast: false }); box(.12, .4, d, baseboard, [x0 - w / 2 + .06, 0, z0], { parent: g, cast: false }); box(.12, .4, d, baseboard, [x0 + w / 2 - .06, 0, z0], { parent: g, cast: false }); }
  if (ceiling) plane(w, d, mat('#fff', { map: TEX.ceiling([w / 4, d / 4]), rough: .9 }), [x0, h, z0], [90, 0, 0], g).userData.kind = 'ceiling';
  g.children.forEach(c => { if (!c.userData.kind) c.userData.kind = c.geometry && c.geometry.type === 'PlaneGeometry' ? 'wall' : 'trim'; });
  fl.userData.kind = 'floor'; g.userData.prop = 'room';
  fl.receiveShadow = true; return g;
}
function ceilingLights(xs, zs, h, night) { if (SO.ceiling === false) return; for (const x of xs) for (const z of zs) prop('ceiling_light', { pos: [x, h, z] }); }
let SO = {}; // options of the set being built: set(name, { h, ceiling, night, ... })
function pointL(p, c = '#fff1d8', i = 30, dist = 30) { const l = new THREE.PointLight(c, i, dist, 1.6); l.position.set(...p); S.scene.add(l); return l; }

const SETS = {
  hallway(night) {
    const h = SO.h || 10; _room({ w: 12, d: 90, h, floor: TEX.tile([6, 45], night ? '#c9d0dc' : '#f3f5f8', night ? '#6f86b0' : '#9fb8d8'), wall: night ? '#c7cbe0' : '#e9e6df', z0: -25, wallLow: night ? '#3b6f8f' : '#4aa3b5' });
    const cols = ['#3a6fd8', '#3a6fd8', '#3a6fd8', '#c83a3a'];
    for (let z = -64; z <= 14; z += 2) { if (Math.abs(((z + 64) % 26) - 13) < 2) continue; const i = ((z / 2) | 0) & 3;
      prop('locker', { pos: [-5.15, 0, z], rotY: 90, color: cols[i] }); prop('locker', { pos: [5.15, 0, z], rotY: -90, color: cols[(i + 2) & 3] }); }
    for (const z of [-51, -25, 1]) { prop('door', { pos: [-5.95, 0, z], rotY: 90 }); prop('door', { pos: [5.95, 0, z], rotY: -90 }); }
    prop('sign', { pos: [-5.8, 7.6, 1], rotY: 90, text: 'CLASS 8B' });
    ceilingLights([0], [-60, -48, -36, -24, -12, 0, 12], h - .01);
    if (night) { pointL([0, 9, 0], '#b8c8ff', 20, 26); pointL([0, 9, -24], '#b8c8ff', 20, 26); light('night', { center: [0, 0, -5], bg: '#05081a', fog: ['#0b1030', 18, 70], hemi: .7, ambI: .25, sun: .35 }); }
    else { pointL([0, 9, 4], '#fff4e0', 25, 30); pointL([0, 9, -16], '#fff4e0', 25, 30); light('indoor', { center: [0, 0, -5], bg: '#e9e6df', fog: ['#e9e6df', 40, 95], sunDir: [8, 30, 14] }); }
  },
  classroom() {
    const h = SO.h || 10; _room({ w: 26, d: 26, h, floor: TEX.tile([8, 8], '#e9e4d8', '#c9c1ae'), wall: '#ece4d2', wallLow: '#9cc3d6' });
    prop('whiteboard', { pos: [0, 3, -12.85], w: 14 }); prop('desk', { pos: [-7, 0, -8], color: '#6e4326' });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { prop('desk', { pos: [-6 + c * 6, 0, -2 + r * 5] }); prop('chair', { pos: [-6 + c * 6, 0, -.6 + r * 5], rotY: 180, color: '#2f6fd0' }); }
    for (const z of [-7, 0, 7]) prop('window', { pos: [12.9, 3, z], rotY: -90, w: 5, h: 5 });
    ceilingLights([-6, 6], [-6, 6], h - .01); pointL([0, 9, 0], '#fff4e0', 30, 34);
    light('indoor', { center: [0, 0, 0], bg: '#ece4d2', sunDir: [-14, 30, 10] });
  },
  bedroom() {
    const h = SO.h || 10; _room({ w: 18, d: 18, h, floor: TEX.carpet([6, 6]), wall: '#dfe7d2' });
    prop('bunkbed', { pos: [-5, 0, -4.6], color: '#5c8f46' }); prop('window', { pos: [3, 3, -8.95], w: 6, h: 4.5, frame: '#6e4326' });
    prop('wardrobe', { pos: [6.6, 0, -7.6] }); prop('lamp', { pos: [7.5, 0, 2] }); prop('rug', { pos: [2, 0, 1], w: 7, d: 5, color: '#6a7fc0' });
    ceilingLights([0], [0], h - .01); pointL([0, 9, 2], '#fff1d8', 30, 30);
    light('indoor', { center: [0, 0, 0], bg: '#dfe7d2', sunDir: [10, 30, 18] });
  },
  house_kitchen() {
    const h = SO.h || 10; _room({ w: 20, d: 18, h, floor: TEX.tile([8, 8], '#f2efe8', '#d8d2c4'), wall: '#f1e6cf' });
    prop('counter', { pos: [-2, 0, -7.8], w: 10 }); prop('fridge', { pos: [6, 0, -7.6] }); prop('window', { pos: [-2, 4.2, -8.95], w: 5, h: 3.5 });
    prop('table', { pos: [0, 0, 2] }); for (const [x, z, r] of [[-3.2, 2, 90], [3.2, 2, -90]]) prop('chair', { pos: [x, 0, z], rotY: r, color: '#8a5a34' });
    ceilingLights([0], [0], h - .01); pointL([0, 9, 0], '#fff1d8', 30, 30); light('indoor', { center: [0, 0, 0], bg: '#f1e6cf' });
  },
  livingroom() {
    const h = SO.h || 10; _room({ w: 22, d: 18, h, floor: TEX.wood([5, 5], '#7a4a2a'), wall: '#e4dccb' });
    prop('couch', { pos: [0, 0, 4], rotY: 180 }); prop('tv', { pos: [0, 0, -7.8] }); prop('rug', { pos: [0, 0, -1], w: 10, d: 7 }); prop('lamp', { pos: [-6, 0, 5] }); prop('plant', { pos: [8.5, 0, -7.5] });
    prop('window', { pos: [10.95, 3, -2], rotY: -90, w: 6, h: 4.5 });
    pointL([0, 9, 0], '#fff1d8', 30, 30); light('indoor', { center: [0, 0, 0], bg: '#e4dccb' });
  },
  outside_school() {
    plane(200, 200, mat('#fff', { map: TEX.grass([40, 40]), rough: .9 }), [0, 0, 0], [-90, 0, 0]);
    plane(14, 60, mat('#fff', { map: TEX.concrete([3, 12]) }), [0, .02, 10], [-90, 0, 0]);
    const g = new THREE.Group(); S.scene.add(g); box(60, 16, 8, mat('#fff', { map: TEX.brick([10, 4]), rough: .9 }), [0, 0, -24], { parent: g });
    box(61, .8, 9, '#e9e4da', [0, 16, -24], { parent: g });
    for (let x = -26; x <= 26; x += 6) for (const y of [3, 9.5]) { if (Math.abs(x) < 5 && y < 5) continue; prop('window', { pos: [x, y, -19.95], w: 3.6, h: 3.6 }); }
    box(8, 7, .3, mat('#bfe1ff', { rough: .1, emissive: '#4f7090', ei: .3 }), [0, 0, -19.9], { parent: g }); box(10, 1.2, .5, '#e9e4da', [0, 7, -19.8], { parent: g });
    prop('sign', { pos: [0, 12.6, -19.85], text: 'OAKRIDGE SCHOOL', bg: '#2c3e64' });
    for (const x of [-20, -12, 12, 20]) prop('tree', { pos: [x, 0, -12] });
    light('day', { center: [0, 0, -4], bg: '#8cc4f5', shadowR: 40, sunDir: [-16, 32, 20], fog: ['#cfe6fb', 60, 160] });
    S.scene.background = TEX.sky(false);
  },
  park() {
    plane(200, 200, mat('#fff', { map: TEX.grass([40, 40]), rough: .9 }), [0, 0, 0], [-90, 0, 0]);
    plane(6, 120, mat('#fff', { map: TEX.concrete([1, 20]) }), [0, .02, 0], [-90, 0, 0]);
    for (const [x, z] of [[-10, -8], [11, -14], [-14, 8], [13, 6], [-8, -26], [9, -32], [0, -44]]) prop('tree', { pos: [x, 0, z], scale: 1.1 });
    prop('bench', { pos: [-5, 0, -4], rotY: 90 }); prop('bench', { pos: [5, 0, 6], rotY: -90 });
    for (let i = 0; i < 14; i++) prop('flower', { pos: [-7 + (i % 7) * .8, 0, 10 + (i / 7 | 0) * .9], color: ['#e8467c', '#f6d23c', '#ffffff'][i % 3] });
    light('day', { center: [0, 0, 0], bg: '#8cc4f5', shadowR: 40, fog: ['#cfe6fb', 60, 160] }); S.scene.background = TEX.sky(false);
  },
};
SETS.school_night_hallway = () => SETS.hallway(true);
export const SET_NAMES = Object.keys(SETS);
/** set(name): builds the set at the origin. One set per video file; for several locations use place(). */
export function set(name, opts = {}) { const f = typeof name === 'function' ? name : SETS[name]; if (!f) throw new Error("unknown set " + name + ' (sets: ' + Object.keys(SETS).join(' ') + ')');
  SO = opts; try { f(!!opts.night, opts); } finally { SO = {}; } return snapLight(); }
/** place(name, [x,y,z]): build another set somewhere else (far away), e.g. place('bedroom',[200,0,0]); lights follow the last call unless lightAt() is used */
export function place(name, at = [0, 0, 0], opts = {}) {
  const prev = S.light ? snapLight() : null;
  const before = new Set(S.scene.children); const f = typeof name === 'function' ? name : SETS[name]; if (!f) throw new Error("unknown set " + name);
  SO = opts; try { f(!!opts.night, opts); } finally { SO = {}; }
  const lightObjs = new Set([S.light.hemi, S.light.sun, S.light.sun.target, S.light.amb]);
  for (const c of S.scene.children) if (!before.has(c) && !lightObjs.has(c)) c.position.add(new THREE.Vector3(...at));
  const lp = snapLight(at);
  if (prev) applySnap(prev); // the current lighting stays until useLight()
  return lp;
}
function snapLight(at = [0, 0, 0]) {
  const v = new THREE.Vector3(...at), L = S.light;
  return { bg: S.scene.background, fog: S.scene.fog, exposure: S.exposure, sky: L.hemi.color.clone(), ground: L.hemi.groundColor.clone(), hemi: L.hemi.intensity, sun: L.sun.intensity,
    sunColor: L.sun.color.clone(), sunPos: L.sun.position.clone().add(v), tgt: L.sun.target.position.clone().add(v), amb: L.amb.intensity };
}
function applySnap(cur) {
  const L = S.light; S.scene.background = cur.bg; S.scene.fog = cur.fog; S.exposure = cur.exposure; L.hemi.color.copy(cur.sky); L.hemi.groundColor.copy(cur.ground); L.hemi.intensity = cur.hemi;
  L.sun.intensity = cur.sun; L.sun.color.copy(cur.sunColor); L.sun.position.copy(cur.sunPos); L.sun.target.position.copy(cur.tgt); L.amb.intensity = cur.amb;
}
const lightCuts = [];
/** useLight(t, placeLight): switch the global lighting state at time t (value returned by place()) */
export function useLight(t, lp) { lightCuts.push({ t, lp }); lightCuts.sort((a, b) => a.t - b.t); }
function applyLight(t) {
  let cur = null; for (const c of lightCuts) if (c.t <= t) cur = c.lp; if (!cur) return; const L = S.light;
  S.scene.background = cur.bg; S.scene.fog = cur.fog; S.exposure = cur.exposure; L.hemi.color.copy(cur.sky); L.hemi.groundColor.copy(cur.ground); L.hemi.intensity = cur.hemi;
  L.sun.intensity = cur.sun; L.sun.color.copy(cur.sunColor); L.sun.position.copy(cur.sunPos); L.sun.target.position.copy(cur.tgt); L.amb.intensity = cur.amb;
}

// ---------------------------------------------------------------- camera
/** cam(t0, t1, {pos, look, fov, to:{pos,look,fov}, ease}) - pos/look: [x,y,z], an avatar (look: its head), or a function from rel()/head() */
export function cam(t0, t1, o) { S.shots.push({ t0, t1, ...o }); S.shots.sort((a, b) => a.t0 - b.t0); }
function resolveP(v, t) { if (!v) return null; if (Array.isArray(v)) return new THREE.Vector3(...v); if (v.isAvatar) return v.headPos(); if (typeof v === 'function') return v(t); return v; }
export function shake(t, amt = .3, dur = .45) { S.shakes.push({ t, amt, dur }); }
export function flash(t, dur = .25, color = '#ffffff') { S.flashes.push({ t, dur, color }); }
export function fade(t0, t1, color = '#000000', from = 0, to = 1) { S.fades.push({ t0, t1, color, from, to }); }
export function lines(t0, t1, o = {}) { S.lines.push({ t0, t1, color: o.color || 'rgba(255,255,255,.8)' }); }
export function onFrame(fn) { S.frameFns.push(fn); }
// SFX cues (2026-10-30): sfx(t, name, {gain, align}) records a cue; tools/render.mjs reads window.__sfx and runs tools/mix.py.
// name = engine/sfx/catalog.json name ('vine_boom', 'pop/pop', 'woosh/deep', ...). Purely additive: no audio plays in the page.
export const SFX_CUES = [];
export function sfx(t, name, o = {}) { SFX_CUES.push({ t, name, ...o }); }
if (typeof window !== 'undefined') window.__sfx = SFX_CUES;
// Auto camera motion (2026-10-30, owner: "the camera was never stationary"). Every shot without `to` and without
// `still:true` gets a slow dolly towards its look point: push-in (authored pos -> closer) or pull-out (closer -> authored pos),
// so the camera never goes BEHIND the authored position (no new wall clipping). Measured on the refs (tools/camref.py,
// 114 shots): median |zoom| 17.5 %/s, 81 % push-ins, 3 % static. Defaults: travel = clamp(rate * len, min, max) of the
// distance, ease in-out; shots shorter than `punch` s get `punchAmt` with an ease-out punch. Pattern: every `outEvery`-th
// auto shot pulls out (0 = never). Drift: a tiny sideways/vertical float, `drift` x distance.
export const CAMDEF = { rate: .175, min: .12, max: .30, punch: 1, punchAmt: .12, outEvery: 5, drift: .012 };
function shotIndex(s) { return S.shots.indexOf(s); }
function autoMove(s, t, p, l) {
  const i = shotIndex(s), next = S.shots[i + 1];
  const len = Math.max(.05, (next ? next.t0 : (S.duration || s.t1 || s.t0 + 2)) - s.t0), u = clamp((t - s.t0) / len);
  let auto = 0; for (let j = 0; j <= i; j++) if (!S.shots[j].to && !S.shots[j].still) auto++;
  const out = CAMDEF.outEvery > 0 && auto % CAMDEF.outEvery === 0 && len >= CAMDEF.punch;
  const amt = len < CAMDEF.punch ? CAMDEF.punchAmt : clamp(CAMDEF.rate * len, CAMDEF.min, CAMDEF.max);
  const k = len < CAMDEF.punch ? EASE.out(u) : easeInOut(u);
  const f = amt * (out ? 1 - k : k), d = p.distanceTo(l);
  const dir = l.clone().sub(p).normalize(); p.addScaledVector(dir, d * f);
  if (CAMDEF.drift) { // sideways + vertical float, perpendicular to the view, direction varies per shot
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), ph = i * 2.399;
    const sx = Math.sin(ph) * (u - .5) * 2, sy = Math.cos(ph) * .5 * Math.sin(u * Math.PI);
    p.addScaledVector(side, d * CAMDEF.drift * sx); p.y += d * CAMDEF.drift * sy;
  }
}
function applyCamera(t) {
  let s = null; for (const x of S.shots) if (x.t0 <= t) s = x; if (!s) s = S.shots[0]; if (!s) { S.camera.position.set(0, 5, 14); S.camera.lookAt(0, 4, 0); return; }
  const w = (EASE[s.ease] || EASE.inOut)((t - s.t0) / Math.max(.001, s.t1 - s.t0));
  let p = resolveP(s.pos, t), l = resolveP(s.look, t) || new THREE.Vector3(0, 4, 0), fov = s.fov || 50;
  p = p.clone(); l = l.clone();
  if (s.to) { const p2 = resolveP(s.to.pos, t), l2 = resolveP(s.to.look, t); if (p2) p.lerp(p2, w); if (l2) l.lerp(l2, w); if (s.to.fov) fov = lerp(fov, s.to.fov, w); }
  else if (!s.still) autoMove(s, t, p, l);
  for (const k of S.shakes) { const dt = t - k.t; if (dt < 0 || dt > k.dur) continue; const a = k.amt * (1 - dt / k.dur);
    p.x += a * Math.sin(dt * 53); p.y += a * Math.sin(dt * 71 + 1); l.x += a * .6 * Math.sin(dt * 61 + 2); }
  for (const k of S.handheld || []) { if (t < k.t0 || t >= k.t1) continue; const a = k.amt; // slow handheld drift (horror look)
    p.x += a * (Math.sin(t * 2.1) + .5 * Math.sin(t * 5.3 + 1)); p.y += a * .7 * (Math.sin(t * 1.7 + 2) + .5 * Math.sin(t * 4.1)); l.x += a * .8 * Math.sin(t * 2.6 + 3); l.y += a * .5 * Math.sin(t * 3.1); }
  S.camera.position.copy(p); S.camera.fov = fov; S.camera.updateProjectionMatrix(); S.camera.lookAt(l);
  const roll = s.to && s.to.roll !== undefined ? lerp(s.roll || 0, s.to.roll, w) : (s.roll || 0); // dutch angle, deg (+ = clockwise)
  if (roll) S.camera.rotateZ(-roll * D2R);
}

// ---------------------------------------------------------------- captions
/** new (tightened) time -> the scene's old time, per timemap.json segment (identity without one) */
export function newToOld(t) { const g = S.tmap && S.tmap.segments; if (!g) return t; let s = g[0]; for (const x of g) { if (t >= x.n0 - 1e-4) s = x; else break; } return Math.min(s.o1, s.o0 + Math.max(0, t - s.n0)); }
export function video(o = {}) { if (o.duration) S.duration = o.duration; }
/** captions(src, {offset, until, max, words}) - src = Parakeet JSON (relative to the video folder); words[].start/end/word */
export function captions(src, o = {}) {
  S.loads.push((async () => {
    const j = o.words ? { words: o.words } : await (await fetch(new URL(src, S.videoUrl))).json();
    if (j.timeline === 'tightened' && S.tmap) for (const w of j.words || []) { w.start = newToOld(w.start); w.end = newToOld(w.end); }
    const emph = o.emph ? new Set(o.emph) : null; // word indexes (in the JSON) shown in ALL CAPS
    const ws = (j.words || []).map((w, i) => { let text = (w.word ?? w.text).trim();
      if (o.strip) text = text.replace(/[.,!?;:]+$/, '') || text; if (emph && emph.has(i)) text = text.toUpperCase();
      return { text, raw: (w.word ?? w.text).trim(), start: w.start - (o.offset || 0), end: w.end - (o.offset || 0) }; }).filter(w => w.text && w.start >= -.01 && (o.until === undefined || w.start < o.until));
    const max = o.max || 7, chunks = []; let cur = [];
    const push = () => { if (cur.length) chunks.push(cur); cur = []; };
    ws.forEach((w, i) => { const gap = i && w.start - ws[i - 1].end > .45; if (gap && cur.length) push(); cur.push(w);
      const rt = w.raw || w.text, punct = /[.,!?;:]["')]?$/.test(rt); if ((punct && (cur.length >= 2 || /[.!?]/.test(rt))) || cur.length >= max) push(); });
    push();
    // merge single lone words into the next chunk when not sentence-ending
    chunks.forEach((c, i) => { if (S.captions.length || i >= 0) S.captions.push({ text: c.map(w => w.text).join(' '), t0: c[0].start, t1: c[c.length - 1].end }); });
    for (let i = 0; i < S.captions.length; i++) { const n = S.captions[i + 1]; S.captions[i].t1 = n ? Math.min(n.t0, S.captions[i].t1 + .7) : S.captions[i].t1 + .6; }
    if (!S.duration && ws.length) S.duration = ws[ws.length - 1].end + .5;
  })());
}
export function caption(t0, t1, text) { S.captions.push({ t0, t1, text }); S.captions.sort((a, b) => a.t0 - b.t0); }
export const CAP = { size: 66, y: .22, maxW: .8, upper: false };
function wrapLines(g, text) {
  const words = text.split(' '); const full = g.measureText(text).width;
  if (full < W * .42 || words.length < 3) { if (full <= W * CAP.maxW) return [text]; }
  let best = [text], bestScore = 1e9; // best 2-line split
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const wa = g.measureText(a).width, wb = g.measureText(b).width;
    const sc = Math.abs(wa - wb) + (Math.max(wa, wb) > W * CAP.maxW ? 1e6 : 0); if (sc < bestScore) { bestScore = sc; best = [a, b]; } }
  return best;
}
function drawCaptions(g, t) {
  const c = S.captions.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const text = CAP.upper ? c.text.toUpperCase() : c.text;
  g.font = `900 ${CAP.size}px Nunito`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const ls = wrapLines(g, text), lh = CAP.size * 1.08, y0 = H * CAP.y - (ls.length - 1) * lh / 2;
  ls.forEach((l, i) => { const y = y0 + i * lh;
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.lineWidth = 12; g.strokeStyle = '#141414'; g.strokeText(l, W / 2, y);
    g.shadowColor = 'transparent'; g.fillStyle = '#ffffff'; g.fillText(l, W / 2, y); });
}

// ---------------------------------------------------------------- overlay fx
// ---------------------------------------------------------------- grade / post fx (opt-in: nothing changes unless a scene calls these)
// grade(t0, t1, {tint, tintA, bloom, ca, contrast, sat, bright, vig}) colour grade for a time range (later calls win);
// GRADE = the defaults a grade() range starts from. whip(t, dur, px, zoom) = blur+zoom flash on a cut; handheld(t0, t1, amt) = camera drift.
export const GRADE = { tint: '#3b2a9e', tintA: 0, bloom: 0, ca: 0, contrast: 1, sat: 1, bright: 1, vig: 0 };
export function grade(t0, t1, o = {}) { (S.grades = S.grades || []).push({ t0, t1, ...o }); }
export function whip(t, dur = .16, px = 22, zoom = .08) { (S.whips = S.whips || []).push({ t, dur, px, zoom }); }
export function handheld(t0, t1, amt = .06) { (S.handheld = S.handheld || []).push({ t0, t1, amt }); }
let fxA, fxB;
function fxCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function postFx(g, t) {
  let G = null; for (const r of S.grades || []) if (t >= r.t0 && t < r.t1) G = { ...GRADE, ...r };
  let wb = 0, wz = 0; for (const k of S.whips || []) { const d = Math.abs(t - k.t); if (d < k.dur) { const a = 1 - d / k.dur; wb = Math.max(wb, k.px * a); wz = Math.max(wz, k.zoom * a); } }
  if (!G && !wb) return;
  if (!fxA) { fxA = fxCanvas(W, H); fxB = fxCanvas(W / 4, H / 4); }
  const a = fxA.getContext('2d'); a.globalCompositeOperation = 'copy'; a.filter = 'none'; a.drawImage(g.canvas, 0, 0); a.globalCompositeOperation = 'source-over';
  if (G) {
    if (G.contrast !== 1 || G.sat !== 1 || G.bright !== 1) { g.save(); g.globalCompositeOperation = 'copy'; g.filter = `brightness(${G.bright}) contrast(${G.contrast}) saturate(${G.sat})`; g.drawImage(fxA, 0, 0); g.restore(); a.globalCompositeOperation = 'copy'; a.drawImage(g.canvas, 0, 0); a.globalCompositeOperation = 'source-over'; }
    if (G.tintA) { g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = G.tintA; g.fillStyle = G.tint; g.fillRect(0, 0, W, H); g.restore(); }
    if (G.bloom) { const b = fxB.getContext('2d'); b.globalCompositeOperation = 'copy'; b.filter = 'brightness(.75) contrast(2.6) blur(7px)'; b.drawImage(fxA, 0, 0, W / 4, H / 4); b.filter = 'none';
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = G.bloom; g.drawImage(fxB, 0, 0, W, H); g.restore(); }
    if (G.ca) { // radial chromatic aberration: a red copy scaled up, blue removed from it, added on a red-less frame
      a.globalCompositeOperation = 'copy'; const s = 1 + G.ca; a.drawImage(g.canvas, -W * (s - 1) / 2, -H * (s - 1) / 2, W * s, H * s);
      a.globalCompositeOperation = 'multiply'; a.fillStyle = '#ff0000'; a.fillRect(0, 0, W, H); a.globalCompositeOperation = 'source-over';
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#00ffff'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; g.drawImage(fxA, 0, 0); g.restore(); }
    if (G.vig) { const v = g.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${G.vig})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  }
  if (wb > .5) { a.globalCompositeOperation = 'copy'; a.filter = 'none'; a.drawImage(g.canvas, 0, 0); const s = 1 + wz;
    g.save(); g.globalCompositeOperation = 'copy'; g.filter = `blur(${wb.toFixed(1)}px)`; g.drawImage(fxA, -W * (s - 1) / 2, -H * (s - 1) / 2, W * s, H * s); g.restore(); }
}
function drawFx(g, t) {
  for (const l of S.lines) { if (t < l.t0 || t >= l.t1) continue; const r = rng(1 + Math.floor(t * 15)); g.strokeStyle = l.color; g.lineCap = 'round';
    for (let i = 0; i < 28; i++) { const a = r() * Math.PI * 2, r0 = 600 + r() * 250, r1 = r0 + 200 + r() * 400; g.lineWidth = 3 + r() * 6;
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); g.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); g.stroke(); } }
  for (const f of S.flashes) { const dt = t - f.t; if (dt < 0 || dt > f.dur) continue; g.globalAlpha = 1 - dt / f.dur; g.fillStyle = f.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  for (const f of S.fades) { if (t < f.t0) continue; const a = t >= f.t1 ? f.to : lerp(f.from, f.to, (t - f.t0) / (f.t1 - f.t0)); if (a <= 0) continue; g.globalAlpha = a; g.fillStyle = f.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  // soft vignette (Roblox story look)
  if (!S.vig) { S.vig = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); S.vig.addColorStop(0, 'rgba(0,0,0,0)'); S.vig.addColorStop(1, 'rgba(0,0,0,.28)'); }
  g.fillStyle = S.vig; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- HUD: overlays + floating counters (additive, 2026-10-30, love)
const OVERLAYS = [], COUNTERS = [];
/** overlay(fn(g2d, t)): draw anything on the 2D layer above the 3D frame, under the captions */
export function overlay(fn) { OVERLAYS.push(fn); }
/** screenOf(worldVec3) -> {x, y, behind} in output pixels (current camera) */
export function screenOf(v) { const p = v.clone().project(S.camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, behind: p.z > 1 }; }
/** counter(a, { value, ticks:[[t,value],...], suffix:' days', size:60, off:[dx,dy,dz] (from head centre), dx/dy (px),
 *  color:'#3cff5a', show:[[t0,t1],...] (default always), sizes:[[t,size],...], pop:.35 })
 *  A bold green number floating by a's head (screen space, follows him). value may be a string ('?????').
 *  A tick pops the text bigger for `pop` s. Hidden when the avatar is hidden or off-camera. */
export function counter(a, o = {}) { const c = { a, value: o.value ?? 0, ticks: (o.ticks || []).slice().sort((x, y) => x[0] - y[0]), suffix: o.suffix ?? ' days',
  size: o.size || 60, sizes: (o.sizes || []).slice().sort((x, y) => x[0] - y[0]), off: o.off || [0, 1.4, 0], dx: o.dx || 0, dy: o.dy || 0, color: o.color || '#3cff5a', show: o.show, pop: o.pop ?? .35 };
  COUNTERS.push(c); return c; }
const fmtNum = v => typeof v === 'number' ? (v >= 100000 ? Math.round(v).toLocaleString('en-US').replace(/,/g, ' ') : String(Math.round(v))) : String(v);
function drawCounters(g, t) {
  for (const c of COUNTERS) {
    if (c.show && !c.show.some(([a, b]) => t >= a && t < b)) continue;
    if (c.a.root && !c.a.root.visible) continue;
    let v = c.value, tk = -1e9; for (const [tt, vv] of c.ticks) if (tt <= t) { v = vv; tk = tt; }
    let size = c.size; for (const [tt, ss] of c.sizes) if (tt <= t) size = ss;
    const pt = screenOf(c.a.headPos(c.off)); if (pt.behind) continue;
    const dt = t - tk, k = dt >= 0 && dt < c.pop ? 1 + .35 * Math.sin(Math.PI * dt / c.pop) : 1;
    const fs = size * k, txt = fmtNum(v) + c.suffix;
    g.save(); g.font = `900 ${fs}px Nunito`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = fs * .15; g.shadowOffsetY = fs * .06; g.lineWidth = Math.max(3, fs * .16); g.strokeStyle = '#0c2a10';
    g.strokeText(txt, pt.x + c.dx, pt.y + c.dy); g.shadowColor = 'transparent'; g.fillStyle = c.color; g.fillText(txt, pt.x + c.dx, pt.y + c.dy); g.restore();
  }
}

// ---------------------------------------------------------------- runtime (index.html calls these)
let renderer, out, octx;
export async function boot(videoUrl, tmap = null) {
  S.tmap = tmap; // tools/tighten.py: captions from a tightened audio.json are mapped back to the scene's OLD time
  S.videoUrl = videoUrl;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  out = document.createElement('canvas'); out.width = W; out.height = H; octx = out.getContext('2d');
  document.body.appendChild(out);
  const font = new FontFace('Nunito', `url(${new URL('fonts/nunito-900.woff2', ENGINE_URL).href})`, { weight: '900' }); document.fonts.add(await font.load());
  for (const n of FACE_NAMES) loadFace(n);
  if (!S.light) light('indoor');
}
export async function ready() { let n; do { n = S.loads.length; await Promise.all(S.loads); } while (S.loads.length !== n); if (!S.duration) S.duration = 5;
  for (const a of S.avatars) a.apply(0); renderer.compile(S.scene, S.camera); return S.duration; }
export function renderAt(t) {
  applyLight(t); for (const a of S.avatars) a.apply(t); for (const m of MOVERS) m.apply(t); for (const f of S.frameFns) f(t); S.scene.updateMatrixWorld(true); applyCamera(t);
  renderer.toneMappingExposure = S.exposure || 1; renderer.render(S.scene, S.camera);
  octx.drawImage(renderer.domElement, 0, 0); postFx(octx, t); drawFx(octx, t); drawCounters(octx, t); for (const f of OVERLAYS) f(octx, t); drawCaptions(octx, t); return out;
}
export function frameData(t, type = 'image/jpeg', q = .92) { renderAt(t); return out.toDataURL(type, q); }
export const state = S;
// ---------------------------------------------------------------- debug hooks for tools/check.mjs (additive, no effect on renders)
/** poseAt(t): put the whole scene + camera at time t without drawing (for checks) */
export function poseAt(t) { applyLight(t); for (const a of S.avatars) a.apply(t); for (const m of MOVERS) m.apply(t); for (const f of S.frameFns) f(t); S.scene.updateMatrixWorld(true); applyCamera(t); S.camera.updateMatrixWorld(true); }
/** collidables(): every mesh that is not part of an avatar (sets, props, custom boxes) */
export function collidables() {
  const own = new Set(); for (const a of S.avatars) a.root.traverse(o => own.add(o));
  const out = []; S.scene.traverse(o => { if (o.isMesh && !own.has(o)) out.push(o); }); return out;
}
if (typeof window !== 'undefined') window.__rbx = { state: S, poseAt, collidables, THREE, CAMDEF };

// ================================================================ 2026-10-31 ANY-TOPIC KIT (all additive; API.md "Any topic")
// ---------------------------------------------------------------- surfaces + skies
const TEX2 = {
  sand: rep => canvasTex('sand', 256, 256, (g, w, h) => speckle(g, w, h, '#e8d29a', 7000, ['#d9c07f', '#f3e2b3', '#cdb06c'], 2, 21), rep),
  snow: rep => canvasTex('snow', 256, 256, (g, w, h) => speckle(g, w, h, '#f4f8fc', 4000, ['#dfe8f2', '#ffffff', '#cfdbe8'], 3, 23), rep),
  asphalt: rep => canvasTex('asphalt', 256, 256, (g, w, h) => speckle(g, w, h, '#3c3f45', 8000, ['#2c2e33', '#4c5058', '#55585f'], 2, 25), rep),
  dirt: rep => canvasTex('dirt', 256, 256, (g, w, h) => speckle(g, w, h, '#8a6a45', 7000, ['#755838', '#9c7b52', '#6b5032'], 3, 27), rep),
  moon: rep => canvasTex('moon', 256, 256, (g, w, h) => { speckle(g, w, h, '#a9a9ad', 6000, ['#8e8e93', '#c2c2c6', '#77777c'], 3, 29); const r = rng(31);
    for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, rr = 6 + r() * 18; g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(x - 2, y - 2, rr * .8, 0, 7); g.fill(); } }, rep),
  checker: (rep, a = '#f4f4f4', b = '#c9241e') => canvasTex('chk' + a + b, 128, 128, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * w / 4, y * h / 4, w / 4, h / 4); } }, rep),
  water: rep => canvasTex('water', 256, 256, (g, w, h) => speckle(g, w, h, '#2f8fd8', 3000, ['#4aa8ec', '#1f74b8', '#7cc6f5'], 3, 33), rep),
  facade: (rep, base = '#c9b79a', win = '#9cc8ec', lit = false) => canvasTex('fac' + base + win + lit, 256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rng(41);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { g.fillStyle = lit && r() > .45 ? '#ffe39a' : win; g.fillRect(18 + x * 80, 16 + y * 62, 56, 40); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(18 + x * 80, 52 + y * 62, 56, 5); } }, rep),
  stars: () => canvasTex('stars', 1024, 512, (g, w, h) => { g.fillStyle = '#03040c'; g.fillRect(0, 0, w, h); const r = rng(43); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${.3 + r() * .7})`; const s = r() < .08 ? 2 : 1; g.fillRect(r() * w, r() * h, s, s); } }),
  earth: () => canvasTex('earth', 512, 256, (g, w, h) => { g.fillStyle = '#2a6fd0'; g.fillRect(0, 0, w, h); const r = rng(45); g.fillStyle = '#4f9a3c';
    for (let i = 0; i < 14; i++) { const x = r() * w, y = 40 + r() * (h - 80); for (let j = 0; j < 6; j++) { g.beginPath(); g.ellipse(x + (r() - .5) * 60, y + (r() - .5) * 40, 14 + r() * 26, 10 + r() * 18, r() * 3, 0, 7); g.fill(); } }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); }),
};
function skyTex(kind) {
  if (!kind || kind === 'day') return TEX.sky(false); if (kind === 'night') return TEX.sky(true); if (kind === 'space') return TEX2.stars();
  return canvasTex('sky_' + kind, 64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h);
    if (kind === 'sunset') { gr.addColorStop(0, '#3b3d8f'); gr.addColorStop(.45, '#e0679a'); gr.addColorStop(.75, '#ffa45c'); gr.addColorStop(1, '#ffe0a0'); }
    else if (kind === 'overcast') { gr.addColorStop(0, '#8e98a6'); gr.addColorStop(1, '#d9dee5'); }
    else if (kind === 'hot') { gr.addColorStop(0, '#4fa3e8'); gr.addColorStop(.7, '#bfe0f5'); gr.addColorStop(1, '#fff1d0'); }
    else if (kind === 'underwater') { gr.addColorStop(0, '#6fd0f0'); gr.addColorStop(1, '#0b4f7a'); }
    else { gr.addColorStop(0, kind); gr.addColorStop(1, kind); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}
const SKY_FOG = { day: '#cfe6fb', hot: '#f5ecd4', sunset: '#f2b38f', overcast: '#cfd5dc', night: '#0b1030', underwater: '#1f7fb0' };
/** surface name ('wood tile carpet concrete grass brick checker sand snow asphalt dirt moon water') or a colour -> texture */
function surface(kind, rep, c1, c2) {
  if (kind && kind.isTexture) return kind;
  switch (kind) { case 'wood': return TEX.wood(rep, c1 || '#7a4a2a'); case 'tile': return TEX.tile(rep, c1 || '#f3f5f8', c2 || '#9fb8d8'); case 'carpet': return TEX.carpet(rep, c1 || '#c9bfae');
    case 'concrete': return TEX.concrete(rep); case 'grass': return TEX.grass(rep); case 'brick': return TEX.brick(rep); case 'checker': return TEX2.checker(rep, c1, c2);
    case 'sand': case 'snow': case 'asphalt': case 'dirt': case 'moon': case 'water': return TEX2[kind](rep);
    default: return TEX.wall(rep, kind || c1 || '#cccccc'); }
}
const surfMat = (kind, rep, c1, c2, o = {}) => mat('#fff', { map: surface(kind, rep, c1, c2), rough: o.rough ?? .85 });
const WALLS = { back: '-z', front: '+z', left: '-x', right: '+x', n: '-z', s: '+z', w: '-x', e: '+x' };
function wallSpot(wall, at, y, W_, D_, inset = .05) { const k = WALLS[wall] || wall || '-z';
  if (k === '-z') return { pos: [at, y, -D_ / 2 + inset], rotY: 0 }; if (k === '+z') return { pos: [at, y, D_ / 2 - inset], rotY: 180 };
  if (k === '-x') return { pos: [-W_ / 2 + inset, y, at], rotY: 90 }; return { pos: [W_ / 2 - inset, y, at], rotY: -90 }; }

// ---------------------------------------------------------------- generic room / outdoor kits
/** room({ w=20, d=18, h=10, floor:'wood'|surface|colour, floorColor, floorColor2, wall:'#e8e2d6', wallLow, ceiling:true,
 *   windows:[{wall:'back'|'front'|'left'|'right', at:0, y:3, w:5, h:4, night}], doors:[{wall, at, color}], lights:true, night, at:[x,y,z] })
 * Builds a box room centred on [0,0,0] (or at `at`, like place()). Returns its light (for useLight). */
export function room(o = {}) {
  const build = () => {
    const w = o.w || 20, d = o.d || 18, h = o.h || 10, fine = /tile|checker/.test(o.floor || '') ? 2.5 : 4;
    _room({ w, d, h, floor: surface(o.floor || 'wood', [w / fine, d / fine], o.floorColor, o.floorColor2), wall: o.wall || '#e8e2d6', ceiling: o.ceiling !== false, wallLow: o.wallLow, baseboard: o.baseboard ?? '#ffffff' });
    for (const s of o.windows || []) { const p = wallSpot(s.wall, s.at || 0, s.y ?? 3, w, d); prop('window', { ...p, w: s.w || 5, h: s.h || 4, night: s.night ?? o.night, frame: s.frame }); }
    for (const s of o.doors || []) { const p = wallSpot(s.wall, s.at || 0, 0, w, d); prop('door', { ...p, color: s.color, window: s.window }); }
    if (o.lights !== false && o.ceiling !== false) { const xs = [], zs = []; for (let x = -w / 2 + 5; x <= w / 2 - 4; x += 10) xs.push(x); for (let z = -d / 2 + 5; z <= d / 2 - 4; z += 10) zs.push(z); ceilingLights(xs.length ? xs : [0], zs.length ? zs : [0], h - .01); }
    pointL([0, h - 1, 0], o.night ? '#9fb4ff' : '#fff1d8', o.night ? 14 : 30, Math.max(w, d) * 1.6);
    light(o.night ? 'night' : 'indoor', { center: [0, 0, 0], bg: o.night ? '#05081a' : (o.wall || '#e8e2d6'), shadowR: Math.max(20, Math.max(w, d) * .8), ...(o.light || {}) });
  };
  return o.at ? place(build, o.at) : set(build, { h: o.h, ceiling: o.ceiling });
}
/** outdoor({ ground:'grass'|'sand'|'snow'|'concrete'|'asphalt'|'dirt'|'moon'|colour, sky:'day'|'sunset'|'night'|'overcast'|'hot'|'space'|'underwater',
 *   path:{w,len,kind,x,z,alongX}, props:[[name, opts], ...], fog:true, size:200, at:[x,y,z] }) */
export function outdoor(o = {}) {
  const build = () => {
    const size = o.size || 200, sky = o.sky || 'day', night = sky === 'night' || sky === 'space';
    plane(size, size, surfMat(o.ground || 'grass', [size / 5, size / 5], o.groundColor), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor';
    if (o.path) { const p = o.path === true ? {} : o.path, len = p.len || 120; plane(p.w || 6, len, surfMat(p.kind || 'concrete', [1, len / 6]), [p.x || 0, .02, p.z || 0], [-90, 0, p.alongX ? 90 : 0]).userData.kind = 'floor'; }
    for (const [name, po] of o.props || []) prop(name, po || {});
    const fogC = SKY_FOG[sky];
    light(night ? 'night' : 'day', { center: [0, 0, 0], shadowR: 40, bg: fogC || '#000', fog: o.fog === false || !fogC ? null : [fogC, o.fogNear || 60, o.fogFar || 170],
      ...(sky === 'sunset' ? { sunColor: '#ffb27a', sun: 2.0, sky: '#ffd2b0', exposure: 1.0 } : sky === 'overcast' ? { sun: 1.0, hemi: 1.5 } : sky === 'space' ? { sun: 2.6, hemi: .35, ambI: .25, sunColor: '#ffffff' } : sky === 'underwater' ? { sunColor: '#a8e6ff', sky: '#9fe0ff', ground: '#0b4f7a' } : {}), ...(o.light || {}) });
    S.scene.background = skyTex(sky);
  };
  return o.at ? place(build, o.at) : set(build, {});
}

// ---------------------------------------------------------------- build(): any object from primitives
/** build([ {box:[w,h,d], at:[x,y,z], color, rot:[x,y,z] deg, r:roundness}, {cyl:[rTop,rBot,h], ...}, {ball:r, scale:[sx,sy,sz], ...},
 *   {cone:[r,h], ...}, {torus:[r,tube], ...}, {text:'HI', size:[w,h], bg, fg, ...} ], { pos, rotY, scale, name }) -> THREE.Group
 * at = the BOTTOM centre for box/cyl/cone/text, the CENTRE for ball/torus. Options per part: emissive, glow (emissive = own colour), opacity, metal, rough. */
export function build(parts, o = {}) {
  const g = new THREE.Group();
  for (const p of parts) {
    const c = p.color || '#cccccc', mo = { rough: p.rough, metal: p.metal, emissive: p.glow ? c : p.emissive, ei: p.ei };
    let m = p.opacity !== undefined && p.opacity < 1 ? (() => { const x = mat(c, { ...mo, noCache: true }).clone(); x.transparent = true; x.opacity = p.opacity; x.depthWrite = false; return x; })() : mat(c, mo);
    const at = p.at || [0, 0, 0]; let mesh;
    if (p.box) mesh = box(p.box[0], p.box[1], p.box[2], m, at, { parent: g, r: p.r });
    else if (p.cyl) mesh = cyl(p.cyl[0], p.cyl[1], p.cyl[2], m, at, { parent: g, seg: p.seg });
    else if (p.ball !== undefined) mesh = ball(p.ball, m, at, { parent: g });
    else if (p.cone) { mesh = new THREE.Mesh(new THREE.ConeGeometry(p.cone[0], p.cone[1], p.seg || 16), m); mesh.position.set(at[0], at[1] + p.cone[1] / 2, at[2]); g.add(mesh); }
    else if (p.torus) { mesh = new THREE.Mesh(new THREE.TorusGeometry(p.torus[0], p.torus[1], 10, 28), m); mesh.position.set(...at); g.add(mesh); }
    else if (p.text !== undefined) { const sz = p.size || [4, 1]; mesh = box(sz[0], sz[1], .1, mat('#fff', { map: textTex(p.text, sz[0], sz[1], p.bg || '#1f3f8f', p.fg || '#ffffff') }), at, { parent: g }); }
    else continue;
    if (p.rot) mesh.rotation.set(p.rot[0] * D2R, p.rot[1] * D2R, p.rot[2] * D2R);
    if (p.scale) mesh.scale.set(...p.scale);
    mesh.castShadow = p.shadow !== false; mesh.receiveShadow = true; if (p.name) mesh.name = p.name;
  }
  g.userData.prop = o.name || 'build'; g.position.set(...(o.pos || [0, 0, 0])); g.rotation.y = (o.rotY || 0) * D2R; if (o.scale) g.scale.setScalar(o.scale);
  (o.parent || S.scene).add(g); return g;
}
function textTex(text, w, h, bg, fg, maxFs = 84) {
  const cw = Math.max(128, Math.min(2048, Math.round(128 * w / h))), ch = 128;
  return canvasTex('txt' + text + w + 'x' + h + bg + fg + maxFs, cw, ch, (c, W_, H_) => { c.fillStyle = bg; c.fillRect(0, 0, W_, H_);
    const ls = String(text).split('\n'); let fs = Math.min(maxFs, (H_ * .8) / ls.length); c.font = `900 ${fs}px Nunito, sans-serif`;
    while (fs > 12 && Math.max(...ls.map(l => c.measureText(l).width)) > W_ * .9) { fs -= 3; c.font = `900 ${fs}px Nunito, sans-serif`; }
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; ls.forEach((l, i) => c.fillText(l, W_ / 2, H_ / 2 + 3 + (i - (ls.length - 1) / 2) * fs * 1.05)); });
}
/** sign(text, { pos, rotY, bg, color (text), w, h, post }) -> a sign sized to its text (h default 1.2). post:true puts it on a pole (pos = ground). */
export function sign(text, o = {}) {
  const h = o.h || 1.2, lines = String(text).split('\n'), longest = Math.max(...lines.map(l => l.length)), w = o.w || Math.max(2.4, longest * h * .62 / lines.length + .8);
  const g = build([...(o.post ? [{ box: [.25, o.postH || 5, .25], at: [0, 0, -.15], color: '#777' }] : []), { text, size: [w, h], bg: o.bg || '#1f3f8f', fg: o.color || '#ffffff', at: [0, o.post ? (o.postH || 5) : 0, 0] }], { pos: o.pos, rotY: o.rotY, scale: o.scale, name: 'sign', parent: o.parent });
  return g;
}

// ---------------------------------------------------------------- prop catalog additions (front = +z, y = 0 is the floor)
const bx = (g, w, h, d, c, p, o = {}) => box(w, h, d, c, p, { ...o, parent: g });
const cy = (g, rt, rb, h, c, p, o = {}) => cyl(rt, rb, h, c, p, { ...o, parent: g });
const bl = (g, r, c, p, o = {}) => ball(r, c, p, { ...o, parent: g });
const cn = (g, r, h, c, p, o = {}) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg || 16), c && c.isMaterial ? c : mat(c, o)); m.position.set(p[0], p[1] + h / 2, p[2]); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
const glass = (c = '#2a3d52', op = .35) => { const m = new THREE.MeshStandardMaterial({ color: col(c), roughness: .08, metalness: .1, transparent: true, opacity: op, depthWrite: false }); m.userData.glass = true; return m; };
const glow = (c, ei = 1.2) => mat(c, { emissive: c, ei });
function limbG(g, x, y, z, w, h, d, c) { const lg = new THREE.Group(); lg.position.set(x, y, z); g.add(lg); box(w, h, d, c, [0, -h, 0], { parent: lg, r: Math.min(.12, w / 3) }); return lg; }
function wheelM(g, r, wd, p, c = '#1b1b1b') { const m = cy(g, r, r, wd, c, [0, 0, 0], { seg: 18 }); m.position.set(...p); m.rotation.z = Math.PI / 2; bx(g, .1, r * .9, r * .9, '#c9c9c9', [p[0] + Math.sign(p[0] || 1) * wd / 2, p[1] - r * .45, p[2]]); return m; }
function eyes(g, y, z, sep = .3, s = .18) { for (const k of [1, -1]) { bx(g, s, s * 1.3, .06, '#111', [k * sep, y, z]); bx(g, s * .4, s * .45, .07, '#fff', [k * sep + .03, y + s * .65, z + .01]); } }
const P2 = {
  // ---- animals (move them with thing()/animal(): legs walk, wings flap, tail wags)
  dog: (o) => { const g = G(), c = o.color || '#c8894a', d = o.color2 || '#6b4423'; bx(g, 1.5, 1.3, 2.8, c, [0, 1.15, 0], { r: .3 });
    const legs = [[.5, 1], [-.5, 1], [.5, -1], [-.5, -1]].map(([x, z]) => limbG(g, x, 1.3, z, .45, 1.3, .45, c));
    bx(g, 1.3, 1.2, 1.2, c, [0, 1.9, 1.5], { r: .3 }); bx(g, .8, .55, .65, o.snout || '#e8c9a0', [0, 1.95, 2.3], { r: .15 }); bx(g, .32, .24, .14, '#111', [0, 2.35, 2.6], { r: .05 });
    eyes(g, 2.55, 2.11, .3); for (const k of [1, -1]) bx(g, .3, .75, .3, d, [k * .7, 2.2, 1.45], { r: .1 }); bx(g, 1.36, .26, .3, o.collar || '#c9241e', [0, 1.9, .86]);
    const tail = new THREE.Group(); tail.position.set(0, 2.2, -1.35); g.add(tail); const tm = bx(tail, .22, .22, .9, c, [0, 0, -.4], { r: .08 }); tm.rotation.x = .6;
    g.userData.legs = legs; g.userData.tail = tail; return g; },
  cat: (o) => { const g = G(), c = o.color || '#9a9a9a'; bx(g, 1.1, 1.0, 2.2, c, [0, .95, 0], { r: .3 });
    const legs = [[.35, .8], [-.35, .8], [.35, -.8], [-.35, -.8]].map(([x, z]) => limbG(g, x, 1.05, z, .32, 1.05, .32, c));
    bx(g, 1.1, 1.0, 1.0, c, [0, 1.6, 1.2], { r: .3 }); for (const k of [1, -1]) cn(g, .2, .45, c, [k * .33, 2.55, 1.15], { seg: 4 });
    bx(g, .45, .3, .1, o.color2 || '#f2f2f2', [0, 1.75, 1.72]); bx(g, .14, .1, .06, '#e87a9a', [0, 2.0, 1.76]); eyes(g, 2.1, 1.71, .24, .16);
    const tail = new THREE.Group(); tail.position.set(0, 1.8, -1.05); g.add(tail); const tm = bx(tail, .18, 1.4, .18, c, [0, 0, 0], { r: .08 }); tm.rotation.x = -.35;
    g.userData.legs = legs; g.userData.tail = tail; return g; },
  bird: (o) => { const g = G(), c = o.color || '#3a7fd8'; bl(g, .5, c, [0, .95, 0]).scale.set(1, .9, 1.3); bl(g, .36, c, [0, 1.5, .45]);
    const bk = cn(g, .12, .4, '#f2a51a', [0, 1.45, .95], { seg: 8 }); bk.rotation.x = Math.PI / 2; bk.position.set(0, 1.45, .9); eyes(g, 1.58, .78, .17, .1);
    const wings = [1, -1].map(k => { const wg = new THREE.Group(); wg.position.set(k * .45, 1.1, 0); g.add(wg); bx(wg, .9, .1, .7, o.color2 || c, [k * .45, 0, 0], { r: .04 }); return wg; });
    for (const k of [1, -1]) bx(g, .07, .5, .07, '#f2a51a', [k * .18, 0, 0]); g.userData.wings = wings; return g; },
  penguin: (o) => { const g = G(), c = o.color || '#1a1c22'; bx(g, 1.9, 2.6, 1.6, c, [0, .35, 0], { r: .3 }); bx(g, 1.4, 2.0, .2, '#f6f6f2', [0, .45, .75], { r: .08 });
    bx(g, 1.6, 1.3, 1.4, c, [0, 2.9, 0], { r: .3 }); bx(g, 1.1, .75, .15, '#f6f6f2', [0, 3.1, .66]); eyes(g, 3.35, .75, .27, .26); bx(g, .5, .25, .55, '#f29a1a', [0, 3.0, .9]);
    for (const k of [1, -1]) bx(g, .6, .2, .8, '#f29a1a', [k * .45, 0, .25]);
    const wings = [1, -1].map(k => { const wg = new THREE.Group(); wg.position.set(k * 1.0, 2.6, 0); g.add(wg); bx(wg, .2, 1.6, .8, c, [k * .05, -1.6, 0]); return wg; }); g.userData.wings = wings; g.userData.flap = .5; return g; },
  fish: (o) => { const g = G(), c = o.color || '#f28c1a'; bl(g, .6, c, [0, 0, 0]).scale.set(.55, .85, 1.4); eyes(g, .15, .62, .2, .12);
    const tail = new THREE.Group(); tail.position.set(0, 0, -.75); g.add(tail); const tm = cn(tail, .45, .6, o.color2 || c, [0, 0, 0], { seg: 4 }); tm.rotation.x = Math.PI / 2; tm.position.set(0, 0, -.25); tm.scale.set(.3, 1, 1);
    g.userData.tail = tail; g.userData.wag = 9; return g; },
  shark: (o) => { const g = G(), c = o.color || '#7d8a96'; bx(g, 1.8, 1.8, 6, c, [0, 0, 0], { r: .7 }); bx(g, 1.5, .6, 4.5, '#e9edf0', [0, -.05, .4], { r: .3 });
    const f = cn(g, .7, 1.6, c, [0, 1.5, -.2], { seg: 4 }); f.scale.set(.25, 1, 1); for (let i = 0; i < 6; i++) cn(g, .09, .22, '#fff', [-.5 + i * .2, .45, 2.95], { seg: 4 }).rotation.x = Math.PI;
    eyes(g, 1.1, 2.6, .55, .18); const tail = new THREE.Group(); tail.position.set(0, .9, -3); g.add(tail); bx(tail, .3, 2.2, 1.2, c, [0, -1.1, -.5], { r: .2 }); g.userData.tail = tail; g.userData.wag = 3; return g; },
  dinosaur: (o) => { const g = G(), c = o.color || '#4f8f3e', b = o.color2 || '#a7c96a';
    const legs = [1, -1].map(k => limbG(g, k * 1.2, 4.2, -.4, 1.2, 4.2, 1.5, c)); for (const lg of legs) bx(lg, 1.4, .5, 2.0, c, [0, -4.2, .4], { r: .15 });
    const body = bx(g, 3.2, 3.4, 5.2, c, [0, 3.4, -.6], { r: .6 }); body.rotation.x = -.18; bx(g, 2.2, 2.6, .3, b, [0, 3.7, 1.95], { r: .1 }).rotation.x = -.18;
    bx(g, 1.9, 2.0, 1.6, c, [0, 6.0, 1.7], { r: .4 }); const headG = new THREE.Group(); headG.position.set(0, 7.4, 2.2); g.add(headG);
    bx(headG, 2.4, 1.6, 3.4, c, [0, -.3, .9], { r: .4 }); const jaw = new THREE.Group(); jaw.position.set(0, -.3, -.2); headG.add(jaw); bx(jaw, 2.2, .6, 3.1, c, [0, -.6, 1.4], { r: .2 });
    for (let i = 0; i < 7; i++) for (const s of [1, -1]) cn(headG, .1, .32, '#fff', [s * 1.0, -.62, .9 + i * .38], { seg: 4 }).rotation.x = Math.PI;
    for (const k of [1, -1]) { bx(headG, .5, .45, .1, '#fff', [k * .75, .55, 1.9]); bx(headG, .26, .3, .1, '#111', [k * .75, .6, 1.96]); bx(headG, .7, .2, .5, c, [k * .7, 1.1, 1.6]); }
    for (const k of [1, -1]) { const a = bx(g, .4, 1.3, .4, c, [k * 1.35, 4.4, 2.0], { r: .12 }); a.rotation.x = -.9; }
    bx(g, 2.2, 2.0, 3.0, c, [0, 3.9, -4.1], { r: .5 }); bx(g, 1.4, 1.3, 3.0, c, [0, 4.1, -6.8], { r: .4 }); bx(g, .8, .8, 2.6, c, [0, 4.3, -9.3], { r: .3 });
    g.userData.legs = legs; g.userData.jaw = jaw; g.userData.legAmp = .45; return g; },
  cow: (o) => { const g = G(), c = o.color || '#f4f4f2'; bx(g, 2.2, 2.0, 4.2, c, [0, 2.0, 0], { r: .3 }); for (const [x, z] of [[.6, 1.2], [-.4, -.6]]) bx(g, .9, .8, 1.2, '#1a1a1a', [x * 1.4 > 0 ? 1.12 : -1.12, 2.6, z], { r: .1 });
    const legs = [[.7, 1.5], [-.7, 1.5], [.7, -1.5], [-.7, -1.5]].map(([x, z]) => limbG(g, x, 2.1, z, .55, 2.1, .55, c));
    bx(g, 1.5, 1.4, 1.5, c, [0, 3.2, 2.5], { r: .25 }); bx(g, 1.2, .7, .5, '#f2b3b3', [0, 3.2, 3.3], { r: .15 }); eyes(g, 4.1, 3.26, .38); for (const k of [1, -1]) cn(g, .12, .45, '#e8e0c8', [k * .6, 4.6, 2.4]);
    g.userData.legs = legs; return g; },
  // ---- vehicles (wheels spin when a thing() moves)
  car: (o) => { const g = G(), c = o.color || '#d12b2b'; bx(g, 4.4, 1.5, 9, c, [0, .7, 0], { r: .35, metal: .2, rough: .35 }); bx(g, 4.0, 1.6, 4.6, c, [0, 2.1, -.6], { r: .35, metal: .2, rough: .35 });
    const gl = glass('#1d2b3a', .75); bx(g, 3.7, 1.3, .12, gl, [0, 2.25, 1.72]); bx(g, 3.7, 1.3, .12, gl, [0, 2.25, -2.92]); for (const k of [1, -1]) bx(g, .12, 1.15, 4.1, gl, [k * 2.02, 2.3, -.6]);
    const wheels = []; for (const x of [2.15, -2.15]) for (const z of [2.9, -2.9]) wheels.push(wheelM(g, .8, .6, [x, .8, z]));
    for (const k of [1, -1]) { bx(g, .8, .4, .1, glow('#fff6c8', 1.5), [k * 1.45, 1.35, 4.5]); bx(g, .7, .35, .1, glow('#ff2a2a', 1.2), [k * 1.5, 1.4, -4.5]); }
    bx(g, 4.5, .45, .5, '#2b2b2b', [0, .55, 4.35], { r: .1 }); bx(g, 4.5, .45, .5, '#2b2b2b', [0, .55, -4.35], { r: .1 }); g.userData.wheels = wheels; return g; },
  bus: (o) => { const g = G(), c = o.color || '#f2c21a'; bx(g, 5, 5.2, 18, c, [0, 1.0, 0], { r: .4 }); const gl = glass('#1d2b3a', .8);
    for (const k of [1, -1]) bx(g, .1, 1.7, 14.5, gl, [k * 2.52, 3.5, -.8]); bx(g, 4.3, 2.3, .1, gl, [0, 3.0, 9.02]); bx(g, 5.06, .25, 18.06, '#111', [0, 2.7, 0]);
    const wheels = []; for (const x of [2.45, -2.45]) for (const z of [6, -6]) wheels.push(wheelM(g, 1.0, .7, [x, 1.0, z])); if (o.text !== '') { for (const k of [1, -1]) { const s = build([{ text: o.text || 'SCHOOL BUS', size: [9, 1.1], bg: c, fg: '#111' }], { parent: g, pos: [k * 2.56, 5.0, -1], rotY: k * 90 }); void s; } }
    g.userData.wheels = wheels; return g; },
  bike: (o) => { const g = G(), c = o.color || '#1f9fd1'; const wheels = [1.3, -1.3].map(z => { const t = new THREE.Mesh(new THREE.TorusGeometry(.85, .1, 8, 24), mat('#1b1b1b')); t.position.set(0, .95, z); t.rotation.y = Math.PI / 2; t.castShadow = true; g.add(t); return t; });
    const f1 = bx(g, .14, .14, 2.6, c, [0, 1.9, 0]); f1.rotation.x = .1; const f2 = bx(g, .14, 1.3, .14, c, [0, .95, -.5]); f2.rotation.x = -.3; const f3 = bx(g, .14, 1.3, .14, c, [0, .95, 1.2]); f3.rotation.x = .3;
    bx(g, .5, .15, .8, '#222', [0, 2.3, -.6], { r: .05 }); bx(g, 1.6, .12, .12, '#555', [0, 2.6, 1.3]); g.userData.wheels = wheels; g.userData.wheelAxis = 'z'; return g; },
  boat: (o) => { const g = G(), c = o.color || '#ffffff'; bx(g, 4, 1.6, 10, c, [0, 0, 0], { r: .6 }); bx(g, 4.05, .3, 10.05, o.stripe || '#c9241e', [0, 1.0, 0]); bx(g, 3, 1.8, 3, c, [0, 1.6, -1], { r: .2 }); bx(g, 2.8, .8, .1, glass(), [0, 2.4, .52]); return g; },
  rocket: (o) => { const g = G(), c = o.color || '#f4f4f4'; cy(g, 1.4, 1.4, 9, c, [0, 1.2, 0], { metal: .3, rough: .3 }); cn(g, 1.4, 3, o.nose || '#c9241e', [0, 10.2, 0]);
    bl(g, .55, mat('#7fc8ff', { emissive: '#2a6fb0', ei: .5, rough: .1 }), [0, 7.5, 1.25]); for (let i = 0; i < 4; i++) { const f = bx(g, .2, 2.6, 1.6, o.nose || '#c9241e', [Math.cos(i * Math.PI / 2) * 1.6, 0, Math.sin(i * Math.PI / 2) * 1.6]); f.rotation.y = -i * Math.PI / 2 + Math.PI / 2; }
    const fl = cn(g, 1.1, 3.2, glow('#ff9a2a', 2), [0, -2.2, 0]); fl.rotation.x = Math.PI; fl.position.y = -0.4; fl.visible = !!o.flame; g.userData.flame = fl; return g; },
  ufo: (o) => { const g = G(); const d = cy(g, 4, 4, .9, mat(o.color || '#a9b3bd', { metal: .7, rough: .25 }), [0, 0, 0], { seg: 32 }); d.scale.set(1, 1, 1); cy(g, 2.4, 4, .5, mat('#8a949e', { metal: .7, rough: .3 }), [0, -.5, 0], { seg: 32 });
    bl(g, 1.8, glass('#9fe7ff', .55), [0, .9, 0]).scale.set(1, .7, 1); for (let i = 0; i < 10; i++) bl(g, .2, glow(i % 2 ? '#7dff6a' : '#ffe14a', 2), [Math.cos(i * .628) * 3.7, .45, Math.sin(i * .628) * 3.7]);
    if (o.beam) { const m = new THREE.MeshBasicMaterial({ color: 0xbfffb0, transparent: true, opacity: .28, depthWrite: false }); m.userData.glass = true; const b = new THREE.Mesh(new THREE.ConeGeometry(4, o.beamH || 14, 24, 1, true), m); b.position.y = -(o.beamH || 14) / 2 - .5; g.add(b); }
    return g; },
  // ---- indoor
  shelf: (o) => { const g = G(), w = o.w || 8, r = rng(o.seed || 3), cols = o.colors || ['#d12b2b', '#f2c21a', '#2b62d9', '#2bb04a', '#ff7a2a', '#9a4fd8', '#f4f4f4'];
    bx(g, w, 6.2, .3, '#d8d8d8', [0, 0, -.75]); for (const k of [1, -1]) bx(g, .2, 6.2, 1.8, '#c4c4c4', [k * w / 2, 0, 0]);
    for (const y of [.25, 1.75, 3.25, 4.75]) { bx(g, w, .15, 1.6, '#bdbdbd', [0, y, 0]); let x = -w / 2 + .35; while (x < w / 2 - .5) { const pw = .45 + r() * .4, ph = .5 + r() * .7; bx(g, pw, ph, .9, cols[(r() * cols.length) | 0], [x + pw / 2, y + .15, .1], { r: .04 }); x += pw + .1; } } return g; },
  register: (o) => { const g = G(); bx(g, 4.2, 3, 2, o.color || '#e9e4da', [0, 0, 0]); bx(g, 4.4, .2, 2.2, '#3a3a3e', [0, 3, 0]); bx(g, 1.4, .8, 1.0, '#2b2b2b', [-.8, 3.2, 0], { r: .08 });
    const s = bx(g, 1.1, .7, .08, glow('#6ad1ff', .9), [-.8, 4.0, .1]); s.rotation.x = -.3; bx(g, 1.0, .1, 3.5, '#222', [1.2, 3.2, 0]); return g; },
  office_desk: (o) => { const g = G(); bx(g, 5, .2, 2.4, mat('#fff', { map: TEX.wood([1, 1], o.color || '#b98a5a') }), [0, 2.4, 0]); bx(g, .2, 2.4, 2.2, '#8c8c8c', [-2.3, 0, 0]); bx(g, .2, 2.4, 2.2, '#8c8c8c', [2.3, 0, 0]); bx(g, 4.4, 1.4, .1, '#8c8c8c', [0, 1.0, -1.05]); return g; },
  computer: (o) => { const g = G(); bx(g, .7, .1, .5, '#222', [0, 0, 0]); bx(g, .15, .7, .15, '#222', [0, .1, 0]); bx(g, 2.0, 1.25, .12, '#111', [0, .75, 0], { r: .04 });
    bx(g, 1.85, 1.1, .02, glow(o.screen || '#3a8fe0', .9), [0, .82, .07], { cast: false }); bx(g, 1.6, .06, .55, '#2a2a2a', [0, 0, .7]); return g; },
  laptop: (o) => { const g = G(); bx(g, 1.4, .08, 1.0, o.color || '#9aa3ab', [0, 0, 0], { r: .03 }); const s = new THREE.Group(); s.position.set(0, .08, -.48); s.rotation.x = -.25; g.add(s);
    bx(s, 1.4, .95, .06, o.color || '#9aa3ab', [0, 0, 0], { r: .03 }); bx(s, 1.28, .82, .02, glow(o.screen || '#5aa8f0', .9), [0, .06, .04], { cast: false }); return g; },
  office_chair: (o) => { const g = G(), c = o.color || '#2b2b2b'; for (let i = 0; i < 5; i++) { const a = bx(g, .2, .15, 1.0, '#555', [Math.sin(i * 1.257) * .5, 0, Math.cos(i * 1.257) * .5]); a.rotation.y = i * 1.257; }
    bx(g, .2, 1.3, .2, '#777', [0, .1, 0]); bx(g, 1.8, .3, 1.8, c, [0, 1.4, 0], { r: .12 }); bx(g, 1.7, 2.0, .3, c, [0, 1.7, -.85], { r: .15 }); return g; },
  cubicle: (o) => { const g = G(), c = o.color || '#7c8fa8'; bx(g, 6, 4.2, .25, c, [0, 0, -1.6], { r: .05 }); bx(g, .25, 4.2, 4, c, [-3, 0, .3], { r: .05 }); bx(g, .25, 4.2, 4, c, [3, 0, .3], { r: .05 });
    prop('office_desk', { parent: g, pos: [0, 0, -.6] }); prop('computer', { parent: g, pos: [0, 2.6, -1.0] }); prop('office_chair', { parent: g, pos: [0, 0, 1.2], rotY: 180 }); return g; },
  water_cooler: () => { const g = G(); bx(g, 1.2, 3, 1.2, '#e9edf0', [0, 0, 0], { r: .1 }); const m = glass('#7fc8ff', .6); cy(g, .55, .55, 1.6, m, [0, 3, 0]); return g; },
  hospital_bed: (o) => { const g = G(); for (const z of [-3.6, 3.6]) for (const x of [-1.8, 1.8]) bx(g, .2, 1.4, .2, '#bfc6cc', [x, 0, z]); bx(g, 4, .5, 8, '#d9dee2', [0, 1.4, 0]);
    bx(g, 3.8, .5, 7.8, '#ffffff', [0, 1.9, 0], { r: .15 }); bx(g, 3.8, .45, 4.5, o.color || '#9fd0e8', [0, 2.2, 1.6], { r: .15 }); bx(g, 2.2, .45, 1.1, '#fff', [0, 2.35, -3.1], { r: .2 });
    bx(g, 4, 3.6, .3, '#d9dee2', [0, 0, -4.1], { r: .1 }); for (const k of [1, -1]) bx(g, .12, .9, 4, '#aab3ba', [k * 2.05, 2.1, -1], { metal: .5 }); return g; },
  iv_stand: () => { const g = G(); bx(g, 1.2, .1, 1.2, '#999', [0, 0, 0]); cy(g, .06, .06, 6, '#bbb', [0, 0, 0], { metal: .6 }); bx(g, .6, .9, .2, glass('#e8f6ff', .8), [.35, 4.6, 0]); return g; },
  heart_monitor: () => { const g = G(); cy(g, .06, .06, 4.5, '#bbb', [0, 0, 0], { metal: .6 }); bx(g, 1.8, 1.3, .6, '#3a3f45', [0, 4.5, 0], { r: .08 });
    const t = canvasTex('ecg', 256, 128, (c, w, h) => { c.fillStyle = '#071a0e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3cff5a'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 70); for (const [x, y] of [[60, 70], [75, 20], [90, 110], [105, 70], [170, 70], [185, 25], [200, 105], [215, 70], [256, 70]]) c.lineTo(x, y); c.stroke(); });
    bx(g, 1.55, 1.05, .02, mat('#fff', { map: t, emissive: '#2aff4a', ei: .3 }), [0, 4.62, .31], { cast: false }); return g; },
  curtain: (o) => { const g = G(), w = o.w || 6; bx(g, w, .12, .12, '#bbb', [0, 7.4, 0]); for (let i = 0; i < Math.round(w / .8); i++) bx(g, .85, 6.6, .18, o.color || '#9fd0e8', [-w / 2 + .4 + i * .8, .7, (i % 2) * .14 - .07]); return g; },
  toilet: () => { const g = G(); cy(g, .55, .45, 1.4, '#ffffff', [0, 0, .3]); cy(g, .78, .7, .3, '#ffffff', [0, 1.4, .45]); cy(g, .8, .8, .08, '#f0f0f0', [0, 1.7, .45]); bx(g, 1.6, 1.6, .7, '#ffffff', [0, 1.4, -.65], { r: .12 }); return g; },
  sink: () => { const g = G(); bx(g, 2.4, 2.8, 1.6, '#e9e4da', [0, 0, 0]); bx(g, 2.5, .2, 1.7, '#f7f7f7', [0, 2.8, 0]); bx(g, 1.4, .1, .9, '#9fb8c8', [0, 2.95, .1]); cy(g, .07, .07, .6, '#bbb', [0, 3.0, -.55], { metal: .7 }); bx(g, .12, .12, .5, '#bbb', [0, 3.5, -.4], { metal: .7 }); return g; },
  mirror: (o) => { const g = G(); bx(g, (o.w || 2.4) + .2, (o.h || 3.2) + .2, .1, '#c9c9c9', [0, 0, 0]); bx(g, o.w || 2.4, o.h || 3.2, .05, mat('#cfe6f2', { metal: .6, rough: .05 }), [0, .1, .06], { cast: false }); return g; },
  bathtub: (o) => { const g = G(); bx(g, 3.4, 2, 7, '#ffffff', [0, 0, 0], { r: .3 }); bx(g, 2.8, .1, 6.4, mat('#7fc8ff', { rough: .1, emissive: '#2a7fc0', ei: .25 }), [0, o.water === false ? .3 : 1.7, 0], { cast: false }); return g; },
  pizza_oven: () => { const g = G(); bx(g, 5, 5, 3.5, mat('#fff', { map: TEX.brick([2, 2]) }), [0, 0, 0]); bx(g, 2.4, 1.6, .2, '#1a0e08', [0, 1.6, 1.68]); bx(g, 2.0, .6, .1, glow('#ff7a1a', 2.0), [0, 1.7, 1.72]); bx(g, 1.2, 3, 1.2, mat('#fff', { map: TEX.brick([1, 1]) }), [0, 5, 0]); return g; },
  booth: (o) => { const g = G(), c = o.color || '#c9241e', w = o.w || 5; bx(g, w, 1.6, 2, c, [0, 0, 0], { r: .15 }); bx(g, w, 3.6, .7, c, [0, 0, -1.2], { r: .2 }); return g; },
  pizza: (o) => { const g = G(); cy(g, o.r || 1, o.r || 1, .14, '#e3a64a', [0, 0, 0], { seg: 24 }); cy(g, (o.r || 1) * .88, (o.r || 1) * .88, .05, '#d8462a', [0, .14, 0], { seg: 24 });
    const r = rng(9); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * .65 * (o.r || 1); cy(g, .14, .14, .05, '#9c1f1a', [Math.cos(a) * d, .19, Math.sin(a) * d]); } return g; },
  cake: () => { const g = G(); cy(g, 1.2, 1.2, .8, '#f7d6e0', [0, 0, 0], { seg: 24 }); cy(g, .85, .85, .7, '#ffffff', [0, .8, 0], { seg: 24 }); for (let i = 0; i < 5; i++) { cy(g, .05, .05, .45, '#6ad1ff', [Math.cos(i * 1.256) * .5, 1.5, Math.sin(i * 1.256) * .5]); bl(g, .07, glow('#ffb02a', 2), [Math.cos(i * 1.256) * .5, 2.02, Math.sin(i * 1.256) * .5]); } return g; },
  burger: () => { const g = G(); cy(g, .6, .55, .25, '#d99a4a', [0, 0, 0]); cy(g, .63, .63, .18, '#5a3218', [0, .25, 0]); cy(g, .66, .66, .06, '#f2c21a', [0, .43, 0]); cy(g, .64, .64, .06, '#4fae3a', [0, .49, 0]); bl(g, .6, '#e0a24e', [0, .58, 0]).scale.set(1, .55, 1); return g; },
  cup: (o) => { const g = G(); cy(g, .3, .24, .7, o.color || '#ffffff', [0, 0, 0]); cy(g, .26, .26, .02, o.drink || '#5a3218', [0, .66, 0]); return g; },
  book: (o) => { const g = G(); bx(g, .8, 1.1, .22, o.color || '#2b62d9', [0, 0, 0], { r: .02 }); bx(g, .74, 1.04, .2, '#f4f0e6', [.04, .03, 0]); return g; },
  bookshelf: (o) => { const g = G(), w = o.w || 5, r = rng(7); bx(g, w, 7, 1.4, mat('#fff', { map: TEX.wood([1, 1], '#6e4326') }), [0, 0, 0]);
    for (const y of [.4, 2.2, 4.0, 5.6]) { let x = -w / 2 + .3; while (x < w / 2 - .4) { const bw = .22 + r() * .2, bh = 1.0 + r() * .5; bx(g, bw, Math.min(bh, 1.5), 1.0, ['#c9241e', '#2b62d9', '#2bb04a', '#f2c21a', '#6a3fc9'][(r() * 5) | 0], [x + bw / 2, y, .25]); x += bw + .04; } } return g; },
  painting: (o) => { const g = G(), w = o.w || 3, h = o.h || 2.2; bx(g, w + .3, h + .3, .12, o.frame || '#8a5a34', [0, 0, 0]);
    const t = canvasTex('paint' + (o.seed || 1), 192, 128, (c, W_, H_) => { const r = rng(o.seed || 1); c.fillStyle = ['#9ccaf7', '#f7c59c', '#c9e8a0'][(r() * 3) | 0]; c.fillRect(0, 0, W_, H_); c.fillStyle = '#5e9a3c'; c.beginPath(); c.ellipse(W_ * .3, H_, W_ * .5, H_ * .45, 0, 0, 7); c.fill(); c.fillStyle = '#4d8530'; c.beginPath(); c.ellipse(W_ * .8, H_, W_ * .45, H_ * .35, 0, 0, 7); c.fill(); c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(W_ * .78, H_ * .28, 14, 0, 7); c.fill(); });
    bx(g, w, h, .02, mat('#fff', { map: t }), [0, .15, .07], { cast: false }); return g; },
  clock: () => { const g = G(); const t = canvasTex('clock', 128, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 8; c.beginPath(); c.arc(64, 64, 56, 0, 7); c.stroke(); c.lineWidth = 6; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 24); c.moveTo(64, 64); c.lineTo(92, 64); c.stroke(); });
    const m = cy(g, .8, .8, .12, mat('#fff', { map: t }), [0, 0, 0], { seg: 28 }); m.rotation.x = Math.PI / 2; m.position.set(0, .8, 0); return g; },
  crate: (o) => { const g = G(), s = o.size || 2; bx(g, s, s, s, mat('#fff', { map: TEX.wood([1, 1], '#a8763f') }), [0, 0, 0]); return g; },
  ball: (o) => { const g = G(), r = o.r || .6; bl(g, r, o.color || '#e8462a', [0, r, 0]); return g; },
  gift: (o) => { const g = G(), s = o.size || 1.4; bx(g, s, s, s, o.color || '#c9241e', [0, 0, 0]); bx(g, s + .02, s + .02, .25, o.ribbon || '#f2c21a', [0, 0, 0]); bx(g, .25, s + .02, s + .02, o.ribbon || '#f2c21a', [0, 0, 0]); bl(g, .25, o.ribbon || '#f2c21a', [0, s + .1, 0]); return g; },
  money: (o) => { const g = G(), n = o.n || 4; for (let i = 0; i < n; i++) { bx(g, 1.4, .3, .7, '#5cb85c', [((i * 7) % 3 - 1) * .1, i * .3, 0]); bx(g, .3, .31, .71, '#f2f2f2', [((i * 7) % 3 - 1) * .1, i * .3, 0]); } return g; },
  trophy: () => { const g = G(), gold = mat('#f2c21a', { metal: .7, rough: .25 }); bx(g, 1, .4, 1, '#3a2a1a', [0, 0, 0]); cy(g, .12, .2, .8, gold, [0, .4, 0]); cy(g, .6, .25, 1.0, gold, [0, 1.2, 0]); return g; },
  portal: (o) => { const g = G(), c = o.color || '#9a4fff', r = o.r || 3; const t = new THREE.Mesh(new THREE.TorusGeometry(r, .35, 12, 40), glow(c, 2)); t.position.y = r + .4; g.add(t);
    const m = new THREE.MeshBasicMaterial({ color: col(c), transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }); m.userData.glass = true; const d = new THREE.Mesh(new THREE.CircleGeometry(r - .2, 40), m); d.position.y = r + .4; g.add(d); g.userData.spin = d; return g; },
  tombstone: (o) => { const g = G(); bx(g, 2, 3, .6, '#8e9196', [0, 0, 0], { r: .3 }); build([{ text: o.text || 'RIP', size: [1.6, .7], bg: '#8e9196', fg: '#3a3a3a', at: [0, 1.6, .31] }], { parent: g }); return g; },
  stairs: (o) => { const g = G(), n = o.n || 8, w = o.w || 4, sh = o.step || .75; for (let i = 0; i < n; i++) bx(g, w, sh * (i + 1), 1.2, o.color || '#b98a5a', [0, 0, -i * 1.2]); return g; },
  // ---- outdoor
  palm: (o) => { const g = G(); let x = 0; for (let i = 0; i < 7; i++) { const s = bx(g, .6, 1.3, .6, '#9a7246', [x, i * 1.25, 0], { r: .15 }); s.rotation.z = -.08; x += .18; }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Group(); l.position.set(x, 8.8, 0); l.rotation.y = a; g.add(l); const lf = bx(l, .9, .15, 4, '#3f9a3c', [0, 0, 2], { r: .05 }); lf.rotation.x = .45; }
    for (let i = 0; i < 3; i++) bl(g, .3, '#6b4a2b', [x + Math.cos(i * 2.1) * .4, 8.5, Math.sin(i * 2.1) * .4]); return g; },
  pine: (o) => { const g = G(), c = o.color || '#2f6e3a'; cy(g, .4, .5, 2.4, '#6b4a2b', [0, 0, 0]); for (let i = 0; i < 3; i++) { cn(g, 3 - i * .7, 3.2, c, [0, 2 + i * 2, 0], { seg: 8 }); if (o.snow) cn(g, (3 - i * .7) * .55, 1.5, '#f6f9fc', [0, 3.8 + i * 2, 0], { seg: 8 }); } return g; },
  rock: (o) => { const g = G(), s = o.size || 1.5, r = rng(o.seed || 5); for (let i = 0; i < 3; i++) bl(g, s * (.6 + r() * .4), o.color || '#8e9196', [(r() - .5) * s, s * .35, (r() - .5) * s]).scale.set(1, .65, 1); return g; },
  cactus: () => { const g = G(), c = '#4f8f3e'; cy(g, .55, .6, 5, c, [0, 0, 0]); bl(g, .55, c, [0, 5, 0]); for (const [k, y, h] of [[1, 1.8, 1.6], [-1, 2.6, 1.3]]) { bx(g, 1.0, .5, .5, c, [k * .8, y, 0], { r: .2 }); cy(g, .3, .3, h, c, [k * 1.25, y, 0]); bl(g, .3, c, [k * 1.25, y + h, 0]); } return g; },
  snowman: () => { const g = G(); bl(g, 1.4, '#f8fbff', [0, 1.3, 0]); bl(g, 1.0, '#f8fbff', [0, 3.2, 0]); bl(g, .7, '#f8fbff', [0, 4.6, 0]); const n = cn(g, .14, .7, '#f28c1a', [0, 4.6, .95], { seg: 8 }); n.rotation.x = Math.PI / 2; n.position.set(0, 4.6, .9);
    for (const k of [1, -1]) bl(g, .09, '#111', [k * .25, 4.85, .62]); cy(g, .8, .8, .1, '#111', [0, 5.15, 0]); cy(g, .5, .5, .9, '#111', [0, 5.2, 0]); return g; },
  igloo: () => { const g = G(); const d = bl(g, 4, mat('#fff', { map: TEX2.snow([4, 4]) }), [0, 0, 0]); d.scale.set(1, .8, 1); const e = cy(g, 1.4, 1.4, 2.5, '#f4f8fc', [0, 0, 3.6]); e.rotation.x = Math.PI / 2; e.position.set(0, 1.0, 4.0); return g; },
  umbrella: (o) => { const g = G(); cy(g, .07, .07, 5, '#eee', [0, 0, 0]); cn(g, 3, 1.2, o.color || '#e8467c', [0, 4.6, 0], { seg: 10 }); g.userData.holdAt = [0, 1.3, 0]; return g; },
  towel: (o) => { const g = G(); const t = canvasTex('towel' + (o.color || ''), 64, 128, (c, w, h) => { c.fillStyle = o.color || '#ff7aa8'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) c.fillRect(0, 10 + i * 30, w, 10); });
    bx(g, 2.4, .06, 4.5, mat('#fff', { map: t }), [0, 0, 0], { cast: false }); return g; },
  street_lamp: (o) => { const g = G(); cy(g, .15, .2, 8, '#3a3d42', [0, 0, 0]); bx(g, .2, .2, 2, '#3a3d42', [0, 7.8, .9]); bx(g, .9, .3, .9, glow('#fff3c8', o.on ? 2.2 : .6), [0, 7.5, 1.8]);
    if (o.on) { const l = new THREE.PointLight('#ffe2a0', 25, 18, 1.6); l.position.set(0, 7, 1.8); g.add(l); } return g; },
  traffic_light: (o) => { const g = G(); cy(g, .15, .15, 6, '#3a3d42', [0, 0, 0]); bx(g, .9, 2.4, .7, '#222', [0, 6, 0], { r: .1 });
    ['red', 'yellow', 'green'].forEach((k, i) => bl(g, .28, (o.state || 'red') === k ? glow({ red: '#ff2a2a', yellow: '#ffc21a', green: '#2aff6a' }[k], 2) : '#333', [0, 7.95 - i * .75, .32])); return g; },
  building: (o) => { const g = G(), w = o.w || 12, h = o.h || 24, d = o.d || 12; bx(g, w, h, d, mat('#fff', { map: TEX2.facade([w / 6, h / 7], o.color || '#c9b79a', '#9cc8ec', o.lit), rough: .9 }), [0, 0, 0]); bx(g, w + .4, .6, d + .4, '#8a8a86', [0, h, 0]); return g; },
  house: (o) => { const g = G(), c = o.color || '#e8d9b8', roof = o.roof || '#8c3a2e'; bx(g, 14, 7.5, 11, c, [0, 0, 0]);
    for (const k of [1, -1]) { const r = bx(g, 8.6, .5, 12.5, roof, [k * 3.6, 9.4, 0]); r.rotation.z = -k * .6; r.position.set(k * 3.55, 9.9, 0); }
    const tri = new THREE.Shape([new THREE.Vector2(-7, 0), new THREE.Vector2(7, 0), new THREE.Vector2(0, 5)]); for (const z of [5.5, -5.5]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(c)); m.position.set(0, 7.5, z); if (z < 0) m.rotation.y = Math.PI; g.add(m); }
    bx(g, 1.6, 3.5, 1.6, '#7a3a2a', [3.5, 9.5, -2]); prop('door', { parent: g, pos: [0, 0, 5.55], color: o.door || '#7a3a2a', window: false });
    for (const x of [-4.2, 4.2]) prop('window', { parent: g, pos: [x, 2.6, 5.56], w: 3, h: 2.6 }); return g; },
  fence: (o) => { const g = G(), w = o.w || 10, c = o.color || '#f4f4f4'; for (let x = -w / 2; x <= w / 2 + .01; x += 1.2) bx(g, .3, 2.6, .2, c, [x, 0, 0]); bx(g, w, .25, .15, c, [0, 1.9, .05]); bx(g, w, .25, .15, c, [0, .9, .05]); return g; },
  mailbox: () => { const g = G(); bx(g, .25, 3, .25, '#6b4a2b', [0, 0, 0]); bx(g, .8, .8, 1.4, '#3a6fd8', [0, 3, 0], { r: .25 }); bx(g, .08, .5, .3, '#d12b2b', [.45, 3.5, -.3]); return g; },
  log: (o) => { const g = G(); const m = cy(g, .55, .55, o.len || 4, '#7a5532', [0, 0, 0]); m.rotation.z = Math.PI / 2; m.position.set(0, .55, 0); return g; },
  bush: (o) => { const g = G(), c = o.color || '#3f8f37'; bl(g, 1.1, c, [0, .8, 0]); bl(g, .8, c, [.8, .6, .2]); bl(g, .8, c, [-.8, .6, -.1]); return g; },
  cloud: () => { const g = G(); const m = mat('#ffffff', { emissive: '#ffffff', ei: .3 }); for (const [x, y, r] of [[0, 0, 2.2], [2, -.3, 1.6], [-2, -.3, 1.7], [1, .9, 1.4]]) bl(g, r, m, [x, y, 0]); return g; },
  planet: (o) => { const g = G(), r = o.r || 10, k = o.kind || 'earth';
    const m = k === 'earth' ? mat('#fff', { map: TEX2.earth(), emissive: '#1a3a70', ei: .25 }) : k === 'sun' ? glow('#ffd23a', 2.5) : k === 'mars' ? mat('#c8552e', { emissive: '#40150a', ei: .3 }) : k === 'moon' ? mat('#fff', { map: TEX2.moon([2, 1]) }) : mat(o.color || '#7a8ac8');
    const b = bl(g, r, m, [0, 0, 0]); b.castShadow = false; if (o.ring) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * .12, 6, 48), mat(o.ringColor || '#d9c38f')); t.rotation.x = 1.3; g.add(t); } g.userData.spin = b; return g; },
  pyramid: (o) => { const g = G(); const p = cn(g, o.r || 20, o.h || 22, mat('#fff', { map: TEX2.sand([4, 4]) }), [0, 0, 0], { seg: 4 }); p.rotation.y = Math.PI / 4; return g; },
  dune: (o) => { const g = G(); bl(g, o.r || 8, mat('#fff', { map: TEX2.sand([3, 3]) }), [0, -(o.r || 8) * .7, 0]).scale.set(1.6, 1, 1); return g; },
  ice: (o) => { const g = G(); const m = glass('#bfe7f7', .6); bx(g, o.w || 3, o.h || 3, o.d || 3, m, [0, 0, 0]); return g; },
  water: (o) => { const g = G(); const m = new THREE.MeshStandardMaterial({ color: col(o.color || '#2f9de0'), map: TEX2.water([(o.w || 20) / 6, (o.d || 20) / 6]), transparent: true, opacity: o.opacity ?? .78, roughness: .15, emissive: col('#0f4f8a'), emissiveIntensity: .25, depthWrite: false });
    m.userData.glass = true; const p = plane(o.w || 20, o.d || 20, m, [0, o.y ?? 0, 0], [-90, 0, 0], g); p.userData.kind = 'water'; g.userData.wave = p; return g; },
  pool: (o) => { const g = G(), w = o.w || 16, d = o.d || 10, h = o.h || 2.6; const tile = mat('#fff', { map: TEX.tile([w / 2, 1], '#e9f6fb', '#7fc8e8') });
    bx(g, w + 1.2, h, .6, tile, [0, 0, -d / 2 - .3]); bx(g, w + 1.2, h, .6, tile, [0, 0, d / 2 + .3]); bx(g, .6, h, d, tile, [-w / 2 - .3, 0, 0]); bx(g, .6, h, d, tile, [w / 2 + .3, 0, 0]);
    bx(g, w, .05, d, '#5cc0ee', [0, 0, 0], { cast: false }); prop('water', { parent: g, w, d, y: h - .4 }); return g; },
};
function G() { return new THREE.Group(); }
Object.assign(PROPS, P2); PROP_NAMES.push(...Object.keys(P2));
PROPS.trex = PROPS.dinosaur; PROPS.dino = PROPS.dinosaur; PROPS.oven = PROPS.pizza_oven; PROP_NAMES.push('trex', 'dino', 'oven');
// sign prop: w / h / color / multi-line, text shrinks to fit (old 4x1 signs look the same unless the text overflowed)
PROPS.sign = (o) => { const g = new THREE.Group(), w = o.w || 4, h = o.h || 1; box(w, h, .15, mat('#fff', { map: textTex(o.text || 'CLASS 8B', w, h, o.bg || '#1f3f8f', o.color || '#ffffff', 64) }), [0, 0, 0], { parent: g }); return g; };

// ---------------------------------------------------------------- thing(): move any prop / animal / vehicle with keyframes
const MOVERS = [];
class Mover {
  constructor(g) { this.g = g; this.keys = []; this.base = { pos: g.position.toArray(), rotY: g.rotation.y / D2R, scale: g.scale.x }; this.isThing = true; MOVERS.push(this); }
  /** at(t, { pos, rotY, scale, visible, anim:'walk'|'run'|'fly'|'swim'|'drive'|'idle'|'hop'|'spin'|'chomp', ease }) */
  at(t, k) { this.keys.push({ t, ...k }); this.keys.sort((a, b) => a.t - b.t); return this; }
  hide(t) { return this.at(t, { visible: false }); } show(t) { return this.at(t, { visible: true }); }
  _track(p, t) { let a = null, b = null; for (const k of this.keys) { if (k[p] === undefined) continue; if (k.t <= t) a = k; else { b = k; break; } } return [a, b]; }
  apply(t) {
    const g = this.g, [pa, pb] = this._track('pos', t); let moving = false;
    if (pa && pb) { const an = this._at('anim', pa.t), e = EASE[pb.ease || (/walk|run|drive|swim|fly/.test(an) ? 'linear' : 'inOut')] || EASE.inOut, w = e((t - pa.t) / (pb.t - pa.t)); moving = t > pa.t && t < pb.t;
      g.position.set(lerp(pa.pos[0], pb.pos[0], w), lerp(pa.pos[1], pb.pos[1], w), lerp(pa.pos[2], pb.pos[2], w)); }
    else if (pa || pb) g.position.set(...(pa || pb).pos); else g.position.set(...this.base.pos);
    const [ra, rb] = this._track('rotY', t);
    if (ra && rb) { const span = Math.min(.35, rb.t - ra.t), w = EASE.inOut((t - (rb.t - span)) / span); g.rotation.y = lerp(ra.rotY, rb.rotY, w) * D2R; } else if (ra || rb) g.rotation.y = (ra || rb).rotY * D2R; else g.rotation.y = this.base.rotY * D2R;
    const [sa, sb] = this._track('scale', t); if (sa && sb) g.scale.setScalar(lerp(sa.scale, sb.scale, EASE.inOut((t - sa.t) / (sb.t - sa.t)))); else if (sa || sb) g.scale.setScalar((sa || sb).scale); else g.scale.setScalar(this.base.scale);
    const [va] = this._track('visible', t); g.visible = va ? va.visible : true;
    const an = this._at('anim', t), u = g.userData, amp = u.legAmp || .7;
    const walkF = an === 'run' ? 3.2 : an === 'walk' ? 1.8 : 0, s = Math.sin(t * Math.PI * 2 * walkF);
    if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = walkF ? (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * amp * s : 0; });
    if (u.wings) u.wings.forEach((w, i) => { const f = an === 'fly' ? .9 * Math.sin(t * 22) : (u.flap && an === 'walk' ? u.flap * Math.sin(t * 9) : 0); w.rotation.z = (i ? -1 : 1) * f; });
    if (u.tail) u.tail.rotation.y = (u.wag ? .35 : .4) * Math.sin(t * (u.wag || 10) * (an === 'swim' ? 1.4 : 1));
    if (u.jaw) u.jaw.rotation.x = an === 'chomp' || an === 'roar' ? .25 + .25 * Math.sin(t * (an === 'chomp' ? 14 : 5)) : 0;
    if (u.wheels && (moving || an === 'drive')) u.wheels.forEach(w => { w.rotation[u.wheelAxis || 'x'] = t * 9; });
    if (an === 'hop') g.position.y += Math.abs(Math.sin(t * 7)) * .8; if (an === 'bob' || an === 'swim') g.position.y += Math.sin(t * 3) * .25;
    if (an === 'spin') g.rotation.y += t * 4; if (u.spin) u.spin.rotation.z = t * 1.5; if (u.flame) u.flame.visible = an === 'launch' || !!this._at('flame', t);
  }
  _at(p, t) { let v = ''; for (const k of this.keys) if (k[p] !== undefined && k.t <= t) v = k[p]; return v; }
}
/** thing(nameOrGroup, opts) -> mover with .at(t, {pos, rotY, scale, visible, anim}) / .hide(t) / .show(t); .g = the THREE.Group.
 *  animal('dog', {pos, rotY, color}) and vehicle('car', {...}) are the same thing. */
export function thing(name, o = {}) { const g = typeof name === 'string' ? prop(name, o) : name; return new Mover(g); }
export const animal = thing, vehicle = thing;

// ---------------------------------------------------------------- attach / hold
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _bb = new THREE.Box3();
/** attach(a, g, { to:'head'|'body'|'back'|'rhand'|'lhand', off:[x,y,z], rot:[deg], t0, t1 }) - parents g to that part: it follows every move and pose */
export function attach(a, g, o = {}) {
  const part = { head: a.head, body: a.body, back: a.body, rhand: a.ra, lhand: a.la }[o.to || 'head'] || a.head;
  const base = { head: [0, 0, 0], body: [0, 1, 0], back: [0, 1, -.85], rhand: [0, -1.6, 0], lhand: [0, -1.6, 0] }[o.to || 'head'] || [0, 0, 0];
  const off = o.off || [0, 0, 0]; part.add(g); g.position.set(base[0] + off[0], base[1] + off[1], base[2] + off[2]); if (o.rot) g.rotation.set(o.rot[0] * D2R, o.rot[1] * D2R, o.rot[2] * D2R);
  if (o.t0 !== undefined || o.t1 !== undefined) onFrame(t => { g.visible = t >= (o.t0 ?? -1e9) && t < (o.t1 ?? 1e9); });
  return g;
}
/** hold(a, g | propName, { hand:'right'|'left'|'both', t0, t1, off:[x,y,z] }) - g floats in front of the hand, upright (turns with him, not with the arm) */
export function hold(a, g, o = {}) {
  if (typeof g === 'string') g = prop(g, o.opts || {});
  S.scene.updateMatrixWorld(true); _bb.setFromObject(g); const hgt = Math.max(.1, _bb.max.y - _bb.min.y), dep = Math.max(.1, _bb.max.z - _bb.min.z), yb = _bb.min.y - g.position.y;
  const off = o.off || [0, 0, 0];
  onFrame(t => { const on = t >= (o.t0 ?? -1e9) && t < (o.t1 ?? 1e9) && a.root.visible; g.visible = on; if (!on) return;
    a.root.updateMatrixWorld(true); const hand = o.hand === 'left' ? a.la : a.ra;
    const p = hand.localToWorld(_v.set(0, -1.5, 0)); if (o.hand === 'both') { const q = a.la.localToWorld(new THREE.Vector3(0, -1.5, 0)); p.add(q).multiplyScalar(.5); }
    const ry = a.root.rotation.y, sc = a.root.scale.x, grip = o.grip || g.userData.holdAt; // grip = the object's own point that sits in the fist (umbrella pole...)
    if (grip) { const s = g.scale.x, fwd = .55 * sc; g.position.set(p.x + Math.sin(ry) * fwd - grip[0] * s + off[0], p.y - grip[1] * s + off[1], p.z + Math.cos(ry) * fwd - grip[2] * s + off[2]); g.rotation.y = ry; return; }
    const fwd = .55 * sc + dep / 2;
    g.position.set(p.x + Math.sin(ry) * fwd + off[0], p.y - yb - hgt / 2 + off[1], p.z + Math.cos(ry) * fwd + off[2]); g.rotation.y = ry; });
  return g;
}

// ---------------------------------------------------------------- ceilings: avatars never poke through, breakCeiling()
let CEIL = null;
function ceilList() { if (CEIL) return CEIL; CEIL = []; S.scene.updateMatrixWorld(true);
  S.scene.traverse(o => { if (o.isMesh && o.userData.kind === 'ceiling' && !o.userData.piece) { _bb.setFromObject(o); CEIL.push({ x0: _bb.min.x, x1: _bb.max.x, z0: _bb.min.z, z1: _bb.max.z, y: _bb.min.y }); } }); return CEIL; }
const HOLES = [];
/** ceilingAt(x, z, y=0) -> height of the lowest ceiling above (x, y, z), or Infinity outdoors */
export function ceilingAt(x, z, y = 0) { let best = Infinity; for (const c of ceilList()) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y > y && c.y < best) best = c.y; return best; }
function keepUnderCeiling(a, t) {
  const p = a.root.position; if (p.y < .25) return; const cy_ = ceilingAt(p.x, p.z, p.y + 1); if (cy_ === Infinity) return;
  for (const h of HOLES) if (t >= h.t && p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1) return;
  a.root.updateMatrixWorld(true); _bb.setFromObject(a.root); const over = _bb.max.y - (cy_ - .1); if (over > 0) p.y = Math.max(0, p.y - over);
}
/** breakCeiling(t, { x, z, w=4, d=4, above:'sky'|'night'|'space'|colour, debris:true }) - at t the ceiling over (x,z) cracks open (floaters can go through) */
export function breakCeiling(t, o = {}) {
  S.scene.updateMatrixWorld(true); const x = o.x || 0, z = o.z || 0, w = o.w || 4, d = o.d || 4;
  let host = null; S.scene.traverse(m => { if (host || !m.isMesh || m.userData.kind !== 'ceiling') return; _bb.setFromObject(m); if (x > _bb.min.x && x < _bb.max.x && z > _bb.min.z && z < _bb.max.z) host = { m, b: _bb.clone() }; });
  if (!host) { console.warn('breakCeiling: no ceiling over', x, z); return; }
  const { m, b } = host, h = b.min.y, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  HOLES.push({ t, x0, x1, z0, z1 });
  const g = new THREE.Group(); S.scene.add(g); const cm = m.material;
  const strip = (ax, bx_, az, bz) => { if (bx_ - ax < .01 || bz - az < .01) return; const p = plane(bx_ - ax, bz - az, cm, [(ax + bx_) / 2, h, (az + bz) / 2], [90, 0, 0], g); p.userData.kind = 'ceiling'; p.userData.piece = true; };
  strip(b.min.x, x0, b.min.z, b.max.z); strip(x1, b.max.x, b.min.z, b.max.z); strip(x0, x1, b.min.z, z0); strip(x0, x1, z1, b.max.z);
  const r = rng(Math.round(x * 13 + z * 7) + 3), rim = mat('#6b5a48', { rough: .9 }), plaster = mat('#d8d4cb', { rough: .9 });
  for (const [ax, az, bx_, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) { // jagged broken edge
    const n = 6; for (let i = 0; i <= n; i++) { const u = i / n, px = lerp(ax, bx_, u), pz = lerp(az, bz, u), s = .35 + r() * .5; const c = box(s, .45 + r() * .4, s, i % 2 ? rim : plaster, [px, h - .3, pz], { parent: g }); c.rotation.set(r(), r(), r()); } }
  for (const [px, pz, sw, sd] of [[x, z0 - .2, w + .8, .4], [x, z1 + .2, w + .8, .4], [x0 - .2, z, .4, d], [x1 + .2, z, .4, d]]) box(sw, .6, sd, rim, [px, h, pz], { parent: g });
  const sky = o.above || 'sky'; if (sky) { const sm = new THREE.MeshBasicMaterial({ map: sky === 'sky' ? TEX.sky(false) : sky === 'night' ? TEX.sky(true) : sky === 'space' ? TEX2.stars() : null, color: /^#/.test(sky) ? col(sky) : col('#ffffff'), fog: false, side: THREE.DoubleSide });
    plane(w * 4, d * 4, sm, [x, h + 7, z], [90, 0, 0], g); }
  g.visible = false; const deb = [];
  if (o.debris !== false) for (let i = 0; i < 9; i++) { const s = .4 + r() * .6, c = box(s, s * .6, s, i % 3 ? plaster : rim, [0, 0, 0]); deb.push({ c, x: x + (r() - .5) * w * 1.4, z: z + (r() - .5) * d * 1.4, d: .1 + r() * .25, s: s * .3, rx: r() * 6, rz: r() * 6 }); }
  onFrame(T => { const on = T >= t; m.visible = !on; g.visible = on;
    for (const k of deb) { const u = clamp((T - t - k.d) / .55); k.c.visible = T >= t + k.d; k.c.position.set(k.x, lerp(h - .5, k.s, u * u), k.z); k.c.rotation.set(k.rx * u, 0, k.rz * u); } });
  return g;
}

// ---------------------------------------------------------------- spacing helpers: lineUp(), crowd(), randomLook()
const SKINS = ['#f2c99b', '#f7e0cc', '#c98d5e', '#7a4a2e', '#e0b48a', '#5a3622'], SHIRTS = ['#d12b2b', '#2b62d9', '#2bb04a', '#f2c933', '#6a3fc9', '#ff7aa8', '#1f9fd1', '#3a3a3a', '#ffffff', '#e05a1a'];
const PANTS = ['#1d2a44', '#2a2a2a', '#4d79b8', '#3b3b44', '#6b4a2b', '#1d1f2a'], HAIRS = ['messy', 'spiky', 'bun', 'long', 'curly', 'cap', 'quiff', 'pigtails', 'ponytail', 'buzz', 'afro', 'beanie'];
const HAIRC = ['#3b2416', '#111111', '#f2c933', '#7a1a2a', '#e05a1a', '#5a3a20', '#dddddd'], PATS = ['plain', 'plain', 'stripes', 'hoodie', 'logo', 'plain'];
const EXTRA_FACES = ['classic_smile', 'happy_derp', 'o_eyes', 'derp_o', 'sweat', 'goofy_tongue', 'glasses_frown', 'dion_smirk'];
/** randomLook(seed) -> avatar options for a background person (skin, shirt, pants, hair, face) */
export function randomLook(seed = 1) { const r = rng(seed * 7919 + 13), p = a => a[(r() * a.length) | 0];
  return { skin: p(SKINS), shirt: { color: p(SHIRTS), pattern: p(PATS), sleeves: r() < .3 ? 'long' : 'short' }, pants: { color: p(PANTS), shoes: r() < .4 ? '#f4f4f4' : undefined }, hair: p(HAIRS), hairColor: p(HAIRC), hatColor: p(SHIRTS), face: p(EXTRA_FACES) }; }
function propFootprints() { S.scene.updateMatrixWorld(true); const out = [];
  S.scene.traverse(o => { if (!o.userData.prop || o.userData.prop === 'room' || o === S.scene) return; let inAv = false; for (const a of S.avatars) if (a.root === o) inAv = true; if (inAv) return;
    _bb.setFromObject(o); if (_bb.isEmpty() || _bb.max.y < .3 || _bb.min.y > 5.5) return; out.push(_bb.clone()); }); return out; }
/** lineUp(people, { at:[x,y,z], dir:"x"|"z"|deg, gap:4.4, rotY }) - people = avatars or avatar options (randomLook() etc.); returns avatars,
 *  centred on `at`, `gap` studs apart (an avatar is 4 wide with arms: 4.4 keeps idle arms apart; 5+ for shrug / tPose / dance). */
export function lineUp(people, o = {}) {
  const list = typeof people === 'number' ? Array.from({ length: people }, (_, i) => randomLook((o.seed || 1) * 100 + i)) : people, n = list.length, gap = o.gap || 4.4, at = o.at || [0, 0, 0];
  const ang = o.dir === 'z' ? 90 : typeof o.dir === 'number' ? o.dir : 0, dx = Math.cos(ang * D2R), dz = -Math.sin(ang * D2R);
  return list.map((p, i) => { const k = (i - (n - 1) / 2) * gap, pos = [at[0] + dx * k, at[1], at[2] + dz * k];
    if (p && p.isAvatar) { p.pos.set(...pos); p.root.position.set(...pos); if (o.rotY !== undefined) { p.o.rotY = o.rotY; p.root.rotation.y = o.rotY * D2R; } return p; }
    return avatar({ ...p, pos, rotY: o.rotY ?? p.rotY ?? 0 }); });
}
/** crowd(n, { center:[x,y,z], w:16, d:10 (area), gap:4.4, face:[x,z] | rotY, seed, looks:[opts] | fn(i), avoidProps:true, pose, faceName })
 *  -> avatars spread over the area, at least `gap` apart, never inside a prop (desks, shelves, cars...), facing `face`. */
export function crowd(n, o = {}) {
  const c = o.center || [0, 0, 0], w = o.w || 16, d = o.d || 10, gap = o.gap || 4.4, r = rng((o.seed || 1) * 31 + 7), fp = o.avoidProps === false ? [] : propFootprints();
  const taken = S.avatars.map(a => [a.pos.x, a.pos.z]), out = [];
  for (let i = 0; i < n; i++) {
    let best = null;
    for (let k = 0; k < 400 && !best; k++) { const x = c[0] + (r() - .5) * w, z = c[2] + (r() - .5) * d;
      if (taken.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < gap * gap)) continue;
      if (fp.some(b => x > b.min.x - 1.3 && x < b.max.x + 1.3 && z > b.min.z - 1.3 && z < b.max.z + 1.3)) continue; best = [x, z]; }
    if (!best) { console.warn('crowd: no room for person', i, '- make the area bigger or the gap smaller'); break; }
    taken.push(best); const look = typeof o.looks === 'function' ? o.looks(i) : o.looks ? o.looks[i % o.looks.length] : randomLook((o.seed || 1) * 100 + i);
    const f = o.face || [c[0], c[2] + d]; const rotY = o.rotY ?? Math.atan2(f[0] - best[0], f[1] - best[1]) / D2R;
    const a = avatar({ ...look, pos: [best[0], c[1], best[1]], rotY, ...(o.faceName ? { face: o.faceName } : {}), ...(o.scale ? { scale: o.scale } : {}) }); if (o.pose) a.at(0, { pose: o.pose, blend: 0 }); out.push(a);
  }
  return out;
}

// ---------------------------------------------------------------- effects: puff, particles, title, label
const puffMat = () => { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .95, roughness: 1, emissive: 0xffffff, emissiveIntensity: .25 }); return m; };
/** puff(t, where:[x,y,z] | avatar | fn, size=1, { flash:true, color }) - a cartoon smoke burst (teleports, vanishing, appearing) */
export function puff(t, where, size = 1, o = {}) {
  const g = new THREE.Group(); S.scene.add(g); const m = puffMat(); if (o.color) m.color.set(o.color);
  const offs = [[0, 0, 0], [.9, .5, .3], [-.9, .6, -.2], [.4, 1.4, .5], [-.5, -.7, .4], [.6, -.6, -.5], [-.3, 1.1, -.6]];
  const balls = offs.map((p, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.9 + (i % 3) * .25, 16, 12), m); b.position.set(p[0] * 1.3, p[1] * 1.3, p[2] * 1.3); g.add(b); return b; });
  onFrame(T => { const k = (T - t) / .55; g.visible = k >= 0 && k <= 1; if (!g.visible) return;
    const p = where && where.isAvatar ? where.headPos([0, -1.4, 0]) : typeof where === 'function' ? where(T) : new THREE.Vector3(...where); g.position.copy(p);
    const s = size * (k < .25 ? .3 + 2.8 * k : 1 - (k - .25) * 1.2); balls.forEach((b, i) => b.scale.setScalar(Math.max(.01, s * (1 + .15 * Math.sin(i * 2.1))))); });
  if (o.flash !== false) flash(t, .14);
}
/** particles(t0, t1, { kind:'confetti'|'rain'|'snow'|'sparkle'|'smoke'|'fire'|'bubbles'|'hearts'|'money', at:[x,y,z] | avatar, area:[w,h,d], n, color, size }) */
export function particles(t0, t1, o = {}) {
  const kind = o.kind || 'confetti', n = o.n || { rain: 160, snow: 140, confetti: 90, sparkle: 40, smoke: 18, fire: 30, bubbles: 24, hearts: 16, money: 30 }[kind] || 60;
  const area = o.area || ({ rain: [30, 16, 30], snow: [40, 18, 40], smoke: [2, 6, 2], fire: [2, 4, 2], sparkle: [4, 5, 4], bubbles: [3, 7, 3], hearts: [3, 5, 3] }[kind] || [16, 12, 16]);
  const r = rng(Math.round(t0 * 100) + n), g = new THREE.Group(); S.scene.add(g); const sz = o.size || 1, fixed = !o.at || Array.isArray(o.at); if (fixed) g.position.set(...(o.at || [0, 0, 0]));
  const COL = { confetti: ['#ff4a4a', '#ffd23a', '#3ad1ff', '#6aff4a', '#ff7aff', '#ffffff'], rain: ['#9fc8ff'], snow: ['#ffffff'], sparkle: ['#fff6a0', '#ffffff'], smoke: ['#9a9a9a', '#bdbdbd'], fire: ['#ffb02a', '#ff5a1a', '#ffe14a'], bubbles: ['#d8f6ff'], hearts: ['#ff3a6a'], money: ['#5cb85c'] }[kind];
  const ps = [];
  for (let i = 0; i < n; i++) { const c = o.color || COL[i % COL.length]; let m;
    const em = /sparkle|fire|hearts/.test(kind) ? mat(c, { emissive: c, ei: 1.6 }) : kind === 'rain' || kind === 'bubbles' ? (() => { const x = mat(c, { noCache: true }).clone(); x.transparent = true; x.opacity = .6; x.depthWrite = false; return x; })() : mat(c);
    if (kind === 'rain') m = new THREE.Mesh(new THREE.BoxGeometry(.05, .9, .05), em); else if (kind === 'snow' || kind === 'smoke' || kind === 'bubbles') m = new THREE.Mesh(new THREE.SphereGeometry(kind === 'smoke' ? .8 : kind === 'bubbles' ? .25 : .12, 10, 8), em);
    else if (kind === 'money') m = new THREE.Mesh(new THREE.BoxGeometry(.9, .03, .45), em); else m = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .06), em);
    m.scale.setScalar(sz); m.castShadow = false; g.add(m); ps.push({ m, x: (r() - .5) * area[0], y: r() * area[1], z: (r() - .5) * area[2], ph: r(), sp: .7 + r() * .6, rx: r() * 6, ry: r() * 6 }); }
  onFrame(T => { const on = T >= t0 && T < t1; g.visible = on; if (!on) return; const dt = T - t0;
    if (!fixed) g.position.copy(o.at.isAvatar ? o.at.headPos([0, -2.6, 0]) : o.at(T));
    for (const p of ps) { const m = p.m; let y;
      if (kind === 'rain') y = area[1] - ((p.y + dt * 22 * p.sp) % area[1]);
      else if (kind === 'snow' || kind === 'confetti' || kind === 'money') { y = area[1] - ((p.y + dt * (kind === 'snow' ? 1.6 : 3.2) * p.sp) % area[1]); m.rotation.set(p.rx + dt * 3, p.ry + dt * 2, 0); }
      else if (kind === 'smoke' || kind === 'fire' || kind === 'bubbles' || kind === 'hearts') { const k = ((p.ph + dt * (kind === 'fire' ? 1.6 : .5) * p.sp) % 1); y = k * area[1]; m.scale.setScalar(sz * (kind === 'smoke' ? .5 + k * 1.4 : kind === 'fire' ? 1.2 - k : 1)); }
      else { const k = (p.ph + dt * 1.5 * p.sp) % 1; y = p.y; m.scale.setScalar(sz * Math.sin(k * Math.PI) * 1.4); m.rotation.z = dt * 4; }
      m.position.set(p.x + (kind === 'snow' || kind === 'bubbles' || kind === 'smoke' ? Math.sin(dt * 1.3 + p.ph * 6) * .5 : 0), y, p.z); } });
  return g;
}
const TITLES = [];
/** title(t0, t1, text, { y:.42, size:96, color:'#fff', stroke:'#141414', bg:null, pop:true, upper:true }) - big screen text ("3 HOURS LATER", "DAY 1") */
export function title(t0, t1, text, o = {}) { TITLES.push({ t0, t1, text, ...o }); }
/** label(target: avatar | [x,y,z] | thing, text, { t0, t1, color, size:54, off:[x,y,z], bg }) - text floating at a 3D point (names, arrows, "BRAD") */
export function label(target, text, o = {}) { TITLES.push({ target, text, t0: o.t0 ?? -1e9, t1: o.t1 ?? 1e9, label: true, ...o }); }
overlay((g, t) => {
  for (const L of TITLES) { if (t < L.t0 || t >= L.t1) continue;
    let x = W / 2, y = H * (L.y ?? .42), size = L.size || (L.label ? 54 : 96);
    if (L.label) { const tg = L.target, off = L.off || [0, 1.6, 0]; let v;
      if (tg && tg.isAvatar) { if (!tg.root.visible) continue; v = tg.headPos(off); } else if (tg && tg.isThing) v = tg.g.position.clone().add(new THREE.Vector3(...off)); else v = new THREE.Vector3(...tg).add(new THREE.Vector3(...(L.off || [0, 0, 0])));
      const sp = screenOf(v); if (sp.behind) continue; x = sp.x; y = sp.y; }
    const dt = t - L.t0, k = L.pop === false || L.label ? 1 : dt < .18 ? .6 + .55 * Math.sin(dt / .18 * Math.PI / 2) : dt < .3 ? 1.15 - (dt - .18) / .12 * .15 : 1;
    const txt = L.upper === false || L.label ? String(L.text) : String(L.text).toUpperCase();
    g.save(); g.font = `900 ${size * k}px Nunito`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const ls = txt.split('\n'), lh = size * k * 1.08;
    if (L.bg) { const wd = Math.max(...ls.map(l => g.measureText(l).width)) + size * .6; g.fillStyle = L.bg; g.beginPath(); g.roundRect(x - wd / 2, y - lh * ls.length / 2 - size * .12, wd, lh * ls.length + size * .24, size * .25); g.fill(); }
    ls.forEach((l, i) => { const yy = y + (i - (ls.length - 1) / 2) * lh; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.lineWidth = Math.max(6, size * k * .17); g.strokeStyle = L.stroke || '#141414'; g.strokeText(l, x, yy);
      g.shadowColor = 'transparent'; g.fillStyle = L.color || '#ffffff'; g.fillText(l, x, yy); });
    g.restore(); }
});

// ---------------------------------------------------------------- more poses
Object.assign(P, {
  lookUp: (t) => ({ la: [.04 * Math.sin(t * 1.7), 0, .08], ra: [-.04 * Math.sin(t * 1.7), 0, -.08], hd: [-.55, 0, 0] }),
  lookDown: (t) => ({ la: [.04 * Math.sin(t * 1.7), 0, .05], ra: [-.04 * Math.sin(t * 1.7), 0, -.05], hd: [.45, 0, 0] }),
  hugKnees: (t) => ({ la: [-1.15, 0, -.32], ra: [-1.15, 0, .32], ll: [-2.25, 0, .04], rl: [-2.25, 0, -.04], by: -1.5, bx: .22, hd: [.28 + .02 * Math.sin(t * 2), 0, 0] }),
  sitFloor: (t) => ({ la: [-.25, 0, .25], ra: [-.25, 0, -.25], ll: [-1.5708, 0, .06], rl: [-1.5708, 0, -.06], by: -1.5 }),
  sitTalk: (t) => ({ la: [-.5 + .15 * Math.sin(t * 3.1), 0, .15], ra: [-.75 + .25 * Math.sin(t * 2.3 + 1), 0, -.2], ll: [-1.5708, 0, .04], rl: [-1.5708, 0, -.04], by: -.5, hd: [.04 * Math.sin(t * 4), .08 * Math.sin(t * 1.3), 0] }),
  sitGesture: (t) => ({ la: [-.35, 0, .05], ra: [-1.3 + .2 * Math.sin(t * 4), 0, -.5], ll: [-1.5708, 0, .04], rl: [-1.5708, 0, -.04], by: -.5, hd: [0, .1, 0] }),
  sitShrug: () => ({ la: [-.5, 0, .9], ra: [-.5, 0, -.9], ll: [-1.5708, 0, .04], rl: [-1.5708, 0, -.04], by: -.5, hd: [0, 0, .15] }),
  sitCry: (t) => ({ la: [-2.2, 0, -.55], ra: [-2.2, 0, .55], ll: [-1.5708, 0, .04], rl: [-1.5708, 0, -.04], by: -.5 + .03 * Math.sin(t * 14), hd: [.35, 0, 0], bx: .1 }),
  crawl: (t) => { const s = Math.sin(t * Math.PI * 2 * 1.4); return { bx: 1.45, by: -.5, la: [-1.45 + .3 * s, 0, .05], ra: [-1.45 - .3 * s, 0, -.05], ll: [-.75 - .25 * s, 0, .03], rl: [-.75 + .25 * s, 0, -.03], hd: [-1.1, 0, 0] }; },
  drag: (t) => ({ la: [-3.0, 0, .15], ra: [-3.0, 0, -.15], ll: [.05 * Math.sin(t * 5), 0, .1], rl: [-.05 * Math.sin(t * 5), 0, -.1], tilt: -1.5708, lift: .5, hd: [-.15, 0, 0] }),
  pull: (t) => ({ la: [-1.35, 0, -.1], ra: [-1.35, 0, .1], ll: [-.35 + .2 * Math.sin(t * 6), 0, .05], rl: [.35 - .2 * Math.sin(t * 6), 0, -.05], bx: -.28 }),
  kneel: () => ({ la: [-.2, 0, .08], ra: [-.2, 0, -.08], ll: [-1.5708, 0, .05], rl: [0, 0, -.05], by: -1.0, rlBack: 1 }),
  cheer: (t) => ({ la: [-2.9 + .25 * Math.sin(t * 9), 0, .3], ra: [-2.9 - .25 * Math.sin(t * 9), 0, -.3], by: .12 * Math.abs(Math.sin(t * 6)), hd: [-.15, 0, 0] }),
  think: (t) => ({ la: [-1.0, 0, -.55], ra: [-2.25, 0, .55], hd: [-.12, 0, .1 + .03 * Math.sin(t * 2)] }),
  swim: (t) => ({ la: [-3.0 + 1.4 * Math.sin(t * 5), 0, .2], ra: [-3.0 + 1.4 * Math.sin(t * 5 + Math.PI), 0, -.2], ll: [.3 * Math.sin(t * 9), 0, 0], rl: [-.3 * Math.sin(t * 9), 0, 0], tilt: 1.5708, lift: .5, hd: [-.6, 0, 0] }),
  punch: (t, lt) => { const k = EASE.out(lt / .14); return { la: [-.9, 0, -.25], ra: [lerp(-.6, -1.6, k), 0, .05], ll: [-.3, 0, 0], rl: [.25, 0, 0], bx: .15 * k }; },
  kick: (t, lt) => { const k = EASE.out(lt / .16); return { la: [-.6, 0, .5], ra: [-.6, 0, -.5], rl: [-1.4 * k, 0, 0], bx: -.15 * k }; },
  dance: (t) => { const s = Math.sin(t * 7); return { la: [-1.6 + 1.2 * s, 0, .4], ra: [-1.6 - 1.2 * s, 0, -.4], ll: [.25 * s, 0, .1], rl: [-.25 * s, 0, -.1], by: .15 * Math.abs(Math.sin(t * 7)), bz: .12 * s, hd: [0, 0, -.15 * s] }; },
  carry: (t) => ({ la: [-1.45, 0, .12], ra: [-1.45, 0, -.12], hd: [.05, 0, 0] }),
  holdUp: () => ({ la: [-2.95, 0, -.25], ra: [-2.95, 0, .25], hd: [-.3, 0, 0] }),
  phone: (t) => ({ la: [.04 * Math.sin(t * 1.7), 0, .05], ra: [-2.75, 0, .38], hd: [0, 0, -.12] }),
  eat: (t) => ({ la: [.04 * Math.sin(t * 1.7), 0, .05], ra: [-2.2 + .25 * Math.sin(t * 8), 0, .35], hd: [-.05, 0, 0] }),
  clap: (t) => { const s = Math.abs(Math.sin(t * 9)); return { la: [-1.3, 0, -.15 - .25 * s], ra: [-1.3, 0, .15 + .25 * s] }; },
  salute: () => ({ la: [0, 0, .05], ra: [-2.5, 0, .75], hd: [-.05, 0, 0] }),
  bow: () => ({ la: [-.4, 0, .05], ra: [-.4, 0, -.05], bx: .75, hd: [.2, 0, 0] }),
  handsHips: () => ({ la: [.15, 0, .55], ra: [.15, 0, -.55], hd: [-.08, 0, 0] }),
  crossArms: () => ({ la: [-1.15, 0, -.72], ra: [-1.05, 0, .72], hd: [-.08, 0, 0] }),
  tPose: () => ({ la: [0, 0, 1.5708], ra: [0, 0, -1.5708] }),
  zombie: (t) => ({ la: [-1.55 + .08 * Math.sin(t * 3), 0, .05], ra: [-1.55 + .08 * Math.sin(t * 3 + 1), 0, -.05], ll: [.3 * Math.sin(t * 4), 0, 0], rl: [-.3 * Math.sin(t * 4), 0, 0], hd: [.15, 0, .2] }),
  reach: () => ({ la: [0, 0, .05], ra: [-2.4, 0, -.1], hd: [-.35, 0, 0], by: .05 }),
  hide: (t) => ({ la: [-2.6, 0, -.7], ra: [-2.6, 0, .7], ll: [-.75, 0, .08], rl: [.35, 0, -.08], bx: .5, by: -.6, hd: [.4, 0, .03 * Math.sin(t * 30)] }),
  sneak: (t) => { const s = Math.sin(t * Math.PI * 2 * 1.1); return { la: [-1.1 + .3 * s, 0, .2], ra: [-1.1 - .3 * s, 0, -.2], ll: [-.45 * s, 0, 0], rl: [.45 * s, 0, 0], bx: .3, by: -.35 }; },
  climb: (t) => { const s = Math.sin(t * 6); return { la: [-2.8 + .4 * s, 0, .15], ra: [-2.8 - .4 * s, 0, -.15], ll: [-.6 - .4 * s, 0, 0], rl: [-.6 + .4 * s, 0, 0], hd: [-.3, 0, 0] }; },
  stretch: (t) => ({ la: [-3.0, 0, -.1], ra: [-3.0, 0, .1], by: .05 * Math.sin(t * 2), hd: [-.25, 0, 0] }),
  freeze: () => ({ la: [-.3, 0, .35], ra: [-.3, 0, -.35], ll: [0, 0, .08], rl: [0, 0, -.08] }),
  sitDrive: (t) => ({ la: [-1.35 + .05 * Math.sin(t * 2), 0, -.12], ra: [-1.35 - .05 * Math.sin(t * 2), 0, .12], ll: [-1.5708, 0, .04], rl: [-1.5708, 0, -.04], by: -.5 }),
});
// kneel: the back leg points down-back
{ const k = P.kneel; P.kneel = (t, lt) => { const p = k(t, lt); p.rl = [1.2, 0, -.05]; return p; }; }
POSES.push(...Object.keys(P).filter(k => !POSES.includes(k)));

// ---------------------------------------------------------------- more sets (all built at the origin; place() moves them)
Object.assign(SETS, {
  house_hallway(night) { const h = SO.h || 10; _room({ w: 8, d: 36, h, floor: TEX.wood([2, 9], '#8a5a34'), wall: night ? '#b9bfd6' : '#efe3cf', ceiling: SO.ceiling ?? true });
    for (const [x, z, r] of [[-3.95, -11, 90], [-3.95, 3, 90], [3.95, -4, -90], [3.95, 10, -90]]) prop('door', { pos: [x, 0, z], rotY: r, color: '#f2f2f2', window: false });
    for (const [x, z, r, s] of [[3.9, -12, -90, 2], [-3.9, -4, 90, 5], [3.9, 3, -90, 8]]) prop('painting', { pos: [x, 3.8, z], rotY: r, seed: s });
    prop('rug', { pos: [0, 0, -2], w: 3.6, d: 24, color: '#8c3a3a' }); prop('window', { pos: [0, 3, -17.95], w: 4, h: 4, night, frame: '#f2f2f2' }); prop('plant', { pos: [2.8, 0, -16] });
    ceilingLights([0], [-10, 0, 10], h - .01); pointL([0, h - 1, -6], night ? '#b8c8ff' : '#fff1d8', night ? 12 : 26, 24); pointL([0, h - 1, 8], night ? '#b8c8ff' : '#fff1d8', night ? 12 : 26, 24);
    night ? light('night', { center: [0, 0, 0], bg: '#05081a', hemi: .65, ambI: .25 }) : light('indoor', { center: [0, 0, 0], bg: '#efe3cf' }); },
  bathroom(night) { const h = SO.h || 10; _room({ w: 14, d: 12, h, floor: TEX.tile([6, 5], '#f4f7fa', '#bcd6e6'), wall: '#dff0f4', wallLow: '#9fd0e0', ceiling: SO.ceiling ?? true });
    prop('toilet', { pos: [-4.5, 0, -4.9] }); prop('sink', { pos: [0, 0, -5.1] }); prop('mirror', { pos: [0, 4.2, -5.95] }); prop('bathtub', { pos: [4.8, 0, -1.5] }); prop('towel', { pos: [-5, 0, 2.5] });
    ceilingLights([0], [0], h - .01); pointL([0, h - 1, 0], '#fff4e8', 26, 22); light('indoor', { center: [0, 0, 0], bg: '#dff0f4' }); },
  office(night) { const h = SO.h || 10; _room({ w: 28, d: 24, h, floor: TEX.carpet([8, 8], '#7f8a99'), wall: '#e7e9ec', ceiling: SO.ceiling ?? true });
    for (const x of [-7, 1]) for (const z of [-5, 4]) prop('cubicle', { pos: [x, 0, z] });
    for (const z of [-7, 0, 7]) prop('window', { pos: [13.95, 3, z], rotY: -90, w: 5, h: 4.5, night }); prop('whiteboard', { pos: [-3, 3, -11.85], w: 10 }); prop('water_cooler', { pos: [11, 0, -10] }); prop('plant', { pos: [-12.5, 0, -10.5] });
    prop('door', { pos: [-13.95, 0, 6], rotY: 90 }); ceilingLights([-7, 3], [-6, 4], h - .01); pointL([0, h - 1, 0], '#f4f8ff', 30, 36); light('indoor', { center: [0, 0, 0], bg: '#e7e9ec' }); },
  hospital(night) { const h = SO.h || 10; _room({ w: 24, d: 20, h, floor: TEX.tile([8, 7], '#f2f6f4', '#cfe3da'), wall: '#eef5f2', wallLow: '#a8d4c4', ceiling: SO.ceiling ?? true });
    for (const x of [-7, 5]) { prop('hospital_bed', { pos: [x, 0, -4.6] }); prop('iv_stand', { pos: [x - 2.9, 0, -6.5] }); prop('heart_monitor', { pos: [x + 2.9, 0, -7.6] }); }
    prop('curtain', { pos: [-1, 0, -3], rotY: 90, w: 9 }); prop('window', { pos: [11.95, 3, 2], rotY: -90, w: 5, h: 4, night }); sign('HOSPITAL', { pos: [0, 7.3, -9.9], bg: '#2b8a5a' });
    prop('door', { pos: [-11.95, 0, 5], rotY: 90, color: '#dfe7e4' }); ceilingLights([-6, 6], [-4, 5], h - .01); pointL([0, h - 1, 0], '#f4fff8', 30, 34); light('indoor', { center: [0, 0, 0], bg: '#eef5f2' }); },
  pizzeria(night) { const h = SO.h || 10; _room({ w: 26, d: 22, h, floor: TEX2.checker([8, 7], '#f4f4f4', '#c9241e'), wall: '#f2e2c4', wallLow: '#8a5a34', ceiling: SO.ceiling ?? true });
    prop('counter', { pos: [-3, 0, -8.6], w: 12, color: '#8a5a34' }); prop('pizza_oven', { pos: [7, 0, -9] }); sign('PIZZA', { pos: [-3, 6.8, -10.9], bg: '#c9241e', h: 1.6 }); prop('register', { pos: [-7, 0, -8.6] });
    for (const z of [-2, 5]) { prop('booth', { pos: [11.4, 0, z - 1.8], rotY: -90 }); prop('table', { pos: [9.2, 0, z], rotY: 90 }); prop('pizza', { pos: [9.2, 2.9, z] }); }
    for (const [x, z] of [[-6, 1], [0, 6]]) { prop('table', { pos: [x, 0, z] }); prop('chair', { pos: [x - 3.4, 0, z], rotY: 90, color: '#c9241e' }); prop('chair', { pos: [x + 3.4, 0, z], rotY: -90, color: '#c9241e' }); prop('pizza', { pos: [x, 2.9, z], r: .9 }); }
    prop('window', { pos: [-12.95, 3, 2], rotY: 90, w: 6, h: 4, night }); ceilingLights([-6, 6], [-4, 5], h - .01); pointL([0, h - 1, 0], '#ffe9c8', 30, 34); light('indoor', { center: [0, 0, 0], bg: '#f2e2c4' }); },
  store(night) { const h = SO.h || 12; _room({ w: 32, d: 28, h, floor: TEX.tile([10, 9], '#f4f4f0', '#dadad2'), wall: '#f1f1ec', wallLow: '#2b8a5a', ceiling: SO.ceiling ?? true });
    for (const x of [-10, -3.5, 3.5, 10]) for (const s of [1, -1]) prop('shelf', { pos: [x + s * .9, 0, -5], rotY: s * 90, w: 9, seed: Math.round(x * 3 + s) });
    for (const x of [-6, 2]) prop('register', { pos: [x, 0, 7] }); sign('SUPERMARKET', { pos: [0, 8.4, -13.9], bg: '#2b8a5a', h: 1.8 });
    ceilingLights([-8, 0, 8], [-7, 3], h - .01); pointL([0, h - 1, 0], '#ffffff', 34, 40); light('indoor', { center: [0, 0, 0], bg: '#f1f1ec', shadowR: 30 }); },
  mall(night) { const h = SO.h || 16; _room({ w: 34, d: 60, h, floor: TEX.tile([10, 18], '#efe9e0', '#cfc6b8'), wall: '#f4efe6', ceiling: SO.ceiling ?? true });
    const shops = SO.shops || ['GAMES', 'SHOES', 'PIZZA', 'TOYS', 'PHONES', 'CANDY'], cols = ['#c9241e', '#2b62d9', '#2b8a5a', '#f28c1a', '#6a3fc9', '#e8467c'];
    shops.forEach((s, i) => { const side = i % 2 ? 1 : -1, z = -20 + Math.floor(i / 2) * 18, x = side * 16.9, rot = side > 0 ? -90 : 90;
      box(.4, 9, 14, cols[i % cols.length], [x, 0, z]); box(.2, 6.5, 11, glass('#bfe1ff', .5), [x - side * .3, 0, z]); sign(s, { pos: [x - side * .35, 7, z], rotY: rot, bg: cols[i % cols.length], h: 1.6 }); });
    for (const z of [-14, 4, 22]) { prop('bench', { pos: [-6, 0, z], rotY: 90 }); prop('plant', { pos: [6, 0, z] }); }
    box(10, .2, 24, glow('#ffffff', .8), [0, h - .3, 0], { cast: false }); ceilingLights([-10, 10], [-20, 0, 20], h - .01); pointL([0, h - 2, -10], '#ffffff', 36, 44); pointL([0, h - 2, 14], '#ffffff', 36, 44); light('indoor', { center: [0, 0, 0], bg: '#f4efe6', shadowR: 40 }); },
  car_interior(night) { const c = SO.color || '#d12b2b', seatC = '#2b2b2b';
    plane(400, 400, mat('#fff', { map: TEX.grass([80, 80]), rough: .9 }), [0, -1.2, 0], [-90, 0, 0]).userData.kind = 'floor'; plane(16, 400, mat('#fff', { map: TEX2.asphalt([3, 80]) }), [0, -1.18, 0], [-90, 0, 0]).userData.kind = 'floor';
    const dashes = []; for (let i = 0; i < 24; i++) dashes.push(box(.35, .02, 3, '#f4f4f4', [4, -1.17, -90 + i * 8], { cast: false }));
    const trees = []; for (let i = 0; i < 14; i++) trees.push(prop(i % 3 ? 'tree' : 'pine', { pos: [(i % 2 ? 1 : -1) * (14 + (i * 7) % 9), -1.2, -100 + i * 15] }));
    onFrame(t => { for (const d of dashes) { d.userData.b = d.userData.b || d.position.clone(); d.position.z = d.userData.b.z + ((t * 30) % 8); }
      for (const tr of trees) { tr.userData.b = tr.userData.b || tr.position.clone(); tr.position.z = tr.userData.b.z + ((t * 30 + 1000) % 210) - 105; } });
    // Roblox-wide car (R6 people are 4 wide): front seats x ±2.2, back bench z 3.6, inner walls at x ±3.6, roof y 6.1
    box(7.6, .3, 8.4, '#3a3a3a', [0, -.3, 1]); for (const k of [1, -1]) { box(.25, 3.2, 8.4, c, [k * 3.75, -.3, 1]); box(.2, 3.2, .3, c, [k * 3.6, 2.9, -2.4]); box(.2, 3.2, .3, c, [k * 3.6, 2.9, 4.9]); box(.1, 3.0, 7, glass('#cfe8ff', .18), [k * 3.7, 2.9, 1.2]); }
    box(7.6, 1.7, 1.4, '#2f2f33', [0, 1.5, -3.1], { r: .2 }); box(7.4, .3, 1.2, '#1f1f22', [0, 3.2, -3.0]); box(7.8, .25, 8.6, c, [0, 6.1, 1]);
    box(7.4, 3.0, .08, glass('#cfe8ff', .15), [0, 3.2, -3.5]); box(7.4, 2.6, .08, glass('#cfe8ff', .15), [0, 3.2, 5.3]);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.6, .09, 8, 24), mat('#111')); wheel.position.set(-2.2, 3.55, -2.15); wheel.rotation.x = -.5; S.scene.add(wheel); box(.12, .12, .8, '#111', [-2.2, 3.1, -2.6]);
    for (const x of [-2.2, 2.2]) { box(2.2, .5, 1.8, seatC, [x, 1.2, 0], { r: .15 }); box(2.2, 2.6, .5, seatC, [x, 1.2, .95], { r: .2 }); box(1.1, .6, .4, seatC, [x, 4.0, 1.0], { r: .15 }); }
    box(7.0, .5, 1.8, seatC, [0, 1.2, 3.6], { r: .15 }); box(7.0, 2.6, .5, seatC, [0, 1.2, 4.55], { r: .2 }); box(1.4, .1, .9, glow('#6ad1ff', .7), [0, 3.0, -2.45], { cast: false });
    for (const k of [1, -1]) { box(.25, .5, 1.2, c, [k * 4.0, 3.2, -2.6]); box(.05, .4, 1.0, mat('#cfe6f2', { metal: .6, rough: .05 }), [k * 4.15, 3.25, -2.6]); }
    light(night ? 'night' : 'day', { center: [0, 0, 0], bg: '#9ccaf7', shadowR: 14, sunDir: [6, 30, -10], fog: night ? ['#0b1030', 30, 120] : ['#cfe6fb', 60, 170], ...(night ? {} : { hemi: 1.5, ambI: .55 }) });
    S.scene.background = skyTex(night ? 'night' : 'day'); },
  house_exterior(night) {
    plane(200, 200, mat('#fff', { map: TEX.grass([40, 40]), rough: .9 }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor';
    plane(200, 10, mat('#fff', { map: TEX2.asphalt([40, 2]) }), [0, .02, 20], [-90, 0, 0]).userData.kind = 'floor'; for (let x = -96; x < 100; x += 8) box(3, .02, .3, '#f2f2f2', [x, .02, 20], { cast: false });
    box(200, .25, 4, mat('#fff', { map: TEX.concrete([40, 1]) }), [0, 0, 13]); plane(7, 22, mat('#fff', { map: TEX.concrete([2, 5]) }), [8.5, .03, 0], [-90, 0, 0]).userData.kind = 'floor';
    plane(2.6, 10, mat('#fff', { map: TEX.concrete([1, 3]) }), [0, .03, 6.5], [-90, 0, 0]).userData.kind = 'floor';
    prop('house', { pos: [0, 0, -4.5], color: SO.color }); prop('fence', { pos: [-9, 0, 11], w: 10 }); prop('mailbox', { pos: [3, 0, 11.4] }); prop('car', { pos: [8.5, 0, -2], color: '#2b62d9' });
    for (const x of [-22, -14, 16, 24]) prop('tree', { pos: [x, 0, -6] }); prop('bush', { pos: [-4.5, 0, 2] }); prop('bush', { pos: [4.5, 0, 2] }); prop('street_lamp', { pos: [-14, 0, 14.5], rotY: 180, on: night });
    prop('house', { pos: [-34, 0, -6], color: '#c8d8e8', roof: '#3a4a6a' }); prop('house', { pos: [34, 0, -6], color: '#e8c8c8', roof: '#4a3a2a' });
    night ? light('night', { center: [0, 0, 0], shadowR: 40, fog: ['#0b1030', 40, 140] }) : light('day', { center: [0, 0, 0], shadowR: 40, fog: ['#cfe6fb', 60, 170] }); S.scene.background = skyTex(night ? 'night' : 'day'); },
  city_street(night) {
    plane(300, 300, mat('#fff', { map: TEX.concrete([60, 60]) }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor'; plane(14, 300, mat('#fff', { map: TEX2.asphalt([3, 60]) }), [0, .02, 0], [-90, 0, 0]).userData.kind = 'floor';
    for (let z = -140; z < 140; z += 8) box(.3, .02, 3.5, '#f2c21a', [0, .02, z], { cast: false }); for (let i = 0; i < 6; i++) box(1.2, .02, 5, '#f4f4f4', [-5 + i * 2, .03, 8], { cast: false });
    for (const s of [1, -1]) box(5, .3, 300, mat('#fff', { map: TEX.concrete([1, 60]) }), [s * 9.5, 0, 0]);
    const r = rng(17), cols = ['#c9b79a', '#b9c4cf', '#d9a98a', '#a9b7a0', '#cfc6e0', '#8f9aa6'];
    for (const s of [1, -1]) for (let z = -100; z <= 60; z += 14) { const bw = 12 + r() * 2, bh = 16 + r() * 30; prop('building', { pos: [s * (13 + bw / 2), 0, z], w: bw, h: bh, d: 13, color: cols[(r() * cols.length) | 0], lit: night }); }
    for (const z of [-40, -12, 16, 44]) { prop('street_lamp', { pos: [-7.6, 0, z], rotY: 90, on: night }); prop('street_lamp', { pos: [7.6, 0, z + 14], rotY: -90, on: night }); }
    prop('traffic_light', { pos: [7.8, 0, 4], rotY: -90, state: SO.light || 'red' }); prop('car', { pos: [4, 0, -24], color: '#f2c21a' }); prop('car', { pos: [-4, 0, -40], rotY: 180, color: '#2b62d9' }); prop('trashcan', { pos: [-8.5, .3, 0] });
    night ? light('night', { center: [0, 0, 0], shadowR: 40, fog: ['#0b1030', 40, 150] }) : light('day', { center: [0, 0, 0], shadowR: 40, sunDir: [-14, 34, 12], fog: ['#cfe6fb', 70, 190] }); S.scene.background = skyTex(night ? 'night' : 'day'); },
  beach() {
    plane(200, 200, mat('#fff', { map: TEX2.sand([40, 40]) }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor';
    const sea = prop('water', { pos: [0, .12, -70], w: 300, d: 120, opacity: .92 }); box(300, .05, 1.6, '#ffffff', [0, .1, -10.2], { cast: false });
    onFrame(t => { sea.position.y = .12 + .06 * Math.sin(t * 1.4); });
    for (const [x, z] of [[-12, -2], [14, 4], [-20, 8], [22, -4]]) prop('palm', { pos: [x, 0, z], rotY: x * 9 }); prop('umbrella', { pos: [11, 0, -3], color: '#e8467c' }); prop('towel', { pos: [12.5, .02, -1.5] }); prop('ball', { pos: [-3, 0, 4], color: '#f2f2f2', r: .7 });
    prop('rock', { pos: [-8, 0, -6], size: 2 }); prop('planet', { pos: [40, 34, -150], r: 8, kind: 'sun' });
    light('day', { center: [0, 0, 0], shadowR: 40, sun: 2.8, fog: ['#e9f4fb', 80, 220] }); S.scene.background = skyTex('hot'); },
  forest(night) {
    plane(200, 200, mat('#fff', { map: TEX.grass([40, 40]), rough: .95 }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor'; plane(5, 160, mat('#fff', { map: TEX2.dirt([1, 30]) }), [0, .02, -20], [-90, 0, 0]).userData.kind = 'floor';
    const r = rng(23); for (let i = 0; i < 70; i++) { const x = (r() - .5) * 120, z = 30 - r() * 140; if (Math.abs(x) < 5) continue; prop(r() < .55 ? 'pine' : 'tree', { pos: [x, 0, z], scale: .9 + r() * .7, color: r() < .5 ? '#2f6e3a' : '#3f8f37' }); }
    for (let i = 0; i < 10; i++) { const x = (r() - .5) * 40, z = 10 - r() * 60; if (Math.abs(x) < 4) continue; prop(i % 3 ? 'bush' : 'rock', { pos: [x, 0, z], seed: i }); } prop('log', { pos: [6, 0, -4], rotY: 30 });
    night ? light('night', { center: [0, 0, 0], shadowR: 40, fog: ['#07101a', 20, 90], hemi: .6 }) : light('day', { center: [0, 0, 0], shadowR: 40, sun: 1.9, hemi: 1.0, fog: ['#b8d4b0', 30, 120] });
    S.scene.background = night ? skyTex('night') : skyTex('#b8d4b0'); },
  desert() {
    plane(300, 300, mat('#fff', { map: TEX2.sand([60, 60]) }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor';
    for (const [x, z, r] of [[-30, -40, 10], [26, -55, 14], [-60, -80, 18], [50, -20, 9]]) prop('dune', { pos: [x, 0, z], r }); prop('pyramid', { pos: [-20, 0, -110] }); prop('pyramid', { pos: [25, 0, -140], r: 14, h: 16 });
    for (const [x, z] of [[-8, -6], [10, -12], [16, 6], [-14, 10]]) prop('cactus', { pos: [x, 0, z] }); prop('rock', { pos: [5, 0, -4], color: '#b07a4a' }); prop('planet', { pos: [-30, 40, -160], r: 7, kind: 'sun' });
    light('day', { center: [0, 0, 0], shadowR: 40, sun: 3.0, sunColor: '#fff0d0', fog: ['#f5ecd4', 80, 230] }); S.scene.background = skyTex('hot'); },
  snow() {
    plane(200, 200, mat('#fff', { map: TEX2.snow([40, 40]), rough: .95 }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor';
    const r = rng(29); for (let i = 0; i < 40; i++) { const x = (r() - .5) * 120, z = 20 - r() * 120; if (Math.abs(x) < 7 && z > -30) continue; prop('pine', { pos: [x, 0, z], snow: true, scale: .9 + r() * .6 }); }
    prop('snowman', { pos: [-5, 0, -4] }); prop('igloo', { pos: [9, 0, -12], rotY: -20 }); prop('ice', { pos: [-10, 0, -14], w: 4, h: 3, d: 4 });
    if (SO.snowfall !== false) particles(0, 1e9, { kind: 'snow', area: [50, 20, 50], at: [0, 0, -8] });
    light('day', { center: [0, 0, 0], shadowR: 40, sun: 1.6, hemi: 1.6, sky: '#e8f0ff', fog: ['#dfe6ee', 40, 140] }); S.scene.background = skyTex('overcast'); },
  space() {
    if (SO.ground !== false) { plane(300, 300, mat('#fff', { map: TEX2.moon([30, 30]), rough: .95 }), [0, 0, 0], [-90, 0, 0]).userData.kind = 'floor';
      const r = rng(37); for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.5 + r() * 3, .35, 6, 24), mat('#9a9aa0')); t.rotation.x = Math.PI / 2; t.position.set((r() - .5) * 80, .05, -r() * 80 + 10); t.scale.z = .5; S.scene.add(t); }
      prop('rocket', { pos: [14, 0, -18] }); }
    prop('planet', { pos: [-40, 38, -130], r: 24, kind: 'earth' }); prop('planet', { pos: [60, 50, -170], r: 6, kind: 'mars' });
    light('night', { center: [0, 0, 0], shadowR: 40, sun: 2.6, sunColor: '#ffffff', hemi: .45, ambI: .3, sky: '#9aa8d0', ground: '#3a3a40', sunDir: [-20, 24, 14], exposure: 1.05 }); S.scene.background = TEX2.stars(); },
  pool_room() { const h = SO.h || 14; _room({ w: 34, d: 30, h, floor: TEX.tile([12, 10], '#f2f8fb', '#cfe6f0'), wall: '#e6f3f8', wallLow: '#5cb6ee', ceiling: SO.ceiling ?? true });
    prop('pool', { pos: [0, 0, -3], w: 20, d: 12 }); for (const z of [-13.95]) prop('window', { pos: [-8, 4, z], w: 6, h: 5 }); prop('window', { pos: [8, 4, -13.95], w: 6, h: 5 });
    ceilingLights([-8, 8], [-6, 6], h - .01); pointL([0, h - 1, 0], '#ffffff', 34, 40); light('indoor', { center: [0, 0, 0], bg: '#e6f3f8', shadowR: 30 }); },
});
SETS.restaurant = SETS.pizzeria; SETS.supermarket = SETS.store; SETS.neighborhood = SETS.house_exterior; SETS.street = SETS.city_street; SETS.moon = SETS.space; SETS.pool = SETS.pool_room;
SET_NAMES.push(...Object.keys(SETS).filter(k => !SET_NAMES.includes(k)));

// ---- added by experiments/roblox-style/tools/export_suite.py (the app reads these; never edit this copy)
export const ENGINE_KIND = 'roblox';
export const ENGINE_VERSION = 1
