import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Gauge, Loader2, Navigation, RefreshCw, Ship } from 'lucide-react'
import { getShipmentVessel, liveVessel, type ShipmentVessel } from '@/lib/vessel-api'
import { Skeleton } from '@/components/ui/skeleton'
import type { VesselEvent } from '@/lib/ais'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

// the map (Leaflet) is only downloaded when there is a position to show
const VesselMap = lazy(() => import('./vessel-map'))

const knots = (n: number) => n.toLocaleString(DATE_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const when = (iso: string) => new Date(iso).toLocaleString(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "2 h" / "3 j": how old a position is. */
function age(iso: string): string {
  const h = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3_600_000))
  return h < 1 ? tr('moins d\'une heure') : h < 48 ? tr('{0} h', h) : tr('{0} j', Math.round(h / 24))
}

const EVENT_LABEL: Record<VesselEvent, (destination: string | null) => string> = {
  first: () => tr('Premier signal du bateau reçu'),
  departed: () => tr('Le bateau a pris la mer'),
  stopped: () => tr('Le bateau s\'est arrêté (escale ou mouillage)'),
  destination: (d) => (d ? tr('Nouvelle destination annoncée : {0}', d) : tr('Destination mise à jour')),
}

const DAY = 86_400_000
/** A date of the shipment ("YYYY-MM-DD") as a moment: noon, so that no time zone moves it to the next day. */
const noon = (iso: string) => new Date(`${iso}T12:00:00`).getTime()
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long' })

/** How far the voyage is, from the planned departure to the estimated arrival (null without an arrival date). */
function voyageProgress(depart: string | undefined, arrive: string | undefined, now: number): { pct: number | null; text: string } | null {
  if (!arrive) return null
  const end = noon(arrive)
  const start = depart ? noon(depart) : null
  const pct = start !== null && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : null
  const toStart = start !== null ? Math.ceil((start - now) / DAY) : 0
  const left = Math.round((end - now) / DAY)
  const text = toStart > 0 ? tr('Départ dans {0} j', toStart)
    : left > 0 ? tr('Arrivée dans {0} j', left)
    : left === 0 ? tr('Arrivée prévue aujourd\'hui')
    : tr('Date d\'arrivée dépassée de {0} j', -left)
  return { pct, text }
}

interface Step { key: string; at: number; label: string; sub: string; planned: boolean }

/** What happened (the history of the ship) and what is expected (the dates of the voyage and the arrival announced by the ship), in order of date. */
function voyageSteps(v: ShipmentVessel): Step[] {
  const steps: Step[] = (v.history ?? []).map((h) => ({ key: `${h.at}-${h.event}`, at: Date.parse(h.at), label: EVENT_LABEL[h.event](h.destination), sub: when(h.at), planned: false }))
  if (v.depart) steps.push({ key: 'depart', at: noon(v.depart), label: tr('Départ prévu'), sub: dayLabel(noon(v.depart)), planned: true })
  if (v.eta) steps.push({ key: 'eta', at: Date.parse(v.eta), label: tr('Arrivée annoncée par le bateau'), sub: `${dayLabel(Date.parse(v.eta))}${v.destination ? ` · ${v.destination}` : ''}`, planned: true })
  if (v.arrive) steps.push({ key: 'arrive', at: noon(v.arrive), label: tr('Arrivée estimée en Haïti'), sub: dayLabel(noon(v.arrive)), planned: true })
  return steps.sort((a, b) => a.at - b.at)
}

