import { useEffect } from 'react'
import { toast } from 'sonner'

import { tr } from '@/lib/i18n'
const MESSAGES: Record<string, string> = {
  bad_oauth_state: tr('La demande de connexion a expiré. Cliquez à nouveau sur « Continuer avec Google » ou « Facebook » depuis la page de connexion.'),
  bad_oauth_callback: tr('La demande de connexion a expiré. Relancez la connexion depuis la page de connexion.'),
  otp_expired: tr('Ce lien a expiré. Demandez un nouveau lien ou connectez-vous avec votre mot de passe.'),
  access_denied: tr('Connexion annulée.'),
}

// Supabase returns OAuth/e-mail-link failures as ?error=... or #error=... on the redirect URL
export function AuthErrorToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const get = (k: string) => params.get(k) ?? hash.get(k)

    const error = get('error')
    if (!error) return

    const code = get('error_code') ?? error
    const description = get('error_description')?.replace(/\+/g, ' ')

    toast.error(tr('Connexion impossible'), {
      description: MESSAGES[code] ?? description ?? tr('Une erreur est survenue. Réessayez.'),
      duration: 10000,
    })

    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  return null
}
