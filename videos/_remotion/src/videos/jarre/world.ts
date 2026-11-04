// La jarre de Zhang Heng : les décors, dans le nouveau rendu calé sur les références (3D « dessin animé » : couleurs franches,
// peinture mate, tout cerné d'encre, lumière claire et égale, texte lisible dans le décor). Cinq lieux, loin les uns des autres :
// la salle du trône (Luoyang) et sa cour, le bus d'aujourd'hui, le village de Longxi après le séisme, le musée.
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getInputProps, staticFile } from "remotion";
import { Kit } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage } from "./cast";
import { Jar } from "./jar";
import { FPS, SHOTS, camAt, HALL, COURT, JAR, THRONE, MAPT, TEA, BUS, LONGXI, MUSEUM, T, WHIPS, clamp01, riderAt, RIDER_X } from "./story";
import { W } from "./words";

/** police des affiches du décor */
export const POSTER_FONT = "Anton Konvwa";
let HDR: THREE.DataTexture | null = null;
/** objets 3D de Sketchfab (CC BY, crédits : public/assets/sketchfab/CREDITS.md), optimisés en GLB (meshopt, WebP 1024) */
const MODELS = ["lanterne", "vase", "vase-dragon", "encensoir", "fauteuil", "cheval", "charrette", "foin", "maison-chine", "cour-chine",
  "temple", "pots", "rochers", "arbres", "bambou", "socles"];
/** matières réalistes de Poly Haven (CC0) : couleur, relief (normales), rugosité */
const TEXS = ["large_floor_tiles_02", "red_plaster_weathered", "lacquered_cherry_wood", "granite_tile_04", "clay_roof_tiles_02", "grey_roof_tiles", "dry_ground_01",
  "clay_plaster", "brown_mud_dry", "herringbone_parquet", "white_plaster_02", "rubber_tiles", "wood_table"];
