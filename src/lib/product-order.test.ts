import { describe, expect, it } from 'vitest'
import { needsShippingPayment, productOrderStage, productOrderStep } from './product-order'

const base = { status: 'processing', payment_status: 'paid', shipping_request: null }
const withReq = (status: string) => ({ ...base, shipping_request: { status } })

describe('productOrderStage', () => {
  it('follows the same flow as a shipping request', () => {
    expect(productOrderStage({ ...base, payment_status: 'unpaid', status: 'pending' })).toBe('pending')
    expect(productOrderStage(base)).toBe('purchasing')
    expect(productOrderStage(withReq('received'))).toBe('awaiting_quote')
    expect(productOrderStage(withReq('quoted'))).toBe('quote_ready')
    expect(productOrderStage(withReq('deposit_paid'))).toBe('deposit_paid')
    expect(productOrderStage(withReq('invoiced'))).toBe('shipping_paid')
    expect(productOrderStage({ ...withReq('invoiced'), status: 'shipped' })).toBe('shipped')
    expect(productOrderStage({ ...withReq('invoiced'), status: 'delivered' })).toBe('delivered')
    expect(productOrderStage({ ...base, status: 'cancelled' })).toBe('cancelled')
    expect(productOrderStage({ ...base, payment_status: 'refunded' })).toBe('cancelled')
  })
  it('maps stages to tracker steps', () => {
    expect(productOrderStep('purchasing')).toBe(0)
    expect(productOrderStep('awaiting_quote')).toBe(1)
    expect(productOrderStep('quote_ready')).toBe(2)
    expect(productOrderStep('shipping_paid')).toBe(3)
    expect(productOrderStep('delivered')).toBe(4)
    expect(productOrderStep('cancelled')).toBe(-1)
  })
  it('asks the customer to pay only when a quote is ready', () => {
    expect(needsShippingPayment(withReq('quoted'))).toBe(true)
    expect(needsShippingPayment(withReq('received'))).toBe(false)
    expect(needsShippingPayment(withReq('invoiced'))).toBe(false)
  })
})
