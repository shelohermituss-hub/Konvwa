import { describe, expect, it } from 'vitest'
import { choose, flatHeading, initialChoice, optionsAt, partsOf, resolve, splitVariants, type DimVariant } from './variant-dimensions'

const v = (id: string, label: string, over: Partial<DimVariant & { label: string }> = {}) => ({ id, label, group_name: 'COULEUR / TAILLE', stock_available: true, image: null as string | null, ...over })
const ring = [
  v('1', 'Noir / Taille 7'), v('2', 'Noir / Taille 8', { image: 'n.jpg' }), v('3', 'Rose / Taille 7', { stock_available: false }), v('4', 'Rose / Taille 8', { image: 'r.jpg' }), v('5', 'Blanc / Taille 7'),
]
const dims = splitVariants(ring, (x) => x.label)!

describe('splitVariants', () => {
  it('splits a colour / size product into its dimensions', () => {
    expect(dims.names).toEqual(['COULEUR', 'TAILLE'])
    expect(dims.rows[0].parts).toEqual(['Noir', 'Taille 7'])
  })
  it('gives up (flat list) when the variants are not one complete choice each', () => {
    expect(splitVariants([v('1', 'Noir'), v('2', 'Rose')], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7', { group_name: null }), v('2', 'Rose / 7', { group_name: null })], (x) => x.label)?.names).toEqual(['', ''])
    expect(splitVariants([v('1', 'Noir / 7', { group_name: 'COULEUR' }), v('2', 'Rose / 7', { group_name: 'COULEUR' })], (x) => x.label)?.names).toEqual(['', ''])
    expect(splitVariants([v('1', 'Noir / 7'), v('2', 'Rose / 7', { group_name: 'AUTRE / TAILLE' })], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7'), v('2', 'Noir / 7')], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7')], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7'), v('2', 'Rose')], (x) => x.label)).toBeNull()
  })
})

describe('optionsAt', () => {
  it('lists the colours in order, with a picture and whether one is in stock', () => {
    const colours = optionsAt(dims, [], 0)
    expect(colours.map((o) => o.value)).toEqual(['Noir', 'Rose', 'Blanc'])
    expect(colours.find((o) => o.value === 'Noir')?.image).toBe('n.jpg')
    expect(colours.every((o) => o.available)).toBe(true)
  })
  it('lists only the sizes that exist in the chosen colour, and marks the ones out of stock', () => {
    expect(optionsAt(dims, ['Blanc'], 1).map((o) => o.value)).toEqual(['Taille 7'])
    const rose = optionsAt(dims, ['Rose'], 1)
    expect(rose.map((o) => [o.value, o.available])).toEqual([['Taille 7', false], ['Taille 8', true]])
  })
})

describe('choose and resolve', () => {
  it('resolves a variant only when every dimension is chosen', () => {
    expect(resolve(dims, ['Noir'])).toBeNull()
    expect(resolve(dims, ['Noir', 'Taille 8'])?.id).toBe('2')
  })
  it('keeps the size when changing the colour if it exists, otherwise picks the only one left or drops it', () => {
    expect(choose(dims, ['Noir', 'Taille 8'], 0, 'Rose')).toEqual(['Rose', 'Taille 8'])
    expect(choose(dims, ['Noir', 'Taille 8'], 0, 'Blanc')).toEqual(['Blanc', 'Taille 7'])
    expect(choose(dims, ['Noir', 'Taille 7'], 0, 'Rose')).toEqual(['Rose'])
    expect(choose(dims, [], 0, 'Noir')).toEqual(['Noir'])
  })
  it('knows the choices of a variant', () => {
    expect(partsOf(dims, '4')).toEqual(['Rose', 'Taille 8'])
    expect(partsOf(dims, null)).toEqual([])
  })
})

describe('other shapes of variants', () => {
  it('splits three dimensions, naming the ones the group does not name with an empty name', () => {
    const three = [v('1', 'Minuit / 16GB / 512GB'), v('2', 'Argent / 16GB / 512GB'), v('3', 'Argent / 32GB / 1TB')]
    const d = splitVariants(three, (x) => x.label)!
    expect(d.names).toEqual(['COULEUR', 'TAILLE', ''])
    expect(optionsAt(d, ['Argent'], 1).map((o) => o.value)).toEqual(['16GB', '32GB'])
    const free = splitVariants([v('1', 'A / x', { group_name: null }), v('2', 'B / x', { group_name: null })], (x) => x.label)!
    expect(free.names).toEqual(['', ''])
  })
  it('chooses by itself a dimension that has one single value', () => {
    const d = splitVariants([v('1', 'Noir / 7'), v('2', 'Noir / 8'), v('3', 'Rose / 7')], (x) => x.label)!
    expect(choose(d, [], 0, 'Rose')).toEqual(['Rose', '7'])
    expect(resolve(d, choose(d, [], 0, 'Rose'))?.id).toBe('3')
    expect(choose(d, [], 0, 'Noir')).toEqual(['Noir'])
    const one = splitVariants([v('1', 'Noir / 7'), v('2', 'Rose / 7')], (x) => x.label)!
    expect(initialChoice(one)).toEqual([])
    const same = splitVariants([v('1', 'Standard / 7'), v('2', 'Standard / 8')], (x) => x.label)!
    expect(initialChoice(same)).toEqual(['Standard'])
  })
  it('heads a single list of sizes "Taille" and a single list of colours "Couleur"', () => {
    expect(flatHeading('Couleur / Taille', ['1 Pack', '4 Pack'], 'Options')).toBe('Taille')
    expect(flatHeading('Couleur / Taille', ['5,07 fl.oz (1 unité)'], 'Options')).toBe('Taille')
    expect(flatHeading('Couleur / Taille', ['Gris', 'Noir'], 'Options')).toBe('Couleur')
    expect(flatHeading('Options', ['Black', 'Silver'], 'Options')).toBe('Options')
    expect(flatHeading(null, ['60 VCaps'], 'Options')).toBe('Options')
  })
})
