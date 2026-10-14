self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Despedida de Caro";
  const body = data.body || "Hay algo nuevo.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { hash: data.hash || "tarde" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hash = event.notification.data?.hash || "tarde";
  const url = new URL(self.registration.scope);
  url.hash = hash;
  event.waitUntil(self.clients.openWindow(url.href));
});
