// Fails when a tr('...') call has no English entry (it would silently show French to English users),
// and warns about French-looking literals that are not wrapped in tr().
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { scanAll } from './scan.mjs'

const { EN } = await import('../../src/locales/en.ts')
const ROOT = new URL('../../src/', import.meta.url).pathname

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'locales') walk(p, out) }
    else if (/\.(tsx?)$/.test(e.name) && !e.name.endsWith('.d.ts') && !/\.test\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const missing = new Map()
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('tr(')) continue
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tr') {
      const arg = node.arguments[0]
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && !Object.prototype.hasOwnProperty.call(EN, arg.text)) {
        const k = arg.text
        if (!missing.has(k)) missing.set(k, `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const FR = /[àâäçéèêëîïôöùûüÿœ]|\b(le|la|les|une|des|du|pour|votre|vos|vous|avec|sans|dans|est|sont|pas|cette|ces|nous|aucun|aucune|erreur|chargement)\b/i
const unwrapped = scanAll().filter((c) => !c.db && FR.test(c.text) && !Object.prototype.hasOwnProperty.call(EN, c.text))

for (const [k, where] of missing) console.error(`missing English: ${JSON.stringify(k)}  (${where})`)
for (const c of unwrapped.slice(0, 30)) console.warn(`not translated: ${JSON.stringify(c.text.slice(0, 80))}  (${c.file}:${c.line})`)
console.log(`${missing.size} missing English entries, ${unwrapped.length} possibly untranslated literals`)
process.exit(missing.size > 0 ? 1 : 0)
