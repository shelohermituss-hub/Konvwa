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

    console.log(`[send-push] VAPID_PUBLIC_KEY set=${!!VAPID_PUBLIC_KEY} VAPID_PRIVATE_KEY set=${!!VAPID_PRIVATE_KEY} SERVICE_ROLE_KEY set=${!!SERVICE_ROLE_KEY}`)

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
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
      return new Response(JSON.stringify({ error: 'user_id and title required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('subscription, notification_types')
      .eq('user_id', body.user_id)

    if (subErr || !subs?.length) {
      console.log(`[send-push] no subscriptions for user=${body.user_id} err=${subErr?.message}`)
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
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

    const staleEndpoints: string[] = []

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
          if (status === 410 || status === 404) staleEndpoints.push(sub.endpoint)
          return { ok: false, status, endpoint: sub.endpoint }
        }
      })
    )

    if (staleEndpoints.length > 0) {
      await Promise.all(
        staleEndpoints.map((ep) =>
          admin.from('push_subscriptions')
            .delete()
            .eq('user_id', body.user_id)
            .filter('subscription->>endpoint', 'eq', ep)
        )
      )
      console.log(`[send-push] removed ${staleEndpoints.length} stale subscription(s)`)
    }

    const sent   = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok).length

    console.log(`[send-push] user=${body.user_id} sent=${sent} failed=${failed}`)

    return new Response(JSON.stringify({ sent, failed, total: results.length }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[send-push] error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
