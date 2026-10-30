import { useState } from 'react'
import { Loader2, MapPin, RefreshCw, Search, Ship } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { findVessel, refreshVessel, type VesselCandidate } from '@/lib/vessel-api'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

export interface VesselShipment {
  id: string
  batch_code: string
  vessel_info: string | null
  vessel_mmsi: string | null
  vessel_imo: string | null
  voyage_number: string | null
  ais_enabled: boolean
  ais_show: Record<string, boolean>
  ais_synced_at: string | null
  ais_error: string | null
}

const SHOW_FIELDS = [
  { key: 'position', label: tr('Position sur la carte') },
  { key: 'speed', label: tr('Vitesse') },
  { key: 'destination', label: tr('Destination') },
  { key: 'eta', label: tr('Arrivée estimée du bateau') },
  { key: 'history', label: tr('Historique des étapes') },
]

const NO_SIGNAL = tr('Aucun signal reçu : le bateau est peut-être hors de portée des récepteurs AIS.')
const knots = (n: number) => n.toLocaleString(DATE_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const coords = (lat: number, lng: number) => `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`

interface Props {
  shipment: VesselShipment | null
  onClose: () => void
  onSaved: (id: string, patch: Partial<VesselShipment>) => void
}

/** Admin: picks the ship of a shipment from the AIS feed (by name), decides what the clients see of it, and reads its position now. */
export function ShipmentVesselDialog({ shipment, onClose, onSaved }: Props) {
  // the dialog is remounted for each shipment (key), so the form starts from the shipment
  const [name, setName] = useState(shipment?.vessel_info ?? '')
  const [mmsi, setMmsi] = useState(shipment?.vessel_mmsi ?? '')
  const [imo, setImo] = useState(shipment?.vessel_imo ?? '')
  const [voyage, setVoyage] = useState(shipment?.voyage_number ?? '')
  const [enabled, setEnabled] = useState(shipment?.ais_enabled ?? false)
  const [show, setShow] = useState<Record<string, boolean>>({ position: true, speed: true, destination: true, eta: true, history: true, ...(shipment?.ais_show ?? {}) })
  const [candidates, setCandidates] = useState<VesselCandidate[] | null>(null)
  const [busy, setBusy] = useState<'find' | 'save' | 'refresh' | null>(null)
  const [synced, setSynced] = useState({ at: shipment?.ais_synced_at ?? null, error: shipment?.ais_error ?? null })

  if (!shipment) return null

  async function search() {
    setBusy('find')
    setCandidates(null)
    try {
      const { candidates: found } = await findVessel(name)
      setCandidates(found)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'))
    }
    setBusy(null)
  }

  function pick(c: VesselCandidate) {
    setMmsi(c.mmsi)
    if (c.imo) setImo(c.imo)
    if (c.name) setName(c.name)
    setCandidates(null)
  }

  /** Saves the form; returns false when something is wrong (the toast says what). */
  async function save(): Promise<boolean> {
    if (!shipment) return false
    if (mmsi && !/^\d{9}$/.test(mmsi)) { toast.error(tr('Le MMSI a 9 chiffres.')); return false }
    if (imo && !/^\d{7}$/.test(imo)) { toast.error(tr('Le numéro IMO a 7 chiffres.')); return false }
    if (enabled && !mmsi) { toast.error(tr('Choisissez d\'abord le bateau (recherche par nom, ou son MMSI).')); return false }
    const patch = { vessel_info: name.trim() || null, vessel_mmsi: mmsi || null, vessel_imo: imo || null, voyage_number: voyage.trim() || null, ais_enabled: enabled, ais_show: show }
    const { error } = await supabase.from('shipments').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', shipment.id)
    if (error) { toast.error(tr('Erreur.')); return false }
    onSaved(shipment.id, patch)
    return true
  }

  async function saveAndClose() {
    setBusy('save')
    if (await save()) { toast.success(tr('Suivi du bateau enregistré.')); onClose() }
    setBusy(null)
  }

  async function saveAndRefresh() {
    if (!shipment) return
    setBusy('refresh')
    try {
      if (await save()) {
        const r = await refreshVessel(shipment.id)
        const now = new Date().toISOString()
        const error = r.heard ? null : NO_SIGNAL
        setSynced({ at: now, error })
        onSaved(shipment.id, { ais_synced_at: now, ais_error: error })
        if (r.heard && r.lat !== null && r.lng !== null) toast.success(tr('Position reçue : {0}', coords(r.lat, r.lng)))
        else toast.info(tr('Aucun signal reçu pour le moment.'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'))
    }
    setBusy(null)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ship className="h-5 w-5" aria-hidden />{tr('Suivi du bateau')}</DialogTitle>
          <DialogDescription>{tr('Lot')}{' '}<span className="font-mono font-semibold">{shipment.batch_code}</span></DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="vessel-name" className="text-xs font-semibold">{tr('Nom du bateau')}</Label>
            <div className="flex gap-2">
              <Input id="vessel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="MV Atlantic Star" className="rounded-xl" />
              <Button type="button" variant="outline" onClick={search} disabled={busy !== null || name.trim().length < 3} className="shrink-0 gap-1.5 rounded-xl">
                {busy === 'find' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                {busy === 'find' ? tr('Écoute…') : tr('Rechercher')}
              </Button>
            </div>
            {busy === 'find' && <p className="text-xs text-muted-foreground">{tr('Le serveur écoute le flux AIS pendant environ 45 secondes.')}</p>}
          </div>

          {candidates && (
            candidates.length === 0 ? (
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                {tr('Aucun bateau de ce nom n\'a été entendu. Il est peut-être hors de portée des récepteurs AIS (en pleine mer) : réessayez quand il est près d\'un port, ou saisissez directement son MMSI ci-dessous (visible sur VesselFinder ou MarineTraffic).')}
              </p>
            ) : (
              <div className="space-y-2" role="listbox" aria-label={tr('Bateaux trouvés')}>
                <p className="text-xs font-semibold text-muted-foreground">{tr('Choisissez le bon bateau :')}</p>
                {candidates.map((c) => (
                  <button key={c.mmsi} type="button" role="option" aria-selected={false} onClick={() => pick(c)} className="w-full rounded-xl border-2 border-gray-200 p-3 text-left transition-colors hover:border-primary active:scale-[0.99]">
                    <p className="text-sm font-bold">{c.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">MMSI {c.mmsi}{c.imo ? ` · IMO ${c.imo}` : ''}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {c.lat !== null && c.lng !== null && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{coords(c.lat, c.lng)}</span>}
                      {c.speed_kn !== null && <span>{tr('{0} nœuds', knots(c.speed_kn))}</span>}
                      {c.destination && <span>→ {c.destination}</span>}
                    </p>
                  </button>
                ))}
              </div>
            )
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vessel-mmsi" className="text-xs font-semibold">MMSI</Label>
              <Input id="vessel-mmsi" inputMode="numeric" maxLength={9} value={mmsi} onChange={(e) => setMmsi(e.target.value.replace(/\D/g, ''))} placeholder="477123400" className="rounded-xl font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vessel-imo" className="text-xs font-semibold">IMO</Label>
              <Input id="vessel-imo" inputMode="numeric" maxLength={7} value={imo} onChange={(e) => setImo(e.target.value.replace(/\D/g, ''))} placeholder="9811000" className="rounded-xl font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vessel-voyage" className="text-xs font-semibold">{tr('N° de voyage')}</Label>
              <Input id="vessel-voyage" maxLength={30} value={voyage} onChange={(e) => setVoyage(e.target.value)} placeholder="026E" className="rounded-xl font-mono text-sm" />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-gray-100 p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">{tr('Suivi automatique')}</span>
                <span className="block text-xs text-muted-foreground">{tr('Toutes les 30 minutes tant que l\'expédition est « Expédié » ou « En transit ».')}</span>
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={tr('Suivi automatique')} />
            </label>
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-muted-foreground">{tr('Ce que le client voit :')}</p>
              {SHOW_FIELDS.map((f) => (
                <label key={f.key} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="rounded" checked={show[f.key] ?? true} onChange={(e) => setShow((s) => ({ ...s, [f.key]: e.target.checked }))} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {(synced.at || synced.error) && (
            <p className={cn('text-xs leading-relaxed', synced.error ? 'text-amber-800' : 'text-muted-foreground')}>
              {synced.at && <>{tr('Dernière lecture :')} {new Date(synced.at).toLocaleString(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. </>}
              {synced.error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tr('Les signaux AIS viennent des récepteurs au sol : loin des côtes, un bateau peut rester sans signal pendant des heures. Le client voit alors la dernière position connue avec son heure.')}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={saveAndRefresh} disabled={busy !== null || !mmsi} className="gap-1.5 rounded-xl">
            {busy === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            {busy === 'refresh' ? tr('Lecture…') : tr('Enregistrer et actualiser')}
          </Button>
          <Button onClick={saveAndClose} disabled={busy !== null} className="rounded-xl">{busy === 'save' ? tr('Enregistrement...') : tr('Enregistrer')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
