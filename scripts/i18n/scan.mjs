// Finds user-facing string literals in src/ (JSX text, text-like attributes, string/template literals).
// Usage: node scripts/i18n/scan.mjs [--json out.json]
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = new URL('../../src/', import.meta.url).pathname
const SKIP_DIRS = new Set(['ui', 'locales'])
const SKIP_FILES = new Set(['locales/en.ts', 'lib/i18n.ts', 'lib/i18n-context.tsx', 'lib/supabase.ts', 'types/index.ts'])
const TEXT_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'description', 'content', 'helperText', 'subtitle', 'emptyText'])
const SKIP_ATTRS = new Set(['className', 'class', 'style', 'key', 'id', 'to', 'href', 'src', 'type', 'name', 'value', 'htmlFor', 'variant', 'size', 'side', 'align', 'role', 'inputMode', 'accept', 'autoComplete', 'target', 'rel', 'viewBox', 'd', 'fill', 'stroke', 'points', 'xmlns', 'loading', 'width', 'height', 'cx', 'cy', 'r', 'x', 'y', 'transform', 'strokeLinecap', 'strokeLinejoin', 'pattern', 'lang'])
const NON_TEXT_CALLS = new Set([
  'tr', 'from', 'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is', 'in', 'not', 'order', 'rpc', 'or', 'filter', 'ilike', 'like',
  'cn', 'cva', 'clsx', 'twMerge', 'navigate', 'getElementById', 'querySelector', 'querySelectorAll', 'getItem', 'setItem',
  'removeItem', 'addEventListener', 'removeEventListener', 'setAttribute', 'matchMedia', 'dispatchEvent', 'Event', 'require',
  'import', 'createContext', 'invoke', 'upload', 'getPublicUrl', 'createSignedUrl', 'useNavigate', 'Link', 'NavLink',
  'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'DateTimeFormat', 'NumberFormat', 'format', 'log', 'warn',
  'error_console', 'get', 'has', 'set', 'startsWith', 'endsWith', 'includes', 'split', 'join', 'replace', 'test', 'match',
  'localeCompare', 'padStart', 'padEnd', 'indexOf', 'RegExp', 'Number', 'parseInt', 'parseFloat', 'scrollIntoView', 'scrollTo',
  'postMessage', 'fetch', 'open', 'register', 'subscribe', 'createElement', 'append', 'storage',
])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out) }
    else if (/\.(tsx?|ts)$/.test(e.name) && !e.name.endsWith('.d.ts') && !/\.test\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const hasLetter = (s) => /\p{L}/u.test(s)
const FR_HINT = /[àâäçéèêëîïôöùûüÿœ]|\b(le|la|les|un|une|des|du|de|et|ou|pour|votre|vos|vous|avec|sans|sur|dans|est|sont|pas|ce|cette|ces|qui|que|nous|mon|ma|mes|plus|aucun|aucune|tous|toutes|voir|ajouter|annuler|enregistrer|erreur|chargement|commande|commandes|paiement|solde|retour|retirer|supprimer|modifier|confirmer|envoyer|fermer|suivant|précédent|oui|non)\b/i

function enclosingCallName(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      const e = p.expression
      if (ts.isIdentifier(e)) return e.text
      if (ts.isPropertyAccessExpression(e)) return e.name.text
      return null
    }
    if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return null
  }
  return null
}

function inTypeOrImport(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isTypeNode(p) || ts.isLiteralTypeNode(p)) return true
    if (ts.isBlock(p) || ts.isJsxElement(p)) return false
  }
  return false
}

function isClassNameAttr(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return ['className', 'class', 'style', 'key', 'id', 'to', 'href', 'src', 'type', 'name', 'value', 'htmlFor', 'variant', 'size', 'side', 'align', 'role', 'inputMode', 'accept', 'autoComplete', 'target', 'rel', 'viewBox', 'd', 'fill', 'stroke', 'points', 'xmlns', 'data-slot'].includes(p.name.getText())
    if (ts.isBlock(p) || ts.isJsxElement(p)) return false
  }
  return false
}

function decodeEntities(s) {
  return s.replace(/&nbsp;/g, '\u00a0').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&rsquo;/g, '\u2019').replace(/&hellip;/g, '\u2026')
}
function normalize(s) { return decodeEntities(s).replace(/\s+/g, ' ').trim() }

const DB_CALLS = new Set(['insert', 'update', 'upsert', 'rpc'])
function inDbWrite(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && DB_CALLS.has(p.expression.name.text)) return true
    if (ts.isBlock(p) || ts.isJsxElement(p) || ts.isSourceFile(p)) return false
  }
  return false
}

export function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const rel = path.relative(ROOT, file)
  const found = []
  const push = (kind, str, node, extra = {}) => {
    const t = kind === 'jsx' ? normalize(str) : str
    if (!t || !hasLetter(t)) return
    const pos = kind === 'jsx' ? node.pos : node.getStart()
    found.push({ file: rel, abs: file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, text: t, pos, end: node.end, db: inDbWrite(node), ...extra })
  }
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (node.getText().trim()) push('jsx', node.getText(), node)
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText()
      const init = node.initializer
      if (init && ts.isStringLiteral(init) && !SKIP_ATTRS.has(name) && !name.startsWith('data-')
          && (TEXT_ATTRS.has(name) || /\s/.test(init.text) || /[^\x00-\x7f]/.test(init.text))) {
        push('attr', init.text, init, { attr: name })
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent
      const isAttrInit = p && ts.isJsxAttribute(p)
      if (!isAttrInit && !inTypeOrImport(node) && !isClassNameAttr(node)) {
        if (!(p && ts.isPropertyAssignment(p) && p.name === node) && !(p && ts.isElementAccessExpression(p))
            && !(p && ts.isCaseClause(p)) && !(p && ts.isBinaryExpression(p) && ['===', '!==', '==', '!='].includes(p.operatorToken.getText()))) {
          const call = enclosingCallName(node)
          if (!call || !NON_TEXT_CALLS.has(call)) {
            const s = node.text
            if (/\s/.test(s) || /[^\x00-\x7f]/.test(s) || /^[A-ZÀ-Ý][a-zà-ÿ]{2,}/.test(s)) push('string', s, node, { call })
          }
        }
      }
    } else if (ts.isTemplateExpression(node)) {
      if (!inTypeOrImport(node) && !isClassNameAttr(node)) {
        const call = enclosingCallName(node)
        if (!call || !NON_TEXT_CALLS.has(call)) {
          let key = node.head.text
          node.templateSpans.forEach((sp, i) => { key += `{${i}}` + sp.literal.text })
          if (hasLetter(key.replace(/\{\d+\}/g, ''))) push('template', key, node, { call, args: node.templateSpans.map((sp) => sp.expression.getText()) })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export function scanAll() {
  const out = []
  for (const f of walk(ROOT)) {
    const rel = path.relative(ROOT, f)
    if (SKIP_FILES.has(rel)) continue
    out.push(...scanFile(f))
  }
  return out
}

if (process.argv[1] && process.argv[1].endsWith('scan.mjs')) {
  const all = scanAll()
  const jsonIdx = process.argv.indexOf('--json')
  if (jsonIdx > -1) fs.writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(all, null, 1))
  const byFile = {}
  for (const f of all) byFile[f.file] = (byFile[f.file] ?? 0) + 1
  console.log('total', all.length, 'unique', new Set(all.map((f) => f.text)).size, 'files', Object.keys(byFile).length)
  const french = all.filter((f) => FR_HINT.test(f.text))
  console.log('french-looking', french.length, 'unique', new Set(french.map((f) => f.text)).size)
}
