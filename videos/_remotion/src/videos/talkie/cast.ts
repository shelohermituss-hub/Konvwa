// La distribution de « La tour qui faisait fondre les voitures » : cartes plates éclairées dans le monde 3D (même
// mécanique que le modèle du pont : pool de canevas, cartes tournées vers l'objectif, ombre de contact, clignements).
// stage(id, t, cam) dit qui est où, dans quelle pose et avec quelle expression ; les effets (fumée, chaleur, bulles)
// sont des cartes non éclairées.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, fxPuff, KID, SKINS, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { FPS, V3, SHOTS, Light, at, smooth, clamp01, HOT, JAG, BIKE, MAT, PAN, PARK, LV, groundY } from "./story";
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
const CONTACT: Record<Light, [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], gris: [0.32, 0.33, 0.4] };
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

/** costume-cravate de l'homme d'affaires (propriétaire de la Jaguar) */
const BIZ: Outfit = { jacket: "#2c3550", pants: "#2a2f40", boots: "#2a1c18", hat: "hair", hair: "#3b2a20", tie: "#c0353a", skin: SKINS[1], build: "stout" };
const CAMERAMAN: Outfit = { jacket: "#5d7a3a", pants: "#3b3f52", boots: "#4a3426", hat: "cap", cap: "#2f5f6a", skin: SKINS[3] };
const REPORTER: Outfit = { jacket: "#c25a7a", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#d9a441", dress: "#7b5ac9", skin: SKINS[0] };
const WRITER: Outfit = { jacket: "#b5653f", pants: "#2a2f40", boots: "#2a1c18", hat: "hair", hair: "#2a201a", skin: SKINS[2] };
const LONDON_KID: Outfit = { ...KID, jacket: "#3f6fb5", cap: "#f2c230" };
const MECHANIC: Outfit = { jacket: "#3f6fb5", pants: "#2f5f6a", boots: "#2a1c18", hat: "cap", cap: "#e2453c", skin: SKINS[1] };
const GUEST: Outfit = { jacket: "#f08a2c", pants: "#3f6fb5", boots: "#f4f1ea", hat: "hair", hair: "#7a4f33", skin: SKINS[0], build: "stout" };
/** Londoniens : manteaux, robes, cheveux variés */
const FOLK: Outfit[] = [
  { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#5a3b2a", skin: SKINS[0] },
  { jacket: "#8c3b4a", pants: "#3b3f52", boots: "#2a1c18", hat: "hair", hair: "#2a201a", dress: "#d9a441", skin: SKINS[3] },
  { jacket: "#5d7a3a", pants: "#2a2f40", boots: "#4a3426", hat: "hair", hair: "#c9a06a", skin: SKINS[2] },
  { jacket: "#2f5f6a", pants: "#3b3f52", boots: "#2a1c18", hat: "hair", hair: "#7a4f33", dress: "#c25a7a", skin: SKINS[1] },
  { jacket: "#b5653f", pants: "#2a2f40", boots: "#4a3426", hat: "cap", cap: "#3f6fb5", skin: SKINS[0] },
  { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#2a1c18", hat: "hair", hair: "#2a201a", skin: SKINS[3] },
];
const UMB = ["#2f3a56", "#c0353a", "#2f6a43", "#3a3d47", "#d9a441", "#3f6fb5"];

/** quelqu'un qui marche de (x0, z0) à la vitesse (vx, vz) m/s depuis t0 ; pas de 0,7 m */
const walker = (cam: CamInfo, out: Stage, i: number, o: Outfit, okey: string, t: number, t0: number, x0: number, z0: number, vx: number, vz: number,
  expr: Expr, prop: Prop = null, sc = 1) => {
  const x = x0 + vx * (t - t0), z = z0 + vz * (t - t0), sp = Math.hypot(vx, vz);
  const phase = q(((t - t0) * sp / 1.4 + hh(i, 5)) % 1, 120);
  const view = viewOf(cam, x, z, vx || 1e-3, vz);
  const y = groundY(x, z);
  const fo: FrontOpts = { mode: "stroll", phase, expr, prop, blink: lidAt(t, i) };
  const so: SideOpts = { mode: "march", phase, expr, stomp: 0.55, stride: 0.875 * view.fs, blink: lidAt(t, i) };
  out.places.push(person(cam, { i, o, okey }, x, y, z, prop ? { side: false, mirror: false } : view, fo, so, sc));
  blob(out, x, y, z, sc);
};
/** quelqu'un debout, de face */
const stander = (cam: CamInfo, out: Stage, i: number, o: Outfit, okey: string, t: number, x: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1, dy = 0) => {
  const y = groundY(x, z) + dy;
  const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, i), ...extra };
  out.places.push(person(cam, { i, o, okey }, x, y, z, { side: false, mirror: false }, fo, {}, sc));
  if (extra.mode !== "sit") blob(out, x, y, z, sc);
};

/** fumée qui monte d'un point (n bouffées décalées) */
const smoke = (out: Stage, t: number, x: number, y: number, z: number, size: number, n = 4, rate = 0.8, seed = 0) => {
  for (let k = 0; k < n; k++) {
    const u = (t * rate + k / n + hh(seed, k)) % 1, s = size * (0.5 + 1.2 * u);
    out.fx.push({ key: `smoke${q(u, 24)}`, cw: 300, ch: 300, draw: (p) => fxSmoke(p, q(u, 24)), soft: true,
      x: x + 0.15 * size * Math.sin(u * 5 + k + seed), y: y + 1.6 * size * u, z, w: s, h: s, rot: u * 0.8 });
  }
};
/** bouffée de fumée grise (300 x 300), t 0..1 */
const fxSmoke = (p: Pen, t: number) => {
  const a = (0.75 * (1 - t) ** 1.3).toFixed(3);
  for (const [x, y, r] of [[130, 170, 70], [175, 150, 62], [150, 120, 58], [115, 130, 48]] as const) p.ell(x, y, r, r * 0.9, `rgba(120,116,124,${a})`, 0);
  for (const [x, y, r] of [[145, 120, 34], [170, 140, 26]] as const) p.ell(x, y, r, r * 0.9, `rgba(176,172,180,${a})`, 0);
};
/** ondes de chaleur (220 x 320) : trois traits ondulés qui montent */
const fxHeat = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) { const y = 300 - i * 17; pts.push([60 + k * 50 + 12 * Math.sin(i * 0.9 + t * 12 + k), y]); }
    p.stroke(pts, 7, "rgba(255,248,226,0.7)");
  }
};
const heat = (out: Stage, t: number, x: number, y: number, z: number, s: number) => {
  const u = q((t * 2) % 1, 12);
  out.fx.push({ key: `heat${u}`, cw: 220, ch: 320, draw: (p) => fxHeat(p, u), soft: true, x, y: y + 0.5 * s, z, w: 0.7 * s, h: 1.0 * s });
};
/** cloques (bulles) qui gonflent sur la selle : 240 x 120, k 0..1 */
export const fxBlisters = (p: Pen, k: number) => {
  for (const [x, y, r, d] of [[60, 70, 22, 0], [118, 52, 28, 0.2], [176, 72, 20, 0.35], [98, 88, 16, 0.5], [150, 92, 14, 0.6]] as const) {
    const g = clamp01((k - d) / 0.4);
    if (g <= 0) continue;
    p.ell(x, y, r * g, r * 0.8 * g, "#3a2c2c", 5);
    p.ell(x - r * 0.3 * g, y - r * 0.3 * g, r * 0.3 * g, r * 0.2 * g, "rgba(255,255,255,0.5)", 0);
  }
};
/** l'œuf dans la poêle (vu de dessus, 300 x 300), k 0 = cru, 1 = cuit */
const fxEgg = (p: Pen, k: number) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, r = 110 + 14 * Math.sin(a * 5) + 8 * Math.sin(a * 3 + 1); pts.push([150 + r * Math.cos(a), 150 + r * 0.85 * Math.sin(a)]); }
  const w = Math.round(205 + 50 * k);
  p.poly(pts, `rgba(${w},${w},${Math.round(w * 0.97)},${(0.35 + 0.65 * k).toFixed(2)})`, 4 + 4 * k);
  if (k > 0.6) for (const [x, y] of [[80, 120], [210, 190], [200, 100]]) p.ell(x, y, 16, 10, "rgba(214,170,110,0.6)", 0);
  p.ell(165, 140, 40, 36, "#f2a92a", 5);
  p.ell(152, 128, 12, 8, "rgba(255,255,255,0.7)", 0);
};
/** la feuille morte sous la loupe (vue de dessus, 300 x 200), burn 0..1 */
const fxLeaf = (p: Pen, burn: number) => {
  p.poly([[20, 100], [90, 40], [190, 30], [280, 100], [190, 170], [90, 160]], "#c98a3a", 6);
  p.stroke([[30, 100], [270, 100]], 5, "#8a5a2a");
  for (const x of [90, 150, 210]) { p.stroke([[x, 100], [x + 30, 55]], 3, "#8a5a2a"); p.stroke([[x, 100], [x + 30, 145]], 3, "#8a5a2a"); }
  if (burn > 0) { p.ell(170, 100, 34 * burn, 24 * burn, "#3a2420", 0); p.ell(170, 100, 16 * burn, 11 * burn, "#e8642a", 0); }
};
export { fxEgg, fxLeaf };

