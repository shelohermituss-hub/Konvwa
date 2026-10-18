import { ExternalLink } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AutoPostPanel } from '@/components/shared/auto-post-panel'
import { SocialCalendarPanel } from '@/components/shared/social-calendar-panel'
import { SocialProductsPanel } from '@/components/shared/social-products-panel'
import { WhatsAppGlyph } from '@/components/shared/whatsapp-glyph'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWhatsAppChannel } from '@/lib/whatsapp-channel'
import { tr } from '@/lib/i18n'

const TABS = ['calendar', 'auto', 'products'] as const
type Tab = (typeof TABS)[number]

/** Admin: everything about the shop's social networks: the editorial calendar of posters, the daily automatic product posters, and manual posts / WhatsApp shares. */
export function AdminSocialPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = TABS.find((t) => t === raw) ?? 'calendar'
  const channel = useWhatsAppChannel()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr('Réseaux sociaux')}</h1>
          <p className="text-sm text-muted-foreground">{tr('Facebook, Instagram et WhatsApp : affiches planifiées, publications automatiques et partages.')}</p>
        </div>
        {channel && (
          <a href={channel} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50">
            <WhatsAppGlyph className="h-4 w-4 text-[#25D366]" />{tr('Chaîne WhatsApp')}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams(v === 'calendar' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="calendar" className="flex-none">{tr('Calendrier d\'affiches')}</TabsTrigger>
          <TabsTrigger value="auto" className="flex-none">{tr('Publication automatique')}</TabsTrigger>
          <TabsTrigger value="products" className="flex-none">{tr('Produits à publier')}</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="pt-3"><SocialCalendarPanel /></TabsContent>
        <TabsContent value="auto" className="pt-3"><AutoPostPanel /></TabsContent>
        <TabsContent value="products" className="pt-3"><SocialProductsPanel /></TabsContent>
      </Tabs>
    </div>
  )
}
