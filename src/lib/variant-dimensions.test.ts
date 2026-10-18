import { describe, expect, it } from 'vitest'
import { choose, optionsAt, partsOf, resolve, splitVariants, type DimVariant } from './variant-dimensions'

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
    expect(splitVariants([v('1', 'Noir / 7', { group_name: 'COULEUR' }), v('2', 'Rose / 7', { group_name: 'COULEUR' })], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7'), v('2', 'Rose / 7', { group_name: 'AUTRE / TAILLE' })], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7'), v('2', 'Noir / 7')], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7')], (x) => x.label)).toBeNull()
    expect(splitVariants([v('1', 'Noir / 7 / L'), v('2', 'Rose / 7 / L')], (x) => x.label)).toBeNull()
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
  it('keeps the size when changing the colour if it exists, drops it otherwise', () => {
    expect(choose(dims, ['Noir', 'Taille 8'], 0, 'Rose')).toEqual(['Rose', 'Taille 8'])
    expect(choose(dims, ['Noir', 'Taille 8'], 0, 'Blanc')).toEqual(['Blanc'])
    expect(choose(dims, ['Noir', 'Taille 7'], 0, 'Rose')).toEqual(['Rose'])
    expect(choose(dims, [], 0, 'Noir')).toEqual(['Noir'])
  })
  it('knows the choices of a variant', () => {
    expect(partsOf(dims, '4')).toEqual(['Rose', 'Taille 8'])
    expect(partsOf(dims, null)).toEqual([])
  })
})
