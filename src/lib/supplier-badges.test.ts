import { describe, expect, it } from 'vitest'
import { flagFor, supplierLogo } from './supplier-badges'

describe('supplierLogo', () => {
  it('matches the shops on the supplier name', () => {
    expect(supplierLogo('Amazon')?.src).toBe('/brands/amazon.png')
    expect(supplierLogo('Alibaba Group Co.')?.name).toBe('Alibaba')
    expect(supplierLogo('SHEIN Official')?.src).toBe('/brands/shein.png')
    expect(supplierLogo('temu')?.src).toBe('/brands/temu.jpg')
  })
  it('returns null for other suppliers', () => {
    expect(supplierLogo('Shenzhen Tech Ltd')).toBeNull()
    expect(supplierLogo('')).toBeNull()
    expect(supplierLogo(null)).toBeNull()
  })
})

describe('flagFor', () => {
  it('finds the flags we have, whatever the case', () => {
    expect(flagFor('CN')).toEqual({ src: '/flags/cn.svg', code: 'CN' })
    expect(flagFor(' us ')?.src).toBe('/flags/us.svg')
    expect(flagFor('HT')?.src).toBe('/flags/ht.svg')
  })
  it('never builds a path from untrusted text', () => {
    expect(flagFor('../x')).toBeNull()
    expect(flagFor('FR')).toBeNull()
    expect(flagFor(undefined)).toBeNull()
  })
})
