const CACHE_NAME = 'konvwa-v2'
const STATIC_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.hostname.includes('supabase') || url.hostname.includes('solutionip')) return

  if (url.origin !== self.location.origin) return

  // Pages: always network so a new deploy is picked up; never serve a stale index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request))
    return
  }

  // Hashed build assets: cache-first, but only keep real JS/CSS/font responses.
  // The SPA rewrite answers missing files with index.html (200); caching that
  // under a script URL leaves the app permanently blank.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          const type = res.headers.get('content-type') || ''
          if (res.ok && !type.includes('text/html')) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Everything else (icons, manifest): network first, cache as offline fallback
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Web Push ───────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'KONVWA', body: event.data.text() }
  }

  const { title = 'KONVWA', body = '', icon = '/icon-192.png', badge = '/badge-mono.png', clickUrl = '/', type = 'info' } = data

  const options = {
    body,
    icon,
    badge,
    vibrate:  [200, 100, 200],
    data:     { clickUrl },
    // One tag per event: a shared tag per type made each notification silently replace the previous one
    tag:      `${title}|${clickUrl}`,
    renotify: true,
    timestamp: Date.now(),
    requireInteraction: false,
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const clickUrl = new URL(event.notification.data?.clickUrl ?? '/', self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is open on the same origin
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin) {
            client.navigate(clickUrl)
            return client.focus()
          }
        } catch { /* ignore */ }
      }
      // Otherwise open a new tab
      return clients.openWindow(clickUrl)
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  // Re-subscribe and notify the app to update the stored subscription
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then((sub) => {
      // Broadcast to all open clients so they can save the new subscription
      clients.matchAll({ type: 'window' }).then((clientList) => {
        clientList.forEach((client) =>
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: sub.toJSON() })
        )
      })
    }).catch(() => { /* re-subscribe failed, push disabled */ })
  )
})
