# LexCapture — Web (deploy PWA)

Paquete estático de la PWA **LexCapture**, listo para hostear en HTTPS (GitHub Pages / Netlify / Cloudflare Pages).
Este repositorio contiene **solo** los archivos públicos necesarios para servir la app. El código fuente de
desarrollo (plantillas .docx, documentos internos, fases) se mantiene aparte y **no** se publica aquí.

## Contenido
- `index.html` — la aplicación (single-file PWA). Es una copia de `LexCapture_v8.html` renombrada.
- `manifest.json` — manifiesto PWA (`start_url` y `scope` en la raíz).
- `sw.js` — service worker (offline, cache-first).
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon.svg` — íconos.
- `privacy.html` — política de privacidad (requerida por Google Play).
- `.nojekyll` — desactiva el procesado Jekyll en GitHub Pages.

## Cómo actualizar la app
Cuando cambie la app en el repo de desarrollo, copiar el HTML nuevo sobre `index.html`:

```bash
cp "../Crear App/LexCapture_v8.html" index.html
git add index.html && git commit -m "update app" && git push
```

## URLs una vez publicado (GitHub Pages)
- App:      `https://<usuario>.github.io/<repo>/`
- Privacidad: `https://<usuario>.github.io/<repo>/privacy.html`
