// WORKED EXAMPLE (lab scene, imports rewritten for a project: scenes/scene.js). Times are this video's own; read it for technique, never copy times.
// stress 1: "every time you lie, your nose grows" (written from engine/API.md only)
import { video, set, place, useLight, avatar, cam, caption, rel, head, shake, prop, build, attach, onFrame, crowd, lineUp, randomLook, animal, title, label, puff, sfx, sign } from '../engine.js';

video({ duration: 12 });
const CLASS = set('classroom');
const HALL = place('house_hallway', [300, 0, 0]);
const CITY = place('city_street', [600, 0, 0]);

const MAX = { skin: '#f2c99b', shirt: { color: '#d12b2b', text: 'MAX' }, pants: { color: '#1d2a44', shoes: '#fff' }, hair: 'quiff', hairColor: '#4a2a14', face: 'classic_smile' };
// one Max per location (teleport rule), each with his own nose
function nose(a, grow) { // grow(t) -> length in studs
  const g = build([{ box: [.32, .32, 1], at: [0, -.16, 0], color: '#f2c99b', r: .1 }]);
  attach(a, g, { to: 'head', off: [0, -.1, .62] });
  onFrame(t => { const L = grow(t); g.scale.set(1, 1, L); g.position.z = .62 + L / 2 - .5; });
  return g;
}
const ramp = (keys) => t => { let v = keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const [t0, a] = keys[i], [t1, b] = keys[i + 1]; if (t >= t0 && t < t1) { const u = Math.min(1, (t - t0) / Math.min(.35, t1 - t0)); v = a + (b - a) * u; return v; } } return keys[keys.length - 1][1]; };

// ---------------- classroom
const maxC = avatar({ ...MAX, pos: [0, .7, 4.4], rotY: 180 });
nose(maxC, ramp([[0, .5], [1.5, .5], [1.9, 1.6], [3.8, 1.6], [4.1, 5], [12, 5]]));
const teacher = avatar({ skin: '#7a4a2e', shirt: { color: '#e9e3d0', pattern: 'tie', sleeves: 'long' }, pants: '#3b3b44', hair: 'bun', hairColor: '#111', accessory: 'glasses', face: 'glasses_frown', pos: [0, 0, -7], rotY: 0 });
teacher.at(2.4, { pose: 'talk' }).at(3.6, { pose: 'crossArms', face: 'squint_mad' }).at(4.6, { face: 'derp_o', pose: 'scared' });
const kids = crowd(4, { center: [0, 0, 7], w: 14, d: 4, face: [0, -8], seed: 3 });
kids.forEach((k, i) => k.at(4.6, { face: ['derp_o', 'o_eyes', 'bug_eyes', 'sweat'][i % 4], pose: i % 2 ? 'scared' : 'point' }));
maxC.at(0, { pose: 'sit', blend: 0, face: 'leo_smug' }).at(3.6, { pose: 'sitTalk', face: 'dion_smirk' }).at(4.1, { face: 'derp_o', pose: 'scared', sit: true });
shake(4.1, .35, .4); sfx(4.15, 'vine_boom');

// ---------------- hallway at home
const maxH = avatar({ ...MAX, pos: [300, 0, -1], rotY: 180, face: 'sweat' });
nose(maxH, ramp([[0, 5], [6.6, 5], [6.95, 9], [12, 9]]));
const mom = avatar({ skin: '#f2c99b', shirt: { color: '#6a3fc9', sleeves: 'long' }, pants: '#2a2a2a', hair: 'long', hairColor: '#7a1a2a', face: 'mom_teeth', pos: [300, 0, -6], rotY: 0 });
mom.at(5.8, { pose: 'handsHips' }).at(6.6, { pose: 'point' });
prop('cookie', { pos: [300.8, 2.6, 1.6] });
maxH.at(5.8, { pose: 'idle' }).at(6.4, { pose: 'shrug', face: 'leo_smug' }).at(7.0, { face: 'bug_eyes', headPitch: 0 });
shake(6.95, .3, .35); sfx(6.95, 'impact/thud');

// ---------------- city, a week later
const maxS = avatar({ ...MAX, pos: [600, .3, 14], rotY: 180, face: 'teary' });
nose(maxS, ramp([[0, 14], [11.2, 14], [11.6, .5]]));
maxS.at(8.2, { pose: 'walk', pos: [600, .3, 14] }).at(9.6, { pos: [600, .3, 9], pose: 'idle' }).at(10.6, { pose: 'talk', face: 'teary' }).at(11.3, { face: 'happy_derp', pose: 'cheer' });
const walkers = lineUp(3, { at: [607.6, .3, 4], dir: 'z', gap: 5, rotY: -90, seed: 9 });
walkers.forEach(w => w.at(8.2, { pose: 'point', face: 'goofy_tongue' }));
const dog = animal('dog', { pos: [596, 0, -2], rotY: 0 });
dog.at(9.4, { pos: [596, 0, -2], anim: 'run' }).at(10.4, { pos: [599.6, 0, 3], rotY: 30 }).at(10.4, { anim: 'idle' });
puff(11.3, maxS, 1.2); title(8.2, 9.3, 'one week later', { y: .3 });
label(maxS, 'MAX', { t0: 9.4, t1: 10.5, off: [0, 1.8, 0] });
sign('NO LYING ZONE', { pos: [600, 0, -6], post: true, bg: '#c9241e' });
sfx(11.3, 'pop/pop');

// ---------------- light + shots
useLight(0, CLASS); useLight(5.8, HALL); useLight(8.2, CITY);
cam(0, 1.2, { pos: rel(maxC, [-2.5, 4.6, 7]), look: head(maxC, [0, -.8, 0]), fov: 50 });                // in this world
cam(1.2, 2.4, { pos: rel(maxC, [1.2, 4.6, 4.4]), look: head(maxC), fov: 42 });                          // every time you lie your nose grows
cam(2.4, 3.6, { pos: rel(teacher, [1.5, 4.4, 5]), look: head(teacher), fov: 45 });                       // did you do your homework
cam(3.6, 4.6, { pos: rel(maxC, [-1.5, 4.6, 5]), look: head(maxC), fov: 46 });                            // yes (boom)
cam(4.6, 5.8, { pos: [9, 7, 14], look: [0, 3, 3], fov: 58 });                                            // the whole class saw it
cam(5.8, 6.6, { pos: rel(maxH, [-2.4, 5.6, -6]), look: head(mom, [0, -.6, 0]), fov: 50 });                          // mom: did you eat the cookies
cam(6.6, 8.2, { pos: rel(maxH, [3.2, 1.6, 6]), look: head(maxH), fov: 62, roll: 8 });                    // no (nose hits mom)
cam(8.2, 9.4, { pos: [606, 6, 28], look: [600, 3.4, 12], fov: 55 });                                     // a week later
cam(9.4, 10.6, { pos: [592, 2.2, 10], look: [598, 2, 2], fov: 55 });                                     // a dog thought it was a stick
cam(10.6, 12, { pos: rel(maxS, [0, 4.4, 5]), look: head(maxS), fov: 44 });                               // he finally told the truth
caption(0, 1.2, 'In this world'); caption(1.2, 2.4, 'every time you lie, your nose grows'); caption(2.4, 3.6, 'Did you do your homework?');
caption(3.6, 4.6, 'Yes.'); caption(4.6, 5.8, 'The whole class saw it'); caption(5.8, 6.6, 'Did you eat the cookies?'); caption(6.6, 8.2, 'No!');
caption(9.4, 10.6, 'a dog thought it was a stick'); caption(10.6, 12, 'so he finally told the truth');
