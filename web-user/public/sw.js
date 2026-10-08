self.addEventListener("push", (event) => {
  const text = event.data ? event.data.text() : "";
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  const title = payload.title || "TRACK notification";
  const options = {
    body: payload.message || "You have a new notification.",
    tag: payload.entityId ? `${payload.entityType}-${payload.entityId}` : undefined,
    data: { url: payload.url || "/notifications" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (target.origin !== self.location.origin) return;

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
