import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LANG } from '@/lib/i18n'

export interface ProductOption {
  id: string
  group_id: string
  label: string
  label_en: string | null
  image: string | null
  price_htg: number
  sort_order: number
}

export interface OptionGroup {
  id: string
  name: string
  name_en: string | null
  sort_order: number
  required: boolean
  multi: boolean
  show_when_group: string | null
  product_options: ProductOption[]
}

export const OPTION_GROUP_SELECT = 'id, name, name_en, sort_order, required, multi, show_when_group, product_options(id, group_id, label, label_en, image, price_htg, sort_order)'

const byOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order

export const optionLabel = (o: Pick<ProductOption, 'label' | 'label_en'>) => (LANG === 'en' && o.label_en?.trim() ? o.label_en : o.label)
export const groupName = (g: Pick<OptionGroup, 'name' | 'name_en'>) => (LANG === 'en' && g.name_en?.trim() ? g.name_en : g.name)

/** Groups and options in display order, with numeric prices. */
export function normalizeGroups(rows: unknown): OptionGroup[] {
  return ((rows ?? []) as OptionGroup[])
    .map((g) => ({ ...g, product_options: (g.product_options ?? []).map((o) => ({ ...o, price_htg: Number(o.price_htg) })).sort(byOrder) }))
    .filter((g) => g.product_options.length > 0)
    .sort(byOrder)
}

/** The product's option groups (none while loading, or when it has none). */
export function useProductOptions(productId: string | undefined): OptionGroup[] {
  const [groups, setGroups] = useState<OptionGroup[]>([])
  useEffect(() => {
    setGroups([])
    if (!productId) return
    let live = true
    supabase.from('product_option_groups').select(OPTION_GROUP_SELECT).eq('product_id', productId).eq('product_options.active', true)
      .then(({ data }) => { if (live) setGroups(normalizeGroups(data)) })
    return () => { live = false }
  }, [productId])
  return groups
}

/** A group is shown unless it depends on another group in which nothing is chosen yet. */
export function visibleGroups(groups: OptionGroup[], selected: string[]): OptionGroup[] {
  return groups.filter((g) => !g.show_when_group || groups.find((p) => p.id === g.show_when_group)?.product_options.some((o) => selected.includes(o.id)))
}

/** Keeps only the choices of groups that are shown (hiding a group forgets what was chosen in it). */
export function cleanSelection(groups: OptionGroup[], selected: string[]): string[] {
  const shown = new Set(visibleGroups(groups, selected).flatMap((g) => g.product_options.map((o) => o.id)))
  const kept = selected.filter((id) => shown.has(id))
  return kept.length === selected.length ? selected : cleanSelection(groups, kept)
}

/** Picks (or unpicks) an option: single-choice groups swap, multi groups toggle. */
export function toggleOption(groups: OptionGroup[], selected: string[], optionId: string): string[] {
  const g = groups.find((x) => x.product_options.some((o) => o.id === optionId))
  if (!g) return selected
  const on = selected.includes(optionId)
  const siblings = g.product_options.map((o) => o.id)
  const next = on ? selected.filter((id) => id !== optionId)
    : g.multi ? [...selected, optionId]
    : [...selected.filter((id) => !siblings.includes(id)), optionId]
  return cleanSelection(groups, next)
}

/** Supplement per unit of a selection (display only: the database prices the order). */
export function optionsSupplement(groups: OptionGroup[], selected: string[]): number {
  return groups.flatMap((g) => g.product_options).filter((o) => selected.includes(o.id)).reduce((s, o) => s + o.price_htg, 0)
}

/** First shown required group with no choice, or null. */
export function missingRequiredGroup(groups: OptionGroup[], selected: string[]): OptionGroup | null {
  return visibleGroups(groups, selected).find((g) => g.required && !g.product_options.some((o) => selected.includes(o.id))) ?? null
}

/** Options of a cart line, with the name of their group. */
export interface CartOption extends ProductOption { group_name: string; group_name_en: string | null }

/** The options with these ids (and their group names), for cart and checkout lines. */
export async function fetchCartOptions(ids: string[]): Promise<Map<string, CartOption>> {
  const known = new Map<string, CartOption>()
  if (ids.length === 0) return known
  const { data } = await supabase.from('product_options')
    .select('id, group_id, label, label_en, image, price_htg, sort_order, product_option_groups(name, name_en)').in('id', ids)
  for (const o of (data ?? []) as unknown as Array<ProductOption & { product_option_groups: { name: string; name_en: string | null } | null }>) {
    const { product_option_groups: g, ...rest } = o
    known.set(o.id, { ...rest, price_htg: Number(o.price_htg), group_name: g?.name ?? '', group_name_en: g?.name_en ?? null })
  }
  return known
}
