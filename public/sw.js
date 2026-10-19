// Minimal service worker: makes the app installable. Nothing is cached so
// authenticated data is never served stale or to the wrong user.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
