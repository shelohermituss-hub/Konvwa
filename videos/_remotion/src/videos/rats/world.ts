// Le monde des « Rats d'Hanoï » (1902) : le boulevard du quartier français (villas ocre, arbres, plaque d'égout), les
// égouts de brique, le bureau des primes, une ferme à rats dans les rizières, et aujourd'hui un jardin et une salle
// d'archives. Même éclairage deux tons, même ciel et mêmes nuages que le modèle du pont ; update(id, f, camera) pose tout.
import * as THREE from "three";
import { Batch, V, lam, boxGeo, quad, tri, Kit, Ray, prop, house, setSight, setVegCenter } from "./build";
import { ctex, rep, cloudHD, grassHD, facadeHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage } from "./cast";
import { FPS, SHOTS, ShotDef, camAt, at, MANHOLE, SEW, OFF, FARM, GARD, BATH, ARCH } from "./story";
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
const paveTex = () => ctex("paveL", 1024, 1024, (g, r) => {
  g.fillStyle = "#a9a7a6"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 128) for (let x = 0; x < 1024; x += 128) { const v = 168 + Math.floor(r() * 22); g.fillStyle = `rgb(${v},${v - 3},${v - 6})`; g.fillRect(x + 3, y + 3, 122, 122); }
});
/** flot qui coule (bouches d'égout, eau des égouts) : bandes qui défilent avec map.offset */
const flowTex = (col: string, hi: string) => ctex("flow" + col, 128, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = hi; g.fillRect(r() * 128, r() * 512, 6 + r() * 10, 30 + r() * 60); }
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

