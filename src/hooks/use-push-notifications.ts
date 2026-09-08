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

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
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

  await supabase.from('push_subscriptions').upsert(
    {
      user_id:            userId,
      subscription:       subscription.toJSON(),
      user_agent:         navigator.userAgent,
      notification_types: activeTypes,
      updated_at:         new Date().toISOString(),
    },
    { onConflict: 'user_id, (subscription->>\'endpoint\')' }
  )
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
  }, [isSupported, userId])

  // Listen for SW-broadcasted subscription changes
  useEffect(() => {
    if (!isSupported || !userId) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
        const sub = event.data.subscription as PushSubscriptionJSON
        supabase.from('push_subscriptions').upsert({
          user_id:      userId,
          subscription: sub,
          updated_at:   new Date().toISOString(),
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

      const reg = await getRegistration()
      if (!reg) return false

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        })
      }

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
