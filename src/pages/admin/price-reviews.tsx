import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'
import { money } from '@/lib/currency'
import { Button } from '@/components/ui/button'

interface Review {
  id: string
  old_usd: number | null
  new_usd: number | null
  old_htg: number | null
  new_htg: number | null
  promos: Array<{ min_qty: number; unit_usd: number }>
  products: { name: string } | null
}

/** Supplier price changes above 15 % wait here for the admin: accepting applies them, refusing keeps the shop's price. */
export function PriceReviews({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<Review[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('price_sync_log')
      .select('id, old_usd, new_usd, old_htg, new_htg, promos, products(name)')
      .eq('status', 'review').is('resolved_at', null).order('checked_at', { ascending: false }).limit(50)
    setRows((data ?? []) as unknown as Review[])
  }, [])
  useEffect(() => { void load() }, [load])

  async function answer(id: string, accept: boolean) {
    setBusy(id)
    const { error } = await supabase.rpc('admin_resolve_price_review', { p_log: id, p_accept: accept })
    setBusy(null)
    if (error) { toast.error(error.message); return }
    toast.success(accept ? tr('Nouveau prix appliqué.') : tr('Prix actuel conservé.'))
    await load()
    onChanged()
  }

  if (rows.length === 0) return null
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4" aria-label={tr('Prix à valider')}>
      <h2 className="text-sm font-bold text-amber-900">{tr('{0} changement(s) de prix à valider', rows.length)}</h2>
      <p className="mb-3 text-xs text-amber-900/80">{tr('Le fournisseur a changé son prix de plus de 15 % : rien n\'est modifié tant que vous n\'avez pas répondu.')}</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.products?.name ?? '—'}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <span>{r.old_usd != null ? `${r.old_usd.toFixed(2)} $` : '—'}</span><ArrowRight className="h-3 w-3" aria-hidden /><span className="font-bold text-foreground">{r.new_usd?.toFixed(2)} $</span>
                <span aria-hidden>·</span>
                <span>{r.old_htg != null ? money(r.old_htg) : '—'}</span><ArrowRight className="h-3 w-3" aria-hidden /><span className="font-bold text-foreground">{r.new_htg != null ? money(r.new_htg) : '—'}</span>
              </p>
              {r.promos.length > 0 && (
                <p className="text-xs text-muted-foreground">{tr('Offres lues : ')}{r.promos.map((p) => `${p.min_qty}+ → ${p.unit_usd.toFixed(2)} $`).join(' · ')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void answer(r.id, false)} className="gap-1 rounded-xl"><X className="h-4 w-4" />{tr('Refuser')}</Button>
              <Button size="sm" disabled={busy === r.id} onClick={() => void answer(r.id, true)} className="gap-1 rounded-xl">
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{tr('Accepter')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
