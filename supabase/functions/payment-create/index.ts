import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Auth: verify user JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const { amount, method, wallet_id } = await req.json()

    // Validate input
    if (!amount || amount < 20) return new Response(JSON.stringify({ error: 'Montant minimum 20 HTG' }), { status: 400, headers: CORS })
    if (!method || !['moncash', 'natcash'].includes(method)) return new Response(JSON.stringify({ error: 'Méthode invalide' }), { status: 400, headers: CORS })

    // Read payment settings (service role bypasses RLS)
    const { data: settings } = await supabaseAdmin.from('app_settings').select('key, value').in('key', ['payment_client_id', 'payment_base_url'])
    const cfg = Object.fromEntries((settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))

    if (!cfg.payment_client_id) return new Response(JSON.stringify({ error: 'API paiement non configurée' }), { status: 503, headers: CORS })

    // Generate unique reference
    const timestamp = Date.now()
    const reference_id = `KW-${user.id.slice(0, 8)}-${timestamp}`

    // Call PLOP PLOP API
    const baseUrl = cfg.payment_base_url || 'https://plopplop.solutionip.app'
    const plopRes = await fetch(`${baseUrl}/api/paiement-marchand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.payment_client_id,
        refference_id: reference_id,
        montant: amount,
        payment_method: method,
      }),
    })

    const plopData = await plopRes.json()

    if (!plopData.status || !plopData.url) {
      return new Response(JSON.stringify({ error: plopData.message || 'Erreur PLOP PLOP' }), { status: 502, headers: CORS })
    }

    // Store pending transaction
    await supabaseAdmin.from('wallet_transactions').insert({
      wallet_id,
      type: 'deposit',
      amount,
      status: 'pending',
      payment_method: method,
      reference: reference_id,
      plop_transaction_id: plopData.transaction_id,
      description: `Recharge ${method === 'moncash' ? 'MonCash' : 'NatCash'} - ${amount.toLocaleString('fr-HT')} HTG`,
    })

    return new Response(
      JSON.stringify({ url: plopData.url, reference_id, transaction_id: plopData.transaction_id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erreur interne', detail: String(err) }), { status: 500, headers: CORS })
  }
})
