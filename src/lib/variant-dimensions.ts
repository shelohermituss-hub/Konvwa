// A variant of the catalogue is one complete choice ("Noir / Taille 7", group "COULEUR / TAILLE"). The product page shows its dimensions one after the other
// (the colour first, then the sizes that exist in that colour) instead of one long list of every combination. Pure functions: unit-tested.

export interface DimVariant { id: string; group_name: string | null; stock_available: boolean; image?: string | null }
export interface DimRow<T> { v: T; parts: string[] }
export interface Dimensions<T> { names: string[]; rows: Array<DimRow<T>> }

const SEP = /\s*\/\s*/

/**
 * The dimensions of a product's variants, or null when they are not one complete choice per variant: every variant must belong to the same group and have
 * the same number of parts (2 to 4) in its label ("Noir / Taille 7"), and no two variants may share a combination. The names come from the group
 * ("COULEUR / TAILLE"); a dimension the group does not name ("Minuit / 16GB / 512GB") has an empty name, which the page fills in.
 */
export function splitVariants<T extends DimVariant>(variants: T[], labelOf: (v: T) => string): Dimensions<T> | null {
  if (variants.length < 2) return null
  const group = variants[0].group_name?.trim() ?? ''
  if (variants.some((v) => (v.group_name?.trim() ?? '') !== group)) return null
  const rows = variants.map((v) => ({ v, parts: labelOf(v).split(SEP).map((s) => s.trim()) }))
  const n = rows[0].parts.length
  if (n < 2 || n > 4 || rows.some((r) => r.parts.length !== n || r.parts.some((p) => !p))) return null
  if (new Set(rows.map((r) => r.parts.join('\u0000'))).size !== rows.length) return null
  const named = group ? group.split(SEP).map((s) => s.trim()) : []
  const names = Array.from({ length: n }, (_, i) => (named.length === n ? named[i] : named.length > n ? named[i] : i < named.length && named.length > 1 ? named[i] : ''))
  return { names, rows }
}

const SIZE_LIKE = /(\d\s?(fl|oz|ml|cl|l|g|kg|lb|lbs|mm|cm|m|go|gb|tb|mo|mb|pcs|pi[eè]ces?|unit[eé]s?|packs?|tablets?|vcaps|softgels|comprim[eé]s)\b)|\b(pack|taille|size)\b/i

/** The heading of a product whose variants are one single list: a group named "Couleur / Taille" holding only sizes is headed "Taille", only colours "Couleur". */
export function flatHeading(group: string | null | undefined, labels: string[], fallback: string): string {
  const names = (group ?? '').split(SEP).map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) return fallback
  if (names.length === 1) return names[0]
  return labels.length > 0 && labels.every((l) => SIZE_LIKE.test(l)) ? names[names.length - 1] : names[0]
}

export interface DimOption<T> { value: string; /** At least one variant with this value (and the values chosen before) is in stock. */ available: boolean; /** The first picture of those variants. */ image: string | null; variant: T }

/** The values of dimension `i` among the variants that match the values already chosen before it, in the order they come. */
export function optionsAt<T extends DimVariant>(dims: Dimensions<T>, chosen: string[], i: number): Array<DimOption<T>> {
  const out = new Map<string, DimOption<T>>()
  for (const r of dims.rows) {
    if (!chosen.slice(0, i).every((c, k) => r.parts[k] === c)) continue
    const o = out.get(r.parts[i])
    if (!o) out.set(r.parts[i], { value: r.parts[i], available: r.v.stock_available, image: r.v.image ?? null, variant: r.v })
    else {
      if (r.v.stock_available && !o.available) { o.available = true; o.variant = r.v }
      if (!o.image && r.v.image) o.image = r.v.image
    }
  }
  return [...out.values()]
}

/** The choices after picking `value` for dimension `i`: the later choices that are still possible are kept (changing the colour keeps the size when it exists in that colour). */
export function choose<T extends DimVariant>(dims: Dimensions<T>, chosen: string[], i: number, value: string): string[] {
  const next = [...chosen.slice(0, i), value]
  let kept = true
  for (let k = i + 1; k < dims.names.length; k++) {
    const keep = chosen[k]
    const options = optionsAt(dims, next, k)
    if (kept && keep !== undefined && options.some((o) => o.value === keep && o.available)) next.push(keep)
    else {
      kept = false
      // a dimension that has one single value (and in stock) needs no choice
      if (options.length === 1 && options[0].available) next.push(options[0].value)
      else break
    }
  }
  return next
}

/** The starting choices: the dimensions with one single value are already chosen. */
export function initialChoice<T extends DimVariant>(dims: Dimensions<T>): string[] {
  const out: string[] = []
  for (let k = 0; k < dims.names.length; k++) {
    const options = optionsAt(dims, out, k)
    if (options.length === 1 && options[0].available) out.push(options[0].value)
    else break
  }
  return out
}

/** The variant of a complete choice, or null while a dimension is still to choose. */
export function resolve<T extends DimVariant>(dims: Dimensions<T>, chosen: string[]): T | null {
  if (chosen.length !== dims.names.length) return null
  return dims.rows.find((r) => r.parts.every((p, k) => p === chosen[k]))?.v ?? null
}

/** The choices that describe a variant. */
export const partsOf = <T extends DimVariant>(dims: Dimensions<T>, id: string | null): string[] => (id ? dims.rows.find((r) => r.v.id === id)?.parts ?? [] : [])
