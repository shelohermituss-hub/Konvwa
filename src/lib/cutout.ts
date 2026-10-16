import { supabase } from '@/lib/supabase'
import { MODEL_SIZE, applyAlpha, fillHoles, toAlpha, toInput } from '@/lib/cutout-core'
// the WebAssembly runtime is served by us (same origin): it is only fetched when the tool is used
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'
import loaderUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'

/** Longest side of a processed picture: keeps memory and the PNG size (10 MB bucket limit) under control. */
const MAX_SIDE = 1600

type Engine = { ort: typeof import('onnxruntime-web/wasm'); session: import('onnxruntime-web/wasm').InferenceSession }
let engine: Promise<Engine> | null = null

/** Loads the runtime and the model once (the 44 MB model is cached by the browser). */
function load(): Promise<Engine> {
  engine ??= (async () => {
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmPaths = { mjs: loaderUrl, wasm: wasmUrl }
    const res = await fetch(supabase.storage.from('models').getPublicUrl('silueta.onnx').data.publicUrl)
    if (!res.ok) throw new Error('model')
    const session = await ort.InferenceSession.create(new Uint8Array(await res.arrayBuffer()), { executionProviders: ['wasm'] })
    return { ort, session }
  })().catch((e) => { engine = null; throw e })
  return engine
}

/** A picture without its background: same size (at most 1600 px), transparent PNG. */
export async function removeBackground(source: Blob): Promise<Blob> {
  const { ort, session } = await load()
  const bitmap = await createImageBitmap(source)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const full = ctx.getImageData(0, 0, w, h)

  const small = document.createElement('canvas')
  small.width = MODEL_SIZE; small.height = MODEL_SIZE
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(bitmap, 0, 0, MODEL_SIZE, MODEL_SIZE)
  bitmap.close()
  const input = toInput(sctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data)

  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]) })
  const map = out[session.outputNames[0]].data as Float32Array
  applyAlpha(full.data, fillHoles(toAlpha(map, w, h), w, h))
  ctx.putImageData(full, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}
