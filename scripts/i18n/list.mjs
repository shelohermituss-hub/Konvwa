// Prints untranslated candidate strings per file: node scripts/i18n/list.mjs <path-substring...>
import { scanAll } from './scan.mjs'
const { EN } = await import('../../src/locales/en.ts')
const subs = process.argv.slice(2)
const seen = new Set()
const byFile = new Map()
for (const c of scanAll()) {
  if (subs.length && !subs.some((s) => c.file.includes(s))) continue
  if (c.db || Object.prototype.hasOwnProperty.call(EN, c.text) || seen.has(c.text)) continue
  if (/^[\s{}()[\]0-9.,:;·•|/\\+*=<>#%$@!?'"_-]*$/.test(c.text.replace(/\{\d+\}/g, ''))) continue
  if (/^(bg|text|border|flex|grid|h-|w-|rounded|px|py|p-|m-|space|gap|items|justify|font|shadow|ring|hover|focus|absolute|relative|min-|max-|inline|block|hidden|overflow|transition|animate|sr-only|col-|row-|top|left|right|bottom|z-|opacity|cursor|select|pointer|object|aspect|line-clamp|truncate|leading|tracking|uppercase|[0-9]+px|linear-gradient|0 |rotate|\(|[a-z-]+\/[a-z0-9]+$)/.test(c.text) && !/[à-ÿ]/.test(c.text)) continue
  seen.add(c.text)
  if (!byFile.has(c.file)) byFile.set(c.file, [])
  byFile.get(c.file).push(c.text)
}
for (const [f, list] of byFile) {
  console.log('## ' + f)
  for (const t of list) console.log(JSON.stringify(t))
}
