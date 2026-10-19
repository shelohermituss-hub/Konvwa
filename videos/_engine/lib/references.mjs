// Numbered catalogue of the client's reference videos: "utilise la référence 4" means read references/catalog.json entry 4 and
// apply its DNA. Numbers never change once given; a new video takes the next free number.
import fs from 'node:fs'
import path from 'node:path'

export function catalogFile(engineDir) {
  return path.join(engineDir, 'references', 'catalog.json')
}

export function loadCatalog(engineDir) {
  const f = catalogFile(engineDir)
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
}

export function saveCatalog(engineDir, catalog) {
  fs.writeFileSync(catalogFile(engineDir), JSON.stringify(catalog, null, 2) + '\n')
}

/** Accepts 4, "4", "n4", "réf. 4", "#4". */
export function refNumber(x) {
  const m = /^\D*(\d+)$/.exec(String(x ?? '').trim())
  return m ? Number(m[1]) : null
}

export function findRef(catalog, x) {
  const n = refNumber(x)
  return catalog.find((r) => r.n === n) || null
}

export function nextNumber(catalog) {
  return catalog.reduce((max, r) => Math.max(max, r.n), 0) + 1
}

/** Folder of a new reference: "07-<slug>" (slug from --name or the file name). */
export function refDir(n, name) {
  const slug = String(name || 'reference').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'reference'
  return `${String(n).padStart(2, '0')}-${slug}`
}

/** Entry for a video that has just been analysed; the look and DNA are written by whoever watched it. */
export function newEntry(n, dir, analysis) {
  return { n, dir, title: 'À décrire', look: `${analysis.aspect}, ${analysis.duration} s, ${analysis.cuts.length} coupe(s)`, dna: [], engine: { hooks: [], scenes: [], transitions: [], backgrounds: [] }, konvwa: '' }
}

/** Engine names cited by an entry that the engine does not know (catches typos and renamed scenes). */
export function unknownEngineNames(entry, { types, transitions, backgrounds }) {
  const e = entry.engine || {}
  return [
    ...[...(e.hooks || []), ...(e.scenes || [])].filter((t) => !types.includes(t)),
    ...(e.transitions || []).filter((t) => !transitions.includes(t)),
    ...(e.backgrounds || []).filter((t) => !backgrounds.includes(t)),
  ]
}

export function formatLine(r) {
  return `${String(r.n).padStart(2)}  ${r.title}  (${r.dir})`
}

export function formatCard(r) {
  const e = r.engine || {}
  const list = (xs) => (xs?.length ? xs.join(', ') : '—')
  return [
    `Référence n° ${r.n} — ${r.title}`,
    `Dossier : references/${r.dir}/ (hook.png, all.png${r.timeline ? ', timeline.jpg' : ''}, analysis.json)`,
    '',
    r.look,
    '',
    'ADN à reprendre :',
    ...(r.dna || []).map((d) => `  • ${d}`),
    '',
    `Moteur : hooks ${list(e.hooks)} · scènes ${list(e.scenes)} · transitions ${list(e.transitions)} · fonds ${list(e.backgrounds)}`,
    r.konvwa ? `Pour KONVWA : ${r.konvwa}` : '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trimEnd()
}
