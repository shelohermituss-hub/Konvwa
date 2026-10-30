import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Anchor, Gauge, Loader2, MapPin, Navigation, RefreshCw, Ship } from 'lucide-react'
import { getShipmentVessel, liveVessel, type ShipmentVessel } from '@/lib/vessel-api'
import { Skeleton } from '@/components/ui/skeleton'
import type { VesselEvent } from '@/lib/ais'
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

/** Where the ship that carries a shipment is, with the steps of its trip. Shows only what the team chose to show; nothing when the ship is not followed. */
export function VesselCard({ shipmentId }: { shipmentId: string }) {
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

  async function refresh() {
    setBusy(true)
    await readNow()
    setBusy(false)
  }

  if (!vessel) return null
  const stale = Date.now() - Date.parse(vessel.at) > 48 * 3_600_000
  const recent = Date.now() - Date.parse(vessel.at) < 30 * 60_000

  return (
    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm" aria-label={tr('Position du bateau')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Ship className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-700/70">
            {tr('Position du bateau')}
            {recent && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />{tr('En direct')}</span>}
          </p>
          <p className="truncate text-sm font-bold">{vessel.vessel || tr('Bateau')}{vessel.voyage ? <span className="ml-2 font-mono text-xs font-medium text-muted-foreground">{tr('Voyage')} {vessel.voyage}</span> : null}</p>
          <p className={stale ? 'text-xs font-medium text-amber-700' : 'text-xs text-muted-foreground'}>
            {tr('Dernier signal : {0} (il y a {1})', when(vessel.at), age(vessel.at))}
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={busy} aria-label={tr('Actualiser la position')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {vessel.lat !== undefined && vessel.lng !== undefined && (
        <div className="mt-3">
          <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
            <VesselMap lat={vessel.lat} lng={vessel.lng} course={vessel.course} track={vessel.track} live={recent} />
          </Suspense>
        </div>
      )}

      {(vessel.speed_kn !== undefined || vessel.destination || vessel.eta) && (
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
          {vessel.eta && (
            <div className="col-span-2 rounded-xl bg-muted/40 p-2.5">
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden />{tr('Arrivée estimée du bateau')}</dt>
              <dd className="font-semibold">{new Date(vessel.eta).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long' })}</dd>
            </div>
          )}
        </dl>
      )}

      {vessel.history && vessel.history.length > 0 && (
        <ol className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {vessel.history.map((h) => (
            <li key={`${h.at}-${h.event}`} className="flex items-start gap-2 text-sm">
              <Anchor className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
              <span>
                <span className="font-medium">{EVENT_LABEL[h.event](h.destination)}</span>
                <span className="block text-xs text-muted-foreground">{when(h.at)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{tr('Position issue des signaux AIS du bateau : elle peut avoir quelques heures de retard et la destination est annoncée par le bateau lui-même.')}</p>
    </section>
  )
}