/** The voyage of the ship that carries a shipment: where it is, how far it is, and the history and the forecasts of the trip. Shows only what the team chose to show; nothing when the ship is not followed. */
export function VesselCard({ shipmentId, onShown }: { shipmentId: string; onShown?: (shown: boolean) => void }) {
  const [vessel, setVessel] = useState<ShipmentVessel | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => getShipmentVessel(shipmentId).then(setVessel), [shipmentId])

  /** Asks the server to read the ship now (it answers "throttled" when it did a moment ago), then shows what it saved. */
  const readNow = useCallback(async () => {
    try { await liveVessel(shipmentId) } catch { /* the saved position is still shown */ }
    await load()
  }, [shipmentId, load])

  // while the page is open: the saved position every minute, a fresh reading of the ship every 3 minutes
  useEffect(() => {
    let ticks = 0
    load().then(() => readNow())
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      ticks += 1
      if (ticks % 3 === 0) readNow(); else load()
    }, 60_000)
    return () => clearInterval(timer)
  }, [load, readNow])

  useEffect(() => { onShown?.(!!vessel) }, [vessel, onShown])

  async function refresh() {
    setBusy(true)
    await readNow()
    setBusy(false)
  }

  if (!vessel) return null
  const stale = !!vessel.at && Date.now() - Date.parse(vessel.at) > 48 * 3_600_000
  const recent = !!vessel.at && Date.now() - Date.parse(vessel.at) < 30 * 60_000
  const progress = voyageProgress(vessel.depart, vessel.arrive, Date.now())
  const steps = voyageSteps(vessel)

  return (
    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm" aria-label={tr('Voyage du bateau')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Ship className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-700/70">
            {tr('Voyage du bateau')}
            {recent && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />{tr('En direct')}</span>}
          </p>
          <p className="truncate text-sm font-bold">{vessel.vessel || tr('Bateau')}</p>
          {(vessel.voyage || vessel.imo) && (
            <p className="text-xs text-muted-foreground">
              {vessel.voyage && <>{tr('Voyage')} <span className="font-mono">{vessel.voyage}</span></>}
              {vessel.voyage && vessel.imo && ' · '}
              {vessel.imo && <>IMO <span className="font-mono">{vessel.imo}</span></>}
            </p>
          )}
          {vessel.at && (
            <p className={stale ? 'text-xs font-medium text-amber-700' : 'text-xs text-muted-foreground'}>
              {tr('Dernier signal : {0} (il y a {1})', when(vessel.at), age(vessel.at))}
            </p>
          )}
        </div>
        <button type="button" onClick={refresh} disabled={busy} aria-label={tr('Actualiser la position')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {progress && (
        <div className="mt-4" role="group" aria-label={progress.text}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">{progress.text}</span>
            {vessel.arrive && !vessel.depart && <span className="text-muted-foreground">{tr('Arrivée estimée en Haïti')} : {dayLabel(noon(vessel.arrive))}</span>}
          </div>
          {progress.pct !== null && (
            <div className="relative mt-2 h-1.5 rounded-full bg-sky-100" aria-hidden>
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${progress.pct}%` }} />
              <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#F05A28] shadow" style={{ left: `${progress.pct}%` }} />
            </div>
          )}
          {vessel.depart && (
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{tr('Départ')} {dayLabel(noon(vessel.depart))}</span>
              <span>{tr('Arrivée')} {dayLabel(noon(vessel.arrive!))}</span>
            </div>
          )}
        </div>
      )}

      {vessel.waiting && (
        <p className="mt-3 rounded-xl bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
          {tr('En attente du premier signal du bateau : sa position apparaîtra ici automatiquement dès qu\'il sera à portée des récepteurs AIS.')}
        </p>
      )}

      {vessel.lat !== undefined && vessel.lng !== undefined && (
        <div className="mt-3">
          <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
            <VesselMap lat={vessel.lat} lng={vessel.lng} course={vessel.course} track={vessel.track} live={recent} />
          </Suspense>
        </div>
      )}

      {(vessel.speed_kn !== undefined || vessel.destination) && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {vessel.speed_kn !== undefined && (
            <div className="rounded-xl bg-muted/40 p-2.5">
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><Gauge className="h-3 w-3" aria-hidden />{tr('Vitesse')}</dt>
              <dd className="font-semibold tabular-nums">{tr('{0} nœuds', knots(vessel.speed_kn))}</dd>
            </div>
          )}
          {vessel.destination && (
            <div className="rounded-xl bg-muted/40 p-2.5">
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><Navigation className="h-3 w-3" aria-hidden />{tr('Destination')}</dt>
              <dd className="truncate font-semibold">{vessel.destination}</dd>
            </div>
          )}
        </dl>
      )}

      {steps.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Historique et prévisions du voyage')}</p>
          <ol className="ml-1.5 space-y-3.5 border-l border-gray-200 pl-4">
            {steps.map((st) => (
              <li key={st.key} className="relative text-sm">
                <span aria-hidden className={cn('absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 bg-white', st.planned ? 'border-dashed border-sky-400' : 'border-sky-600 bg-sky-600')} />
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className={cn('font-medium', st.planned && 'text-muted-foreground')}>{st.label}</span>
                  {st.planned && <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700">{tr('Prévision')}</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{st.sub}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!vessel.waiting && <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{tr('Position issue des signaux AIS du bateau : elle peut avoir quelques heures de retard et la destination est annoncée par le bateau lui-même.')}</p>}
    </section>
  )
}
