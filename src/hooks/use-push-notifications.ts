import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export type NotificationTypes = {
  orders:   boolean
  payments: boolean
  quotes:   boolean
  alerts:   boolean
}

const DEFAULT_TYPES: NotificationTypes = { orders: true, payments: true, quotes: true, alerts: true }

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return new Uint8Array(Array.from(raw, (c) => c.charCodeAt(0)))
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

async function saveSubscription(
  userId: string,
  subscription: PushSubscription,
  types: NotificationTypes
) {
  const activeTypes = Object.entries(types)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const endpoint = subscription.endpoint

  // PostgREST can't target a functional unique index via onConflict,
  // so we delete the existing row for this endpoint then insert fresh.
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('subscription->>endpoint', endpoint)

  await supabase.from('push_subscriptions').insert({
    user_id:            userId,
    subscription:       subscription.toJSON(),
    user_agent:         navigator.userAgent,
    notification_types: activeTypes,
    updated_at:         new Date().toISOString(),
  })
}

function sameKey(sub: PushSubscription, wanted: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey
  if (!current) return false
  const a = new Uint8Array(current)
  return a.length === wanted.length && a.every((b, i) => b === wanted[i])
}

// Returns a subscription made with the current VAPID key, replacing any stale one
// (a subscription created with another key is rejected by the push service with 403 forever).
async function ensureSubscription(
  userId: string,
  vapidKey: string,
  types: NotificationTypes,
): Promise<PushSubscription | null> {
  const reg = await getRegistration()
  if (!reg) return null

  const wanted = urlBase64ToUint8Array(vapidKey)
  let sub = await reg.pushManager.getSubscription()

  if (sub && !sameKey(sub, wanted)) {
    await removeSubscription(userId, sub.endpoint)
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted })
  }

  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('subscription->>endpoint', sub.endpoint)
    .limit(1)
  if (!data?.length) await saveSubscription(userId, sub, types)

  return sub
}

async function removeSubscription(userId: string, endpoint: string) {
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('subscription->>endpoint', endpoint)
}

export function usePushNotifications(userId?: string) {
  const [permission, setPermission]   = useState<PushPermission>('default')
  const [subscribed, setSubscribed]   = useState(false)
  const [loading, setLoading]         = useState(false)
  const [types, setTypes]             = useState<NotificationTypes>(DEFAULT_TYPES)

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator

  // Sync current permission and subscription state on mount
  useEffect(() => {
    if (!isSupported || !userId) return

    setPermission(Notification.permission as PushPermission)

    getRegistration().then(async (reg) => {
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    })

    // Permission already granted: silently repair a missing / outdated subscription
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (Notification.permission === 'granted' && vapidKey) {
      ensureSubscription(userId, vapidKey, DEFAULT_TYPES)
        .then((sub) => setSubscribed(!!sub))
        .catch((e) => console.error('[push] repair error:', e))
    }
  }, [isSupported, userId])

  // Listen for SW-broadcasted subscription changes
  useEffect(() => {
    if (!isSupported || !userId) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
        const sub = event.data.subscription as PushSubscriptionJSON
        if (!sub.endpoint) return
        supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('subscription->>endpoint', sub.endpoint)
          .then(() =>
            supabase.from('push_subscriptions').insert({
              user_id:      userId,
              subscription: sub,
              updated_at:   new Date().toISOString(),
            })
          )
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [isSupported, userId])

  const subscribe = useCallback(async (preferredTypes = types): Promise<boolean> => {
    if (!isSupported || !userId) return false

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('[push] VITE_VAPID_PUBLIC_KEY not set')
      return false
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm as PushPermission)
      if (perm !== 'granted') return false

      const sub = await ensureSubscription(userId, vapidKey, preferredTypes)
      if (!sub) return false

      await saveSubscription(userId, sub, preferredTypes)
      setSubscribed(true)
      setTypes(preferredTypes)
      return true
    } catch (e) {
      console.error('[push] subscribe error:', e)
      return false
    } finally {
      setLoading(false)
    }
  }, [isSupported, userId, types])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !userId) return
    setLoading(true)
    try {
      const reg = await getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removeSubscription(userId, sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [isSupported, userId])

  const updateTypes = useCallback(async (next: NotificationTypes): Promise<void> => {
    setTypes(next)
    if (!subscribed || !userId) return
    const reg = await getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await saveSubscription(userId, sub, next)
  }, [subscribed, userId])

  return {
    isSupported,
    permission,
    subscribed,
    loading,
    types,
    subscribe,
    unsubscribe,
    updateTypes,
  }
}
