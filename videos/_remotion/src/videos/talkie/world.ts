// Le monde de « La tour qui faisait fondre les voitures » : la City de Londres (la rue d'en face, la tour à façade
// concave, les tours voisines et le « cornichon »), un parc pour la loupe, et Las Vegas (l'hôtel courbe, la piscine).
// Même éclairage deux tons, même ciel et mêmes nuages que le modèle du pont ; update(id, f, camera) pose tout pour le
// plan id à l'image f (fonction pure de id + f) : la Jaguar qui fond, la tache de lumière, les rayons, le bus.
import * as THREE from "three";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, V, lam, boxGeo, quad, Kit, Ray, prop, setSight, setVegCenter, inTheWay } from "./build";
import { ctex, rep, cloudHD, grassHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, Stage, fxEgg, fxLeaf, fxBlisters } from "./cast";
import { FPS, SHOTS, ShotDef, camAt, at, ramp, smooth, clamp01, TOWER, HOT, JAG, BIKE, MAT, PAN, PARK, LV, SHOP_Z } from "./story";
import { godzyTexture } from "../_commun/godzy";

/** pas de modèles Kenney ici : arbres et buissons sont les végétaux procéduraux de build.ts */
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
/** tache douce (lueur additive) : blanc au centre, transparent au bord */
const glowTex = () => ctex("glowSoft", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.75)"); gr.addColorStop(0.7, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

// ---------------- textures peintes de Londres ----------------
const asphaltTex = () => ctex("asphaltL", 1024, 1024, (g, r) => {
  g.fillStyle = "#62646e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? "rgba(38,38,46,0.3)" : "rgba(160,160,170,0.25)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 3, 2 + r() * 3); }
  for (let i = 0; i < 14; i++) { const x = r() * 1024, y = r() * 1024, s = 60 + r() * 140; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, "rgba(40,40,50,0.12)"); gr.addColorStop(1, "rgba(40,40,50,0)"); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
});
const paveTex = () => ctex("paveL", 1024, 1024, (g, r) => {
  g.fillStyle = "#a9a7a6"; g.fillRect(0, 0, 1024, 1024);
  const S = 128; // 0,6 m de dalle pour 1024 px = 4,8 m
  for (let y = 0; y < 1024; y += S) for (let x = 0; x < 1024; x += S) {
    const v = 168 + Math.floor(r() * 22); g.fillStyle = `rgb(${v},${v - 3},${v - 6})`; g.fillRect(x + 3, y + 3, S - 6, S - 6);
    if (r() < 0.25) { g.fillStyle = "rgba(90,85,80,0.12)"; g.fillRect(x + 3 + r() * 60, y + 3 + r() * 60, 30 + r() * 40, 20 + r() * 30); }
  }
});
/** façade de tour de bureaux : rubans de fenêtres, verre bleu-gris, montants ; w x h en mètres */
const officeTex = (seed: number) => ctex("officeL" + seed, 512, 1024, (g, r) => {
  const pal = [["#cfd3d8", "#6f88a8"], ["#d8cbb2", "#59718f"], ["#b9c2cc", "#46607e"], ["#e2ddd2", "#7d93ad"], ["#9fa9b4", "#3e5470"]][seed % 5];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 512, 1024);
  const fl = 1024 / 16, ribbon = seed % 2 === 0;
  for (let k = 0; k < 16; k++) {
    const y = k * fl + fl * 0.22, h = fl * 0.58;
    if (ribbon) {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#a9c0dc"); gr.addColorStop(1, pal[1]);
      g.fillStyle = gr; g.fillRect(0, y, 512, h);
      g.fillStyle = "rgba(30,35,45,0.35)"; for (let x = 0; x < 512; x += 64) g.fillRect(x, y, 4, h);
    } else for (let x = 16; x < 512; x += 64) {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#b7cbe2"); gr.addColorStop(1, pal[1]);
      g.fillStyle = gr; g.fillRect(x, y, 34, h);
      if (r() < 0.2) { g.fillStyle = "rgba(255,240,200,0.35)"; g.fillRect(x, y, 34, h); }
    }
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, k * fl, 512, 3);
  }
});
/** verre de la tour : panneaux d'un étage (4 m) sur 1,5 m, reflets de ciel, quelques vitres plus claires.
 *  u = 0..1 sur la largeur (~48 m, 32 colonnes), v = 0..1 sur 150 m (38 étages) */
