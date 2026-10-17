// ============================================================================
// Service Worker – Push-Benachrichtigungen (auch bei geschlossener Seite)
// und Zahl am App-Icon. Kein Offline-Cache: Seiten kommen immer frisch aus dem Netz.
// ============================================================================
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  // Reste eines früheren Offline-Caches entfernen
  for (const k of await caches.keys()) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  const jobs = [self.registration.showNotification(d.title || "Altima Bowl", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-maskable-192.png",
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "./" },
  })];
  // Zahl am App-Icon (z.B. offene Tipps)
  if (typeof d.badge === "number" && self.navigator && self.navigator.setAppBadge) jobs.push(d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
  event.waitUntil(Promise.all(jobs).catch(() => {}));
});

// Antippen: passende Seite öffnen (vorhandenes Fenster bevorzugt)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { if ("focus" in w) { try { await w.navigate(url); } catch (e) { /* egal */ } return w.focus(); } }
    return self.clients.openWindow(url);
  })());
});
