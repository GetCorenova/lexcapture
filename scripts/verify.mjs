#!/usr/bin/env node
/**
 * verify — corre las suites de regresión (Playwright sobre la app real).
 *
 * Hay ~38 suites y en conjunto tardan mucho, así que por defecto NO se corren
 * todas: se listan y se elige. Correrlas todas a ciegas antes de cada cambio
 * es la forma más rápida de dejar de correrlas.
 *
 *   npm run verify                 → lista las suites
 *   npm run verify -- compartir    → corre las que casen con «compartir»
 *   npm run verify -- --todas      → corre todas, en serie
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const suites = readdirSync(RAIZ).filter(f => /^verify_.*\.mjs$/.test(f)).sort();
const arg = process.argv.slice(2);
const todas = arg.includes('--todas');
const filtro = arg.filter(a => !a.startsWith('--'));

let elegidas = todas ? suites
  : filtro.length ? suites.filter(s => filtro.some(f => s.includes(f)))
  : [];

if (!elegidas.length) {
  console.log(`\n  ${suites.length} suites disponibles:\n`);
  suites.forEach(s => console.log('    ' + s.replace(/^verify_|\.mjs$/g, '')));
  console.log('\n  npm run verify -- <nombre>     ·     npm run verify -- --todas\n');
  if (filtro.length) { console.error(`  Nada casó con «${filtro.join(' ')}».\n`); process.exit(1); }
  process.exit(0);
}

const fallidas = [];
for (const s of elegidas) {
  console.log(`\n${'═'.repeat(60)}\n  ${s}\n${'═'.repeat(60)}`);
  if (spawnSync(process.execPath, [join(RAIZ, s)], { cwd: RAIZ, stdio: 'inherit' }).status !== 0) fallidas.push(s);
}
console.log(`\n${'─'.repeat(60)}`);
console.log(`  ${elegidas.length - fallidas.length}/${elegidas.length} suites en verde`);
if (fallidas.length) { console.log('  En rojo: ' + fallidas.join(', ')); process.exit(1); }
console.log('');
