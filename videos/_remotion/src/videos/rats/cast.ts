// La distribution des « Rats d'Hanoï » : cartes plates éclairées dans le monde 3D (même mécanique que le modèle
// du pont : pool de canevas, cartes tournées vers l'objectif, ombre de contact, clignements). stage(id, t, cam) dit qui
// est où, dans quelle pose et avec quelle expression ; les effets (rats, queues, pièce, tableaux) sont des cartes non éclairées.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, KID, SKINS, townsfolk, Outfit, Expr, FrontOpts, SideOpts, Prop } from "./toon";
import { FPS, V3, SHOTS, Light, at, smooth, clamp01, SEW, OFF, FARM, GARD, BATH, ARCH, MANHOLE, groundY } from "./story";
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

const VN = (v: number): Outfit => ({ jacket: ["#3a3d6b", "#6b4f3a", "#4f5a3a", "#5a3a3a"][v % 4], pants: ["#2a2f40", "#3b3f52", "#4a3a2a"][v % 3], boots: "#2a1c18", hat: "non", skin: [SKINS[2], SKINS[3], SKINS[1]][v % 3] });
const CLERK: Outfit = { jacket: "#efe9da", pants: "#e4ddcc", boots: "#2a1c18", hat: "hair", hair: "#3b2a20", tie: "#2a2f40", moustache: "#3b2a20", skin: SKINS[0] };
const INSPECTOR: Outfit = { jacket: "#f1ede2", pants: "#e4ddcc", boots: "#3a2a20", hat: "casque", skin: SKINS[0], moustache: "#7a5a3a", build: "stout" };
const LADY: Outfit = { jacket: "#c25a7a", pants: "#3b3f52", boots: "#2a1c18", hat: "bonnet", dress: "#f2d58a", skin: SKINS[0] };
const GENT: Outfit = { jacket: "#2a2f40", pants: "#4a4a52", boots: "#1e1a1c", hat: "tophat", skin: SKINS[1], moustache: "#4a3426" };
const BATHER: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#2a1c18", hat: "hair", hair: "#5a3b2a", dress: "#9bb8e0", skin: SKINS[0] };
const MODERN_KID: Outfit = { ...KID, jacket: "#3f6fb5", cap: "#f2c230" };
const HISTORIAN: Outfit = { jacket: "#7a6a5a", pants: "#3b3f52", boots: "#2a1c18", hat: "hair", hair: "#c9c2b8", skin: SKINS[0], tie: "#8c3b4a" };

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

