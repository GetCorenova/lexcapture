#!/usr/bin/env node
/**
 * deploy:web — publica la web: sube el build, valida y empuja a GitHub Pages.
 *
 * Este repositorio ES el que se despliega (su origin apunta al repo de la
 * app en vivo), así que `git push` publica. Por eso el build se valida ANTES
 * de commitear: publicar un <script> roto deja la app en blanco en el
 * teléfono de quien la tenga instalada, en campo, sin un error visible.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' }).trim();
const paso = m => console.log('\n── ' + m);

paso('1/4  Validar y subir el build');
if (spawnSync(process.execPath, [join(RAIZ, 'scripts', 'build-web.mjs')], { stdio: 'inherit' }).status !== 0) {
  console.error('\nNo se publica: el build no pasó la validación.\n'); process.exit(1);
}

paso('2/4  Revisar cambios');
const sucio = git('status', '--porcelain');
if (!sucio) { console.log('  Nada que publicar.\n'); process.exit(0); }
console.log(sucio.split('\n').slice(0, 20).map(l => '  ' + l).join('\n'));

paso('3/4  Commit');
const build = git('grep', '-o', '-h', 'cache-v[0-9]*', '--', 'sw.js').replace('cache-v', '');
git('add', '-A');
git('commit', '-m', `chore(deploy): build ${build}`);
console.log('  ' + git('log', '--oneline', '-1'));

paso('4/4  Push');
const r = spawnSync('git', ['push'], { cwd: RAIZ, stdio: 'inherit' });
if (r.status !== 0) { console.error('\nEl commit quedó hecho pero el push falló.\n'); process.exit(r.status || 1); }

const origin = git('remote', 'get-url', 'origin').replace(/\.git$/, '');
console.log(`\n✓ Publicado (build ${build}).`);
console.log(`  Repo:   ${origin}`);
console.log(`  Commit: ${origin}/commit/${git('rev-parse', 'HEAD')}`);
console.log('  En vivo: https://getcorenova.github.io/lexcapture/  (el CDN tarda 1-2 min)\n');
