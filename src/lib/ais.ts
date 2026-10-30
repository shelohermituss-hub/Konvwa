// AIS: the position signals that ships broadcast, read from the aisstream.io feed. Pure functions (unit-tested).
// supabase/functions/vessel-track/ais.ts is a verbatim copy: the server reads the feed with the same code (a test checks it).

export interface AisFix {
  mmsi: string
  name: string
  lat: number
  lng: number
  speed_kn: number | null
  course: number | null
  nav_status: number | null
  /** When the ship sent it (ISO, UTC). */
  at: string
}

export interface AisStatic {
  mmsi: string
  imo: string | null
  name: string
  destination: string | null
  /** ISO, UTC: the ship only broadcasts month, day, hour and minute. */
  eta: string | null
  ship_type: number | null
}

export type AisMessage = { kind: 'position'; fix: AisFix } | { kind: 'static'; info: AisStatic }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** "2026-10-28 16:17:32.318353 +0000 UTC" (the feed's format) -> ISO; the receive time when it cannot be read. */
export function aisTime(v: unknown, now: Date): string {
  const m = typeof v === 'string' ? /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(v) : null
  const d = m ? new Date(`${m[1]}T${m[2]}Z`) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : now.toISOString()
}

/** Destinations are padded with "@" and typed by hand: "CN YTN@@@@" -> "CN YTN". */
export function cleanDestination(v: unknown): string | null {
  const s = text(v).replace(/@+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  return s || null
}

/** The ETA of a ship has no year: the nearest date that is not long past. */
export function etaFromAis(eta: unknown, now: Date): string | null {
  if (!eta || typeof eta !== 'object') return null
  const e = eta as Record<string, unknown>
  const month = num(e.Month), day = num(e.Day)
  if (month === null || day === null || month < 1 || month > 12 || day < 1 || day > 31) return null
  const hour = num(e.Hour), minute = num(e.Minute)
  const h = hour !== null && hour < 24 ? hour : 0
  const mi = minute !== null && minute < 60 ? minute : 0
  let year = now.getUTCFullYear()
  let d = new Date(Date.UTC(year, month - 1, day, h, mi))
  if (d.getUTCMonth() !== month - 1) return null                         // 31 February…
  if (d.getTime() < now.getTime() - 90 * 86_400_000) { year += 1; d = new Date(Date.UTC(year, month - 1, day, h, mi)) }
  return d.getUTCMonth() === month - 1 ? d.toISOString() : null
}

/** One message of the feed, or null when it is not a position / static report or has nothing usable. */
export function parseAisMessage(raw: unknown, now: Date = new Date()): AisMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as { MessageType?: unknown; MetaData?: Record<string, unknown>; Message?: Record<string, Record<string, unknown> | undefined> }
  const meta = m.MetaData ?? {}

  if (m.MessageType === 'PositionReport') {
    const p = m.Message?.PositionReport
    if (!p) return null
    const lat = num(p.Latitude), lng = num(p.Longitude)
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null   // 91 / 181 mean "not available"
    const mmsi = String(p.UserID ?? meta.MMSI ?? '').trim()
    if (!/^\d{9}$/.test(mmsi)) return null
    const sog = num(p.Sog), cog = num(p.Cog), nav = num(p.NavigationalStatus)
    return {
      kind: 'position',
      fix: {
        mmsi,
        name: text(meta.ShipName),
        lat, lng,
        speed_kn: sog !== null && sog < 102.3 ? sog : null,
        course: cog !== null && cog < 360 ? Math.round(cog) : null,
        nav_status: nav,
        at: aisTime(meta.time_utc, now),
      },
    }
  }

  if (m.MessageType === 'ShipStaticData') {
    const s = m.Message?.ShipStaticData
    if (!s) return null
    const mmsi = String(s.UserID ?? meta.MMSI ?? '').trim()
    if (!/^\d{9}$/.test(mmsi)) return null
    const imo = String(num(s.ImoNumber) ?? '')
    return {
      kind: 'static',
      info: {
        mmsi,
        imo: /^\d{7}$/.test(imo) ? imo : null,
        name: text(s.Name).replace(/@+/g, ' ').trim() || text(meta.ShipName),
        destination: cleanDestination(s.Destination),
        eta: etaFromAis(s.Eta, now),
        ship_type: num(s.Type),
      },
    }
  }
  return null
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Does the ship's name contain what the admin typed ("atlantic star" finds "MV ATLANTIC STAR")? At least 3 letters or digits. */
export function nameMatches(query: string, name: string): boolean {
  const q = norm(query)
  return q.length >= 3 && norm(name).includes(q)
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(x)))
}

export interface LastPosition { lat: number; lng: number; speed_kn: number | null; destination: string | null; at: string }
export type VesselEvent = 'first' | 'departed' | 'stopped' | 'destination'

/** What changed since the last saved position, in words the client understands (null: nothing worth a line in the history). */
export function vesselEvent(prev: LastPosition | null, next: { speed_kn: number | null; destination: string | null }): VesselEvent | null {
  if (!prev) return 'first'
  if (prev.speed_kn !== null && next.speed_kn !== null) {
    if (prev.speed_kn < 2 && next.speed_kn >= 3) return 'departed'
    if (prev.speed_kn >= 2 && next.speed_kn < 0.5) return 'stopped'
  }
  if (prev.destination && next.destination && prev.destination !== next.destination) return 'destination'
  return null
}

/** A position is saved when it is the first, when it tells something new, or when the ship moved ~5 nautical miles or 6 hours went by. */
export function shouldRecord(prev: LastPosition | null, next: { lat: number; lng: number; at: string }, event: VesselEvent | null): boolean {
  if (!prev) return true
  if (Date.parse(next.at) <= Date.parse(prev.at)) return false
  if (event) return true
  return (Date.parse(next.at) - Date.parse(prev.at)) / 3_600_000 >= 6 || haversineKm(prev, next) >= 9.3
}
