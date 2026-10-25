self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'FitLab';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || 'Il tuo promemoria FitLab è pronto.',
    icon: '/apple-touch-icon.png?v=3',
    badge: '/apple-touch-icon.png?v=3',
    data: { url: payload.url || '/' },
    tag: payload.tag || 'fitlab-reminder',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) return existing.navigate(url).then(() => existing.focus());
    return self.clients.openWindow(url);
  }));
});
