import { describe, expect, it } from 'vitest'
import { EN } from '@/locales/en'
import { SERVER_RULES } from '@/locales/en/server'
import { pickLocalized, plural, tr, trServer } from './i18n'

describe('French (default language)', () => {
  it('returns the source text and fills placeholders', () => {
    expect(tr('Annuler')).toBe('Annuler')
    expect(tr('{0} sur {1}', 3, 5)).toBe('3 sur 5')
  })
  it('keeps server messages untouched', () => expect(trServer('Solde insuffisant.')).toBe('Solde insuffisant.'))
  it('prefers the French text', () => expect(pickLocalized('fr', 'en')).toBe('fr'))
  it('pluralises with the French rule (0 and 1 are singular)', () => {
    expect(plural(0)).toBe('')
    expect(plural(1)).toBe('')
    expect(plural(2)).toBe('s')
  })
})

describe('server rule order', () => {
  it('matches the installment description before the generic order payment rule', () => {
    const match = (text: string) => {
      for (const [re, tpl] of SERVER_RULES) { const m = text.match(re); if (m) return tpl.replace(/\{(\d+)\}/g, (_, i: string) => m[Number(i) + 1] ?? '') }
      return null
    }
    expect(match('Paiement commande KW-123 (échéance 2/3)')).toBe('Order payment KW-123 (installment 2/3)')
    expect(match('Paiement commande KW-123')).toBe('Order payment KW-123')
  })
})

describe('English dictionary', () => {
  it('has no empty translation', () => {
    const empty = Object.entries(EN).filter(([, v]) => !v.trim()).map(([k]) => k)
    expect(empty).toEqual([])
  })

  it('only uses {n} placeholders that exist in the French source', () => {
    // French may carry extra plural-suffix placeholders that English does not need
    const placeholders = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1])
    const invented = Object.entries(EN).filter(([fr, en]) => placeholders(en).some((p) => !placeholders(fr).includes(p))).map(([fr]) => fr)
    expect(invented).toEqual([])
  })

  it('does not drop a value placeholder (the first ones must all be kept)', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]))
    const dropped = Object.entries(EN).filter(([fr, en]) => {
      const f = placeholders(fr)
      const e = placeholders(en)
      return f.length > 0 && e.length === 0
    }).map(([fr]) => fr)
    expect(dropped).toEqual([])
  })

  it('compiles every server rule', () => {
    for (const [pattern, template] of SERVER_RULES) {
      expect(pattern).toBeInstanceOf(RegExp)
      expect(typeof template).toBe('string')
    }
  })
})
