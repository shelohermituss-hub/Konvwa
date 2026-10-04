import { Outlet, Link, useLocation } from 'react-router-dom'
import { ThemeQuickToggle } from '@/components/shared/theme-switch'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LayoutDashboard, Package, Ship, Users, CreditCard, AlertTriangle, Settings, LogOut, ChevronDown, Bell, BarChart3, FileText, Truck, PackageSearch, ScrollText, BadgeCheck, Scale, Ticket, Gauge, Bug, Store, ScanLine, MapPin } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { MfaGate } from '@/components/shared/mfa-gate'

import { tr } from '@/lib/i18n'
function AdminSidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const allItems = [
    { title: tr('Tableau de bord'), url: '/admin', icon: LayoutDashboard },
    { title: tr('Pilotage'), url: '/admin/insights', icon: Gauge },
    { title: tr('Commandes'), url: '/admin/orders', icon: Package },
    { title: tr('Devis'), url: '/admin/quotes', icon: FileText },
    { title: tr('Expéditions'), url: '/admin/shipments', icon: Ship },
    { title: tr('Paiements'), url: '/admin/payments', icon: CreditCard },
    { title: tr('Produits'), url: '/admin/products', icon: Package },
    { title: tr('Utilisateurs'), url: '/admin/users', icon: Users },
    { title: tr('Litiges'), url: '/admin/disputes', icon: AlertTriangle },
    { title: tr('Analytics'), url: '/admin/analytics', icon: BarChart3 },
    { title: tr('Notifications'), url: '/admin/notifications', icon: Bell },
    { title: tr('Scan réception'), url: '/admin/scan', icon: ScanLine },
    { title: tr('Cargaisons'), url: '/admin/shipping-requests', icon: PackageSearch },
    { title: tr('Commandes catalogue'), url: '/admin/product-orders', icon: Package },
    { title: tr('Retrait et livraison'), url: '/admin/delivery-options', icon: MapPin },
    { title: tr('Config. expédition'), url: '/admin/shipping-config', icon: Truck },
    { title: tr('Vérification d\'identité'), url: '/admin/kyc', icon: BadgeCheck },
    { title: tr('Revendeurs'), url: '/admin/resellers', icon: Store },
    { title: tr('Codes promo'), url: '/admin/promos', icon: Ticket },
    { title: tr('Rapprochement'), url: '/admin/reconciliation', icon: Scale },
    { title: tr('Journal d\'audit'), url: '/admin/audit-logs', icon: ScrollText },
    { title: tr('Erreurs'), url: '/admin/errors', icon: Bug },
    { title: tr('Paramètres'), url: '/admin/settings', icon: Settings },
  ]
  // managers run daily operations; money rules, audit and settings stay with full admins
  const adminOnly = new Set(['/admin/promos', '/admin/reconciliation', '/admin/audit-logs', '/admin/errors', '/admin/settings'])
  const items = allItems.filter((i) => profile?.role === 'admin' || !adminOnly.has(i.url))

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
        <SidebarGroup>
          <SidebarGroupLabel>{tr('Gestion')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
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
