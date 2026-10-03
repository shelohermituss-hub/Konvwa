// Wraps every scanned string that has an entry in src/locales/en.ts with tr(). Idempotent: already wrapped strings are skipped.
// Usage: node scripts/i18n/apply.mjs [--dry] [--only path/substring]
import fs from 'node:fs'
import { scanAll } from './scan.mjs'

const { EN } = await import('../../src/locales/en.ts')
const dry = process.argv.includes('--dry')
const onlyIdx = process.argv.indexOf('--only')
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null

const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
const all = scanAll().filter((c) => (!only || c.file.includes(only)) && !c.db && Object.prototype.hasOwnProperty.call(EN, c.text))

const byFile = new Map()
for (const c of all) {
  if (!byFile.has(c.abs)) byFile.set(c.abs, [])
  byFile.get(c.abs).push(c)
}

let edits = 0
for (const [file, list] of byFile) {
  let src = fs.readFileSync(file, 'utf8')
  list.sort((a, b) => b.pos - a.pos)
  for (const c of list) {
    const orig = src.slice(c.pos, c.end)
    let rep
    if (c.kind === 'jsx') {
      const lead = orig.match(/^\s*/)[0]
      const trail = orig.match(/\s*$/)[0]
      const pre = lead && !lead.includes('\n') ? "{' '}" : ''
      const post = trail && !trail.includes('\n') && trail.length < orig.length ? "{' '}" : ''
      const leadOut = pre ? '' : lead
      const trailOut = post ? '' : trail
      rep = `${leadOut}${pre}{tr(${q(c.text)})}${post}${trailOut}`
    } else if (c.kind === 'attr') {
      rep = `{tr(${q(c.text)})}`
      // replace the initializer only (c.pos..c.end is the string literal node)
    } else if (c.kind === 'template') {
      rep = `tr(${q(c.text)}${c.args.length ? ', ' + c.args.join(', ') : ''})`
    } else {
      rep = `tr(${q(c.text)})`
    }
    src = src.slice(0, c.pos) + rep + src.slice(c.end)
    edits++
  }
  if (!/from '@\/lib\/i18n'/.test(src)) {
    const imports = [...src.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm)]
    const last = imports[imports.length - 1]
    const at = last ? last.index + last[0].length : 0
    src = src.slice(0, at) + "\nimport { tr } from '@/lib/i18n'" + src.slice(at)
  }
  if (!dry) fs.writeFileSync(file, src)
}
console.log(dry ? 'would edit' : 'edited', edits, 'strings in', byFile.size, 'files')
