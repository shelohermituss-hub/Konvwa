// Test du nouveau rendu (références de la chaîne) : distribution : cartes plates éclairées dans le monde 3D (même mécanique que le modèle
// du pont : pool de canevas, cartes tournées vers l'objectif, ombre de contact, clignements). stage(id, t, cam) dit qui
// est où, dans quelle pose et avec quelle expression ; les effets (rats, queues, pièce, tableaux) sont des cartes non éclairées.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, KID, SKINS, townsfolk, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { FPS, V3, SHOTS, Light, at, smooth, clamp01, CLERK, CATCHER, FARMER, groundY } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: Light = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<Light, [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], gris: [0.32, 0.33, 0.4], canicule: [0.24, 0.22, 0.3] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME !== "golden") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- la distribution ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** visages BLANCS, comme dans les références (contour noir épais, yeux points) */
const WHITE = "#f7f4ee";
const CATCH: Outfit = { jacket: "#3a3d6b", pants: "#2a2f40", boots: "#2a1c18", hat: "non", skin: WHITE };
const FARM: Outfit = { jacket: "#6b4f3a", pants: "#3b3f52", boots: "#2a1c18", hat: "non", skin: WHITE };
const CLERK_O: Outfit = { jacket: "#f1ede2", pants: "#e4ddcc", boots: "#3a2a20", hat: "casque", skin: WHITE, moustache: "#5a3b2a", tie: "#2a2f40", build: "stout" };

const walker = (cam: CamInfo, out: Stage, i: number, o: Outfit, okey: string, t: number, t0: number, x0: number, z0: number, vx: number, vz: number,
  expr: Expr, prop: Prop = null, sc = 1, run = false) => {
  const x = x0 + vx * (t - t0), z = z0 + vz * (t - t0), sp = Math.hypot(vx, vz);
  const phase = q(((t - t0) * sp / (run ? 1.0 : 1.4) + hh(i, 5)) % 1, 120);
  const view = viewOf(cam, x, z, vx || 1e-3, vz);
  const y = groundY(x, z);
  const fo: FrontOpts = { mode: run ? "march" : "stroll", phase, expr, prop, blink: lidAt(t, i), lift: run ? 70 : 60 };
  const so: SideOpts = { mode: "march", phase, expr, stomp: run ? 1.0 : 0.55, stride: (run ? 1.2 : 0.875) * view.fs, blink: lidAt(t, i) };
  out.places.push(person(cam, { i, o, okey }, x, y, z, prop ? { side: false, mirror: false } : view, fo, so, sc));
  blob(out, x, y, z, sc);
};
const stander = (cam: CamInfo, out: Stage, i: number, o: Outfit, okey: string, t: number, x: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1, dy = 0) => {
  const y = groundY(x, z) + dy;
  const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, i), ...extra };
  out.places.push(person(cam, { i, o, okey }, x, y, z, { side: false, mirror: false }, fo, {}, sc));
  if (extra.mode !== "sit") blob(out, x, y, z, sc);
};


