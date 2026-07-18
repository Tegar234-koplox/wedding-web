const CACHE_NAME = "niskala-offline-v2";
const OFFLINE_ASSETS = [
  "/offline-id.html",
  "/offline-en.html",
  "/preloader/no-connection.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("niskala-offline-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/preloader/no-connection.png") {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request)),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    const offlinePage =
      url.pathname === "/en" || url.pathname.startsWith("/en/")
        ? "/offline-en.html"
        : "/offline-id.html";
    event.respondWith(
      fetch(event.request).catch(() => caches.match(offlinePage)),
    );
  }
});
