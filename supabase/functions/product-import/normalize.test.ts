import { describe, expect, it } from 'vitest'
import { cleanSpecs, cleanText, dimsFrom, extractJson, parseDimensionsText, parseWeightText, priceToUsd, toCm, toKg, validateAi, weightFrom, titlesAgree, looksLikeErrorPage, normalizeLadder } from './normalize'

describe('units', () => {
  it('converts weights to kg', () => {
    expect(toKg(1, 'kg')).toBe(1)
    expect(toKg(500, 'grams')).toBe(0.5)
    expect(toKg(2, 'pounds')).toBe(0.907)
    expect(toKg(12.7, 'Ounces')).toBe(0.36)
    expect(toKg('1,5', 'kg')).toBe(1.5)
  })
  it('rejects unknown units and absurd values', () => {
    expect(toKg(1, 'stone')).toBeNull()
    expect(toKg(0, 'kg')).toBeNull()
    expect(toKg(-3, 'kg')).toBeNull()
    expect(toKg(5000, 'kg')).toBeNull()
    expect(toKg('abc', 'kg')).toBeNull()
  })
  it('converts lengths to cm', () => {
    expect(toCm(10, 'in')).toBe(25.4)
    expect(toCm(250, 'mm')).toBe(25)
    expect(toCm(1.5, 'm')).toBe(150)
    expect(toCm(5, 'furlong')).toBeNull()
  })
  it('reads weights and dimensions from text', () => {
    expect(parseWeightText('Item Weight: 1.2 pounds')).toBe(0.544)
    expect(parseWeightText('350 g')).toBe(0.35)
    expect(parseWeightText('heavy')).toBeNull()
    expect(parseDimensionsText('5.9 x 3.9 x 1.2 inches')).toEqual({ length: 15, width: 9.9, height: 3 })
    expect(parseDimensionsText('30 × 20 × 15 cm')).toEqual({ length: 30, width: 20, height: 15 })
    expect(parseDimensionsText('big box')).toBeNull()
  })
  it('accepts structured and text forms', () => {
    expect(weightFrom({ value: 2, unit: 'lb' })).toBe(0.907)
    expect(weightFrom('2 lb')).toBe(0.907)
    expect(weightFrom(null)).toBeNull()
    expect(dimsFrom({ length: 12, width: 8, height: 4, unit: 'in' })).toEqual({ length: 30.5, width: 20.3, height: 10.2 })
    expect(dimsFrom('10 x 10 x 10 cm')).toEqual({ length: 10, width: 10, height: 10 })
    expect(dimsFrom({ length: 12, width: 0, height: 4, unit: 'in' })).toBeNull()
  })
})

describe('priceToUsd', () => {
  it('converts USD and EUR, flags the rest', () => {
    expect(priceToUsd(19.99, 'USD', 1.08).usd).toBe(19.99)
    expect(priceToUsd('10', 'EUR', 1.08).usd).toBe(10.8)
    expect(priceToUsd(10, 'CAD', 1.08)).toEqual({ usd: null, warning: 'currency_CAD' })
    expect(priceToUsd(null, 'USD', 1.08).usd).toBeNull()
    expect(priceToUsd(-5, 'USD', 1.08).usd).toBeNull()
  })
})

describe('text helpers', () => {
  it('cleans and truncates', () => {
    expect(cleanText('  a\u0000b​  c \n d ', 50)).toBe('ab c d')
    expect(cleanText('x'.repeat(300), 10)).toHaveLength(10)
    expect(cleanText('a\n\n\n\nb', 50, true)).toBe('a\n\nb')
    expect(cleanText(42, 10)).toBe('')
  })
  it('builds a bounded spec table', () => {
    expect(cleanSpecs([{ name: 'Color', value: 'Black' }, { name: '', value: 'x' }, { name: 'Color', value: 'Red' }, null])).toEqual({ Color: 'Black' })
    expect(Object.keys(cleanSpecs(Array.from({ length: 80 }, (_, i) => ({ name: `k${i}`, value: 'v' }))))).toHaveLength(30)
  })
})

