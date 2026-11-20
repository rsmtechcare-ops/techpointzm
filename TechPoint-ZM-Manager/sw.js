// TechPoint ZM service worker v0.6 — fast on slow networks, still updates immediately when online.
const CACHE = 'techpoint-shell-v11';
const SHELL = ['/', '/index.html', '/styles.css', '/v05.css', '/config.js', '/app.js', '/manifest.webmanifest',
  '/assets/app-icon-192.png', '/assets/app-icon-512.png', '/assets/techpoint-mark-white.png', '/assets/techpoint-mark-black.png', '/assets/brand-marble.jpg', '/assets/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm', 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js', 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'];
self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(u, u.startsWith('http') ? { mode:'cors' } : undefined).then(r => r.ok ? c.put(u, r) : null).catch(() => null)))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('slow')), ms))]);
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Library from CDN: cache-first (never changes) so launches are instant.
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase API/storage: always live
  // App files: try the network for up to 2.5s (so updates arrive), otherwise use the saved copy (so it never hangs).
  e.respondWith(withTimeout(fetch(req), 2500).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })
    .catch(() => caches.match(req).then(hit => hit || caches.match('/index.html'))));
});
