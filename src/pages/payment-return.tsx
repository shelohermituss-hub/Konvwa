import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Wallet } from 'lucide-react'
import { verifyPayment } from '@/lib/payment-api'

type State = 'loading' | 'success' | 'pending' | 'failed' | 'error'

export function PaymentReturnPage() {
  const [params] = useSearchParams()
  const [state, setState] = useState<State>('loading')
  const [amount, setAmount] = useState<number | null>(null)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const ref = params.get('ref') || params.get('refference_id') || params.get('reference_id')
    if (!ref) { setState('error'); setErrMsg('Référence de paiement introuvable.'); return }

    let tries = 0
    const maxTries = 6

    async function poll() {
      try {
        const result = await verifyPayment(ref!)
        if (result.verified) {
          if (result.amount) setAmount(result.amount)
          setState('success')
        } else if (result.failed) {
          setState('failed')
        } else if (tries < maxTries) {
          // Transaction still pending — retry in 3s
          tries++
          setTimeout(poll, 3000)
        } else {
          setState('pending')
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setErrMsg(msg)
        setState('error')
      }
    }

    poll()
  }, [params])

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-gray-100 shadow-sm p-8 text-center">

        {state === 'loading' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-5">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h1 className="text-lg font-bold mb-2">Vérification en cours…</h1>
            <p className="text-sm text-muted-foreground">Nous confirmons votre paiement auprès de la plateforme.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-5">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-lg font-bold mb-2">Paiement confirmé !</h1>
            {amount && (
              <p className="text-3xl font-black text-emerald-600 mb-1">
                +{amount.toLocaleString('fr-HT')} HTG
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-6">Votre portefeuille a été crédité avec succès.</p>
            <Link
              to="/wallet"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <Wallet className="h-4 w-4" />
              Voir mon portefeuille
            </Link>
          </>
        )}

        {state === 'pending' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 mx-auto mb-5">
              <Loader2 className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-lg font-bold mb-2">Paiement en attente</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Votre paiement est en cours de traitement. Il sera crédité dans quelques minutes. Vérifiez votre portefeuille.
            </p>
            <Link
              to="/wallet"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              <Wallet className="h-4 w-4" />
              Voir mon portefeuille
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-5">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-lg font-bold mb-2">Paiement échoué</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Votre paiement n'a pas pu être traité. Aucun montant n'a été débité.
            </p>
            <Link
              to="/wallet"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              Réessayer
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-5">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-lg font-bold mb-2">Erreur</h1>
            <p className="text-sm text-muted-foreground mb-2">{errMsg}</p>
            <p className="text-xs text-muted-foreground/70 mb-6">
              Si vous avez effectué un paiement, contactez le support avec votre référence.
            </p>
            <Link
              to="/dashboard"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #F05A28, #D44E21)' }}
            >
              Retour à l'accueil
            </Link>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-6 text-center">
        Powered by PLOP PLOP · MonCash & NatCash
      </p>
    </div>
  )
}
