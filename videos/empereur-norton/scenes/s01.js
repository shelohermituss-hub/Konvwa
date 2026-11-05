// L'empereur Norton (San Francisco, 1859-1880) : un homme ruiné se proclame empereur, et toute une ville joue le jeu.
// Style toon (moteur du pack Creatorize) : décors habillés, lumière par plan, têtes blanches, couleurs vives.
import { shot } from '../engine.js';
const F = 1 / 30;
const GRADE = { day: { sat: 1.3, bright: 1.18, contrast: 1.05 }, warm: { sat: 1.3, bright: 1.25, contrast: 1.04 }, night: { sat: 1.3, bright: 1.45, contrast: 1.0, lift: [0.03, 0.03, 0.07] } };
const sp = (P, ...n) => { for (const k of n) if (P.spots[k]) return P.spots[k]; return [0, 0, 0]; };
const NORTON = { top: { type: 'uniform', color: '#1d3f8f', trim: '#f2c230' }, hat: 'officer', hatColor: '#1d3f8f', hair: { type: 'horseshoe', color: '#e6e6e6' }, acc: ['mustache'] };
const norton = (S, at, ry, face = 'smug') => S.char('walt', { at, ry, face, look: NORTON });
const cop = (S, at, ry, face = 'neutral', id = 'sam') => S.char(id, { at, ry, face, look: { hat: 'officer', hatColor: '#1d3a6e', top: { type: 'uniform', color: '#1d3a6e', trim: '#f2c230' } } });

// ---- 1 : 1859, la lettre ----
shot({ say: 'Mille huit cent cinquante-neuf', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('street', { seed: 11, era: '1919', mood: 'warm', names: ['THE BULLETIN', 'GODZY', 'BAKERY'] });
  const sw = sp(P, 'sidewalk');
  const N = norton(S, [sw[0], sw[1] - 2.4], 0, 'determined');
  N.walk([[sw[0], sw[1] + 0.4]], S.t0, { style: 'brisk', until: S.at('lettre') });
  S.camera('creep', { on: [sw[0], 1.1, sw[1] - 0.8], frame: 'mws', height: 4 });
  return { N };
} });

// ---- 2 : la lettre, « Je me proclame empereur » ----
shot({ say: '« Je me proclame', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('old-town', { seed: 4, era: '1919', mood: 'warm' });
  const cf = sp(P, 'cafe');
  const N = norton(S, cf.slice(0, 2), 0, 'determined');
  N.gesture('pointUp', S.at('EMPEREUR'));
  N.face('excited', S.at('EMPEREUR'));
  S.fx('sparkle', { at: [N.home.x, 1.8, N.home.z], size: 0.6 });
  S.camera('creep', { on: N, frame: 'mcu', side: 20, into: true });
  return { N };
} });

// ---- 3 : il a tout perdu (riz) ----
shot({ say: 'Il s\'appelle Joshua', build(S) {
  S.grade(GRADE.day);
  const P = S.place('harbour', { seed: 3, era: '1919', mood: 'day' });
  const q = sp(P, 'quay');
  const N = norton(S, q.slice(0, 2), q[2], 'worried');
  S.info('sign', { at: [q[0] + 1.6, q[1] - 0.4], text: 'RIZ\nÀ VENDRE', style: 'wood', mount: 'posts', height: 1.1 });
  N.face('sad', S.at('perdu'));
  N.extra('gloom', S.at('perdu'), S.at('riz') + 1);
  N.gesture('shrug', S.at('riz'));
  S.camera('creep', { ...P.cams.quay, on: N, frame: 'ms' });
  return { N };
} });

// ---- 4 : il se couronne tout seul ----
shot({ say: 'Alors', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('museum-hall', { seed: 6, mood: 'warm', density: 1.3, wall: '#e8b04a' });
  const h = sp(P, 'hall');
  const N = norton(S, h.slice(0, 2), h[2], 'smug');
  const crown = S.prop('crown', { at: [h[0], 2.9, h[1]], scale: 1.6 });
  const tC = S.at('couronne');
  S.tick((t) => { const k = Math.min(1, Math.max(0, (t - (tC - 0.5)) / 0.55)); crown.position.y = 2.9 - k * 1.28; });
  N.gesture('present', tC);
  N.face('laugh', tC + 0.2);
  S.fx('sparkle', { at: [h[0], 1.7, h[1]], size: 0.8 });
  S.camera('creep', { on: N, frame: 'mcu', side: -15, into: true });
  return { N };
} });

// ---- 5 : premier décret : abolir le Congrès ----
shot({ say: 'Son premier décret', build(S) {
  S.grade(GRADE.day);
  const P = S.place('museum-hall', { seed: 2, mood: 'day', density: 1.2 });
  const h = sp(P, 'hall');
  const N = norton(S, [h[0], h[1] + 0.5], 0, 'determined');
  S.info('sign', { at: [h[0] - 1.8, h[1] - 0.6], text: 'DÉCRET N°1', style: 'wood', mount: 'posts', height: 1.2 });
  N.gesture('point', S.at('abolit'));
  S.camera('creep', { on: N, frame: 'ms', side: 20, into: true });
  return { N };
} });

