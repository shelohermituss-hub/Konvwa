import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export type AdminBadges = Partial<Record<'quotes' | 'orders' | 'product_orders' | 'cargos' | 'payments' | 'disputes' | 'kyc' | 'resellers', number>>

/** Number of new / pending items per admin section (refreshed every minute, when the tab is shown again and on navigation). */
export function useAdminBadges(): AdminBadges {
  const [badges, setBadges] = useState<AdminBadges>({})
  const { pathname } = useLocation()

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_badge_counts')
    if (data && typeof data === 'object') setBadges(data as AdminBadges)
  }, [])

  useEffect(() => { void load() }, [load, pathname])
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, 60_000)
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  return badges
}
