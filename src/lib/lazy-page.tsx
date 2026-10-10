import { lazy, Suspense, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'

/** Small centred spinner shown while a page's code downloads (the first visit to that page only). */
function PageFallback() {
  return <div className="flex min-h-[40vh] w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="…" /></div>
}

/**
 * A page whose code is downloaded when it is first opened, not with the first screen: a visitor only pays for the pages he visits.
 * Accepts layouts and guards that take children as well.
 */
export function page<P extends object = object>(load: () => Promise<Record<string, unknown>>, name: string) {
  const C = lazy(async () => ({ default: (await load())[name] as ComponentType<P> }))
  return function LazyPage(props: P) {
    return <Suspense fallback={<PageFallback />}><C {...props} /></Suspense>
  }
}
