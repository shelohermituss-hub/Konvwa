import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Search, MoreHorizontal, Users, Shield, UserCircle2, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface UserRow {
  user_id: string
  full_name: string
  phone: string | null
  role: UserRole
  created_at: string
  email?: string
  order_count?: number
  wallet_balance?: number
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  client: { label: 'Client', color: 'bg-muted text-muted-foreground' },
  agent: { label: 'Agent', color: 'bg-accent/15 text-accent' },
  manager: { label: 'Manager', color: 'bg-primary/15 text-primary' },
  admin: { label: 'Admin', color: 'bg-destructive/15 text-destructive' },
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('client')
  const [saving, setSaving] = useState(false)

  async function loadUsers() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false })

    if (!profiles) { setLoading(false); return }

    const userIds = profiles.map(p => p.user_id)

    // Get order counts per user
    const { data: orders } = await supabase.from('orders').select('user_id').in('user_id', userIds)
    const orderCountMap: Record<string, number> = {}
    ;(orders || []).forEach(o => { orderCountMap[o.user_id] = (orderCountMap[o.user_id] || 0) + 1 })

    // Get wallet balances
    const { data: wallets } = await supabase.from('wallets').select('user_id, available_balance').in('user_id', userIds)
    const walletMap = Object.fromEntries((wallets || []).map(w => [w.user_id, w.available_balance]))

    setUsers(profiles.map(p => ({
      ...(p as unknown as UserRow),
      order_count: orderCountMap[p.user_id] || 0,
      wallet_balance: walletMap[p.user_id] || 0,
    })))
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').includes(search)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  async function handleRoleUpdate() {
    if (!editUser) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', editUser.user_id)
    if (error) toast.error('Erreur lors de la mise à jour du rôle.')
    else {
      toast.success('Rôle mis à jour.')
      setUsers(prev => prev.map(u => u.user_id === editUser.user_id ? { ...u, role: newRole } : u))
      setEditUser(null)
    }
    setSaving(false)
  }

  const ROLE_FILTERS = [
    { value: 'all', label: 'Tous' },
    { value: 'client', label: 'Clients' },
    { value: 'agent', label: 'Agents' },
    { value: 'manager', label: 'Managers' },
    { value: 'admin', label: 'Admins' },
  ]

  const stats = {
    total: users.length,
    clients: users.filter(u => u.role === 'client').length,
    staff: users.filter(u => u.role !== 'client').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des utilisateurs" description="Administrez les comptes et rôles utilisateurs" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total utilisateurs', value: stats.total, icon: Users },
          { label: 'Clients', value: stats.clients, icon: UserCircle2 },
          { label: 'Équipe', value: stats.staff, icon: Shield },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <kpi.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou téléphone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              {ROLE_FILTERS.map(f => (
                <Button key={f.value} size="sm" variant={roleFilter === f.value ? 'default' : 'outline'} onClick={() => setRoleFilter(f.value)} className="shrink-0">
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Aucun utilisateur" description="Aucun utilisateur ne correspond à votre recherche." />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Solde wallet</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(user => {
                    const roleCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.client
                    const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-sm">{user.full_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.phone || '—'}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', roleCfg.color)}>{roleCfg.label}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{user.order_count} cmd</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{(user.wallet_balance || 0).toLocaleString()} HTG</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('fr-HT')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditUser(user); setNewRole(user.role) }}>
                                <Edit className="mr-2 h-4 w-4" />Changer le rôle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit role dialog */}
      <Dialog open={!!editUser} onOpenChange={o => { if (!o) setEditUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>{editUser?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleRoleUpdate} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
