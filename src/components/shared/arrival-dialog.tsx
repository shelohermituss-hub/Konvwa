import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { tr, trServer } from '@/lib/i18n'

export interface ArrivalTarget {
  kind: 'order' | 'product_order'
  id: string
  label: string
  weight_kg?: number | null
  cbm?: number | null
}

/**
 * The team confirms that the order is available at the warehouse and enters the real weight / volume. The customer is notified,
 * picks a shipping method (fees computed from these measures and the rate grid) and pays.
 */
export function ArrivalDialog({ target, onClose, onDone }: { target: ArrivalTarget | null; onClose: () => void; onDone: () => void }) {
  const [kg, setKg] = useState('')
  const [cbm, setCbm] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('product_rate_categories').select('slug, name').eq('active', true).order('sort_order').then(({ data }) => {
      const list = (data ?? []) as Array<{ slug: string; name: string }>
      setCategories(list)
      setCategory((v) => v || list[0]?.slug || 'generic')
    })
  }, [])
  useEffect(() => {
    setKg(target?.weight_kg ? String(target.weight_kg) : '')
    setCbm(target?.cbm ? String(target.cbm) : '')
  }, [target])

  async function confirm() {
    if (!target) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_order_arrived', {
      p_kind: target.kind, p_id: target.id, p_kg: Number(kg) || 0, p_cbm: Number(cbm) || 0, p_category_slug: category || 'generic',
    })
    setBusy(false)
    if (error || !data?.success) { toast.error(trServer((data?.error as string | undefined) ?? error?.message ?? 'Erreur')); return }
    toast.success(tr('Le client est prévenu : il choisit son mode d\'expédition et paie.'))
    onDone()
    onClose()
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr('Disponible à l\'entrepôt')}</DialogTitle>
          <DialogDescription>
            {target?.label} — {tr('Saisissez le poids ou le volume réel : les frais d\'expédition du client en sont calculés automatiquement.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="arr-kg" className="text-sm font-semibold">{tr('Poids réel (kg)')}</label>
              <Input id="arr-kg" type="number" min={0} step="0.01" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="arr-cbm" className="text-sm font-semibold">{tr('Volume réel (CBM)')}</label>
              <Input id="arr-cbm" type="number" min={0} step="0.001" inputMode="decimal" value={cbm} onChange={(e) => setCbm(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="arr-cat" className="text-sm font-semibold">{tr('Type de produits (tarif)')}</label>
            <select id="arr-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              {categories.map((c) => <option key={c.slug} value={c.slug}>{tr(c.name)}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>{tr('Annuler')}</Button>
          <Button className="rounded-xl" disabled={busy || (!(Number(kg) > 0) && !(Number(cbm) > 0))} onClick={() => void confirm()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Prévenir le client')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
