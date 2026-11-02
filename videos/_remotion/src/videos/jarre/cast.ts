// La jarre de Zhang Heng : distribution. Cartes plates éclairées dans le monde 3D (pool de canevas, cartes tournées vers
// l'objectif, ombre de contact, clignements) ; stage(id, t, cam) dit qui est où, dans quelle pose, avec quelle expression ;
// les effets (nuage en colère, éclair, cheval au galop, flèche, ondes, « ? ») sont des cartes non éclairées.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { FPS, V3, SHOTS, Light, at, smooth, clamp01, groundY, T, JAR, THRONE, ZH, MAPT, TEA, LONGXI, MUSEUM, BUS } from "./story";
import { W } from "./words";
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

// ---------------- les personnages (visages BLANCS, comme dans les références) ----------------
const WHITE = "#f7f4ee";
const EMP: Outfit = { jacket: "#f6cf4a", dress: "#e9b52c", pants: "#3a2a20", boots: "#3a2a20", hat: "mian", skin: WHITE, sash: "#d8352f" };
const ZHANG: Outfit = { jacket: "#43b3a8", dress: "#2f8f8a", pants: "#2a2228", boots: "#2a2228", hat: "guan", skin: WHITE, beard: "#2a2228" };
const COURT = (v: number): Outfit => {
  const robes = ["#c8352e", "#3456a8", "#7a4fa8", "#2f8f5a", "#d8692e", "#3a7ac4"];
  const c = robes[v % robes.length];
  return { jacket: c, dress: c, pants: "#2a2228", boots: "#2a2228", hat: "guan", skin: WHITE, beard: v % 3 === 1 ? "#2a2228" : undefined, moustache: v % 3 === 2 ? "#2a2228" : undefined };
};
const PASS: Outfit = { jacket: "#3f7fc4", pants: "#2a2f40", boots: "#f4f1ea", hat: "hair", hair: "#3a2a20", skin: WHITE };
const RIDER2: Outfit = { jacket: "#e0a35a", pants: "#3b3f52", boots: "#3a2a20", hat: "cap", cap: "#d8352f", skin: WHITE };
const VILL = (v: number): Outfit => v % 2
  ? { jacket: ["#8a6a4a", "#5a7a4a", "#4a6a8a"][v % 3], pants: "#3b3f52", boots: "#3a2a20", hat: "non", skin: WHITE }
  : { jacket: ["#b5653f", "#6a5a8a", "#7a8a4a"][v % 3], dress: ["#b5653f", "#6a5a8a", "#7a8a4a"][v % 3], pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#2a2228", skin: WHITE };
const VISIT = (v: number): Outfit => [
  { jacket: "#e2453c", pants: "#2a2f40", boots: "#f4f1ea", hat: "hair", hair: "#5a3b2a", skin: WHITE },
  { jacket: "#2f9d7e", dress: "#f2b13c", pants: "#2a2f40", boots: "#3a2a20", hat: "hair", hair: "#2a2228", skin: WHITE },
  { jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#3f7fc4", build: "kid", skin: WHITE },
][v % 3] as Outfit;

// ---------------- effets dessinés ----------------
/** le nuage en colère (le Ciel qui gronde l'empereur), 800 x 480 ; m = 0..1 bouche qui gronde */
const fxCloud = (p: Pen, m: number) => {
  const puffs: [number, number, number][] = [[170, 300, 130], [320, 220, 160], [500, 210, 150], [640, 290, 120], [400, 330, 150], [260, 350, 110], [560, 350, 110]];
  for (const [x, y, r] of puffs) p.ell(x, y, r + 10, r * 0.78 + 10, INKC, 0);
  for (const [x, y, r] of puffs) p.ell(x, y, r, r * 0.78, "#5f6880", 0);
  for (const [x, y, r] of puffs) p.ell(x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.3, "rgba(255,255,255,0.12)", 0);
  // les sourcils froncés, les yeux, la bouche qui gronde
  p.stroke([[300, 215], [370, 250]], 16); p.stroke([[500, 215], [430, 250]], 16);
  p.ell(345, 275, 22, 20, "#fffdf4", 6); p.ell(455, 275, 22, 20, "#fffdf4", 6);
  p.dot(352, 280, 9); p.dot(448, 280, 9);
  p.ell(400, 352, 62, 18 + 30 * m, "#3a1620", 8);
  p.poly([[352, 340], [448, 340], [440, 352], [360, 352]], "#fffdf4", 0);
};
const INKC = "#1a1418";
/** l'éclair, 200 x 600 */
const fxBolt = (p: Pen) => p.poly([[120, 0], [40, 260], [100, 260], [30, 600], [170, 220], [105, 220], [175, 0]], "#ffe45a", 8);
/** une onde au sol (anneau), 512 x 512 */
const fxRing = (p: Pen) => { p.ell(256, 256, 236, 236, null, 14); p.ell(256, 256, 236, 236, null, 6); p.g.strokeStyle = "#f3c84a"; p.g.lineWidth = 8; p.g.beginPath(); p.g.ellipse(256, 256, 236, 236, 0, 0, 7); p.g.stroke(); };
/** la grande flèche rouge au sol, 300 x 900 (pointe en haut = vers l'avant) */
const fxArrow = (p: Pen) => {
  p.poly([[110, 900], [190, 900], [190, 300], [270, 300], [150, 40], [30, 300], [110, 300]], "#e2453c", 12);
  const g = p.g; g.save(); g.translate(150, 610); g.rotate(-Math.PI / 2); g.fillStyle = "#fff6e0"; g.font = '900 64px "Anton Konvwa", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SÉISME", 0, 4); g.restore();
};
/** le gros point d'interrogation, 400 x 560 */
const fxQuestion = (p: Pen) => {
  const g = p.g; g.font = '900 520px "Anton Konvwa", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 26; g.strokeStyle = INKC; g.lineJoin = "round"; g.strokeText("?", 200, 300); g.fillStyle = "#f3c84a"; g.fillText("?", 200, 300);
};
/** une étiquette « OUEST », 500 x 200 */
const fxLabel = (p: Pen, txt: string, bg: string) => {
  p.poly([[20, 30], [480, 20], [470, 180], [30, 175]], bg, 10);
  const g = p.g; g.font = '900 110px "Anton Konvwa", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff6e0"; g.fillText(txt, 250, 104);
};
/** nuage de poussière, 400 x 300 (doux) */
const fxDust = (p: Pen, k: number) => {
  for (let i = 0; i < 7; i++) { const x = 80 + i * 40 + 20 * Math.sin(i * 2 + k), y = 170 + 40 * Math.cos(i * 1.7 + k), r = 60 + 25 * Math.sin(i + k); p.ell(x, y, r, r * 0.75, "rgba(214,184,140,0.55)", 0); }
};
/** fissure au sol, 600 x 200 */
const fxCrack = (p: Pen) => { p.stroke([[10, 100], [120, 80], [180, 130], [280, 90], [360, 140], [450, 95], [590, 120]], 14); p.stroke([[180, 130], [210, 190]], 8); p.stroke([[360, 140], [380, 20]], 8); };
/** le cheval au galop et son cavalier (le messager), de profil, 900 x 640, tourné vers la droite ; f = image (0..5) */
const fxRider = (p: Pen, f: number, dusty: boolean) => {
  const two = Math.PI * 2, ph = (f / 6) * two, bob = 10 * Math.sin(ph * 2);
  const C = "#a0643a", D = "#6e3f22";
  // jambes : deux paires en opposition
  const legs: [number, number][] = [[300, 0], [340, 0.5], [560, 0.25], [600, 0.75]];
  for (const [x, o] of legs) {
    const a = Math.sin(ph + o * two), top: [number, number] = [x, 390 + bob], knee: [number, number] = [x + 40 * a, 470 + bob], hoof: [number, number] = [x + 70 * a + (a < 0 ? -20 : 10), 560 - 25 * Math.max(0, Math.cos(ph + o * two))];
    p.stroke([top, knee, hoof], 30, D); p.stroke([top, knee, hoof], 20, C); p.ell(hoof[0], hoof[1] + 6, 16, 9, INKC, 0);
  }
  // queue, corps, encolure, tête
  p.stroke([[230, 330 + bob], [170, 360 + bob], [140, 430 + bob]], 26, "#3a2418");
  p.ell(450, 360 + bob, 210, 92, C, 10);
  p.poly([[590, 320 + bob], [660, 180 + bob], [720, 170 + bob], [700, 300 + bob], [640, 380 + bob]], C, 10);
  p.poly([[660, 180 + bob], [800, 215 + bob], [810, 260 + bob], [770, 270 + bob], [700, 245 + bob]], C, 10);
  p.dot(735, 205 + bob, 8); p.ell(800, 240 + bob, 6, 5, INKC, 0);
  p.poly([[690, 160 + bob], [700, 128 + bob], [712, 168 + bob]], C, 6);
  for (let k = 0; k < 5; k++) p.stroke([[640 + k * 14, 190 + k * 22 + bob], [612 + k * 12, 214 + k * 24 + bob]], 12, "#3a2418");
  // selle et cavalier penché en avant
  p.poly([[390, 280 + bob], [500, 280 + bob], [490, 310 + bob], [400, 310 + bob]], "#d8352f", 6);
  p.ell(455, 220 + bob, 52, 72, "#c8352e", 9, 0, 360, 0.5);
  p.stroke([[480, 210 + bob], [560, 250 + bob], [640, 240 + bob]], 12, "#8a2a24");
  p.stroke([[430, 280 + bob], [420, 350 + bob], [450, 380 + bob]], 18, "#3b3f52");
  p.ell(500, 130 + bob, 50, 54, WHITE, 9);
  p.dot(518, 120 + bob, 7); p.dot(540, 122 + bob, 7);
  p.arc(526, 146 + bob, 14, 8, 20, 160, 6);
  p.ell(495, 88 + bob, 46, 18, "#1e1a24", 6, 180, 360);
  if (dusty) for (let k = 0; k < 4; k++) p.ell(120 - k * 30, 540 - k * 20, 50 + 10 * k, 34 + 6 * k, "rgba(214,184,140,0.6)", 0);
};
/** le petit cavalier sur la carte (pion), 300 x 240 */
const fxToken = (p: Pen, f: number) => {
  const b = 6 * Math.sin(f * 1.6);
  p.ell(150, 150 + b, 90, 45, "#a0643a", 8);
  p.poly([[220, 130 + b], [260, 70 + b], [290, 90 + b], [250, 150 + b]], "#a0643a", 8);
  for (const x of [90, 120, 180, 210]) p.stroke([[x, 180 + b], [x + 8 * Math.sin(f + x), 228]], 14);
  p.ell(150, 80 + b, 26, 34, "#c8352e", 7); p.ell(152, 36 + b, 22, 22, WHITE, 7);
};
/** une bulle de rire « HA HA », 360 x 220 */
const fxHaha = (p: Pen, k: number) => {
  p.ell(180, 105, 160, 90, "#fffdf4", 9);
  p.poly([[90, 175], [60, 215], [130, 182]], "#fffdf4", 0);
  const g = p.g; g.font = '900 96px "Anton Konvwa", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = INKC; g.fillText(k % 2 ? "HA HA !" : "HI HI !", 180, 108);
};

// ---------------- la scène au temps t ----------------
/** l'apparition d'un effet (0 → 1 en dt secondes, avec un petit rebond) */
const pop = (t: number, a: number, dt = 0.18) => { const x = clamp01((t - a) / dt); return x < 1 ? x * (1.15 - 0.15 * x) : 1; };
const J = JAR;
const dir = (deg: number, r: number): [number, number] => [J[0] + r * Math.sin((deg * Math.PI) / 180), J[2] + r * Math.cos((deg * Math.PI) / 180)];

export const stage = (id: number, t: number, cam: CamInfo, s = SHOTS[id - 1]): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = s.light;
  findSun(cam, SUN);
  const loc = s.loc;
  if (loc === "hall") {
    // l'empereur sur son trône (sauf quand il est à la carte, ou sorti dans la cour)
    const atMap = t > W[36] - 0.2 && t < W[58];
    const empE: Expr = t > W[49] && t < W[58] ? "nervous" : t > T.dropW && t < W[163] ? "shock" : t > W[163] && t < W[173] ? "stern" : t > W[209] ? "smile" : "neutral";
    if (atMap) stander(cam, out, 1, EMP, "emp", t, MAPT[0], MAPT[2] - 1.35, t > W[49] ? "nervous" : "stern", { look: 1, tilt: t > W[49] ? 4 : 0 });
    else stander(cam, out, 1, EMP, "emp", t, THRONE[0], THRONE[2], empE, { mode: "sit" }, 1, THRONE[1]);
    // Zhang Heng à côté de sa jarre
    const zE: Expr = t < W[25] ? "smile" : t < W[147] ? (t > W[58] - 0.3 && t < W[70] ? "grin" : "smile_closed") : t < W[166] ? "neutral" : t < W[173] ? "nervous" : "grin";
    const zProp: Prop = t < W[25] ? "plan" : null;
    stander(cam, out, 2, ZHANG, "zh", t, ZH[0], ZH[2], zE, { look: -1, prop: zProp, wave: t > W[58] && t < W[62] ? 0.8 : t > W[209] ? 0.6 : undefined });
    // la cour : deux rangées de fonctionnaires (présents à l'accroche et le jour de la bille de l'ouest)
    const court = t < W[25] || (t > W[147] - 0.3 && t < W[173]);
    if (court) for (let k = 0; k < 8; k++) {
      const side = k % 2 ? 1 : -1, z = -5.6 + Math.floor(k / 2) * 1.7, x = side * 3.3;
      const mock = t > T.laugh, puzzled = t > W[155] && !mock;
      const e: Expr = mock ? (k % 3 === 0 ? "grin" : "laugh") : puzzled ? (k % 2 ? "dazed" : "neutral") : k % 4 === 1 ? "smile_closed" : "neutral";
      stander(cam, out, 10 + k, COURT(k), `c${k}`, t, x, z, e, { look: -side, wave: mock && k % 2 === 0 ? 0.5 + 0.3 * Math.sin(t * 9 + k) : undefined, tilt: mock ? 3 * Math.sin(t * 8 + k) : 0 });
      if (mock && k < 4) out.fx.push({ key: `haha${k % 2}`, cw: 360, ch: 220, draw: (p) => fxHaha(p, k), x: x - side * 0.2, y: 2.45 + 0.05 * Math.sin(t * 10 + k), z, w: 0.62 * pop(t, T.laugh + 0.12 * k), h: 0.38 * pop(t, T.laugh + 0.12 * k) });
    }
    // les ondes autour de la jarre (« sent les tremblements de terre »)
    if (t > T.ring && t < T.ring + 2.6) for (let k = 0; k < 3; k++) {
      const u = (t - T.ring - 0.45 * k) / 1.6;
      if (u > 0 && u < 1) out.fx.push({ key: "ring", cw: 512, ch: 512, draw: fxRing, x: J[0], y: 0.03 + 0.002 * k, z: J[2], w: 3 + 9 * u, h: 3 + 9 * u, flat: true });
    }
    // le cavalier sur la carte : il avance… lentement
    const [r0, r1] = T.riderMap;
    if (t > r0 - 0.5 && t < W[56]) {
      const u = clamp01((t - r0) / (r1 - r0));
      const f = Math.floor(t * 6) % 6;
      out.fx.push({ key: `tok${f % 4}`, cw: 300, ch: 240, draw: (p) => fxToken(p, f), x: MAPT[0] - 0.95 + 0.62 * smooth(u), y: 0.92 + 0.11, z: MAPT[2] - 0.1 + 0.18 * u, w: 0.28, h: 0.22 });
    }
    // la flèche de la direction (vers le sud : le dragon dont la bille est tombée)
    if (t > T.arrow && t < W[114] + 0.3) {
      const k = pop(t, T.arrow, 0.35), L = 5.2 * k;
      out.fx.push({ key: "arrow", cw: 300, ch: 900, draw: fxArrow, x: J[0], y: 0.035, z: J[2] + 1.6 + L / 2, w: 1.1, h: L, flat: true, rot: Math.PI });
    }
    // « Comment ? » : le gros point d'interrogation au-dessus de la jarre
    if (t > T.question && t < W[119] + 0.1) out.fx.push({ key: "question", cw: 400, ch: 560, draw: fxQuestion, x: J[0], y: 2.75 + 0.04 * Math.sin(t * 6), z: J[2], w: 0.9 * pop(t, T.question), h: 1.26 * pop(t, T.question) });
    // la bille de l'ouest : l'étiquette
    if (t > T.ouest && t < W[156]) { const k = pop(t, T.ouest); const [x, z] = dir(270, 1.55); out.fx.push({ key: "ouest", cw: 500, ch: 200, draw: (p) => fxLabel(p, "OUEST", "#e2453c"), x, y: 1.75, z, w: 0.8 * k, h: 0.32 * k }); }
  } else if (loc === "court") {
    if (t < W[40]) {
      // le Ciel gronde : l'empereur sur le seuil, le nuage en colère au-dessus du toit, l'éclair
      stander(cam, out, 1, EMP, "emp", t, 0, 6.4, t > W[29] ? "shock" : "nervous", { look: 0, headTilt: -6 });
      for (let k = 0; k < 3; k++) stander(cam, out, 10 + k, COURT(k), `c${k}`, t, -1.6 + k * 1.6 + (k === 1 ? 0.3 : 0), 7.6 + (k % 2) * 0.6, "shock", { look: k - 1 });
      const m = t > T.bolt ? 0.6 + 0.4 * Math.abs(Math.sin(t * 12)) : 0.25;
      out.fx.push({ key: `cloud${Math.round(m * 4)}`, cw: 800, ch: 480, draw: (p) => fxCloud(p, Math.round(m * 4) / 4), x: 0, y: 12.5 + 0.2 * Math.sin(t * 2), z: 3, w: 13, h: 7.8 });
      if (t > T.bolt && t < T.bolt + 0.45 && Math.floor((t - T.bolt) * 20) % 3 !== 2) out.fx.push({ key: "bolt", cw: 200, ch: 600, draw: fxBolt, x: 2.2, y: 9.2, z: 3.5, w: 1.6, h: 4.8 });
    } else {
      // quelques jours plus tard : le messager au galop, de la porte de la ville jusqu'au seuil de la salle
      const [g0, g1] = T.gallop, u = clamp01((t - g0) / (g1 - g0)), z = 24 - 15.5 * (1 - (1 - u) * (1 - u));
      const f = u < 1 ? Math.floor(t * 12) % 6 : 1;
      const right = -cam.right.z > 0;
      out.fx.push({ key: `rider${f}${right ? "r" : "l"}`, cw: 900, ch: 640, draw: (p) => { if (!right) { p.g.translate(900, 0); p.g.scale(-1, 1); } fxRider(p, f, u < 1); }, x: 0.3, y: 1.05, z, w: 2.9, h: 2.06 });
      if (u < 1) out.fx.push({ key: `dust${Math.floor(t * 8) % 3}`, cw: 400, ch: 300, draw: (p) => fxDust(p, Math.floor(t * 8) % 3), x: 0.3, y: 0.55, z: z + 1.8, w: 2.4, h: 1.8, soft: true });
      stander(cam, out, 1, EMP, "emp", t, -0.7, 6.2, t > W[183] ? "shock" : "neutral", { look: 0 });
      stander(cam, out, 2, ZHANG, "zh", t, 0.9, 6.4, t > W[185] ? "grin" : "neutral", { look: 0 });
    }
  } else if (loc === "bus") {
    // le passager debout ; au coup de frein, il part vers l'avant (vers -z = à gauche de l'image)
    const lean = t > T.lean ? Math.sin(Math.PI * clamp01((t - T.lean) / 1.6)) : 0;
    const sgn = cam.right.z > 0 ? -1 : 1;
    stander(cam, out, 3, PASS, "pass", t, BUS[0] + 0.3, BUS[2] - 0.3, t > T.brake ? "shock" : "neutral", { tilt: sgn * 24 * lean, look: 0 });
    stander(cam, out, 4, RIDER2, "r2", t, BUS[0] + 0.9, BUS[2] - 2.6, t > T.brake ? "dazed" : "smile_closed", { mode: "sit", tilt: sgn * 10 * lean }, 1, 0.12);
  } else if (loc === "longxi") {
    const c = LONGXI;
    const sh = t < T.shake3[1] ? 1 : 0;
    for (let k = 0; k < 5; k++) {
      const x = c[0] - 2.4 + k * 1.2, z = c[2] + 1.2 + (k % 2) * 0.9;
      stander(cam, out, 20 + k, VILL(k), `v${k}`, t, x, z, k % 2 ? "shock" : "dazed", { look: k < 2 ? 1 : -1, tilt: sh * 6 * Math.sin(t * 30 + k) });
    }
    for (let k = 0; k < 4; k++) out.fx.push({ key: `dust${k % 3}`, cw: 400, ch: 300, draw: (p) => fxDust(p, k), x: c[0] - 4 + k * 2.6, y: 1.1 + 0.3 * Math.sin(t + k), z: c[2] - 2.6 - (k % 2), w: 3.4, h: 2.4, soft: true });
    out.fx.push({ key: "crack", cw: 600, ch: 200, draw: fxCrack, x: c[0] + 0.2, y: 0.03, z: c[2] + 3.4, w: 4, h: 1.3, flat: true });
  } else if (loc === "museum") {
    const c = MUSEUM;
    stander(cam, out, 30, VISIT(0), "m0", t, c[0] - 1.5, c[2] + 0.3, "neutral", { look: 1 });
    stander(cam, out, 31, VISIT(1), "m1", t, c[0] + 1.45, c[2] + 0.1, t > W[203] ? "dazed" : "smile_closed", { look: -1 });
    stander(cam, out, 32, VISIT(2), "m2", t, c[0] + 0.55, c[2] + 0.75, "shock", { look: -1 });
  }
  return out;
};
