// Minimal service worker whose only job is to display incoming Web Push
// messages and focus/open the admin tab on click. Registered lazily by
// src/lib/pushNotifications.ts only when the user opts in — not on every
// page load — so it doesn't interfere with normal browsing.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'Notification', body: '', url: '/admin' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/admin' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
