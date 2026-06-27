import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
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

const REQUEST_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Soumis', color: 'bg-warning/15 text-warning' },
  reviewing: { label: 'En révision', color: 'bg-primary/15 text-primary' },
  quoted: { label: 'Devisé', color: 'bg-success/15 text-success' },
  rejected: { label: 'Refusé', color: 'bg-destructive/15 text-destructive' },
}

const URGENCY_LABELS: Record<string, string> = {
  normal: 'Normal (4-6 sem.)',
  urgent: 'Urgent (2-3 sem.)',
  express: 'Express (1-2 sem.)',
}

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

    // Update product request status
    await supabase.from('product_requests').update({ status: 'quoted' }).eq('id', request.id)

    // Create order from quote
    await supabase.from('orders').insert({
      user_id: request.user_id,
      quote_id: quoteData.id,
      status: 'quote_sent',
    })

    // Notify client
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

  return (
    <div className="space-y-5 py-2">
      {/* Product info */}
      <div className="rounded-xl bg-muted/40 p-3 space-y-1">
        <p className="font-semibold text-sm">{request.product_name}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Qté: {request.quantity}</span>
          <span>•</span>
          <span>{URGENCY_LABELS[request.urgency]}</span>
          {request.budget_estimate && <><span>•</span><span>Budget: {request.budget_estimate.toLocaleString()} HTG</span></>}
        </div>
        {request.notes && <p className="text-xs text-muted-foreground italic">{request.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Prix produit (HTG) *</Label>
          <Input type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)} className="h-8 text-sm" placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quantité</Label>
          <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Frais de service (HTG)</Label>
          <Input type="number" value={serviceFee} onChange={e => setServiceFee(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Frais d'achat (HTG)</Label>
          <Input type="number" value={purchaseFee} onChange={e => setPurchaseFee(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fret maritime (HTG)</Label>
          <Input type="number" value={shippingFee} onChange={e => setShippingFee(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Douane estimée (HTG)</Label>
          <Input type="number" value={customsFee} onChange={e => setCustomsFee(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Livraison locale (HTG)</Label>
          <Input type="number" value={localFee} onChange={e => setLocalFee(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Marge (HTG)</Label>
          <Input type="number" value={margin} onChange={e => setMargin(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Imprévus (HTG)</Label>
          <Input type="number" value={contingency} onChange={e => setContingency(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Délai livraison (jours)</Label>
          <Input type="number" value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes internes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm" />
      </div>

      {/* Total preview */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Produit</span>
          <span>{subtotal.toLocaleString()} HTG</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Frais & marges</span>
          <span>{totalFees.toLocaleString()} HTG</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>Total client</span>
          <span className="text-primary">{total.toLocaleString()} HTG</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} type="button">Annuler</Button>
        <Button onClick={handleCreate} disabled={saving || !productPrice} type="button">
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

  const STATUS_FILTERS = [
    { value: 'submitted', label: 'Soumis' },
    { value: 'reviewing', label: 'En révision' },
    { value: 'quoted', label: 'Devisés' },
    { value: 'rejected', label: 'Refusés' },
    { value: 'all', label: 'Tous' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des devis" description="Traitez les demandes produits et créez les devis" />

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
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={FileText} title="Aucune demande" description="Aucune demande ne correspond à votre filtre." />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Urgence</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const cfg = REQUEST_STATUS_CONFIG[r.status] || REQUEST_STATUS_CONFIG.submitted
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-[150px] truncate">{r.product_name}</span>
                            <a href={r.product_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{r.source_platform}</Badge>
                        </TableCell>
                        <TableCell>{r.quantity}</TableCell>
                        <TableCell className="text-xs">{r.urgency}</TableCell>
                        <TableCell className="text-sm">{r.budget_estimate ? `${r.budget_estimate.toLocaleString()}` : '—'}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', cfg.color)}>{cfg.label}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('fr-HT')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {r.status === 'submitted' && (
                                <DropdownMenuItem onClick={async () => {
                                  await supabase.from('product_requests').update({ status: 'reviewing' }).eq('id', r.id)
                                  setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'reviewing' } : x))
                                  toast.success('Demande mise en révision.')
                                }}>
                                  <Eye className="mr-2 h-4 w-4" />En révision
                                </DropdownMenuItem>
                              )}
                              {(r.status === 'submitted' || r.status === 'reviewing') && !r.has_quote && (
                                <DropdownMenuItem onClick={() => setQuoteRequest(r)}>
                                  <Calculator className="mr-2 h-4 w-4" />Créer devis
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={async () => {
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote builder dialog */}
      <Dialog open={!!quoteRequest} onOpenChange={o => { if (!o) setQuoteRequest(null) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Créer un devis
            </DialogTitle>
            <DialogDescription>
              Calculez le devis tout-compris pour {quoteRequest?.customer_name}
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
