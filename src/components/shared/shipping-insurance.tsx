import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { insuranceFeeHtg } from '@/lib/insurance'
import { useStepUp } from '@/lib/step-up'
import { Input } from '@/components/ui/input'
import { tr, trServer, LOCALE_TAG } from '@/lib/i18n'
import { money } from '@/lib/currency'

type Settings = { rate: number; min: number; max: number; usd: number }

export function ShippingInsurance({ requestId, insured, insuredValueUsd, feeHtg, onChange }: {
  requestId: string
  insured: boolean
  insuredValueUsd: number | null
  feeHtg: number | null
  onChange: () => void
}) {
  const { confirmPayment } = useStepUp()
  const [s, setS] = useState<Settings | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (insured) return
    void supabase.from('app_settings').select('key,value')
      .in('key', ['insurance_rate_percent', 'insurance_min_value_usd', 'insurance_max_value_usd', 'usd_to_htg_rate'])
      .then(({ data }) => {
        const m = Object.fromEntries((data ?? []).map((r) => [r.key, Number(r.value)]))
        setS({ rate: m.insurance_rate_percent ?? 3, min: m.insurance_min_value_usd ?? 100, max: m.insurance_max_value_usd ?? 5000, usd: m.usd_to_htg_rate ?? 140 })
      })
  }, [insured])

  if (insured) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <p className="text-sm text-emerald-800">
          {tr('Colis assuré — valeur déclarée {0} USD, prime {1}.', (insuredValueUsd ?? 0).toLocaleString(LOCALE_TAG), money(feeHtg ?? 0))}
        </p>
      </div>
    )
  }
  if (!s) return null

  const v = Number(value)
  const valid = v >= s.min && v <= s.max
  const fee = insuranceFeeHtg(v, s.rate, s.usd)

  async function buy() {
    if (!valid) return
    setBusy(true)
    if (!(await confirmPayment(fee))) { setBusy(false); return }
    const { data, error } = await supabase.rpc('buy_shipping_insurance', { p_request_id: requestId, p_value_usd: v })
    setBusy(false)
    if (error || !data?.success) { toast.error(trServer(data?.error ?? error?.message ?? 'Erreur')); return }
    toast.success(tr('Colis assuré.'))
    onChange()
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        {tr('Assurer mon colis (optionnel)')}
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {tr('Prime de {0} % de la valeur déclarée, payée avec votre portefeuille. Valeur entre {1} et {2} USD.', s.rate, s.min.toLocaleString(LOCALE_TAG), s.max.toLocaleString(LOCALE_TAG))}
      </p>
      <label htmlFor="ins-value" className="mb-1 block text-xs font-medium">{tr('Valeur déclarée (USD)')}</label>
      <div className="flex items-center gap-2">
        <Input id="ins-value" type="number" inputMode="decimal" min={s.min} max={s.max} value={value}
          onChange={(e) => setValue(e.target.value)} className="h-11 rounded-xl" />
        <button type="button" disabled={!valid || busy} onClick={() => void buy()}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {valid ? tr('Assurer — {0}', money(fee)) : tr('Assurer')}
        </button>
      </div>
    </div>
  )
}
