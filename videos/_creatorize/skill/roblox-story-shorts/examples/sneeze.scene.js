// WORKED EXAMPLE (lab scene, imports rewritten for a project: scenes/scene.js). Times are this video's own; read it for technique, never copy times.
// sneeze: original short (54.4 s). Every sneeze teleports the person closest to you. Max, Brad, pepper, a penguin.
import { video, set, place, useLight, avatar, cam, captions, rel, head, shake, flash, fade, lines, prop, onFrame, THREE, scene, mat, box } from '../engine.js';

video({ duration: 54.39 });
const CLASS = set('classroom');                      // origin
const HALL = place('hallway', [0, 0, -300]);
const BAK = place('house_kitchen', [300, 0, 0]);     // French bakery
{ scene.updateMatrixWorld(true); const kill = []; const v = new THREE.Vector3(); scene.traverse(o => { if (!o.isMesh || o.userData.kind) return; o.getWorldPosition(v); if (v.x > 295 && v.x < 305 && v.z > -1 && v.z < 5 && v.y < 5) kill.push(o); }); kill.forEach(o => o.parent.remove(o)); }
const CAF = place('house_kitchen', [600, 0, 0]);     // cafeteria
// shells: a built set used only for its lighting, its own meshes hidden, our custom build on top
function shell(name, at) {
  const before = new Set(scene.children); const lp = place(name, at);
  for (const c of scene.children) if (!before.has(c) && !c.isLight && c.children !== undefined && c.type !== 'Object3D') c.visible = false;
  return lp;
}
const POOL = shell('bedroom', [900, 0, 0]);
const ANT = shell('park', [1200, 0, 0]);
captions('audio/clean.json');

// ---------------------------------------------------------------- helpers
const MAXL = { skin: '#f2c99b', shirt: { color: '#d12b2b', pattern: 'hoodie', sleeves: 'long' }, pants: { color: '#1d2a44', shoes: '#f4f4f4' }, hair: 'messy', hairColor: '#4a2a14', face: 'classic_smile' };
const FRIEND = { skin: '#7a4a2e', shirt: { color: '#2bb04a', pattern: 'stripes' }, pants: { color: '#2a2a2a' }, hair: 'spiky', hairColor: '#111', face: 'happy_derp' };
const BRAD = { skin: '#f7e0cc', shirt: { color: '#141414', pattern: 'logo', sleeves: 'long' }, pants: { color: '#2257c9', shoes: '#d12b2b' }, hair: 'cap', hatColor: '#f28c1a', face: 'leo_smug' };
const MATH = { skin: '#f7e0cc', shirt: { color: '#e9e3d0', pattern: 'tie', sleeves: 'long' }, pants: { color: '#3b3b44' }, hair: 'bald', accessory: 'glasses', face: 'glasses_frown' };
const KIDS = [
  { skin: '#f2c99b', shirt: { color: '#f2c933' }, pants: { color: '#333' }, hair: 'long', hairColor: '#7a1a2a' },
  { skin: '#7a4a2e', shirt: { color: '#6a3fc9', pattern: 'hoodie', sleeves: 'long' }, pants: { color: '#111' }, hair: 'bun', hairColor: '#111' },
  { skin: '#f7e0cc', shirt: { color: '#1f9fd1' }, pants: { color: '#4d79b8' }, hair: 'curly', hairColor: '#ddd' },
  { skin: '#c98d5e', shirt: { color: '#ff7aa8', sleeves: 'long' }, pants: { color: '#fff' }, hair: 'long', hairColor: '#f2c933' },
  { skin: '#f2c99b', shirt: { color: '#3a3a3a', pattern: 'torn' }, pants: { color: '#2a2a2a' }, hair: 'spiky', hairColor: '#e05a1a' },
];
const A = (base, pos, rotY, extra = {}) => avatar({ ...base, pos, rotY, ...extra });
const vis = (a, t0, t1) => { a.hide(0); a.show(t0); if (t1 != null) a.hide(t1); return a; };

