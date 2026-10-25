/* COMPAÑEROS Y BUZÓN · compartir entre cuentas, paso 1 (2026-10-24).

   Dos funcionarios con cuenta se agregan como compañeros UNA vez, estando
   juntos, con un solo escaneo; desde ahí tienen un buzón cifrado de un teléfono
   al otro. Esta suite lo ejerce contra los EMULADORES de Firebase (Auth +
   Firestore), que arranca y apaga ella misma. Cada contexto de navegador es un
   teléfono: su almacenamiento y su llave.

   A · la llave de identidad de la cuenta: se crea, se guarda cifrada, sirve sin
       señal y es la MISMA en todos los equipos de la cuenta.
   B · agregar un compañero: el código pasa por el lector QR de verdad, los dos
       quedan agregados y confirmados, con el mismo código de seguridad; el código
       es de un solo uso y caduca.
   C · el buzón: lo que guarda Firestore no se lee; reglas; un mensaje no abre en
       otro sitio; quien no es compañero no entra; quitar un compañero.
   D · lo que se ve en «Modo compartir»; sin cuenta no aparece; consola. */
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
const DIA = 86400000;

const R = [];
const log = (ok, l, x) => { R.push(!!ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };

/* ── Emuladores ─────────────────────────────────────────────────────────── */
const vivo = async u => { try { await fetch(u); return true; } catch (e) { return false; } };
let emu = null, salida = '';
if (!(await vivo(AUTH)) || !(await vivo(FS))) {
  emu = spawn(process.execPath, [join(ROOT, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:start',
    '--only', 'auth,firestore', '--project', PROY, '--config', join(ROOT, 'firebase/firebase.json')],
    { cwd: join(ROOT, 'firebase'), stdio: ['ignore', 'pipe', 'pipe'] });
  emu.stdout.on('data', d => { salida += d; });
  emu.stderr.on('data', d => { salida += d; });
  const t0 = Date.now();
  while (!((await vivo(AUTH)) && (await vivo(FS)))) {
    if (Date.now() - t0 > 120000) { console.error(salida.slice(-3000)); throw new Error('Los emuladores no arrancaron'); }
    await new Promise(r => setTimeout(r, 700));
  }
}
const apagar = () => { if (emu) { try { execSync('taskkill /pid ' + emu.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} } };
await fetch(`${AUTH}/emulator/v1/projects/${PROY}/accounts`, { method: 'DELETE' });
await fetch(`${FS}/emulator/v1/projects/${PROY}/databases/(default)/documents`, { method: 'DELETE' });

const DOCS = `${FS}/v1/projects/${PROY}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const listar = async col => ((await (await fetch(`${DOCS}/${col}?pageSize=300`, { headers: OWNER })).json()).documents || []);
const leerDoc = async ruta => { const r = await fetch(`${DOCS}/${ruta}`, { headers: OWNER }); return r.status === 200 ? r.json() : null; };
const borrarDoc = ruta => fetch(`${DOCS}/${ruta}`, { method: 'DELETE', headers: OWNER });
const escribirDoc = (ruta, fields) => fetch(`${DOCS}/${ruta}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields }) });
async function ponerDerecho(uid) {
  await escribirDoc(`entitlements/${uid}`, { plan: { stringValue: 'prueba' }, pruebaUsada: { booleanValue: true },
                                             vence: { timestampValue: new Date(Date.now() + 10 * DIA).toISOString() } });
}
async function esperar(fn, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) {} await new Promise(r => setTimeout(r, 400)); }
  return false;
}

/* ── Servidor de la app: la CSP se abre a los emuladores SOLO aquí ─────── */
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  let b = readFileSync(p);
  if (extname(p) === '.html') b = b.toString('utf8').replace("connect-src 'self'", `connect-src 'self' ${AUTH} ${FS}`);
  s.end(b);
});
await new Promise(r => server.listen(8174, r));
const URL = 'http://localhost:8174/LexCapture_v8.html';

