// node videos/eolienne/cover/render-cover.mjs → videos/eolienne/cover.png (+ cover-grille.png, aperçu 3:4 du profil)
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await page.goto(pathToFileURL(join(here, 'cover.html')).href, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const out = join(here, '..', 'cover.png')
await page.screenshot({ path: out })
await browser.close()
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', out, '-vf', 'crop=1080:1440:0:240,scale=540:720', join(here, '..', 'cover-grille.png')])
console.log('ok', out)
