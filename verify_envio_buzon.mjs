/* ENVIAR A UN COMPAÑERO · compartir entre cuentas, paso 2 (2026-10-24).

   Se marcan personas y capturas y se pulsa «Enviar a X». Viaja por el buzón,
   cifrado de un teléfono al otro, y del otro lado queda POR REVISAR: nada se
   guarda hasta que lo acepte con la revisión de siempre. Contra los EMULADORES
   de Firebase (Auth + Firestore), que la suite arranca y apaga. Cada contexto
   de navegador es un teléfono; hay dos equipos de cada cuenta.

   E · enviar desde la pantalla, revisar («Ahora no» / «Importar»), el acuse.
   F · un envío grande, partido en pedazos.
   G · sin señal: la cola, que sobrevive a cerrar la app, y descartar.
   H · lo que no entra: de quien no es compañero, y un envío incompleto.
   I · la pantalla. */
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
await new Promise(r => server.listen(8175, r));
const URL = 'http://localhost:8175/LexCapture_v8.html';

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

/* Lo que la app dice en pantalla, para poder comprobarlo. */
async function espiar(t) {
  await t.page.evaluate(() => {
    window.__toasts = [];
    const f = window.toast;
    window.toast = function (m) { window.__toasts.push(String(m)); return f.apply(this, arguments); };
  });
}
const dichos = t => t.page.evaluate(() => (window.__toasts || []).join(' | '));
const bandeja = t => t.page.evaluate(() => _bzBandeja.map(x => ({ k: x.k, nom: x.nom, p: x.abierto.personas.length, c: x.abierto.casos.length })));
const salidaDe = t => t.page.evaluate(() => _bzSalida.map(x => ({ e: x.e, estado: x.estado, oculto: !!x.oculto, n: (x.partes || []).length })));
const cuantos = t => t.page.evaluate(() => ({ p: DB.getPersons().length, c: DB.getCases().length }));
async function emparejar(X, Y, uX, uY) {
  const b = await X.page.evaluate(async () => Array.from((await bzNuevoCodigo()).bytes));
  await Y.page.evaluate(async b => bzAgregarDesdeCodigo(Uint8Array.from(b)), b);
  return esperar(async () => (await contactos(X)).some(c => c.uid === uY && c.confirmado) &&
                             (await contactos(Y)).some(c => c.uid === uX && c.confirmado), 30000);
}
/* Pulsa un botón del diálogo por su texto. */
async function pulsar(t, texto) {
  await t.page.evaluate(tx => {
    const b = [...document.querySelectorAll('#modal-c button')].find(x => x.innerText.trim() === tx);
    if (!b) throw new Error('no está el botón «' + tx + '»');
    b.click();
  }, texto);
}

