import { describe, expect, it } from 'vitest'
import { accountBlock, isRestricted } from './account-access'

const NOW = new Date('2026-10-04T12:00:00Z').getTime()

describe('accountBlock', () => {
  it('lets active customers and staff through', () => {
    expect(accountBlock({ role: 'client', account_status: 'active' }, NOW)).toBeNull()
    expect(accountBlock({ role: 'admin', account_status: 'banned' }, NOW)).toBeNull()
    expect(accountBlock(null, NOW)).toBeNull()
  })
  it('blocks banned and suspended customers', () => {
    expect(accountBlock({ role: 'client', account_status: 'banned' }, NOW)).toBe('banned')
    expect(accountBlock({ role: 'client', account_status: 'suspended' }, NOW)).toBe('suspended')
  })
  it('ends a timed suspension by itself', () => {
    expect(accountBlock({ role: 'client', account_status: 'suspended', status_until: '2026-10-05T00:00:00Z' }, NOW)).toBe('suspended')
    expect(accountBlock({ role: 'client', account_status: 'suspended', status_until: '2026-10-03T00:00:00Z' }, NOW)).toBeNull()
  })
})

describe('isRestricted', () => {
  it('reads the restriction list', () => {
    expect(isRestricted({ restrictions: ['payments'] }, 'payments')).toBe(true)
    expect(isRestricted({ restrictions: ['payments'] }, 'orders')).toBe(false)
    expect(isRestricted(null, 'orders')).toBe(false)
  })
})
