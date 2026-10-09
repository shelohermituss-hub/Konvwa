import { describe, expect, it } from 'vitest'
import { resolveNotificationLink as r } from './notification-link'

describe('resolveNotificationLink', () => {
  it('keeps valid links', () => {
    expect(r({ link: '/orders/abc' }, 'client')).toBe('/orders/abc')
    expect(r({ link: '/product-orders/abc' }, 'client')).toBe('/product-orders/abc')
    expect(r({ link: '/admin/shipping-requests?open=1' }, 'admin')).toBe('/admin/shipping-requests?open=1')
  })
  it('maps links of pages that no longer exist', () => {
    expect(r({ link: '/expeditions' }, 'client')).toBe('/shipments')
    expect(r({ link: '/admin/orders/1234' }, 'admin')).toBe('/admin/orders')
  })
  it('does not send a customer to an admin page', () => {
    expect(r({ link: '/admin/payments' }, 'client')).toBe('/notifications')
  })
  it('finds a page when there is no link', () => {
    expect(r({ link: null, type: 'payment' }, 'client')).toBe('/wallet')
    expect(r({ link: null, title: 'Recharge confirmée' }, 'client')).toBe('/wallet')
    expect(r({ link: null, title: 'Colis reçu' }, 'client')).toBe('/shipments')
    expect(r({ link: null, title: 'Bienvenue' }, 'client')).toBe('/notifications')
  })
  it('never follows an external link', () => {
    expect(r({ link: 'https://evil.example' }, 'client')).toBe('/notifications')
    expect(r({ link: '//evil.example' }, 'client')).toBe('/notifications')
  })
  it('the home category opens the home route', () => {
    expect(r({ link: null, type: 'home', title: 'Nouveautés' }, 'client')).toBe('/')
    expect(r({ link: '/', type: 'home' }, 'client')).toBe('/')
  })
})
