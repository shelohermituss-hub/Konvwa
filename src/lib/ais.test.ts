import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aisTime, cleanDestination, etaFromAis, haversineKm, nameMatches, parseAisMessage, shouldRecord, vesselEvent, type LastPosition } from './ais'

const NOW = new Date('2026-10-30T12:00:00Z')

const position = (over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => ({
  MessageType: 'PositionReport',
  MetaData: { MMSI: 477123400, ShipName: 'ATLANTIC STAR  ', time_utc: '2026-10-30 11:58:12.123456 +0000 UTC', ...meta },
  Message: { PositionReport: { UserID: 477123400, Latitude: 22.5, Longitude: 114.3, Sog: 12.4, Cog: 187.6, NavigationalStatus: 0, ...over } },
})

describe('parseAisMessage', () => {
  it('reads a position report', () => {
    const m = parseAisMessage(position(), NOW)
    expect(m).toEqual({ kind: 'position', fix: { mmsi: '477123400', name: 'ATLANTIC STAR', lat: 22.5, lng: 114.3, speed_kn: 12.4, course: 188, nav_status: 0, at: '2026-10-30T11:58:12.000Z' } })
  })
  it('drops "not available" values and unusable positions', () => {
    const m = parseAisMessage(position({ Sog: 102.3, Cog: 360 }), NOW)
    expect(m?.kind === 'position' && [m.fix.speed_kn, m.fix.course]).toEqual([null, null])
    expect(parseAisMessage(position({ Latitude: 91, Longitude: 181 }), NOW)).toBeNull()
    expect(parseAisMessage(position({ UserID: 12 }, { MMSI: 12 }), NOW)).toBeNull()
    expect(parseAisMessage({ MessageType: 'BaseStationReport' }, NOW)).toBeNull()
    expect(parseAisMessage(null, NOW)).toBeNull()
  })
  it('reads the static data: IMO, destination and ETA', () => {
    const m = parseAisMessage({
      MessageType: 'ShipStaticData',
      MetaData: { MMSI: 477123400 },
      Message: { ShipStaticData: { UserID: 477123400, ImoNumber: 9811000, Name: 'ATLANTIC STAR@@', Destination: 'CN YTN>HT PAP@@@', Eta: { Month: 11, Day: 20, Hour: 14, Minute: 30 }, Type: 70 } },
    }, NOW)
    expect(m).toEqual({ kind: 'static', info: { mmsi: '477123400', imo: '9811000', name: 'ATLANTIC STAR', destination: 'CN YTN>HT PAP', eta: '2026-11-20T14:30:00.000Z', ship_type: 70 } })
  })
})

describe('small readers', () => {
  it('reads the feed time, or falls back to now', () => {
    expect(aisTime('2026-10-28 16:17:32.318353 +0000 UTC', NOW)).toBe('2026-10-28T16:17:32.000Z')
    expect(aisTime('garbage', NOW)).toBe(NOW.toISOString())
  })
  it('cleans destinations', () => {
    expect(cleanDestination('HT  PAP@@@@@')).toBe('HT PAP')
    expect(cleanDestination('@@@@')).toBeNull()
    expect(cleanDestination(undefined)).toBeNull()
  })
  it('gives the ETA the nearest sensible year', () => {
    expect(etaFromAis({ Month: 1, Day: 5, Hour: 24, Minute: 60 }, NOW)).toBe('2027-01-05T00:00:00.000Z')   // already past this year: next year
    expect(etaFromAis({ Month: 10, Day: 20, Hour: 8, Minute: 0 }, NOW)).toBe('2026-10-20T08:00:00.000Z')    // a few days late stays this year
    expect(etaFromAis({ Month: 0, Day: 0, Hour: 24, Minute: 60 }, NOW)).toBeNull()
    expect(etaFromAis({ Month: 2, Day: 31, Hour: 1, Minute: 0 }, NOW)).toBeNull()
    expect(etaFromAis(undefined, NOW)).toBeNull()
  })
  it('matches names loosely, from 3 characters', () => {
    expect(nameMatches('atlantic star', 'MV ATLANTIC STAR')).toBe(true)
    expect(nameMatches('MV-Atlantic', 'MV ATLANTIC STAR')).toBe(true)
    expect(nameMatches('at', 'ATLANTIC')).toBe(false)
    expect(nameMatches('pacific', 'ATLANTIC STAR')).toBe(false)
  })
  it('measures distances', () => {
    expect(Math.round(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }))).toBe(111)
  })
})

const last: LastPosition = { lat: 22.5, lng: 114.3, speed_kn: 0.2, destination: 'CN YTN', at: '2026-10-30T06:00:00.000Z' }

describe('history', () => {
  it('names what changed', () => {
    expect(vesselEvent(null, { speed_kn: 0, destination: null })).toBe('first')
    expect(vesselEvent(last, { speed_kn: 12, destination: 'CN YTN' })).toBe('departed')
    expect(vesselEvent({ ...last, speed_kn: 14 }, { speed_kn: 0.1, destination: 'CN YTN' })).toBe('stopped')
    expect(vesselEvent({ ...last, speed_kn: 14 }, { speed_kn: 13, destination: 'HT PAP' })).toBe('destination')
    expect(vesselEvent({ ...last, speed_kn: 14 }, { speed_kn: 13, destination: 'CN YTN' })).toBeNull()
    expect(vesselEvent({ ...last, speed_kn: 14 }, { speed_kn: 13, destination: null })).toBeNull()
  })
  it('saves a position only when it brings something', () => {
    const next = { lat: 22.5, lng: 114.3, at: '2026-10-30T07:00:00.000Z' }
    expect(shouldRecord(null, next, null)).toBe(true)
    expect(shouldRecord(last, next, null)).toBe(false)                                                  // same place, an hour later
    expect(shouldRecord(last, next, 'departed')).toBe(true)
    expect(shouldRecord(last, { ...next, at: '2026-10-30T12:30:00.000Z' }, null)).toBe(true)           // six hours
    expect(shouldRecord(last, { ...next, lng: 114.5 }, null)).toBe(true)                                // moved ~20 km
    expect(shouldRecord(last, { ...next, at: '2026-10-30T05:00:00.000Z' }, 'departed')).toBe(false)    // older than the saved one
  })
})

describe('server copy', () => {
  it('supabase/functions/vessel-track/ais.ts must be re-copied from src/lib/ais.ts whenever it changes', () => {
    expect(readFileSync('supabase/functions/vessel-track/ais.ts', 'utf8')).toBe(readFileSync('src/lib/ais.ts', 'utf8'))
  })
})
