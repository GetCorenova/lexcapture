/* LA CUENTA · F2 del plan de cuenta (2026-10-23).

   Se ejerce entera contra los EMULADORES de Firebase (Auth + Firestore), que la
   propia suite arranca y apaga: ninguna comprobación toca un proyecto real.
   Dos contextos de navegador son dos teléfonos (dos almacenamientos).

   Lo que se mide:
   A · dónde hay cuenta: sin configuración y en localhost la app sigue como antes;
       con cuenta, sin sesión solo se ve la bienvenida, y abrir la app no carga el SDK.
   B · crear la cuenta: Firebase recibe una llave derivada y NUNCA la contraseña;
       en la nube solo hay sobres cifrados; el código se enseña y se confirma.
   C · la sesión: reabre sin pedir nada, cerrar sesión no borra, otra cuenta no
       ve los datos de este equipo, una contraseña equivocada no deja nada a medias.
   D · cambiar la contraseña sin tocar los datos, y un cambio cortado a la mitad.
   E · olvidé la contraseña: enlace del correo + código de recuperación; sin código,
       empezar de cero sin tocar lo del teléfono.
   F · código de recuperación nuevo.
   G · eliminar la cuenta.
   H · las reglas de Firestore.
   I · estructura: CSP, paquete local del SDK, Service Worker, redirección. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { spawn, execSync } from 'child_process';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PROY = 'demo-flagrante';
const AUTH = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085';
const EMU = { auth: AUTH, host: '127.0.0.1', puerto: 8085, proyecto: PROY };
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');

/* ── Emuladores ─────────────────────────────────────────────────────────── */
const vivo = async u => { try { await fetch(u); return true; } catch (e) { return false; } };
let emu = null;
if (!(await vivo(AUTH)) || !(await vivo(FS))) {
  emu = spawn(process.execPath, [join(ROOT, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:start',
    '--only', 'auth,firestore', '--project', PROY, '--config', join(ROOT, 'firebase/firebase.json')],
    { cwd: join(ROOT, 'firebase'), stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  emu.stdout.on('data', d => { salida += d; });
  emu.stderr.on('data', d => { salida += d; });
  const t0 = Date.now();
  while (!((await vivo(AUTH)) && (await vivo(FS)))) {
    if (Date.now() - t0 > 90000) { console.error(salida.slice(-2000)); throw new Error('Los emuladores no arrancaron'); }
    await new Promise(r => setTimeout(r, 500));
  }
}
const apagar = () => { if (emu) { try { execSync('taskkill /pid ' + emu.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} } };
async function limpiarEmuladores() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROY}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROY}/databases/(default)/documents`, { method: 'DELETE' });
}
const oob = async (correo, tipo) => {
  const j = await (await fetch(`${AUTH}/emulator/v1/projects/${PROY}/oobCodes`)).json();
  return (j.oobCodes || []).filter(c => c.email === correo && c.requestType === tipo).pop();
};
const docLlaves = async uid => {
  const r = await fetch(`${FS}/v1/projects/${PROY}/databases/(default)/documents/users/${uid}/llaves/main`, { headers: { Authorization: 'Bearer owner' } });
  return r.status === 200 ? r.json() : null;
};
const cuentasAuth = async () => {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROY}/accounts:query`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: '{}' });
  return ((await r.json()).userInfo || []);
};
await limpiarEmuladores();

/* ── Servidor de la app: la CSP se abre a los emuladores SOLO aquí ─────── */
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  let b = readFileSync(p);
  if (extname(p) === '.html') b = b.toString('utf8').replace("connect-src 'self'", `connect-src 'self' ${AUTH} ${FS}`);
  s.end(b);
});
await new Promise(r => server.listen(8171, r));
const URL = 'http://localhost:8171/LexCapture_v8.html';

const browser = await chromium.launch({ headless: true });
const errs = [];
async function telefono(conEmulador = true) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
  if (conEmulador) await ctx.addInitScript(e => {
    const o = JSON.parse(localStorage.getItem('lc_flags') || '{}'); o.cuentaEmulador = e;
    /* El derecho de uso (F3) lo ejerce verify_prueba.mjs: aquí no se concede prueba. */
    o.pruebaLibre = true;
    localStorage.setItem('lc_flags', JSON.stringify(o));
  }, EMU);
  const page = await ctx.newPage();
  const red = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('dialog', d => d.accept());
  page.on('request', r => { const u = r.url(); if (u.startsWith(AUTH) || u.startsWith(FS)) red.push({ u, b: r.postData() || '' }); });
  return { ctx, page, red };
}
const listo = p => p.waitForFunction(() => window._lcListo === true, null, { timeout: 15000 });
const pant = (p, n) => p.waitForSelector(`.cu-pant[data-p="${n}"]`, { timeout: 30000 });
const enPant = (p, n) => p.evaluate(n => !!document.querySelector(`#cu-ov.on .cu-pant[data-p="${n}"]`), n);
async function abrir(t, url = URL) { await t.page.goto(url, { waitUntil: 'load' }); await listo(t.page); }

