/*
 * Aalim service worker.
 *
 * PRIVACY RULE: no authenticated response is ever written to a cache.
 * Chat history, conversations, and auth state live on the API, which runs
 * on a different origin, so the cross-origin bypass below already
 * excludes them. The explicit path denylist is a second layer, so that
 * proxying the API under this origin later cannot silently start caching
 * private data.
 */

const VERSION = "aalim-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
// A static file, not a Next route: the fallback must render without any
// JS chunk, since the chunks for a never-visited route are never cached.
const OFFLINE_URL = "/offline.html";

// Public, user-independent routes only. /chat is deliberately absent: it
// is reached through the network so a signed-out or offline visitor gets
// the offline page rather than an empty chat frame.
const SHELL_ROUTES = ["/", "/login", "/signup"];

const PRECACHE = [
  ...SHELL_ROUTES,
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/AALIM.png",
];

// Never cache anything under these paths, whatever their origin.
const PRIVATE_PATHS = ["/auth", "/ask", "/conversations", "/api"];

function isPrivatePath(pathname) {
  return PRIVATE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll is atomic: one 404 would discard the whole precache, so
      // each entry is added independently and failures are tolerated.
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is ever cacheable.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (the API included) goes straight to the network and is
  // never stored.
  if (url.origin !== self.location.origin) return;

  if (isPrivatePath(url.pathname)) return;

  // Privacy rests on two checks, both above: the cross-origin bypass
  // (the API is a separate origin) and the private-path denylist. The
  // request's `credentials` flag is deliberately NOT used as a signal —
  // browsers set credentials:"include" on navigations and on <img>
  // requests alike, so treating it as "private" skips ordinary public
  // assets and the app shell while protecting nothing extra.
  //
  // Navigations: network first, so content is always fresh, with the
  // cached shell and finally the offline page as fallbacks. Only
  // SHELL_ROUTES are ever stored, and those are public, statically
  // prerendered pages; /chat is not among them.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(SHELL_CACHE)
            .then((cache) => {
              if (SHELL_ROUTES.includes(url.pathname)) cache.put(request, copy);
            })
            .catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreVary: true });
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL, { ignoreVary: true });
          return (
            offline ??
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        })
    );
    return;
  }

  // Build output is content-hashed and immutable, so cache-first is safe
  // and keeps repeat launches fast on a slow phone connection.
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|webp|avif|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      // ignoreVary: the precache fetch and the document's own request send
      // different Accept headers, so a Vary-respecting match misses and the
      // asset falls through to the network — which is exactly what is not
      // available when the cache matters.
      caches.match(request, { ignoreVary: true }).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(ASSET_CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return response;
          })
      )
    );
  }
});
