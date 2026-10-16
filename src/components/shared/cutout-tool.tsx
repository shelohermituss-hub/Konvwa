import { useState } from 'react'
import { Loader2, Scissors, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

/** Only pictures stored by us can be read in the browser (CORS) and are worth replacing. */
const OURS = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\//

/**
 * Admin tool: removes the background of the product photos, on this device (free, open-source model).
 * `variantUrls` are the pictures of the variants, `galleryUrls` the whole gallery. Nothing is saved until the product is saved,
 * and the original files stay in storage.
 */
export function CutoutTool({ variantUrls, galleryUrls, onApply }: {
  variantUrls: string[]
  galleryUrls: string[]
  /** Replaces each picture address (old -> new) in the product form. */
  onApply: (map: Record<string, string>) => void
}) {
  const { user } = useAuth()
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; phase: 'model' | 'photos' } | null>(null)
  const [undo, setUndo] = useState<Record<string, string> | null>(null)

  const wanted = [...new Set([...variantUrls, ...(all ? galleryUrls : [])].filter((u) => OURS.test(u)))]
  const foreign = [...new Set([...variantUrls, ...(all ? galleryUrls : [])])].filter((u) => !!u && !OURS.test(u)).length

  async function run() {
    if (!user || wanted.length === 0) return
    setBusy(true); setUndo(null)
    setProgress({ done: 0, total: wanted.length, phase: 'model' })
    const done: Record<string, string> = {}
    let failed = 0
    try {
      const { removeBackground } = await import('@/lib/cutout')
      for (let i = 0; i < wanted.length; i++) {
        setProgress({ done: i, total: wanted.length, phase: i === 0 ? 'model' : 'photos' })
        try {
          const res = await fetch(wanted[i])
          if (!res.ok) throw new Error('fetch')
          const png = await removeBackground(await res.blob())
          const path = `${user.id}/cutout-${Date.now()}-${i}.png`
          const { error } = await supabase.storage.from('product-images').upload(path, png, { contentType: 'image/png', upsert: false })
          if (error) throw error
          done[wanted[i]] = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        } catch (e) {
          console.error('[cutout]', e)
          failed++
        }
      }
    } catch (e) {
      console.error('[cutout] load', e)
      toast.error(tr('Le modèle de détourage n\'a pas pu démarrer sur cet appareil. Essayez depuis un ordinateur récent.'))
      setBusy(false); setProgress(null)
      return
    }
    const n = Object.keys(done).length
    if (n > 0) {
      onApply(done)
      setUndo(Object.fromEntries(Object.entries(done).map(([old, now]) => [now, old])))
      toast.success(tr('{0} photos détourées : vérifiez le rendu puis enregistrez le produit.', n))
    }
    if (failed > 0) toast.warning(tr('{0} photos n\'ont pas pu être traitées.', failed))
    setBusy(false); setProgress(null)
  }

  return (
    <div className="col-span-2 space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy || wanted.length === 0} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
          {tr('Détourer les photos')}
        </Button>
        {undo && !busy && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { onApply(undo); setUndo(null) }} className="gap-1.5">
            <Undo2 className="h-4 w-4" />{tr('Rétablir les originales')}
          </Button>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={all} disabled={busy} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 rounded" />
          {tr('Toute la galerie (sinon : seulement les photos des variantes)')}
        </label>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {progress
          ? progress.phase === 'model' && progress.done === 0
            ? tr('Chargement du modèle (la première fois : environ 45 Mo)…')
            : tr('Photo {0} sur {1}…', progress.done + 1, progress.total)
          : tr('Gratuit : le fond est retiré sur votre appareil (quelques secondes par photo, mieux vaut un ordinateur). Les originales restent conservées ; rien n\'est changé tant que vous n\'enregistrez pas.')}
        {!progress && foreign > 0 && ` ${tr('{0} photos hébergées ailleurs seront ignorées.', foreign)}`}
      </p>
    </div>
  )
}
