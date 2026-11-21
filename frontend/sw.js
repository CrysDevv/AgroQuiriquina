const VER = 'aq-v3';
const CDN = 'https://cdn.jsdelivr.net';
const SHELL = [
  '/',
  '/manifest.json',
  '/static/css/style.css',
  '/static/icons/icon-192.png',
  '/static/icons/logo.png',
  CDN + '/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const mismo = u.origin === location.origin;

  // API, admin y el propio SW: directo a la red, sin cachear
  if (mismo && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin/') || u.pathname === '/sw.js')) return;

  // Navegación HTML: Network-First con fallback a "/" cacheado
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(res => {
        if (res.ok && mismo && u.pathname === '/') {
          const cp = res.clone();
          caches.open(VER).then(c => c.put('/', cp));
        }
        return res;
      }).catch(() => caches.match('/').then(x => x || Response.error()))
    );
    return;
  }

  // Estáticos (propios, manifest, Bootstrap Icons CSS/fuentes): Stale-While-Revalidate
  if ((mismo && (u.pathname.startsWith('/static/') || u.pathname === '/manifest.json')) || u.origin === CDN) {
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const hit = await c.match(r);
      const net = fetch(r).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    })());
  }
});
