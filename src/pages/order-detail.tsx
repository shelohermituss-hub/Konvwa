import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { TimelineStep } from '@/components/shared/timeline-step'
import { ArrowLeft, Clock, FileText, Calendar, CheckCircle2, XCircle, Wallet, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import IconBoite from 'flat-color-icons/svg/package.svg'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
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

interface WalletData {
  id: string
  available_balance: number
}

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold text-foreground ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (!id || !user) return

    Promise.all([
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
        .maybeSingle(),
      supabase
        .from('wallets')
        .select('id, available_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]).then(([orderRes, walletRes]) => {
      if (orderRes.data) setOrder(orderRes.data as unknown as OrderDetail)
      else setNotFound(true)
      if (walletRes.data) setWallet(walletRes.data)
      setLoading(false)
    })
  }, [id, user])

  function estimatedDelivery() {
    if (!order?.quotes?.estimated_delivery_days) return null
    const d = new Date(order.created_at)
    d.setDate(d.getDate() + order.quotes.estimated_delivery_days)
    return d
  }

  async function handleAcceptQuote() {
    if (!order) return
    setAccepting(true)
    const { data, error } = await supabase.rpc('accept_quote', { p_order_id: order.id })
    if (error || !data?.success) {
      toast.error(data?.error || 'Erreur lors de l\'acceptation du devis.')
    } else {
      toast.success('Devis accepté ! Procédez au paiement.')
      setOrder(prev => prev ? { ...prev, status: 'awaiting_payment' } : null)
    }
    setAccepting(false)
  }

  async function handleRejectQuote() {
    if (!order) return
    const { data, error } = await supabase.rpc('reject_quote', { p_order_id: order.id })
    if (error || !data?.success) {
      toast.error(data?.error || 'Erreur lors du refus du devis.')
    } else {
      toast.info('Devis refusé.')
      setOrder(prev => prev ? { ...prev, status: 'cancelled' } : null)
    }
  }

  async function handlePayNow() {
    if (!order?.quotes || !wallet) return
    const total = order.quotes.total
    if (wallet.available_balance < total) {
      toast.error('Solde insuffisant. Veuillez recharger votre portefeuille.')
      return
    }
    setPaying(true)
    try {
      const { data, error } = await supabase.rpc('pay_order', { p_order_id: order.id })
      if (error) throw error
      if (!data?.success) {
        toast.error(data?.error || 'Erreur lors du paiement.')
        return
      }
      toast.success('Paiement effectué ! Votre commande est en cours de traitement.')
      setOrder(prev => prev ? { ...prev, status: 'paid', payment_status: 'paid', total_paid: total } : null)
      setWallet(prev => prev ? { ...prev, available_balance: prev.available_balance - total } : null)
    } catch {
      toast.error('Erreur lors du paiement. Réessayez.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#F4F5F7] px-4 pt-5 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="min-h-full bg-[#F4F5F7] flex items-center justify-center px-4">
        <div className="text-center">
          <img src={IconBoite} alt="" className="h-14 w-14 mx-auto opacity-30 mb-3" />
          <p className="text-muted-foreground mb-4 font-medium">Commande introuvable.</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/orders"><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link>
          </Button>
        </div>
      </div>
    )
  }

  const productName = order.quotes?.product_requests?.product_name || 'Produit'
  const delivery = estimatedDelivery()
  const total = order.quotes?.total ?? 0
  const canPay = wallet ? wallet.available_balance >= total : false
  const needsPayment = order.status === 'awaiting_payment' && order.payment_status !== 'paid'

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-10">

      {/* Header */}
      <div className="bg-white border-b border-border/60 px-4 pt-4 pb-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-xl">
            <Link to="/orders"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-foreground truncate">{productName}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-muted-foreground font-mono">{order.tracking_code}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Status tracker */}
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm px-4 py-4">
          <OrderStatusTracker status={order.status} />
        </div>

        {/* ── DEVIS REÇU — accepter/refuser ── */}
        {order.status === 'quote_sent' && order.quotes && (
          <div className="rounded-2xl bg-primary/8 border border-primary/20 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Devis reçu — Action requise</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Total : <span className="font-bold text-primary">{total.toLocaleString('fr-HT')} HTG</span>
                  {order.quotes.estimated_delivery_days && ` · ${order.quotes.estimated_delivery_days} jours`}
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                    <XCircle className="h-3.5 w-3.5" />Refuser
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Refuser ce devis ?</AlertDialogTitle>
                    <AlertDialogDescription>La commande sera annulée. Cette action est irréversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRejectQuote} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Confirmer le refus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" onClick={handleAcceptQuote} disabled={accepting} className="flex-1 rounded-xl gap-1.5">
                {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {accepting ? 'Acceptation…' : 'Accepter'}
              </Button>
            </div>
          </div>
        )}

        {/* ── PAIEMENT REQUIS — CTA proéminent ── */}
        {needsPayment && (
          <div className="rounded-2xl border border-warning/30 overflow-hidden shadow-sm">
            <div className="bg-warning/8 px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/20 shrink-0">
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Paiement requis</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Réglez <span className="font-bold text-foreground">{total.toLocaleString('fr-HT')} HTG</span> depuis votre portefeuille pour lancer la commande.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white px-4 py-3 space-y-3">
              {/* Solde dispo */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Solde disponible
                </span>
                <span className={`font-bold ${canPay ? 'text-emerald-600' : 'text-destructive'}`}>
                  {(wallet?.available_balance ?? 0).toLocaleString('fr-HT')} HTG
                </span>
              </div>
              {canPay ? (
                <Button
                  onClick={handlePayNow}
                  disabled={paying}
                  className="w-full rounded-xl h-11 font-bold gap-2"
                >
                  {paying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Paiement en cours…</>
                  ) : (
                    <><Wallet className="h-4 w-4" />Payer {total.toLocaleString('fr-HT')} HTG</>
                  )}
                </Button>
              ) : (
                <Button asChild className="w-full rounded-xl h-11 font-bold gap-2">
                  <Link to="/wallet">
                    <Wallet className="h-4 w-4" />
                    Recharger mon portefeuille
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Détails commande */}
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Détails commande</p>
          </div>
          <div className="px-4 divide-y divide-border/50">
            <InfoRow label="Plateforme" value={(order.quotes?.product_requests?.source_platform || '—').toUpperCase()} />
            <InfoRow label="Date" value={new Date(order.created_at).toLocaleDateString('fr-FR')} />
            {delivery && <InfoRow label="Livraison estimée" value={delivery.toLocaleDateString('fr-FR')} />}
            <InfoRow
              label="Statut paiement"
              value={order.payment_status === 'paid' ? 'Payé' : order.payment_status === 'partial' ? 'Partiel' : 'Impayé'}
              valueClass={order.payment_status === 'paid' ? 'text-emerald-600' : 'text-warning'}
            />
            {order.quotes?.product_requests?.product_url && (
              <div className="py-3">
                <a
                  href={order.quotes.product_requests.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary font-semibold flex items-center gap-1.5 hover:underline"
                >
                  Voir le produit <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Résumé paiement */}
        {order.quotes && (
          <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Résumé paiement</p>
            </div>
            <div className="px-4 py-2">
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Prix produit</span>
                <span className="font-medium">{order.quotes.product_price.toLocaleString('fr-HT')} HTG</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Quantité</span>
                <span className="font-medium">× {order.quotes.quantity}</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Frais de service</span>
                <span className="font-medium">{order.quotes.service_fee.toLocaleString('fr-HT')} HTG</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Frais d'achat</span>
                <span className="font-medium">{order.quotes.purchase_fee.toLocaleString('fr-HT')} HTG</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Frais maritime</span>
                <span className="font-medium">{order.quotes.shipping_fee.toLocaleString('fr-HT')} HTG</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Douane estimée</span>
                <span className="font-medium">{order.quotes.customs_fee.toLocaleString('fr-HT')} HTG</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm border-b border-border/50">
                <span className="text-muted-foreground">Livraison locale</span>
                <span className="font-medium">{order.quotes.local_delivery_fee.toLocaleString('fr-HT')} HTG</span>
              </div>
              <Separator className="my-0" />
              <div className="flex justify-between py-3">
                <span className="font-bold text-base">Total</span>
                <span className="font-bold text-base text-primary">{order.quotes.total.toLocaleString('fr-HT')} HTG</span>
              </div>
              <div className="flex justify-between pb-3 text-sm">
                <span className="text-emerald-600 font-medium">Déjà payé</span>
                <span className="text-emerald-600 font-semibold">{order.total_paid.toLocaleString('fr-HT')} HTG</span>
              </div>
            </div>
          </div>
        )}

        {/* Suivi timeline */}
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">Suivi de la commande</p>
          </div>
          <div className="px-4 py-4">
            <TimelineStep currentStatus={order.status as OrderStatus} />
          </div>
        </div>

        {/* Expédition */}
        {delivery && (
          <div className="rounded-2xl bg-white border border-border/60 shadow-sm px-4 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Arrivée estimée</p>
              <p className="text-sm font-bold text-foreground">{delivery.toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        )}

        {/* Support */}
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Besoin d'aide ?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Notre équipe est disponible</p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link to="/support">Contacter</Link>
          </Button>
        </div>

      </div>
    </div>
  )
}
