# Flagrante

Aplicación para el registro de capturas y la generación de los documentos legales que
las acompañan, para uso en campo. **PWA de un solo archivo**, sin servidor y sin
dependencias externas: funciona sin conexión, que es como se usa.

**En vivo:** https://getcorenova.github.io/lexcapture/

> Este repositorio **es** el que sirve GitHub Pages: un `git push` publica.

## Qué se sirve

| Archivo | Para qué |
|---|---|
| `LexCapture_v8.html` | La aplicación entera: interfaz, lógica y las plantillas de los seis documentos oficiales embebidas en base64 |
| `index.html` | Redirige a la app con el token `?v=N` que fuerza al navegador a descargar la versión nueva |
| `sw.js` | Service Worker: caché offline. El HTML va siempre a red primero |
| `manifest.json` | Manifiesto PWA |
| `icon-*.png`, `icon.svg` | Íconos. Los genera `npm run gen:icons` desde `icon.svg` |
| `privacy.html` | Política de privacidad (la exige Google Play) |
| `.nojekyll` | Desactiva el procesado Jekyll de GitHub Pages |

## Comandos

```bash
npm run build:web          # valida: sintaxis de los <script>, cero recursos externos, peso
npm run serve:web          # sirve en local (hace falta http:// para que el SW se registre)
npm run deploy:web         # valida, commitea y publica
npm run verify             # lista las suites de regresión
npm run verify -- <nombre> # corre las que casen con ese nombre
npm run gen:icons          # regenera los íconos desde icon.svg
```

## Verificación

44 suites de Playwright sobre la aplicación real (`verify_*.mjs`). No son pruebas
unitarias: abren la app, diligencian formularios, generan los `.docx` y `.pdf` y los
miden. Se corren por nombre; `--todas` las ejecuta en serie y tarda.

Las capturas y los documentos que producen **no se versionan** (`.gitignore`): se
regeneran corriendo la suite.

## Android

El envoltorio vive fuera de este repositorio, en `../lexcapture-android` (Capacitor).
Usa **carga remota**: el `.aab` no lleva el código web dentro, así que un cambio en la
app se publica con `deploy:web` y llega a los teléfonos ya instalados **sin recompilar
ni pasar por Play Console**. Solo hay que recompilar si cambia el envoltorio.

## Documentación

- `CLAUDE.md` — la historia del producto y el porqué de cada decisión. Es la memoria del
  proyecto: conviene leerlo antes de tocar nada.
- `PUBLICAR.md` — la guía de publicación en Play Store, con sus decisiones irreversibles.
- `store-listing.md` — los textos de la ficha de la tienda.
