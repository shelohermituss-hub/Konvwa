import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Check, CheckCircle2, Copy, ExternalLink, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Send, Trash2, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SocialPosterEditor, KIND_LABEL, formOf, type PosterForm } from '@/components/shared/social-poster-editor'
import { SocialProposeDialog } from '@/components/shared/social-propose-dialog'
import { WhatsAppShareMenu } from '@/components/shared/whatsapp-share-menu'
import { renderInfoCard } from '@/lib/facebook-card'
import { supabase } from '@/lib/supabase'
import { assetThumbPath } from '@/lib/social-assets'
import { CALENDAR_COLUMNS, HAITI_ZONE, infoInputOf, plainHeadline, toHaitiInput, type CalendarDraft, type CalendarKind, type CalendarRow, type CalendarStatus } from '@/lib/social-calendar'
import { cn } from '@/lib/utils'
import { LOCALE_TAG, tr } from '@/lib/i18n'

type Filter = 'proposed' | 'approved' | 'posted' | 'failed' | 'rejected' | 'all'

const STATUS: Record<CalendarStatus, { label: () => string; cls: string }> = {
  proposed: { label: () => tr('À valider'), cls: 'bg-amber-100 text-amber-800' },
  approved: { label: () => tr('Validée'), cls: 'bg-emerald-100 text-emerald-800' },
  posting: { label: () => tr('Publication…'), cls: 'bg-sky-100 text-sky-800' },
  posted: { label: () => tr('Publiée'), cls: 'bg-gray-100 text-gray-700' },
  failed: { label: () => tr('Échec'), cls: 'bg-red-100 text-red-800' },
  rejected: { label: () => tr('Refusée'), cls: 'bg-gray-100 text-gray-500' },
}
const KIND_CLS: Record<CalendarKind, string> = {
  event: 'bg-violet-100 text-violet-800', explainer: 'bg-sky-100 text-sky-800', news: 'bg-teal-100 text-teal-800', promo: 'bg-orange-100 text-orange-800',
}

