// Échantillon toon (pack Creatorize) : la même histoire que la Marmelade, avec ce que les références montrent :
// décors habillés, lumière dessinée (rayons, nuit bleue + lampes orange), fond flou + objet au premier plan, effets, foule.
import { shot } from '../engine.js';
const F = 1 / 30;

// ---- 1 : la salle, en plein jour, rayons de soleil ----
shot({ say: 'En Haïti, il y a eu un vrai duc', build(S) {
  S.grade({ sat: 1.15, bright: 1.12, contrast: 1.04 });
  const P = S.place('museum-hall', { seed: 3, mood: 'warm', density: 1.4 });
  const C = P.spots.hall;
  S.fx('godrays', { at: [-1.2, 3.2, -2.5], size: [1.2, 2.4], dir: [0.5, -1, 0.2], length: 5, count: 5, dust: true });
  const you = S.char('main', { at: C.slice(0, 2), ry: C[2], face: 'smug', outfit: 'medieval' });
  you.gesture('hips', S.at('vrai'));
  you.face('laugh', S.at('Marmelade'));
  S.fx('sparkle', { at: you.head(), size: 0.5 });
  S.camera('creep', { on: you, frame: 'ms', side: -25, into: true });
  return { you };
} });

// ---- 2 : la nuit bleue, torches orange, le général se proclame roi ----
shot({ say: 'Dans le Nord, le général', build(S) {
  S.grade({ sat: 1.7, bright: 1.4, contrast: 1.04, lift: [0.03, 0.03, 0.07] });
  const P = S.place('old-town', { seed: 5, era: 'medieval', mood: 'night' });
  const king = S.char('main', { at: P.spots.fountain.slice(0, 2), ry: P.spots.fountain[2], face: 'determined', outfit: 'knight' });
  king.gesture('armsUp', S.at('roi'));
  king.face('excited', S.at('roi'));
  S.fx('sparkle', { at: king.head(), size: 0.7 });
  S.fx('embers', { at: [0, 0.2, 0], count: 40 });
  S.camera('creep', { on: king, frame: 'ms', yaw: -20, into: true });
  return { king };
} });

// ---- 3 : la foule des nobles, coucher de soleil ----
shot({ say: 'Alors, une semaine plus tard', build(S) {
  S.grade({ sat: 1.45, bright: 1.4, contrast: 1.04, lift: [0.06, 0.05, 0.05] });
  const P = S.place('old-town', { seed: 8, era: 'medieval', mood: 'warm' });
  const [cx, cz] = P.spots.center;
  const ids = ['juno', 'dex', 'otis', 'rose', 'walt', 'priya', 'sam', 'lola', 'viktor', 'mei', 'hugo', 'ada'];
  const line = ids.map((id, i) => S.char(id, { at: [cx - 3.4 + i * 0.62, cz + 1.3 + (i % 2) * 0.12], ry: -0.25, face: 'happy', outfit: i % 3 === 0 ? 'medieval' : undefined }));
  const you = S.char('main', { at: [cx + 0.9, cz - 0.3], ry: 0.5, face: 'smug', outfit: 'medieval' });
  const t = S.at('noblesse');
  line.forEach((a, i) => a.headTo(you, t - 6 * F + i * 3 * F));
  you.gesture('wave', S.at('fabrique'), { until: t + 0.6 });
  S.fx('speedLines', { at: [cx + 0.9, 1.2, cz - 0.3], dir: [1, 0, 0], count: 14, radius: [0.5, 1.2] });
  S.camera('creep', { ...P.cams.square });
  return { you, line };
} });

// ---- 4 : l'écu au premier plan flou, le duc ravi ----
shot({ say: 'Chacun reçoit des armoiries', build(S) {
  S.grade({ sat: 1.3, bright: 1.2, contrast: 1.05, lift: [0.04, 0.04, 0.04] });
  const P = S.place('museum-hall', { seed: 9, mood: 'warm', density: 1.3, wall: '#4fb3c8', floor: '#f2e2b8' });
  const duke = S.char('main', { at: P.spots.statue.slice(0, 2), ry: P.spots.statue[2], face: 'blissful', outfit: 'medieval' });
  const shield = S.prop('mug', { at: [-0.35, 1.2, 0.9], scale: 3 });
  duke.extra('sparkle', S.at('titre'), S.at('titre') + 1.2);
  duke.face('laugh', S.at('titre'));
  S.camera('creep', { on: duke, frame: 'mcu', side: 20, into: true });
  S.focus(duke, { at: S.t0 });
  return { duke };
} });
