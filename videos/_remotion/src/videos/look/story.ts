// Test du nouveau rendu, d'après les références de la chaîne : la première phrase des Rats d'Hanoï (≈ 6,9 s).
// UNE caméra continue (pas de coupe franche) : gros plan sur la queue et la pièce au guichet, glissement vers l'employé,
// puis passage rapide filé (« whip ») vers la réserve où l'on élève les rats. 60 i/s.
import { getInputProps } from "remotion";
import { W } from "./words";

export const FPS = 60;
export const D0 = 0;
/** fin du test : après « rats. » (mot 20) */
export const LAST_WORD = 20;
export const TOTAL = Math.round((W[LAST_WORD + 1] + 0.45) * FPS);
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const at = (k: number, lead = 2 / FPS) => W[k] - lead;

// ---------------- lieux (mètres) ----------------
/** le bureau des primes : comptoir le long de x à z = 0, mur du fond à z = -4, porte de la réserve dans le mur de droite (x = 5) */
export const ROOM = { x0: -5, x1: 5, z0: -4, z1: 4, h: 4.2 };
/** la réserve aux cages, derrière la porte de droite */
export const STORE = { x0: 5, x1: 11, z0: -4, z1: 2 };
export const CLERK: V3 = [0.15, 0, -0.95];
export const CATCHER: V3 = [0.62, 0, 0.85];
export const FARMER: V3 = [8.0, 0, -1.6];
export const groundY = (_x = 0, _z = 0) => 0;

// ---------------- « plans » (pour la lumière et la distribution ; la caméra, elle, ne coupe pas) ----------------
export type Light = "day" | "golden" | "gris" | "canicule";
export type ShotDef = { id: number; k: number; light: Light; a: number; b: number; sunAz?: number; sunEl?: number };
/** le passage filé : de la fin de « rat… » au début de « et » */
export const WHIP = { a: W[10] + 0.18, b: W[11] + 0.02 };
export const SHOTS: ShotDef[] = [
  { id: 1, k: 0, light: "day", a: 0, b: Math.round(WHIP.a * FPS), sunAz: 120, sunEl: 38 },
  { id: 2, k: 11, light: "day", a: Math.round(WHIP.a * FPS), b: TOTAL, sunAz: 120, sunEl: 38 },
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = -1000;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- caméra continue ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Key = { t: number; pos: V3; look: V3; fov: number; roll: number; via?: boolean };
/** points de passage ; entre deux points la caméra glisse (glide), et le passage filé se fait en ≈ 0,3 s */
const KEYS: Key[] = [
  { t: 0, pos: [0.2, 1.55, 2.9], look: [0.25, 1.35, -0.6], fov: 38, roll: -0.04 },          // le chasseur de dos (à droite, devant), l'employé derrière le comptoir
  { t: W[6], pos: [-0.1, 1.5, 2.3], look: [0.48, 1.25, -0.23], fov: 40, roll: -0.03 },        // « payait » : on plonge vers la queue et la pièce
  { t: WHIP.a, pos: [-0.35, 1.55, 1.45], look: [0.1, 1.42, -0.95], fov: 36, roll: 0.02 },      // « queue de rat » : l'employé horrifié
  { t: WHIP.b, pos: [0.25, 1.55, 1.6], look: [8.6, 1.0, -2.6], fov: 30, roll: 0.06 },         // passage filé : on tourne vers la porte de la réserve
  { t: (WHIP.b + W[18]) / 2, pos: [4.2, 1.5, -1.5], look: [8.4, 1.0, -2.4], fov: 38, roll: 0.03, via: true }, // on file par la porte
  { t: W[18], pos: [5.9, 1.4, 0.0], look: [8.3, 1.0, -2.35], fov: 42, roll: 0.02 },         // « élever » : les cages, l'éleveur
  { t: W[21] + 0.45, pos: [6.3, 1.35, -0.3], look: [8.3, 1.0, -2.4], fov: 40, roll: 0.0 },
];
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
export const camAt = (_id: number, f: number): Cam => {
  // images de contrôle seulement : inputProps { cam: { pos, look, fov } } impose une caméra fixe
  const dbg = (getInputProps() as { cam?: { pos: V3; look: V3; fov: number } }).cam;
  if (dbg) return { ...dbg, roll: 0 };
  const t = f / FPS;
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  // un point « via » ne marque pas d'arrêt : on accélère jusqu'à lui et on freine après
  const A = KEYS[i], B = KEYS[i + 1], x = clamp01((t - A.t) / Math.max(1e-3, B.t - A.t));
  const u = B.via ? x * x : A.via ? 1 - (1 - x) * (1 - x) : glide(x);
  return { pos: lerp3(A.pos, B.pos, u), look: lerp3(A.look, B.look, u), fov: lerp(A.fov, B.fov, u), roll: lerp(A.roll, B.roll, u) };
};
/** 0..1 : force du flou de vitesse pendant le passage filé */
export const whipBlur = (f: number) => { const t = f / FPS, m = (WHIP.a + WHIP.b) / 2, h = (WHIP.b - WHIP.a) / 2 + 0.04; return clamp01(1 - Math.abs(t - m) / h); };

// ---------------- flou de profondeur ----------------
export type Dof = { cInf: number; focus?: (f: number) => V3 };
export const dofAt = (f: number): Dof => {
  const t = f / FPS;
  if (t < W[6]) return { cInf: 10, focus: () => [0.15, 1.45, -0.95] };
  if (t < WHIP.a - 0.6) return { cInf: 12, focus: () => [0.6, 1.15, 0.2] };
  if (t < WHIP.b) return { cInf: 10, focus: () => [0.15, 1.5, -0.95] };
  return { cInf: 9, focus: () => [8.0, 1.2, -1.6] };
};
