/* F6 · APP CHECK (2026-10-25).

   En la app de Android, un proveedor propio canjea un token CLÁSICO de Play
   Integrity por uno de App Check. Aquí no hay teléfono ni Google Play: se simula
   el complemento nativo (`Capacitor.Plugins.Integridad.clasico`) y el servicio
   de App Check (con `page.route`), y se mide lo que la app manda y lo que hace
   con lo que recibe. Lo que no se puede medir aquí —que Google acepte el token—
   se mide en un teléfono real desde una pista de Play (PUBLICAR.md).

   Cuatro mitades:
   A. Apagado mientras no esté puesto el appId de Android, y nunca en la web ni
      con los emuladores. Es el estado que se publica hoy.
   B. El canje: URL, cuerpo, el reto como nonce, el ttl y los errores.
   C. Arrancado de verdad sobre el SDK: pide el token solo y no rompe nada.
   D. El servidor y el complemento: apagado en el servidor, método clásico. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const ANDROID = join(ROOT, '..', 'lexcapture-android', 'android', 'app', 'src', 'main', 'java', 'com', 'getcorenova', 'flagrante', 'IntegridadPlugin.java');
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8171, r));

const R = [];
const log = (ok, l, x) => { R.push(!!ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');

/* ── Estático ─────────────────────────────────────────────────────────── */
log(/var CU_APPCHECK = \{ androidAppId: '' \};/.test(src), '[A1] Se publica APAGADO: CU_APPCHECK.androidAppId vacío');
const csp = (src.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
log(/connect-src[^;]*https:\/\/content-firebaseappcheck\.googleapis\.com/.test(csp), '[A2] La CSP deja hablar con el servicio de canje de App Check');
const vendor = readFileSync(join(ROOT, 'vendor', 'firebase.js'), 'utf8');
log(/initializeAppCheck/.test(vendor) && /CustomProvider/.test(vendor), '[A3] El paquete local de Firebase trae App Check (initializeAppCheck + CustomProvider)');
const iIni = src.indexOf("FB.initializeApp(cuConfig(), 'flagrante')"), iAc = src.indexOf('acIniciar(app);'), iAuth = src.indexOf('FB.initializeAuth(app');
log(iIni > 0 && iIni < iAc && iAc < iAuth, '[A4] App Check arranca justo después de initializeApp y ANTES de Auth y Firestore');

/* ── En el navegador ──────────────────────────────────────────────────── */
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
const page = await ctx.newPage();
const errs = [], violaciones = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await page.exposeFunction('__csp', v => violaciones.push(v));
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', e => window.__csp(e.violatedDirective + ' ' + e.blockedURI));
});

/* El servicio de App Check, simulado. Guarda lo que recibe. */
const pedidos = [];
let modo = 'ok';
await page.route('https://content-firebaseappcheck.googleapis.com/**', async route => {
  const req = route.request();
  const url = req.url(), cuerpo = req.postDataJSON ? req.postDataJSON() : null;
  pedidos.push({ url, metodo: req.method(), cuerpo, tipo: req.headers()['content-type'] || '' });
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (/:generatePlayIntegrityChallenge/.test(url)) {
    if (modo === 'reto-500') return route.fulfill({ status: 500, headers: cors, body: '{}' });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ challenge: 'UmV0b0RlUHJ1ZWJhMTIzNDU2Nzg5MA', ttl: '3600s' }) });
  }
  if (/:exchangePlayIntegrityToken/.test(url)) {
    if (modo === 'canje-403') return route.fulfill({ status: 403, headers: cors, body: '{}' });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ token: 'eyJ.TOKEN-APPCHECK.firma', ttl: '1800s' }) });
  }
  return route.fulfill({ status: 404, headers: cors, body: '{}' });
});

await page.goto('http://localhost:8171/LexCapture_v8.html');
await page.waitForFunction(() => window._lcListo, null, { timeout: 30000 });

/* El complemento nativo, simulado como lo inyectaría Capacitor en Android. */
const SIM_CAP = `window.__clasico = [];
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android',
    Plugins: { Integridad: {
      token: async () => ({ token: 'estandar' }),
      clasico: async (o) => { window.__clasico.push(o); if (window.__clasicoFalla) { var e = new Error('Play falló'); e.code = 'integridad--3'; throw e; } return { token: 'TOKEN-PLAY-CLASICO' }; }
    }, Device: { getId: async () => ({ identifier: 'x' }) } } };`;

