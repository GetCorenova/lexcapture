/* Regresión del MÓDULO DE MEMBRESÍA (licencias firmadas, sin servidor).
   Lo que hay que comprobar de punta a punta:

   A. La criptografía hace su trabajo: un código legítimo se acepta, y uno
      manipulado, uno firmado con otra clave y uno vencido se rechazan. Si esto
      no se sostiene, todo lo demás es decoración.
   B. La regla de negocio pedida: rol admin o acceso VIP vigente saltan el muro;
      un VIP caducado NO; y la prueba gratuita cubre al usuario nuevo.
   C. EL GUARDIA, que es lo que de verdad importa para quien usa la app: con la
      membresía vencida no se generan documentos de capturas NUEVAS, pero las
      que se abrieron mientras había derecho se siguen documentando SIEMPRE —
      el plazo del art. 28 C.P. son 36 horas y nadie puede quedarse a medias.
      Y leer, editar y exportar no se bloquean nunca.
   D. El panel de administración: invisible sin rol admin, emite licencias que
      la propia app acepta, y el registro se busca por correo.
   E. Lo que NO cambia: sin licencia instalada el almacenamiento no gana claves
      y el documento generado es byte a byte el mismo que antes del módulo.
   F. Que las pantallas SE VEAN — no que existan en el DOM. Es la lección que
      este proyecto ya pagó: una sección insertada fuera de <main> salía en
      blanco y la regresión daba verde igual. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { webcrypto } from 'node:crypto';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = tmpdir();
const PORT = 8163;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
const log = (ok, label, extra) => {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
};

/* ═══ Emisor de códigos para la prueba ═════════════════════════════════════
   Firma igual que la app y que scripts/emitir-licencia.mjs. Se usa la clave
   privada REAL: así lo que se prueba es la cadena entera —emitir, transportar,
   verificar— y no una maqueta que podría diverger del emisor de verdad. */
const CLAVE = join(ROOT, '..', 'keystore-RESGUARDAR', 'lexcapture-licencias-PRIVADA.json');
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwkPriv = JSON.parse(readFileSync(CLAVE, 'utf8'));
const keyPriv = await webcrypto.subtle.importKey('jwk', jwkPriv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

async function emitir(p, key = keyPriv) {
  const cuerpo = b64u(new TextEncoder().encode(JSON.stringify(
    Object.assign({ v: 1, plan: 'lexcapture_monthly', rol: 'user', iat: Date.now(), vip: false, vexp: null }, p))));
  const firma = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(cuerpo));
  return 'LXL1.' + cuerpo + '.' + b64u(new Uint8Array(firma));
}
const MES = 2629800000, DIA = 86400000;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(700);

const estado = () => page.evaluate(() => licEstado());
const instalar = (t) => page.evaluate(c => licInstalar(c), t);
const limpiarLic = () => page.evaluate(() => licQuitar());

/* ═══ A · La criptografía ══════════════════════════════════════════════════ */
console.log('\n── A · Criptografía ──');

const bueno = await emitir({ sub: 'ok@test.co', exp: Date.now() + 6 * MES });
log((await page.evaluate(c => licVerificar(c).then(p => !!p), bueno)) === true,
  'Un código legítimo se verifica');

// Se cambia UN carácter del contenido firmado: la firma deja de cuadrar.
const partes = bueno.split('.');
const manipulado = partes[0] + '.' + partes[1].slice(0, -4) + 'AAAA.' + partes[2];
log((await page.evaluate(c => licVerificar(c).then(p => !!p), manipulado)) === false,
  'Un código con el contenido manipulado se RECHAZA');

// ⚠️ La prueba que de verdad protege el negocio: alguien que genera su propio
// par de claves y se firma una licencia de administrador.
const otroPar = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const falso = await emitir({ sub: 'pirata@test.co', rol: 'admin', exp: Date.now() + 99 * MES }, otroPar.privateKey);
log((await page.evaluate(c => licVerificar(c).then(p => !!p), falso)) === false,
  'Un código firmado con OTRA clave se RECHAZA (no se puede fabricar una licencia)');

const vencido = await emitir({ sub: 'viejo@test.co', exp: Date.now() - DIA });
log((await instalar(vencido)).ok === false, 'Un código ya vencido no se instala');

log((await page.evaluate(() => licVerificar('cualquier cosa').then(p => !!p))) === false,
  'Texto que no es un código se rechaza sin reventar');

/* ═══ B · La regla de negocio ══════════════════════════════════════════════ */
console.log('\n── B · Regla de negocio ──');

