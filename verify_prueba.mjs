/* EL DERECHO DE USO · F3 del plan de cuenta (2026-10-23).

   La prueba de 14 días la concede el SERVIDOR (firebase/functions). Esta suite
   la ejerce entera contra los EMULADORES de Firebase (Auth + Firestore +
   Functions), que arranca y apaga ella misma: ninguna comprobación toca un
   proyecto real. Cada contexto de navegador es un teléfono (su almacenamiento,
   su ANDROID_ID y su Device Recall).

   ⚠️ Play Integrity no se puede pedir desde un navegador ni desde un emulador
   de Android, así que el complemento nativo se SIMULA: devuelve un token «SIM.»
   con el veredicto que cada prueba quiere, y la función lo acepta SOLO porque
   corre en el emulador (FUNCTIONS_EMULATOR). La lógica que lo juzga es la misma
   que en producción; lo que no se prueba aquí es hablar con Google de verdad.

   S · la lógica del servidor, sin emuladores (correo desechable, veredicto, recall).
   P · pedir la prueba: correo sin verificar, concesión, mismo teléfono con otra
       cuenta, Device Recall tras restablecer, ANDROID_ID sin recall, integridad,
       correo desechable, reinstalar, otra cuenta en otro teléfono, la web.
   V · día 15: la app cerrada salvo pagar, revisar, exportar, salir y eliminar.
   R · el reloj del teléfono no revive la prueba; el plan pagado tiene 3 días de gracia.
   W · los avisos del final de la prueba.
   F · las reglas de Firestore.
   D · eliminar la cuenta limpia el servidor (también si el teléfono se cortó).
   E · estructura: CSP, SDK, guardián, simulación encerrada en el emulador. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { spawn, execSync } from 'child_process';
import { createRequire } from 'module';
import { createHash } from 'crypto';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const ANDROID = join(ROOT, '..', 'lexcapture-android');
const PROY = 'demo-flagrante', REGION = 'southamerica-east1';
const AUTH = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', FN = 'http://127.0.0.1:5001';
const EMU = { auth: AUTH, host: '127.0.0.1', puerto: 8085, fnPuerto: 5001, proyecto: PROY };
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const DIA = 86400000;

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const fnSrc = readFileSync(join(ROOT, 'firebase/functions/index.js'), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');

/* ═══ S · LA LÓGICA DEL SERVIDOR ═════════════════════════════════════════ */
const P = createRequire(import.meta.url)(join(ROOT, 'firebase/functions/prueba.js'));
log(P.desechable('x@yopmail.com') && P.desechable('x@mail.mailinator.com') && !P.desechable('x@gmail.com') && !P.desechable('x@policia.gov.co'),
    '[S1] los correos desechables se reconocen (también en subdominios) y los corrientes no');
