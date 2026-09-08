import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hmacSha256(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    // Admin-only
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Réservé aux administrateurs' }), { status: 403, headers: CORS })
    }

    const { amount, method, recipient, reference } = await req.json()
    if (!amount || !method || !recipient || !reference) {
      return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: CORS })
    }

    // Read ALL settings including secret (service role bypasses RLS)
    const { data: settings } = await supabaseAdmin.from('app_settings').select('key, value').in('key', ['payment_client_id', 'payment_client_secret', 'payment_base_url'])
    const cfg = Object.fromEntries((settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))

    if (!cfg.payment_client_id || !cfg.payment_client_secret) {
      return new Response(JSON.stringify({ error: 'Identifiants PLOP PLOP non configurés' }), { status: 503, headers: CORS })
    }

    const baseUrl = cfg.payment_base_url || 'https://plopplop.solutionip.app'

    // ── Étape 1: Authentification ──────────────────────────────────────
    const authRes = await fetch(`${baseUrl}/api/auth/marchand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cfg.payment_client_id, client_secret: cfg.payment_client_secret }),
    })
    const authData = await authRes.json()
    if (!authData.success || !authData.token) {
      return new Response(JSON.stringify({ error: `Auth PLOP PLOP échouée: ${authData.message}` }), { status: 502, headers: CORS })
    }
    const marchand_token = authData.token

    // ── Étape 2: Générer le jeton de retrait ──────────────────────────
    const timestamp = Math.floor(Date.now() / 1000)
    const payload = [amount, method, recipient, reference, timestamp].join('|')
    const withdrawal_signature = await hmacSha256(payload, cfg.payment_client_secret)

    const tokenRes = await fetch(`${baseUrl}/api/auth/marchand/withdrawal-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${marchand_token}` },
      body: JSON.stringify({ amount, method, recipient, reference, timestamp, withdrawal_signature }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.success || !tokenData.withdrawal_token) {
      return new Response(JSON.stringify({ error: `Token retrait échoué: ${tokenData.message}`, code: tokenData.error_code }), { status: 502, headers: CORS })
    }
    const withdrawal_token = tokenData.withdrawal_token

    // ── Étape 3: Exécuter le retrait ─────────────────────────────────
    const withdrawRes = await fetch(`${baseUrl}/api/withdraw/marchand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${withdrawal_token}` },
      body: JSON.stringify({ amount, method, recipient, reference }),
    })
    const withdrawData = await withdrawRes.json()

    return new Response(
      JSON.stringify(withdrawData),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erreur interne', detail: String(err) }), { status: 500, headers: CORS })
  }
})