// teleport puff: white smoke balls burst and shrink
const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .95, roughness: 1, emissive: 0xffffff, emissiveIntensity: .25 });
function puff(t, where, size = 1) {
  const g = new THREE.Group(); scene.add(g);  const offs = [[0, 0, 0], [.9, .5, .3], [-.9, .6, -.2], [.4, 1.4, .5], [-.5, -.7, .4], [.6, -.6, -.5], [-.3, 1.1, -.6]];
  const balls = offs.map((o, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.9 + (i % 3) * .25, 16, 12), puffMat); m.position.set(o[0] * 1.3, o[1] * 1.3, o[2] * 1.3); g.add(m); return m; });
  onFrame(T => {
    const k = (T - t) / .55; g.visible = k >= 0 && k <= 1;
    if (!g.visible) return;
    const p = typeof where === 'function' ? where() : new THREE.Vector3(...where); g.position.copy(p);
    const s = size * (k < .25 ? .3 + 2.8 * k : 1 - (k - .25) * 1.2);
    balls.forEach((b, i) => b.scale.setScalar(Math.max(.01, s * (1 + .15 * Math.sin(i * 2.1)))));
  });
  flash(t, .14);
}
// face mask: a white surgical mask on the lower face
function mask(a, t0, t1 = 999) {
  const g = new THREE.Group(); scene.add(g);
  box(1.3, .65, .12, '#e9f1f7', [0, -.375, 0], { parent: g, cast: false });
  box(1.3, .06, .14, '#b9c7d2', [0, .1, 0], { parent: g, cast: false });
  onFrame(t => { g.visible = t >= t0 && t < t1 && a.root.visible; const r = a.root.rotation.y; g.position.copy(a.headPos([0, -.35, 0])); g.position.x += Math.sin(r) * .56; g.position.z += Math.cos(r) * .56; g.rotation.y = r; });
}
// something held in a hand (pudding, croissants, pepper)
function held(g, who) { onFrame(t => { const w = who(t); g.visible = !!w; if (w) g.position.copy(rel(w[0], w[1])()); g.rotation.y = w ? w[0].root.rotation.y : 0; }); }
function pudding() { const g = new THREE.Group(); scene.add(g); box(.7, .7, .7, '#f4f4f4', [0, 0, 0], { parent: g, r: .1 }); box(.62, .18, .62, '#6b3a1c', [0, .62, 0], { parent: g }); box(.08, .9, .08, '#c9c9c9', [.15, .5, 0], { parent: g }); return g; }

// ---------------------------------------------------------------- CLASSROOM (origin)
const maxC = A(MAXL, [0, .7, 4.6], 180);                 // at his desk
const deskKid = A(KIDS[0], [6, .7, 4.6], 180, { face: 'happy_derp' });
const nextRoom = A(KIDS[2], [8.5, 0, -2.5], -120, { face: 'o_eyes' });
const helmetT = A({ ...MATH, hair: 'cap', hatColor: '#f2c21a', accessory: undefined, shirt: { color: '#6b8e3a', sleeves: 'long' } }, [-3, 0, -10.5], 15, { face: 'glasses_worry' });
const mathT = A(MATH, [2, 0, -10.5], 0);
prop('sign', { pos: [2, 6.2, -12.85], text: '2 + 2 = ?', bg: '#1d5e3a' });
maxC.at(0, { pose: 'sit', blend: 0, face: 'classic_smile' }).at(.9, { face: 'squint_frown' }).at(1.42, { face: 'noob_yell' }).at(2.2, { face: 'classic_smile' })
  .at(16.34, { face: 'squint_frown' }).at(16.62, { face: 'noob_yell' }).at(17.2, { face: 'sweat' })
  .at(25.64, { face: 'teary' });
deskKid.at(0, { pose: 'sit', blend: 0 }).at(1.45, { face: 'derp_o' });
vis(deskKid, 0, 3.32);
puff(3.3, [6, 3.6, 4.6]);
vis(nextRoom, 5.9, 6.95); nextRoom.at(5.9, { pose: 'shrug' });
vis(helmetT, 11.0, 12.3); helmetT.at(11, { pose: 'talk' });
mathT.at(0, { pose: 'idle' }).at(16.34, { pose: 'point', face: 'glasses_frown' }).at(16.7, { face: 'derp_o', pose: 'scared' });
vis(mathT, 16.3, 17.5); puff(17.48, [2, 3.6, -10.5]);
mask(maxC, 24.7);

