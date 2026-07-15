# FASE G — Service Worker + PWA Offline Garantizado

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: MEDIA (~25-30 mensajes · cómodo en ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/verify` `/run`  
**Prerequisito:** Fase E completada (el cifrado debe estar activo antes de garantizar offline)

---

## Objetivo
Implementar Service Worker con Cache-First y actualizar el manifest.json para garantizar funcionamiento 100% offline en operativos sin señal (Fix C2). La app debe instalarse como PWA en el teléfono del funcionario.

---

## Instrucciones de ejecución

### Paso 1 — Service Worker (sw.js)
Crear `sw.js` en la raíz de Crear App:

```js
const CACHE_NAME = 'lexcapture-v8-cache-v1'
const ASSETS = [
  '/LexCapture_v8.html',
  // docx.js y otras dependencias están embebidas en el HTML → no listar
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

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})
```

**Nota importante:** Como la app es un archivo HTML autónomo sin servidor de producción definido, el SW debe cachearse respecto a la ubicación real del archivo. Agregar en el HTML comentario de instrucción para el usuario sobre cómo hacer deploy (GitHub Pages, etc.).

### Paso 2 — Registro del Service Worker en LexCapture_v8.html
Agregar al final del `<body>`:
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.warn('SW no disponible (solo funciona en HTTPS o localhost):', err))
  })
}
```

### Paso 3 — manifest.json
Crear `manifest.json`:
```json
{
  "name": "LexCapture — Gestión de Capturas",
  "short_name": "LexCapture",
  "description": "App de gestión de capturas para la Policía Nacional de Colombia",
  "start_url": "./LexCapture_v8.html",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#d97706",
  "orientation": "portrait",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "categories": ["utilities", "productivity"],
  "lang": "es"
}
```

**Nota sobre íconos:** Si no hay íconos PNG disponibles en el proyecto, generar íconos SVG en línea dentro del manifest o usar íconos base64 simples. El escudo de policía de `/components/assets/escudo-policia.png` puede usarse si está disponible en la ruta.

### Paso 4 — Link al manifest en el HTML
En el `<head>` de LexCapture_v8.html:
```html
<link rel="manifest" href="./manifest.json">
<meta name="apple-mobile-web-app-title" content="LexCapture">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

### Paso 5 — Prompt de instalación PWA
Capturar el evento `beforeinstallprompt` y mostrar un banner de instalación:
```js
let installPrompt = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  installPrompt = e
  document.getElementById('install-banner').style.display = 'flex'
})
```

Banner en el HTML (inicialmente oculto):
- "📲 Instalar LexCapture como app" + botón "Instalar" + botón "×" para cerrar
- Al instalar: `installPrompt.prompt()` → ocultar banner
- Guardar `lc_pwa_dismissed = true` si el usuario cierra el banner para no mostrarlo de nuevo

### Paso 6 — Indicador de estado offline
En el header de la app, mostrar indicador de conectividad:
- 🟢 En línea / 🔴 Sin señal
- Escuchar `window.addEventListener('online'/'offline', ...)`
- Toast al cambiar: "📡 Sin señal — trabajando en modo offline" / "📡 Conexión restaurada"

### Paso 7 — Verificar golden path offline
Ejecuta `/verify` con esta secuencia:
1. Abrir la app y cargar completamente
2. En DevTools → Network → poner en modo "Offline"
3. Recargar la app → debe cargar desde caché sin errores
4. Crear una captura completa (wizard 7 pasos) → guardar
5. Generar dossier WA → copiar texto
6. Generar y descargar FPJ-5 .docx → debe funcionar (docx.js está embebido)
7. Volver a modo "Online" → toast de conexión restaurada

---

## Criterios de éxito
- [ ] La app carga completamente en modo offline (DevTools → Network: Offline)
- [ ] Service Worker registrado correctamente (visible en DevTools → Application → Service Workers)
- [ ] manifest.json válido (visible en DevTools → Application → Manifest)
- [ ] Banner de instalación PWA aparece en navegadores compatibles
- [ ] Indicador de estado offline visible en el header
- [ ] Wizard completo funciona offline (crear captura, guardar)
- [ ] Generación de .docx funciona offline

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
