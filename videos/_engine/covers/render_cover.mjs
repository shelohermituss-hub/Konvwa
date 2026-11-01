// Couverture créée à part : node videos/_engine/covers/render_cover.mjs videos/<projet>/cover
// Lit <dossier>/cover.html (qui utilise ../../_engine/covers/kit/cover.css et fond.jpg),
// écrit videos/<projet>/cover.png (1080×1920) et cover-grille.png (aperçu 3:4 de la grille du profil).
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
for (const d of process.argv.slice(2)) {
  const dir = resolve(d)
  await page.goto(pathToFileURL(join(dir, 'cover.html')).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const out = join(dir, '..', 'cover.png')
  await page.screenshot({ path: out })
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', out, '-vf', 'crop=1080:1440:0:240,scale=540:720', join(dir, '..', 'cover-grille.png')])
  console.log('ok', out)
}
await browser.close()
