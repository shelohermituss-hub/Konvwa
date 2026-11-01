// « Les rats d'Hanoï » (1902) : découpage, caméras, flou de profondeur. 60 i/s (règle du client).
// Chaque plan commence 2 images avant son mot (W = débuts des mots, words.ts). Coupes franches entre les idées,
// glissements lents pendant le plan, roulis de 2 à 4°, aucun tremblé.
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
/** le quartier français : boulevard le long de x, trottoirs à |z| 5..9, façades des villas à |z| = 9,5 */
export const MANHOLE: V3 = [2, 0.125, 7.0];
/** les égouts (tunnel de brique le long de x), le bureau des primes, la ferme à rats, le jardin d'aujourd'hui,
 *  la salle de bains, la salle d'archives */
export const SEW: V3 = [900, 0, 0];
export const OFF: V3 = [-500, 0, 0];
export const FARM: V3 = [500, 0, 0];
export const GARD: V3 = [500, 0, 300];
export const BATH: V3 = [-500, 0, 300];
export const ARCH: V3 = [-500, 0, -300];
/** hauteur du sol : trottoirs du boulevard à 0,12 m, le reste à 0 */
export const groundY = (x: number, z: number) => (Math.abs(x) < 200 && Math.abs(z) > 5 && Math.abs(z) < 30 ? 0.12 : 0);

// ---------------- plans ----------------
export type Light = "day" | "golden" | "gris" | "canicule";
export type ShotDef = { id: number; k: number; light: Light; a: number; b: number; sunAz?: number; sunEl?: number };
const DEF: { k: number; light: Light; sunAz?: number; sunEl?: number }[] = [
  { k: 0, light: "day", sunAz: 130 },        // 1 accroche : au guichet, une queue de rat contre une pièce
  { k: 11, light: "golden", sunAz: 150 },    // 2 une ferme à rats, l'éleveur ravi
  { k: 21, light: "day", sunAz: 140 },       // 3 le quartier français tout neuf
  { k: 31, light: "day", sunAz: 120 },       // 4 la chasse d'eau
  { k: 38, light: "day" },                   // 5 sous les rues : la ville des rats
  { k: 49, light: "day", sunAz: 120 },       // 6 la carte : la peste en Asie
  { k: 56, light: "day", sunAz: 140 },       // 7 on engage des chasseurs
  { k: 61, light: "day" },                   // 8 dans les égouts, la lanterne et le seau
  { k: 73, light: "day", sunAz: 120 },       // 9 le tableau : 20 112 rats en un jour
  { k: 85, light: "day" },                   // 10 les rats font des petits plus vite
  { k: 97, light: "day", sunAz: 120 },       // 11 plan B : un centime
  { k: 104, light: "day", sunAz: 130 },      // 12 la pile de rats, puis… la queue
  { k: 117, light: "day", sunAz: 140 },      // 13 l'image du quotidien : la mauvaise herbe
  { k: 138, light: "day", sunAz: 140 },      // 14 des rats sans queue dans les rues
  { k: 150, light: "day" },                  // 15 couper la queue, relâcher le rat
  { k: 164, light: "day", sunAz: 140 },      // 16 l'inspecteur découvre la ferme
  { k: 177, light: "day", sunAz: 120 },      // 17 la prime est annulée
  { k: 181, light: "golden", sunAz: 160 },   // 18 plus de rats qu'avant
  { k: 188, light: "day", sunAz: 120 },      // 19 l'effet cobra
  { k: 199, light: "day", sunAz: 130 },      // 20 l'historien : l'effet rat
];
export const SHOTS: ShotDef[] = DEF.map((d, i) => ({
  id: i + 1, ...d,
  a: i === 0 ? 0 : Math.round(at(d.k) * FPS),
  b: i < DEF.length - 1 ? Math.round(at(DEF[i + 1].k) * FPS) : TOTAL,
}));
/** fondus enchaînés aux changements de lieu ou d'époque ; un flash blanc après l'accroche */
export const XFADE: Record<number, number> = { 4: 10, 13: 10, 14: 10, 19: 12 };
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
const [ox, , oz] = OFF, [sx, , sz] = SEW, [fx, , fz] = FARM, [gx, , gz] = GARD, [bx, , bz] = BATH, [ax, , az] = ARCH;
const KEYS: Record<number, Key> = {
  1: { p0: [ox + 2.4, 1.55, oz + 3.0], p1: [ox + 1.9, 1.48, oz + 2.4], l0: [ox, 1.25, oz - 0.5], fov: 40, roll: -0.04 },
  2: { p0: [fx + 3.0, 1.5, fz + 4.6], p1: [fx + 2.4, 1.45, fz + 3.9], l0: [fx, 0.8, fz + 0.4], fov: 42, roll: 0.03 },
  3: { p0: [-32, 13, 2], p1: [-26, 10, 2.5], l0: [10, 2, 0], fov: 44, roll: -0.02 },
  4: { p0: [bx + 1.9, 1.6, bz + 2.3], p1: [bx + 1.6, 1.55, bz + 1.9], l0: [bx, 1.4, bz - 1.4], fov: 42, roll: 0.03 },
  5: { p0: [sx - 6, 1.8, sz - 0.6], p1: [sx - 4.5, 1.6, sz - 0.5], l0: [sx + 6, 0.3, sz + 0.3], fov: 48, roll: -0.03 },
  6: { p0: [ox - 1.4, 2.05, oz - 2.0], p1: [ox - 1.6, 2.1, oz - 2.4], l0: [ox - 2, 2.25, oz - 4.45], fov: 40, roll: 0.03 },
  7: { p0: [3.4, 1.6, 2.2], p1: [3.0, 1.55, 2.6], l0: [1.6, 1.1, 7.4], fov: 44, roll: -0.03 },
  8: { p0: [sx - 1.2, 1.4, sz + 0.9], p1: [sx - 0.6, 1.35, sz + 0.8], l0: [sx + 3.5, 0.9, sz - 1.0], fov: 44, roll: 0.03 },
  9: { p0: [ox + 1.7, 2.0, oz - 1.9], p1: [ox + 1.9, 2.05, oz - 2.3], l0: [ox + 2.2, 2.3, oz - 4.45], fov: 40, roll: -0.03 },
  10: { p0: [sx + 0.8, 1.25, sz + 1.0], p1: [sx + 1.2, 1.15, sz + 0.9], l0: [sx + 5, 0.15, sz - 0.5], fov: 46, roll: 0.03 },
  11: { p0: [ox + 0.5, 1.6, oz + 1.5], p1: [ox + 0.4, 1.58, oz + 1.25], l0: [ox, 1.55, oz], fov: 38, roll: -0.04 },
  12: { p0: [ox + 2.5, 1.65, oz + 2.9], p1: [ox + 2.0, 1.6, oz + 2.4], l0: [ox, 1.3, oz - 0.3], fov: 42, roll: 0.03 },
  13: { p0: [gx + 2.2, 1.15, gz + 2.7], p1: [gx + 1.8, 1.1, gz + 2.3], l0: [gx, 0.65, gz], fov: 42, roll: -0.03 },
  14: { p0: [4.5, 0.9, 3.4], p1: [4.0, 0.85, 3.8], l0: [-1, 0.6, 7], fov: 44, roll: 0.03 },
  15: { p0: [sx + 0.3, 1.35, sz + 0.7], p1: [sx + 0.6, 1.3, sz + 0.6], l0: [sx + 2.6, 1.0, sz - 1.1], fov: 40, roll: -0.03 },
  16: { p0: [fx - 3.0, 1.6, fz + 5.0], p1: [fx - 2.4, 1.55, fz + 4.3], l0: [fx + 0.4, 1.0, fz + 0.4], fov: 42, roll: 0.03 },
  17: { p0: [ox + 0.3, 1.85, oz + 1.8], p1: [ox + 0.3, 1.9, oz + 1.4], l0: [ox, 2.0, oz - 4.4], fov: 44, roll: -0.02 },
  18: { p0: [-14, 3, 0.5], p1: [-11, 2.6, 0.8], l0: [6, 0.4, 3], fov: 46, roll: 0.03 },
  19: { p0: [ax + 1.3, 1.45, az + 1.9], p1: [ax + 1.1, 1.4, az + 1.6], l0: [ax - 0.2, 1.15, az - 0.1], fov: 40, roll: -0.03 },
  20: { p0: [ax + 1.8, 1.55, az + 2.4], p1: [ax + 1.5, 1.5, az + 2.0], l0: [ax + 0.3, 1.2, az - 0.3], fov: 42, roll: 0.02 },
};
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1], K = KEYS[id], u = glide((f - s.a) / Math.max(1, s.b - s.a));
  const look = K.l1 ? lerp3(K.l0, K.l1, u) : K.l0;
  return { pos: lerp3(K.p0, K.p1, u), look, fov: K.fov + ((K.fov1 ?? K.fov) - K.fov) * u, roll: K.roll ?? 0 };
};