/** terre battue claire (1024 px = 8 m) */
const dirtTex = () => ctex("dirtH", 1024, 1024, (g, r) => {
  g.fillStyle = "#c9ad7e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 7000; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,90,50,0.25)" : "rgba(240,220,180,0.3)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 4, 2 + r() * 4); }
  for (let i = 0; i < 12; i++) { g.strokeStyle = "rgba(110,80,50,0.25)"; g.lineWidth = 6; g.beginPath(); g.moveTo(0, r() * 1024); g.bezierCurveTo(300, r() * 1024, 700, r() * 1024, 1024, r() * 1024); g.stroke(); }
});
/** rizières : carrés verts et eau qui brille (1024 px = 20 m) */
const paddyTex = () => ctex("paddy", 1024, 1024, (g, r) => {
  g.fillStyle = "#8a7a50"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 256) for (let x = 0; x < 1024; x += 256) {
    g.fillStyle = r() < 0.4 ? "#7fb6c4" : ["#7fb84a", "#6aa83c", "#93c55a"][Math.floor(r() * 3)]; g.fillRect(x + 10, y + 10, 236, 236);
    g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 3; for (let k = 0; k < 6; k++) { const yy = y + 30 + k * 36; g.beginPath(); g.moveTo(x + 20, yy); g.lineTo(x + 236, yy); g.stroke(); }
  }
});
const bambooTex = () => ctex("bambooW", 512, 512, (g) => {
  g.fillStyle = "#c9a660"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) { g.fillStyle = x % 64 ? "#b8944e" : "#d6b673"; g.fillRect(x, 0, 30, 512); g.fillStyle = "rgba(90,60,20,0.4)"; for (let y = 40; y < 512; y += 120) g.fillRect(x, y + (x % 3) * 10, 30, 6); }
});
const plasterTex = () => ctex("plasterO", 512, 512, (g, r) => {
  g.fillStyle = "#e9d8b0"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 30; i++) { const x = r() * 512, y = r() * 512, s = 30 + r() * 80; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, "rgba(160,130,80,0.12)"); gr.addColorStop(1, "rgba(160,130,80,0)"); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
  g.fillStyle = "#b8945a"; g.fillRect(0, 380, 512, 132);
});
const tileTex = (a: string, b: string) => ctex("tile" + a + b, 512, 512, (g) => {
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) { g.fillStyle = (x + y) % 128 ? a : b; g.fillRect(x, y, 64, 64); }
  g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 2; for (let k = 0; k <= 512; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
});
/** étagères de livres (1024 px = 3 m), avec un dos « GODZY » */
const booksTex = () => ctex("booksA", 1024, 1280, (g, r) => {
  g.fillStyle = "#5a3a28"; g.fillRect(0, 0, 1024, 1280);
  for (let row = 0; row < 5; row++) {
    const y1 = 1240 - row * 250, y0 = y1 - 210;
    g.fillStyle = "#7a5a40"; g.fillRect(0, y1, 1024, 24);
    let x = 10;
    while (x < 1000) {
      const w = 22 + r() * 30, h = 150 + r() * 55;
      g.fillStyle = ["#8c3b4a", "#2f5f6a", "#d9a441", "#3a3d6b", "#5d7a3a", "#b5653f", "#efe2bf"][Math.floor(r() * 7)]; g.fillRect(x, y1 - h, w, h);
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x + 3, y1 - h + 14, w - 6, 5);
      x += w + 3;
    }
    void y0;
  }
  g.save(); g.translate(512, 1240 - 2 * 250 - 90); g.fillStyle = "#c8402e"; g.fillRect(-24, -100, 48, 200); g.rotate(-Math.PI / 2);
  g.fillStyle = "#f2d58a"; g.font = '900 34px "Arial Black", Arial, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("GODZY", 0, 0); g.restore();
});

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
const FAR_SHOT = new Set([3]);

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
  private flows: THREE.Texture[] = [];
  private lanterns: THREE.Sprite[] = [];
  private cover = new THREE.Group();
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
    setVegCenter(0, 0);
    const b = new Batch(), bs = new Batch(); // bs : ne projette pas d'ombre
    const iron = lam("ironP", () => ({ color: "#2b2f3a" })), wood = lam("woodP", () => ({ color: "#8a5a3c" }));
    b.add(flatUp(-900, 900, -900, 900, -0.02, 200, 200), lam("groundFar", () => ({ color: "#a39a7e" })));

    // ---- le boulevard du quartier français ----
    b.add(flatUp(-200, 200, -5, 5, 0.0, 50, 2.5), lam("dirtRoad", () => ({ map: dirtTex() })));
    for (const s of [-1, 1]) b.add(flatUp(-200, 200, s < 0 ? -9.5 : 5, s < 0 ? -5 : 9.5, 0.12, 80, 1), lam("paveH", () => ({ map: paveTex() })));
    for (const s of [-1, 1]) b.add(boxGeo(V(-200, 0, s < 0 ? -5.12 : 4.88), V(200, 0.12, s < 0 ? -4.88 : 5.12)), lam("kerbH", () => ({ color: "#c9c0a8" })));
    for (const [sgn, zc, yaw] of [[-1, -13.5, 0], [1, 13.5, Math.PI]] as const) {
      let x = -80, k = 0;
      while (x < 80) { const w = [9, 11, 10][k % 3], hh = [8.4, 9.8, 7][k % 3]; house(sgn < 0 ? bs : b, x + w / 2, zc, yaw, w, 8, hh, [0, 1, 4, 6][(k + (sgn > 0 ? 2 : 0)) % 4]); x += w + 3.2; k++; }
    }
    for (let x = -60; x <= 60; x += 9) for (const z of [-6.6, 6.6]) prop(b, kit, "tree_oak", x + (z > 0 ? 4 : 0), 0.12, z, 7.5, x);
    for (let lx = -54; lx <= 54; lx += 18) for (const lz of [-5.4, 5.4]) {
      b.add(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8).translate(0, 1.8, 0), iron, M4(lx, 0.12, lz));
      b.add(new THREE.BoxGeometry(0.4, 0.5, 0.4).translate(0, 3.8, 0), lam("gasLampH", () => ({ color: "#f2e2a8" })), M4(lx, 0.12, lz));
    }
    // la plaque d'égout ouverte : le trou noir, le couvercle posé à côté
    const [mx, my, mz] = MANHOLE;
    b.add(new THREE.CircleGeometry(0.45, 28).rotateX(-Math.PI / 2), lam("holeDark", () => ({ color: "#1a1416" })), M4(mx, my + 0.004, mz));
    b.add(new THREE.CylinderGeometry(0.47, 0.47, 0.05, 28).translate(0, 0.025, 0), iron, M4(mx + 1.0, my, mz + 0.3));
    // enseigne GODZY d'un café sur le boulevard
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.8), new THREE.MeshBasicMaterial({ map: godzyTexture({ w: 1024, h: 292 }) }));
    sign.position.set(-6.5, 3.2, 9.4); sign.rotation.y = Math.PI; sign.layers.set(NOINK); R.add(sign);

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

    // ---- le bureau des primes (sans plafond) ----
    const [ox, , oz] = OFF, plaster = lam("plasterO", () => ({ map: plasterTex() }));
    b.add(flatUp(ox - 7, ox + 7, oz - 4.6, oz + 8, 0.0, 7, 6), lam("tilesO", () => ({ map: tileTex("#c9b48a", "#e8dcc0") })));
    walls(b, plaster, ox - 7, ox + 7, 0, 4.2, oz - 4.8, oz - 4.5, 4);
    walls(b, plaster, ox - 7.3, ox - 7, 0, 4.2, oz - 4.8, oz + 8, 4);
    walls(b, plaster, ox + 7, ox + 7.3, 0, 4.2, oz - 4.8, oz + 8, 4);
    b.add(boxGeo(V(ox - 3, 0, oz - 0.55), V(ox + 3, 1.05, oz + 0.55)), wood);
    b.add(boxGeo(V(ox - 3.1, 1.05, oz - 0.65), V(ox + 3.1, 1.12, oz + 0.65)), lam("counterTop", () => ({ color: "#6a4128" })));
    b.add(boxGeo(V(ox - 6.8, 0, oz - 4.5), V(ox - 4.6, 2.6, oz - 3.9)), wood); // armoire de dossiers
    b.add(boxGeo(V(ox + 4.4, 0, oz - 4.5), V(ox + 6.8, 1.0, oz - 3.6)), lam("bucketsO", () => ({ color: "#8a8f98" }))); // seaux empilés
    // ---- la ferme à rats dans les rizières ----
    const [fx, , fz] = FARM;
    b.add(flatUp(fx - 300, fx + 300, fz - 300, fz + 300, 0.0, 60, 60), lam("paddy", () => ({ map: paddyTex() })));
    b.add(flatUp(fx - 6, fx + 6, fz - 4, fz + 6, 0.01, 4, 3), lam("yard", () => ({ map: dirtTex() })));
    const bamboo = lam("bamboo", () => ({ map: bambooTex() })), thatch = lam("thatch", () => ({ color: "#c9a660" }));
    walls(b, bamboo, fx - 3.5, fx + 3.5, 0, 2.6, fz - 4.2, fz - 1.2, 3);
    b.add(new THREE.ConeGeometry(5.2, 3, 4).translate(0, 1.5, 0), thatch, M4(fx, 2.6, fz - 2.7, Math.PI / 4, 1, 1, 0.62));
    for (let c = 0; c < 3; c++) { // les cages : cadre en bois, barreaux
      const cx = fx - 1.5 + c * 1.5;
      b.add(boxGeo(V(cx - 0.6, 0, fz - 0.15), V(cx + 0.6, 0.08, fz + 0.45)), wood);
      b.add(boxGeo(V(cx - 0.6, 0.92, fz - 0.15), V(cx + 0.6, 1.0, fz + 0.45)), wood);
      b.add(boxGeo(V(cx - 0.6, 0.08, fz - 0.15), V(cx + 0.6, 0.92, fz - 0.1)), lam("cageBack", () => ({ color: "#6a4a30" })));
      for (let k = 0; k <= 8; k++) b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.84, 5).translate(0, 0.5, 0), iron, M4(cx - 0.58 + k * 0.145, 0, fz + 0.43));
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.26), new THREE.MeshBasicMaterial({ map: godzyTexture({ w: 1024, h: 296, bg: "#e9d8a8" }) }));
    label.position.set(fx, 1.12, fz + 0.2); label.layers.set(NOINK); R.add(label);
    b.add(boxGeo(V(fx - 0.5, 1.0, fz + 0.15), V(fx + 0.5, 1.4, fz + 0.2)), wood);
    setVegCenter(fx, fz);
    for (const [dx, dz, h] of [[-8, -6, 7], [7, -5, 8], [-10, 4, 6], [9, 6, 7], [3, -9, 9]] as const) prop(b, kit, "tree_fat", fx + dx, 0, fz + dz, h, dx);
    // ---- le jardin d'aujourd'hui ----
    const [gx, , gz] = GARD;
    b.add(flatUp(gx - 40, gx + 40, gz - 40, gz + 40, 0.01, 20, 20), lam("grassG", () => ({ map: grassHD() })));
    walls(b, lam("houseG", () => ({ map: facadeHD("gardHouse", 14, 7, { wall: "#e9d8b8", shutter: "#3f6fb5", door: true }) })), gx - 7, gx + 7, 0, 7, gz - 7, gz - 4, 14);
    for (let x = -6; x <= 6; x += 0.5) b.add(boxGeo(V(gx + x - 0.06, 0, gz + 3.5), V(gx + x + 0.06, 0.9, gz + 3.56)), lam("picket", () => ({ color: "#f4f1ea" })));
    b.add(boxGeo(V(gx - 6, 0.55, gz + 3.45), V(gx + 6, 0.65, gz + 3.5)), lam("picket", () => ({ color: "#f4f1ea" })));
    setVegCenter(gx, gz);
    for (const [dx, dz] of [[-5, -2], [5, -2.5]] as const) prop(b, kit, "plant_bushLarge", gx + dx, 0.01, gz + dz, 1.2);
    // ---- la salle de bains de la villa ----
    const [bx, , bz] = BATH, tiles = lam("tilesB", () => ({ map: tileTex("#f4f1ea", "#9fc4dc") }));
    b.add(flatUp(bx - 2.5, bx + 2.5, bz - 2.2, bz + 3, 0.0, 4, 4), lam("floorB", () => ({ map: tileTex("#2f3a56", "#f4f1ea") })));
    walls(b, tiles, bx - 2.5, bx + 2.5, 0, 3.6, bz - 2.4, bz - 2.2, 1.5);
    walls(b, tiles, bx - 2.7, bx - 2.5, 0, 3.6, bz - 2.4, bz + 3, 1.5);
    const porcelain = twoTone(new THREE.MeshPhongMaterial({ color: "#f8f6f0", specular: "#ffffff", shininess: 60 }));
    b.add(new THREE.CylinderGeometry(0.24, 0.17, 0.42, 20).translate(0, 0.21, 0), porcelain, M4(bx, 0, bz - 1.2));
    b.add(new THREE.TorusGeometry(0.22, 0.04, 8, 24).rotateX(Math.PI / 2), wood, M4(bx, 0.44, bz - 1.2));
    b.add(boxGeo(V(bx - 0.3, 2.3, bz - 2.2), V(bx + 0.3, 2.7, bz - 1.95)), lam("tankB", () => ({ color: "#5a7a5a" })));
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6).translate(0, 1.0, 0), iron, M4(bx, 0.42, bz - 1.98));
    b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 4).translate(0, -0.45, 0), iron, M4(bx + 0.25, 2.3, bz - 2.0));
    b.add(new THREE.SphereGeometry(0.05, 10, 8), wood, M4(bx + 0.25, 1.38, bz - 2.0));
    // ---- la salle d'archives (aujourd'hui) ----
    const [ax, , az] = ARCH, shelves = lam("books", () => ({ map: booksTex() }));
    b.add(flatUp(ax - 4, ax + 4, az - 3, az + 4, 0.0, 4, 4), lam("floorA", () => ({ color: "#7a5a40" })));
    walls(b, shelves, ax - 4, ax + 4, 0, 3.4, az - 3.2, az - 3.0, 3);
    walls(b, shelves, ax - 4.2, ax - 4, 0, 3.4, az - 3.2, az + 4, 3);
    b.add(boxGeo(V(ax - 1.2, 0, az - 0.6), V(ax + 1.2, 0.95, az + 0.5)), wood);
    b.add(boxGeo(V(ax + 0.6, 0.95, az - 0.4), V(ax + 1.1, 1.15, az + 0.1)), lam("filesA", () => ({ color: "#d9c79a" })));
    b.add(new THREE.CylinderGeometry(0.03, 0.06, 0.5, 8).translate(0, 0.25, 0), iron, M4(ax - 0.9, 0.95, az - 0.3));
    b.add(new THREE.ConeGeometry(0.18, 0.2, 12, 1, true).translate(0, 0.55, 0), lam("lampA", () => ({ color: "#2f6a43", side: THREE.DoubleSide })), M4(ax - 0.9, 0.95, az - 0.3));

    b.build(R); bs.build(R, false);
    setSight([]);
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
    // ---- l'eau des égouts qui coule, les lanternes qui vacillent ----
    for (const fl of this.flows) fl.offset.y = -t * 0.9;
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
