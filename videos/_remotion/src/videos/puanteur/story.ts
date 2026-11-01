// « La Grande Puanteur » (Londres, 1858) : découpage, caméras, flou de profondeur. 60 i/s (règle du client).
// Chaque plan commence 2 images avant son mot (W = débuts des mots, words.ts). Grammaire caméra du skill : coupes
// franches entre les idées, glissements lents pendant le plan, roulis de 2 à 4°, aucun tremblé.
import { W, VOICE_END } from "./words";

export const FPS = 60;
export const D0 = 0;
export const TOTAL = Math.round((VOICE_END + 1.6) * FPS);
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const at = (k: number, lead = 2 / FPS) => W[k] - lead;
export const ramp = (t: number, a: number, b: number) => smooth((t - at(a)) / Math.max(0.05, at(b) - at(a)));

// ---------------- lieux (mètres) ----------------
/** la Tamise coule le long de x, entre la rive sud (z = -110) et le quai nord (z = 0) ; l'eau est à -1,5 m */
export const RIVER = { zS: -110, zN: 0, y: -1.5 };
/** le Parlement : façade sur le fleuve à z = 8, terrasse entre le quai et la façade */
export const PARL = { x0: -62, x1: 62, z: 8, depth: 28, h: 20 };
export const CLOCK: V3 = [-74, 0, 20];   // la tour de l'horloge
export const VICT: V3 = [74, 0, 22];     // la grande tour carrée
export const BRIDGE_X = -98;             // le pont de Westminster
/** les bouches d'égout qui crachent dans le fleuve, et les usines derrière */
export const OUTFALL_X = [144, 150, 156];
/** la rue victorienne (axe le long de x à z = STREET_Z) ; façades à z = 142 (sud) et 158 (nord) */
export const STREET_Z = 150;
export const THERMO: V3 = [4, 1.75, 142.12];
/** la tranchée des égouts dans la rue */
export const TRENCH = { x0: 20, x1: 52, z: 150, w: 4, d: 3.2 };
export const BAZ: V3 = [26, 0, 146.6];
/** aujourd'hui : une rue moderne avec la poubelle et la plaque d'égout */
export const MOD: V3 = [500, 0, 0];
export const BIN: V3 = [500, 0.12, 3.0];
export const MANHOLE: V3 = [497, 0.0, -2.0];
/** la salle des débats (intérieur) et le tunnel d'égout */
export const CH: V3 = [-500, 0, 0];
export const SEW: V3 = [900, 0, 0];
/** hauteur du sol : terrasse et trottoirs à 0,12 m, chaussées à 0 */
export const groundY = (x: number, z: number) => {
  if (Math.abs(x - MOD[0]) < 200) return z > 0.6 ? 0.12 : 0;
  if (Math.abs(x - CH[0]) < 200 || Math.abs(x - SEW[0]) < 200) return 0;
  if (z > 100) return z > 143.5 && z < 156.5 ? 0 : 0.12;
  return 0.12;
};