const CORREO_A = 'agente.uno@flagrante.test', CLAVE_A = 'Clave seguraA1';
const CORREO_B = 'agente.dos@flagrante.test', CLAVE_B = 'Clave seguraB2';

try {
/* ═══ A · DÓNDE HAY CUENTA ═══════════════════════════════════════════════ */
const T0 = await telefono(false);
await abrir(T0);
const a1 = await T0.page.evaluate(() => ({ ov: document.getElementById('cu-ov').classList.contains('on'), activa: cuActiva(),
  inst: cuInstalada(), aj: (go('ajustes'), document.getElementById('aj-cuenta').innerHTML) }));
log(!a1.ov && !a1.activa && a1.aj === '', '[A1] en localhost sin emuladores la app abre como antes, sin bienvenida ni sección Cuenta');
log(!a1.activa && /var CU_FB = \{ apiKey: '[^']*', authDomain: '[^']*', projectId: '(flagrante)?', appId: '[^']*', messagingSenderId: '[^']*'(, storageBucket: '[^']*')? \};/.test(src),
    '[A2] la configuración de Firebase (vacía o la del proyecto real) no activa la cuenta en localhost sin emuladores');
await T0.ctx.close();

const A = await telefono();
await abrir(A);
await pant(A.page, 'bienvenida');
const a3 = await A.page.evaluate(() => {
  const r = document.getElementById('cu-ov').getBoundingClientRect();
  return { w: r.width, h: r.height, listo: window._lcListo, fb: typeof window.FB, btns: [...document.querySelectorAll('#cu-box .btn')].map(b => b.textContent) };
});
log(a3.w >= 380 && a3.h >= 790 && a3.listo, '[A3] con cuenta y sin sesión, la bienvenida ocupa la pantalla entera', `${a3.w}×${a3.h}`);
log(a3.btns.join('|') === 'Crear cuenta|Ya tengo cuenta', '[A4] la bienvenida ofrece crear cuenta o iniciar sesión', a3.btns.join('|'));
log(a3.fb === 'undefined' && A.red.length === 0, '[A5] abrir la app no carga el SDK ni habla con Firebase (abre sin señal)');

/* Un equipo que ya tenía capturas antes de la cuenta: se quedan con la cuenta que se cree. */
await A.page.evaluate(async () => { await DB.saveCases([{ id: 'previa', tipo: 'URI', created: Date.now(), capturados: [{ id: 'p1', priNom: 'ANTERIOR' }] }]); });

/* ═══ B · CREAR LA CUENTA ═══════════════════════════════════════════════ */
await A.page.click('text=Crear cuenta');
await pant(A.page, 'crear');
await A.page.fill('#cu-correo', CORREO_A);
await A.page.fill('#cu-clave', 'corta1'); await A.page.fill('#cu-clave2', 'corta1');
await A.page.click('#cu-ok');
const b1 = await A.page.textContent('#cu-err');
log(/10 caracteres/.test(b1) && A.red.length === 0, '[B1] una contraseña floja se rechaza sin contactar a nadie', b1);
await A.page.fill('#cu-clave', CLAVE_A); await A.page.fill('#cu-clave2', CLAVE_A + 'x');
await A.page.click('#cu-ok');
log(/no coinciden/.test(await A.page.textContent('#cu-err')), '[B2] si las dos contraseñas no coinciden, se dice');
await A.page.fill('#cu-clave2', CLAVE_A);
await A.page.click('#cu-ok');
await pant(A.page, 'codigo');
const codigoA = await A.page.getAttribute('#cu-codigo', 'data-codigo');
log(/^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/.test(codigoA), '[B3] el código de recuperación son 24 caracteres en grupos de 4', codigoA);

const signUp = A.red.find(x => /accounts:signUp/.test(x.u));
const enviada = signUp ? JSON.parse(signUp.b).password : '';
log(!!enviada && enviada.startsWith('Fa1!') && enviada.length === 47 && enviada !== CLAVE_A,
    '[B4] Firebase recibe una llave derivada, no la contraseña', enviada.slice(0, 8) + '…');
log(A.red.every(x => !x.b.includes(CLAVE_A)), '[B5] la contraseña no aparece en NINGUNA petición a Firebase', A.red.length + ' peticiones');

const sesA = await A.page.evaluate(() => ({ uid: _cuenta.uid, dek: _cuenta.dek, raw: localStorage.getItem('lc_cuenta') }));
const dA = await docLlaves(sesA.uid);
const camposA = dA ? Object.keys(dA.fields).sort().join(',') : '';
const textoNube = JSON.stringify(dA);
log(camposA === 'act,dekClave,dekRec,kdf,v', '[B6] en la nube solo hay el sobre de la contraseña y el del código', camposA);
log(!textoNube.includes(sesA.dek) && !textoNube.includes(CORREO_A) && !textoNube.includes(codigoA.replace(/-/g, '')),
    '[B7] el sobre no contiene la llave de los datos, ni el correo, ni el código');
log(!sesA.raw.includes('@') && !sesA.raw.includes(sesA.uid), '[B8] la cuenta de este equipo se guarda cifrada con la llave del equipo');

await A.page.fill('#cu-conf', 'ZZZZ'); await A.page.click('#cu-ok');
log(/No coincide/.test(await A.page.textContent('#cu-err')), '[B9] confirmar el código con otros caracteres no avanza');
await A.page.fill('#cu-conf', codigoA.slice(-4).toLowerCase()); await A.page.click('#cu-ok');
await pant(A.page, 'verificar');
log(!!(await oob(CORREO_A, 'VERIFY_EMAIL')), '[B10] se envía el correo de verificación');
log(await A.page.evaluate(() => _cuenta.codigoPend === null), '[B11] una vez confirmado, el código ya no se guarda en el equipo');
await A.page.click('text=Hacerlo después');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'));
const b12 = await A.page.evaluate(() => ({ previa: !!DB.getCase('previa'), dueno: !!_cuenta.uid }));
log(b12.previa && b12.dueno, '[B12] lo que el equipo ya tenía se queda, ahora con dueño');
await A.page.evaluate(() => go('ajustes'));
const b13 = await A.page.evaluate(() => ({ t: document.getElementById('aj-cuenta').innerText, n: document.querySelectorAll('#aj-cuenta .aj-sec-hdr').length }));
log(b13.n === 1 && /agente\.uno@flagrante\.test/.test(b13.t) && /sin verificar/i.test(b13.t), '[B13] Ajustes → Cuenta muestra el correo y que falta verificarlo');

const vlink = await oob(CORREO_A, 'VERIFY_EMAIL');
await abrir(A, URL + '?mode=verifyEmail&oobCode=' + vlink.oobCode);
await pant(A.page, 'mensaje');
const b14 = await A.page.evaluate(() => ({ t: document.getElementById('cu-box').innerText, v: _cuenta.verificado }));
await A.page.click('#cu-box .btn');
const b14url = await A.page.evaluate(() => location.search);
log(/verificado/i.test(b14.t) && b14.v === true && !/oobCode/.test(b14url), '[B14] el enlace del correo verifica la cuenta y se limpia de la dirección');

/* ═══ C · LA SESIÓN ═════════════════════════════════════════════════════ */
await abrir(A);
const c1 = await A.page.evaluate(() => ({ ov: document.getElementById('cu-ov').classList.contains('on'), fb: typeof window.FB }));
log(!c1.ov, '[C1] con sesión, la app abre directo sin pedir nada');
log(c1.fb === 'undefined', '[C2] y sin cargar el SDK al abrir (la sesión vive cifrada en el equipo)');

await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Cerrar sesión');
await A.page.click('.mc >> button.bp');
await pant(A.page, 'bienvenida');
const c3 = await A.page.evaluate(async () => ({ s: _cuenta.sesion, dek: _cuenta.dek, n: (DB.getCases() || []).length, raw: !!(await lcIdbGet('lc_cases')) }));
log(c3.s === false && !c3.dek && c3.n === 1 && c3.raw, '[C3] cerrar sesión deja la información en el equipo, sin la llave de la nube');

await A.page.click('text=Ya tengo cuenta'); await pant(A.page, 'entrar');
await A.page.fill('#cu-correo', CORREO_A); await A.page.fill('#cu-clave', 'Equivocada99');
await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-err').hidden, null, { timeout: 30000 });
const c4 = await A.page.evaluate(() => ({ e: document.getElementById('cu-err').textContent, s: _cuenta.sesion, dek: !!_cuenta.dek }));
log(/incorrectos/.test(c4.e) && c4.s === false && !c4.dek, '[C4] una contraseña equivocada no abre nada ni deja nada a medias', c4.e);
await A.page.fill('#cu-clave', CLAVE_A); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 30000 });
const c5 = await A.page.evaluate(() => ({ s: _cuenta.sesion, dek: _cuenta.dek, previa: !!DB.getCase('previa') }));
log(c5.s && c5.dek === sesA.dek && c5.previa, '[C5] volver a entrar recupera la misma llave y la misma información');

