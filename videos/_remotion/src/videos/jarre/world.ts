// La jarre de Zhang Heng : les décors, dans le nouveau rendu calé sur les références (3D « dessin animé » : couleurs franches,
// peinture mate, tout cerné d'encre, lumière claire et égale, texte lisible dans le décor). Cinq lieux, loin les uns des autres :
// la salle du trône (Luoyang) et sa cour, le bus d'aujourd'hui, le village de Longxi après le séisme, le musée.
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { staticFile } from "remotion";
import { Kit } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage } from "./cast";
import { Jar } from "./jar";
import { FPS, SHOTS, camAt, HALL, COURT, JAR, THRONE, MAPT, TEA, BUS, LONGXI, MUSEUM, T, WHIPS, clamp01 } from "./story";
import { W } from "./words";

/** police des affiches du décor */
export const POSTER_FONT = "Anton Konvwa";
let HDR: THREE.DataTexture | null = null;
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const font = new FontFace(POSTER_FONT, `url(${staticFile("fonts/anton.woff2")})`).load()
      .then((ff) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(ff); return ["_font", new THREE.Group()] as const; });
    kitP = Promise.all([
      new RGBELoader().loadAsync(staticFile("assets/polyhaven/hdri/kloofendal_48d_partly_cloudy_puresky.hdr")).then((t) => { HDR = t; return ["_hdr", new THREE.Group()] as const; }),
      font,
    ]).then((l) => Object.fromEntries(l) as Kit);
  }
  return kitP;
};

// ---------------- outils ----------------
const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });
const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
};
const cyl = (r: number, h: number, m: THREE.Material, x: number, y: number, z: number, n = 24, r2 = r) => {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, n), m); me.position.set(x, y + h / 2, z); me.castShadow = true; me.receiveShadow = true; return me;
};
const ball = (r: number, m: THREE.Material, x: number, y: number, z: number) => { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); me.position.set(x, y, z); me.castShadow = true; return me; };
/** un panneau dessiné posé contre un mur (face vers +z, tourné de yaw) */
const panel = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, yaw = 0, back = "#fbf0d4") => {
  const g = new THREE.Group();
  g.add(box(w, h, 0.02, mat({ color: back }), 0, 0, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: tex })); face.position.z = 0.012; face.receiveShadow = true; g.add(face);
  g.position.set(x, y, z); g.rotation.y = yaw; return g;
};
const tiled = (t: THREE.Texture, rx: number, ry: number) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
/** toit chinois : deux pans, une faîtière, des coins relevés (largeur w, profondeur d, au-dessus de y) */
const roof = (w: number, d: number, y: number, tile: THREE.Material, ridge: THREE.Material) => {
  const g = new THREE.Group(), h = d * 0.42;
  for (const s of [-1, 1]) {
    const len = Math.hypot(d / 2 + 0.6, h), sl = box(w + 1.6, 0.18, len, tile, 0, y + h / 2, s * (d / 4 + 0.15));
    sl.rotation.x = s * Math.atan2(h, d / 2 + 0.6); g.add(sl);
  }
  g.add(box(w + 1.2, 0.32, 0.32, ridge, 0, y + h + 0.06, 0));
  for (const sx of [-1, 1]) {
    g.add(box(0.3, 0.7, 0.3, ridge, sx * (w / 2 + 0.55), y + h + 0.3, 0));
    for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8), ridge); c.position.set(sx * (w / 2 + 0.85), y + 0.15, sz * (d / 2 + 0.75)); c.rotation.set(sz * 0.9, 0, -sx * 0.9); g.add(c); }
  }
  return g;
};