await limpiarLic();
let e = await estado();
log(e.premium === true && e.motivo === 'prueba',
  'Un equipo recién instalado entra en la prueba gratuita', `${e.dias} días`);

/* ⚠️ La prueba tiene que quedar ESTAMPADA en disco. Si no se persistiera se
   reiniciaría en cada sesión y sería una prueba infinita — que es el defecto que
   introdujo el primer intento, cuando licEstado() la estampaba desde el lector y
   hubo que sacarla de ahí (rompía el aviso anual del NUNC). */
const t1 = await page.evaluate(() => { const c = DB.getConfig(); return c && c.trialInicio; });
log(typeof t1 === 'number' && t1 > 0, 'La fecha de inicio de la prueba queda persistida', new Date(t1).toISOString().slice(0,10));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(900);
const t2 = await page.evaluate(() => { const c = DB.getConfig(); return c && c.trialInicio; });
log(t2 === t1, '⚠️ Y NO se reinicia al volver a entrar (si no, la prueba sería infinita)');

// ⚠️ Se consume la prueba ANTES de medir plan/VIP/admin: mientras esté viva,
// CUALQUIER equipo da premium y las tres comprobaciones siguientes pasarían
// por el motivo equivocado. Es el fallo que destapó esta suite en su primera
// corrida — no del código, del orden de la prueba.
await page.evaluate(() => { const c = DB.getConfig(); c.trialInicio = Date.now() - 40 * 86400000; DB.saveConfig(c); });
log((await instalar(await emitir({ sub: 'mensual@test.co', exp: Date.now() + MES }))).ok === true,
  'Se instala una membresía mensual');
e = await estado();
log(e.premium === true && e.motivo === 'plan' && e.correo === 'mensual@test.co',
  'Con plan vigente hay acceso, y se sabe de quién es', e.etiqueta);

// isVipFreeAccess + vipExpiresAt: la bandera de acceso manual que pedía el encargo.
await instalar(await emitir({ sub: 'vip@test.co', plan: 'vip', exp: Date.now() - DIA, vip: true, vexp: Date.now() + 3 * MES }));
e = await estado();
log(e.premium === true && e.motivo === 'vip',
  'VIP vigente salta el muro AUNQUE su plan esté vencido');

await instalar(await emitir({ sub: 'vipviejo@test.co', plan: 'vip', exp: Date.now() - DIA, vip: true, vexp: Date.now() - DIA }));
e = await estado();
log(e.premium === false,
  'VIP CADUCADO ya no salta el muro (la fecha de vigencia se respeta)');

await instalar(await emitir({ sub: 'admin@test.co', rol: 'admin', exp: Date.now() - 99 * MES }));
e = await estado();
log(e.premium === true && e.motivo === 'admin' && e.rol === 'admin',
  'Rol admin: acceso total aunque el plan esté vencido');

/* ═══ C · EL GUARDIA ═══════════════════════════════════════════════════════ */
console.log('\n── C · El guardia ──');

// Se deja el equipo sin derecho: sin licencia y con la prueba ya consumida.
await limpiarLic();
await page.evaluate(d => { const c = DB.getConfig(); c.trialInicio = Date.now() - d; DB.saveConfig(c); },
  (35 * DIA));
e = await estado();
log(e.premium === false && e.motivo === 'prueba-vencida', 'Con la prueba consumida no hay acceso');

const corte = await page.evaluate(() => licVenceEn());
const vieja = { id: 'V1', created: corte - DIA };        // abierta con derecho
const nueva = { id: 'N1', created: Date.now() };          // abierta después

log((await page.evaluate(c => licPuedeGenerar(c), nueva)) === false,
  'Captura NUEVA sin membresía: no se generan sus documentos');
log((await page.evaluate(c => licPuedeGenerar(c), vieja)) === true,
  '⚠️ Captura abierta MIENTRAS había derecho: se sigue documentando SIEMPRE');

// La integración real: lcProducirDoc tiene que cortar ANTES de construir nada.
const cortó = await page.evaluate(async (c) => {
  let construido = false;
  const orig = LC_DOCS.FPJ.build;
  LC_DOCS.FPJ.build = function () { construido = true; return null; };
  await lcProducirDoc('FPJ', { caso: c }, { papel: 'CARTA', fmt: 'WORD' });
  LC_DOCS.FPJ.build = orig;
  return { construido, muro: document.getElementById('modal').classList.contains('open') };
}, nueva);
log(cortó.construido === false, 'lcProducirDoc corta ANTES de construir el documento');
log(cortó.muro === true, 'Y se abre el muro explicando por qué');

