import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { channelUrl } from '@/lib/whatsapp-channel-url'

let cached: string | null | undefined

/** The KONVWA WhatsApp channel link set by the admin (Paramètres), or null while it is not set: the "follow the channel" buttons then stay hidden. */
export function useWhatsAppChannel(): string | null {
  const [url, setUrl] = useState<string | null>(cached ?? null)
  useEffect(() => {
    if (cached !== undefined) return
    let alive = true
    supabase.from('app_settings').select('value').eq('key', 'whatsapp_channel_url').maybeSingle()
      .then(({ data }) => { cached = channelUrl(data?.value); if (alive) setUrl(cached) }, () => {})
    return () => { alive = false }
  }, [])
  return url
}
