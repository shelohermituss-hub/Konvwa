import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { TimelineStep } from '@/components/shared/timeline-step'
import { ArrowLeft, Mail, Clock, FileText, Calendar, CheckCircle2, XCircle, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { OrderStatus } from '@/types'
import { OrderStatusTracker } from '@/components/shared/order-status-tracker'

interface OrderDetail {
  id: string
  tracking_code: string
  status: string
  total_paid: number
  payment_status: string
  created_at: string
  quotes: {
    id: string
    total: number
    product_price: number
    quantity: number
    service_fee: number
    purchase_fee: number
    shipping_fee: number
    customs_fee: number
    local_delivery_fee: number
    estimated_delivery_days: number | null
    product_requests: {
      product_name: string
      product_url: string
      source_platform: string
    } | null
  } | null
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!id) return

    supabase
      .from('orders')
      .select(`
        id, tracking_code, status, total_paid, payment_status, created_at,
        quotes(
          id, total, product_price, quantity,
          service_fee, purchase_fee, shipping_fee, customs_fee, local_delivery_fee,
          estimated_delivery_days,
          product_requests(product_name, product_url, source_platform)
        )
      `)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOrder(data as unknown as OrderDetail)
        } else {
          setNotFound(true)
        }
        setLoading(false)
      })
  }, [id])

  function estimatedDelivery() {
    if (!order?.quotes?.estimated_delivery_days) return null
    const d = new Date(order.created_at)
    d.setDate(d.getDate() + order.quotes.estimated_delivery_days)
    return d
  }

  async function handleAcceptQuote() {
    if (!order?.quotes?.id) return
    setAccepting(true)
    const { error } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', order.quotes.id)
    const { error: orderError } = await supabase.from('orders').update({ status: 'awaiting_payment' }).eq('id', order.id)
    if (error || orderError) {
      toast.error('Erreur lors de l\'acceptation du devis.')
    } else {
      toast.success('Devis accepté ! Procédez au paiement.')
      setOrder(prev => prev ? { ...prev, status: 'awaiting_payment', quotes: prev.quotes ? { ...prev.quotes } : null } : null)
    }
    setAccepting(false)
  }

  async function handleRejectQuote() {
    if (!order?.quotes?.id) return
    const { error } = await supabase.from('quotes').update({ status: 'rejected' }).eq('id', order.quotes.id)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    if (error) {
      toast.error('Erreur lors du refus.')
    } else {
      toast.info('Devis refusé.')
      setOrder(prev => prev ? { ...prev, status: 'cancelled' } : null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">Commande introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/orders"><ArrowLeft className="mr-2 h-4 w-4" />Retour aux commandes</Link>
        </Button>
      </div>
    )
  }

  const productName = order.quotes?.product_requests?.product_name || 'Produit'
  const delivery = estimatedDelivery()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{productName}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-muted-foreground font-mono text-sm">{order.tracking_code}</p>
        </div>
      </div>

      {/* Status tracker */}
      <OrderStatusTracker status={order.status} className="bg-card rounded-2xl border border-border px-4 py-3" />

      {/* Quote action banner */}
      {order.status === 'quote_sent' && order.quotes && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Devis reçu — Action requise</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Total: <span className="font-bold text-primary">{order.quotes.total.toLocaleString()} HTG</span> · Délai: {order.quotes.estimated_delivery_days || '—'} jours
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                      <XCircle className="h-4 w-4" />Refuser
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Refuser ce devis ?</AlertDialogTitle>
                      <AlertDialogDescription>La commande sera annulée. Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRejectQuote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirmer le refus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" onClick={handleAcceptQuote} disabled={accepting} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {accepting ? 'Acceptation...' : 'Accepter le devis'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment CTA */}
      {order.status === 'awaiting_payment' && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-warning">Paiement requis</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Réglez {(order.quotes?.total ?? 0).toLocaleString()} HTG depuis votre portefeuille pour lancer la commande.
                </p>
              </div>
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/wallet">
                  <Wallet className="h-4 w-4" />Recharger / Payer
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Suivi de la commande
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineStep currentStatus={order.status as OrderStatus} />
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Détails</TabsTrigger>
              <TabsTrigger value="quote">Devis</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="support">Support</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plateforme</p>
                      <Badge variant="outline" className="mt-1 capitalize">
                        {order.quotes?.product_requests?.source_platform || '—'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date de commande</p>
                      <p className="font-medium">
                        {new Date(order.created_at).toLocaleDateString('fr-HT')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Livraison estimée</p>
                      <p className="font-medium">
                        {delivery ? delivery.toLocaleDateString('fr-HT') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Statut paiement</p>
                      <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="mt-1 capitalize">
                        {order.payment_status === 'paid' ? 'Payé' : order.payment_status === 'partial' ? 'Partiel' : 'Impayé'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quote" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {order.quotes ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Prix produit</span>
                        <span>{order.quotes.product_price.toLocaleString()} HTG</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Quantité</span>
                        <span>{order.quotes.quantity}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais de service</span>
                        <span>{order.quotes.service_fee.toLocaleString()} HTG</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais d'achat</span>
                        <span>{order.quotes.purchase_fee.toLocaleString()} HTG</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais maritime</span>
                        <span>{order.quotes.shipping_fee.toLocaleString()} HTG</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Douane estimée</span>
                        <span>{order.quotes.customs_fee.toLocaleString()} HTG</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Livraison locale</span>
                        <span>{order.quotes.local_delivery_fee.toLocaleString()} HTG</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span className="text-primary">{order.quotes.total.toLocaleString()} HTG</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Aucun devis disponible</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun document disponible pour le moment</p>
                    <p className="text-sm">Les factures et documents seront disponibles après livraison</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="support" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="mb-2">Besoin d'aide avec cette commande ?</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Notre équipe support est disponible pour vous aider
                    </p>
                    <Button asChild>
                      <Link to="/support">Contacter le support</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Résumé paiement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Total commande</span>
                <span className="font-semibold">{(order.quotes?.total ?? 0).toLocaleString()} HTG</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Payé</span>
                <span>{order.total_paid.toLocaleString()} HTG</span>
              </div>
              <Separator />
              <Badge className="w-full justify-center" variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                {order.payment_status === 'paid' ? 'Payé intégralement' : 'En attente de paiement'}
              </Badge>
            </CardContent>
          </Card>

          {delivery && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expédition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Arrivée estimée</p>
                    <p className="font-medium">{delivery.toLocaleDateString('fr-HT')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
