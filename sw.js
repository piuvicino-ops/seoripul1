self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: '서울서리풀1 씹어먹기',
      body: event.data?.text?.() || ''
    };
  }

  const title = data.title || '서울서리풀1 씹어먹기';
  const options = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-192.png',
    data: { url: data.url || './' },
    tag: data.tag || 'seoripul1-push',
    renotify: Boolean(data.renotify)
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(
    event.notification?.data?.url || './',
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windows) {
      if ('focus' in client) {
        try {
          await client.navigate(target);
        } catch {}
        return client.focus();
      }
    }

    return clients.openWindow(target);
  })());
});
