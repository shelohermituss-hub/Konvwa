// Background removal: the model-independent part (pixels in, pixels out). The model itself runs in the browser (see cutout.ts).
// Model: Silueta (U²-Net, MIT) – input 320×320 RGB normalised like rembg, output a 320×320 "foreground" map.

export const MODEL_SIZE = 320

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/** RGBA pixels of the picture resized to 320×320 -> model input (planar CHW, scaled by the brightest value, mean/std normalised). */
export function toInput(rgba: ArrayLike<number>): Float32Array {
  const n = MODEL_SIZE * MODEL_SIZE
  let max = 1
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) if (rgba[i * 4 + c] > max) max = rgba[i * 4 + c]
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / max - MEAN[c]) / STD[c]
  return out
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** The model's 320×320 map -> alpha channel (0-255) at the picture's own size: min-max scaled, bilinear upsampled, edges tightened. */
export function toAlpha(map: ArrayLike<number>, width: number, height: number): Uint8ClampedArray {
  const S = MODEL_SIZE
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < S * S; i++) { if (map[i] < lo) lo = map[i]; if (map[i] > hi) hi = map[i] }
  const span = hi - lo || 1
  const alpha = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    const fy = Math.min(S - 1, Math.max(0, ((y + 0.5) * S) / height - 0.5))
    const y0 = Math.floor(fy), y1 = Math.min(S - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.min(S - 1, Math.max(0, ((x + 0.5) * S) / width - 0.5))
      const x0 = Math.floor(fx), x1 = Math.min(S - 1, x0 + 1), tx = fx - x0
      const v = (map[y0 * S + x0] * (1 - tx) + map[y0 * S + x1] * tx) * (1 - ty) + (map[y1 * S + x0] * (1 - tx) + map[y1 * S + x1] * tx) * ty
      alpha[y * width + x] = Math.round(255 * smooth(((v - lo) / span - 0.15) / 0.3))
    }
  }
  return alpha
}

/** Writes the alpha channel into RGBA pixels (in place). */
export function applyAlpha(rgba: Uint8ClampedArray, alpha: Uint8ClampedArray): void {
  for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i]
}

/**
 * Lenses and other enclosed areas come out of the model as uncertain blotches: every area the outside background cannot reach
 * (found by flooding from the picture's border through the transparent pixels) is made fully opaque, in place.
 */
export function fillHoles(alpha: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const outside = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  let top = 0
  const push = (i: number) => { if (!outside[i] && alpha[i] < 128) { outside[i] = 1; stack[top++] = i } }
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1) }
  while (top > 0) {
    const i = stack[--top]
    const x = i % width
    if (x > 0) push(i - 1)
    if (x < width - 1) push(i + 1)
    if (i >= width) push(i - width)
    if (i < width * (height - 1)) push(i + width)
  }
  for (let i = 0; i < alpha.length; i++) if (!outside[i]) alpha[i] = 255
  return alpha
}
