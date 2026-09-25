#!/usr/bin/env node
/**
 * build:android — genera el App Bundle (.aab) firmado del envoltorio nativo.
 *
 * ⚠️ LO PRIMERO QUE HAY QUE SABER (cambió en la FASE 0, 2026-09-25):
 * EL .aab LLEVA EL CÓDIGO WEB DENTRO. Antes el envoltorio usaba CARGA REMOTA
 * (`server.url` → getcorenova.github.io/lexcapture) y cualquiera con acceso al
 * repositorio de GitHub podía cambiar el código que corre en los teléfonos sin
 * pasar por Play. Ahora este script copia la app a `www/` y el paquete la sirve
 * desde el propio teléfono:
 *
 *   · Un cambio en LexCapture_v8.html llega a la app de Play SOLO con un
 *     paquete nuevo (este script) y la revisión de Play. `deploy:web` ya solo
 *     actualiza la versión web.
 *   · La app arranca sin red desde el primer uso: no descarga nada.
 *
 * ⚠️ `server.hostname` = getcorenova.github.io A PROPÓSITO: el almacenamiento
 * del WebView va por ORIGEN, y ese es el origen de la versión de carga remota.
 * Con el `localhost` por defecto, un teléfono que actualice desde la versión
 * anterior abriría un almacenamiento vacío — perdería sus capturas.
 *
 * El proyecto Android vive FUERA de este repositorio (es una carpeta hermana,
 * sin git propio) para que el keystore y las contraseñas no puedan acabar
 * versionados por descuido. Se puede mover con LEXCAPTURE_ANDROID.
 */
