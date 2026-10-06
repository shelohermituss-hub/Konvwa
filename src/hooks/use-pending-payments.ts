import { useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { verifyPayment } from '@/lib/payment-api'
import { tr } from '@/lib/i18n'

/**
 * A customer may pay at MonCash / NatCash and close the page before coming back. On opening the app, the checkout payments still
 * waiting (last 24 h) are asked to the gateway again: if it confirmed them the orders are placed, if not nothing happens.
 */
export function usePendingPayments(userId: string | undefined, onOrdered?: () => void) {
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data } = await supabase.from('checkout_intents').select('reference, source').eq('user_id', userId).eq('status', 'pending').gte('created_at', since).order('created_at', { ascending: false }).limit(3)
      for (const row of (data ?? []) as Array<{ reference: string; source: string }>) {
        if (cancelled) return
        const r = await verifyPayment(row.reference).catch(() => null)
        if (r?.kind === 'checkout' && r.verified) {
          if (r.ok) {
            if (row.source === 'cart') await supabase.from('cart_items').delete().eq('user_id', userId)
            toast.success(tr('Votre paiement a été validé : commande passée.'))
            onOrdered?.()
          } else {
            toast.warning(tr('Paiement reçu, mais la commande n\'a pas pu être passée : le montant est sur votre portefeuille.'))
          }
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
}