const ahora = Date.now();
const vBueno = uid => ({ requestDetails: { requestPackageName: P.PAQUETE, requestHash: P.hashSolicitud(uid), timestampMillis: String(ahora) },
  appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' }, deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] } });
const conV = (uid, f) => { const v = vBueno(uid); f(v); return v; };
log(P.revisarVeredicto(vBueno('u1'), 'u1', ahora) === '', '[S2] un token de esta app, de esta cuenta, reciente y de un teléfono íntegro pasa');
log(P.revisarVeredicto(vBueno('u1'), 'u2', ahora) === 'integridad', '[S3] un token pedido para OTRA cuenta no sirve (requestHash)');
log(P.revisarVeredicto(conV('u1', v => { v.requestDetails.requestPackageName = 'com.otra.app'; }), 'u1', ahora) === 'integridad', '[S4] ni el de otra app');
log(P.revisarVeredicto(conV('u1', v => { v.requestDetails.timestampMillis = String(ahora - 11 * 60000); }), 'u1', ahora) === 'integridad-vieja', '[S5] ni uno de hace más de 10 minutos');
log(P.revisarVeredicto(conV('u1', v => { v.appIntegrity.appRecognitionVerdict = 'UNRECOGNIZED_VERSION'; }), 'u1', ahora) === 'integridad-app', '[S6] ni el de un APK que no viene de Play');
log(P.revisarVeredicto(conV('u1', v => { v.deviceIntegrity.deviceRecognitionVerdict = ['MEETS_BASIC_INTEGRITY']; }), 'u1', ahora) === 'integridad-telefono'
    && P.revisarVeredicto(conV('u1', v => { delete v.deviceIntegrity.deviceRecognitionVerdict; }), 'u1', ahora) === 'integridad-telefono',
    '[S7] ni el de un teléfono sin MEETS_DEVICE_INTEGRITY (root, emulador)');
const ym = d => { const x = new Date(d); return x.getUTCFullYear() * 100 + x.getUTCMonth() + 1; };
const conR = r => ({ deviceIntegrity: { deviceRecall: r } });
log(P.recallUsado({ deviceIntegrity: {} }, ahora) === null && P.recallUsado(conR({ values: {}, writeDates: {} }), ahora) === false
    && P.recallUsado(conR({ values: { bitFirst: true }, writeDates: { yyyymmFirst: ym(ahora) } }), ahora) === true,
    '[S8] Device Recall: sin evaluar → null · sin bit → no usado · bit 1 puesto → ya usó la prueba');
log(P.recallUsado(conR({ values: { bitFirst: true }, writeDates: { yyyymmFirst: ym(ahora - 30 * 30 * DIA) } }), ahora) === false
    && P.recallUsado(conR({ values: { bitFirst: true }, writeDates: { yyyymmFirst: ym(ahora - 20 * 30 * DIA) } }), ahora) === true,
    '[S9] un bit de hace más de 2 años ya no cuenta (teléfono revendido); uno de hace 20 meses sí');

/* ── Emuladores ─────────────────────────────────────────────────────────── */
const secreto = join(ROOT, 'firebase/functions/.secret.local');
if (!existsSync(secreto)) writeFileSync(secreto, 'PRUEBA_HMAC=secreto-solo-del-emulador\n');
if (!existsSync(join(ROOT, 'firebase/functions/node_modules/firebase-functions')))
  throw new Error('Faltan las dependencias de las funciones: cd firebase/functions && npm install');
const vivo = async u => { try { await fetch(u); return true; } catch (e) { return false; } };
const fnLista = async () => {
  try { const r = await fetch(`${FN}/${PROY}/${REGION}/miDerecho`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}' });
        return r.status === 401; } catch (e) { return false; }
};
let emu = null, salida = '';
if (!(await vivo(AUTH)) || !(await vivo(FS)) || !(await fnLista())) {
  emu = spawn(process.execPath, [join(ROOT, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:start',
    '--only', 'auth,firestore,functions', '--project', PROY, '--config', join(ROOT, 'firebase/firebase.json')],
    { cwd: join(ROOT, 'firebase'), stdio: ['ignore', 'pipe', 'pipe'] });
  emu.stdout.on('data', d => { salida += d; });
  emu.stderr.on('data', d => { salida += d; });
  const t0 = Date.now();
  while (!((await vivo(AUTH)) && (await vivo(FS)) && (await fnLista()))) {
    if (Date.now() - t0 > 120000) { console.error(salida.slice(-3000)); throw new Error('Los emuladores no arrancaron'); }
    await new Promise(r => setTimeout(r, 700));
  }
}
const apagar = () => { if (emu) { try { execSync('taskkill /pid ' + emu.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} } };
await fetch(`${AUTH}/emulator/v1/projects/${PROY}/accounts`, { method: 'DELETE' });
await fetch(`${FS}/emulator/v1/projects/${PROY}/databases/(default)/documents`, { method: 'DELETE' });

const DOCS = `${FS}/v1/projects/${PROY}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const leer = async ruta => { const r = await fetch(`${DOCS}/${ruta}`, { headers: OWNER }); return r.status === 200 ? r.json() : null; };
const listar = async col => ((await (await fetch(`${DOCS}/${col}?pageSize=100`, { headers: OWNER })).json()).documents || []);
async function ponerDerecho(uid, plan, venceMs) {
  await fetch(`${DOCS}/entitlements/${uid}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: {
    plan: { stringValue: plan }, pruebaUsada: { booleanValue: true }, vence: { timestampValue: new Date(venceMs).toISOString() } } }) });
}
async function verificarCorreo(uid) {
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROY}/accounts:update`,
    { method: 'POST', headers: OWNER, body: JSON.stringify({ localId: uid, emailVerified: true }) });
}
async function esperar(fn, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 400)); }
  return false;
}

/* ── Servidor de la app: la CSP se abre a los emuladores SOLO aquí ─────── */
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  let b = readFileSync(p);
  if (extname(p) === '.html') b = b.toString('utf8').replace("connect-src 'self'", `connect-src 'self' ${AUTH} ${FS} ${FN}`);
  s.end(b);
});
await new Promise(r => server.listen(8172, r));
const URL = 'http://localhost:8172/LexCapture_v8.html';

const browser = await chromium.launch({ headless: true });
const errs = [];
/* Un teléfono. `sim` = cómo responde su Play Integrity simulado:
   telefono (identidad física para Device Recall), androidId, recall (false =
   sin evaluar), integridad, app, hashFalso, desfase (ms del token). Sin `sim`
   es la versión web: no hay envoltorio nativo. */
async function telefono(sim) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, acceptDownloads: true });
  await ctx.addInitScript(([e, s]) => {
    const o = JSON.parse(localStorage.getItem('lc_flags') || '{}'); o.cuentaEmulador = e;
    localStorage.setItem('lc_flags', JSON.stringify(o));
    if (!s) return;
    window.__sim = s; window.__simLlamadas = [];
    const b64u = t => btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    window.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => 'android',
      Plugins: {
        Integridad: { token: async ({ requestHash, proyecto }) => {
          const x = window.__sim; window.__simLlamadas.push({ requestHash, proyecto });
          const v = { requestDetails: { requestPackageName: 'com.getcorenova.flagrante', requestHash: x.hashFalso ? 'f'.repeat(64) : requestHash,
                                        timestampMillis: String(Date.now() + (x.desfase || 0)) },
                      appIntegrity: { appRecognitionVerdict: x.app || 'PLAY_RECOGNIZED' },
                      deviceIntegrity: { deviceRecognitionVerdict: x.integridad || ['MEETS_DEVICE_INTEGRITY'] },
                      _sim: { telefono: x.telefono, recall: x.recall !== false } };
          return { token: 'SIM.' + b64u(JSON.stringify(v)) };
        } },
        Device: { getId: async () => ({ identifier: window.__sim.androidId }) }
      }
    };
  }, [EMU, sim || null]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('dialog', d => d.accept());
  return { ctx, page };
}
const listo = p => p.waitForFunction(() => window._lcListo === true, null, { timeout: 15000 });
const pant = (p, n) => p.waitForSelector(`#cu-ov.on .cu-pant[data-p="${n}"]`, { timeout: 40000 });
const enPant = (p, n) => p.evaluate(n => !!document.querySelector(`#cu-ov.on .cu-pant[data-p="${n}"]`), n);
async function abrir(t) { await t.page.goto(URL, { waitUntil: 'load' }); await listo(t.page); }
/* Crea la cuenta como lo haría la pantalla (la pantalla en sí la mide verify_cuenta). */
async function crearCuenta(t, correo, clave) {
  await abrir(t);
  await pant(t.page, 'bienvenida');
  return t.page.evaluate(async ([c, k]) => {
    await cuCrear(c, k);
    await cuGuardarLocal(Object.assign({}, _cuenta, { codigoPend: null }));
    cuContinuar();
    return _cuenta.uid;
  }, [correo, clave]);
}
async function entrar(t, correo, clave) {
  await abrir(t);
  await pant(t.page, 'bienvenida');
  await t.page.evaluate(async ([c, k]) => { const r = await cuEntrar(c, k); _cuTrasPantalla(r); }, [correo, clave]);
}
const empezar = async t => { await t.page.click('#cu-ok'); };
const errTxt = t => t.page.evaluate(() => { const e = document.getElementById('cu-err'); return e && !e.hidden ? e.textContent : ''; });
async function esperarError(t) { await t.page.waitForFunction(() => { const e = document.getElementById('cu-err'); return (e && !e.hidden) || !document.getElementById('cu-ov').classList.contains('on'); }, null, { timeout: 30000 }); return errTxt(t); }
/* Llama a la función saltándose la pantalla: lo que el servidor decide no puede depender del cliente. */
const llamar = (t, nombre, datos) => t.page.evaluate(async ([n, d]) => {
  try { const r = await FB.httpsCallable(_cuFB.fns, n)(d); return { ok: true, d: r.data }; }
  catch (e) { return { ok: false, code: e.code, msg: (e.details && e.details.motivo) || e.message }; }
}, [nombre, datos]);
const tokenSim = (t) => t.page.evaluate(async () => (await window.Capacitor.Plugins.Integridad.token({ requestHash: await drHashSolicitud(_cuenta.uid), proyecto: '1' })).token);

