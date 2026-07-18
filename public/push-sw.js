/* Antifofista Squad — Push Service Worker */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'ANTIFOFISTA SQUAD', body: '' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'antifofista',
    renotify: true,
    data: { url: payload.url || '/app/registro' },
  };
  event.waitUntil(self.registration.showNotification(payload.title || 'ANTIFOFISTA SQUAD', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app/registro';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        try {
          if ('focus' in client) {
            await client.focus();
            if ('navigate' in client) await client.navigate(target);
            return;
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
