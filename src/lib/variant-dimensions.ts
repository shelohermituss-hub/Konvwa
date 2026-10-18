// A variant of the catalogue is one complete choice ("Noir / Taille 7", group "COULEUR / TAILLE"). The product page shows its dimensions one after the other
// (the colour first, then the sizes that exist in that colour) instead of one long list of every combination. Pure functions: unit-tested.

export interface DimVariant { id: string; group_name: string | null; stock_available: boolean; image?: string | null }
export interface DimRow<T> { v: T; parts: string[] }
export interface Dimensions<T> { names: string[]; rows: Array<DimRow<T>> }

const SEP = /\s*\/\s*/

/**
 * The dimensions of a product's variants, or null when they are not one complete choice per variant: every variant must belong to the same group
 * ("COULEUR / TAILLE"), have as many parts in its label ("Noir / Taille 7") as the group has names (2 or 3), and no two variants may share a combination.
 */
export function splitVariants<T extends DimVariant>(variants: T[], labelOf: (v: T) => string): Dimensions<T> | null {
  if (variants.length < 2) return null
  const group = variants[0].group_name?.trim() ?? ''
  if (!group || variants.some((v) => (v.group_name?.trim() ?? '') !== group)) return null
  const names = group.split(SEP).map((s) => s.trim())
  if (names.length < 2 || names.length > 3 || names.some((n) => !n)) return null
  const rows = variants.map((v) => ({ v, parts: labelOf(v).split(SEP).map((s) => s.trim()) }))
  if (rows.some((r) => r.parts.length !== names.length || r.parts.some((p) => !p))) return null
  if (new Set(rows.map((r) => r.parts.join('\u0000'))).size !== rows.length) return null
  return { names, rows }
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
  for (let k = i + 1; k < dims.names.length; k++) {
    const keep = chosen[k]
    if (keep !== undefined && optionsAt(dims, next, k).some((o) => o.value === keep && o.available)) next.push(keep)
    else break
  }
  return next
}

/** The variant of a complete choice, or null while a dimension is still to choose. */
export function resolve<T extends DimVariant>(dims: Dimensions<T>, chosen: string[]): T | null {
  if (chosen.length !== dims.names.length) return null
  return dims.rows.find((r) => r.parts.every((p, k) => p === chosen[k]))?.v ?? null
}

/** The choices that describe a variant. */
export const partsOf = <T extends DimVariant>(dims: Dimensions<T>, id: string | null): string[] => (id ? dims.rows.find((r) => r.v.id === id)?.parts ?? [] : [])