// ---- 6 : le Congrès l'ignore ; l'armée ne bouge pas ----
shot({ say: 'Le Congrès l\'ignore', build(S) {
  S.grade(GRADE.day);
  const P = S.place('museum-hall', { seed: 5, mood: 'warm', density: 1.2 });
  const h = sp(P, 'hall');
  const ids = ['viktor', 'priya', 'otis', 'rose', 'dex'];
  const crowd = ids.map((id, i) => S.char(id, { at: [h[0] - 1.4 + i * 0.7, h[1] - 1.5], ry: (i - 2) * 0.2, face: 'bored' }));
  const N = norton(S, [h[0], h[1] + 0.3], 0, 'annoyed');
  const soldier = cop(S, [h[0] + 1.6, h[1] - 0.5], -0.3, 'skeptical');
  soldier.gesture('shrug', S.at('armée'));
  crowd.forEach((a, i) => a.headTo([h[0] + 3, 1.2, h[1] + 4], S.at('ignore') + i * 3 * F));
  S.camera('creep', { on: [h[0], 1.1, h[1] - 0.6], frame: 'ws', height: 6, into: true });
  return { N, crowd };
} });

// ---- 7 : pourtant, la ville joue le jeu ----
shot({ say: 'Pourtant', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('old-town', { seed: 13, era: '1919', mood: 'warm' });
  const [cx, cz] = sp(P, 'center');
  const N = norton(S, [cx, cz + 0.2], 0, 'excited');
  const ids = ['juno', 'dex', 'otis', 'rose', 'kai', 'priya', 'lola', 'mei'];
  const crowd = ids.map((id, i) => S.char(id, { at: [cx - 2.2 + i * 0.62, cz + 1.4 + (i % 2) * 0.15], ry: 0, face: 'happy' }));
  crowd.forEach((a, i) => a.gesture('clap', S.at('jeu') + i * 2 * F));
  N.gesture('wave', S.at('jeu'));
  S.fx('confetti', { at: [cx, 3.5, cz], count: 120 });
  S.camera('creep', { ...P.cams.square });
  return { N, crowd };
} });

// ---- 8 : sa monnaie, acceptée au restaurant ----
shot({ say: 'Il imprime', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('diner', { seed: 7, mood: 'day', name: 'GODZY DINER' });
  const c = sp(P, 'center');
  const N = norton(S, c.slice(0, 2), c[2], 'smug');
  const reg = S.prop('cash_register', { at: [c[0] - 1.0, 0.95, c[1] - 0.6] });
  const bills = S.prop('money_stack', { at: [c[0] + 0.5, 0.95, c[1] - 0.4], count: 3 });
  N.gesture('present', S.at('monnaie'));
  N.face('laugh', S.at('ACCEPTENT') || S.at('restaurants'));
  S.camera('creep', { on: N, frame: 'ms', side: 25, into: true });
  return { N };
} });

// ---- 9 : 1867, l'arrestation ----
shot({ say: 'Mille huit cent soixante', build(S) {
  S.grade(GRADE.day);
  const P = S.place('street', { seed: 17, era: '1919', mood: 'day', names: ['BANQUE', 'HÔTEL', 'GODZY'] });
  const s = sp(P, 'crossing');
  const N = norton(S, [s[0], s[1]], -0.5, 'worried');
  const C = cop(S, [s[0] - 0.9, s[1] - 0.1], 1.3, 'determined');
  C.reach(N, S.at('arrête'), { side: 'R', hold: 1.2 });
  N.face('shocked', S.at('arrête'));
  N.jolt(S.at('arrête'), { h: 0.3 });
  S.camera('creep', { on: N, frame: 'ms', side: 30, into: true });
  return { N, C };
} });

// ---- 10 : le scandale : le journal ----
shot({ say: 'Le scandale', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('street', { seed: 21, era: '1919', mood: 'warm', names: ['LE JOURNAL', 'LIBRAIRIE', 'CAFÉ'] });
  const s = sp(P, 'sidewalk');
  const ids = ['juno', 'dex', 'otis', 'rose', 'walt', 'kai', 'bea'];
  const crowd = ids.map((id, i) => S.char(id, { at: [s[0] - 1.8 + i * 0.62, s[1] + 1.2 - (i % 2) * 0.15], ry: 0, face: 'angry' }));
  S.info('sign', { at: [s[0], s[1] - 0.5], text: 'AUCUN SANG\nVERSÉ', style: 'wood', mount: 'posts', height: 1.4 });
  crowd.forEach((a, i) => { a.gesture('fists', S.at('scandale') + i * 2 * F); a.extra('vein', S.at('scandale'), S.at('pays') + 1); });
  S.fx('speedLines', { at: [s[0], 1.4, s[1]], dir: [1, 0, 0], count: 12, radius: [0.5, 1.1] });
  S.camera('creep', { on: [s[0], 1.2, s[1] + 0.6], frame: 'ws', height: 6, into: true });
  return { crowd };
} });

