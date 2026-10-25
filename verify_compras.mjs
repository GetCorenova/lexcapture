/* LA SUSCRIPCIÓN · F5 del plan de cuenta (2026-10-24).

   Google Play cobra, RevenueCat valida el recibo y el SERVIDOR (miDerecho)
   pregunta a RevenueCat y escribe el derecho de uso. Esta suite lo ejerce contra
   los EMULADORES de Firebase (Auth + Firestore + Functions), que arranca y apaga.

   ⚠️ Dos simulaciones, cada una en su lado:
   · en el teléfono, el complemento nativo `Purchases` (no existe en un navegador);
   · en el servidor, RevenueCat: la función lee `_simRC/{uid}` SOLO porque corre en
     el emulador (FUNCTIONS_EMULATOR). Pagar en el teléfono simulado escribe ese
     documento, que es lo que haría RevenueCat al recibir el recibo de Google Play.
   Lo que no se prueba aquí es hablar con Google Play ni con RevenueCat de verdad.

   S · la traducción de RevenueCat al derecho de uso, sin emuladores.
   C · comprar: la web dice dónde, los planes, cancelar, pendiente, pagar, otro equipo.
   R · el servidor manda: margen, reembolso, comprar en otro teléfono, restaurar.
   E · estructura: claves, reglas, consola. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { join, extname } from 'path';
import { spawn, execSync } from 'child_process';
import { createRequire } from 'module';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PROY = 'demo-flagrante', REGION = 'southamerica-east1';
const AUTH = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', FN = 'http://127.0.0.1:5001';
const EMU = { auth: AUTH, host: '127.0.0.1', puerto: 8085, fnPuerto: 5001, proyecto: PROY };
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const DIA = 86400000;

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const fnSrc = readFileSync(join(ROOT, 'firebase/functions/index.js'), 'utf8');

/* ═══ S · LA TRADUCCIÓN DE REVENUECAT ═══════════════════════════════════ */
const C = createRequire(import.meta.url)(join(ROOT, 'firebase/functions/compras.js'));
const t0 = Date.now();
const iso = ms => new Date(ms).toISOString();
const sub = (exp, extra) => ({ entitlements: { flagrante_pro: Object.assign({ expires_date: exp, product_identifier: 'lexcapture_premium:mensual' }, extra || {}) },
  subscriptions: { 'lexcapture_premium:mensual': { is_sandbox: true } } });
const eA = C.estadoRC(sub(iso(t0 + 30 * DIA)), t0);
log(eA.existe && eA.activo && eA.vence === Date.parse(iso(t0 + 30 * DIA)) && eA.sandbox, '[S1] una suscripción vigente: activa, con su vencimiento');
log(!C.estadoRC(sub(iso(t0 - DIA)), t0).activo && C.estadoRC(sub(iso(t0 - DIA), { grace_period_expires_date: iso(t0 + 3 * DIA) }), t0).activo,
    '[S2] vencida no cuenta, salvo dentro del período de gracia de Google Play');
log(C.estadoRC(sub(null), t0).activo && !C.estadoRC({ entitlements: { otro: {} } }, t0).existe && !C.estadoRC(null, t0).existe,
    '[S3] sin vencimiento es para siempre; otro entitlement (o nada) no cuenta');
log(C.debeConsultar(null, t0) && C.debeConsultar({ plan: 'prueba', vence: t0 + 10 * DIA }, t0)
    && !C.debeConsultar({ plan: 'pagado', vence: t0 + 10 * DIA }, t0) && C.debeConsultar({ plan: 'pagado', vence: t0 + DIA }, t0)
    && C.debeConsultar({ plan: 'pagado', vence: t0 + 10 * DIA }, t0, true),
    '[S4] se pregunta a RevenueCat salvo con un plan pagado de más de 2 días por delante (o si se fuerza)');
