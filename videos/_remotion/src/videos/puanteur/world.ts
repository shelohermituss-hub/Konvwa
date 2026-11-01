// Le monde de « La Grande Puanteur » : Londres en 1858 (la Tamise brune, le Parlement néogothique tout neuf, sa tour
// de l'horloge, le pont, les bouches d'égout et les usines, une rue victorienne, la salle des débats, le tunnel de
// brique) et une rue d'aujourd'hui (la poubelle au soleil, la plaque d'égout). Même éclairage deux tons, même ciel et
// mêmes nuages que le modèle du pont ; update(id, f, camera) pose tout pour le plan id à l'image f.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, V, lam, boxGeo, quad, tri, Kit, Ray, prop, house, setSight, setVegCenter } from "./build";
import { ctex, rep, cloudHD, cobbleHD, stoneHD, facadeHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage } from "./cast";
import { FPS, SHOTS, ShotDef, camAt, at, clamp01, RIVER, PARL, CLOCK, VICT, BRIDGE_X, OUTFALL_X, STREET_Z, TRENCH, MOD, BIN, MANHOLE, CH, SEW } from "./story";
import { godzyTexture } from "../_commun/godzy";

export const loadKit = () => Promise.resolve({} as Kit);

// ---------------- soleil ----------------
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
const glowTex = () => ctex("glowSoft", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.75)"); gr.addColorStop(0.7, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

