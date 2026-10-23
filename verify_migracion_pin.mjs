/* SIN PIN · F1 de la cuenta (2026-10-23).

   El PIN desapareció: la app abre directo y cifra en reposo con una LLAVE DEL
   EQUIPO (WebCrypto, no extraíble, guardada en IndexedDB). Sustituye a
   verify_pin.mjs, que medía la verificación del PIN de la Fase 0.

   Lo que se mide aquí:
   · un equipo recién instalado abre directo y no escribe nada del PIN;
   · un equipo con PIN pasa UNA vez por la migración: el PIN incorrecto no abre y
     se cuenta en disco, el correcto re-cifra todo con la llave del equipo, no se
     pierde un dato y no queda rastro del PIN;
   · una migración interrumpida a mitad de camino se completa sin perder nada;
   · un equipo con datos que NO abren con su llave no arranca la sesión ni los
     pisa (antes, un fallo de descifrado dejaba la caché vacía y el siguiente
     guardado borraba lo que había en disco);
   · «Olvidé mi PIN» borra también IndexedDB (y con ella la llave). */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8161, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
page.on('dialog', d => d.accept());

const URL = 'http://localhost:8161/LexCapture_v8.html';
const listo = () => page.waitForFunction(() => window._lcListo === true, null, { timeout: 8000 });

