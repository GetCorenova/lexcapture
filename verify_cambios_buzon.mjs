/* LOS CAMBIOS VUELVEN, CON AUTORIZACIÓN · compartir entre cuentas, paso 3 (2026-10-24).

   Una captura que se pasó por el buzón queda compartida. Lo que cualquiera de
   los dos guarde después le llega al otro, que ve un aviso breve y un resumen
   («Agregó…», «Editó…») y decide si lo aplica. Si los dos cambiaron lo mismo,
   se marca y por defecto se queda lo propio. Contra los EMULADORES de Firebase.

   G · el que recibe diligencia y le llega al que compartió, sin aplicarse.
   H · en los dos sentidos.   I · los dos cambiaron lo mismo.
   J · descartar, quién firma, y lo que no entra.   K · la pantalla. */
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
await new Promise(r => server.listen(8176, r));
const URL = 'http://localhost:8176/LexCapture_v8.html';

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

async function espiar(t) {
  await t.page.evaluate(() => {
    window.__toasts = [];
    const f = window.toast;
    window.toast = function (m) { window.__toasts.push(String(m)); return f.apply(this, arguments); };
  });
}
const dichos = t => t.page.evaluate(() => (window.__toasts || []).join(' | '));
const bandeja = t => t.page.evaluate(() => _bzBandeja.map(x => ({ k: x.k, tipo: x.tipo, id: x.id, nom: x.nom, n: x.n, mids: x.mids.length })));
const caso = (t, id) => t.page.evaluate(id => JSON.parse(JSON.stringify(DB.getCase(id))), id);
async function emparejar(X, Y, uX, uY) {
  const b = await X.page.evaluate(async () => Array.from((await bzNuevoCodigo()).bytes));
  await Y.page.evaluate(async b => bzAgregarDesdeCodigo(Uint8Array.from(b)), b);
  return esperar(async () => (await contactos(X)).some(c => c.uid === uY && c.confirmado) &&
                             (await contactos(Y)).some(c => c.uid === uX && c.confirmado), 30000);
}
async function pulsar(t, texto) {
  await t.page.evaluate(tx => {
    const b = [...document.querySelectorAll('#modal-c button')].find(x => x.innerText.trim() === tx);
    if (!b) throw new Error('no está el botón «' + tx + '»');
    b.click();
  }, texto);
}
/* Un guardado del funcionario: por DB.saveCase, como el formulario y las actas. */
async function editar(t, id, fn) {
  await t.page.evaluate('(async () => { const c = JSON.parse(JSON.stringify(DB.getCase(' + JSON.stringify(id) + '))); (' + fn.toString() + ')(c); await DB.saveCase(c); })()');
}
const pendienteUpd = async (t, id) => (await bandeja(t)).filter(x => x.tipo === 'upd' && x.id === id);
const modal = t => t.page.evaluate(() => document.getElementById('modal-c').innerText);

