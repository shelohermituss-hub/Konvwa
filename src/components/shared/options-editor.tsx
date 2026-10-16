import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

export interface OptionRow { id: string; label: string; label_en: string; image: string; price_htg: number }
export interface OptionGroupRow {
  id: string
  name: string
  name_en: string
  required: boolean
  multi: boolean
  /** id of the group that must have a choice for this one to be shown ('' = always shown) */
  show_when: string
  options: OptionRow[]
}

export const emptyOption = (): OptionRow => ({ id: crypto.randomUUID(), label: '', label_en: '', image: '', price_htg: 0 })
export const emptyOptionGroup = (): OptionGroupRow => ({ id: crypto.randomUUID(), name: '', name_en: '', required: false, multi: false, show_when: '', options: [emptyOption()] })

export function optionGroupsError(rows: OptionGroupRow[]): string | null {
  if (rows.length > 20) return tr('20 groupes d\'options au maximum.')
  for (const g of rows) {
    if (!g.name.trim()) return tr('Chaque groupe d\'options doit avoir un nom.')
    if (g.options.length === 0) return tr('« {0} » n\'a aucune option.', g.name)
    if (g.show_when && !rows.some((x) => x.id === g.show_when && x.id !== g.id)) return tr('« {0} » dépend d\'un groupe qui n\'existe pas.', g.name)
    for (const o of g.options) {
      if (!o.label.trim()) return tr('Chaque option doit avoir un libellé.')
      if (!(o.price_htg >= 0)) return tr('Le supplément d\'une option ne peut pas être négatif.')
      if (o.image.trim() && !/^https:\/\/\S+$/.test(o.image.trim())) return tr('L\'image d\'une option doit être un lien https.')
    }
  }
  return null
}

export async function loadOptionGroups(productId: string): Promise<OptionGroupRow[]> {
  const { data } = await supabase.from('product_option_groups')
    .select('id, name, name_en, sort_order, required, multi, show_when_group, product_options(id, label, label_en, image, price_htg, sort_order, active)')
    .eq('product_id', productId).order('sort_order')
  type Row = { id: string; name: string; name_en: string | null; required: boolean; multi: boolean; show_when_group: string | null
    product_options: Array<{ id: string; label: string; label_en: string | null; image: string | null; price_htg: number; sort_order: number; active: boolean }> }
  return ((data ?? []) as unknown as Row[]).map((g) => ({
    id: g.id, name: g.name, name_en: g.name_en ?? '', required: g.required, multi: g.multi, show_when: g.show_when_group ?? '',
    options: g.product_options.filter((o) => o.active).sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ id: o.id, label: o.label, label_en: o.label_en ?? '', image: o.image ?? '', price_htg: Number(o.price_htg) })),
  }))
}

/** Saves the groups of a product keeping the ids that already exist (carts keep pointing at the same options). Admin only (RLS). */
export async function saveOptionGroups(productId: string, rows: OptionGroupRow[]): Promise<string | null> {
  const groups = rows.map((g, i) => ({
    id: g.id, product_id: productId, name: g.name.trim(), name_en: g.name_en.trim() || null, sort_order: i,
    required: g.required, multi: g.multi, show_when_group: g.show_when || null,
  }))
  const options = rows.flatMap((g) => g.options.map((o, i) => ({
    id: o.id, group_id: g.id, label: o.label.trim(), label_en: o.label_en.trim() || null, image: o.image.trim() || null,
    price_htg: o.price_htg, sort_order: i, active: true,
  })))
  if (groups.length > 0) {
    const a = await supabase.from('product_option_groups').upsert(groups)
    if (a.error) return a.error.message
    const b = await supabase.from('product_options').upsert(options)
    if (b.error) return b.error.message
  }
  const keep = groups.map((g) => g.id)
  const del = supabase.from('product_option_groups').delete().eq('product_id', productId)
  const d = await (keep.length > 0 ? del.not('id', 'in', `(${keep.join(',')})`) : del)
  if (d.error) return d.error.message
  if (keep.length > 0) {
    const o = await supabase.from('product_options').delete().in('group_id', keep).not('id', 'in', `(${options.map((x) => x.id).join(',')})`)
    if (o.error) return o.error.message
  }
  return null
}

