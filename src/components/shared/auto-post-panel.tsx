import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'
import { LOCALE_TAG, tr } from '@/lib/i18n'

const PER_DAY = 5
const SETTING = 'auto_post_enabled'

interface Row { status: 'pending' | 'posted' | 'failed'; error: string | null; updated_at: string; local_day: string; products: { name: string } | null }

/** Day in Haiti (yyyy-mm-dd), the day the daily budget is counted on. */
const haitiDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(new Date())

/**
 * Admin: switch of the daily automatic posters (5 products a day, from 7:00 in Haiti, on Facebook and Instagram, never twice the same product)
 * and the latest results. The database decides what to post and when; this panel only flips the switch and shows what happened.
 */
export function AutoPostPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', SETTING).maybeSingle(),
      supabase.from('social_posts').select('status, error, updated_at, local_day, products(name)').eq('source', 'auto').order('updated_at', { ascending: false }).limit(10),
    ])
    setEnabled(s.data?.value === 'true')
    setRows((r.data ?? []) as unknown as Row[])
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30000)
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
    setTimeout(() => void load(), 4000)
  }

  const today = haitiDay()
  const doneToday = rows.filter((r) => r.local_day === today).length

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">{tr('Publication automatique des affiches')}</p>
            <p className="text-xs text-muted-foreground">
              {tr('{0} produits par jour à partir de 7 h (heure d\'Haïti), sur Facebook et Instagram. Un produit n\'est jamais publié deux fois.', PER_DAY)}
              {enabled && ` · ${tr('Aujourd\'hui : {0} sur {1}', doneToday, PER_DAY)}`}
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
                <AlertDialogDescription>{tr('Un produit tiré au sort, qui n\'a pas encore d\'affiche, sera publié tout de suite sur Facebook et Instagram. Cela ne change pas le programme du jour.')}</AlertDialogDescription>
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

      {rows.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">{tr('Dernières publications automatiques')}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => void load()} className="h-7 gap-1 px-2 text-xs"><RefreshCw className="h-3.5 w-3.5" />{tr('Actualiser')}</Button>
          </div>
          <ul className="space-y-1">
            {rows.map((r, i) => (
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
