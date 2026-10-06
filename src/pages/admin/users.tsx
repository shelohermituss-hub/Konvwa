import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, Users, Shield, UserCircle2, SlidersHorizontal, ChevronLeft, ChevronRight, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { AdminUserSheet } from '@/components/shared/admin-user-sheet'
import { accountBlock, type AccountStatus } from '@/lib/account-access'

import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { tr, DATE_LOCALE } from '@/lib/i18n'
import { moneyAmount, currencyLabel } from '@/lib/currency'
interface UserRow {
  user_id: string
  full_name: string
  phone: string | null
  email: string | null
  role: UserRole
  created_at: string
  last_sign_in_at: string | null
  account_status: AccountStatus
  status_until: string | null
  restrictions: string[]
  order_count?: number
  wallet_balance?: number
}

const ROLE_CONFIG: Record<UserRole, { label: string; dot: string; badge: string }> = {
  client:  { label: tr('Client'),   dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground' },
  agent:   { label: 'Agent',    dot: 'bg-blue-500',         badge: 'bg-blue-50 text-blue-700' },
  manager: { label: 'Manager',  dot: 'bg-primary',          badge: 'bg-primary/10 text-primary' },
  admin:   { label: 'Admin',    dot: 'bg-destructive',      badge: 'bg-destructive/10 text-destructive' },
}

const ROLE_FILTERS = [
  { value: 'all',     label: tr('Tous') },
  { value: 'client',  label: tr('Clients') },
  { value: 'agent',   label: tr('Agents') },
  { value: 'manager', label: tr('Managers') },
  { value: 'admin',   label: tr('Admins') },
  { value: 'blocked',    label: tr('Suspendus') },
  { value: 'restricted', label: tr('Restreints') },
]

const PAGE_SIZE = 15

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  async function loadUsers() {
    const { data } = await supabase.rpc('admin_list_users')
    setUsers(((data ?? []) as UserRow[]).map(u => ({ ...u, order_count: Number(u.order_count) || 0, wallet_balance: Number(u.wallet_balance) || 0 })))
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const isBlocked = (u: UserRow) => accountBlock(u) !== null
  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = u.full_name.toLowerCase().includes(q) || (u.phone || '').includes(search) || (u.email ?? '').toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' ? true
      : roleFilter === 'blocked' ? isBlocked(u)
      : roleFilter === 'restricted' ? (u.restrictions?.length ?? 0) > 0 && !isBlocked(u)
      : u.role === roleFilter
    return matchSearch && matchRole
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageUsers = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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
          <h1 className="text-2xl font-bold tracking-tight">{tr('Utilisateurs')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : tr('{0} utilisateur{1}', filtered.length, filtered.length !== 1 ? 's' : '')}
          </p>
        </div>
        <ExportCsvButton
          filename="utilisateurs"
          headers={['nom', 'email', 'telephone', 'role', 'statut', 'restrictions', 'commandes', 'solde_htg', 'inscription']}
          rows={() => filtered.map(u => [u.full_name, u.email ?? '', u.phone ?? '', u.role, u.account_status, (u.restrictions ?? []).join('|'), u.order_count ?? 0, u.wallet_balance ?? 0, u.created_at])}
          disabled={filtered.length === 0}
        />
      </div>

      {/* KPI mini cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: tr('Total utilisateurs'), value: stats.total, icon: Users, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
          { label: tr('Clients'),            value: stats.clients, icon: UserCircle2, iconClass: 'text-blue-600', bgClass: 'bg-blue-50' },
          { label: tr('Équipe'),             value: stats.staff,   icon: Shield, iconClass: 'text-amber-600', bgClass: 'bg-amber-50' },
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
              placeholder={tr('Rechercher par nom, e-mail ou téléphone...')}
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
                    {f.value === 'blocked' ? users.filter(isBlocked).length
                      : f.value === 'restricted' ? users.filter(u => (u.restrictions?.length ?? 0) > 0 && !isBlocked(u)).length
                      : users.filter(u => u.role === f.value).length}
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
            <p className="font-semibold text-muted-foreground">{tr('Aucun utilisateur trouvé')}</p>
            <p className="text-xs text-muted-foreground mt-1">{tr('Modifiez vos filtres de recherche')}</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Utilisateur')}</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">{tr('Téléphone')}</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{tr('Rôle')}</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right">{tr('Commandes')}</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right">{tr('Solde')}</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">{tr('Inscrit le')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageUsers.map(user => {
                  const roleCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.client
                  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <TableRow key={user.user_id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setOpenId(user.user_id)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{user.full_name}</p>
                            {user.email && <p className="max-w-[200px] truncate text-[11px] text-muted-foreground">{user.email}</p>}
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
                        {isBlocked(user) && (
                          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            <Ban className="h-3 w-3" aria-hidden="true" />{user.account_status === 'banned' ? tr('Désactivé') : tr('Suspendu')}
                          </span>
                        )}
                        {!isBlocked(user) && (user.restrictions?.length ?? 0) > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />{tr('Restreint')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        <span className="text-sm font-semibold">{user.order_count}</span>
                        <span className="text-xs text-muted-foreground ml-1">{tr('cmd')}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        <p className="text-sm font-semibold">{moneyAmount(user.wallet_balance || 0)}</p>
                        <p className="text-[10px] text-muted-foreground">{currencyLabel()}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label={tr('Actions')}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setOpenId(user.user_id)}>
                              <SlidersHorizontal className="mr-2 h-4 w-4" />{tr('Gérer le compte')}
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
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}{' '}{tr('sur')}{' '}{filtered.length}
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

      <AdminUserSheet userId={openId} onClose={() => setOpenId(null)} onChanged={() => void loadUsers()} />
    </div>
  )
}