/** tout ce qui a un visage (et les petits effets) dans le plan id au temps t */
export const stage = (id: number, t: number, cam: CamInfo, s = SHOTS[id - 1]): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = s.light;
  findSun(cam, SUN);
  const [hx, , hz] = HOT, [jx, , jz] = JAG;
  const street = (golden: boolean, umbrellas: boolean) => {
    // passants sur les deux trottoirs, à pas lents ; quelques-uns s'arrêtent et regardent la tour
    for (let i = 0; i < 14; i++) {
      const north = i % 3 === 0, z = north ? -6.2 - hh(i, 2) * 1.6 : 6.6 + hh(i, 2) * 2.4;
      const dir = hh(i, 3) < 0.5 ? -1 : 1, sp = 0.8 + 0.4 * hh(i, 4), x0 = -30 + i * 5.2 + hh(i) * 3;
      const x = x0 + dir * sp * (t - 40);
      if (!north && Math.abs(x - hx) < 7 && golden) continue; // personne ne reste dans la tache de lumière
      walker(cam, out, 300 + i, FOLK[i % 6], `f${i % 6}${umbrellas ? "u" : ""}`, t, 40, x0, z, dir * sp, 0, golden && i % 4 === 1 ? "nervous" : "neutral",
        umbrellas ? "umbrella" : null);
    }
  };
  switch (id) {
    case 1: { // l'accroche : une passante horrifiée devant la voiture qui fond
      stander(cam, out, 10, FOLK[1], "f1", t, 12.3, 7.3, "shock", { look: -1 });
      smoke(out, t, jx + 1.6, 1.25, jz, 0.9, 5, 0.7, 1);
      smoke(out, t, jx - 0.6, 1.4, jz + 0.4, 0.8, 4, 0.6, 2);
      heat(out, t, jx + 2.0, 0.9, jz + 0.9, 1.1);
      break;
    }
    case 5: case 24: { // l'enfant et son talkie-walkie (jouet) ; un parent derrière
      const talk = id === 24;
      stander(cam, out, 20, LONDON_KID, "kid", t, -5.0, 9.4, talk ? "grin" : "smile", { prop: "walkie", look: talk ? 0 : 1 }, 0.72);
      if (!talk) stander(cam, out, 21, FOLK[0], "f0", t, -2.4, 8.2, "smile", { look: -1 });
      break;
    }
    case 6: case 17: street(true, false); break;
    case 16: street(false, true); break;
    case 7: {
      street(true, false);
      // quelqu'un s'arrête net au bord de la tache
      stander(cam, out, 30, FOLK[2], "f2", t, hx - 6.8, hz + 1.4, t > at(63) ? "shock" : "neutral", { look: 1 });
      break;
    }
    case 8: { smoke(out, t, BIKE[0] + 0.05, 1.0, BIKE[2], 0.35, 4, 1.1, 3); heat(out, t, BIKE[0] - 0.3, 0.9, BIKE[2], 0.6); break; }
    case 9: { const k = clamp01((t - at(75)) / 0.6); smoke(out, t, MAT[0], 0.05, MAT[2], 0.25 + 0.35 * k, 5, 0.9, 4); break; }
    case 10: case 13: { // l'homme d'affaires arrive, puis découvre les dégâts
      const tin = at(80), arrive = id === 10 ? smooth((t - (s.a / FPS)) / Math.max(0.1, tin + 0.6 - s.a / FPS)) : 1;
      const x = 12.4 - 3.0 * arrive, z = 6.0;
      const expr: Expr = id === 13 ? (t > at(92) ? "pained" : "shock") : t > at(82) ? "shock" : "smile";
      if (arrive < 1) walker(cam, out, 40, BIZ, "biz", t, t, x, z, -1.2, 0, expr);
      else stander(cam, out, 40, BIZ, "biz", t, x, z, expr, { look: id === 13 ? 1 : -1 });
      smoke(out, t, jx + 1.6, 1.25, jz, 0.8, 4, 0.7, 1);
      break;
    }
    case 11: smoke(out, t, jx + 0.9, 1.15, jz + 0.95, 0.25, 3, 1.2, 5); break;
    case 12: smoke(out, t, jx + 2.45, 0.85, jz, 0.25, 3, 1.2, 6); heat(out, t, jx + 2.5, 0.8, jz + 0.2, 0.45); break;
    case 14: { // les journalistes accourent depuis la gauche
      const t0 = SHOTS[13].a / FPS;
      walker(cam, out, 50, CAMERAMAN, "cam", t, t0, -3.5, 8.8, 2.2, -0.35, "grin", "camera");
      walker(cam, out, 51, REPORTER, "rep", t, t0, -5.0, 7.6, 2.4, -0.2, "grin", "mic");
      walker(cam, out, 52, WRITER, "wri", t, t0, -6.4, 9.4, 2.3, -0.3, "laugh", "notebook");
      stander(cam, out, 40, BIZ, "biz", t, 9.3, 6.0, "pained");
      smoke(out, t, jx + 1.6, 1.25, jz, 0.8, 4, 0.7, 1);
      break;
    }
    case 15: { // la poêle et l'œuf
      stander(cam, out, 51, REPORTER, "rep", t, PAN[0] + 1.2, PAN[2] - 0.9, t > at(108) ? "laugh" : "grin", { prop: t < at(108) ? "egg" : "mic", look: -1 });
      heat(out, t, PAN[0], 0.05, PAN[2], 0.5);
      break;
    }
    case 18: case 19: { // le parc : un enfant tient la loupe au-dessus d'une feuille
      if (id === 18) stander(cam, out, 60, LONDON_KID, "kid", t, PARK[0] - 0.35, PARK[2] - 0.25, t > at(134) ? "grin" : "smile", { prop: "magnifier", look: 1 }, 0.72);
      const burn = clamp01((t - at(148)) / 0.8);
      if (burn > 0.3) smoke(out, t, PARK[0] + 0.55, 0.03, PARK[2] + 0.45, 0.18 + 0.12 * burn, 4, 1.2, 7);
      break;
    }
    case 22: { // la Jaguar réparée : chèque et mécanicien
      stander(cam, out, 40, BIZ, "biz", t, 9.4, 6.1, "relief", { prop: "cheque" });
      stander(cam, out, 70, MECHANIC, "mech", t, 4.0, 5.6, "grin", { look: 1 });
      break;
    }
    case 26: { // Las Vegas : un client sur son transat, les cheveux qui fument
      const [lx, , lz] = LV, k = clamp01((t - at(207)) / 0.5);
      stander(cam, out, 80, GUEST, "guest", t, lx - 0.2, lz - 1.6, k > 0.4 ? "shock" : "smile_closed", { mode: "sit" }, 1, 0.42);
      if (k > 0) smoke(out, t, lx - 0.2, 1.7, lz - 1.5, 0.45 + 0.2 * k, 6, 1.3, 8);
      stander(cam, out, 81, FOLK[3], "f3", t, lx - 2.6, lz - 2.4, "smile", { mode: "sit" }, 1, 0.42);
      break;
    }
    default: break;
  }
  return out;
};
export { FPS };