const TX: Record<string, THREE.Texture> = {};
let ANIM: THREE.AnimationClip[] = [];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const font = new FontFace(POSTER_FONT, `url(${staticFile("fonts/anton.woff2")})`).load()
      .then((ff) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(ff); return ["_font", new THREE.Group()] as const; });
    const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), tl = new THREE.TextureLoader();
    kitP = Promise.all([
      ...MODELS.map((n) => gl.loadAsync(staticFile(`assets/sketchfab/${n}.glb`)).then((g) => { if (n === "cheval") ANIM = g.animations; return [n, g.scene] as const; })),
      ...TEXS.flatMap((id) => (["diff", "nor", "rough"] as const).map((k) => tl.loadAsync(staticFile(`assets/polyhaven/tex/${id}_${k}.jpg`)).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping; if (k === "diff") t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TX[`${id}_${k}`] = t; return [`_${id}_${k}`, new THREE.Group()] as const;
      }))),
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
/** matière réaliste Poly Haven, répétée rx × ry fois, teintée */
const pbr = (id: string, rx: number, ry: number, tint = "#ffffff", nscale = 1) => {
  const c = (k: string) => { const t = TX[`${id}_${k}`].clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  return new THREE.MeshStandardMaterial({ map: c("diff"), normalMap: c("nor"), normalScale: new THREE.Vector2(nscale, nscale), roughnessMap: c("rough"), color: tint, metalness: 0 });
};
const items = (o: THREE.Object3D) => { let n = o; while (n.children.length === 1) n = n.children[0]; return n.children.length ? n.children : [o]; };
/** copie d'un modèle, mise à l'échelle (hauteur h ou plus grande largeur w), posée au sol en (x, y, z), tournée de yaw */
const place = (src: THREE.Object3D, o: { h?: number; w?: number }, x: number, y: number, z: number, yaw = 0, lift = 1) => {
  const c = src.clone(true), g = new THREE.Group();
  const b = new THREE.Box3().setFromObject(c), size = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
  const k = o.h ? o.h / Math.max(1e-4, size.y) : (o.w ?? 1) / Math.max(1e-4, Math.max(size.x, size.z));
  c.position.set(-ctr.x, -b.min.y, -ctr.z);
  const inner = new THREE.Group(); inner.add(c); inner.scale.setScalar(k);
  g.add(inner); g.position.set(x, y, z); g.rotation.y = yaw;
  g.traverse((m) => { const me = m as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = true; const mm = me.material as THREE.MeshStandardMaterial; if (lift !== 1 && mm.color) { me.material = mm.clone(); (me.material as THREE.MeshStandardMaterial).color.multiplyScalar(lift); } } });
  return g;
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

/** orientation du modèle de cheval (il doit regarder vers -z, la salle) et vitesse de lecture de son animation */
const HORSE_YAW = Math.PI;
const GALLOP_SPEED = 1.0;
/** dans la longue animation du modèle (60 s : pas, trot, galop…) : le galop, et une pose debout pour l'arrivée (secondes) */
const GALLOP: [number, number] = [33.0, 35.0];
const STAND = 5;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight;
  private jar: Jar; private replica: Jar;
  private city: THREE.Texture; private tea: THREE.Mesh;
  private houses: THREE.Object3D[] = [];
  private fill: THREE.DirectionalLight; private hallLights: THREE.Group; private museumLights: THREE.Group; private busLights: THREE.Group;
  private horse!: THREE.Group; private mixer: THREE.AnimationMixer | null = null;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const K = (n: string) => kit[n];
    const R = this.root;
    // ---- lumière claire et égale ; le soleil suit la caméra d'un lieu à l'autre (ombres) ----
    this.hemi = new THREE.HemisphereLight("#fff6e6", "#b89a74", 1.5);
    this.sun = new THREE.DirectionalLight("#fff0d6", 1.8);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.radius = 3;
    const sc = this.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.fill = new THREE.DirectionalLight("#cfe0ff", 0.35); this.fill.position.set(3, 4, 8);
    R.add(this.hemi, this.sun, this.sun.target, this.fill);
    // ---- lumières de la salle : lanternes chaudes, un projecteur sur la jarre, un sur le trône ----
    this.hallLights = new THREE.Group(); R.add(this.hallLights);
    for (const [x, z] of [[-2.4, -5.5], [2.4, -5.5], [-2.4, -0.5], [2.4, -0.5], [-2.4, 3.0], [2.4, 3.0]] as const) {
      const pl = new THREE.PointLight("#ffa45a", 9, 9, 2); pl.position.set(x, 4.35, z); this.hallLights.add(pl);
    }
    const jarSpot = new THREE.SpotLight("#fff1d8", 160, 14, 0.42, 0.65, 1.6); jarSpot.position.set(1.2, 6.3, -0.8); jarSpot.target.position.set(JAR[0], 1.0, JAR[2]);
    jarSpot.castShadow = true; jarSpot.shadow.mapSize.set(2048, 2048); jarSpot.shadow.bias = -0.0003; jarSpot.shadow.radius = 4;
    const thrSpot = new THREE.SpotLight("#ffd6a0", 90, 12, 0.5, 0.8, 1.6); thrSpot.position.set(0, 6.2, -4.5); thrSpot.target.position.set(THRONE[0], 1.2, THRONE[2]);
    thrSpot.castShadow = true; thrSpot.shadow.mapSize.set(1024, 1024);
    this.hallLights.add(jarSpot, jarSpot.target, thrSpot, thrSpot.target);
    // ---- musée : projecteurs sur les vitrines et les socles ----
    this.museumLights = new THREE.Group(); R.add(this.museumLights);
    for (const [dx, dz, i, sh] of [[0, -0.5, 140, true], [-4.4, -3.2, 70, false], [4.4, -3.2, 70, false], [-5.6, 1.5, 60, false], [5.6, 1.5, 60, false]] as const) {
      const sp = new THREE.SpotLight("#fff4e4", i, 9, 0.38, 0.7, 1.6); sp.position.set(MUSEUM[0] + dx * 0.8, 4.3, MUSEUM[2] + dz + 1.2); sp.target.position.set(MUSEUM[0] + dx, 1.0, MUSEUM[2] + dz);
      if (sh) { sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.bias = -0.0003; }
      this.museumLights.add(sp, sp.target);
    }
    // ---- bus : rampes lumineuses du plafond ----
    this.busLights = new THREE.Group(); R.add(this.busLights);
    for (const z of [-4, 0, 4]) { const pl = new THREE.PointLight("#f4f8ff", 6, 6, 2); pl.position.set(BUS[0], 2.1, BUS[2] + z); this.busLights.add(pl); }

    // ================= la salle du trône =================
    const { x0, x1, z0, z1, h } = HALL;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), pbr("large_floor_tiles_02", (x1 - x0) / 3, (z1 - z0) / 3, "#f2e2c4"));
    floor.position.set(0, 0, (z0 + z1) / 2); floor.receiveShadow = true; R.add(floor);
    const lacq = pbr("red_plaster_weathered", 5, 2.2, "#ffb0a0"), red = pbr("lacquered_cherry_wood", 1, 3, "#ff5a48"), gold = mat({ color: "#e8b84a" }), dark = mat({ color: "#5a2a1e" });
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
    // lanternes de soie rouge suspendues (modèle 3D), et leur fil
    for (const [x, z] of [[-2.4, -5.5], [2.4, -5.5], [-2.4, -0.5], [2.4, -0.5], [-2.4, 3.0], [2.4, 3.0]] as const) R.add(place(K("lanterne"), { h: 1.0 }, x, 4.0, z, 0, 1.2), cyl(0.012, h - 5.0, mat({ color: INK }), x, 5.0, z, 6));
    // brûle-parfums de bronze de chaque côté de l'estrade, vases de porcelaine, jarres de bronze, fauteuils, pots
    for (const sx of [-1, 1]) {
      R.add(place(K("encensoir"), { h: 1.0 }, sx * 2.7, 0, -6.4));
      R.add(box(0.7, 0.8, 0.7, pbr("wood_table", 1, 1, "#8a4a30"), sx * 4.0, 0.4, -8.7), place(K("vase"), { h: 1.15 }, sx * 4.0, 0.8, -8.7, sx * 0.6));
      R.add(place(K("vase-dragon"), { h: 1.3 }, sx * 6.1, 0, -8.6), place(K("vase-dragon"), { h: 1.1 }, sx * 6.2, 0, 4.0));
      R.add(place(K("fauteuil"), { h: 1.15 }, sx * 6.3, 0, -1.0, -sx * Math.PI / 2), place(K("fauteuil"), { h: 1.15 }, sx * 6.3, 0, 1.4, -sx * Math.PI / 2));
      R.add(place(K("pots"), { w: 1.4 }, sx * 6.0, 0, -4.6, sx));
    }
    // la table à carte de l'empire
    R.add(box(2.5, 0.1, 1.6, pbr("wood_table", 1.2, 0.8, "#c08060"), MAPT[0], 0.87, MAPT[2]));
    R.add(place(K("fauteuil"), { h: 1.15 }, MAPT[0] - 1.7, 0, MAPT[2] - 0.2, Math.PI / 2), place(K("fauteuil"), { h: 1.15 }, MAPT[0] + 1.75, 0, MAPT[2] + 0.1, -Math.PI / 2));
    for (const [dx, dz] of [[-1.1, -0.65], [1.1, -0.65], [-1.1, 0.65], [1.1, 0.65]] as const) R.add(box(0.12, 0.82, 0.12, dark, MAPT[0] + dx, 0.41, MAPT[2] + dz));
    const map = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.44).rotateX(-Math.PI / 2), mat({ map: mapTex() })); map.position.set(MAPT[0], 0.925, MAPT[2]); map.receiveShadow = true; R.add(map);
    // la petite table à thé : théière et tasse (qui ne bougeront pas)
    R.add(box(0.9, 0.06, 0.6, pbr("wood_table", 0.5, 0.4, "#a06040"), TEA[0], 0.66, TEA[2]), place(K("fauteuil"), { h: 1.15 }, TEA[0] + 0.85, 0, TEA[2] - 0.1, -Math.PI / 2));
    for (const [dx, dz] of [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]] as const) R.add(box(0.06, 0.63, 0.06, dark, TEA[0] + dx, 0.315, TEA[2] + dz));
    const porc = mat({ color: "#f6f2e6" }), blue = mat({ color: "#2f6fd0" });
    const pot = ball(0.13, porc, TEA[0] - 0.2, 0.8, TEA[2] - 0.05); pot.scale.set(1, 0.85, 1); R.add(pot, ball(0.03, blue, TEA[0] - 0.2, 0.93, TEA[2] - 0.05));
    const sp = cyl(0.025, 0.14, porc, TEA[0] - 0.05, 0.76, TEA[2] - 0.05, 8); sp.rotation.z = -0.9; R.add(sp);
    R.add(cyl(0.065, 0.075, porc, TEA[0] + 0.18, 0.69, TEA[2] + 0.06, 20, 0.045), cyl(0.066, 0.012, blue, TEA[0] + 0.18, 0.74, TEA[2] + 0.06, 20));
    this.tea = new THREE.Mesh(new THREE.CircleGeometry(0.056, 24).rotateX(-Math.PI / 2), mat({ color: "#8a5a1a" })); this.tea.position.set(TEA[0] + 0.18, 0.758, TEA[2] + 0.06); R.add(this.tea);
    // la jarre
    this.jar = new Jar(); this.jar.root.position.set(...JAR); R.add(this.jar.root);

    // ================= la cour, devant la salle =================
    const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.x1 - COURT.x0, COURT.z1 - COURT.z0 + 4).rotateX(-Math.PI / 2), pbr("granite_tile_04", 9, 8, "#f4ecdc"));
    court.position.set(0, -0.005, (COURT.z0 + COURT.z1) / 2 + 2); court.receiveShadow = true; R.add(court);
    const tileGold = pbr("clay_roof_tiles_02", 8, 3, "#ffc850"), ridge = mat({ color: "#2f6f5e" });
    R.add(roof(x1 - x0, 7, h, tileGold, ridge));
    // la frise sous le toit et les colonnes du porche
    R.add(box(x1 - x0 + 0.6, 0.6, 0.4, mat({ map: tiled(coffersTex(), 10, 0.5) }), 0, h - 0.3, z1 + 0.5));
    for (const x of [-6, -3.6, 3.6, 6]) R.add(cyl(0.28, h - 0.6, red, x, 0, z1 + 0.9), cyl(0.38, 0.25, gold, x, 0, z1 + 0.9));
    // murs de la cour (rouges, chaperon de tuiles), la porte de la ville
    const wallR = pbr("red_plaster_weathered", 8, 1.2, "#ffb0a0"), cap = pbr("grey_roof_tiles", 10, 1, "#9fd0c4");
    for (const sx of [-1, 1]) { R.add(box(0.6, 3.2, COURT.z1 - COURT.z0, wallR, sx * COURT.x1, 1.6, (COURT.z0 + COURT.z1) / 2), box(1.0, 0.3, COURT.z1 - COURT.z0, cap, sx * COURT.x1, 3.3, (COURT.z0 + COURT.z1) / 2)); }
    for (const sx of [-1, 1]) R.add(box(COURT.x1 - 2.5, 3.6, 0.8, wallR, sx * (2.5 + COURT.x1) / 2, 1.8, COURT.z1), box(COURT.x1 - 2.5, 0.3, 1.2, cap, sx * (2.5 + COURT.x1) / 2, 3.75, COURT.z1));
    R.add(box(5.6, 1.4, 1.0, wallR, 0, 4.9, COURT.z1), roof(6, 2.6, 5.6, mat({ map: tiled(roofTileTex("roofTeal", "#2f8a7e"), 4, 1) }), dark).translateZ(COURT.z1));
    // arbres ronds, grand brûle-parfum, la bannière signée
    const leaf = mat({ color: "#5fb04a" }), trunk = mat({ color: "#7a4f2a" });
    const trees = items(K("arbres"));
    for (const [k, x, z] of [[1, -9, 10], [2, 9, 10], [3, -9, 19], [1, 9, 19], [2, -11.5, 15], [3, 11.5, 14]] as const) R.add(place(trees[k % trees.length], { h: 5.5 }, x, 0, z, k));
    R.add(place(K("encensoir"), { h: 1.6 }, 0, 0, 15.5));
    for (const sx of [-1, 1]) { R.add(place(K("pots"), { w: 1.6 }, sx * 11.6, 0, 7.0, sx), place(K("rochers"), { w: 2.2 }, sx * 10.8, 0, 22.5, sx)); R.add(place(K("vase-dragon"), { h: 1.4 }, sx * 3.0, 0, 6.2)); }
    // les lanternes du porche, et au-delà des murs : les toits des autres pavillons et une pagode
    for (const x of [-4.8, -1.6, 1.6, 4.8]) R.add(place(K("lanterne"), { h: 1.0 }, x, 4.3, 5.75, 0, 1.2));
    for (const sx of [-1, 1]) R.add(place(K("cour-chine"), { w: 16 }, sx * 22, 0, 14, sx * Math.PI / 2));
    R.add(place(K("temple"), { h: 14 }, 9, 0, 40));
    // le cheval du messager (modèle 3D animé : son galop est joué image par image)
    const hs = cloneSkinned(K("cheval")), hb = new THREE.Box3().setFromObject(hs), hsz = hb.getSize(new THREE.Vector3()), hc = hb.getCenter(new THREE.Vector3());
    hs.position.set(-hc.x, -hb.min.y, -hc.z); hs.traverse((m) => { const me = m as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = true; me.frustumCulled = false; } m.layers.set(NOINK); });
    const hin = new THREE.Group(); hin.add(hs); hin.scale.setScalar(1.75 / hsz.y);
    this.horse = new THREE.Group(); this.horse.add(hin); this.horse.rotation.y = HORSE_YAW; R.add(this.horse);
    if (ANIM[0]) { this.mixer = new THREE.AnimationMixer(hs); this.mixer.clipAction(ANIM[0]).play(); }
    R.add(cyl(0.07, 6, mat({ color: "#5a2a1e" }), 6.5, 0, 12.5, 10), box(1.3, 0.08, 0.08, gold, 6.5, 5.9, 12.5));
    R.add(panel(godzyTex("#d8352f", "#f3c84a", true), 1.0, 3.8, 6.5, 3.9, 12.52, 0, "#d8352f"));

    // ================= le bus d'aujourd'hui =================
    let from = R.children.length;
    const B = BUS, bw = 2.4, bl = 12, bh = 2.3, bx0 = B[0] - bw / 2, bx1 = B[0] + bw / 2;
    const bfloor = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl).rotateX(-Math.PI / 2), pbr("rubber_tiles", 2, 10, "#9aa0b0")); bfloor.position.set(B[0], 0.002, B[2]); R.add(bfloor);
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

    this.grab("bus", from);
    // ================= Longxi, après le séisme =================
    from = R.children.length;
    const L = LONGXI;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), pbr("dry_ground_01", 30, 30, "#f6e0b8")); ground.position.set(L[0], 0, L[2] - 20); ground.receiveShadow = true; R.add(ground);
    const hill = (x: number, z: number, r: number, hh: number, c: string) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: c })); m.scale.y = hh / r; m.position.set(x, 0, z); return m; };
    // les montagnes arides du Gansu (relief réel, texture satellite), au loin
    // collines de lœss en relief (même terre sèche que le sol), de plus en plus hautes au loin
    const hg = new THREE.PlaneGeometry(220, 110, 160, 80).rotateX(-Math.PI / 2), hp = hg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), z = hp.getZ(i), far = Math.max(0, (-z + 25) / 80);
      const hgt = far * far * (14 + 7 * Math.sin(x * 0.045 + 1.3) + 5 * Math.sin(x * 0.11 + z * 0.07) + 2.2 * Math.sin(x * 0.31 - z * 0.23));
      hp.setY(i, Math.max(0, hgt));
    }
    hg.computeVertexNormals();
    const hills = new THREE.Mesh(hg, pbr("dry_ground_01", 40, 20, "#e8c89a")); hills.position.set(L[0], -0.02, L[2] - 60); hills.receiveShadow = true; R.add(hills);
    void hill;
    const mud = pbr("clay_plaster", 1.5, 1, "#f0d0a0"), roofG = pbr("grey_roof_tiles", 4, 2);
    const house = (x: number, z: number, w: number, d: number, tilt: number, fallen: boolean) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = tilt;
      g.add(box(w, 1.9, d, mud, 0, 0.95, 0));
      g.add(box(0.7, 1.3, 0.05, mat({ color: "#5a3a22" }), 0, 0.65, d / 2 + 0.01));
      const r = roof(w - 1.4, d, 1.9, roofG, mat({ color: "#4a4f5f" }));
      if (fallen) { r.rotation.set(0.25, 0, 0.35); r.position.set(0.4, -1.1, 0.4); }
      g.add(r); return g;
    };
    // les maisons du village (modèles 3D), penchées par la secousse ; deux masures effondrées
    for (const [dx, dz, w, yaw, tl] of [[-6.0, -4.5, 6.5, 0.2, 0.03], [4.5, -4.8, 6.0, -0.25, -0.05], [12, -9, 7, 0.4, 0.0]] as const) {
      const hs = place(K("maison-chine"), { w }, L[0] + dx, 0, L[2] + dz, yaw); hs.rotation.z = tl; this.houses.push(hs); R.add(hs);
    }
    for (const [dx, dz, w, d, tl, f] of [[-1.0, -2.8, 3.0, 2.4, -0.07, true], [-11, -6.5, 3.0, 2.4, -0.05, true]] as const) {
      const hs = house(L[0] + dx, L[2] + dz, w, d, tl, f); this.houses.push(hs); R.add(hs);
    }
    const tc = place(K("charrette"), { w: 2.6 }, L[0] - 4.2, 0, L[2] - 0.3, 0.6); tc.rotation.z = 0.12; R.add(tc);
    for (const [dx, dz] of [[5.2, -1.4], [6.4, -0.6], [-7.8, -1.0]] as const) R.add(place(K("foin"), { w: 1.6 }, L[0] + dx, 0, L[2] + dz, dx));
    R.add(place(K("pots"), { w: 1.5 }, L[0] + 2.2, 0, L[2] - 1.6, 0.5), place(K("rochers"), { w: 3 }, L[0] - 3, 0, L[2] + 6.5));
    const bam = items(K("bambou"));
    for (const [k, dx, dz] of [[1, -9, -2], [1, 9.5, -2.5], [1, -14, -5]] as const) R.add(place(bam[k % bam.length], { h: 4 }, L[0] + dx, 0, L[2] + dz));
    // la route vers l'est (Luoyang), et le panneau
    const road = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 60).rotateX(-Math.PI / 2), pbr("brown_mud_dry", 1, 25, "#f0d8b0")); road.position.set(L[0] + 2, 0.006, L[2] + 20); road.rotation.y = 0; R.add(road);
    R.add(cyl(0.07, 2.2, mat({ color: "#7a4f2a" }), L[0] + 3.6, 0, L[2] + 4.4, 8), panel(signTex("LONGXI", "#2f6fd0"), 1.5, 0.5, L[0] + 3.6, 2.0, L[2] + 4.46, 0, "#2f6fd0"));
    for (const [k, dx, dz] of [[1, -12, 2], [2, 11, 1], [3, -15, -10], [1, 15, -12], [2, -20, -16], [3, 20, -18]] as const) R.add(place(trees[k % trees.length], { h: 6 }, L[0] + dx, 0, L[2] + dz, k));
    void leaf; void trunk;

    this.grab("longxi", from);
    // ================= le musée =================
    from = R.children.length;
    const M = MUSEUM;
    const mfloor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12).rotateX(-Math.PI / 2), pbr("herringbone_parquet", 5, 4)); mfloor.position.set(M[0], 0, M[2]); mfloor.receiveShadow = true; R.add(mfloor);
    const mwall = pbr("white_plaster_02", 4, 1.5, "#eef4f8"), mtrim = mat({ color: "#2f6fd0" });
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
    // d'autres pièces exposées sur des socles : vases, jarre de bronze, brûle-parfum
    const so = items(K("socles"));
    for (const [k, dx, dz, obj, oh] of [[0, -4.4, -3.2, "vase", 0.9], [1, 4.4, -3.2, "vase-dragon", 0.9], [2, -5.6, 1.5, "encensoir", 0.7], [0, 5.6, 1.5, "vase", 0.8]] as const) {
      const s0 = place(so[k % so.length], { h: 1.1 }, M[0] + dx, 0, M[2] + dz); R.add(s0, place(K(obj), { h: oh }, M[0] + dx, 1.1, M[2] + dz));
    }
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(1.5, 1.4, 1.1), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    spot.position.set(M[0], 4.2, M[2] - 0.5); spot.scale.setScalar(1.4); spot.layers.set(NOINK); R.add(spot);
    this.grab("museum", from);
  }
  /** les objets ajoutés depuis `from` forment un lieu, caché quand la caméra est ailleurs */
  private places: Record<string, THREE.Group> = {};
  private grab(name: string, from: number) {
    const g = new THREE.Group();
    for (const o of this.root.children.slice(from)) g.add(o);
    this.root.add(g); this.places[name] = g;
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
    // salle : le soleil entre par la grande porte (sud) et dessine sa tache et les ombres des colonnes sur le dallage
    // cour et Longxi : soleil franc et rasant (ombres longues) ; musée et bus : soleil coupé, lumières intérieures
    const tgt = s.loc === "hall" ? [0, 0, -1] : s.loc === "court" ? [0, 0, 13] : s.loc === "bus" ? BUS : s.loc === "longxi" ? LONGXI : MUSEUM;
    const sd = s.loc === "hall" ? [-4, 7.5, 16] : s.loc === "longxi" ? [-14, 7, 9] : [-11, 12, 7];
    this.sun.target.position.set(tgt[0], tgt[1], tgt[2]); this.sun.position.set(tgt[0] + sd[0], sd[1], tgt[2] + sd[2]);
    for (const [k, g] of Object.entries(this.places)) g.visible = k === s.loc;
    // l'orage de la cour : ciel et lumière assombris
    const storm = s.loc === "court" && t < W[40];
    const LI: Record<string, [number, number, number]> = { hall: [0.32, 5.5, 0.12], court: [0.75, 3.4, 0.25], longxi: [0.6, 3.8, 0.2], museum: [0.28, 0, 0.1], bus: [0.7, 0, 0.3] };
    const [hi, si, fli] = storm ? [0.45, 0.35, 0.15] : LI[s.loc];
    this.hemi.intensity = hi; this.sun.intensity = si; this.fill.intensity = fli; this.sun.castShadow = si > 0;
    this.hemi.color.set(s.loc === "hall" ? "#ffe2c0" : "#dfeaff"); this.hemi.groundColor.set(s.loc === "hall" ? "#5a2a18" : "#8a6a48");
    this.sun.color.set(s.loc === "longxi" ? "#ffd8a0" : "#fff0d8");
    this.hallLights.visible = s.loc === "hall"; this.museumLights.visible = s.loc === "museum"; this.busLights.visible = s.loc === "bus";
    if (HDR) HDR.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = HDR; scene.background = HDR; scene.backgroundIntensity = storm ? 0.45 : 1.3; scene.environmentIntensity = storm ? 0.3 : 0.6;
    // une légère brume : profondeur dans la salle (poussière dans la lumière), air sec et poussiéreux à Longxi
    scene.fog = s.loc === "hall" ? new THREE.FogExp2("#4a2c1c", 0.028) : s.loc === "longxi" ? new THREE.FogExp2("#e6cfa6", 0.012) : s.loc === "court" ? new THREE.FogExp2(storm ? "#5a6070" : "#d8e2ea", 0.006) : null;
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
    // le cheval au galop (et à l'arrêt, une fois arrivé)
    const rd = riderAt(t);
    this.horse.visible = s.loc === "court" && t > W[40];
    this.horse.position.set(RIDER_X, 0, rd.z);
    const hT = (getInputProps() as { horseT?: number }).horseT; // images de contrôle : instant de l'animation imposé
    // au galop dans la cour, puis debout, arrêté devant la salle
    const ta = t - T.gallop[1];
    if (this.mixer && ANIM[0]) this.mixer.setTime(hT ?? (rd.u < 1 ? GALLOP[0] + (((t - T.gallop[0]) * GALLOP_SPEED) % (GALLOP[1] - GALLOP[0])) : STAND));
    void ta;
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
