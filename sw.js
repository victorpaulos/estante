// Estante da Banda — funciona sem internet.
// O app fica guardado em SHELL; as músicas baixadas ficam em AUDIO (gravadas pela própria página).
const SHELL = "estante-shell-v1";
const AUDIO = "estante-audio-v1";
const SHELL_FILES = ["./", "index.html", "brasao.png", "icone.png", "https://cdn.jsdelivr.net/npm/soundtouchjs@0.3.0/dist/soundtouch.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("estante-shell-") && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req, opts) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(opts && opts.key || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(opts && opts.key || req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Músicas: se já estão no celular, tocam dali.
  if (url.pathname.includes("/musicas/arquivos/")) {
    e.respondWith(caches.open(AUDIO).then(c => c.match(req.url, { ignoreSearch: true })).then(hit => hit || fetch(req)));
    return;
  }
  // Lista de músicas e páginas: tenta a internet (para pegar novidades); sem internet, usa a cópia.
  if (url.origin === location.origin && (url.pathname.endsWith("/biblioteca.json"))) {
    e.respondWith(networkFirst(req, { key: new URL("biblioteca.json", self.registration.scope).href }));
    return;
  }
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    if (url.pathname.endsWith("/admin.html")) return; // o painel sempre precisa de internet
    e.respondWith(networkFirst(req, { key: new URL("index.html", self.registration.scope).href }));
    return;
  }
  // Motor de áudio, fontes e imagens: guardados na primeira vez.
  if (url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" ||
      (url.origin === location.origin && /\.(png|js)$/.test(url.pathname))) {
    e.respondWith(cacheFirst(req));
  }
});
