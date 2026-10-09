/**
 * Where a notification leads. Old notifications carry links of pages that no longer exist or have no link at all:
 * they are mapped to the closest valid page so a click always opens the right place. Only in-app paths are followed.
 */
export interface NotifLinkInput { link: string | null; type?: string | null; title?: string | null }

const STAFF_ROLES = ['admin', 'manager', 'agent']

export function resolveNotificationLink(n: NotifLinkInput, role?: string | null): string {
  const staff = !!role && STAFF_ROLES.includes(role)
  let link = (n.link ?? '').trim()

  if (!link || !link.startsWith('/') || link.startsWith('//')) {
    // the "home" category: a visitor lands on the product feed, a customer on the dashboard (the home route decides)
    if (n.type === 'home') return '/'
    const t = (n.title ?? '').toLowerCase()
    if (n.type === 'payment' || /recharge|paiement|portefeuille|dépôt|depot|payment|wallet|top-up/.test(t)) return '/wallet'
    if (/expédition|expedition|colis|shipment|parcel/.test(t)) return '/shipments'
    if (/commande|order|devis|quote/.test(t)) return '/orders'
    return '/notifications'
  }

  link = link.replace(/^\/expeditions(\/|$)/, '/shipments$1')
  link = link.replace(/^\/admin\/orders\/[^/?#]+/, '/admin/orders')
  link = link.replace(/^\/admin\/quotes\/[^/?#]+/, '/admin/quotes')
  // an admin page is useless to a customer
  if (link.startsWith('/admin') && !staff) return '/notifications'
  return link
}