// ---------------- plans ----------------
export type Light = "day" | "golden" | "gris" | "canicule";
export type ShotDef = { id: number; k: number; light: Light; a: number; b: number; sunAz?: number; sunEl?: number };
const DEF: { k: number; light: Light; sunAz?: number; sunEl?: number }[] = [
  { k: 0, light: "canicule", sunAz: 120 },     // 1 accroche : un député se bouche le nez, le fleuve fume derrière
  { k: 7, light: "canicule", sunAz: 130 },     // 2 les députés fuient le Parlement par la terrasse
  { k: 15, light: "canicule" },                // 3 la Tamise vue du ciel
  { k: 23, light: "canicule", sunAz: 140 },    // 4 les bouches d'égout crachent dans le fleuve
  { k: 37, light: "canicule", sunAz: 150 },    // 5 la canicule dans la rue
  { k: 44, light: "canicule", sunAz: 120 },    // 6 le thermomètre monte
  { k: 49, light: "canicule", sunAz: 150 },    // 7 le fleuve fermente, couvert de bulles
  { k: 60, light: "day", sunAz: 140 },         // 8 aujourd'hui : une poubelle oubliée au soleil
  { k: 68, light: "day", sunAz: 140 },         // 9 le couvercle se soulève, l'enfant se bouche le nez
  { k: 81, light: "canicule" },                // 10 une poubelle aussi longue qu'un fleuve
  { k: 89, light: "canicule", sunAz: 150 },    // 11 le Parlement tout neuf au bord de l'eau
  { k: 98, light: "canicule", sunAz: 120 },    // 12 on trempe les rideaux dans le produit chimique
  { k: 109, light: "canicule", sunAz: 130 },   // 13 ça ne suffit pas : les députés se bouchent le nez
  { k: 113, light: "canicule", sunAz: 140 },   // 14 ils sortent en courant, mouchoir sur le nez
  { k: 123, light: "canicule", sunAz: 140 },   // 15 déménager le Parlement : la charrette de bancs
  { k: 133, light: "canicule", sunAz: 130 },   // 16 le crieur de journaux : la Grande Puanteur
  { k: 139, light: "canicule", sunAz: 120 },   // 17 pour une fois, les députés votent très vite
  { k: 148, light: "canicule", sunAz: 120 },   // 18 dix-huit jours : le calendrier
  { k: 158, light: "day", sunAz: 140 },        // 19 Bazalgette et la tranchée
  { k: 163, light: "day" },                    // 20 dans le tunnel de brique
  { k: 174, light: "day" },                    // 21 les égouts emmènent l'eau sale loin de la ville
  { k: 182, light: "day", sunAz: 130 },        // 22 « Et le plus fort ? »
  { k: 186, light: "gris" },                   // 23 le « mauvais air » : un nuage qui fait peur
  { k: 197, light: "gris" },                   // 24 « C'était faux » : le nuage se dégonfle
  { k: 199, light: "day", sunAz: 140 },        // 25 le fleuve propre, la maladie chassée
  { k: 210, light: "day", sunAz: 130 },        // 26 aujourd'hui : la plaque d'égout, l'eau qui coule dessous
];
export const SHOTS: ShotDef[] = DEF.map((d, i) => ({
  id: i + 1, ...d,
  a: i === 0 ? 0 : Math.round(at(d.k) * FPS),
  b: i < DEF.length - 1 ? Math.round(at(DEF[i + 1].k) * FPS) : TOTAL,
}));
/** fondus enchaînés (images) aux changements de lieu ou d'époque ; un flash blanc après l'accroche */
export const XFADE: Record<number, number> = { 8: 10, 10: 10, 12: 10, 19: 10, 20: 10, 21: 10, 23: 10, 25: 12, 26: 12 };
export const FLASH_AT = SHOTS[2].a;

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
const [cx, , cz] = CH, [mx, , mz] = MOD, [sx, , sz] = SEW;
const KEYS: Record<number, Key> = {
  1: { p0: [2.6, 1.85, -2.4], p1: [2.0, 1.78, -1.5], l0: [0, 1.55, 4.2], fov: 40, roll: -0.04 },
  2: { p0: [18, 2.0, 1.6], p1: [15, 1.9, 2.0], l0: [2, 2.4, 5.5], fov: 44, roll: 0.03 },
  3: { p0: [170, 95, -235], p1: [148, 84, -208], l0: [-10, 8, -30], fov: 38, roll: -0.02 },
  4: { p0: [145.5, 1.2, -13], p1: [147, 1.0, -11.5], l0: [150, -0.8, 0], fov: 44, roll: 0.03 },
  5: { p0: [-22, 1.7, 150.5], p1: [-18, 1.65, 150.6], l0: [10, 2.4, 149], fov: 42, roll: -0.03 },
  6: { p0: [4.5, 1.7, 143.6], p1: [4.35, 1.72, 143.25], l0: [4, 1.75, 142.12], fov: 34, roll: 0.04 },
  7: { p0: [22, 0.8, -3.5], p1: [21.4, 0.55, -4.6], l0: [24, -1.5, -12], fov: 40, roll: -0.04 },
  8: { p0: [mx + 3.6, 1.35, mz - 0.6], p1: [mx + 3.0, 1.28, mz - 0.1], l0: [mx, 0.8, mz + 3], fov: 40, roll: 0.03 },
  9: { p0: [mx + 1.9, 1.25, mz + 0.6], p1: [mx + 1.7, 1.2, mz + 0.85], l0: [mx - 0.2, 1.05, mz + 2.8], fov: 42, roll: -0.04 },
  10: { p0: [300, 58, -20], p1: [270, 54, -26], l0: [0, 0, -55], fov: 40, roll: 0.02 },
  11: { p0: [40, 6, -75], p1: [33, 6, -68], l0: [0, 14, 14], fov: 44, roll: -0.03 },
  12: { p0: [cx + 4.6, 1.55, cz - 1.4], p1: [cx + 4.0, 1.5, cz - 1.9], l0: [cx + 1.0, 1.3, cz - 6], fov: 42, roll: 0.03 },
  13: { p0: [cx + 9, 1.9, cz + 0.6], p1: [cx + 8, 1.85, cz + 0.4], l0: [cx, 1.1, cz - 3.8], fov: 46, roll: -0.03 },
  14: { p0: [-15, 1.5, 2.2], p1: [-12.5, 1.45, 2.4], l0: [2, 1.4, 4.8], fov: 44, roll: 0.03 },
  15: { p0: [13, 1.7, 155.2], p1: [10.5, 1.65, 154.8], l0: [2, 1.2, 150], fov: 44, roll: -0.03 },
  16: { p0: [-4.5, 1.15, 148.0], p1: [-4.75, 1.13, 147.6], l0: [-6, 1.1, 145.6], fov: 36, roll: 0.04 },
  17: { p0: [cx - 9.5, 2.3, cz + 0.2], p1: [cx - 8.5, 2.2, cz + 0.2], l0: [cx, 1.2, cz], fov: 50, roll: 0.02 },
  18: { p0: [cx + 8.4, 1.95, cz + 0.8], p1: [cx + 8.9, 1.98, cz + 0.5], l0: [cx + 10.9, 2.0, cz], fov: 36, roll: -0.03 },
  19: { p0: [37, 2.5, 143.4], p1: [34.5, 2.4, 143.6], l0: [27, 0.0, 150], fov: 46, roll: 0.03 },
  20: { p0: [sx - 5, 1.6, sz - 0.6], p1: [sx - 3.5, 1.6, sz - 0.5], l0: [sx + 6, 1.4, sz + 0.4], fov: 50, roll: -0.03 },
  21: { p0: [-70, 150, 60], p1: [-50, 160, 50], l0: [90, 0, -50], fov: 50, roll: 0.02 },
  22: { p0: [27.3, 1.75, 144.5], p1: [27.1, 1.72, 144.85], l0: [26, 1.65, 146.6], fov: 34, roll: 0 },
  23: { p0: [-21, 1.6, 151], p1: [-18, 1.6, 151.2], l0: [0, 2.3, 150], fov: 46, roll: -0.03 },
  24: { p0: [-6.5, 2.3, 153.6], p1: [-6.2, 2.32, 153.2], l0: [-1, 2.6, 150], fov: 40, roll: 0.04 },
  25: { p0: [10, 2.3, -4.5], p1: [8, 2.2, -3.6], l0: [-4, 3, 6], fov: 46, roll: -0.02 },
  26: { p0: [mx + 2.6, 1.7, mz - 4.8], p1: [mx - 1.6, 0.75, mz - 2.7], l0: [mx - 3, 0, mz - 2], l1: [mx - 3, -0.6, mz - 2], fov: 44, roll: 0.03 },
};
export const kickAt = (_t: number) => 0;
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1], K = KEYS[id], u = glide((f - s.a) / Math.max(1, s.b - s.a));
  const look = K.l1 ? lerp3(K.l0, K.l1, u) : K.l0;
  return { pos: lerp3(K.p0, K.p1, u), look, fov: K.fov + ((K.fov1 ?? K.fov) - K.fov) * u, roll: K.roll ?? 0 };
};

