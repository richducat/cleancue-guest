const CACHE = "cleancue-pilot-v6";
const SHELL = ["./", "./manifest.webmanifest", "./icon.svg", "./privacy.html", "./support.html", "./terms.html"];

async function precacheApp() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const indexURL = new URL("./", self.registration.scope);
  const response = await fetch(indexURL, { cache: "reload" });
  if (!response.ok) throw new Error("App shell unavailable");
  const html = await response.clone().text();
  await cache.put(indexURL, response);
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], indexURL))
    .filter((url) => url.origin === self.location.origin && /\/assets\/.*\.(?:js|css)$/.test(url.pathname));
  await cache.addAll([...new Set(assets.map((url) => url.href))]);
}

self.addEventListener("install", (event) => event.waitUntil(precacheApp().then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has("code") || url.searchParams.has("token_hash") || url.pathname.includes("/auth/")) return;
  if (/\/assets\/.*\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./") : undefined))));
});
