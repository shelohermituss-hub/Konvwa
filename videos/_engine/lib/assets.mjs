// Real assets for the briefs: search a stock source, download into library/ (briefs reference it as lib:<path>), log the credit, cut out the background.
import fs from 'node:fs'
import path from 'node:path'
import { run } from './media.mjs'
import * as pixabay from './pixabay.mjs'

/** Sources the CLI can query. Unsplash goes through its MCP tools (download, then `cutout`); Pexels waits for a key. */
export const SOURCES = { pixabay }

export function source(name) {
  const s = SOURCES[name]
  if (!s) throw new Error(`source inconnue : ${name} (${Object.keys(SOURCES).join(' | ')})`)
  return s
}

/**
 * Absolute file for `--to library/<dossier>/<nom>` (the extension is added when missing).
 * Refuses anything that would land outside library/ or a name with odd characters: the path ends up in briefs and in git.
 */
export function libraryTarget(libraryDir, to, ext) {
  const rel = String(to || '').replace(/^library\//, '')
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*(\.[a-z0-9]+)?$/.test(rel)) throw new Error(`destination invalide : ${to} (attendu : library/<dossier>/<nom>, minuscules, chiffres, tirets)`)
  const file = path.extname(rel) ? rel : `${rel}.${ext}`
  return { file: path.join(libraryDir, file), ref: `lib:${file}` }
}

export function creditLine(ref, item) {
  return `- \`${ref}\` — ${item.source} ${item.type} ${item.id} — ${item.page} — par [${item.author}](${item.authorUrl})`
}

const CREDITS_HEADER = '# Crédits des assets de la bibliothèque\n\nChaque fichier téléchargé par `motion assets get` est listé ici avec sa source et son auteur.\nPixabay : [licence Pixabay](https://pixabay.com/service/license-summary/) (usage commercial autorisé, attribution non obligatoire).\n\n'

/** Records the credit once per file, replacing an older line for the same file (re-download over it). */
export function recordCredit(libraryDir, ref, item) {
  const credits = path.join(libraryDir, 'CREDITS.md')
  const kept = (fs.existsSync(credits) ? fs.readFileSync(credits, 'utf8') : CREDITS_HEADER).split('\n').filter((l) => !l.startsWith(`- \`${ref}\``)).join('\n')
  const body = kept.trimEnd() + '\n'
  const blank = body.split('\n').at(-2).startsWith('- ') ? '' : '\n'
  fs.writeFileSync(credits, body + blank + creditLine(ref, item) + '\n')
}

/** Downloads one item into library/ and returns { ref, file, item }. Fails before writing anything if the item cannot be found. */
export function getAsset(libraryDir, sourceName, id, { type = 'photo', to } = {}) {
  const item = source(sourceName).byId(id, { type })
  if (!item) throw new Error(`${sourceName} ${id} : aucun fichier téléchargeable`)
  const { file, ref } = libraryTarget(libraryDir, to, item.ext)
  if (path.extname(file).slice(1) !== item.ext) throw new Error(`${to} : l’extension doit être .${item.ext}`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.part'
  // The CDN answers 429 with a Retry-After when it throttles: curl waits and retries.
  const r = run('curl', ['-sSL', '--fail', '--retry', '3', '--retry-max-time', '300', '--max-time', '600', '-o', tmp, item.url])
  if (!r.ok) { fs.rmSync(tmp, { force: true }); throw new Error(`téléchargement impossible (${r.err.trim()})`) }
  fs.renameSync(tmp, file)
  recordCredit(libraryDir, ref, item)
  return { ref, file, item }
}

/** The rembg command: $REMBG if set, else `rembg` on the PATH. */
export function rembgCommand(env = process.env) {
  return env.REMBG || 'rembg'
}

/** Background removal with rembg (local, no credit). Writes <name>-cutout.png next to the input unless `out` is given. */
export function cutout(input, out) {
  if (!fs.existsSync(input)) throw new Error(`fichier introuvable : ${input}`)
  const target = out || input.replace(/\.[^./]+$/, '') + '-cutout.png'
  const r = run(rembgCommand(), ['i', input, target])
  if (r.status == null) throw new Error('rembg introuvable : pip install "rembg[cpu,cli]" (ou REMBG=/chemin/vers/rembg)')
  if (!r.ok || !fs.existsSync(target)) throw new Error(`détourage impossible (${(r.err || r.out).trim().split('\n').at(-1)})`)
  return target
}
