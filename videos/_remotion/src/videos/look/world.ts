// Test du nouveau rendu : un bureau colonial MEUBLÉ d'objets 3D (Sketchfab, CC BY, voir public/assets/sketchfab/CREDITS.md)
// avec leurs vraies matières (PBR), éclairé par un ciel HDRI (Poly Haven), le soleil qui entre par la fenêtre (rayons),
// une lampe chaude et un ventilateur qui tourne ; la réserve aux cages derrière la porte de droite.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { staticFile } from "remotion";
import { Kit } from "./build";
import { ctex, planksHD } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage, CAGES } from "./cast";
import { FPS, SHOTS, camAt, ROOM, STORE } from "./story";

const MODELS = ["counter", "filing-cabinet", "bookshelf", "wall-clocks", "rugs", "flowerpot", "desk-lamp", "ceiling-fan", "cages", "barrel", "doors"];
let HDR: THREE.DataTexture | null = null;
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const gl = new GLTFLoader();
    kitP = Promise.all([
      ...MODELS.map((n) => gl.loadAsync(staticFile(`assets/sketchfab/${n}.glb`)).then((g) => [n, g.scene] as const)),
      new RGBELoader().loadAsync(staticFile("assets/polyhaven/hdri/kiara_1_dawn.hdr")).then((t) => { HDR = t; return ["_hdr", new THREE.Group()] as const; }),
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
  g.fillStyle = "#f1d79c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 512, s = 30 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, "rgba(180,130,60,0.12)"); gr.addColorStop(1, "rgba(180,130,60,0)"); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
});
const brickTex = () => ctex("brickLook", 512, 512, (g, r) => {
  g.fillStyle = "#c9b089"; g.fillRect(0, 0, 512, 512);
  for (let y = 0, row = 0; y < 512; y += 32, row++) for (let x = -(row % 2) * 48; x < 512; x += 96) { const v = 0.85 + r() * 0.25; g.fillStyle = `rgb(${Math.round(176 * v)},${Math.round(98 * v)},${Math.round(66 * v)})`; g.fillRect(x + 3, y + 3, 90, 26); }
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
    const lamp = new THREE.PointLight("#ffb866", 6, 7, 1.6); lamp.position.set(-1.05, 1.62, 0.05); R.add(lamp);
    const storeLamp = new THREE.PointLight("#ffa04a", 9, 9, 1.4); storeLamp.position.set(8.4, 3.0, -0.6); R.add(storeLamp);

    // ---- le bureau : plancher, murs crème, lambris, plafond à poutres ----
    const { x0, x1, z0, z1, h } = ROOM;
    const floorT = planksHD(); floorT.repeat.set(3, 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 7, z1 - z0).rotateX(-Math.PI / 2), std({ map: floorT, color: "#c99a6a", roughness: 0.7 }));
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
    for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 + 0.12, x1 - x0, 0.06], [x0 + 0.12, 0, 0.06, z1 - z0]] as const) R.add(box(w, 1.1, d, wood, x, 0.55, z));
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), std({ color: "#e9d2a0" })); ceil.position.set(0, h, 0); R.add(ceil);
    for (let x = x0 + 1; x < x1; x += 2) R.add(box(0.22, 0.25, z1 - z0, beam, x, h - 0.12, 0));
    // ---- la réserve : briques, une lucarne, des cages et des tonneaux ----
    const brick = std({ map: brickTex() });
    R.add(box(STORE.x1 - STORE.x0, h, 0.2, brick, (STORE.x0 + STORE.x1) / 2, h / 2, STORE.z0));
    R.add(box(0.2, h, STORE.z1 - STORE.z0, brick, STORE.x1, h / 2, (STORE.z0 + STORE.z1) / 2));
    const sceil = new THREE.Mesh(new THREE.PlaneGeometry(STORE.x1 - STORE.x0, STORE.z1 - STORE.z0).rotateX(Math.PI / 2), beam); sceil.position.set((STORE.x0 + STORE.x1) / 2, h, (STORE.z0 + STORE.z1) / 2); R.add(sceil);

    // ---- les objets ----
    const counter = place(K("counter"), { w: 3.6 }, 0, 0, 0, Math.PI); R.add(counter);
    R.add(place(K("filing-cabinet"), { h: 1.6 }, -4.2, 0, -3.4));
    R.add(place(K("bookshelf"), { h: 2.4 }, 2.8, 0, -3.62));
    const clocks = items(K("wall-clocks"));
    R.add(place(clocks[0], { h: 0.55 }, 0.6, 2.75, -3.88));
    R.add(place(items(K("rugs"))[0], { w: 2.6 }, 0.6, 0.006, 2.1));
    const pots = items(K("flowerpot"));
    R.add(place(pots[0], { h: 1.3 }, -4.2, 0, 2.6), place(pots[Math.min(1, pots.length - 1)], { h: 1.1 }, 4.3, 0, 2.8));
    R.add(place(K("desk-lamp"), { h: 0.48 }, -1.05, 1.08, 0.05, 0.6));
    this.fan = place(K("ceiling-fan"), { w: 1.5 }, 0.2, h - 0.75, 0.4); R.add(this.fan);
    // les cages en deux étages, des tonneaux, la porte de la réserve ouverte
    for (const y of [0, 1.2]) for (const x of [7.4, 8.6, 9.8]) R.add(place(items(K("cages"))[0], { h: 1.05 }, x, y + 0.02, -2.9));
    R.add(box(3.9, 0.08, 0.9, wood, 8.6, 1.2, -2.9));
    for (const [x, z] of [[10.3, -1.0], [10.4, 0.1], [6.0, -3.3]] as const) R.add(place(K("barrel"), { h: 0.95 }, x, 0, z));
    R.add(place(items(K("doors"))[0], { h: 2.65 }, 5.1, 0, -2.6, -Math.PI / 2 + 0.9));
    void CAGES;

    // ---- rayons de soleil (fenêtre du bureau, lucarne de la réserve) et halo de la lampe ----
    const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex(), color: new THREE.Color(1.6, 1.25, 0.8), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let k = 0; k < 3; k++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 6.5), shaftM); sh.position.set(-2.7 + k * 0.45 + 2.2, 1.75, -2.0 + 0.2 * k); sh.rotation.set(-0.95, 0.35, -0.25);
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
    scene.environment = this.pmrem; scene.background = this.pmrem; scene.backgroundIntensity = 1.4; scene.environmentIntensity = 0.55;
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
