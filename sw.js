/* Service worker · Sistema Integral SVB
   - La app (index.html) se pide primero a la red y, sin señal, sale de la caché.
   - El SDK de Firebase (versión fija en la URL) se guarda en caché para abrir sin conexión.
   - Las llamadas a Firestore/Auth NO pasan por acá: las maneja el SDK (con su propia caché offline). */
const VERSION = "svb-v2.0.0";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // SDK de Firebase: caché primero (las URLs llevan la versión)
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.open(VERSION).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Navegación y archivos propios: red primero, caché como respaldo
  e.respondWith(
    fetch(req).then((r) => { if (r.ok && (req.mode === "navigate" || SHELL.some((s) => url.pathname.endsWith(s.replace("./", "/"))))) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, cp)); } return r; })
      .catch(async () => (await caches.match(req)) || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
  );
});
