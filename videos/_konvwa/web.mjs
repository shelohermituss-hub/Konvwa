#!/usr/bin/env node
// KONVWA : le rendu des styles three.js du pack Creatorize (toon, lowpoly, recon, stickman, stickstory, flat, vox,
// collage, pixel, roblox, starter), hors de l'application. Il fait ce que fait l'application : un petit serveur local
// qui sert le projet exactement comme elle (la page hôte, le moteur du projet, ses scènes, la bibliothèque low-poly),
// et un Chrome / Edge sans fenêtre qui pilote la page (window.suite : info, stills, events, sweep, layout, exportVideo).
// Le moteur et la page hôte ne sont jamais modifiés.
//
//   node web.mjs info    <projet>
//   node web.mjs stills  <projet> --times 1,3.5 [--scale 0.5] [--out dossier]
//   node web.mjs events  <projet>                               -> audio/events.json (pour la conception sonore)
//   node web.mjs check   <projet>                               (scènes qui plantent + problèmes de mise en page)
//   node web.mjs video   <projet> [--fps 60] [--from 0] [--to fin] [--name video]  -> out/<name>.h264 + out/<name>.mp4
//   node web.mjs serve   <projet> [--port 8765]                 aperçu dans le navigateur (mode preview)
//
// Navigateur : CZ_BROWSER, sinon Chrome / Edge installés (Windows), sinon google-chrome / chromium (Linux).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.resolve(HERE, '..', '_creatorize');
const { launch } = await import(new URL('file://' + path.join(PACK, 'stylekit', 'tools', 'cdp.mjs').replace(/\\/g, '/')).href);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.srt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

