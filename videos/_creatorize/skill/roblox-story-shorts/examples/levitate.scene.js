// WORKED EXAMPLE (lab scene, imports rewritten for a project: scenes/scene.js). Times are this video's own; read it for technique, never copy times.
// levitate: 1:1 recreation (26 shots, 32.35 s). Lies make you float; Leo stays smug.
import { video, set, place, useLight, avatar, cam, captions, rel, head, shake, prop, onFrame, THREE, scene, mat } from '../engine.js';

video({ duration: 32.35 });
const BED = set('bedroom');                       // shots 1-3, 9 (window corner)
const HOUSE = place('livingroom', [300, 0, 0]);   // shot 4
const OUT = place('outside_school', [0, 0, 600]); // shots 5-6
const BED2 = place('bedroom', [600, 0, 0]);       // shots 7-8
const HALL = place('hallway', [0, 0, -300]);      // shots 10-26
captions('audio/clean.json');

// ---- cast (our own builds, styled like the ref's cast)
const LEO = { skin: '#f2c99b', shirt: { color: '#1f4fd1', sleeves: 'none' }, pants: { color: '#15161c' }, hair: 'curly', hairColor: '#dcdcdc', face: 'leo_smug' };
const at = (p, r) => ({ pos: p, rotY: r });
const leoA = avatar({ ...LEO, ...at([-4.6, 0, .6], 0) });           // bedroom, in front of the bunk bed
const leoW = avatar({ ...LEO, ...at([3, .25, -6.2], 0), face: 'teary' }); // window corner, on the beanbag
const leoH = avatar({ ...LEO, ...at([299.2, 0, 6.4], 180) });         // house hallway, back to camera
const leoO = avatar({ ...LEO, ...at([-2.4, 0, 606], 90) });         // outside school
const leoB = avatar({ ...LEO, ...at([598.6, 0, 4], 160) });         // sister's room
const leo = avatar({ ...LEO, ...at([-3.7, 0, -305], 90) });         // school hallway, back to the lockers

const suit = avatar({ skin: '#f7e0cc', shirt: { color: '#1b2440', pattern: 'suit', sleeves: 'long' }, pants: { color: '#1b2440' }, hair: 'fedora', hairColor: '#111', hatColor: '#151515', face: 'classic_smile', pos: [300.8, 0, -1.5], rotY: 0 });
const kid = avatar({ skin: '#f7e0cc', shirt: { color: '#1a1a1a', pattern: 'hoodie', sleeves: 'long' }, pants: { color: '#3a0f12', shoes: '#f4f4f4' }, hair: 'messy', hairColor: '#3b2416', face: 'neutral', pos: [2.4, 0, 606], rotY: -90 });
const sister = avatar({ skin: '#7a4a2e', shirt: { color: '#111', pattern: 'torn', sleeves: 'short' }, pants: { color: '#f2f2f2' }, hair: 'spiky', hairColor: '#0d0d0d', face: 'blonde_smug', pos: [601.2, 0, -.6], rotY: -25 });
const bully = avatar({ skin: '#f7e0cc', shirt: { color: '#141414', pattern: 'logo', sleeves: 'long' }, pants: { color: '#2257c9', shoes: '#d12b2b' }, hair: 'long', hairColor: '#f2c933', face: 'noob_angry', pos: [-1.5, 0, -305], rotY: -90 });
const girl1 = avatar({ skin: '#f7e0cc', shirt: { color: '#111', pattern: 'torn', sleeves: 'long' }, pants: { color: '#111' }, hair: 'bun', hairColor: '#111', face: 'noob_yell', pos: [-1.8, 0, -315], rotY: 0 });
const girl2 = avatar({ skin: '#f2c99b', shirt: { color: '#1c2550', pattern: 'hoodie', sleeves: 'long' }, pants: { color: '#4d79b8' }, hair: 'long', hairColor: '#7a1a2a', face: 'o_eyes', pos: [2.2, 0, -315], rotY: 0 });
const teacher = avatar({ skin: '#f7e0cc', shirt: { color: '#141414', pattern: 'tie', sleeves: 'long' }, pants: { color: '#141414' }, hair: 'messy', hairColor: '#111', accessory: 'glasses', face: 'derp_o', pos: [-1.6, 0, -323], rotY: 0 });
// tiny bully seen through the ceiling hole (shot 25)
const mini = avatar({ skin: '#f7e0cc', shirt: { color: '#141414', pattern: 'logo', sleeves: 'long' }, pants: { color: '#2257c9', shoes: '#d12b2b' }, hair: 'long', hairColor: '#f2c933', face: 'noob_angry', pos: [-1.4, 9.9, -305], rotY: -90, scale: .25 });
mini.hide(0).show(27.45).hide(29.57).at(27.45, { pose: 'flail' });

