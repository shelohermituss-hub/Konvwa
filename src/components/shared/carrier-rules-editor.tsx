import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

interface ItemType { slug: string; label: string }
interface ItemRule { id: string; item_type: string; mode: 'fixed' | 'extra' | 'per_lb'; price_usd: number; value_min_usd: number; value_max_usd: number | null }

const MODES: { value: ItemRule['mode']; label: () => string; unit: string }[] = [
  { value: 'fixed', label: () => tr('Prix fixe par article'), unit: '' },
  { value: 'extra', label: () => tr('Frais en plus du poids'), unit: '' },
  { value: 'per_lb', label: () => tr('Prix par livre'), unit: '/lb' },
]

/** "Téléphone mobile" -> "telephone_mobile" */
const slugify = (label: string) => label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

/** Admin: the special prices of ONE rate by item type (phone, laptop, perfume…), optionally by declared value. The amounts are applied by the database at checkout. */
export function CarrierRulesEditor({ rateId }: { rateId: string }) {
  const [types, setTypes] = useState<ItemType[]>([])
  const [rules, setRules] = useState<ItemRule[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ item_type: '', mode: 'fixed' as ItemRule['mode'], price: '', min: '', max: '' })
  const [newType, setNewType] = useState('')

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      supabase.from('shipping_item_types').select('slug, label').order('sort_order').order('label'),
      supabase.from('shipping_item_rules').select('id, item_type, mode, price_usd, value_min_usd, value_max_usd').eq('rate_id', rateId).order('item_type').order('value_min_usd'),
    ])
    setTypes(t.data ?? [])
    setRules((r.data ?? []) as ItemRule[])
    setLoading(false)
  }, [rateId])

  useEffect(() => { void load() }, [load])

  const labelOf = (slug: string) => types.find(t => t.slug === slug)?.label ?? slug

  async function addRule() {
    const price = parseFloat(form.price)
    const min = form.min ? parseFloat(form.min) : 0
    const max = form.max ? parseFloat(form.max) : null
    if (!form.item_type) { toast.error(tr('Choisissez un type d\'article.')); return }
    if (!(price >= 0)) { toast.error(tr('Prix invalide.')); return }
    if (!(min >= 0) || (max !== null && !(max > min))) { toast.error(tr('Valeur déclarée : le maximum doit dépasser le minimum.')); return }
    setBusy(true)
    const { error } = await supabase.from('shipping_item_rules').insert({ rate_id: rateId, item_type: form.item_type, mode: form.mode, price_usd: price, value_min_usd: min, value_max_usd: max })
    setBusy(false)
    if (error) { toast.error(error.code === '23505' ? tr('Ce type a déjà un prix pour cette tranche de valeur.') : error.message); return }
    setForm(f => ({ ...f, price: '', min: '', max: '' }))
    await load()
  }

  async function removeRule(id: string) {
    const { error } = await supabase.from('shipping_item_rules').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setRules(r => r.filter(x => x.id !== id))
  }

  async function addType() {
    const label = newType.trim()
    const slug = slugify(label)
    if (!label || !slug) return
    const { error } = await supabase.from('shipping_item_types').insert({ slug, label, sort_order: 1000 })
    if (error) { toast.error(error.code === '23505' ? tr('Ce type existe déjà.') : error.message); return }
    setNewType('')
    await load()
  }

  if (loading) return <div className="h-12 animate-pulse rounded-xl bg-muted/50" />

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div>
        <Label className="text-sm font-semibold">{tr('Prix par type d\'article')}</Label>
        <p className="text-xs text-muted-foreground">{tr('Un article dont le type a un prix ici ne suit plus le tarif au poids : prix fixe par article, frais ajoutés au poids, ou prix par livre. La tranche de valeur (USD) est celle de l\'article.')}</p>
      </div>

      {rules.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl bg-white text-sm">
          {rules.map(r => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{labelOf(r.item_type)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {MODES.find(m => m.value === r.mode)?.label()}
                  {(r.value_min_usd > 0 || r.value_max_usd !== null) && ` · ${r.value_min_usd}${r.value_max_usd !== null ? `–${r.value_max_usd}` : '+'} $`}
                </span>
              </span>
              <span className="shrink-0 font-semibold">${r.price_usd}{r.mode === 'per_lb' ? '/lb' : ''}</span>
              <button type="button" onClick={() => void removeRule(r.id)} aria-label={tr('Supprimer')} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label className="text-xs">{tr('Type d\'article')}</Label>
          <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">{tr('Choisir…')}</option>
            {types.map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}
          </select>
        </div>
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label className="text-xs">{tr('Calcul')}</Label>
          <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as ItemRule['mode'] }))} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {MODES.map(m => <option key={m.value} value={m.value}>{m.label()}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{tr('Prix (USD)')}</Label>
          <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{tr('Valeur min ($)')}</Label>
            <Input type="number" min="0" step="0.01" placeholder="0" value={form.min} onChange={e => setForm(f => ({ ...f, min: e.target.value }))} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tr('Valeur max ($)')}</Label>
            <Input type="number" min="0" step="0.01" value={form.max} onChange={e => setForm(f => ({ ...f, max: e.target.value }))} className="h-9" />
          </div>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void addRule()} className="rounded-xl">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" />{tr('Ajouter ce prix')}</>}
      </Button>

      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <Input placeholder={tr('Nouveau type d\'article (ex. Montre)')} value={newType} onChange={e => setNewType(e.target.value)} className="h-9" />
        <Button type="button" variant="ghost" size="sm" onClick={() => void addType()} className="shrink-0 rounded-xl">{tr('Créer le type')}</Button>
      </div>
    </div>
  )
}