const CLAVE = 'Clave segura 2026';
const T1 = { telefono: 'tel-uno', androidId: 'a1b2c3d4e5f60718' };

try {
/* ═══ P · PEDIR LA PRUEBA ════════════════════════════════════════════════ */
const A = await telefono(T1);
const uidA = await crearCuenta(A, 'agente.uno@flagrante.test', CLAVE);
await pant(A.page, 'prueba');
const p1 = await A.page.evaluate(() => ({ btns: [...document.querySelectorAll('#cu-box .btn')].map(b => b.textContent), der: lcDerecho(), nav: (go('personas'), document.getElementById('screen-personas').classList.contains('on')) }));
log(p1.der === 'sinPrueba' && p1.btns.includes('Empezar mis 14 días') && !p1.nav,
    '[P1] una cuenta sin plan ve «Empieza tu prueba gratuita» y no puede entrar a la app', p1.btns.join('|'));

await empezar(A);
const p2 = await esperarError(A);
log(/confirma tu correo/i.test(p2), '[P2] sin el correo verificado, el teléfono no pide la prueba', p2);
const tokA0 = await tokenSim(A);
const p3 = await llamar(A, 'iniciarPrueba', { integridad: tokA0, dispositivo: T1.androidId });
log(!p3.ok && p3.msg === 'correo-sin-verificar' && !(await leer('entitlements/' + uidA)),
    '[P3] y el SERVIDOR tampoco la concede con el correo sin verificar (aunque se salte la pantalla)', p3.msg);

await verificarCorreo(uidA);
await A.page.evaluate(() => { window.__simLlamadas = []; cuMostrar('prueba'); });
await empezar(A);
const p4e = await esperarError(A); if (p4e) console.log('     (error al pedir la prueba)', p4e);
const ent = await leer('entitlements/' + uidA);
const venceA = ent ? Date.parse(ent.fields.vence.timestampValue) : 0;
log(ent && ent.fields.plan.stringValue === 'prueba' && Math.abs(venceA - (Date.now() + 14 * DIA)) < 120000,
    '[P4] con el correo verificado, el servidor concede 14 días', ent && ent.fields.vence.timestampValue);
const p5 = await A.page.evaluate(() => ({ der: lcDerecho(), plan: _cuenta.derecho && _cuenta.derecho.plan, llamadas: window.__simLlamadas, uid: _cuenta.uid,
  t: document.getElementById('toast').textContent, cas: document.getElementById('screen-capturas').classList.contains('on') }));
log(p5.der === 'activo' && p5.plan === 'prueba' && p5.cas && /14 días/.test(p5.t), '[P5] la app se abre en Capturas y lo dice', p5.t);
log(p5.llamadas.length === 1 && p5.llamadas[0].requestHash === sha('flagrante|prueba|' + uidA) && p5.llamadas[0].proyecto === '123456789012',
    '[P6] el token de integridad va atado a la cuenta (requestHash) y al número del proyecto');
const tel = await listar('dispositivosPrueba');
log(tel.length === 1 && !JSON.stringify(tel).includes(uidA) && !JSON.stringify(tel).includes(T1.androidId),
    '[P7] el teléfono queda anotado por un HMAC: sin el ANDROID_ID ni el uid', tel.length + ' documento(s)');
const rec = await leer('_simRecall/tel-uno');
log(!!rec && rec.fields.values.mapValue.fields.bitFirst.booleanValue === true, '[P8] y se marca el bit 1 de Device Recall del teléfono');
await A.page.evaluate(() => go('ajustes'));
const p9 = await A.page.evaluate(() => document.getElementById('aj-cuenta').innerText);
log(/Prueba gratuita/.test(p9) && /quedan 14 días/.test(p9), '[P9] Ajustes → Cuenta dice el plan y cuánto queda');
const p10 = await llamar(A, 'iniciarPrueba', { integridad: await tokenSim(A), dispositivo: T1.androidId });
log(p10.ok && p10.d.vence === venceA, '[P10] pedirla otra vez con la prueba vigente no la alarga ni falla: devuelve la misma');

/* El mismo teléfono con otra cuenta (correo nuevo). */
const B = await telefono(T1);
const uidB = await crearCuenta(B, 'agente.dos@flagrante.test', CLAVE);
await verificarCorreo(uidB);
await pant(B.page, 'prueba');
await empezar(B);
const p11 = await esperarError(B);
log(/teléfono ya usó/.test(p11) && !(await leer('entitlements/' + uidB)), '[P11] el MISMO teléfono con OTRA cuenta no tiene otra prueba', p11);

/* Restablecido de fábrica: ANDROID_ID nuevo, pero Device Recall lo recuerda. */
await B.page.evaluate(() => { window.__sim.androidId = 'ffeeddccbbaa9988'; cuMostrar('prueba'); });
await empezar(B);
const p12 = await esperarError(B);
log(/teléfono ya usó/.test(p12) && !(await leer('entitlements/' + uidB)), '[P12] tras restablecer de fábrica (ANDROID_ID nuevo) Device Recall lo sigue recordando', p12);

/* Sin Device Recall (cuenta de Play sin licencia…): el ANDROID_ID es el respaldo. */
await B.page.evaluate(([id]) => { window.__sim.androidId = id; window.__sim.recall = false; window.__sim.telefono = 'tel-otro'; cuMostrar('prueba'); }, [T1.androidId]);
await empezar(B);
const p13 = await esperarError(B);
log(/teléfono ya usó/.test(p13) && !(await leer('entitlements/' + uidB)), '[P13] sin Device Recall, el ANDROID_ID cifrado impide repetirla en el mismo teléfono', p13);

/* Integridad: cada fallo se dice y NO gasta la prueba. */
const C = await telefono({ telefono: 'tel-tres', androidId: '0011223344556677' });
const uidC = await crearCuenta(C, 'agente.tres@flagrante.test', CLAVE);
await verificarCorreo(uidC);
await pant(C.page, 'prueba');
const intento = async (cambio) => { await C.page.evaluate(c => { Object.assign(window.__sim, c); cuMostrar('prueba'); }, cambio); await empezar(C); return esperarError(C); };
const p14 = await intento({ integridad: ['MEETS_BASIC_INTEGRITY'] });
const p15 = await intento({ integridad: ['MEETS_DEVICE_INTEGRITY'], app: 'UNRECOGNIZED_VERSION' });
const p16 = await intento({ app: 'PLAY_RECOGNIZED', hashFalso: true });
const p17 = await intento({ hashFalso: false, desfase: -20 * 60000 });
log(/root o emulador/.test(p14), '[P14] un teléfono sin integridad (root, emulador) no tiene prueba, y se dice', p14);
log(/instalada desde Google Play/.test(p15), '[P15] un APK que no viene de Play tampoco', p15);
log(/instalada desde Google Play/.test(p16), '[P16] ni un token pedido para otra cuenta', p16);
log(/tardó demasiado/.test(p17), '[P17] ni un token viejo', p17);
log(!(await leer('entitlements/' + uidC)) && (await listar('dispositivosPrueba')).length === 1, '[P18] ninguno de esos intentos gastó la prueba de la cuenta ni anotó el teléfono');
await C.page.evaluate(() => { window.__sim.desfase = 0; cuMostrar('prueba'); });
await empezar(C);
await C.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 40000 });
log(!!(await leer('entitlements/' + uidC)), '[P19] con todo en orden, un teléfono nuevo sí tiene su prueba');

