import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Link } from 'react-router-dom'
import { Package, Users, Ship, AlertTriangle, CreditCard, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useAdminStats } from '@/hooks/use-admin-stats'
import { cn } from '@/lib/utils'

const chartConfig = {
  orders: { label: 'Commandes', color: 'var(--chart-1)' },
  revenue: { label: 'Revenu (HTG)', color: 'var(--chart-2)' },
} satisfies ChartConfig

interface KpiCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconClass: string
  bgClass: string
  trend?: { value: number; positive: boolean }
  loading?: boolean
}

function KpiCard({ title, value, icon: Icon, iconClass, bgClass, trend, loading }: KpiCardProps) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', bgClass)}>
          <Icon className={cn('h-5 w-5', iconClass)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            trend.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          )}>
            <TrendingUp className={cn('h-3 w-3', !trend.positive && 'rotate-180')} />
            {trend.value}
          </div>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-1.5" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
          </>
        )}
      </div>
    </div>
  )
}

function MetricBadge({ icon: Icon, value, label, colorClass, bgClass, href }: {
  icon: React.ElementType
  value: string | number
  label: string
  colorClass: string
  bgClass: string
  href: string
}) {
  return (
    <Link to={href}>
      <div className={cn('rounded-2xl p-5 shadow-sm hover:opacity-90 transition-opacity', bgClass)}>
        <Icon className={cn('h-8 w-8 mb-3', colorClass)} />
        <p className={cn('text-2xl font-bold', colorClass)}>{value}</p>
        <p className={cn('text-sm mt-0.5 font-medium', colorClass, 'opacity-80')}>{label}</p>
      </div>
    </Link>
  )
}

export function AdminDashboard() {
  const stats = useAdminStats()

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{today}</p>
        </div>
        <Link to="/admin/orders">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
            <Package className="h-4 w-4" />
            Commandes
          </Button>
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Commandes totales"
          value={stats.totalOrders}
          icon={Package}
          iconClass="text-primary"
          bgClass="bg-primary/10"
          loading={stats.loading}
        />
        <KpiCard
          title="En attente de traitement"
          value={stats.pendingOrders}
          icon={Clock}
          iconClass="text-amber-600"
          bgClass="bg-amber-50"
          loading={stats.loading}
        />
        <KpiCard
          title="Revenus encaissés"
          value={stats.loading ? '—' : `${(stats.totalRevenuePaid / 1000).toFixed(0)}k HTG`}
          icon={CreditCard}
          iconClass="text-emerald-600"
          bgClass="bg-emerald-50"
          loading={stats.loading}
        />
        <KpiCard
          title="Clients enregistrés"
          value={stats.totalUsers}
          icon={Users}
          iconClass="text-blue-600"
          bgClass="bg-blue-50"
          trend={stats.loading ? undefined : { value: stats.newUsersThisMonth, positive: true }}
          loading={stats.loading}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-foreground">Commandes par mois</h3>
            <p className="text-xs text-muted-foreground mt-0.5">6 derniers mois</p>
          </div>
          <div className="p-5">
            {stats.loading ? (
              <Skeleton className="h-[220px] rounded-xl" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData} barSize={28}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="orders" fill="var(--color-orders)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-foreground">Revenus par mois</h3>
            <p className="text-xs text-muted-foreground mt-0.5">En HTG, 6 derniers mois</p>
          </div>
          <div className="p-5">
            {stats.loading ? (
              <Skeleton className="h-[220px] rounded-xl" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.monthlyData}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue)"
                      strokeWidth={2.5}
                      dot={{ fill: 'var(--color-revenue)', r: 4, strokeWidth: 2, stroke: 'white' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Metric badges ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBadge
          icon={Package}
          value={stats.loading ? '—' : stats.pendingOrders}
          label="Commandes en attente"
          colorClass="text-white"
          bgClass="bg-primary"
          href="/admin/orders"
        />
        <MetricBadge
          icon={Ship}
          value={stats.loading ? '—' : stats.activeShipments}
          label="Expéditions actives"
          colorClass="text-blue-700"
          bgClass="bg-blue-100"
          href="/admin/shipments"
        />
        <MetricBadge
          icon={AlertTriangle}
          value={stats.loading ? '—' : stats.openTickets}
          label="Tickets ouverts"
          colorClass="text-amber-700"
          bgClass="bg-amber-100"
          href="/admin/tickets"
        />
        <MetricBadge
          icon={Users}
          value={stats.loading ? '—' : stats.newUsersThisMonth}
          label="Nouveaux clients ce mois"
          colorClass="text-foreground"
          bgClass="bg-card border border-gray-100"
          href="/admin/users"
        />
      </div>

      {/* ── Recent orders ── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-sm text-foreground">Commandes récentes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Dernières commandes reçues</p>
          </div>
          <Link to="/admin/orders">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs rounded-xl">
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {stats.loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : stats.recentOrders.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucune commande pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {stats.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 shrink-0">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{order.product_name ?? 'Produit'}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_name ?? '—'} · <span className="font-mono">{order.tracking_code}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <StatusBadge status={order.status} />
                  <div className="text-right hidden sm:block">
                    <p className="font-semibold text-sm">{order.total_paid != null ? `${order.total_paid.toLocaleString()}` : '—'}</p>
                    <p className="text-[10px] text-muted-foreground">HTG</p>
                  </div>
                  <p className="text-xs text-muted-foreground hidden md:block">
                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
