import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plane, Ship, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useStepUp } from '@/lib/step-up'
import { cn } from '@/lib/utils'
import { tr, trServer, LOCALE_TAG } from '@/lib/i18n'

export type ShippableOrderKind = 'order' | 'product_order'

interface Option {
  rate_id: string
  name: string
  mode: string
  transit_days_min: number | null
  transit_days_max: number | null
  description: string | null
  amount_htg: number
}

interface OptionsResult {
  success: boolean
  ready?: boolean
  weight_kg?: number | null
  cbm?: number | null
  options?: Option[]
  error?: string
}

/**
 * The parcel is available at the warehouse: the customer picks a shipping method, the fees are computed by the database from
 * the real weight / volume entered by the team and the rate grid, then paid from the wallet. The browser never sends an amount.
 */
export function ShippingMethodPicker({ kind, orderId, balance, onPaid }: {
  kind: ShippableOrderKind
  orderId: string
  balance: number | null
  onPaid: () => void
}) {
  const { confirmPayment } = useStepUp()
  const [data, setData] = useState<OptionsResult | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    const { data: res } = await supabase.rpc('order_shipping_options', { p_kind: kind, p_id: orderId })
    const r = (res ?? { success: false }) as OptionsResult
    setData(r)
    setSelected((cur) => cur ?? r.options?.[0]?.rate_id ?? null)
  }, [kind, orderId])
  useEffect(() => { void load() }, [load])

  const chosen = data?.options?.find((o) => o.rate_id === selected) ?? null
  const short = chosen != null && balance != null && balance < chosen.amount_htg

  async function pay() {
    if (!chosen || paying) return
    if (!(await confirmPayment(chosen.amount_htg))) return
    setPaying(true)
    const { data: res, error } = await supabase.rpc('pay_order_shipping', { p_kind: kind, p_id: orderId, p_rate_id: chosen.rate_id })
    setPaying(false)
    if (error || !res?.success) {
      toast.error(res?.error ? trServer(res.error as string) : tr('Erreur de paiement'))
      return
    }
    toast.success(tr('Expédition payée — votre colis va partir'))
    onPaid()
  }

  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />
  if (!data.success || !data.ready) return null

  const options = data.options ?? []
  const measures = [
    data.weight_kg ? `${Number(data.weight_kg).toLocaleString(LOCALE_TAG)} kg` : null,
    data.cbm ? `${Number(data.cbm).toLocaleString(LOCALE_TAG)} CBM` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-white shadow-sm">
      <div className="flex items-start gap-3 bg-primary/8 px-4 pb-3 pt-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15"><Truck className="h-4 w-4 text-primary" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{tr('Votre commande est disponible à l\'entrepôt')}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{tr('Choisissez comment l\'expédier : les frais sont calculés directement.')}</p>
          {measures && <p className="mt-1 text-xs font-semibold text-foreground">{tr('Colis mesuré :')} {measures}</p>}
        </div>
      </div>

      {options.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{tr('Aucun mode d\'expédition disponible pour ce colis. Notre équipe vous contactera.')}</p>
      ) : (
        <div className="space-y-2 px-4 py-3" role="radiogroup" aria-label={tr('Mode d\'expédition')}>
          {options.map((o) => {
            const active = o.rate_id === selected
            const Icon = o.mode === 'air' ? Plane : Ship
            return (
              <button
                key={o.rate_id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(o.rate_id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/40')}
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500')}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {o.transit_days_min != null && o.transit_days_max != null ? tr('{0}–{1} jours', o.transit_days_min, o.transit_days_max) : (o.description ?? '')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-base font-black tabular-nums">{o.amount_htg.toLocaleString(LOCALE_TAG)}</span>
                  <span className="block text-[10px] text-muted-foreground">HTG</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {chosen && (
        <div className="space-y-2 border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{tr('Total à payer')}</span>
            <span className="text-lg font-black tabular-nums">{chosen.amount_htg.toLocaleString(LOCALE_TAG)} HTG</span>
          </div>
          {balance != null && (
            <p className={cn('text-xs', short ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              {tr('Solde du portefeuille : {0} HTG', balance.toLocaleString(LOCALE_TAG))}
            </p>
          )}
          {short ? (
            <Button asChild className="h-11 w-full rounded-xl font-bold"><Link to="/wallet">{tr('Recharger mon portefeuille')}</Link></Button>
          ) : (
            <Button onClick={() => void pay()} disabled={paying} className="h-11 w-full rounded-xl font-bold">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : tr('Payer l\'expédition')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