/* Segundo teléfono: la cuenta B. */
const B = await telefono();
await abrir(B); await pant(B.page, 'bienvenida');
await B.page.click('text=Crear cuenta'); await pant(B.page, 'crear');
await B.page.fill('#cu-correo', CORREO_B); await B.page.fill('#cu-clave', CLAVE_B); await B.page.fill('#cu-clave2', CLAVE_B);
await B.page.click('#cu-ok'); await pant(B.page, 'codigo');
const codigoB = await B.page.getAttribute('#cu-codigo', 'data-codigo');
await B.page.fill('#cu-conf', codigoB.slice(-4)); await B.page.click('#cu-ok');
await pant(B.page, 'verificar'); await B.page.click('text=Hacerlo después');
const uidB = await B.page.evaluate(() => _cuenta.uid);
log(codigoB !== codigoA && uidB !== sesA.uid, '[C6] otra cuenta en otro teléfono tiene su propio código y su propio uid');

/* La cuenta B en el teléfono de A: no ve nada. */
await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Cerrar sesión'); await A.page.click('.mc >> button.bp');
await pant(A.page, 'bienvenida');
await A.page.click('text=Ya tengo cuenta'); await pant(A.page, 'entrar');
await A.page.fill('#cu-correo', CORREO_B); await A.page.fill('#cu-clave', CLAVE_B); await A.page.click('#cu-ok');
await pant(A.page, 'otraCuenta');
const c7 = await A.page.evaluate(async () => ({ t: document.getElementById('cu-box').innerText, uid: _cuenta.uid, s: _cuenta.sesion,
  n: (DB.getCases() || []).length, fbUser: !!(await _cuUsuarioListo()) }));
