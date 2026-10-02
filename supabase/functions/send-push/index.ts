import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Subscriptions the push service will never accept again (deleted, expired, or created with a different VAPID key)
const DEAD_STATUSES = [401, 403, 404, 410]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? ''
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@konvwa.com'
    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')      ?? ''
    const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // The public key is not secret; its prefix lets us check it matches the one the app uses
    console.log(`[send-push] vapid_public_prefix=${VAPID_PUBLIC_KEY.slice(0, 12)} private_set=${!!VAPID_PRIVATE_KEY} service_role_set=${!!SERVICE_ROLE_KEY}`)

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: 'VAPID keys not configured' }, 500)
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const body: {
      user_id: string
      title: string
      body: string
      icon?: string
      click_url?: string
      type?: string
    } = await req.json()

    if (!body.user_id || !body.title) {
      return json({ error: 'user_id and title required' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Only push what was really written to the notifications table (the endpoint is public)
    const { data: real } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', body.user_id)
      .eq('title', body.title)
      .gt('created_at', new Date(Date.now() - 5 * 60_000).toISOString())
      .limit(1)
    if (!real?.length) {
      console.warn(`[send-push] rejected: no recent notification for user=${body.user_id}`)
      return json({ error: 'No matching notification' }, 403)
    }

    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('subscription, notification_types')
      .eq('user_id', body.user_id)

    if (subErr || !subs?.length) {
      console.log(`[send-push] no subscriptions for user=${body.user_id} err=${subErr?.message}`)
      return json({ sent: 0, reason: 'no subscriptions' })
    }

    console.log(`[send-push] found ${subs.length} subscriptions for user=${body.user_id}`)

    const payload = JSON.stringify({
      title:    body.title,
      body:     body.body,
      icon:     body.icon     ?? '/icon-192.png',
      badge:    '/badge-mono.png',
      clickUrl: body.click_url ?? '/',
      type:     body.type     ?? 'info',
    })

    const typeMap: Record<string, string> = {
      order: 'orders', payment: 'payments', quote: 'quotes',
      success: 'payments', warning: 'alerts', error: 'alerts', info: 'alerts',
    }
    const category = typeMap[body.type ?? 'info'] ?? 'alerts'

    const eligible = subs.filter((s) => {
      const types = s.notification_types as string[] | null
      return !types || types.includes(category)
    })

    const deadEndpoints: string[] = []

    const results = await Promise.all(
      eligible.map(async (s) => {
        const sub = s.subscription as PushSub
        try {
          const res = await webpush.sendNotification(sub, payload)
          return { ok: true, status: res.statusCode, endpoint: sub.endpoint }
        } catch (e: unknown) {
          const err = e as { statusCode?: number; body?: string }
          const status = err?.statusCode ?? 0
          console.error(`[send-push] status=${status} err=${String(err?.body ?? e).slice(0, 150)} endpoint=...${sub.endpoint.slice(-20)}`)
          if (DEAD_STATUSES.includes(status)) deadEndpoints.push(sub.endpoint)
          return { ok: false, status, endpoint: sub.endpoint }
        }
      })
    )

    if (deadEndpoints.length > 0) {
      await Promise.all(
        deadEndpoints.map((ep) =>
          admin.from('push_subscriptions')
            .delete()
            .eq('user_id', body.user_id)
            .filter('subscription->>endpoint', 'eq', ep)
        )
      )
      console.log(`[send-push] removed ${deadEndpoints.length} dead subscription(s)`)
    }

    const sent   = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok).length

    console.log(`[send-push] user=${body.user_id} sent=${sent} failed=${failed}`)

    return json({ sent, failed, removed: deadEndpoints.length, total: results.length })
  } catch (e) {
    console.error('[send-push] error:', e)
    return json({ error: String(e) }, 500)
  }
})