// ---------------------------------------------------------------- HALLWAY [0,0,-300]
const fallKid = A(KIDS[0], [0, 4.5, -310], 0, { face: 'derp_o' });
vis(fallKid, 3.8, 4.7); fallKid.at(3.82, { pos: [0, 4.5, -310], pose: 'fall' }).at(4.3, { pos: [0, 0, -310], ease: 'in' }).at(4.32, { pose: 'faint' });
const sneezeGirl = A(KIDS[3], [-1.4, 0, -322], 90, { face: 'classic_smile' });
const smallV = A(KIDS[2], [1.4, 0, -322], -90, { face: 'neutral' });
sneezeGirl.at(4.6, { face: 'squint_frown' }).at(5.3, { face: 'noob_yell', pose: 'shrug' });
vis(sneezeGirl, 4.6, 6.0); vis(smallV, 4.6, 5.62); puff(5.6, [1.4, 3.6, -322], .8);
const bigGuy = A({ skin: '#f2c99b', shirt: { color: '#1b2440', pattern: 'suit', sleeves: 'long' }, pants: { color: '#1b2440' }, hair: 'fedora', hatColor: '#151515' }, [-2.2, 0, -336], 90, { face: 'squint_frown', scale: 1.15 });
const bigV = A({ skin: '#f7e0cc', shirt: { color: '#e05a1a' }, pants: { color: '#444' }, hair: 'messy', hairColor: '#111' }, [2.6, 0, -336], -90, { face: 'o_eyes' });
bigGuy.at(6.9, { pose: 'idle' }).at(7.25, { face: 'mom_rage', pose: 'armsUp' });
vis(bigGuy, 6.9, 7.8); vis(bigV, 6.9, 7.42); puff(7.4, [2.6, 3.6, -336], 1.6); shake(7.3, .45, .4);
// chaos: three sneezers, victims popping away one by one
const chaos = [];
for (let i = 0; i < 3; i++) {
  const z = -350 - i * 5.5, s = A(KIDS[(i + 1) % 5], [-1.6, 0, z], 90, { face: 'noob_yell' }), v = A(KIDS[(i + 3) % 5], [1.6, 0, z], -90, { face: 'derp_o' });
  vis(s, 9.4, 11.05); vis(v, 9.4, 9.7 + i * .42); s.at(9.4, { pose: 'shrug' }); v.at(9.4, { pose: 'scared' });
  puff(9.68 + i * .42, [1.6, 3.6, z], 1); chaos.push(s, v);
}
lines(9.6, 11.0);
// NO CATS sign + a kid pointing at it
prop('sign', { pos: [-4.4, 7.6, -362], rotY: 90, text: 'NO CATS', bg: '#c9241e' });
const catKid = A(KIDS[4], [-2.2, 0, -365.5], -60, { face: 'glasses_frown' }); vis(catKid, 12.2, 13.8); catKid.at(12.2, { pose: 'point' });
// Max + best friend in the hallway
const maxH = A(MAXL, [-1.6, 0, -288], 90, { face: 'bug_eyes' });
const friendH = A(FRIEND, [2.0, 0, -288], -90);
const shyA = A(KIDS[1], [3.4, 0, -294], -45, { face: 'sweat' }), shyB = A(KIDS[3], [-3.4, 0, -281], 160, { face: 'sweat' });
vis(maxH, 13.7, 26.0); vis(shyA, 13.7, 16.3); vis(shyB, 13.7, 16.3);
maxH.at(13.7, { pose: 'idle' }).at(14.6, { face: 'squint_frown' }).at(15.0, { face: 'noob_yell', pose: 'shrug' }).at(15.6, { face: 'sweat', pose: 'idle' })
  .at(19.26, { face: 'squint_frown' }).at(19.75, { face: 'noob_yell', pose: 'shrug' }).at(20.4, { face: 'sweat', pose: 'idle' })
  .at(23.3, { face: 'dion_smirk' }).at(24.76, { face: 'teary', pose: 'walk', pos: [-1.6, 0, -288], rotY: 180 }).at(25.7, { pos: [-1.6, 0, -292.5] });
