// El expediente del caso: que sea alcanzable desde el menu de la captura y que
// lo que vive dentro funcione. La pantalla existia y se habia quedado sin
// ninguna puerta de entrada, y con ella tres campos que ninguna otra pide.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = process.env.TEMP || '.';
const MIME = { '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.js':'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8121, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 80)); });

await page.goto('http://localhost:8121/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI');
  c.spoa = ''; c.numIncidente = ''; c.recibe = '';
  await DB.saveCase(c);
  go('capturas');
});
await page.waitForTimeout(400);

// [1] el menú SIGUE cabiendo sin desplazarse
await page.click('.cc-wrap .prow-more');
await page.waitForTimeout(350);
const m = await page.evaluate(() => {
  const sh = document.getElementById('act-sheet');
  return {
    n: document.querySelectorAll('#act-items .sheet-item').length,
    alto: sh.scrollHeight,
    tope: Math.round(parseFloat(getComputedStyle(sh).maxHeight)),
    scroll: sh.scrollHeight > sh.clientHeight + 1,
    tit: [...document.querySelectorAll('#act-items .ti')].map(e => e.textContent.trim())
  };
});
log(m.n === 7 && !m.scroll, '[1] El menu sigue en 7 items y no se desplaza', m.alto + 'px de ' + m.tope + 'px');
console.log('      ' + m.tit.join(' | '));

// [2] hay una entrada al expediente
log(m.tit.includes('Expediente del caso'), '[2] El menu ofrece la entrada al expediente');

// [3] abre de verdad la pantalla, con el caso cargado
await page.click('#act-items .sheet-item:has-text("Expediente del caso")');
await page.waitForTimeout(500);
const s3 = await page.evaluate(() => ({
  pantalla: document.getElementById('screen-dossier').classList.contains('on'),
  vacio: getComputedStyle(document.getElementById('dos-empty')).display,
  sub: document.getElementById('dos-sub').textContent,
  texto: (document.getElementById('dos-txt').value || '').slice(0, 40)
}));
log(s3.pantalla && s3.vacio === 'none' && s3.texto.length > 10, '[3] Abre el expediente con el caso cargado', s3.sub);
await page.screenshot({ path: resolve(SHOTS, 'p2_expediente.png'), fullPage: true });

// [4] los tres campos huérfanos se pueden diligenciar y persisten
await page.click('button[onclick="lcDossierExtra()"]');
await page.waitForTimeout(350);
await page.fill('#dx-spoa', '110016000000202400123');
await page.fill('#dx-inc', '884411');
await page.fill('#dx-recibe', 'Fiscal 12 URI - Ana Gomez');
await page.click('button[onclick="lcDossierExtraGuardar()"]');
await page.waitForTimeout(700);
const s4 = await page.evaluate(() => {
  const c = DB.getCase(_dosCasoId);
  return { spoa: c.spoa, inc: c.numIncidente, rec: c.recibe, hint: document.getElementById('dos-extra-hint').textContent };
});
log(s4.spoa === '110016000000202400123' && s4.inc === '884411' && s4.rec.indexOf('Fiscal 12') === 0,
  '[4] SPOA, incidente y fiscal se diligencian y se guardan');
console.log('      ' + s4.hint);

// [5] y salen en el dossier
const s5 = await page.evaluate(() => document.getElementById('dos-txt').value);
log(/SPOA: 110016000000202400123/.test(s5) && /Incidente: 884411/.test(s5), '[5] Salen impresos en la seccion de disposicion');

// [6] sobreviven a recargar
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);
await page.fill('#pin-e', '135790');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(1000);
log(await page.evaluate(() => DB.getCases()[0].spoa) === '110016000000202400123', '[6] Persisten tras recargar');

// [7] el editor de secciones ahora tiene botón y abre
await page.evaluate(() => { _dosCasoId = DB.getCases()[0].id; go('dossier'); });
await page.waitForTimeout(500);
log(!!(await page.$('#dos-sec-btn')), '[7] El editor de secciones tiene boton en pantalla');
await page.click('#dos-sec-btn');
await page.waitForTimeout(400);
const s7 = await page.evaluate(() => ({
  vis: document.getElementById('dos-sec-inner').style.display,
  filas: document.querySelectorAll('#dos-sec-inner .sec-row').length
}));
log(s7.vis === 'block' && s7.filas === 10, '[8] Abre y lista las 10 secciones', s7.filas + ' filas');

// [9] desactivar una sección se refleja en el texto
const s9 = await page.evaluate(async () => {
  const antes = document.getElementById('dos-txt').value;
  toggleSecItem('victima');
  await new Promise(r => setTimeout(r, 200));
  const desp = document.getElementById('dos-txt').value;
  toggleSecItem('victima');
  return { cambio: antes !== desp, tenia: /CTIMA/.test(antes), sigue: /CTIMA/.test(desp) };
});
log(s9.cambio && s9.tenia && !s9.sigue, '[9] Desactivar una seccion la quita del dossier al instante');

// [10] la edición del texto manda sobre lo generado
const s10 = await page.evaluate(() => {
  document.getElementById('dos-txt').value = 'TEXTO EDITADO A MANO';
  return { propio: _dosTexto(_dosCasoId), ajeno: _dosTexto('inexistente') };
});
log(s10.propio === 'TEXTO EDITADO A MANO' && s10.ajeno === '',
  '[10] Compartir y copiar respetan lo editado, y no inventan nada para un caso que no existe');

// [11] otro caso genera el suyo
const s11 = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('CESPA');
  c.id = 'OTRO';
  await DB.saveCase(c);
  const t = _dosTexto('OTRO');
  return t.indexOf('DIOS Y PATRIA') >= 0 && t.indexOf('TEXTO EDITADO') < 0;
});
log(s11, '[11] Otro caso genera su propio dossier, sin arrastrar la edicion del abierto');

// [12] no quedan funciones de salida sin llamador
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const cuenta = n => src.split(new RegExp('\\b' + n + '\\b')).length - 1;
const huerf = ['abrirDossierCaso', 'toggleSecEditor', 'lcDossierExtra', 'copyDosTxt', 'shareDosWA'].filter(n => cuenta(n) < 2);
log(huerf.length === 0, '[12] Ninguna funcion del expediente se quedo sin puerta', huerf.length ? huerf : 'todas alcanzables');

log(errs.length === 0, '[13] Consola sin errores', errs.length ? errs.slice(0, 3) : '');
console.log('\n' + R.filter(Boolean).length + '/' + R.length + ' comprobaciones');
await browser.close();
server.close();
process.exit(R.every(Boolean) ? 0 : 1);
