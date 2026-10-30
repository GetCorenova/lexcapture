#!/usr/bin/env node
/**
 * build:pdfjs — copia el lector de PDF (pdf.js) a vendor/pdfjs/.
 *
 * El visor del módulo Formatos usa pdf.js, que la app NO pide a un CDN (se usa
 * sin cobertura y la CSP no lo deja): viaja junto a la app (GitHub Pages, la
 * caché del Service Worker y el paquete de Android) y se carga SOLO al abrir el
 * visor. Se usa la compilación «legacy», que también corre en los WebView
 * viejos de los teléfonos con Android 7-9.
 *
 * La versión es la EXACTA de package.json y queda escrita en la primera línea de
 * cada archivo, para que `--check` sepa si el paquete está al día.
 *
 * Uso:
 *   node scripts/build-pdfjs.mjs           copia los archivos
 *   node scripts/build-pdfjs.mjs --check   comprueba que existen y están al día
 *
 * Lo llama `npm run build:web` (y su --check).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(RAIZ, 'vendor', 'pdfjs');
const ORIGEN = join(RAIZ, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
export const ARCHIVOS = ['pdf.min.mjs', 'pdf.worker.min.mjs'];

const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const pedida = (pkg.devDependencies || {})['pdfjs-dist'] || '';
const MARCA = v => `/* Flagrante · pdf.js ${v} (pdfjs-dist, legacy) — copiado por scripts/build-pdfjs.mjs. No editar a mano. Licencia Apache-2.0: vendor/pdfjs/LICENSE. */\n`;

function version(f) {
  const p = join(DEST, f);
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').slice(0, 200).match(/pdf\.js (\S+) \(/);
  return m ? m[1] : null;
}

export function comprobar() {
  const fallos = [];
  if (!pedida) fallos.push('package.json no fija la versión de pdfjs-dist');
  for (const f of ARCHIVOS) {
    const v = version(f);
    if (!v) fallos.push(`falta vendor/pdfjs/${f} — ejecuta: npm run build:web`);
    else if (v !== pedida) fallos.push(`vendor/pdfjs/${f} es de la versión ${v} y package.json pide ${pedida} — ejecuta: npm run build:web`);
  }
  const kb = fallos.length ? 0 : Math.round(ARCHIVOS.reduce((s, f) => s + statSync(join(DEST, f)).size, 0) / 1024);
  return { ok: !fallos.length, fallos, version: pedida, kb };
}

export function copiar() {
  const instalada = JSON.parse(readFileSync(join(RAIZ, 'node_modules', 'pdfjs-dist', 'package.json'), 'utf8')).version;
  if (instalada !== pedida) throw new Error(`pdfjs-dist instalado ${instalada} ≠ ${pedida} en package.json — ejecuta npm install`);
  mkdirSync(DEST, { recursive: true });
  for (const f of ARCHIVOS) writeFileSync(join(DEST, f), MARCA(instalada) + readFileSync(join(ORIGEN, f), 'utf8'));
  writeFileSync(join(DEST, 'LICENSE'), readFileSync(join(RAIZ, 'node_modules', 'pdfjs-dist', 'LICENSE')));
  return comprobar();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const r = comprobar();
    if (!r.ok) { r.fallos.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
    console.log(`  ✓ vendor/pdfjs al día (pdf.js ${r.version}, ${r.kb} KB)`);
  } else {
    const r = copiar();
    console.log(`  ✓ vendor/pdfjs copiado (pdf.js ${r.version}, ${r.kb} KB)`);
  }
}