log(/a•••@flagrante\.test/.test(c7.t) && c7.uid === sesA.uid && c7.s === false && c7.n === 1 && !c7.fbUser,
    '[C7] otra cuenta en este teléfono no ve sus datos, no se queda conectada y se dice de quién es el equipo');
await A.page.click('text=Iniciar sesión con esa cuenta'); await pant(A.page, 'entrar');
await A.page.click('.cu-volver'); await pant(A.page, 'bienvenida');
const antes = A.red.length;
await A.page.click('text=Crear cuenta'); await pant(A.page, 'crear');
await A.page.fill('#cu-correo', 'tercero@flagrante.test'); await A.page.fill('#cu-clave', CLAVE_B); await A.page.fill('#cu-clave2', CLAVE_B);
await A.page.click('#cu-ok'); await pant(A.page, 'otraCuenta');
log(!A.red.slice(antes).some(x => /accounts:signUp/.test(x.u)), '[C8] y crear otra cuenta en un equipo que ya tiene dueño no llega a crearla');

await A.page.click('text=Iniciar sesión con esa cuenta'); await pant(A.page, 'entrar');
await A.page.fill('#cu-correo', CORREO_A); await A.page.fill('#cu-clave', CLAVE_A); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 30000 });

/* ═══ D · CAMBIAR LA CONTRASEÑA ═════════════════════════════════════════ */
const NUEVA_A = 'Otra claveA77';
const d1 = await A.page.evaluate(async () => { try { await cuCambiarClave('MalaClave11', 'Otra claveA77'); return 'cambió'; } catch (e) { return e.code; } });
log(/invalid|wrong/.test(d1), '[D1] con la contraseña actual equivocada no cambia nada', d1);
await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Cambiar contraseña');
await A.page.fill('#cu-clave', CLAVE_A); await A.page.fill('#cu-clave1', NUEVA_A); await A.page.fill('#cu-clave2', NUEVA_A);
await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('modal').classList.contains('open'), null, { timeout: 30000 });
const d2 = await A.page.evaluate(async ([c, n, uid]) => {
  const d = await _cuLeerLlaves(uid);
  const kN = await cuDerivar(c, n);
  const b = await cuDesenvolver(kN.env, d.dekClave, _cuAadClave(uid));
  return { dek: b ? _b64FromBytes(b) : null, nueva: 'dekClaveNueva' in d, previa: !!DB.getCase('previa') };
}, [CORREO_A, NUEVA_A, sesA.uid]);
log(d2.dek === sesA.dek && !d2.nueva && d2.previa, '[D2] la contraseña nueva abre la MISMA llave y la información no se tocó');
const d3 = await A.page.evaluate(async ([c, v, n]) => {
  const r = {};
  try { await cuEntrar(c, v); r.vieja = 'entró'; } catch (e) { r.vieja = e.code; }
  try { await cuEntrar(c, n); r.nueva = 'entró'; } catch (e) { r.nueva = e.code; }
  return r;
}, [CORREO_A, CLAVE_A, NUEVA_A]);
log(/invalid|wrong/.test(d3.vieja) && d3.nueva === 'entró', '[D3] la contraseña vieja ya no entra y la nueva sí', JSON.stringify(d3));

