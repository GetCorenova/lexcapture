#!/usr/bin/env node
/**
 * serve:web — sirve la app en este computador, sin dependencias.
 *
 * Existe porque la app es una PWA y una PWA necesita origen http(s): abierta
 * con doble clic (file://) no registra el Service Worker, no guarda en
 * localStorage con el mismo origen y no se instala. Con esto se prueba en
 * cualquier computador tal como se verá en producción.
 *
 *   npm run serve:web            → http://localhost:8080
 *   npm run serve:web -- 3000    → otro puerto
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = parseInt(process.argv[2], 10) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json', '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  // normalize + comprobación de prefijo: sin esto, un `..` en la URL serviría
  // cualquier archivo del disco. Es un servidor de desarrollo, pero igual.
  const abs = normalize(join(RAIZ, ruta));
  if (!abs.startsWith(RAIZ) || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 — ' + ruta);
  }
  res.writeHead(200, {
    'Content-Type': TIPOS[extname(abs).toLowerCase()] || 'application/octet-stream',
    // Sin caché: el objetivo de este servidor es ver el cambio que acabas de
    // hacer, no reproducir el comportamiento del CDN.
    'Cache-Control': 'no-store',
    'Service-Worker-Allowed': '/',
  });
  createReadStream(abs).pipe(res);
}).listen(PUERTO, () => {
  console.log(`\n  Flagrante sirviéndose desde ${RAIZ}`);
  console.log(`\n  →  http://localhost:${PUERTO}\n`);
  console.log('  Ctrl+C para parar.\n');
});