const [cmd, projArg, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { const k = rest[i].slice(2); opt[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; }
if (!cmd || !projArg) { console.error('usage: node web.mjs info|stills|events|check|video|serve <projet> [options]'); process.exit(2); }
const PROJ = path.resolve(fs.existsSync(projArg) ? projArg : path.join(HERE, '..', projArg));
const P = JSON.parse(fs.readFileSync(path.join(PROJ, 'project.json'), 'utf8'));
// le moteur : la copie du projet s'il en a une, sinon le dossier du pack nommé par project.json > konvwa > moteur (rien
// n'est recopié dans le film : les fichiers absents du projet sont servis depuis le pack, tels quels)
const ENGDIR = P.konvwa?.moteur ? path.join(PACK, P.konvwa.moteur) : null;
const engineFile = [path.join(PROJ, 'engine.js'), ENGDIR && path.join(ENGDIR, 'engine.js')].find(f => f && fs.existsSync(f));
if (!engineFile) { console.error('KONVWA web : pas de engine.js (ni dans le projet, ni project.json > konvwa > moteur)'); process.exit(2); }
const KIND = String(fs.readFileSync(engineFile, 'utf8').match(/export const ENGINE_KIND = '(\w+)'/)?.[1] || 'pixel');
const HOSTPAGE = KIND === 'roblox' ? 'roblox.html' : 'host.html';
const OUT = path.join(PROJ, 'out'); fs.mkdirSync(OUT, { recursive: true });

// ---------------- le serveur (les mêmes adresses que celui de l'application) ----------------
const inside = (root, rel) => { const f = path.resolve(root, rel); return f === root || f.startsWith(root + path.sep) ? f : null; };
const send = (res, f) => {
  let st; try { st = fs.statSync(f); } catch { res.writeHead(404); return res.end(); }
  if (st.isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
};
const json = (res, o) => { const b = Buffer.from(JSON.stringify(o)); res.writeHead(200, { 'Content-Type': MIME['.json'], 'Content-Length': b.length }); res.end(b); };
const body = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const LIB = path.join(PACK, 'lowpoly', 'library');
const ANIMS = path.join(PACK, 'recon', 'assets', 'anims', 'builtin.json');

function startServer(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      const host = String(req.headers.host || '').replace(/:\d+$/, '');
      if (host !== '127.0.0.1' && host !== 'localhost') { res.writeHead(403); return res.end(); }
      const url = new URL(req.url || '/', 'http://x');
      const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      if (parts[0] === 'blank.html') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end('<!doctype html><meta charset="utf-8">'); }
      if (parts[0] !== 'p' || parts[1] !== 'film') { res.writeHead(404); return res.end(); }
      const r = parts.slice(2);
      if (r[0] === '__suite') {
        if (req.method === 'POST') {
          const b = await body(req);
          if (r[1] === 'append' && r[2]) {
            const f = path.join(OUT, r[2].replace(/[^\w-]/g, '') + '.h264');
            if (url.searchParams.get('reset')) fs.writeFileSync(f, b); else fs.appendFileSync(f, b);
            res.writeHead(200); return res.end('ok');
          }
          if (r[1] === 'frame' && r[2] && r[3]) {
            const d = path.join(PROJ, '.suite', 'frames', r[2].replace(/[^\w-]/g, '')); fs.mkdirSync(d, { recursive: true });
            fs.writeFileSync(path.join(d, r[3].replace(/[^\w.-]/g, '')), b); res.writeHead(200); return res.end('ok');
          }
          res.writeHead(404); return res.end();
        }
        const f = inside(path.join(PACK, 'host'), r.slice(1).join('/'));
        return f ? send(res, f) : (res.writeHead(404), res.end());
      }
      if (r[0] === '__lib') {
        const rel = r.slice(1).join('/');
        if (rel === 'index.json') return send(res, path.join(LIB, 'index.json'));
        const f = inside(LIB, rel); return f ? send(res, f) : (res.writeHead(404), res.end());
      }
      if (r[0] === '__anims') return json(res, { version: 1, builtin: fs.existsSync(ANIMS) ? (JSON.parse(fs.readFileSync(ANIMS, 'utf8')).entries ?? []) : [], user: [] });
      if (r[0] === '__chars3d') return json(res, { version: 1, entries: [] });
      if (r[0] === '__library') { const f = inside(path.join(PACK, 'library'), r.slice(1).join('/')); return f ? send(res, f) : (res.writeHead(404), res.end()); }
      let f = inside(PROJ, r.join('/'));
      if (!f) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(f) && ENGDIR) { const g = inside(ENGDIR, r.join('/')); if (g && fs.existsSync(g)) f = g; }
      if (req.method === 'HEAD') { const ok = fs.existsSync(f); res.writeHead(ok ? 200 : 404); return res.end(); }
      return send(res, f);
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

// ---------------- la page dans un Chrome sans fenêtre ----------------
async function withPage(fn) {
  const { server, port } = await startServer();
  const browser = await launch({ args: process.platform === 'linux' ? ['--no-sandbox', '--enable-unsafe-swiftshader'] : [] });
  const [W, H] = ['16:9', 'landscape', 'wide'].includes(P.settings?.format) ? [1920, 1080] : [1080, 1920];
  const page = await browser.newPage(`http://127.0.0.1:${port}/p/film/__suite/${HOSTPAGE}?mode=render`, {
    width: Math.round(W / 2), height: Math.round(H / 2),
    onConsole: (type, text) => { if (/^PROGRESS \d/.test(text)) { const [, f, n] = text.split(' '); process.stdout.write(`\r  ${f}/${n} images`); } else if (type === 'error' || /^\[(error|warn)\]/.test(text)) console.log('  page:', text.slice(0, 300)); } });
  try {
    await page.waitFor('window.ready === true', 300000);
    const be = await page.evaluate('window.bootError || null');
    if (be) throw new Error('la page n\'a pas démarré : ' + be);
    return await fn(page, port);
  } finally {
    const errs = await page.evaluate('window.suite ? window.suite.errors() : []').catch(() => []);
    for (const e of (errs || []).filter(e => e.level === 'error').slice(0, 12)) console.log('  ERREUR:', e.text.slice(0, 300));
    await browser.close().catch(() => {}); server.close();
  }
}

const times = s => String(s || '').split(',').map(Number).filter(x => Number.isFinite(x));
const run = {
  async info() { await withPage(async p => console.log(JSON.stringify(await p.evaluate('window.suite.info()'), null, 1))); },
  async stills() {
    const ts = times(opt.times), scale = +opt.scale || 0.5, out = path.resolve(opt.out || path.join(PROJ, 'renders', 'stills'));
    fs.mkdirSync(out, { recursive: true });
    await withPage(async p => {
      for (const t of ts) {   // une image à la fois (une grande image en une seule réponse peut couper la liaison DevTools)
        const [d] = await p.evaluate(`window.suite.stills([${t}], ${scale})`, { timeout: 600000 });
        if (!d) { console.log(`  ${t}s : la scène a planté (voir ERREUR)`); continue; }
        const f = path.join(out, `t${String(t.toFixed(2)).padStart(6, '0')}.png`);
        fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); console.log('  ' + f);
      }
    });
  },
  async events() {
    await withPage(async p => {
      const ev = await p.evaluate('window.suite.events()', { timeout: 1800000 });
      fs.mkdirSync(path.join(PROJ, 'audio'), { recursive: true });
      fs.writeFileSync(path.join(PROJ, 'audio', 'events.json'), JSON.stringify(ev, null, 1));
      console.log(`  audio/events.json : ${ev?.sfx?.length ?? 0} sons, ${ev?.shots?.length ?? 0} plans`);
    });
  },
  async check() {
    await withPage(async p => {
      const sw = await p.evaluate('window.suite.sweep(10)', { timeout: 1800000 });
      console.log(`  balayage : ${sw.frames} images, ${sw.errors.length} erreur(s)`);
      for (const e of sw.errors) console.log(`  ERREUR ${e.where} à ${e.t}s : ${e.message}`);
      const lay = await p.evaluate('window.suite.layout()', { timeout: 1800000 }).catch(() => null);
      if (lay) { console.log(`  mise en page : ${lay.issues.length} problème(s)`); for (const i of lay.issues.slice(0, 40)) console.log('   - ' + JSON.stringify(i).slice(0, 240)); }
      process.exitCode = sw.errors.length ? 1 : 0;
    });
  },
  async video() {
    const fps = +opt.fps || 60, name = String(opt.name || 'video').replace(/[^\w-]/g, '');
    await withPage(async p => {
      const sup = await p.evaluate(`(async () => typeof VideoEncoder !== 'undefined' && (await VideoEncoder.isConfigSupported({ codec: 'avc1.640033', width: 1080, height: 1920, bitrate: 16e6, framerate: ${fps}, avc: { format: 'annexb' } })).supported)()`);
      const end = +(await p.evaluate('window.suite.info()')).end || P.end;
      const to = opt.to != null ? +opt.to : end, from = +opt.from || 0; opt._dur = to - from;
      if (sup && !opt.images) {   // le chemin de l'application : l'encodeur H.264 du navigateur (Chrome / Edge)
        const r = await p.evaluate(`window.suite.exportVideo({ name: '${name}', fps: ${fps}, from: ${from}, to: ${to} })`, { timeout: 6 * 3600000 });
        console.log(`\n  ${r.frames} images en ${r.seconds}s (${r.fps} i/s)`);
        return;
      }
      // sans encodeur H.264 (Chromium libre, serveur) : image par image en PNG vers le serveur local, ffmpeg encode ensuite
      console.log('  (navigateur sans encodeur H.264 : image par image)');
      const dir = path.join(PROJ, '.suite', 'frames', name); fs.rmSync(dir, { recursive: true, force: true });
      const n = Math.round((to - from) * fps), B = 15;
      for (let f0 = 0; f0 < n; f0 += B) {
        const ts = Array.from({ length: Math.min(B, n - f0) }, (_, k) => +(from + (f0 + k) / fps).toFixed(5));
        await p.evaluate(`(async () => { const ts = ${JSON.stringify(ts)};
          for (let k = 0; k < ts.length; k++) { const [d] = await window.suite.stills([ts[k]], 1); if (!d) continue;
            const b = await (await fetch(d)).blob(); await fetch(location.pathname.replace(/[^/]+$/, '') + 'frame/${name}/' + String(${f0} + k).padStart(6, '0') + '.png', { method: 'POST', body: b }); } return 1; })()`, { timeout: 1800000 });
        process.stdout.write(`\r  ${Math.min(n, f0 + B)}/${n} images`);
      }
      process.stdout.write('\n');
      opt._frames = dir;
    });
    const h = path.join(OUT, name + '.h264'), mp4 = path.join(OUT, name + '.mp4');
    const mix = ['final_mix.wav', 'clean.wav'].map(f => path.join(PROJ, 'audio', f)).find(f => fs.existsSync(f));
    const vin = opt._frames ? ['-framerate', String(fps), '-i', path.join(opt._frames, '%06d.png')] : ['-r', String(fps), '-i', h];
    const venc = opt._frames ? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-bf', '0', '-g', String(fps * 2)] : ['-c:v', 'copy'];
    const args = ['-y', '-v', 'error', ...vin, ...(mix ? ['-ss', String(+opt.from || 0), '-i', mix] : []), ...venc, ...(mix ? ['-af', 'apad', '-c:a', 'aac', '-b:a', '192k'] : []), '-t', String(opt._dur), mp4];   // l'image entière, le son complété de silence
    const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
    if (r.status) throw new Error('ffmpeg a échoué');
    console.log('  ' + mp4);
  },
  async serve() {
    const { port } = await startServer(+opt.port || 8765);
    console.log(`Aperçu : http://127.0.0.1:${port}/p/film/__suite/${HOSTPAGE}?mode=preview  (Ctrl+C pour arrêter)`);
  },
};
if (!run[cmd]) { console.error('commande inconnue : ' + cmd); process.exit(2); }
try { await run[cmd](); } catch (e) { console.error('\nKONVWA web : ' + (e?.message || e)); process.exit(1); }
