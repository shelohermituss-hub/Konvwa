// Test du nouveau rendu : un bureau colonial MEUBLÉ d'objets 3D (Sketchfab, CC BY, voir public/assets/sketchfab/CREDITS.md)
// avec leurs vraies matières (PBR), éclairé par un ciel HDRI (Poly Haven), le soleil qui entre par la fenêtre (rayons),
// une lampe chaude et un ventilateur qui tourne ; la réserve aux cages derrière la porte de droite.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { staticFile } from "remotion";
import { Kit } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage, CAGES } from "./cast";
import { FPS, SHOTS, camAt, ROOM, STORE } from "./story";

const MODELS = ["filing-cabinet", "bookshelf", "wall-clocks", "flowerpot", "desk-lamp", "ceiling-fan", "cages", "barrel"];
let HDR: THREE.DataTexture | null = null;
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const gl = new GLTFLoader();
    kitP = Promise.all([
      ...MODELS.map((n) => gl.loadAsync(staticFile(`assets/sketchfab/${n}.glb`)).then((g) => [n, g.scene] as const)),
      new RGBELoader().loadAsync(staticFile("assets/polyhaven/hdri/kloofendal_48d_partly_cloudy_puresky.hdr")).then((t) => { HDR = t; return ["_hdr", new THREE.Group()] as const; }),
    ]).then((l) => Object.fromEntries(l) as Kit);
  }
  return kitP;
};