/** un rat de profil (300 x 160), tourné vers la droite ; f = image de course (0..3), tail = avec sa queue */
const fxRat = (p: Pen, f: number, tail: boolean, flip: boolean) => {
  const g = p.g;
  g.save();
  if (flip) { g.translate(300, 0); g.scale(-1, 1); }
  const lg = [[0, 1], [1, 0], [0, -1], [-1, 0]][f % 4];
  if (tail) p.stroke([[90, 100], [55, 92], [25, 104], [6, 92]], 7, "#d99a9a");
  else p.ell(88, 98, 7, 7, "#c46a6a", 4);
  for (const [lx, s] of [[120, lg[0]], [200, lg[1]]] as const) p.stroke([[lx, 110], [lx + 14 * s, 140]], 9, "#4a3a3a");
  p.ell(150, 98, 70, 38, "#7a6a66", 7);
  p.ell(140, 88, 46, 16, "rgba(255,255,255,0.18)", 0);
  p.poly([[200, 76], [262, 100], [246, 112], [205, 118]], "#7a6a66", 7);
  p.ell(206, 70, 16, 18, "#d99a9a", 6);
  p.dot(232, 92, 6); p.dot(262, 101, 6, "#2a1c1c");
  for (const k of [-1, 1]) p.stroke([[258, 102], [286, 98 + k * 10]], 2, "#241726");
  g.restore();
};
/** des rats qui courent : n rats dans la bande [x0, x1] à z, vitesse v (m/s), boucle ; tail : avec ou sans queue */
const rats = (out: Stage, cam: CamInfo, t: number, n: number, x0: number, x1: number, z0: number, z1: number, y: number, v: number, tail: (k: number) => boolean, sz = 0.36, seed = 0) => {
  for (let k = 0; k < n; k++) {
    const len = x1 - x0, sp = v * (0.7 + 0.6 * hh(k, 41 + seed));
    const x = x0 + ((((hh(k, 42 + seed) * len + sp * t) % len) + len) % len), z = z0 + (z1 - z0) * hh(k, 43 + seed);
    const f = Math.floor(t * 12 + k) % 4, right = sp * cam.right.x > 0, tl = tail(k);
    out.fx.push({ key: `rat${f}${tl ? "t" : "n"}${right ? "r" : "l"}`, cw: 300, ch: 160, draw: (p) => fxRat(p, f, tl, !right), x, y: y + sz * 0.27, z, w: sz, h: sz * 0.53 });
  }
};
/** la pièce d'un centime (300 x 300), vue de face ou de tranche selon s (-1..1) */
const fxCoin = (p: Pen, s: number) => {
  const w = Math.max(0.08, Math.abs(s));
  p.ell(150, 150, 130 * w, 130, "#e8c45a", 10);
  p.ell(150, 150, 100 * w, 100, null, 5);
  if (w > 0.5) { const g = p.g; g.fillStyle = "#7a5a1a"; g.textAlign = "center"; g.font = '900 90px Georgia, serif'; g.save(); g.translate(150, 150); g.scale(w, 1); g.fillText("1", 0, 10); g.font = '900 30px Georgia, serif'; g.fillText("CENT", 0, 60); g.restore(); }
};
/** la botte de queues de rats (260 x 300) */
const fxTails = (p: Pen) => {
  for (let k = 0; k < 14; k++) { const x0 = 70 + k * 9; p.stroke([[x0, 40], [x0 + 6 * Math.sin(k), 120], [x0 - 8 + 4 * Math.cos(k), 200], [x0 + 10 * Math.sin(k * 2), 285]], 9, k % 2 ? "#d99a9a" : "#e6aaaa"); }
  p.poly([[60, 60], [200, 60], [200, 92], [60, 92]], "#8a5a34", 6);
};

/** la scène au temps t : le chasseur et l'employé au guichet, l'éleveur et ses rats dans la réserve */
export const stage = (id: number, t: number, cam: CamInfo, s = SHOTS[id - 1]): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = s.light;
  findSun(cam, SUN);
  // au guichet
  stander(cam, out, 1, CATCH, "catch", t, CATCHER[0], CATCHER[2], t > at(6) ? "grin" : "smile", { prop: "tail", look: -1 });
  const shock = t > at(8);
  stander(cam, out, 2, CLERK_O, "clerk", t, CLERK[0], CLERK[2], shock ? "shock" : "neutral", { prop: shock ? null : "coin", look: 1, wave: shock ? 0.9 : undefined });
  out.fx.push({ key: "coin1", cw: 300, ch: 300, draw: (p) => fxCoin(p, 1), x: 0.42, y: 1.095, z: 0.15, w: 0.08, h: 0.08, flat: true });
  out.fx.push({ key: "tails", cw: 260, ch: 300, draw: fxTails, x: 0.72, y: 1.21, z: 0.22, w: 0.2, h: 0.24, rot: -0.15 });
  // dans la réserve : l'éleveur ravi, des rats dans les cages et par terre
  stander(cam, out, 3, FARM, "farm", t, FARMER[0], FARMER[2], t > at(16) ? "laugh" : "grin", { look: -1, wave: t > at(18) ? 0.7 : undefined });
  for (let c = 0; c < CAGES.length; c++) for (let k = 0; k < 3; k++) {
    const [cx, cy, cz] = CAGES[c], f = Math.floor(t * 8 + k + c) % 4;
    out.fx.push({ key: `rat${f}t${k % 2 ? "r" : "l"}`, cw: 300, ch: 160, draw: (p) => fxRat(p, f, true, k % 2 === 0), x: cx - 0.3 + k * 0.3, y: cy + 0.12, z: cz + 0.15, w: 0.24, h: 0.13 });
  }
  for (let k = 0; k < 5; k++) {
    const x = 6.2 + ((k * 0.9 + t * (0.8 + 0.2 * k)) % 3.6), f = Math.floor(t * 12 + k) % 4;
    out.fx.push({ key: `rat${f}tr`, cw: 300, ch: 160, draw: (p) => fxRat(p, f, true, false), x, y: 0.07, z: -0.2 - k * 0.35, w: 0.3, h: 0.16 });
  }
  return out;
};
/** planchers des cages de la réserve (x, y, z) : la scène en pose les rats */
export const CAGES: V3[] = [[7.4, 0.15, -2.75], [8.6, 0.15, -2.75], [9.8, 0.15, -2.75], [7.4, 0.95, -2.75], [8.6, 0.95, -2.75], [9.8, 0.95, -2.75]];
export { FPS };
