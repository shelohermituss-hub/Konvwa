import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, FileText, Eye, Calculator, ExternalLink, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ProductRequest {
  id: string
  product_name: string
  product_url: string
  source_platform: string
  category: string | null
  quantity: number
  urgency: string
  budget_estimate: number | null
  notes: string | null
  status: string
  created_at: string
  user_id: string
  customer_name?: string
  has_quote: boolean
}

const REQUEST_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  submitted: { label: 'Soumis',      bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400' },
  reviewing: { label: 'En révision', bg: 'bg-primary/10',  text: 'text-primary',     dot: 'bg-primary' },
  quoted:    { label: 'Devisé',      bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejected:  { label: 'Refusé',      bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
}

const URGENCY_LABELS: Record<string, string> = {
  normal:  'Normal (4-6 sem.)',
  urgent:  'Urgent (2-3 sem.)',
  express: 'Express (1-2 sem.)',
}

const STATUS_FILTERS = [
  { value: 'submitted', label: 'Soumis' },
  { value: 'reviewing', label: 'En révision' },
  { value: 'quoted',    label: 'Devisés' },
  { value: 'rejected',  label: 'Refusés' },
  { value: 'all',       label: 'Tous' },
]

function QuoteBuilder({ request, onCreated, onCancel }: { request: ProductRequest; onCreated: () => void; onCancel: () => void }) {
  const [productPrice, setProductPrice] = useState('')
  const [quantity, setQuantity] = useState(request.quantity.toString())
  const [serviceFee, setServiceFee] = useState('5000')
  const [purchaseFee, setPurchaseFee] = useState('3000')
  const [shippingFee, setShippingFee] = useState('15000')
  const [customsFee, setCustomsFee] = useState('8000')
  const [localFee, setLocalFee] = useState('2500')
  const [margin, setMargin] = useState('2000')
  const [contingency, setContingency] = useState('1000')
  const [deliveryDays, setDeliveryDays] = useState('35')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const parseNum = (v: string) => parseFloat(v) || 0
  const subtotal = parseNum(productPrice) * parseNum(quantity)
  const totalFees = parseNum(serviceFee) + parseNum(purchaseFee) + parseNum(shippingFee) + parseNum(customsFee) + parseNum(localFee) + parseNum(margin) + parseNum(contingency)
  const total = subtotal + totalFees

  async function handleCreate() {
    if (!productPrice) return
    setSaving(true)

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 7)

    const { data: quoteData, error } = await supabase
      .from('quotes')
      .insert({
        request_id: request.id,
        product_price: parseNum(productPrice),
        quantity: parseNum(quantity),
        service_fee: parseNum(serviceFee),
        purchase_fee: parseNum(purchaseFee),
        shipping_fee: parseNum(shippingFee),
        customs_fee: parseNum(customsFee),
        local_delivery_fee: parseNum(localFee),
        margin: parseNum(margin),
        contingency: parseNum(contingency),
        total,
        estimated_delivery_days: parseNum(deliveryDays),
        status: 'pending',
        valid_until: validUntil.toISOString(),
        notes: notes || null,
      })
      .select('id')
      .maybeSingle()

    if (error || !quoteData) {
      toast.error('Erreur lors de la création du devis.')
      setSaving(false)
      return
    }

    await supabase.from('product_requests').update({ status: 'quoted' }).eq('id', request.id)
    await supabase.from('orders').insert({ user_id: request.user_id, quote_id: quoteData.id, status: 'quote_sent' })
    await supabase.from('notifications').insert({
      user_id: request.user_id,
      title: 'Devis prêt !',
      message: `Votre devis pour "${request.product_name}" est prêt. Montant total: ${total.toLocaleString()} HTG.`,
      type: 'success',
    })

    toast.success('Devis créé et commande ouverte.')
    setSaving(false)
    onCreated()
  }

  const fields = [
    { label: 'Prix produit (HTG) *', value: productPrice, onChange: setProductPrice },
    { label: 'Quantité', value: quantity, onChange: setQuantity },
    { label: 'Frais de service', value: serviceFee, onChange: setServiceFee },
    { label: "Frais d'achat", value: purchaseFee, onChange: setPurchaseFee },
    { label: 'Fret maritime', value: shippingFee, onChange: setShippingFee },
    { label: 'Douane estimée', value: customsFee, onChange: setCustomsFee },
    { label: 'Livraison locale', value: localFee, onChange: setLocalFee },
    { label: 'Marge', value: margin, onChange: setMargin },
    { label: 'Imprévus', value: contingency, onChange: setContingency },
    { label: 'Délai livraison (jours)', value: deliveryDays, onChange: setDeliveryDays },
  ]

  return (
    <div className="space-y-4 py-2">
      {/* Product info */}
      <div className="rounded-xl bg-muted/40 p-3 space-y-1">
        <p className="font-semibold text-sm">{request.product_name}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Qté: {request.quantity}</span>
          <span>·</span>
          <span>{URGENCY_LABELS[request.urgency]}</span>
          {request.budget_estimate && <><span>·</span><span>Budget: {request.budget_estimate.toLocaleString()} HTG</span></>}
        </div>
        {request.notes && <p className="text-xs text-muted-foreground italic">{request.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.label} className="space-y-1">
            <Label className="text-xs font-semibold">{f.label}</Label>
            <Input type="number" value={f.value} onChange={e => f.onChange(e.target.value)} className="h-8 text-sm rounded-lg" placeholder="0" />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Notes internes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm rounded-xl resize-none" />
      </div>

      {/* Total preview */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Produit ({quantity} × {productPrice || 0} HTG)</span>
          <span className="font-mono">{subtotal.toLocaleString()} HTG</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Frais & marges</span>
          <span className="font-mono">+ {totalFees.toLocaleString()} HTG</span>
        </div>
        <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
          <span>Total client</span>
          <span className="text-primary font-mono">{total.toLocaleString()} HTG</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="rounded-xl">Annuler</Button>
        <Button onClick={handleCreate} disabled={saving || !productPrice} className="rounded-xl">
          {saving ? 'Création...' : 'Créer le devis'}
        </Button>
      </div>
    </div>
  )
}

export function AdminQuotesPage() {
  const [requests, setRequests] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('submitted')
  const [quoteRequest, setQuoteRequest] = useState<ProductRequest | null>(null)

  async function loadRequests() {
    const { data } = await supabase
      .from('product_requests')
      .select('id, product_name, product_url, source_platform, category, quantity, urgency, budget_estimate, notes, status, created_at, user_id')
      .order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }

    const userIds = [...new Set(data.map(r => r.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]))

    const { data: quotesData } = await supabase.from('quotes').select('request_id')
    const quotedIds = new Set((quotesData || []).map(q => q.request_id))

    setRequests(data.map(r => ({
      ...(r as unknown as ProductRequest),
      customer_name: profileMap[r.user_id] || '—',
      has_quote: quotedIds.has(r.id),
    })))
    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [])

  const filtered = requests.filter(r => {
    const matchSearch = r.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.customer_name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion des devis</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading ? '…' : `${filtered.length} demande${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filters + table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par client ou produit..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={statusFilter === f.value ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(f.value)}
                  className="rounded-xl shrink-0"
                >
                  {f.label}
                  {f.value !== 'all' && (
                    <span className={cn(
                      'ml-1.5 text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-0.5',
                      statusFilter === f.value ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {requests.filter(r => r.status === f.value).length}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">Aucune demande</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Aucune demande ne correspond à votre filtre</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Produit</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Plateforme</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell text-right">Qté</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Urgence</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right">Budget</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Statut</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Date</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const cfg = REQUEST_STATUS_CONFIG[r.status] || REQUEST_STATUS_CONFIG.submitted
                return (
                  <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium text-sm">{r.customer_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[150px] truncate text-sm">{r.product_name}</span>
                        <a href={r.product_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs font-semibold capitalize text-muted-foreground">{r.source_platform}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-sm">{r.quantity}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{r.urgency}</TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <span className="text-sm font-semibold">{r.budget_estimate ? r.budget_estimate.toLocaleString() : '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1', cfg.bg, cfg.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                          {r.status === 'submitted' && (
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={async () => {
                              await supabase.from('product_requests').update({ status: 'reviewing' }).eq('id', r.id)
                              setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'reviewing' } : x))
                              toast.success('Demande mise en révision.')
                            }}>
                              <Eye className="mr-2 h-4 w-4" />Mettre en révision
                            </DropdownMenuItem>
                          )}
                          {(r.status === 'submitted' || r.status === 'reviewing') && !r.has_quote && (
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setQuoteRequest(r)}>
                              <Calculator className="mr-2 h-4 w-4" />Créer devis
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="rounded-lg cursor-pointer text-destructive focus:text-destructive" onClick={async () => {
                            await supabase.from('product_requests').update({ status: 'rejected' }).eq('id', r.id)
                            await supabase.from('notifications').insert({
                              user_id: r.user_id,
                              title: 'Demande refusée',
                              message: `Votre demande pour "${r.product_name}" n'a pas pu être traitée.`,
                              type: 'warning',
                            })
                            setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'rejected' } : x))
                            toast.success('Demande refusée.')
                          }}>
                            <XCircle className="mr-2 h-4 w-4" />Refuser
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Quote builder dialog */}
      <Dialog open={!!quoteRequest} onOpenChange={o => { if (!o) setQuoteRequest(null) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Créer un devis
            </DialogTitle>
            <DialogDescription>
              Calculez le devis tout-compris pour <span className="font-semibold">{quoteRequest?.customer_name}</span>
            </DialogDescription>
          </DialogHeader>
          {quoteRequest && (
            <QuoteBuilder
              request={quoteRequest}
              onCreated={() => { setQuoteRequest(null); loadRequests() }}
              onCancel={() => setQuoteRequest(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