shyA.at(15.0, { pose: 'scared' }); shyB.at(15.0, { pose: 'scared' });
mask(maxH, 24.7);
friendH.at(19.26, { pose: 'talk', face: 'happy_derp' }).at(19.8, { face: 'derp_o', pose: 'scared' }).at(22.1, { pose: 'idle', face: 'happy_derp' }).at(23.32, { face: 'goofy_tongue' });
vis(friendH, 19.2, 20.32); friendH.show(22.12).hide(24.76); puff(20.3, [2.0, 3.6, -288]); puff(22.12, [2.0, 3.6, -288], .9);
const crois = new THREE.Group(); scene.add(crois);
for (let i = 0; i < 3; i++) box(1.0, .4, .45, '#d9952e', [0, i * .42, 0], { parent: crois, r: .15 });
held(crois, t => t >= 20.4 && t < 24.8 ? [t < 22.1 ? friendB : friendH, [-1.4, 2.2, .7]] : null);

// ---------------------------------------------------------------- BAKERY [300,0,0]
prop('sign', { pos: [298, 7.2, -8.9], text: 'BOULANGERIE', bg: '#1d3fa0' });
for (let i = 0; i < 3; i++) box(1.4, 4.5, .1, ['#1d3fa0', '#ffffff', '#d12b2b'][i], [304.6 + i * 1.4, 4.6, -8.9]);
for (let i = 0; i < 5; i++) box(.45, .4, 3.0, '#d9a24a', [294.6 + i * 1.1, 3.25, -7.9], { r: .15, rotY: 70 });
const baker = A({ skin: '#f7e0cc', shirt: { color: '#ffffff', sleeves: 'long' }, pants: { color: '#ffffff' }, hair: 'bald' }, [300, 0, -5.4], 0, { face: 'dad_moustache' });
const bigVB = A({ skin: '#f7e0cc', shirt: { color: '#e05a1a' }, pants: { color: '#444' }, hair: 'messy', hairColor: '#111' }, [299, 0, 1.5], 20, { face: 'derp_o' });
const friendB = A(FRIEND, [301, 0, 1.5], -15, { face: 'o_eyes' });
vis(bigVB, 7.7, 9.45); bigVB.at(7.74, { pose: 'scared' }).at(8.6, { face: 'bug_eyes', pose: 'shrug' });
vis(friendB, 20.4, 22.1); friendB.at(20.44, { pose: 'scared' }).at(21.1, { face: 'happy_derp', pose: 'idle' });
baker.at(7.7, { pose: 'idle', face: 'dad_moustache' }).at(8.5, { pose: 'wave' }).at(20.44, { pose: 'idle' }).at(21.2, { pose: 'wave' });
puff(7.76, [299, 3.6, 1.5]); puff(20.46, [301, 3.6, 1.5]);

// ---------------------------------------------------------------- POOL [900,0,0] (underwater)
box(34, .3, 34, '#3f9de0', [900, -.3, 0]);
for (let i = -2; i <= 2; i++) box(.6, .02, 30, '#1f4f9a', [900 + i * 5, 0, 0], { cast: false });
box(34, 14, .5, '#5cb6ee', [900, 0, -14]); box(.5, 14, 34, '#5cb6ee', [884, 0, 0]); box(.5, 14, 34, '#5cb6ee', [916, 0, 0]);
box(2.4, .3, 2.4, '#bcd4e6', [900, 0, -4], { cast: false });   // drain
const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x7fd8ff, transparent: true, opacity: .55, side: THREE.DoubleSide, emissive: 0x2a8fd8, emissiveIntensity: .5 }));
water.rotation.x = -Math.PI / 2; water.position.set(900, 11, 0); scene.add(water);
const mathP = A(MATH, [900, 0, -1], 0, { face: 'bug_eyes' }); vis(mathP, 17.6, 19.3);
mathP.at(17.66, { pose: 'float', pos: [900, .6, -1] }).at(19.2, { pos: [900, .3, -1] });
const bubbles = [];
for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.18 + (i % 3) * .08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: .8, emissive: 0xffffff, emissiveIntensity: .3 })); scene.add(b); bubbles.push(b); }
onFrame(t => { bubbles.forEach((b, i) => { const k = ((t * .9 + i * .37) % 3) / 3; b.visible = t > 17.6 && t < 19.3; b.position.set(900 + Math.sin(i * 1.7) * .9 + Math.sin(t * 3 + i) * .15, 4.6 + k * 6, -1 + .9 + Math.cos(i) * .5); }); });


