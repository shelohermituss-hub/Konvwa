// « La tour qui faisait fondre les voitures » (Londres, 2013) : découpage, caméras, flou de profondeur.
// 60 i/s (règle du client). Chaque plan commence 2 images avant son mot (W = débuts des mots, words.ts).
// Grammaire caméra du skill : coupes franches entre les idées, glissements lents (smootherstep) pendant le plan,
// légère poussée sur chaque tenue, roulis de 2 à 4°, aucun tremblé à la main.
import { W, VOICE_END } from "./words";

export const FPS = 60;
export const D0 = 0; // la ville est à plat : sol à y = 0 (build.ts l'importe pour les maisons)
export const TOTAL = Math.round((VOICE_END + 1.6) * FPS);
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
/** temps (s) du mot k, moins l'avance de réaction (0 à 3 images avant le mot) */
export const at = (k: number, lead = 2 / FPS) => W[k] - lead;
/** 0 avant le mot a, 1 après le mot b, en douceur entre les deux */
export const ramp = (t: number, a: number, b: number) => smooth((t - at(a)) / Math.max(0.05, at(b) - at(a)));

// ---------------- lieux (mètres) ----------------
/** la tour du 20 Fenchurch Street : base au nord de la rue, façade sud concave tournée vers la rue */
export const TOWER = { x: 0, z: -45, h: 150 };
/** la tache de lumière sur le trottoir d'en face */
export const HOT: V3 = [4, 0, 6.2];
/** la Jaguar garée le long du trottoir sud, capot vers +x */
export const JAG: V3 = [6, 0, 3.6];
export const BIKE: V3 = [-2.5, 0, 7.7];
/** façades des boutiques du trottoir sud (tournées vers la rue, -z) */
export const SHOP_Z = 13;
/** le paillasson devant la porte de la boutique GODZY (lot x -5,5..3,5) */
export const MAT: V3 = [-1.0, 0.13, SHOP_Z - 0.45];
export const PAN: V3 = [3.3, 0.02, 6.8];
/** le parc (la loupe) et Las Vegas, loin de la rue */
export const PARK: V3 = [400, 0, 0];
export const LV: V3 = [-600, 0, 0];
/** hauteur du sol : trottoirs à 0,12 m, chaussée à 0, herbe du parc, dallage de Las Vegas */
export const groundY = (x: number, z: number) => {
  if (Math.abs(x - PARK[0]) < 100) return 0.01;
  if (Math.abs(x - LV[0]) < 300) return 0.03;
  return z > 4.6 || z < -4.4 ? 0.12 : 0;
};

