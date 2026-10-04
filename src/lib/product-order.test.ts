import { describe, expect, it } from 'vitest'
import { isCancelledOrder, needsShippingPayment, productOrderLabel, trackingStatusOf } from './product-order'

const base = { status: 'processing', payment_status: 'paid', tracking_status: 'paid', shipping_paid_at: null }

describe('catalogue order tracking', () => {
  it('starts at "paid"', () => {
    expect(trackingStatusOf(base)).toBe('paid')
    expect(trackingStatusOf({ ...base, tracking_status: null })).toBe('paid')
    expect(productOrderLabel(base)).toBe('Payé')
  })
  it('asks the customer to choose a shipping method only once the parcel is at the warehouse and the shipping is not paid', () => {
    expect(needsShippingPayment(base)).toBe(false)
    expect(needsShippingPayment({ ...base, tracking_status: 'in_china_warehouse' })).toBe(true)
    expect(needsShippingPayment({ ...base, tracking_status: 'in_china_warehouse', shipping_paid_at: '2026-10-04T00:00:00Z' })).toBe(false)
    expect(needsShippingPayment({ ...base, tracking_status: 'in_transit' })).toBe(false)
    expect(needsShippingPayment({ ...base, status: 'cancelled', tracking_status: 'in_china_warehouse' })).toBe(false)
  })
  it('follows the cargo labels', () => {
    expect(productOrderLabel({ ...base, tracking_status: 'in_transit', shipping_paid_at: 'x' })).toBe('En transit')
    expect(productOrderLabel({ ...base, tracking_status: 'delivered', shipping_paid_at: 'x' })).toBe('Livré')
    expect(productOrderLabel({ ...base, tracking_status: 'shipping_paid', shipping_paid_at: 'x' })).toBe('Expédition payée')
  })
  it('handles unpaid and cancelled orders', () => {
    expect(productOrderLabel({ ...base, payment_status: 'unpaid', status: 'pending', tracking_status: null })).toBe('En attente de paiement')
    expect(isCancelledOrder({ ...base, payment_status: 'refunded' })).toBe(true)
    expect(productOrderLabel({ ...base, status: 'cancelled' })).toBe('Annulée')
  })
})
