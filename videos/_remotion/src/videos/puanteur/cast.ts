// La distribution de « La Grande Puanteur » : cartes plates éclairées dans le monde 3D (même mécanique que le modèle
// du pont : pool de canevas, cartes tournées vers l'objectif, ombre de contact, clignements). stage(id, t, cam) dit qui
// est où, dans quelle pose et avec quelle expression ; les effets (odeurs, mouches, bulles, nuage) sont des cartes non éclairées.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, KID, SKINS, townsfolk, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { FPS, V3, SHOTS, Light, at, smooth, clamp01, CH, MOD, SEW, BAZ, THERMO, STREET_Z, groundY } from "./story";
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

/** députés de 1858 : redingotes sombres, hauts-de-forme, quelques moustaches */
const MP: Outfit[] = [
  { jacket: "#2a2f40", pants: "#4a4a52", boots: "#1e1a1c", hat: "tophat", skin: SKINS[0], moustache: "#4a3426" },
  { jacket: "#3b2a2a", pants: "#55524c", boots: "#1e1a1c", hat: "tophat", skin: SKINS[1] },
  { jacket: "#2f3a2f", pants: "#4a4a52", boots: "#1e1a1c", hat: "tophat", skin: SKINS[2], moustache: "#7a5a3a", build: "stout" },
  { jacket: "#3a3550", pants: "#55524c", boots: "#1e1a1c", hat: "tophat", skin: SKINS[0] },
  { jacket: "#2a2f40", pants: "#3b3f52", boots: "#1e1a1c", hat: "tophat", skin: SKINS[3], moustache: "#2a201a" },
  { jacket: "#4a3a2a", pants: "#4a4a52", boots: "#1e1a1c", hat: "tophat", skin: SKINS[1], build: "stout", moustache: "#c9c2b8" },
];
const BAZALGETTE: Outfit = { jacket: "#2a2f40", pants: "#3b3f52", boots: "#1e1a1c", hat: "tophat", skin: SKINS[1], moustache: "#3a2a20", build: "stout" };
const SERVANT: Outfit = { jacket: "#3a3d6b", pants: "#3a3d6b", boots: "#2a1c18", hat: "bonnet", dress: "#3a3d6b", skin: SKINS[2] };
const NEWSBOY: Outfit = { ...KID, jacket: "#7a5a3a", pants: "#4a4a52", boots: "#2a1c18", cap: "#5a3b2a" };
const NAVVY: Outfit[] = [
  { jacket: "#8c5a3a", pants: "#4a4a52", boots: "#2a1c18", hat: "cap", cap: "#5a3b2a", skin: SKINS[1] },
  { jacket: "#5d7a3a", pants: "#3b3f52", boots: "#2a1c18", hat: "cap", cap: "#3a3d47", skin: SKINS[3] },
  { jacket: "#a8724a", pants: "#4a4a52", boots: "#2a1c18", hat: "cap", cap: "#2f3a2f", skin: SKINS[0] },
];
const MODERN_KID: Outfit = { ...KID, jacket: "#3f6fb5", cap: "#f2c230" };
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));

/** quelqu'un qui marche de (x0, z0) à (vx, vz) m/s depuis t0 ; pas de 0,7 m */
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
/** quelqu'un debout ou assis, de face */
const stander = (cam: CamInfo, out: Stage, i: number, o: Outfit, okey: string, t: number, x: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, sc = 1, dy = 0) => {
  const y = groundY(x, z) + dy;
  const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, i), ...extra };
  out.places.push(person(cam, { i, o, okey }, x, y, z, { side: false, mirror: false }, fo, {}, sc));
  if (extra.mode !== "sit") blob(out, x, y, z, sc);
};