// ---------------- plans ----------------
export type Light = "day" | "golden" | "gris";
export type ShotDef = { id: number; k: number; light: Light; a: number; b: number; sunAz?: number; sunEl?: number };
const DEF: { k: number; light: Light; sunAz?: number; sunEl?: number }[] = [
  { k: 0, light: "golden", sunAz: 160, sunEl: 12 },   // 1 accroche : la voiture fond, la tour derrière
  { k: 12, light: "day" },                             // 2 « Nous sommes en 2013 » : la City vue du ciel
  { k: 27, light: "day", sunAz: 150 },                 // 3 « plus large en haut qu'en bas » : contre-plongée
  { k: 33, light: "day", sunAz: 120 },                 // 4 « façade de verre bombée » : la courbe de profil
  { k: 43, light: "day", sunAz: 140 },                 // 5 « le Talkie-Walkie » : l'enfant et son talkie-walkie
  { k: 49, light: "golden", sunAz: 170, sunEl: 9 },    // 6 « Fin d'été, le soleil est bas » : la rue, ombres longues
  { k: 55, light: "golden", sunAz: 165, sunEl: 10 },   // 7 la tache de lumière apparaît
  { k: 66, light: "golden", sunAz: 150, sunEl: 10 },   // 8 la selle de vélo cloque
  { k: 74, light: "golden", sunAz: 150, sunEl: 10 },   // 9 le paillasson fume
  { k: 77, light: "golden", sunAz: 160, sunEl: 10 },   // 10 l'homme d'affaires retrouve sa Jaguar
  { k: 83, light: "golden", sunAz: 150, sunEl: 10 },   // 11 le rétroviseur fond
  { k: 87, light: "golden", sunAz: 150, sunEl: 10 },   // 12 le logo se ramollit
  { k: 91, light: "golden", sunAz: 160, sunEl: 10 },   // 13 la carrosserie gondole
  { k: 95, light: "golden", sunAz: 160, sunEl: 10 },   // 14 les journalistes accourent
  { k: 98, light: "golden", sunAz: 150, sunEl: 10 },   // 15 la poêle et l'œuf
  { k: 111, light: "gris" },                           // 16 « Heureusement… jamais de soleil »
  { k: 121, light: "golden", sunAz: 170, sunEl: 9 },   // 17 « Malheureusement… il y en avait »
  { k: 128, light: "day", sunAz: 120 },                // 18 la loupe au soleil (le parc)
  { k: 137, light: "day", sunAz: 110 },                // 19 la lumière serrée sur un seul point
  { k: 152, light: "golden", sunAz: 175, sunEl: 12 },  // 20 la tour fait pareil, en miroir
  { k: 158, light: "golden", sunAz: 175, sunEl: 12 },  // 21 des milliers de vitres vers le même coin de rue
  { k: 170, light: "day", sunAz: 140 },                // 22 la réparation de la Jaguar
  { k: 179, light: "day", sunAz: 130 },                // 23 les pare-soleil sur la façade
  { k: 186, light: "day", sunAz: 140 },                // 24 « Et le plus fort ? »
  { k: 190, light: "day", sunAz: 120, sunEl: 55 },     // 25 Las Vegas, le même architecte
  { k: 204, light: "day", sunAz: 140, sunEl: 60 },     // 26 la piscine : les cheveux qui roussissent
];
export const SHOTS: ShotDef[] = DEF.map((d, i) => ({
  id: i + 1, ...d,
  a: i === 0 ? 0 : Math.round(at(d.k) * FPS),
  b: i < DEF.length - 1 ? Math.round(at(DEF[i + 1].k) * FPS) : TOTAL,
}));
/** fondus enchaînés (images) aux changements de lieu ou de moment ; un flash blanc après l'accroche */
export const XFADE: Record<number, number> = { 16: 8, 17: 8, 18: 10, 22: 10, 25: 12 };
export const FLASH_AT = SHOTS[1].a;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- caméras ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Key = { p0: V3; p1: V3; l0: V3; l1?: V3; fov: number; fov1?: number; roll?: number };
const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const [px, , pz] = PARK, [lx, , lz] = LV;
const KEYS: Record<number, Key> = {
  1: { p0: [15.5, 1.15, 12.5], p1: [13.2, 1.05, 10.4], l0: [5.6, 2.6, 1.0], l1: [5.9, 2.2, 2.0], fov: 46, roll: -0.05 },
  2: { p0: [150, 150, 190], p1: [118, 128, 160], l0: [0, 55, -40], fov: 40, roll: 0.03 },
  3: { p0: [9, 1.7, 12.6], p1: [8.6, 1.7, 12.0], l0: [0, 95, -32], fov: 52, roll: 0.07 },
  4: { p0: [118, 58, -2], p1: [108, 62, 4], l0: [0, 70, -26], fov: 40, roll: -0.03 },
  5: { p0: [-6.3, 1.3, 12.6], p1: [-6.0, 1.3, 11.9], l0: [1, 9, -24], l1: [1, 10, -24], fov: 44, roll: 0.03 },
  6: { p0: [-26, 3.2, 6.5], p1: [-21.5, 3.0, 6.3], l0: [6, 2.2, 4.5], fov: 40, roll: -0.03 },
  7: { p0: [10.5, 7.5, 12.6], p1: [9.4, 6.8, 12.0], l0: [3.5, 0.2, 6.0], fov: 46, roll: 0.04 },
  8: { p0: [-1.0, 1.3, 9.8], p1: [-1.3, 1.22, 9.3], l0: [-2.5, 0.95, 7.7], fov: 36, roll: -0.04 },
  9: { p0: [0.8, 1.25, 10.2], p1: [0.5, 1.1, 10.6], l0: [-1.0, 0.2, 12.5], fov: 40, roll: 0.04 },
  10: { p0: [17, 1.6, 9.6], p1: [15, 1.55, 9.0], l0: [7, 1.3, 4.6], fov: 40, roll: -0.03 },
  11: { p0: [9.0, 1.25, 6.3], p1: [8.75, 1.18, 5.95], l0: [7.85, 1.0, 4.55], fov: 34, roll: 0.05 },
  12: { p0: [11.0, 1.05, 3.9], p1: [10.6, 1.0, 3.75], l0: [8.6, 0.78, 3.6], fov: 34, roll: -0.04 },
  13: { p0: [5.4, 1.35, 9.2], p1: [5.6, 1.28, 8.6], l0: [6, 0.8, 4.4], fov: 40, roll: 0.03 },
  14: { p0: [-1.6, 1.85, 12.6], p1: [-0.8, 1.8, 12.1], l0: [3.5, 1.2, 6.0], fov: 50, roll: -0.03 },
  15: { p0: [4.1, 0.75, 8.1], p1: [3.85, 0.62, 7.75], l0: [3.3, 0.06, 6.8], fov: 38, roll: 0.05 },
  16: { p0: [-26, 3.2, 6.5], p1: [-23.5, 3.1, 6.4], l0: [6, 2.2, 4.5], fov: 40, roll: -0.02 },
  17: { p0: [-23.5, 3.1, 6.4], p1: [-21, 3.0, 6.3], l0: [6, 2.0, 4.5], fov: 40, roll: -0.03 },
  18: { p0: [px + 3.3, 1.05, pz + 3.4], p1: [px + 2.9, 1.0, pz + 3.0], l0: [px + 0.3, 0.6, pz + 0.1], fov: 40, roll: 0.03 },
  19: { p0: [px + 1.3, 0.55, pz + 1.55], p1: [px + 1.1, 0.48, pz + 1.3], l0: [px + 0.55, 0.12, pz + 0.45], fov: 36, roll: -0.04 },
  20: { p0: [44, 18, 74], p1: [38, 17, 66], l0: [0, 48, -24], fov: 48, roll: 0.03 },
  21: { p0: [60, 64, 92], p1: [84, 92, 124], l0: [2, 22, -6], fov: 44, roll: -0.02 },
  22: { p0: [12.5, 1.6, 10], p1: [11.6, 1.55, 9.4], l0: [6, 1.3, 4.4], fov: 40, roll: 0.03 },
  23: { p0: [34, 34, 64], p1: [30, 40, 58], l0: [0, 72, -24], fov: 46, roll: -0.03 },
  24: { p0: [-5.9, 1.25, 11.6], p1: [-5.6, 1.2, 11.0], l0: [-4.4, 1.05, 9.0], fov: 32, roll: 0 },
  25: { p0: [lx + 48, 18, lz + 64], p1: [lx + 42, 20, lz + 56], l0: [lx, 34, lz - 52], fov: 46, roll: 0.02 },
  26: { p0: [lx + 3.2, 1.35, lz + 2.1], p1: [lx + 2.8, 1.28, lz + 1.7], l0: [lx + 0.2, 0.75, lz - 1.3], fov: 40, roll: -0.03 },
};
/** secousse d'impact : signe inversé à chaque image, amortie sur 7 images (fx de la rupture) */
const KICKS: { t: number; amp: number }[] = [{ t: 0, amp: 0 }];
export const kickAt = (t: number) => {
  let y = 0;
  for (const k of KICKS) { const n = Math.round((t - k.t) * FPS); if (n >= 0 && n < 7) y += k.amp * (1 - n / 7) * (n % 2 ? -1 : 1); }
  return y;
};
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1], K = KEYS[id], u = glide((f - s.a) / Math.max(1, s.b - s.a));
  const look = K.l1 ? lerp3(K.l0, K.l1, u) : K.l0;
  return { pos: add(lerp3(K.p0, K.p1, u), [0, kickAt(f / FPS), 0]), look, fov: K.fov + ((K.fov1 ?? K.fov) - K.fov) * u, roll: K.roll ?? 0 };
};

