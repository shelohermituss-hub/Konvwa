import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const STORAGE_KEY = 'konvwa-scroll'
const MAX_ENTRIES = 60
const RESTORE_MS = 3000

type Pos = { c: number; w: number }

function load(): Record<string, Pos> {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Pos> } catch { return {} }
}
function save(map: Record<string, Pos>): void {
  const keys = Object.keys(map)
  if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[k]
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map)) } catch { /* storage blocked: positions just are not kept */ }
}

/**
 * Every page has its own scroll position:
 *  - a new page (link, button) starts at the top, whatever the previous page was scrolled to;
 *  - going back / forward puts each page back where it was, even when its content arrives late (the position is retried until the page is tall enough).
 * `container` is the scrolling element of the layout; pages that scroll the window itself are handled too.
 */
export function useScrollManager(container: RefObject<HTMLElement | null>): void {
  const location = useLocation()
  const navType = useNavigationType()
  const keyRef = useRef(location.key)
  const restoring = useRef(false)
  const positions = useRef<Record<string, Pos>>(load())

  // remember where the user is, for the page they are on
  useEffect(() => {
    const el = container.current
    let raf = 0
    const record = () => {
      raf = 0
      if (restoring.current) return
      positions.current[keyRef.current] = { c: el?.scrollTop ?? 0, w: window.scrollY }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(record) }
    const flush = () => { record(); save(positions.current) }
    el?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      el?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [container])

  useLayoutEffect(() => {
    const el = container.current
    // the position left by the page we are coming from has been recorded by the scroll listener
    save(positions.current)
    keyRef.current = location.key
    const target = navType === 'POP' ? positions.current[location.key] : undefined

    if (!target || (target.c < 2 && target.w < 2)) {
      restoring.current = false
      if (!location.hash) {
        if (el) el.scrollTop = 0
        window.scrollTo(0, 0)
      }
      return
    }

    // back / forward: retry until the page is tall enough (data and images may still be loading)
    restoring.current = true
    const started = performance.now()
    let raf = 0
    let stopped = false
    const stop = () => { if (stopped) return; stopped = true; restoring.current = false; cancelAnimationFrame(raf) }
    const step = () => {
      if (stopped) return
      if (el) el.scrollTop = target.c
      if (target.w > 0) window.scrollTo(0, target.w)
      const okC = !el || Math.abs(el.scrollTop - target.c) < 2
      const okW = target.w <= 0 || Math.abs(window.scrollY - target.w) < 2
      if ((okC && okW) || performance.now() - started > RESTORE_MS) { stop(); return }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // the user taking over cancels the restoration
    const cancel = () => stop()
    window.addEventListener('wheel', cancel, { passive: true, once: true })
    window.addEventListener('touchstart', cancel, { passive: true, once: true })
    window.addEventListener('keydown', cancel, { once: true })
    return () => {
      stop()
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('keydown', cancel)
    }
  }, [location.key, location.hash, navType, container])
}
