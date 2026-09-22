#!/usr/bin/env node
/**
 * build:web — prepara el despliegue web de Flagrante.
 *
 * Esta aplicación no tiene bundler ni framework: es UN HTML autónomo que se
 * sirve tal cual. Así que "compilar para web" aquí son dos cosas concretas, y
 * las dos han roto la app antes:
 *
 *  1. SUBIR LOS TRES TOKENS ANTI-CACHÉ A LA VEZ. El número de build vive en
 *     TRES archivos (index.html ?v=N, sw.js cache-vN, y _BUILD dentro del
 *     HTML) y hasta ahora se subía a mano. Si uno se queda atrás, el usuario
 *     abre una build vieja sin que nada falle a la vista — el defecto que
 *     CLAUDE.md registra como «el usuario veía builds viejos».
 *
 *  2. VALIDAR QUE EL SCRIPT SIGUE SIENDO CÓDIGO VÁLIDO. El HTML lleva 21 000
 *     líneas de JavaScript en un solo bloque: un `*` seguido de `/` dentro de
 *     un comentario cierra el comentario y rompe el <script> ENTERO, y la
 *     página queda en blanco. Pasa `node --check` sobre el script extraído,
 *     que es la comprobación que CLAUDE.md manda hacer siempre.
 *
 * Uso:
 *   node scripts/build-web.mjs            sube el build en 1 y valida
 *   node scripts/build-web.mjs --check    solo valida, no toca nada
 *   node scripts/build-web.mjs --set 120  fija un número concreto
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(RAIZ, 'LexCapture_v8.html');
const INDEX = join(RAIZ, 'index.html');
const SW = join(RAIZ, 'sw.js');

// Los tres sitios donde vive el número de build. Cada uno con el patrón que lo
// localiza; el grupo 1 es el número. Añadir un cuarto sitio es añadir una fila.
const TOKENS = [
  { nom: 'index.html → ?v=',    ruta: INDEX, re: /(LexCapture_v8\.html\?v=)(\d+)/,        g: 2 },
  { nom: 'sw.js → cache-v',     ruta: SW,    re: /(lexcapture-v8-cache-v)(\d+)/,          g: 2 },
  { nom: 'Flagrante → _BUILD' , ruta: APP,   re: /(var\s+_BUILD\s*=\s*)(\d+)/,            g: 2 },
];

const arg = process.argv.slice(2);
const soloCheck = arg.includes('--check');
const iSet = arg.indexOf('--set');
const fijado = iSet >= 0 ? parseInt(arg[iSet + 1], 10) : null;

let fallos = 0;
const err = m => { console.error('  ✗ ' + m); fallos++; };
const ok  = m => console.log('  ✓ ' + m);

// ── 1. Leer los tres tokens ────────────────────────────────────────────────
console.log('\nTokens anti-caché');
const leidos = TOKENS.map(t => {
  const txt = readFileSync(t.ruta, 'utf8');
  const m = txt.match(t.re);
  if (!m) { err(`${t.nom}: no se encontró el token — ¿cambió el formato?`); return null; }
  return { ...t, txt, valor: parseInt(m[t.g], 10) };
});
if (leidos.some(x => !x)) { console.error('\nBUILD FALLIDO\n'); process.exit(1); }

const valores = leidos.map(x => x.valor);
const enSync = valores.every(v => v === valores[0]);
if (enSync) ok(`los tres en ${valores[0]}`);
else err(`DESINCRONIZADOS: ${leidos.map(x => `${x.nom}${x.valor}`).join(' · ')}`);

// ── 2. Validar el JavaScript del HTML ──────────────────────────────────────
// Se extraen TODOS los bloques <script> sin src y se pasan por node --check.
// Un `<script>` roto deja la página en blanco sin dar ningún error visible.
console.log('\nJavaScript');
const html = readFileSync(APP, 'utf8');
const bloques = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (!bloques.length) err('no se encontró ningún bloque <script> en el HTML');
bloques.forEach((src, i) => {
  const tmp = join(tmpdir(), `lexcapture-check-${process.pid}-${i}.js`);
  try {
    writeFileSync(tmp, src);
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    ok(`bloque ${i + 1}/${bloques.length}: sintaxis válida (${src.split('\n').length} líneas)`);
  } catch (e) {
    const detalle = (e.stderr || e.stdout || '').toString().split('\n').slice(0, 4).join('\n    ');
    err(`bloque ${i + 1}/${bloques.length}: SINTAXIS ROTA\n    ${detalle}`);
  }
});

// ── 3. La app tiene que seguir siendo autónoma ─────────────────────────────
// Se usa en campo sin cobertura: un <script src> o una hoja de estilos de un
// CDN en el HTML la dejaría sin arrancar offline. Lo que se carga en caliente
// (el script de Google para sincronizar con Drive) es otra cosa y sí vale:
// solo se pide al entrar a esa pantalla y el resto de la app funciona sin él.
console.log('\nAutonomía offline');
const externos = [
  ...html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)/gi),
  ...html.matchAll(/<link[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)/gi),
].map(m => m[1]).filter(u => /^(https?:)?\/\//.test(u));
if (externos.length) externos.forEach(u => err(`recurso externo en el HTML: ${u}`));
else ok('cero recursos externos — arranca sin red');

// ── 4. Peso ────────────────────────────────────────────────────────────────
const mb = Buffer.byteLength(html) / 1048576;
console.log('\nPeso');
console.log(`  · LexCapture_v8.html: ${mb.toFixed(2)} MB`);
if (mb > 12) err(`el HTML pasa de 12 MB — arranca lento en un teléfono en campo`);
else ok('dentro de lo razonable para cargar en campo');

if (fallos) { console.error(`\nBUILD FALLIDO — ${fallos} problema(s)\n`); process.exit(1); }

// ── 5. Subir el build ──────────────────────────────────────────────────────
if (soloCheck) {
  console.log(`\n✓ Validación OK (build ${valores[0]}). No se tocó ningún archivo.\n`);
  process.exit(0);
}
const nuevo = fijado != null && !Number.isNaN(fijado) ? fijado : Math.max(...valores) + 1;
if (nuevo <= Math.max(...valores) && fijado == null) { err('no se pudo calcular el build nuevo'); process.exit(1); }

console.log(`\nSubiendo build → ${nuevo}`);
for (const t of leidos) {
  // Se reemplaza SOLO el número, conservando el prefijo capturado: así el
  // patrón no puede comerse texto de alrededor.
  const out = t.txt.replace(t.re, (_, pre) => pre + nuevo);
  writeFileSync(t.ruta, out);
  ok(`${t.nom}${nuevo}`);
}
console.log(`\n✓ Build ${nuevo} listo para desplegar.  Siguiente: npm run deploy:web\n`);
