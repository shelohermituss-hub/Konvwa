// Creatorize's preview / render host for ROBLOX STORY SHORTS (style id 'roblox', 1080x1920). Served at
// /p/<projectId>/__suite/roblox.html. The engine is the project's engine.js (the lab's rbx.js: experiments/roblox-style,
// copied by tools/export_suite.py): the scene files declare everything up front and renderAt(t) draws any moment.
// It speaks the same messages as host.js / bhost.js, so the editor (Preview.tsx: seek, playing, pick, frame, info, ping,
// graphics) and the render workers (window.suite: info, stills, sweep, exportVideo, events, layout, errors) work unchanged.
const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'preview';
const FW = 1080, FH = 1920;
const parentPost = msg => { try { window.parent !== window && window.parent.postMessage({ source: 'cz-host', ...msg }, '*'); } catch {} };
const errors = [];
const logError = (level, text) => { errors.push({ level, text: String(text), at: Date.now() }); if (errors.length > 200) errors.shift(); if (MODE === 'preview') parentPost({ type: 'log', level, text: String(text) }); else console.log(`[${level}] ${text}`); };
window.addEventListener('error', e => logError('error', e.message || String(e.error)));
window.addEventListener('unhandledrejection', e => logError('error', String(e.reason?.message || e.reason)));
document.addEventListener('securitypolicyviolation', e => logError('error', `Blocked by the app's security policy: ${e.effectiveDirective || e.violatedDirective} ${String(e.blockedURI || 'inline').slice(0, 160)}`));