// ---------------- effets dessinés ----------------
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
/** une pile de rats sur le comptoir (420 x 260) */
const fxPile = (p: Pen) => {
  for (let k = 0; k < 14; k++) { const x = 60 + (k * 53) % 300, y = 220 - Math.floor(k / 5) * 46 - (k % 2) * 10; p.ell(x, y, 50, 26, ["#7a6a66", "#6a5a56", "#857570"][k % 3], 6); p.dot(x + 40, y - 6, 4); p.stroke([[x - 48, y + 6], [x - 80, y + 14]], 5, "#d99a9a"); }
};
/** la carte de l'Asie (520 x 400) : la peste qui s'étend (k 0..1) */
const fxMap = (p: Pen, k: number) => {
  p.poly([[10, 10], [510, 10], [510, 390], [10, 390]], "#f1e6c8", 10);
  p.poly([[60, 90], [200, 50], [330, 70], [420, 140], [380, 220], [300, 260], [250, 330], [210, 260], [150, 240], [90, 180]], "#d9c38f", 6);
  p.poly([[300, 230], [330, 250], [320, 300], [295, 290]], "#cdb57d", 4);
  const g = p.g; g.fillStyle = "#3a2a20"; g.font = '900 34px Georgia, serif'; g.textAlign = "center"; g.fillText("ASIE", 250, 370);
  const pts = [[260, 160], [300, 140], [240, 200], [330, 180], [280, 220], [200, 150], [310, 250], [350, 120], [220, 110]];
  pts.slice(0, Math.round(2 + k * 7)).forEach(([x, y]) => { p.ell(x, y, 16, 16, "#d1262c", 4); p.ell(x, y, 30, 30, "rgba(209,38,44,0.25)", 0); });
  p.ell(312, 236, 9, 9, "#2a6fd1", 3); // Hanoï
};
/** le tableau des rats tués (520 x 300) */
const fxTally = (p: Pen, n: number) => {
  p.poly([[10, 10], [510, 10], [510, 290], [10, 290]], "#2f3a2f", 12);
  const g = p.g; g.textAlign = "center"; g.fillStyle = "#f1ede2";
  g.font = '700 40px Georgia, serif'; g.fillText("21 JUIN 1902", 260, 70);
  g.font = '900 120px Georgia, serif'; g.fillText(n.toLocaleString("fr-FR").replace(/ | /g, " "), 260, 200);
  g.font = '700 36px Georgia, serif'; g.fillText("RATS", 260, 262);
};
/** la pièce d'un centime (300 x 300), vue de face ou de tranche selon s (-1..1) */
const fxCoin = (p: Pen, s: number) => {
  const w = Math.max(0.08, Math.abs(s));
  p.ell(150, 150, 130 * w, 130, "#e8c45a", 10);
  p.ell(150, 150, 100 * w, 100, null, 5);
  if (w > 0.5) { const g = p.g; g.fillStyle = "#7a5a1a"; g.textAlign = "center"; g.font = '900 90px Georgia, serif'; g.save(); g.translate(150, 150); g.scale(w, 1); g.fillText("1", 0, 10); g.font = '900 30px Georgia, serif'; g.fillText("CENT", 0, 60); g.restore(); }
};
/** l'affiche « PRIME ANNULÉE » et son tampon (500 x 360), k = tampon 0..1 */
const fxAnnule = (p: Pen, k: number) => {
  p.poly([[10, 10], [490, 10], [490, 350], [10, 350]], "#f1e6c8", 8);
  const g = p.g; g.textAlign = "center"; g.fillStyle = "#3a2a20";
  g.font = '700 46px Georgia, serif'; g.fillText("PRIME", 250, 90); g.font = '700 36px Georgia, serif'; g.fillText("1 CENT PAR QUEUE", 250, 150);
  if (k > 0) {
    const s = 1 + 0.6 * (1 - k);
    g.save(); g.translate(250, 250); g.rotate(-0.18); g.scale(s, s); g.globalAlpha = Math.min(1, k * 1.5);
    g.strokeStyle = "#c0353a"; g.lineWidth = 12; g.strokeRect(-200, -55, 400, 110);
    g.fillStyle = "#c0353a"; g.font = '900 70px "Arial Black", Arial, sans-serif'; g.fillText("ANNULÉE", 0, 26); g.restore();
  }
};
/** le cobra qui sort du panier (300 x 420), r = sortie 0..1 */
const fxCobra = (p: Pen, r: number, t: number) => {
  const top = 330 - 230 * r, sw = 14 * Math.sin(t * 3);
  if (r > 0.05) {
    p.stroke([[150, 340], [150 + sw, (340 + top) / 2], [150, top + 40]], 34, "#5d7a3a");
    p.ell(150 + sw * 0.5, top + 20, 58, 46, "#6f8f45", 7);
    p.ell(150 + sw * 0.5, top + 26, 26, 30, "#e8d39a", 0);
    p.dot(132 + sw * 0.5, top + 6, 6); p.dot(168 + sw * 0.5, top + 6, 6);
    p.stroke([[150 + sw * 0.5, top + 44], [150 + sw * 0.5, top + 62], [140 + sw * 0.5, top + 70]], 3, "#c0353a");
  }
  p.poly([[60, 300], [240, 300], [220, 410], [80, 410]], "#c9a06a", 7);
  for (let y = 320; y < 410; y += 22) p.stroke([[70, y], [230, y]], 3, "rgba(90,60,30,0.5)");
};
/** le livre de l'historien (380 x 300) */
const fxBook = (p: Pen) => {
  p.poly([[20, 30], [360, 30], [360, 280], [20, 280]], "#8c3b4a", 9);
  p.poly([[20, 30], [50, 30], [50, 280], [20, 280]], "#6a2a36", 6);
  const g = p.g; g.textAlign = "center"; g.fillStyle = "#f2d58a"; g.font = '900 54px Georgia, serif'; g.fillText("L'EFFET", 205, 130); g.fillText("RAT", 205, 200);
};
/** graines semées en douce (240 x 240), t 0..1 */
const fxSeeds = (p: Pen, t: number) => { for (let k = 0; k < 9; k++) p.ell(60 + (k * 37) % 130, 30 + t * 160 + (k % 3) * 18, 7, 9, "#8a6a3a", 3); };
/** une touffe de mauvaise herbe (200 x 200) */
const fxWeed = (p: Pen) => { for (const a of [-0.6, -0.3, 0, 0.3, 0.6]) p.stroke([[100, 190], [100 + 80 * Math.sin(a), 190 - 150 * Math.cos(a)]], 14, "#4f9a37"); };
/** la chasse d'eau : remous bleus (300 x 200), t 0..1 */
const fxFlush = (p: Pen, t: number) => { for (let k = 0; k < 3; k++) p.arc(150, 100, 100 - k * 28, 40 - k * 10, t * 720 + k * 90, t * 720 + k * 90 + 220, 9, ["#6fb6e6", "#9fd0f0", "#d7eefa"][k]); };
export { fxRat, fxPile, fxMap, fxTally, fxCoin, fxAnnule, fxCobra, fxBook, fxSeeds, fxWeed, fxFlush };

