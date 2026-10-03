import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

interface Row { key: string; value: string; label: string; description: string | null }

const KEYS = [
  'staff_mfa_required',
  'mfa_payment_threshold_htg',
  'kyc_required_above_htg',
  'audit_alert_threshold_htg',
  'referral_reward_htg',
  'referral_min_payment_htg',
  'support_whatsapp',
  'insurance_rate_percent',
  'insurance_min_value_usd',
  'insurance_max_value_usd',
  'loyalty_silver_orders',
  'loyalty_gold_orders',
  'loyalty_silver_discount_pct',
  'loyalty_gold_discount_pct',
]

/** Security, rewards and support settings. The database only lets full admins change the critical ones. */
export function AdminSecuritySettings() {
  const [rows, setRows] = useState<Row[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value, label, description').in('key', KEYS)
    const list = ((data ?? []) as Row[]).sort((a, b) => KEYS.indexOf(a.key) - KEYS.indexOf(b.key))
    setRows(list)
    setValues(Object.fromEntries(list.map((r) => [r.key, r.value])))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const changed = rows.filter((r) => values[r.key] !== r.value)

  async function save() {
    setSaving(true)
    let failed = false
    for (const r of changed) {
      const { error } = await supabase.from('app_settings').update({ value: values[r.key], updated_at: new Date().toISOString() }).eq('key', r.key)
      if (error) failed = true
    }
    setSaving(false)
    if (failed) toast.error(tr('Certains réglages sont réservés aux administrateurs.'))
    else toast.success(tr('Réglages enregistrés.'))
    await load()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50"><ShieldCheck className="h-4 w-4 text-sky-600" /></div>
        <div>
          <p className="text-sm font-semibold">{tr('Sécurité, bonus et support')}</p>
          <p className="text-xs text-muted-foreground">{tr('MFA, seuils de confirmation, parrainage et contact WhatsApp')}</p>
        </div>
      </div>
      <div className="space-y-5 p-5">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : (
          <>
            {rows.map((r) => (
              <div key={r.key} className="space-y-1.5">
                {r.key === 'staff_mfa_required' ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor={r.key} className="text-sm font-semibold">{tr(r.label)}</Label>
                      {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{tr(r.description)}</p>}
                    </div>
                    <Switch id={r.key} checked={values[r.key] === 'true'} onCheckedChange={(v) => setValues((p) => ({ ...p, [r.key]: v ? 'true' : 'false' }))} />
                  </div>
                ) : (
                  <>
                    <Label htmlFor={r.key} className="text-sm font-semibold">{tr(r.label)}</Label>
                    {r.description && <p className="text-xs text-muted-foreground">{tr(r.description)}</p>}
                    <Input
                      id={r.key}
                      value={values[r.key] ?? ''}
                      onChange={(e) => setValues((p) => ({ ...p, [r.key]: r.key === 'support_whatsapp' ? e.target.value.replace(/\D/g, '') : e.target.value }))}
                      inputMode="numeric"
                      className="rounded-xl font-mono"
                    />
                  </>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={saving || changed.length === 0} className="gap-2 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr('Enregistrer')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