/* Correo desechable. */
const D = await telefono({ telefono: 'tel-cuatro', androidId: '8899aabbccddeeff' });
const uidD = await crearCuenta(D, 'alguien@yopmail.com', CLAVE);
await verificarCorreo(uidD);
await pant(D.page, 'prueba');
await empezar(D);
const p20 = await esperarError(D);
log(/correos temporales/.test(p20) && !(await leer('entitlements/' + uidD)), '[P20] un correo desechable no tiene prueba', p20);

/* Reinstalar: el mismo teléfono, almacenamiento vacío, misma cuenta. */
const A2 = await telefono(T1);
await entrar(A2, 'agente.uno@flagrante.test', CLAVE);
await A2.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 40000 });
const p21 = await A2.page.evaluate(() => ({ der: lcDerecho(), v: _cuenta.derecho.vence }));
log(p21.der === 'activo' && p21.v === venceA, '[P21] reinstalar no reinicia la prueba: al entrar trae la misma, con su fecha');
/* La misma cuenta en OTRO teléfono. */
const A3 = await telefono({ telefono: 'tel-cinco', androidId: '1234567890abcdef' });
await entrar(A3, 'agente.uno@flagrante.test', CLAVE);
await A3.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 40000 });
const p22 = await llamar(A3, 'iniciarPrueba', { integridad: await tokenSim(A3), dispositivo: '1234567890abcdef' });
log(p22.ok && p22.d.vence === venceA && (await listar('dispositivosPrueba')).length === 2,
    '[P22] la misma cuenta en otro teléfono usa SU prueba: no se repite ni se anota el teléfono nuevo');

