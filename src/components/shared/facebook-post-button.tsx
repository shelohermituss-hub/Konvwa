import { useState } from 'react'
import { ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { CARD_STYLES, renderProductCard } from '@/lib/facebook-card'
import { deleteFacebookPost, postProductToSocial, type SocialPost, type SocialTarget } from '@/lib/facebook-api'
import { discountPct, strikePrice } from '@/lib/product-pricing'
import { tr } from '@/lib/i18n'

/** Only pictures stored by us can be drawn on the card (CORS) and sent to Facebook / Instagram. */
const OURS = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\//
/** Instagram takes JPEG only: the product photos that are not JPEG stay on Facebook only. */
const JPEG = /\.jpe?g$/i

interface Props {
  product: {
    id: string; name: string; price_htg: number; discount_pct?: number | null; images: string[]
    delivery_days_min: number | null; delivery_days_max: number | null; supplier_verified: boolean; active: boolean
  }
}

/** Admin: one click makes a visual card of the saved product and posts it, with a written caption and the link, on the shop's Facebook Page and Instagram. */
export function FacebookPostButton({ product }: Props) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [posted, setPosted] = useState<SocialPost | null>(null)
  const [removing, setRemoving] = useState(false)
  const [style, setStyle] = useState('auto')
  const [targets, setTargets] = useState<Record<SocialTarget, boolean>>({ facebook: true, instagram: true })
  const chosen = (Object.keys(targets) as SocialTarget[]).filter((t) => targets[t])

  async function run() {
    if (!user || chosen.length === 0) return
    setBusy(true); setPosted(null)
    try {
      setStep(tr('Création du visuel…'))
      const pct = discountPct(product)
      const photos = product.images.filter((u) => OURS.test(u))
      if (photos.length === 0) throw new Error(tr('Ajoutez au moins une photo du produit enregistrée sur KONVWA.'))
      const card = await renderProductCard({
        name: product.name, priceHtg: product.price_htg, strikeHtg: pct ? strikePrice(product.price_htg, pct) : null, discountPct: pct || null,
        images: photos, deliveryMin: product.delivery_days_min, deliveryMax: product.delivery_days_max, verified: product.supplier_verified,
        style: style === 'auto' ? undefined : Number(style),
      })
      const path = `${user.id}/fb-card-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, card, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw new Error(upErr.message)
      const cardUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      setStep(tr('Publication…'))
      const extra = photos.filter((u) => chosen.includes('facebook') || JPEG.test(u)).slice(0, 3)
      const res = await postProductToSocial(product.id, [cardUrl, ...extra], chosen)
      setPosted(res)
      const failed = Object.values(res.errors).filter(Boolean)
      if (failed.length === 0) toast.success(tr('Publié.'))
      else toast.warning(failed.join(' — '), { duration: 15000 })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'), { duration: 15000 })
    } finally {
      setBusy(false); setStep('')
    }
  }

  async function undo() {
    if (!posted?.post_id) return
    setRemoving(true)
    try {
      await deleteFacebookPost(posted.post_id)
      setPosted((p) => (p ? { ...p, post_id: undefined, url: undefined } : p))
      toast.success(tr('Publication Facebook supprimée.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="col-span-2 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-sm font-semibold">{tr('Publier sur Facebook et Instagram')}</p>
      <p className="text-xs text-muted-foreground">
        {product.active
          ? tr('Crée un visuel pro (photos, prix, livraison) et le publie avec un texte accrocheur et le lien du produit, en un clic. Les modifications non enregistrées ne sont pas prises en compte.')
          : tr('Publiez d\'abord le produit sur le site : le lien de la publication doit mener à une page visible.')}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(['facebook', 'instagram'] as const).map((t) => (
          <label key={t} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded" checked={targets[t]} disabled={busy} onChange={(e) => setTargets((cur) => ({ ...cur, [t]: e.target.checked }))} />
            {t === 'facebook' ? 'Facebook' : 'Instagram'}
          </label>
        ))}
        <NativeSelect value={style} onChange={(e) => setStyle(e.target.value)} disabled={busy} size="sm" aria-label={tr('Style du visuel')}>
          <NativeSelectOption value="auto">{tr('Style : au hasard')}</NativeSelectOption>
          {CARD_STYLES.map((n, k) => <NativeSelectOption key={n} value={String(k)}>{tr('Style')} : {tr(n)}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void run()} disabled={busy || !product.active || chosen.length === 0} className="gap-1.5 rounded-xl bg-[#1877F2] text-white hover:bg-[#1668d6]">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? step : tr('Publier')}
        </Button>
        {posted?.url && (
          <>
            <a href={posted.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />{tr('Voir sur Facebook')}
            </a>
            <Button type="button" size="sm" variant="outline" onClick={() => void undo()} disabled={removing} className="gap-1.5 rounded-xl text-destructive">
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{tr('Supprimer le post Facebook')}
            </Button>
          </>
        )}
        {posted?.instagram && (posted.instagram.url
          ? <a href={posted.instagram.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ExternalLink className="h-4 w-4" />{tr('Voir sur Instagram')}</a>
          : <span className="text-sm font-medium text-emerald-700">{tr('Publié sur Instagram')}</span>)}
      </div>
      {posted?.instagram && <p className="text-xs text-muted-foreground">{tr('Instagram ne permet pas de supprimer une publication depuis le site : supprimez-la dans l\'application.')}</p>}
      {posted && <p className="whitespace-pre-line rounded-xl bg-white p-2.5 text-xs text-muted-foreground">{posted.caption}</p>}
    </div>
  )
}
