/* Paulo App · funciona sem internet */
const V = "pauloapp-v7";
const CORE = ["./", "./index.html"];
const LIBS = ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(CORE).catch(() => {});
    await Promise.all(LIBS.map(u => fetch(u, {mode: "cors"}).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V && k !== "pauloapp-tiles") await caches.delete(k);
    await self.clients.claim();
  })());
});
async function trimTiles(c) { const ks = await c.keys(); if (ks.length > 4000) for (const k of ks.slice(0, ks.length - 4000)) await c.delete(k); }
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // páginas do app: tenta a internet (para pegar atualizações) e cai no cache se estiver offline
  if (req.mode === "navigate" || (url.origin === location.origin && /\.(html)?$/.test(url.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(req, {signal: ctl.signal}); clearTimeout(to);
        if (r.ok) c.put("./index.html", r.clone());
        return r;
      } catch (err) { return (await c.match("./index.html")) || (await c.match("./")) || Response.error(); }
    })());
    return;
  }
  // mapa: guarda os pedaços de mapa que você já viu
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith((async () => {
      const c = await caches.open("pauloapp-tiles"), hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok) { c.put(req, r.clone()); trimTiles(c); } return r; } catch (err) { return new Response("", {status: 504}); }
    })());
    return;
  }
  // fontes e biblioteca do mapa
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "unpkg.com") {
    e.respondWith((async () => {
      const c = await caches.open(V), hit = await c.match(req.url);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req.url, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
