const CACHE_NAME = 'lexcapture-v8-cache-v25'
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon.svg',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// El HTML (navegación e index.html) va SIEMPRE a red primero: con cache-first
// el SW servía el index viejo indefinidamente y el celular seguía abriendo una
// build anterior aunque el servidor ya tuviera la nueva. La caché queda como
// respaldo offline. El resto de assets (iconos, manifest) sigue cache-first.
const isHTML = req =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html')

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return

  if (isHTML(req)) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    )
    return
  }

  e.respondWith(caches.match(req).then(cached => cached || fetch(req)))
})
