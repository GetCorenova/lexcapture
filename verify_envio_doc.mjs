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

// Selectores del sheet nuevo: 1 botón "Compartir documento" + 1 "Solo descargar".
const SEL_SHARE = '#share-it-doc';
const SEL_DL = '#share-it-dl';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ================= CONTEXTO ANDROID (uso real en campo) =================
  // La ÚNICA vía web para adjuntar un archivo a WhatsApp/Gmail/correo es la hoja
  // de compartir del sistema (navigator.share con files). La app siempre la abre;
  // el usuario elige la app destino. Si no hay Web Share de archivos -> descarga.
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
  log(/Enviar FPJ-5/.test(actTxt) && /Descargar FPJ-5/.test(actTxt) && /Enviar Dossier/.test(actTxt) && /Copiar Dossier/.test(actTxt),
    '[1] Menu de la captura ofrece enviar/descargar documento y enviar/copiar dossier', actTxt.replace(/\s+/g, ' ').slice(0, 90));
  await page.evaluate(() => closeActionSheet());
  await page.waitForTimeout(250);

  // ---- 2. Android con Web Share de archivos: el .docx va ADJUNTO por la hoja ----
  await page.evaluate(() => {
    window._shared = null; window._opened = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function (d) {
      window._shared = { n: d.files.length, name: d.files[0].name, size: d.files[0].size, type: d.files[0].type, hasText: 'text' in d, hasTitle: 'title' in d };
      return Promise.resolve();
    };
    // window.open ya NO se usa en el flujo de envío (no hay respaldo wa.me/mailto).
    window.open = function (u) { window._opened = u; return {}; };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(600);   // deja terminar la pre-generacion del .docx
  const sheetOn = await page.$eval('#share-sheet', el => el.classList.contains('on'));
  const deShare = await page.$eval('#share-de-doc', el => el.textContent);
  log(sheetOn, '[2] Sheet de envio se abre');
  log(/[Aa]djunt/.test(deShare), '[2] Android: descripcion anuncia adjunto directo (Gmail/Drive/WhatsApp)', deShare);
  await page.screenshot({ path: join(ROOT, 'verify_envio_02_sheet.png') });

  const [dlNone] = await Promise.all([
    page.waitForEvent('download', { timeout: 2500 }).catch(() => null),
    page.click(SEL_SHARE)
  ]);
  await page.waitForTimeout(400);
  const r2 = await page.evaluate(() => ({ shared: window._shared, opened: window._opened }));
  log(!!r2.shared && r2.shared.n === 1 && /^FPJ5_URI_.*\.docx$/.test(r2.shared.name) && r2.shared.size > 10000,
    '[2] navigator.share recibe el .docx adjunto', JSON.stringify(r2.shared));
  log(!!r2.shared && /wordprocessingml\.document$/.test(r2.shared.type), '[2] MIME correcto de .docx', r2.shared && r2.shared.type);
  log(!!r2.shared && r2.shared.hasText === false && r2.shared.hasTitle === false, '[2] Comparte SOLO el archivo (sin text ni title) — compatible con Samsung/WhatsApp');
  log(r2.opened === null, '[2] NO abre wa.me/ventana externa (se eliminó el respaldo de texto)', String(r2.opened));
  log(dlNone === null, '[2] No fuerza descarga cuando adjunta', dlNone ? dlNone.suggestedFilename() : '(sin descarga)');

  // ---- 3. share() RECHAZADO por la app destino (caso Samsung/WhatsApp) ----
  // NO se marca el dispositivo, NO se manda texto: el .docx se descarga y se invita
  // a reintentar eligiendo Gmail o Drive.
  await page.evaluate(() => {
    window._shared = null; window._opened = null;
    localStorage.removeItem('lc_share_files');
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function () {
      window._shared = 'intentado';
      var err = new Error('Permission denied'); err.name = 'NotAllowedError';
      return Promise.reject(err);
    };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(600);
  const [dlFail] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click(SEL_SHARE)
  ]);
  await page.waitForTimeout(500);
  const r3 = await page.evaluate(() => ({ shared: window._shared, opened: window._opened, flag: localStorage.getItem('lc_share_files') }));
  log(r3.shared === 'intentado', '[3] Share rechazado: SI intentó adjuntar por la hoja del sistema');
  log(!!dlFail && /^FPJ5_URI_.*\.docx$/.test(dlFail.suggestedFilename()), '[3] Share rechazado: el .docx queda descargado', dlFail ? dlFail.suggestedFilename() : '(sin descarga)');
  log(r3.opened === null, '[3] Share rechazado: NO abre wa.me solo-texto (fin del spam)', String(r3.opened));
  log(r3.flag === null, '[3] Share rechazado: NO deshabilita el compartir (sin marca lc_share_files)', String(r3.flag));

  // Reintento inmediato: la app VUELVE a intentar el adjunto (no quedó bloqueada) ----
  await page.evaluate(() => {
    window._shared = null;
    navigator.share = function (d) { window._shared = { n: d.files.length, name: d.files[0].name }; return Promise.resolve(); };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(600);
  await page.click(SEL_SHARE);
  await page.waitForTimeout(400);
  const r3b = await page.evaluate(() => window._shared);
  log(!!r3b && r3b.n === 1 && /^FPJ5_URI_.*\.docx$/.test(r3b.name),
    '[3] Reintento: vuelve a intentar el adjunto directo (nunca queda condenado al texto)', JSON.stringify(r3b));

  // ---- 4. Sin Web Share de archivos (escritorio): descarga directa, sin share ----
  await page.evaluate(() => {
    window._shared = null; window._opened = null;
    navigator.canShare = function () { return false; };
  });
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(600);
  const deNoShare = await page.$eval('#share-de-doc', el => el.textContent);
  log(/[Dd]escarga/.test(deNoShare), '[4] Sin Web Share: descripcion explica que solo descarga', deNoShare);
  const [dlDesk] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click(SEL_SHARE)
  ]);
  await page.waitForTimeout(400);
  const r4 = await page.evaluate(() => ({ shared: window._shared, opened: window._opened }));
  log(!!dlDesk && /^FPJ5_URI_.*\.docx$/.test(dlDesk.suggestedFilename()), '[4] Sin Web Share: el .docx se descarga', dlDesk ? dlDesk.suggestedFilename() : '(sin descarga)');
  log(r4.shared === null, '[4] Sin Web Share: no intenta navigator.share', String(r4.shared));
  log(r4.opened === null, '[4] Sin Web Share: no abre ventana externa', String(r4.opened));

  // ---- 5. Solo descargar ----
  await page.evaluate((id) => abrirEnvioDoc(id), uriId);
  await page.waitForTimeout(400);
  const [dl1] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click(SEL_DL)
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
  await page.evaluate((id) => {
    window._opened = null; window._shared = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function () { window._shared = 'intentado'; return Promise.resolve(); };
    abrirEnvioDoc(id);
  }, badId);
  await page.waitForTimeout(400);
  const [dlBad] = await Promise.all([
    page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
    page.click(SEL_SHARE)
  ]);
  const r6 = await page.evaluate(() => ({ opened: window._opened, shared: window._shared }));
  log(dlBad === null && r6.opened === null && r6.shared === null, '[6] Caso con NUNC invalido NO descarga ni comparte', 'dl=' + (dlBad ? dlBad.suggestedFilename() : 'null') + ' shared=' + r6.shared);

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
  await page.evaluate((id) => {
    window._shared = null;
    navigator.canShare = function (d) { return !!(d && d.files && d.files.length); };
    navigator.share = function (d) { window._shared = { n: d.files.length, name: d.files[0].name }; return Promise.resolve(); };
    abrirEnvioDoc(id);
  }, ojId);
  await page.waitForTimeout(600);
  const ojTitle = await page.$eval('#share-title', el => el.textContent);
  log(/Documento OJ/.test(ojTitle), '[7] Sheet identifica documento OJ', ojTitle);
  await page.click(SEL_SHARE);
  await page.waitForTimeout(400);
  const r7 = await page.evaluate(() => window._shared);
  log(!!r7 && r7.n === 1 && /^OJ_.*\.docx$/.test(r7.name), '[7] OJ: navigator.share recibe el documento OJ adjunto', JSON.stringify(r7));

  // ---- 8. Dossier: botón Enviar por tipo abre el sheet ----
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

  // ---- 10. Consola sin errores INESPERADOS (Android) ----
  // El escenario [3] fuerza un rechazo de share(); el `console.error('Web Share
  // falló…')` que dispara es intencional (canal de diagnóstico), no un bug.
  const realErrors = consoleErrors.filter(e => !/Web Share falló/.test(e));
  log(realErrors.length === 0, '[10] Sin errores de consola inesperados (Android)', realErrors.slice(0, 5).join(' || '));
  await ctxAndroid.close();

  // ================= CONTEXTO iOS (share nativo con archivo) =================
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
      window._shared = { n: d.files.length, name: d.files[0].name, size: d.files[0].size, hasText: 'text' in d };
      return Promise.resolve();
    };
  });
  await page2.evaluate((id) => abrirEnvioDoc(id), uriId2);
  await page2.waitForTimeout(700);
  const deIos = await page2.$eval('#share-de-doc', el => el.textContent);
  log(/[Aa]djunt/.test(deIos), '[11] iOS: descripcion indica envio como adjunto directo', deIos);
  await page2.click(SEL_SHARE);
  await page2.waitForTimeout(600);
  const sharedIos = await page2.evaluate(() => window._shared);
  log(!!sharedIos && sharedIos.n === 1 && /^FPJ5_URI_.*\.docx$/.test(sharedIos.name) && sharedIos.size > 10000,
    '[11] iOS: navigator.share recibe el .docx adjunto', JSON.stringify(sharedIos));
  log(!!sharedIos && sharedIos.hasText === false, '[11] iOS: comparte SOLO el archivo (sin text)');
  log(consoleErrors2.length === 0, '[11] Sin errores de consola (iOS)', consoleErrors2.slice(0, 3).join(' || '));
  await ctxIos.close();

  // ---- 12. El nombre del archivo compartido va SIN tildes/ñ (Samsung) ----
  // La descarga conserva tildes; solo el File que va a navigator.share se normaliza.
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page3 = await ctx3.newPage();
  await bootAndSeed(page3);
  const asciiOk = await page3.evaluate(() => {
    var f = _mkShareFile({ blob: new Blob(['x'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fname: 'FPJ5_CESPA_Hernández_Muñoz.docx' });
    return f ? f.name : null;
  });
  log(asciiOk === 'FPJ5_CESPA_Hernandez_Munoz.docx', '[12] El archivo compartido se normaliza a ASCII (Hernández→Hernandez, ñ→n)', String(asciiOk));
  await ctx3.close();

  console.log('\n======= REPORTE ENVIO DE DOCUMENTOS =======');
  const fails = report.filter(r => r.ok === false);
  console.log(fails.length === 0 ? 'TODO OK (' + report.length + ' checks)' : fails.length + ' FALLO(S)');
  await browser.close();
  server.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); server.close(); process.exit(1); });