/* Un cambio cortado DESPUÉS de cambiarla en Firebase y ANTES de promover el sobre. */
const CORTADA = 'Cortada claveA5';
const d4 = await A.page.evaluate(async ([c, a, n, uid]) => {
  const kA = await cuDerivar(c, a), kN = await cuDerivar(c, n);
  const user = await _cuUsuarioVivo(kA);
  const dek = await cuDesenvolver(kA.env, (await _cuLeerLlaves(uid)).dekClave, _cuAadClave(uid));
  await FB.updateDoc(_cuRef(uid), { dekClaveNueva: await cuEnvolver(kN.env, dek, _cuAadClave(uid)) });
  await FB.updatePassword(user, kN.auth);
  /* …y aquí se cierra la app. */
  await FB.signOut(_cuFB.auth);
  const r = await cuEntrar(c, n);
  const d = await _cuLeerLlaves(uid);
  return { r, nueva: 'dekClaveNueva' in d, dek: _cuenta.dek };
}, [CORREO_A, NUEVA_A, CORTADA, sesA.uid]);
log(!d4.r.necesitaCodigo && !d4.nueva && d4.dek === sesA.dek, '[D4] un cambio cortado a la mitad se termina al entrar, sin perder la llave');

/* ═══ E · OLVIDÉ LA CONTRASEÑA ══════════════════════════════════════════ */
await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Cerrar sesión'); await A.page.click('.mc >> button.bp');
await pant(A.page, 'bienvenida');
await A.page.click('text=Ya tengo cuenta'); await pant(A.page, 'entrar');
await A.page.click('text=¿Olvidaste tu contraseña?'); await pant(A.page, 'olvido');
/* E1-E8: el enlace abre ESTA app (URL de acción propia, CU_ACCION_EN_APP). */
await A.page.evaluate(() => { CU_ACCION_EN_APP = true; });
await A.page.fill('#cu-correo', CORREO_A); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-info').hidden, null, { timeout: 30000 });
const rlink = await oob(CORREO_A, 'PASSWORD_RESET');
log(!!rlink, '[E1] «olvidé mi contraseña» envía el enlace al correo');
await abrir(A, URL + '?mode=resetPassword&oobCode=' + rlink.oobCode + '&apiKey=x&lang=es');
await pant(A.page, 'restablecer');
log((await A.page.textContent('#cu-box')).includes(CORREO_A), '[E2] el enlace abre la pantalla de contraseña nueva para esa cuenta');
const RESET = 'Restablecida A9';
const antesR = A.red.length;
await A.page.fill('#cu-clave', RESET); await A.page.fill('#cu-clave2', RESET); await A.page.click('#cu-ok');
await pant(A.page, 'necesitaCodigo');
const resetReq = A.red.slice(antesR).find(x => /accounts:resetPassword/.test(x.u) && /newPassword/.test(x.b));
log(!!resetReq && JSON.parse(resetReq.b).newPassword.startsWith('Fa1!') && !A.red.some(x => x.b.includes(RESET)),
    '[E3] también al restablecer, Firebase recibe la llave derivada y nunca la contraseña');
