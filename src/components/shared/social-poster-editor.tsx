import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { WhatsAppShareMenu } from '@/components/shared/whatsapp-share-menu'
import { renderInfoCard } from '@/lib/facebook-card'
import { CALENDAR_KINDS, fromHaitiInput, infoInputOf, toHaitiInput, type CalendarDraft, type CalendarKind, type CalendarLayout, type CalendarRow, type SocialTarget } from '@/lib/social-calendar'
import { SOCIAL_ASSETS, assetThumbPath } from '@/lib/social-assets'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

export const KIND_LABEL: Record<CalendarKind, () => string> = {
  event: () => tr('Événement'), explainer: () => tr('Explicatif'), news: () => tr('Nouveauté'), promo: () => tr('Promo'),
}
const LAYOUTS: Array<{ id: CalendarLayout; label: () => string; help: () => string }> = [
  { id: 'photo', label: () => tr('Grande photo'), help: () => tr('Une photo en haut qui se fond dans le blanc : événements, explications, promos.') },
  { id: 'studio', label: () => tr('Produit sur fond clair'), help: () => tr('Un objet sur fond clair : nouveautés et bons plans.') },
]

/** The poster as the form edits it. */
export interface PosterForm {
  kind: CalendarKind
  layout: CalendarLayout
  /** The id of the stock photo, null for none. */
  asset: string | null
  badge: string
  headline: string
  subline: string
  /** Always four boxes; the empty ones are dropped when saving. */
  bullets: string[]
  caption: string
  targets: SocialTarget[]
  /** `datetime-local` value, Haiti time. */
  when: string
}

export const formOf = (r: CalendarRow | CalendarDraft): PosterForm => ({
  kind: r.kind, layout: r.layout, asset: r.asset, badge: r.badge ?? '', headline: r.headline, subline: r.subline ?? '',
  bullets: [...r.bullets, '', '', '', ''].slice(0, 4), caption: r.caption, targets: r.targets, when: toHaitiInput(r.scheduled_at),
})

/** A blank poster for tomorrow noon (Haiti). */
export function blankForm(): PosterForm {
  const tomorrow = toHaitiInput(new Date(Date.now() + 86400000).toISOString()).slice(0, 10)
  return { kind: 'news', layout: 'photo', asset: 'tote-bags', badge: '', headline: '', subline: '', bullets: ['', '', '', ''], caption: '', targets: ['facebook', 'instagram'], when: `${tomorrow}T12:00` }
}

/** What goes to the database (the fields of a calendar row), or the reason why the form cannot be saved. */
export function draftOf(f: PosterForm): { ok: true; value: Omit<CalendarDraft, 'batch'> } | { ok: false; error: string } {
  const headline = f.headline.trim(); const caption = f.caption.trim()
  if (headline.length < 3) return { ok: false, error: tr('Écrivez le titre de l\'affiche (3 caractères au moins).') }
  if (caption.length < 3) return { ok: false, error: tr('Écrivez le texte de la publication.') }
  if (f.targets.length === 0) return { ok: false, error: tr('Choisissez Facebook et/ou Instagram.') }
  const at = fromHaitiInput(f.when)
  if (!at) return { ok: false, error: tr('Choisissez la date et l\'heure de publication.') }
  return {
    ok: true,
    value: {
      kind: f.kind, layout: f.layout, asset: f.asset, badge: f.badge.trim() || null, headline, subline: f.subline.trim() || null,
      bullets: f.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 4), caption, targets: f.targets, scheduled_at: at,
    },
  }
}

