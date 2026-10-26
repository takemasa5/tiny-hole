/* global __PRECACHE__, __BUILD_ID__ */
const ASSETS = __PRECACHE__.map(
  (path) => new URL(path, self.registration.scope).href,
);
const PREFIX = "tiny-hole:" + new URL(self.registration.scope).pathname + ":";
const CACHE = PREFIX + __BUILD_ID__;
const SHELL = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll(
          ASSETS.map((url) => new Request(url, { cache: "reload" })),
        );
      } catch (error) {
        // A partial download must never replace a working offline version.
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== CACHE)
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.href.startsWith(self.registration.scope))
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(
        request.mode === "navigate" ? SHELL : request,
      );
      return cached || fetch(request);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "CHECK_OFFLINE_READY") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const saved = await Promise.all(ASSETS.map((url) => cache.match(url)));
        event.ports[0]?.postMessage({ ready: saved.every(Boolean) });
      })(),
    );
  }
});
