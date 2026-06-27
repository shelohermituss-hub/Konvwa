import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminStats {
  totalOrders: number
  pendingOrders: number
  totalRevenuePaid: number
  totalUsers: number
  newUsersThisMonth: number
  activeShipments: number
  openTickets: number
  recentOrders: RecentOrder[]
  monthlyData: MonthlyDataPoint[]
  loading: boolean
}

export interface RecentOrder {
  id: string
  tracking_code: string
  status: string
  total_paid: number | null
  created_at: string
  customer_name: string | null
  product_name: string | null
}

export interface MonthlyDataPoint {
  month: string
  orders: number
  revenue: number
}

const PENDING_STATUSES = [
  'submitted', 'reviewing', 'quoted', 'awaiting_payment',
  'paid', 'purchasing', 'in_transit', 'customs_clearance',
  'arrived_haiti', 'delivering',
]

function monthLabel(d: Date) {
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

export function useAdminStats(): AdminStats {
  const [state, setState] = useState<Omit<AdminStats, 'loading'>>({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenuePaid: 0,
    totalUsers: 0,
    newUsersThisMonth: 0,
    activeShipments: 0,
    openTickets: 0,
    recentOrders: [],
    monthlyData: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

      const [
        totalOrdersRes,
        pendingOrdersRes,
        revenueRes,
        totalUsersRes,
        newUsersRes,
        shipmentsRes,
        ticketsRes,
        recentOrdersRes,
        monthlyOrdersRes,
      ] = await Promise.all([
        // Total orders
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        // Pending (not delivered/cancelled/completed)
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', PENDING_STATUSES),
        // Revenue: sum of total_paid for completed/paid orders
        supabase.from('orders').select('total_paid').not('status', 'in', '(draft,cancelled,submitted,reviewing,quoted,awaiting_payment)'),
        // Total client users
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        // New users this month
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        // Active shipments
        supabase.from('shipments').select('*', { count: 'exact', head: true }).not('status', 'in', '(delivered,completed,returned)'),
        // Open support tickets
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed)'),
        // Recent orders with customer + product
        supabase
          .from('orders')
          .select('id, tracking_code, status, total_paid, created_at, quotes(total, product_requests(product_name)), profiles!orders_user_id_fkey(full_name)')
          .order('created_at', { ascending: false })
          .limit(6),
        // Monthly orders for chart
        supabase
          .from('orders')
          .select('created_at, total_paid, status')
          .gte('created_at', sixMonthsAgo)
          .order('created_at', { ascending: true }),
      ])

      if (cancelled) return

      // Compute revenue sum
      const paidOrders = revenueRes.data ?? []
      const totalRevenuePaid = paidOrders.reduce((sum, o) => sum + (o.total_paid ?? 0), 0)

      // Map recent orders
      const recentOrders: RecentOrder[] = (recentOrdersRes.data ?? []).map((o: any) => ({
        id: o.id,
        tracking_code: o.tracking_code,
        status: o.status,
        total_paid: o.quotes?.total ?? o.total_paid ?? null,
        created_at: o.created_at,
        customer_name: o.profiles?.full_name ?? null,
        product_name: o.quotes?.product_requests?.product_name ?? null,
      }))

      // Build monthly chart data (last 6 months)
      const monthMap = new Map<string, { orders: number; revenue: number }>()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthMap.set(monthLabel(d), { orders: 0, revenue: 0 })
      }
      for (const o of (monthlyOrdersRes.data ?? [])) {
        const label = monthLabel(new Date(o.created_at))
        if (monthMap.has(label)) {
          const entry = monthMap.get(label)!
          entry.orders += 1
          entry.revenue += o.total_paid ?? 0
        }
      }
      const monthlyData: MonthlyDataPoint[] = Array.from(monthMap.entries()).map(([month, v]) => ({
        month,
        orders: v.orders,
        revenue: v.revenue,
      }))

      setState({
        totalOrders: totalOrdersRes.count ?? 0,
        pendingOrders: pendingOrdersRes.count ?? 0,
        totalRevenuePaid,
        totalUsers: totalUsersRes.count ?? 0,
        newUsersThisMonth: newUsersRes.count ?? 0,
        activeShipments: shipmentsRes.count ?? 0,
        openTickets: ticketsRes.count ?? 0,
        recentOrders,
        monthlyData,
      })
      setLoading(false)
    }

    fetch()
    return () => { cancelled = true }
  }, [])

  return { ...state, loading }
}
