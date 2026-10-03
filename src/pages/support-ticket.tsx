import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Loader2, Send } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { tr, DATE_LOCALE } from '@/lib/i18n'

interface Ticket { id: string; subject: string; status: string; user_id: string }
interface Msg { id: string; sender_id: string; message: string; created_at: string }

const STATUS_LABEL: Record<string, string> = {
  open: tr('Ouvert'), in_progress: tr('En cours'), resolved: tr('Résolu'), closed: tr('Fermé'),
}

export function SupportTicketPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('support_tickets').select('id, subject, status, user_id').eq('id', id).maybeSingle(),
      supabase.from('support_messages').select('id, sender_id, message, created_at').eq('ticket_id', id).order('created_at', { ascending: true }),
    ])
    setTicket((t as Ticket | null) ?? null)
    setMessages((m ?? []) as Msg[])
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])

  // new messages appear without reloading (row-level security still applies to realtime)
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`support-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${id}` }, (payload) => {
        const row = payload.new as Msg
        setMessages((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function send() {
    if (!user || !id || !text.trim()) return
    setSending(true)
    const { data, error } = await supabase
      .from('support_messages')
      .insert({ ticket_id: id, sender_id: user.id, message: text.trim() })
      .select('id, sender_id, message, created_at')
      .maybeSingle()
    setSending(false)
    if (error || !data) return
    setText('')
    setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data as Msg]))
  }

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/60" /></div>
  }
  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-muted-foreground">{tr('Demande introuvable.')}</p>
        <button onClick={() => navigate('/support')} className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-white">{tr('Retour')}</button>
      </div>
    )
  }
  const closed = ticket.status === 'closed'

  return (
    <div className="flex min-h-full flex-col bg-[#F4F5F7]">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-3">
        <button onClick={() => navigate('/support')} aria-label={tr('Retour')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground">{STATUS_LABEL[ticket.status] ?? ticket.status}</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 py-4" aria-live="polite">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-white')}>
                {!mine && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{tr('Support KONVWA')}</p>}
                <p className="whitespace-pre-line break-words">{m.message}</p>
                <time className={cn('mt-1 block text-[10px]', mine ? 'text-white/70' : 'text-muted-foreground')} dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleString(DATE_LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 border-t border-gray-100 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {closed ? (
          <p className="text-center text-xs text-muted-foreground">{tr('Cette demande est fermée. Ouvrez une nouvelle demande si besoin.')}</p>
        ) : (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send() }}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder={tr('Écrire un message…')}
              aria-label={tr('Écrire un message…')}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-[#F0F1F5] border-0"
            />
            <button type="submit" disabled={sending || !text.trim()} aria-label={tr('Envoyer')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