/* La web: no hay Play Integrity, así que la prueba no se inicia allí. */
const W = await telefono(null);
const uidW = await crearCuenta(W, 'agente.web@flagrante.test', CLAVE);
await verificarCorreo(uidW);
await pant(W.page, 'prueba');
const p23 = await W.page.evaluate(() => ({ t: document.getElementById('cu-box').innerText, a: !!document.querySelector('#cu-box a[href*="play.google.com"]'),
  emp: [...document.querySelectorAll('#cu-box .btn')].some(b => /Empezar/.test(b.textContent)) }));
log(/desde la app de Android/.test(p23.t) && p23.a && !p23.emp, '[P23] en la web se explica que la prueba se inicia en Android, con el enlace a Play');
/* El token de sesión tiene que decir ya «correo verificado»: así lo único que
   falta es el token de Play, que es lo que se mide. */
await W.page.evaluate(async () => { await _cuFB.auth.currentUser.getIdToken(true); });
const p24 = await llamar(W, 'iniciarPrueba', { integridad: 'cualquier-cosa', dispositivo: 'abcdefgh12345678' });
const p25 = await llamar(W, 'iniciarPrueba', { dispositivo: 'abcdefgh12345678' });
log(!p24.ok && !p25.ok && /integridad/.test(p24.msg + p25.msg) && !(await leer('entitlements/' + uidW)),
    '[P24] y sin un token de Play el servidor no la concede, aunque se llame a mano', p24.msg + ' · ' + p25.msg);
await W.page.click('text=Ya la inicié');
await W.page.waitForFunction(() => { const e = document.getElementById('cu-info'); return e && !e.hidden; }, null, { timeout: 20000 });
log(/todavía no tiene un plan/.test(await W.page.textContent('#cu-info')), '[P25] «Ya la inicié» pregunta al servidor y dice que no hay plan');
await ponerDerecho(uidW, 'prueba', Date.now() + 5 * DIA);
await W.page.click('text=Ya la inicié');
await W.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 20000 });
log(await W.page.evaluate(() => lcDerecho() === 'activo'), '[P26] y cuando la cuenta ya tiene plan (iniciado en Android), la web se abre');

/* ═══ V · DÍA 15 ══════════════════════════════════════════════════════════ */
await A.page.evaluate(async () => {
  await DB.saveCases([{ id: 'c-vence', tipo: 'URI', created: Date.now(), capturados: [{ id: 'p1', priNom: 'ANA' }] }]);
  await DB.savePersons([{ id: 'per-1', priNom: 'ANA', priApe: 'PEREZ' }]);
});
await ponerDerecho(uidA, 'prueba', Date.now() - 60000);
await A.page.evaluate(async () => { await drActualizar(); drTrasActualizar(); });
await pant(A.page, 'vencido');
const v1 = await A.page.evaluate(() => ({ t: document.getElementById('cu-box').innerText, btns: [...document.querySelectorAll('#cu-box button')].map(b => b.textContent.trim()) }));
log(/Tu prueba terminó/.test(v1.t), '[V1] el día 15 la app se cierra: «Tu prueba terminó»');
log(['Suscribirme', 'Ya pagué: revisar', 'Exportar mis datos', 'Cerrar sesión', 'Eliminar mi cuenta'].every(b => v1.btns.includes(b)) && v1.btns.length === 5,
    '[V2] y solo ofrece suscribirse, revisar el pago, exportar, cerrar sesión o eliminar la cuenta', v1.btns.join('|'));
