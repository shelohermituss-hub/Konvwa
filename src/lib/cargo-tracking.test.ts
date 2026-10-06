import { describe, expect, it } from 'vitest'
import { cargoEstimate } from './cargo-tracking'


describe('cargoEstimate', () => {
  const rate = { transit_days_min: 15, transit_days_max: 25 }
  it('uses the batch estimated arrival when known', () => {
    const e = cargoEstimate({ status: 'invoiced', shipment: { status: 'in_transit', estimated_arrival: '2026-11-03' }, quoted_rate: rate })
    expect(e?.kind).toBe('date')
  })
  it('counts the shipping method transit time from the departure, or shows the range before it', () => {
    const e = cargoEstimate({ status: 'invoiced', shipment: { status: 'shipped', departure_date: '2026-10-01' }, quoted_rate: rate })
    expect(e?.kind === 'date' && e.date.toISOString().slice(0, 10)).toBe('2026-10-26')
    expect(cargoEstimate({ status: 'quoted', quoted_rate: rate })).toEqual({ kind: 'days', min: 15, max: 25 })
  })
  it('shows nothing before a quote, without a method, or once arrived', () => {
    expect(cargoEstimate({ status: 'received', quoted_rate: rate })).toBeNull()
    expect(cargoEstimate({ status: 'quoted' })).toBeNull()
    expect(cargoEstimate({ status: 'invoiced', tracking_status: 'arrived_haiti', quoted_rate: rate })).toBeNull()
  })
})
