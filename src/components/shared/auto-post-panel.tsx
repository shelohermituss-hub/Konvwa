import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Clock, Loader2, Plus, RefreshCw, Send, Shuffle, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'
import { MAX_SLOTS, normalizeTimes, parseTimes, spreadTimes } from '@/lib/autopost-schedule'
import { LOCALE_TAG, tr } from '@/lib/i18n'

const SETTING = 'auto_post_enabled'
const TIMES = 'auto_post_times'
const DEFAULT_TIMES = ['07:00', '10:00', '13:00', '16:00', '19:00']

interface Row { status: 'pending' | 'posted' | 'failed'; error: string | null; updated_at: string; local_day: string; products: { name: string } | null }

/** Day in Haiti (yyyy-mm-dd), the day the daily budget is counted on. */
const haitiDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(new Date())

/**
 * Admin: the automatic product posters. The switch, the times of the day (one poster per time, so the admin chooses how many a day and when, Haiti time)
 * and the latest results. The database decides what to post and when; this panel only edits the switch and the times, and shows what happened.
 */
export function AutoPostPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saved, setSaved] = useState<string[]>(DEFAULT_TIMES)
  const [times, setTimes] = useState<string[]>(DEFAULT_TIMES)
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [savingTimes, setSavingTimes] = useState(false)
  const [starting, setStarting] = useState(false)
  const [spread, setSpread] = useState({ count: '5', from: '07:00', to: '19:00' })

  const load = useCallback(async (keepEdits = false) => {
    const [s, r] = await Promise.all([
      supabase.from('app_settings').select('key, value').in('key', [SETTING, TIMES]),
      supabase.from('social_posts').select('status, error, updated_at, local_day, products(name)').eq('source', 'auto').order('updated_at', { ascending: false }).limit(20),
    ])
    const get = (k: string) => (s.data ?? []).find((x: { key: string; value: string }) => x.key === k)?.value
    setEnabled(get(SETTING) === 'true')
    const fromDb = parseTimes(get(TIMES))
    setSaved(fromDb)
    if (!keepEdits) setTimes(fromDb.length > 0 ? fromDb : DEFAULT_TIMES)
    setRows((r.data ?? []) as unknown as Row[])
  }, [])

  useEffect(() => {
    void load()
    // the results refresh by themselves; the times being edited are left alone
    const t = setInterval(() => void load(true), 30000)
    return () => clearInterval(t)
  }, [load])

  async function toggle(next: boolean) {
    setSaving(true)
    const { error } = await supabase.from('app_settings').update({ value: String(next), updated_at: new Date().toISOString() }).eq('key', SETTING)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setEnabled(next)
    toast.success(next ? tr('Publication automatique activée.') : tr('Publication automatique désactivée.'))
  }

  async function saveTimes() {
    const clean = normalizeTimes(times)
    if (clean.length === 0) { toast.error(tr('Choisissez au moins une heure de publication.')); return }
    setSavingTimes(true)
    const { data, error } = await supabase.rpc('admin_set_autopost_schedule', { p_times: clean })
    setSavingTimes(false)
    if (error) { toast.error(error.message); return }
    const next = parseTimes(String(data ?? ''))
    setSaved(next); setTimes(next)
    toast.success(tr('Heures enregistrées : {0} publications par jour.', next.length))
  }

  async function postNow() {
    setStarting(true)
    const { data, error } = await supabase.rpc('admin_autopost_now')
    setStarting(false)
    if (error) { toast.error(error.message); return }
    const msg: Record<string, string> = {
      sent: tr('Un poster est en cours de publication (environ une minute).'),
      busy: tr('Une publication est déjà en cours.'),
      nothing_to_post: tr('Tous les produits ont déjà leur affiche.'),
      no_secret: tr('Configuration incomplète : le secret de publication est manquant.'),
    }
    if (data === 'sent') toast.success(msg.sent); else toast.info(msg[String(data)] ?? String(data))
    setTimeout(() => void load(true), 4000)
  }

  const setTime = (i: number, v: string) => setTimes((cur) => cur.map((t, k) => (k === i ? v : t)))
  const dirty = normalizeTimes(times).join(',') !== saved.join(',') || times.some((t) => t.trim() === '')
  const today = haitiDay()
  const doneToday = rows.filter((r) => r.local_day === today).length
  const perDay = saved.length

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">{tr('Publication automatique des affiches')}</p>
            <p className="text-xs text-muted-foreground">
              {tr('{0} produits par jour, sur Facebook et Instagram. Un produit n\'est jamais publié deux fois.', perDay)}
              {enabled && ` · ${tr('Aujourd\'hui : {0} sur {1}', doneToday, perDay)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={starting} className="gap-1.5 rounded-xl">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{tr('Publier un poster maintenant')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tr('Publier un poster maintenant ?')}</AlertDialogTitle>
                <AlertDialogDescription>{tr('Un produit tiré au sort, qui n\'a pas encore d\'affiche, sera publié tout de suite sur Facebook et Instagram. Il compte dans les publications du jour.')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr('Annuler')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void postNow()}>{tr('Publier')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <label className="flex items-center gap-2 text-sm font-medium">
            {enabled === null || saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <Switch checked={enabled === true} disabled={enabled === null || saving} onCheckedChange={(v) => void toggle(v)} aria-label={tr('Activer la publication automatique')} />
            {enabled ? tr('Activée') : tr('Désactivée')}
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-gray-50/70 p-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-4 w-4 text-primary" aria-hidden />{tr('Heures de publication (heure d\'Haïti)')}</p>
          <p className="text-xs text-muted-foreground">{tr('Une affiche de produit est publiée à chaque heure. Ajoutez ou retirez des heures pour changer le nombre de publications par jour ({0} au maximum).', MAX_SLOTS)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {times.map((t, i) => (
            <div key={i} className="flex items-center rounded-xl border border-gray-200 bg-white pl-1 pr-0.5">
              <Input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} aria-label={tr('Heure {0}', i + 1)} className="h-9 w-[7.5rem] border-0 bg-transparent px-2 shadow-none focus-visible:ring-0" />
              <button
                type="button" disabled={times.length <= 1} onClick={() => setTimes((cur) => cur.filter((_, k) => k !== i))} aria-label={tr('Retirer cette heure')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
              ><X className="h-4 w-4" aria-hidden /></button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={times.length >= MAX_SLOTS} onClick={() => setTimes((cur) => [...cur, '12:00'])} className="h-9 gap-1 rounded-xl">
            <Plus className="h-4 w-4" />{tr('Ajouter une heure')}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-9 gap-1 rounded-xl text-muted-foreground"><Shuffle className="h-4 w-4" />{tr('Répartir sur la journée')}</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-3">
              <p className="text-xs text-muted-foreground">{tr('Remplit les heures de façon régulière entre la première et la dernière publication.')}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="sp-count" className="text-xs">{tr('Nombre')}</Label>
                  <Input id="sp-count" type="number" min={1} max={MAX_SLOTS} value={spread.count} onChange={(e) => setSpread((s) => ({ ...s, count: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sp-from" className="text-xs">{tr('De')}</Label>
                  <Input id="sp-from" type="time" value={spread.from} onChange={(e) => setSpread((s) => ({ ...s, from: e.target.value }))} className="h-9 px-2" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sp-to" className="text-xs">{tr('À')}</Label>
                  <Input id="sp-to" type="time" value={spread.to} onChange={(e) => setSpread((s) => ({ ...s, to: e.target.value }))} className="h-9 px-2" />
                </div>
              </div>
              <Button type="button" size="sm" className="w-full rounded-xl" onClick={() => { const r = spreadTimes(Number(spread.count), spread.from, spread.to); if (r.length > 0) setTimes(r) }}>{tr('Appliquer')}</Button>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void saveTimes()} disabled={!dirty || savingTimes} className="gap-1.5 rounded-xl">
            {savingTimes && <Loader2 className="h-4 w-4 animate-spin" />}{tr('Enregistrer les heures')}
          </Button>
          {dirty && <Button type="button" size="sm" variant="ghost" onClick={() => setTimes(saved.length > 0 ? saved : DEFAULT_TIMES)} className="rounded-xl text-muted-foreground">{tr('Annuler les changements')}</Button>}
          <span className="text-xs text-muted-foreground">{tr('{0} publications par jour', normalizeTimes(times).length)}</span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">{tr('Dernières publications automatiques')}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => void load(true)} className="h-7 gap-1 px-2 text-xs"><RefreshCw className="h-3.5 w-3.5" />{tr('Actualiser')}</Button>
          </div>
          <ul className="space-y-1">
            {rows.slice(0, 10).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {r.status === 'posted' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  : r.status === 'failed' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-medium">{r.products?.name ?? '—'}</span>
                  {r.status === 'failed' && r.error && <span className="line-clamp-2 text-destructive">{r.error}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground">{new Date(r.updated_at).toLocaleString(LOCALE_TAG, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
