import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'
import type { VesselEvent } from '@/lib/ais'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('vessel-track', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const res = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as { error?: string } | null : null
    throw new Error(res?.error || tr('Erreur réseau'))
  }
  if (data?.error) throw new Error(String(data.error))
  return data as T
}

export interface VesselCandidate {
  mmsi: string
  name: string
  imo: string | null
  destination: string | null
  lat: number | null
  lng: number | null
  speed_kn: number | null
  at: string | null
}

/** Ships of the AIS feed whose name contains `name` (the server listens for up to 90 seconds); `heard` says how much the feed sent, to tell "nothing found" from "nothing received". */
export const findVessel = (name: string) => call<{ candidates: VesselCandidate[]; heard: { messages: number; ships: number; source?: string } }>({ action: 'find', name })

/** Reads the position of the ship of a shipment now (up to 100 seconds: it stops as soon as the ship is heard). */
export const refreshVessel = (shipmentId: string) => call<{ heard: boolean; saved: boolean; messages: number; lat: number | null; lng: number | null; at: string | null }>({ action: 'refresh', shipment_id: shipmentId })

/** A client with the map open: the server reads the ship now (at most once every 3 minutes per shipment; `throttled` when it was read recently). */
export const liveVessel = (shipmentId: string) => call<{ throttled?: boolean; heard?: boolean }>({ action: 'live', shipment_id: shipmentId })

/** What a client sees of the ship of their shipment: only the parameters the team chose to show are present. */
export interface ShipmentVessel {
  vessel: string | null
  voyage: string | null
  imo?: string
  /** Dates of the shipment (YYYY-MM-DD), when the team shows the dates. */
  depart?: string
  arrive?: string
  /** The ship has not been heard yet: only the ship and the voyage are known. */
  waiting?: boolean
  /** When the ship sent its last position (absent while `waiting`). */
  at?: string
  lat?: number
  lng?: number
  /** Heading in degrees (0 = north). */
  course?: number
  /** The route travelled so far, oldest first: [lat, lng]. */
  track?: Array<[number, number]>
  speed_kn?: number
  destination?: string
  eta?: string
  history?: Array<{ at: string; event: VesselEvent; destination: string | null }>
}

export async function getShipmentVessel(shipmentId: string): Promise<ShipmentVessel | null> {
  const { data, error } = await supabase.rpc('get_shipment_vessel', { p_shipment: shipmentId })
  if (error) return null
  return (data as ShipmentVessel | null) ?? null
}