// ---------------- flou de profondeur ----------------
export type Dof = { cInf: number; focus?: (f: number) => V3 };
const DOFS: Record<number, Dof> = {
  1: { cInf: 12, focus: () => [ox, 1.3, oz] }, 2: { cInf: 10, focus: () => [fx, 0.8, fz + 0.4] }, 3: { cInf: 0 }, 4: { cInf: 10, focus: () => [bx, 1.3, bz - 1.2] },
  5: { cInf: 6, focus: () => [sx + 3, 0.3, sz] }, 6: { cInf: 12, focus: () => [ox - 2, 2.25, oz - 4.45] }, 7: { cInf: 8, focus: () => [1.6, 1.1, 7.4] },
  8: { cInf: 10, focus: () => [sx + 3, 1.0, sz - 1.1] }, 9: { cInf: 12, focus: () => [ox + 2.2, 2.3, oz - 4.45] }, 10: { cInf: 10, focus: () => [sx + 4, 0.2, sz - 0.5] },
  11: { cInf: 15, focus: () => [ox, 1.55, oz] }, 12: { cInf: 10, focus: () => [ox, 1.3, oz] }, 13: { cInf: 10, focus: () => [gx, 0.7, gz] },
  14: { cInf: 10, focus: () => [0, 0.4, 6.6] }, 15: { cInf: 12, focus: () => [sx + 2.6, 1.0, sz - 1.1] }, 16: { cInf: 8, focus: () => [fx + 0.4, 1.0, fz + 0.4] },
  17: { cInf: 6, focus: () => [ox, 2.0, oz - 4.4] }, 18: { cInf: 0 }, 19: { cInf: 12, focus: () => [ax - 0.2, 1.15, az - 0.1] }, 20: { cInf: 12, focus: () => [ax + 0.3, 1.2, az - 0.3] },
};
export const dofAt = (f: number) => DOFS[shotAt(f).id];
