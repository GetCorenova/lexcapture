#!/usr/bin/env node
/**
 * build:firebase — empaqueta el SDK de Firebase en vendor/firebase.js.
 *
 * La app no carga nada de un CDN (se usa sin cobertura, y la CSP no lo deja):
 * el SDK modular se empaqueta aquí con esbuild en un solo archivo que expone
 * `window.FB`. La versión es la EXACTA de package.json, y queda escrita en la
 * cabecera del archivo para que `--check` sepa si el paquete está al día.
 *
 * Uso:
 *   node scripts/build-firebase.mjs           genera vendor/firebase.js
 *   node scripts/build-firebase.mjs --check   comprueba que existe y está al día
 *
 * Lo llama `npm run build:web` (y su --check), así que no hace falta ejecutarlo
 * a mano salvo al cambiar la versión de Firebase.
 */
import { existsSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'vendor', 'firebase.js');
const ENTRADA = join(RAIZ, 'scripts', 'firebase-entry.mjs');

const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const pedida = (pkg.devDependencies || {}).firebase || (pkg.dependencies || {}).firebase || '';
/* ⚠️ La cabecera lleva también la huella de firebase-entry.mjs: con solo la
   versión, añadir una exportación (p. ej. las funciones del servidor) dejaba el
   paquete viejo dando por bueno el --check, y la app fallaba al llamarla. */
/* Sin los CR: git entrega el archivo con CRLF en Windows y con LF fuera, y la
   huella tiene que ser la misma en los dos. */
const huellaEntrada = () => createHash('sha256').update(readFileSync(ENTRADA, 'utf8').replace(/\r/g, '')).digest('hex').slice(0, 12);
const MARCA = v => `/* Flagrante · paquete local de Firebase JS SDK ${v} — entrada ${huellaEntrada()} — generado por scripts/build-firebase.mjs. No editar a mano. */`;

export function versionEmpaquetada() {
  if (!existsSync(SALIDA)) return null;
  const cab = readFileSync(SALIDA, 'utf8').slice(0, 300);
  const m = cab.match(/Firebase JS SDK (\S+) —/);
  return m ? m[1] : null;
}

export function comprobar() {
  const fallos = [];
  const v = versionEmpaquetada();
  if (!pedida) fallos.push('package.json no fija la versión de firebase');
  else if (!v) fallos.push('falta vendor/firebase.js — ejecuta: npm run build:web');
  else if (v !== pedida) fallos.push(`vendor/firebase.js es de la versión ${v} y package.json pide ${pedida} — ejecuta: npm run build:web`);
  else if (!readFileSync(SALIDA, 'utf8').slice(0, 300).includes('entrada ' + huellaEntrada())) fallos.push('vendor/firebase.js no corresponde a scripts/firebase-entry.mjs — ejecuta: npm run build:web');
  return { ok: !fallos.length, fallos, version: v, kb: v ? Math.round(statSync(SALIDA).size / 1024) : 0 };
}

export async function empaquetar() {
  const instalada = JSON.parse(readFileSync(join(RAIZ, 'node_modules', 'firebase', 'package.json'), 'utf8')).version;
  if (instalada !== pedida) throw new Error(`firebase instalado ${instalada} ≠ ${pedida} en package.json — ejecuta npm install`);
  const { build } = await import('esbuild');
  mkdirSync(dirname(SALIDA), { recursive: true });
  await build({
    entryPoints: [ENTRADA],
    outfile: SALIDA,
    bundle: true,
    format: 'iife',
    globalName: 'FB',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    /* Firebase es Apache-2.0: sus avisos de licencia se conservan al final. */
    legalComments: 'eof',
    banner: { js: MARCA(instalada) },
    logLevel: 'warning'
  });
  return { version: instalada, kb: Math.round(statSync(SALIDA).size / 1024) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const r = comprobar();
    if (!r.ok) { r.fallos.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
    console.log(`  ✓ vendor/firebase.js al día (Firebase ${r.version}, ${r.kb} KB)`);
  } else {
    const r = await empaquetar();
    console.log(`  ✓ vendor/firebase.js generado (Firebase ${r.version}, ${r.kb} KB)`);
  }
}
