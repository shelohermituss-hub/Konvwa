import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImageOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { tr, LOCALE_TAG, trServer } from '@/lib/i18n'

const BUCKET = 'package-photos'
const MAX_BYTES = 8 * 1024 * 1024

type Photo = { id: string; path: string; caption: string | null; created_at: string; url?: string }

/** Photos taken at the warehouse. Private bucket: images are shown through short-lived signed URLs. */
export function PackagePhotos({ requestId, canUpload = false, hideWhenEmpty = false }: {
  requestId: string
  canUpload?: boolean
  hideWhenEmpty?: boolean
}) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Photo | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('package_photos')
      .select('id, path, caption, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as Photo[]
    if (rows.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600)
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
      rows.forEach((r) => { r.url = byPath.get(r.path) ?? undefined })
    }
    setPhotos(rows)
    setLoading(false)
  }, [requestId])

  useEffect(() => { void load() }, [load])

  async function onFiles(files: FileList | null) {
    const file = files?.[0]
    if (input.current) input.current.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast.error(tr('Format accepté : JPG, PNG ou WebP.')); return }
    if (file.size > MAX_BYTES) { toast.error(tr('Photo trop lourde (8 Mo maximum).')); return }
    setBusy(true)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${requestId}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(false); toast.error(tr('Envoi impossible : {0}', up.error.message)); return }
    const { data, error } = await supabase.rpc('admin_add_package_photo', { p_request_id: requestId, p_path: path, p_caption: null })
    setBusy(false)
    if (error || !data?.success) {
      await supabase.storage.from(BUCKET).remove([path])
      toast.error(trServer(data?.error ?? error?.message ?? 'Erreur'))
      return
    }
    toast.success(tr('Photo ajoutée — le client est prévenu.'))
    void load()
  }

  if (loading) return null
  if (hideWhenEmpty && !photos.length && !canUpload) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
          {tr('Photos du colis à l\'entrepôt')}
        </h3>
        {canUpload && (
          <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
              className="sr-only" aria-label={tr('Ajouter une photo')} onChange={(e) => void onFiles(e.target.files)} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/20 px-3 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {tr('Ajouter une photo')}
            </button>
          </>
        )}
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr('Aucune photo pour le moment.')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} className="block aspect-square w-full overflow-hidden rounded-xl bg-gray-100"
                aria-label={tr('Agrandir la photo du {0}', new Date(p.created_at).toLocaleDateString(LOCALE_TAG))}>
                {p.url
                  ? <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <ImageOff className="m-auto h-5 w-5 text-gray-400" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open?.url && (
        <div role="dialog" aria-modal="true" aria-label={tr('Photo du colis')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <img src={open.url} alt={tr('Photo du colis')} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
