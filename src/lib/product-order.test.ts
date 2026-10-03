import { describe, expect, it } from 'vitest'
import { needsShippingPayment, productOrderStage, productOrderTimeline } from './product-order'

const base = { status: 'processing', payment_status: 'paid', shipping_request: null }
const withReq = (status: string, shipment: string | null = null) => ({ ...base, shipping_request: { status, shipment: shipment ? { status: shipment } : null } })

describe('productOrderStage', () => {
  it('follows the same flow as a shipping request', () => {
    expect(productOrderStage({ ...base, payment_status: 'unpaid', status: 'pending' })).toBe('pending')
    expect(productOrderStage(base)).toBe('purchasing')
    expect(productOrderStage(withReq('received'))).toBe('awaiting_quote')
    expect(productOrderStage(withReq('quoted'))).toBe('quote_ready')
    expect(productOrderStage(withReq('deposit_paid'))).toBe('deposit_paid')
    expect(productOrderStage(withReq('invoiced'))).toBe('shipping_paid')
    expect(productOrderStage(withReq('invoiced', 'in_transit'))).toBe('shipped')
    expect(productOrderStage(withReq('invoiced', 'delivered'))).toBe('delivered')
    expect(productOrderStage({ ...withReq('invoiced'), status: 'delivered' })).toBe('delivered')
    expect(productOrderStage({ ...base, status: 'cancelled' })).toBe('cancelled')
    expect(productOrderStage({ ...base, payment_status: 'refunded' })).toBe('cancelled')
  })
  it('asks the customer to pay only when a quote is ready', () => {
    expect(needsShippingPayment(withReq('quoted'))).toBe(true)
    expect(needsShippingPayment(withReq('received'))).toBe(false)
    expect(needsShippingPayment(withReq('invoiced'))).toBe(false)
  })
})

describe('productOrderTimeline', () => {
  it('starts with the paid purchase and then follows the cargo steps', () => {
    const t = productOrderTimeline(base)
    expect(t.steps[0].key).toBe('purchased')
    expect(t.steps.map((s) => s.key)).toEqual(['purchased', 'received', 'quoted', 'paid', 'shipped', 'in_transit', 'arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered'])
    expect(t.index).toBe(0)
  })
  it('moves along with the request and the batch', () => {
    expect(productOrderTimeline(withReq('received')).index).toBe(1)
    expect(productOrderTimeline(withReq('quoted')).index).toBe(2)
    expect(productOrderTimeline(withReq('invoiced')).index).toBe(3)
    expect(productOrderTimeline(withReq('invoiced', 'in_transit')).index).toBe(5)
    expect(productOrderTimeline({ ...withReq('invoiced'), status: 'delivered' }).index).toBe(9)
  })
})
