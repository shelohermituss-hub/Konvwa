import { useState } from 'react'
import { ChevronDown, Loader2, Megaphone, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { WhatsAppGlyph } from '@/components/shared/whatsapp-glyph'
import { useWhatsAppChannel } from '@/lib/whatsapp-channel'
import { prepareChannelPost, shareOnWhatsApp, type Shareable } from '@/lib/whatsapp-share'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'

interface Props {
  /** The poster and its text, built when the admin picks an action (it may take a moment). */
  build: () => Promise<Shareable>
  size?: 'sm' | 'default'
  /** Only the WhatsApp logo (for a row of icon buttons). */
  iconOnly?: boolean
  className?: string
  disabled?: boolean
}

/**
 * "Partager sur WhatsApp": sends a poster and its text to a contact or a group (share sheet on a phone, download + WhatsApp link elsewhere), or prepares a post for the
 * WhatsApp channel (picture downloaded, text copied, channel opened) when the channel link is set in the settings.
 */
export function WhatsAppShareMenu({ build, size = 'sm', iconOnly, className, disabled }: Props) {
  const channel = useWhatsAppChannel()
  const [busy, setBusy] = useState(false)

  async function run(kind: 'share' | 'channel') {
    setBusy(true)
    try {
      const s = await build()
      if (kind === 'share') {
        const r = await shareOnWhatsApp(s)
        if (r.result === 'fallback') {
          toast.success(tr('Affiche téléchargée : joignez-la à votre message WhatsApp.'), {
            duration: 12000,
            ...(r.blocked ? { action: { label: tr('Ouvrir WhatsApp'), onClick: () => window.open(r.link, '_blank', 'noopener,noreferrer') } } : {}),
          })
        }
      } else if (channel) {
        const r = await prepareChannelPost(s, channel)
        toast.success(r.copied ? tr('Affiche téléchargée, texte copié : collez-le dans la chaîne.') : tr('Affiche téléchargée. Copiez le texte à la main.'), {
          duration: 12000,
          ...(r.blocked ? { action: { label: tr('Ouvrir la chaîne'), onClick: () => window.open(channel, '_blank', 'noopener,noreferrer') } } : {}),
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Erreur réseau'), { duration: 10000 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button" size={iconOnly ? 'icon' : size} variant={iconOnly ? 'ghost' : 'outline'} disabled={disabled || busy}
          aria-label={iconOnly ? tr('Partager sur WhatsApp') : undefined} title={iconOnly ? tr('Partager sur WhatsApp') : undefined}
          className={cn('rounded-xl', iconOnly ? 'h-8 w-8' : 'gap-1.5', className)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppGlyph className="h-4 w-4 text-[#1FA855]" />}
          {!iconOnly && <>{tr('Partager sur WhatsApp')}<ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden /></>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onSelect={() => void run('share')} className="items-start gap-2">
          <Send className="mt-0.5 h-4 w-4" aria-hidden />
          <span>
            <span className="block font-medium">{tr('Envoyer à un contact ou un groupe')}</span>
            <span className="block text-xs text-muted-foreground">{tr('Sur téléphone, l\'affiche et le texte partent directement.')}</span>
          </span>
        </DropdownMenuItem>
        {channel && (
          <DropdownMenuItem onSelect={() => void run('channel')} className="items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4" aria-hidden />
            <span>
              <span className="block font-medium">{tr('Publier dans la chaîne WhatsApp')}</span>
              <span className="block text-xs text-muted-foreground">{tr('Télécharge l\'affiche, copie le texte et ouvre la chaîne.')}</span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
