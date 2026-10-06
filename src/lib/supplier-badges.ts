/** Logo of the shop a product comes from (matched on the supplier name) and flag of the supplier's country. */

const LOGOS: Array<{ test: RegExp; src: string; name: string }> = [
  { test: /alibaba|1688/i, src: '/brands/alibaba.png', name: 'Alibaba' },
  { test: /amazon/i, src: '/brands/amazon.png', name: 'Amazon' },
  { test: /shein/i, src: '/brands/shein.png', name: 'Shein' },
  { test: /temu/i, src: '/brands/temu.jpg', name: 'Temu' },
  { test: /muscle\s*(&|and)\s*strength/i, src: '/brands/muscle-strength.png', name: 'Muscle & Strength' },
]

export function supplierLogo(supplierName: string | null | undefined): { src: string; name: string } | null {
  if (!supplierName) return null
  const hit = LOGOS.find((l) => l.test.test(supplierName))
  return hit ? { src: hit.src, name: hit.name } : null
}

// Flags available in /public/flags (ISO 3166-1 alpha-2, lower case). Add a file and its code here to support a new country.
const FLAGS = new Set(['ht', 'us', 'cn'])

export function flagFor(countryCode: string | null | undefined): { src: string; code: string } | null {
  const code = (countryCode ?? '').trim().toLowerCase()
  return FLAGS.has(code) ? { src: `/flags/${code}.svg`, code: code.toUpperCase() } : null
}
