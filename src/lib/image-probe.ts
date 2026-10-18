// Checks in the browser that picture links open, the way a customer's browser opens them. A picture that does not open at all (error, or an empty 1-pixel one)
// is "broken"; one that is merely slow is not: only a clear failure is reported.

const TIMEOUT_MS = 12000

/** Loads one picture. `true` = it opens, `false` = it does not, `null` = no answer in time (not reported as broken). */
export function probeImage(url: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => { img.src = ''; resolve(null) }, TIMEOUT_MS)
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth >= 40 && img.naturalHeight >= 40) }
    img.onerror = () => { clearTimeout(timer); resolve(false) }
    img.decoding = 'async'
    img.src = url
  })
}

/**
 * Probes the links with a few loads at a time; `onProgress` is told how many were done, and the links that do not open are returned.
 * `signal` stops the check (what was found so far is returned).
 */
export async function probeImages(urls: string[], onProgress: (done: number, broken: number) => void, signal: AbortSignal, parallel = 8): Promise<Set<string>> {
  const broken = new Set<string>()
  let next = 0; let done = 0
  async function worker() {
    while (!signal.aborted) {
      const i = next++
      if (i >= urls.length) return
      if ((await probeImage(urls[i])) === false) broken.add(urls[i])
      onProgress(++done, broken.size)
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, urls.length) }, worker))
  return broken
}