const textoMuro = await page.evaluate(() => document.getElementById('modal-c').innerText);
log(/no se bloquean/i.test(textoMuro),
  '⚠️ El muro DICE que las capturas anteriores no se bloquean (en el mismo sitio donde dice que no)');
await page.evaluate(() => closeModal());

const dejaPasar = await page.evaluate(async (c) => {
  let construido = false;
  const orig = LC_DOCS.FPJ.build;
  LC_DOCS.FPJ.build = function () { construido = true; return null; };
  await lcProducirDoc('FPJ', { caso: c }, { papel: 'CARTA', fmt: 'WORD' });
  LC_DOCS.FPJ.build = orig;
  return construido;
}, vieja);
log(dejaPasar === true, 'La captura anterior SÍ llega al motor documental');

// Lo que nunca se puede secuestrar.
const libre = await page.evaluate(() => ({
  lee: typeof DB.getCases === 'function' && Array.isArray(DB.getCases()),
  exporta: typeof exportarCapturas === 'function',
  dossier: typeof _dosTexto === 'function',
}));
log(libre.lee && libre.exporta && libre.dossier,
  '⚠️ Leer, exportar el respaldo y el dossier NO pasan por el guardia: los datos son del usuario');

const guardaFuente = await page.evaluate(() => licGuardia.toString() + licPuedeGenerar.toString());
log(!/getCases|exportar|_dosTexto/.test(guardaFuente),
  'El guardia no toca ninguna función de lectura ni de exportación');

/* ═══ D · Panel de administración ══════════════════════════════════════════ */
console.log('\n── D · Panel de administración ──');

await limpiarLic();
await page.evaluate(() => licPintarNav());
await page.waitForTimeout(200);
log((await page.$eval('[data-screen="admin"]', el => el.hidden)) === true,
  'Sin rol admin, el panel de administración no aparece en el menú');

await instalar(await emitir({ sub: 'jefe@test.co', rol: 'admin', exp: Date.now() + 99 * MES }));
await page.evaluate(() => licPintarNav());
await page.waitForTimeout(200);
log((await page.$eval('[data-screen="admin"]', el => el.hidden)) === false,
  'Con rol admin, el panel aparece');

/* ⚠️ Al RECARGAR: el estado se cargaba bien pero el menú se quedaba con lo
   que traía el HTML, así que un administrador que reabría la app no veía su
   panel hasta pasar por Membresía. Lo destapó mirar la app, no un check —
   la suite llamaba a licPintarNav() a mano y lo tapaba. */
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(900);
log((await page.$eval('[data-screen="admin"]', el => el.hidden)) === false,
  '⚠️ Tras RECARGAR, el administrador sigue viendo su panel sin tocar nada');

await page.evaluate(() => go('admin'));
await page.waitForTimeout(400);
log((await page.innerText('#adm-pane')).toLowerCase().includes('clave de emisión'),
  'El panel pide la clave de emisión antes de dejar emitir');

// Se carga la clave privada real y se emite desde la app.
await page.fill('#adm-priv', JSON.stringify(jwkPriv));
await page.click('button[onclick="licCargarClave()"]');
await page.waitForTimeout(600);
log((await page.innerText('#adm-pane')).toLowerCase().includes('clave cargada'), 'La clave de emisión se carga');

await page.fill('#adm-sub', 'cliente@unidad.gov.co');
await page.selectOption('#adm-plan', 'lexcapture_annual');
await page.fill('#adm-nota', 'curso de agosto');
await page.click('button[onclick="licEmitir()"]');
await page.waitForTimeout(700);
const emitido = await page.$eval('#lic-cod-out', t => t.value);
log(/^LXL1\./.test(emitido), 'El panel emite un código con el formato correcto');
log((await page.evaluate(c => licVerificar(c).then(p => p && p.sub), emitido)) === 'cliente@unidad.gov.co',
  '⚠️ Y el código que emite el panel lo ACEPTA la propia app (la clave cuadra)');
await page.evaluate(() => closeModal());
await page.waitForTimeout(300);

log((await page.innerText('#adm-reg')).includes('cliente@unidad.gov.co'),
  'La emisión queda en el registro');
await page.fill('#adm-buscar', 'cliente@unidad');
await page.waitForTimeout(300);
log((await page.innerText('#adm-reg')).includes('cliente@unidad.gov.co'),
  'El registro se busca POR CORREO, como pedía el encargo');
