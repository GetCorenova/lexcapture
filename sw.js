// La versión web de Flagrante se retiró (2026-10-30): solo queda la app de Android.
// Este Service Worker existe para que los navegadores que alguna vez instalaron la
// web dejen de servirla desde su caché: al instalarse borra TODAS las cachés de
// este origen y se desregistra. No intercepta ninguna petición.
// ⚠️ No navega las pestañas abiertas: la app ya no registra un Service Worker, y
// recargarlas desde aquí no aportaría nada.
// Versión: lexcapture-v8-cache-v179 (la lee `npm run build:web`).

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
  )
})
