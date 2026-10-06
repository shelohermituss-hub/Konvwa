import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { tr } from '@/lib/i18n'

const MAX_SCALE = 5

interface View { scale: number; x: number; y: number }
const RESET: View = { scale: 1, x: 0, y: 0 }

/**
 * Full-screen picture viewer: pinch, double tap / double click, wheel or buttons to zoom, drag to move a zoomed picture,
 * swipe (or arrows) to change picture. Escape or × closes it.
 */
export function ImageViewer({ images, index, onIndexChange, onClose, alt }: {
  images: string[]; index: number; onIndexChange: (i: number) => void; onClose: () => void; alt: string
}) {
  const [view, setView] = useState<View>(RESET)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; scale: number } | null>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)
  const lastTap = useRef(0)
  const swipeStart = useRef<number | null>(null)

  const go = useCallback((delta: number) => {
    const next = index + delta
    if (next < 0 || next >= images.length) return
    setView(RESET)
    onIndexChange(next)
  }, [index, images.length, onIndexChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [go, onClose])

  const zoomTo = (scale: number) => setView((v) => {
    const s = Math.min(MAX_SCALE, Math.max(1, scale))
    return s === 1 ? RESET : { ...v, scale: s }
  })

  function onPointerDown(e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale }
      drag.current = null
      swipeStart.current = null
    } else {
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
      swipeStart.current = view.scale === 1 ? e.clientX : null
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const s = Math.min(MAX_SCALE, Math.max(1, gesture.current.scale * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.dist)))
      setView((v) => (s === 1 ? RESET : { ...v, scale: s }))
    } else if (drag.current && view.scale > 1) {
      const dx = e.clientX - drag.current.x; const dy = e.clientY - drag.current.y
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true
      setView((v) => ({ ...v, x: drag.current ? drag.current.vx + dx : v.x, y: drag.current ? drag.current.vy + dy : v.y }))
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasDrag = drag.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    if (pointers.current.size > 0) return
    drag.current = null
    if (swipeStart.current !== null) {
      const dx = e.clientX - swipeStart.current
      swipeStart.current = null
      if (Math.abs(dx) > 60) { go(dx < 0 ? 1 : -1); return }
    }
    // double tap / double click toggles the zoom
    if (!wasDrag?.moved) {
      const now = Date.now()
      if (now - lastTap.current < 300) { setView((v) => (v.scale > 1 ? RESET : { scale: 2.5, x: 0, y: 0 })); lastTap.current = 0 } else lastTap.current = now
    }
  }

  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 disabled:opacity-30'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-white">
        <span className="text-sm font-semibold tabular-nums">{index + 1} / {images.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} onClick={() => zoomTo(view.scale - 1)} disabled={view.scale <= 1} aria-label={tr('Dézoomer')}><ZoomOut className="h-5 w-5" /></button>
          <button type="button" className={btn} onClick={() => zoomTo(view.scale + 1)} disabled={view.scale >= MAX_SCALE} aria-label={tr('Zoomer')}><ZoomIn className="h-5 w-5" /></button>
          <button type="button" className={btn} onClick={onClose} aria-label={tr('Fermer')}><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onWheel={(e) => zoomTo(view.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2))}
      >
        <img
          src={images[index]} alt={alt} draggable={false}
          className="max-h-full max-w-full object-contain will-change-transform"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, cursor: view.scale > 1 ? 'grab' : 'zoom-in', transition: pointers.current.size ? 'none' : 'transform 150ms ease-out' }}
        />
        {images.length > 1 && (
          <>
            <button type="button" className={`${btn} absolute left-3 top-1/2 hidden -translate-y-1/2 sm:flex`} onClick={() => go(-1)} disabled={index === 0} aria-label={tr('Photo précédente')}><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" className={`${btn} absolute right-3 top-1/2 hidden -translate-y-1/2 sm:flex`} onClick={() => go(1)} disabled={index === images.length - 1} aria-label={tr('Photo suivante')}><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
      </div>
      <p className="pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2 text-center text-xs text-white/60">{tr('Pincez ou touchez deux fois pour zoomer')}</p>
    </div>,
    document.body,
  )
}
