import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { tr } from '@/lib/i18n'

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** An ad video that plays while at least half of it is on screen, pauses once scrolled away, and starts muted. */
export function useAdVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !prefersReducedMotion()) void el.play().catch(() => {})
      else el.pause()
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
    if (!el.muted) void el.play().catch(() => {})
  }, [])

  return { ref, muted, toggle }
}

/** Round sound button laid over a video; keep it outside any link or button wrapping the video. */
export function MuteButton({ muted, onToggle, className = '' }: { muted: boolean; onToggle: () => void; className?: string }) {
  const Icon = muted ? VolumeX : Volume2
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? tr('Activer le son') : tr('Couper le son')}
      aria-pressed={!muted}
      className={`absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}
