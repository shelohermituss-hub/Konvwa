import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAdminBadges, type AdminBadges } from '@/hooks/use-admin-badges'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/shared/notification-bell'
import { ThemeQuickToggle } from '@/components/shared/theme-switch'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LayoutDashboard, Package, Ship, Users, CreditCard, AlertTriangle, Settings, LogOut, ChevronDown, ChevronRight, Bell, BarChart3, FileText, Truck, PackageSearch, ScrollText, BadgeCheck, Scale, Ticket, Gauge, Bug, Store, ScanLine, MapPin } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { MfaGate } from '@/components/shared/mfa-gate'

import { tr } from '@/lib/i18n'
interface NavItem { title: string; url: string; icon: React.ElementType; badge?: keyof AdminBadges; adminOnly?: boolean }
interface NavGroup { key: string; title: string; icon: React.ElementType; items: NavItem[] }

function readOpenGroups(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem('admin-nav-open') ?? '{}') as Record<string, boolean> } catch { return {} }
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return (
    <span
      aria-label={tr('{0} nouveaux', n)}
      className={cn('ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground tabular-nums', className)}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

function AdminSidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const badges = useAdminBadges()

  // grouped by what the team does; money rules, audit and settings stay with full admins (adminOnly)
  const allGroups: NavGroup[] = [
    { key: 'overview', title: tr('Pilotage'), icon: LayoutDashboard, items: [
      { title: tr('Tableau de bord'), url: '/admin', icon: LayoutDashboard },
      { title: tr('Pilotage'), url: '/admin/insights', icon: Gauge },
      { title: tr('Analytics'), url: '/admin/analytics', icon: BarChart3 },
    ] },
    { key: 'orders', title: tr('Commandes'), icon: Package, items: [
      { title: tr('Devis'), url: '/admin/quotes', icon: FileText, badge: 'quotes' },
      { title: tr('Commandes'), url: '/admin/orders', icon: Package, badge: 'orders' },
      { title: tr('Commandes catalogue'), url: '/admin/product-orders', icon: Package, badge: 'product_orders' },
      { title: tr('Cargaisons'), url: '/admin/shipping-requests', icon: PackageSearch, badge: 'cargos' },
    ] },
    { key: 'logistics', title: tr('Logistique'), icon: Ship, items: [
      { title: tr('Expéditions'), url: '/admin/shipments', icon: Ship },
      { title: tr('Scan réception'), url: '/admin/scan', icon: ScanLine },
      { title: tr('Retrait et livraison'), url: '/admin/delivery-options', icon: MapPin },
      { title: tr('Config. expédition'), url: '/admin/shipping-config', icon: Truck },
    ] },
    { key: 'customers', title: tr('Clients et argent'), icon: Users, items: [
      { title: tr('Paiements'), url: '/admin/payments', icon: CreditCard, badge: 'payments' },
      { title: tr('Utilisateurs'), url: '/admin/users', icon: Users },
      { title: tr('Vérification d\'identité'), url: '/admin/kyc', icon: BadgeCheck, badge: 'kyc' },
      { title: tr('Revendeurs'), url: '/admin/resellers', icon: Store, badge: 'resellers' },
      { title: tr('Litiges'), url: '/admin/disputes', icon: AlertTriangle, badge: 'disputes' },
      { title: tr('Codes promo'), url: '/admin/promos', icon: Ticket, adminOnly: true },
      { title: tr('Rapprochement'), url: '/admin/reconciliation', icon: Scale, adminOnly: true },
    ] },
    { key: 'catalog', title: tr('Catalogue et messages'), icon: Store, items: [
      { title: tr('Produits'), url: '/admin/products', icon: Package },
      { title: tr('Notifications'), url: '/admin/notifications', icon: Bell },
    ] },
    { key: 'system', title: tr('Technique et paramètres'), icon: Settings, items: [
      { title: tr('Journal d\'audit'), url: '/admin/audit-logs', icon: ScrollText, adminOnly: true },
      { title: tr('Erreurs'), url: '/admin/errors', icon: Bug, adminOnly: true },
      { title: tr('Paramètres'), url: '/admin/settings', icon: Settings, adminOnly: true },
    ] },
  ]
  const isAdmin = profile?.role === 'admin'
  const groups = allGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) }))
    .filter((g) => g.items.length > 0)

  const [stored, setStored] = useState<Record<string, boolean>>(readOpenGroups)
  const groupHasActive = (g: NavGroup) => g.items.some((i) => i.url === location.pathname)
  const isOpen = (g: NavGroup) => stored[g.key] ?? (g.key === 'orders' || groupHasActive(g))
  function toggle(g: NavGroup, open: boolean) {
    const next = { ...stored, [g.key]: open }
    setStored(next)
    try { localStorage.setItem('admin-nav-open', JSON.stringify(next)) } catch { /* storage unavailable: the state stays in memory */ }
  }
  const groupCount = (g: NavGroup) => g.items.reduce((sum, i) => sum + (i.badge ? badges[i.badge] ?? 0 : 0), 0)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link to="/admin" className="flex items-center gap-2">
          <KonvwaLogo size={26} />
          <span className="text-xs text-muted-foreground ml-1">{tr('Administration')}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => {
          const open = isOpen(g) || groupHasActive(g)
          const count = groupCount(g)
          return (
            <Collapsible key={g.key} open={open} onOpenChange={(o) => toggle(g, o)} className="group/collapsible">
              <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    <g.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{g.title}</span>
                    {!open && <CountBadge n={count} />}
                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-90' : '', open || !count ? 'ml-auto' : '')} aria-hidden="true" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {g.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                            <Link to={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              {item.badge && <CountBadge n={badges[item.badge] ?? 0} />}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">{profile?.full_name}</span>
                <span className="text-xs text-muted-foreground capitalize">{profile?.role}</span>
              </div>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{tr('Administration')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {tr('Portail client')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {tr('Déconnexion')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AdminTopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-100 bg-white px-6">
      <SidebarTrigger className="-ml-2" />
      <div className="flex items-center gap-2">
        <ThemeQuickToggle />
        <NotificationBell />
      </div>
    </header>
  )
}

export function AdminLayout() {
  return (
    <MfaGate>
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminTopBar />
        <main className="flex-1 overflow-auto p-6 bg-[#F4F5F7]">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
    </MfaGate>
  )
}