// ---- extra set dressing
const beanbag = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 20), mat('#5f9a3a', { rough: .85 }));
beanbag.scale.set(1, .55, 1); beanbag.position.set(3, .9, -6.4); beanbag.castShadow = beanbag.receiveShadow = true; scene.add(beanbag);
prop('sign', { pos: [-5.8, 7.6, -325.2], rotY: 90, text: 'LIBRARY' });
const hole = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat('#1846c8', { rough: .9, emissive: '#1846c8', ei: .35 }));
hole.rotation.x = Math.PI / 2; hole.position.set(-1.4, 9.97, -305); scene.add(hole);
prop('ceiling_light', { pos: [600, 9.99, -.6] });

// ---- lighting per location
useLight(0, BED); useLight(1.17, HOUSE); useLight(5.95, OUT); useLight(8.85, BED2); useLight(12.07, BED); useLight(14.42, HALL);

// ---- action
leoA.at(0, { pose: 'idle' }); leoO.at(0, { pose: 'idle' }).at(7.7, { face: 'sweat' });
leoW.at(0, { pose: 'sit', blend: 0 });
// shot 4: suit floats a few inches on "small lie", to the ceiling on "big lie"
suit.at(1.17, { pose: 'talk', pos: [300.8, 0, -1.5] }).at(3.0, { pose: 'float', pos: [300.8, 0, -1.5] })
  .at(3.5, { pos: [300.8, .8, -1.5] }).at(4.72, { pos: [300.8, .8, -1.5], face: 'bug_eyes' })
  .at(5.6, { pos: [300.8, 4.3, -1.5], pose: 'flail', face: 'derp_o', ease: 'in' });
// shot 6: kid drifts a foot off the ground
kid.at(6.22, { pose: 'talk', pos: [2.4, 0, 606], face: 'happy_derp' }).at(7.7, { pos: [2.4, 0, 606], pose: 'float', face: 'bug_eyes' }).at(8.6, { pos: [2.4, 1.3, 606] });
// shots 7-8: sister lifts to the light fixture
sister.at(8.85, { pose: 'shrug', pos: [601.2, 0, -.6] }).at(9.95, { pose: 'point' }).at(10.4, { pos: [601.2, 0, -.6], pose: 'float' })
  .at(10.85, { pos: [600.4, 2.5, -.6], face: 'sweat', pose: 'flail' }).at(11.3, { pos: [600.2, 4.2, -.6] });
// school hallway: shove, lie, float up, through the ceiling
bully.at(14.42, { pose: 'shove', face: 'noob_angry' }).at(15.08, { face: 'noob_yell' }).at(15.83, { pose: 'talk', face: 'leo_smug' })
  .at(16.17, { pos: [-1.5, 0, -305], pose: 'float', face: 'derp_o' }).at(17.9, { pos: [-1.5, 3.0, -305], ease: 'in' })
  .at(18.6, { pos: [-1.5, 6.3, -305], pose: 'flail' }).at(19.0, { pos: [-1.5, 6.9, -305], pose: 'float' })
  .at(21.77, { face: 'noob_angry' }).at(25.5, { face: 'noob_yell' }).at(26.9, { pos: [-1.5, 6.9, -305] }).at(27.4, { pos: [-1.5, 15, -305], ease: 'in' });
