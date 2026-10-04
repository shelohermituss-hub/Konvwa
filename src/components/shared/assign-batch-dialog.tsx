import { useEffect, useState } from 'react'
import { Loader2, Ship } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { shipmentStatusLabel } from '@/lib/cargo-tracking'
import { tr, trServer } from '@/lib/i18n'

export interface AssignTarget {
  kind: 'order' | 'product_order'
  id: string
  label: string
}

interface Batch { id: string; batch_code: string; status: string; vessel_info: string | null }

/** The team puts an order in an expedition / batch directly; the order then follows the batch. */
export function AssignBatchDialog({ target, onClose, onDone }: { target: AssignTarget | null; onClose: () => void; onDone: () => void }) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchId, setBatchId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) return
    void (async () => {
      const [b, r] = await Promise.all([
        supabase.from('shipments').select('id, batch_code, status, vessel_info').order('created_at', { ascending: false }),
        supabase.from(target.kind === 'order' ? 'orders' : 'product_orders').select('shipment_id').eq('id', target.id).maybeSingle(),
      ])
      setBatches((b.data ?? []) as Batch[])
      setBatchId(((r.data as { shipment_id: string | null } | null)?.shipment_id) ?? '')
    })()
  }, [target])

  async function save() {
    if (!target) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_assign_order_to_batch', { p_kind: target.kind, p_id: target.id, p_shipment_id: batchId || null })
    setBusy(false)
    if (error || !data?.success) { toast.error(trServer((data?.error as string | undefined) ?? error?.message ?? 'Erreur')); return }
    toast.success(batchId ? tr('Commande assignée à l\'expédition') : tr('Assignation retirée'))
    onDone()
    onClose()
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ship className="h-4 w-4" />{tr('Assigner à une expédition')}</DialogTitle>
          <DialogDescription>{target?.label} — {tr('La commande suivra le statut de l\'expédition choisie.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="assign-batch" className="text-sm font-semibold">{tr('Expédition (lot)')}</label>
          <select id="assign-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
            <option value="">{tr('— Aucune —')}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_code} · {shipmentStatusLabel(b.status)}{b.vessel_info ? ` · ${b.vessel_info}` : ''}</option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>{tr('Annuler')}</Button>
          <Button className="rounded-xl" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr('Enregistrer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
