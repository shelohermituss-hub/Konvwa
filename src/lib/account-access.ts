/** What the team decided for a customer account (set by staff only, enforced by the database). */
export type AccountStatus = 'active' | 'suspended' | 'banned'
export type Restriction = 'orders' | 'payments' | 'deposits' | 'requests' | 'support'

export const RESTRICTIONS: Restriction[] = ['orders', 'payments', 'deposits', 'requests', 'support']

export interface AccessFields {
  role?: string
  account_status?: AccountStatus | null
  status_until?: string | null
  restrictions?: string[] | null
}

/** Blocked kind for a customer account, or null when the account can be used (staff are never blocked). */
export function accountBlock(p: AccessFields | null | undefined, now = Date.now()): 'banned' | 'suspended' | null {
  if (!p || (p.role && p.role !== 'client')) return null
  if (p.account_status === 'banned') return 'banned'
  if (p.account_status === 'suspended') {
    if (!p.status_until || new Date(p.status_until).getTime() > now) return 'suspended'
  }
  return null
}

export function isRestricted(p: AccessFields | null | undefined, action: Restriction): boolean {
  return !!p?.restrictions?.includes(action)
}
