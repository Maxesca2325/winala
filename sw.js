/* Winala service worker — small on purpose.
 * - Static build assets: cache-first (they are content-hashed).
 * - Pages: network-first with a short timeout, then the last cached copy,
 *   then /offline. Lets a user on a dropping 3G link reopen what they saw.
 * - Never touches POST (server actions, payments) or Next's RSC fetches,
 *   which Next.js retries itself (experimental.useOffline).
 */
const VERSION = "winala-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
// Works at the domain root and under a sub-path (GitHub Pages test build).
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const OFFLINE = new URL(self.location.href).searchParams.get("offline") || `${BASE}/offline`;
const PRECACHE = [OFFLINE, `${BASE}/icon-192.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (url.pathname.includes("/_next/static/") || /\.(png|svg|ico|woff2)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      Promise.race([fetch(req), timeout(6000)])
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE))),
    );
  }
});
