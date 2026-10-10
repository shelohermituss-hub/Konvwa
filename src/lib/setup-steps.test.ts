import { describe, expect, it } from 'vitest'
import { canContinue, skippedItems, validName, validPhone, type SetupState } from './setup-steps'

const empty: SetupState = { profile: false, notifications: false, notificationsUnsupported: false, passkey: false, camera: false, installed: false, address: false, mfa: false, kyc: false }

describe('setup steps', () => {
  it('validates name and phone', () => {
    expect(validName(' J ')).toBe(false)
    expect(validName('Jean Pierre')).toBe(true)
    expect(validPhone('55 62-667')).toBe(false)
    expect(validPhone('5562 6676')).toBe(true)
  })
  it('blocks required steps until satisfied', () => {
    expect(canContinue('profile', empty)).toBe(false)
    expect(canContinue('profile', { ...empty, profile: true })).toBe(true)
  })
  it('never blocks optional steps (notifications included)', () => {
    expect(canContinue('access', empty)).toBe(true)
    expect(canContinue('mfa', empty)).toBe(true)
    expect(canContinue('kyc', empty)).toBe(true)
    expect(canContinue('address', empty)).toBe(true)
  })
  it('lists what was skipped', () => {
    expect(skippedItems(empty).sort()).toEqual(['address', 'camera', 'install', 'kyc', 'mfa', 'notifications', 'passkey'])
    expect(skippedItems({ ...empty, passkey: true, mfa: true, kyc: true, address: true, camera: true, installed: true, notifications: true })).toEqual([])
  })
})
