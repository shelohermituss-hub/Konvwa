// In-page half of tools/check.mjs: loaded into engine/index.html after the scene is ready.
// runCheck({ samples, names }) -> { shots, flags: [{type, shot, t, who, part, what, depth}] }
import * as THREE from 'three';

const TOL = .12;          // env penetration below this is a normal contact (0.12-0.4 = minor, e.g. a back leaning into lockers)
const REST = .65;         // resting on top of something (feet on floor, sitting, lying): env top within this above the part bottom
const AV_TOL = .15;       // avatar vs avatar
const SMALL = .8;         // env meshes smaller than this (cookie, phone, door knob, flowers) are ignored
const TOUCHY = /hug|shove|sit|lie|faint|sleep|carry|pull|drag/;

const R = window.__rbx, S = R.state;
const tmpV = new THREE.Vector3();

function obbFromLocalBox(box, m) { // box in the object's local space, m = matrixWorld
  const e = m.elements, ax = [], he = [];
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()).applyMatrix4(m);
  for (let i = 0; i < 3; i++) { const v = new THREE.Vector3(e[i * 4], e[i * 4 + 1], e[i * 4 + 2]); const L = v.length() || 1; ax.push(v.divideScalar(L)); he.push(size.getComponent(i) / 2 * L); }
  const aabb = new THREE.Box3(); for (let i = 0; i < 8; i++) { const p = c.clone(); for (let k = 0; k < 3; k++) p.addScaledVector(ax[k], he[k] * ((i >> k) & 1 ? 1 : -1)); aabb.expandByPoint(p); }
  return { c, ax, he, aabb };
}
function geomBox(o) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); return o.geometry.boundingBox; }
function groupBox(g) { // union of child mesh boxes in g's local space
  const b = new THREE.Box3(); for (const ch of g.children) if (ch.isMesh) { ch.updateMatrix(); b.union(geomBox(ch).clone().applyMatrix4(ch.matrix)); } return b;
}
// SAT: smallest overlap along the 15 axes (0 or less = apart)
function satDepth(A, B) {
  const axes = [...A.ax, ...B.ax];
  for (const a of A.ax) for (const b of B.ax) { const x = new THREE.Vector3().crossVectors(a, b); if (x.lengthSq() > 1e-6) axes.push(x.normalize()); }
  const d = B.c.clone().sub(A.c); let min = Infinity;
  for (const L of axes) {
    let ra = 0, rb = 0; for (let i = 0; i < 3; i++) { ra += A.he[i] * Math.abs(A.ax[i].dot(L)); rb += B.he[i] * Math.abs(B.ax[i].dot(L)); }
    const ov = ra + rb - Math.abs(d.dot(L)); if (ov <= 0) return 0; if (ov < min) min = ov;
  }
  return min;
}
function inside(p, O, m = 0) { const d = p.clone().sub(O.c); for (let i = 0; i < 3; i++) if (Math.abs(d.dot(O.ax[i])) > O.he[i] + m) return false; return true; }

function envName(o) {
  let n = o, kind = o.userData.kind; while (n && !n.userData.prop) n = n.parent;
  const p = n ? n.userData.prop : 'box'; const w = new THREE.Vector3(); o.getWorldPosition(w);
  return (kind && p === 'room' ? kind : p) + `@(${w.x.toFixed(0)},${w.y.toFixed(0)},${w.z.toFixed(0)})`;
}
function visibleChain(o) { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; }

function avatarParts(a) {
  const parts = [['torso', a.torso, null], ['head', a.head.children[0], null], ['armL', a.la, 1], ['armR', a.ra, 1], ['legL', a.ll, 1], ['legR', a.rl, 1]];
  return parts.map(([n, o, grp]) => ({ name: n, obj: o, box: grp ? groupBox(o) : geomBox(o) }));
}
function poseOf(a, t) { if (a._poseAt) return a._poseAt(t); let n = 'idle'; for (const k of a.keys) if (k.pose !== undefined && k.t <= t) n = k.pose; return n; } // _poseAt: 'sit:<pose>' while a { sit } key holds the legs seated