const when = (iso: string) => new Intl.DateTimeFormat(LOCALE_TAG, { timeZone: HAITI_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const monthOf = (iso: string) => new Intl.DateTimeFormat(LOCALE_TAG, { timeZone: HAITI_ZONE, month: 'long', year: 'numeric' }).format(new Date(iso))
const isPast = (r: CalendarRow) => new Date(r.scheduled_at).getTime() < Date.now()

/**
 * Admin: the editorial calendar. Proposed posters (events of the year, explainers, news, promos) are read, edited and validated one by one or all at once; the
 * validated ones are published by a job at their date (Haiti time), in addition to the daily product posters. A poster can also be shared on WhatsApp.
 */
export function SocialCalendarPanel() {
  const [rows, setRows] = useState<CalendarRow[] | null>(null)
  const [filter, setFilter] = useState<Filter | null>(null)
  const [editing, setEditing] = useState<CalendarRow | null>(null)
  const [initial, setInitial] = useState<PosterForm | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => Promise<void> } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('social_calendar').select(CALENDAR_COLUMNS).order('scheduled_at', { ascending: true }).limit(500)
    if (error) { toast.error(error.message); setRows((cur) => cur ?? []); return }
    setRows((data ?? []) as unknown as CalendarRow[])
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30000)
    return () => clearInterval(t)
  }, [load])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { proposed: 0, approved: 0, posted: 0, failed: 0, rejected: 0, all: 0 }
    for (const r of rows ?? []) { c.all++; if (r.status === 'posting') c.approved++; else c[r.status]++ }
    return c
  }, [rows])
  // opens on what needs the admin: the proposals, else what is planned, else everything
  const current: Filter = filter ?? (counts.proposed > 0 ? 'proposed' : counts.approved > 0 ? 'approved' : 'all')
  const shown = useMemo(
    () => (rows ?? []).filter((r) => (current === 'all' ? true : current === 'approved' ? r.status === 'approved' || r.status === 'posting' : r.status === current)),
    [rows, current],
  )
  const groups = useMemo(() => {
    const out: Array<{ month: string; items: CalendarRow[] }> = []
    // what is to come first, what is done most recent first
    const list = current === 'posted' || current === 'failed' ? [...shown].reverse() : shown
    for (const r of list) {
      const m = monthOf(r.scheduled_at)
      if (out.length === 0 || out[out.length - 1].month !== m) out.push({ month: m, items: [] })
      out[out.length - 1].items.push(r)
    }
    return out
  }, [shown, current])

  async function setStatus(ids: string[], status: 'approved' | 'rejected' | 'proposed', from: CalendarStatus[]) {
    const { error } = await supabase.from('social_calendar').update({ status }).in('id', ids).in('status', from)
    if (error) { toast.error(error.message); return false }
    await load()
    return true
  }

  async function approve(list: CalendarRow[]) {
    const future = list.filter((r) => !isPast(r))
    const past = list.length - future.length
    if (future.length > 0 && await setStatus(future.map((r) => r.id), 'approved', ['proposed', 'failed', 'rejected'])) {
      toast.success(future.length === 1 ? tr('Affiche validée : elle sera publiée à la date prévue.') : tr('{0} affiches validées : elles seront publiées aux dates prévues.', future.length))
    }
    if (past > 0) toast.info(tr('{0} affiche(s) dont la date est passée n\'ont pas été validées : changez leur date ou publiez-les maintenant.', past), { duration: 9000 })
  }

  async function remove(ids: string[]) {
    const { error } = await supabase.from('social_calendar').delete().in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(ids.length === 1 ? tr('Affiche supprimée.') : tr('{0} affiches supprimées.', ids.length))
    await load()
  }

  async function publishNow(r: CalendarRow) {
    setBusyId(r.id)
    const { data, error } = await supabase.rpc('admin_social_publish_now', { p_id: r.id })
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    if (data === 'sent') toast.success(tr('L\'affiche est en cours de publication (environ une minute).'))
    else toast.info(tr('Cette affiche ne peut plus être publiée.'))
    setTimeout(() => void load(), 4000)
    await load()
  }

  async function save(value: Omit<CalendarDraft, 'batch'>, approve: boolean) {
    if (approve && new Date(value.scheduled_at).getTime() < Date.now()) {
      toast.error(tr('La date est passée : choisissez une date à venir, ou enregistrez puis publiez maintenant.'))
      return
    }
    setSaving(true)
    const { error } = editing
      ? await supabase.from('social_calendar').update({ ...value, status: approve ? 'approved' : editing.status === 'failed' ? 'proposed' : editing.status }).eq('id', editing.id)
      : await supabase.from('social_calendar').insert({ ...value, status: approve ? 'approved' : 'proposed' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(approve ? tr('Affiche enregistrée et validée.') : tr('Affiche enregistrée.'))
    setEditorOpen(false)
    await load()
  }

  const edit = (r: CalendarRow | null, form: PosterForm | null = null) => { setEditing(r); setInitial(form); setEditorOpen(true) }
  const duplicate = (r: CalendarRow) => {
    const f = formOf(r)
    edit(null, { ...f, when: toHaitiInput(new Date(Date.now() + 86400000).toISOString()).slice(0, 10) + f.when.slice(10) })
  }
  const ask = (title: string, text: string, run: () => Promise<void>) => setConfirm({ title, text, run })

  const FILTERS: Array<[Filter, string]> = [['proposed', tr('À valider')], ['approved', tr('Validées')], ['posted', tr('Publiées')], ['failed', tr('Échecs')], ['rejected', tr('Refusées')], ['all', tr('Tout')]]
  const proposed = (rows ?? []).filter((r) => r.status === 'proposed')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          {tr('Planifiez des mois d\'affiches : fêtes, explications, nouveautés, promos. Elles sont publiées en plus des affiches de produits, à la date que vous validez (heure d\'Haïti).')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => edit(null)} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" />{tr('Nouvelle affiche')}</Button>
          <Button type="button" onClick={() => setProposeOpen(true)} className="gap-1.5 rounded-xl"><CalendarPlus className="h-4 w-4" />{tr('Proposer un calendrier')}</Button>
        </div>
      </div>

      {proposed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">{tr('{0} affiches attendent votre validation.', proposed.length)}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => ask(tr('Valider les {0} affiches ?', proposed.length), tr('Elles seront publiées automatiquement à leur date. Vous pourrez encore les modifier ou les retirer avant.'), () => approve(proposed))} className="gap-1.5 rounded-xl">
              <Check className="h-4 w-4" />{tr('Tout valider')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => ask(tr('Refuser les {0} affiches ?', proposed.length), tr('Elles ne seront pas publiées. Vous pourrez les remettre à valider plus tard.'), async () => { if (await setStatus(proposed.map((r) => r.id), 'rejected', ['proposed'])) toast.success(tr('Affiches refusées.')) })} className="rounded-xl">
              {tr('Tout refuser')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr('Filtrer les affiches')}>
        {FILTERS.map(([id, label]) => (
          <button
            key={id} type="button" role="tab" aria-selected={current === id} onClick={() => setFilter(id)}
            className={cn('rounded-full border px-3 py-1.5 text-sm transition-colors', current === id ? 'border-primary bg-primary text-primary-foreground' : 'border-gray-200 bg-white hover:bg-gray-50')}
          >
            {label} <span className={cn('tabular-nums', current === id ? 'opacity-80' : 'text-muted-foreground')}>{counts[id]}</span>
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <CalendarPlus className="h-9 w-9 text-muted-foreground/40" />
          <p className="text-sm font-medium">{counts.all === 0 ? tr('Le calendrier est vide.') : tr('Aucune affiche dans cette liste.')}</p>
          {counts.all === 0 && <Button type="button" onClick={() => setProposeOpen(true)} className="rounded-xl">{tr('Proposer un calendrier')}</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.month} aria-label={g.month}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.month}</h3>
              <ul className="space-y-2">
                {g.items.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-gray-100 bg-white p-3 sm:flex-nowrap">
                    <button type="button" onClick={() => edit(r)} className="hidden h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-100 sm:block" aria-label={tr('Voir l\'affiche')} tabIndex={-1}>
                      {r.asset && <img src={assetThumbPath(r.asset)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </button>
                    <div className="w-full shrink-0 text-xs sm:w-28">
                      <p className="font-semibold capitalize">{when(r.scheduled_at)}</p>
                      {r.status !== 'posted' && isPast(r) && r.status !== 'posting' && <p className="text-amber-700">{tr('Date passée')}</p>}
                    </div>
                    <div className="min-w-0 flex-1 basis-full sm:basis-0">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className={cn('text-[10px]', KIND_CLS[r.kind])}>{KIND_LABEL[r.kind]()}</Badge>
                        <Badge variant="secondary" className={cn('gap-1 text-[10px]', STATUS[r.status].cls)}>
                          {r.status === 'posting' && <Loader2 className="h-3 w-3 animate-spin" />}{STATUS[r.status].label()}
                        </Badge>
                        {r.targets.map((t) => <span key={t} className="text-[10px] text-muted-foreground">{t === 'facebook' ? 'Facebook' : 'Instagram'}</span>)}
                      </div>
                      <button type="button" onClick={() => edit(r)} className="block w-full text-left">
                        <span className="line-clamp-2 text-sm font-semibold sm:line-clamp-1">{plainHeadline(r.headline)}</span>
                        {r.subline && <span className="line-clamp-1 text-xs text-muted-foreground">{r.subline}</span>}
                      </button>
                      {r.error && (r.status === 'failed' || r.status === 'posted') && <p className="mt-1 line-clamp-2 text-xs text-destructive">{r.error}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {r.status === 'proposed' && (
                        <>
                          <Button type="button" size="sm" onClick={() => void approve([r])} className="gap-1 rounded-xl"><Check className="h-4 w-4" />{tr('Valider')}</Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => void setStatus([r.id], 'rejected', ['proposed'])} className="h-8 w-8 rounded-xl text-muted-foreground" aria-label={tr('Refuser')} title={tr('Refuser')}><X className="h-4 w-4" /></Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <Button type="button" size="sm" variant="outline" disabled={busyId === r.id} onClick={() => ask(tr('Publier maintenant ?'), tr('L\'affiche sera publiée tout de suite sur {0}.', r.targets.map((t) => (t === 'facebook' ? 'Facebook' : 'Instagram')).join(' + ')), () => publishNow(r))} className="gap-1 rounded-xl">
                          {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{tr('Publier maintenant')}
                        </Button>
                      )}
                      {r.status === 'failed' && (
                        <Button type="button" size="sm" variant="outline" disabled={busyId === r.id} onClick={() => void publishNow(r)} className="gap-1 rounded-xl">
                          {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}{tr('Réessayer')}
                        </Button>
                      )}
                      {r.status === 'rejected' && (
                        <Button type="button" size="sm" variant="outline" onClick={() => void setStatus([r.id], 'proposed', ['rejected'])} className="gap-1 rounded-xl"><Undo2 className="h-4 w-4" />{tr('Remettre à valider')}</Button>
                      )}
                      {r.status === 'posted' && r.facebook_post_id && (
                        <a href={`https://www.facebook.com/${r.facebook_post_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-medium text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />{tr('Voir')}
                        </a>
                      )}
                      {r.status === 'posted' && !r.facebook_post_id && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label={tr('Publiée')} />}
                      <WhatsAppShareMenu iconOnly build={async () => ({ text: r.caption, image: await renderInfoCard(infoInputOf(r), r.asset), filename: 'konvwa-affiche.jpg' })} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" aria-label={tr('Plus d\'actions')}><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => edit(r)}><Pencil className="mr-2 h-4 w-4" />{r.status === 'posted' || r.status === 'posting' ? tr('Voir l\'affiche') : tr('Modifier')}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => duplicate(r)}><Copy className="mr-2 h-4 w-4" />{tr('Dupliquer')}</DropdownMenuItem>
                          {r.status === 'approved' && <DropdownMenuItem onSelect={() => void setStatus([r.id], 'proposed', ['approved'])}><Undo2 className="mr-2 h-4 w-4" />{tr('Retirer de la programmation')}</DropdownMenuItem>}
                          {r.status !== 'posted' && r.status !== 'posting' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => ask(tr('Supprimer cette affiche ?'), tr('Elle sera retirée du calendrier.'), () => remove([r.id]))} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />{tr('Supprimer')}</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <SocialPosterEditor open={editorOpen} row={editing} initial={initial} saving={saving} onClose={() => setEditorOpen(false)} onSave={(v, a) => void save(v, a)} />
      <SocialProposeDialog open={proposeOpen} existing={(rows ?? []).filter((r) => r.status !== 'rejected')} onClose={() => setProposeOpen(false)} onAdded={() => { setFilter('proposed'); void load() }} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const run = confirm?.run; setConfirm(null); void run?.() }}>{tr('Confirmer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