log(true, '[E4] con la contraseña nueva, la llave de la información pide el código de recuperación');
await A.page.fill('#cu-cod', codigoB); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-err').hidden, null, { timeout: 30000 });
log(/no corresponde/.test(await A.page.textContent('#cu-err')), '[E5] el código de otra cuenta no abre nada');
await A.page.fill('#cu-cod', codigoA.toLowerCase()); await A.page.click('#cu-ok');
await pant(A.page, 'codigo');
const codigoA2 = await A.page.getAttribute('#cu-codigo', 'data-codigo');
const e6 = await A.page.evaluate(async ([viejo, uid]) => {
  const d = await _cuLeerLlaves(uid);
  const rv = await cuLlaveRec(viejo, uid);
  return { dek: _cuenta.dek, viejoAbre: !!(await cuDesenvolver(rv, d.dekRec, _cuAadRec(uid))), sesion: _cuenta.sesion, previa: !!DB.getCase('previa') };
}, [codigoA, sesA.uid]);
log(e6.dek === sesA.dek && e6.sesion && e6.previa, '[E6] con el código se recupera la MISMA llave y la información del teléfono sigue ahí');
log(codigoA2 !== codigoA && !e6.viejoAbre, '[E7] el código usado deja de servir y se estrena uno nuevo');
await A.page.fill('#cu-conf', codigoA2.slice(-4)); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 30000 });

/* Sin código: empezar de cero en la nube, sin tocar el teléfono. */
await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Cerrar sesión'); await A.page.click('.mc >> button.bp');
await pant(A.page, 'bienvenida');
await A.page.evaluate(async c => { await (await cuSdk()); await FB.sendPasswordResetEmail(_cuFB.auth, c); }, CORREO_A);
const rlink2 = await oob(CORREO_A, 'PASSWORD_RESET');
await abrir(A, URL + '?mode=resetPassword&oobCode=' + rlink2.oobCode);
await pant(A.page, 'restablecer');
const SINCOD = 'Sin codigo A33';
const TRAS_T = 'Tras temporal T7';
await A.page.fill('#cu-clave', SINCOD); await A.page.fill('#cu-clave2', SINCOD); await A.page.click('#cu-ok');
await pant(A.page, 'necesitaCodigo');
await A.page.click('text=No tengo el código');
await pant(A.page, 'codigo');
const e8 = await A.page.evaluate(() => ({ dek: _cuenta.dek, previa: !!DB.getCase('previa'), s: _cuenta.sesion }));
log(e8.dek !== sesA.dek && e8.previa && e8.s, '[E8] sin código se estrena otra llave y lo del teléfono no se toca');
let codigoA3 = await A.page.getAttribute('#cu-codigo', 'data-codigo');
await A.page.fill('#cu-conf', codigoA3.slice(-4)); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 30000 });
const dekA3 = e8.dek;

/* E9-E15: la URL de acción NO se puede cambiar en el proyecto real, así que el
   enlace abre la página de Google y allí se escribe una contraseña TEMPORAL. */
await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Cerrar sesión'); await A.page.click('.mc >> button.bp');
await pant(A.page, 'bienvenida');
await A.page.click('text=Ya tengo cuenta'); await pant(A.page, 'entrar');
await A.page.click('text=¿Olvidaste tu contraseña?'); await pant(A.page, 'olvido');
log(await A.page.evaluate(() => CU_ACCION_EN_APP === false) && /var CU_ACCION_EN_APP = false;/.test(src),
    '[E9] la app publicada da por hecho que el enlace abre la página de Google');
await A.page.fill('#cu-correo', CORREO_A); await A.page.click('#cu-ok');
await pant(A.page, 'temporal');
const e10 = await A.page.evaluate(() => ({ correo: document.getElementById('cu-correo').value, info: !document.getElementById('cu-info').hidden,
  txt: document.getElementById('cu-box').innerText }));
