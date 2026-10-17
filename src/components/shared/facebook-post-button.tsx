import { useState } from 'react'
import { ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { renderProductCard } from '@/lib/facebook-card'
import { deleteFacebookPost, postProductToFacebook, type FacebookPost } from '@/lib/facebook-api'
import { discountPct, strikePrice } from '@/lib/product-pricing'
import { tr } from '@/lib/i18n'

/** Only pictures stored by us can be drawn on the card (CORS) and sent to Facebook. */
const OURS = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\//

interface Props {
  product: {
    id: string; name: string; price_htg: number; discount_pct?: number | null; images: string[]
    delivery_days_min: number | null; delivery_days_max: number | null; supplier_verified: boolean; active: boolean
  }
}

/** Admin: one click makes a visual card of the saved product and posts it, with a written caption and the link, on the shop's Facebook Page. */
export function FacebookPostButton({ product }: Props) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [posted, setPosted] = useState<FacebookPost | null>(null)
  const [removing, setRemoving] = useState(false)

  async function run() {
    if (!user) return
    setBusy(true); setPosted(null)
    try {
      setStep(tr('Création du visuel…'))
      const pct = discountPct(product)
      const photos = product.images.filter((u) => OURS.test(u))
      if (photos.length === 0) throw new Error(tr('Ajoutez au moins une photo du produit enregistrée sur KONVWA.'))
      const card = await renderProductCard({
        name: product.name, priceHtg: product.price_htg, strikeHtg: pct ? strikePrice(product.price_htg, pct) : null, discountPct: pct || null,
        images: photos, deliveryMin: product.delivery_days_min, deliveryMax: product.delivery_days_max, verified: product.supplier_verified,
      })
      const path = `${user.id}/fb-card-${Date.now()}.png`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, card, { contentType: 'image/png', upsert: false })
      if (upErr) throw new Error(upErr.message)
      const cardUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      setStep(tr('Publication sur Facebook…'))
      const res = await postProductToFacebook(product.id, [cardUrl, ...photos.slice(0, 3)])
      setPosted(res)
      toast.success(tr('Publié sur Facebook.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'))
    } finally {
      setBusy(false); setStep('')
    }
  }

  async function undo() {
    if (!posted) return
    setRemoving(true)
    try {
      await deleteFacebookPost(posted.post_id)
      setPosted(null)
      toast.success(tr('Publication supprimée.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="col-span-2 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-sm font-semibold">{tr('Publier sur Facebook')}</p>
      <p className="text-xs text-muted-foreground">
        {product.active
          ? tr('Crée un visuel pro (photos, prix, livraison) et le publie sur la page avec un texte accrocheur et le lien du produit, en un clic. Les modifications non enregistrées ne sont pas prises en compte.')
          : tr('Publiez d\'abord le produit sur le site : le lien de la publication doit mener à une page visible.')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void run()} disabled={busy || !product.active} className="gap-1.5 rounded-xl bg-[#1877F2] text-white hover:bg-[#1668d6]">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? step : tr('Publier sur Facebook')}
        </Button>
        {posted && (
          <>
            <a href={posted.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />{tr('Voir la publication')}
            </a>
            <Button type="button" size="sm" variant="outline" onClick={() => void undo()} disabled={removing} className="gap-1.5 rounded-xl text-destructive">
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{tr('Supprimer le post')}
            </Button>
          </>
        )}
      </div>
      {posted && <p className="whitespace-pre-line rounded-xl bg-white p-2.5 text-xs text-muted-foreground">{posted.caption}</p>}
    </div>
  )
}