// ---------------- effets dessinés ----------------
/** lignes d'odeur vertes (220 x 320) : trois traits ondulés qui montent */
const fxStink = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) { const y = 300 - i * 17; pts.push([60 + k * 50 + 14 * Math.sin(i * 0.8 + t * 10 + k), y]); }
    p.stroke(pts, 15, "rgba(36,23,38,0.55)");
    p.stroke(pts, 9, ["#9cc84a", "#7fb03a", "#b5d65a"][k]);
  }
};
const stink = (out: Stage, t: number, x: number, y: number, z: number, s: number, seed = 0) => {
  const u = q((t * 0.8 + seed * 0.37) % 1, 16), rise = u * 0.5 * s, a = u < 0.15 ? u / 0.15 : u > 0.75 ? (1 - u) / 0.25 : 1;
  out.fx.push({ key: `stink${q((t * 2 + seed) % 1, 12)}`, cw: 220, ch: 320, draw: (p) => fxStink(p, q((t * 2 + seed) % 1, 12)), x, y: y + 0.5 * s + rise, z, w: 0.7 * s * a, h: 1.0 * s * a });
};
/** une mouche (120 x 90) : corps noir, deux ailes qui battent */
const fxFly = (p: Pen, flap: number) => {
  p.ell(60, 55, 20, 14, "#241726", 0);
  p.ell(48, 34 - flap * 8, 18, 12, "rgba(220,235,255,0.8)", 4, 0, 360, -20);
  p.ell(74, 34 - flap * 8, 18, 12, "rgba(220,235,255,0.8)", 4, 0, 360, 20);
  p.dot(76, 52, 5, "#c0353a");
};
const flies = (out: Stage, t: number, x: number, y: number, z: number, r: number, n = 5) => {
  for (let k = 0; k < n; k++) {
    const a = t * (2.2 + k * 0.4) + k * 1.7, fl = q(Math.abs(Math.sin(t * 40 + k)), 4);
    out.fx.push({ key: `fly${fl}`, cw: 120, ch: 90, draw: (p) => fxFly(p, fl), x: x + r * Math.cos(a), y: y + 0.25 * r * Math.sin(a * 1.7 + k), z: z + r * 0.6 * Math.sin(a), w: 0.07, h: 0.052 });
  }
};
/** bulle qui crève à la surface du fleuve (200 x 140), t 0..1 */
const fxBubble = (p: Pen, t: number) => {
  if (t < 0.75) { const r = 30 + 40 * t; p.ell(100, 120 - r * 0.7, r, r * 0.8, "#7a6a3e", 6); p.ell(100 - r * 0.35, 120 - r, r * 0.25, r * 0.16, "rgba(255,248,220,0.7)", 0); }
  else { const k = (t - 0.75) / 0.25; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.dot(100 + 60 * k * Math.cos(a), 90 + 30 * k * Math.sin(a), 8 * (1 - k), "#5e5030"); } }
};
const bubbles = (out: Stage, t: number, x0: number, z0: number, y: number, n: number, sp: number, sz = 0.5) => {
  for (let k = 0; k < n; k++) {
    const u = q((t * 0.7 + hh(k, 21)) % 1, 20);
    out.fx.push({ key: `bub${u}`, cw: 200, ch: 140, draw: (p) => fxBubble(p, u), x: x0 + (hh(k, 22) - 0.5) * sp, y: y + 0.08, z: z0 + (hh(k, 23) - 0.5) * sp * 0.6, w: sz, h: sz * 0.7 });
  }
};
/** le thermomètre (260 x 600), k 0..1 = niveau du mercure */
const fxThermo = (p: Pen, k: number) => {
  p.poly([[70, 20], [190, 20], [190, 580], [70, 580]], "#f1ead8", 8);
  p.ell(130, 500, 44, 44, "#d1262c", 8);
  p.poly([[112, 70], [148, 70], [148, 480], [112, 480]], "#ffffff", 6);
  const top = 470 - 390 * k;
  p.poly([[116, top], [144, top], [144, 490], [116, 490]], "#d1262c", 0);
  for (let i = 0; i < 9; i++) p.stroke([[150, 90 + i * 45], [172, 90 + i * 45]], 5);
  const g = p.g; g.fillStyle = "#241726"; g.font = '900 46px "Arial Black", Arial, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(`${Math.round(14 + 20 * k)}°`, 130, 600 - 560);
};
/** le calendrier (400 x 460), n = jour */
const fxCal = (p: Pen, n: number) => {
  p.poly([[20, 40], [380, 40], [380, 440], [20, 440]], "#fbf8f0", 10);
  p.poly([[20, 40], [380, 40], [380, 130], [20, 130]], "#c0353a", 10);
  for (const x of [110, 290]) p.ell(x, 40, 16, 22, "#3a3d47", 6);
  const g = p.g; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#ffffff"; g.font = '900 54px Georgia, serif'; g.fillText("1858", 200, 88);
  g.fillStyle = "#241726"; g.font = '900 210px Georgia, serif'; g.fillText(`${n}`, 200, 300);
};
/** le « mauvais air » : nuage vert avec un visage grognon (600 x 420), d = dégonflé 0..1 */
const fxMiasma = (p: Pen, d: number) => {
  const s = 1 - 0.75 * d;
  const lobes: [number, number, number][] = [[300, 230, 150], [170, 250, 110], [430, 250, 115], [240, 160, 100], [370, 160, 105], [300, 300, 120]];
  for (const [x, y, r] of lobes) p.ell(300 + (x - 300) * s, 230 + (y - 230) * s, r * s, r * 0.85 * s, "#8fb84a", 10);
  for (const [x, y, r] of lobes) p.ell(300 + (x - 300) * s - 12 * s, 230 + (y - 230) * s - 14 * s, r * 0.7 * s, r * 0.5 * s, "#a9cf5f", 0);
  const ey = 210, f = d > 0.3 ? 1 : 0;
  for (const sx of [-1, 1]) {
    p.ell(300 + sx * 55 * s, ey, 26 * s, (f ? 6 : 22) * s, "#ffffff", 6);
    if (!f) p.dot(300 + sx * 50 * s, ey + 4 * s, 9 * s);
    p.stroke([[300 + sx * 85 * s, ey - 40 * s], [300 + sx * 30 * s, ey - 26 * s]], 10 * s);
  }
  if (f) p.ell(300, 290, 22 * s, 18 * s, "#3a2a20", 6);
  else p.arc(300, 300, 60 * s, 26 * s, 200, 340, 12 * s);
};
export { fxThermo, fxCal };

