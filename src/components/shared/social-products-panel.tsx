import { useEffect, useState } from 'react'
import { Loader2, Package, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FacebookPostButton } from '@/components/shared/facebook-post-button'
import { WhatsAppShareMenu } from '@/components/shared/whatsapp-share-menu'
import { getProductCaption } from '@/lib/facebook-api'
import { buildProductCard, cardFileName } from '@/lib/product-card'
import { moneyAmount } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

interface P {
  id: string; name: string; price_htg: number; discount_pct: number | null; images: string[]; delivery_days_min: number | null; delivery_days_max: number | null
  supplier_verified: boolean; supplier_name: string | null; active: boolean
}
const COLUMNS = 'id, name, price_htg, discount_pct, images, delivery_days_min, delivery_days_max, supplier_verified, supplier_name, active'

/**
 * Admin: posts a chosen product by hand on Facebook / Instagram (the visual card and its caption), or shares it on WhatsApp. The daily automatic posts
 * choose a product on their own; this is for the products the team wants to push right now.
 */
export function SocialProductsPanel() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<P[] | null>(null)
  const [open, setOpen] = useState<P | null>(null)

  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      let query = supabase.from('products').select(COLUMNS).eq('active', true).order('created_at', { ascending: false }).limit(24)
      // the characters that have a meaning in a filter are dropped: the search is plain words
      const word = q.trim().replace(/[%,()*\\]/g, ' ').trim()
      if (word) query = query.ilike('name', `%${word}%`)
      void query.then(({ data }) => { if (alive) setRows((data ?? []) as P[]) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-sm text-muted-foreground">
        {tr('Choisissez un produit à mettre en avant : le site crée son affiche et la publie sur Facebook et Instagram, ou vous la partagez sur WhatsApp.')}
      </p>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Rechercher un produit…')} className="pl-9" aria-label={tr('Rechercher un produit…')} />
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{tr('Chargement…')}</div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-muted-foreground">{tr('Aucun produit actif trouvé.')}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground/30" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                <p className="text-xs font-bold text-primary">{moneyAmount(p.price_htg)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(p)} className="rounded-xl">{tr('Publier…')}</Button>
                <WhatsAppShareMenu
                  iconOnly
                  build={async () => {
                    const { card } = await buildProductCard(p)
                    return { text: await getProductCaption(p.id), image: card, filename: cardFileName(p.name) }
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="line-clamp-2">{open?.name}</DialogTitle>
            <DialogDescription>{tr('Le visuel et le texte sont créés automatiquement.')}</DialogDescription>
          </DialogHeader>
          {open && <div className="grid"><FacebookPostButton product={open} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