onFrame(t => { // bully tips onto his side as he rises (pinned flat under the ceiling tiles)
  const k = Math.min(1, Math.max(0, (t - 17.6) / 1.3)); bully.root.rotation.z = -1.5 * k * k * (3 - 2 * k);
  kid.root.rotation.z = t > 7.8 ? -.22 : 0; mini.root.rotation.x = Math.PI; hole.visible = t > 27.3;
});
leo.at(14.42, { pose: 'idle', face: 'noob_unamused' }).at(15.83, { face: 'leo_smug' });
girl1.at(20.05, { pose: 'armsUp' }); girl2.at(20.05, { pose: 'scared' });
teacher.at(20.72, { pose: 'idle' }).at(20.98, { pose: 'faint', face: 'noob_unamused' }).at(21.6, { pose: 'lie' });

// ---- camera (one cam per ref shot). Portrait = narrow horizontal fov: keep distance.
cam(0, .22, { pos: rel(leoA, [0, 4.0, 6.0]), look: head(leoA, [0, -1.5, 0]), fov: 45 });
cam(.22, .6, { pos: rel(leoA, [0, 3.4, 10.5]), look: head(leoA, [0, -2.4, 0]), fov: 45 });
cam(.6, 1.17, { pos: rel(leoA, [0, 3.4, 13.5]), look: head(leoA, [0, -2.4, 0]), fov: 45 });
cam(1.17, 5.95, { pos: rel(leoH, [-1.9, 4.8, -5.0]), look: [300.8, 3.6, -1.5], fov: 55, to: { look: [300.8, 6.4, -1.5] } });
cam(5.95, 6.22, { pos: rel(leoO, [.3, 3.9, 2.4]), look: head(leoO, [0, -.6, 0]), fov: 42 });
cam(6.22, 8.85, { pos: [0, 4.4, 627], look: [0, 3.0, 606], fov: 40 });
cam(8.85, 10.85, { pos: rel(leoB, [-2.4, 5.4, -6.2]), look: head(sister, [0, -1.4, 0]), fov: 58 });
cam(10.85, 12.07, { pos: rel(leoB, [-1.6, 3.0, -4.2]), look: [600.4, 7.8, -.6], fov: 64 });
cam(12.07, 14.42, { pos: [3, 8.6, .2], look: [3, 2.8, -6.2], fov: 46 });
cam(14.42, 14.75, { pos: [-.4, 4.2, -301.2], look: [-3.0, 3.8, -305.2], fov: 52 });
cam(14.75, 15.08, { pos: [-1.0, 4.2, -302.2], look: [-3.0, 3.9, -305.2], fov: 50 });
cam(15.08, 15.83, { pos: rel(bully, [-.5, 3.4, 1.3]), look: head(bully, [0, .1, 0]), fov: 50 });
cam(15.83, 16.17, { pos: [-3.7, 5.0, -302.8], look: head(bully, [0, -.3, 0]), fov: 50 });
cam(16.17, 17.9, { pos: [-2.4, 4.6, -297.5], look: [-2.6, 4.6, -305], fov: 55 });
cam(17.9, 18.32, { pos: [-2.2, 2.6, -297.5], look: head(bully), fov: 58 });
cam(18.32, 18.62, { pos: [-3.6, 1.6, -301.0], look: head(bully), fov: 64 });
cam(18.62, 20.05, { pos: [-1.8, 1.4, -297], look: [-1.6, 8.6, -305], fov: 70, to: { pos: [-1.8, 1.4, -297.8] } });
cam(20.05, 20.72, { pos: [.2, 4.0, -304.3], look: [.2, 3.4, -315], fov: 52 });
cam(20.72, 21.77, { pos: [-.6, 4.6, -315.5], look: [-1.6, 2.6, -324], fov: 50 });
cam(21.77, 24.3, { pos: rel(leo, [0, .9, 1.6]), look: [-1.5, 8.6, -305], fov: 74 });
cam(24.3, 27.45, { pos: [-2.4, 9.5, -306.6], look: [-4.0, 1.5, -305], fov: 70 });
cam(27.45, 29.57, { pos: [-1.4, 1.2, -304.9], look: [-1.39, 10, -305.0], fov: 48 });
cam(29.57, 30.5, { pos: rel(leo, [0, 4.4, 3.6]), look: head(leo), fov: 42 });
cam(30.5, 32.35, { pos: rel(leo, [0, 7.6, 8.6]), look: head(leo, [0, -2.4, 0]), fov: 48, to: { pos: rel(leo, [0, 7.2, 7.6]) } });
shake(14.45, .2, .3); shake(27.0, .25, .4);
