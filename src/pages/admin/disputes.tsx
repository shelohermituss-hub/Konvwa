import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Search, MoreHorizontal, MessageSquare, Send, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TicketStatus, TicketPriority } from '@/types'

interface AdminTicket {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  user_id: string
  order_id: string | null
  customer_name?: string
}

interface TicketMessage {
  id: string
  message: string
  sender_id: string
  created_at: string
  sender_name?: string
  is_admin?: boolean
}

const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Ouvert', color: 'bg-warning/15 text-warning', icon: Clock },
  in_progress: { label: 'En cours', color: 'bg-primary/15 text-primary', icon: MessageSquare },
  resolved: { label: 'Résolu', color: 'bg-success/15 text-success', icon: CheckCircle2 },
  closed: { label: 'Fermé', color: 'bg-muted text-muted-foreground', icon: XCircle },
}

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Basse', color: 'text-muted-foreground' },
  normal: { label: 'Normale', color: 'text-foreground' },
  high: { label: 'Haute', color: 'text-warning' },
  urgent: { label: 'Urgente', color: 'text-destructive' },
}

export function AdminDisputesPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [activeTicket, setActiveTicket] = useState<AdminTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [newStatus, setNewStatus] = useState<TicketStatus>('open')
  const [saving, setSaving] = useState(false)

  async function loadTickets() {
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, user_id, order_id')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const userIds = [...new Set(data.map(t => t.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]))

    setTickets(data.map(t => ({ ...(t as unknown as AdminTicket), customer_name: profileMap[t.user_id] || '—' })))
    setLoading(false)
  }

  async function loadMessages(ticketId: string) {
    const { data } = await supabase
      .from('support_messages')
      .select('id, message, sender_id, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (!data) return

    const senderIds = [...new Set(data.map(m => m.sender_id))]
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, role').in('user_id', senderIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, { name: p.full_name, role: p.role }]))

    setMessages(data.map(m => ({
      ...(m as unknown as TicketMessage),
      sender_name: profileMap[m.sender_id]?.name || '—',
      is_admin: ['admin', 'manager', 'agent'].includes(profileMap[m.sender_id]?.role || ''),
    })))
  }

  useEffect(() => { loadTickets() }, [])

  async function openTicket(ticket: AdminTicket) {
    setActiveTicket(ticket)
    setNewStatus(ticket.status)
    await loadMessages(ticket.id)
    // Mark as in_progress if open
    if (ticket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticket.id)
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'in_progress' } : t))
    }
  }

  async function handleReply() {
    if (!replyText.trim() || !activeTicket) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase.from('support_messages').insert({
      ticket_id: activeTicket.id,
      sender_id: user.id,
      message: replyText.trim(),
    })

    // Notify client
    await supabase.from('notifications').insert({
      user_id: activeTicket.user_id,
      title: 'Réponse de support',
      message: `Notre équipe a répondu à votre ticket: "${activeTicket.subject}"`,
      type: 'info',
    })

    setReplyText('')
    await loadMessages(activeTicket.id)
    setSaving(false)
  }

  async function handleStatusChange() {
    if (!activeTicket) return
    await supabase.from('support_tickets').update({ status: newStatus }).eq('id', activeTicket.id)
    setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: newStatus } : t))
    setActiveTicket(prev => prev ? { ...prev, status: newStatus } : null)
    toast.success('Statut mis à jour.')
  }

  const filtered = tickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.customer_name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const STATUS_FILTERS = [
    { value: 'open', label: 'Ouverts' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'resolved', label: 'Résolus' },
    { value: 'closed', label: 'Fermés' },
    { value: 'all', label: 'Tous' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Support & Litiges" description="Gérez les tickets de support et les demandes clients" />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'open', icon: Clock },
          { key: 'in_progress', icon: MessageSquare },
          { key: 'resolved', icon: CheckCircle2 },
          { key: 'closed', icon: XCircle },
        ].map(({ key, icon: Icon }) => {
          const cfg = TICKET_STATUS_CONFIG[key as TicketStatus]
          return (
            <Card key={key}>
              <CardContent className="pt-5 flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', cfg.color.split(' ')[0])}>
                  <Icon className={cn('h-5 w-5', cfg.color.split(' ')[1])} />
                </div>
                <div>
                  <p className="text-xl font-bold">{tickets.filter(t => t.status === key).length}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {STATUS_FILTERS.map(f => (
                <Button key={f.value} size="sm" variant={statusFilter === f.value ? 'default' : 'outline'} onClick={() => setStatusFilter(f.value)} className="shrink-0">
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
            <EmptyState icon={MessageSquare} title="Aucun ticket" description="Aucun ticket de support ne correspond." />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(ticket => {
                    const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
                    const priorityCfg = PRIORITY_CONFIG[ticket.priority]
                    return (
                      <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openTicket(ticket)}>
                        <TableCell className="font-medium text-sm">{ticket.customer_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{ticket.subject}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-semibold', priorityCfg.color)}>{priorityCfg.label}</span>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', statusCfg.color)}>{statusCfg.label}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('fr-HT')}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openTicket(ticket)}>
                                <MessageSquare className="mr-2 h-4 w-4" />Ouvrir conversation
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', ticket.id)
                                setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'resolved' } : t))
                                toast.success('Ticket marqué comme résolu.')
                              }}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />Marquer résolu
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

      {/* Ticket conversation dialog */}
      <Dialog open={!!activeTicket} onOpenChange={o => { if (!o) { setActiveTicket(null); setMessages([]) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {activeTicket?.subject}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3">
              <span>{activeTicket?.customer_name}</span>
              <Badge variant="outline" className="text-xs capitalize">{activeTicket?.priority}</Badge>
            </DialogDescription>
          </DialogHeader>

          {/* Status change */}
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <Label className="text-sm shrink-0">Statut:</Label>
            <Select value={newStatus} onValueChange={v => setNewStatus(v as TicketStatus)}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TICKET_STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleStatusChange}>Appliquer</Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 max-h-64">
            <div className="space-y-3 pr-2 py-2">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun message</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={cn('flex', msg.is_admin ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                      msg.is_admin ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
                    )}>
                      <p className="text-[10px] font-semibold opacity-70 mb-1">{msg.sender_name}</p>
                      <p className="leading-relaxed">{msg.message}</p>
                      <p className={cn('text-[10px] mt-1 opacity-60', msg.is_admin ? 'text-right' : '')}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Reply */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Textarea
              placeholder="Répondre au client..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
            />
            <Button onClick={handleReply} disabled={!replyText.trim() || saving} className="self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
