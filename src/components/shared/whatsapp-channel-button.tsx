import { MessageCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { useWhatsAppChannel } from '@/lib/whatsapp-channel'

const GREEN = '#25D366'

/** "Follow our WhatsApp channel": a button (or a card) that opens the channel invitation. Nothing is shown while the admin has not set the link. */
export function WhatsAppChannelButton({ variant = 'button', className }: { variant?: 'button' | 'link' | 'card'; className?: string }) {
  const url = useWhatsAppChannel()
  if (!url) return null
  const open = { href: url, target: '_blank', rel: 'noopener noreferrer' }

  if (variant === 'link') {
    return (
      <a {...open} className={cn('inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-5 text-sm font-bold transition-colors hover:bg-[#25D366]/10', className)} style={{ borderColor: GREEN, color: '#128C4A' }}>
        <MessageCircle className="h-4 w-4" aria-hidden />{tr('Suivre notre chaîne WhatsApp')}
      </a>
    )
  }
  if (variant === 'card') {
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-4', className)}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: GREEN }}><MessageCircle className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{tr('Nos nouveautés sur WhatsApp')}</p>
          <p className="text-xs text-muted-foreground">{tr('Promotions, arrivages et nouveaux produits, directement sur votre téléphone.')}</p>
        </div>
        <a {...open} className="shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: GREEN }}>{tr('Suivre la chaîne')}</a>
      </div>
    )
  }
  return (
    <a {...open} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90', className)} style={{ background: GREEN }}>
      <MessageCircle className="h-5 w-5" aria-hidden />{tr('Suivre notre chaîne WhatsApp')}
    </a>
  )
}

const DISMISS_KEY = 'konvwa-channel-invite-dismissed'

/** The same invitation as a card that can be closed for good (kept in this browser): shown once on the dashboard. */
export function WhatsAppChannelInvite({ className }: { className?: string }) {
  const [hidden, setHidden] = useState(true)
  useEffect(() => {
    try { setHidden(localStorage.getItem(DISMISS_KEY) === '1') } catch { setHidden(false) }
  }, [])
  const url = useWhatsAppChannel()
  if (hidden || !url) return null
  return (
    <div className={cn('relative', className)}>
      <WhatsAppChannelButton variant="card" />
      <button
        type="button"
        aria-label={tr('Fermer')}
        onClick={() => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* storage unavailable */ } }}
        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-white"
      ><X className="h-3.5 w-3.5" aria-hidden /></button>
    </div>
  )
}
