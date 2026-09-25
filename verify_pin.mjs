/* EL PIN SE VERIFICA DESCIFRANDO — Fase 0 (2026-09-25).

   ⚠️ Lo que había: `lc_key_hash` = SHA-256(sal‖PIN) de UNA pasada, que con una copia
   del almacenamiento dejaba probar los 10 000 PIN en menos de un segundo; y un
   contador de intentos EN MEMORIA, que se ponía a cero al recargar la página.

   Lo que se mide aquí: que no quede hash, que el PIN correcto abra y el incorrecto
   no, que los intentos fallidos se cuenten en disco y la espera crezca, que un
   equipo anterior a la Fase 0 entre sin perder nada y pierda el hash al entrar, y
   que «Olvidé mi PIN» borre también IndexedDB. */
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
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);

/* ── 1 · Crear el PIN ─────────────────────────────────────────────────── */
await page.fill('#pin-a', '4826'); await page.fill('#pin-b', '4826');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(1200);
const p1 = await page.evaluate(() => ({
  hash: localStorage.getItem('lc_key_hash'),
  check: localStorage.getItem('lc_key_check'),
  sesion: !!_sessionKey
}));
log(p1.hash === null, '[P1] crear el PIN ya NO guarda un hash del PIN');
log(!!p1.check && p1.check.indexOf('flagrante') < 0 && p1.sesion,
    '[P2] guarda un verificador cifrado, sin la constante a la vista');
log(!/localStorage\.setItem\('lc_key_hash'/.test(src), '[P3] ninguna línea del código escribe lc_key_hash');

await page.evaluate(async () => { await DB.saveCases([{ id: 'pc1', tipo: 'URI', created: Date.now(), capturados: [{ id: 'q', priNom: 'ROSA' }] }]); });

/* ── 2 · PIN incorrecto, con el contador en disco ─────────────────────── */
async function intentar(pin) {
  await page.fill('#pin-e', pin);
  await page.click('button[onclick="doUnlockPin()"]');
  await page.waitForFunction(() => { const e = document.getElementById('pin-err'); return e && e.textContent && e.textContent !== 'Verificando...'; }, null, { timeout: 5000 }).catch(() => {});
  return page.evaluate(() => ({ err: (document.getElementById('pin-err') || {}).textContent || '',
                                sesion: !!_sessionKey, disco: localStorage.getItem('lc_pin_intentos') }));
}
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
const m1 = await intentar('1111');
log(!m1.sesion && /incorrecto/i.test(m1.err), '[P4] un PIN incorrecto no abre', m1.err);
log(m1.disco && JSON.parse(m1.disco).n === 1, '[P5] el intento fallido queda contado EN DISCO', m1.disco);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
const d2 = await page.evaluate(() => JSON.parse(localStorage.getItem('lc_pin_intentos') || '{}').n);
log(d2 === 1, '[P6] recargar la app ya NO pone el contador a cero', d2);

let m;
for (const p of ['2222', '3333', '4444']) m = await intentar(p);
m = await intentar('5555');
log(/espera/i.test(m.err) && JSON.parse(m.disco).hasta > Date.now(), '[P7] al quinto fallo hay que esperar', m.err);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
const bloq = await intentar('4826');
log(!bloq.sesion && /espera/i.test(bloq.err), '[P8] la espera sobrevive a recargar, ni el PIN correcto entra', bloq.err);

/* La espera CRECE: se simula que pasó la primera y se vuelve a fallar. */
await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('lc_pin_intentos')); o.hasta = 0; localStorage.setItem('lc_pin_intentos', JSON.stringify(o)); });
const t0 = Date.now();
const m6 = await intentar('6666');
const hasta6 = JSON.parse(m6.disco).hasta - t0;
log(hasta6 > 45000 && /espera/i.test(m6.err), '[P9] y cada fallo más la dobla (60 s tras el sexto)', Math.round(hasta6 / 1000) + ' s');

await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('lc_pin_intentos')); o.hasta = 0; localStorage.setItem('lc_pin_intentos', JSON.stringify(o)); });
const ok = await intentar('4826');
await page.waitForTimeout(800);
const trasOk = await page.evaluate(() => ({ sesion: !!_sessionKey, disco: localStorage.getItem('lc_pin_intentos'),
                                            caso: !!DB.getCase('pc1') }));
log(trasOk.sesion && trasOk.caso, '[P10] el PIN correcto abre y los datos están');
log(trasOk.disco === null, '[P11] y entrar bien pone el contador a cero');

/* ── 3 · Un equipo ANTERIOR a la Fase 0 ───────────────────────────────── */
/* Se reconstruye el almacenamiento tal como lo dejaba el build 131: sal, hash de
   una pasada, capturas cifradas con la llave del PIN y SIN verificador. */
await page.evaluate(async () => {
  const pin = '9090';
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await _lcDeriveKey(pin, salt);
  const hash = await _lcHashPin(pin, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key,
    new TextEncoder().encode(JSON.stringify([{ id: 'legado', tipo: 'URI', created: 1, capturados: [{ id: 'l', priNom: 'VIEJO' }] }])));
  const buf = new Uint8Array(12 + enc.byteLength); buf.set(iv); buf.set(new Uint8Array(enc), 12);
  localStorage.clear();
  localStorage.setItem('lc_key_salt', _b64FromBytes(salt));
  localStorage.setItem('lc_key_hash', hash);
  localStorage.setItem('lc_cases', _b64FromBytes(buf));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
const leg1 = await intentar('1234');
log(!leg1.sesion, '[P12] en un equipo de antes, un PIN incorrecto sigue sin abrir');
await page.evaluate(() => localStorage.removeItem('lc_pin_intentos'));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
await intentar('9090');
await page.waitForTimeout(800);
const leg2 = await page.evaluate(() => ({
  sesion: !!_sessionKey, caso: !!DB.getCase('legado'),
  hash: localStorage.getItem('lc_key_hash'), check: !!localStorage.getItem('lc_key_check')
}));
log(leg2.sesion && leg2.caso, '[P13] el PIN de siempre abre y las capturas de antes están', JSON.stringify(leg2));
log(leg2.hash === null && leg2.check, '[P14] y en ese primer desbloqueo el hash desaparece y nace el verificador');

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
await intentar('9090');
await page.waitForTimeout(600);
const leg3 = await page.evaluate(() => !!_sessionKey && !!DB.getCase('legado'));
log(leg3, '[P15] y las siguientes veces entra por el verificador');

/* ── 4 · «Olvidé mi PIN» también borra IndexedDB ──────────────────────── */
await page.evaluate(async () => { await lcIdbSet('sync_base', 'algo-cifrado'); });
const antes = await page.evaluate(async () => await lcIdbGet('sync_base'));
await page.evaluate(() => forgotPin());
await page.waitForTimeout(1500);
const despues = await page.evaluate(async () => ({
  base: await lcIdbGet('sync_base'),
  claves: Object.keys(localStorage).filter(k => k !== 'lc_theme')
}));
log(antes === 'algo-cifrado' && despues.base === undefined && despues.claves.length === 0,
    '[P16] «Olvidé mi PIN» borra también la base de la sincronización en IndexedDB', JSON.stringify(despues));

log(errs.length === 0, '[P17] consola limpia', errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
const n = R.filter(Boolean).length;
console.log('\n' + n + '/' + R.length + (n === R.length ? '  TODO OK' : '  ⚠️ HAY FALLOS'));
process.exit(n === R.length ? 0 : 1);