const browser = await chromium.launch({ headless: true });
const errs = [];
async function telefono(conCuenta = true) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
  if (conCuenta) await ctx.addInitScript(e => {
    const o = JSON.parse(localStorage.getItem('lc_flags') || '{}'); o.cuentaEmulador = e; o.pruebaLibre = true;
    localStorage.setItem('lc_flags', JSON.stringify(o));
  }, EMU);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('dialog', d => d.accept());
  return { ctx, page };
}
const listo = p => p.waitForFunction(() => window._lcListo === true, null, { timeout: 20000 });
async function abrir(t) { await t.page.goto(URL, { waitUntil: 'load' }); await listo(t.page); }
async function crearCuenta(t, correo, nombre) {
  const uid = await t.page.evaluate(async ([c, k, n]) => {
    await cuCrear(c, k);
    await cuGuardarLocal(Object.assign({}, _cuenta, { codigoPend: null }));
    const cfg = lcCfgCrudo();
    cfg.perfiles = [{ id: 'pf-1', nombre: n, grado: 'Patrullero', activo: true }]; cfg.perfilActivo = 'pf-1';
    await DB.saveConfig(cfg);
    cuContinuar();
    return _cuenta.uid;
  }, [correo, CLAVE, nombre]);
  await ponerDerecho(uid);
  return uid;
}
async function entrar(t, correo) {
  await t.page.evaluate(async ([c, k]) => { const r = await cuEntrar(c, k); _cuTrasPantalla(r); }, [correo, CLAVE]);
}
/* El buzón escuchando y la identidad lista. */
const enLinea = t => t.page.waitForFunction(() => !!(typeof _bzUnsub !== 'undefined' && _bzUnsub && _bzId), null, { timeout: 30000 });
const contactos = t => t.page.evaluate(() => JSON.parse(JSON.stringify(bzContactos())));
const buzon = async uid => (await listar(`buzon/${uid}/m`));
/* El código, dibujado y LEÍDO con el lector de la app: así viaja en la calle. */
async function porElLector(t, bytes) {
  return t.page.evaluate(async b => {
    const p = Uint8Array.from(b);
    const svg = ptQrSvg(p, 320);
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
    const W = 400, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, W); x.drawImage(img, 40, 40, 320, 320);
    const r = ptQrLeer(x.getImageData(0, 0, W, W).data, W, W);
    return r ? Array.from(r) : null;
  }, bytes);
}

const CLAVE = 'Clave segura 2026';

