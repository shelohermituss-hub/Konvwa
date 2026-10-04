// Génère 30 images (1080x1350, rendu 2x = 2160x2700) + calendrier.md.   Usage : node gen.cjs [jour]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const posts = require('./data.cjs');
const OUT = path.join(__dirname, 'images');
fs.mkdirSync(OUT, { recursive: true });

const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  box: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  tag: '<path d="m19 5-14 14"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  receipt: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
};
const svg = (n, size, color, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

const THEMES = {
  white:  { bg: '#FFFFFF', ink: '#0A1628', mute: '#475569', accent: '#F05A28', card: '#FFF3EE', cardInk: '#0A1628', chip: '#F05A28', chipInk: '#fff', deco: '#F05A28' },
  navy:   { bg: '#0A1628', ink: '#FFFFFF', mute: '#B6C2D4', accent: '#FF7252', card: 'rgba(255,255,255,.07)', cardInk: '#fff', chip: '#F05A28', chipInk: '#fff', deco: '#F05A28' },
  orange: { bg: '#F05A28', ink: '#FFFFFF', mute: '#FFE3D9', accent: '#0A1628', card: 'rgba(255,255,255,.16)', cardInk: '#fff', chip: '#0A1628', chipInk: '#fff', deco: '#FF7252' },
};

const CSS = (t) => `
@font-face{font-family:P;font-weight:400;src:url(fonts/poppins-latin-400-normal.woff2)}
@font-face{font-family:P;font-weight:600;src:url(fonts/poppins-latin-600-normal.woff2)}
@font-face{font-family:P;font-weight:700;src:url(fonts/poppins-latin-700-normal.woff2)}
@font-face{font-family:P;font-weight:800;src:url(fonts/poppins-latin-800-normal.woff2)}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;position:relative;overflow:hidden;background:${t.bg};color:${t.ink};font-family:P,Arial,sans-serif}
em{font-style:normal;color:${t.accent};font-weight:800}
b{font-weight:800}
.c{position:absolute;border-radius:50%;background:${t.deco}}
.chip{display:inline-block;background:${t.chip};color:${t.chipInk};font-weight:700;font-size:25px;letter-spacing:.12em;text-transform:uppercase;padding:12px 28px;border-radius:999px}
.foot{position:absolute;left:72px;right:72px;bottom:56px;display:flex;align-items:center;justify-content:space-between;z-index:5}
.foot .l{display:flex;align-items:center;gap:14px;font-weight:800;letter-spacing:.22em;font-size:30px}
.foot .l img{height:46px}
.foot .u{font-weight:700;font-size:28px;color:${t.mute}}
h1,h2{font-weight:600;letter-spacing:-.02em}
.top{position:absolute;left:72px;top:72px;z-index:5}
`;

const foot = () => `<div class="foot"><div class="l"><img src="assets/konvwa-logo.svg">KONVWA</div><div class="u">konvwa.shop</div></div>`;
const wrap = (t, body, nofoot) => `<!doctype html><meta charset="utf-8"><style>${CSS(t)}</style><body>${body}${nofoot ? '' : foot()}</body>`;

const T = {
  hero(p, t) {
    return wrap(t, `
      <div class="c" style="width:840px;height:840px;right:-250px;top:410px;background:${p.theme === 'navy' ? '#F05A28' : '#0A1628'}"></div>
      <h1 style="position:absolute;left:72px;top:96px;width:900px;font-size:84px;line-height:1.1;font-weight:400">${p.head}</h1>
      <p style="position:absolute;left:72px;top:450px;width:520px;font-size:32px;line-height:1.45;color:${t.mute}">${p.sub}</p>
      <img src="assets/forklift.png" style="position:absolute;left:290px;top:520px;width:800px;filter:drop-shadow(0 34px 34px rgba(0,0,0,.3))">
      ${p.pay ? `<div style="position:absolute;right:72px;bottom:160px;background:#F05A28;color:#fff;border-radius:26px;padding:22px 34px;text-align:right;z-index:4"><div style="font-size:20px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">Payez en gourdes avec</div><div style="font-size:36px;font-weight:700">MonCash · NatCash</div></div>` : ''}
      <div style="position:absolute;left:72px;bottom:160px;display:flex;flex-direction:column;gap:14px;z-index:4">
        ${[['alibaba.png', 'Alibaba'], ['shein.png', 'Shein'], ['temu.jpg', 'Temu']].map(([f, n]) => `<div style="display:flex;align-items:center;gap:14px;background:#fff;color:#0A1628;border-radius:999px;padding:10px 30px 10px 12px;font-weight:700;font-size:28px;width:max-content;box-shadow:0 8px 24px rgba(10,22,40,.18)"><img src="assets/${f}" style="height:42px;width:42px;object-fit:contain;border-radius:9px">${n}</div>`).join('')}
      </div>`);
  },
  feature(p, t) {
    return wrap(t, `
      <div class="c" style="width:520px;height:520px;right:-190px;top:-190px;opacity:${p.theme === 'orange' ? .5 : 1}"></div>
      <div class="top"><span class="chip">${p.tag}</span></div>
      <div style="position:absolute;left:72px;right:72px;top:190px;display:flex;flex-direction:column;gap:34px">
        <div style="width:170px;height:170px;border-radius:48px;background:${p.theme === 'white' ? '#0A1628' : '#fff'};display:flex;align-items:center;justify-content:center;box-shadow:0 24px 50px rgba(0,0,0,.22)">${svg(p.icon, 96, p.theme === 'white' ? '#fff' : p.theme === 'orange' ? '#F05A28' : '#0A1628', 1.8)}</div>
        <h1 style="font-size:78px;line-height:1.1">${p.title}</h1>
        <p style="font-size:34px;line-height:1.5;color:${t.mute}">${p.body}</p>
      </div>
      <div style="position:absolute;left:72px;right:72px;bottom:150px;display:flex;flex-direction:column;gap:14px">
        ${p.bullets.map((b) => `<div style="display:flex;align-items:center;gap:20px;background:${t.card};border-radius:24px;padding:16px 26px;font-size:30px;font-weight:600;color:${t.cardInk}"><span style="width:44px;height:44px;border-radius:50%;background:${t.accent};display:flex;align-items:center;justify-content:center;flex:none">${svg('check', 26, '#fff', 3.2)}</span>${b}</div>`).join('')}
      </div>`);
  },
  steps(p, t) {
    const n = p.steps.length, h = n === 4 ? 168 : 220;
    return wrap(t, `
      <div class="c" style="width:440px;height:440px;right:-170px;top:-170px;opacity:${p.theme === 'orange' ? .5 : 1}"></div>
      <div class="top"><span class="chip">${p.tag}</span></div>
      <h1 style="position:absolute;left:72px;top:200px;width:800px;font-size:84px;line-height:1.08">${p.title}</h1>
      <div style="position:absolute;left:72px;right:72px;top:${n === 4 ? 450 : 470}px;display:flex;flex-direction:column;gap:20px">
        ${p.steps.map(([a, b], i) => `<div style="display:flex;align-items:center;gap:30px;background:${t.card};border-radius:32px;padding:0 34px;height:${h}px">
          <div style="width:92px;height:92px;border-radius:50%;background:${t.accent};color:#fff;font-weight:800;font-size:50px;display:flex;align-items:center;justify-content:center;flex:none">${i + 1}</div>
          <div><div style="font-size:40px;font-weight:700;color:${t.cardInk};line-height:1.15">${a}</div><div style="font-size:27px;line-height:1.4;color:${t.mute};margin-top:6px">${b}</div></div></div>`).join('')}
      </div>`);
  },
  compare(p, t) {
    const col = ([name, items], dark) => `<div style="flex:1;border-radius:36px;padding:44px 34px;background:${dark ? '#0A1628' : '#FFF3EE'};color:${dark ? '#fff' : '#0A1628'};min-height:620px">
      <div style="font-size:40px;font-weight:800;line-height:1.1;color:${dark ? '#FF7252' : '#F05A28'};margin-bottom:30px">${name}</div>
      ${items.map((i) => `<div style="display:flex;gap:16px;margin-bottom:26px;font-size:29px;line-height:1.4"><span style="flex:none;margin-top:4px">${svg('check', 34, dark ? '#FF7252' : '#F05A28', 3.2)}</span>${i}</div>`).join('')}</div>`;
    return wrap(t, `
      <div class="c" style="width:440px;height:440px;right:-170px;top:-170px"></div>
      <div class="top"><span class="chip">${p.tag}</span></div>
      <h1 style="position:absolute;left:72px;top:200px;width:800px;font-size:88px;line-height:1.08">${p.title}</h1>
      <div style="position:absolute;left:72px;right:72px;top:480px;display:flex;gap:26px">${col(p.left, false)}${col(p.right, true)}</div>`);
  },
  tips(p, t) {
    return wrap(t, `
      <div class="c" style="width:440px;height:440px;right:-170px;top:-170px"></div>
      <div class="top"><span class="chip">${p.tag}</span></div>
      <h1 style="position:absolute;left:72px;top:200px;width:800px;font-size:78px;line-height:1.1">${p.title}</h1>
      <div style="position:absolute;left:72px;right:72px;top:480px;display:flex;flex-direction:column;gap:16px">
        ${p.items.map((i, k) => `<div style="display:flex;align-items:center;gap:26px;background:${t.card};border-radius:28px;padding:0 32px;height:122px;font-size:31px;line-height:1.3;font-weight:600;color:${t.cardInk}">
          <span style="width:64px;height:64px;border-radius:50%;background:${t.accent};color:#fff;display:flex;align-items:center;justify-content:center;flex:none;font-weight:800;font-size:32px">${k + 1}</span>${i}</div>`).join('')}
      </div>`);
  },
  faq(p, t) {
    return wrap(t, `
      <div class="c" style="width:440px;height:440px;right:-170px;top:-170px"></div>
      <div class="top"><span class="chip">${p.tag}</span></div>
      <div style="position:absolute;left:72px;top:210px;font-size:300px;line-height:1;font-weight:800;color:${t.accent};opacity:.9">?</div>
      <h1 style="position:absolute;left:72px;top:560px;width:936px;font-size:78px;line-height:1.12">${p.q}</h1>
      <div style="position:absolute;left:72px;right:72px;top:830px;background:${t.card};border-radius:36px;padding:44px 46px;font-size:34px;line-height:1.55;color:${t.cardInk}">${p.a}</div>`);
  },
  recap(p, t) {
    return wrap(t, `
      <div class="c" style="width:440px;height:440px;right:-170px;top:-170px"></div>
      <div class="top"><span class="chip">${p.tag}</span></div>
      <h1 style="position:absolute;left:72px;top:200px;width:800px;font-size:84px;line-height:1.08">${p.title}</h1>
      <div style="position:absolute;left:72px;right:72px;top:490px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
        ${p.cells.map(([ic, l]) => `<div style="background:${t.card};border-radius:32px;padding:30px 30px;height:206px;display:flex;flex-direction:column;justify-content:space-between"><div style="width:84px;height:84px;border-radius:24px;background:#0A1628;display:flex;align-items:center;justify-content:center">${svg(ic, 48, '#fff', 1.9)}</div><div style="font-size:34px;font-weight:700;line-height:1.15;color:${t.cardInk}">${l}</div></div>`).join('')}
      </div>`);
  },
  cta(p, t) {
    return wrap(t, `
      <div class="c" style="width:900px;height:900px;right:-300px;top:560px;background:#F05A28"></div>
      <div class="c" style="width:560px;height:560px;left:-260px;bottom:-250px;background:#FF7252"></div>
      <h1 style="position:absolute;left:72px;top:150px;width:936px;font-size:130px;line-height:1.02;font-weight:400">${p.head}</h1>
      <p style="position:absolute;left:72px;top:520px;width:640px;font-size:38px;line-height:1.45;color:${t.mute}">${p.sub}</p>
      <img src="assets/forklift.png" style="position:absolute;left:250px;top:640px;width:880px;filter:drop-shadow(0 34px 34px rgba(0,0,0,.35))">
      <div style="position:absolute;left:72px;bottom:150px;background:#fff;color:#0A1628;border-radius:999px;padding:24px 54px;font-size:46px;font-weight:800;box-shadow:0 14px 40px rgba(0,0,0,.3);z-index:4">${p.cta}</div>`, true);
  },
};

(async () => {
  const only = process.argv[2] ? +process.argv[2] : null;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  for (const p of posts) {
    if (only && p.day !== only) continue;
    const t = THEMES[p.theme];
    const file = path.join(__dirname, `_tmp_${p.day}.html`);
    fs.writeFileSync(file, T[p.type](p, t));
    await pg.goto('file://' + file, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(OUT, `jour-${String(p.day).padStart(2, '0')}.png`) });
    fs.unlinkSync(file);
    console.log('jour', p.day);
  }
  await b.close();
  if (!only) {
    let md = '# KONVWA — 30 jours de contenu\n\nUne image par jour (`images/jour-XX.png`, 2160×2700 px, format portrait 4:5 pour Instagram/Facebook). Légende et hashtags à copier-coller.\nPublier une fois par jour, par exemple entre 18 h et 20 h (heure d\'Haïti), à ajuster selon vos statistiques.\n\n';
    for (const p of posts) md += `## Jour ${p.day} — ${p.type === 'hero' ? 'Poster' : p.type === 'cta' ? 'Appel à l\'action' : 'Carte explicative'}\n\n![jour ${p.day}](images/jour-${String(p.day).padStart(2, '0')}.png)\n\n**Légende :** ${p.caption}\n\n**Hashtags :** ${p.tags}\n\n---\n\n`;
    fs.writeFileSync(path.join(__dirname, 'calendrier.md'), md);
  }
})();
