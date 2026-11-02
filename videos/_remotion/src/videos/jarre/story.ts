// « La jarre qui sentait les séismes » (Zhang Heng, an 132) — style ANIMÉ, nouveau rendu calé sur les références :
// 3D « dessin animé » (couleurs franches, tout cerné d'encre), caméra CONTINUE dans chaque lieu, passages filés (whip)
// d'un lieu à l'autre au lieu de coupes franches, sous-titres discrets. 60 i/s. Les temps viennent de la voix (words.ts).
import { getInputProps } from "remotion";
import { W, VOICE_END } from "./words";

export const FPS = 60;
export const D0 = 0;
export const TOTAL = Math.round((VOICE_END + 0.9) * FPS);
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
/** début d'un mot, avancé de 2 images (les réactions tombent juste avant le mot) */
export const at = (k: number, lead = 2 / FPS) => W[k] - lead;
export const groundY = (_x = 0, _z = 0) => 0;

// ---------------- lieux (mètres) ----------------
/** la salle du trône (Luoyang) : trône au nord (z -), portes au sud (z = 5) sur la cour */
export const HALL = { x0: -7, x1: 7, z0: -9.5, z1: 5, h: 6.5 };
/** la jarre au milieu de la salle ; ses 8 dragons regardent les 8 directions (0 = sud = +z, 90 = est = +x, 270 = ouest) */
export const JAR: V3 = [0, 0, -2.5];
export const THRONE: V3 = [0, 0.6, -7.7];
export const ZH: V3 = [1.85, 0, -1.4];
export const MAPT: V3 = [-2.6, 0, 1.7];
export const TEA: V3 = [2.2, 0, -5.6];
/** la cour devant la salle, la porte de la ville au sud */
export const COURT = { x0: -13, x1: 13, z0: 5, z1: 26 };
export const BUS: V3 = [60, 0, 0];
export const LONGXI: V3 = [-80, 0, 0];
export const MUSEUM: V3 = [140, 0, 0];

// ---------------- les temps forts ----------------
export const T = {
  ring: at(17),              // « tremblements » : ondes autour de la jarre
  shake1: [W[28], W[36] - 0.2] as const, // « un séisme… gronde »
  bolt: at(34),              // « gronde » : éclair
  riderMap: [W[40], W[48] + 0.4] as const, // le cavalier traverse la carte
  quake: [W[92], W[101] + 0.1] as const,   // « Quand la terre tremble »
  dropS: W[102] + 0.02,      // « Clong ! » : la bille du sud tombe dans le crapaud
  arrow: at(108),            // « ce dragon-là montre la direction »
  question: at(114),         // « Comment ? »
  brake: at(126),            // « freine »
  lean: at(127),             // « ton corps part… »
  tilt: at(140),             // « fait pareil »
  push: at(143) + 0.1,       // « pousse une seule bille »
  dropW: W[149] + 0.02,      // « clong ! » : la bille de l'ouest
  ouest: at(153),
  laugh: at(166),
  gallop: [W[173], W[182]] as const,
  shake3: [W[186], W[192]] as const,
};

/** le messager au galop : de la porte de la ville (z 24) au seuil de la salle (z 8,5), en freinant */
export const RIDER_X = 0.3;
export const riderAt = (t: number) => { const u = clamp01((t - T.gallop[0]) / (T.gallop[1] - T.gallop[0])); return { u, z: 24 - 15.5 * (1 - (1 - u) * (1 - u)) }; };

