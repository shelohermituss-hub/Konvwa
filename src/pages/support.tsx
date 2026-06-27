import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { MessageSquare, Plus, ChevronRight, Clock, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Ticket {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
}

const statusLabels: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
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

  useEffect(() => {
    loadTickets()
  }, [user])

  async function handleSubmit() {
    if (!subject || !message || !user) return
    setSubmitting(true)

    const { data: ticketData, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject,
        priority,
        status: 'open',
      })
      .select('id')
      .maybeSingle()

    if (ticketError || !ticketData) {
      toast.error('Erreur lors de la création du ticket. Veuillez réessayer.')
      setSubmitting(false)
      return
    }

    const { error: msgError } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: ticketData.id,
        sender_id: user.id,
        message,
      })

    if (msgError) {
      toast.error('Ticket créé mais le message n\'a pas pu être envoyé.')
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Support"
        description="Besoin d'aide ? Ouvrez un ticket ou consultez vos demandes existantes"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* New ticket */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle demande
            </CardTitle>
            <CardDescription>
              Décrivez votre problème et nous vous répondrons rapidement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Sujet *</Label>
              <Input
                id="subject"
                placeholder="Résumé de votre demande"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Décrivez votre problème en détail..."
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!subject || !message || submitting}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer la demande
            </Button>
          </CardContent>
        </Card>

        {/* Ticket list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mes demandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Aucune demande"
                description="Vous n'avez pas encore ouvert de ticket de support."
              />
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary transition-colors cursor-pointer"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                      {ticket.status === 'open' ? (
                        <Clock className="h-5 w-5 text-warning" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={ticket.status === 'open' || ticket.status === 'in_progress' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {statusLabels[ticket.status] || ticket.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('fr-HT')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
