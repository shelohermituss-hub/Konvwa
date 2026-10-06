import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Wallet, Loader2, CheckCircle, Package, ArrowRight, Plane, Ship, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CART_PRODUCT_SELECT, cartLineUnitPrice, cartLineVariantName, toCartProduct, useCart, type CartItem } from '@/lib/cart-context'
import { VARIANT_SELECT, type ProductVariant } from '@/lib/catalog'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { toast } from 'sonner'

import { inviteInstall } from '@/lib/pwa'
import { tr, LOCALE_TAG } from '@/lib/i18n'
import { useStepUp } from '@/lib/step-up'
import { createCheckoutPayment } from '@/lib/payment-api'
import { createCheckout, fetchCheckoutShipping, type CheckoutShipping, type CreatedOrder } from '@/lib/checkout-api'
import { cn } from '@/lib/utils'
import { money } from '@/lib/currency'
interface WalletData {
  id: string
  available_balance: number
}

export function CheckoutPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const { items: cartItems, total: cartTotal, clearCart: clearCartItems } = useCart()
  // "Buy" from a product page: only that product is bought, the cart is left as it is
  const location = useLocation()
  const buyNow = (location.state as { buyNow?: { product_id: string; variant_id: string | null; quantity: number } } | null)?.buyNow ?? null
  const [buyItem, setBuyItem] = useState<CartItem | null>(null)
  const [buyLoading, setBuyLoading] = useState(!!buyNow)
  const items = useMemo(() => (buyNow ? (buyItem ? [buyItem] : []) : cartItems), [buyNow, buyItem, cartItems])
  const total = buyNow ? (buyItem ? cartLineUnitPrice(buyItem) * buyItem.quantity : 0) : cartTotal
  const clearCart = async () => { if (!buyNow) await clearCartItems() }
  const { confirmPayment } = useStepUp()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paidOrders, setPaidOrders] = useState<CreatedOrder[]>([])
  // US products are sold all inclusive: the customer picks the shipping method here and pays everything at once
  const [shipping, setShipping] = useState<CheckoutShipping | null>(null)
  const [shippingLoading, setShippingLoading] = useState(true)
  const [shippingError, setShippingError] = useState('')
  const [rateId, setRateId] = useState<string | null>(null)
  // How the customer pays: the wallet, or MonCash / NatCash directly (redirected to the gateway; nothing is ordered until it confirms)
  const [payWith, setPayWith] = useState<'wallet' | 'moncash' | 'natcash' | 'stripe'>('wallet')

  useEffect(() => {
    if (!buyNow || !user) return
    let cancelled = false
    void (async () => {
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from('products').select(CART_PRODUCT_SELECT).eq('id', buyNow.product_id).eq('active', true).maybeSingle(),
        buyNow.variant_id ? supabase.from('product_variants').select(VARIANT_SELECT).eq('id', buyNow.variant_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      if (p && (!buyNow.variant_id || v)) {
        setBuyItem({
          id: 'buy-now', product_id: buyNow.product_id, variant_id: buyNow.variant_id, quantity: Math.max(1, Math.floor(buyNow.quantity)),
          product_variants: v ? { ...(v as ProductVariant), price_htg: Number((v as ProductVariant).price_htg) } : null,
          products: toCartProduct(p as unknown as CartItem['products'], !!profile?.is_reseller),
        })
      }
      setBuyLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyNow?.product_id, buyNow?.variant_id, user])

  useEffect(() => {
    if (!user) return
    supabase
      .from('wallets')
      .select('id, available_balance')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setWallet(data as WalletData)
        setLoadingWallet(false)
      })
  }, [user])

  const cartKey = items.map(i => `${i.product_id}:${i.variant_id ?? ''}:${i.quantity}`).join(',')
  useEffect(() => {
    if (items.length === 0) { setShippingLoading(false); return }
    let cancelled = false
    setShippingLoading(true); setShippingError('')
    fetchCheckoutShipping(items.map(i => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity })))
      .then((r) => {
        if (cancelled) return
        setShipping(r)
        setRateId((prev) => (r.options.some(o => o.rate_id === prev) ? prev : r.options[0]?.rate_id ?? null))
      })
      .catch((e: unknown) => { if (!cancelled) setShippingError(e instanceof Error ? e.message : tr('Erreur inconnue')) })
      .finally(() => { if (!cancelled) setShippingLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey])

  const hasUs = (shipping?.us_count ?? 0) > 0
  const chosen = shipping?.options.find(o => o.rate_id === rateId) ?? null
  const shippingFee = hasUs && chosen ? chosen.amount_htg : 0
  const grandTotal = total + shippingFee
  const blocked = (shipping?.missing.length ?? 0) > 0
  const noMethod = hasUs && !blocked && !chosen
  const canPay = !shippingLoading && !shippingError && !blocked && !noMethod

  // Redirect if cart is empty (and not just paid)
  useEffect(() => {
    if (!success && items.length === 0 && !paying && !buyLoading) {
      navigate('/products', { replace: true })
    }
  }, [items, success, paying, navigate, buyLoading])

  async function handleGatewayPay() {
    if (!user || !canPay || (payWith !== 'moncash' && payWith !== 'natcash' && payWith !== 'stripe')) return
    if (!(await confirmPayment(grandTotal))) return
    setPaying(true)
    try {
      // The amount is recomputed by the database; the orders are only placed when the gateway confirms the payment
      const r = await createCheckoutPayment({
        method: payWith,
        items: items.map(i => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity })),
        shipping_rate_id: hasUs ? rateId : null,
        source: buyNow ? 'buy_now' : 'cart',
      })
      sessionStorage.setItem('konvwa_pay_ref', r.reference_id)
      toast.success(tr('Redirection vers ') + (payWith === 'moncash' ? 'MonCash' : payWith === 'stripe' ? tr('la page de paiement par carte') : 'NatCash') + '…')
      window.location.href = r.url
    } catch (e: unknown) {
      toast.error(tr('Paiement échoué'), { description: e instanceof Error ? e.message : tr('Erreur inconnue') })
      setPaying(false)
    }
  }

  async function handlePay() {
    if (viaGateway) { await handleGatewayPay(); return }
    if (!wallet || !user) return
    if (!canPay) return
    if (wallet.available_balance < grandTotal) {
      toast.error(tr('Solde insuffisant'), { description: tr('Rechargez votre portefeuille pour continuer.') })
      return
    }
    if (!(await confirmPayment(grandTotal))) return

    setPaying(true)
    try {
      // The orders, their prices and the shipping fee are computed by the database from the product ids and the chosen method
      const created = await createCheckout(items.map(item => ({ product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity })), hasUs ? rateId : null)
      const done: CreatedOrder[] = []
      for (const order of created.orders) {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('pay_product_order', { p_order_id: order.order_id })
        const failure = rpcErr ? rpcErr.message : rpcResult && rpcResult.success === false ? (rpcResult.error ?? tr('Paiement refusé')) : null
        if (failure) {
          if (done.length > 0) { await clearCart(); setPaidOrders(done); setOrderId(done[0].order_id) }
          throw new Error(done.length > 0 ? `${failure} — ${tr('une commande est restée à payer : retrouvez-la dans Commandes.')}` : failure)
        }
        done.push(order)
      }
      await clearCart()
      setPaidOrders(done)
      setOrderId(done[0]?.order_id ?? null)
      setSuccess(true)
      inviteInstall()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : tr('Erreur inconnue')
      toast.error(tr('Paiement échoué'), { description: msg })
    } finally {
      setPaying(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-5">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-lg font-bold mb-2">{t('checkout.success')}</h1>
          <p className="text-sm text-muted-foreground mb-2">{t('checkout.success_sub')}</p>
          <p className="text-2xl font-black text-emerald-700 mb-3">
            {money(paidOrders.reduce((sum, o) => sum + o.total, 0))}
          </p>
          <p className="mb-6 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {paidOrders.some(o => o.prepaid) && paidOrders.some(o => !o.prepaid)
              ? tr('Produits des États-Unis : achat et expédition payés. Autres produits : achat payé, l\'expédition se paiera à l\'arrivée du colis à l\'entrepôt (nous vous préviendrons).')
              : paidOrders.some(o => o.prepaid)
                ? tr('Achat et expédition sont payés : il n\'y a plus rien à payer. Nous vous suivons votre colis jusqu\'à la livraison.')
                : tr('Vous avez payé l\'achat des produits. À l\'arrivée du colis à l\'entrepôt, nous vous préviendrons pour payer l\'expédition.')}
          </p>
          <button
            onClick={() => navigate(paidOrders.length === 1 && orderId ? `/product-orders/${orderId}` : '/orders')}
            className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white mb-3"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            {t('checkout.view_orders')}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/products')}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            {tr('Continuer mes achats')}
          </button>
        </div>
      </div>
    )
  }

  const viaGateway = payWith !== 'wallet'
  const insufficient = !viaGateway && (wallet ? wallet.available_balance < grandTotal : false)

  return (
    <div className="min-h-full bg-[#F4F5F7] pb-36">
      {/* Header */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-white/95 backdrop-blur-md px-4 border-b border-gray-100 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold">{t('checkout.title')}</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {hasUs ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground">
            <p className="font-bold">{shipping && shipping.other_count > 0 ? tr('Votre panier sera séparé en 2 commandes') : tr('Expédition incluse')}</p>
            <p className="mt-0.5 text-muted-foreground">
              {shipping && shipping.other_count > 0
                ? tr('Produits des États-Unis : achat et expédition payés maintenant (tout inclus). Autres produits : achat seul, l\'expédition se paie plus tard, à l\'arrivée du colis à l\'entrepôt.')
                : tr('Ces produits viennent des États-Unis : choisissez le mode d\'expédition ci-dessous et payez tout maintenant, achat et livraison.')}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground">
            <p className="font-bold">{tr('Achat seul')}</p>
            <p className="mt-0.5 text-muted-foreground">{tr('Vous payez ici l\'achat des produits. L\'expédition se paie plus tard, quand votre colis est arrivé à l\'entrepôt et que nous vous prévenons.')}</p>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold">{t('checkout.order_summary')}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {(item.product_variants?.image ?? item.products?.images?.[0]) ? (
                    <img src={item.product_variants?.image ?? item.products?.images?.[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground/25" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.products?.name}</p>
                  {cartLineVariantName(item) && <p className="truncate text-xs text-foreground/80">{cartLineVariantName(item)}</p>}
                  {hasUs && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {(item.products?.supplier_country ?? '').toUpperCase() === 'US' ? tr('Expédition incluse') : tr('Achat seul')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{item.quantity} × {money(cartLineUnitPrice(item))}</p>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">
                  {money((cartLineUnitPrice(item) * item.quantity))}
                </p>
              </div>
            ))}
          </div>
          {hasUs && chosen && (
            <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{tr('Produits')}</span><span className="font-semibold">{money(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{tr('Expédition')} · {chosen.name}</span><span className="font-semibold">{money(shippingFee)}</span></div>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm font-bold">{t('cart.total')}</span>
            <span className="text-lg font-black text-primary">{money(grandTotal)}</span>
          </div>
        </div>

        {/* Shipping method (US products, all inclusive) */}
        {shippingLoading && items.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm text-muted-foreground border border-gray-100">
            <Loader2 className="h-4 w-4 animate-spin" />{tr('Calcul de l\'expédition…')}
          </div>
        )}
        {shippingError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{shippingError}</div>
        )}
        {blocked && shipping && (
          <div className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">{tr('Commande impossible pour le moment')}</p>
              <p className="mt-0.5 text-xs">{tr('Le colis de ces produits n\'est pas encore renseigné (poids, dimensions) : retirez-les du panier ou réessayez plus tard.')}</p>
              <ul className="mt-1 list-disc pl-4 text-xs">{shipping.missing.map(m => <li key={m.product_id}>{m.name}</li>)}</ul>
            </div>
          </div>
        )}
        {hasUs && !blocked && !shippingLoading && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold">{tr('Mode d\'expédition')}</p>
            <p className="mb-3 text-xs text-muted-foreground">{tr('Colis estimé : {0} kg. Le prix est calculé selon le poids et le volume.', (shipping?.kg ?? 0).toLocaleString(LOCALE_TAG))}</p>
            {shipping && shipping.options.length > 0 ? (
              <div className="space-y-2" role="radiogroup" aria-label={tr('Mode d\'expédition')}>
                {shipping.options.map(o => {
                  const active = o.rate_id === rateId
                  return (
                    <button key={o.rate_id} type="button" role="radio" aria-checked={active} onClick={() => setRateId(o.rate_id)}
                      className={cn('flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3 text-left transition-colors', active ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white')}>
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-white' : 'bg-gray-100 text-muted-foreground')}>
                        {o.mode === 'ocean' ? <Ship className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{o.name}</span>
                        {o.transit_days_min && o.transit_days_max ? <span className="text-xs text-muted-foreground">{o.transit_days_min}-{o.transit_days_max} {tr('jours')}</span> : null}
                      </span>
                      <span className="shrink-0 text-sm font-bold">{money(o.amount_htg)}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-destructive">{tr('Aucun mode d\'expédition disponible pour ce colis. Contactez le support.')}</p>
            )}
          </div>
        )}

        {/* Payment method */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="mb-3 text-sm font-bold">{tr('Moyen de paiement')}</p>
          <div role="radiogroup" aria-label={tr('Moyen de paiement')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              { id: 'wallet', label: tr('Portefeuille'), icon: <Wallet className="h-6 w-6 text-primary" aria-hidden /> },
              { id: 'moncash', label: 'MonCash', icon: <img src="/moncash-logo.jpg" alt="" className="h-6 object-contain" /> },
              { id: 'natcash', label: 'NatCash', icon: <img src="/natcash-logo.png" alt="" className="h-6 object-contain" /> },
              { id: 'stripe', label: tr('Carte'), icon: <img src="/pay-stripe.png" alt="" className="h-6 object-contain" /> },
            ] as const).filter((m) => m.id !== 'stripe' || isAdmin).map((m) => (
              <button
                key={m.id} type="button" role="radio" aria-checked={payWith === m.id} onClick={() => setPayWith(m.id)}
                className={cn('flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-xs font-semibold transition-colors active:scale-[0.98]',
                  payWith === m.id ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300')}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
          {viaGateway && (
            <p className="mt-3 text-xs text-muted-foreground">
              {tr('Vous serez redirigé vers la plateforme de paiement. La commande n\'est passée qu\'une fois le paiement validé ; sans validation, rien n\'est commandé.')}
            </p>
          )}
        </div>

        {/* Wallet balance */}
        {!viaGateway && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">{t('checkout.payment')}</p>
              <p className="text-xs text-muted-foreground">{tr('Paiement instantané depuis votre solde')}</p>
            </div>
          </div>

          {loadingWallet ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr('Chargement du solde…')}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-sm text-muted-foreground">{t('checkout.balance')}</p>
              <p className={`text-base font-black ${insufficient ? 'text-destructive' : 'text-emerald-700'}`}>
                {money((wallet?.available_balance ?? 0))}
              </p>
            </div>
          )}

          {insufficient && !loadingWallet && (
            <div className="mt-3 p-3 rounded-xl bg-destructive/8 border border-destructive/20">
              <p className="text-xs font-semibold text-destructive mb-1">{t('checkout.insufficient')}</p>
              <p className="text-xs text-muted-foreground">
                {tr('Il vous manque')}{' '}{money(grandTotal - (wallet?.available_balance ?? 0))}
              </p>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Bottom pay button */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_20px_rgba(10,22,40,0.08)] px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        {insufficient ? (
          <button
            onClick={() => navigate('/wallet')}
            className="w-full flex items-center justify-center gap-2 h-13 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            <Wallet className="h-4 w-4" />
            {t('checkout.topup')}
          </button>
        ) : (
          <button
            onClick={handlePay}
            disabled={paying || (!viaGateway && loadingWallet) || items.length === 0 || !canPay}
            className="w-full flex items-center justify-center gap-2 h-13 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('checkout.processing')}
              </>
            ) : (
              <>
                {viaGateway ? tr('Payer avec {0}', payWith === 'moncash' ? 'MonCash' : payWith === 'stripe' ? tr('Carte') : 'NatCash') : t('checkout.confirm')} · {money(grandTotal)}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
