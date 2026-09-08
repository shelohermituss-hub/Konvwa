import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Bell, BellOff, Plus, Search, RefreshCw, Send, Loader2,
  Users, CheckCheck, Mail, AlertTriangle, Package, CreditCard, Info,
  X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  read: boolean
  created_at: string
}

interface UserOption {
  user_id: string
  full_name: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  order:   { label: 'Commande',  icon: Package,      color: 'text-blue-600 bg-blue-50' },
  payment: { label: 'Paiement',  icon: CreditCard,   color: 'text-emerald-600 bg-emerald-50' },
  quote:   { label: 'Devis',     icon: Mail,         color: 'text-violet-600 bg-violet-50' },
  success: { label: 'Succès',    icon: CheckCheck,   color: 'text-emerald-600 bg-emerald-50' },
  warning: { label: 'Alerte',    icon: AlertTriangle,color: 'text-amber-600 bg-amber-50' },
  error:   { label: 'Erreur',    icon: AlertTriangle,color: 'text-red-600 bg-red-50' },
  info:    { label: 'Info',      icon: Info,         color: 'text-sky-600 bg-sky-50' },
}

const ALL_TYPES = Object.keys(TYPE_CONFIG)

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, icon: Bell, color: 'text-muted-foreground bg-muted' }
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ── Create notification dialog ────────────────────────────────────────────────