export function OptionsEditor({ rows, onChange }: { rows: OptionGroupRow[]; onChange: (rows: OptionGroupRow[]) => void }) {
  const setGroup = (i: number, patch: Partial<OptionGroupRow>) => onChange(rows.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  const setOption = (i: number, k: number, patch: Partial<OptionRow>) =>
    setGroup(i, { options: rows[i].options.map((o, j) => (j === k ? { ...o, ...patch } : o)) })
  return (
    <div className="space-y-2">
      <Label>{tr('Options en plus (verres, étui…)')}</Label>
      <p className="text-xs text-muted-foreground">
        {tr('Choix qui s\'ajoutent à la variante, chacun avec sa photo et un supplément de prix par unité (en HTG). Un groupe peut être obligatoire, accepter plusieurs choix, ou ne s\'afficher qu\'après un choix dans un autre groupe.')}
      </p>
      {rows.map((g, i) => (
        <div key={g.id} className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input value={g.name} onChange={e => setGroup(i, { name: e.target.value })} placeholder={tr('Nom du groupe (ex. Verres)')} aria-label={tr('Nom du groupe')} maxLength={80} />
            <Input value={g.name_en} onChange={e => setGroup(i, { name_en: e.target.value })} placeholder={tr('Nom en anglais')} aria-label={tr('Nom en anglais')} maxLength={80} />
            <select value={g.show_when} onChange={e => setGroup(i, { show_when: e.target.value })} aria-label={tr('Afficher seulement après un choix dans')} className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">{tr('Toujours affiché')}</option>
              {rows.filter(x => x.id !== g.id).map(x => <option key={x.id} value={x.id}>{tr('Après un choix dans « {0} »', x.name || '…')}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={g.required} onChange={e => setGroup(i, { required: e.target.checked })} className="h-4 w-4 rounded" />{tr('Obligatoire')}</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={g.multi} onChange={e => setGroup(i, { multi: e.target.checked })} className="h-4 w-4 rounded" />{tr('Plusieurs choix possibles')}</label>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i).map(x => (x.show_when === g.id ? { ...x, show_when: '' } : x)))} className="ml-auto flex h-9 w-9 items-center justify-center text-destructive hover:text-destructive/80" aria-label={tr('Retirer le groupe')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {g.options.map((o, k) => (
            <div key={o.id} className="grid grid-cols-[1fr_6.5rem_2.25rem] gap-2 rounded-lg bg-muted/40 p-2">
              <Input value={o.label} onChange={e => setOption(i, k, { label: e.target.value })} placeholder={tr('Libellé (ex. Anti-bleu)')} aria-label={tr('Libellé')} maxLength={80} />
              <Input type="number" min={0} step="any" value={o.price_htg || ''} onChange={e => setOption(i, k, { price_htg: parseFloat(e.target.value) || 0 })} placeholder={tr('+ HTG')} aria-label={tr('Supplément HTG')} />
              <button type="button" onClick={() => setGroup(i, { options: g.options.filter((_, j) => j !== k) })} className="flex h-9 w-9 items-center justify-center text-destructive hover:text-destructive/80" aria-label={tr('Retirer l\'option')}>
                <Trash2 className="h-4 w-4" />
              </button>
              <Input value={o.label_en} onChange={e => setOption(i, k, { label_en: e.target.value })} placeholder={tr('Libellé en anglais')} aria-label={tr('Libellé en anglais')} maxLength={80} />
              <Input className="col-span-2" value={o.image} onChange={e => setOption(i, k, { image: e.target.value })} placeholder="https://…" aria-label={tr('Photo de l\'option')} />
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setGroup(i, { options: [...g.options, emptyOption()] })} className="gap-1.5">
            <Plus className="h-4 w-4" />{tr('Ajouter une option')}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, emptyOptionGroup()])} className="gap-1.5">
        <Plus className="h-4 w-4" />{tr('Ajouter un groupe d\'options')}
      </Button>
    </div>
  )
}