let descargas = 0;
A.page.on('download', () => { descargas++; });
const v3 = await A.page.evaluate(async () => {
  await cuOcultar();                           // aunque alguien quite la pantalla, el guardián sigue
  const r = {};
  go('personas'); r.nav = document.getElementById('screen-personas').classList.contains('on');
  startWizard('URI'); r.wiz = document.getElementById('screen-wizard').classList.contains('on');
  editCase('c-vence'); r.edit = document.getElementById('screen-wizard').classList.contains('on');
  go('compartir'); r.comp = document.getElementById('screen-compartir').classList.contains('on');
  r.env = ptEnviarRegistros([], [DB.getCase('c-vence')]).ok;
  r.imp = await new Promise(res => ptConfirmarImportacion({ personas: [], casos: [] }, 'x', ok => res(ok)));
  r.ov = document.querySelector('#cu-ov.on .cu-pant[data-p="vencido"]') !== null;
  return r;
});
log(!v3.nav && !v3.wiz && !v3.edit && !v3.comp, '[V3] el guardián cierra la navegación, el formulario, editar y Modo compartir', JSON.stringify(v3));
log(v3.env === false && v3.imp === false, '[V4] Modo compartir no envía ni recibe nada');
log(v3.ov, '[V5] y al intentarlo vuelve la pantalla del plan vencido');
await A.page.evaluate(() => { lcSalida('FPJ', { caso: DB.getCase('c-vence') }); lcProducirDoc('FPJ', { caso: DB.getCase('c-vence') }, { papel: 'CARTA' }); });
await A.page.waitForTimeout(800);
log(descargas === 0, '[V6] ni se genera ningún documento');

const dl = A.page.waitForEvent('download', { timeout: 30000 });
await A.page.click('text=Exportar mis datos');
const archivo = await dl;
await pant(A.page, 'exportado');
const ruta = await archivo.path();
const bytes = [...readFileSync(ruta)];
const v7 = await A.page.evaluate(async (b) => {
  const pin = document.getElementById('dr-clave').textContent.replace(/\s/g, '');
  const r = await ptArchivoAbrir(new Uint8Array(b).buffer, pin);
  const malo = await ptArchivoAbrir(new Uint8Array(b).buffer, '000000');
  return { pin, ok: r.ok, n: r.ok ? r.personas.length + r.casos.length : -1, malo: malo.ok, t: document.getElementById('cu-box').innerText };
}, bytes);
log(/\.lexc$/.test(archivo.suggestedFilename()) && v7.ok && v7.n === 2 && /^\d{6}$/.test(v7.pin),
    '[V7] «Exportar mis datos» entrega un .lexc con todo, y la clave de 6 dígitos lo abre', archivo.suggestedFilename() + ' · ' + v7.n + ' registros');
log(!v7.malo && !String(Buffer.from(bytes)).includes('ANA'), '[V8] el archivo va cifrado: sin la clave no se abre ni se lee');
await A.page.click('text=Listo');
await pant(A.page, 'vencido');
await A.page.click('text=Suscribirme');
log(/Actualiza Flagrante desde Google Play/.test(await A.page.textContent('#cu-info')),
    '[V9] en una app sin el complemento de compras, «Suscribirme» pide actualizar (la compra la mide verify_compras)');
await A.page.click('text=Ya pagué: revisar');
await A.page.waitForFunction(() => /todavía no tiene un plan/.test((document.getElementById('cu-info') || {}).textContent || ''), null, { timeout: 20000 });
log(true, '[V10] «Ya pagué: revisar» pregunta al servidor y dice que no hay plan activo');
await abrir(A);
await pant(A.page, 'vencido');
log(await enPant(A.page, 'vencido'), '[V11] al volver a abrir la app sigue cerrada');

