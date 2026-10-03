import { useCallback, useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, LOCALE_TAG } from '@/lib/i18n'

interface Option { id: string; region_id: string; kind: 'pickup' | 'home'; label: string; details: string | null; price_htg: number; active: boolean }
interface Region { id: string; name: string }

/** Pickup points and home delivery by region. The price is shown to the customer before they order. */
export function AdminDeliveryOptionsPage() {
  const [options, setOptions] = useState<Option[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regionId, setRegionId] = useState('')
  const [kind, setKind] = useState<'pickup' | 'home'>('pickup')
  const [label, setLabel] = useState('')
  const [details, setDetails] = useState('')
  const [price, setPrice] = useState('0')

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      supabase.from('delivery_options').select('id, region_id, kind, label, details, price_htg, active').order('region_id').order('sort_order'),
      supabase.from('haiti_regions').select('id, name').order('sort_order'),
    ])
    setOptions((o.data ?? []) as Option[])
    setRegions((r.data ?? []) as Region[])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const p = Number(price)
    if (!regionId || label.trim().length < 2 || !(p >= 0)) { toast.error(tr('Région, libellé et prix valides requis.')); return }
    setSaving(true)
    const { error } = await supabase.from('delivery_options').insert({ region_id: regionId, kind, label: label.trim(), details: details.trim() || null, price_htg: p })
    setSaving(false)
    if (error) { toast.error(tr('Enregistrement impossible : {0}', error.message)); return }
    setLabel(''); setDetails(''); setPrice('0')
    void load()
  }
  async function toggle(o: Option) {
    const { error } = await supabase.from('delivery_options').update({ active: !o.active }).eq('id', o.id)
    if (error) toast.error(error.message); else void load()
  }
  async function remove(o: Option) {
    if (!window.confirm(tr('Supprimer « {0} » ?', o.label))) return
    const { error } = await supabase.from('delivery_options').delete().eq('id', o.id)
    if (error) toast.error(error.message); else void load()
  }

  const regionName = (id: string) => regions.find((r) => r.id === id)?.name ?? '—'

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><MapPin className="h-6 w-6" />{tr('Retrait et livraison')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Points de retrait et livraison à domicile par région. Le client voit le prix avant de commander.')}</p>
      </div>

      <form onSubmit={(e) => void add(e)} className="grid gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2">
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label={tr('Région')} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="">{tr('Région')}</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{tr(r.name)}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'pickup' | 'home')} aria-label={tr('Type')} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="pickup">{tr('Retrait')}</option>
          <option value="home">{tr('Livraison à domicile')}</option>
        </select>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr('Libellé (ex. Agence Delmas 33)')} aria-label={tr('Libellé')} className="rounded-xl" maxLength={120} />
        <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} aria-label={tr('Prix (HTG)')} className="rounded-xl" />
        <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder={tr('Détails (horaires, adresse…)')} aria-label={tr('Détails')} className="rounded-xl sm:col-span-2" maxLength={300} />
        <Button type="submit" disabled={saving} className="h-10 gap-2 rounded-xl sm:col-span-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{tr('Ajouter')}
        </Button>
      </form>

      {loading ? <Skeleton className="h-40 rounded-2xl" /> : options.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{tr('Aucune option pour le moment.')}</p>
      ) : (
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.id} className={cn('flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm', !o.active && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{o.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {tr(regionName(o.region_id))} · {o.kind === 'pickup' ? tr('Retrait') : tr('Livraison à domicile')} · {o.price_htg.toLocaleString(LOCALE_TAG)} HTG
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void toggle(o)}>{o.active ? tr('Désactiver') : tr('Activer')}</Button>
              <Button type="button" variant="ghost" size="icon" aria-label={tr('Supprimer')} onClick={() => void remove(o)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