const cP = C.cambioRC({ plan: 'prueba', vence: t0 + 5 * DIA, pruebaUsada: true }, eA, t0);
log(cP && cP.plan === 'pagado' && cP.vence === eA.vence && cP.pruebaUsada === true, '[S5] pagar en plena prueba la reemplaza y conserva que la prueba se usó');
const cR = C.cambioRC({ plan: 'pagado', vence: t0 + 20 * DIA }, C.estadoRC(sub(iso(t0 - 2 * DIA)), t0), t0);
log(cR && cR.vence === Date.parse(iso(t0 - 2 * DIA)) && C.cambioRC({ plan: 'pagado', vence: t0 + 20 * DIA }, C.estadoRC(null, t0), t0).vence === t0,
    '[S6] un reembolso baja el vencimiento; si RevenueCat ya no conoce el entitlement, termina hoy');
log(C.cambioRC({ plan: 'prueba', vence: t0 + DIA }, C.estadoRC(null, t0), t0) === null && C.cambioRC(null, C.estadoRC(null, t0), t0) === null
    && C.cambioRC({ plan: 'pagado', vence: eA.vence, producto: eA.producto }, eA, t0) === null,
    '[S7] quien nunca pagó no se toca, y si nada cambió no se escribe');

/* ── Emuladores ─────────────────────────────────────────────────────────── */
const secreto = join(ROOT, 'firebase/functions/.secret.local');
if (!existsSync(secreto)) writeFileSync(secreto, 'PRUEBA_HMAC=secreto-solo-del-emulador\n');
if (!/REVENUECAT_SK=/.test(readFileSync(secreto, 'utf8'))) appendFileSync(secreto, 'REVENUECAT_SK=sk_solo-del-emulador\n');
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
  const ti = Date.now();
  while (!((await vivo(AUTH)) && (await vivo(FS)) && (await fnLista()))) {
    if (Date.now() - ti > 120000) { console.error(salida.slice(-3000)); throw new Error('Los emuladores no arrancaron'); }
    await new Promise(r => setTimeout(r, 700));
  }
}
/* ⚠️ El emulador de Firestore es un `java` aparte que sobrevive al taskkill del
   árbol en Windows: se cierra también por su puerto. */
