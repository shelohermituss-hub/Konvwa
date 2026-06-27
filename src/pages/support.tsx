import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Plus, ChevronRight, Clock, Loader2, HelpCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Ticket {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  open:        { label: 'Ouvert',   dot: 'bg-amber-400',        bg: 'bg-amber-50',   text: 'text-amber-700' },
  in_progress: { label: 'En cours', dot: 'bg-primary',          bg: 'bg-primary/10', text: 'text-primary' },
  resolved:    { label: 'Résolu',   dot: 'bg-emerald-500',      bg: 'bg-emerald-50', text: 'text-emerald-700' },
  closed:      { label: 'Fermé',    dot: 'bg-muted-foreground', bg: 'bg-muted',      text: 'text-muted-foreground' },
}

export function SupportPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState('normal')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadTickets() {
    if (!user) return
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }

  useEffect(() => { loadTickets() }, [user])

  async function handleSubmit() {
    if (!subject || !message || !user) return
    setSubmitting(true)
    const { data: ticketData, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({ user_id: user.id, subject, priority, status: 'open' })
      .select('id')
      .maybeSingle()
    if (ticketError || !ticketData) {
      toast.error('Erreur lors de la création du ticket. Veuillez réessayer.')
      setSubmitting(false)
      return
    }
    const { error: msgError } = await supabase.from('support_messages').insert({
      ticket_id: ticketData.id,
      sender_id: user.id,
      message,
    })
    if (msgError) {
      toast.error("Ticket créé mais le message n'a pas pu être envoyé.")
    } else {
      toast.success('Votre demande a bien été envoyée.')
      setSubject('')
      setMessage('')
      setPriority('normal')
      await loadTickets()
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-full bg-[#F4F5F7]">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Besoin d'aide ? Nous répondons rapidement.</p>
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* New ticket form */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Nouvelle demande</p>
              <p className="text-xs text-muted-foreground">Décrivez votre problème</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-sm font-semibold">Sujet *</Label>
              <Input
                id="subject"
                placeholder="Résumé de votre demande"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority" className="text-sm font-semibold">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 rounded-xl bg-[#F0F1F5] border-0 font-medium focus:ring-1 focus:ring-primary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-sm font-semibold">Message *</Label>
              <Textarea
                id="message"
                placeholder="Décrivez votre problème en détail..."
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-xl bg-[#F0F1F5] border-0 font-medium resize-none focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>
            <button
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
              disabled={!subject || !message || submitting}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer la demande
            </button>
          </div>
        </div>

        {/* Ticket list */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Mes demandes ({tickets.length})</p>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-10 text-center">
              <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-sm text-muted-foreground">Aucune demande</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Vous n'avez pas encore ouvert de ticket de support.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tickets.map((ticket) => {
                const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
                return (
                  <div key={ticket.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', cfg.bg)}>
                      {ticket.status === 'open' ? (
                        <Clock className={cn('h-4 w-4', cfg.text)} />
                      ) : (
                        <MessageSquare className={cn('h-4 w-4', cfg.text)} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5', cfg.bg, cfg.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