try {
const A = await telefono(); await abrir(A);
const uA = await crearCuenta(A, 'nelson@flagrante.test', 'Nelson David');
await enLinea(A);
const B = await telefono(); await abrir(B);
const uB = await crearCuenta(B, 'luz@flagrante.test', 'Luz Marín');
await enLinea(B);
log(await emparejar(A, B, uA, uB), '[P1] Los dos quedan agregados y confirmados');
for (const t of [A, B]) await espiar(t);

await A.page.evaluate(async () => {
  await DB.saveCases([{ id: 'cas-1', tipo: 'URI', fechaProc: '2026-10-24', created: Date.now(),
    capturados: [{ id: 'cap-1', priNom: 'JUAN', priApe: 'PÉREZ', tipoDoc: 'CC', numDoc: '71000111' }],
    victimas: [{ id: 'vic-1', priNom: 'MARÍA', priApe: 'GÓMEZ', tipoDoc: 'CC', numDoc: '43111222', tel: '3001111111' }],
    testigos: [], elementos: [], actas: [], lugar: { muni: 'Medellín', barrio: 'Centro' },
    servidor: { nombre: 'NELSON DAVID' }, narracion: { texto: 'Relato inicial' } }]);
  await bzEnviarRegistros(bzContactos()[0].uid, [], DB.getCases());
});
await esperar(async () => (await bandeja(B)).some(x => x.tipo === 'reg'));
const kR = (await bandeja(B)).find(x => x.tipo === 'reg').k;
await B.page.evaluate(k => bzUiRevisar(k), kR);
await B.page.waitForSelector('#modal.open');
await pulsar(B, 'Importar');
await esperar(async () => !!(await caso(B, 'cas-1')));
const cA = await caso(A, 'cas-1'), cB = await caso(B, 'cas-1');
log(cA.bzc && cA.bzc[uB] && cB.bzc && cB.bzc[uA] && cA.bzc[uB].b.victimas[0].tel === '3001111111',
  '[V1] Al enviar y aceptar, la captura queda compartida en los dos con lo que tienen en común');
log(cA.bzc[uB].b && !('bzc' in cA.bzc[uB].b), '[V1b] La base no se guarda dentro de sí misma');
await esperar(async () => (await buzon(uA)).length === 0 && (await buzon(uB)).length === 0);

/* ═══ G · B diligencia después, y le llega a A sin aplicarse ═══════════════ */
await editar(B, 'cas-1', c => {
  c.victimas[0].tel = '3009999999';
  c.actas = [{ personaId: 'cap-1', obs: 'Se le leyeron los derechos', updated: Date.now() }];
});
const llego = await esperar(async () => (await pendienteUpd(A, 'cas-1')).length === 1, 30000);
log(llego, '[G1] Lo que el otro guarda le llega a quien compartió');
log((await caso(A, 'cas-1')).victimas[0].tel === '3001111111' && !(await caso(A, 'cas-1')).actas.length,
  '[G2] Y NO se aplica solo: la captura de aquí no cambió');
const docs = await buzon(uA);
log(docs.length >= 1 && !JSON.stringify(docs).includes('3009999999') && !JSON.stringify(docs).includes('derechos'),
  '[G3] Viaja cifrado: Firestore no ve ni el teléfono ni el acta');
const ent = (await pendienteUpd(A, 'cas-1'))[0];
log(ent.n && !('bzc' in ent.n), '[G4] Lo que viaja no lleva las bases del otro');
log((await caso(B, 'cas-1')).bzc[uA].b.victimas[0].tel === '3009999999', '[G5] Quien envió deja como base lo que mandó');
log(/hizo cambios en la captura de JUAN PÉREZ/.test(await dichos(A)), '[G6] Aviso breve al llegar', (await dichos(A)).slice(-90));
const vista = await A.page.evaluate(() => {
  go('capturas'); renderCases();
  const av = document.querySelector('.bz-aviso'), bd = document.querySelector('.b-bzcam');
  return { av: av ? av.innerText : '', alto: av ? av.getBoundingClientRect().height : 0, bd: !!bd,
           cnt: (document.getElementById('bz-cnt-nav') || {}).textContent };
});
log(vista.alto > 30 && /hizo cambios en 1 captura/.test(vista.av) && vista.bd && vista.cnt === '1',
  '[G7] En Capturas: el aviso arriba, la insignia en la tarjeta y el contador del menú', vista.av.replace(/\n/g, ' · '));

await A.page.evaluate(k => bzUiRevisarCambios(k), ent.k);
await A.page.waitForSelector('#modal.open');
const m1 = await modal(A);
log(/Agregó el acta de derechos de JUAN PÉREZ/.test(m1) && /Editó el teléfono de la víctima MARÍA GÓMEZ/.test(m1),
  '[G8] El resumen dice qué agregó y qué editó, con nombres', m1.replace(/\n/g, ' · ').slice(0, 200));
log(!/otros datos|updated|bzc/i.test(m1) && !/Los dos lo cambiaron/.test(m1), '[G9] Sin ruido: ni sellos ni conflictos inventados');
await pulsar(A, 'Ahora no');
await A.page.waitForTimeout(300);
log((await pendienteUpd(A, 'cas-1')).length === 1 && (await caso(A, 'cas-1')).victimas[0].tel === '3001111111',
  '[G10] «Ahora no» lo deja pendiente y no cambia nada');
await A.page.evaluate(() => { wc = { id: 'cas-1' }; });
await A.page.evaluate(k => bzUiRevisarCambios(k), ent.k);
await A.page.waitForSelector('#modal.open');
await pulsar(A, 'Aplicar');
await A.page.waitForTimeout(400);
log((await caso(A, 'cas-1')).victimas[0].tel === '3001111111' && /Cierra la captura/.test(await dichos(A)),
  '[G11] Con la captura abierta en el formulario no se aplica, y lo dice');
await A.page.evaluate(() => { wc = null; closeModal(); });
await A.page.evaluate(k => bzUiRevisarCambios(k), ent.k);
await A.page.waitForSelector('#modal.open');
await pulsar(A, 'Aplicar');
const aplicado = await esperar(async () => (await caso(A, 'cas-1')).victimas[0].tel === '3009999999');
const cA2 = await caso(A, 'cas-1');
log(aplicado && cA2.actas.length === 1 && cA2.actas[0].obs === 'Se le leyeron los derechos',
  '[G12] Al aplicar entran el teléfono y el acta');
log(await esperar(async () => (await buzon(uA)).length === 0 && (await bandeja(A)).length === 0),
  '[G13] Se borra del buzón y de «Por revisar»');
log(cA2.bzc[uB].b.victimas[0].tel === '3009999999', '[G14] La base de A pasa a ser lo que ya tienen en común');
await A.page.waitForTimeout(4000);
log((await buzon(uB)).length === 0, '[G15] Lo aplicado no vuelve en eco al otro');
await editar(A, 'cas-1', c => {});
await A.page.waitForTimeout(4000);
log((await buzon(uB)).length === 0, '[G16] Guardar sin cambiar nada no manda nada');

/* ═══ H · En los dos sentidos ═══════════════════════════════════════════════ */
await editar(A, 'cas-1', c => { c.lugar.barrio = 'La Candelaria'; });
const vuelta = await esperar(async () => (await pendienteUpd(B, 'cas-1')).length === 1, 30000);
log(vuelta && (await caso(B, 'cas-1')).lugar.barrio === 'Centro', '[H1] La corrección de quien compartió le llega al otro, pendiente');
const kH = (await pendienteUpd(B, 'cas-1'))[0].k;
await B.page.evaluate(k => bzUiRevisarCambios(k), kH);
await B.page.waitForSelector('#modal.open');
log(/Editó el lugar de los hechos/.test(await modal(B)), '[H2] El resumen nombra el apartado');
await pulsar(B, 'Aplicar');
log(await esperar(async () => (await caso(B, 'cas-1')).lugar.barrio === 'La Candelaria'), '[H3] Y lo aplica');

/* ═══ I · Los dos cambiaron lo mismo ═══════════════════════════════════════ */
await editar(A, 'cas-1', c => { c.victimas[0].tel = '3002222222'; });
await esperar(async () => (await pendienteUpd(B, 'cas-1')).length === 1, 30000);
await editar(B, 'cas-1', c => { c.victimas[0].tel = '3003333333'; });
await esperar(async () => (await pendienteUpd(A, 'cas-1')).length === 1, 30000);
const kI = (await pendienteUpd(B, 'cas-1'))[0].k;
await B.page.evaluate(k => bzUiRevisarCambios(k), kI);
await B.page.waitForSelector('#modal.open');
const m2 = await modal(B);
log(/Los dos lo cambiaron/.test(m2) && /Tuyo: «3003333333» · Suyo: «3002222222»/.test(m2) && /Si no eliges, se queda lo tuyo/.test(m2),
  '[I1] Se marca el choque, con lo de cada uno', m2.replace(/\n/g, ' · ').slice(0, 220));
await pulsar(B, 'Aplicar');
await B.page.waitForTimeout(800);
log((await caso(B, 'cas-1')).victimas[0].tel === '3003333333', '[I2] Por defecto se queda lo propio');
const kI2 = (await pendienteUpd(A, 'cas-1'))[0].k;
await A.page.evaluate(k => bzUiRevisarCambios(k), kI2);
await A.page.waitForSelector('#modal.open');
await A.page.evaluate(() => { const b = [...document.querySelectorAll('.cf-op')].find(x => x.dataset.v === 'suyo'); b.click(); });
await pulsar(A, 'Aplicar');
log(await esperar(async () => (await caso(A, 'cas-1')).victimas[0].tel === '3003333333'), '[I3] Y se puede tomar lo del otro');
await A.page.waitForTimeout(4000);
log((await pendienteUpd(A, 'cas-1')).length === 0 && (await pendienteUpd(B, 'cas-1')).length === 0,
  '[I4] Tras resolver, ninguno de los dos queda con nada pendiente');

/* ═══ J · Descartar, quién firma y lo que no entra ════════════════════════ */
await editar(A, 'cas-1', c => { c.narracion.texto = 'Relato corregido por A'; });
await esperar(async () => (await pendienteUpd(B, 'cas-1')).length === 1, 30000);
const kJ = (await pendienteUpd(B, 'cas-1'))[0].k;
await B.page.evaluate(k => bzUiRevisarCambios(k), kJ);
await B.page.waitForSelector('#modal.open');
await pulsar(B, 'Descartar');
await B.page.waitForTimeout(800);
log((await caso(B, 'cas-1')).narracion.texto === 'Relato inicial' && (await pendienteUpd(B, 'cas-1')).length === 0 &&
    await esperar(async () => (await buzon(uB)).length === 0), '[J1] Descartar no cambia nada y lo saca del buzón');
await editar(B, 'cas-1', c => { c.servidor = { nombre: 'LUZ MARIN' }; });
await A.page.waitForTimeout(6000);
log((await caso(A, 'cas-1')).servidor.nombre === 'NELSON DAVID' && (await pendienteUpd(A, 'cas-1')).length === 0,
  '[J2] Quién suscribe no viaja: cambiar el servidor allá no le propone nada aquí');
await B.page.evaluate(async uA => {
  const con = bzContacto(uA);
  await _bzEncolarObjeto(con, 'upd', { id: 'no-esta', b: { id: 'no-esta', capturados: [] }, n: { id: 'no-esta', capturados: [{ id: 'x' }] } }, {});
}, uA);
await A.page.waitForTimeout(5000);
log(!(await caso(A, 'no-esta')) && (await bandeja(A)).length === 0 && (await buzon(uA)).length === 0,
  '[J3] Un cambio nunca crea una captura que aquí no está');

/* ═══ K · La pantalla ══════════════════════════════════════════════════════ */
await editar(B, 'cas-1', c => { c.testigos = [{ id: 'tes-1', priNom: 'PEDRO', priApe: 'RUIZ' }]; });
await esperar(async () => (await pendienteUpd(A, 'cas-1')).length === 1, 30000);
const pant = await A.page.evaluate(() => {
  _ptUiPaso = 'inicio'; go('compartir');
  const c = document.getElementById('bz-pendientes');
  const malos = []; document.querySelectorAll('#cp-pane .bz-de, #cp-pane .bz-nom, #cp-pane p').forEach(e => { if (e.innerText.length > 110) malos.push(e.innerText); });
  const t = document.getElementById('cp-pane').innerText.toLowerCase();
  return { txt: c ? c.innerText : '', malos: malos.concat(['firebase', 'firestore', 'servidor', 'uid', 'buzón', 'base'].filter(w => t.includes(w))) };
});
log(/Cambios de PT Luz Marín/.test(pant.txt) && /Agregó el testigo PEDRO RUIZ/.test(pant.txt), '[K1] En «Por revisar» se ve quién cambió qué', pant.txt.replace(/\n/g, ' · '));
log(!pant.malos.length, '[K2] Textos cortos y sin palabras técnicas', JSON.stringify(pant.malos));
const exp = await A.page.evaluate(() => { abrirDossierCaso('cas-1'); const e = document.querySelector('.bz-exp-cam'); return e ? e.innerText : ''; });
log(/hizo cambios/.test(exp) && /Revisar los cambios/.test(exp), '[K3] Y en el expediente de la captura', exp.replace(/\n/g, ' · '));
await A.page.waitForTimeout(700);
await A.page.screenshot({ path: join(ROOT, 'verify_cambios_buzon_exp.png') });
await A.page.evaluate(() => go('capturas'));
await A.page.waitForTimeout(700);
await A.page.screenshot({ path: join(ROOT, 'verify_cambios_buzon.png') });
await A.page.evaluate(k => bzUiRevisarCambios(k), (await pendienteUpd(A, 'cas-1'))[0].k);
await A.page.waitForSelector('#modal.open');
await A.page.waitForTimeout(500);
await A.page.screenshot({ path: join(ROOT, 'verify_cambios_buzon_modal.png') });
await A.page.evaluate(() => closeModal());
const reales = errs.filter(e => !/permission|PERMISSION_DENIED|Missing or insufficient|net::ERR|offline/i.test(e));
log(!reales.length, '[K4] Consola sin errores', reales.slice(0, 3).join(' | '));
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