const a = await page.evaluate(() => ({
  web: acNativo(), disp: typeof acDisponible === 'function' && (function () { try { return acDisponible(); } catch (e) { return 'error: ' + e.message; } })()
}));
log(a.web === false, '[A5] En el navegador (sin envoltorio) no se considera la app de Android');

await page.evaluate(SIM_CAP);
const b = await page.evaluate(async () => {
  await cuSdk();                      // carga vendor/firebase.js (sin pedir nada a la red)
  var sinId = acDisponible();
  CU_APPCHECK.androidAppId = '1:837685454525:android:abc123';
  var conId = acDisponible();
  localStorage.setItem('lc_flags', JSON.stringify({ cuentaEmulador: { auth: 'http://127.0.0.1:9099', host: '127.0.0.1', puerto: 8085 } }));
  var conEmulador = acDisponible();
  localStorage.removeItem('lc_flags');
  CU_APPCHECK.androidAppId = '';
  return { sinId, conId, conEmulador, nativo: acNativo() };
});
log(b.nativo === true, '[A6] Con el complemento de Android presente, sí se reconoce la app');
log(b.sinId === false, '[A7] …pero sin appId de Android sigue APAGADO', JSON.stringify(b));
log(b.conId === true, '[A8] Con appId y en Android, se puede encender');
log(b.conEmulador === false, '[A9] Con los emuladores de Firebase nunca se enciende (no exigen App Check)');

/* ── B. El canje ──────────────────────────────────────────────────────── */
const ttl = await page.evaluate(() => [acTtlMs('3600s'), acTtlMs('1800.5s'), acTtlMs('raro'), acTtlMs(''), acTtlMs('-5s')]);
log(ttl[0] === 3600000 && ttl[1] === 1800500, '[B1] El ttl «3600s» se lee en milisegundos', JSON.stringify(ttl));
log(ttl[2] === 3600000 && ttl[3] === 3600000 && ttl[4] === 3600000, '[B2] Un ttl que no es una duración válida cuenta como una hora');

pedidos.length = 0;
const t = await page.evaluate(async () => {
  CU_APPCHECK.androidAppId = '1:837685454525:android:abc123';
  window.__clasico = [];
  var antes = Date.now();
  var r = await acToken();
  return { r, antes, despues: Date.now(), clasico: window.__clasico };
});
const reto = pedidos.find(p => /:generatePlayIntegrityChallenge/.test(p.url) && p.metodo === 'POST');
const canje = pedidos.find(p => /:exchangePlayIntegrityToken/.test(p.url) && p.metodo === 'POST');
const URL_OK = /^https:\/\/content-firebaseappcheck\.googleapis\.com\/v1\/projects\/flagrante\/apps\/1%3A837685454525%3Aandroid%3Aabc123:(generatePlayIntegrityChallenge|exchangePlayIntegrityToken)\?key=AIza/;
log(reto && URL_OK.test(reto.url), '[B3] Pide el reto a projects/<proyecto>/apps/<appId de Android>:generatePlayIntegrityChallenge con la clave', reto && reto.url.slice(0, 140));
log(reto && /application\/json/.test(reto.tipo) && JSON.stringify(reto.cuerpo) === '{}', '[B4] …por POST, en JSON y con cuerpo vacío');
log(t.clasico.length === 1 && t.clasico[0].nonce === 'UmV0b0RlUHJ1ZWJhMTIzNDU2Nzg5MA', '[B5] El reto viaja como nonce al token CLÁSICO de Play Integrity', JSON.stringify(t.clasico));
log(t.clasico[0] && t.clasico[0].proyecto === '837685454525', '[B6] …con el número del proyecto de Google Cloud');
log(canje && URL_OK.test(canje.url) && canje.cuerpo && canje.cuerpo.playIntegrityToken === 'TOKEN-PLAY-CLASICO',
    '[B7] Canjea en :exchangePlayIntegrityToken mandando { playIntegrityToken }', canje && JSON.stringify(canje.cuerpo));
log(t.r.token === 'eyJ.TOKEN-APPCHECK.firma', '[B8] Devuelve el token de App Check que da el servicio');
log(t.r.expireTimeMillis >= t.antes + 1800000 && t.r.expireTimeMillis <= t.despues + 1800000,
    '[B9] …y su vencimiento (expireTimeMillis = ahora + ttl), que es la forma que pide CustomProvider');