log(e10.correo === CORREO_A && e10.info && /temporal/i.test(e10.txt), '[E10] tras enviar el enlace se explica la contraseña temporal, con el correo ya puesto');
/* La página de Google: Firebase guarda la temporal TAL CUAL. */
const rlink3 = await oob(CORREO_A, 'PASSWORD_RESET');
const TEMP = 'temporal123';
await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-flagrante`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: rlink3.oobCode, newPassword: TEMP }) });
await A.page.fill('#cu-temp', TEMP); await A.page.fill('#cu-clave', TEMP); await A.page.fill('#cu-clave2', TEMP); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-err').hidden, null, { timeout: 30000 });
log(/temporal/.test(await A.page.textContent('#cu-err')), '[E11] la contraseña nueva no puede ser la temporal (la vio la página de Google)');
await A.page.fill('#cu-temp', 'otra cosa 9'); await A.page.fill('#cu-clave', TRAS_T); await A.page.fill('#cu-clave2', TRAS_T); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-err').hidden && /no coincide/.test(document.getElementById('cu-err').textContent), null, { timeout: 60000 });
log(await enPant(A.page, 'temporal'), '[E12] una temporal equivocada se dice y no deja nada a medias');
const antesT = A.red.length;
await A.page.fill('#cu-temp', TEMP); await A.page.fill('#cu-clave', TRAS_T); await A.page.fill('#cu-clave2', TRAS_T); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !!document.querySelector('.cu-pant[data-p="necesitaCodigo"]') ||
  (document.getElementById('cu-err') && !document.getElementById('cu-err').hidden), null, { timeout: 60000 });
if (!(await enPant(A.page, 'necesitaCodigo'))) console.log('     pantalla:', await A.page.textContent('#cu-err'));
await pant(A.page, 'necesitaCodigo');
const redT = A.red.slice(antesT);
const updT = redT.find(x => /accounts:update/.test(x.u) && /"password"/.test(x.b));
log(!!updT && JSON.parse(updT.b).password.startsWith('Fa1!') && !redT.some(x => x.b.includes(TRAS_T)),
    '[E13] la contraseña nueva se cambia en el acto por la llave derivada: Firebase nunca la recibe');
await A.page.fill('#cu-cod', codigoA3); await A.page.click('#cu-ok');
await pant(A.page, 'codigo');
codigoA3 = await A.page.getAttribute('#cu-codigo', 'data-codigo');
await A.page.fill('#cu-conf', codigoA3.slice(-4)); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 30000 });
const e14 = await A.page.evaluate(() => ({ dek: _cuenta.dek, previa: !!DB.getCase('previa') }));
log(e14.dek === dekA3 && e14.previa, '[E14] con el código se recupera la MISMA llave y lo del teléfono sigue ahí');
const tempYa = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-flagrante`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: CORREO_A, password: TEMP, returnSecureToken: true }) })).json();
log(!!tempYa.error, '[E15] la contraseña temporal deja de servir');

/* ═══ F · CÓDIGO NUEVO DESDE AJUSTES ═══════════════════════════════════ */
await A.page.evaluate(() => go('ajustes'));
await A.page.click('text=Código de recuperación nuevo');
await A.page.fill('#cu-clave', 'Mala clave 1'); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-err').hidden, null, { timeout: 30000 });
log(/incorrectos/.test(await A.page.textContent('#cu-err')), '[F1] sin la contraseña no se genera otro código');
await A.page.fill('#cu-clave', TRAS_T); await A.page.click('#cu-ok');
await pant(A.page, 'codigo');
const codigoA4 = await A.page.getAttribute('#cu-codigo', 'data-codigo');
const f2 = await A.page.evaluate(async ([viejo, nuevo, uid]) => {
  const d = await _cuLeerLlaves(uid);
  const v = await cuDesenvolver(await cuLlaveRec(viejo, uid), d.dekRec, _cuAadRec(uid));
  const n = await cuDesenvolver(await cuLlaveRec(nuevo, uid), d.dekRec, _cuAadRec(uid));
  return { v: !!v, n: n ? _b64FromBytes(n) : null };
}, [codigoA3, codigoA4, sesA.uid]);
log(!f2.v && f2.n === dekA3, '[F2] el código nuevo abre la llave y el anterior deja de servir');
await A.page.fill('#cu-conf', codigoA4.slice(-4)); await A.page.click('#cu-ok');
await A.page.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 30000 });

/* ═══ H · REGLAS DE FIRESTORE ═══════════════════════════════════════════ */
const h = await B.page.evaluate(async uidA => {
  await cuSdk();
  const r = {};
  try { await FB.getDocFromServer(FB.doc(_cuFB.db, 'users', uidA, 'llaves', 'main')); r.leer = 'leyó'; } catch (e) { r.leer = e.code; }
  try { await FB.setDoc(FB.doc(_cuFB.db, 'users', uidA, 'llaves', 'main'), { v: 1, dekClave: 'x'.repeat(40), dekRec: 'x'.repeat(40) }); r.escribir = 'escribió'; } catch (e) { r.escribir = e.code; }
  try { await FB.updateDoc(_cuRef(_cuenta.uid), { colado: 'texto en claro' }); r.campo = 'escribió'; } catch (e) { r.campo = e.code; }
  try { await FB.setDoc(FB.doc(_cuFB.db, 'users', _cuenta.uid, 'otra', 'cosa'), { a: 1 }); r.otra = 'escribió'; } catch (e) { r.otra = e.code; }
  await FB.signOut(_cuFB.auth);
  try { await FB.getDocFromServer(_cuRef(_cuenta.uid)); r.anonimo = 'leyó'; } catch (e) { r.anonimo = e.code; }
  return r;
}, sesA.uid);
log(h.leer === 'permission-denied', '[H1] una cuenta no puede leer las llaves de otra', h.leer);
log(h.escribir === 'permission-denied', '[H2] ni escribirlas', h.escribir);
log(h.campo === 'permission-denied', '[H3] ni el dueño puede colar un campo que no sea un sobre', h.campo);
log(h.otra === 'permission-denied', '[H4] y fuera de las llaves todo está cerrado (F4 abrirá los registros)', h.otra);
log(h.anonimo === 'permission-denied', '[H5] sin sesión no se lee nada', h.anonimo);

