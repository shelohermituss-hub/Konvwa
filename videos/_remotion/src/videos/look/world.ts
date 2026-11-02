// Test du nouveau rendu, calé sur les références (chaîne ricksclips) : de la 3D « dessin animé » et non réaliste.
// Couleurs franches et saturées, lumière claire et égale, TOUT cerné d'encre noire (objets compris), murs pleins de
// choses dessinées (affiche, calendrier, horloge, cadres) avec du texte lisible dans le décor.
// Les objets Sketchfab (CC BY, voir public/assets/sketchfab/CREDITS.md) gardent leur forme et leur dessin, mais
// perdent leurs matières réalistes (reflets, rugosité, métal) : peinture mate, comme le reste.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { staticFile } from "remotion";
import { Kit } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage } from "./cast";
import { FPS, SHOTS, camAt, ROOM, STORE } from "./story";

const MODELS = ["filing-cabinet", "bookshelf", "flowerpot", "desk-lamp", "ceiling-fan", "cages", "barrel"];
/** police des affiches du décor */
export const POSTER_FONT = "Anton Konvwa";
let HDR: THREE.DataTexture | null = null;
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const gl = new GLTFLoader();
    const font = new FontFace(POSTER_FONT, `url(${staticFile("fonts/anton.woff2")})`).load()
      .then((ff) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(ff); return ["_font", new THREE.Group()] as const; });
    kitP = Promise.all([
      ...MODELS.map((n) => gl.loadAsync(staticFile(`assets/sketchfab/${n}.glb`)).then((g) => [n, g.scene] as const)),
      new RGBELoader().loadAsync(staticFile("assets/polyhaven/hdri/kloofendal_48d_partly_cloudy_puresky.hdr")).then((t) => { HDR = t; return ["_hdr", new THREE.Group()] as const; }),
      font,
    ]).then((l) => Object.fromEntries(l) as Kit);
  }
  return kitP;
};

// ---------------- outils ----------------
/** les objets d'un pack (premier niveau qui a plusieurs enfants) */
const items = (o: THREE.Object3D) => { let n = o; while (n.children.length === 1) n = n.children[0]; return n.children.length ? n.children : [o]; };
/** matières « peinture mate » : on garde le dessin (map) et la couleur, on retire reflets, rugosité, relief et métal */
const toon = (o: THREE.Object3D, lift = 1.12) => {
  o.traverse((m) => {
    const me = m as THREE.Mesh; if (!me.isMesh) return;
    const old = (Array.isArray(me.material) ? me.material[0] : me.material) as THREE.MeshStandardMaterial;
    me.material = new THREE.MeshStandardMaterial({ map: old.map ?? null, color: (old.color ?? new THREE.Color(1, 1, 1)).clone().multiplyScalar(lift), roughness: 1, metalness: 0, transparent: old.transparent, alphaTest: old.alphaTest });
    me.castShadow = true; me.receiveShadow = true;
  });
  return o;
};
/** copie d'un objet, mise à l'échelle (hauteur h, ou largeur w), posée au sol en (x, y, z), tournée de yaw */
const place = (src: THREE.Object3D, o: { h?: number; w?: number }, x: number, y: number, z: number, yaw = 0) => {
  const c = src.clone(true), g = new THREE.Group();
  const b = new THREE.Box3().setFromObject(c), size = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
  const s = o.h ? o.h / Math.max(1e-4, size.y) : (o.w ?? 1) / Math.max(1e-4, Math.max(size.x, size.z));
  c.position.set(-ctr.x, -b.min.y, -ctr.z);
  const inner = new THREE.Group(); inner.add(c); inner.scale.setScalar(s);
  g.add(inner); g.position.set(x, y, z); g.rotation.y = yaw;
  return toon(g);
};
const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });
const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
};
const cyl = (r: number, h: number, m: THREE.Material, x: number, y: number, z: number, n = 24) => {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, n), m); me.position.set(x, y + h / 2, z); me.castShadow = true; me.receiveShadow = true; return me;
};
/** un tableau dessiné (affiche, calendrier…) : un cadre en relief, cerné par l'encre, et une toile dessinée */
const picture = (tex: THREE.Texture, w: number, h: number, frame: string | null, x: number, y: number, z: number, yaw = 0) => {
  const g = new THREE.Group();
  if (frame) g.add(box(w + 0.08, h + 0.08, 0.04, mat({ color: frame }), 0, 0, 0));
  else g.add(box(w, h, 0.006, mat({ color: "#fbf0d4" }), 0, 0, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: tex })); face.position.z = frame ? 0.022 : 0.005; face.receiveShadow = true; g.add(face);
  g.position.set(x, y, z); g.rotation.y = yaw; return g;
};