// ---------------- flou de profondeur ----------------
export type Dof = { cInf: number; focus?: (f: number) => V3 };
const DOFS: Record<number, Dof> = {
  1: { cInf: 12, focus: () => [0, 1.6, 4.0] }, 2: { cInf: 6, focus: () => [4, 1.5, 5] }, 3: { cInf: 0 }, 4: { cInf: 8, focus: () => [150, -0.6, 0] },
  5: { cInf: 0 }, 6: { cInf: 15, focus: () => THERMO }, 7: { cInf: 10, focus: () => [24, -1.5, -12] }, 8: { cInf: 10, focus: () => BIN },
  9: { cInf: 12, focus: () => [mx - 0.2, 1.05, mz + 2.8] }, 10: { cInf: 0 }, 11: { cInf: 0 }, 12: { cInf: 11, focus: () => [cx + 1.0, 1.0, cz - 5.6] },
  13: { cInf: 8, focus: () => [cx, 1.1, cz - 3.8] }, 14: { cInf: 6, focus: () => [-4, 1.4, 4.5] }, 15: { cInf: 8, focus: () => [3, 1.2, 150] },
  16: { cInf: 13, focus: () => [-6, 1.1, 145.6] }, 17: { cInf: 0 }, 18: { cInf: 14, focus: () => [cx + 10.9, 2.0, cz] }, 19: { cInf: 6, focus: () => [27, 0.5, 149] },
  20: { cInf: 8, focus: () => [sx + 5, 1.2, sz + 0.6] }, 21: { cInf: 0 }, 22: { cInf: 14, focus: () => [26, 1.65, 146.6] }, 23: { cInf: 0 },
  24: { cInf: 10, focus: () => [-1, 2.6, 150] }, 25: { cInf: 0 }, 26: { cInf: 10, focus: () => MANHOLE },
};
export const dofAt = (f: number) => DOFS[shotAt(f).id];