let R = null, P = null, END = 0, t = 0, out = null, srcLines = [], NAMES = [];
const SCENE_FILE = () => `scenes/${(P?.scenes || ['scene'])[0]}.js`;
// a shot's name in the Shots list: the words spoken in it (its first caption), else "Shot N"; its line: the cam() call that
// starts it (cam(<t0>, ...) in the scene file), so a click on the shot opens the right place (the engine records neither)
const camLine = t0 => { for (let i = 0; i < srcLines.length; i++) { const m = /\bcam\(\s*(\d+(?:\.\d+)?)\s*,/.exec(srcLines[i]); if (m && Math.abs(+m[1] - t0) < 1e-3) return i + 1; } return 0; };
const wordsIn = (t0, t1) => { const C = R?.state?.captions || [], c = C.find(c => c.t0 >= t0 - .05 && c.t0 < t1 - .05) || C.find(c => c.t1 > t0 + .05 && c.t0 < t1 - .05); const w = c ? String(c.text).trim() : ''; return w.length > 42 ? w.slice(0, 40).replace(/\s+\S*$/, '') + '…' : w; };
const shotsOf = () => {
  const S = R?.state?.shots || [];
  return S.map((s, i) => { const t1 = i + 1 < S.length ? S[i + 1].t0 : END;
    return { index: i, t0: s.t0, t1, file: SCENE_FILE(), line: s.srcLine || camLine(s.t0) || 1, name: s.name || wordsIn(s.t0, t1) || `Shot ${i + 1}`,
      chapter: null, chapterFirst: false, cut: true, trans: null }; });
};
const shotIndexAt = time => { const S = R?.state?.shots || []; let k = 0; for (let i = 0; i < S.length; i++) if (S[i].t0 <= time + 1e-6) k = i; return k; };
const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const whereAt = time => { const i = shotIndexAt(time); return `shot ${i + 1} at ${time.toFixed(2)}s: `; };

// the scene variable that made each avatar (const leo = avatar(...)), like tools/check.mjs: names in picks and the clip check
function nameAvatars() {
  const seen = {}, avs = R.state.avatars || [];
  const base = avs.map((a, i) => { const s = srcLines[(a.srcLine || 0) - 1] || ''; const m = /(\w+)\s*=\s*(?:avatar|\w+)\(/.exec(s); const b = m ? m[1] : a.srcLine ? 'L' + a.srcLine : 'a' + i; seen[b] = (seen[b] || 0) + 1; return b; });
  const k = {}; return base.map(b => seen[b] > 1 ? `${b}#${(k[b] = (k[b] || 0) + 1)}` : b);
}

function draw(time) {
  t = Math.max(0, Math.min(END, time));
  try { R.renderAt(t); } catch (e) { logError('error', whereAt(t) + e.message); }
}

// ---------- its own clock while the video plays (the editor plays the audio; this page follows its epoch clock) ----------
const run = { t: 0, at: 0, rate: 1 }; let playing = false, raf = 0;
const epochNow = () => performance.timeOrigin + performance.now();
function loop() {
  if (!playing) return;
  draw(Math.min(END, run.t + Math.max(0, epochNow() - run.at) / 1000 * run.rate));
  raf = requestAnimationFrame(loop);
}
function setPlaying(on, m) {
  if (m) { run.t = m.t; run.at = m.at; run.rate = +m.rate > 0 ? +m.rate : 1; }
  if (on && !playing) { playing = true; raf = requestAnimationFrame(loop); }
  if (!on && playing) { playing = false; cancelAnimationFrame(raf); draw(t); }
}

// ---------- picking: the avatar (or prop / set part) under the click ----------
function pick(nx, ny, time) {
  if (time !== undefined) draw(time); else draw(t);
  const T = R.THREE, S = R.state, i = shotIndexAt(t), sh = shotsOf()[i] || null;
  const shot = sh ? { index: sh.index, t0: sh.t0, t1: sh.t1, file: sh.file, line: sh.line, name: sh.name } : null;
  const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(nx * 2 - 1, -(ny * 2 - 1)), S.camera);
  const visible = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  const hit = rc.intersectObjects(S.scene.children, true).find(h => h.object.isMesh && visible(h.object));
  if (!hit) return { kind: 'shot', time: t, shot };
  const avs = S.avatars || [], ai = avs.findIndex(a => { for (let o = hit.object; o; o = o.parent) if (o === a.root) return true; return false; });
  let root = hit.object, kind = 'object', name = hit.object.name || null, key = null;
  if (ai >= 0) { root = avs[ai].root; kind = 'character'; name = NAMES[ai]; key = NAMES[ai]; }
  else { for (let o = hit.object; o && !o.isScene; o = o.parent) if (o.userData?.prop) { root = o; name = String(o.userData.prop); kind = 'prop'; break; }
    if (kind === 'object' && hit.object.userData?.kind) { kind = hit.object.userData.kind; name = name || kind; } }
  const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(2));
  const pts = []; for (let k = 0; k < 8; k++) pts.push(new T.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(S.camera));
  const xs = pts.map(p => (p.x + 1) / 2), ys = pts.map(p => (1 - p.y) / 2), x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys));
  const rect = { x: x0, y: y0, w: Math.min(1, Math.max(...xs)) - x0, h: Math.min(1, Math.max(...ys)) - y0 };
  return { kind: 'object', time: t, shot, element: { key, kind, name, point: hit.point.toArray().map(v => +v.toFixed(2)), size, ramp: null,
    ...(ai >= 0 ? { roblox: { avatar: NAMES[ai], line: avs[ai].srcLine || null, file: SCENE_FILE() } } : {}) }, rect };
}

function info() {
  return { end: END, title: P?.title, settings: P?.settings || {}, art: [FW, FH], size: [FW, FH], kind: 'roblox', errors: errors.slice(-50), cues: [],
    preview: { asked: 1, scale: 1, scalable: false, drawn: [FW, FH] }, graphics: {}, gpu: null, shots: shotsOf() };
}

// ---------- boot ----------
async function boot() {
  P = await (await fetch('../project.json', { cache: 'no-store' })).json();
  R = await import('../engine.js');
  await R.boot(new URL('../', location.href));
  out = document.querySelector('canvas');
  const sceneErrors = [];
  for (const m of P.scenes || []) {
    try { srcLines = (await (await fetch(`../scenes/${m}.js`, { cache: 'no-store' })).text()).split(/\r?\n/); } catch {}
    try { await import(`../scenes/${m}.js`); } catch (e) { sceneErrors.push(`${m}.js: ${e.message}`); logError('error', `scene ${m}.js failed to load: ${e.message}`); }
  }
  const dur = await R.ready();
  END = +P.end > 0 ? +P.end : dur;
  // Project settings: captions on/off and their size (the engine draws them)
  const cap = P.settings?.captions || {};
  if (cap.on === false) R.state.captions.length = 0;
  if (R.CAP && +cap.size > 0) R.CAP.size = Math.round(66 * +cap.size);
  if (R.CAP && typeof cap.upper === 'boolean') R.CAP.upper = cap.upper;
  NAMES = nameAvatars();
  window.R = R;
  return { sceneErrors };
}