/** tout ce qui a un visage (et les petits effets) dans le plan id au temps t */
export const stage = (id: number, t: number, cam: CamInfo, s = SHOTS[id - 1]): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = s.light;
  findSun(cam, SUN);
  const t0 = s.a / FPS, [ox, , oz] = OFF, [sx, , sz] = SEW, [fx, , fz] = FARM, [gx, , gz] = GARD, [bx, , bz] = BATH, [ax, , az] = ARCH;
  const caged = () => { // des rats derrière les barreaux des cages (3 cages en rangée)
    for (let c = 0; c < 3; c++) for (let k = 0; k < 4; k++) {
      const f = Math.floor(t * 6 + k + c) % 4;
      out.fx.push({ key: `rat${f}t${k % 2 ? "r" : "l"}`, cw: 300, ch: 160, draw: (p) => fxRat(p, f, true, k % 2 === 0), x: fx - 1.5 + c * 1.5 + (k % 2 - 0.5) * 0.45, y: 0.32 + Math.floor(k / 2) * 0.42, z: fz + 0.15, w: 0.3, h: 0.16 });
    }
  };
  switch (id) {
    case 1: case 12: {
      stander(cam, out, 10, CLERK, "clerk", t, ox, oz - 1.3, id === 12 && t < at(114) ? "pained" : "neutral", { prop: id === 12 && t < at(114) ? "pinch" : "coin", look: 1 });
      stander(cam, out, 11, VN(0), "vn0", t, ox + 0.9, oz + 1.2, "grin", { prop: "tail" });
      if (id === 12 && t < at(114) + 0.3) out.fx.push({ key: "pile", cw: 420, ch: 260, draw: fxPile, x: ox - 0.5, y: 1.33, z: oz + 0.1, w: 0.9, h: 0.56 });
      if (id === 1) out.fx.push({ key: "coin1", cw: 300, ch: 300, draw: (p) => fxCoin(p, 1), x: ox + 0.3, y: 1.16, z: oz + 0.1, w: 0.08, h: 0.08, flat: true });
      break;
    }
    case 2: case 16: {
      caged();
      stander(cam, out, 20, VN(1), "vn1", t, fx - 1.6, fz + 1.7, id === 2 ? "laugh" : "nervous", { look: 1 });
      if (id === 16) stander(cam, out, 21, INSPECTOR, "insp", t, fx + 1.5, fz + 1.9, t > at(166) ? "shock" : "stern", { look: -1 });
      break;
    }
    case 3: {
      for (let i = 0; i < 6; i++) walker(cam, out, 30 + i, i % 2 ? LADY : GENT, i % 2 ? "lady" : "gent", t, 0, -16 + i * 6, i % 2 ? 7.2 : -7.2, i % 2 ? 0.7 : -0.7, 0, "smile");
      break;
    }
    case 4: {
      const pull = t > at(33);
      stander(cam, out, 40, BATHER, "bather", t, bx + 0.8, bz - 0.9, pull ? "grin" : "smile", { wave: pull ? 0.9 : undefined });
      if (t > at(34)) { const u = q(((t - at(34)) * 0.8) % 1, 20); out.fx.push({ key: `flush${u}`, cw: 300, ch: 200, draw: (p) => fxFlush(p, u), x: bx, y: 0.47, z: bz - 1.2, w: 0.4, h: 0.27, flat: true }); }
      break;
    }
    case 5: rats(out, cam, t, 26, sx - 2, sx + 12, sz - 0.9, sz + 0.9, 0.1, 1.2, () => true, 0.34); break;
    case 6: { const k = clamp01((t - t0) / 1.6); out.fx.push({ key: `map${q(k, 12)}`, cw: 520, ch: 400, draw: (p) => fxMap(p, q(k, 12)), x: ox - 2, y: 2.25, z: oz - 4.42, w: 1.3, h: 1.0 }); break; }
    case 7: {
      for (let i = 0; i < 4; i++) stander(cam, out, 50 + i, VN(i), `vn${i}`, t, 0.4 + i * 0.95, 7.7 + (i % 2) * 0.4, i % 2 ? "neutral" : "stern", { prop: i % 2 ? "bucket" : "lantern" });
      stander(cam, out, 21, INSPECTOR, "insp", t, -0.9, 6.3, "stern", { look: 1, wave: 0.2 });
      break;
    }
    case 8: {
      walker(cam, out, 60, VN(2), "vn2", t, t0, sx + 2.4, sz - 1.15, 0.5, 0, "stern", "lantern");
      rats(out, cam, t, 10, sx + 3.5, sx + 12, sz - 0.9, sz + 0.9, 0.1, 2.2, () => true, 0.34, 3);
      break;
    }
    case 9: {
      const n = Math.round(20112 * smooth((t - t0) / 1.3));
      out.fx.push({ key: `tally${Math.round(n / 100)}`, cw: 520, ch: 300, draw: (p) => fxTally(p, Math.round(n / 100) * 100 + (n >= 20100 ? 12 : 0)), x: ox + 2.2, y: 2.3, z: oz - 4.42, w: 1.3, h: 0.75 });
      break;
    }
    case 10: { const n = Math.round(8 + 40 * clamp01((t - t0) / 2.6)); rats(out, cam, t, n, sx + 1, sx + 10, sz - 0.9, sz + 0.9, 0.1, 0.9, () => true, 0.32, 5); break; }
    case 11: { const sp = Math.cos((t - t0) * 6); out.fx.push({ key: `coin${q(sp, 10)}`, cw: 300, ch: 300, draw: (p) => fxCoin(p, q(sp, 10)), x: ox, y: 1.55, z: oz, w: 0.42, h: 0.42 }); stander(cam, out, 10, CLERK, "clerk", t, ox - 0.1, oz - 1.3, "grin", { look: 1 }); break; }
    case 13: {
      const sow = t > at(130);
      stander(cam, out, 70, MODERN_KID, "kid", t, gx, gz, sow ? "grin" : "smile", { prop: sow ? "coin" : "weed", look: sow ? -1 : 1 }, 0.72);
      for (let k = 0; k < 5; k++) out.fx.push({ key: "weed", cw: 200, ch: 200, draw: fxWeed, x: gx - 1.2 + k * 0.6, y: 0.12, z: gz - 0.6 - (k % 2) * 0.5, w: 0.24, h: 0.24 });
      if (sow) { const u = q(((t - at(130)) * 1.2) % 1, 16); out.fx.push({ key: `seeds${u}`, cw: 240, ch: 240, draw: (p) => fxSeeds(p, u), x: gx + 0.35, y: 0.35, z: gz + 0.15, w: 0.3, h: 0.3 }); }
      break;
    }
    case 14: {
      stander(cam, out, 80, LADY, "lady", t, -1.6, 8.0, t > at(146) ? "shock" : "neutral", { look: 1 });
      stander(cam, out, 81, GENT, "gent", t, -0.6, 8.4, t > at(148) ? "shock" : "neutral", { look: 1 });
      rats(out, cam, t, 6, -8, 10, 5.6, 7.0, 0.12, -1.8, () => false, 0.36, 7);
      break;
    }
    case 15: {
      stander(cam, out, 90, VN(3), "vn3", t, sx + 2.6, sz - 1.2, t > at(155) ? "grin" : "stern", { prop: t > at(155) ? "tail" : "scissors" });
      if (t > at(156)) rats(out, cam, t - at(156), 1, sx + 2.8, sx + 9, sz - 0.4, sz - 0.4, 0.1, 2.5, () => false, 0.36, 9);
      break;
    }
    case 17: {
      const k = clamp01((t - at(179)) / 0.25);
      out.fx.push({ key: `annule${q(k, 10)}`, cw: 500, ch: 360, draw: (p) => fxAnnule(p, q(k, 10)), x: ox, y: 2.3, z: oz - 4.42, w: 1.25, h: 0.9 });
      stander(cam, out, 10, CLERK, "clerk", t, ox + 0.9, oz - 1.6, "stern", { look: -1 });
      break;
    }
    case 18: rats(out, cam, t, 40, -14, 14, -4.5, 7.5, 0.06, 1.6, (k) => k % 3 !== 0, 0.36, 11); break;
    case 19: { const r = clamp01((t - at(191)) / 0.8); out.fx.push({ key: `cobra${q(r, 12)}${q(t % 1, 6)}`, cw: 300, ch: 420, draw: (p) => fxCobra(p, q(r, 12), q(t % 1, 6) * 6), x: ax - 0.25, y: 1.15, z: az - 0.05, w: 0.42, h: 0.59 }); stander(cam, out, 95, HISTORIAN, "hist", t, ax + 0.6, az - 0.9, t > at(197) ? "shock" : "neutral", { look: -1 }); break; }
    case 20: {
      stander(cam, out, 95, HISTORIAN, "hist", t, ax + 0.6, az - 0.9, t > at(209) ? "grin" : "smile", { look: -1 });
      out.fx.push({ key: "book", cw: 380, ch: 300, draw: fxBook, x: ax + 0.1, y: 1.05, z: az - 0.1, w: 0.42, h: 0.33 });
      if (t > at(209)) { const f = Math.floor(t * 12) % 4; out.fx.push({ key: `rat${f}tr`, cw: 300, ch: 160, draw: (p) => fxRat(p, f, true, false), x: ax - 0.25 + 0.25 * (t - at(209)), y: 1.25, z: az - 0.05, w: 0.3, h: 0.16 }); }
      break;
    }
    default: break;
  }
  return out;
};
export { FPS };
