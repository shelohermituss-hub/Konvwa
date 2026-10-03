import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CheckCircle2, ScanLine, XCircle } from 'lucide-react'
import jsQR from 'jsqr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

interface Result {
  at: number
  code: string
  ok: boolean
  text: string
  received?: boolean
}

/** Reception scanner: point the camera at a package label (or type the code, or use a USB scanner). */
export function AdminScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const [on, setOn] = useState(false)
  const [denied, setDenied] = useState(false)
  const [manual, setManual] = useState('')
  const [results, setResults] = useState<Result[]>([])

  const submit = useCallback(async (raw: string) => {
    const code = raw.trim()
    const now = Date.now()
    // the camera sees the same label many times a second: ignore repeats for 4 s
    if (!code || (lastRef.current.code === code && now - lastRef.current.at < 4000)) return
    lastRef.current = { code, at: now }
    const { data, error } = await supabase.rpc('admin_scan_package', { p_code: code })
    const r = data as { success?: boolean; error?: string; customer?: string; package_no?: number; total?: number; scanned?: number; already_scanned?: boolean; received?: boolean } | null
    const ok = !error && !!r?.success
    const text = ok
      ? `${r?.customer || '—'} · ${tr('colis {0}/{1}', r?.package_no ?? 0, r?.total ?? 0)} · ${r?.already_scanned ? tr('déjà scanné') : tr('{0} scanné(s)', r?.scanned ?? 0)}${r?.received ? ` · ${tr('TOUS REÇUS')}` : ''}`
      : (r?.error ?? error?.message ?? tr('Étiquette non reconnue.'))
    if (navigator.vibrate) navigator.vibrate(ok ? 60 : [60, 60, 60])
    setResults((prev) => [{ at: now, code, ok, text, received: r?.received }, ...prev].slice(0, 30))
  }, [])

  useEffect(() => {
    if (!on) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const video = videoRef.current
    const canvas = canvasRef.current
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped || !video || !canvas) return
        video.srcObject = stream
        await video.play()
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const tick = () => {
          if (stopped) return
          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
            if (hit?.data) void submit(hit.data)
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setDenied(true)
        setOn(false)
      }
    })()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [on, submit])

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ScanLine className="h-6 w-6" />{tr('Scan à la réception')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('Scannez chaque étiquette. Quand tous les colis d\'une demande sont scannés, elle passe en « reçu » et le client est prévenu.')}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-black shadow-sm">
        <video ref={videoRef} playsInline muted className={cn('aspect-square w-full object-cover', !on && 'hidden')} />
        <canvas ref={canvasRef} className="hidden" />
        {!on && (
          <div className="flex aspect-square flex-col items-center justify-center gap-3 bg-muted text-center">
            {denied ? <CameraOff className="h-10 w-10 text-muted-foreground" /> : <Camera className="h-10 w-10 text-muted-foreground" />}
            <p className="px-6 text-sm text-muted-foreground">{denied ? tr('Caméra refusée ou indisponible. Autorisez-la, ou saisissez le code ci-dessous.') : tr('La caméra est éteinte.')}</p>
          </div>
        )}
      </div>
      <Button onClick={() => { setDenied(false); setOn((v) => !v) }} className="h-11 w-full gap-2 rounded-xl">
        {on ? <><CameraOff className="h-4 w-4" />{tr('Arrêter la caméra')}</> : <><Camera className="h-4 w-4" />{tr('Démarrer la caméra')}</>}
      </Button>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(manual); setManual('') }}>
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="KW1:…" className="rounded-xl font-mono" aria-label={tr('Code de l\'étiquette')} autoComplete="off" />
        <Button type="submit" variant="outline" className="rounded-xl" disabled={!manual.trim()}>{tr('Valider')}</Button>
      </form>

      <ul className="space-y-2" aria-live="polite">
        {results.map((r) => (
          <li key={r.at} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm', r.ok ? (r.received ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-white') : 'border-destructive/30 bg-destructive/5')}>
            {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
            <span className="min-w-0 break-words">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
