import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8123;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

const report = [];
function log(ok, label, extra) {
  report.push({ ok, label, extra });
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), label, extra !== undefined ? ('— ' + extra) : '');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // ---- Setup: PIN + caso URI de simulador ----
  await page.fill('#pin-a', '135790');
  await page.fill('#pin-b', '135790');
  await page.click('button[onclick="doSetPin()"]');
  await page.waitForTimeout(400);

  const uriId = await page.evaluate(() => {
    var c = SIM.genFlagrancia('flagrancia-uri');
    c.isTest = false;
    c.nunc = '0500160002062026';
    DB.saveCase(c);
    go('capturas');
    renderCases();
    return c.id;
  });
  await page.waitForTimeout(300);

  // ---- 1. Botón de envío visible en la tarjeta ----
  const sendBtns = await page.$$('#cl .cc-act[title="Enviar documento"]');
  log(sendBtns.length >= 1, '[1] Tarjeta de captura muestra boton "Enviar documento"', 'botones=' + sendBtns.length);
  await page.screenshot({ path: join(ROOT, 'verify_envio_01_tarjeta.png') });

  // ---- 2. Sheet de envío se abre con las 3 opciones ----
  await page.click('#cl .cc-act[title="Enviar documento"]');
  await page.waitForTimeout(350);
  const sheetOn = await page.$eval('#share-sheet', el => el.classList.contains('on'));
  const sheetTitle = await page.$eval('#share-title', el => el.textContent);
  const opts = await page.$$eval('#share-sheet .sheet-item .ti', els => els.map(e => e.textContent));
  log(sheetOn, '[2] Sheet de envio se abre al tocar el boton');
  log(/FPJ-5 URI/.test(sheetTitle), '[2] Titulo del sheet identifica el documento y capturado', sheetTitle);
  log(opts.join(',') === 'WhatsApp,Correo electrónico,Solo descargar', '[2] Opciones: WhatsApp / Correo / Descargar', opts.join(' | '));
  await page.screenshot({ path: join(ROOT, 'verify_envio_02_sheet.png') });

  // ---- 3. Móvil: Web Share API con archivo adjunto (WhatsApp) ----
  await page.evaluate(() => {
    window._shared = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function (d) {
      window._shared = { n: d.files.length, name: d.files[0].name, size: d.files[0].size, type: d.files[0].type, text: d.text };
      return Promise.resolve();
    };
  });
  await page.click('#share-sheet .sheet-item:nth-of-type(1)');
  await page.waitForTimeout(600);
  const shared = await page.evaluate(() => window._shared);
  log(!!shared && shared.n === 1 && /^FPJ5_URI_.*\.docx$/.test(shared.name) && shared.size > 10000,
    '[3] navigator.share recibe el FPJ-5 .docx como archivo', JSON.stringify(shared));
  const sheetClosed = await page.$eval('#share-sheet', el => !el.classList.contains('on'));
  log(sheetClosed, '[3] Sheet se cierra tras enviar');

  // ---- 4. Móvil: opción Correo usa el mismo share nativo con archivo ----
  await page.evaluate(() => { window._shared = null; });
  await page.click('#cl .cc-act[title="Enviar documento"]');
  await page.waitForTimeout(300);
  await page.click('#share-sheet .sheet-item:nth-of-type(2)');
  await page.waitForTimeout(600);
  const shared2 = await page.evaluate(() => window._shared);
  log(!!shared2 && shared2.n === 1 && /\.docx$/.test(shared2.name), '[4] Opcion Correo comparte el .docx adjunto (share nativo)', JSON.stringify(shared2));

  // ---- 5. Opción "Solo descargar" ----
  await page.click('#cl .cc-act[title="Enviar documento"]');
  await page.waitForTimeout(300);
  const [dl1] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(3)')
  ]);
  log(!!dl1 && /^FPJ5_URI_.*\.docx$/.test(dl1.suggestedFilename()), '[5] "Solo descargar" baja el .docx', dl1 ? dl1.suggestedFilename() : '(sin descarga)');

  // ---- 6. Escritorio (sin Web Share de archivos): descarga + abre WhatsApp Web ----
  await page.evaluate(() => {
    navigator.canShare = undefined;
    window._opened = null;
    window.open = function (u) { window._opened = u; return null; };
  });
  await page.click('#cl .cc-act[title="Enviar documento"]');
  await page.waitForTimeout(300);
  const [dl2] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => window._opened);
  log(!!dl2, '[6] Fallback escritorio WA: el .docx se descarga', dl2 ? dl2.suggestedFilename() : '(sin descarga)');
  log(!!opened && opened.startsWith('https://wa.me/?text='), '[6] Fallback escritorio WA: abre wa.me con mensaje', (opened || '').slice(0, 70));
  log(!!opened && decodeURIComponent(opened).includes('Adjunta el archivo'), '[6] Mensaje instruye adjuntar el archivo descargado');

  // ---- 7. NUNC inválido bloquea el envío ----
  const badId = await page.evaluate(() => {
    var c = SIM.genFlagrancia('flagrancia-uri');
    c.nunc = '123';
    DB.saveCase(c);
    renderCases();
    return c.id;
  });
  await page.evaluate((id) => {
    window._shared = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function (d) { window._shared = { name: d.files[0].name }; return Promise.resolve(); };
    abrirEnvioDoc(id);
  }, badId);
  await page.waitForTimeout(300);
  await page.click('#share-sheet .sheet-item:nth-of-type(1)');
  await page.waitForTimeout(500);
  const sharedBad = await page.evaluate(() => window._shared);
  log(sharedBad === null, '[7] Caso con NUNC invalido NO se comparte (bloqueado con aviso)', JSON.stringify(sharedBad));

  // ---- 8. Caso OJ: genera y comparte el documento OJ con plantilla activa ----
  const ojId = await page.evaluate(() => {
    var ts = DB.getTemplates();
    ts.forEach(function (t) { if (t.id === '_builtin_fiscalia') t.tipo = 'fpj5_oj'; });
    DB.saveTemplates(ts);
    var c = SIM.genOJ();
    c.isTest = false;
    DB.saveCase(c);
    renderCases();
    return c.id;
  });
  await page.evaluate((id) => {
    window._shared = null;
    navigator.share = function (d) {
      window._shared = { n: d.files.length, name: d.files[0].name, size: d.files[0].size, type: d.files[0].type, text: d.text };
      return Promise.resolve();
    };
    abrirEnvioDoc(id);
  }, ojId);
  await page.waitForTimeout(300);
  const ojTitle = await page.$eval('#share-title', el => el.textContent);
  log(/Documento OJ/.test(ojTitle), '[8] Sheet identifica documento OJ', ojTitle);
  await page.click('#share-sheet .sheet-item:nth-of-type(1)');
  await page.waitForTimeout(800);
  const sharedOJ = await page.evaluate(() => window._shared);
  log(!!sharedOJ && /^OJ_.*\.docx$/.test(sharedOJ.name) && sharedOJ.size > 1000,
    '[8] navigator.share recibe el documento OJ .docx', JSON.stringify(sharedOJ));

  // ---- 9. Dossier: botón Enviar presente y con etiqueta por tipo ----
  await page.evaluate((id) => { go('dossier'); _dosCasoId = id; renderDossier(); }, uriId);
  await page.waitForTimeout(300);
  const dosSendUri = await page.$eval('#dos-btn-send', el => el.textContent).catch(() => '');
  log(dosSendUri === '📤 Enviar FPJ-5 URI', '[9] Dossier URI: boton Enviar FPJ-5 URI', dosSendUri);
  await page.evaluate((id) => { _dosCasoId = id; var c = DB.getCase(id); updateDosPreview(c); }, ojId);
  await page.waitForTimeout(200);
  const dosSendOj = await page.$eval('#dos-btn-send', el => el.textContent).catch(() => '');
  log(dosSendOj === '📤 Enviar Oficio Disposición', '[9] Dossier OJ: boton Enviar Oficio Disposicion', dosSendOj);
  await page.evaluate(() => { window._shared = null; });
  await page.click('#dos-btn-send');
  await page.waitForTimeout(300);
  const dosSheetOn = await page.$eval('#share-sheet', el => el.classList.contains('on'));
  log(dosSheetOn, '[9] Boton Enviar del dossier abre el sheet de envio');
  await page.screenshot({ path: join(ROOT, 'verify_envio_03_dossier.png') });

  // ---- 10. Descarga normal (regresión descargarFPJ / genDocOJ tras refactor) ----
  await page.evaluate(() => closeShareSheet());
  await page.evaluate((id) => { _dosCasoId = id; renderDossier(); }, uriId);
  const [dl3] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.evaluate(() => descargarFPJ())
  ]);
  log(!!dl3 && /^FPJ5_URI_.*\.docx$/.test(dl3.suggestedFilename()), '[10] descargarFPJ() sigue descargando tras refactor', dl3 ? dl3.suggestedFilename() : '(sin descarga)');
  const [dl4] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.evaluate((id) => { var c = DB.getCase(id); genDocOJ(c, null); }, ojId)
  ]);
  log(!!dl4 && /^OJ_.*\.docx$/.test(dl4.suggestedFilename()), '[10] genDocOJ() sigue descargando tras refactor', dl4 ? dl4.suggestedFilename() : '(sin descarga)');

  // ---- 11. Consola limpia ----
  log(consoleErrors.length === 0, '[11] Sin errores de consola', consoleErrors.slice(0, 5).join(' || '));

  console.log('\n======= REPORTE ENVIO DE DOCUMENTOS =======');
  const fails = report.filter(r => r.ok === false);
  console.log(fails.length === 0 ? 'TODO OK (' + report.length + ' checks)' : fails.length + ' FALLO(S)');
  await browser.close();
  server.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); server.close(); process.exit(1); });
