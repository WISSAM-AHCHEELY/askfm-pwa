
const CACHE_NAME = "ask-pwa-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

const APP_BASE = new URL("./", self.location.href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // لا نتدخل في طلبات Supabase أو المواقع الخارجية.
  if (url.origin !== self.location.origin) return;

  // لا نخزن طلبات خارج مجلد التطبيق.
  if (!url.pathname.startsWith(APP_BASE.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", copy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");

          return cached || new Response(
            "الموقع غير متاح حالياً. تحقق من اتصال الإنترنت.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});