/* ═══ R · EL RELOJ Y LA GRACIA ════════════════════════════════════════════ */
await ponerDerecho(uidA, 'prueba', Date.now() + DIA);
await A.page.click('text=Ya pagué: revisar');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 20000 });
const r0 = Date.now();
await A.page.clock.setFixedTime(r0 + 2 * DIA);
const r1 = await A.page.evaluate(() => lcDerecho());
await A.page.clock.setFixedTime(r0 - 30 * DIA);
const r2 = await A.page.evaluate(() => lcDerecho());
log(r1 === 'vencido', '[R1] sin señal la prueba vence a su hora (el reloj avanza 2 días)');
log(r2 === 'vencido', '[R2] y atrasar la hora del teléfono NO la revive');
const r3 = await A.page.evaluate(async () => {
  _drMarca = Date.now() + 40 * 86400000; drGuardarReloj();   // la marca alta que dejó el reloj avanzado
  await _lcWriteChain.cuenta;
  _drMarca = 0; _cuenta = JSON.parse(await _lcDecrypt(localStorage.getItem('lc_cuenta')));
  return lcDerecho();
});
log(r3 === 'vencido', '[R3] la marca del reloj se guarda con la cuenta: cerrar y abrir la app tampoco la revive');
await A.page.evaluate(async () => { await drActualizar(); });
log(await A.page.evaluate(() => lcDerecho()) === 'activo', '[R4] con señal, manda la hora del SERVIDOR: un reloj desajustado no castiga a nadie');
await A.page.clock.setFixedTime(Date.now());

await ponerDerecho(uidA, 'pagado', Date.now() - DIA);
await A.page.evaluate(async () => { await drActualizar(); drTrasActualizar(); });
const g1 = await A.page.evaluate(() => lcDerecho());
await ponerDerecho(uidA, 'pagado', Date.now() - 4 * DIA);
await A.page.evaluate(async () => { await drActualizar(); drTrasActualizar(); });
await pant(A.page, 'vencido');
const g2 = await A.page.evaluate(() => ({ d: lcDerecho(), t: document.getElementById('cu-box').innerText }));
log(g1 === 'activo', '[R5] el plan PAGADO tiene 3 días de gracia (por si el teléfono pasa días sin señal)');
log(g2.d === 'vencido' && /Tu suscripción venció/.test(g2.t), '[R6] y pasados, se cierra con «Tu suscripción venció»');

/* ═══ W · LOS AVISOS ═════════════════════════════════════════════════════ */
await ponerDerecho(uidA, 'prueba', Date.now() + 1.5 * DIA);
await A.page.evaluate(async () => { _drAvisado = ''; await drActualizar(); drTrasActualizar(); });
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 20000 });
log(/Te quedan 2 días/.test(await A.page.textContent('#toast')), '[W1] dos días antes del final se avisa');
await ponerDerecho(uidA, 'prueba', Date.now() + 5 * 3600000);
await A.page.evaluate(async () => { _drAvisado = ''; await drActualizar(); drTrasActualizar(); });
log(/menos de un día/.test(await A.page.textContent('#toast')), '[W2] y el último día también');

/* ═══ F · LAS REGLAS DE FIRESTORE ════════════════════════════════════════ */
const f = await A.page.evaluate(async ([otro]) => {
  const db = _cuFB.db, uid = _cuenta.uid, r = {};
  const intenta = async fn => { try { await fn(); return 'ok'; } catch (e) { return e.code; } };
  r.leerPropio = await intenta(() => FB.getDocFromServer(FB.doc(db, 'entitlements', uid)));
  r.escribirPropio = await intenta(() => FB.setDoc(FB.doc(db, 'entitlements', uid), { plan: 'pagado', vence: new Date(4e12) }));
  r.leerOtro = await intenta(() => FB.getDocFromServer(FB.doc(db, 'entitlements', otro)));
  r.telefonos = await intenta(() => FB.getDocFromServer(FB.doc(db, 'dispositivosPrueba', 'x')));
  r.recall = await intenta(() => FB.getDocFromServer(FB.doc(db, '_simRecall', 'tel-uno')));
  return r;
}, [uidC]);
log(f.leerPropio === 'ok', '[F1] cada cuenta lee su derecho de uso');
log(f.escribirPropio === 'permission-denied', '[F2] y NO lo puede escribir (si pudiera, se regalaría la prueba)', f.escribirPropio);
log(f.leerOtro === 'permission-denied', '[F3] ni leer el de otra cuenta', f.leerOtro);
log(f.telefonos === 'permission-denied' && f.recall === 'permission-denied', '[F4] los teléfonos anotados solo los ve el servidor');

