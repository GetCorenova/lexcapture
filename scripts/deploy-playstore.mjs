#!/usr/bin/env node
/**
 * deploy:playstore — un comando: compila, firma y sube a Play Console.
 *
 * Es un envoltorio de Fastlane, que vive en el proyecto Android (carpeta
 * hermana). Aquí se hacen las comprobaciones que Fastlane no puede hacer
 * porque fallan ANTES de arrancar: que Ruby y Fastlane existan, y que la
 * clave de la cuenta de servicio esté donde toca. Sin esto el usuario recibe
 * un «command not found» sin decirle qué instalar.
 *
 *   npm run deploy:playstore              → borrador en la pista interna
 *   npm run deploy:playstore -- --publicar → lo publica a los testers ya
 *   npm run deploy:playstore -- --check    → solo comprueba, no compila
 */
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(resolve(process.env.LEXCAPTURE_ANDROID || join(RAIZ, '..', 'lexcapture-android')), 'android');
const arg = process.argv.slice(2);
const soloCheck = arg.includes('--check');

/* El argumento va DENTRO de la cadena y no en el arreglo: con shell:true Node
   los concatena sin escapar y avisa de obsolescencia en cada ejecución. */
const hay = c => spawnSync(c + ' -v', [], { shell: true, stdio: 'pipe' }).status === 0;

/* ⚠️ Ruby recién instalado NO está en el PATH de una terminal que ya estuviera
   abierta: Windows solo se lo entrega a los procesos nuevos. Es exactamente la
   situación de quien acaba de seguir la instrucción de instalarlo, y sin esto
   el script le diría «Ruby no está instalado» justo después de instalarlo.
   Se busca en los sitios donde RubyInstaller deja sus versiones y, si aparece,
   se antepone su carpeta al PATH que heredan los procesos hijos. */
function rubyEnPath() {
  if (hay('ruby')) return true;
  if (process.platform !== 'win32') return false;
  const bases = ['C:/', 'C:/tools/', join(process.env.LOCALAPPDATA || '', 'Programs') + '/'];
  const dirs = [];
  for (const b of bases) {
    try { readdirSync(b).forEach(d => { if (/^Ruby\d/i.test(d)) dirs.push(join(b, d, 'bin')); }); }
    catch (e) { /* esa base no existe en este equipo */ }
  }
  // La más nueva primero: el nombre lleva la versión (Ruby33-x64 > Ruby31-x64).
  dirs.sort().reverse();
  for (const d of dirs) {
    if (!existsSync(join(d, 'ruby.exe'))) continue;
    process.env.PATH = d + ';' + process.env.PATH;
    if (hay('ruby')) { console.log('  · Ruby encontrado en ' + d + ' (no estaba en el PATH de esta terminal)'); return true; }
  }
  return false;
}

let fallos = 0;
const err = (m, ayuda) => { console.error('  ✗ ' + m); if (ayuda) console.error(ayuda); fallos++; };
const ok = m => console.log('  ✓ ' + m);

console.log('\nRequisitos para publicar en Play Console');

if (!existsSync(ANDROID)) {
  err(`no se encontró el proyecto Android en ${ANDROID}`,
      '    Si está en otro sitio: LEXCAPTURE_ANDROID="C:/ruta/lexcapture-android"\n');
  process.exit(1);
}
ok(`proyecto Android: ${ANDROID}`);

// ── Ruby ───────────────────────────────────────────────────────────────────
// Fastlane es una gema de Ruby. Windows no lo trae.
const RUBY = rubyEnPath();
if (!RUBY) {
  err('Ruby no está instalado (Fastlane es una gema de Ruby)',
`
    Windows:  winget install RubyInstallerTeam.RubyWithDevKit.3.3
              (cerrar y reabrir la terminal después)
    macOS:    brew install ruby
    Linux:    sudo apt install ruby-full build-essential
`);
} else {
  /* ⚠️ El programa va ENTRECOMILLADO dentro de la cadena: con shell:true y los
     argumentos en el arreglo, Node los concatena sin escapar y a ruby le llega
     «-e print RUBY_VERSION» en tres trozos — evalúa «print» y busca un archivo
     llamado RUBY_VERSION, así que la versión salía en blanco. */
  const v = spawnSync('ruby -e "print RUBY_VERSION"', [], { shell: true, encoding: 'utf8' }).stdout;
  ok('Ruby ' + (v || '').trim());
}

// ── Fastlane ───────────────────────────────────────────────────────────────
const conBundler = existsSync(join(ANDROID, '..', 'Gemfile')) || existsSync(join(ANDROID, 'Gemfile'));
if (RUBY && !hay('fastlane') && !hay('bundle')) {
  err('Fastlane no está instalado',
`
    Desde ${ANDROID}:
      gem install bundler
      bundle install        (usa el Gemfile, fija la versión)
`);
} else if (RUBY) ok('Fastlane disponible' + (conBundler ? ' (por Bundler, versión fijada)' : ''));

// ── La clave de la cuenta de servicio ──────────────────────────────────────
const clave = process.env.GOOGLE_PLAY_KEY
  ? resolve(process.env.GOOGLE_PLAY_KEY)
  : join(ANDROID, 'google-play-key.json');
if (!existsSync(clave)) {
  err(`falta la clave de la cuenta de servicio (${clave})`,
`
    1. Google Cloud Console → proyecto → IAM → Cuentas de servicio
       → Crear cuenta → Claves → Agregar clave → JSON.
    2. Play Console → Configuración → Acceso a la API: vincular ese proyecto.
    3. Play Console → Usuarios y permisos → Invitar a esa cuenta de servicio
       con permiso de «Publicar en pruebas internas» sobre la app.
    4. Guardar el JSON como google-play-key.json en ${ANDROID}
       (ya está en .gitignore) o exportar GOOGLE_PLAY_KEY con su ruta.

    ⚠️ Esto necesita la cuenta de Play Console VERIFICADA. Si Google sigue
       revisando el documento de identidad, el acceso a la API no aparece.
`);
} else ok('clave de cuenta de servicio presente');

// ── La firma ───────────────────────────────────────────────────────────────
if (!existsSync(join(ANDROID, 'keystore.properties'))) {
  err('falta android/keystore.properties — el .aab saldría sin firmar');
} else ok('firma configurada');

if (fallos) {
  console.error(`\nNo se puede publicar todavía — ${fallos} requisito(s) sin cumplir.`);
  console.error('Los demás pasos siguen disponibles: npm run build:android\n');
  process.exit(1);
}

console.log('\n  ⚠️ La PRIMERA versión de una ficha no se puede subir por API:');
console.log('     Google exige subir ese primer .aab a mano por la consola web.');
console.log('     A partir de la segunda, este comando ya funciona.\n');

if (soloCheck) { console.log('✓ Requisitos OK. No se compiló ni subió nada (--check).\n'); process.exit(0); }

// ── Lanzar Fastlane ────────────────────────────────────────────────────────
const lane = ['deploy_internal'];
if (arg.includes('--publicar')) lane.push('publicar:true');
const cmd = hay('bundle') && conBundler ? ['bundle', 'exec', 'fastlane', ...lane] : ['fastlane', ...lane];

console.log(`Ejecutando: ${cmd.join(' ')}\n`);
const r = spawnSync(cmd[0], cmd.slice(1), {
  cwd: ANDROID, stdio: 'inherit', shell: true,
  env: { ...process.env, GOOGLE_PLAY_KEY: clave },
});
process.exit(r.status || 0);
