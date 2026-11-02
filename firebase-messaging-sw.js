importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

const { vapidKey: _vapidKey, ...firebaseAppConfig } = self.FIREBASE_CONFIG;
firebase.initializeApp(firebaseAppConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Master League update", {
    body: data.message || "A new league post is ready.",
    icon: "./assets/master-league-logo.png",
    badge: "./assets/master-league-logo.png",
    tag: data.notificationId || "master-league-update",
    timestamp: Date.parse(data.createdAt) || Date.now(),
    data: { link: data.link || "./index.html#notifications" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedLink = event.notification.data?.link || "./index.html#notifications";
  const requestedTarget = new URL(requestedLink, self.location.origin);
  const target = requestedTarget.origin === self.location.origin
    ? requestedTarget
    : new URL("./index.html#notifications", self.location.origin);

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === target.origin) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