const errorDe = async (prep) => page.evaluate(async (p) => {
  window.__clasicoFalla = p === 'play';
  try { await acToken(); return 'sin error'; } catch (e) { return e.code + (e.detalle ? ' · ' + e.detalle : ''); }
  finally { window.__clasicoFalla = false; }
}, prep);
modo = 'reto-500'; const e1 = await errorDe('red'); modo = 'ok';
log(e1 === 'ac/generatePlayIntegrityChallenge-500', '[B10] Si el reto falla, el error dice cuál paso y con qué estado', e1);
const e2 = await errorDe('play');
log(e2 === 'ac/integridad · integridad--3', '[B11] Si Google Play no da el token, se conserva su código de error (lo único legible desde campo)', e2);
modo = 'canje-403'; const e3 = await errorDe('red'); modo = 'ok';
log(e3 === 'ac/exchangePlayIntegrityToken-403', '[B12] Si el canje es rechazado (p. ej. app no registrada), se dice', e3);

/* ── C. Arrancado de verdad ───────────────────────────────────────────── */
pedidos.length = 0;
const c = await page.evaluate(async () => {
  CU_APPCHECK.androidAppId = '1:837685454525:android:abc123';
  window.__clasico = [];
  var app = FB.initializeApp(cuConfig(), 'prueba-appcheck');
  var ok = acIniciar(app);
  var dos = acIniciar(app);        // no se arranca dos veces
  for (var i = 0; i < 40 && !window.__clasico.length; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 300));
  CU_APPCHECK.androidAppId = '';
  return { ok, dos, pidio: window.__clasico.length, activo: _acActivo };
});
log(c.ok === true && c.activo === true, '[C1] acIniciar enciende App Check sobre el SDK real');
log(c.dos === true, '[C2] Llamarlo otra vez no lo vuelve a arrancar (devuelve que ya está activo)');
log(c.pidio >= 1 && pedidos.some(p => /:exchangePlayIntegrityToken/.test(p.url)),
    '[C3] Con la renovación automática, el SDK pide el token solo, por el proveedor propio', 'tokens pedidos a Play: ' + c.pidio);
log(violaciones.length === 0, '[C4] Ninguna violación de la CSP al hablar con App Check', violaciones.join(' | '));
/* B10 y B12 provocan a propósito un 500 y un 403: el navegador los anota en consola. */
const errsReales = errs.filter(e => !/Failed to load resource: the server responded with a status of (500|403)/.test(e));
log(errsReales.length === 0, '[C5] Consola limpia (salvo los dos errores de red que provoca la prueba)', errsReales.join(' | '));

/* ── D. El servidor y el complemento nativo ───────────────────────────── */
const fnSrc = readFileSync(join(ROOT, 'firebase', 'functions', 'index.js'), 'utf8');
log(/const APP_CHECK_OBLIGATORIO = false;/.test(fnSrc), '[D1] El servidor NO exige App Check todavía (APP_CHECK_OBLIGATORIO = false)');
log(/enforceAppCheck: APP_CHECK_OBLIGATORIO && !EMULADOR/.test(fnSrc), '[D2] …y en el emulador nunca lo exige');
log((fnSrc.match(/onCall\(CALL\(/g) || []).length === 2 && !/onCall\(\{/.test(fnSrc), '[D3] Las dos funciones que llama la app pasan por esa misma opción');
if (existsSync(ANDROID)) {
  const java = readFileSync(ANDROID, 'utf8');
  log(/public void clasico\(PluginCall call\)/.test(java) && /IntegrityTokenRequest\.builder\(\)\.setNonce\(nonce\)\.setCloudProjectNumber\(numero\)/.test(java),
      '[D4] El complemento de Android tiene el método clásico con el nonce y el número de proyecto');
  log(/public void token\(PluginCall call\)/.test(java) && /StandardIntegrityTokenRequest/.test(java),
      '[D5] …y conserva el estándar de la prueba gratuita');
} else {
  log(true, '[D4] (sin el proyecto de Android en esta máquina: no se mide el complemento)');
}

await browser.close(); server.close();
const okN = R.filter(Boolean).length;
console.log(`\n${okN}/${R.length}  ${okN === R.length ? '✅ TODO EN VERDE' : '❌ HAY FALLOS'}`);
process.exit(okN === R.length ? 0 : 1);
