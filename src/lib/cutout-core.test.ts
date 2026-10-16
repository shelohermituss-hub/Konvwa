import { describe, expect, it } from 'vitest'
import { MODEL_SIZE, applyAlpha, fillHoles, toAlpha, toInput } from './cutout-core'

const S = MODEL_SIZE

describe('cutout core', () => {
  it('turns pixels into a planar, normalised model input', () => {
    const rgba = new Uint8ClampedArray(S * S * 4).fill(255)
    const input = toInput(rgba)
    expect(input).toHaveLength(3 * S * S)
    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229, 5)
    expect(input[S * S]).toBeCloseTo((1 - 0.456) / 0.224, 5)
  })

  it('upsamples the map to the picture size and makes a clean edge', () => {
    const map = new Float32Array(S * S)
    for (let y = 0; y < S; y++) for (let x = S / 2; x < S; x++) map[y * S + x] = 1 // right half is the subject
    const alpha = toAlpha(map, 640, 480)
    expect(alpha).toHaveLength(640 * 480)
    expect(alpha[10 * 640 + 20]).toBe(0)
    expect(alpha[10 * 640 + 620]).toBe(255)
  })

  it('writes the alpha channel into the pixels', () => {
    const px = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    applyAlpha(px, new Uint8ClampedArray([0, 128]))
    expect(Array.from(px)).toEqual([10, 20, 30, 0, 40, 50, 60, 128])
  })

  it('fills the areas enclosed by the subject (lenses) but not the outside', () => {
    const w = 40, h = 40
    const a = new Uint8ClampedArray(w * h)
    for (let y = 5; y < 35; y++) for (let x = 5; x < 35; x++) a[y * w + x] = 255 // a ring: solid square...
    for (let y = 15; y < 25; y++) for (let x = 15; x < 25; x++) a[y * w + x] = 40 // ...with an uncertain hole in the middle
    fillHoles(a, w, h)
    expect(a[20 * w + 20]).toBe(255)
    expect(a[2 * w + 2]).toBe(0)
  })
})