// ---------- message API (preview mode) ----------
let ready = false;
window.addEventListener('message', async e => {
  const m = e.data; if (!m || m.target !== 'cz-host') return;
  if (!ready) { if (m.id) parentPost({ type: 'reply-error', id: m.id, message: window.bootError || 'The preview is not loaded.' }); return; }
  try {
    if (m.type === 'seek') { if (m.playing && typeof m.at === 'number') setPlaying(true, m); else { setPlaying(false); draw(m.t); } }
    else if (m.type === 'playing') setPlaying(!!m.on);
    else if (m.type === 'crisp') { /* always drawn at full size */ }
    else if (m.type === 'pick') parentPost({ type: 'picked', id: m.id, result: pick(m.x, m.y, m.t) });
    else if (m.type === 'frame') {
      draw(m.t ?? t); const c = document.createElement('canvas'); c.width = FW * (m.scale || .25); c.height = FH * (m.scale || .25);
      c.getContext('2d').drawImage(out, 0, 0, c.width, c.height); parentPost({ type: 'frame', id: m.id, dataUrl: c.toDataURL('image/jpeg', .85) });
    }
    else if (m.type === 'info') parentPost({ type: 'info', id: m.id, info: info() });
    else if (m.type === 'ping') parentPost({ type: 'pong', id: m.id, result: { t, lost: false } });
    else if (m.type === 'graphics') { if (m.id) parentPost({ type: 'graphics', id: m.id, result: { t } }); }
    else if (m.type === 'bench') { const n = m.n || 8, a = performance.now(); for (let k = 0; k < n; k++) draw(t); parentPost({ type: 'bench', id: m.id, result: { fps: +(n / Math.max(.001, (performance.now() - a) / 1000)).toFixed(1), t } }); }
  } catch (err) { logError('error', err.message); parentPost({ type: 'reply-error', id: m.id, message: err.message }); }
});

// ---------- the clip check (check_layout): lib/clipcheck.js, the lab's tools/clipcheck.page.js ----------
const MAJOR = .4;
async function clipCheck(range, samples = 6) {
  const mod = await import('../lib/clipcheck.js');
  const res = mod.runCheck({ samples, names: NAMES });
  const S = R.state.shots, inRange = s => !range || ((range.from == null || s.t0 >= range.from - 1e-6) && (range.to == null || s.t0 <= range.to + 1e-6));
  const times = [];
  for (let si = 0; si < S.length; si++) { const s = S[si], end = si + 1 < S.length ? S[si + 1].t0 : END; if (end <= s.t0 || !inRange(s)) continue; for (let k = 0; k < samples; k++) times.push(+(s.t0 + (end - s.t0) * (k + .5) / samples).toFixed(3)); }
  const groups = new Map();
  for (const f of res.flags) {
    const s = S[f.shot - 1]; if (s && !inRange(s)) continue;
    const base = String(f.what).replace(/@.*/, ''), k = [f.type, f.shot, f.who, base].join('|'), g = groups.get(k);
    if (!g) groups.set(k, { ...f, base, parts: new Set([f.part]), n: 1, tLast: f.t });
    else { g.parts.add(f.part); g.n++; g.tLast = Math.max(g.tLast, f.t); if (f.depth > g.depth) { g.depth = f.depth; g.what = f.what; } }
  }
  const issues = [];
  for (const g of [...groups.values()].sort((a, b) => a.t - b.t)) {
    const part = [...g.parts].filter(Boolean).join(','), who = part ? `${g.who}.${part}` : g.who, span = `${g.t.toFixed(2)}${g.n > 1 ? `-${g.tLast.toFixed(2)}` : ''} s`;
    if (g.type === 'CLIP' && g.depth < MAJOR) continue;                 // a minor contact (a back leaning on lockers) is not a problem
    const detail = g.type === 'CLIP' ? `${g.depth.toFixed(2)} studs inside it in shot ${g.shot} (${span}): move him or the thing, or change the pose`
      : g.type === 'CUT' ? `the shot's subject, his head ${(g.depth * 100).toFixed(0)} % out of the frame in shot ${g.shot} (${span}): frame him (camera further back, or look at his head)`
      : g.type === 'HIDDEN' ? `hidden behind it in shot ${g.shot} (${span}): move the camera or him`
      : `the camera is inside it in shot ${g.shot} (${span}): move the camera out`;
    issues.push({ t: g.t, type: g.type.toLowerCase(), what: who, other: g.type === 'CUT' ? null : g.what, detail });
  }
  draw(t);
  return { times, issues };
}