// ---------------------------------------------------------------- CAFETERIA [600,0,0]
prop('sign', { pos: [600, 7.4, -8.9], text: 'CAFETERIA', bg: '#2b7a3a' });
const tables = [[594, -1.5], [606, 6], [594, 6]];
for (const [x, z] of tables) prop('table', { pos: [x, 0, z] });
const maxS = A(MAXL, [603.2, .7, 2], -90, { face: 'teary' });
vis(maxS, 26.8, 30.62); maxS.at(26.8, { pose: 'sit', blend: 0 });
mask(maxS, 0);
const tenft = prop('sign', { pos: [606.9, 5.4, -8.9], text: '10 FT', bg: '#c9241e' }); void tenft;
// the line: Max at the counter, Brad cuts in front
const maxL = A(MAXL, [603.5, 0, -3.8], -90, { face: 'classic_smile' });
const brad = A(BRAD, [598.8, 0, -1.4], 180);
vis(maxL, 30.6, 50.95);
maxL.at(30.62, { pose: 'idle' }).at(33.6, { face: 'squint_mad' }).at(34.3, { face: 'noob_angry', pose: 'shrug' }).at(35.2, { face: 'teary', pose: 'idle' })
  .at(36.9, { face: 'sweat' }).at(38.26, { face: 'squint_frown' }).at(42.5, { face: 'glasses_frown' }).at(46.26, { face: 'dion_smirk' })
  .at(47.52, { pose: 'point', face: 'leo_smug' }).at(48.14, { face: 'squint_frown', pose: 'idle' }).at(48.5, { face: 'mom_rage', pose: 'armsUp' }).at(49.4, { face: 'leo_smug', pose: 'idle' });
mask(maxL, 0, 46.6);
brad.at(30.6, { pose: 'idle' }).at(31.5, { pose: 'idle', pos: [598.8, 0, -1.4], rotY: 180 }).at(32.5, { pose: 'walk', pos: [598.8, 0, -1.4] })
  .at(33.4, { pos: [600.2, 0, -3.8], pose: 'idle', rotY: -90 }).at(34.14, { pose: 'shove', face: 'evil' }).at(34.6, { pose: 'idle', rotY: 90 })
  .at(35.16, { pose: 'talk', face: 'happy_derp' }).at(42.48, { face: 'leo_smug', pose: 'idle' }).at(43.88, { pose: 'talk' })
  .at(44.96, { face: 'noob_yell', pose: 'shrug' }).at(46.26, { face: 'leo_smug', pose: 'idle' }).at(48.6, { face: 'derp_o', pose: 'scared' });
vis(brad, 30.6, 48.9); puff(48.88, rel(brad, [0, 3.6, 0]), 1.4); shake(48.7, .5, .5); lines(48.6, 49.0);
const pud = pudding(); held(pud, t => t >= 30.6 && t < 34.3 ? [maxL, [-1.4, 2.0, .9]] : t >= 34.3 && t < 48.88 ? [brad, [-1.4, 2.0, .9]] : null);
const pudFloor = pudding(); onFrame(t => { pudFloor.visible = t >= 48.88 && t < 50.95; pudFloor.position.set(600.2, 0, -3.6); });
const pepper = new THREE.Group(); scene.add(pepper); box(.45, .9, .45, '#e8e8e8', [0, 0, 0], { parent: pepper }); box(.47, .25, .47, '#2a2a2a', [0, .9, 0], { parent: pepper });
held(pepper, t => t >= 47.52 && t < 48.6 ? [maxL, [-.3, 4.0, .9]] : null);
// cafeteria kids: by the walls (10 ft), then at the tables, then under them
const KPOS = [[592.4, -6], [609, -2.5], [591.5, 7.5], [608.5, 8], [596, 8.2]];
const KTAB = [[592.5, 1.2], [591.2, -4.6], [604.4, 3.3], [607.6, 3.3], [594, 3.3]];
const KUND = [[596, -1.5], [591.8, -1.5], [605, 6], [607.4, 6], [594.2, 6]];
const ck = KIDS.map((k, i) => A(k, [...KPOS[i].slice(0, 1), 0, KPOS[i][1]], [45, -45, 135, -135, 180][i], { face: 'sweat' }));
ck.forEach((k, i) => {
  vis(k, 26.8, 48.9);
  k.at(26.8, { pose: 'idle', pos: [KPOS[i][0], 0, KPOS[i][1]] }).at(30.6, { pos: [KPOS[i][0], 0, KPOS[i][1]] })
    .at(30.62, { pos: [KTAB[i][0], 0, KTAB[i][1]], rotY: i < 2 ? 180 : 0, face: 'classic_smile', blend: 0 })
    .at(39.68, { face: ['derp_o', 'sis_scared', 'o_eyes', 'bug_eyes', 'derp_o'][i], pose: 'scared', pos: [KTAB[i][0], 0, KTAB[i][1]] })
    .at(40.85, { pose: 'crouch', blend: .15, pos: [KTAB[i][0], 0, KTAB[i][1]] }).at(41.3, { pos: [KUND[i][0], 0, KUND[i][1]], ease: 'out' });
});
// MISSING poster
const missing = prop('sign', { pos: [609.85, 5.6, -2], rotY: -90, text: 'MISSING: BRAD', bg: '#f2f2f2' }); void missing;

