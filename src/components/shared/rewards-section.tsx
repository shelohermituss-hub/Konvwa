import { useCallback, useEffect, useState } from 'react'
import { Award, Check, Copy, Loader2, MessageCircle, Ticket, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { tr } from '@/lib/i18n'
import { tierProgress, type Loyalty } from '@/lib/loyalty'
import { money } from '@/lib/currency'

interface Stats { invited: number; rewarded: number; hasReferrer: boolean }

export function RewardsSection() {
  const { user } = useAuth()
  const [code, setCode] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({ invited: 0, rewarded: 0, hasReferrer: true })
  const [friendCode, setFriendCode] = useState('')
  const [promo, setPromo] = useState('')
  const [busy, setBusy] = useState<'friend' | 'promo' | null>(null)
  const [copied, setCopied] = useState(false)
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: mine }, { data: asReferrer }, { data: asReferee }] = await Promise.all([
      supabase.rpc('my_referral_code'),
      supabase.from('referrals').select('rewarded_at').eq('referrer_id', user.id),
      supabase.from('referrals').select('referee_id').eq('referee_id', user.id).maybeSingle(),
    ])
    setCode((mine as string | null) ?? null)
    const list = (asReferrer ?? []) as Array<{ rewarded_at: string | null }>
    setStats({ invited: list.length, rewarded: list.filter((r) => r.rewarded_at).length, hasReferrer: !!asReferee })
  }, [user])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void supabase.rpc('my_loyalty').then(({ data }) => setLoyalty((data as Loyalty | null) ?? null)) }, [])

  const link = code ? `${window.location.origin}/auth?ref=${code}` : ''

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function whatsapp() {
    const text = tr('Rejoins KONVWA et importe depuis Alibaba, Shein et Temu. Utilise mon code {0} : {1}', code ?? '', link)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  async function applyFriend() {
    setBusy('friend')
    const { data, error } = await supabase.rpc('apply_referral', { p_code: friendCode })
    setBusy(null)
    const r = data as { success?: boolean; error?: string } | null
    if (error || !r?.success) { toast.error(r?.error ?? error?.message ?? tr('Action impossible.')); return }
    toast.success(tr('Code enregistré. Le bonus sera crédité à votre premier paiement.'))
    setFriendCode('')
    await load()
  }

  async function redeem() {
    setBusy('promo')
    const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: promo })
    setBusy(null)
    const r = data as { success?: boolean; error?: string; credited?: number } | null
    if (error || !r?.success) { toast.error(r?.error ?? error?.message ?? tr('Action impossible.')); return }
    toast.success(tr('{0} ajoutés à votre portefeuille.', money(r.credited ?? 0)))
    setPromo('')
  }

  const tierName = (t: Loyalty['tier']) => (t === 'gold' ? tr('Or') : t === 'silver' ? tr('Argent') : tr('Bronze'))

  return (
    <div className="space-y-5 p-5">
      {loyalty && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Award className="h-4 w-4 text-primary" aria-hidden="true" />{tr('Niveau fidélité : {0}', tierName(loyalty.tier))}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loyalty.discount_pct > 0
              ? tr('{0} % de remise sur nos frais de service, appliquée à vos devis.', loyalty.discount_pct)
              : tr('Dès {0} commandes payées : {1} % de remise sur nos frais de service (puis {2} % dès {3}).', loyalty.silver_at, loyalty.silver_pct, loyalty.gold_pct, loyalty.gold_at)}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={tierProgress(loyalty)} aria-valuemin={0} aria-valuemax={100} aria-label={tr('Progression vers le niveau suivant')}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${tierProgress(loyalty)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {loyalty.next_at
              ? tr('{0} commande(s) payée(s) · encore {1} pour le niveau suivant', loyalty.orders, Math.max(0, loyalty.next_at - loyalty.orders))
              : tr('{0} commande(s) payée(s) · niveau maximum atteint', loyalty.orders)}
          </p>
        </div>
      )}

      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />{tr('Parrainez vos amis')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tr('Votre ami et vous recevez chacun un bonus dans votre portefeuille dès son premier paiement éligible.')}
        </p>
        {code ? (
          <>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <span className="flex-1 font-mono text-lg font-bold tracking-widest">{code}</span>
              <button onClick={() => void copy()} aria-label={tr('Copier le lien')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white">
                {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
              </button>
              <button onClick={whatsapp} aria-label={tr('Partager sur WhatsApp')} className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-700 hover:bg-white">
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {tr('{0} ami(s) invité(s) · {1} bonus reçu(s)', stats.invited, stats.rewarded)}
            </p>
          </>
        ) : (
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted/50" />
        )}
      </div>

      {!stats.hasReferrer && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{tr('Vous avez un code de parrainage ?')}</p>
          <div className="flex gap-2">
            <Input value={friendCode} onChange={(e) => setFriendCode(e.target.value.toUpperCase())} maxLength={12} placeholder="ABCD1234" className="h-11 rounded-xl font-mono uppercase" />
            <Button onClick={() => void applyFriend()} disabled={busy === 'friend' || friendCode.trim().length < 4} className="h-11 rounded-xl">
              {busy === 'friend' ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Valider')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-border/50 pt-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Ticket className="h-4 w-4 text-primary" />{tr('Code promo')}</p>
        <div className="flex gap-2">
          <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} maxLength={32} placeholder={tr('Votre code')} className="h-11 rounded-xl font-mono uppercase" />
          <Button onClick={() => void redeem()} disabled={busy === 'promo' || promo.trim().length < 3} className="h-11 rounded-xl">
            {busy === 'promo' ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Utiliser')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{tr('Le montant du code est ajouté directement à votre portefeuille.')}</p>
      </div>
    </div>
  )
}
