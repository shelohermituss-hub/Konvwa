// MyShipTracking API (v2, https://api.myshiptracking.com/api/v2): the latest known position of a ship, even when it was received hours ago (satellite included),
// where the free aisstream.io feed only gives what it hears live. Pure functions (unit-tested).
// supabase/functions/vessel-track/mst.ts is a verbatim copy: the server reads the answers with the same code (a test checks it).
// The field names follow the MyShipTracking documentation; the reader accepts the usual variants and returns null for what it cannot read.
import type { AisFix, AisStatic } from './ais.ts'

export interface MstVessel {
  mmsi: string
  imo: string | null
  name: string
  /** null when the answer has no usable position. */
  fix: AisFix | null
  /** Destination and ETA (only in the extended answer). */
  info: AisStatic
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const first = (o: Record<string, unknown>, keys: string[]): unknown => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')

/** "2026-10-30 13:25:12" (UTC), an ISO date or a Unix time (seconds) -> ISO; null when it cannot be read. */
export function mstTime(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v < 1e11 ? v * 1000 : v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof v !== 'string' || !v.trim()) return null
  const s = v.trim().replace(' ', 'T')
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** The ship object of an answer: `{ data: {…} }`, `{ data: [{…}] }`, or the object itself. */
function shipObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const data = b.data ?? b.result ?? b.vessel
  if (Array.isArray(data)) return (data[0] as Record<string, unknown> | undefined) ?? null
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return 'mmsi' in b || 'lat' in b ? b : null
}

/** The answer of GET /vessel (simple or extended), or null when it holds no ship. */
export function parseMstVessel(body: unknown, now: Date = new Date()): MstVessel | null {
  const o = shipObject(body)
  if (!o) return null
  const mmsi = str(first(o, ['mmsi', 'MMSI']))
  if (!/^\d{9}$/.test(mmsi)) return null
  const imoRaw = str(first(o, ['imo', 'IMO']))
  const imo = /^\d{7}$/.test(imoRaw) ? imoRaw : null
  const name = str(first(o, ['vessel_name', 'name', 'shipname', 'ship_name']))
  const lat = num(first(o, ['lat', 'latitude'])), lng = num(first(o, ['lng', 'lon', 'longitude']))
  const speed = num(first(o, ['speed', 'sog'])), course = num(first(o, ['course', 'cog']))
  const at = mstTime(first(o, ['received', 'last_pos_received', 'position_received', 'timestamp', 'time'])) ?? now.toISOString()
  const usable = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
  const eta = mstTime(first(o, ['eta', 'eta_utc', 'eta_date']))
  const destination = str(first(o, ['destination', 'dest'])).replace(/@+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || null
  return {
    mmsi, imo, name,
    fix: usable
      ? { mmsi, name, lat, lng, speed_kn: speed !== null && speed >= 0 && speed < 102.3 ? speed : null, course: course !== null && course >= 0 && course < 360 ? Math.round(course) : null, nav_status: null, at }
      : null,
    info: { mmsi, imo, name, destination, eta, ship_type: null },
  }
}

export interface MstCandidate { mmsi: string; name: string; imo: string | null; destination: string | null; lat: number | null; lng: number | null; speed_kn: number | null; at: string | null }

/** The answer of GET /vessel/search: the ships found (at most 8), with what the answer says of them. */
export function parseMstSearch(body: unknown): MstCandidate[] {
  const list = body && typeof body === 'object' ? ((body as Record<string, unknown>).data ?? (body as Record<string, unknown>).result ?? body) : null
  if (!Array.isArray(list)) return []
  const out: MstCandidate[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const mmsi = str(first(o, ['mmsi', 'MMSI']))
    if (!/^\d{9}$/.test(mmsi)) continue
    const imoRaw = str(first(o, ['imo', 'IMO']))
    const lat = num(first(o, ['lat', 'latitude'])), lng = num(first(o, ['lng', 'lon', 'longitude']))
    out.push({
      mmsi,
      name: str(first(o, ['vessel_name', 'name', 'shipname', 'ship_name'])),
      imo: /^\d{7}$/.test(imoRaw) ? imoRaw : null,
      destination: null,
      lat, lng,
      speed_kn: num(first(o, ['speed', 'sog'])),
      at: mstTime(first(o, ['received', 'last_pos_received', 'timestamp', 'time'])),
    })
    if (out.length === 8) break
  }
  return out
}
