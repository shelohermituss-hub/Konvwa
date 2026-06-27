import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, Users, Shield, UserCircle2, Edit, ChevronLeft, ChevronRight } from 'lucide-react'
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
  order_count?: number
  wallet_balance?: number
}

const ROLE_CONFIG: Record<UserRole, { label: string; dot: string; badge: string }> = {
  client:  { label: 'Client',   dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground' },
  agent:   { label: 'Agent',    dot: 'bg-blue-500',         badge: 'bg-blue-50 text-blue-700' },
  manager: { label: 'Manager',  dot: 'bg-primary',          badge: 'bg-primary/10 text-primary' },
  admin:   { label: 'Admin',    dot: 'bg-destructive',      badge: 'bg-destructive/10 text-destructive' },
}

const ROLE_FILTERS = [
  { value: 'all',     label: 'Tous' },
  { value: 'client',  label: 'Clients' },
  { value: 'agent',   label: 'Agents' },
  { value: 'manager', label: 'Managers' },
  { value: 'admin',   label: 'Admins' },
]

const PAGE_SIZE = 15

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('client')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)

  async function loadUsers() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false })

    if (!profiles) { setLoading(false); return }

    const userIds = profiles.map(p => p.user_id)
    const [{ data: orders }, { data: wallets }] = await Promise.all([
      supabase.from('orders').select('user_id').in('user_id', userIds),
      supabase.from('wallets').select('user_id, available_balance').in('user_id', userIds),
    ])

    const orderCountMap: Record<string, number> = {}
    ;(orders || []).forEach(o => { orderCountMap[o.user_id] = (orderCountMap[o.user_id] || 0) + 1 })
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageUsers = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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

  const stats = {
    total: users.length,
    clients: users.filter(u => u.role === 'client').length,
    staff: users.filter(u => u.role !== 'client').length,
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${filtered.length} utilisateur${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* KPI mini cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total utilisateurs', value: stats.total, icon: Users, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
          { label: 'Clients',            value: stats.clients, icon: UserCircle2, iconClass: 'text-blue-600', bgClass: 'bg-blue-50' },
          { label: 'Équipe',             value: stats.staff,   icon: Shield, iconClass: 'text-amber-600', bgClass: 'bg-amber-50' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            {loading ? (
              <Skeleton className="h-16 rounded-xl" />
            ) : (
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', kpi.bgClass)}>
                  <kpi.icon className={cn('h-5 w-5', kpi.iconClass)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou téléphone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {ROLE_FILTERS.map(f => (
              <Button
                key={f.value}
                size="sm"
                variant={roleFilter === f.value ? 'default' : 'outline'}
                onClick={() => { setRoleFilter(f.value); setPage(0) }}
                className="rounded-xl shrink-0"
              >
                {f.label}
                {f.value !== 'all' && (
                  <span className={cn(
                    'ml-1.5 text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-0.5',
                    roleFilter === f.value ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  )}>
                    {users.filter(u => u.role === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">Aucun utilisateur trouvé</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Modifiez vos filtres de recherche</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Utilisateur</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Téléphone</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Rôle</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right">Commandes</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right">Solde</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Inscrit le</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageUsers.map(user => {
                  const roleCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.client
                  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <TableRow key={user.user_id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.full_name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {user.phone || '—'}
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1', roleCfg.badge)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', roleCfg.dot)} />
                          {roleCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        <span className="text-sm font-semibold">{user.order_count}</span>
                        <span className="text-xs text-muted-foreground ml-1">cmd</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        <p className="text-sm font-semibold">{(user.wallet_balance || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">HTG</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-44">
                            <DropdownMenuItem
                              className="rounded-lg cursor-pointer"
                              onClick={() => { setEditUser(user); setNewRole(user.role) }}
                            >
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button key={i} variant={i === page ? 'default' : 'ghost'} size="icon" className="h-8 w-8 rounded-lg text-xs" onClick={() => setPage(i)}>
                      {i + 1}
                    </Button>
                  ))}
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit role dialog */}
      <Dialog open={!!editUser} onOpenChange={o => { if (!o) setEditUser(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Utilisateur : <span className="font-semibold">{editUser?.full_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold mb-2">Rôle actuel</p>
              {editUser && (
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1', ROLE_CONFIG[editUser.role]?.badge)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', ROLE_CONFIG[editUser.role]?.dot)} />
                  {ROLE_CONFIG[editUser.role]?.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Nouveau rôle</p>
              <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
                <SelectTrigger className="rounded-xl">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleRoleUpdate} disabled={saving || newRole === editUser?.role} className="rounded-xl">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
