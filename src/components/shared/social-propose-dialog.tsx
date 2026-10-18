import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { KIND_LABEL } from '@/components/shared/social-poster-editor'
import { supabase } from '@/lib/supabase'
import { useWhatsAppChannel } from '@/lib/whatsapp-channel'
import { CALENDAR_KINDS, dateFr, fromHaitiInput, haitiDay, plainHeadline, proposeCalendar, toHaitiInput, type CalendarKind } from '@/lib/social-calendar'
import { tr } from '@/lib/i18n'

const KIND_HELP: Record<CalendarKind, () => string> = {
  event: () => tr('Vœux et comptes à rebours des fêtes de l\'année (Nouvel An, Carnaval, fête des mères, Noël…)'),
  explainer: () => tr('Comment ça marche : commander, payer, suivre un colis, devenir revendeur…'),
  news: () => tr('Nouveaux arrivages, produits préférés, catalogue'),
  promo: () => tr('Promos de la semaine, bons plans, Black Friday'),
}

const ymdInput = (d: { y: number; m: number; d: number }) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
const parseYmd = (v: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null }

interface Props {
  open: boolean
  /** What the calendar already holds (the same poster is not proposed twice close together). */
  existing: Array<{ headline: string; scheduled_at: string }>
  onClose: () => void
  onAdded: () => void
}

/**
 * Admin: asks the site for a calendar of posters for the coming months (events of the year, explainers, news, promos). The proposals are added as "à valider":
 * nothing is published before the admin has edited and validated each one.
 */
export function SocialProposeDialog({ open, existing, onClose, onAdded }: Props) {
  const channel = useWhatsAppChannel()
  const [months, setMonths] = useState('3')
  const [perWeek, setPerWeek] = useState('3')
  const [kinds, setKinds] = useState<CalendarKind[]>(CALENDAR_KINDS)
  const [from, setFrom] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setFrom(ymdInput(haitiDay(new Date(Date.now() + 86400000)))) }, [open])

  const start = parseYmd(from)
  const proposals = useMemo(
    () => (start ? proposeCalendar({ from: start, months: Number(months), perWeek: Number(perWeek), kinds, channelUrl: channel, existing, now: new Date() }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, months, perWeek, kinds, channel, existing],
  )
  const toggle = (k: CalendarKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  async function add() {
    if (proposals.length === 0) return
    setSaving(true)
    // by slices, so that a long calendar is not refused for its size
    for (let i = 0; i < proposals.length; i += 50) {
      const { error } = await supabase.from('social_calendar').insert(proposals.slice(i, i + 50).map((p) => ({ ...p, status: 'proposed' })))
      if (error) { setSaving(false); toast.error(error.message); if (i > 0) onAdded(); return }
    }
    setSaving(false)
    toast.success(tr('{0} affiches ajoutées au calendrier. Relisez-les puis validez-les.', proposals.length))
    onAdded(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-primary" />{tr('Proposer un calendrier')}</DialogTitle>
          <DialogDescription>{tr('Le site prépare des affiches pour les mois à venir. Rien n\'est publié avant que vous ayez relu et validé chaque affiche.')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-from">{tr('À partir du')}</Label>
              <Input id="pr-from" type="date" value={from} min={ymdInput(haitiDay(new Date()))} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-months">{tr('Durée')}</Label>
              <NativeSelect id="pr-months" value={months} onChange={(e) => setMonths(e.target.value)}>
                {[1, 2, 3, 6, 12].map((n) => <NativeSelectOption key={n} value={String(n)}>{tr('{0} mois', n)}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-week">{tr('Affiches par semaine')}</Label>
              <NativeSelect id="pr-week" value={perWeek} onChange={(e) => setPerWeek(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <NativeSelectOption key={n} value={String(n)}>{n}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">{tr('Les affiches par semaine ne comptent pas les fêtes de l\'année, qui ont leurs propres dates.')}</p>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{tr('Types d\'affiches')}</legend>
            {CALENDAR_KINDS.map((k) => (
              <label key={k} className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded" checked={kinds.includes(k)} onChange={() => toggle(k)} />
                <span><span className="font-medium">{KIND_LABEL[k]()}</span><span className="block text-xs text-muted-foreground">{KIND_HELP[k]()}</span></span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {proposals.length > 0 ? tr('{0} affiches proposées', proposals.length) : tr('Aucune affiche à proposer avec ces choix.')}
            </p>
            {proposals.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-xs">
                {proposals.map((p, i) => {
                  const at = toHaitiInput(p.scheduled_at)
                  const day = parseYmd(at.slice(0, 10))
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 tabular-nums text-muted-foreground">{day ? dateFr(day) : at.slice(0, 10)} · {at.slice(11)}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{KIND_LABEL[p.kind]()}</Badge>
                      <span className="min-w-0 flex-1 truncate">{plainHeadline(p.headline)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">{tr('Annuler')}</Button>
          <Button type="button" onClick={() => void add()} disabled={saving || proposals.length === 0 || fromHaitiInput(`${from}T12:00`) === null} className="gap-1.5 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{tr('Ajouter au calendrier')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
