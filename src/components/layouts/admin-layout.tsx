import { Outlet, Link, useLocation } from 'react-router-dom'
import { KonvwaLogo } from '@/components/shared/konvwa-logo'
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LayoutDashboard, Package, Ship, Users, CreditCard, AlertTriangle, Settings, LogOut, ChevronDown, Bell, BarChart3, FileText, Truck } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function AdminSidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const items = [
    { title: 'Tableau de bord', url: '/admin', icon: LayoutDashboard },
    { title: 'Commandes', url: '/admin/orders', icon: Package },
    { title: 'Devis', url: '/admin/quotes', icon: FileText },
    { title: 'Expéditions', url: '/admin/shipments', icon: Ship },
    { title: 'Paiements', url: '/admin/payments', icon: CreditCard },
    { title: 'Produits', url: '/admin/products', icon: Package },
    { title: 'Utilisateurs', url: '/admin/users', icon: Users },
    { title: 'Litiges', url: '/admin/disputes', icon: AlertTriangle },
    { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
    { title: 'Notifications', url: '/admin/notifications', icon: Bell },
    { title: 'Config. expédition', url: '/admin/shipping-config', icon: Truck },
    { title: 'Paramètres', url: '/admin/settings', icon: Settings },
  ]

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link to="/admin" className="flex items-center gap-2">
          <KonvwaLogo size={26} />
          <span className="text-xs text-muted-foreground ml-1">Administration</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestion</SidebarGroupLabel>
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
            <DropdownMenuLabel>Administration</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Portail client
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

export function AdminLayout() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminTopBar />
        <main className="flex-1 overflow-auto p-6 bg-[#F4F5F7]">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
