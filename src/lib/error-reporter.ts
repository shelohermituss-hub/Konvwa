import { supabase } from '@/lib/supabase'

const MAX_PER_SESSION = 5
const IGNORED = [/ResizeObserver loop/i, /Non-Error promise rejection/i, /^Script error\.?$/i, /Failed to fetch dynamically imported module/i, /Load failed/i, /NetworkError/i]
let sent = 0

/** Sends an error to the database (grouped per day). Best effort: reporting must never break the app. */
export function reportError(error: unknown, extra?: string): void {
  if (sent >= MAX_PER_SESSION || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  if (!message || IGNORED.some((re) => re.test(message))) return
  sent++
  const stack = error instanceof Error ? error.stack ?? '' : ''
  void Promise.resolve(
    supabase.rpc('log_client_error', {
      p_message: extra ? `${extra}: ${message}` : message,
      p_stack: stack,
      p_url: window.location.pathname,
      p_user_agent: navigator.userAgent,
    }),
  ).catch(() => {})
}

export function installErrorReporting(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'unhandledrejection'))
}
