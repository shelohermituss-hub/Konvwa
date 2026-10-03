import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, EyeOff, ImagePlus, Loader2, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Review {
  id: string
  author_name: string
  rating: number
  comment: string
  photos: string[]
  hidden: boolean
  created_at: string
}

const MAX_PHOTOS = 3
const MAX_BYTES = 5 * 1024 * 1024

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={tr('{0} sur 5', value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
      ))}
    </span>
  )
}

export function ProductReviews({ productId }: { productId: string }) {
  const { user, isAdmin } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{ purchased: boolean; reviewed: boolean }>({ purchased: false, reviewed: false })
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [{ data }, { data: st }] = await Promise.all([
      supabase.from('product_reviews').select('id, author_name, rating, comment, photos, hidden, created_at')
        .eq('product_id', productId).order('created_at', { ascending: false }).limit(30),
      supabase.rpc('product_review_status', { p_product_id: productId }),
    ])
    setReviews((data ?? []) as Review[])
    if (st) setStatus(st as { purchased: boolean; reviewed: boolean })
    setLoading(false)
  }, [productId])

  useEffect(() => { void load() }, [load])

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) { toast.error(tr('Seules les images sont acceptées.')); continue }
      if (f.size > MAX_BYTES) { toast.error(tr('Image trop lourde (max 5 Mo).')); continue }
      if (next.length < MAX_PHOTOS) next.push(f)
    }
    setFiles(next)
  }

  async function submit() {
    if (!user) return
    setBusy(true)
    try {
      const paths: string[] = []
      for (const f of files) {
        const ext = (f.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
        const path = `${user.id}/review-${Date.now()}-${paths.length}.${ext}`
        const { error } = await supabase.storage.from('product-images').upload(path, f, { contentType: f.type, upsert: false })
        if (error) throw new Error(error.message)
        paths.push(path)
      }
      // the database checks the purchase; photo paths must live in the user's own folder
      const { data, error } = await supabase.rpc('submit_review', { p_product_id: productId, p_rating: rating, p_comment: comment, p_photos: paths })
      const result = data as { success?: boolean; error?: string } | null
      if (error || !result?.success) throw new Error(result?.error ?? error?.message ?? tr('Envoi impossible.'))
      toast.success(tr('Merci pour votre avis !'))
      setOpen(false); setComment(''); setFiles([]); setRating(5)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Envoi impossible.'))
    } finally {
      setBusy(false)
    }
  }

  async function hide(r: Review) {
    const { data } = await supabase.rpc('admin_set_review_hidden', { p_review_id: r.id, p_hidden: !r.hidden })
    if ((data as { success?: boolean } | null)?.success) await load()
  }

  const visible = reviews.filter((r) => !r.hidden)
  const average = visible.length ? visible.reduce((s, r) => s + r.rating, 0) / visible.length : 0
  const photoUrl = (p: string) => (p.startsWith('http') ? p : supabase.storage.from('product-images').getPublicUrl(p).data.publicUrl)

  return (
    <section id="section-reviews" className="scroll-mt-28 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">{tr('Avis clients')}</h2>
        {visible.length > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <Stars value={average} />
            <span className="font-bold">{average.toFixed(1)}</span>
            <span className="text-muted-foreground">({visible.length})</span>
          </span>
        )}
      </div>

      {!loading && status.purchased && !open && (
        <Button variant="outline" onClick={() => setOpen(true)} className="mb-3 h-11 w-full rounded-xl">
          {status.reviewed ? tr('Modifier mon avis') : tr('Donner mon avis')}
        </Button>
      )}

      {open && (
        <div className="mb-4 space-y-3 rounded-xl bg-muted/40 p-3">
          <div className="flex items-center gap-1" role="radiogroup" aria-label={tr('Note')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={tr('{0} sur 5', n)} onClick={() => setRating(n)} className="p-1">
                <Star className={cn('h-7 w-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder={tr('Racontez votre expérience avec ce produit (qualité, délai, conformité)…')} className="rounded-xl bg-white" />
          <div className="flex flex-wrap items-center gap-2">
            {files.map((f, i) => (
              <span key={i} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <button type="button" aria-label={tr('Retirer la photo')} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-white"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {files.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-muted-foreground" aria-label={tr('Ajouter une photo')}>
                <ImagePlus className="h-5 w-5" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={() => void submit()} disabled={busy} className="flex-1 rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Publier mon avis')}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status.purchased ? tr('Soyez le premier à donner votre avis.') : tr('Aucun avis pour le moment. Seuls les clients ayant acheté ce produit peuvent en laisser.')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {reviews.map((r) => (
            <li key={r.id} className={cn('py-3', r.hidden && 'opacity-50')}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{r.author_name}</span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-sky-700"><BadgeCheck className="h-3 w-3" aria-hidden />{tr('Achat vérifié')}</span>
                </span>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={r.created_at}>
                  {new Date(r.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
                </time>
              </div>
              <Stars value={r.rating} size="h-3.5 w-3.5" />
              {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.comment}</p>}
              {r.photos.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {r.photos.map((p) => <a key={p} href={photoUrl(p)} target="_blank" rel="noopener noreferrer"><img src={photoUrl(p)} alt={tr('Photo de l\'avis')} loading="lazy" className="h-16 w-16 rounded-lg object-cover" /></a>)}
                </div>
              )}
              {isAdmin && (
                <button type="button" onClick={() => void hide(r)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  <EyeOff className="h-3 w-3" />{r.hidden ? tr('Réafficher') : tr('Masquer')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