// ---- 11 : le chef de la police le libère, avec des excuses ----
shot({ say: 'Le chef de la police', build(S) {
  S.grade(GRADE.day);
  const P = S.place('office', { seed: 9, era: 'modern', mood: 'day' });
  const d = sp(P, 'desk');
  const chief = cop(S, [d[0] - 0.5, d[1] + 1.0], 0.5, 'sad', 'viktor');
  const N = norton(S, [d[0] + 0.5, d[1] + 1.0], -0.3, 'smug');
  chief.gesture('present', S.at('excuses'));
  chief.face('worried', S.at('excuses'));
  N.gesture('hips', S.at('libère'));
  S.camera('creep', { on: [d[0], 1.2, d[1] + 1.0], frame: 'ms', height: 4, into: true });
  return { N, chief };
} });

// ---- 12 : les agents le saluent dans la rue ----
shot({ say: 'Et les agents', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('street', { seed: 31, era: '1919', mood: 'warm', names: ['GODZY', 'PHARMACIE', 'THÉÂTRE'] });
  const s = sp(P, 'sidewalk');
  const N = norton(S, [s[0], s[1] + 0.6], 0, 'smug');
  const cops = ['sam', 'viktor', 'otis', 'kai'].map((id, i) => cop(S, [s[0] - 1.5 + i * 1.0, s[1] - 0.6], 0.12 * (i - 1.5), 'neutral', id));
  cops.forEach((c, i) => c.gesture('stop', S.at('SALUENT') + i * 3 * F));
  S.camera('creep', { on: [s[0], 1.0, s[1]], frame: 'ws', height: 4, into: true });
  return { N, cops };
} });

// ---- 13 : 1880, il meurt ; « Le roi est mort » ----
shot({ say: 'Il meurt', build(S) {
  S.grade(GRADE.night);
  const P = S.place('street', { seed: 41, era: '1919', mood: 'night', names: ['LE JOURNAL', 'CAFÉ', 'HÔTEL'] });
  const s = sp(P, 'sidewalk');
  S.info('sign', { at: [s[0] + 0.2, s[1] - 0.2], text: 'LE ROI\nEST MORT', style: 'wood', mount: 'posts', height: 1.5 });
  const crowd = ['juno', 'dex', 'rose', 'walt', 'priya'].map((id, i) => S.char(id, { at: [s[0] - 1.6 + i * 0.7, s[1] + 1.4], ry: 0, face: 'sad' }));
  crowd.forEach((a) => a.extra('tears', S.at('roi'), S.at('mort') + 1));
  S.fx('rain', { count: 400 });
  S.camera('creep', { on: [s[0] + 0.2, 1.3, s[1]], frame: 'ws', height: 5, into: true });
  return { crowd };
} });

// ---- 14 : le pont ----
shot({ say: 'Il réclamait', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('ocean-surface', { seed: 15, mood: 'warm', ship: false });
  const T = S.THREE;
  const mat = new T.MeshStandardMaterial({ color: '#e0572b', roughness: 0.55 });
  const Z = -30;
  const deck = new T.Mesh(new T.BoxGeometry(46, 0.9, 3.2), mat); deck.position.set(0, 6, Z); S.add(deck);
  for (const x of [-7, 7]) { const tw = new T.Mesh(new T.BoxGeometry(1.4, 16, 1.4), mat); tw.position.set(x, 8, Z); S.add(tw); }
  for (let x = -22; x <= 22; x += 1.6) {
    const ax = Math.abs(x); const y = ax <= 7 ? 7.2 + (8.8 / 49) * x * x : 16 - (ax - 7) * (9.4 / 16);
    const h = Math.max(0.2, y - 6.4); const hg = new T.Mesh(new T.BoxGeometry(0.1, h, 0.1), mat); hg.position.set(x, 6.4 + h / 2, Z); S.add(hg);
  }
  S.info('sign', { at: [-1.5, -6], text: 'GODZY\nFERRY', style: 'wood', mount: 'posts', height: 1.1 });
  S.camera('creep', { on: [0, 10, Z], frame: 30, yaw: 6, height: 1 });
  return {};
} });

// ---- 15 : ouvert en 1936 : l'empereur avait vu juste ----
shot({ say: 'Ce pont', build(S) {
  S.grade(GRADE.warm);
  const P = S.place('harbour', { seed: 18, era: '1919', mood: 'warm' });
  const q = sp(P, 'quay');
  const N = norton(S, q.slice(0, 2), q[2], 'blissful');
  N.extra('sparkle', S.at('juste') - 1.5, S.at('juste') + 1.2);
  N.gesture('thumbsUp', S.at('juste'));
  N.face('laugh', S.at('juste'));
  S.fx('sparkle', { at: [N.home.x, 1.9, N.home.z], size: 0.9 });
  S.camera('creep', { on: N, frame: 'ms', side: -20, into: true });
  return { N };
} });
