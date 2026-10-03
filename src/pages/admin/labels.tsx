import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Info { code: string; customer: string; warehouse: string; total: number; created: string }

/** One 100×150 mm label per package, each with a QR code the reception scanner understands. */
export function AdminLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const [info, setInfo] = useState<Info | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      const { data: req } = await supabase
        .from('product_requests')
        .select('id, user_id, package_count, created_at, warehouse:warehouses(code, name)')
        .eq('id', id).eq('request_type', 'shipping').maybeSingle()
      if (!req || cancelled) { setError(true); return }
      const { data: person } = await supabase.from('profiles').select('full_name').eq('user_id', req.user_id as string).maybeSingle()
      const total = Math.min(Math.max(Number(req.package_count) || 1, 1), 100)
      const wh = req.warehouse as unknown as { code: string; name: string } | null
      const urls = await Promise.all(Array.from({ length: total }, (_, i) =>
        QRCode.toDataURL(`KW1:${req.id}:${i + 1}/${total}`, { margin: 1, width: 360, errorCorrectionLevel: 'M' })))
      if (cancelled) return
      setInfo({ code: String(req.id).slice(0, 8).toUpperCase(), customer: person?.full_name ?? '—', warehouse: wh?.code ?? wh?.name ?? '—', total, created: req.created_at as string })
      setCodes(urls)
    })().catch(() => setError(true))
    return () => { cancelled = true }
  }, [id])

  if (error) return <p className="p-8 text-center text-sm text-destructive">{tr('Demande introuvable.')}</p>
  if (!info) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary/60" /></div>

  return (
    <div>
      <style>{'@page { size: 100mm 150mm; margin: 0 } @media print { body { background: #fff } }'}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr('Étiquettes de colis')}</h1>
          <p className="text-sm text-muted-foreground">{tr('{0} étiquette(s) pour la demande #{1}. Format 100 × 150 mm.', info.total, info.code)}</p>
        </div>
        <Button onClick={() => window.print()} className="gap-2 rounded-xl"><Printer className="h-4 w-4" />{tr('Imprimer')}</Button>
      </div>

      <div className="flex flex-wrap gap-4 print:block">
        {codes.map((src, i) => (
          <section key={i} className="flex h-[150mm] w-[100mm] flex-col justify-between border border-dashed border-gray-300 bg-white p-[6mm] text-black print:break-after-page print:border-0">
            <div className="flex items-start justify-between">
              <span className="text-2xl font-black tracking-wide">KONVWA</span>
              <span className="text-right text-xs">{new Date(info.created).toLocaleDateString(DATE_LOCALE)}</span>
            </div>
            <img src={src} alt={tr('Code QR du colis {0}', i + 1)} className="mx-auto h-[62mm] w-[62mm]" />
            <div className="text-center">
              <p className="text-5xl font-black leading-none">{i + 1}<span className="text-2xl font-bold">/{info.total}</span></p>
              <p className="mt-1 text-xs uppercase tracking-widest">{tr('Colis')}</p>
            </div>
            <div className="space-y-1 border-t-2 border-black pt-2">
              <p className="truncate text-lg font-bold">{info.customer}</p>
              <p className="font-mono text-sm">#{info.code} · {info.warehouse}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