const glassTex = (warm: boolean) => ctex(warm ? "glassGold" : "glassDay", 1024, 2048, (g, r) => {
  const cols = 32, rows = 38, cw = 1024 / cols, rh = 2048 / rows;
  const top = warm ? "#f4c58e" : "#c7dcf2", mid = warm ? "#b98aa0" : "#7fa6d2", low = warm ? "#5e5a86" : "#46679a";
  const sky = g.createLinearGradient(0, 0, 0, 2048); sky.addColorStop(0, top); sky.addColorStop(0.45, mid); sky.addColorStop(1, low);
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 2048);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = r();
    if (v < 0.18) { g.fillStyle = warm ? "rgba(255,226,170,0.35)" : "rgba(235,245,255,0.35)"; g.fillRect(i * cw, j * rh, cw, rh); }
    else if (v < 0.3) { g.fillStyle = "rgba(30,40,70,0.18)"; g.fillRect(i * cw, j * rh, cw, rh); }
  }
  // grands reflets diagonaux (nuages sur le verre)
  for (let k = 0; k < 7; k++) {
    g.save(); g.translate(r() * 1024, r() * 2048); g.rotate(-0.5);
    g.fillStyle = warm ? "rgba(255,236,200,0.22)" : "rgba(255,255,255,0.2)"; g.fillRect(-300, -30, 600, 60 + r() * 80); g.restore();
  }
  g.fillStyle = "rgba(44,48,62,0.75)";
  for (let i = 0; i <= cols; i++) g.fillRect(i * cw - 2, 0, 4, 2048);
  g.fillStyle = "rgba(230,232,240,0.55)";
  for (let j = 0; j <= rows; j++) g.fillRect(0, j * rh - 3, 1024, 6);
});
/** verre de l'hôtel de Las Vegas : bandes dorées et bronze */
const vegasTex = () => ctex("vegasGlass", 1024, 2048, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 2048); gr.addColorStop(0, "#e9d2a6"); gr.addColorStop(0.5, "#c9a77a"); gr.addColorStop(1, "#8f7356");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 2048);
  const rows = 57, rh = 2048 / rows;
  for (let j = 0; j < rows; j++) { g.fillStyle = "rgba(70,52,40,0.45)"; g.fillRect(0, j * rh + rh * 0.7, 1024, rh * 0.3); if (r() < 0.3) { g.fillStyle = "rgba(255,240,210,0.25)"; g.fillRect(0, j * rh, 1024, rh * 0.7); } }
  g.fillStyle = "rgba(60,45,35,0.5)"; for (let x = 0; x < 1024; x += 32) g.fillRect(x, 0, 3, 2048);
});
/** une rangée de commerces londoniens : brique, fenêtres à guillotine blanches, vitrine et bandeau peint au rez-de-chaussée */
type Shop = { name: string; fascia: string; ink: string; godzy?: boolean };
const SHOPS: Shop[] = [
  { name: "CAFÉ", fascia: "#2f5f6a", ink: "#f4efe2" }, { name: "NEWS", fascia: "#c0353a", ink: "#ffffff" },
  { name: "BAKERY", fascia: "#d9a441", ink: "#3a2a1a" }, { name: "PHARMACY", fascia: "#2f6a43", ink: "#ffffff" },
  { name: "BOOKS", fascia: "#3a3d6b", ink: "#f2d58a" }, { name: "FLOWERS", fascia: "#c25a7a", ink: "#ffffff" },
  { name: "TAILOR", fascia: "#2a2f40", ink: "#e8c45a" }, { name: "PUB", fascia: "#5a2a24", ink: "#e8c45a" },
];
const BRICKS = ["#b45a3c", "#9c4f3a", "#c87a52", "#8a4b3d", "#b9845e"];
const rowTex = (key: string, wm: number, hm: number, shop: Shop, brick: string) => {
  const PX = Math.min(64, 2048 / Math.max(wm, hm)), W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex("row" + key, W, H, (g, r) => {
    g.fillStyle = "#e9d3b4"; g.fillRect(0, 0, W, H);
    const bw = m(0.25), bh = m(0.085);
    for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
      const k = 0.88 + r() * 0.2, c = new THREE.Color(brick).multiplyScalar(k);
      g.fillStyle = "#" + c.getHexString(); g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
    // étages : fenêtres à guillotine
    const floors = Math.floor((hm - 4.2) / 3.1), n = Math.max(1, Math.floor(wm / 2.4));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) * W) / n, y1 = H - m(4.2 + fl * 3.1 + 0.6), ww = m(1.0), wh = m(1.7), x0 = cx - ww / 2, y0 = y1 - wh;
      g.fillStyle = "#f4efe2"; g.fillRect(x0 - m(0.1), y0 - m(0.1), ww + m(0.2), wh + m(0.2));
      const gl = g.createLinearGradient(0, y0, 0, y1); gl.addColorStop(0, "#9fb4dc"); gl.addColorStop(1, "#4f5c96");
      g.fillStyle = gl; g.fillRect(x0, y0, ww, wh);
      g.fillStyle = "#f4efe2"; g.fillRect(x0, y0 + wh / 2 - m(0.04), ww, m(0.08)); g.fillRect(cx - m(0.025), y0, m(0.05), wh);
      g.fillStyle = "rgba(255,255,255,0.4)"; g.save(); g.beginPath(); g.rect(x0, y0, ww, wh); g.clip(); g.translate(x0 + ww * 0.35, y0 + wh / 2); g.rotate(0.7); g.fillRect(-m(0.05), -wh, m(0.08), 2 * wh); g.restore();
      g.fillStyle = "#e4dccb"; g.fillRect(x0 - m(0.15), y1 + m(0.1), ww + m(0.3), m(0.1));
      g.fillStyle = "#e4dccb"; g.fillRect(x0 - m(0.12), y0 - m(0.3), ww + m(0.24), m(0.16));
    }
    // corniche
    g.fillStyle = "#efe6d4"; g.fillRect(0, 0, W, m(0.45)); g.fillStyle = "rgba(60,45,40,0.35)"; g.fillRect(0, m(0.45), W, m(0.06));
    // rez-de-chaussée : vitrine, porte au centre, bandeau
    const gf = m(4.2);
    g.fillStyle = shop.fascia; g.fillRect(0, H - gf, W, gf);
    g.fillStyle = "#2a2430"; g.fillRect(0, H - gf, W, m(0.08));
    const fy = H - gf + m(0.25), fh = m(0.85);
    g.fillStyle = shop.godzy ? "#f2d58a" : shop.fascia; g.fillRect(m(0.3), fy, W - m(0.6), fh);
    g.strokeStyle = "#e8c45a"; g.lineWidth = m(0.06); g.strokeRect(m(0.3), fy, W - m(0.6), fh);
    g.font = `900 ${Math.round(fh * 0.66)}px "Arial Black", Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    if (shop.godzy) { g.lineWidth = fh * 0.09; g.strokeStyle = "#241726"; g.strokeText("GODZY", W / 2, fy + fh / 2 + m(0.03)); g.fillStyle = "#c8402e"; g.fillText("GODZY", W / 2, fy + fh / 2 + m(0.03)); }
    else { g.fillStyle = shop.ink; g.fillText(shop.name, W / 2, fy + fh / 2 + m(0.03)); }
    const wy = fy + fh + m(0.35), wh2 = H - wy - m(0.35), dw = m(1.2);
    for (const [x0, x1] of [[m(0.4), W / 2 - dw / 2 - m(0.25)], [W / 2 + dw / 2 + m(0.25), W - m(0.4)]]) {
      const gl = g.createLinearGradient(0, wy, 0, wy + wh2); gl.addColorStop(0, "#c6d6ea"); gl.addColorStop(1, "#5d6a98");
      g.fillStyle = gl; g.fillRect(x0, wy, x1 - x0, wh2);
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x0 + (x1 - x0) * 0.2, wy, m(0.12), wh2);
      // marchandises en vitrine
      for (let k = 0; k < 4; k++) { g.fillStyle = ["#e2453c", "#f2c230", "#5aa83c", "#f4efe2"][(k + key.length) % 4]; g.fillRect(x0 + (x1 - x0) * (0.15 + k * 0.2), wy + wh2 * 0.62, (x1 - x0) * 0.12, wh2 * 0.3); }
      g.strokeStyle = "#2a2430"; g.lineWidth = m(0.06); g.strokeRect(x0, wy, x1 - x0, wh2);
    }
    g.fillStyle = "#3a2a24"; g.fillRect(W / 2 - dw / 2, wy - m(0.2), dw, H - wy + m(0.2));
    g.fillStyle = "rgba(160,190,230,0.6)"; g.fillRect(W / 2 - dw / 2 + m(0.15), wy, dw - m(0.3), m(1.2));
    g.fillStyle = "#e8c45a"; g.beginPath(); g.arc(W / 2 + dw / 2 - m(0.18), H - m(1.1), m(0.05), 0, 7); g.fill();
  });
};
const coirTex = () => ctex("coir", 512, 320, (g, r) => {
  g.fillStyle = "#b8864a"; g.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.5 ? "rgba(90,60,30,0.35)" : "rgba(230,190,130,0.35)"; g.fillRect(r() * 512, r() * 320, 1 + r() * 2, 4 + r() * 6); }
  g.strokeStyle = "#5a3b22"; g.lineWidth = 14; g.strokeRect(10, 10, 492, 300);
  g.font = '900 78px "Arial Black", Arial, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#4a2e18"; g.fillText("WELCOME", 256, 166);
});
const busTex = () => ctex("busRed", 1024, 512, (g) => {
  g.fillStyle = "#d1262c"; g.fillRect(0, 0, 1024, 512);
  for (const [y, h] of [[40, 120], [270, 110]] as const) {
    g.fillStyle = "#3b4466"; g.fillRect(30, y, 964, h);
    g.fillStyle = "rgba(190,210,240,0.45)"; for (let x = 30; x < 994; x += 120) g.fillRect(x + 10, y + 8, 18, h - 16);
    g.fillStyle = "#d1262c"; for (let x = 150; x < 994; x += 120) g.fillRect(x - 4, y, 8, h);
  }
  g.fillStyle = "#f2efe6"; g.fillRect(0, 222, 1024, 12);
  g.fillStyle = "#2a2430"; g.fillRect(0, 490, 1024, 22);
});
const badgeTex = () => ctex("catBadge", 256, 256, (g) => { // badge rond : une tête de chat stylisée (pas le vrai logo)
  const gr = g.createRadialGradient(100, 90, 10, 128, 128, 128); gr.addColorStop(0, "#f4f6fa"); gr.addColorStop(0.7, "#aeb6c2"); gr.addColorStop(1, "#6f7886");
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
  g.fillStyle = "#1f5a3a"; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.fill();
  g.fillStyle = "#e8c45a"; g.beginPath();
  g.moveTo(70, 150); g.lineTo(78, 70); g.lineTo(108, 102); g.lineTo(148, 102); g.lineTo(178, 70); g.lineTo(186, 150); g.quadraticCurveTo(128, 205, 70, 150); g.fill();
  g.fillStyle = "#1f5a3a"; g.beginPath(); g.ellipse(106, 135, 9, 13, 0, 0, 7); g.ellipse(150, 135, 9, 13, 0, 0, 7); g.fill();
});
const waterTex = () => ctex("poolWater", 512, 512, (g, r) => {
  g.fillStyle = "#39b7d6"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(225,250,255,0.55)"; g.lineWidth = 5; g.lineCap = "round";
  for (let i = 0; i < 70; i++) { const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 12, x + 44, y + 2); g.stroke(); }
});
const sandTex = () => ctex("sandLV", 512, 512, (g, r) => {
  g.fillStyle = "#e3c08c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { g.fillStyle = r() < 0.5 ? "rgba(170,120,70,0.25)" : "rgba(255,240,210,0.3)"; g.fillRect(r() * 512, r() * 512, 2, 2); }
});
const deckTex = () => ctex("poolDeck", 512, 512, (g, r) => {
  g.fillStyle = "#efe2c8"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) { const v = 228 + Math.floor(r() * 18); g.fillStyle = `rgb(${v},${v - 12},${v - 34})`; g.fillRect(x + 2, y + 2, 60, 60); }
});

// ---------------- géométrie ----------------
/** surface en grille : fn(u, v) pour u, v dans 0..1 ; normale = du x dv ; uv = (u * us, v * vs) */
const surf = (nu: number, nv: number, fn: (u: number, v: number) => [number, number, number], us = 1, vs = 1) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(i / nu, j / nv)); uv.push((i / nu) * us, (j / nv) * vs); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const flatUp = (x0: number, x1: number, z0: number, z1: number, y: number, us: number, vs: number) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), us, vs);
const M4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(sx, sy, sz));
const between = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 6) => {
  const g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg, 1, true);
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1)));
};

/** la tour : plus large en haut, façade sud concave (en plan ET en coupe) tournée vers la rue */
const TH = TOWER.h;
const tw = (y: number) => 42 + 12 * (y / TH);                                   // largeur
const zS = (x: number, y: number) => TOWER.z + 13 + 17 * (y / TH) ** 2 + 6 * ((2 * x) / tw(y)) ** 2; // façade sud
const zN = (y: number) => TOWER.z - 13 - 4 * (y / TH) ** 2;                     // façade nord
/** point de la façade sud (sx = -1..1 sur la largeur, y en mètres) */
export const facadeAt = (sx: number, y: number) => V(TOWER.x + (sx * tw(y)) / 2, y, zS((sx * tw(y)) / 2, y));
const towerGeos = () => {
  const ny = 40;
  const south = surf(28, ny, (u, v) => { const y = v * TH, x = (u - 0.5) * tw(y); return [TOWER.x + x, y, zS(x, y)]; }, 1, 1);
  const north = surf(8, ny, (u, v) => { const y = v * TH, x = (0.5 - u) * tw(y); return [TOWER.x + x, y, zN(y)]; }, 1, 1);
  const east = surf(10, ny, (u, v) => { const y = v * TH, x = tw(y) / 2; return [TOWER.x + x, y, zS(x, y) + (zN(y) - zS(x, y)) * u]; }, 0.6, 1);
  const west = surf(10, ny, (u, v) => { const y = v * TH, x = -tw(y) / 2; return [TOWER.x + x, y, zN(y) + (zS(x, y) - zN(y)) * u]; }, 0.6, 1);
  const top = surf(12, 6, (u, v) => { const x = (u - 0.5) * tw(TH); return [TOWER.x + x, TH + 9 * v, zS(x, TH) + (zN(TH) - zS(x, TH)) * v]; }, 1, 0.3);
  return { glass: mergeGeometries([south, north, east, west].map((g) => g.toNonIndexed()), false), top };
};
/** pare-soleil horizontaux sur la façade sud : une lame tous les 4 m, posées de bas en haut */
const FINS = Array.from({ length: 33 }, (_, k) => 12 + k * 4.1);
const finGeo = () => mergeGeometries(FINS.map((y) => surf(24, 1, (u, v) => { const x = (u - 0.5) * tw(y) * 0.98; return [TOWER.x + x, y + 0.15 * v, zS(x, y) + 0.2 + 1.6 * v]; }).toNonIndexed()), false);

/** un bloc de bureaux plat, façade avant tournée vers +z locale */
const block = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, seed: number, check = true) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.5, hz = (across ? w : d) / 2 + 0.5;
  if (check && inTheWay(x - hx, x + hx, 0, h, z - hz, z + hz)) return;
  const m = M4(x, 0, z, yaw), tex = lam("office" + (seed % 5) + "_" + Math.round(w) + "_" + Math.round(h), () => ({ map: rep(officeTex(seed % 5), Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 48))) }));
  const texD = lam("office" + (seed % 5) + "_" + Math.round(d) + "_" + Math.round(h), () => ({ map: rep(officeTex(seed % 5), Math.max(1, Math.round(d / 12)), Math.max(1, Math.round(h / 48))) }));
  const hw = w / 2, hd = d / 2;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), tex, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), tex, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), texD, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), texD, m);
  b.add(flatUp(-hw, hw, -hd, hd, h, 1, 1), lam("roofFlat", () => ({ color: "#8d8a90" })), m);
  b.add(boxGeo(V(-hw * 0.4, h, -hd * 0.4), V(hw * 0.2, h + 2.2, hd * 0.1)), lam("plant", () => ({ color: "#b9b6ae" })), m); // local technique
};

/** une maison-commerce londonienne (façade avant vers +z locale) */
const shopHouse = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.3, hz = (across ? w : d) / 2 + 0.3;
  if (inTheWay(x - hx, x + hx, 0, h + 1, z - hz, z + hz)) return;
  const shop: Shop = si < 0 ? { name: "GODZY", fascia: "#2f5f6a", ink: "#ffffff", godzy: true } : SHOPS[si % SHOPS.length];
  const brick = BRICKS[Math.abs(si) % BRICKS.length], key = `${si}_${w}_${h}`;
  const front = lam("rowF" + key, () => ({ map: rowTex(key, w, h, shop, brick) }));
  const side = lam("rowS" + brick, () => ({ color: brick }));
  const m = M4(x, 0, z, yaw), hw = w / 2, hd = d / 2;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(flatUp(-hw, hw, -hd, hd, h, 1, 1), lam("roofFlat", () => ({ color: "#8d8a90" })), m);
  const trim = lam("trimL", () => ({ color: "#efe6d4" }));
  b.add(boxGeo(V(-hw - 0.05, h - 0.45, hd), V(hw + 0.05, h, hd + 0.25)), trim, m);              // corniche
  b.add(boxGeo(V(-hw - 0.05, 3.85, hd), V(hw + 0.05, 4.2, hd + 0.3)), lam("fasciaTop", () => ({ color: "#2a2430" })), m); // haut de vitrine
  for (const s of [-1, 1]) b.add(boxGeo(V(s * hw - 0.18, 0, hd), V(s * hw + 0.18, 4.2, hd + 0.18)), trim, m); // pilastres
  b.add(boxGeo(V(-0.9, 0, hd - 0.05), V(0.9, 0.12, hd + 0.5)), lam("stepL", () => ({ color: "#bdb9b2" })), m);  // marche
  for (const cx of [-hw + 1, hw - 1]) b.add(boxGeo(V(cx - 0.35, h, -0.4), V(cx + 0.35, h + 1.4, 0.4)), lam("chimL", () => ({ color: "#9c4f3a" })), m); // cheminées
};

// ---------------- la Jaguar ----------------
const CAR_L = 4.8, CAR_W = 1.84;
const carShape = (pts: [number, number][]) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
const extrude = (pts: [number, number][], depth: number, bevel = 0.07) => {
  const g = new THREE.ExtrudeGeometry(carShape(pts), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return toCreasedNormals(g, 0.7);
};
const LOWER: [number, number][] = [[-2.35, 0.3], [2.32, 0.3], [2.4, 0.55], [2.28, 0.8], [0.95, 0.92], [-1.55, 0.96], [-2.3, 0.88], [-2.42, 0.56]];
const CABIN: [number, number][] = [[0.95, 0.9], [0.15, 1.38], [-1.15, 1.41], [-1.75, 0.94]];
const WINDOW: [number, number][] = [[0.78, 0.98], [0.12, 1.33], [-1.1, 1.36], [-1.56, 0.99]];

// ---------------- les nuages et le reste ----------------
type CarParts = { root: THREE.Group; body: THREE.Mesh; base: Float32Array; mirror: THREE.Group; mirrorDrip: THREE.Mesh; badge: THREE.Mesh; badgeDrip: THREE.Mesh; paint: THREE.MeshPhongMaterial };

const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 3) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len: Math.min(len, 60), core: sx === 0 && sy === 0 });
  }
  return out;
};

/** plans où l'on voit la ville de haut ou de loin : brouillard repoussé */
const FAR_SHOT = new Set([2, 4, 20, 21, 23, 25]);
/** bus : position x de départ par plan (il roule vers +x à 6 m/s dans la voie nord) */
const BUS_AT: Record<number, number> = { 2: -60, 6: -34, 16: -40, 17: -12 };

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
  private cloudMaps: Record<"day" | "golden" | "gris", THREE.Texture[]>;
  private clouds: { m: THREE.Mesh; a: number; d: number; y: number }[] = [];
  private glassMat: THREE.MeshPhongMaterial; private glassMaps: { day: THREE.Texture; gold: THREE.Texture };
  private fins: THREE.Mesh; private finCount = 0;
  private car!: CarParts;
  private bus = new THREE.Group();
  private hot: THREE.Mesh; private hotMat: THREE.MeshBasicMaterial;
  private glare: THREE.Mesh; private glareMat: THREE.MeshBasicMaterial;
  private rays: THREE.Mesh; private rayMat: THREE.MeshBasicMaterial; private rayIdx = 0;
  private lensBeam: THREE.Mesh; private lensMat: THREE.MeshBasicMaterial;
  private lensSpot: THREE.Mesh; private spotMat: THREE.MeshBasicMaterial;
  private magnifier = new THREE.Group();
  private vegasHot: THREE.Mesh; private vegasMat: THREE.MeshBasicMaterial;
  private pan = new THREE.Group(); private mat: THREE.Mesh; private matMat: THREE.MeshLambertMaterial;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- ciel + lumière (comme le modèle) ----
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
      gris: [0, 1, 2, 3].map((k) => cloudHD(k + 4, LOOK.gris.cloud)) };
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push({ m, a: (i / 12) * Math.PI * 2 + 0.3, d: 560 + (i % 3) * 70, y: 110 + (i % 4) * 36 }); R.add(m);
    }

    // ---- sol : asphalte, trottoirs, bordures, marquage ----
    const b = new Batch();
    const asph = lam("asphalt", () => ({ map: asphaltTex() })), pave = lam("pave", () => ({ map: paveTex() }));
    const kerb = lam("kerb", () => ({ color: "#c9c5bd" })), yellow = lam("yellowLine", () => ({ color: "#f2c230" })), white = lam("whiteLine", () => ({ color: "#f4f1ea" }));
    b.add(flatUp(-900, 900, -900, 900, -0.02, 180, 180), lam("groundFar", () => ({ color: "#8f8f8c" })));
    b.add(flatUp(-320, 320, -4.4, 4.6, 0, 80, 1.12), asph);              // la rue
    for (const zc of [-60, 40, 90]) b.add(flatUp(-320, 320, zc - 4.5, zc + 4.5, 0.001, 80, 1.12), asph); // rues parallèles (vue du ciel)
    for (const xc of [-90, -45, 45, 90, 140]) b.add(flatUp(xc - 4.5, xc + 4.5, -320, 260, 0.002, 1.12, 72), asph);
    b.add(flatUp(-320, 320, 4.6, SHOP_Z + 12, 0.12, 133, 3), pave);     // trottoir sud (jusqu'aux boutiques)
    b.add(flatUp(-320, 320, -42, -4.4, 0.12, 133, 8), pave);           // trottoir nord + parvis de la tour
    b.add(boxGeo(V(-320, 0, 4.45), V(320, 0.12, 4.6)), kerb);
    b.add(boxGeo(V(-320, 0, -4.4), V(320, 0.12, -4.25)), kerb);
    for (const z of [4.2, 4.33, -3.9, -4.03]) b.add(flatUp(-320, 320, z - 0.05, z + 0.05, 0.004, 1, 1), yellow); // doubles lignes jaunes
    for (let x = -318; x < 320; x += 6) b.add(flatUp(x, x + 3, 0.02, 0.18, 0.004, 1, 1), white);           // ligne centrale
    for (let k = 0; k < 6; k++) b.add(flatUp(-14 + k * 0.9, -14 + k * 0.9 + 0.5, -4.2, 4.4, 0.005, 1, 1), white); // passage piéton

    // ---- la tour ----
    this.glassMaps = { day: glassTex(false), gold: glassTex(true) };
    this.glassMat = twoTone(new THREE.MeshPhongMaterial({ map: this.glassMaps.day, specular: "#9fb3c8", shininess: 50, side: THREE.DoubleSide }), 0.6);
    const tg = towerGeos();
    const tower = new THREE.Mesh(tg.glass, this.glassMat); tower.castShadow = true; tower.receiveShadow = true; R.add(tower);
    const crown = new THREE.Mesh(tg.top, twoTone(new THREE.MeshPhongMaterial({ map: rep(this.glassMaps.day, 1, 0.3), specular: "#c8d8e8", shininess: 60, side: THREE.DoubleSide })));
    crown.castShadow = true; R.add(crown);
    // base : hall vitré en retrait et socle de pierre
    b.add(boxGeo(V(TOWER.x - 22, 0, zN(0) + 1), V(TOWER.x + 22, 7, zS(0, 0) - 0.5)), lam("lobby", () => ({ color: "#3f4f6a" })));
    b.add(boxGeo(V(TOWER.x - 24, 0, zS(0, 0) - 0.2), V(TOWER.x + 24, 0.6, zS(0, 0) + 2.5)), lam("plinthL", () => ({ color: "#d6d0c4" })));
    this.fins = new THREE.Mesh(finGeo(), twoTone(new THREE.MeshLambertMaterial({ color: "#eef0f2", side: THREE.DoubleSide })));
    this.fins.castShadow = true; R.add(this.fins);
    this.finCount = (this.fins.geometry.attributes.position.count / FINS.length);

    // ---- lignes de visée : on retire ce qui boucherait un plan ----
    setSight(sightLines());
    // rangée de boutiques au sud (façades vers -z, à SHOP_Z) ; la boutique Godzy est derrière le paillasson
    const bs = new Batch(); // les boutiques ne projettent pas d'ombre : le soleil couchant est derrière elles et doit éclairer la rue
    let x = -64, si = 0;
    while (x < 70) {
      const w = [6, 7.5, 9][si % 3], h = [13, 15.5, 11.5, 17][si % 4], cx = x + w / 2;
      const godzy = cx - w / 2 < MAT[0] && cx + w / 2 > MAT[0];
      shopHouse(bs, cx, SHOP_Z + 5, Math.PI, w, 10, godzy ? 14 : h, godzy ? -1 : si);
      x += w; si++;
    }
    // côté nord : blocs de bureaux de part et d'autre du parvis (façades vers +z)
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
      const w = 22 + (k % 2) * 8, cx = sx * (34 + k * 30 + w / 2 - 15);
      block(b, cx, -20, 0, w, 26, 26 + ((k * 17) % 30), k + (sx > 0 ? 2 : 0));
    }
    // la ville autour : tours de bureaux (vue du ciel), plus hautes vers le nord-ouest (la City)
    let seed = 3;
    for (let gx = -270; gx <= 270; gx += 30) for (let gz = -300; gz <= 220; gz += 30) {
      seed = (seed * 16807) % 2147483647;
      const rr = (seed % 1000) / 1000;
      if (Math.abs(gz) < 34 && Math.abs(gx) < 200) continue;      // la rue et ses deux rives
      if (Math.abs(gx - TOWER.x) < 42 && gz < 0 && gz > -100) continue; // la tour
      if (Math.hypot(gx + 95, gz + 125) < 40) continue;           // le cornichon
      const city = gz < 0 && gx < 120, h = city ? 30 + rr * 90 : 14 + rr * 30;
      block(b, gx + (rr - 0.5) * 6, gz + (rr - 0.5) * 6, (rr > 0.5 ? 0 : Math.PI / 2), 18 + rr * 8, 18 + (1 - rr) * 6, h, Math.floor(rr * 50));
    }
    // le « cornichon » (une tour en ogive, dessinée à notre façon)
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24, y = u * 175, r = 22 * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.9)) * (1 - 0.08 * u) + 1; pts.push(new THREE.Vector2(Math.max(0.5, r), y)); }
    const gher = new THREE.LatheGeometry(pts, 36);
    b.add(gher, lam("gherkin", () => ({ map: rep(ctex("gherkinT", 512, 512, (g) => {
      g.fillStyle = "#4f78a6"; g.fillRect(0, 0, 512, 512);
      for (let k = -8; k < 16; k++) { g.fillStyle = k % 2 ? "#2f4d78" : "#7ea2c8"; g.save(); g.translate(k * 48, 0); g.rotate(0.5); g.fillRect(0, -100, 20, 900); g.restore(); }
      g.strokeStyle = "rgba(230,236,245,0.6)"; g.lineWidth = 3; for (let y = 0; y < 512; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    }), 6, 4) })), M4(-95, 0, -125));
    // rangées d'arbres sur le parvis et lampadaires
    setVegCenter(0, 0);
    for (const tx of [-30, -20, 20, 30]) prop(b, kit, "tree_oak", tx, 0.12, -9.5, 6.5, tx);
    const iron = lam("ironL", () => ({ color: "#2b2f3a" }));
    for (let lx = -60; lx <= 60; lx += 15) for (const lz of [5.1, -4.9]) {
      if (Math.abs(lx - JAG[0]) < 3 && lz > 0) continue;
      b.add(new THREE.CylinderGeometry(0.07, 0.1, 5, 8).translate(0, 2.5, 0), iron, M4(lx, 0.12, lz));
      b.add(new THREE.CylinderGeometry(0.25, 0.15, 0.5, 6).translate(0, 5.2, 0), lam("lampL", () => ({ color: "#f4e6b8" })), M4(lx, 0.12, lz));
    }
    // cabine téléphonique rouge et borne
    const red = lam("phoneRed", () => ({ color: "#c8262c" }));
    b.add(boxGeo(V(-9.4, 0.12, SHOP_Z - 2.4), V(-8.4, 2.6, SHOP_Z - 1.4)), red);
    b.add(boxGeo(V(-9.5, 2.6, SHOP_Z - 2.5), V(-8.3, 2.85, SHOP_Z - 1.3)), red);
    b.add(boxGeo(V(-9.2, 0.9, SHOP_Z - 2.42), V(-8.6, 2.3, SHOP_Z - 2.39)), lam("phoneGlass", () => ({ color: "#9fb4dc" })));
    b.add(new THREE.CylinderGeometry(0.28, 0.3, 1.3, 14).translate(0, 0.65, 0), red, M4(10.5, 0.12, SHOP_Z - 1.0));
    b.add(new THREE.SphereGeometry(0.29, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, M4(10.5, 1.42, SHOP_Z - 1.0));

    // ---- le parc (la loupe) ----
    const grass = lam("grassHD", () => ({ map: grassHD() }));
    b.add(flatUp(PARK[0] - 60, PARK[0] + 60, PARK[2] - 60, PARK[2] + 60, 0.01, 30, 30), grass);
    b.add(flatUp(PARK[0] - 1.5, PARK[0] + 9, PARK[2] - 4.5, PARK[2] - 3.2, 0.02, 4, 1), lam("pathP", () => ({ color: "#d8c6a0" })));
    setVegCenter(PARK[0], PARK[2]);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.2, d = 11 + (i % 3) * 5;
      prop(b, kit, ["tree_oak", "tree_fat", "tree_default"][i % 3], PARK[0] + Math.cos(a) * d, 0.01, PARK[2] + Math.sin(a) * d, 7 + (i % 4), i);
    }
    for (const [dx, dz] of [[-3, 2.5], [3.5, -2.5], [-2.2, -3]]) prop(b, kit, "plant_bushLarge", PARK[0] + dx, 0.01, PARK[2] + dz, 0.9);
    b.add(boxGeo(V(PARK[0] - 3.4, 0.4, PARK[2] - 2.2), V(PARK[0] - 1.6, 0.48, PARK[2] - 1.8)), lam("benchW", () => ({ color: "#a8724a" })));
    for (const s of [-1, 1]) b.add(boxGeo(V(PARK[0] - 2.5 + s * 0.8 - 0.05, 0, PARK[2] - 2.15), V(PARK[0] - 2.5 + s * 0.8 + 0.05, 0.4, PARK[2] - 1.85)), iron);

    // ---- Las Vegas ----
    b.add(flatUp(LV[0] - 300, LV[0] + 300, LV[2] - 300, LV[2] + 300, 0.01, 60, 60), lam("sandLV", () => ({ map: sandTex() })));
    b.add(flatUp(LV[0] - 26, LV[0] + 26, LV[2] - 46, LV[2] + 16, 0.03, 10, 12), lam("deckLV", () => ({ map: deckTex() })));
    const vg = surf(30, 30, (u, v) => { const y = v * 110, xx = (u - 0.5) * 84; return [LV[0] + xx, y, LV[2] - 60 + 14 * (xx / 42) ** 2]; }, 1, 1);
    const vb = surf(10, 30, (u, v) => { const y = v * 110, xx = (0.5 - u) * 84; return [LV[0] + xx, y, LV[2] - 76 + 6 * (xx / 42) ** 2]; }, 1, 1);
    const vs = [-1, 1].map((s) => surf(4, 30, (u, v) => { const y = v * 110, xx = s * 42; return s > 0 ? [LV[0] + xx, y, LV[2] - 46 - 24 * u] : [LV[0] + xx, y, LV[2] - 70 + 24 * u]; }, 0.3, 1));
    const vMat = twoTone(new THREE.MeshPhongMaterial({ map: vegasTex(), specular: "#e8d2a8", shininess: 40, side: THREE.DoubleSide }), 0.6);
    const vegas = new THREE.Mesh(mergeGeometries([vg, vb, ...vs].map((g) => g.toNonIndexed()), false), vMat);
    vegas.castShadow = true; vegas.receiveShadow = true; R.add(vegas);
    b.add(flatUp(LV[0] - 42, LV[0] + 42, LV[2] - 76, LV[2] - 46, 110, 1, 1), lam("roofFlat", () => ({ color: "#8d8a90" })));
    // la piscine, ses margelles, les transats et les parasols
    const water = new THREE.Mesh(flatUp(LV[0] - 9, LV[0] + 9, LV[2] - 13, LV[2] - 4, 0.0, 3, 1.5), lam("poolWater", () => ({ map: waterTex() })));
    water.position.y = 0.05; water.receiveShadow = true; R.add(water);
    const coping = lam("coping", () => ({ color: "#f4efe6" }));
    for (const [x0, x1, z0, z1] of [[-9.3, 9.3, -13.3, -13], [-9.3, 9.3, -4, -3.7], [-9.3, -9, -13, -4], [9, 9.3, -13, -4]] as const)
      b.add(boxGeo(V(LV[0] + x0, 0, LV[2] + z0), V(LV[0] + x1, 0.09, LV[2] + z1)), coping);
    const lounger = lam("lounger", () => ({ map: ctex("loungerT", 128, 256, (g) => { for (let y = 0; y < 256; y += 32) { g.fillStyle = (y / 32) % 2 ? "#f4f1ea" : "#3f8fc8"; g.fillRect(0, y, 128, 32); } }) }));
    for (let k = -3; k <= 3; k++) {
      const lx = LV[0] - 0.2 + k * 1.6, lz = LV[2] - 1.9;
      b.add(boxGeo(V(lx - 0.35, 0.3, lz - 0.9), V(lx + 0.35, 0.38, lz + 0.6)), lounger);
      b.add(quad(V(lx - 0.35, 0.38, lz - 0.9), V(lx + 0.35, 0.38, lz - 0.9), V(lx + 0.35, 0.95, lz - 1.3), V(lx - 0.35, 0.95, lz - 1.3)), lounger);
      for (const s of [-1, 1]) for (const zz of [-0.8, 0.5]) b.add(boxGeo(V(lx + s * 0.3 - 0.03, 0.03, lz + zz - 0.03), V(lx + s * 0.3 + 0.03, 0.3, lz + zz + 0.03)), coping);
      if (k % 2 !== 0) {
        b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6).translate(0, 1.2, 0), coping, M4(lx + 0.8, 0.03, lz + 0.9));
        b.add(new THREE.ConeGeometry(1.2, 0.5, 8, 1, true).translate(0, 2.4, 0), lam("parasol", () => ({ color: "#f2c230", side: THREE.DoubleSide })), M4(lx + 0.8, 0.03, lz + 0.9));
      }
    }
    // palmiers : tronc courbe + palmes en ellipsoïdes aplatis
    const trunk = lam("palmTrunk", () => ({ color: "#a2794e" })), frond = lam("palmFrond", () => ({ color: "#4f9a3c" }));
    for (const [dx, dz, h] of [[-14, -8, 9], [14, -8, 10], [-20, 6, 8], [20, 4, 9.5], [-6, 10, 7.5], [8, 12, 8.5]] as const) {
      const px = LV[0] + dx, pz = LV[2] + dz;
      let prev = V(px, 0, pz);
      for (let i = 1; i <= 6; i++) { const u = i / 6, p = V(px + 0.8 * u * u, h * u, pz); b.add(between(prev, p, 0.24 - 0.08 * u, 0.24 - 0.08 * (u - 1 / 6), 8), trunk); prev = p; }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, g = new THREE.SphereGeometry(1, 10, 6);
        g.scale(1.9, 0.12, 0.45); g.translate(1.6, 0, 0); g.rotateZ(-0.35); g.rotateY(a);
        b.add(g, frond, M4(prev.x, prev.y, prev.z));
      }
    }
    // montagnes au loin
    const hill = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    ([[-180, -330, 160, 60, 90], [40, -380, 220, 80, 110], [-380, -250, 180, 55, 100]] as const).forEach(([dx, dz, sx, sy, sz], i) =>
      b.add(hill, lam("mount" + i, () => ({ color: ["#c99d73", "#b98f6c", "#d4a97d"][i] })), new THREE.Matrix4().compose(V(LV[0] + dx, -2, LV[2] + dz), new THREE.Quaternion(), V(sx, sy, sz))));
    b.build(R);
    bs.build(R, false);
    setSight([]);

    // ---- signatures « Godzy » : panneau d'affichage à Las Vegas (la boutique et le bus portent les deux autres) ----
    const bill = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), new THREE.MeshBasicMaterial({ map: godzyTexture({ w: 1024, h: 320 }) }));
    bill.position.set(LV[0] + 24, 12, LV[2] - 18); bill.rotation.y = -0.45; bill.layers.set(NOINK); R.add(bill);
    const billBack = new THREE.Mesh(new THREE.BoxGeometry(14.4, 4.8, 0.3), lam("billBack", () => ({ color: "#3a3d47" })));
    billBack.position.set(LV[0] + 24, 12, LV[2] - 18).addScaledVector(V(Math.sin(-0.45), 0, Math.cos(-0.45)), -0.2); billBack.rotation.y = -0.45; billBack.castShadow = true; R.add(billBack);
    for (const s of [-4, 4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 8), lam("ironL", () => ({ color: "#2b2f3a" }))); p.position.set(LV[0] + 24 + s * Math.cos(-0.45), 5, LV[2] - 18 - s * Math.sin(-0.45) - 0.3); R.add(p); }

    // ---- le bus à impériale (pub GODZY sur le flanc côté trottoir) ----
    const busBody = new THREE.Mesh(boxGeo(V(-5.5, 0.35, -1.25), V(5.5, 4.4, 1.25)), lam("bus", () => ({ map: busTex() })));
    busBody.castShadow = true; this.bus.add(busBody);
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.9), new THREE.MeshBasicMaterial({ map: godzyTexture({ w: 1024, h: 200, bg: "#f2d58a" }) }));
    ad.position.set(-0.6, 2.2, 1.27); ad.layers.set(NOINK); this.bus.add(ad);
    for (const wx of [-3.6, 3.4]) for (const wz of [-1.1, 1.1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16).rotateX(Math.PI / 2), lam("tyre", () => ({ color: "#26262c" })));
      w.position.set(wx, 0.5, wz); this.bus.add(w);
    }
    this.bus.visible = false; R.add(this.bus);

    // ---- la Jaguar ----
    this.buildCar(R);
    // ---- le vélo ----
    const bike = new THREE.Group(), metal = twoTone(new THREE.MeshPhongMaterial({ color: "#2f6fb0", specular: "#ffffff", shininess: 60 }));
    for (const wx of [-0.52, 0.55]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 28), lam("tyre", () => ({ color: "#26262c" }))); w.position.set(wx, 0.36, 0); bike.add(w); }
    const fr = (a: number[], c: number[]) => { const m = new THREE.Mesh(between(V(a[0], a[1], 0), V(c[0], c[1], 0), 0.025), metal); bike.add(m); };
    fr([-0.52, 0.36], [-0.05, 0.36]); fr([-0.05, 0.36], [0.38, 0.82]); fr([-0.12, 0.88], [0.38, 0.82]); fr([-0.05, 0.36], [-0.12, 0.88]);
    fr([-0.52, 0.36], [-0.12, 0.88]); fr([0.55, 0.36], [0.38, 0.82]); fr([0.38, 0.82], [0.32, 1.02]);
    const bar = new THREE.Mesh(between(V(0.32, 1.02, -0.28), V(0.32, 1.02, 0.28), 0.02), metal); bike.add(bar);
    const seat = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), lam("seatL", () => ({ color: "#3a2c2c" })));
    seat.scale.set(0.15, 0.045, 0.08); seat.position.set(-0.12, 0.92, 0); bike.add(seat);
    bike.position.set(BIKE[0], 0.12, BIKE[2]); bike.rotation.y = 0.15;
    bike.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    R.add(bike);
    // ---- le paillasson ----
    this.matMat = twoTone(new THREE.MeshLambertMaterial({ map: coirTex() }));
    this.mat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.6), [this.matMat, this.matMat, this.matMat, this.matMat, this.matMat, this.matMat]);
    this.mat.position.set(MAT[0], 0.135, MAT[2]); this.mat.rotation.y = Math.PI; this.mat.receiveShadow = true; R.add(this.mat);
    // ---- la poêle ----
    const panM = twoTone(new THREE.MeshPhongMaterial({ color: "#2b2d33", specular: "#888888", shininess: 40 }));
    const panB = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.04, 24), panM); panB.position.y = 0.02;
    const panH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.035), panM); panH.position.set(0.26, 0.035, 0);
    this.pan.add(panB, panH); this.pan.position.set(PAN[0], 0.12, PAN[2]); this.pan.rotation.y = 0.6; this.pan.traverse((o) => { o.castShadow = true; }); R.add(this.pan);

    // ---- la lumière concentrée : tache au sol, éblouissement sur la façade, rayons ----
    this.hotMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(2.6, 2.0, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.hot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.hotMat);
    this.hot.position.set(HOT[0], 0.14, HOT[2]); this.hot.scale.set(13, 1, 7); this.hot.renderOrder = 2; this.hot.layers.set(NOINK); R.add(this.hot);
    this.glareMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(3, 2.3, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glareMat); this.glare.layers.set(NOINK); this.glare.renderOrder = 3; R.add(this.glare);
    const rayG: THREE.BufferGeometry[] = [];
    let rs = 7;
    const rr = () => { rs = (rs * 16807) % 2147483647; return (rs % 10000) / 10000; };
    for (let k = 0; k < 48; k++) {
      const p0 = facadeAt(rr() * 1.7 - 0.85, 25 + rr() * 110), p1 = V(HOT[0] + (rr() - 0.5) * 3, 0.2, HOT[2] + (rr() - 0.5) * 1.5);
      rayG.push(between(p0, p1, 0.18 + rr() * 0.25, 0.05, 5).toNonIndexed());
    }
    this.rayIdx = rayG[0].attributes.position.count;
    this.rayMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.7), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.rays = new THREE.Mesh(mergeGeometries(rayG, false), this.rayMat); this.rays.layers.set(NOINK); this.rays.frustumCulled = false; this.rays.renderOrder = 4; R.add(this.rays);
    // la loupe : faisceau en cône et point brûlant
    this.lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.2, 0.7), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.lensBeam = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.0, 1, 24, 1, true).translate(0, -0.5, 0), this.lensMat);
    this.lensBeam.layers.set(NOINK); this.lensBeam.renderOrder = 4; R.add(this.lensBeam);
    this.spotMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(4, 3.2, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.lensSpot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.spotMat); this.lensSpot.layers.set(NOINK); this.lensSpot.renderOrder = 5; R.add(this.lensSpot);
    const rim = twoTone(new THREE.MeshPhongMaterial({ color: "#2b2d33", specular: "#ffffff", shininess: 80 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 10, 32), rim); ring.rotation.x = Math.PI / 2;
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#cfe6ff", transparent: true, opacity: 0.25, depthWrite: false }));
    glass.layers.set(NOINK);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8).rotateZ(Math.PI / 2), lam("handleL", () => ({ color: "#8a5a34" }))); handle.position.x = 0.19;
    this.magnifier.add(ring, glass, handle); this.magnifier.visible = false; R.add(this.magnifier);
    // Las Vegas : la zone brûlante autour des transats
    this.vegasMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(2.2, 1.7, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.vegasHot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.vegasMat);
    this.vegasHot.position.set(LV[0] - 0.4, 0.06, LV[2] - 1.8); this.vegasHot.scale.set(9, 1, 5); this.vegasHot.layers.set(NOINK); this.vegasHot.renderOrder = 2; R.add(this.vegasHot);
  }

  private buildCar(R: THREE.Object3D) {
    const root = new THREE.Group();
    const paint = twoTone(new THREE.MeshPhongMaterial({ color: "#1f6a44", specular: "#cfe8da", shininess: 70 }), 0.6);
    const chrome = twoTone(new THREE.MeshPhongMaterial({ color: "#c9ced6", specular: "#ffffff", shininess: 90 }));
    const glassM = twoTone(new THREE.MeshPhongMaterial({ color: "#3b4f78", specular: "#ffffff", shininess: 90 }));
    const body = new THREE.Mesh(extrude(LOWER, CAR_W - 0.14), paint);
    const base = new Float32Array(body.geometry.attributes.position.array as Float32Array);
    const cabin = new THREE.Mesh(extrude(CABIN, CAR_W - 0.42, 0.06), paint);
    for (const s of [-1, 1]) {
      const wg = new THREE.ShapeGeometry(carShape(WINDOW)); wg.translate(0, 0, s * ((CAR_W - 0.42) / 2 + 0.065));
      if (s < 0) wg.scale(1, 1, 1);
      root.add(new THREE.Mesh(wg, glassM));
    }
    // pare-brise et lunette
    root.add(new THREE.Mesh(quad(V(0.9, 0.95, -0.66), V(0.9, 0.95, 0.66), V(0.18, 1.36, 0.6), V(0.18, 1.36, -0.6)), glassM));
    root.add(new THREE.Mesh(quad(V(-1.7, 0.98, 0.66), V(-1.7, 0.98, -0.66), V(-1.15, 1.38, -0.6), V(-1.15, 1.38, 0.6)), glassM));
    // roues
    for (const wx of [-1.5, 1.45]) for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 20).rotateX(Math.PI / 2), lam("tyre", () => ({ color: "#26262c" })));
      w.position.set(wx, 0.36, s * (CAR_W / 2 - 0.12)); root.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16).rotateX(Math.PI / 2), chrome);
      hub.position.set(wx, 0.36, s * (CAR_W / 2 + 0.01)); root.add(hub);
    }
    // phares, calandre, pare-chocs
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: "#fff6d8" })); l.position.set(2.36, 0.68, s * 0.62); l.scale.set(0.5, 1, 1); root.add(l);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: "#d1262c" })); tl.position.set(-2.4, 0.72, s * 0.62); root.add(tl);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.7), lam("grilleL", () => ({ color: "#2b2d33" }))); grille.position.set(2.39, 0.55, 0); root.add(grille);
    for (const x of [2.44, -2.46]) { const bp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, CAR_W - 0.1), chrome); bp.position.set(x, 0.36, 0); root.add(bp); }
    // le badge (fond, logo qui se ramollit) et son goutte-à-goutte
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ map: badgeTex() }));
    badge.position.set(2.43, 0.58, 0); badge.layers.set(NOINK); root.add(badge);
    const badgeDrip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), chrome); badgeDrip.position.set(2.43, 0.45, 0); root.add(badgeDrip);
    // le rétroviseur (côté trottoir, +z)
    const mirror = new THREE.Group(); mirror.position.set(0.72, 1.0, (CAR_W - 0.14) / 2 + 0.05);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.16), paint); arm.position.z = 0.08; mirror.add(arm);
    const housing = new THREE.Group(); housing.position.z = 0.16; mirror.add(housing);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), paint); shell.scale.set(0.07, 0.07, 0.12); shell.position.z = 0.1; housing.add(shell);
    const glassMir = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20).rotateY(-Math.PI / 2), chrome); glassMir.position.set(-0.06, 0, 0.1); glassMir.scale.set(1, 1, 1.6); housing.add(glassMir);
    const mirrorDrip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 10).rotateX(Math.PI), paint); mirrorDrip.position.set(0, -0.08, 0.12); housing.add(mirrorDrip);
    root.add(body, cabin, mirror);
    root.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    root.position.set(JAG[0], 0, JAG[2]);
    R.add(root);
    this.car = { root, body, base, mirror: housing as unknown as THREE.Group, mirrorDrip, badge, badgeDrip, paint };
  }

  /** l'état de la voiture : rétroviseur, logo, carrosserie (0 intacte .. 1 fondue) */
  private carState(id: number, t: number) {
    const s = SHOTS[id - 1], u = clamp01((t - s.a / FPS) / Math.max(0.1, (s.b - s.a) / FPS));
    if (id === 22) return { m: 0, l: 0, b: 0 };
    if (id === 1) return { m: 0.6 + 0.4 * u, l: 1, b: 0.55 + 0.45 * u };
    const m = id < 11 || (id > 22) ? 0 : id === 11 ? ramp(t, 84, 86) : 1;
    const l = id < 12 ? 0 : id === 12 ? ramp(t, 88, 90) : 1;
    const b = id < 13 ? 0 : id === 13 ? ramp(t, 92, 94) : 1;
    return id >= 23 ? { m: 0, l: 0, b: 0 } : { m, l, b };
  }

  private poseCar(id: number, t: number) {
    const k = this.carState(id, t), C = this.car;
    // rétroviseur : la coque pique du nez et s'étire, une goutte pend
    C.mirror.rotation.x = 1.0 * k.m; C.mirror.scale.set(1, 1 + 0.7 * k.m, 1 - 0.15 * k.m);
    C.mirrorDrip.visible = k.m > 0.05; C.mirrorDrip.scale.setScalar(0.2 + 1.2 * k.m);
    // logo : s'allonge vers le bas, coule
    C.badge.scale.set(1, 1 + 0.9 * k.l, 1); C.badge.position.y = 0.58 - 0.07 * k.l;
    C.badgeDrip.visible = k.l > 0.05; C.badgeDrip.position.y = 0.45 - 0.12 * k.l; C.badgeDrip.scale.set(0.6 + 0.6 * k.l, 0.6 + 1.6 * k.l, 0.6 + 0.6 * k.l);
    // carrosserie : le flanc côté trottoir gondole et se creuse autour de la tache
    const pos = C.body.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array, B = C.base;
    for (let i = 0; i < pos.count; i++) {
      const x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2];
      const side = clamp01((z - 0.3) / 0.6), w = Math.exp(-(((x + 0.2) / 1.6) ** 2)) * side * k.b;
      a[i * 3] = x; a[i * 3 + 1] = y - 0.05 * w * (0.6 + 0.4 * Math.sin(x * 5));
      a[i * 3 + 2] = z - w * (0.05 + 0.06 * (0.5 + 0.5 * Math.sin(x * 9 + y * 6)));
    }
    pos.needsUpdate = true;
    // la peinture terne quand elle a chauffé, brillante une fois réparée
    C.paint.shininess = id === 22 ? 120 : 70 - 40 * k.b;
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
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 140);
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
    this.fog.near = far ? L.fogNear * 6 : L.fogNear; this.fog.far = far ? L.fogFar * 3.2 : L.fogFar;
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
      const cl = this.clouds[i], m = cl.m, mat = m.material as THREE.MeshBasicMaterial;
      m.position.set(cam.position.x + Math.cos(cl.a) * cl.d, cl.y + (s.light === "gris" ? -40 : 0), cam.position.z + Math.sin(cl.a) * cl.d);
      m.scale.set((s.light === "gris" ? 1.8 : 1) * (130 + (i % 4) * 30), (s.light === "gris" ? 1.4 : 1) * (65 + (i % 4) * 15), 1);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- la tour : verre chaud au soleil couchant, pare-soleil qui poussent (plan 23 et après) ----
    this.glassMat.map = s.light === "golden" ? this.glassMaps.gold : this.glassMaps.day;
    const fins = id < 23 ? 0 : id === 23 ? ramp(t, 181, 185) : 1;
    this.fins.visible = fins > 0;
    this.fins.geometry.setDrawRange(0, Math.round(fins * FINS.length) * this.finCount);
    // ---- le bus ----
    const bx = BUS_AT[id];
    this.bus.visible = bx !== undefined;
    if (bx !== undefined) this.bus.position.set(bx + 6 * (t - s.a / FPS), 0, -2.2);
    // ---- la Jaguar, le paillasson, la poêle ----
    this.poseCar(id, t);
    this.car.root.visible = id < 18 || id === 22;
    const mk = id < 9 ? 0 : id === 9 ? ramp(t, 75, 76) : 1;
    this.matMat.color.setScalar(1 - 0.45 * mk);
    this.pan.visible = id === 15 && t > at(101);
    // ---- la lumière concentrée ----
    const near = id === 15 ? 0.35 : id === 8 || id === 9 ? 0.6 : id === 1 || id >= 10 && id <= 14 ? 0.75 : 1;
    const hotK = near * (id === 1 ? 1 : id === 7 ? ramp(t, 60, 65) : (id >= 8 && id <= 15) || id === 17 || id === 20 || id === 21 ? 1 : 0);
    this.hot.visible = hotK > 0.01;
    this.hotMat.color.setRGB(1.9, 1.45, 0.85).multiplyScalar(hotK * (1 + 0.06 * Math.sin(t * 9)));
    const glareK = s.light === "golden" && id <= 21 ? (id === 6 ? 0.25 : id === 7 ? 0.3 + 0.7 * ramp(t, 60, 65) : 1) : 0;
    this.glare.visible = glareK > 0.01;
    if (glareK > 0) {
      const gp = facadeAt(0, 62);
      this.glare.position.copy(gp).add(V(0, 0, 6)); this.glare.quaternion.copy(cam.quaternion);
      const gs = 22 + 4 * Math.sin(t * 2.3);
      this.glare.scale.set(gs, gs, 1); this.glareMat.color.setRGB(2.4, 1.8, 1.1).multiplyScalar(glareK * 0.8);
    }
    const rayK = id === 20 ? ramp(t, 152, 157) : id === 21 ? 1 : 0;
    this.rays.visible = rayK > 0;
    this.rays.geometry.setDrawRange(0, Math.max(1, Math.round(rayK * 48)) * this.rayIdx);
    this.rayMat.opacity = 0.32 + 0.08 * Math.sin(t * 7);
    // ---- la loupe (plans 18-19) ----
    const lensOn = id === 18 || id === 19;
    this.lensBeam.visible = this.lensSpot.visible = lensOn;
    this.magnifier.visible = id === 19;
    if (lensOn) {
      const conc = ramp(t, 146, 151), leaf = V(PARK[0] + 0.55, 0.03, PARK[2] + 0.45);
      const lens = id === 19 ? V(PARK[0] + 0.5, 0.42, PARK[2] + 0.38) : V(PARK[0] + LENS18[0], LENS18[1], PARK[2] + LENS18[2]);
      this.magnifier.position.copy(lens); this.magnifier.rotation.set(0, 0.6, 0);
      const r = 0.1, spotR = 0.11 - 0.095 * conc;
      // tronc de cône : rayon de la loupe en haut, rayon du point en bas
      this.lensBeam.position.copy(lens);
      this.lensBeam.scale.set(r, lens.distanceTo(leaf), r);
      this.lensBeam.quaternion.setFromUnitVectors(V(0, -1, 0), leaf.clone().sub(lens).normalize());
      this.lensMat.opacity = 0.18 + 0.12 * conc;
      this.lensSpot.position.copy(leaf).add(V(0, 0.005, 0));
      this.lensSpot.scale.set(2.2 * spotR, 1, 2.2 * spotR);
      this.spotMat.color.setRGB(2.2, 1.8, 1.0).multiplyScalar(1 + 3 * conc);
    }
    // ---- Las Vegas ----
    this.vegasHot.visible = id === 25 || id === 26;
    this.vegasMat.color.setRGB(2.2, 1.7, 1.0).multiplyScalar(id === 26 ? 0.4 + 0.6 * ramp(t, 205, 207) : 0.5);

    // ---- distribution + effets ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st: Stage = stage(id, t, { pos: cam.position, right });
    this.extraFx(id, t, st);
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

  /** effets posés sur les objets du décor : cloques de la selle, œuf, feuille */
  private extraFx(id: number, t: number, st: Stage) {
    const q = (v: number) => Math.round(v * 30) / 30;
    if (id >= 8 && id <= 17) {
      const k = q(id === 8 ? ramp(t, 70, 73) : 1);
      if (k > 0) st.fx.push({ key: `blisters${k}`, cw: 240, ch: 120, draw: (p) => fxBlisters(p, k), x: BIKE[0] - 0.12 + 0.01, y: 0.12 + 0.97, z: BIKE[2] + 0.01, w: 0.3, h: 0.15 });
    }
    if (id === 15 && t > at(108)) {
      const k = q(clamp01((t - at(108)) / 0.6));
      st.fx.push({ key: `egg${k}`, cw: 300, ch: 300, draw: (p) => fxEgg(p, k), x: PAN[0], y: 0.12 + 0.045, z: PAN[2], w: 0.24, h: 0.24, flat: true, rot: 0.4 });
    }
    if (id === 18 || id === 19) {
      const k = q(smooth((t - at(148)) / 0.8));
      st.fx.push({ key: `leaf${k}`, cw: 300, ch: 200, draw: (p) => fxLeaf(p, k), x: PARK[0] + 0.55, y: 0.02, z: PARK[2] + 0.45, w: 0.3, h: 0.2, flat: true, rot: 0.5 });
    }
  }
}
/** la loupe du plan 18, relative au parc : tenue par l'enfant (main droite à l'écran), au-dessus de la feuille */
const LENS18: [number, number, number] = [0.15, 0.5, 0.05];
