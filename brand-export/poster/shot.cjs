const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1080,height:1080},deviceScaleFactor:2});
await p.goto('file:///home/user/Konvwa/brand-export/poster/poster.html',{waitUntil:'networkidle'}).catch(()=>{});
await p.waitForTimeout(1500);
await p.screenshot({path:'/home/user/Konvwa/brand-export/konvwa-poster-2160.png'});await b.close()})();
