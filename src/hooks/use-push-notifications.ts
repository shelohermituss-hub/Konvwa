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
  subscription: PushSubscription,
  types: NotificationTypes
) {
  const activeTypes = Object.entries(types)
    .filter(([, v]) => v)
    .map(([k]) => k)

  // One browser = one account: the database hands this endpoint to the signed-in user
  // and takes it away from any other account that used the same device before.
  await supabase.rpc('register_push_subscription', {
    p_subscription: subscription.toJSON(),
    p_types:        activeTypes,
    p_user_agent:   navigator.userAgent,
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

  // Idempotent: also re-binds the device to the current account after someone else signed in here
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, notification_types')
    .eq('user_id', userId)
    .eq('subscription->>endpoint', sub.endpoint)
    .limit(1)
  if (!data?.length) {
    await saveSubscription(sub, types)
  } else {
    // keep the user's saved preferences, only claim the endpoint
    const saved = (data[0].notification_types as string[] | null) ?? []
    await saveSubscription(sub, Object.fromEntries(saved.map((t) => [t, true])) as NotificationTypes)
  }

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
        supabase.rpc('register_push_subscription', {
          p_subscription: sub,
          p_types:        Object.keys(DEFAULT_TYPES),
          p_user_agent:   navigator.userAgent,
        })
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

      await saveSubscription(sub, preferredTypes)
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
    if (sub) await saveSubscription(sub, next)
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

/** Called on sign-out: this browser must stop receiving the signed-out account's notifications. */
export async function detachPushFromThisDevice(userId: string) {
  try {
    const reg = await getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await removeSubscription(userId, sub.endpoint)
    await sub.unsubscribe()
  } catch {
    /* sign-out must never fail because of push */
  }
}
