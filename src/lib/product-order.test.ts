import { describe, expect, it } from 'vitest'
import { needsShippingPayment, productOrderStage, productOrderStep } from './product-order'

const base = { status: 'processing', payment_status: 'paid', received_at: null, shipping_paid_at: null }

describe('productOrderStage', () => {
  it('follows the purchase-then-shipping flow', () => {
    expect(productOrderStage({ ...base, payment_status: 'unpaid', status: 'pending' })).toBe('pending')
    expect(productOrderStage(base)).toBe('purchasing')
    expect(productOrderStage({ ...base, received_at: '2026-01-01' })).toBe('arrived')
    expect(productOrderStage({ ...base, received_at: '2026-01-01', shipping_paid_at: '2026-01-02' })).toBe('ready_to_ship')
    expect(productOrderStage({ ...base, status: 'shipped', received_at: 'x', shipping_paid_at: 'y' })).toBe('shipped')
    expect(productOrderStage({ ...base, status: 'delivered' })).toBe('delivered')
    expect(productOrderStage({ ...base, status: 'cancelled' })).toBe('cancelled')
    expect(productOrderStage({ ...base, payment_status: 'refunded' })).toBe('cancelled')
  })
  it('maps stages to tracker steps', () => {
    expect(productOrderStep('purchasing')).toBe(0)
    expect(productOrderStep('arrived')).toBe(1)
    expect(productOrderStep('delivered')).toBe(4)
    expect(productOrderStep('cancelled')).toBe(-1)
  })
  it('asks for the shipping only when it is due and positive', () => {
    expect(needsShippingPayment({ ...base, received_at: 'x', shipping_amount_htg: 2500 })).toBe(true)
    expect(needsShippingPayment({ ...base, received_at: 'x', shipping_amount_htg: 0 })).toBe(false)
    expect(needsShippingPayment({ ...base, shipping_amount_htg: 2500 })).toBe(false)
  })
})
