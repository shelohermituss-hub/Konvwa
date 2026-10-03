import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LANG, tr } from '@/lib/i18n'

/** hCaptcha site key: public by design (the secret lives in the Supabase Auth settings). */
const SITE_KEY: string = import.meta.env.VITE_CAPTCHA_SITE_KEY || '6cfedae6-3aaa-47d2-82da-c07860bcb926'
const SCRIPT = 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off'

interface HCaptchaApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window { hcaptcha?: HCaptchaApi }
}

let loading: Promise<HCaptchaApi> | null = null
function loadHcaptcha(): Promise<HCaptchaApi> {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha)
  loading ??= new Promise<HCaptchaApi>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => (window.hcaptcha ? resolve(window.hcaptcha) : reject(new Error('hcaptcha missing')))
    s.onerror = () => { loading = null; reject(new Error('hcaptcha failed to load')) }
    document.head.appendChild(s)
  })
  return loading
}

function CaptchaWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let id: string | null = null
    let cancelled = false
    loadHcaptcha()
      .then((api) => {
        if (cancelled || !box.current) return
        id = api.render(box.current, {
          sitekey: SITE_KEY,
          hl: LANG,
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => setFailed(true))
    return () => { cancelled = true; if (id && window.hcaptcha) window.hcaptcha.remove(id) }
  }, [onToken])

  if (failed) return <p className="text-xs text-destructive" role="alert">{tr('Captcha indisponible. Vérifiez votre connexion puis rechargez la page.')}</p>
  return <div ref={box} className="flex min-h-[78px] justify-center" />
}

/**
 * Captcha for an auth form: render `widget`, send `token` as `captchaToken`, call `reset()` after every attempt
 * (a token works once). `ready` is false until the user has solved it.
 */
export function useCaptcha(): { token: string | undefined; ready: boolean; reset: () => void; widget: ReactNode } {
  const [token, setToken] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const reset = useCallback(() => { setToken(null); setNonce((n) => n + 1) }, [])
  const onToken = useCallback((t: string | null) => setToken(t), [])
  return {
    token: token ?? undefined,
    ready: !!token,
    reset,
    widget: <CaptchaWidget key={nonce} onToken={onToken} />,
  }
}