/** The poster drawn for a form, redrawn a moment after each change. */
function usePreview(form: PosterForm, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef<string | null>(null)
  const key = JSON.stringify(infoInputOf({ ...form, badge: form.badge.trim() || null, subline: form.subline.trim() || null, bullets: form.bullets.map((b) => b.trim()).filter(Boolean) }))
  const asset = form.asset
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      const input = JSON.parse(key) as ReturnType<typeof infoInputOf>
      renderInfoCard({ ...input, headline: input.headline || tr('Votre titre ici') }, asset)
        .then((b) => {
          if (!alive) return
          const next = URL.createObjectURL(b)
          if (current.current) URL.revokeObjectURL(current.current)
          current.current = next
          setUrl(next)
        })
        .catch(() => {})
        .finally(() => { if (alive) setBusy(false) })
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [key, enabled, asset])
  useEffect(() => () => { if (current.current) URL.revokeObjectURL(current.current) }, [])
  return { url, busy }
}

interface Props {
  open: boolean
  /** The poster being edited, or null for a new one. */
  row: CalendarRow | null
  /** A starting point for a new poster (from "duplicate", for instance). */
  initial?: PosterForm | null
  saving: boolean
  onClose: () => void
  /** `approve`: the poster is validated at once. */
  onSave: (value: Omit<CalendarDraft, 'batch'>, approve: boolean) => void
}

/**
 * Admin: writes or edits one poster of the editorial calendar, with the poster drawn next to the form (the same drawing as the one published).
 * A poster that is already published, or being published, is only shown (and can be shared on WhatsApp).
 */
