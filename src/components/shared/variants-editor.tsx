import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { tr } from '@/lib/i18n'

export interface VariantRow {
  /** Present for variants already saved: keeps carts and past orders linked when the variant is edited. */
  id?: string
  group_name: string
  label: string
  label_en: string
  price_htg: number
  image: string
  stock_available: boolean
}

export const emptyVariant = (group = ''): VariantRow => ({ group_name: group, label: '', label_en: '', price_htg: 0, image: '', stock_available: true })

/** First problem found in the rows (shown as a toast), or null when they can be saved. */
export function variantsError(rows: VariantRow[]): string | null {
  if (rows.length > 100) return tr('100 variantes au maximum.')
  for (const r of rows) {
    if (!r.label.trim()) return tr('Chaque variante doit avoir un libellé.')
    if (!(r.price_htg > 0)) return tr('Chaque variante doit avoir un prix supérieur à 0.')
    if (r.image.trim() && !/^https:\/\/\S+$/.test(r.image.trim())) return tr('L\'image d\'une variante doit être un lien https.')
  }
  return null
}

/** JSON sent to `admin_save_product_variants` (the order of the rows is their display order). */
export function variantsPayload(rows: VariantRow[]) {
  return rows.map((r, i) => ({
    id: r.id ?? null, group_name: r.group_name.trim() || null, label: r.label.trim(), label_en: r.label_en.trim() || null,
    price_htg: r.price_htg, image: r.image.trim() || null, stock_available: r.stock_available, active: true, sort_order: i,
  }))
}

export function VariantsEditor({ rows, onChange }: { rows: VariantRow[]; onChange: (rows: VariantRow[]) => void }) {
  const set = (i: number, patch: Partial<VariantRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <Label>{tr('Variantes (tailles, couleurs…)')}</Label>
      <p className="text-xs text-muted-foreground">
        {tr('Une variante = un choix complet (ex. « Noir / M ») avec son prix normal (sans réduction) et sa photo. Le client doit en choisir une ; les paliers par quantité s\'appliquent en % sur son prix. Le groupe sert seulement à les ranger.')}
      </p>
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input value={r.group_name} onChange={e => set(i, { group_name: e.target.value })} placeholder={tr('Groupe (ex. Taille)')} aria-label={tr('Groupe')} maxLength={40} />
            <Input type="number" min={0} step="any" value={r.price_htg || ''} onChange={e => set(i, { price_htg: parseFloat(e.target.value) || 0 })} placeholder={tr('Prix normal HTG')} aria-label={tr('Prix normal HTG')} />
            <Input value={r.label} onChange={e => set(i, { label: e.target.value })} placeholder={tr('Libellé (ex. M, Rouge)')} aria-label={tr('Libellé')} maxLength={120} />
            <Input value={r.label_en} onChange={e => set(i, { label_en: e.target.value })} placeholder={tr('Libellé en anglais')} aria-label={tr('Libellé en anglais')} maxLength={120} />
            <Input className="col-span-2" value={r.image} onChange={e => set(i, { image: e.target.value })} placeholder="https://…" aria-label={tr('Photo de la variante')} />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={r.stock_available} onChange={e => set(i, { stock_available: e.target.checked })} className="h-4 w-4 rounded" />
              {tr('En stock')}
            </label>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex h-9 w-9 items-center justify-center text-destructive hover:text-destructive/80" aria-label={tr('Retirer la variante')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, emptyVariant(rows[rows.length - 1]?.group_name ?? '')])} className="gap-1.5">
        <Plus className="h-4 w-4" />{tr('Ajouter une variante')}
      </Button>
    </div>
  )
}