try {
/* ═══ A · LA LLAVE DE IDENTIDAD ═══════════════════════════════════════════ */
const A = await telefono(); await abrir(A);
const uA = await crearCuenta(A, 'nelson@flagrante.test', 'Nelson David');
await enLinea(A);
const idA = await A.page.evaluate(() => ({ pub: _bzId.pubB64, priv: _bzId.privB64, huella: _bzId.huella }));
const docIdA = await leerDoc(`users/${uA}/llaves/id`);
const privNube = docIdA && docIdA.fields.priv.stringValue, pubNube = docIdA && docIdA.fields.pub.stringValue;
log(!!docIdA && pubNube === idA.pub, '[A1] Al entrar, la cuenta estrena su llave de identidad en la nube', idA.huella);
log(privNube && !privNube.includes(idA.priv.slice(20, 60)) && privNube.length < 400,
  '[A2] La privada viaja CIFRADA: lo que guarda Firestore no es la llave', privNube && privNube.length + ' caracteres');
const sinRed = await A.page.evaluate(async () => {
  const antes = _bzId.pubB64;
  _bzId = null;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  const id = await bzIdentidad();
  delete navigator.onLine;
  return id && id.pubB64 === antes && !id.nube;
});
log(sinRed, '[A3] Sin señal sirve la de este equipo (guardada cifrada aquí)');
const local = await A.page.evaluate(async uid => {
  const enc = await lcIdbGet('bz|' + uid);
  return { cifrada: typeof enc === 'string' && !enc.includes('"priv"'), abre: !!JSON.parse(await _lcDecrypt(enc)).priv };
}, uA);
log(local.cifrada && local.abre, '[A4] En este equipo va cifrada con la llave del equipo');
await borrarDoc(`users/${uA}/llaves/id`);
const repuesta = await A.page.evaluate(async () => { const antes = _bzId.pubB64; _bzId = null; const id = await bzIdentidad(); return id && id.pubB64 === antes; });
const docRep = await leerDoc(`users/${uA}/llaves/id`);
log(repuesta && docRep && docRep.fields.pub.stringValue === idA.pub,
  '[A5] Si falta en la nube, se repone con la MISMA llave (los compañeros no se pierden)');

const A2 = await telefono(); await abrir(A2);
await entrar(A2, 'nelson@flagrante.test');
await enLinea(A2);
const pubA2 = await A2.page.evaluate(() => _bzId.pubB64);
log(pubA2 === idA.pub, '[A6] Otro equipo de la misma cuenta tiene la MISMA llave');

/* ═══ B · AGREGAR UN COMPAÑERO ════════════════════════════════════════════ */
const B = await telefono(); await abrir(B);
const uB = await crearCuenta(B, 'luz@flagrante.test', 'Luz Marín');
await enLinea(B);

const cod = await A.page.evaluate(async () => { const c = await bzNuevoCodigo(); return { b: Array.from(c.bytes), v: ptQrMatriz(c.bytes).v }; });
log(cod.v <= 10, '[B1] El código para agregar cabe en un QR pequeño', cod.b.length + ' B → versión ' + cod.v);
const leido = await porElLector(B, cod.b);
log(leido && leido.length === cod.b.length && leido.every((x, i) => x === cod.b[i]),
  '[B2] Se dibuja y se vuelve a LEER con el lector de la app, byte a byte');
const rB = await B.page.evaluate(async b => bzAgregarDesdeCodigo(Uint8Array.from(b)), leido);
const cB0 = await contactos(B);
log(rB.ok && cB0.length === 1 && cB0[0].uid === uA && /Nelson/.test(cB0[0].nom),
  '[B3] Quien escanea guarda al compañero con su nombre', rB.ok ? rB.nom : rB.motivo);
const okA = await esperar(async () => { const c = await contactos(A); return c.length === 1 && c[0].uid === uB && c[0].confirmado; });
const cA = await contactos(A);
log(okA && /Luz/.test(cA[0].nom), '[B4] Al que enseñó el código le llega la solicitud y lo agrega solo', cA[0] && cA[0].nom);
const okB = await esperar(async () => { const c = await contactos(B); return c.length === 1 && c[0].confirmado > 0; });
log(okB, '[B5] Y le responde: los dos quedan confirmados');
const hB = await B.page.evaluate(() => _bzId.huella);
const cB = await contactos(B);
log(cA[0].huella === hB && cB[0].huella === idA.huella,
  '[B6] Los dos ven el mismo código de seguridad de cada uno', idA.huella + ' · ' + hB);
const vacios = await esperar(async () => (await buzon(uA)).length === 0 && (await buzon(uB)).length === 0);
log(vacios, '[B7] Lo atendido se borra de los dos buzones');

/* Un tercero que ve el mismo código después: ya se gastó. */
const C = await telefono(); await abrir(C);
const uC = await crearCuenta(C, 'tercero@flagrante.test', 'Tercero Ajeno');
await enLinea(C);
await C.page.evaluate(async b => bzAgregarDesdeCodigo(Uint8Array.from(b)), cod.b);
await A.page.waitForTimeout(2500);
log((await contactos(A)).length === 1, '[B8] El código es de un solo uso: un segundo escaneo no agrega a nadie');
/* Un código caducado. */
const cad = await A.page.evaluate(async () => {
  const c = await bzNuevoCodigo();
  _bzInvit[_bzInvit.length - 1].exp = Date.now() - 10 * 60000;
  await _bzGuardarLocal();
  return Array.from(c.bytes);
});
await C.page.evaluate(async b => bzAgregarDesdeCodigo(Uint8Array.from(b)), cad);
await A.page.waitForTimeout(2500);
log((await contactos(A)).length === 1, '[B9] Un código caducado no agrega a nadie (una foto vieja no sirve)');
const propio = await A.page.evaluate(async () => { const c = await bzNuevoCodigo(); return bzAgregarDesdeCodigo(c.bytes); });
log(!propio.ok && /tuyo/.test(propio.motivo), '[B10] Escanear el propio lo dice', propio.motivo);
const ajeno = await A.page.evaluate(() => {
  const r = new Uint8Array(150); crypto.getRandomValues(r);
  return [bzLeerCodigo(r), bzLeerCodigo(new Uint8Array([70, 76, 71, 49]))];
});
log(ajeno[0] === null && ajeno[1] === null, '[B11] Un código que no es de un compañero se rechaza al leerlo');
const viajaA2 = await esperar(async () => (await contactos(A2)).some(c => c.uid === uB), 40000);
log(viajaA2, '[B12] El compañero pasa solo a los demás equipos de la cuenta (por la nube, cifrado)');

/* ═══ C · EL BUZÓN ════════════════════════════════════════════════════════ */
/* Un mensaje de un tipo que esta versión no atiende se queda en el buzón: así
   se puede mirar qué guarda Firestore. */
const MARCA = 'SECRETO-DEL-PROCEDIMIENTO-4521';
const midZ = await A.page.evaluate(async ([uid, m]) => bzEnviar(bzContacto(uid), 'zz', { texto: m }), [uB, MARCA]);
await B.page.waitForTimeout(1200);
const crudo = await leerDoc(`buzon/${uB}/m/${midZ}`);
const txt = JSON.stringify(crudo || {});
log(crudo && !txt.includes(MARCA) && crudo.fields.de.stringValue === uA,
  '[C1] Firestore guarda quién lo manda, nunca qué: el contenido no se lee');
const abre = await B.page.evaluate(async ([uid, mid, ct]) => {
  const con = bzContacto(uid);
  return [await _bzAbrir(con, 'zz', mid, ct), await _bzAbrir(con, 'zz', 'otro-id-cualquiera-123', ct), await _bzAbrir(con, 'hola', mid, ct)];
}, [uA, midZ, crudo.fields.ct.stringValue]);
log(abre[0] && abre[0].texto === MARCA, '[C2] El compañero lo abre');
log(abre[1] === null && abre[2] === null, '[C3] El mismo sobre movido a otro mensaje o a otro tipo no abre');
const abreC = await C.page.evaluate(async ([uidA, mid, ct, pub]) => {
  const con = { uid: uidA, pub };
  const k = await bzCanal(con);
  return !!(await cuDesenvolver(k, ct, _bzAad('zz', uidA, _bzId.uid, mid)));
}, [uA, midZ, crudo.fields.ct.stringValue, idA.pub]);
log(!abreC, '[C4] Otra cuenta, aun con la llave pública de A, no lo abre');
await borrarDoc(`buzon/${uB}/m/${midZ}`);

const reglas = await C.page.evaluate(async ([uA, uB]) => {
  const db = _cuFB.db, out = {};
  const prueba = async (k, f) => { try { await f(); out[k] = 'paso'; } catch (e) { out[k] = e.code || String(e); } };
  await prueba('leerBuzonAjeno', () => FB.getDocsFromServer(FB.collection(db, 'buzon', uA, 'm')));
  await prueba('suplantar', () => FB.setDoc(FB.doc(db, 'buzon', uB, 'm', 'suplantado-0123456789'),
    { v: 1, de: uA, t: 'hola', ct: 'x'.repeat(40), ts: FB.serverTimestamp() }));
  await prueba('llaveAjena', () => FB.getDocFromServer(FB.doc(db, 'users', uA, 'llaves', 'id')));
  /* Crear y cambiar, en el buzón de una cuenta que no escucha (si escuchara, lo
     borraría antes del segundo intento y este sería otra creación). */
  await prueba('crear', () => FB.setDoc(FB.doc(db, 'buzon', 'nadie-escucha-aqui', 'm', 'propio-0123456789ab'),
    { v: 1, de: _cuenta.uid, t: 'zz', ct: 'x'.repeat(40), ts: FB.serverTimestamp() }));
  await prueba('cambiar', () => FB.setDoc(FB.doc(db, 'buzon', 'nadie-escucha-aqui', 'm', 'propio-0123456789ab'),
    { v: 1, de: _cuenta.uid, t: 'zz', ct: 'y'.repeat(40), ts: FB.serverTimestamp() }));
  await prueba('campoExtra', () => FB.setDoc(FB.doc(db, 'buzon', uB, 'm', 'extra-0123456789abc'),
    { v: 1, de: _cuenta.uid, t: 'zz', ct: 'x'.repeat(40), ts: FB.serverTimestamp(), nombre: 'Juan' }));
  await prueba('ajenoAB', () => FB.setDoc(FB.doc(db, 'buzon', uB, 'm', 'ajeno-0123456789abcd'),
    { v: 1, de: _cuenta.uid, t: 'zz', ct: 'x'.repeat(40), ts: FB.serverTimestamp() }));
  return out;
}, [uA, uB]);
log(reglas.leerBuzonAjeno === 'permission-denied', '[C5] Nadie lee el buzón de otro', reglas.leerBuzonAjeno);
log(reglas.suplantar === 'permission-denied', '[C6] Nadie escribe a nombre de otro', reglas.suplantar);
log(reglas.llaveAjena === 'permission-denied', '[C7] Nadie lee la llave de identidad de otro', reglas.llaveAjena);
log(reglas.crear === 'paso' && reglas.cambiar === 'permission-denied' && reglas.campoExtra === 'permission-denied',
  '[C8] Se puede dejar un mensaje, pero no cambiarlo ni meterle campos sueltos', JSON.stringify(reglas));
/* Lo de quien no es compañero se borra sin abrirlo, y no agrega a nadie. */
const fueraB = await esperar(async () => !(await buzon(uB)).some(d => d.name.endsWith('ajeno-0123456789abcd')));
log(fueraB && (await contactos(B)).length === 1, '[C9] Lo que deja quien no es compañero se borra sin abrirse');

/* Quitar un compañero: lo que mande después ya no entra. */
await B.page.evaluate(async uid => bzQuitarContacto(uid), uA);
await A.page.evaluate(async uid => bzEnviar(bzContacto(uid), 'hola', { nom: 'PT Nelson David' }), uB);
const fueraQ = await esperar(async () => (await buzon(uB)).length === 0);
log(fueraQ && (await contactos(B)).length === 0, '[C10] Quitado el compañero, lo que mande se descarta');
/* Y se pueden volver a agregar. */
const cod2 = await A.page.evaluate(async () => Array.from((await bzNuevoCodigo()).bytes));
await B.page.evaluate(async b => bzAgregarDesdeCodigo(Uint8Array.from(b)), cod2);
const otraVez = await esperar(async () => (await contactos(B)).some(c => c.uid === uA && c.confirmado));
log(otraVez, '[C11] Se pueden volver a agregar con un código nuevo');

/* ═══ D · LO QUE SE VE ═══════════════════════════════════════════════════ */
await B.page.evaluate(() => { _ptUiPaso = 'inicio'; go('compartir'); });
await B.page.waitForTimeout(300);
const vista = await B.page.evaluate(() => {
  const c = document.getElementById('bz-companeros'), r = c ? c.getBoundingClientRect() : null;
  return { alto: r ? r.height : 0, txt: c ? c.innerText : '', btns: c ? c.querySelectorAll('.pt-op').length : 0 };
});
log(vista.alto > 80 && /Nelson/.test(vista.txt) && /seguridad/i.test(vista.txt) && vista.btns === 2,
  '[D1] «Mis compañeros» se ve en Modo compartir, con el compañero y su código de seguridad', Math.round(vista.alto) + ' px');
await B.page.evaluate(() => bzUiMostrar());
await B.page.waitForSelector('#cp-pane .pt-qr svg', { timeout: 10000 });
const qr = await B.page.evaluate(() => ({
  svg: !!document.querySelector('#cp-pane .pt-qr svg'),
  cuenta: (document.getElementById('bz-cuenta') || {}).textContent || '',
  txt: document.getElementById('cp-pane').innerText
}));
log(qr.svg && /Válido 4:5\d|Válido 5:00/.test(qr.cuenta), '[D2] Mostrar mi código: el código y cuánto le queda', qr.cuenta);
const textos = await B.page.evaluate(() => {
  const malos = [];
  document.querySelectorAll('#cp-pane p, #cp-pane .de, #cp-pane .cc-de, #cp-pane .bz-de').forEach(e => { if (e.innerText.length > 110) malos.push(e.innerText); });
  return malos;
});
await B.page.evaluate(() => bzUiCerrarCodigo());
const tecnicas = await B.page.evaluate(() => {
  const t = document.getElementById('cp-pane').innerText.toLowerCase();
  return ['firebase', 'firestore', 'servidor', 'ecdh', 'llave pública', 'uid', 'buzón'].filter(w => t.includes(w));
});
log(!textos.length && !tecnicas.length, '[D3] Textos cortos y sin una palabra técnica', JSON.stringify(textos.concat(tecnicas)));
const sinCuenta = await telefono(false); await abrir(sinCuenta);
const nada = await sinCuenta.page.evaluate(() => { _ptUiPaso = 'inicio'; go('compartir'); return { activa: bzActiva(), card: !!document.getElementById('bz-companeros') }; });
log(!nada.activa && !nada.card, '[D4] Sin cuenta no aparece (la pantalla de siempre)');

const reales = errs.filter(e => !/permission|PERMISSION_DENIED|Missing or insufficient/i.test(e));
log(!reales.length, '[D5] Consola sin errores (salvo los rechazos provocados en C)', reales.slice(0, 3).join(' | '));
} catch (e) {
  console.error(e);
  R.push(false);
} finally {
  await browser.close();
  server.close();
  apagar();
}
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