// ---------------------------------------------------------------- ANTARCTICA [1200,0,0]
box(160, .3, 160, '#f2f7fc', [1200, -.3, 0], { rough: .9 });
const ice = [[1192, -12, 5, 4, 4], [1208, -16, 7, 6, 5], [1186, -26, 9, 9, 7], [1214, -30, 10, 12, 8], [1200, -40, 18, 7, 8]];
ice.forEach(([x, z, w, h, d], i) => { const m = box(w, h, d, '#bfe7f7', [x, 0, z], { rough: .25 }); if (i === 0) { m.material = new THREE.MeshStandardMaterial({ color: 0xbfe7f7, transparent: true, opacity: .45, roughness: .2 }); m.castShadow = false; } });
for (let i = 0; i < 7; i++) box(3 + i % 3, .8, 3, '#ffffff', [1188 + i * 4.2, 0, -6 - (i % 3) * 3], { r: .35 });
// the penguin (boxes)
const peng = new THREE.Group(); peng.position.set(1200, 0, 0); scene.add(peng);
box(1.9, 2.6, 1.6, '#1a1c22', [0, .35, 0], { parent: peng, r: .3 });
box(1.4, 2.0, .2, '#f6f6f2', [0, .45, .75], { parent: peng, r: .08 });
box(1.6, 1.3, 1.4, '#1a1c22', [0, 2.9, 0], { parent: peng, r: .3 });
box(1.1, .75, .15, '#f6f6f2', [0, 3.1, .66], { parent: peng });
box(.28, .32, .1, '#111', [-.27, 3.35, .75], { parent: peng }); box(.28, .32, .1, '#111', [.27, 3.35, .75], { parent: peng });
box(.08, .1, .05, '#fff', [-.22, 3.5, .81], { parent: peng }); box(.08, .1, .05, '#fff', [.32, 3.5, .81], { parent: peng });
box(.5, .25, .55, '#f29a1a', [0, 3.0, .9], { parent: peng });
box(.6, .2, .8, '#f29a1a', [-.45, 0, .25], { parent: peng }); box(.6, .2, .8, '#f29a1a', [.45, 0, .25], { parent: peng });
const flipL = box(.2, 1.6, .8, '#1a1c22', [-1.05, .9, 0], { parent: peng }), flipR = box(.2, 1.6, .8, '#1a1c22', [1.05, .9, 0], { parent: peng });
const pudP = pudding(); pudP.position.set(1201.0, 1.75, 1.35); pudP.scale.setScalar(.9); scene.add(pudP);
onFrame(t => {
  flipR.rotation.z = t > 53.0 ? .9 : .15; flipR.position.set(t > 53.0 ? 1.25 : 1.05, t > 53.0 ? 1.4 : .9, t > 53.0 ? .6 : 0);
  pudP.visible = t > 53.0; peng.rotation.z = Math.sin(t * 7) * .04;
});
const bradIce = A(BRAD, [1192, 0, -12], 0, { face: 'sweat' }); vis(bradIce, 50.9); bradIce.at(50.9, { pose: 'scared' });
// Brad shivers inside an ice block (the 5x4x4 one is see-through)
onFrame(t => { bradIce.root.position.x = 1192 + Math.sin(t * 60) * .05; });

// ---------------------------------------------------------------- lighting cuts
useLight(0, CLASS); useLight(3.82, HALL); useLight(5.9, CLASS); useLight(6.94, HALL); useLight(7.74, BAK); useLight(9.42, HALL);
useLight(11.04, CLASS); useLight(12.28, HALL); useLight(16.34, CLASS); useLight(17.66, POOL); useLight(19.26, HALL); useLight(20.44, BAK);
useLight(22.1, HALL); useLight(25.64, CLASS); useLight(26.86, CAF); useLight(50.92, ANT);

