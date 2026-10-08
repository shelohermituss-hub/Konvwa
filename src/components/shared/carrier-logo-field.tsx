import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { CarrierLogo } from '@/components/shared/carrier-logo'
import { tr } from '@/lib/i18n'

const MAX_BYTES = 2 * 1024 * 1024

/** Admin field: the logo of the company that carries the parcel and gives the rate. The image goes to the public product-images bucket, its https address is kept in `value`. */
export function CarrierLogoField({ value, onChange, name }: { value: string; onChange: (url: string) => void; name: string }) {
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file || !user) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast.error(tr('Image JPG, PNG ou WebP seulement.')); return }
    if (file.size > MAX_BYTES) { toast.error(tr('Image trop lourde (max 2 Mo).')); return }
    setBusy(true)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${user.id}/carrier-logo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false })
    setBusy(false)
    if (error) { toast.error(tr('Envoi de l\'image impossible.')); return }
    onChange(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{tr('Logo de la compagnie (optionnel)')}</Label>
      <div className="flex items-center gap-3">
        {value ? <CarrierLogo src={value} name={name || tr('Logo')} className="h-12 w-20" /> : (
          <span className="flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-muted-foreground"><ImagePlus className="h-5 w-5" aria-hidden /></span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            {value ? tr('Changer le logo') : tr('Ajouter le logo')}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-sm text-destructive hover:bg-red-50">
              <X className="h-4 w-4" aria-hidden />{tr('Retirer')}
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <p className="text-xs text-muted-foreground">{tr('Affiché au client quand il choisit son mode d\'expédition. Fond clair conseillé.')}</p>
    </div>
  )
}