/** les objets d'un pack (premier niveau qui a plusieurs enfants) */
const items = (o: THREE.Object3D) => { let n = o; while (n.children.length === 1) n = n.children[0]; return n.children.length ? n.children : [o]; };
/** copie d'un objet, mise à l'échelle (hauteur h, ou largeur w), posée au sol en (x, y, z), tournée de yaw */
const place = (src: THREE.Object3D, o: { h?: number; w?: number }, x: number, y: number, z: number, yaw = 0) => {
  const c = src.clone(true), g = new THREE.Group();
  const b = new THREE.Box3().setFromObject(c), size = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
  const s = o.h ? o.h / Math.max(1e-4, size.y) : (o.w ?? 1) / Math.max(1e-4, Math.max(size.x, size.z));
  c.position.set(-ctr.x, -b.min.y, -ctr.z);
  const inner = new THREE.Group(); inner.add(c); inner.scale.setScalar(s);
  g.add(inner); g.position.set(x, y, z); g.rotation.y = yaw;
  g.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
  return g;
};
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const plasterTex = () => ctex("plasterLook", 512, 512, (g, r) => {
  g.fillStyle = "#f6e7c4"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 512, s = 30 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, "rgba(180,130,60,0.12)"); gr.addColorStop(1, "rgba(180,130,60,0)"); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
});
const brickTex = () => ctex("brickLook", 512, 512, (g, r) => {
  g.fillStyle = "#c9b089"; g.fillRect(0, 0, 512, 512);
  for (let y = 0, row = 0; y < 512; y += 32, row++) for (let x = -(row % 2) * 48; x < 512; x += 96) { const v = 0.85 + r() * 0.25; g.fillStyle = `rgb(${Math.round(176 * v)},${Math.round(98 * v)},${Math.round(66 * v)})`; g.fillRect(x + 3, y + 3, 90, 26); }
});
/** carrelage colonial rouge et crème (512 px = 1,1 m) */
const tileTex = () => { const t = ctex("tilesLook", 512, 512, (g) => {
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) { g.fillStyle = (x + y) % 256 ? "#b8503a" : "#efe2c4"; g.fillRect(x, y, 128, 128); }
  g.strokeStyle = "rgba(60,40,30,0.35)"; g.lineWidth = 3; for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
}); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
/** tapis persan : fond rouge, bordures, médaillon */
const rugTex = () => ctex("rugLook", 512, 340, (g, r) => {
  g.fillStyle = "#7a1f1c"; g.fillRect(0, 0, 512, 340);
  g.strokeStyle = "#e3c27a"; g.lineWidth = 10; g.strokeRect(14, 14, 484, 312);
  g.strokeStyle = "#1f3a5a"; g.lineWidth = 16; g.strokeRect(34, 34, 444, 272);
  for (let k = 0; k < 24; k++) { g.fillStyle = k % 2 ? "#e3c27a" : "#c9643a"; g.fillRect(44 + k * 18.5, 22, 9, 9); g.fillRect(44 + k * 18.5, 309, 9, 9); }
  g.fillStyle = "#1f3a5a"; g.beginPath(); g.moveTo(256, 90); g.lineTo(356, 170); g.lineTo(256, 250); g.lineTo(156, 170); g.closePath(); g.fill();
  g.fillStyle = "#e3c27a"; g.beginPath(); g.moveTo(256, 125); g.lineTo(312, 170); g.lineTo(256, 215); g.lineTo(200, 170); g.closePath(); g.fill();
  g.fillStyle = "#7a1f1c"; g.beginPath(); g.arc(256, 170, 18, 0, 7); g.fill();
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.fillRect(r() * 512, r() * 340, 2, 2); }
});
const shaftTex = () => ctex("shaftLook", 64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); });
const glowTex = () => ctex("glowSoft", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return me;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight;
  private fan: THREE.Object3D;
  private pmrem: THREE.Texture | null = null;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, K = (n: string) => kit[n];
    // ---- lumière : soleil par la fenêtre (ombres), ciel doux, lampe chaude ----
    this.hemi = new THREE.HemisphereLight("#ffe9c8", "#6a4a3a", 0.35);
    this.sun = new THREE.DirectionalLight("#ffd29a", 3.2);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.sun.position.set(-9, 13, -14); this.sun.target.position.set(1, 0, 1);
    R.add(this.hemi, this.sun, this.sun.target);
    const lamp = new THREE.PointLight("#ffb866", 10, 7, 1.4); lamp.position.set(-1.05, 1.62, 0.05); R.add(lamp);
    const storeLamp = new THREE.PointLight("#ffa04a", 30, 14, 1.2); storeLamp.position.set(8.4, 3.0, -0.6); R.add(storeLamp);
    const cageLight = new THREE.PointLight("#ffd9a8", 18, 8, 1.2); cageLight.position.set(7.2, 2.0, 0.6); R.add(cageLight);

    // ---- le bureau : plancher, murs crème, lambris, plafond à poutres ----
    const { x0, x1, z0, z1, h } = ROOM;
    const floorT = tileTex(); floorT.repeat.set(9, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 7, z1 - z0).rotateX(-Math.PI / 2), std({ map: floorT, roughness: 0.45 }));
    floor.position.set((x0 + x1 + 6) / 2, 0, (z0 + z1) / 2); floor.receiveShadow = true; R.add(floor);
    const plaster = std({ map: plasterTex() }), wood = std({ color: "#6a3f24", roughness: 0.6 }), beam = std({ color: "#5a3420", roughness: 0.7 });
    // mur du fond avec une fenêtre à volets (x -3.6..-1.8, y 1.2..3.3)
    const wx0 = -3.6, wx1 = -1.8, wy0 = 1.2, wy1 = 3.3;
    R.add(box(wx0 - x0, h, 0.2, plaster, (x0 + wx0) / 2, h / 2, z0), box(x1 - wx1, h, 0.2, plaster, (wx1 + x1) / 2, h / 2, z0));
    R.add(box(wx1 - wx0, wy0, 0.2, plaster, (wx0 + wx1) / 2, wy0 / 2, z0), box(wx1 - wx0, h - wy1, 0.2, plaster, (wx0 + wx1) / 2, (h + wy1) / 2, z0));
    for (const sx of [wx0 - 0.5, wx1 + 0.5]) R.add(box(0.85, wy1 - wy0, 0.06, std({ color: "#2f6a5a" }), sx, (wy0 + wy1) / 2, z0 + 0.14));
    R.add(box(wx1 - wx0 + 0.3, 0.12, 0.3, wood, (wx0 + wx1) / 2, wy0, z0 + 0.1));
    // mur de gauche, mur de droite avec la porte de la réserve (z -2.4..-0.6)
    R.add(box(0.2, h, z1 - z0, plaster, x0, h / 2, (z0 + z1) / 2));
    R.add(box(0.2, h, -2.4 - z0, plaster, x1, h / 2, (z0 - 2.4) / 2), box(0.2, h, z1 + 0.6, plaster, x1, h / 2, (z1 - 0.6) / 2), box(0.2, h - 2.7, 1.8, plaster, x1, (h + 2.7) / 2, -1.5));
    const teal = std({ color: "#2f7a6e", roughness: 0.5 });
    for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 + 0.12, x1 - x0, 0.06], [x0 + 0.12, 0, 0.06, z1 - z0], [x1 - 0.12, 0.5 * (z1 - 0.6), 0.06, z1 + 0.6]] as const) R.add(box(w, 1.15, d, teal, x, 0.575, z));
    for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 + 0.16, x1 - x0, 0.08], [x0 + 0.16, 0, 0.08, z1 - z0]] as const) R.add(box(w, 0.06, d, wood, x, 1.18, z));
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), std({ color: "#e9d2a0" })); ceil.position.set(0, h, 0); R.add(ceil);
    for (let x = x0 + 1; x < x1; x += 2) R.add(box(0.22, 0.25, z1 - z0, beam, x, h - 0.12, 0));
    // ---- la réserve : briques, une lucarne, des cages et des tonneaux ----
    const brick = std({ map: brickTex() });
    R.add(box(STORE.x1 - STORE.x0, h, 0.2, brick, (STORE.x0 + STORE.x1) / 2, h / 2, STORE.z0));
    R.add(box(0.2, h, STORE.z1 - STORE.z0, brick, STORE.x1, h / 2, (STORE.z0 + STORE.z1) / 2));
    const sceil = new THREE.Mesh(new THREE.PlaneGeometry(STORE.x1 - STORE.x0, STORE.z1 - STORE.z0).rotateX(Math.PI / 2), beam); sceil.position.set((STORE.x0 + STORE.x1) / 2, h, (STORE.z0 + STORE.z1) / 2); R.add(sceil);

    // ---- les objets ----
    // le comptoir du guichet : bois sombre, panneaux en relief, dessus ciré, une grille de guichet
    const cw = std({ color: "#7a4528", roughness: 0.55 }), ctop = std({ color: "#5a3420", roughness: 0.65 }), brass = new THREE.MeshStandardMaterial({ color: "#c9a04a", metalness: 0.9, roughness: 0.3 });
    R.add(box(3.4, 1.02, 0.7, cw, -0.2, 0.51, 0), box(3.56, 0.07, 0.86, ctop, -0.2, 1.055, 0));
    for (let k = 0; k < 4; k++) R.add(box(0.66, 0.6, 0.04, std({ color: "#8a5232", roughness: 0.5 }), -1.47 + k * 0.85, 0.52, 0.37));
    for (let k = 0; k < 7; k++) R.add(box(0.025, 0.7, 0.025, brass, -0.95 + k * 0.12, 1.44, -0.05));
    R.add(box(0.85, 0.04, 0.05, brass, -0.59, 1.8, -0.05));
    R.add(place(K("filing-cabinet"), { h: 1.6 }, -4.2, 0, -3.4));
    R.add(place(K("bookshelf"), { h: 2.4 }, 2.8, 0, -3.62));
    const clocks = items(K("wall-clocks"));
    R.add(place(clocks[0], { h: 0.55 }, 0.6, 2.75, -3.88));
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6).rotateX(-Math.PI / 2), std({ map: rugTex(), roughness: 0.95 }));
    rug.position.set(0.3, 0.006, 1.6); rug.receiveShadow = true; R.add(rug);
    const pots = items(K("flowerpot"));
    R.add(place(pots[0], { h: 1.3 }, -4.2, 0, 2.6), place(pots[Math.min(1, pots.length - 1)], { h: 1.1 }, 4.3, 0, 2.8));
    R.add(place(K("desk-lamp"), { h: 0.48 }, -1.05, 1.08, 0.05, 0.6));
    this.fan = place(K("ceiling-fan"), { w: 1.5 }, 0.2, h - 0.75, 0.4); R.add(this.fan);
    // les cages en deux étages, des tonneaux, la porte de la réserve ouverte
    // une cage = les 4 premières pièces du pack (toit, socle, grillage, plateau)
    const cage = new THREE.Group(); for (const o of items(K("cages")).slice(0, 4)) cage.add(o.clone(true));
    for (const y of [0, 0.87]) for (const x of [7.4, 8.6, 9.8]) R.add(place(cage, { h: 0.75 }, x, y + 0.02, -3.1));
    R.add(box(3.9, 0.08, 1.5, wood, 8.6, 0.85, -3.1));
    for (const [x, z] of [[10.3, -1.0], [10.4, 0.1], [6.0, -3.3]] as const) R.add(place(K("barrel"), { h: 0.95 }, x, 0, z));
    // une porte à panneaux au fond (le pack de portes est une rangée de 16 m : on la fait nous-mêmes)
    const dw = std({ color: "#5e3a22", roughness: 0.55 }), dp = std({ color: "#6e4428", roughness: 0.5 });
    R.add(box(1.1, 2.3, 0.08, dw, 3.95, 1.15, -3.86), box(1.3, 0.12, 0.12, wood, 3.95, 2.36, -3.84));
    for (const [y, hh] of [[0.55, 0.7], [1.55, 0.95]] as const) for (const dx of [-0.24, 0.24]) R.add(box(0.36, hh, 0.04, dp, 3.95 + dx, y, -3.8));
    R.add(box(0.06, 0.06, 0.08, brass, 3.6, 1.1, -3.78));
    void CAGES;

    // ---- rayons de soleil (fenêtre du bureau, lucarne de la réserve) et halo de la lampe ----
    const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex(), color: new THREE.Color(1.6, 1.25, 0.8), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let k = 0; k < 3; k++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4.5), shaftM); sh.position.set(-3.0 + k * 0.4, 1.7, -2.9 + 0.15 * k); sh.rotation.set(-0.9, 0.3, -0.2);
      sh.layers.set(NOINK); sh.renderOrder = 5; R.add(sh);
    }
    for (let k = 0; k < 2; k++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5), shaftM); sh.position.set(8.0 + k * 0.6, 2.2, -2.0); sh.rotation.set(-0.7, 0.2, 0.1); sh.layers.set(NOINK); sh.renderOrder = 5; R.add(sh); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(2.4, 1.5, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.set(-1.05, 1.5, 0.05); halo.scale.setScalar(0.7); halo.layers.set(NOINK); R.add(halo);
    const halo2 = halo.clone(); halo2.position.set(8.4, 3.0, -0.6); halo2.scale.setScalar(1.1); R.add(halo2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 1) })); bulb.position.copy(storeLamp.position); R.add(bulb);
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // ciel HDRI : lumière d'ambiance (PMREM) et fond vu par la fenêtre
    if (!this.pmrem && HDR) {
      HDR.mapping = THREE.EquirectangularReflectionMapping;
      this.pmrem = HDR;
    }
    scene.environment = this.pmrem; scene.background = this.pmrem; scene.backgroundIntensity = 1.2; scene.environmentIntensity = 0.5;
    scene.fog = null;
    // les personnages (cartes) gardent l'éclairage deux tons du style
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK.day.bounce); TONE.uSat.value = 1.15;
    CHAR.uCharTint.value.set(1.0, 0.95, 0.88); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
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