/** tout ce qui a un visage (et les petits effets) dans le plan id au temps t */
export const stage = (id: number, t: number, cam: CamInfo, s = SHOTS[id - 1]): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = s.light;
  findSun(cam, SUN);
  const t0 = s.a / FPS, [cx, , cz] = CH, [mx, , mz] = MOD, [sx, , sz] = SEW;
  const riverStink = (n: number, x0: number, x1: number, z: number, sc = 1.4) => {
    for (let k = 0; k < n; k++) stink(out, t, x0 + ((x1 - x0) * k) / Math.max(1, n - 1), -1.4, z - hh(k, 31) * 4, sc, k);
  };
  const streetFolk = (expr: (i: number) => Expr, prop: (i: number) => Prop, n = 10, speed = 0.7) => {
    for (let i = 0; i < n; i++) {
      const north = i % 2 === 0, z = north ? STREET_Z + 4.6 + hh(i, 2) * 1.2 : STREET_Z - 4.6 - hh(i, 2) * 1.2;
      const dir = hh(i, 3) < 0.5 ? -1 : 1;
      walker(cam, out, 300 + i, FOLK[i % 6], `f${i % 6}${String(prop(i))}`, t, 0, -30 + i * 6.5 + hh(i) * 3 - dir * speed * t0, z, dir * speed, 0, expr(i), prop(i));
    }
  };
  switch (id) {
    case 1: {
      stander(cam, out, 10, MP[2], "mp2", t, 0, 4.0, t > at(5) ? "pained" : "nervous", { prop: "hanky", look: -1 });
      for (const [k, sx] of [[0, -2.2], [1, 2.4], [2, 1.2]] as const) stink(out, t, sx, 0.9, 1.0 + k * 0.4, 0.9, k);
      flies(out, t, 0.2, 2.0, 3.8, 0.35, 3);
      break;
    }
    case 2: case 14: {
      const dir = id === 2 ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        const xs = id === 2 ? 3 - i * 1.5 : -3 + i * 1.5;
        walker(cam, out, 20 + i, MP[i], `mp${i}`, t, t0, xs, 3.0 + (i % 3) * 1.1, dir * 2.8, 0, i % 2 ? "pained" : "shock", "hanky", 1, true);
      }
      riverStink(4, -6, 10, -3.5, 1.4);
      break;
    }
    case 4: riverStink(4, 144, 158, -2.5, 1.0); break;
    case 5: {
      streetFolk((i) => (i % 3 === 0 ? "pained" : "nervous"), (i) => (i % 2 ? "fan" : "hanky"), 10, 0.6);
      break;
    }
    case 6: {
      const k = clamp01((t - t0) / 1.2);
      out.fx.push({ key: `thermo${q(k, 30)}`, cw: 260, ch: 600, draw: (p) => fxThermo(p, q(k, 30)), x: THERMO[0], y: THERMO[1], z: THERMO[2] + 0.02, w: 0.2, h: 0.46 });
      break;
    }
    case 7: bubbles(out, t, 24, -12, -1.5, 9, 6, 0.6); riverStink(3, 21, 27, -10, 1.0); break;
    case 8: case 9: {
      const open = id === 9 ? clamp01((t - at(69)) / 0.5) : 0;
      flies(out, t, mx, 1.25, mz + 3.0, 0.45, 6);
      for (let k = 0; k < 3; k++) stink(out, t, mx - 0.25 + k * 0.25, 1.1 + 0.3 * open, mz + 3.0, 0.5 + 0.4 * open, k);
      if (id === 9) stander(cam, out, 30, MODERN_KID, "kid", t, mx - 1.2, mz + 2.2, open > 0.3 ? "pained" : "neutral", { prop: open > 0.3 ? "pinch" : null, look: 1 }, 0.72);
      break;
    }
    case 10: case 11: riverStink(id === 10 ? 10 : 6, id === 10 ? -40 : -30, id === 10 ? 160 : 30, -8, id === 10 ? 6 : 3.5); break;
    case 12: {
      stander(cam, out, 40, SERVANT, "maid", t, cx + 10.3, cz - 4.7, "pained", { look: -1 });
      stink(out, t, cx + 8.6, 1.4, cz - 6.6, 0.8, 1);
      break;
    }
    case 13: case 17: {
      for (let i = 0; i < 12; i++) {
        const side = i < 6 ? -1 : 1, j = i % 6, x = cx - 6 + j * 2.4, z = cz + side * (3.4 + (j % 2) * 1.1);
        const vote = id === 17 && t > at(141) + j * 0.06;
        const fo: Partial<FrontOpts> = id === 13 ? { mode: "sit", prop: "hanky" } : { mode: "sit", wave: vote ? q(0.6 + 0.4 * Math.sin(t * 6 + i), 10) : undefined };
        stander(cam, out, 50 + i, MP[i % 6], `mp${i % 6}`, t, x, z, id === 13 ? "pained" : vote ? "grin" : "neutral", fo, 1, 0.45 + (j % 2) * 0.35);
      }
      if (id === 13) for (let k = 0; k < 3; k++) stink(out, t, cx - 3 + k * 3, 2.4, cz - 6.5, 1.0, k);
      break;
    }
    case 15: {
      const cxr = 2 + 1.4 * (t - t0);
      for (let i = 0; i < 3; i++) walker(cam, out, 60 + i, MP[i + 1], `mp${i + 1}`, t, t0, -1.6 - i * 0.9, STREET_Z - 1.0 + i * 1.0, 1.4, 0, "pained", null);
      void cxr;
      break;
    }
    case 16: {
      stander(cam, out, 70, NEWSBOY, "newsboy", t, -6, 145.6, Math.sin(t * 5) > 0 ? "laugh" : "grin", { prop: "paper" }, 0.72);
      streetFolk(() => "nervous", (i) => (i % 3 ? null : "hanky"), 6, 0.6);
      break;
    }
    case 18: {
      const n = Math.max(1, Math.min(18, 1 + Math.floor(((t - at(148)) / Math.max(0.3, at(150) + 0.4 - at(148))) * 17)));
      out.fx.push({ key: `cal${n}`, cw: 400, ch: 460, draw: (p) => fxCal(p, n), x: cx + 10.9, y: 2.2, z: cz - 2.7, w: 0.9, h: 1.04 });
      break;
    }
    case 19: case 22: {
      stander(cam, out, 80, BAZALGETTE, "baz", t, BAZ[0], BAZ[2], id === 22 ? "grin" : "stern", { prop: "plan", look: id === 22 ? 0 : 1 });
      if (id === 19) for (let i = 0; i < 4; i++) stander(cam, out, 81 + i, NAVVY[i % 3], `nav${i % 3}`, t, 30 + i * 4.5, STREET_Z + (i % 2 ? 0.8 : -0.8), "neutral", { prop: "shovel" }, 1, -1.1);
      break;
    }
    case 20: {
      for (let i = 0; i < 3; i++) stander(cam, out, 90 + i, NAVVY[i], `nav${i}`, t, sx + 3 + i * 3.2, sz + (i % 2 ? 0.9 : -0.9), "neutral", { prop: "brick" });
      break;
    }
    case 23: case 24: {
      const d = id === 24 ? clamp01((t - at(197) - 0.1) / 0.5) : 0, x = id === 23 ? -14 + 2.2 * (t - t0) : -1;
      out.fx.push({ key: `miasma${q(d, 20)}`, cw: 600, ch: 420, draw: (p) => fxMiasma(p, q(d, 20)), soft: true, x, y: 2.6 + 0.15 * Math.sin(t * 3), z: STREET_Z, w: 3.6, h: 2.5 });
      if (id === 23) for (let i = 0; i < 6; i++) walker(cam, out, 320 + i, FOLK[i], `f${i}`, t, t0, -6 + i * 2.2, STREET_Z + (i % 2 ? 3.5 : -3.5), 2.6, 0, "shock", null, 1, true);
      break;
    }
    case 25: {
      for (let i = 0; i < 6; i++) walker(cam, out, 400 + i, i % 2 ? MP[i] : FOLK[i], i % 2 ? `mp${i}` : `f${i}`, t, t0, -2 - i * 2.4, 1.2 + (i % 3) * 1.1, i % 2 ? 0.6 : -0.6, 0, i % 3 ? "smile_closed" : "grin");
      break;
    }
    default: break;
  }
  return out;
};
export { FPS };