// ---------------- textures peintes ----------------
/** la Tamise : brune et épaisse (1858) ou bleue (après les égouts) ; 1024 px = 16 m */
const riverTex = (clean: boolean) => ctex(clean ? "riverClean" : "riverDirty", 1024, 1024, (g, r) => {
  g.fillStyle = clean ? "#3f8fb8" : "#6b5a34"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26; i++) { const x = r() * 1024, y = r() * 1024, s = 80 + r() * 160; const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, clean ? "rgba(90,180,220,0.35)" : "rgba(60,48,24,0.4)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
  g.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const x = r() * 1024, y = r() * 1024, w = 20 + r() * 50;
    g.strokeStyle = clean ? "rgba(230,248,255,0.6)" : "rgba(168,149,100,0.65)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 8, x + w, y); g.stroke();
  }
  if (!clean) for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? "rgba(90,110,40,0.5)" : "rgba(40,32,18,0.5)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, 7); g.fill(); }
});
/** façade néogothique : pierre ocre pâle, travées de fenêtres en ogive, contreforts, cordons ; 1024 px = 16 m de large, 20 m de haut */
const gothicTex = (key: string, floors = 3) => ctex("goth" + key, 1024, 1280, (g, r) => {
  g.fillStyle = "#dcc796"; g.fillRect(0, 0, 1024, 1280);
  for (let y = 0; y < 1280; y += 22) { g.fillStyle = `rgba(150,120,70,${0.05 + r() * 0.05})`; g.fillRect(0, y, 1024, 2); }
  const bays = 4, bw = 1024 / bays, fh = 1180 / floors;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    g.fillStyle = "#cdb684"; g.fillRect(x0, 0, 26, 1280); // contrefort
    g.fillStyle = "rgba(255,245,215,0.5)"; g.fillRect(x0 + 4, 0, 6, 1280);
    for (let f = 0; f < floors; f++) {
      const y1 = 1280 - 60 - f * fh, wh = fh * 0.62, ww = bw * 0.42, cx = x0 + bw / 2, y0 = y1 - wh;
      g.fillStyle = "#efe2bf";
      g.beginPath(); g.moveTo(cx - ww / 2 - 10, y1 + 6); g.lineTo(cx - ww / 2 - 10, y0 + ww * 0.3); g.quadraticCurveTo(cx - ww / 2 - 10, y0 - ww * 0.35, cx, y0 - ww * 0.55); g.quadraticCurveTo(cx + ww / 2 + 10, y0 - ww * 0.35, cx + ww / 2 + 10, y0 + ww * 0.3); g.lineTo(cx + ww / 2 + 10, y1 + 6); g.closePath(); g.fill();
      const gl = g.createLinearGradient(0, y0, 0, y1); gl.addColorStop(0, "#7f93b8"); gl.addColorStop(1, "#46557e");
      g.fillStyle = gl;
      g.beginPath(); g.moveTo(cx - ww / 2, y1); g.lineTo(cx - ww / 2, y0 + ww * 0.3); g.quadraticCurveTo(cx - ww / 2, y0 - ww * 0.28, cx, y0 - ww * 0.45); g.quadraticCurveTo(cx + ww / 2, y0 - ww * 0.28, cx + ww / 2, y0 + ww * 0.3); g.lineTo(cx + ww / 2, y1); g.closePath(); g.fill();
      g.fillStyle = "#efe2bf"; g.fillRect(cx - 4, y0 - ww * 0.4, 8, wh + ww * 0.4); g.fillRect(cx - ww / 2, y0 + wh * 0.45, ww, 7);
      g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(cx - ww / 2 + 8, y0 + 10, 10, wh - 20);
    }
  }
  for (let f = 1; f < floors; f++) { g.fillStyle = "#c9b07a"; g.fillRect(0, 1280 - 40 - f * fh, 1024, 16); g.fillStyle = "rgba(255,245,215,0.5)"; g.fillRect(0, 1280 - 40 - f * fh, 1024, 4); }
  g.fillStyle = "#c9b07a"; g.fillRect(0, 1280 - 50, 1024, 50);
});
const clockTex = () => ctex("clockFace", 512, 512, (g) => {
  g.fillStyle = "#c9a24a"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#f7f1e1"; g.strokeStyle = "#2a2430"; g.lineWidth = 18; g.beginPath(); g.arc(256, 256, 210, 0, 7); g.fill(); g.stroke();
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.lineWidth = 12; g.beginPath(); g.moveTo(256 + 160 * Math.cos(a), 256 + 160 * Math.sin(a)); g.lineTo(256 + 195 * Math.cos(a), 256 + 195 * Math.sin(a)); g.stroke(); }
  g.lineWidth = 18; g.beginPath(); g.moveTo(256, 256); g.lineTo(256, 120); g.stroke();
  g.lineWidth = 14; g.beginPath(); g.moveTo(256, 256); g.lineTo(350, 300); g.stroke();
});
/** briques du tunnel (1024 px = 4 m), éclairées par les lanternes (auto-illuminées) */
const sewerBrick = () => ctex("sewerBrick", 1024, 1024, (g, r) => {
  g.fillStyle = "#6a3c2c"; g.fillRect(0, 0, 1024, 1024);
  const bw = 64, bh = 22;
  for (let y = 0, row = 0; y < 1024; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < 1024; x += bw) {
    const v = 0.85 + r() * 0.3; g.fillStyle = `rgb(${Math.round(178 * v)},${Math.round(92 * v)},${Math.round(62 * v)})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
  }
});
const panelTex = () => ctex("oakPanel", 512, 512, (g, r) => {
  g.fillStyle = "#7a4f33"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) {
    g.fillStyle = "#8a5a3c"; g.fillRect(x + 12, y + 12, 104, 104);
    g.fillStyle = "rgba(255,220,180,0.18)"; g.fillRect(x + 12, y + 12, 104, 6);
    g.fillStyle = "rgba(40,20,10,0.3)"; g.fillRect(x + 12, y + 110, 104, 6);
    for (let k = 0; k < 4; k++) { g.strokeStyle = "rgba(60,35,20,0.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 20 + r() * 80, y + 14); g.lineTo(x + 20 + r() * 80, y + 114); g.stroke(); }
  }
});
const curtainTex = (col: string) => ctex("curtain" + col, 256, 512, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 256, 512);
  for (let x = 0; x < 256; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, "rgba(0,0,0,0.28)"); gr.addColorStop(0.5, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0.28)"); g.fillStyle = gr; g.fillRect(x, 0, 32, 512); }
  g.fillStyle = "#e8c45a"; g.fillRect(0, 480, 256, 32);
});
const binTex = () => ctex("binGodzy", 512, 512, (g) => { // flanc de la poubelle avec l'autocollant GODZY
  g.fillStyle = "#2f5f3a"; g.fillRect(0, 0, 512, 512);
  for (let x = 30; x < 512; x += 60) { g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x, 0, 10, 512); }
  const t = godzyTexture({ w: 512, h: 160 }).image as HTMLCanvasElement;
  g.save(); g.translate(256, 190); g.rotate(-0.06); g.drawImage(t, -170, -53, 340, 106); g.restore();
});
const manholeTex = () => ctex("manhole", 512, 512, (g) => {
  g.fillStyle = "#3a3d47"; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
  g.strokeStyle = "#5a5e6a"; g.lineWidth = 14; for (let r = 60; r < 240; r += 45) { g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke(); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + 240 * Math.cos(a), 256 + 240 * Math.sin(a)); g.stroke(); }
  g.fillStyle = "#2a2d36"; g.font = '900 54px Georgia, serif'; g.textAlign = "center"; g.fillText("LONDON", 256, 275);
});
const busTex = () => ctex("busRed", 1024, 512, (g) => {
  g.fillStyle = "#d1262c"; g.fillRect(0, 0, 1024, 512);
  for (const [y, h] of [[40, 120], [270, 110]] as const) {
    g.fillStyle = "#3b4466"; g.fillRect(30, y, 964, h);
    g.fillStyle = "#d1262c"; for (let x = 150; x < 994; x += 120) g.fillRect(x - 4, y, 8, h);
  }
  g.fillStyle = "#2a2430"; g.fillRect(0, 490, 1024, 22);
});
const asphaltTex = () => ctex("asphaltL", 1024, 1024, (g, r) => {
  g.fillStyle = "#62646e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? "rgba(38,38,46,0.3)" : "rgba(160,160,170,0.25)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 3, 2 + r() * 3); }
});
const paveTex = () => ctex("paveL", 1024, 1024, (g, r) => {
  g.fillStyle = "#a9a7a6"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 128) for (let x = 0; x < 1024; x += 128) { const v = 168 + Math.floor(r() * 22); g.fillStyle = `rgb(${v},${v - 3},${v - 6})`; g.fillRect(x + 3, y + 3, 122, 122); }
});
/** flot qui coule (bouches d'égout, eau des égouts) : bandes qui défilent avec map.offset */
const flowTex = (col: string, hi: string) => ctex("flow" + col, 128, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = hi; g.fillRect(r() * 128, r() * 512, 6 + r() * 10, 30 + r() * 60); }
});
/** traits lumineux des égouts vus du ciel : tirets qui défilent vers l'est */
const dashTex = () => ctex("dashGlow", 256, 32, (g) => {
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "rgba(255,255,255,0.15)"); gr.addColorStop(0.7, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0.15)");
  g.fillStyle = gr; g.fillRect(0, 6, 256, 20);
});

// ---------------- géométrie ----------------
const flatUp = (x0: number, x1: number, z0: number, z1: number, y: number, us: number, vs: number) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), us, vs);
const M4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(sx, sy, sz));
/** boîte texturée : la texture couvre chaque face (u le long de la face, v vers le haut), répétée tous les `tile` m */
const walls = (b: Batch, mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tile: number, top?: THREE.Material) => {
  const tw = (a: number) => a / tile, th = (y1 - y0) / (tile * 1.25);
  b.add(quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), tw(x1 - x0), th), mat);
  b.add(quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), tw(x1 - x0), th), mat);
  b.add(quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), tw(z1 - z0), th), mat);
  b.add(quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), tw(z1 - z0), th), mat);
  if (top) b.add(flatUp(x0, x1, z0, z1, y1, 1, 1), top);
};
/** toit à deux pans le long de x */
const ridge = (b: Batch, mat: THREE.Material, x0: number, x1: number, y: number, z0: number, z1: number, h: number) => {
  const zm = (z0 + z1) / 2;
  b.add(quad(V(x0, y, z1), V(x1, y, z1), V(x1, y + h, zm), V(x0, y + h, zm), (x1 - x0) / 4, 2), mat);
  b.add(quad(V(x1, y, z0), V(x0, y, z0), V(x0, y + h, zm), V(x1, y + h, zm), (x1 - x0) / 4, 2), mat);
  b.add(tri(V(x0, y, z0), V(x0, y, z1), V(x0, y + h, zm)), mat);
  b.add(tri(V(x1, y, z1), V(x1, y, z0), V(x1, y + h, zm)), mat);
};
/** pinacles le long d'une arête de toit */
const pinnacles = (b: Batch, mat: THREE.Material, x0: number, x1: number, y: number, z: number, step: number) => {
  for (let x = x0; x <= x1 + 0.01; x += step) b.add(new THREE.ConeGeometry(0.45, 2.6, 4).translate(0, 1.3, 0), mat, M4(x, y, z, Math.PI / 4));
};
/** une tour gothique carrée : fût, corniche, (cadrans), toit pyramidal */
const gothTower = (b: Batch, x: number, z: number, w: number, h: number, roofH: number, face: THREE.Material, stone: THREE.Material, roof: THREE.Material, clock?: THREE.Material) => {
  walls(b, face, x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, w);
  b.add(boxGeo(V(x - w / 2 - 0.4, h, z - w / 2 - 0.4), V(x + w / 2 + 0.4, h + 1.2, z + w / 2 + 0.4)), stone);
  if (clock) {
    walls(b, stone, x - w / 2 - 0.2, x + w / 2 + 0.2, h + 1.2, h + 1.2 + w * 0.95, z - w / 2 - 0.2, z + w / 2 + 0.2, w * 2);
    const c = h + 1.2 + w * 0.47, r = w * 0.36;
    for (const [nx, nz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const)
      b.add(new THREE.CircleGeometry(r, 32), clock, M4(x + nx * (w / 2 + 0.25), c, z + nz * (w / 2 + 0.25), ry));
    const top = h + 1.2 + w * 0.95;
    b.add(boxGeo(V(x - w / 2 - 0.4, top, z - w / 2 - 0.4), V(x + w / 2 + 0.4, top + 0.8, z + w / 2 + 0.4)), stone);
    b.add(new THREE.ConeGeometry(w * 0.72, roofH, 4).translate(0, roofH / 2, 0), roof, M4(x, top + 0.8, z, Math.PI / 4));
  } else {
    b.add(new THREE.ConeGeometry(w * 0.72, roofH, 4).translate(0, roofH / 2, 0), roof, M4(x, h + 1.2, z, Math.PI / 4));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(new THREE.ConeGeometry(0.9, 5, 8).translate(0, 2.5, 0), roof, M4(x + sx * w / 2, h + 1.2, z + sz * w / 2));
  }
};

const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 3) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len: Math.min(len, 40), core: sx === 0 && sy === 0 });
  }
  return out;
};
/** plans vus du ciel ou de loin : brouillard repoussé */
const FAR_SHOT = new Set([3, 10, 11, 21]);

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "gris" | "canicule", THREE.Texture[]>;
  private clouds: { m: THREE.Mesh; a: number; d: number; y: number }[] = [];
  private river: THREE.Mesh; private riverMat: THREE.MeshLambertMaterial; private riverMaps: { dirty: THREE.Texture; clean: THREE.Texture };
  private flows: THREE.Texture[] = [];
  private lid = new THREE.Group();
  private cart = new THREE.Group();
  private trench = new THREE.Group();
  private bus = new THREE.Group();
  private sewerGlow: THREE.Mesh; private dash: THREE.Texture;
  private lanterns: THREE.Sprite[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- ciel + lumière ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      gris: [0, 1, 2, 3].map((k) => cloudHD(k + 4, LOOK.gris.cloud)), canicule: [0, 1, 2, 3].map((k) => cloudHD(k + 8, LOOK.canicule.cloud)) };
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK);
      this.clouds.push({ m, a: (i / 12) * Math.PI * 2 + 0.3, d: 560 + (i % 3) * 70, y: 110 + (i % 4) * 36 }); R.add(m);
    }

    setSight(sightLines());
    setVegCenter(0, 60);
    const b = new Batch(), bs = new Batch(); // bs : ne projette pas d'ombre
    const stone = lam("parlStone", () => ({ color: "#d8c393" })), slate = lam("parlSlate", () => ({ color: "#5a6478" }));
    const gothic = lam("gothic", () => ({ map: gothicTex("a", 3) })), gothicT = lam("gothicT", () => ({ map: gothicTex("t", 6) }));
    const cobble = lam("cobbleHD", () => ({ map: cobbleHD() })), wallStone = lam("embank", () => ({ map: stoneHD("wallHD", ["#a99b86", "#9f917c", "#b1a38e", "#968873"], "#7b6f60") }));
    const mud = lam("mud", () => ({ color: "#6e5a3c" })), iron = lam("ironP", () => ({ color: "#2b2f3a" })), wood = lam("woodP", () => ({ color: "#8a5a3c" }));

    // ---- la Tamise et ses rives ----
    this.riverMaps = { dirty: rep(riverTex(false), 100, 7), clean: rep(riverTex(true), 100, 7) };
    this.riverMat = twoTone(new THREE.MeshLambertMaterial({ map: this.riverMaps.dirty }));
    this.river = new THREE.Mesh(flatUp(-700, 900, RIVER.zS, RIVER.zN, RIVER.y, 1, 1), this.riverMat);
    this.river.receiveShadow = true; R.add(this.river);
    b.add(flatUp(-900, 900, -900, 900, -3, 200, 200), lam("groundFar", () => ({ color: "#9a9282" })));
    b.add(flatUp(-900, 900, 0, 900, -0.02, 200, 100), lam("groundN", () => ({ color: "#a59a84" })));
    b.add(boxGeo(V(-700, RIVER.y - 1, -0.6), V(900, 0.12, 0)), wallStone);                  // quai nord
    b.add(boxGeo(V(-700, RIVER.y - 1, RIVER.zS), V(900, 0.6, RIVER.zS + 0.6)), wallStone); // rive sud
    b.add(flatUp(-900, 900, -900, RIVER.zS, 0.6, 400, 10), lam("southBank", () => ({ color: "#a59a84" })));
    b.add(flatUp(-700, 900, -2.5, -0.6, RIVER.y + 0.02, 1, 1), mud);
    // terrasse, parapet
    b.add(flatUp(PARL.x0 - 30, PARL.x1 + 30, 0, PARL.z, 0.12, 40, 3), lam("terrace", () => ({ map: paveTex() })));
    b.add(boxGeo(V(-700, 0.12, -0.6), V(900, 1.0, -0.2)), stone);
    // ---- le Parlement ----
    const { x0, x1, z, depth, h } = PARL;
    walls(b, gothic, x0, x1, 0, h, z, z + depth, 16);
    ridge(b, slate, x0, x1, h, z, z + depth, 7);
    b.add(boxGeo(V(x0 - 0.3, h - 0.3, z - 0.4), V(x1 + 0.3, h + 0.6, z + depth + 0.4)), stone);
    pinnacles(b, stone, x0, x1, h + 0.6, z - 0.1, 4);
    for (const px of [-40, -14, 14, 40]) { // avant-corps et tourelles
      walls(b, gothic, px - 5, px + 5, 0, h + 4, z - 3, z + 1, 10);
      b.add(new THREE.ConeGeometry(3.6, 6, 4).translate(0, 3, 0), slate, M4(px, h + 4, z - 1, Math.PI / 4));
    }
    b.add(boxGeo(V(-2.2, 0.12, z - 0.3), V(2.2, 4.4, z + 0.1)), lam("doorP", () => ({ color: "#4a2e1e" }))); // la porte sur la terrasse
    gothTower(b, CLOCK[0], CLOCK[2], 9, 58, 18, gothicT, stone, lam("spire", () => ({ color: "#3b4a5e" })), lam("clockFace", () => ({ map: clockTex() })));
    gothTower(b, VICT[0], VICT[2], 18, 62, 10, gothicT, stone, slate);
    // ---- le pont de Westminster : tablier, piles, arches peintes ----
    b.add(boxGeo(V(BRIDGE_X - 7, 3.6, RIVER.zS - 6), V(BRIDGE_X + 7, 4.6, 6)), stone);
    b.add(boxGeo(V(BRIDGE_X - 7, 4.6, RIVER.zS - 6), V(BRIDGE_X - 6.4, 5.6, 6)), stone);
    b.add(boxGeo(V(BRIDGE_X + 6.4, 4.6, RIVER.zS - 6), V(BRIDGE_X + 7, 5.6, 6)), stone);
    for (let zz = -8; zz > RIVER.zS; zz -= 16) b.add(boxGeo(V(BRIDGE_X - 7.6, RIVER.y - 1, zz - 1.8), V(BRIDGE_X + 7.6, 3.6, zz + 1.8)), wallStone);
    // ---- la rive sud : entrepôts ----
    for (let x = -240; x < 300; x += 14) house(bs, x, RIVER.zS - 12, 0, 12, 10, 8 + ((x / 14) % 3) * 2, Math.abs(Math.round(x / 14)) % 8, 0.6);
    // ---- les bouches d'égout et les usines ----
    this.flows = [];
    for (const ox of OUTFALL_X) {
      b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 16).rotateX(Math.PI / 2), iron, M4(ox, -0.6, -0.9));
      const ft = rep(flowTex("#5e4a28", "rgba(150,125,80,0.6)"), 1, 2); this.flows.push(ft);
      const fall = new THREE.Mesh(quad(V(ox - 0.6, -0.6, -1.6), V(ox + 0.6, -0.6, -1.6), V(ox + 0.8, RIVER.y + 0.02, -3.4), V(ox - 0.8, RIVER.y + 0.02, -3.4)),
        new THREE.MeshLambertMaterial({ map: ft, side: THREE.DoubleSide }));
      R.add(fall);
    }
    for (const [fx, fz, w, hh] of [[132, 22, 18, 12], [160, 26, 22, 14], [190, 20, 16, 11]] as const) {
      walls(b, lam("factory", () => ({ map: facadeHD("factoryP", 20, 13, { wall: "#b5543c", shutter: "#3b3f52", brick: true }) })), fx - w / 2, fx + w / 2, 0, hh, fz - 8, fz + 8, 20);
      ridge(b, slate, fx - w / 2, fx + w / 2, hh, fz - 8, fz + 8, 4);
      b.add(new THREE.CylinderGeometry(0.9, 1.3, 26, 14).translate(0, 13, 0), lam("chimneyP", () => ({ color: "#9c4f3a" })), M4(fx + w / 3, 0, fz));
    }
    // ---- les bateaux ----
    for (const [bx, bz, ry] of [[20, -40, 0.2], [-30, -70, -0.4], [90, -55, 0.6], [60, -25, -0.2], [-150, -50, 0.1]] as const) {
      const hull = new THREE.BoxGeometry(5, 1, 1.8); hull.translate(0, 0.3, 0);
      b.add(hull, wood, M4(bx, RIVER.y, bz, ry));
      b.add(new THREE.CylinderGeometry(0.07, 0.07, 5, 6).translate(0, 3, 0), wood, M4(bx, RIVER.y, bz, ry));
      b.add(new THREE.PlaneGeometry(2.4, 3.2).translate(0.9, 3.2, 0), lam("sailP", () => ({ color: "#e9dcbf", side: THREE.DoubleSide })), M4(bx, RIVER.y, bz, ry));
    }

    // ---- la rue victorienne ----
    b.add(flatUp(-200, 200, STREET_Z - 6.5, STREET_Z + 6.5, 0.0, 100, 3), cobble);
    b.add(flatUp(-200, 200, STREET_Z - 8.5, STREET_Z - 6.5, 0.12, 100, 1), lam("paveV", () => ({ map: paveTex() })));
    b.add(flatUp(-200, 200, STREET_Z + 6.5, STREET_Z + 8.5, 0.12, 100, 1), lam("paveV", () => ({ map: paveTex() })));
    b.add(flatUp(-200, 200, 40, 140, 0.0, 50, 25), cobble); // entre le Parlement et la rue (vu du ciel)
    for (const [sgn, zc, yaw] of [[-1, STREET_Z - 12.5, 0], [1, STREET_Z + 12.5, Math.PI]] as const) {
      let x = -90, k = 0;
      while (x < 100) {
        const w = [7, 9, 8][k % 3], hh = [9.8, 8.4, 11.2, 7][k % 4];
        house(sgn < 0 ? bs : b, x + w / 2, zc, yaw, w, 8, hh, (k * 3 + (sgn > 0 ? 1 : 0)) % 8);
        x += w + 0.2; k++;
      }
    }
    // la rue derrière (blocs de maisons vus du ciel)
    for (let zz = 60; zz < 240; zz += 26) if (Math.abs(zz - STREET_Z) > 20) for (let xx = -180; xx < 180; xx += 13) house(bs, xx, zz, (zz / 26) % 2 ? 0 : Math.PI, 9.6, 8, 8.4 + (Math.abs(xx) % 3), Math.abs(xx + zz) % 8);
    for (let lx = -60; lx <= 60; lx += 12) for (const lz of [STREET_Z - 6.8, STREET_Z + 6.8]) { // becs de gaz
      b.add(new THREE.CylinderGeometry(0.06, 0.09, 3.4, 8).translate(0, 1.7, 0), iron, M4(lx, 0.12, lz));
      b.add(new THREE.BoxGeometry(0.4, 0.5, 0.4).translate(0, 3.6, 0), lam("gasLamp", () => ({ color: "#f2e2a8" })), M4(lx, 0.12, lz));
    }
    // enseigne GODZY sur une boutique de la rue (côté nord, façade vers la rue)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshBasicMaterial({ map: godzyTexture({ w: 1024, h: 288 }) }));
    sign.position.set(-14, 3.1, STREET_Z + 8.4); sign.rotation.y = Math.PI; sign.layers.set(NOINK); R.add(sign);
    // la tranchée des égouts : terre, parois, tunnel en construction (visible à partir du plan 19)
    const bt = new Batch();
    const earth = lam("earth", () => ({ color: "#7a5a3c" }));
    bt.add(boxGeo(V(TRENCH.x0, -2.4, TRENCH.z - TRENCH.w / 2), V(TRENCH.x1, -2.3, TRENCH.z + TRENCH.w / 2)), earth);
    bt.add(flatUp(TRENCH.x0, TRENCH.x1, TRENCH.z - TRENCH.w / 2, TRENCH.z + TRENCH.w / 2, 0.005, 8, 1), lam("trenchDark", () => ({ color: "#4a3626" })));
    const arch = new THREE.CylinderGeometry(1.5, 1.5, TRENCH.x1 - TRENCH.x0 - 6, 18, 1, true, 0, Math.PI); arch.rotateZ(Math.PI / 2);
    bt.add(arch, lam("sewerB", () => ({ map: rep(sewerBrick(), 6, 1) })), M4((TRENCH.x0 + TRENCH.x1) / 2 + 3, -1.6, TRENCH.z));
    for (const sz of [-1, 1]) for (let xx = TRENCH.x0; xx < TRENCH.x1; xx += 6.4) bt.add(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), earth, new THREE.Matrix4().compose(V(xx + 1.6, 0, TRENCH.z + sz * (TRENCH.w / 2 + 1.1)), new THREE.Quaternion(), V(0.8, 0.3, 0.5)));
    for (let xx = TRENCH.x0; xx < TRENCH.x1; xx += 4) bt.add(boxGeo(V(xx, 0.02, TRENCH.z - 2.4), V(xx + 0.25, 0.08, TRENCH.z + 2.4)), wood);
    bt.build(this.trench); R.add(this.trench);
    // la charrette du déménagement (plan 15)
    const cartBed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 1.5), lam("woodP", () => ({ color: "#8a5a3c" }))); cartBed.position.y = 0.8;
    this.cart.add(cartBed);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 20), lam("woodP", () => ({ color: "#8a5a3c" }))); w.position.set(0, 0.6, s * 0.85); this.cart.add(w); }
    for (let k = 0; k < 3; k++) { const bench = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 0.6), lam("benchGreen", () => ({ color: "#2f6a43" }))); bench.position.set(0, 1.1 + k * 0.38, (k % 2 - 0.5) * 0.4); bench.rotation.y = k * 0.08; this.cart.add(bench); }
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.6), lam("crateP", () => ({ color: "#c9a06a" }))); crate.position.set(0.8, 2.3, 0); this.cart.add(crate);
    this.cart.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); this.cart.visible = false; R.add(this.cart);

    // ---- la salle des débats (sans plafond : le soleil entre par le haut) ----
    const [cx, , cz] = CH, panel = lam("oak", () => ({ map: panelTex() }));
    b.add(flatUp(cx - 12, cx + 12, cz - 7.5, cz + 7.5, 0.0, 12, 8), lam("floorCh", () => ({ map: rep(panelTex(), 1, 1), color: "#a07a5a" })));
    b.add(flatUp(cx - 3.5, cx + 3.5, cz - 2.2, cz + 2.2, 0.01, 1, 1), lam("carpetCh", () => ({ color: "#3d7a4f" })));
    for (const [a0, a1, b0, b1] of [[cx - 12, cx + 12, cz - 7.8, cz - 7.5], [cx - 12, cx + 12, cz + 7.5, cz + 7.8]] as const) walls(b, panel, a0, a1, 0, 9, b0, b1, 4);
    walls(b, panel, cx + 11, cx + 11.3, 0, 9, cz - 7.5, cz + 7.5, 4);
    walls(b, panel, cx - 12.3, cx - 12, 0, 9, cz - 7.5, cz + 7.5, 4);
    // fenêtres en ogive et rideaux sur le mur du fleuve (z -), un rideau trempé descend dans la bassine
    for (const wx of [-8, -3, 2, 7]) {
      b.add(quad(V(cx + wx - 1.1, 3, cz - 7.45), V(cx + wx + 1.1, 3, cz - 7.45), V(cx + wx + 1.1, 7.8, cz - 7.45), V(cx + wx - 1.1, 7.8, cz - 7.45)), lam("winCh", () => ({ color: "#8fa6c8" })));
      if (wx !== 7) for (const s of [-1, 1]) b.add(quad(V(cx + wx + s * 0.8 - 0.55, 2.6, cz - 7.3), V(cx + wx + s * 0.8 + 0.55, 2.6, cz - 7.3), V(cx + wx + s * 0.8 + 0.55, 8.2, cz - 7.3), V(cx + wx + s * 0.8 - 0.55, 8.2, cz - 7.3)), lam("curtainR", () => ({ map: curtainTex("#9c2f3a"), side: THREE.DoubleSide })));
    }
    // la bassine de chlorure de chaux, le rideau qui trempe dedans
    b.add(new THREE.CylinderGeometry(0.75, 0.6, 0.7, 20, 1, true).translate(0, 0.35, 0), wood, M4(cx + 9.4, 0, cz - 5.6));
    b.add(new THREE.CircleGeometry(0.72, 20).rotateX(-Math.PI / 2), lam("chlorine", () => ({ color: "#e6f0d6" })), M4(cx + 9.4, 0.6, cz - 5.6));
    b.add(quad(V(cx + 6.6, 8.2, cz - 7.25), V(cx + 7.6, 8.2, cz - 7.25), V(cx + 9.7, 0.62, cz - 5.4), V(cx + 8.9, 0.62, cz - 5.8)), lam("curtainR", () => ({ map: curtainTex("#9c2f3a"), side: THREE.DoubleSide })));
    // les bancs verts en gradins, la table au milieu
    const green = lam("benchGreen", () => ({ color: "#2f6a43" }));
    for (const s of [-1, 1]) for (const [r0, hgt] of [[3.0, 0.45], [4.1, 0.8]] as const) {
      b.add(boxGeo(V(cx - 8, 0, cz + s * r0 - 0.45), V(cx + 8, hgt, cz + s * r0 + 0.45)), green);
      b.add(boxGeo(V(cx - 8, hgt, cz + s * (r0 + 0.4) - 0.08), V(cx + 8, hgt + 0.55, cz + s * (r0 + 0.4) + 0.08)), green);
    }
    b.add(boxGeo(V(cx - 2.5, 0, cz - 0.8), V(cx + 2.5, 0.9, cz + 0.8)), wood);
    b.add(boxGeo(V(cx + 8.8, 0, cz - 1.2), V(cx + 10.6, 2.6, cz + 1.2)), wood); // le fauteuil du président
    b.add(boxGeo(V(cx + 10.6, 1.2, cz - 0.7), V(cx + 10.95, 3.3, cz + 0.7)), green);

    // ---- le tunnel d'égout (ovoïde, en brique, éclairé par les lanternes) ----
    const [sx, , sz] = SEW;
    const tun = new THREE.CylinderGeometry(2.4, 2.4, 60, 28, 1, true); tun.rotateZ(Math.PI / 2); tun.scale(1, 1.15, 1);
    const tunM = new THREE.MeshLambertMaterial({ map: rep(sewerBrick(), 15, 4), side: THREE.BackSide, emissive: new THREE.Color("#ffb070"), emissiveIntensity: 0.55 });
    tunM.emissiveMap = tunM.map;
    const tm = new THREE.Mesh(tun, tunM); tm.position.set(sx + 10, 2.2, sz); R.add(tm);
    const waterF = rep(flowTex("#4f6a5e", "rgba(170,200,190,0.5)"), 6, 1); waterF.rotation = Math.PI / 2; this.flows.push(waterF);
    const tw = new THREE.Mesh(flatUp(sx - 20, sx + 40, sz - 0.9, sz + 0.9, 0.1, 1, 1), new THREE.MeshLambertMaterial({ map: waterF, emissive: new THREE.Color("#3f5a50"), emissiveIntensity: 0.6 }));
    R.add(tw);
    for (const side of [-1, 1]) b.add(boxGeo(V(sx - 20, -0.3, sz + side * 0.9 - (side > 0 ? 0 : 1.2)), V(sx + 40, 0.0, sz + side * 0.9 + (side > 0 ? 1.2 : 0))), lam("walkway", () => ({ color: "#8a5a40", emissive: new THREE.Color("#6a3a24") })));
    for (const lx of [-6, 2, 10, 18]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(3, 2.1, 1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      s.position.set(sx + lx, 3.2, sz + 1.6); s.scale.set(1.6, 1.6, 1); s.layers.set(NOINK); R.add(s); this.lanterns.push(s);
      b.add(new THREE.BoxGeometry(0.22, 0.32, 0.22), lam("lanternBody", () => ({ color: "#3a2a20" })), M4(sx + lx, 3.2, sz + 1.6));
    }
    b.add(boxGeo(V(sx + 14, 0, sz - 1.5), V(sx + 15.2, 1.1, sz - 0.9)), lam("brickPile", () => ({ map: rep(sewerBrick(), 0.3, 0.3), emissive: new THREE.Color("#5a2a1a") })));

    // ---- aujourd'hui : la rue, la poubelle, la plaque d'égout, la tour de l'horloge au loin ----
    const [mx, , mz] = MOD;
    b.add(flatUp(mx - 150, mx + 150, mz - 7, mz + 0.6, 0.0, 40, 1), lam("asphaltM", () => ({ map: asphaltTex() })));
    b.add(flatUp(mx - 150, mx + 150, mz + 0.6, mz + 6.5, 0.12, 60, 2), lam("paveM", () => ({ map: paveTex() })));
    b.add(boxGeo(V(mx - 150, 0, mz + 0.45), V(mx + 150, 0.12, mz + 0.6)), lam("kerbM", () => ({ color: "#c9c5bd" })));
    for (let k = -6; k <= 6; k++) house(b, mx + k * 9, mz + 11, Math.PI, 8.6, 9, 9.8, (k + 20) % 8);
    b.add(flatUp(mx - 150, mx + 150, mz - 18, mz - 7, 0.12, 60, 2), lam("paveM", () => ({ map: paveTex() })));
    const mh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32).rotateX(-Math.PI / 2), lam("manhole", () => ({ map: manholeTex() })));
    mh.position.set(MANHOLE[0], 0.012, MANHOLE[2]); mh.receiveShadow = true; R.add(mh);
    gothTower(b, mx - 60, mz - 140, 9, 58, 18, gothicT, stone, lam("spire", () => ({ color: "#3b4a5e" })), lam("clockFace", () => ({ map: clockTex() })));
    setVegCenter(mx, mz);
    for (const tx of [-24, -12, 12, 24]) prop(b, kit, "tree_oak", mx + tx, 0.12, mz + 5.6, 6.5, tx);
    // la poubelle : cuve verte (autocollant GODZY côté rue), couvercle à charnière
    const binM = lam("binGodzy", () => ({ map: binTex() })), binG = lam("binGreen", () => ({ color: "#2f5f3a" }));
    const [bx, by, bz] = BIN;
    b.add(quad(V(bx + 0.32, by + 0.02, bz - 0.375), V(bx - 0.32, by + 0.02, bz - 0.375), V(bx - 0.32, by + 0.98, bz - 0.375), V(bx + 0.32, by + 0.98, bz - 0.375)), binM);
    walls(b, binG, bx - 0.33, bx + 0.33, by, by + 1.0, bz - 0.36, bz + 0.36, 1);
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14).rotateZ(Math.PI / 2), iron, M4(bx + s * 0.3, by + 0.1, bz + 0.38));
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.82).translate(0, 0.03, -0.41), binG);
    this.lid.add(lidM); this.lid.position.set(bx, by + 1.0, bz + 0.4); this.lid.traverse((o) => { o.castShadow = true; }); R.add(this.lid);
    // le bus d'aujourd'hui (plan 26)
    const busBody = new THREE.Mesh(boxGeo(V(-5.5, 0.35, -1.25), V(5.5, 4.4, 1.25)), lam("bus", () => ({ map: busTex() })));
    busBody.castShadow = true; this.bus.add(busBody);
    for (const wx of [-3.6, 3.4]) for (const wz of [-1.1, 1.1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16).rotateX(Math.PI / 2), lam("tyre", () => ({ color: "#26262c" }))); w.position.set(wx, 0.5, wz); this.bus.add(w); }
    this.bus.visible = false; R.add(this.bus);

    b.build(R); bs.build(R, false);
    setSight([]);

    // ---- les égouts vus du ciel : deux grands collecteurs le long des rives, des branches sous les rues ----
    this.dash = rep(dashTex(), 60, 1);
    const glowM = new THREE.MeshBasicMaterial({ map: this.dash, color: new THREE.Color(1.0, 2.6, 3.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    const lines: THREE.BufferGeometry[] = [];
    for (const zz of [14, RIVER.zS - 8]) lines.push(flatUp(-300, 700, zz - 3.5, zz + 3.5, 1.0, 1, 1));
    for (const xx of [-120, -40, 40, 120, 200]) lines.push(quad(V(xx - 2.2, 1.0, 300), V(xx + 2.2, 1.0, 300), V(xx + 2.2, 1.0, 14), V(xx - 2.2, 1.0, 14), 1, 1));
    this.sewerGlow = new THREE.Mesh(mergeGeometries(lines, false), glowM);
    this.sewerGlow.renderOrder = 10; this.sewerGlow.layers.set(NOINK); this.sewerGlow.visible = false; R.add(this.sewerGlow);
  }

  /** soleil relatif à la caméra, figé par plan (comme le modèle) */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    // ---- caméra ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- lumière ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 160);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 320); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 700; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- ciel, brouillard, soleil, nuages ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    const far = FAR_SHOT.has(id);
    this.fog.near = far ? L.fogNear * 6 : L.fogNear; this.fog.far = far ? L.fogFar * 3 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i], m = cl.m, mat = m.material as THREE.MeshBasicMaterial, g = s.light === "gris";
      m.position.set(cam.position.x + Math.cos(cl.a) * cl.d, cl.y + (g ? -40 : 0), cam.position.z + Math.sin(cl.a) * cl.d);
      m.scale.set((g ? 1.8 : 1) * (130 + (i % 4) * 30), (g ? 1.4 : 1) * (65 + (i % 4) * 15), 1);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- le fleuve (sale, puis propre au plan 25), les flots qui coulent ----
    this.riverMat.map = id === 25 ? this.riverMaps.clean : this.riverMaps.dirty;
    if (this.riverMat.map) this.riverMat.map.offset.set(t * 0.004, 0);
    for (const fl of this.flows) fl.offset.y = -t * 0.9;
    // ---- la poubelle, la charrette, le bus, les égouts lumineux ----
    this.lid.rotation.x = id === 9 ? 1.1 * clamp01((t - at(69)) / 0.5) : 0;
    this.trench.visible = id >= 19;
    this.cart.visible = id === 15;
    if (id === 15) { this.cart.position.set(1.2 + 1.4 * (t - s.a / FPS), 0, STREET_Z); }
    this.bus.visible = id === 26;
    if (id === 26) this.bus.position.set(MOD[0] - 40 + 6 * (t - s.a / FPS), 0, MOD[2] - 5.0);
    this.sewerGlow.visible = id === 21;
    this.dash.offset.x = -t * 0.8;
    for (const l of this.lanterns) l.scale.setScalar(1.5 + 0.12 * Math.sin(t * 9 + l.position.x));

    // ---- distribution + effets ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st: Stage = stage(id, t, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
