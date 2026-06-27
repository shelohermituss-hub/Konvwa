import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Link } from 'react-router-dom'
import { Package, Users, ArrowRight, Ship, AlertTriangle, CreditCard } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useAdminStats } from '@/hooks/use-admin-stats'

const chartConfig = {
  orders: { label: 'Commandes', color: 'var(--chart-1)' },
  revenue: { label: 'Revenu (HTG)', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function AdminDashboard() {
  const stats = useAdminStats()

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Commandes totales"
              value={stats.totalOrders}
              icon={Package}
              description="Toutes les commandes"
            />
            <StatCard
              title="En attente"
              value={stats.pendingOrders}
              icon={Package}
              description="À traiter"
            />
            <StatCard
              title="Revenus encaissés"
              value={`${(stats.totalRevenuePaid / 1000).toFixed(0)}k HTG`}
              icon={CreditCard}
              description="Commandes payées"
            />
            <StatCard
              title="Clients"
              value={stats.totalUsers}
              icon={Users}
              trend={{ value: stats.newUsersThisMonth, label: 'nouveaux ce mois', positive: true }}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commandes par mois</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <Skeleton className="h-[250px] rounded-xl" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenus par mois (HTG)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <Skeleton className="h-[250px] rounded-xl" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.monthlyData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--color-revenue)', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick metric cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 bg-primary text-primary-foreground">
          <CardContent className="pt-6">
            <Package className="h-8 w-8 mb-3" />
            <p className="font-bold text-2xl">{stats.loading ? '—' : stats.pendingOrders}</p>
            <p className="text-sm text-primary-foreground/80">Commandes en attente</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-accent text-accent-foreground">
          <CardContent className="pt-6">
            <Ship className="h-8 w-8 mb-3" />
            <p className="font-bold text-2xl">{stats.loading ? '—' : stats.activeShipments}</p>
            <p className="text-sm text-accent-foreground/80">Expéditions actives</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-warning text-warning-foreground">
          <CardContent className="pt-6">
            <AlertTriangle className="h-8 w-8 mb-3" />
            <p className="font-bold text-2xl">{stats.loading ? '—' : stats.openTickets}</p>
            <p className="text-sm text-warning-foreground/80">Tickets ouverts</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card">
          <CardContent className="pt-6">
            <Users className="h-8 w-8 mb-3 text-muted-foreground" />
            <p className="font-bold text-2xl">{stats.loading ? '—' : stats.newUsersThisMonth}</p>
            <p className="text-sm text-muted-foreground">Nouveaux clients ce mois</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Commandes récentes</CardTitle>
          <Link to="/admin/orders">
            <Button variant="ghost" size="sm">
              Voir tout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats.loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : stats.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune commande pour le moment</p>
          ) : (
            <div className="space-y-3">
              {stats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{order.product_name ?? 'Produit'}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {order.total_paid != null ? `${order.total_paid.toLocaleString()} HTG` : '—'}
                      </p>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