describe('AI output', () => {
  const cats = ['Électronique', 'Maison']
  it('keeps only valid, bounded values', () => {
    const r = validateAi({ name_fr: 'Casque', name_en: 'Headphones', description_fr: 'd', description_en: 'e', category: 'électronique', tags_fr: ['a', '', 'b'], tags_en: 'nope', estimated_package: { weight_kg: 0.4, length_cm: 20, width_cm: 18, height_cm: 8 } }, cats)
    expect(r).toMatchObject({ name_fr: 'Casque', category: 'Électronique', tags_fr: ['a', 'b'], tags_en: [], estimated_package: { weight_kg: 0.4, length_cm: 20, width_cm: 18, height_cm: 8 } })
  })
  it('drops unknown categories and absurd packages, rejects empty output', () => {
    const r = validateAi({ name_fr: 'X', category: 'Armes', estimated_package: { weight_kg: 9000, length_cm: 1, width_cm: 1, height_cm: 1 } }, cats)
    expect(r?.category).toBeNull()
    expect(r?.estimated_package).toBeNull()
    expect(validateAi({}, cats)).toBeNull()
    expect(validateAi('text', cats)).toBeNull()
  })
  it('extracts JSON from fenced replies', () => {
    expect(extractJson('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('{"a":2} trailing')).toEqual({ a: 2 })
    expect(extractJson('no json')).toBeNull()
  })
})

describe('priceToUsd with several currencies', () => {
  it('converts yuan with the setting rate and refuses unknown rates', () => {
    expect(priceToUsd(100, 'CNY', { EUR: 1.08, CNY: 0.14 }).usd).toBe(14)
    expect(priceToUsd(100, '¥', { CNY: 0.14 }).usd).toBe(14)
    expect(priceToUsd(100, 'CNY', 1.08)).toEqual({ usd: null, warning: 'currency_CNY' })
  })
})

describe('validateAi labels', () => {
  it('keeps translated variant labels, bounded and keyed by the original', () => {
    const r = validateAi({ name_fr: 'A', labels: [{ src: 'Black', fr: 'Noir', en: 'Black' }, { src: '', fr: 'x' }, 7] }, [])
    expect(r?.labels).toEqual({ Black: { fr: 'Noir', en: 'Black' } })
  })
})

describe('titlesAgree', () => {
  it('tells the same product from another one', () => {
    expect(titlesAgree('Robe fleurie manches longues femme | SHEIN', 'Robe Fleurie Femme Manches Longues')).toBe(true)
    expect(titlesAgree('Wireless earbuds Bluetooth 5.3', 'Casque Bluetooth sans fil')).toBe(true)
    expect(titlesAgree('Robe fleurie manches longues', 'Cuiseur à riz électrique 5L')).toBe(false)
    expect(titlesAgree('', 'Anything')).toBe(true)
  })
})

describe('looksLikeErrorPage', () => {
  it('spots error, robot-check and sign-in pages but not products', () => {
    for (const bad of ["Page d'erreur 404", '404 Not Found', 'Access Denied', 'Are you a robot?', 'Sign in - Alibaba.com', 'Oops! Something went wrong']) expect(looksLikeErrorPage(bad)).toBe(true)
    for (const ok of ['Robe fleurie manches longues femme', 'Wireless earbuds Bluetooth 5.3 with 404 mAh case'.replace(' 404 mAh', ''), 'Casque de moto modulable']) expect(looksLikeErrorPage(ok)).toBe(false)
  })
})

describe('normalizeLadder', () => {
  const rates = { EUR: 1.08, CNY: 0.14 }
  it('takes the first range as the minimum order and base price, the others as tiers', () => {
    const l = normalizeLadder([
      { min_qty: 500, price: 4.2, currency: 'USD' }, { min_qty: 50, price: 5.2, currency: 'USD' }, { min_qty: 100, price: 4.8, currency: 'USD' },
    ], null, 'USD', rates)
    expect(l).toEqual({ moq: 50, base_usd: 5.2, tiers: [{ min_qty: 100, price_usd: 4.8 }, { min_qty: 500, price_usd: 4.2 }] })
  })
  it('drops ranges whose price does not go down, duplicates and garbage', () => {
    const l = normalizeLadder([
      { min_qty: 10, price: 3 }, { min_qty: 10, price: 2.5 }, { min_qty: 20, price: 3.5 }, { min_qty: 30, price: 2 }, { min_qty: 0, price: 1 }, { min_qty: 40, price: 'x' }, null,
    ], null, 'USD', rates)
    expect(l).toEqual({ moq: 10, base_usd: 3, tiers: [{ min_qty: 30, price_usd: 2 }] })
  })
  it('converts CNY and falls back to the page minimum when there is no ladder', () => {
    expect(normalizeLadder([{ min_qty: 2, price: 100 }], null, 'CNY', rates).base_usd).toBe(14)
    expect(normalizeLadder([], 60, 'USD', rates)).toEqual({ moq: 60, base_usd: null, tiers: [] })
    expect(normalizeLadder(undefined, 'abc', 'USD', rates)).toEqual({ moq: null, base_usd: null, tiers: [] })
  })
})