import { existsSync, readFileSync, statSync, copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRAP = resolve(process.env.LEXCAPTURE_ANDROID || join(RAIZ, '..', 'lexcapture-android'));
const ANDROID = join(WRAP, 'android');
const soloCheck = process.argv.includes('--check');
// --debug: APK de depuración para probar en el emulador (no se sube a Play).
const debug = process.argv.includes('--debug');
const TAREA = debug ? 'assembleDebug' : 'bundleRelease';

let fallos = 0;
const err = m => { console.error('  ✗ ' + m); fallos++; };
const ok  = m => console.log('  ✓ ' + m);
const avi = m => console.log('  ! ' + m);

console.log('\nRequisitos del build de Android');

// ── El proyecto ────────────────────────────────────────────────────────────
if (!existsSync(ANDROID)) {
  err(`no se encontró el proyecto Android en ${ANDROID}`);
  console.error('\n    Es una carpeta HERMANA de este repo, a propósito (el keystore no');
  console.error('    puede acabar versionado). Si está en otro sitio:');
  console.error('      LEXCAPTURE_ANDROID="C:/ruta/lexcapture-android" npm run build:android\n');
  process.exit(1);
}
ok(`proyecto Android: ${ANDROID}`);

// ── La firma ───────────────────────────────────────────────────────────────
// Sin esto Gradle produce un .aab SIN FIRMAR, que Play Console rechaza. Y si
// el keystore no es EL MISMO de siempre, Google rechaza la actualización: la
// ficha exige la misma firma en cada versión, para siempre.
const props = join(ANDROID, 'keystore.properties');
if (!existsSync(props)) {
  err('falta android/keystore.properties — el .aab saldría sin firmar');
} else {
  const cfg = Object.fromEntries(readFileSync(props, 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  const faltan = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].filter(k => !cfg[k]);
  if (faltan.length) err(`keystore.properties incompleto: falta ${faltan.join(', ')}`);
  else {
    const jks = resolve(ANDROID, cfg.storeFile);
    if (!existsSync(jks)) err(`el keystore no está en ${jks}`);
    else ok(`keystore presente y con las 4 claves (alias «${cfg.keyAlias}»)`);
  }
}

// ── El JDK ─────────────────────────────────────────────────────────────────
const jdk = process.env.JAVA_HOME;
if (!jdk || !existsSync(jdk)) err('JAVA_HOME no apunta a un JDK (Android Studio trae uno en \jbr)');
else ok(`JAVA_HOME: ${jdk}`);
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) avi('ANDROID_HOME sin definir — Gradle puede no encontrar el SDK');
else ok(`SDK: ${process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT}`);

// ── La versión ─────────────────────────────────────────────────────────────
// Play Console rechaza un .aab cuyo versionCode ya se haya subido, y el
// mensaje no siempre es obvio. Se avisa aquí, no al final de la subida.
const gradle = join(ANDROID, 'app', 'build.gradle');
if (existsSync(gradle)) {
  const g = readFileSync(gradle, 'utf8');
  const vc = g.match(/versionCode\s+(\d+)/), vn = g.match(/versionName\s+["']([^"']+)/);
  if (vc) {
    ok(`versionCode ${vc[1]} · versionName ${vn ? vn[1] : '?'}`);
    avi('cada subida a Play necesita un versionCode MAYOR que el anterior');
  }
}

// ── El código web que viaja en el paquete ─────────────────────────────────
// ⚠️ Se comprueba que el envoltorio YA NO apunte a GitHub: con `server.url`
// puesto, Capacitor ignoraría lo copiado y seguiría descargando el código.
const capCfg = join(WRAP, 'capacitor.config.json');
if (existsSync(capCfg)) {
  const cc = JSON.parse(readFileSync(capCfg, 'utf8'));
  const srv = cc.server || {};
  if (srv.url) err(`capacitor.config.json todavía tiene server.url (${srv.url}): el paquete descargaría el código de la red`);
  else ok('capacitor.config.json sin server.url: el código viaja en el paquete');
  if (srv.hostname !== 'getcorenova.github.io')
    err('server.hostname tiene que ser getcorenova.github.io — si no, el teléfono que actualice abre un almacenamiento vacío');
  else ok('server.hostname conserva el origen de la versión anterior (no se pierden datos al actualizar)');
} else err('no se encontró capacitor.config.json');
const buildWeb = (readFileSync(join(RAIZ, 'LexCapture_v8.html'), 'utf8').match(/var\s+_BUILD\s*=\s*(\d+)/) || [])[1];
if (buildWeb) ok(`código web a empaquetar: build ${buildWeb}`); else err('no se encontró _BUILD en LexCapture_v8.html');

if (fallos) { console.error(`\nBUILD FALLIDO — ${fallos} problema(s)\n`); process.exit(1); }
if (soloCheck) { console.log('\n✓ Requisitos OK. No se compiló nada (--check).\n'); process.exit(0); }

// ── Copiar la app a www/ y pasarla al proyecto Android ─────────────────────
// Solo lo que la página usa: el HTML (como index.html), el manifiesto y los
// íconos. NO el sw.js (en el envoltorio no se registra) ni el index.html de
// redirección (aquí la app ES el index).
console.log('\nCopiando la app web al paquete…');
const WWW = join(WRAP, 'www');
if (existsSync(WWW)) for (const f of readdirSync(WWW)) rmSync(join(WWW, f), { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
copyFileSync(join(RAIZ, 'LexCapture_v8.html'), join(WWW, 'index.html'));
for (const f of ['manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon.svg'])
  copyFileSync(join(RAIZ, f), join(WWW, f));
ok(`www/ listo (build ${buildWeb})`);
const cap = spawnSync('npx cap copy android', [], { cwd: WRAP, stdio: 'inherit', shell: true });
if (cap.status !== 0) { console.error('\nBUILD FALLIDO — «npx cap copy android» devolvió ' + cap.status + '\n'); process.exit(1); }
ok('copiado al proyecto Android (npx cap copy android)');

// ── Compilar ───────────────────────────────────────────────────────────────
console.log('\nCompilando App Bundle release (puede tardar varios minutos)…\n');
/* ⚠️ La ruta del proyecto lleva ESPACIOS («Proyectos 2026», «APP Capturas»), y eso
   rompió el build de dos maneras distintas antes de quedar así:
   1. Con la ruta absoluta SIN comillas, cmd.exe la parte en el primer espacio:
      «"D:\…\Proyectos" no se reconoce como un comando».
   2. Invocando solo «gradlew.bat» y confiando en el directorio de trabajo,
      cmd.exe tampoco lo encuentra: «gradlew.bat no se reconoce…».
   La que funciona es la ruta absoluta ENTRECOMILLADA. La tarea va dentro de la
   misma cadena y no en el arreglo de argumentos, porque con shell:true Node los
   concatena sin escapar y avisa de obsolescencia por ello.
   ⚠️ Lo destapó COMPILAR DE VERDAD: el modo --check no llega hasta esta línea. */
const gradlew = process.platform === 'win32'
  ? '"' + join(ANDROID, 'gradlew.bat') + '" ' + TAREA
  : './gradlew ' + TAREA;
const r = spawnSync(gradlew, [], { cwd: ANDROID, stdio: 'inherit', shell: true });
if (r.status !== 0) { console.error('\nBUILD FALLIDO — Gradle devolvió ' + r.status + '\n'); process.exit(r.status || 1); }

if (debug) {
  const apk = join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (!existsSync(apk)) { console.error('\nNo apareció el APK de depuración en ' + apk + '\n'); process.exit(1); }
  console.log('\n✓ APK de depuración: ' + apk + '\n  (solo para el emulador — no se sube a Play)\n');
  process.exit(0);
}
const aab = join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
if (!existsSync(aab)) { console.error('\nGradle terminó bien pero no apareció el .aab en ' + aab + '\n'); process.exit(1); }
console.log(`\n✓ .aab listo: ${aab}`);
console.log(`  ${(statSync(aab).size / 1048576).toFixed(2)} MB`);
console.log('\n  Subirlo:  npm run deploy:playstore\n');
