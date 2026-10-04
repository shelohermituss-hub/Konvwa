// Assemble une vidéo verticale 1080x1920 : fond de marque + enregistrement de l'appli dans un téléphone + titres + écran final.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), cp = require('child_process');
const which = +process.argv[2] || 1;
const END = 3.5;
const VIDEOS = {
  1: { name: 'ugc-1-commander-en-4-etapes', caps: {
      dash: ['Acheter sur Alibaba, Shein ou Temu depuis Haïti ?', 'Sans carte bancaire étrangère', ''],
      submit: ['Collez le lien du produit', 'Alibaba, Shein ou Temu', '1'],
      notif: ['Recevez votre devis', 'Tous les frais sont détaillés', '2'],
      wallet: ['Payez en gourdes', 'MonCash, NatCash ou portefeuille KONVWA', '3'],
      order: ['Suivez votre colis', 'Étape par étape jusqu\'à la livraison', '4'] },
    end: ['Commandez sur', 'konvwa.shop'] },
  2: { name: 'ugc-2-payer-moncash-natcash', caps: {
      wallet: ['Pas de carte bancaire étrangère ?', 'Pas de problème avec KONVWA', ''],
      dialog: ['Rechargez votre portefeuille', 'MonCash ou NatCash, en gourdes', ''],
      wallet2: ['Votre solde, toujours visible', 'Historique de chaque transaction', ''],
      order: ['Payez vos commandes en un clic', 'Depuis votre portefeuille KONVWA', ''] },
    end: ['Payez en gourdes sur', 'konvwa.shop'] },
  3: { name: 'ugc-3-suivre-son-colis', caps: {
      notif: ['Où est mon colis ?', 'Vous êtes notifié à chaque étape', ''],
      order: ['Suivez chaque étape', 'Achat, entrepôt, expédition, transit', ''],
      delivered: ['Jusqu\'à la livraison', 'Tout est dans votre tableau de bord', ''] },
    end: ['Suivez vos colis sur', 'konvwa.shop'] },
};
const V = VIDEOS[which];
const FONT = `@font-face{font-family:P;font-weight:400;src:url(file://${process.cwd()}/fonts/poppins-latin-400-normal.woff2)}@font-face{font-family:P;font-weight:600;src:url(file://${process.cwd()}/fonts/poppins-latin-600-normal.woff2)}@font-face{font-family:P;font-weight:700;src:url(file://${process.cwd()}/fonts/poppins-latin-700-normal.woff2)}@font-face{font-family:P;font-weight:800;src:url(file://${process.cwd()}/fonts/poppins-latin-800-normal.woff2)}`;
const base = `${FONT}*{box-sizing:border-box;margin:0}body{width:1080px;height:1920px;font-family:P,Arial;position:relative;overflow:hidden;background:transparent}`;
const html = {
  bg: `<style>${base}body{background:linear-gradient(160deg,#0A1628 0%,#10213b 100%)}.c{position:absolute;border-radius:50%}</style><div class=c style="width:760px;height:760px;right:-260px;top:-260px;background:#F05A28"></div><div class=c style="width:520px;height:520px;left:-240px;bottom:-200px;background:#F05A28;opacity:.9"></div><div class=c style="width:70px;height:70px;left:90px;top:300px;background:#FF7252"></div>`,
  bezel: `<style>${base}</style><div style="position:absolute;left:176px;top:346px;width:728px;height:1428px;border-radius:84px;border:14px solid #05080f;box-shadow:0 40px 90px rgba(0,0,0,.5)"></div><div style="position:absolute;left:470px;top:362px;width:140px;height:30px;border-radius:20px;background:#05080f"></div>`,
  mask: `<style>${base}body{background:#000}</style><div style="position:absolute;left:190px;top:360px;width:700px;height:1400px;border-radius:70px;background:#fff"></div>`,
  cap: ([t, s, n]) => `<style>${base}</style>
    <div style="position:absolute;left:70px;right:70px;top:84px;height:240px;display:flex;align-items:center;gap:30px">
      ${n ? `<div style="flex:none;width:130px;height:130px;border-radius:50%;background:#F05A28;color:#fff;font-weight:800;font-size:76px;display:flex;align-items:center;justify-content:center">${n}</div>` : ''}
      <div style="color:#fff;font-weight:800;font-size:${t.length > 30 ? 62 : 72}px;line-height:1.1;letter-spacing:-.01em">${t}</div></div>
    <div style="position:absolute;left:0;right:0;top:1790px;display:flex;justify-content:center"><div style="background:#F05A28;color:#fff;font-weight:700;font-size:38px;padding:16px 40px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35)">${s}</div></div>`,
  end: ([a, b]) => `<style>${base}body{background:#fff}.c{position:absolute;border-radius:50%}</style>
    <div class=c style="width:900px;height:900px;right:-330px;bottom:-250px;background:#0A1628"></div><div class=c style="width:560px;height:560px;left:-260px;top:-240px;background:#F05A28"></div>
    <div style="position:absolute;left:0;right:0;top:560px;text-align:center;color:#0A1628"><div style="height:200px;display:flex;justify-content:center">${fs.readFileSync('konvwa-logo.svg','utf8').replace('<svg ','<svg height="200" ')}</div><div style="font-weight:800;letter-spacing:.3em;font-size:62px;margin:30px 0 90px;padding-left:.3em">KONVWA</div>
      <div style="font-size:60px;font-weight:400">${a}</div><div style="font-size:112px;font-weight:800;color:#F05A28;line-height:1.1">${b}</div></div>
    <div style="position:absolute;left:0;right:0;bottom:130px;display:flex;justify-content:center;z-index:3"><div style="background:#fff;color:#0A1628;border-radius:26px;padding:22px 40px;font-size:38px;font-weight:700;box-shadow:0 14px 40px rgba(0,0,0,.3)">MonCash · NatCash</div></div>`,
};
(async () => {
  const meta = JSON.parse(fs.readFileSync(`raw/v${which}.json`));
  fs.mkdirSync('caps', { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const shot = async (name, h, transparent = true) => { await pg.setContent(`<!doctype html><meta charset=utf-8>${h}`); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(250); await pg.screenshot({ path: `caps/${name}.png`, omitBackground: transparent }); };
  await shot('bg', html.bg, false); await shot('bezel', html.bezel); await shot('mask', html.mask, false);
  const names = meta.marks.slice(0, -1).map(m => m.n);
  for (const n of names) await shot(`c${which}_${n}`, html.cap(V.caps[n]));
  await shot(`end${which}`, html.end(V.end), false);
  await b.close();
  // screen video
  cp.execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i raw/v${which}.txt -vf fps=30,format=yuv420p -an raw/v${which}.mp4`);
  const screenLen = meta.marks[meta.marks.length - 1].t;
  const T = (n) => meta.marks.find(m => m.n === n).t + meta.off;
  const total = meta.total + END;
  const ins = ['-loop 1 -t ' + total + ' -i caps/bg.png', `-i raw/v${which}.mp4`, '-loop 1 -t ' + total + ' -i caps/mask.png', '-loop 1 -t ' + total + ' -i caps/bezel.png'];
  names.forEach(n => ins.push(`-loop 1 -t ${total} -i caps/c${which}_${n}.png`));
  ins.push(`-loop 1 -t ${total} -i caps/end${which}.png`, '-f lavfi -t ' + total + ' -i anullsrc=r=44100:cl=stereo');
  let f = `[1:v]scale=700:1400,tpad=stop_mode=clone:stop_duration=${END + 1}[s];[2:v]scale=1080:1920,format=gray,crop=700:1400:190:360[m];[s][m]alphamerge[sa];[0:v][sa]overlay=190:360[b1];[b1][3:v]overlay=0:0[l0]`;
  let last = 'l0';
  const bounds = meta.marks.map(m => m.t + meta.off);
  names.forEach((n, i) => { const a = bounds[i], e = i === names.length - 1 ? meta.total : bounds[i + 1]; f += `;[${last}][${4 + i}:v]overlay=0:0:enable='between(t,${a.toFixed(2)},${e.toFixed(2)})'[l${i + 1}]`; last = `l${i + 1}`; });
  f += `;[${last}][${4 + names.length}:v]overlay=0:0:enable='gte(t,${meta.total.toFixed(2)})'[out]`;
  const out = `out/${V.name}.mp4`;
  cp.execSync(`ffmpeg -y -loglevel error ${ins.join(' ')} -filter_complex "${f}" -map "[out]" -map ${5 + names.length}:a -t ${total.toFixed(2)} -r 30 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -shortest ${out}`, { stdio: 'inherit' });
  console.log('done', out, total.toFixed(1) + 's');
})();