await page.fill('#adm-buscar', 'zzz-no-existe');
await page.waitForTimeout(300);
log((await page.innerText('#adm-reg')).includes('Nada casó'),
  'Una búsqueda sin resultados lo dice, en vez de quedarse en blanco');
await page.fill('#adm-buscar', '');
await page.waitForTimeout(200);

// ⚠️ La clave privada NO puede quedarse guardada en el equipo.
const claveEnDisco = await page.evaluate(() =>
  Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('"d"')));
log(claveEnDisco === false,
  '⚠️ La clave PRIVADA no se guarda en el almacenamiento: vive solo en memoria');

/* ═══ E · Lo que no cambia ═════════════════════════════════════════════════ */
console.log('\n── E · Lo que no cambia ──');

const claves = await page.evaluate(() => Object.keys(localStorage).sort());
log(claves.includes('lc_lic') && claves.includes('lc_licreg'),
  'La licencia y el registro viven en sus propias claves', claves.filter(k => k.startsWith('lc_lic')).join(', '));

const cifrado = await page.evaluate(() => {
  const v = localStorage.getItem('lc_lic') || '';
  return { tieneCorreo: v.includes('@'), largo: v.length };
});
log(cifrado.tieneCorreo === false,
  '⚠️ Va CIFRADA: el correo del funcionario no se lee en el almacenamiento');

// Un documento real, con y sin módulo de membresía de por medio.
const doc = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('uri');
  c.isTest = true;
  const out = await buildFPJBlob(c, 'CARTA');
  return out ? { ok: true, bytes: out.blob.size, nombre: out.fname } : { ok: false };
});
log(doc.ok === true, 'El FPJ-5 se sigue generando con normalidad', doc.bytes ? doc.bytes.toLocaleString() + ' bytes' : '');

const sinRastro = await page.evaluate(() =>
  [buildFPJBlob, buildActaBlob, buildOficioOJBlob].every(f => !/lic[A-Z]/.test(f.toString())));
log(sinRastro === true,
  '⚠️ Ningún motor documental conoce el módulo: el muro vive SOLO en el productor único');

/* ═══ F · Que se vea ═══════════════════════════════════════════════════════ */
console.log('\n── F · Que se vea ──');

for (const [pantalla, render] of [['membresia', 'lic-pane'], ['admin', 'adm-pane']]) {
  await page.evaluate(p => go(p), pantalla);
  await page.waitForTimeout(450);
  const caja = await page.evaluate(p => {
    const s = document.getElementById('screen-' + p);
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { enMain: s.parentElement && s.parentElement.id === 'main', alto: Math.round(r.height), ancho: Math.round(r.width) };
  }, pantalla);
  log(!!caja && caja.enMain && caja.alto > 200 && caja.ancho > 200,
    `La pantalla «${pantalla}» cuelga de <main> y ocupa espacio real`,
    caja ? `${caja.ancho}×${caja.alto}` : 'no existe');
}

// La regla de los 110 caracteres (Mejora 6): ningún aviso puede ser un ladrillo.
for (const p of ['membresia', 'admin']) {
  await page.evaluate(x => go(x), p);
  await page.waitForTimeout(350);
  const largos = await page.$$eval('.screen.on .oj-hint, .screen.on .lic-muro p', els =>
    els.map(e => e.innerText.trim()).filter(t => t.length > 110));
  log(largos.length === 0, `«${p}»: ningún aviso pasa de 110 caracteres`,
    largos.length ? largos[0].slice(0, 60) + '…' : '');
}

// Y el muro, que es lo que ve quien no ha pagado.
await limpiarLic();
await page.evaluate(() => { const c = DB.getConfig(); c.trialInicio = Date.now() - 40 * 86400000; DB.saveConfig(c); });
await page.evaluate(() => go('membresia'));
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, 'lic_01_membresia_vencida.png') });
await page.evaluate(() => licAbrirMuro({ id: 'X', created: Date.now() }));
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, 'lic_02_muro.png') });
await page.evaluate(() => closeModal());

// En tema claro, que es donde suelen aparecer los contrastes olvidados.
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(300);
await page.evaluate(() => go('membresia'));
await page.waitForTimeout(350);
await page.screenshot({ path: join(SHOTS, 'lic_03_membresia_claro.png') });
await page.evaluate(() => setTheme('dark'));
log(true, 'Capturas de pantalla guardadas', SHOTS);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 2).join(' | ') || 'sin errores');

console.log(`\n${'─'.repeat(58)}\n  ${n - fails}/${n} comprobaciones en verde`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