/* ═══ D · ELIMINAR LA CUENTA ═════════════════════════════════════════════ */
await C.page.evaluate(async (k) => { try { await cuEliminarCuenta(k); } catch (e) {} }, CLAVE).catch(() => {});
const d1 = await esperar(async () => !(await leer('entitlements/' + uidC)));
log(d1 && !(await leer('users/' + uidC + '/llaves/main')), '[D1] eliminar la cuenta borra en el servidor su derecho de uso y sus llaves');
log((await listar('dispositivosPrueba')).length === 2, '[D2] el teléfono sigue anotado (sin el uid): borrar la cuenta no regala otra prueba');
/* El teléfono se cortó a la mitad: el usuario desaparece y sus llaves quedaron. */
log(!!(await leer('users/' + uidB + '/llaves/main')), '[D3·previo] la cuenta B tiene sus llaves en la nube');
await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROY}/accounts:delete`, { method: 'POST', headers: OWNER, body: JSON.stringify({ localId: uidB }) });
log(await esperar(async () => !(await leer('users/' + uidB + '/llaves/main'))), '[D3] si el borrado se cortó en el teléfono, el servidor termina el trabajo');

/* ═══ E · ESTRUCTURA ═════════════════════════════════════════════════════ */
const csp = (src.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
log(/connect-src[^;]*https:\/\/\*\.cloudfunctions\.net/.test(csp) && !/127\.0\.0\.1|localhost/.test(csp), '[E1] la CSP abre las funciones del servidor y nada local');
const vendor = readFileSync(join(ROOT, 'vendor/firebase.js'), 'utf8');
log(/httpsCallable/.test(vendor) && /getFunctions/.test(vendor) && /entrada [0-9a-f]{12}/.test(vendor.slice(0, 300)), '[E2] el paquete local del SDK trae las funciones y la huella de su entrada');
/* Sin comentarios, se quitan TODOS los bloques `if (EMULADOR…) { … }` (por
   llaves emparejadas): fuera de ellos no puede quedar rastro de la simulación. */
const sinComent = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
let fuera = sinComent, bloques = 0;
for (let i; (i = fuera.search(/if \(EMULADOR[^)]*\)\s*\{/)) >= 0;) {
  let j = fuera.indexOf('{', i), prof = 0, k = j;
  for (; k < fuera.length; k++) { if (fuera[k] === '{') prof++; else if (fuera[k] === '}' && --prof === 0) break; }
  fuera = fuera.slice(0, i) + fuera.slice(k + 1); bloques++;
}
log(bloques >= 3 && /'SIM\.'|_sim/.test(sinComent) && !/'SIM\.'|_sim/.test(fuera)
    && /const EMULADOR = process\.env\.FUNCTIONS_EMULATOR === 'true';/.test(fnSrc),
    '[E3] la simulación de Play Integrity solo existe dentro del emulador', bloques + ' bloques');
const reglas = readFileSync(join(ROOT, 'firebase/firestore.rules'), 'utf8');
log(/match \/entitlements\/\{uid\}\s*\{\s*allow read: if esDueno\(uid\);\s*allow write: if false;/.test(reglas), '[E4] las reglas: el derecho de uso se lee, nunca se escribe desde el teléfono');
const cuerpo = n => { const i = src.indexOf(n); return i < 0 ? '' : src.slice(i, i + 420); };
const guard = ['function go(name)', 'function startWizard(tipo)', 'function editCase(id)', 'function lcSalida(kind, ctx, nombre)', 'async function lcProducirDoc(kind, ctx, sel)',
  'function ptEnviarRegistros(personas, casos, cb)', 'async function ptExportarArchivo(personas, casos)', 'function ptImportarArchivo()', 'function ptConfirmarImportacion(abierto, deQuien, cb, opts)',
  'async function bzEnviarRegistros(uidPara, personas, casos)'];
log(guard.every(g => /lcGuardia\(\)/.test(cuerpo(g))), '[E5] un solo guardián en las diez puertas (la décima: enviar a un compañero por el buzón)');
const ws = src.indexOf('function wizSave');
log(ws > 0 && !/lcGuardia/.test(src.slice(ws, src.indexOf('\nfunction ', ws + 20))), '[E6] guardar una captura que ya se estaba llenando no se bloquea (no se pierde trabajo)');
log(/function drLibre\(\) \{\s*if \(!cuEsLocal\(\)\) return false;/.test(src), '[E7] el atajo de las pruebas (pruebaLibre) solo existe en localhost');
const plug = join(ANDROID, 'android/app/src/main/java/com/getcorenova/flagrante/IntegridadPlugin.java');
const main = join(ANDROID, 'android/app/src/main/java/com/getcorenova/flagrante/MainActivity.java');
const gradle = join(ANDROID, 'android/app/build.gradle');
if (existsSync(plug)) {
  const pj = readFileSync(plug, 'utf8'), mj = readFileSync(main, 'utf8'), gj = readFileSync(gradle, 'utf8');
  log(/@CapacitorPlugin\(name = "Integridad"\)/.test(pj) && /setRequestHash\(hash\)/.test(pj) && /setCloudProjectNumber\(numero\)/.test(pj)
      && /registerPlugin\(IntegridadPlugin\.class\);\s*\r?\n\s*super\.onCreate/.test(mj) && /com\.google\.android\.play:integrity:1\.6\.0/.test(gj),
      '[E8] el envoltorio Android trae el complemento de Play Integrity, registrado antes del puente');
} else log(true, '[E8] (el proyecto Android no está en este equipo: no se comprueba)');

const ruido = /Failed to load resource|permission-denied|PERMISSION_DENIED|Missing or insufficient permissions|status of 40[0-9]|ERR_ABORTED/;
const malos = errs.filter(e => !ruido.test(e));
log(malos.length === 0, '[E9] consola limpia (sin contar los rechazos que la prueba provoca)', malos.slice(0, 3).join(' | '));
} catch (e) {
  console.error(e);
  log(false, 'la suite se interrumpió', String(e.message).slice(0, 200));
} finally {
  await browser.close();
  server.close();
  apagar();
}
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