export function SocialPosterEditor({ open, row, initial, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<PosterForm>(blankForm)
  const [error, setError] = useState('')
  const locked = row?.status === 'posted' || row?.status === 'posting'
  useEffect(() => {
    if (!open) return
    setForm(row ? formOf(row) : initial ?? blankForm()); setError('')
  }, [open, row, initial])

  const preview = usePreview(form, open)
  const set = <K extends keyof PosterForm>(k: K, v: PosterForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleTarget = (t: SocialTarget) => set('targets', form.targets.includes(t) ? form.targets.filter((x) => x !== t) : [...form.targets, t])
  const captionLeft = useMemo(() => 2000 - form.caption.length, [form.caption])
  const photos = useMemo(() => SOCIAL_ASSETS.filter((a) => a.layouts.includes(form.layout)), [form.layout])
  // switching the layout keeps the photo when it suits the new one, else takes the first that does
  function pickLayout(layout: CalendarLayout) {
    setForm((f) => {
      const ok = f.asset ? SOCIAL_ASSETS.find((a) => a.id === f.asset)?.layouts.includes(layout) : true
      return { ...f, layout, asset: ok ? f.asset : SOCIAL_ASSETS.find((a) => a.layouts.includes(layout))?.id ?? null }
    })
  }

  function submit(approve: boolean) {
    const r = draftOf(form)
    if (!r.ok) { setError(r.error); return }
    setError('')
    onSave(r.value, approve)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{row ? (locked ? tr('Affiche') : tr('Modifier l\'affiche')) : tr('Nouvelle affiche')}</DialogTitle>
          <DialogDescription>{tr('L\'affiche est dessinée automatiquement à partir de ces textes. Vérifiez-la à droite avant de valider.')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          <fieldset disabled={locked || saving} className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-kind">{tr('Type')}</Label>
                <NativeSelect id="sp-kind" value={form.kind} onChange={(e) => set('kind', e.target.value as CalendarKind)}>
                  {CALENDAR_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{KIND_LABEL[k]()}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-when">{tr('Publication (heure d\'Haïti)')}</Label>
                <Input id="sp-when" type="datetime-local" value={form.when} onChange={(e) => set('when', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr('Présentation')}</Label>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tr('Présentation')}>
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id} type="button" role="radio" aria-checked={form.layout === l.id} onClick={() => pickLayout(l.id)}
                    className={cn('rounded-xl border px-3 py-2 text-left text-sm transition-colors', form.layout === l.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50')}
                  >
                    <span className="block font-semibold">{l.label()}</span>
                    <span className="block text-xs text-muted-foreground">{l.help()}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr('Photo')}</Label>
              <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-2 sm:grid-cols-5" role="radiogroup" aria-label={tr('Photo')}>
                <button
                  type="button" role="radio" aria-checked={form.asset === null} onClick={() => set('asset', null)}
                  className={cn('flex aspect-square items-center justify-center rounded-lg border bg-white px-1 text-center text-[11px] leading-tight text-muted-foreground transition-colors', form.asset === null ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:bg-gray-50')}
                >{tr('Sans photo')}</button>
                {photos.map((a) => (
                  <button
                    key={a.id} type="button" role="radio" aria-checked={form.asset === a.id} aria-label={tr(a.label)} title={tr(a.label)} onClick={() => set('asset', a.id)}
                    className={cn('aspect-square overflow-hidden rounded-lg border bg-white transition-shadow', form.asset === a.id ? 'border-primary ring-2 ring-primary/40' : 'border-gray-200 hover:ring-2 hover:ring-primary/20')}
                  >
                    <img src={assetThumbPath(a.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{tr('Photos libres de droits (Unsplash).')}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-badge">{tr('Étiquette (au-dessus du titre)')}</Label>
              <Input id="sp-badge" value={form.badge} maxLength={40} onChange={(e) => set('badge', e.target.value)} placeholder={tr('Nouveautés, Promo, Événement…')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-headline">{tr('Titre *')}</Label>
              <Textarea id="sp-headline" rows={2} value={form.headline} maxLength={120} onChange={(e) => set('headline', e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{tr('Entourez de *étoiles* les mots à écrire en orange.')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-subline">{tr('Phrase sous le titre')}</Label>
              <Textarea id="sp-subline" rows={2} value={form.subline} maxLength={200} onChange={(e) => set('subline', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{form.kind === 'explainer' ? tr('Étapes (jusqu\'à 4)') : tr('Points clés (jusqu\'à 4)')}</Label>
              {form.bullets.map((b, i) => (
                <Input key={i} value={b} maxLength={90} onChange={(e) => set('bullets', form.bullets.map((x, k) => (k === i ? e.target.value : x)))} aria-label={tr('Point {0}', i + 1)} placeholder={i === 0 ? tr('Un point par ligne, court') : ''} />
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="sp-caption">{tr('Texte de la publication *')}</Label>
                <span className={cn('text-xs tabular-nums', captionLeft < 100 ? 'text-amber-700' : 'text-muted-foreground')}>{captionLeft}</span>
              </div>
              <Textarea id="sp-caption" rows={8} value={form.caption} maxLength={2000} onChange={(e) => set('caption', e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-sm font-medium">{tr('Publier sur')}</span>
              {(['facebook', 'instagram'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded" checked={form.targets.includes(t)} onChange={() => toggleTarget(t)} />
                  {t === 'facebook' ? 'Facebook' : 'Instagram'}
                </label>
              ))}
            </div>
            {row?.status === 'failed' && row.error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{row.error}</p>}
            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          </fieldset>

          <div className="space-y-3">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
              {preview.url && <img src={preview.url} alt={tr('Aperçu de l\'affiche')} className={cn('h-full w-full object-cover transition-opacity duration-150', preview.busy && 'opacity-60')} />}
              {(preview.busy || !preview.url) && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={tr('Chargement…')} /></div>}
            </div>
            <WhatsAppShareMenu
              className="w-full justify-center"
              disabled={form.headline.trim().length < 3 || form.caption.trim().length < 3}
              build={async () => ({ text: form.caption.trim(), image: await renderInfoCard(infoInputOf({ ...form, badge: form.badge.trim() || null, subline: form.subline.trim() || null, bullets: form.bullets.map((b) => b.trim()).filter(Boolean) }), form.asset), filename: 'konvwa-affiche.jpg' })}
            />
          </div>
        </div>

        {!locked && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">{tr('Annuler')}</Button>
            <Button type="button" variant="outline" onClick={() => submit(false)} disabled={saving} className="rounded-xl">{tr('Enregistrer')}</Button>
            <Button type="button" onClick={() => submit(true)} disabled={saving} className="gap-1.5 rounded-xl">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{tr('Enregistrer et valider')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
