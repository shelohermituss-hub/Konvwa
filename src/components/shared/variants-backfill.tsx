import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { importVariantsOnly } from '@/lib/product-import-api'
import { priceHtgFromUsd } from '@/lib/import-pricing'
import { variantsPayload, type VariantRow } from '@/components/shared/variants-editor'
import { tr } from '@/lib/i18n'

interface Target { id: string; name: string; source_url: string; price_htg: number }
type Outcome = { id: string; name: string; status: 'added' | 'none' | 'error'; detail: string }

/**
 * Adds the variants (size, colour…) to products that were imported before variants existed. One product at a time: its page is read again,
 * and only the variants are saved (the product sheet, price and pictures are never touched). A product with a single version stays as it is.
 */
export function VariantsBackfill({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [targets, setTargets] = useState<Target[] | null>(null)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState<Outcome[]>([])
  const stop = useRef(false)

  useEffect(() => {
    if (!open) return
    setDone([]); setTargets(null)
    void (async () => {
      const [{ data: products }, { data: withVariants }] = await Promise.all([
        supabase.from('products').select('id, name, source_url, price_htg').not('source_url', 'is', null).order('created_at', { ascending: false }),
        supabase.from('product_variants').select('product_id'),
      ])
      const has = new Set((withVariants ?? []).map((v: { product_id: string }) => v.product_id))
      setTargets(((products ?? []) as Target[]).filter((p) => p.source_url && /^https:\/\//i.test(p.source_url) && !has.has(p.id)))
    })()
  }, [open])

  async function run() {
    if (!targets) return
    stop.current = false; setRunning(true); setDone([])
    const { data: rows } = await supabase.from('app_settings').select('key, value').in('key', ['usd_to_htg_rate', 'service_margin_percent'])
    const get = (k: string, fallback: number) => { const v = Number(rows?.find((r: { key: string; value: string }) => r.key === k)?.value); return Number.isFinite(v) && v > 0 ? v : fallback }
    const rate = get('usd_to_htg_rate', 140)
    const margin = get('service_margin_percent', 15)
    for (const p of targets) {
      if (stop.current) break
      let out: Outcome
      try {
        const r = await importVariantsOnly(p.source_url)
        if (r.variants.length < 2) {
          out = { id: p.id, name: p.name, status: 'none', detail: tr('Une seule version trouvée') }
        } else {
          // same price rule as an import: USD x rate + margin; a variant without its own price keeps the product's current price
          const payload: VariantRow[] = r.variants.map((v) => ({
            group_name: v.group_name ?? '', label: v.label, label_en: v.label_en ?? '', image: v.image ?? '', stock_available: v.stock_available,
            price_htg: v.price_usd ? priceHtgFromUsd(v.price_usd, rate, margin) : p.price_htg,
          }))
          const { data: res, error } = await supabase.rpc('admin_save_product_variants', { p_product: p.id, p_variants: variantsPayload(payload) })
          out = error || !res?.success
            ? { id: p.id, name: p.name, status: 'error', detail: error?.message ?? res?.error ?? '' }
            : { id: p.id, name: p.name, status: 'added', detail: tr('{0} variantes ajoutées', r.variants.length) }
        }
      } catch (e) {
        out = { id: p.id, name: p.name, status: 'error', detail: e instanceof Error ? e.message : tr('Erreur réseau') }
      }
      setDone((d) => [...d, out])
    }
    setRunning(false)
    onDone()
  }

  const added = done.filter((d) => d.status === 'added').length
  const total = targets?.length ?? 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !running) onClose() }}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr('Récupérer les variantes manquantes')}</DialogTitle>
          <DialogDescription>
            {tr('Relit la page de chaque produit importé sans variantes et ajoute ses tailles, couleurs, etc. Le reste de la fiche (prix, images, textes) n\'est pas modifié. Gardez cette fenêtre ouverte.')}
          </DialogDescription>
        </DialogHeader>
        {targets === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /></div>
        ) : total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tr('Tous les produits importés ont déjà leurs variantes.')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium" aria-live="polite">{tr('{0} / {1} produits traités · {2} avec variantes', done.length, total, added)}</p>
              {running ? (
                <Button variant="outline" size="sm" onClick={() => { stop.current = true }} className="gap-1.5 rounded-xl"><Square className="h-3.5 w-3.5" aria-hidden />{tr('Arrêter')}</Button>
              ) : (
                <Button size="sm" onClick={() => void run()} className="gap-1.5 rounded-xl"><Play className="h-3.5 w-3.5" aria-hidden />{done.length > 0 ? tr('Reprendre') : tr('Lancer')}</Button>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length}>
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(done.length / total) * 100}%` }} />
            </div>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto text-xs">
              {done.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="min-w-0 truncate">{d.name}</span>
                  <span className={d.status === 'added' ? 'shrink-0 font-semibold text-emerald-600' : d.status === 'error' ? 'shrink-0 font-semibold text-destructive' : 'shrink-0 text-muted-foreground'}>{d.detail}</span>
                </li>
              ))}
              {running && <li className="flex items-center gap-2 px-3 py-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />{targets[done.length]?.name}</li>}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