// ---------------- textures dessinées (couleurs pleines, traits d'encre) ----------------
const INK = "#1a1418";
const wallTex = () => ctex("wallR", 256, 256, (g, r) => {
  g.fillStyle = "#f4c445"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(214,150,40,${0.05 + r() * 0.06})`; const x = r() * 256, y = r() * 256; g.beginPath(); g.ellipse(x, y, 14 + r() * 30, 8 + r() * 18, r() * 3, 0, 7); g.fill(); }
});
const boardTex = () => ctex("boardR", 256, 256, (g) => {
  g.fillStyle = "#2f9d7e"; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 4, 0, 6, 256); g.fillStyle = INK; g.fillRect(x, 0, 3, 256); }
});
const tileTex = () => ctex("tileR", 512, 512, (g) => {
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) {
    const a = ((x + y) / 128) % 2 === 0; g.fillStyle = a ? "#f6ead2" : "#d8513a"; g.fillRect(x, y, 128, 128);
    if (!a) { g.fillStyle = "#f2b13c"; g.beginPath(); g.moveTo(x + 64, y + 30); g.lineTo(x + 98, y + 64); g.lineTo(x + 64, y + 98); g.lineTo(x + 30, y + 64); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }
  }
  g.strokeStyle = INK; g.lineWidth = 4; for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
});
const ceilTex = () => ctex("ceilR", 256, 256, (g) => {
  g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(60,50,40,0.55)"; g.lineWidth = 4; g.strokeRect(2, 2, 252, 252);
});
const brickTex = () => ctex("brickR", 512, 512, (g, r) => {
  g.fillStyle = "#f1dcc0"; g.fillRect(0, 0, 512, 512);
  for (let y = 0, row = 0; y < 512; y += 42, row++) for (let x = -(row % 2) * 64; x < 512; x += 128) {
    const v = 0.9 + r() * 0.18; g.fillStyle = `rgb(${Math.round(206 * v)},${Math.round(92 * v)},${Math.round(64 * v)})`;
    g.fillRect(x + 5, y + 5, 118, 32); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, 118, 32);
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x + 10, y + 9, 60, 5);
  }
});
const woodTex = (key: string, base: string, line: string) => ctex(key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line; g.lineWidth = 2;
  for (let k = 0; k < 14; k++) { const y = 8 + k * 18 + r() * 6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + k) * 3); g.stroke(); }
});
/** l'affiche de la prime, en français, lisible (texte du décor comme dans les références) */
const posterTex = () => ctex("posterR", 512, 720, (g) => {
  g.fillStyle = "#fbf0d4"; g.fillRect(0, 0, 512, 720);
  g.fillStyle = "#d8352f"; g.fillRect(0, 0, 512, 150);
  g.fillStyle = "#fff6e0"; g.font = `120px "${POSTER_FONT}"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("AVIS", 256, 80);
  // un rat dessiné
  g.lineWidth = 8; g.strokeStyle = INK; g.fillStyle = "#9a9aa6";
  g.beginPath(); g.ellipse(250, 300, 120, 62, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(372, 270, 52, 40, -0.3, 0, 7); g.fill(); g.stroke();
  g.fillStyle = "#f2a7b0"; g.beginPath(); g.arc(352, 228, 22, 0, 7); g.fill(); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(392, 262, 7, 0, 7); g.fill();
  g.strokeStyle = "#e48a96"; g.lineWidth = 12; g.beginPath(); g.moveTo(135, 310); g.bezierCurveTo(60, 330, 70, 420, 150, 410); g.stroke();
  g.fillStyle = INK; g.font = `150px "${POSTER_FONT}"`; g.fillText("1 CENT", 256, 500);
  g.font = `56px "${POSTER_FONT}"`; g.fillText("PAR QUEUE DE RAT", 256, 600);
  g.fillStyle = "#d8352f"; g.font = `40px "${POSTER_FONT}"`; g.fillText("HANOÏ — 1902", 256, 670);
  g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(5, 5, 502, 710);
});
const calTex = () => ctex("calR", 300, 400, (g) => {
  g.fillStyle = "#fffdf6"; g.fillRect(0, 0, 300, 400);
  g.fillStyle = "#2f6fd0"; g.fillRect(0, 0, 300, 110);
  g.fillStyle = "#fff"; g.font = `78px "${POSTER_FONT}"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("1902", 150, 60);
  g.fillStyle = INK; g.font = `36px "${POSTER_FONT}"`; g.fillText("JUIN", 150, 145);
  g.font = "bold 22px sans-serif";
  for (let d = 0; d < 30; d++) { const c = d % 7, rr = Math.floor(d / 7); g.fillStyle = d === 11 ? "#d8352f" : INK; g.fillText(String(d + 1), 35 + c * 38, 195 + rr * 44); }
  g.strokeStyle = "#d8352f"; g.lineWidth = 4; g.beginPath(); g.arc(35 + 4 * 38, 195 + 44, 19, 0, 7); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(4, 4, 292, 392);
});
const clockTex = () => ctex("clockR", 400, 400, (g) => {
  g.fillStyle = "#d8352f"; g.beginPath(); g.arc(200, 200, 196, 0, 7); g.fill();
  g.fillStyle = "#fffdf6"; g.beginPath(); g.arc(200, 200, 160, 0, 7); g.fill();
  g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(200, 200, 194, 0, 7); g.stroke(); g.beginPath(); g.arc(200, 200, 160, 0, 7); g.stroke();
  g.fillStyle = INK; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  for (let k = 1; k <= 12; k++) { const a = (k / 12) * Math.PI * 2; g.fillText(String(k), 200 + Math.sin(a) * 125, 200 - Math.cos(a) * 125); }
  g.lineCap = "round"; g.lineWidth = 12; g.beginPath(); g.moveTo(200, 200); g.lineTo(200 - 60, 200 - 20); g.stroke();
  g.lineWidth = 8; g.beginPath(); g.moveTo(200, 200); g.lineTo(200 + 20, 200 - 110); g.stroke();
  g.beginPath(); g.arc(200, 200, 12, 0, 7); g.fill();
});
const mapTex = () => ctex("mapR", 420, 320, (g) => {
  g.fillStyle = "#cfe8f0"; g.fillRect(0, 0, 420, 320);
  g.fillStyle = "#9fd17a"; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.moveTo(120, 20); g.bezierCurveTo(260, 10, 330, 70, 250, 120); g.bezierCurveTo(330, 170, 300, 240, 240, 300); g.bezierCurveTo(200, 250, 230, 190, 180, 150); g.bezierCurveTo(90, 120, 60, 60, 120, 20); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#d8352f"; g.beginPath(); g.arc(205, 70, 10, 0, 7); g.fill(); g.stroke();
  g.fillStyle = INK; g.font = `34px "${POSTER_FONT}"`; g.textAlign = "center"; g.fillText("INDOCHINE", 210, 300);
});
/** signature du client dans le décor : le nom seul */
const godzyTex = (bg: string, fg: string) => ctex(`godzy${bg}`, 400, 160, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 400, 160);
  g.fillStyle = fg; g.font = `110px "${POSTER_FONT}"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("GODZY", 200, 86);
  g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(5, 5, 390, 150);
});
const ledgerTex = () => ctex("ledgerR", 400, 280, (g) => {
  g.fillStyle = "#fffaf0"; g.fillRect(0, 0, 400, 280);
  g.strokeStyle = "#8fb3e0"; g.lineWidth = 2; for (let y = 30; y < 280; y += 22) { g.beginPath(); g.moveTo(14, y); g.lineTo(386, y); g.stroke(); }
  g.strokeStyle = "#d8352f"; g.beginPath(); g.moveTo(200, 0); g.lineTo(200, 280); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 3; for (let y = 30; y < 250; y += 22) { g.beginPath(); g.moveTo(24, y - 4); g.lineTo(60 + ((y * 7) % 90), y - 4); g.moveTo(214, y - 4); g.lineTo(240 + ((y * 13) % 120), y - 4); g.stroke(); }
});
const crateTex = () => ctex("crateR", 256, 256, (g) => {
  g.fillStyle = "#d9a35a"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = INK; g.lineWidth = 6; for (const y of [4, 86, 170, 252]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.lineWidth = 8; g.strokeRect(4, 4, 248, 248); g.beginPath(); g.moveTo(10, 10); g.lineTo(246, 246); g.stroke();
});
const shaftTex = () => ctex("shaftLook", 64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); });
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
  private fan: THREE.Object3D;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, K = (n: string) => kit[n];
    // ---- lumière claire et égale (références) : grand ciel doux, soleil modéré par la fenêtre, une lampe chaude ----
    this.hemi = new THREE.HemisphereLight("#fff6e6", "#b89a74", 1.55);
    this.sun = new THREE.DirectionalLight("#fff0d6", 1.7);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.radius = 4;
    const sc = this.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.sun.position.set(-9, 13, -14); this.sun.target.position.set(1, 0, 1);
    const fill = new THREE.DirectionalLight("#e8f0ff", 0.6); fill.position.set(3, 4, 8);
    R.add(this.hemi, this.sun, this.sun.target, fill);
    const lamp = new THREE.PointLight("#ffc27a", 3, 4, 1.6); lamp.position.set(-1.05, 1.5, 0.05); R.add(lamp);
    const storeLamp = new THREE.PointLight("#ffd29a", 14, 12, 1.4); storeLamp.position.set(8.4, 3.0, -0.6); R.add(storeLamp);

    // ---- le bureau : carreaux, murs jaunes coloniaux, lambris vert, plafond blanc à poutres ----
    const { x0, x1, z0, z1, h } = ROOM;
    const floorT = tileTex().clone(); floorT.repeat.set(10, 5); floorT.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 7, z1 - z0).rotateX(-Math.PI / 2), mat({ map: floorT }));
    floor.position.set((x0 + x1 + 6) / 2, 0, (z0 + z1) / 2); floor.receiveShadow = true; R.add(floor);
    const wall = mat({ map: wallTex() }), board = mat({ map: boardTex() }), wood = mat({ map: woodTex("woodR", "#a35a2c", "rgba(60,25,10,0.5)") });
    const beam = mat({ color: "#8a4f2a" }), white = mat({ color: "#fbf6ea" });
    // mur du fond avec une grande fenêtre à volets verts (x -3.6..-1.8, y 1.2..3.3)
    const wx0 = -3.6, wx1 = -1.8, wy0 = 1.2, wy1 = 3.3;
    R.add(box(wx0 - x0, h, 0.2, wall, (x0 + wx0) / 2, h / 2, z0), box(x1 - wx1, h, 0.2, wall, (wx1 + x1) / 2, h / 2, z0));
    R.add(box(wx1 - wx0, wy0, 0.2, wall, (wx0 + wx1) / 2, wy0 / 2, z0), box(wx1 - wx0, h - wy1, 0.2, wall, (wx0 + wx1) / 2, (h + wy1) / 2, z0));
    for (const sx of [wx0 - 0.48, wx1 + 0.48]) R.add(box(0.8, wy1 - wy0, 0.06, board, sx, (wy0 + wy1) / 2, z0 + 0.14));
    R.add(box(wx1 - wx0 + 0.3, 0.12, 0.3, white, (wx0 + wx1) / 2, wy0, z0 + 0.1), box(0.08, wy1 - wy0, 0.08, white, (wx0 + wx1) / 2, (wy0 + wy1) / 2, z0), box(wx1 - wx0, 0.08, 0.08, white, (wx0 + wx1) / 2, 2.3, z0));
    // murs de côté (porte de la réserve à droite, z -2.4..-0.6)
    R.add(box(0.2, h, z1 - z0, wall, x0, h / 2, (z0 + z1) / 2));
    R.add(box(0.2, h, -2.4 - z0, wall, x1, h / 2, (z0 - 2.4) / 2), box(0.2, h, z1 + 0.6, wall, x1, h / 2, (z1 - 0.6) / 2), box(0.2, h - 2.7, 1.8, wall, x1, (h + 2.7) / 2, -1.5));
    R.add(box(0.26, 0.14, 2.1, white, x1 - 0.05, 2.75, -1.5), box(0.26, 2.7, 0.12, white, x1 - 0.05, 1.35, -2.46), box(0.26, 2.7, 0.12, white, x1 - 0.05, 1.35, -0.54));
    // lambris vert et sa cimaise
    for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 + 0.12, x1 - x0, 0.06], [x0 + 0.12, 0, 0.06, z1 - z0], [x1 - 0.12, 0.5 * (z1 - 0.6), 0.06, z1 + 0.6], [x1 - 0.12, (z0 - 2.4) / 2, 0.06, -2.4 - z0]] as const) R.add(box(w, 1.1, d, board, x, 0.55, z));
    for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 + 0.16, x1 - x0, 0.1], [x0 + 0.16, 0, 0.1, z1 - z0]] as const) R.add(box(w, 0.07, d, white, x, 1.13, z));
    const cT = ceilTex().clone(); cT.repeat.set((x1 - x0) / 0.8, (z1 - z0) / 0.8); cT.needsUpdate = true;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), mat({ map: cT })); ceil.position.set(0, h, 0); R.add(ceil);
    for (let x = x0 + 1; x < x1; x += 2) R.add(box(0.2, 0.22, z1 - z0, beam, x, h - 0.11, 0));
    // ---- la réserve : briques claires, plafond de planches ----
    const brick = mat({ map: brickTex() });
    R.add(box(STORE.x1 - STORE.x0, h, 0.2, brick, (STORE.x0 + STORE.x1) / 2, h / 2, STORE.z0));
    R.add(box(0.2, h, STORE.z1 - STORE.z0, brick, STORE.x1, h / 2, (STORE.z0 + STORE.z1) / 2));
    R.add(box(STORE.x1 - STORE.x0, h, 0.2, brick, (STORE.x0 + STORE.x1) / 2, h / 2, STORE.z1));
    const sceil = new THREE.Mesh(new THREE.PlaneGeometry(STORE.x1 - STORE.x0, STORE.z1 - STORE.z0).rotateX(Math.PI / 2), mat({ map: woodTex("plankR", "#b9844e", "rgba(60,30,10,0.6)") }));
    sceil.position.set((STORE.x0 + STORE.x1) / 2, h, (STORE.z0 + STORE.z1) / 2); R.add(sceil);

    // ---- le comptoir du guichet : bois chaud, panneaux, dessus ciré, grille de guichet en laiton ----
    const cw = mat({ map: woodTex("ctrR", "#b8662f", "rgba(70,30,10,0.45)") }), ctop = mat({ color: "#7a3e22" }), panel = mat({ color: "#cf7a3c" });
    const brass = mat({ color: "#e8b84a" });
    R.add(box(3.4, 1.02, 0.7, cw, -0.2, 0.51, 0), box(3.56, 0.07, 0.86, ctop, -0.2, 1.055, 0));
    for (let k = 0; k < 4; k++) R.add(box(0.66, 0.6, 0.04, panel, -1.47 + k * 0.85, 0.52, 0.37));
    for (let k = 0; k < 7; k++) R.add(box(0.03, 0.7, 0.03, brass, -0.95 + k * 0.12, 1.44, -0.05));
    R.add(box(0.85, 0.05, 0.06, brass, -0.59, 1.8, -0.05));
    // sur le comptoir : registre ouvert, encrier, tampon, piles de pièces, une caisse
    R.add(box(0.5, 0.04, 0.34, mat({ color: "#2f5fae" }), -0.15, 1.11, -0.05));
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3).rotateX(-Math.PI / 2), mat({ map: ledgerTex() })); page.position.set(-0.15, 1.132, -0.05); R.add(page);
    R.add(cyl(0.045, 0.08, mat({ color: "#22283a" }), -0.55, 1.09, 0.05), cyl(0.03, 0.025, mat({ color: "#d8352f" }), -0.55, 1.17, 0.05));
    R.add(cyl(0.04, 0.05, mat({ color: "#7a3e22" }), 0.25, 1.09, 0.12), cyl(0.012, 0.1, mat({ color: "#7a3e22" }), 0.25, 1.14, 0.12), cyl(0.03, 0.03, mat({ color: "#d8352f" }), 0.25, 1.24, 0.12));
    for (const [x, z, n] of [[0.95, 0.05, 6], [1.05, -0.08, 4], [0.9, -0.12, 3]] as const) for (let k = 0; k < n; k++) R.add(cyl(0.035, 0.012, brass, x, 1.09 + k * 0.013, z, 16));
    R.add(box(0.36, 0.16, 0.26, mat({ map: crateTex() }), 1.2, 1.17, -0.15));
    // ---- les murs racontent : affiche de la prime, calendrier, horloge, carte, signature ----
    R.add(picture(posterTex(), 0.72, 1.01, null, 0.95, 2.25, z0 + 0.11));
    R.add(picture(calTex(), 0.38, 0.5, null, -0.45, 2.0, z0 + 0.11));
    R.add(picture(clockTex(), 0.55, 0.55, null, 0.25, 3.25, z0 + 0.11));
    R.add(picture(mapTex(), 0.78, 0.6, "#7a3e22", -4.88, 2.3, 0.8, Math.PI / 2));
    R.add(picture(godzyTex("#2f6fd0", "#fff6e0"), 0.6, 0.24, "#7a3e22", -1.0, 2.75, z0 + 0.11));
    // ---- objets 3D (peinture mate) ----
    R.add(place(K("filing-cabinet"), { h: 1.6 }, -4.3, 0, -3.4));
    R.add(place(K("bookshelf"), { h: 2.4 }, 2.9, 0, -3.62));
    const pots = items(K("flowerpot"));
    R.add(place(pots[0], { h: 1.3 }, -4.3, 0, 2.6), place(pots[0], { h: 1.1 }, 4.4, 0, 2.8), place(pots[0], { h: 1.0 }, -2.7, 0, -3.5));
    R.add(place(K("desk-lamp"), { h: 0.48 }, -1.05, 1.08, 0.05, 0.6));
    this.fan = place(K("ceiling-fan"), { w: 1.5 }, 0.2, h - 0.75, 0.4); R.add(this.fan);
    // une porte à panneaux au fond
    const dw = mat({ color: "#3f7fc4" }), dp = mat({ color: "#5a97d6" });
    R.add(box(1.1, 2.3, 0.08, dw, 4.0, 1.15, -3.86), box(1.3, 0.12, 0.12, white, 4.0, 2.36, -3.84));
    for (const [y, hh] of [[0.55, 0.7], [1.55, 0.95]] as const) for (const dx of [-0.24, 0.24]) R.add(box(0.36, hh, 0.04, dp, 4.0 + dx, y, -3.8));
    R.add(cyl(0.04, 0.03, brass, 3.62, 1.08, -3.8));
    // ---- la réserve : cages sur une étagère, tonneaux, caisses (une signée) ----
    const cage = new THREE.Group(); for (const o of items(K("cages")).slice(0, 4)) cage.add(o.clone(true));
    for (const y of [0, 0.87]) for (const x of [7.4, 8.6, 9.8]) R.add(place(cage, { h: 0.75 }, x, y + 0.02, -3.1));
    R.add(box(3.9, 0.08, 1.5, wood, 8.6, 0.85, -3.1));
    for (const [x, z] of [[10.3, -1.0], [10.4, 0.1], [6.0, -3.3]] as const) R.add(place(K("barrel"), { h: 0.95 }, x, 0, z));
    const crate = mat({ map: crateTex() });
    R.add(box(0.7, 0.6, 0.6, crate, 10.4, 0.3, 1.3), box(0.55, 0.45, 0.5, crate, 10.3, 0.82, 1.25));
    R.add(picture(godzyTex("#f2b13c", "#1a1418"), 0.5, 0.2, null, 10.04, 0.32, 1.3, -Math.PI / 2));

    // ---- rayons de soleil (fenêtre) et halo de la lampe ----
    const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex(), color: new THREE.Color(1.4, 1.2, 0.9), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let k = 0; k < 3; k++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4.5), shaftM); sh.position.set(-3.0 + k * 0.4, 1.7, -2.9 + 0.15 * k); sh.rotation.set(-0.9, 0.3, -0.2);
      sh.layers.set(NOINK); sh.renderOrder = 5; R.add(sh);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(1.6, 1.1, 0.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.set(-1.05, 1.5, 0.05); halo.scale.setScalar(0.5); halo.layers.set(NOINK); R.add(halo);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 1.2) })); bulb.position.copy(storeLamp.position); R.add(bulb);
    R.add(cyl(0.008, 1.1, mat({ color: INK }), 8.4, 3.1, -0.6, 6));
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // le ciel par la fenêtre ; un soupçon d'ambiance HDRI pour les objets
    if (HDR) HDR.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = HDR; scene.background = HDR; scene.backgroundIntensity = 1.3; scene.environmentIntensity = 0.25;
    scene.fog = null;
    // les personnages (cartes) gardent l'éclairage deux tons du style
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK.day.bounce); TONE.uSat.value = 1.15;
    CHAR.uCharTint.value.set(1.0, 0.97, 0.94); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    this.fan.rotation.y = t * 5.5;
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