try {
/* ═══ PREPARACIÓN: dos compañeros, y un segundo equipo de cada cuenta ════ */
const A = await telefono(); await abrir(A);
const uA = await crearCuenta(A, 'nelson@flagrante.test', 'Nelson David');
await enLinea(A);
const B = await telefono(); await abrir(B);
const uB = await crearCuenta(B, 'luz@flagrante.test', 'Luz Marín');
await enLinea(B);
const par = await emparejar(A, B, uA, uB);
log(par, '[P1] Los dos quedan agregados y confirmados');
const A2 = await telefono(); await abrir(A2); await entrar(A2, 'nelson@flagrante.test'); await enLinea(A2);
const B2 = await telefono(); await abrir(B2); await entrar(B2, 'luz@flagrante.test'); await enLinea(B2);
for (const t of [A, B, A2, B2]) await espiar(t);

const SECRETO = 'NARRACION-SECRETA-7781';
await A.page.evaluate(async s => {
  await DB.savePersons([{ id: 'per-1', priNom: 'MARÍA', priApe: 'GÓMEZ', tipoDoc: 'CC', numDoc: '43111222', tel: '3001234567' }]);
  await DB.saveCases([{ id: 'cas-1', tipo: 'URI', fechaProc: '2026-10-24', created: Date.now(),
    capturados: [{ id: 'cap-1', priNom: 'JUAN', priApe: 'PÉREZ', tipoDoc: 'CC', numDoc: '71000111' }],
    victimas: [], testigos: [], elementos: [], narracion: { texto: s } }]);
}, SECRETO);

/* ═══ E · ENVIAR, REVISAR, ACEPTAR (por «Enviar a», desde Capturas) ══════ */
await A.page.evaluate(() => { go('capturas'); });
await A.page.waitForSelector('#ev-capturas .ev-chip.ok');
const chip = await A.page.evaluate(() => document.querySelector('#ev-capturas .ev-chip.ok').innerText.trim());
await A.page.click('#ev-capturas .ev-chip.ok');
const antes = await A.page.evaluate(() => { const b = document.querySelector('#ev-capturas .ev-sel .bp'); return { txt: document.querySelector('#ev-capturas .ev-sel').innerText, dis: b.disabled }; });
log(chip === 'Luz MARÍN' && /Enviar a Luz MARÍN/.test(antes.txt) && antes.dis,
  '[E1] Tocar al vinculado abre la selección sobre la lista, con «Enviar» apagado mientras no haya nada marcado', chip);
await A.page.click('#cl [data-ev="cas-1"] .cc');
const marcado = await A.page.evaluate(() => { const b = document.querySelector('#ev-capturas .ev-sel .bp'); return { txt: b.innerText, dis: b.disabled }; });
log(/Enviar \(1\)/.test(marcado.txt) && !marcado.dis, '[E2] Al marcar, el botón dice cuántas van', marcado.txt);
const chunks0 = [];
await A.page.click('#ev-capturas .ev-sel .bp');
const llego = await esperar(async () => (await bandeja(B)).length === 1);
const docs = await buzon(uB);
const crudo = JSON.stringify(docs);
log(llego && docs.length === 1 && docs[0].fields.t.stringValue === 'env' &&
    !crudo.includes(SECRETO) && !crudo.includes('71000111') && !crudo.includes('PÉREZ'),
  '[E3] Viaja por el buzón y Firestore no ve el contenido (ni nombres, ni documentos, ni el relato)');
chunks0.push(...docs);
log((await cuantos(B)).p === 0 && (await cuantos(B)).c === 0, '[E4] Al llegar NO se guarda nada todavía');
const vB = await B.page.evaluate(() => {
  go('capturas');
  const av = document.querySelector('#cl .ev-llego'), n = document.getElementById('bz-cnt-nav'), pt = document.getElementById('bz-punto');
  evGestionar('c');
  const c = document.getElementById('bz-pendientes');
  return { av: av ? av.innerText : '', txt: c ? c.innerText : '', alto: c ? c.getBoundingClientRect().height : 0,
           cnt: n ? n.textContent : '', vis: n ? n.style.display !== 'none' : false, punto: pt ? pt.style.display !== 'none' : false };
});
await B.page.evaluate(() => closeModal());
log(/Nelson DAVID te envió 1 captura/.test(vB.av) && vB.alto > 60 && /De Nelson DAVID/.test(vB.txt) && /1 captura/.test(vB.txt) && /Revisar/.test(vB.txt) && vB.cnt === '1' && vB.vis && vB.punto,
  '[E5] Al otro le sale el aviso encima de Capturas, «Por revisar» en el panel y el contador en Capturas', vB.av.replace(/\n/g, ' · '));
log(/Te llegó de Nelson DAVID: 1 captura/.test(await dichos(B)), '[E6] Y un aviso breve al llegar', (await dichos(B)).slice(0, 90));
log((await bandeja(B2)).length === 1, '[E7] Lo ve también su otro equipo (la bandeja es el propio buzón)');
const envA = await A.page.evaluate(() => { evGestionar('c'); const c = document.getElementById('bz-enviados'); const t = c ? c.innerText : ''; closeModal(); return t; });
log(/A Luz MARÍN/.test(envA) && /Esperando que lo revise/.test(envA), '[E8] Quien envió ve «Esperando que lo revise»');

const k = (await bandeja(B))[0].k;
await B.page.click('#cl .ev-llego');
await B.page.waitForSelector('#modal.open');
const modal = await B.page.evaluate(() => document.getElementById('modal-c').innerText);
log(/Revisa lo que llegó/.test(modal) && /Nada se guarda hasta que lo aceptes/.test(modal) && /Ahora no/.test(modal),
  '[E9] El aviso abre la revisión de siempre, con «Ahora no»');
await pulsar(B, 'Ahora no');
await B.page.waitForTimeout(400);
log((await bandeja(B)).length === 1 && (await cuantos(B)).c === 0, '[E10] «Ahora no» lo deja por revisar y no guarda nada');
await B.page.evaluate(k => bzUiRevisar(k), k);
await B.page.waitForSelector('#modal.open');
await pulsar(B, 'Importar');
const guardado = await esperar(async () => (await cuantos(B)).c === 1);
const datos = await B.page.evaluate(() => ({ cap: DB.getCases()[0].capturados[0].numDoc, rel: DB.getCases()[0].narracion.texto }));
log(guardado && datos.cap === '71000111' && datos.rel === SECRETO, '[E11] Al importar, entra la captura íntegra');
const vacio = await esperar(async () => (await buzon(uB)).length === 0);
log(vacio, '[E12] Los pedazos se borran del buzón');
const fueB2 = await esperar(async () => (await bandeja(B2)).length === 0);
log(fueB2, '[E13] Y desaparece de «Por revisar» en su otro equipo');
const sinCnt = await B.page.evaluate(() => document.getElementById('bz-cnt-nav').style.display === 'none' && !document.querySelector('#cl .ev-llego'));
log(sinCnt, '[E14] El contador y el aviso se apagan');
const acuse = await esperar(async () => (await salidaDe(A)).filter(x => !x.oculto).length === 0);
log(acuse && /Luz MARÍN importó 1 registro/.test(await dichos(A)), '[E15] A quien envió le llega el acuse: «importó 1 registro»', (await dichos(A)).slice(-80));
log(await esperar(async () => (await buzon(uA)).length === 0), '[E16] El acuse lo atiende el equipo que envió, no el otro de su cuenta');

/* Un pedazo que reaparece (el borrado no alcanzó a salir): no vuelve a pedir revisión. */
const f0 = chunks0[0];
const rp = await fetch(`${FS}/v1/${f0.name}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: f0.fields }) });
/* Se espera a que los dos equipos de B lo hayan visto antes de mirar. */
await B.page.waitForTimeout(4000);
const reBorrado = rp.ok && await esperar(async () => (await buzon(uB)).length === 0);
log(reBorrado && (await bandeja(B)).length === 0 && (await bandeja(B2)).length === 0 && (await cuantos(B)).c === 1,
  '[E17] Un envío ya atendido que reaparece se borra solo y no se importa dos veces');

/* ═══ F · UN ENVÍO GRANDE, EN PEDAZOS ═══════════════════════════════════ */
const grande = await A.page.evaluate(async () => {
  const rel = i => Array.from({ length: 6000 }, (_, j) => 'Renglón ' + i + '.' + j + ' del relato largo').join(' ');
  const cs = [];
  for (let i = 0; i < 6; i++) cs.push({ id: 'big-' + i, tipo: 'URI', fechaProc: '2026-10-23', created: Date.now() - i,
    capturados: [{ id: 'bc-' + i, priNom: 'CAPTURADO', priApe: 'NUMERO ' + i }], victimas: [], testigos: [], narracion: { texto: rel(i) } });
  const todos = DB.getCases().concat(cs);
  await DB.saveCases(todos);
  const r = await bzEnviarRegistros(_bzContacto0(), [], cs);
  return { r, largos: cs.map(c => c.narracion.texto.length) };
  function _bzContacto0() { return bzContactos()[0].uid; }
});
log(grande.r.ok && grande.r.partes >= 3, '[F1] Lo que no cabe en un mensaje se parte en pedazos', grande.r.partes + ' pedazos');
const docsF = await esperar(async () => (await bandeja(B)).length === 1, 40000);
const tamF = (await buzon(uB)).map(d => d.fields.ct.stringValue.length);
log(docsF && tamF.every(n => n < 900000), '[F2] Del otro lado se juntan; cada pedazo cabe en un documento', Math.max(...tamF, 0) + ' caracteres el mayor');
const kF = (await bandeja(B))[0].k;
await B.page.evaluate(k => bzUiRevisar(k), kF);
await B.page.waitForSelector('#modal.open');
await pulsar(B, 'Importar');
const okF = await esperar(async () => (await cuantos(B)).c === 7);
const largosB = await B.page.evaluate(() => DB.getCases().filter(c => /^big-/.test(c.id)).sort((a, b) => a.id < b.id ? -1 : 1).map(c => c.narracion.texto.length));
log(okF && JSON.stringify(largosB) === JSON.stringify(grande.largos), '[F3] Las seis capturas llegan enteras, letra por letra');
await esperar(async () => (await salidaDe(A)).filter(x => !x.oculto).length === 0);

/* ═══ G · SIN SEÑAL ══════════════════════════════════════════════════════ */
await A.page.evaluate(async () => {
  await DB.savePersons(DB.getPersons().concat([{ id: 'per-2', priNom: 'PEDRO', priApe: 'RUIZ', tipoDoc: 'CC', numDoc: '9800777' }]));
});
await A.ctx.setOffline(true);
const off = await A.page.evaluate(async () => {
  const r = await bzEnviarRegistros(bzContactos()[0].uid, DB.getPersons().filter(p => p.id === 'per-2'), []);
  evGestionar('c');
  const txt = (document.getElementById('bz-enviados') || {}).innerText || '';
  closeModal();
  return { r, onLine: navigator.onLine, txt };
});
await A.page.waitForTimeout(2500);
log(off.r.ok && !off.onLine && /Sin señal: sale cuando vuelva/.test(off.txt) && (await buzon(uB)).length === 0,
  '[G1] Sin señal se puede enviar igual: queda esperando y lo dice');
const persiste = await A.page.evaluate(async () => {
  _bzSalida = []; _bzLocalUid = '';                 // como si la app se hubiera cerrado
  await _bzCargarLocal();
  return _bzSalida.filter(x => !x.oculto && x.estado === 'cola').length;
});
log(persiste === 1, '[G2] Cerrar la aplicación no lo pierde: la cola vive en el equipo');
const colaCifrada = await A.page.evaluate(async uid => { const v = await lcIdbGet('bzo|' + uid); return typeof v === 'string' && !v.includes('9800777') && !v.includes('PEDRO'); }, uA);
log(colaCifrada, '[G3] Y va cifrada');
await A.ctx.setOffline(false);
await A.page.evaluate(() => window.dispatchEvent(new Event('online')));
const salio = await esperar(async () => (await bandeja(B)).length === 1, 90000);
log(salio, '[G4] Al volver la señal sale solo');
const kG = (await bandeja(B))[0].k;
await B.page.evaluate(k => bzUiDescartar(k), kG);
await B.page.waitForSelector('#modal.open');
await pulsar(B, 'Descartar');
const descartado = await esperar(async () => (await buzon(uB)).length === 0 && (await bandeja(B)).length === 0);
log(descartado && !(await B.page.evaluate(() => DB.getPersons().some(p => p.id === 'per-2'))),
  '[G5] Descartar no guarda nada y lo saca del buzón');
const avisoNo = await esperar(async () => /no importó lo que le enviaste/.test(await dichos(A)));
log(avisoNo, '[G6] Y a quien envió se le dice que no lo importó');

/* ═══ H · LO QUE NO ENTRA ════════════════════════════════════════════════ */
const C = await telefono(); await abrir(C);
await crearCuenta(C, 'tercero@flagrante.test', 'Tercero Ajeno');
await enLinea(C);
await C.page.evaluate(async uB => _bzEscribir(uB, { t: 'env', ct: 'x'.repeat(60) }, 'ajeno-env-0123456789'), uB);
const fueraC = await esperar(async () => !(await buzon(uB)).some(d => d.name.endsWith('ajeno-env-0123456789')), 60000);   // un desconocido se espera BZ_DESC_ESPERA antes de borrarse
log(fueraC && (await bandeja(B)).length === 0, '[H1] Un envío de quien no es compañero se borra sin abrirse');
/* Un envío al que le falta un pedazo: se ve «Llegando…» y a la semana se descarta. */
const mitad = await A.page.evaluate(async uB => {
  const con = bzContacto(uB), mid = _bzMid();
  const ct = await cuEnvolver(await bzCanal(con), _cuTE(JSON.stringify({ e: 'mitad-0123456789', i: 0, n: 2, d: btoa('{"a":') })),
                              _bzAad('env', _bzId.uid, uB, mid));
  return { mid, ct };
}, uB);
await escribirDoc(`buzon/${uB}/m/${mitad.mid}`, { v: { integerValue: '1' }, de: { stringValue: uA }, t: { stringValue: 'env' },
  ct: { stringValue: mitad.ct }, ts: { timestampValue: new Date(Date.now() - 8 * DIA).toISOString() } });
const llegando = await esperar(async () => B.page.evaluate(() => { evGestionar('c'); const si = /Llegando… 1 de 2/.test(document.getElementById('ev-gest').innerText); closeModal(); return si; }));
log(llegando, '[H2] Mientras faltan pedazos se ve «Llegando…», sin nada que aceptar');
await B.page.evaluate(() => _bzLimpiarPartes());
const limpio = await esperar(async () => !(await buzon(uB)).some(d => d.name.endsWith(mitad.mid)));
log(limpio && (await bandeja(B)).length === 0, '[H3] A la semana, lo que nunca se completó se descarta');
const sinRoto = (await contactos(B)).find(c => c.uid === uA);
log(sinRoto && !sinRoto.roto, '[H4] Nada de esto marca al compañero como «llaves cambiaron»');

/* ═══ I · LA PANTALLA ════════════════════════════════════════════════════ */
await A.page.evaluate(async () => { await bzUiEnviar(bzContactos()[0].uid, DB.getPersons().filter(p => p.id === 'per-1'), []); });
await esperar(async () => (await bandeja(B)).length === 1);
await B.page.evaluate(() => { go('personas'); evGestionar('p'); });
const malos = await B.page.evaluate(() => {
  const m = [];
  document.querySelectorAll('#ev-gest p, #ev-gest .de, #ev-gest .bz-de, #ev-gest .bz-nom, .ev-llego').forEach(e => { if (e.innerText.length > 110) m.push(e.innerText); });
  const t = (document.getElementById('ev-gest').innerText + ' ' + document.getElementById('pl').innerText).toLowerCase();
  return m.concat(['firebase', 'firestore', 'servidor', 'uid', 'buzón', 'pedazo', 'cifrad'].filter(w => t.includes(w)));
});
log(!malos.length, '[I1] Textos cortos y sin palabras técnicas', JSON.stringify(malos));
const anchoOk = await B.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
log(anchoOk, '[I2] Sin desborde horizontal en el teléfono');
const mas = await B.page.evaluate(() => { closeModal(); const a = document.querySelector('#pl .ev-llego'); return a ? a.innerText : ''; });
log(/Nelson DAVID te envió 1 persona/.test(mas), '[I3] El aviso también sale encima de Personas', mas.replace(/\n/g, ' · '));
await B.page.screenshot({ path: join(ROOT, 'verify_envio_buzon.png'), fullPage: true });
const sinCuenta = await telefono(false); await abrir(sinCuenta);
const nada = await sinCuenta.page.evaluate(() => { go('capturas'); evGestionar('c'); return !document.getElementById('bz-pendientes') && !document.querySelector('.ev-llego') && !document.querySelector('.ev-chip.ok'); });
log(nada, '[I4] Sin cuenta no aparece nada de esto');
const reales = errs.filter(e => !/permission|PERMISSION_DENIED|Missing or insufficient|ERR_INTERNET_DISCONNECTED|net::ERR|offline/i.test(e));
log(!reales.length, '[I5] Consola sin errores (salvo los provocados)', reales.slice(0, 3).join(' | '));
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