function CreateDialog({
  open,
  users,
  onClose,
  onCreated,
}: {
  open: boolean
  users: UserOption[]
  onClose: () => void
  onCreated: () => void
}) {
  const [target, setTarget]   = useState<'user' | 'all'>('user')
  const [userId, setUserId]   = useState('')
  const [type, setType]       = useState('info')
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch]   = useState('')

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function reset() {
    setTarget('user'); setUserId(''); setType('info')
    setTitle(''); setBody(''); setSearch('')
  }

  async function handleSend() {
    if (!title.trim()) { toast.error('Le titre est requis'); return }
    if (!body.trim())  { toast.error('Le message est requis'); return }
    if (target === 'user' && !userId) { toast.error('Sélectionnez un utilisateur'); return }

    setSending(true)
    try {
      if (target === 'all') {
        const rows = users.map(u => ({
          user_id: u.user_id, type, title: title.trim(), body: body.trim(), read: false,
        }))
        if (rows.length === 0) { toast.error('Aucun utilisateur trouvé'); return }
        const { error } = await supabase.from('notifications').insert(rows)
        if (error) throw error
        toast.success(`Notification envoyée à ${rows.length} utilisateurs`)
      } else {
        const { error } = await supabase.from('notifications').insert({
          user_id: userId, type, title: title.trim(), body: body.trim(), read: false,
        })
        if (error) throw error
        toast.success('Notification envoyée')
      }
      reset()
      onCreated()
      onClose()
    } catch (e) {
      console.error(e)
      toast.error("Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Créer une notification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target */}
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Destinataire</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['user', 'all'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all text-left',
                    target === t ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 bg-muted/40 text-muted-foreground'
                  )}
                >
                  {t === 'user' ? <Mail className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}
                  {t === 'user' ? 'Un utilisateur' : 'Tous les utilisateurs'}
                </button>
              ))}
            </div>
          </div>

          {/* User picker */}
          {target === 'user' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Utilisateur <span className="text-destructive">*</span></Label>
              <div className="relative mb-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 rounded-xl text-sm bg-muted/40 border-0"
                />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Aucun résultat</p>
                ) : filtered.map(u => (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => setUserId(u.user_id)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      userId === u.user_id ? 'bg-primary/5 text-primary font-semibold' : 'hover:bg-muted/40'
                    )}
                  >
                    {u.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-10 rounded-xl bg-muted/40 border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_TYPES.map(t => {
                  const cfg = TYPE_CONFIG[t]
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Titre <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Ex: Votre commande est prête"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-10 rounded-xl bg-muted/40 border-0 text-sm"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Message <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Contenu de la notification…"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              className="rounded-xl bg-muted/40 border-0 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => { reset(); onClose() }} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2" style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Envoi…' : target === 'all' ? `Envoyer à tous (${users.length})` : 'Envoyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ n, usersMap, onMarkRead }: { n: Notification; usersMap: Map<string, string>; onMarkRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TYPE_CONFIG[n.type] ?? { label: n.type, icon: Bell, color: 'text-muted-foreground bg-muted' }
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-xl border transition-colors overflow-hidden', n.read ? 'bg-white border-gray-100' : 'bg-primary/[0.02] border-primary/20')}>
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5', cfg.color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold leading-tight">{n.title}</span>
            <TypeBadge type={n.type} />
            {!n.read && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground/70">
              {usersMap.get(n.user_id) ?? n.user_id.slice(0, 8)}
            </span>
            <span className="text-[11px] text-muted-foreground/50">·</span>
            <span className="text-[11px] text-muted-foreground/70">
              {new Date(n.created_at).toLocaleString('fr-HT', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!n.read && (
            <button
              onClick={e => { e.stopPropagation(); onMarkRead(n.id) }}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              Lu
            </button>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3.5 pt-0 border-t border-gray-100 bg-muted/20">
          <p className="text-sm text-foreground mt-2 leading-relaxed">{n.body}</p>
          {n.data && Object.keys(n.data).length > 0 && (
            <pre className="mt-2 text-[11px] bg-muted rounded-lg p-2 overflow-x-auto text-muted-foreground">
              {JSON.stringify(n.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [users, setUsers]               = useState<UserOption[]>([])
  const [loading, setLoading]           = useState(true)
  const [showCreate, setShowCreate]     = useState(false)
  const [filterType, setFilterType]     = useState('all')
  const [filterRead, setFilterRead]     = useState<'all' | 'unread' | 'read'>('all')
  const [search, setSearch]             = useState('')

  async function load() {
    setLoading(true)
    const [notifsRes, usersRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, user_id, type, title, body, data, read, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('user_id, full_name').order('full_name'),
    ])
    if (notifsRes.data) setNotifications(notifsRes.data as Notification[])
    if (usersRes.data) setUsers(usersRes.data as UserOption[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read).map(n => n.id)
    if (unread.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unread)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    toast.success(`${unread.length} notification${unread.length > 1 ? 's' : ''} marquée${unread.length > 1 ? 's' : ''} comme lue${unread.length > 1 ? 's' : ''}`)
  }

  const usersMap = new Map(users.map(u => [u.user_id, u.full_name]))

  const total  = notifications.length
  const unread = notifications.filter(n => !n.read).length
  const read   = total - unread

  const filtered = notifications.filter(n => {
    if (filterType !== 'all' && n.type !== filterType) return false
    if (filterRead === 'unread' && n.read)  return false
    if (filterRead === 'read'   && !n.read) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (usersMap.get(n.user_id) ?? '').toLowerCase()
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || name.includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérer et envoyer des notifications aux utilisateurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Tout marquer lu
            </Button>
          )}
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)', color: '#fff' }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle notification
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: total, icon: Bell, color: 'text-foreground' },
          { label: 'Non lues', value: unread, icon: BellOff, color: 'text-primary' },
          { label: 'Lues', value: read, icon: CheckCheck, color: 'text-emerald-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 shrink-0">
              <Icon className={cn('h-5 w-5', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, message ou utilisateur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl text-sm bg-white border-gray-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-36 rounded-xl text-sm bg-white border-gray-200">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {ALL_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_CONFIG[t].label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterRead(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                filterRead === f ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              {f === 'all' ? 'Tous' : f === 'unread' ? 'Non lus' : 'Lus'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">Aucune notification</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {search || filterType !== 'all' || filterRead !== 'all'
                ? 'Aucun résultat pour ces filtres'
                : 'Créez la première notification'}
            </p>
          </div>
        ) : filtered.map(n => (
          <NotifRow key={n.id} n={n} usersMap={usersMap} onMarkRead={markRead} />
        ))}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} notification{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
        </p>
      )}

      <CreateDialog
        open={showCreate}
        users={users}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />
    </div>
  )
}