// ---------------- textures dessinées ----------------
const INK = "#1a1418";
const font = (px: number) => `${px}px "${POSTER_FONT}"`;
const stoneTex = (key: string, a: string, b: string) => ctex(key, 256, 256, (g, r) => {
  for (let y = 0; y < 256; y += 128) for (let x = 0; x < 256; x += 128) { g.fillStyle = ((x + y) / 128) % 2 ? a : b; g.fillRect(x, y, 128, 128); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,80,30,${0.04 + r() * 0.05})`; g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 14, 0, 7); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 4; for (let k = 0; k <= 256; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
});
const lacquerTex = () => ctex("lacquer", 256, 512, (g) => {
  g.fillStyle = "#c8352e"; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(20, 0, 30, 512);
  g.fillStyle = "#e8b84a"; g.fillRect(0, 0, 256, 50); g.fillRect(0, 470, 256, 42);
  g.strokeStyle = INK; g.lineWidth = 4; for (const y of [50, 470]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.lineWidth = 3; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 16, 25); g.lineTo(x + 32, 10); g.stroke(); }
});
const latticeTex = () => ctex("lattice", 256, 256, (g) => {
  g.fillStyle = "#fff4d8"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#8a2a24"; g.lineWidth = 10;
  for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  g.lineWidth = 6; for (let k = 32; k < 256; k += 64) { g.beginPath(); g.moveTo(k, k - 32); g.lineTo(k + 32, k); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
});
const coffersTex = () => ctex("coffers", 256, 256, (g) => {
  g.fillStyle = "#2f8a7e"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#1f5f6e"; g.fillRect(24, 24, 208, 208);
  g.fillStyle = "#e8b84a"; g.beginPath(); g.arc(128, 128, 54, 0, 7); g.fill();
  g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeRect(24, 24, 208, 208); g.strokeRect(3, 3, 250, 250);
  g.fillStyle = "#d8352f"; g.beginPath(); g.arc(128, 128, 22, 0, 7); g.fill(); g.stroke();
});
const carpetTex = () => ctex("carpet", 256, 512, (g) => {
  g.fillStyle = "#b32a2a"; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "#e8b84a"; g.fillRect(0, 0, 26, 512); g.fillRect(230, 0, 26, 512);
  g.strokeStyle = INK; g.lineWidth = 4; for (const x of [26, 230]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  g.strokeStyle = "#e8b84a"; g.lineWidth = 6; g.beginPath(); g.arc(128, 256, 60, 0, 7); g.stroke();
});
/** le grand paravent derrière le trône : un dragon d'or sur fond rouge */
const screenTex = () => ctex("screenDragon", 1024, 512, (g) => {
  g.fillStyle = "#b32a2a"; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = "#e8b84a"; g.lineWidth = 16; g.strokeRect(20, 20, 984, 472);
  const pts: [number, number][] = []; for (let i = 0; i <= 60; i++) { const x = 140 + i * 12.5; pts.push([x, 270 + 110 * Math.sin(i * 0.22)]); }
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = INK; g.lineWidth = 64; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.strokeStyle = "#f3c84a"; g.lineWidth = 50; g.stroke();
  g.fillStyle = "#e8a83a"; for (let i = 2; i < 60; i += 4) { const [x, y] = pts[i]; g.beginPath(); g.moveTo(x - 10, y - 22); g.lineTo(x, y - 52); g.lineTo(x + 10, y - 22); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); }
  const [hx, hy] = pts[60];
  g.fillStyle = "#f3c84a"; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.ellipse(hx + 30, hy - 10, 70, 50, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(hx + 40, hy - 25, 13, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(hx + 44, hy - 25, 6, 0, 7); g.fill();
  g.fillStyle = "#e2453c"; g.beginPath(); g.arc(hx + 140, hy - 10, 30, 0, 7); g.fill(); g.stroke();
});
/** la carte de l'empire Han : Luoyang (la capitale), Longxi à l'ouest, fleuves, Grande Muraille */
const mapTex = () => ctex("hanMap", 1024, 640, (g) => {
  g.fillStyle = "#9fd0e0"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#f2dfa8"; g.strokeStyle = INK; g.lineWidth = 8;
  g.beginPath(); g.moveTo(90, 160); g.bezierCurveTo(300, 60, 640, 80, 850, 150); g.bezierCurveTo(960, 230, 930, 380, 880, 470); g.bezierCurveTo(760, 600, 520, 600, 380, 560); g.bezierCurveTo(220, 520, 60, 420, 70, 300); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = "#3f7fc4"; g.lineWidth = 10;
  g.beginPath(); g.moveTo(180, 250); g.bezierCurveTo(360, 160, 520, 330, 860, 260); g.stroke();
  g.beginPath(); g.moveTo(200, 420); g.bezierCurveTo(420, 380, 620, 520, 880, 420); g.stroke();
  g.strokeStyle = "#8a4f2a"; g.lineWidth = 8; g.setLineDash([18, 10]); g.beginPath(); g.moveTo(140, 175); g.bezierCurveTo(340, 110, 600, 120, 820, 165); g.stroke(); g.setLineDash([]);
  for (const [x, y, lab, col] of [[640, 300, "LUOYANG", "#e2453c"], [250, 285, "LONGXI", "#2f6fd0"]] as const) {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, 18, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = INK; g.font = font(40); g.textAlign = "center"; g.fillText(lab, x, y + 60);
  }
  g.fillStyle = INK; g.font = font(54); g.textAlign = "center"; g.fillText("EMPIRE HAN", 512, 560);
  g.strokeStyle = INK; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 626);
});
const roofTileTex = (key: string, base: string) => ctex(key, 256, 256, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = INK; g.lineWidth = 4; for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.18)"; for (let x = 6; x < 256; x += 32) g.fillRect(x, 0, 6, 256);
});
const mudTex = () => ctex("mudWall", 256, 256, (g, r) => {
  g.fillStyle = "#e0b47a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(140,90,40,${0.05 + r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 10 + r() * 30, 4 + r() * 6); }
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(40, 0); g.lineTo(70, 60); g.lineTo(50, 110); g.lineTo(90, 170); g.stroke();
});
const loessTex = () => ctex("loess", 256, 256, (g, r) => {
  g.fillStyle = "#e9c88a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(150,100,50,${0.06 + r() * 0.08})`; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 6, 0, 7); g.fill(); }
});
const cityTex = () => ctex("cityStrip", 2048, 512, (g, r) => {
  g.fillStyle = "#bfe3f5"; g.fillRect(0, 0, 2048, 512);
  const cols = ["#f2b13c", "#e2453c", "#3f7fc4", "#2f9d7e", "#f6ead2", "#7a4fa8"];
  for (let x = 0; x < 2048; ) {
    const w = 120 + r() * 160, h = 180 + r() * 280, c = cols[Math.floor(r() * cols.length)];
    g.fillStyle = c; g.fillRect(x, 512 - h, w, h); g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(x, 512 - h, w, h);
    g.fillStyle = "#fffaf0"; for (let y = 512 - h + 24; y < 470; y += 56) for (let wx = x + 18; wx < x + w - 30; wx += 44) { g.fillRect(wx, y, 24, 30); g.lineWidth = 4; g.strokeRect(wx, y, 24, 30); }
    x += w + 10;
  }
  g.fillStyle = "#555a66"; g.fillRect(0, 470, 2048, 42);
});
const busFloorTex = () => ctex("busFloor", 256, 256, (g) => {
  g.fillStyle = "#5a6070"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(255,255,255,0.08)"; for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 6);
});
const godzyTex = (bg: string, fg: string, vertical = false) => ctex(`godzy${bg}${vertical}`, vertical ? 200 : 600, vertical ? 760 : 220, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  if (vertical) { g.font = font(130); "GODZY".split("").forEach((c, i) => g.fillText(c, 100, 90 + i * 142)); }
  else { g.font = font(150); g.fillText("GODZY", 300, 116); }
  g.strokeStyle = INK; g.lineWidth = 12; g.strokeRect(6, 6, g.canvas.width - 12, g.canvas.height - 12);
});
const labelTex = () => ctex("museumLabel", 700, 300, (g) => {
  g.fillStyle = "#fffdf6"; g.fillRect(0, 0, 700, 300);
  g.fillStyle = INK; g.textAlign = "center"; g.font = font(64); g.fillText("RÉPLIQUE MODERNE", 350, 100);
  g.font = font(40); g.fillText("d'après la jarre de Zhang Heng", 350, 175); g.fillText("Chine, an 132", 350, 235);
  g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(5, 5, 690, 290);
});
const signTex = (txt: string, bg: string) => ctex(`sign${txt}`, 600, 200, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 600, 200);
  g.fillStyle = "#fff6e0"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = font(120); g.fillText(txt, 300, 106);
  g.strokeStyle = INK; g.lineWidth = 12; g.strokeRect(6, 6, 588, 188);
});
const posterTex = () => ctex("museumPoster", 500, 700, (g) => {
  g.fillStyle = "#2f6fd0"; g.fillRect(0, 0, 500, 700);
  g.fillStyle = "#f3c84a"; g.beginPath(); g.arc(250, 300, 150, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 10; g.stroke();
  g.fillStyle = "#fff6e0"; g.textAlign = "center"; g.font = font(78); g.fillText("SÉISMES", 250, 560); g.font = font(44); g.fillText("2000 ANS D'INVENTIONS", 250, 630);
  g.strokeRect(5, 5, 490, 690);
});
const glowTex = () => ctex("glowSoft", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight;
  private jar: Jar; private replica: Jar;
  private city: THREE.Texture; private tea: THREE.Mesh;
  private houses: THREE.Object3D[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root;
    // ---- lumière claire et égale ; le soleil suit la caméra d'un lieu à l'autre (ombres) ----
    this.hemi = new THREE.HemisphereLight("#fff6e6", "#b89a74", 1.5);
    this.sun = new THREE.DirectionalLight("#fff0d6", 1.8);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.radius = 4;
    const sc = this.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    const fill = new THREE.DirectionalLight("#e8f0ff", 0.55); fill.position.set(3, 4, 8);
    R.add(this.hemi, this.sun, this.sun.target, fill);

    // ================= la salle du trône =================
    const { x0, x1, z0, z1, h } = HALL;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat({ map: tiled(stoneTex("hallFloor", "#f1d8a0", "#e6c47e"), (x1 - x0) / 2, (z1 - z0) / 2) }));
    floor.position.set(0, 0, (z0 + z1) / 2); floor.receiveShadow = true; R.add(floor);
    const lacq = mat({ map: tiled(lacquerTex(), 6, 1) }), red = mat({ color: "#c8352e" }), gold = mat({ color: "#e8b84a" }), dark = mat({ color: "#5a2a1e" });
    const lat = mat({ map: latticeTex() });
    // murs : fond et côtés en laque rouge, fenêtres à croisillons sur les côtés
    R.add(box(x1 - x0, h, 0.3, lacq, 0, h / 2, z0));
    for (const sx of [-1, 1]) {
      R.add(box(0.3, h, z1 - z0, lacq, sx * x1, h / 2, (z0 + z1) / 2));
      for (const z of [-6.5, -3, 0.5]) R.add(panel(latticeTex(), 1.8, 1.8, sx * (x1 - 0.17), 2.6, z, -sx * Math.PI / 2, "#8a2a24"));
    }
    // le mur de la façade, avec la grande porte ouverte sur la cour (x -2.2..2.2, h 4.2)
    R.add(box(x1 - 2.2, h, 0.3, lacq, (2.2 + x1) / 2, h / 2, z1), box(x1 - 2.2, h, 0.3, lacq, -(2.2 + x1) / 2, h / 2, z1), box(4.4, h - 4.2, 0.3, lacq, 0, (h + 4.2) / 2, z1));
    R.add(box(4.8, 0.3, 0.4, gold, 0, 4.3, z1), box(0.3, 4.2, 0.4, gold, -2.35, 2.1, z1), box(0.3, 4.2, 0.4, gold, 2.35, 2.1, z1));
    // plafond à caissons
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), mat({ map: tiled(coffersTex(), (x1 - x0) / 1.4, (z1 - z0) / 1.4) })); ceil.position.set(0, h, (z0 + z1) / 2); R.add(ceil);
    for (let z = z0 + 1.5; z < z1; z += 3) R.add(box(x1 - x0, 0.3, 0.3, red, 0, h - 0.15, z));
    // colonnes rouges, bases et chapiteaux dorés
    for (const sx of [-1, 1]) for (const z of [-8, -5.2, -2.4, 0.4, 3.2]) {
      R.add(cyl(0.3, h, red, sx * 4.6, 0, z), cyl(0.42, 0.3, gold, sx * 4.6, 0, z), cyl(0.38, 0.3, gold, sx * 4.6, h - 0.6, z));
    }
    // le tapis rouge, l'estrade, le trône, le paravent au dragon
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 11.5).rotateX(-Math.PI / 2), mat({ map: tiled(carpetTex(), 1, 4) })); carpet.position.set(0, 0.012, -0.5); carpet.receiveShadow = true; R.add(carpet);
    R.add(box(6, 0.3, 3.2, dark, 0, 0.15, -8.0), box(5, 0.3, 2.8, red, 0, 0.45, -8.1));
    R.add(box(1.8, 0.35, 0.9, gold, THRONE[0], 0.78, THRONE[2] - 0.25), box(1.9, 1.6, 0.18, gold, THRONE[0], 1.4, THRONE[2] - 0.65), box(0.18, 0.6, 0.9, gold, THRONE[0] - 0.95, 1.0, THRONE[2] - 0.25), box(0.18, 0.6, 0.9, gold, THRONE[0] + 0.95, 1.0, THRONE[2] - 0.25));
    R.add(ball(0.12, red, THRONE[0] - 0.95, 2.25, THRONE[2] - 0.65), ball(0.12, red, THRONE[0] + 0.95, 2.25, THRONE[2] - 0.65));
    R.add(panel(screenTex(), 7, 3.5, 0, 3.0, z0 + 0.2, 0, "#e8b84a"));
    // lanternes rouges suspendues
    const lanM = mat({ color: "#e2453c", emissive: new THREE.Color("#ff6a3a"), emissiveIntensity: 0.35 });
    for (const [x, z] of [[-2.4, -5.5], [2.4, -5.5], [-2.4, -0.5], [2.4, -0.5], [-2.4, 3.0], [2.4, 3.0]] as const) {
      const l = ball(0.32, lanM, x, 4.6, z); l.scale.set(1, 1.2, 1); R.add(l, cyl(0.2, 0.08, gold, x, 4.98, z), cyl(0.2, 0.08, gold, x, 4.15, z), cyl(0.012, h - 5.0, mat({ color: INK }), x, 5.06, z, 6));
    }
    // brûle-parfums de bronze de chaque côté de l'estrade
    for (const sx of [-1, 1]) { R.add(cyl(0.4, 0.5, gold, sx * 2.7, 0.35, -6.4, 20, 0.3)); for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3; R.add(cyl(0.05, 0.4, gold, sx * 2.7 + 0.25 * Math.sin(a), 0, -6.4 + 0.25 * Math.cos(a), 8)); } }
    // la table à carte de l'empire
    R.add(box(2.5, 0.1, 1.6, mat({ color: "#8a4f2a" }), MAPT[0], 0.87, MAPT[2]));
    for (const [dx, dz] of [[-1.1, -0.65], [1.1, -0.65], [-1.1, 0.65], [1.1, 0.65]] as const) R.add(box(0.12, 0.82, 0.12, dark, MAPT[0] + dx, 0.41, MAPT[2] + dz));
    const map = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.44).rotateX(-Math.PI / 2), mat({ map: mapTex() })); map.position.set(MAPT[0], 0.925, MAPT[2]); map.receiveShadow = true; R.add(map);
    // la petite table à thé : théière et tasse (qui ne bougeront pas)
    R.add(box(0.9, 0.06, 0.6, mat({ color: "#7a3e22" }), TEA[0], 0.66, TEA[2]));
    for (const [dx, dz] of [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]] as const) R.add(box(0.06, 0.63, 0.06, dark, TEA[0] + dx, 0.315, TEA[2] + dz));
    const porc = mat({ color: "#f6f2e6" }), blue = mat({ color: "#2f6fd0" });
    const pot = ball(0.13, porc, TEA[0] - 0.2, 0.8, TEA[2] - 0.05); pot.scale.set(1, 0.85, 1); R.add(pot, ball(0.03, blue, TEA[0] - 0.2, 0.93, TEA[2] - 0.05));
    const sp = cyl(0.025, 0.14, porc, TEA[0] - 0.05, 0.76, TEA[2] - 0.05, 8); sp.rotation.z = -0.9; R.add(sp);
    R.add(cyl(0.065, 0.075, porc, TEA[0] + 0.18, 0.69, TEA[2] + 0.06, 20, 0.045), cyl(0.066, 0.012, blue, TEA[0] + 0.18, 0.74, TEA[2] + 0.06, 20));
    this.tea = new THREE.Mesh(new THREE.CircleGeometry(0.056, 24).rotateX(-Math.PI / 2), mat({ color: "#8a5a1a" })); this.tea.position.set(TEA[0] + 0.18, 0.758, TEA[2] + 0.06); R.add(this.tea);
    // la jarre
    this.jar = new Jar(); this.jar.root.position.set(...JAR); R.add(this.jar.root);

    // ================= la cour, devant la salle =================
    const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.x1 - COURT.x0, COURT.z1 - COURT.z0 + 4).rotateX(-Math.PI / 2), mat({ map: tiled(stoneTex("courtFloor", "#e4dccb", "#d6ccb6"), 13, 12) }));
    court.position.set(0, -0.005, (COURT.z0 + COURT.z1) / 2 + 2); court.receiveShadow = true; R.add(court);
    const tileGold = mat({ map: tiled(roofTileTex("roofGold", "#f2b83a"), 8, 2) }), ridge = mat({ color: "#2f6f5e" });
    R.add(roof(x1 - x0, 7, h, tileGold, ridge));
    // la frise sous le toit et les colonnes du porche
    R.add(box(x1 - x0 + 0.6, 0.6, 0.4, mat({ map: tiled(coffersTex(), 10, 0.5) }), 0, h - 0.3, z1 + 0.5));
    for (const x of [-6, -3.6, 3.6, 6]) R.add(cyl(0.28, h - 0.6, red, x, 0, z1 + 0.9), cyl(0.38, 0.25, gold, x, 0, z1 + 0.9));
    // murs de la cour (rouges, chaperon de tuiles), la porte de la ville
    const wallR = mat({ color: "#c8452e" }), cap = mat({ map: tiled(roofTileTex("roofTeal", "#2f8a7e"), 10, 1) });
    for (const sx of [-1, 1]) { R.add(box(0.6, 3.2, COURT.z1 - COURT.z0, wallR, sx * COURT.x1, 1.6, (COURT.z0 + COURT.z1) / 2), box(1.0, 0.3, COURT.z1 - COURT.z0, cap, sx * COURT.x1, 3.3, (COURT.z0 + COURT.z1) / 2)); }
    for (const sx of [-1, 1]) R.add(box(COURT.x1 - 2.5, 3.6, 0.8, wallR, sx * (2.5 + COURT.x1) / 2, 1.8, COURT.z1), box(COURT.x1 - 2.5, 0.3, 1.2, cap, sx * (2.5 + COURT.x1) / 2, 3.75, COURT.z1));
    R.add(box(5.6, 1.4, 1.0, wallR, 0, 4.9, COURT.z1), roof(6, 2.6, 5.6, mat({ map: tiled(roofTileTex("roofTeal", "#2f8a7e"), 4, 1) }), dark).translateZ(COURT.z1));
    // arbres ronds, grand brûle-parfum, la bannière signée
    const leaf = mat({ color: "#5fb04a" }), trunk = mat({ color: "#7a4f2a" });
    for (const [x, z] of [[-9, 10], [9, 10], [-9, 19], [9, 19]] as const) { R.add(cyl(0.18, 1.6, trunk, x, 0, z, 10)); const c = ball(1.3, leaf, x, 2.6, z); c.scale.set(1, 0.85, 1); R.add(c); }
    R.add(cyl(0.7, 0.9, gold, 0, 0.4, 15.5, 24, 0.5)); for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3; R.add(cyl(0.08, 0.5, gold, 0.5 * Math.sin(a), 0, 15.5 + 0.5 * Math.cos(a), 8)); }
    R.add(cyl(0.07, 6, mat({ color: "#5a2a1e" }), 6.5, 0, 12.5, 10), box(1.3, 0.08, 0.08, gold, 6.5, 5.9, 12.5));
    R.add(panel(godzyTex("#d8352f", "#f3c84a", true), 1.0, 3.8, 6.5, 3.9, 12.52, 0, "#d8352f"));

    // ================= le bus d'aujourd'hui =================
    const B = BUS, bw = 2.4, bl = 12, bh = 2.3, bx0 = B[0] - bw / 2, bx1 = B[0] + bw / 2;
    const bfloor = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl).rotateX(-Math.PI / 2), mat({ map: tiled(busFloorTex(), 2, 8) })); bfloor.position.set(B[0], 0.002, B[2]); R.add(bfloor);
    const bwall = mat({ color: "#f6f2e6" }), bseat = mat({ color: "#2f6fd0" }), pole = mat({ color: "#f2c230" });
    for (const sx of [-1, 1]) { const x = B[0] + sx * bw / 2; R.add(box(0.1, 0.9, bl, bwall, x, 0.45, B[2]), box(0.1, 0.45, bl, bwall, x, bh - 0.22, B[2])); for (let z = -6; z <= 6; z += 2) R.add(box(0.12, 0.95, 0.12, bwall, x, 1.38, B[2] + z)); }
    R.add(box(bw, 0.1, bl, mat({ color: "#e9e4d6" }), B[0], bh, B[2]), box(bw, bh, 0.1, bwall, B[0], bh / 2, B[2] - bl / 2), box(bw, bh, 0.1, bwall, B[0], bh / 2, B[2] + bl / 2));
    for (let z = -5; z <= 5; z += 1.6) for (const sx of [-1, 1]) { if (sx === -1 && Math.abs(z) < 1.5) continue; R.add(box(0.5, 0.12, 0.5, bseat, B[0] + sx * 0.82, 0.48, B[2] + z), box(0.5, 0.55, 0.1, bseat, B[0] + sx * 0.82, 0.8, B[2] + z + 0.22)); }
    for (const z of [-4, -1.6, 0.8, 3.2]) R.add(cyl(0.035, bh, pole, B[0] - 0.2, 0, B[2] + z, 10));
    R.add(cyl(0.03, bl, pole, B[0], bh - 0.25, B[2], 8).rotateX(Math.PI / 2));
    for (let z = -5; z <= 5; z += 1) R.add(box(0.06, 0.2, 0.03, mat({ color: "#2a2f40" }), B[0], bh - 0.4, B[2] + z));
    R.add(box(0.5, 0.04, bl - 1, mat({ color: "#ffffff", emissive: new THREE.Color("#fff6e0"), emissiveIntensity: 0.8 }), B[0], bh - 0.04, B[2]));
    this.city = tiled(cityTex(), 1, 1);
    const cityM = new THREE.MeshBasicMaterial({ map: this.city });
    for (const sx of [-1, 1]) { const strip = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), cityM); strip.position.set(B[0] + sx * 3.5, 1.8, B[2]); strip.rotation.y = -sx * Math.PI / 2; strip.layers.set(NOINK); R.add(strip); }
    R.add(panel(godzyTex("#f3c84a", "#1a1418"), 1.3, 0.42, bx1 - 0.06, 2.05, B[2] - 1.6, -Math.PI / 2, "#f3c84a"));
    void bx0;

    // ================= Longxi, après le séisme =================
    const L = LONGXI;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), mat({ map: tiled(loessTex(), 30, 30) })); ground.position.set(L[0], 0, L[2] - 20); ground.receiveShadow = true; R.add(ground);
    const hill = (x: number, z: number, r: number, hh: number, c: string) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: c })); m.scale.y = hh / r; m.position.set(x, 0, z); return m; };
    for (const [dx, dz, r, hh, c] of [[-22, -30, 16, 12, "#c99a5a"], [6, -36, 20, 16, "#b98a4a"], [30, -28, 14, 10, "#d4a868"], [-40, -14, 12, 8, "#8fae5a"], [24, -10, 9, 6, "#9cbb62"], [-8, -48, 26, 22, "#a8b8d0"]] as const) R.add(hill(L[0] + dx, L[2] + dz, r, hh, c));
    const mud = mat({ map: mudTex() }), roofG = mat({ map: tiled(roofTileTex("roofGrey", "#7a7f8f"), 4, 1) });
    const house = (x: number, z: number, w: number, d: number, tilt: number, fallen: boolean) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = tilt;
      g.add(box(w, 1.9, d, mud, 0, 0.95, 0));
      g.add(box(0.7, 1.3, 0.05, mat({ color: "#5a3a22" }), 0, 0.65, d / 2 + 0.01));
      const r = roof(w - 1.4, d, 1.9, roofG, mat({ color: "#4a4f5f" }));
      if (fallen) { r.rotation.set(0.25, 0, 0.35); r.position.set(0.4, -1.1, 0.4); }
      g.add(r); return g;
    };
    for (const [dx, dz, w, d, tl, f] of [[-5.5, -3.5, 3.4, 2.6, 0.04, false], [-1.0, -4.8, 3.0, 2.4, -0.07, true], [3.6, -3.4, 3.4, 2.6, 0.0, false], [7.5, -6.2, 3.0, 2.4, 0.09, false], [-8.6, -7.5, 3.0, 2.4, -0.05, true]] as const) {
      const hs = house(L[0] + dx, L[2] + dz, w, d, tl, f); this.houses.push(hs); R.add(hs);
    }
    // la route vers l'est (Luoyang), et le panneau
    const road = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 60).rotateX(-Math.PI / 2), mat({ color: "#c9a06a" })); road.position.set(L[0] + 2, 0.006, L[2] + 20); road.rotation.y = 0; R.add(road);
    R.add(cyl(0.07, 2.2, mat({ color: "#7a4f2a" }), L[0] + 3.6, 0, L[2] + 4.4, 8), panel(signTex("LONGXI", "#2f6fd0"), 1.5, 0.5, L[0] + 3.6, 2.0, L[2] + 4.46, 0, "#2f6fd0"));
    for (const [dx, dz] of [[-12, 2], [11, 0], [-14, -10], [14, -12]] as const) { R.add(cyl(0.15, 1.4, trunk, L[0] + dx, 0, L[2] + dz, 8)); const c = ball(1.1, leaf, L[0] + dx, 2.2, L[2] + dz); c.scale.set(1, 0.85, 1); R.add(c); }

    // ================= le musée =================
    const M = MUSEUM;
    const mfloor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12).rotateX(-Math.PI / 2), mat({ map: tiled(stoneTex("museumFloor", "#d9b88a", "#cfa978"), 7, 6) })); mfloor.position.set(M[0], 0, M[2]); mfloor.receiveShadow = true; R.add(mfloor);
    const mwall = mat({ color: "#eaf2f6" }), mtrim = mat({ color: "#2f6fd0" });
    R.add(box(14, 4.5, 0.2, mwall, M[0], 2.25, M[2] - 5), box(0.2, 4.5, 12, mwall, M[0] - 7, 2.25, M[2]), box(0.2, 4.5, 12, mwall, M[0] + 7, 2.25, M[2]), box(14, 0.12, 0.25, mtrim, M[0], 0.06, M[2] - 4.9));
    const mceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 12).rotateX(Math.PI / 2), mat({ color: "#ffffff" })); mceil.position.set(M[0], 4.5, M[2]); R.add(mceil);
    R.add(box(1.5, 0.9, 1.5, mat({ color: "#2a2f40" }), M[0], 0.45, M[2] - 0.5));
    this.replica = new Jar(0.55); this.replica.root.position.set(M[0], 0.9, M[2] - 0.5); R.add(this.replica.root);
    this.replica.update(0, { land: [null, null, null, null, null, null, null, null], shake: 0, xray: 0, colTilt: 0, colDir: 0 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.45, 1.45), new THREE.MeshStandardMaterial({ color: "#cfefff", transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false }));
    glass.position.set(M[0], 0.9 + 0.725, M[2] - 0.5); glass.layers.set(NOINK); R.add(glass);
    for (const [dx, dz] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]] as const) R.add(box(0.03, 1.45, 0.03, mat({ color: "#c9ccd2" }), M[0] + dx, 0.9 + 0.725, M[2] - 0.5 + dz));
    R.add(box(1.48, 0.03, 1.48, mat({ color: "#c9ccd2" }), M[0], 2.35, M[2] - 0.5));
    R.add(panel(labelTex(), 0.7, 0.3, M[0], 0.62, M[2] + 0.26, 0, "#fffdf6"));
    R.add(panel(posterTex(), 1.4, 1.96, M[0] - 3.2, 2.2, M[2] - 4.88), panel(godzyTex("#2f6fd0", "#fff6e0"), 1.5, 0.55, M[0] + 3.0, 2.8, M[2] - 4.88, 0, "#2f6fd0"));
    for (const dx of [-5, 5]) R.add(box(0.06, 2.0, 1.2, mat({ color: "#7a4f2a" }), M[0] + dx, 2.0, M[2] - 4.85));
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(1.5, 1.4, 1.1), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    spot.position.set(M[0], 4.2, M[2] - 0.5); spot.scale.setScalar(1.4); spot.layers.set(NOINK); R.add(spot);
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // le soleil (et son ombre) suit le lieu
    const tgt = s.loc === "hall" ? [0, 0, -2] : s.loc === "court" ? [0, 0, 13] : s.loc === "bus" ? BUS : s.loc === "longxi" ? LONGXI : MUSEUM;
    this.sun.target.position.set(tgt[0], tgt[1], tgt[2]); this.sun.position.set(tgt[0] - 9, 14, tgt[2] + 6);
    // l'orage de la cour : ciel et lumière assombris
    const storm = s.loc === "court" && t < W[40];
    this.hemi.intensity = storm ? 0.85 : 1.5; this.sun.intensity = storm ? 0.5 : s.loc === "hall" ? 1.2 : 1.8;
    if (HDR) HDR.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = HDR; scene.background = HDR; scene.backgroundIntensity = storm ? 0.45 : 1.3; scene.environmentIntensity = 0.25;
    scene.fog = null;
    // les personnages (cartes) : éclairage deux tons du style
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK.day.bounce); TONE.uSat.value = 1.15;
    CHAR.uCharTint.value.set(1.0, 0.97, 0.94); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- la jarre ----
    const cut = t > WHIPS[3] && t < WHIPS[4];
    const quake = t > T.quake[0] && t < T.quake[1] ? 0.012 * Math.min(1, (t - T.quake[0]) / 0.2, (T.quake[1] - t) / 0.3) : 0;
    this.jar.update(t, {
      land: [t > T.quake[0] - 0.5 && t < WHIPS[2] ? T.dropS : null, null, null, null, null, null, cut ? T.push + 0.36 : t > WHIPS[4] ? T.dropW : null, null],
      shake: quake,
      xray: cut ? clamp01((t - WHIPS[3]) / 0.5) : 0,
      colTilt: cut ? 0.2 * clamp01((t - T.tilt) / 0.45) : 0, colDir: 270,
    });
    // le bus roule, puis freine
    const brake = T.brake, v = (tt: number) => (tt < brake ? 9 : Math.max(0, 9 * (1 - (tt - brake) / 0.8)));
    const dist = t < brake ? 9 * t : 9 * brake + (9 * Math.min(0.8, t - brake)) / 2 + 0 * v(t);
    this.city.offset.x = -(dist / 60) % 1;
    // la tasse de thé : immobile (la surface ne frémit pas). Les maisons de Longxi tremblent
    this.tea.position.y = 0.758;
    const sh3 = t > T.shake3[0] && t < T.shake3[1] ? 0.03 : 0;
    this.houses.forEach((hs, k) => { hs.position.x = LONGXI[0] + [-5.5, -1.0, 3.6, 7.5, -8.6][k] + sh3 * Math.sin(t * 40 + k); });
    // ---- distribution ----
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const st: Stage = stage(id, t, { pos: cam.position, right, sun: this.sun.position.clone().sub(this.sun.target.position).normalize() });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0; const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++), [w, hh, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, hh, k, p.draw); a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2); a.mesh.castShadow = true;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0; const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw); e.use(!!p.soft); e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0); else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1); fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return new THREE.Vector3(...c.look);
  }
}