/* ═══ G · ELIMINAR LA CUENTA ════════════════════════════════════════════ */
await B.page.evaluate(() => { localStorage.setItem('lc_theme', 'dark'); go('ajustes'); });
await B.page.evaluate(() => renderAjCuenta());
await B.page.click('text=Eliminar mi cuenta');
await B.page.fill('#cu-clave', 'Mala clave 2'); await B.page.click('#cu-ok');
await B.page.waitForFunction(() => !document.getElementById('cu-err').hidden, null, { timeout: 30000 });
log(!!(await docLlaves(uidB)) && (await cuentasAuth()).some(u => u.localId === uidB), '[G1] con la contraseña equivocada no se borra nada');
await B.page.fill('#cu-clave', CLAVE_B);
await Promise.all([B.page.waitForNavigation({ timeout: 30000 }), B.page.click('#cu-ok')]);
await listo(B.page); await pant(B.page, 'bienvenida');
const g2 = await B.page.evaluate(() => ({ cu: localStorage.getItem('lc_cuenta'), tema: localStorage.getItem('lc_theme') }));
log(!(await docLlaves(uidB)) && !(await cuentasAuth()).some(u => u.localId === uidB), '[G2] se borran las llaves de la nube y la cuenta de Firebase');
log(g2.cu === null && g2.tema === 'dark', '[G3] y la información del teléfono; el tema (preferencia del equipo) se conserva');

/* ═══ I · ESTRUCTURA ═══════════════════════════════════════════════════ */
const csp = (src.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const conn = (csp.match(/connect-src ([^;]+)/) || [])[1] || '';
log(['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com'].every(d => conn.includes(d)) && !/127\.0\.0\.1|localhost/.test(csp),
    '[I1] la CSP abre las conexiones a Firebase y a nada de pruebas');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const vend = existsSync(join(ROOT, 'vendor/firebase.js')) ? readFileSync(join(ROOT, 'vendor/firebase.js'), 'utf8') : '';
log(vend.startsWith('/* Flagrante · paquete local de Firebase JS SDK ' + pkg.devDependencies.firebase + ' ') && !/<script[^>]+src=["']https?:/i.test(src),
    '[I2] el SDK viaja en un archivo local de la versión fijada, sin CDN');
const and = readFileSync(join(ROOT, 'scripts/build-android.mjs'), 'utf8');
log(/vendor', 'firebase\.js'/.test(and) && !/serviceWorker\.register\(/.test(src), '[I3] el paquete de Android lleva el SDK y la app ya no registra un Service Worker (web retirada)');
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
log(!/LexCapture_v8\.html/.test(idx) && /flagrante\.web\.app/.test(idx), '[I4] index.html ya no abre la app: la versión web se retiró');
const i5 = await A.page.evaluate(async claves => {
  let txt = JSON.stringify(Object.assign({}, localStorage));
  return claves.filter(c => txt.includes(c));
}, [CLAVE_A, NUEVA_A, CORTADA, RESET, SINCOD, TRAS_T, codigoA, codigoA4]);
log(i5.length === 0, '[I5] ninguna contraseña ni código queda escrito en el almacenamiento del teléfono');
const ruido = errs.filter(e => !/auth\/|permission-denied|PERMISSION_DENIED|400 \(Bad Request\)|status of 4\d\d/.test(e));
log(ruido.length === 0, '[I6] consola limpia (sin contar los rechazos que la prueba provoca)', ruido.slice(0, 3).join(' | '));

await A.ctx.close(); await B.ctx.close();
} catch (e) {
  console.error(e); R.push(false);
} finally {
  await browser.close(); server.close(); apagar();
}
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