// ---------------------------------------------------------------- shots (cut on the words)
cam(0, .9, { pos: [3, 2.6, 12], look: [1.5, 3.6, 4.6], fov: 55 });                                     // In this world
cam(.9, 1.9, { pos: rel(maxC, [0, 4.6, 4.8]), look: head(maxC), fov: 46 });                           // every time you sneeze
shake(1.45, .35, .35);
cam(1.9, 3.04, { pos: [8.6, 4.6, 10.5], look: [5.6, 3.4, 4.6], fov: 50 });                               // the person closest to you
cam(3.04, 3.82, { pos: [6, 4.4, 11], look: [6, 3.0, 4.6], fov: 48 });                                 // gets teleported (puff)
cam(3.82, 4.68, { pos: [-2.5, 1.6, -300], look: [0, 2.6, -310], fov: 60 });                          // somewhere random
cam(4.68, 5.5, { pos: rel(sneezeGirl, [-2.4, 4.6, 5.4]), look: head(sneezeGirl, [-.6, -.4, 0]), fov: 44 }); // small sneeze
cam(5.5, 5.9, { pos: [0, 4.4, -314], look: [1.4, 3.6, -322], fov: 46 });                              // they end up (puff)
cam(5.9, 6.94, { pos: [7.6, 5.0, 2.4], look: head(nextRoom, [0, -.8, 0]), fov: 44 });                     // in the next room
cam(6.94, 7.74, { pos: rel(bigGuy, [1.6, 1.6, 2.6]), look: head(bigGuy), fov: 62 });                 // BIG sneeze (low)
cam(7.74, 8.6, { pos: [299.4, 4.4, 9.5], look: [299.4, 3.6, -2], fov: 50 });                         // another
cam(8.6, 9.42, { pos: rel(bigVB, [0, 4.6, 4.8]), look: head(bigVB), fov: 46 });                       // country
cam(9.42, 11.04, { pos: [0, 5.6, -341], look: [0, 3, -356], fov: 58, to: { pos: [0, 5.2, -345] } });  // allergy season is chaos
cam(11.04, 12.28, { pos: rel(helmetT, [0, 3.4, 5.4]), look: head(helmetT, [0, -.2, 0]), fov: 50 });     // teachers wear helmets
cam(12.28, 13.74, { pos: [2.6, 4.4, -357], look: [-3.6, 5.6, -363], fov: 56 });                      // nobody owns a cat
cam(13.74, 14.6, { pos: rel(maxH, [0, 4.6, 4.6]), look: head(maxH), fov: 46 });                       // Max had the worst
cam(14.6, 16.34, { pos: rel(maxH, [-1, 4.4, 9.5]), look: head(maxH, [0, -1.6, 0]), fov: 55 });        // allergies in his whole school
cam(16.34, 16.9, { pos: rel(maxC, [0, 4.6, 4.6]), look: head(maxC), fov: 46 });                       // one sneeze sent
cam(16.9, 17.66, { pos: rel(mathT, [0, 4.6, 5.0]), look: head(mathT), fov: 46 });                     // his math teacher (puff)
shake(16.68, .35, .35);
cam(17.66, 19.26, { pos: [900, 1.0, 9.5], look: [900, 4.2, -1], fov: 58, to: { pos: [900, 1.2, 7] } }); // bottom of a swimming pool
cam(19.26, 20.44, { pos: [.2, 4.6, -276], look: [.2, 3.6, -288], fov: 56 });                       // another sent his best friend
cam(20.44, 21.2, { pos: [301, 4.0, 8.5], look: [301, 3.6, 0], fov: 48 });                             // into a bakery
cam(21.2, 22.1, { pos: [301, 6.0, 7.5], look: [301, 5.4, -8.9], fov: 58 });                               // in France
cam(22.1, 23.32, { pos: rel(friendH, [2.6, 4.2, 5.0]), look: head(friendH, [0, -1.0, 0]), fov: 50 }); // came back with croissants
cam(23.32, 24.76, { pos: rel(friendH, [2.0, 4.6, 4.4]), look: head(friendH), fov: 46 });                // that one was fine
cam(24.76, 25.64, { pos: [-2, 4.4, -298], look: head(maxH, [0, -.6, 0]), fov: 46 });                  // mask everywhere (hallway)
cam(25.64, 26.86, { pos: rel(maxC, [1.2, 4.6, 4.0]), look: head(maxC), fov: 44 });                    // everywhere (classroom)
cam(26.86, 28.64, { pos: [612, 5.0, 4.5], look: [602, 3.0, 2], fov: 55 });                           // sat alone at lunch
cam(28.64, 30.62, { pos: [600, 15, 9], look: [600, 0, 0], fov: 70, to: { pos: [600, 16.5, 9.5] } });  // nobody closer than 10 ft
cam(30.62, 31.5, { pos: [609, 4.5, 1], look: [603.5, 3.6, -3.8], fov: 50 });                         // then one day
cam(31.5, 32.52, { pos: rel(brad, [-.8, 1.6, 3.6]), look: head(brad), fov: 60 });                     // a kid named Brad
cam(32.52, 33.58, { pos: [602, 5, 5], look: [601.8, 3.2, -3.8], fov: 52 });                           // cut in front of him
cam(33.58, 34.14, { pos: rel(maxL, [2.6, 4.6, 3.8]), look: head(maxL), fov: 42 });                      // reaction
cam(34.14, 35.16, { pos: [601.9, 3.4, .4], look: [601.9, 2.6, -3.8], fov: 56 });                     // stole his pudding
cam(35.16, 36.9, { pos: rel(brad, [-2.6, 4.6, 3.8]), look: head(brad), fov: 42 });                       // laughed in his face
cam(36.9, 38.26, { pos: rel(maxL, [3.0, 4.6, 3.0]), look: head(maxL), fov: 44, to: { pos: rel(maxL, [2.6, 4.6, 3.8]) } }); // felt it coming
cam(38.26, 39.68, { pos: rel(maxL, [1.8, 4.4, 3.0]), look: head(maxL, [0, -.3, 0]), fov: 40 });          // nose twitched
shake(38.9, .12, .2); shake(39.3, .15, .2);
cam(39.68, 40.88, { pos: [609, 7.5, -7.5], look: [598, 2.0, 3], fov: 70 });                           // everyone in the cafeteria
cam(40.88, 42.48, { pos: [598.2, 1.5, 4.8], look: [594.5, 1.2, -1.5], fov: 60 });                      // dove under the tables
cam(42.48, 43.88, { pos: [598, 4.6, 5], look: head(brad, [0, -1, 0]), fov: 52 });                     // Brad just stood there
cam(43.88, 44.96, { pos: rel(brad, [-2.6, 4.6, 3.8]), look: head(brad), fov: 42 });                      // what are you gonna do
cam(44.96, 46.26, { pos: rel(brad, [-2.2, 1.4, 2.4]), look: head(brad), fov: 62 });                     // sneeze on me?
cam(46.26, 47.52, { pos: rel(maxL, [2.6, 4.6, 3.8]), look: head(maxL), fov: 42 });                      // Max didn't sneeze
cam(47.52, 48.3, { pos: rel(maxL, [2.4, 4.4, 3.4]), look: head(maxL, [-.2, -.2, 0]), fov: 44 });       // he sniffed some pepper
cam(48.3, 49.0, { pos: [605, 4.6, 5], look: [601.6, 3.6, -3.8], fov: 56 });                         // ACHOO (Brad poof)
cam(49.0, 50.0, { pos: [600.2, 2.4, 1.2], look: [600.2, .4, -3.6], fov: 52 });                        // Brad hasn't been seen
cam(50.0, 50.92, { pos: [604, 5.4, -2], look: [609.85, 5.4, -2], fov: 50 });                          // since (MISSING poster)
cam(50.92, 52.28, { pos: [1200, 9, 22], look: [1200, 2, -10], fov: 55, to: { pos: [1200, 7, 16] } }); // somewhere in Antarctica
cam(52.28, 53.04, { pos: [1200, 1.4, 6], look: [1200, 3.0, 0], fov: 55 });                            // a penguin (low)
cam(53.04, 54.39, { pos: [1201.5, 3.4, 4.8], look: [1200.6, 2.4, 0], fov: 44 });                      // really nice pudding
