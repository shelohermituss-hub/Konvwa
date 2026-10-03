import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { tr } from '@/lib/i18n'

/** Slim banner shown while the device has no connection. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (online) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-xs font-semibold text-white">
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      {tr('Vous êtes hors ligne. Certaines actions sont indisponibles.')}
    </div>
  )
}
