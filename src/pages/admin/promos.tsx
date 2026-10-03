import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE, LOCALE_TAG } from '@/lib/i18n'

interface Promo {
  code: string
  credit_htg: number
  max_uses: number
  used_count: number
  expires_at: string | null
  active: boolean
  created_at: string
}

export function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [credit, setCredit] = useState('')
  const [maxUses, setMaxUses] = useState('1')
  const [expires, setExpires] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(100)
    setPromos((data ?? []) as Promo[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function create() {
    const value = Number(credit)
    const uses = Number(maxUses)
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(uses) || uses <= 0) { toast.error(tr('Montant ou limite invalide.')); return }
    setSaving(true)
    const { error } = await supabase.from('promo_codes').insert({
      code: code.trim().toUpperCase(),
      credit_htg: value,
      max_uses: uses,
      expires_at: expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
    })
    setSaving(false)
    if (error) { toast.error(error.code === '23505' ? tr('Ce code existe déjà.') : tr('Création impossible (réservée aux administrateurs).')); return }
    toast.success(tr('Code créé.'))
    setCode(''); setCredit(''); setMaxUses('1'); setExpires('')
    await load()
  }

  async function toggle(p: Promo) {
    const { error } = await supabase.from('promo_codes').update({ active: !p.active }).eq('code', p.code)
    if (error) { toast.error(tr('Action impossible.')); return }
    await load()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tr('Codes promo')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Chaque code crédite directement le portefeuille du client, une seule fois par client.')}</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold">{tr('Nouveau code')}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={32} placeholder="BIENVENUE" className="rounded-xl font-mono uppercase" aria-label={tr('Code')} />
          <Input value={credit} onChange={(e) => setCredit(e.target.value)} inputMode="numeric" placeholder={tr('Montant (HTG)')} className="rounded-xl" aria-label={tr('Montant (HTG)')} />
          <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder={tr('Utilisations max')} className="rounded-xl" aria-label={tr('Utilisations max')} />
          <Input value={expires} onChange={(e) => setExpires(e.target.value)} type="date" className="rounded-xl" aria-label={tr('Expire le')} />
        </div>
        <Button onClick={() => void create()} disabled={saving || code.trim().length < 3 || !credit} className="mt-3 gap-1.5 rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{tr('Créer le code')}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : promos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">{tr('Aucun code promo')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {promos.map((p) => {
            const expired = !!p.expires_at && new Date(p.expires_at) < new Date()
            return (
              <li key={p.code} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="font-mono text-sm font-bold tracking-wider">{p.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.credit_htg.toLocaleString(LOCALE_TAG)} HTG · {tr('{0} / {1} utilisations', p.used_count, p.max_uses)}
                    {p.expires_at ? ` · ${tr('expire le')} ${new Date(p.expires_at).toLocaleDateString(DATE_LOCALE)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', p.active && !expired && p.used_count < p.max_uses ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                    {!p.active ? tr('Désactivé') : expired ? tr('Expiré') : p.used_count >= p.max_uses ? tr('Épuisé') : tr('Actif')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void toggle(p)} className="rounded-xl">{p.active ? tr('Désactiver') : tr('Activer')}</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