export function runCheck({ samples = 8, names = [] } = {}) {
  const shots = S.shots, dur = S.duration, flags = [], cam = S.camera;
  const env = R.collidables().filter(o => !(o.material && o.material.transparent && o.material.alphaTest));
  const avs = S.avatars.map((a, i) => ({ a, name: names[i] || 'a' + i, parts: avatarParts(a) }));
  const ray = new THREE.Raycaster();
  for (let si = 0; si < shots.length; si++) {
    const s = shots[si], end = si + 1 < shots.length ? shots[si + 1].t0 : dur; if (end <= s.t0) continue;
    for (let k = 0; k < samples; k++) {
      const t = s.t0 + (end - s.t0) * (k + .5) / samples;
      R.poseAt(t);
      const frust = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const envO = []; for (const o of env) { if (!visibleChain(o)) continue; const O = obbFromLocalBox(geomBox(o), o.matrixWorld);
        const sz = O.aabb.getSize(tmpV); if (Math.max(sz.x, sz.y, sz.z) < SMALL) continue; O.o = o; O.plane = o.geometry.type === 'PlaneGeometry'; envO.push(O); }
      const live = [];
      for (const A of avs) {
        if (!visibleChain(A.a.root)) continue;
        const P = A.parts.map(p => { const O = obbFromLocalBox(p.box, p.obj.matrixWorld); O.name = p.name; return O; });
        if (!P.some(O => frust.intersectsBox(O.aabb))) continue; // off screen
        // line of sight: is any part centre visible (no set/prop surface between camera and it)? Avatars in another
        // location (place() 300 units away) are behind walls and are skipped.
        const envMeshes = envO.filter(E => !(E.o.material && E.o.material.userData && E.o.material.userData.glass)).map(E => E.o); let seen = false, blocker = null; // glass / water (material.userData.glass) never hides anyone
        for (const O of [P[0], P[1], P[4], P[5]]) { const d = O.c.distanceTo(cam.position); ray.set(cam.position, O.c.clone().sub(cam.position).normalize()); ray.near = 0; ray.far = Math.max(.01, d - .6);
          const h = ray.intersectObjects(envMeshes, false)[0]; if (!h) { seen = true; break; } if (!blocker) blocker = { o: h.object, d: d - h.distance, dist: d }; }
        if (!seen) { if (blocker && blocker.dist < 25) flags.push({ type: 'HIDDEN', shot: si + 1, t, who: A.name, part: '', what: envName(blocker.o), depth: blocker.d }); continue; }
        // projected head height in output px (1920 tall): tiny far-away people are not judged
        const hd = P[1], top = hd.c.clone().addScaledVector(new THREE.Vector3(0, 1, 0), hd.he[1]).project(cam), bot = hd.c.clone().addScaledVector(new THREE.Vector3(0, 1, 0), -hd.he[1]).project(cam);
        const hpx = Math.abs(top.y - bot.y) / 2 * 1920; if (hpx < 24) continue;
        live.push({ ...A, P, pose: poseOf(A.a, t), hpx });
      }
      const subject = live.reduce((m, A) => !m || A.hpx > m.hpx ? A : m, null);
      // avatar vs set / props
      for (const A of live) for (const O of A.P) {
        if (!frust.intersectsBox(O.aabb)) continue;
        for (const E of envO) {
          if (!O.aabb.intersectsBox(E.aabb) || E.o.userData.kind === "water") continue; // standing in water is fine
          const top = E.aabb.max.y; if (top - O.aabb.min.y < REST && O.c.y > top - .05) continue; // resting on it
          // sitting / lying / sleeping on furniture is a deliberate contact (legs under a desk, sunk into a bed or armchair):
          // only room surfaces (walls, ceiling) still count for those poses
          if (/sit|lie|faint|sleep|crouch|hugKnees|kneel|crawl|drag|swim|hide/.test(A.pose) && E.o.userData.kind !== 'wall' && E.o.userData.kind !== 'ceiling') continue;
          const d = satDepth(O, E); if (d > TOL) flags.push({ type: 'CLIP', shot: si + 1, t, who: A.name, part: O.name, what: envName(E.o), depth: d });
        }
      }
      // avatar vs avatar
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const A = live[i], B = live[j]; if (/hug|shove/.test(A.pose) || /hug|shove/.test(B.pose)) continue;
        let best = null; for (const X of A.P) for (const Y of B.P) { if (!X.aabb.intersectsBox(Y.aabb)) continue; const d = satDepth(X, Y); if (d > AV_TOL && (!best || d > best.depth)) best = { part: X.name, other: Y.name, depth: d }; }
        if (best) flags.push({ type: 'CLIP', shot: si + 1, t, who: A.name, part: best.part, what: B.name + '.' + best.other, depth: best.depth });
      }
      // heads cut by the frame edge / hidden behind something nearer
      for (const A of live) {
        const H = A.P[1]; const pts = []; for (let i = 0; i < 8; i++) { const p = H.c.clone(); for (let k2 = 0; k2 < 3; k2++) p.addScaledVector(H.ax[k2], H.he[k2] * ((i >> k2) & 1 ? 1 : -1)); pts.push(p.project(cam)); }
        if (pts.some(p => p.z > 1 || p.z < -1)) continue;
        const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
        const area = (x1 - x0) * (y1 - y0); const ix = Math.max(0, Math.min(1, x1) - Math.max(-1, x0)), iy = Math.max(0, Math.min(1, y1) - Math.max(-1, y0));
        const vis = area > 0 ? ix * iy / area : 0;
        if (vis <= 0) continue; // fully out of frame: not in the shot
        // only the shot's subject (biggest head on screen) counts; crowd heads at the edge are normal framing
        if (A === subject && A.hpx >= 120 && vis < .75 && vis > .05 && (y1 - y0) < 1.0) flags.push({ type: 'CUT', shot: si + 1, t, who: A.name, part: 'head', what: 'frame edge', depth: 1 - vis });
      }
      // camera inside geometry
      for (const E of envO) if (!E.plane && Math.min(...E.he) > .03 && inside(cam.position, E, .05)) flags.push({ type: 'CAM', shot: si + 1, t, who: 'camera', part: '', what: envName(E.o), depth: 0 });
      for (const A of live) for (const O of A.P) if (inside(cam.position, O, .05)) flags.push({ type: 'CAM', shot: si + 1, t, who: 'camera', part: '', what: A.name + '.' + O.name, depth: 0 });
    }
  }
  return { shots: shots.map((s, i) => ({ n: i + 1, t0: s.t0, t1: i + 1 < shots.length ? shots[i + 1].t0 : dur })), flags };
}
