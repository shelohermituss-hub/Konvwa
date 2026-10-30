import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mstTime, parseMstSearch, parseMstVessel } from './mst'

const NOW = new Date('2026-10-30T12:00:00Z')

describe('mstTime', () => {
  it('reads the usual time formats as UTC', () => {
    expect(mstTime('2026-10-30 09:12:05')).toBe('2026-10-30T09:12:05.000Z')
    expect(mstTime('2026-10-30T09:12:05Z')).toBe('2026-10-30T09:12:05.000Z')
    expect(mstTime('2026-10-30T09:12:05+02:00')).toBe('2026-10-30T07:12:05.000Z')
    expect(mstTime(1793351525)).toBe('2026-10-30T09:12:05.000Z')
    expect(mstTime('soon')).toBeNull()
    expect(mstTime(undefined)).toBeNull()
  })
})

describe('parseMstVessel', () => {
  const ship = { vessel_name: 'TAMPA TRIUMPH', mmsi: 636026640, imo: 9737462, lat: 17.62, lng: -102.1, course: 121.5, speed: 19.1, received: '2026-10-30 09:12:05' }

  it('reads a simple answer wrapped in data', () => {
    const v = parseMstVessel({ status: 'success', data: ship }, NOW)
    expect(v?.mmsi).toBe('636026640')
    expect(v?.imo).toBe('9737462')
    expect(v?.fix).toEqual({ mmsi: '636026640', name: 'TAMPA TRIUMPH', lat: 17.62, lng: -102.1, speed_kn: 19.1, course: 122, nav_status: null, at: '2026-10-30T09:12:05.000Z' })
  })
  it('reads an answer that is the ship itself, a list, and numbers sent as text', () => {
    expect(parseMstVessel(ship, NOW)?.fix?.lat).toBe(17.62)
    expect(parseMstVessel({ data: [ship] }, NOW)?.fix?.lng).toBe(-102.1)
    expect(parseMstVessel({ data: { ...ship, lat: '17.62', lng: '-102.1', speed: '19.1' } }, NOW)?.fix?.speed_kn).toBe(19.1)
  })
  it('reads the destination and the ETA of an extended answer', () => {
    const v = parseMstVessel({ data: { ...ship, destination: 'BALBOA@@@', eta: '2026-11-03 06:00:00' } }, NOW)
    expect(v?.info.destination).toBe('BALBOA')
    expect(v?.info.eta).toBe('2026-11-03T06:00:00.000Z')
  })
  it('has no position when the answer has none, or an impossible one', () => {
    expect(parseMstVessel({ data: { mmsi: '636026640', vessel_name: 'X' } }, NOW)?.fix).toBeNull()
    expect(parseMstVessel({ data: { ...ship, lat: 0, lng: 0 } }, NOW)?.fix).toBeNull()
    expect(parseMstVessel({ data: { ...ship, lat: 95 } }, NOW)?.fix).toBeNull()
  })
  it('gives the receive time when the answer has no time, and drops unavailable speed and course', () => {
    const v = parseMstVessel({ data: { ...ship, received: undefined, speed: 102.3, course: 360 } }, NOW)
    expect(v?.fix).toMatchObject({ at: NOW.toISOString(), speed_kn: null, course: null })
  })
  it('refuses an answer without a ship', () => {
    expect(parseMstVessel({ status: 'error', message: 'no vessel' }, NOW)).toBeNull()
    expect(parseMstVessel({ data: [] }, NOW)).toBeNull()
    expect(parseMstVessel({ data: { mmsi: '12' } }, NOW)).toBeNull()
    expect(parseMstVessel(null, NOW)).toBeNull()
  })
})

describe('parseMstSearch', () => {
  it('lists the ships found', () => {
    const list = parseMstSearch({ data: [
      { vessel_name: 'TAMPA TRIUMPH', mmsi: 636026640, imo: 9737462, lat: 17.6, lng: -102.1, speed: 19.1 },
      { vessel_name: 'BAD', mmsi: 12 },
      { vessel_name: 'TAMPA TRIUMPH II', mmsi: '636000001' },
    ] })
    expect(list.map((c) => [c.mmsi, c.name, c.imo])).toEqual([['636026640', 'TAMPA TRIUMPH', '9737462'], ['636000001', 'TAMPA TRIUMPH II', null]])
  })
  it('gives nothing for an unreadable answer', () => {
    expect(parseMstSearch({ error: 'x' })).toEqual([])
    expect(parseMstSearch(null)).toEqual([])
  })
})

describe('server copy', () => {
  it('supabase/functions/vessel-track/mst.ts must be re-copied from src/lib/mst.ts whenever it changes', () => {
    expect(readFileSync('supabase/functions/vessel-track/mst.ts', 'utf8')).toBe(readFileSync('src/lib/mst.ts', 'utf8'))
  })
})
