import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Rate limit per user (see check_rate_limit in the database)
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', { p_key: `payment-verify:${user.id}`, p_max: 60, p_window_seconds: 600 })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Trop de requêtes, réessayez dans quelques minutes.' }), { status: 429, headers: { ...CORS, 'Retry-After': '600' } })
    }

    const { reference_id } = await req.json()
    if (!reference_id) return new Response(JSON.stringify({ error: 'reference_id manquant' }), { status: 400, headers: CORS })

    // Read settings
    const { data: settings } = await supabaseAdmin.from('app_settings').select('key, value').in('key', ['payment_client_id', 'payment_base_url'])
    const cfg = Object.fromEntries((settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))

    if (!cfg.payment_client_id) return new Response(JSON.stringify({ error: 'API non configurée' }), { status: 503, headers: CORS })

    // Verify with PLOP PLOP
    const baseUrl = cfg.payment_base_url || 'https://plopplop.solutionip.app'
    const plopRes = await fetch(`${baseUrl}/api/paiement-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cfg.payment_client_id, refference_id: reference_id }),
    })

    const plopData = await plopRes.json()

    // Find the pending transaction
    const { data: tx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, wallet_id, amount, status, wallets!inner(user_id)')
      .eq('reference', reference_id)
      .maybeSingle()

    if (!tx) return new Response(JSON.stringify({ error: 'Transaction introuvable' }), { status: 404, headers: CORS })

    // Only the owner of the deposit (or an admin) may trigger its verification
    const owner = (tx as unknown as { wallets: { user_id: string } }).wallets?.user_id
    if (owner !== user.id) {
      const { data: me } = await supabaseAdmin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
      if (!me || !['admin', 'manager'].includes(me.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
      }
    }

    // Already processed — idempotent
    if (tx.status === 'completed') {
      return new Response(JSON.stringify({ verified: true, already_processed: true, amount: tx.amount }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (plopData.trans_status === 'ok') {
      // Claim the transaction atomically: of two concurrent verifications only one gets the row,
      // so the wallet can never be credited twice for the same payment.
      const { data: claimed } = await supabaseAdmin
        .from('wallet_transactions')
        .update({ status: 'completed' })
        .eq('id', tx.id)
        .in('status', ['pending', 'failed'])
        .select('id')
      if (!claimed?.length) {
        return new Response(JSON.stringify({ verified: true, already_processed: true, amount: tx.amount }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const { error: creditError } = await supabaseAdmin.rpc('increment_wallet_balance', { p_wallet_id: tx.wallet_id, p_amount: tx.amount })
      if (creditError) {
        await supabaseAdmin.from('wallet_transactions').update({ status: 'pending' }).eq('id', tx.id)
        return new Response(JSON.stringify({ error: 'Crédit impossible, réessayez' }), { status: 500, headers: CORS })
      }

      return new Response(
        JSON.stringify({ verified: true, amount: tx.amount, method: plopData.method }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    } else {
      // Still pending or failed
      const failed = !plopData.status
      if (failed) {
        await supabaseAdmin.from('wallet_transactions').update({ status: 'failed' }).eq('id', tx.id)
      }
      return new Response(
        JSON.stringify({ verified: false, status: plopData.trans_status ?? 'no', failed }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erreur interne', detail: String(err) }), { status: 500, headers: CORS })
  }
})
