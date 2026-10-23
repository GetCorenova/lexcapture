/* LA NUBE · F4 del plan de cuenta (2026-10-23).

   Toda la información de la cuenta —capturas, personas, firmas y ajustes— viaja
   registro por registro a Firestore, cifrada de extremo a extremo, y aparece en
   cualquier equipo donde se inicie sesión. Esta suite la ejerce entera contra los
   EMULADORES de Firebase (Auth + Firestore), que arranca y apaga ella misma.
   Cada contexto de navegador es un teléfono (su almacenamiento, su llave).

   A · un equipo con datos crea la cuenta y lo sube todo; Firestore no tiene texto legible.
   B · otro equipo entra y lo baja; los cambios llegan en vivo; correcciones y
       borrados no se revierten; conflictos y cambios en campos distintos.
   C · sin señal: lo pendiente sube al volver, también tras cerrar la app.
   D · la captura abierta en el formulario no se pisa.
   R · reglas: otra cuenta, plan vencido, versión, forma del documento; sobres
       movidos de sitio o de versión no abren.
   E · empezar de cero sin código; la guarda contra un almacén vacío.
   S · el almacén local pasó a IndexedDB; sin cuenta no hay nube; la copia en
       Drive ya no existe; lo que se ve; consola. */
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
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');

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
const escribirDoc = (ruta, fields) => fetch(`${DOCS}/${ruta}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields }) });
async function ponerDerecho(uid, plan, venceMs) {
  await escribirDoc(`entitlements/${uid}`, { plan: { stringValue: plan }, pruebaUsada: { booleanValue: true },
                                             vence: { timestampValue: new Date(venceMs).toISOString() } });
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
await new Promise(r => server.listen(8173, r));
const URL = 'http://localhost:8173/LexCapture_v8.html';

const browser = await chromium.launch({ headless: true });
const errs = [];
/* Un teléfono con la cuenta apuntando a los emuladores. `pruebaLibre` deja el
   derecho de uso abierto en el teléfono; las REGLAS lo siguen exigiendo, así que
   cada cuenta recibe su derecho en el emulador. */
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
async function crearCuenta(t, correo, clave) {
  return t.page.evaluate(async ([c, k]) => {
    await cuCrear(c, k);
    await cuGuardarLocal(Object.assign({}, _cuenta, { codigoPend: null }));
    cuContinuar();
    return _cuenta.uid;
  }, [correo, clave]);
}
async function entrar(t, correo, clave) {
  await t.page.evaluate(async ([c, k]) => { const r = await cuEntrar(c, k); _cuTrasPantalla(r); }, [correo, clave]);
}
/* Quieta: sin ronda en curso, sin ronda programada, sin nada esperando. */
const quieta = (t, ms = 30000) => t.page.waitForFunction(() =>
  typeof _nb !== 'undefined' && _nb && !_nbCorriendo && !_nbProg && !_nbEntrantes.length && _nbEstado.pendientes === 0 && _nbEstado.fase === 'ok',
  null, { timeout: ms });
/* Igualdad de registros sin importar el orden de las claves (lo que viaja va en
   forma canónica). */
const canon = v => (v === null || typeof v !== 'object') ? v : Array.isArray(v) ? v.map(canon)
  : Object.keys(v).filter(k => k[0] !== '_').sort().reduce((o, k) => (o[k] = canon(v[k]), o), {});
const igual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const sincronizar = async t => { await t.page.evaluate(() => { nbProgramar(0); }); await t.page.waitForTimeout(300); await quieta(t); };
const caso = (t, id) => t.page.evaluate(id => JSON.parse(JSON.stringify(DB.getCase(id) || null)), id);
const regs = async uid => (await listar(`users/${uid}/reg`));

const CLAVE = 'Clave segura 2026';
const MARCAS = ['ZULUAGA NUBE', '43123456', '0500160000002026', 'ESTACION NUBE PRUEBA', 'Calle 47 Nube'];

try {
/* ═══ A · EL PRIMER EQUIPO SUBE TODO ═════════════════════════════════════ */
const A = await telefono();
await abrir(A);
/* Datos de antes de la cuenta: dos capturas, una persona, una firma y ajustes. */
const ids = await A.page.evaluate(async (M) => {
  const c1 = SIM.genFlagrancia('flagrancia-uri'); c1.id = 'caso-uno'; c1.nunc = M[2]; c1.lugar = Object.assign({}, c1.lugar, { dir: M[4], barrio: 'Prado' });
  const c2 = SIM.genFlagrancia('flagrancia-uri'); c2.id = 'caso-dos';
  await DB.saveCase(c1); await DB.saveCase(c2);
  await DB.savePerson({ id: 'per-zuluaga', priNom: 'ANA', priApe: M[0], numDoc: M[1], tipoDoc: 'CC', rol: 'Víctima' });
  const cfg = lcCfgCrudo(); cfg.nombreEstacion = M[3]; cfg.perfiles = [{ id: 'pf-uno', nombre: 'Juan Prueba', grado: 'Patrullero', activo: true }];
  await DB.saveConfig(cfg);
  await DB.saveFirma('pf-uno', { b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', w: 120, h: 40 });
  return { casos: DB.getCases().length, personas: DB.getPersons().length };
}, MARCAS);
const uid = await crearCuenta(A, 'agente.nube@flagrante.test', CLAVE);
await ponerDerecho(uid, 'prueba', Date.now() + 14 * DIA);
await A.page.evaluate(() => nbProgramar(0));
await quieta(A, 45000);
let docsA = await regs(uid);
const esperados = ids.casos + ids.personas + 2; // + ajustes + firma
log(docsA.length === esperados, '[A1] al crear la cuenta, el equipo sube TODO lo que ya tenía (capturas, personas, ajustes y firma)', docsA.length + ' de ' + esperados);
const crudo = JSON.stringify(docsA);
log(MARCAS.every(m => !crudo.includes(m)) && !crudo.includes('caso-uno') && !crudo.includes('per-zuluaga') && !crudo.includes('Juan Prueba'),
    '[A2] Firestore no contiene NADA legible: ni nombres, ni documentos, ni NUNC, ni identificadores');
const forma = docsA.every(d => {
  const f = d.fields, id = d.name.split('/').pop();
  return Object.keys(f).sort().join() === 'borrado,ct,rev,updatedAt,v' && /^r[A-Za-z0-9_-]{27}$/.test(id) && f.rev.integerValue === '1' && f.borrado.booleanValue === false;
});
log(forma, '[A3] cada documento es solo {v, rev, updatedAt, borrado, ct} y su nombre es un HMAC (no dice qué es)');
const cfgPayload = await A.page.evaluate(async () => {
  const d = await nbDocId('g', 'main'); const s = await FB.getDocFromServer(nbRef(d)); const x = s.data();
  return await nbDescifrar(d, x.rev, x.ct);
});
log(cfgPayload && cfgPayload.t === 'g' && cfgPayload.o.nombreEstacion === MARCAS[3] && !('nuncAno' in cfgPayload.o) && !('dossierSeccionesV' in cfgPayload.o),
    '[A4] los ajustes viajan sin las marcas de migración de este equipo');
log(await A.page.evaluate(() => /nube/.test(document.getElementById('cap-sub').textContent)), '[A5] el subtítulo de Capturas dice cuándo fue la última sincronización',
    await A.page.evaluate(() => document.getElementById('cap-sub').textContent));

/* ═══ B · OTRO EQUIPO ════════════════════════════════════════════════════ */
const B = await telefono();
await abrir(B);
await entrar(B, 'agente.nube@flagrante.test', CLAVE);
await B.page.evaluate(() => nbProgramar(0));
await esperar(() => B.page.evaluate(() => DB.getCases().length === 2 && DB.getPersons().length >= 1), 30000);
await quieta(B);
const enB = await B.page.evaluate(() => ({ c1: DB.getCase('caso-uno'), p: DB.getPerson('per-zuluaga'), est: lcCfgCrudo().nombreEstacion, f: DB.getFirma('pf-uno') }));
const enA = await caso(A, 'caso-uno');
log(enB.c1 && igual(enB.c1, enA) && enB.c1.nunc === MARCAS[2] && enB.p && enB.p.numDoc === MARCAS[1],
    '[B1] en el otro equipo aparecen las capturas y las personas, idénticas');
log(enB.est === MARCAS[3], '[B2] y los ajustes');
log(enB.f && enB.f.w === 120 && /^iVBOR/.test(enB.f.b64), '[B3] y la firma manuscrita (mismo usuario, cifrada)');
log((await regs(uid)).length === esperados, '[B4] bajar no sube nada: el otro equipo no crea copias');

/* En vivo: A cambia el barrio; B lo ve sin recargar. */
await A.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = 'Boston'; await DB.saveCase(c); });
const vivoB = await esperar(() => B.page.evaluate(() => DB.getCase('caso-uno').lugar.barrio === 'Boston'), 20000);
log(vivoB, '[B5] un cambio en un equipo aparece en el otro EN VIVO, sin recargar');
await quieta(A); await quieta(B);

/* Corrección: B corrige; A la recibe; nadie la revierte. */
await B.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = 'Laureles'; await DB.saveCase(c); });
await esperar(() => A.page.evaluate(() => DB.getCase('caso-uno').lugar.barrio === 'Laureles'), 20000);
await quieta(A); await quieta(B);
await A.page.evaluate(() => nbProgramar(0)); await B.page.evaluate(() => nbProgramar(0));
await A.page.waitForTimeout(1500); await quieta(A); await quieta(B);
const bA = (await caso(A, 'caso-uno')).lugar.barrio, bB = (await caso(B, 'caso-uno')).lugar.barrio;
log(bA === 'Laureles' && bB === 'Laureles', '[B6] una corrección llega al otro equipo y NO vuelve al valor anterior (el fallo de la copia en Drive)', bA + ' / ' + bB);

/* Vaciar un campo también viaja. */
await A.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = ''; await DB.saveCase(c); });
const vacio = await esperar(() => B.page.evaluate(() => DB.getCase('caso-uno').lugar.barrio === ''), 20000);
log(vacio, '[B7] vaciar un campo también se propaga');
await quieta(A); await quieta(B);

/* Borrado: A borra; B la pierde; no resucita. */
await A.page.evaluate(async () => { await DB.delCase('caso-dos'); });
const borrado = await esperar(() => B.page.evaluate(() => !DB.getCase('caso-dos')), 20000);
await quieta(A); await quieta(B);
await B.page.evaluate(() => nbProgramar(0)); await B.page.waitForTimeout(1200); await quieta(B); await quieta(A);
const resucita = await A.page.evaluate(() => !!DB.getCase('caso-dos'));
const lapida = (await regs(uid)).filter(d => d.fields.borrado.booleanValue);
log(borrado && !resucita && lapida.length === 1, '[B8] un borrado llega al otro equipo y no resucita; en la nube queda una lápida cifrada', lapida.length + ' lápida(s)');

/* Cambios en campos DISTINTOS a la vez, sin señal: los dos sobreviven. */
await A.ctx.setOffline(true); await B.ctx.setOffline(true);
await A.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = 'Belén'; await DB.saveCase(c); });
await B.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.narracion = Object.assign({}, c.narracion, { texto: 'Relato escrito en el equipo B.' }); await DB.saveCase(c); });
await A.page.waitForTimeout(3000);
const sinRed = await A.page.evaluate(() => ({ f: _nbEstado.fase, p: _nbEstado.pendientes, sub: document.getElementById('cap-sub').textContent }));
log(sinRed.f === 'sinRed' && sinRed.p === 1 && /1 sin subir/.test(sinRed.sub), '[C1] sin señal, el cambio espera y se ve: «1 sin subir»', sinRed.sub);
await A.ctx.setOffline(false);
await esperar(() => A.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0), 25000);
await B.ctx.setOffline(false);
await esperar(() => B.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0 && DB.getCase('caso-uno').lugar.barrio === 'Belén'), 30000);
await esperar(() => A.page.evaluate(() => (DB.getCase('caso-uno').narracion || {}).texto === 'Relato escrito en el equipo B.'), 25000);
await quieta(A); await quieta(B);
const cA = await caso(A, 'caso-uno'), cB = await caso(B, 'caso-uno');
log(cA.lugar.barrio === 'Belén' && cB.lugar.barrio === 'Belén' && cA.narracion.texto === cB.narracion.texto && /equipo B/.test(cA.narracion.texto),
    '[C2] al volver la señal, cambios hechos a la vez en campos distintos se juntan: ninguno se pierde');

/* Conflicto: el MISMO campo, distinto en cada equipo. */
await A.ctx.setOffline(true); await B.ctx.setOffline(true);
await A.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = 'Manrique'; await DB.saveCase(c); });
await B.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = 'Robledo'; await DB.saveCase(c); });
await A.page.waitForTimeout(800);
await A.ctx.setOffline(false);
await esperar(() => A.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0), 25000);
await B.ctx.setOffline(false);
await esperar(() => B.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0), 30000);
await esperar(() => A.page.evaluate(() => DB.getCase('caso-uno').lugar.barrio === 'Robledo'), 25000);
await quieta(A); await quieta(B);
const conf = await B.page.evaluate(() => (_nb.meta.conflictos || []).filter(x => /lugar\/barrio/.test(x.ruta)));
const fA = (await caso(A, 'caso-uno')).lugar.barrio, fB = (await caso(B, 'caso-uno')).lugar.barrio;
log(fA === fB && fB === 'Robledo' && conf.length >= 1 && conf[0].remoto === 'Manrique',
    '[C3] un conflicto converge en los dos equipos y el valor del otro queda anotado (nada se pierde en silencio)', fA + ' / ' + fB);

/* Cerrar la app con cambios sin subir: al volver, se suben. La página se CIERRA
   sin señal, así que nada pudo subir antes. */
await A.ctx.setOffline(true);
await A.page.evaluate(async () => { const p = JSON.parse(JSON.stringify(DB.getPerson('per-zuluaga'))); p.tel = '3001234567'; await DB.savePerson(p); });
await A.page.waitForTimeout(500);
await A.page.close();
await A.ctx.setOffline(false);
A.page = await A.ctx.newPage();
A.page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
A.page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
A.page.on('dialog', d => d.accept());
await abrir(A);
const tras = await esperar(() => B.page.evaluate(() => (DB.getPerson('per-zuluaga') || {}).tel === '3001234567'), 30000);
log(tras, '[C4] lo que quedó sin subir al cerrar la app se sube al volver a abrirla (la cola es la comparación con la base, no una lista que se pierde)');
await quieta(A); await quieta(B);

/* ═══ D · LA CAPTURA ABIERTA EN EL FORMULARIO ════════════════════════════ */
await B.page.evaluate(() => { editCase('caso-uno'); });
await B.page.waitForTimeout(400);
await A.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.vereda = 'Vereda remota'; await DB.saveCase(c); });
await B.page.waitForTimeout(5000);
const mientras = await B.page.evaluate(() => ({ v: (DB.getCase('caso-uno').lugar || {}).vereda || '', esp: Object.keys(_nbEspera).length, wc: !!wc }));
log(mientras.wc && mientras.v !== 'Vereda remota' && mientras.esp === 1, '[D1] lo que llega de la captura abierta en el formulario ESPERA (no se cambia por debajo)', JSON.stringify(mientras));
await B.page.evaluate(async () => { wc.lugar = Object.assign({}, wc.lugar, { zona: 'Zona del formulario' }); await DB.saveCase(JSON.parse(JSON.stringify(wc))); wc = null; go('capturas'); });
await esperar(() => B.page.evaluate(() => { const c = DB.getCase('caso-uno'); return c.lugar.vereda === 'Vereda remota' && c.lugar.zona === 'Zona del formulario'; }), 20000);
await esperar(() => A.page.evaluate(() => DB.getCase('caso-uno').lugar.zona === 'Zona del formulario'), 25000);
await quieta(A); await quieta(B);
const d2a = await caso(A, 'caso-uno'), d2b = await caso(B, 'caso-uno');
log(d2b.lugar.vereda === 'Vereda remota' && d2b.lugar.zona === 'Zona del formulario' && d2a.lugar.vereda === 'Vereda remota' && d2a.lugar.zona === 'Zona del formulario',
    '[D2] al cerrar el formulario se funde a tres vías: lo que llegó y lo que se guardó quedan los dos, en los dos equipos');

/* ═══ R · REGLAS Y SOBRES ════════════════════════════════════════════════ */
const C = await telefono();
await abrir(C);
const uidC = await crearCuenta(C, 'otra.cuenta@flagrante.test', CLAVE);
await ponerDerecho(uidC, 'prueba', Date.now() + 14 * DIA);
const unDoc = (await regs(uid))[0].name.split('/').pop();
const ajena = await C.page.evaluate(async ([u, d]) => {
  const ref = FB.doc(_cuFB.db, 'users', u, 'reg', d);
  const r = {};
  try { await FB.getDocFromServer(ref); r.leer = 'ok'; } catch (e) { r.leer = e.code; }
  try { await FB.setDoc(ref, { v: 1, rev: 99, updatedAt: FB.serverTimestamp(), borrado: false, ct: 'x'.repeat(40) }); r.escribir = 'ok'; } catch (e) { r.escribir = e.code; }
  try { await FB.deleteDoc(ref); r.borrar = 'ok'; } catch (e) { r.borrar = e.code; }
  return r;
}, [uid, unDoc]);
log(ajena.leer === 'permission-denied' && ajena.escribir === 'permission-denied' && ajena.borrar === 'permission-denied',
    '[R1] otra cuenta no puede leer, escribir ni borrar los registros', JSON.stringify(ajena));
const forma2 = await A.page.evaluate(async (d) => {
  const ref = nbRef(d), s = (await FB.getDocFromServer(ref)).data(), r = {};
  const intento = async (k, data) => { try { await FB.setDoc(ref, data); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
  await intento('mismaRev', { v: 1, rev: s.rev, updatedAt: FB.serverTimestamp(), borrado: false, ct: s.ct });
  await intento('saltaRev', { v: 1, rev: s.rev + 2, updatedAt: FB.serverTimestamp(), borrado: false, ct: s.ct });
  await intento('horaPropia', { v: 1, rev: s.rev + 1, updatedAt: FB.Timestamp.fromMillis(Date.now()), borrado: false, ct: s.ct });
  await intento('campoDeMas', { v: 1, rev: s.rev + 1, updatedAt: FB.serverTimestamp(), borrado: false, ct: s.ct, tipo: 'captura' });
  try { await FB.setDoc(FB.doc(_cuFB.db, 'users', _cuenta.uid, 'reg', 'caso-uno'), { v: 1, rev: 1, updatedAt: FB.serverTimestamp(), borrado: false, ct: s.ct }); r.nombreRaro = 'ok'; } catch (e) { r.nombreRaro = e.code; }
  return r;
}, unDoc);
log(Object.values(forma2).every(v => v === 'permission-denied'),
    '[R2] las reglas exigen la versión siguiente, la hora del servidor, la forma exacta y un nombre de HMAC', JSON.stringify(forma2));

/* Plan vencido: no se sube (queda en el equipo); bajar sí. */
let rechazos = 0;
A.page.on('console', m => { if (/no se pudo subir/.test(m.text())) rechazos++; });
await ponerDerecho(uid, 'prueba', Date.now() - DIA);
await A.page.evaluate(async () => { const c = JSON.parse(JSON.stringify(DB.getCase('caso-uno'))); c.lugar.barrio = 'Sin plan'; await DB.saveCase(c); });
await esperar(() => A.page.evaluate(() => _nbEstado.fase === 'sinDerecho'), 20000);
const venc = await A.page.evaluate(() => ({ f: _nbEstado.fase, p: _nbEstado.pendientes, fila: (() => { const d = document.createElement('div'); d.innerHTML = nbFila(); return d.textContent; })() }));
const lee = await A.page.evaluate(async (d) => { try { await FB.getDocFromServer(nbRef(d)); return 'ok'; } catch (e) { return e.code; } }, unDoc);
log(venc.f === 'sinDerecho' && venc.p === 1 && lee === 'ok' && /plan esté activo/.test(venc.fila),
    '[R3] con el plan vencido las reglas no dejan subir (el cambio se queda en el equipo, y se dice) pero sí leer lo suyo', JSON.stringify({ f: venc.f, p: venc.p, lee }));
await A.page.waitForTimeout(6000);
log(rechazos >= 1 && rechazos <= 2, '[R3b] un rechazo de las reglas no se reintenta en bucle (antes, cada rechazo pedía otra ronda)', rechazos + ' intento(s) en ~6 s');
await ponerDerecho(uid, 'pagado', Date.now() - DIA);
await A.page.evaluate(() => nbAjSincronizar());
await esperar(() => A.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0), 20000);
log(await A.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0),
    '[R4] un plan PAGADO vencido hace 1 día sigue subiendo: los mismos 3 días de gracia que da la app');
await ponerDerecho(uid, 'prueba', Date.now() + 14 * DIA);
await quieta(A); await quieta(B);

/* Sobres movidos: el mismo `ct` en otro documento, o devuelto a otra versión, no abre. */
const docs3 = await regs(uid);
const vivoDoc = docs3.find(d => !d.fields.borrado.booleanValue);
const ilegAntes = await B.page.evaluate(() => _nbEstado.ilegibles);
const nombreCopia = 'r' + 'A'.repeat(27);
await escribirDoc(`users/${uid}/reg/${nombreCopia}`, { v: { integerValue: '1' }, rev: { integerValue: '5' }, borrado: { booleanValue: false },
  ct: vivoDoc.fields.ct, updatedAt: { timestampValue: new Date().toISOString() } });
const otraRev = String(Number(vivoDoc.fields.rev.integerValue) + 1);
const nombreVivo = vivoDoc.name.split('/').pop();
await escribirDoc(`users/${uid}/reg/${nombreVivo}`, Object.assign({}, vivoDoc.fields, { rev: { integerValue: otraRev }, updatedAt: { timestampValue: new Date().toISOString() } }));
await esperar(() => B.page.evaluate(n => _nbEstado.ilegibles >= n + 2, ilegAntes), 15000);
const ileg = await B.page.evaluate(() => _nbEstado.ilegibles);
log(ileg >= ilegAntes + 2, '[R5] un sobre copiado a otro documento, o con la versión cambiada, no abre: se deja como estaba', (ileg - ilegAntes) + ' rechazados');
/* Se limpia lo que la prueba sembró a mano, para que no estorbe a lo que sigue. */
await fetch(`${DOCS}/users/${uid}/reg/${nombreCopia}`, { method: 'DELETE', headers: OWNER });
await escribirDoc(`users/${uid}/reg/${nombreVivo}`, Object.assign({}, vivoDoc.fields, { updatedAt: { timestampValue: new Date().toISOString() } }));

/* ═══ E · GUARDAS ════════════════════════════════════════════════════════ */
/* Un almacén que sale vacío (no por borrar) no borra la nube. */
const antesG = (await regs(uid)).filter(d => !d.fields.borrado.booleanValue).length;
await B.page.evaluate(async () => { _casesCache = []; _personsCache = []; await nbRonda(); });
await B.page.waitForTimeout(1500);
const despuesG = (await regs(uid)).filter(d => !d.fields.borrado.booleanValue).length;
log(despuesG === antesG && antesG > 0, '[E1] si un equipo se queda sin capturas ni personas sin haberlas borrado, NO borra la nube', antesG + ' → ' + despuesG);
await B.page.reload({ waitUntil: 'load' }); await listo(B.page);
await esperar(() => B.page.evaluate(() => DB.getCases().length === 1 && DB.getPersons().length >= 1), 20000);
log(await B.page.evaluate(() => DB.getCases().length === 1), '[E2] y al volver a abrir sigue teniendo todo');

/* «Empezar de cero» sin código: lo anterior se borra y lo de este equipo sube con la llave nueva. */
const cero = await C.page.evaluate(async () => {
  const c = SIM.genFlagrancia('flagrancia-uri'); c.id = 'caso-de-c'; await DB.saveCase(c);
  nbProgramar(0); await new Promise(r => setTimeout(r, 4000));
  const antes = (await FB.getDocsFromServer(FB.collection(_cuFB.db, 'users', _cuenta.uid, 'reg'))).size;
  const k = await cuDerivar(_cuenta.correo, 'Clave segura 2026');
  _cuPend = { uid: _cuenta.uid, correo: _cuenta.correo, env: k.env };
  const dekVieja = _cuenta.dek;
  await cuEmpezarDeCero();
  await cuGuardarLocal(Object.assign({}, _cuenta, { codigoPend: null }));
  nbProgramar(0); await new Promise(r => setTimeout(r, 5000));
  const snap = await FB.getDocsFromServer(FB.collection(_cuFB.db, 'users', _cuenta.uid, 'reg'));
  let abren = 0;
  for (const d of snap.docs) { const x = d.data(); if (await nbDescifrar(d.id, x.rev, x.ct)) abren++; }
  return { antes, despues: snap.size, abren, llaveNueva: dekVieja !== _cuenta.dek, local: DB.getCases().length };
});
log(cero.llaveNueva && cero.antes >= 1 && cero.despues === cero.abren && cero.despues >= 1 && cero.local === 1,
    '[E3] empezar de cero sin código borra lo que ya nadie abre y vuelve a subir lo de este equipo con la llave nueva', JSON.stringify(cero));

/* Cerrar sesión para la nube. */
await C.page.evaluate(async () => { await cuCerrarSesion(false); });
log(await C.page.evaluate(() => !_nb && !_nbUnsub && !_nbArrancado), '[E4] cerrar sesión detiene la nube (sin escucha ni rondas)');

/* ═══ S · EL ALMACÉN, SIN CUENTA, Y LO QUE SE RETIRÓ ═════════════════════ */
const alm = await A.page.evaluate(async () => {
  const idb = await lcIdbGet('lc_cases');
  return { idb: !!idb, ls: localStorage.getItem('lc_cases'), lsP: localStorage.getItem('lc_persons'), lsF: localStorage.getItem('lc_firmas'),
           base: !!(await lcIdbGet('nb|' + _cuenta.uid)), baseClaro: /caso-uno/.test(String(await lcIdbGet('nb|' + _cuenta.uid))) };
});
log(alm.idb && alm.ls === null && alm.lsP === null && alm.lsF === null, '[S1] las capturas, las personas y las firmas viven en IndexedDB (no en localStorage)');
log(alm.base && !alm.baseClaro, '[S2] la base de la nube está en IndexedDB y va cifrada con la llave del equipo');
/* Un equipo de antes: los datos en localStorage pasan solos a IndexedDB. */
const mig = await A.page.evaluate(async () => {
  const enc = await lcIdbGet('lc_cases');
  localStorage.setItem('lc_cases', enc); await lcIdbDel('lc_cases');
  return DB.getCases().length;
});
await A.page.reload({ waitUntil: 'load' }); await listo(A.page);
await A.page.waitForTimeout(800);
const mig2 = await A.page.evaluate(async () => ({ n: DB.getCases().length, idb: !!(await lcIdbGet('lc_cases')), ls: localStorage.getItem('lc_cases') }));
log(mig2.n === mig && mig2.idb && mig2.ls === null, '[S3] un equipo con las capturas en localStorage las pasa a IndexedDB al abrir, sin perder ninguna', JSON.stringify(mig2));

/* Sin cuenta configurada: ni SDK, ni red, ni base. */
const Z = await telefono(false);
await Z.ctx.addInitScript(() => { localStorage.setItem('lc_sync', 'resto-de-la-copia-en-drive'); });
await abrir(Z);
await Z.page.evaluate(async () => { const c = SIM.genFlagrancia('flagrancia-uri'); await DB.saveCase(c); });
await Z.page.waitForTimeout(4000);
const sinC = await Z.page.evaluate(async () => ({ fb: typeof FB, nb: !!_nb, arr: _nbArrancado, sync: localStorage.getItem('lc_sync'), sub: document.getElementById('cap-sub').textContent }));
log(sinC.fb === 'undefined' && !sinC.nb && !sinC.arr && !/nube|sin subir/.test(sinC.sub), '[S4] sin cuenta no hay nube: no se carga el SDK ni se toca la red', JSON.stringify(sinC));
log(sinC.sync === null, '[S5] lo que quedaba de la copia en Drive (lc_sync) se retira al abrir');
const retirado = ['function sySincronizar', 'function syToken', 'SY_CLIENT_ID', 'screen-sync', 'nav-sync', 'mas-sync', 'accounts.google.com', 'syncAutoDesbloqueo', 'function lcFlag', 'renderSync'];
log(retirado.every(x => !src.includes(x)) && !/'compartir','sync'\]/.test(src),
    '[S6] la copia en Drive ya no existe: ni el módulo, ni la pantalla, ni el menú, ni el script de Google', retirado.filter(x => src.includes(x)).join(','));
const csp = src.match(/Content-Security-Policy" content="([^"]+)"/)[1];
log(!/www\.googleapis|oauth2\.googleapis|accounts\.google|gsi/.test(csp) && /firestore\.googleapis\.com/.test(csp), '[S7] la CSP ya no abre Google Drive ni su inicio de sesión; sí Firestore');
const reglas = readFileSync(join(ROOT, 'firebase/firestore.rules'), 'utf8');
log(/match \/users\/\{uid\}\/reg\/\{id\}/.test(reglas) && /resource\.data\.rev \+ 1/.test(reglas) && /vigente\(uid\)/.test(reglas),
    '[S8] las reglas tienen los registros, el comparar-y-cambiar de versión y el derecho de uso');

/* Lo que se ve en Ajustes → Cuenta. */
await A.page.evaluate(() => { go('ajustes'); });
await esperar(() => A.page.evaluate(() => _nbEstado.fase === 'ok' && _nbEstado.pendientes === 0), 20000);
await A.page.evaluate(() => renderAjCuenta());
const fila = await A.page.evaluate(() => { const f = document.getElementById('nb-fila'); return f ? f.innerText : ''; });
log(/Nube/.test(fila) && /Al día/.test(fila) && /Sincronizar ahora/.test(fila), '[S9] Ajustes → Cuenta dice si la nube está al día y deja sincronizar a mano', fila.replace(/\s+/g, ' '));

const ruido = /Failed to load resource|permission-denied|PERMISSION_DENIED|Missing or insufficient permissions|status of 40[0-9]|ERR_ABORTED|ERR_INTERNET_DISCONNECTED|net::ERR|WebChannelConnection|Could not reach Cloud Firestore|client is offline|FirebaseError/;
const malos = errs.filter(e => !ruido.test(e));
log(malos.length === 0, '[S10] consola limpia (sin contar los rechazos y cortes que la prueba provoca)', malos.slice(0, 3).join(' | '));
} catch (e) {
  console.error(e);
  log(false, 'la suite se interrumpió', String(e.message).slice(0, 300));
} finally {
  await browser.close();
  server.close();
  apagar();
}
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
