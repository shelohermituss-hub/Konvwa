import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

let cached: Record<string, string> | null = null

/** Logo of the carrier of each shipping rate (rate id -> https address), set by the admin: shown next to the rate when the customer chooses a method. */
export function useCarrierLogos(): Record<string, string> {
  const [logos, setLogos] = useState<Record<string, string>>(cached ?? {})
  useEffect(() => {
    if (cached) return
    let alive = true
    supabase.from('shipping_rates').select('id, carrier_logo_url').not('carrier_logo_url', 'is', null)
      .then(({ data, error }) => {
        if (error || !alive) return
        cached = Object.fromEntries((data ?? []).filter((r) => typeof r.carrier_logo_url === 'string' && /^https:\/\//i.test(r.carrier_logo_url)).map((r) => [r.id as string, r.carrier_logo_url as string]))
        setLogos(cached)
      }, () => {})
    return () => { alive = false }
  }, [])
  return logos
}
