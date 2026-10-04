import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Megaphone, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AdCard, AD_COLUMNS, adMediaUrl, type Ad } from '@/components/shared/ad-banners'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

const MAX_IMAGE = 5 * 1024 * 1024
const MAX_VIDEO = 30 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'

interface Form {
  eyebrow: string; eyebrow_en: string
  title: string; title_en: string
  subtitle: string; subtitle_en: string
  link_url: string
  sort_order: string
  starts_at: string; ends_at: string
  active: boolean
}
const EMPTY: Form = { eyebrow: '', eyebrow_en: '', title: '', title_en: '', subtitle: '', subtitle_en: '', link_url: '', sort_order: '0', starts_at: '', ends_at: '', active: true }

// <input type="datetime-local"> works in local time, the database stores UTC
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

function status(ad: Ad): { label: string; ok: boolean } {
  const now = Date.now()
  if (!ad.active) return { label: tr('Désactivée'), ok: false }
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return { label: tr('Programmée'), ok: false }
  if (ad.ends_at && new Date(ad.ends_at).getTime() <= now) return { label: tr('Terminée'), ok: false }
  return { label: tr('En ligne'), ok: true }
}

export function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Ad | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [removeMedia, setRemoveMedia] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ad_banners').select(AD_COLUMNS).order('sort_order', { ascending: true }).order('created_at', { ascending: false })
    setAds((data ?? []) as Ad[])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview) }, [filePreview])

  function openNew() {
    setEditing(null); setForm({ ...EMPTY, sort_order: String(ads.length ? Math.max(...ads.map((a) => a.sort_order)) + 1 : 0) })
    setFile(null); setRemoveMedia(false); setOpen(true)
  }
  function openEdit(ad: Ad) {
    setEditing(ad)
    setForm({
      eyebrow: ad.eyebrow ?? '', eyebrow_en: ad.eyebrow_en ?? '', title: ad.title, title_en: ad.title_en ?? '',
      subtitle: ad.subtitle ?? '', subtitle_en: ad.subtitle_en ?? '', link_url: ad.link_url ?? '',
      sort_order: String(ad.sort_order), starts_at: toLocalInput(ad.starts_at), ends_at: toLocalInput(ad.ends_at), active: ad.active,
    })
    setFile(null); setRemoveMedia(false); setOpen(true)
  }

  function pickFile(f: File | undefined) {
    if (!f) return
    const isVideo = f.type.startsWith('video/')
    if (!ACCEPT.split(',').includes(f.type)) { toast.error(tr('Format non pris en charge (JPG, PNG, WebP, GIF, MP4 ou WebM).')); return }
    if (f.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) { toast.error(isVideo ? tr('Vidéo trop lourde (max 30 Mo).') : tr('Image trop lourde (max 5 Mo).')); return }
    setFile(f); setRemoveMedia(false)
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const nz = (v: string) => (v.trim() ? v.trim() : null)

  async function save() {
    const link = form.link_url.trim()
    if (!form.title.trim()) { toast.error(tr('Le titre est requis.')); return }
    if (link && !/^(https:\/\/\S+|\/[A-Za-z0-9/_?=&#.%-]*)$/.test(link)) { toast.error(tr('Le lien doit commencer par https:// ou par / (page de l\'application).')); return }
    const starts = fromLocalInput(form.starts_at); const ends = fromLocalInput(form.ends_at)
    if (starts && ends && new Date(ends) <= new Date(starts)) { toast.error(tr('La date de fin doit suivre la date de début.')); return }
    setSaving(true)
    let media_path = editing?.media_path ?? null
    let media_type: 'image' | 'video' = editing?.media_type ?? 'image'
    const oldPath = media_path
    if (file) {
      const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('ads').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
      if (upErr) { console.error('ads upload', upErr); setSaving(false); toast.error(tr('Envoi du fichier impossible.'), { description: upErr.message }); return }
      media_path = path; media_type = file.type.startsWith('video/') ? 'video' : 'image'
    } else if (removeMedia) { media_path = null; media_type = 'image' }

    const row = {
      eyebrow: nz(form.eyebrow), eyebrow_en: nz(form.eyebrow_en), title: form.title.trim(), title_en: nz(form.title_en),
      subtitle: nz(form.subtitle), subtitle_en: nz(form.subtitle_en), link_url: nz(link),
      sort_order: Number.isFinite(Number(form.sort_order)) ? Math.trunc(Number(form.sort_order)) : 0,
      starts_at: starts, ends_at: ends, active: form.active, media_path, media_type,
    }
    const { error } = editing
      ? await supabase.from('ad_banners').update(row).eq('id', editing.id)
      : await supabase.from('ad_banners').insert(row)
    if (error) {
      if (file && media_path) await supabase.storage.from('ads').remove([media_path])
      console.error('ads save', error); setSaving(false); toast.error(tr('Enregistrement impossible.'), { description: error.message }); return
    }
    if (oldPath && oldPath !== media_path) await supabase.storage.from('ads').remove([oldPath])
    setSaving(false); setOpen(false)
    toast.success(editing ? tr('Publicité mise à jour.') : tr('Publicité créée.'))
    await load()
  }

  async function toggle(ad: Ad) {
    const { error } = await supabase.from('ad_banners').update({ active: !ad.active }).eq('id', ad.id)
    if (error) { toast.error(tr('Action impossible.')); return }
    await load()
  }

  async function remove(ad: Ad) {
    if (!window.confirm(tr('Supprimer « {0} » ?', ad.title))) return
    const { error } = await supabase.from('ad_banners').delete().eq('id', ad.id)
    if (error) { toast.error(tr('Suppression impossible.')); return }
    if (ad.media_path) await supabase.storage.from('ads').remove([ad.media_path])
    toast.success(tr('Publicité supprimée.'))
    await load()
  }

  const previewAd: Ad = {
    id: 'preview', eyebrow: nz(form.eyebrow), eyebrow_en: null, title: form.title || tr('Titre de la publicité'), title_en: null,
    subtitle: nz(form.subtitle), subtitle_en: null,
    media_type: file ? (file.type.startsWith('video/') ? 'video' : 'image') : (editing?.media_type ?? 'image'),
    media_path: removeMedia ? null : editing?.media_path ?? null, link_url: null, active: true, sort_order: 0, starts_at: null, ends_at: null,
  }
  const previewSrc = file ? filePreview : removeMedia ? null : undefined
  const hasMedia = !!file || (!!editing?.media_path && !removeMedia)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Publicités')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tr('Cartes affichées sur l\'accueil des clients, sous les boutiques : image ou vidéo, titre, lien et période de diffusion.')}</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" />{tr('Nouvelle publicité')}</Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}</div>
      ) : ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">{tr('Aucune publicité')}</p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ads.map((ad) => {
            const st = status(ad)
            return (
              <li key={ad.id} className="space-y-2">
                <div className="pointer-events-none"><AdCard ad={{ ...ad, link_url: null }} mediaSrc={adMediaUrl(ad.media_path)} /></div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
                  <div className="text-xs text-muted-foreground">
                    <span className={cn('mr-2 rounded-full px-2.5 py-1 font-semibold', st.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground')}>{st.label}</span>
                    #{ad.sort_order}
                    {ad.ends_at ? ` · ${tr('jusqu\'au')} ${new Date(ad.ends_at).toLocaleDateString(DATE_LOCALE)}` : ''}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={ad.active} onCheckedChange={() => void toggle(ad)} aria-label={tr('Activer')} />
                    <Button variant="outline" size="icon" onClick={() => openEdit(ad)} aria-label={tr('Modifier')} className="h-8 w-8 rounded-xl"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="icon" onClick={() => void remove(ad)} aria-label={tr('Supprimer')} className="h-8 w-8 rounded-xl text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o) }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? tr('Modifier la publicité') : tr('Nouvelle publicité')}</DialogTitle>
            <DialogDescription>{tr('Ce que voient vos clients apparaît à droite.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{tr('Image ou vidéo')}</Label>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5 rounded-xl">
                    {file?.type.startsWith('video/') ? <Video className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                    {hasMedia ? tr('Remplacer le fichier') : tr('Choisir un fichier')}
                  </Button>
                  {hasMedia && <Button type="button" variant="ghost" onClick={() => { setFile(null); setRemoveMedia(true) }} className="rounded-xl text-destructive">{tr('Retirer')}</Button>}
                </div>
                <p className="text-xs text-muted-foreground">{tr('Format paysage 4:3 conseillé. Image : 5 Mo max. Vidéo MP4 ou WebM : 30 Mo max (lue en boucle, sans son).')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>{tr('Petit titre (optionnel)')}</Label><Input value={form.eyebrow} onChange={set('eyebrow')} maxLength={60} placeholder={tr('NOUVEAU SUR KONVWA')} className="rounded-xl" /></div>
                <div className="space-y-1.5"><Label>{tr('Ordre d\'affichage')}</Label><Input value={form.sort_order} onChange={set('sort_order')} inputMode="numeric" className="rounded-xl" /></div>
              </div>
              <div className="space-y-1.5"><Label>{tr('Titre')} *</Label><Input value={form.title} onChange={set('title')} maxLength={120} className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>{tr('Texte (optionnel)')}</Label><Input value={form.subtitle} onChange={set('subtitle')} maxLength={200} className="rounded-xl" /></div>
              <details className="rounded-xl border border-gray-100 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">{tr('Version anglaise (optionnel)')}</summary>
                <div className="mt-3 space-y-3">
                  <Input value={form.eyebrow_en} onChange={set('eyebrow_en')} maxLength={60} placeholder="Label" className="rounded-xl" aria-label="Label (EN)" />
                  <Input value={form.title_en} onChange={set('title_en')} maxLength={120} placeholder="Title" className="rounded-xl" aria-label="Title (EN)" />
                  <Input value={form.subtitle_en} onChange={set('subtitle_en')} maxLength={200} placeholder="Text" className="rounded-xl" aria-label="Text (EN)" />
                </div>
              </details>
              <div className="space-y-1.5">
                <Label>{tr('Lien au clic (optionnel)')}</Label>
                <Input value={form.link_url} onChange={set('link_url')} placeholder="https://… ou /products" className="rounded-xl" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>{tr('Début de diffusion')}</Label><Input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} className="rounded-xl" /></div>
                <div className="space-y-1.5"><Label>{tr('Fin de diffusion')}</Label><Input type="datetime-local" value={form.ends_at} onChange={set('ends_at')} className="rounded-xl" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />{tr('Publicité active')}</label>
            </div>
            <div className="pointer-events-none md:sticky md:top-0 md:self-start">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr('Aperçu')}</p>
              <AdCard ad={previewAd} mediaSrc={previewSrc} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="rounded-xl">{tr('Annuler')}</Button>
            <Button onClick={() => void save()} disabled={saving || !form.title.trim()} className="gap-1.5 rounded-xl">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{tr('Enregistrer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
