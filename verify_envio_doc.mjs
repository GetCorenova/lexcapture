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

async function bootAndSeed(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.fill('#pin-a', '135790');
  await page.fill('#pin-b', '135790');
  await page.click('button[onclick="doSetPin()"]');
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    var c = SIM.genFlagrancia('flagrancia-uri');
    c.isTest = false;
    c.nunc = '0500160002062026';
    DB.saveCase(c);
    go('capturas');
    renderCases();
    return c.id;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ================= CONTEXTO ANDROID (uso real en campo) =================
  // Chrome/Android SI permite .docx en Web Share -> debe adjuntarse el archivo.
  // Si el navegador no soporta compartir archivos, plan B: descargar + abrir
  // WhatsApp/correo con el mensaje que indica adjuntar desde Descargas.
  const ctxAndroid = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
  });
  const page = await ctxAndroid.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  const uriId = await bootAndSeed(page);
  await page.waitForTimeout(300);

  // ---- 1. Acción de envío en el menú ⋮ de la captura ----
  await page.click('#cl .prow-more');
  await page.waitForTimeout(300);
  const actTxt = await page.$eval('#act-sheet', el => el.textContent);
  log(/Enviar documento/.test(actTxt), '[1] Menu de la captura ofrece "Enviar documento"', actTxt.replace(/\s+/g, ' ').slice(0, 70));
  await page.evaluate(() => closeActionSheet());
  await page.waitForTimeout(250);

  // ---- 2. Android con Web Share de archivos: el .docx va ADJUNTO ----
  await page.evaluate(() => {
    window._shared = null; window._opened = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function (d) {
      window._shared = { n: d.files.length, name: d.files[0].name, size: d.files[0].size, type: d.files[0].type };
      return Promise.resolve();
    };
    // Devuelve un objeto: es lo que hace un window.open permitido (con activacion
    // del tap). Si devolviera null, _openExt lo tomaria como popup bloqueado y
    // navegaria la pestaña a wa.me.
    window.open = function (u) { window._opened = u; return {}; };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(600);   // deja terminar la pre-generacion del .docx
  const sheetOn = await page.$eval('#share-sheet', el => el.classList.contains('on'));
  const deWaShare = await page.$eval('#share-de-wa', el => el.textContent);
  log(sheetOn, '[2] Sheet de envio se abre');
  log(/adjunt/i.test(deWaShare) && !/clip/.test(deWaShare), '[2] Android: descripcion WhatsApp anuncia adjunto directo', deWaShare);
  await page.screenshot({ path: join(ROOT, 'verify_envio_02_sheet.png') });

  const [dlNone] = await Promise.all([
    page.waitForEvent('download', { timeout: 2500 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  await page.waitForTimeout(400);
  const r2 = await page.evaluate(() => ({ shared: window._shared, opened: window._opened }));
  log(!!r2.shared && r2.shared.n === 1 && /^FPJ5_URI_.*\.docx$/.test(r2.shared.name) && r2.shared.size > 10000,
    '[2] Android WA: navigator.share recibe el .docx adjunto', JSON.stringify(r2.shared));
  log(!!r2.shared && /wordprocessingml\.document$/.test(r2.shared.type), '[2] MIME correcto de .docx', r2.shared && r2.shared.type);
  log(r2.opened === null, '[2] Android WA: NO abre wa.me solo-texto cuando puede adjuntar', String(r2.opened));
  log(dlNone === null, '[2] Android WA: no fuerza descarga cuando adjunta', dlNone ? dlNone.suggestedFilename() : '(sin descarga)');

  // ---- 3. Sin Web Share de archivos: plan B (descarga + wa.me con mensaje) ----
  await page.evaluate(() => {
    window._shared = null; window._opened = null;
    navigator.canShare = function () { return false; };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(600);
  const deWa = await page.$eval('#share-de-wa', el => el.textContent);
  const deMail = await page.$eval('#share-de-mail', el => el.textContent);
  log(/clip 📎/.test(deWa), '[3] Sin share: descripcion WhatsApp explica descarga + adjuntar', deWa);
  log(/Descargas/.test(deMail), '[3] Sin share: descripcion Correo explica descarga + adjuntar', deMail);
  const [dlWa] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  await page.waitForTimeout(400);
  const r3 = await page.evaluate(() => ({ shared: window._shared, opened: window._opened }));
  log(!!dlWa && /^FPJ5_URI_.*\.docx$/.test(dlWa.suggestedFilename()), '[3] Plan B: el .docx se descarga', dlWa ? dlWa.suggestedFilename() : '(sin descarga)');
  log(!!r3.opened && r3.opened.startsWith('https://wa.me/?text='), '[3] Plan B: abre wa.me con mensaje', (r3.opened || '').slice(0, 60));
  log(r3.shared === null, '[3] Plan B: no llama a navigator.share', String(r3.shared));
  log(!!r3.opened && decodeURIComponent(r3.opened).includes('Adjunta el archivo'), '[3] Mensaje instruye adjuntar desde Descargas');

  // ---- 4. Correo sin Web Share: descarga + mailto con asunto ----
  // El mailto se abre con _navExt (location.href): no requiere activacion del tap.
  await page.evaluate(() => {
    window._mailto = null;
    window._navExt = function (u) { window._mailto = u; };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(300);
  const [dlMail] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(2)')
  ]);
  await page.waitForTimeout(400);
  const mailto = await page.evaluate(() => window._mailto);
  log(!!dlMail, '[4] Android Correo: el .docx se descarga', dlMail ? dlMail.suggestedFilename() : '(sin descarga)');
  log(!!mailto && mailto.startsWith('mailto:?subject=') && decodeURIComponent(mailto).includes('FPJ-5 URI'), '[4] Android Correo: abre mailto con asunto', (mailto || '').slice(0, 60));

  // ---- 5. Solo descargar ----
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(300);
  const [dl1] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(3)')
  ]);
  log(!!dl1 && /^FPJ5_URI_.*\.docx$/.test(dl1.suggestedFilename()), '[5] "Solo descargar" baja el .docx', dl1 ? dl1.suggestedFilename() : '(sin descarga)');

  // ---- 6. NUNC inválido bloquea el envío ----
  const badId = await page.evaluate(() => {
    var c = SIM.genFlagrancia('flagrancia-uri');
    c.nunc = '123';
    DB.saveCase(c);
    renderCases();
    return c.id;
  });
  await page.evaluate((id) => { window._opened = null; abrirEnvioDoc(id); }, badId);
  await page.waitForTimeout(300);
  const [dlBad] = await Promise.all([
    page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  const openedBad = await page.evaluate(() => window._opened);
  log(dlBad === null && openedBad === null, '[6] Caso con NUNC invalido NO descarga ni abre WhatsApp', 'dl=' + (dlBad ? dlBad.suggestedFilename() : 'null') + ' opened=' + openedBad);

  // ---- 7. Caso OJ con plantilla activa ----
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
  await page.evaluate((id) => { window._opened = null; abrirEnvioDoc(id); }, ojId);
  await page.waitForTimeout(300);
  const ojTitle = await page.$eval('#share-title', el => el.textContent);
  log(/Documento OJ/.test(ojTitle), '[7] Sheet identifica documento OJ', ojTitle);
  const [dlOj] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  await page.waitForTimeout(400);
  const openedOj = await page.evaluate(() => window._opened);
  log(!!dlOj && /^OJ_.*\.docx$/.test(dlOj.suggestedFilename()), '[7] Android OJ: el documento OJ se descarga', dlOj ? dlOj.suggestedFilename() : '(sin descarga)');
  log(!!openedOj && openedOj.startsWith('https://wa.me/'), '[7] Android OJ: abre wa.me', (openedOj || '').slice(0, 40));

  // ---- 8. Dossier: botón Enviar por tipo ----
  await page.evaluate((id) => { go('dossier'); _dosCasoId = id; renderDossier(); }, uriId);
  await page.waitForTimeout(300);
  const dosSendUri = await page.$eval('#dos-btn-send', el => el.textContent).catch(() => '');
  log(/Enviar FPJ-5 URI/.test(dosSendUri), '[8] Dossier URI: boton Enviar FPJ-5 URI', dosSendUri);
  await page.evaluate((id) => { _dosCasoId = id; var c = DB.getCase(id); updateDosPreview(c); }, ojId);
  await page.waitForTimeout(200);
  const dosSendOj = await page.$eval('#dos-btn-send', el => el.textContent).catch(() => '');
  log(/Enviar Oficio Disposición/.test(dosSendOj), '[8] Dossier OJ: boton Enviar Oficio Disposicion', dosSendOj);
  await page.click('#dos-btn-send');
  await page.waitForTimeout(300);
  const dosSheetOn = await page.$eval('#share-sheet', el => el.classList.contains('on'));
  log(dosSheetOn, '[8] Boton Enviar del dossier abre el sheet');
  await page.evaluate(() => closeShareSheet());

  // ---- 9. Regresión: descarga clásica sigue funcionando ----
  await page.evaluate((id) => { _dosCasoId = id; renderDossier(); }, uriId);
  const [dl3] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.evaluate(() => descargarFPJ())
  ]);
  log(!!dl3 && /^FPJ5_URI_.*\.docx$/.test(dl3.suggestedFilename()), '[9] descargarFPJ() sigue descargando', dl3 ? dl3.suggestedFilename() : '(sin descarga)');
  const [dl4] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.evaluate((id) => { var c = DB.getCase(id); genDocOJ(c, null); }, ojId)
  ]);
  log(!!dl4 && /^OJ_.*\.docx$/.test(dl4.suggestedFilename()), '[9] genDocOJ() sigue descargando', dl4 ? dl4.suggestedFilename() : '(sin descarga)');

  // ---- 10. Consola limpia (Android) ----
  log(consoleErrors.length === 0, '[10] Sin errores de consola (Android)', consoleErrors.slice(0, 5).join(' || '));
  await ctxAndroid.close();

  // ================= CONTEXTO iOS (share nativo con archivo) =================
  // Safari/iOS SI permite compartir .docx via Web Share -> debe usar navigator.share.
  const ctxIos = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page2 = await ctxIos.newPage();
  const consoleErrors2 = [];
  page2.on('pageerror', e => consoleErrors2.push('pageerror: ' + e.message));
  const uriId2 = await bootAndSeed(page2);
  await page2.waitForTimeout(300);
  await page2.evaluate(() => {
    window._shared = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function (d) {
      window._shared = { n: d.files.length, name: d.files[0].name, size: d.files[0].size, text: d.text };
      return Promise.resolve();
    };
  });
  await page2.evaluate((id) => abrirEnvioDoc(id), uriId2);
  await page2.waitForTimeout(700);
  const deWaIos = await page2.$eval('#share-de-wa', el => el.textContent);
  log(/archivo adjunto/.test(deWaIos), '[11] iOS: descripcion indica envio como adjunto directo', deWaIos);
  await page2.click('#share-sheet .sheet-item:nth-of-type(1)');
  await page2.waitForTimeout(600);
  const sharedIos = await page2.evaluate(() => window._shared);
  log(!!sharedIos && sharedIos.n === 1 && /^FPJ5_URI_.*\.docx$/.test(sharedIos.name) && sharedIos.size > 10000,
    '[11] iOS: navigator.share recibe el .docx adjunto', JSON.stringify(sharedIos));
  log(consoleErrors2.length === 0, '[11] Sin errores de consola (iOS)', consoleErrors2.slice(0, 3).join(' || '));

  // ========== 12. share() RECHAZADO POR EL DISPOSITIVO (caso reportado en campo) ==========
  // canShare dice que si, pero share() rechaza (NotAllowedError). Antes el usuario
  // quedaba tirado: solo se descargaba el .docx y no se abria ni WhatsApp ni correo.
  const ctx3 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
  });
  const page3 = await ctx3.newPage();
  const consoleErrors3 = [];
  page3.on('pageerror', e => consoleErrors3.push('pageerror: ' + e.message));
  const uriId3 = await bootAndSeed(page3);
  await page3.waitForTimeout(300);
  await page3.evaluate(() => {
    window._shared = null; window._opened = null; window._navegado = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function () {
      window._shared = 'intentado';
      var err = new Error('Permission denied'); err.name = 'NotAllowedError';
      return Promise.reject(err);
    };
    window.open = function () { return null; };            // popup bloqueado: sin activacion
    window._navExt = function (u) { window._navegado = u; };
  });

  // Estado "preparando": los botones se bloquean mientras se genera el .docx
  await page3.evaluate(() => { _shareBusy(true); _shareHint('busy'); });
  const busyDis = await page3.$eval('#share-it-wa', el => el.disabled);
  const busyTxt = await page3.$eval('#share-de-wa', el => el.textContent);
  log(busyDis && /Preparando/.test(busyTxt), '[12] Mientras se genera, WhatsApp queda bloqueado', busyTxt);

  await page3.evaluate((id) => abrirEnvioDoc(id), uriId3);
  await page3.waitForTimeout(700);
  log(await page3.$eval('#share-it-wa', el => !el.disabled), '[12] Con el .docx listo, el boton se habilita');

  const [dlFail] = await Promise.all([
    page3.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page3.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  await page3.waitForTimeout(500);
  const r12 = await page3.evaluate(() => ({ shared: window._shared, nav: window._navegado, flag: localStorage.getItem('lc_share_files') }));
  log(r12.shared === 'intentado', '[12] Primer envio SI intenta adjuntar directo');
  log(!!dlFail, '[12] Share fallido: el .docx se descarga', dlFail ? dlFail.suggestedFilename() : '(sin descarga)');
  log(!!r12.nav && r12.nav.startsWith('https://wa.me/?text='), '[12] Share fallido: IGUAL abre WhatsApp (antes no abria nada)', (r12.nav || '(nada)').slice(0, 50));
  log(r12.flag === 'off', '[12] El dispositivo queda marcado como "no adjunta"', String(r12.flag));

  // Segundo envio: ya no gasta el tap en share(); plan B con window.open (hay activacion)
  await page3.evaluate(() => { window._shared = null; window._navegado = null; window._opened = null; window.open = function (u) { window._opened = u; return {}; }; });
  await page3.evaluate((id) => abrirEnvioDoc(id), uriId3);
  await page3.waitForTimeout(600);
  const deWa2 = await page3.$eval('#share-de-wa', el => el.textContent);
  log(/clip 📎/.test(deWa2), '[12] Segundo envio: la descripcion ya anuncia el plan B', deWa2);
  await Promise.all([
    page3.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page3.click('#share-sheet .sheet-item:nth-of-type(1)')
  ]);
  await page3.waitForTimeout(400);
  const r12b = await page3.evaluate(() => ({ shared: window._shared, opened: window._opened, nav: window._navegado }));
  log(r12b.shared === null, '[12] Segundo envio: NO vuelve a intentar share (no quema el tap)', String(r12b.shared));
  log(!!r12b.opened && r12b.opened.startsWith('https://wa.me/?text='), '[12] Segundo envio: abre WhatsApp con window.open, sin sacar al usuario de la app', (r12b.opened || '(nada)').slice(0, 50));
  log(r12b.nav === null, '[12] Segundo envio: no navega la pestaña fuera de la app', String(r12b.nav));

  // Correo con el dispositivo ya marcado
  await page3.evaluate(() => { window._mailto = null; window._navExt = function (u) { window._mailto = u; }; });
  await page3.evaluate((id) => abrirEnvioDoc(id), uriId3);
  await page3.waitForTimeout(500);
  await Promise.all([
    page3.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page3.click('#share-sheet .sheet-item:nth-of-type(2)')
  ]);
  await page3.waitForTimeout(400);
  const mailto2 = await page3.evaluate(() => window._mailto);
  log(!!mailto2 && mailto2.startsWith('mailto:?subject=') && decodeURIComponent(mailto2).includes('Adjunta el archivo'),
    '[12] Correo: abre el cliente de correo con el mensaje listo', (mailto2 || '(nada)').slice(0, 55));
  log(consoleErrors3.length === 0, '[12] Sin errores de pagina', consoleErrors3.slice(0, 3).join(' || '));
  await ctx3.close();

  console.log('\n======= REPORTE ENVIO DE DOCUMENTOS =======');
  const fails = report.filter(r => r.ok === false);
  console.log(fails.length === 0 ? 'TODO OK (' + report.length + ' checks)' : fails.length + ' FALLO(S)');
  await browser.close();
  server.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); server.close(); process.exit(1); });
