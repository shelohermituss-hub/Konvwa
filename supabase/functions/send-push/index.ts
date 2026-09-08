import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── VAPID signing via Web Crypto (no npm:web-push needed) ──────────────────

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyB64: string
): Promise<string> {
  const header  = { alg: 'ES256', typ: 'JWT' }
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 86400, sub: subject }

  const enc   = new TextEncoder()
  const hEnc  = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)))
  const pEnc  = uint8ArrayToBase64Url(enc.encode(JSON.stringify(payload)))
  const input = `${hEnc}.${pEnc}`

  const keyData = urlBase64ToUint8Array(privateKeyB64)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(input)
  )

  return `${input}.${uint8ArrayToBase64Url(new Uint8Array(sig))}`
}

// ── Encrypt push message (RFC 8291) ───────────────────────────────────────

async function encryptPayload(
  subscription: { keys: { p256dh: string; auth: string } },
  plaintext: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc        = new TextEncoder()
  const salt       = crypto.getRandomValues(new Uint8Array(16))
  const authSecret = urlBase64ToUint8Array(subscription.keys.auth)
  const clientKey  = urlBase64ToUint8Array(subscription.keys.p256dh)

  // Server ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  )

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', clientKey.buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  )

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  )

  // HKDF to derive PRK
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveBits'])

  const prk = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: enc.encode('Content-Encoding: auth\0') },
    hkdfKey, 256
  )

  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits'])

  // Key info
  const keyInfo = concat(enc.encode('Content-Encoding: aesgcm\0\x41'), clientKey, serverPublicKeyRaw)
  const nonceInfo = concat(enc.encode('Content-Encoding: nonce\0\x41'), clientKey, serverPublicKeyRaw)

  const cek = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo }, prkKey, 128
  )
  const nonce = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96
  )

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])

  // Pad plaintext (2-byte padding length prefix + 0 bytes of padding)
  const plaintextBytes = enc.encode(plaintext)
  const padded = new Uint8Array(2 + plaintextBytes.length)
  padded[0] = 0; padded[1] = 0
  padded.set(plaintextBytes, 2)

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  )

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw }
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out   = new Uint8Array(total)
  let offset  = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// ── Send one push notification ─────────────────────────────────────────────

interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

async function sendPush(
  sub: PushSub,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const url      = new URL(sub.endpoint)
    const audience = `${url.protocol}//${url.host}`
    const jwt      = await createVapidJwt(audience, vapidSubject, vapidPrivateKey)

    const { ciphertext, salt, serverPublicKey } = await encryptPayload(sub, payload)

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization':   `vapid t=${jwt},k=${vapidPublicKey}`,
        'Content-Encoding': 'aesgcm',
        'Content-Type':    'application/octet-stream',
        'Encryption':      `salt=${uint8ArrayToBase64Url(salt)}`,
        'Crypto-Key':      `dh=${uint8ArrayToBase64Url(serverPublicKey)}`,
        'TTL':             '86400',
      },
      body: ciphertext,
    })

    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── Edge Function handler ─────────────────────────────────────────────────

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

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

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

    // Fetch all subscriptions for this user
    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('subscription, notification_types')
      .eq('user_id', body.user_id)

    if (subErr || !subs?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({
      title:    body.title,
      body:     body.body,
      icon:     body.icon     ?? '/icon-192.png',
      badge:    '/icon-192.png',
      clickUrl: body.click_url ?? '/',
      type:     body.type     ?? 'info',
    })

    // Map type to notification category
    const typeMap: Record<string, string> = {
      order: 'orders', payment: 'payments', quote: 'quotes',
      success: 'payments', warning: 'alerts', error: 'alerts', info: 'alerts',
    }
    const category = typeMap[body.type ?? 'info'] ?? 'alerts'

    const results = await Promise.all(
      subs
        .filter((s) => {
          const types = s.notification_types as string[] | null
          return !types || types.includes(category)
        })
        .map((s) => sendPush(s.subscription as PushSub, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT))
    )

    // Remove stale subscriptions (410 Gone)
    // (simplified — in production, track endpoint and delete stale ones)

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