// ---------------- flou de profondeur (lensblur.ts) ----------------
/** cInf en pixels à 1080 de large : gros plans 12-16, plans moyens 10-12, larges et aériens 0 ; mise au point sur les yeux / l'objet */
export type Dof = { cInf: number; focus?: (f: number) => V3 };
const DOFS: Record<number, Dof> = {
  1: { cInf: 12, focus: () => [6.6, 1.0, 4.4] }, 2: { cInf: 0 }, 3: { cInf: 0 }, 4: { cInf: 0 }, 5: { cInf: 10, focus: () => [-4.5, 1.2, 9.1] },
  6: { cInf: 0 }, 7: { cInf: 6, focus: () => HOT }, 8: { cInf: 15, focus: () => [-2.45, 0.95, 7.7] }, 9: { cInf: 14, focus: () => MAT },
  10: { cInf: 10, focus: () => [9, 1.5, 6.4] }, 11: { cInf: 15, focus: () => [7.85, 1.0, 4.55] }, 12: { cInf: 15, focus: () => [8.6, 0.78, 3.6] },
  13: { cInf: 11, focus: () => [6, 0.8, 4.5] }, 14: { cInf: 8, focus: () => [2, 1.4, 6.5] }, 15: { cInf: 15, focus: () => PAN },
  16: { cInf: 0 }, 17: { cInf: 0 }, 18: { cInf: 11, focus: () => [px, 0.9, pz] }, 19: { cInf: 15, focus: () => [px + 0.55, 0.1, pz + 0.45] },
  20: { cInf: 0 }, 21: { cInf: 0 }, 22: { cInf: 10, focus: () => [8.6, 1.5, 6.6] }, 23: { cInf: 0 }, 24: { cInf: 13, focus: () => [-4.5, 1.2, 9.1] },
  25: { cInf: 0 }, 26: { cInf: 12, focus: () => [lx - 0.2, 0.75, lz - 1.6] },
};
export const dofAt = (f: number) => DOFS[shotAt(f).id];