// ---------------- « plans » (lumière et distribution ; la caméra, elle, glisse) ----------------
export type Light = "day" | "golden" | "gris" | "canicule";
export type Loc = "hall" | "court" | "bus" | "longxi" | "museum";
export type ShotDef = { id: number; k: number; light: Light; a: number; b: number; loc: Loc; sunAz?: number; sunEl?: number };
/** passages filés : à mi-chemin, la caméra saute d'un lieu à l'autre, cachée par le flou de vitesse */
export const WHIPS: number[] = [W[25] - 0.05, W[36] - 0.05, W[119] - 0.05, W[134] - 0.04, W[147] - 0.05, W[173] - 0.05, W[186] - 0.05, W[197] - 0.06, W[209] - 0.05];
const WH = WHIPS.map((x) => Math.round(x * FPS));
const segs: [Loc, Light][] = [["hall", "day"], ["court", "gris"], ["hall", "day"], ["bus", "day"], ["hall", "day"], ["hall", "day"], ["court", "day"], ["longxi", "day"], ["museum", "day"], ["hall", "day"]];
export const SHOTS: ShotDef[] = segs.map(([loc, light], i) => ({ id: i + 1, k: 0, light, loc, a: i ? WH[i - 1] : 0, b: i < WH.length ? WH[i] : TOTAL }));
export const XFADE: Record<number, number> = {};
export const FLASH_AT = -1000;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- caméra ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
/** via : point de passage sans arrêt ; cut : saut (au milieu d'un passage filé) */
type Key = { t: number; pos: V3; look: V3; fov: number; roll?: number; via?: boolean; cut?: boolean };
const J = JAR;
/** point d'une orbite autour de la jarre : angle (degrés, 0 = sud), rayon, hauteur */
const orb = (deg: number, r: number, h: number): V3 => [J[0] + r * Math.sin((deg * Math.PI) / 180), h, J[2] + r * Math.cos((deg * Math.PI) / 180)];
const JC: V3 = [J[0], 1.15, J[2]];
/** un passage filé : la caméra finit son mouvement en tournant vite (yaw), saute, et arrive en tournant dans le nouveau lieu */
const turn = (pos: V3, look: V3, deg: number): V3 => {
  const a = (deg * Math.PI) / 180, dx = look[0] - pos[0], dz = look[2] - pos[2];
  return [pos[0] + dx * Math.cos(a) - dz * Math.sin(a), look[1], pos[2] + dx * Math.sin(a) + dz * Math.cos(a)];
};
const whip = (tw: number, from: Omit<Key, "t">, to: Omit<Key, "t">, dir = 1, d = 0.16): Key[] => [
  { ...from, t: tw - d, via: false },
  { ...from, look: turn(from.pos, from.look, 40 * dir), t: tw, via: true },
  { ...to, look: turn(to.pos, to.look, -40 * dir), t: tw + 1e-4, via: true, cut: true },
  { ...to, t: tw + d },
];
const KEYS: Key[] = [
  // ---- accroche : gros plan sur un dragon et sa bille, recul : l'empereur sur son trône, Zhang Heng présente sa jarre ----
  { t: 0, pos: [0.3, 1.22, -0.45], look: [0, 1.12, -1.35], fov: 40 },
  { t: W[10], pos: [3.6, 2.2, 0.9], look: [-0.5, 1.45, -5.2], fov: 56 },
  ...whip(WHIPS[0], { pos: [3.0, 2.6, 2.6], look: [-0.6, 1.3, -4.6], fov: 58 },
    { pos: [1.6, 0.6, 12.4], look: [0, 6.2, 3], fov: 60 }),
  // ---- la cour sous l'orage : le Ciel gronde l'empereur ----
  ...whip(WHIPS[1], { pos: [0.9, 0.7, 11.0], look: [0, 6.6, 3], fov: 58 },
    { pos: [-2.75, 2.45, 2.8], look: [-2.75, 0.92, 1.55], fov: 44 }, -1),
  // ---- la carte de l'empire : la nouvelle met des semaines ; l'empereur dépité ----
  { t: W[48], pos: [-2.55, 2.3, 2.75], look: [-2.6, 0.92, 1.5], fov: 44 },
  { t: W[54], pos: [-2.0, 1.6, 3.7], look: [-2.6, 1.3, 0.3], fov: 46 },
  // ---- Zhang Heng et sa jarre ----
  { t: W[58], pos: [2.0, 1.55, 0.7], look: [1.75, 1.45, -1.4], fov: 44 },
  { t: W[66], pos: orb(38, 4.8, 1.6), look: [0.5, 1.1, -2.3], fov: 54 },
  { t: W[71] - 0.1, pos: orb(42, 4.0, 1.7), look: [0.3, 1.2, -2.4], fov: 52 },
  // tout autour, huit dragons (orbite)
  { t: W[75], pos: orb(15, 2.7, 1.55), look: JC, fov: 48, via: true },
  { t: W[79], pos: orb(-25, 2.6, 1.5), look: JC, fov: 48, via: true },
  { t: W[83], pos: orb(-60, 2.4, 1.1), look: [J[0], 0.8, J[2]], fov: 48, via: true },
  // et sous chaque dragon, un crapaud
  { t: W[90], pos: orb(-55, 2.5, 0.75), look: [...orb(-45, 1.2, 0.38)] as V3, fov: 46 },
  // ---- quand la terre tremble : la bille du sud tombe dans le crapaud ----
  { t: W[96], pos: [0.9, 1.05, -0.2], look: [0, 0.85, -1.35], fov: 46 },
  { t: W[103], pos: [0.45, 0.72, -0.55], look: [0, 0.45, -1.3], fov: 42 },
  // la direction : la flèche au sol, vue de derrière la jarre
  { t: W[113] + 0.2, pos: [0.6, 3.9, -5.6], look: [0, 0, 1.2], fov: 56 },
  // ---- comment ? le secret est perdu ----
  { t: W[115], pos: [2.7, 2.4, -0.9], look: [0, 1.95, -2.5], fov: 52 },
  ...whip(WHIPS[2], { pos: [2.2, 2.1, -0.2], look: [0, 1.9, -2.5], fov: 50 },
    { pos: [58.85, 1.45, 1.6], look: [60.9, 1.15, -0.9], fov: 62 }),
  // ---- le bus qui freine ----
  ...whip(WHIPS[3], { pos: [58.85, 1.4, 0.4], look: [60.9, 1.1, -0.5], fov: 60 },
    { pos: [2.6, 1.55, 0.3], look: [0, 1.15, -2.5], fov: 46 }, -1),
  // ---- la colonne cachée dans la jarre (vue en transparence) ----
  ...whip(WHIPS[4], { pos: [2.1, 1.45, -0.3], look: [-0.3, 1.05, -2.5], fov: 46 },
    { pos: [3.4, 2.0, 2.6], look: [0, 1.2, -3.6], fov: 52 }),
  // ---- un jour : la bille de l'ouest tombe ----
  { t: W[150], pos: [-2.5, 0.95, -1.2], look: [-1.2, 0.55, -2.5], fov: 44 },
  { t: W[154] + 0.2, pos: [-2.9, 1.3, -0.9], look: [-1.2, 0.9, -2.6], fov: 46 },
  // personne n'a rien senti : la tasse de thé ne bouge pas
  { t: W[158], pos: [2.75, 0.95, -4.95], look: [2.38, 0.74, -5.54], fov: 40 },
  { t: W[162] + 0.15, pos: [2.6, 1.0, -4.8], look: [2.38, 0.8, -5.64], fov: 42 },
  // on se moque
  { t: W[165], pos: [-1.5, 1.6, 0.9], look: [-3.1, 1.35, -2.3], fov: 48 },
  ...whip(WHIPS[5], { pos: [2.6, 1.6, 0.7], look: [1.85, 1.45, -1.4], fov: 44 },
    { pos: [6.2, 1.3, 22.5], look: [0, 1.3, 23.2], fov: 48 }),
  // ---- quelques jours plus tard : le messager au galop ----
  // la caméra suit le cheval (sa position : cast.ts, z = 24 - 15,5 (1 - (1 - u)²))
  { t: W[173] + 0.6, pos: [6.2, 1.35, 19.5], look: [0, 1.2, 17.0], fov: 48, via: true },
  { t: W[173] + 1.2, pos: [6.0, 1.35, 15.5], look: [0, 1.2, 12.6], fov: 48, via: true },
  { t: W[173] + 1.8, pos: [5.6, 1.4, 13.0], look: [0, 1.2, 9.8], fov: 48, via: true },
  { t: W[182], pos: [5.4, 1.4, 12.0], look: [0, 1.3, 8.6], fov: 48 },
  ...whip(WHIPS[6], { pos: [3.2, 1.6, 13.6], look: [0, 1.4, 7.8], fov: 50 },
    { pos: [-78.2, 1.5, 7.2], look: [-80, 1.7, 0], fov: 50 }, -1),
  // ---- Longxi : la terre a tremblé ; à des centaines de kilomètres ----
  { t: W[192], pos: [-77.5, 2.2, 8.5], look: [-80, 1.4, 0], fov: 52 },
  ...whip(WHIPS[7], { pos: [-73.5, 9.5, 17.5], look: [-80, 0.5, -4], fov: 56 },
    { pos: [143.2, 1.6, 4.6], look: [140, 1.2, -0.5], fov: 48 }),
  // ---- le musée : aucune copie moderne n'est aussi précise ----
  { t: W[205], pos: [141.6, 1.45, 2.2], look: [140, 1.25, -0.5], fov: 46 },
  ...whip(WHIPS[8], { pos: [140.9, 1.4, 1.4], look: [140, 1.3, -0.5], fov: 44 },
    { pos: [2.9, 1.7, 1.5], look: [0.7, 1.4, -2.3], fov: 48 }, -1),
  // ---- fin : la vraie jarre et Zhang Heng, fier ----
  { t: TOTAL / FPS, pos: [2.4, 1.6, 0.8], look: [0.8, 1.4, -2.0], fov: 46 },
];
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const hash = (n: number) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
const noise = (t: number, s: number) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash(i + s) * 2 - 1, hash(i + 1 + s) * 2 - 1, u); };
/** tremblements de terre (et coup de frein) : secousse de la caméra */
export const shakeAt = (t: number) => {
  const win = (a: number, b: number, k: number) => (t > a && t < b ? k * Math.min(1, (t - a) / 0.15, (b - t) / 0.3) : 0);
  return win(T.shake1[0], T.shake1[1], 0.05) + win(T.quake[0], T.quake[1], 0.045) + win(T.shake3[0], T.shake3[1], 0.07);
};
export const camAt = (_id: number, f: number): Cam => {
  // images de contrôle seulement : inputProps { cam: { pos, look, fov } } impose une caméra fixe
  const dbg = (getInputProps() as { cam?: { pos: V3; look: V3; fov: number } }).cam;
  if (dbg) return { ...dbg, roll: 0 };
  const t = f / FPS;
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  // un passage filé (B.cut) : on reste du côté de A jusqu'au saut
  const x = B.cut ? 1 : clamp01((t - A.t) / Math.max(1e-3, B.t - A.t));
  const u = A.via && B.via ? x : B.via ? x * x : A.via ? 1 - (1 - x) * (1 - x) : glide(x);
  const pos = lerp3(A.pos, B.pos, u), look = lerp3(A.look, B.look, u);
  const s = shakeAt(t);
  if (s) { pos[0] += s * noise(t * 22, 1); pos[1] += s * noise(t * 25, 2); look[0] += s * 1.5 * noise(t * 20, 3); look[1] += s * 1.5 * noise(t * 23, 4); }
  // le coup de frein : la caméra (assise dans le bus) part un peu vers l'avant
  if (t > T.brake && t < T.brake + 1.2) { const k = Math.sin(Math.PI * clamp01((t - T.brake) / 1.2)); pos[2] -= 0.14 * k; look[2] -= 0.25 * k; }
  return { pos, look, fov: lerp(A.fov, B.fov, u), roll: lerp(A.roll ?? 0, B.roll ?? 0, u) };
};
/** 0..1 : force du flou de vitesse pendant les passages filés */
export const whipBlur = (f: number) => {
  const t = f / FPS;
  let m = 0;
  for (const w of WHIPS) m = Math.max(m, clamp01(1 - Math.abs(t - w) / 0.2));
  return m * m;
};
/** le lieu où se trouve la caméra */
export const locAt = (f: number): Loc => shotAt(f).loc;

// ---------------- flou de profondeur ----------------
export type Dof = { cInf: number; focus?: (f: number) => V3 };
export const dofAt = (f: number): Dof => {
  const t = f / FPS;
  // gros plans (dragon, crapaud, tasse) : arrière-plan plus flou
  const close = t < W[6] || (t > W[90] - 1 && t < W[106]) || (t > W[156] && t < W[164]);
  return { cInf: close ? 13 : 9 };
};
