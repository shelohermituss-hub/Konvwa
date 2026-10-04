import { describe, expect, it } from 'vitest'
import { pdfSafe } from './pdf'

describe('pdfSafe', () => {
  it('replaces the narrow no-break spaces of formatted numbers', () => {
    expect(pdfSafe('13 191,00')).toBe('13 191,00')
    expect(pdfSafe('1 000')).toBe('1 000')
  })
  it('turns arrows into ASCII and drops emoji', () => {
    expect(pdfSafe('Chine → Haïti')).toBe('Chine > Haïti')
    expect(pdfSafe('\u{1F1E8}\u{1F1F3} Shenzhen')).toBe(' Shenzhen')
  })
  it('keeps accents, dashes and the euro sign', () => {
    expect(pdfSafe('Expédition séparée — 60–70 jours · 5 €')).toBe('Expédition séparée — 60–70 jours · 5 €')
  })
})
