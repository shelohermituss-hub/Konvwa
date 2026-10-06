// Administrator-only: permanently deletes a client account and its data (profile, wallet and history, orders, requests, addresses, files…).
// Safety: only an admin (with the MFA rule of staff accounts) can call it; never on oneself or on a staff account; a wallet that still
// holds money needs an explicit confirmation; the deletion is recorded in the audit log.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKETS = ['avatars', 'kyc-documents', 'payment-proofs', 'package-photos']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    // administrators only, evaluated with the caller's own token (it also enforces the MFA rule)
    const asUser = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: isSuper } = await asUser.rpc('is_super_admin')
    if (isSuper !== true) return json({ error: 'Réservé aux administrateurs.' }, 403)

    const { data: allowed } = await admin.rpc('check_rate_limit', { p_key: `admin-delete-user:${user.id}`, p_max: 20, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Trop de suppressions, réessayez plus tard.' }, 429)

    const body = await req.json().catch(() => ({})) as { user_id?: unknown; confirm_email?: unknown; accept_balance_loss?: unknown }
    const uid = typeof body.user_id === 'string' ? body.user_id : ''
    if (!UUID.test(uid)) return json({ error: 'Utilisateur invalide.' }, 400)
    if (uid === user.id) return json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400)

    const { data: profile } = await admin.from('profiles').select('role, full_name').eq('user_id', uid).maybeSingle()
    const { data: target } = await admin.auth.admin.getUserById(uid)
    if (!profile || !target?.user) return json({ error: 'Utilisateur introuvable.' }, 404)
    if (profile.role !== 'client') return json({ error: 'Seuls les comptes clients peuvent être supprimés : retirez d\'abord le rôle de l\'équipe.' }, 400)

    const email = (target.user.email ?? '').toLowerCase()
    if (typeof body.confirm_email !== 'string' || body.confirm_email.trim().toLowerCase() !== email) {
      return json({ error: 'Saisissez l\'e-mail du compte pour confirmer.' }, 400)
    }

    const { data: wallet } = await admin.from('wallets').select('available_balance, blocked_balance').eq('user_id', uid).maybeSingle()
    const money = Number(wallet?.available_balance ?? 0) + Number(wallet?.blocked_balance ?? 0)
    if (money > 0 && body.accept_balance_loss !== true) {
      return json({ error: `Ce portefeuille contient ${money} HTG : confirmez que ce solde sera perdu, ou remboursez-le d'abord.`, code: 'balance_not_empty', balance: money }, 409)
    }

    // files of the user (identity documents, payment proofs, photos, avatar) live under a folder named after the user id
    for (const bucket of BUCKETS) {
      const { data: files } = await admin.storage.from(bucket).list(uid, { limit: 1000 })
      const paths = (files ?? []).filter((f: { id: string | null }) => f.id).map((f: { name: string }) => `${uid}/${f.name}`)
      if (paths.length > 0) await admin.storage.from(bucket).remove(paths)
    }

    const counts = {
      orders: (await admin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count ?? 0,
      catalog_orders: (await admin.from('product_orders').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count ?? 0,
      requests: (await admin.from('product_requests').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count ?? 0,
    }

    // everything else follows by cascade from the auth account
    const { error: delError } = await admin.auth.admin.deleteUser(uid)
    if (delError) {
      console.error('[admin-delete-user]', delError.message)
      return json({ error: 'Suppression impossible : des données liées à ce compte la bloquent.' }, 500)
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id, actor_role: 'admin', action: 'user_deleted', resource_type: 'user', resource_id: uid,
      details: { email, name: profile.full_name, lost_balance_htg: money, ...counts },
    })
    return json({ success: true })
  } catch (e) {
    console.error('[admin-delete-user]', e)
    return json({ error: 'Erreur interne' }, 500)
  }
})
