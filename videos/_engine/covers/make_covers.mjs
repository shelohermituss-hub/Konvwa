// Couvertures TikTok (1080×1920) à partir d'une image du rendu + un gros titre.
// Usage : node videos/_engine/covers/make_covers.mjs [projet ...]
// Écrit videos/<projet>/cover.png (et cover-grille.png, l'aperçu 3:4 de la grille du profil).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const videos = resolve(here, '../..');
const font = (p) => pathToFileURL(join(videos, p)).href;
const only = process.argv.slice(2);
const covers = JSON.parse(readFileSync(join(here, 'covers.json'), 'utf8'))
  .filter((c) => !only.length || only.includes(c.project));

const STYLES = {
  // shade : le dégradé noir doit couvrir les sous-titres incrustés du rendu
  // (ANIMÉ vers y≈1420–1540 ; 3D vers y≈1180–1300, d'où un noir plus haut).
  anime: { font: 'Anton', size: 176, line: 0.98, accent: '#FFD23F', kicker: '#FFD23F', track: '0.01em',
    shade: 'rgba(0,0,0,0) 36%,rgba(0,0,0,.85) 52%,rgba(0,0,0,1) 64%,rgba(0,0,0,1) 82%', bg: 'none' },
  '3d': { font: 'Poppins', weight: 800, size: 172, line: 1.02, accent: '#5CE1E6', kicker: '#5CE1E6', track: '-0.02em',
    shade: 'rgba(0,0,0,0) 34%,rgba(0,0,0,.9) 53%,rgba(0,0,0,1) 59%,rgba(0,0,0,1) 72%', bg: 'brightness(1.35) saturate(1.15)' },
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const line = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

const html = (c, bg) => {
  const st = STYLES[c.style];
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Anton;src:url(${font('joconde/assets/fonts/anton.woff2')})}
@font-face{font-family:Poppins;font-weight:800;src:url(${font('telephone/assets/fonts/poppins-800.woff2')})}
@font-face{font-family:Mono;font-weight:700;src:url(${font('telephone/assets/fonts/jetbrains-mono-700.woff2')})}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#000}
.bg{position:absolute;inset:0;background:url(${bg}) center/cover;filter:${st.bg}}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,${st.shade},rgba(0,0,0,.92) 100%)}
.box{position:absolute;left:70px;right:70px;top:980px;height:640px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.kicker{font:700 40px/1 Mono;letter-spacing:.14em;color:${st.kicker};margin-bottom:34px;padding:14px 26px;border:3px solid ${st.kicker};border-radius:999px;background:rgba(0,0,0,.45)}
h1{font-family:${st.font};font-weight:${st.weight || 400};font-size:${st.size}px;line-height:${st.line};letter-spacing:${st.track};color:#fff;text-transform:uppercase;text-shadow:0 8px 0 rgba(0,0,0,.55),0 0 40px rgba(0,0,0,.6)}
h1 span{display:block;white-space:nowrap}
em{font-style:normal;color:${st.accent}}
</style><div class="bg"></div><div class="shade"></div><div class="box"><div class="kicker">${esc(c.kicker)}</div>
<h1>${c.title.map((t) => `<span>${line(t)}</span>`).join('')}</h1></div>`;
};

const tmp = mkdtempSync(join(tmpdir(), 'covers-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const c of covers) {
  const src = join(videos, c.project, 'renders', c.render || `${c.project}.mp4`);
  const bg = join(tmp, `${c.project}.png`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(c.at), '-i', src, '-frames:v', '1', bg]);
  const file = join(tmp, `${c.project}.html`);
  writeFileSync(file, html(c, pathToFileURL(bg).href));
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Rétrécit une ligne trop large pour tenir dans 940 px.
  await page.evaluate(() => {
    for (const s of document.querySelectorAll('h1 span')) {
      const w = s.scrollWidth;
      if (w > 940) s.style.fontSize = `${(parseFloat(getComputedStyle(s).fontSize) * 940) / w}px`;
    }
  });
  const out = join(videos, c.project, 'cover.png');
  await page.screenshot({ path: out });
  // Aperçu de la grille du profil TikTok : recadrage central 3:4.
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', out, '-vf', 'crop=1080:1440:0:240,scale=540:720', join(videos, c.project, 'cover-grille.png')]);
  console.log('ok', out);
}
await browser.close();