const apagar = () => {
  if (!emu) return;
  try { execSync('taskkill /pid ' + emu.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  try { execSync('powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort 8085,9099,5001,9150 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' }); } catch (e) {}
};
await fetch(`${AUTH}/emulator/v1/projects/${PROY}/accounts`, { method: 'DELETE' });
await fetch(`${FS}/emulator/v1/projects/${PROY}/databases/(default)/documents`, { method: 'DELETE' });

const DOCS = `${FS}/v1/projects/${PROY}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const leer = async ruta => { const r = await fetch(`${DOCS}/${ruta}`, { headers: OWNER }); return r.status === 200 ? r.json() : null; };
/* Un objeto JS a los `fields` de la API REST de Firestore. */
const valor = v => v === null ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) }
  : typeof v === 'string' ? { stringValue: v } : { mapValue: { fields: campos(v) } };
const campos = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valor(v)]));
/* Lo que haría RevenueCat al recibir el recibo de Google Play. */
async function rcPoner(uid, venceMs, producto = 'lexcapture_premium:mensual') {
  await fetch(`${DOCS}/_simRC/${uid}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: campos({
    entitlements: { flagrante_pro: { expires_date: iso(venceMs), product_identifier: producto, purchase_date: iso(Date.now()) } },
    subscriptions: { [producto]: { is_sandbox: true } } }) }) });
}
async function ponerDerecho(uid, plan, venceMs) {
  await fetch(`${DOCS}/entitlements/${uid}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: {
    plan: { stringValue: plan }, pruebaUsada: { booleanValue: true }, vence: { timestampValue: iso(venceMs) } } }) });
}
const derechoServidor = async uid => {
  const d = await leer('entitlements/' + uid); if (!d) return null;
  const f = d.fields;
  return { plan: f.plan && f.plan.stringValue, vence: f.vence ? Date.parse(f.vence.timestampValue) : 0,
           pruebaUsada: !!(f.pruebaUsada && f.pruebaUsada.booleanValue), producto: f.producto && f.producto.stringValue };
};

/* ── Servidor de la app: la CSP se abre a los emuladores SOLO aquí ─────── */
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p) || !extname(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  let b = readFileSync(p);
  if (extname(p) === '.html') b = b.toString('utf8').replace("connect-src 'self'", `connect-src 'self' ${AUTH} ${FS} ${FN}`);
  s.end(b);
});
await new Promise(r => server.listen(8173, r));
const URL = 'http://localhost:8173/LexCapture_v8.html';

const browser = await chromium.launch({ headless: true });
const errs = [];
/* Un teléfono. `nativo`: la app de Android con el complemento de compras
   simulado. Sin él es la versión web. */
async function telefono(nativo) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
  /* Pagar en Google Play → RevenueCat recibe el recibo (lo escribe la prueba). */
  await ctx.exposeFunction('__rcPagar', async (uid, producto, dias) => { await rcPoner(uid, Date.now() + dias * DIA, producto); return true; });
  await ctx.addInitScript(([e, nat]) => {
    const o = JSON.parse(localStorage.getItem('lc_flags') || '{}'); o.cuentaEmulador = e;
    localStorage.setItem('lc_flags', JSON.stringify(o));
    if (!nat) return;
    window.__rc = { llamadas: [], uid: null, modo: 'pagar' };
    const ci = act => ({ customerInfo: { entitlements: { active: act ? { flagrante_pro: { isActive: true } } : {} } } });
    const paq = (id, tipo, prod, precio, mes) => ({ identifier: id, packageType: tipo, offeringIdentifier: 'default',
      presentedOfferingContext: { offeringIdentifier: 'default' },
      product: { identifier: prod, title: tipo, priceString: precio, pricePerMonthString: mes } });
    window.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => 'android',
      Plugins: { Purchases: {
        configure: async c => { __rc.llamadas.push(['configure', c]); __rc.uid = c.appUserID; },
        logIn: async o => { __rc.llamadas.push(['logIn', o]); __rc.uid = o.appUserID; return ci(false); },
        getOfferings: async () => { __rc.llamadas.push(['getOfferings']);
          if (__rc.modo === 'sinRed') { const x = new Error('net'); x.code = '10'; throw x; }
          const p = [paq('$rc_monthly', 'MONTHLY', 'lexcapture_premium:mensual', '$ 19.900', '$ 19.900'),
                     paq('$rc_annual', 'ANNUAL', 'lexcapture_premium:anual', '$ 199.000', '$ 16.583')];
          return { current: { identifier: 'default', availablePackages: p }, all: {} }; },
        purchasePackage: async ({ aPackage }) => { __rc.llamadas.push(['purchasePackage', aPackage.identifier]);
          if (__rc.modo === 'cancelar') { const x = new Error('cancel'); x.code = '1'; throw x; }
          if (__rc.modo === 'pendiente') { const x = new Error('pend'); x.code = '20'; throw x; }
          await window.__rcPagar(__rc.uid, aPackage.product.identifier, aPackage.packageType === 'ANNUAL' ? 365 : 30);
          return Object.assign({ productIdentifier: aPackage.product.identifier }, ci(true)); },
        restorePurchases: async () => { __rc.llamadas.push(['restorePurchases']); return ci(false); },
        getCustomerInfo: async () => ci(false)
      } }
    };
  }, [EMU, !!nativo]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('dialog', d => d.accept());
  return { ctx, page };
}
const listo = p => p.waitForFunction(() => window._lcListo === true, null, { timeout: 15000 });
const pant = (p, n) => p.waitForSelector(`#cu-ov.on .cu-pant[data-p="${n}"]`, { timeout: 40000 });
const enPant = (p, n) => p.evaluate(n => !!document.querySelector(`#cu-ov.on .cu-pant[data-p="${n}"]`), n);
const cerrado = p => p.waitForFunction(() => !document.getElementById('cu-ov').classList.contains('on'), null, { timeout: 40000 });
async function abrir(t) { await t.page.goto(URL, { waitUntil: 'load' }); await listo(t.page); }
async function crearCuenta(t, correo, clave) {
  await abrir(t);
  await pant(t.page, 'bienvenida');
  return t.page.evaluate(async ([c, k]) => {
    await cuCrear(c, k);
    await cuGuardarLocal(Object.assign({}, _cuenta, { codigoPend: null, verificado: true }));
    cuContinuar();
    return _cuenta.uid;
  }, [correo, clave]);
}
async function entrar(t, correo, clave) {
  await abrir(t);
  await pant(t.page, 'bienvenida');
  await t.page.evaluate(async ([c, k]) => { const r = await cuEntrar(c, k); _cuTrasPantalla(r); }, [correo, clave]);
}
const info = t => t.page.evaluate(() => { const e = document.getElementById('cu-info'); return e && !e.hidden ? e.textContent : ''; });
const err = t => t.page.evaluate(() => { const e = document.getElementById('cu-err'); return e && !e.hidden ? e.textContent : ''; });
const estado = t => t.page.evaluate(() => ({ der: lcDerecho(), plan: _cuenta.derecho && _cuenta.derecho.plan, vence: _cuenta.derecho && _cuenta.derecho.vence }));
const vencer = async (t, uid) => { await ponerDerecho(uid, 'prueba', Date.now() - 60000);
  await t.page.evaluate(async () => { await drActualizar(); drTrasActualizar(); }); await pant(t.page, 'vencido'); };

const CLAVE = 'Clave segura 2026';
try {
/* ═══ C · COMPRAR ════════════════════════════════════════════════════════ */
const W = await telefono(false);
const uidW = await crearCuenta(W, 'web.compras@flagrante.test', CLAVE);
await vencer(W, uidW);
await W.page.click('text=Suscribirme');
log(/se compra en la app de Android/.test(await info(W)) && await enPant(W.page, 'vencido'),
    '[C1] en la web «Suscribirme» dice dónde se compra y no abre nada');
await W.ctx.close();

const B = await telefono(true);
const uidB = await crearCuenta(B, 'agente.compras@flagrante.test', CLAVE);
await pant(B.page, 'prueba');
log(await B.page.isVisible('text=Suscribirme sin la prueba'), '[C2] en la app de Android se puede suscribir sin pasar por la prueba (la salida de un teléfono que no pasa Play Integrity)');
await vencer(B, uidB);
await B.page.click('text=Suscribirme');
await B.page.waitForSelector('.cp-plan', { timeout: 30000 });
const c3 = await B.page.evaluate(() => ({ t: document.getElementById('cu-box').innerText, n: document.querySelectorAll('.cp-plan').length,
  conf: __rc.llamadas.find(l => l[0] === 'configure') }));
log(c3.n === 2 && /Mensual[\s\S]*\$ 19\.900[\s\S]*al mes/.test(c3.t) && /Anual[\s\S]*\$ 199\.000[\s\S]*al año/.test(c3.t) && /16\.583/.test(c3.t),
    '[C3] los planes y sus precios los da Google Play (mensual y anual, con el equivalente mensual)');
log(/renueva sola/.test(c3.t) && /cancel/.test(c3.t) && /Restaurar compras/.test(c3.t),
    '[C4] la pantalla dice que se renueva sola, cómo se cancela, y deja restaurar compras');
log(c3.conf && c3.conf[1].apiKey === 'goog_vKJzoidrLNxFALSmhtZbOEvvcOa' && c3.conf[1].appUserID === uidB,
    '[C5] RevenueCat se configura con la clave pública y el usuario es el uid de la cuenta');

await B.page.evaluate(() => { __rc.modo = 'cancelar'; });
await B.page.click('.cp-plan >> nth=0');
await B.page.waitForFunction(() => __rc.llamadas.some(l => l[0] === 'purchasePackage') && !document.querySelector('.cp-plan:disabled'), null, { timeout: 20000 });
const c6 = await estado(B);
log(c6.der === 'vencido' && !(await err(B)) && await enPant(B.page, 'planes') && !(await derechoServidor(uidB)).producto,
    '[C6] cerrar la ventana de Google Play no da error ni da el plan');
await B.page.evaluate(() => { __rc.modo = 'pendiente'; });
await B.page.click('.cp-plan >> nth=0');
await B.page.waitForFunction(() => { const e = document.getElementById('cu-info'); return e && !e.hidden; }, null, { timeout: 20000 });
log(/pendiente/.test(await info(B)) && (await estado(B)).der === 'vencido', '[C7] un pago pendiente se dice y no da el plan todavía');

await B.page.evaluate(() => { __rc.modo = 'pagar'; });
await B.page.click('.cp-plan >> nth=1');
await cerrado(B.page);
const c8 = await estado(B), s8 = await derechoServidor(uidB);
log(c8.der === 'activo' && c8.plan === 'pagado' && Math.abs(c8.vence - (Date.now() + 365 * DIA)) < 5 * 60000,
    '[C8] pagar el anual abre la app con el plan pagado por un año');
log(s8.plan === 'pagado' && s8.pruebaUsada === true && s8.producto === 'lexcapture_premium:anual',
    '[C9] lo escribió el SERVIDOR tras preguntar a RevenueCat, y conserva que la prueba se usó');
await B.page.evaluate(() => go('ajustes'));
const c10 = await B.page.evaluate(() => document.getElementById('aj-cuenta').innerHTML);
log(/Suscripción/.test(c10) && /Administrar en Google Play/.test(c10) && /account\/subscriptions\?package=com\.getcorenova\.flagrante/.test(c10),
    '[C10] Ajustes → Cuenta muestra la suscripción y lleva a administrarla en Google Play');

/* El otro equipo tiene que poder pasar de «verifica tu correo». */
await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROY}/accounts:update`,
  { method: 'POST', headers: OWNER, body: JSON.stringify({ localId: uidB, emailVerified: true }) });
const B2 = await telefono(false);
await entrar(B2, 'agente.compras@flagrante.test', CLAVE);
await cerrado(B2.page);
log((await estado(B2)).plan === 'pagado' && (await estado(B2)).der === 'activo', '[C11] lo comprado es de la cuenta: otro equipo con la misma cuenta abre con el plan');
await B2.ctx.close();

/* ═══ R · EL SERVIDOR MANDA ═══════════════════════════════════════════════ */
/* Con más de 2 días por delante no se vuelve a preguntar a RevenueCat… */
await rcPoner(uidB, Date.now() - 5 * DIA, 'lexcapture_premium:anual');
await B.page.evaluate(async () => { await drActualizar(); });
log((await estado(B)).der === 'activo' && (await derechoServidor(uidB)).vence > Date.now() + 300 * DIA,
    '[R1] con el plan pagado y días por delante, el servidor no le pregunta a RevenueCat en cada apertura');
/* …pero un reembolso se ve al revisar. */
await B.page.evaluate(async () => { await drActualizar(true); drTrasActualizar(); });
await pant(B.page, 'vencido');
const r2 = await estado(B);
log(r2.der === 'vencido' && r2.plan === 'pagado' && /suscripción venció/i.test(await B.page.textContent('#cu-box')),
    '[R2] un reembolso o revocación en RevenueCat cierra la app al revisar (pasados los 3 días de gracia)');

const E = await telefono(true);
const uidE = await crearCuenta(E, 'agente.prueba@flagrante.test', CLAVE);
await ponerDerecho(uidE, 'prueba', Date.now() + 8 * DIA);
await E.page.evaluate(async () => { await drActualizar(); });
log((await estado(E)).plan === 'prueba', '[R3] (en prueba, sin compra)');
await rcPoner(uidE, Date.now() + 30 * DIA);
await E.page.evaluate(async () => { await drActualizar(); });
log((await estado(E)).plan === 'pagado', '[R4] quien está en prueba y paga en otro teléfono ve el plan pagado en la siguiente consulta');

const F = await telefono(true);
const uidF = await crearCuenta(F, 'agente.restaura@flagrante.test', CLAVE);
await vencer(F, uidF);
await rcPoner(uidF, Date.now() + 30 * DIA);
await F.page.click('text=Suscribirme');
await F.page.waitForSelector('.cp-plan', { timeout: 30000 });
await F.page.click('text=Restaurar compras');
await cerrado(F.page);
log((await estado(F)).plan === 'pagado' && await F.page.evaluate(() => __rc.llamadas.some(l => l[0] === 'restorePurchases')),
    '[R5] «Restaurar compras» le pide a Google Play lo comprado y el servidor lo confirma');

const G = await telefono(true);
const uidG = await crearCuenta(G, 'agente.revisa@flagrante.test', CLAVE);
await vencer(G, uidG);
await rcPoner(uidG, Date.now() + 30 * DIA);
await G.page.click('text=Ya pagué: revisar');
await cerrado(G.page);
log((await estado(G)).plan === 'pagado' && await G.page.evaluate(() => __rc.llamadas.some(l => l[0] === 'restorePurchases')),
    '[R6] «Ya pagué: revisar» también restaura en Google Play antes de preguntar al servidor');
await G.page.evaluate(() => { cuMostrar('vencido'); __rc.modo = 'sinRed'; lcComprar(); });
await G.page.waitForFunction(() => /conexión|internet/i.test(document.getElementById('cu-box').innerText), null, { timeout: 20000 });
log(await G.page.isVisible('text=Reintentar'), '[R7] sin señal los planes no cargan, se dice y se puede reintentar');

/* ═══ E · ESTRUCTURA ═════════════════════════════════════════════════════ */
const r8 = await G.page.evaluate(async uid => {
  const out = {};
  for (const [n, f] of [['leerRC', () => FB.getDocFromServer(FB.doc(_cuFB.db, '_simRC/' + uid))],
                        ['escribirDerecho', () => FB.setDoc(FB.doc(_cuFB.db, 'entitlements/' + uid), { plan: 'pagado' })]]) {
    try { await f(); out[n] = 'permitido'; } catch (e) { out[n] = e.code; }
  }
  return out;
}, uidG);
log(r8.leerRC === 'permission-denied' && r8.escribirDerecho === 'permission-denied', '[E1] el teléfono no lee RevenueCat ni se escribe el plan', JSON.stringify(r8));
log(!/sk_[A-Za-z0-9]/.test(fnSrc) && /defineSecret\('REVENUECAT_SK'\)/.test(fnSrc) && !/sk_[A-Za-z0-9]{8}|REVENUECAT_SK/.test(src),
    '[E2] la clave secreta de RevenueCat solo vive en los secretos del servidor; la app lleva la pública');
log(/if \(EMULADOR\) \{\s*const s = await db\.doc\('_simRC\/'/.test(fnSrc) && /api\.revenuecat\.com\/v1\/subscribers/.test(fnSrc),
    '[E3] la simulación de RevenueCat solo existe dentro del emulador; fuera se consulta la API real');
log(!/flagrante_pro/.test(src.replace(/var CP_ENT = 'flagrante_pro';/, '')) && /CP_ENT/.test(src),
    '[E4] la app nombra el entitlement en un solo sitio, y ningún producto concreto');
const ruido = errs.filter(e => !/permission-denied|PERMISSION_DENIED|400 \(Bad Request\)|status of 4\d\d|\[Flagrante\] (planes|restaurar)/.test(e));
log(ruido.length === 0, '[E5] consola limpia (sin contar los rechazos que la prueba provoca)', ruido.join(' | '));
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
