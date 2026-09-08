import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Wallet, Loader2, CheckCircle, Package, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCart } from '@/lib/cart-context'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { toast } from 'sonner'

interface WalletData {
  id: string
  available_balance: number
}

export function CheckoutPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, total, clearCart } = useCart()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)

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

  // Redirect if cart is empty (and not just paid)
  useEffect(() => {
    if (!success && items.length === 0 && !paying) {
      navigate('/products', { replace: true })
    }
  }, [items, success, paying, navigate])

  async function handlePay() {
    if (!wallet || !user) return
    if (wallet.available_balance < total) {
      toast.error('Solde insuffisant', { description: 'Rechargez votre portefeuille pour continuer.' })
      return
    }

    setPaying(true)
    try {
      // Create the product_order
      const { data: order, error: orderErr } = await supabase
        .from('product_orders')
        .insert({
          user_id: user.id,
          total_htg: total,
          status: 'pending',
          payment_status: 'unpaid',
        })
        .select('id')
        .single()

      if (orderErr || !order) throw new Error(orderErr?.message ?? 'Erreur création commande')

      // Insert order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.products?.name ?? '',
        product_price_htg: item.products?.price_htg ?? 0,
        quantity: item.quantity,
        subtotal_htg: (item.products?.price_htg ?? 0) * item.quantity,
      }))

      const { error: itemsErr } = await supabase.from('product_order_items').insert(orderItems)
      if (itemsErr) throw new Error(itemsErr.message)

      // Deduct wallet via RPC
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('pay_product_order', { p_order_id: order.id })
      if (rpcErr) throw new Error(rpcErr.message)
      if (rpcResult?.error) throw new Error(rpcResult.error)

      await clearCart()
      setSuccess(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      toast.error('Paiement échoué', { description: msg })
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
          <p className="text-2xl font-black text-emerald-600 mb-6">
            {total.toLocaleString('fr-HT')} HTG
          </p>
          <button
            onClick={() => navigate('/orders')}
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
            Continuer mes achats
          </button>
        </div>
      </div>
    )
  }

  const insufficient = wallet ? wallet.available_balance < total : false

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
        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold">{t('checkout.order_summary')}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.products?.images?.length > 0 ? (
                    <img src={item.products.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground/25" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.products?.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} × {(item.products?.price_htg ?? 0).toLocaleString('fr-HT')} HTG</p>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">
                  {((item.products?.price_htg ?? 0) * item.quantity).toLocaleString('fr-HT')} HTG
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm font-bold">{t('cart.total')}</span>
            <span className="text-lg font-black text-primary">{total.toLocaleString('fr-HT')} HTG</span>
          </div>
        </div>

        {/* Wallet balance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">{t('checkout.payment')}</p>
              <p className="text-xs text-muted-foreground">Paiement instantané depuis votre solde</p>
            </div>
          </div>

          {loadingWallet ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du solde…
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-sm text-muted-foreground">{t('checkout.balance')}</p>
              <p className={`text-base font-black ${insufficient ? 'text-destructive' : 'text-emerald-600'}`}>
                {(wallet?.available_balance ?? 0).toLocaleString('fr-HT')} HTG
              </p>
            </div>
          )}

          {insufficient && !loadingWallet && (
            <div className="mt-3 p-3 rounded-xl bg-destructive/8 border border-destructive/20">
              <p className="text-xs font-semibold text-destructive mb-1">{t('checkout.insufficient')}</p>
              <p className="text-xs text-muted-foreground">
                Il vous manque {(total - (wallet?.available_balance ?? 0)).toLocaleString('fr-HT')} HTG.
              </p>
            </div>
          )}
        </div>
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
            disabled={paying || loadingWallet || items.length === 0}
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
                {t('checkout.confirm')} · {total.toLocaleString('fr-HT')} HTG
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
