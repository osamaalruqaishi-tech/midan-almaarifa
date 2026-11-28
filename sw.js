/* ميدان المعرفة — Service Worker
   - الصفحة: من الشبكة أولاً (لتصل التحديثات فوراً) ومن الذاكرة عند انقطاع الإنترنت.
   - المكتبات والخطوط والأيقونات: من الذاكرة مع تحديثها في الخلفية.
   - الاتصال باللعبة الجماعية (WebSocket) لا يمر من هنا. */
const VERSION = 'v4';
const CACHE = 'midan-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './tahaddi/', './tahaddi/index.html'];
const CDN = ['https://cdnjs.cloudflare.com/', 'https://unpkg.com/', 'https://cdn.jsdelivr.net/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('midan-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  const sameOrigin = url.startsWith(self.location.origin);

  // صفحة اللعبة: الشبكة أولاً، ثم النسخة المحفوظة
  if (req.mode === 'navigate') {
    const isTah = new URL(url).pathname.includes('/tahaddi/');
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), timeout(6000)]);
        if (res && res.ok) cache.put(isTah ? './tahaddi/index.html' : './index.html', res.clone());
        return res;
      } catch (err) {
        if (isTah) return (await cache.match('./tahaddi/index.html')) || (await cache.match('./tahaddi/')) || Response.error();
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // الملفات الثابتة والمكتبات: من الذاكرة مع تحديث في الخلفية
  if (sameOrigin || CDN.some(p => url.startsWith(p))) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
