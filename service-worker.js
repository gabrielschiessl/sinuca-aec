const CACHE_NAME = "aec-sinuca-shell-v25";
const APP_ROOT = new URL("./", self.location).pathname;
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}index.html`,
  `${APP_ROOT}css/variables.css`,
  `${APP_ROOT}css/style.css`,
  `${APP_ROOT}css/layout.css`,
  `${APP_ROOT}css/components.css`,
  `${APP_ROOT}css/home.css`,
  `${APP_ROOT}js/app.js`,
  `${APP_ROOT}manifest.webmanifest`,
  `${APP_ROOT}assets/icons/pwa-192.png`,
  `${APP_ROOT}assets/icons/pwa-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("aec-sinuca-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith(`${APP_ROOT}api/`)
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          return caches.match(`${APP_ROOT}index.html`);
        }

        return Response.error();
      }),
  );
});