// ---------- render worker API (render mode) ----------
window.suite = {
  info,
  async stills(times, scale = .5) {
    const c = document.createElement('canvas'); c.width = Math.round(FW * scale); c.height = Math.round(FH * scale); const x = c.getContext('2d'); const res = [];
    for (const tt of times) {
      try { R.renderAt(Math.max(0, Math.min(END, tt))); x.drawImage(out, 0, 0, c.width, c.height); res.push(c.toDataURL('image/png')); }
      catch (err) { logError('error', whereAt(tt) + err.message); res.push(null); }
      await new Promise(r => setTimeout(r, 0));
    }
    return res;
  },
  async sweep(fps = 10) {
    const found = new Map(); let n = 0;
    for (let f = 0; f <= END * fps; f++) {
      const tt = f / fps; try { R.renderAt(tt); } catch (err) { const k = shotIndexAt(tt) + '|' + err.message; if (!found.has(k)) found.set(k, { t: +tt.toFixed(3), where: whereAt(tt).replace(/: $/, ''), message: err.message }); }
      if (++n % 40 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { frames: n, errors: [...found.values()] };
  },
  async exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6 } = {}) {
    window.exporting = true;
    to = to ?? END;
    const base = location.pathname.replace(/\/roblox\.html$/, '');
    const chunks = []; let bytes = 0, first = true, err = null;
    const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });
    let cfg = { codec: 'avc1.640033', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
    for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) { const c = { ...cfg, hardwareAcceleration: hw }; if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } }
    enc.configure(cfg);
    const flush = async force => { if (!chunks.length || (!force && bytes < 8e6)) return; const blob = new Blob(chunks); chunks.length = 0; bytes = 0;
      const r = await fetch(`${base}/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false;
      if (!r.ok) throw new Error(`Could not write the video: ${await r.text().catch(() => r.status)}`); };
    const n = Math.round((to - from) * fps), t0 = performance.now();
    for (let f = 0; f < n; f++) {
      if (err) throw err;
      const tt = from + f / fps;
      try { R.renderAt(tt); } catch (e) { throw new Error(`A scene throws an error at ${fmtT(tt)} (${whereAt(tt).replace(/: $/, '')}), so the video cannot be exported: ${e.message}. Ask Claude to fix it, then export again.`); }
      const vf = new VideoFrame(out, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
      if (f % 30 === 0) { await flush(false); console.log(`PROGRESS ${f} ${n} ${(f / Math.max((performance.now() - t0) / 1000, .001)).toFixed(1)}`); }
    }
    await enc.flush(); await flush(true); enc.close();
    const secs = (performance.now() - t0) / 1000;
    return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2), encIn: n, encOut: n };
  },
  // sound design: the shots (every cam() is a cut) and the scene's sfx() cues (audio/events.json -> the style's sound_design.py)
  async events() {
    const cues = (window.__sfx || []).filter(c => c && typeof c.t === 'number' && c.name).map(c => ({ ...c, t: +c.t.toFixed(3) }));
    return { shots: shotsOf().map(s => ({ t0: +s.t0.toFixed(3), chapter: false, cut: true, mode: 0, name: s.name })), hits: [], cards: [], sfx: cues, style: 'roblox' };
  },
  async layout(times, range) { return clipCheck(range); },
  errors: () => errors.slice(),
};

boot().then(({ sceneErrors }) => {
  ready = true;
  draw(+(qs.get('t') || 0));
  window.ready = true;
  parentPost({ type: 'ready', info: info(), sceneErrors });
}).catch(err => { logError('error', 'boot failed: ' + (err?.message || err)); window.bootError = String(err?.message || err); window.ready = true; parentPost({ type: 'boot-error', message: window.bootError }); });