/* ── 1 · Equipo recién instalado ───────────────────────────────────────── */
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(async () => { localStorage.clear(); await lcIdbBorrarTodo(); });
await page.reload({ waitUntil: 'load' });
await listo();
const n1 = await page.evaluate(async () => {
  await DB.saveCases([{ id: 'n1', tipo: 'URI', created: Date.now(), capturados: [{ id: 'z', priNom: 'ANA' }] }]);
  const k = await lcIdbGet('llave_equipo');
  let exporta = true;
  try { await crypto.subtle.exportKey('raw', k); } catch (e) { exporta = false; }
  const raw = String((await lcIdbGet('lc_cases')) || '');
  return { ov: document.getElementById('pin-ov').classList.contains('on'), sesion: !!_sessionKey,
           salt: localStorage.getItem('lc_key_salt'), check: localStorage.getItem('lc_key_check'),
           ext: k && k.extractable, exporta, enClaro: /ANA/.test(raw) || raw.charAt(0) === '[' };
});
log(!n1.ov && n1.sesion, '[M1] un equipo recién instalado abre directo, sin pantalla de PIN');
log(n1.salt === null && n1.check === null, '[M2] y no escribe nada del PIN (ni sal ni verificador)');
log(n1.ext === false && !n1.exporta, '[M3] la llave del equipo NO es extraíble: ni la propia app puede leer sus bytes');
log(!n1.enClaro, '[M4] lo guardado sigue cifrado en disco');
log(!/setItem\('lc_key_salt'/.test(src) && !/setItem\('lc_key_check'/.test(src),
    '[M5] ninguna línea del código vuelve a escribir la sal ni el verificador del PIN');
log(['showPinSetup', 'doSetPin', 'showPinEntry', 'doUnlockPin', 'forgotPin', '_lcPinVerificadorCrear']
      .every(f => !new RegExp('function ' + f + '\\b').test(src)),
    '[M6] el subsistema del PIN se retiró entero (no queda código sin puerta)');

await page.reload({ waitUntil: 'load' });
await listo();
const n2 = await page.evaluate(() => ({ ov: document.getElementById('pin-ov').classList.contains('on'), c: (DB.getCase('n1') || {}).capturados }));
log(!n2.ov && n2.c && n2.c[0].priNom === 'ANA', '[M7] al volver a abrir entra directo y con sus datos');

/* ── 2 · Un equipo de una versión con PIN ──────────────────────────────── */
async function sembrarLegado(pin, opt = {}) {
  return page.evaluate(async ([pin, hashOnly, parcial]) => {
    localStorage.clear(); await lcIdbBorrarTodo(); _sessionKey = null;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    _sessionKey = await _lcDeriveKey(pin, salt);
    localStorage.setItem('lc_key_salt', _b64FromBytes(salt));
    if (hashOnly) localStorage.setItem('lc_key_hash', await _lcHashPin(pin, salt));
    else localStorage.setItem('lc_key_check', await _lcEncrypt(LC_PIN_CHECK));
    const casos = [{ id: 'm1', tipo: 'URI', created: Date.now(), capturados: [{ id: 'q1', priNom: 'ROSA', priApe: 'LOPEZ', numDoc: '111' }] }];
    localStorage.setItem('lc_cases', await _lcEncrypt(JSON.stringify(casos)));
    localStorage.setItem('lc_persons', await _lcEncrypt(JSON.stringify([{ id: 'q1', priNom: 'ROSA', priApe: 'LOPEZ', numDoc: '111', rol: 'Capturado' }])));
    localStorage.setItem('lc_cfg', await _lcEncrypt(JSON.stringify({ nombreEstacion: 'ESTACION MIGRADA' })));
    localStorage.setItem('lc_firmas', await _lcEncrypt(JSON.stringify({ p1: { b64: 'AAAA', w: 10, h: 5 } })));
    localStorage.setItem('lc_draft', await _lcEncrypt(JSON.stringify({ caso: { id: 'd1', tipo: 'URI' }, paso: 2 })));
    await lcIdbSet('sync_base', 'base-cifrada-con-el-pin');
    if (parcial) {   // una migración que se cortó tras re-cifrar solo las capturas
      const r = await lcLlaveEquipo(); _sessionKey = r.key;
      localStorage.setItem('lc_cases', await _lcEncrypt(JSON.stringify(casos)));
    }
    _sessionKey = null;
    return _b64FromBytes(salt);
  }, [pin, !!opt.hashOnly, !!opt.parcial]);
}
async function intentar(pin) {
  await page.fill('#pin-e', pin);
  await page.click('button[onclick="doMigrarPin()"]');
  await page.waitForFunction(() => {
    const e = document.getElementById('pin-err');
    return window._lcListo === true || (e && e.textContent && !/Verificando|Pasando/.test(e.textContent));
  }, null, { timeout: 8000 }).catch(() => {});
  return page.evaluate(() => ({ err: (document.getElementById('pin-err') || {}).textContent || '',
                                sesion: !!_sessionKey, disco: localStorage.getItem('lc_pin_intentos') }));
}

const salt = await sembrarLegado('4826');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
const g1 = await page.evaluate(() => ({ ov: document.getElementById('pin-ov').classList.contains('on'),
  campo: !!document.getElementById('pin-e'), txt: (document.getElementById('pin-box') || {}).innerText || '' }));
log(g1.ov && g1.campo && /última vez/i.test(g1.txt), '[M8] un equipo con PIN pide el PIN UNA última vez, y dice para qué', g1.txt.replace(/\n/g, ' · ').slice(0, 90));

const m1 = await intentar('1111');
log(!m1.sesion && /incorrecto/i.test(m1.err), '[M9] un PIN incorrecto no abre', m1.err);
log(m1.disco && JSON.parse(m1.disco).n === 1, '[M10] y el intento queda contado EN DISCO', m1.disco);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
const d2 = await page.evaluate(() => JSON.parse(localStorage.getItem('lc_pin_intentos') || '{}').n);
log(d2 === 1, '[M11] recargar no pone el contador a cero: la migración no es la puerta para probar los 10 000 PIN', d2);

const ok = await intentar('4826');
await listo();
const m2 = await page.evaluate(async (saltB64) => {
  const c = DB.getCase('m1'), cfg = DB.getConfig();
  /* F4: tras la migración las capturas quedan en IndexedDB. */
  await new Promise(r => setTimeout(r, 300));
  const raw = (await lcIdbGet('lc_cases')) || localStorage.getItem('lc_cases');
  /* ¿Lo nuevo todavía abre con la llave del PIN? No debería. */
  const vieja = await _lcDeriveKey('4826', Uint8Array.from(atob(saltB64), x => x.charCodeAt(0)));
  let abreConPin = true;
  try { await _lcDescifrarCon(vieja, raw); } catch (e) { abreConPin = false; }
  return {
    ov: document.getElementById('pin-ov').classList.contains('on'),
    caso: c && c.capturados[0].priNom, persona: (DB.getPerson('q1') || {}).priNom,
    cfg: cfg.nombreEstacion, firma: !!DB.getFirma('p1'), draft: !!(DB.getDraft() || {}).caso,
    restos: ['lc_key_salt', 'lc_key_check', 'lc_key_hash', 'lc_pin_intentos'].filter(k => localStorage.getItem(k) !== null),
    base: await lcIdbGet('sync_base'), enClaro: /ROSA/.test(raw), abreConPin
  };
}, salt);
log(ok.sesion && !m2.ov, '[M12] con el PIN correcto la sesión abre y la pantalla se va');
log(m2.caso === 'ROSA' && m2.persona === 'ROSA' && m2.cfg === 'ESTACION MIGRADA' && m2.firma && m2.draft,
    '[M13] no se pierde un dato: capturas, personas, ajustes, firma y borrador', JSON.stringify(m2));
log(m2.restos.length === 0, '[M14] no queda rastro del PIN (sal, verificador, hash, intentos)', JSON.stringify(m2.restos));
log(m2.base === undefined, '[M15] la base de la sincronización (cifrada con el PIN) se retira en vez de quedar ilegible');
log(!m2.enClaro && !m2.abreConPin, '[M16] todo quedó cifrado con la llave del equipo, y ya no abre con la del PIN');

await page.reload({ waitUntil: 'load' });
await listo();
const m3 = await page.evaluate(() => ({ ov: document.getElementById('pin-ov').classList.contains('on'), caso: (DB.getCase('m1') || {}).id }));
log(!m3.ov && m3.caso === 'm1', '[M17] y desde ahí abre directo, sin volver a pedir nada');

/* ── 3 · Un equipo aún más viejo, con el hash rápido de antes de la Fase 0 ── */
await sembrarLegado('1357', { hashOnly: true });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
const h = await intentar('1357');
await listo().catch(() => {});
const h2 = await page.evaluate(() => ({ caso: (DB.getCase('m1') || {}).id, hash: localStorage.getItem('lc_key_hash') }));
log(h.sesion && h2.caso === 'm1' && h2.hash === null, '[M18] un equipo con el hash rápido de antes también migra y lo pierde', JSON.stringify(h2));

/* ── 4 · Una migración interrumpida a mitad de camino ──────────────────── */
await sembrarLegado('2468', { parcial: true });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
const p = await intentar('2468');
await listo().catch(() => {});
const p2 = await page.evaluate(() => ({ caso: (DB.getCase('m1') || {}).id, cfg: DB.getConfig().nombreEstacion, salt: localStorage.getItem('lc_key_salt') }));
log(p.sesion && p2.caso === 'm1' && p2.cfg === 'ESTACION MIGRADA' && p2.salt === null,
    '[M19] si la migración se cortó a mitad de camino, la segunda vuelta la completa sin perder nada', JSON.stringify(p2));

/* ── 5 · Datos que no abren con la llave del equipo ────────────────────── */
const antes = await page.evaluate(async () => {
  const otra = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, otra, new TextEncoder().encode('[{"id":"ajeno"}]'));
  const buf = new Uint8Array(12 + enc.byteLength); buf.set(iv); buf.set(new Uint8Array(enc), 12);
  const b64 = _b64FromBytes(buf);
  /* F4: las capturas viven en IndexedDB, que es lo que se lee primero. */
  await lcIdbSet('lc_cases', b64);
  localStorage.removeItem('lc_cases');
  return b64;
});
const nErr = errs.length;
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);
const il = await page.evaluate(async () => ({
  ov: document.getElementById('pin-ov').classList.contains('on'),
  txt: (document.getElementById('pin-box') || {}).innerText || '', sesion: !!_sessionKey, listo: window._lcListo,
  disco: await lcIdbGet('lc_cases')
}));
errs.splice(nErr);   // el aviso en consola de esta sección es provocado a propósito
log(il.ov && /no se pudieron abrir/i.test(il.txt) && !il.sesion && !il.listo,
    '[M20] si lo guardado no abre con la llave del equipo, NO se arranca la sesión y se dice', il.txt.replace(/\n/g, ' · ').slice(0, 80));
log(il.disco === antes, '[M21] y lo que hay en disco no se pisa (antes, la caché vacía lo habría borrado al guardar)');

/* ── 6 · «Olvidé mi PIN» borra también la llave ────────────────────────── */
await sembrarLegado('9999');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await Promise.all([
  page.waitForNavigation({ waitUntil: 'load' }).catch(() => {}),
  page.click('#pin-box .pin-forget')
]);
await listo();
const f = await page.evaluate(async () => ({
  casos: DB.getCases().length, salt: localStorage.getItem('lc_key_salt'),
  ov: document.getElementById('pin-ov').classList.contains('on')
}));
log(f.casos === 0 && f.salt === null && !f.ov, '[M22] «Olvidé mi PIN» borra todo, llave incluida, y la app arranca de cero', JSON.stringify(f));

log(errs.length === 0, '[M23] consola limpia', errs.join(' | '));

await browser.close(); server.close();
const fallos = R.filter(x => !x).length;
console.log(`\n${R.length - fallos}/${R.length} verificaciones OK`);
process.exit(fallos ? 1 : 0);
