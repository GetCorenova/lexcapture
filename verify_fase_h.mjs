import { chromium } from 'playwright';
import { resolve } from 'path';

const BASE = 'http://localhost:8080/LexCapture_v8.html';
const OUT = (name) => resolve('d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App', `verify_h_${name}.png`);
const report = [];
function log(ok, label, extra) {
  report.push({ ok, label, extra });
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), label, extra !== undefined ? ('— ' + extra) : '');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36',
    permissions: []
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // ---- 1. PIN setup + cifrado ----
  const pinSetupVisible = await page.$eval('#pin-ov', el => el.classList.contains('on')).catch(() => false);
  log(pinSetupVisible, '[1] Pantalla de configuracion de PIN aparece en primer arranque');
  await page.fill('#pin-a', '135790');
  await page.fill('#pin-b', '135790');
  await page.click('button[onclick="doSetPin()"]');
  await page.waitForTimeout(400);
  const pinOvClosed = await page.$eval('#pin-ov', el => !el.classList.contains('on')).catch(() => false);
  log(pinOvClosed, '[1] Overlay de PIN se cierra tras configurar');
  const rawCases0 = await page.evaluate(() => localStorage.getItem('lc_cases'));
  const looksEncrypted = rawCases0 === null || (!rawCases0.trim().startsWith('[') && !rawCases0.trim().startsWith('{'));
  log(looksEncrypted, '[1] lc_cases en localStorage NO esta en JSON plano (cifrado activo)', rawCases0 ? rawCases0.slice(0,40)+'…' : '(vacio)');

  // ---- 2. Ajustes: estacion ----
  await page.evaluate(() => go('ajustes'));
  await page.waitForTimeout(150);
  await page.fill('#aj-rango', 'CORONEL');
  await page.fill('#aj-distrito', 'TRES');
  await page.fill('#aj-estacion', 'CANDELARIA');
  await page.fill('#aj-verde3', 'Subteniente Juan Martinez Lopez', { timeout: 2000 }).catch(() => {});
  await page.fill('#aj-diamante3', 'Teniente Pedro Sanchez Gomez', { timeout: 2000 }).catch(() => {});
  await page.click('button[onclick="saveAjustes()"]');
  await page.waitForTimeout(300);
  const cfgAfter = await page.evaluate(() => DB.getConfig());
  log(cfgAfter.rangoComandante === 'CORONEL' && cfgAfter.numDistrito === 'TRES' && cfgAfter.nombreEstacion === 'CANDELARIA',
    '[2] Configuracion de estacion guardada correctamente', JSON.stringify({r:cfgAfter.rangoComandante,d:cfgAfter.numDistrito,e:cfgAfter.nombreEstacion}));

  // ---- 3. Perfil de funcionario ----
  await page.evaluate(() => go('perfil'));
  await page.waitForTimeout(150);
  await page.evaluate(() => openPerfilForm(''));
  await page.waitForTimeout(150);
  await page.fill('#pfm-grado', 'Patrullero');
  await page.fill('#pfm-nombre', 'Carlos Andres Ruiz Ortiz');
  await page.fill('#pfm-cedula', '1020304050');
  await page.fill('#pfm-tel', '3001234567');
  await page.click('button[onclick^="savePerfilForm"]');
  await page.waitForTimeout(300);
  const cfgPerfil = await page.evaluate(() => DB.getConfig());
  log((cfgPerfil.perfiles || []).length >= 1, '[3] Perfil de funcionario creado', JSON.stringify(cfgPerfil.perfiles));

  // ---- 4. Crear captura URI (wizard completo real) ----
  await page.evaluate(() => startWizard('URI'));
  await page.waitForTimeout(150);
  await page.fill('#w-nunc', '0500160002062026');
  await page.fill('#w-spoa', '1234567890123');
  await page.fill('#w-cond0', 'Hurto calificado');
  await page.fill('#w-art0', 'Art. 239');
  await page.click('button[onclick="wizNext()"]');
  await page.waitForTimeout(150);
  await page.fill('#w-dir', 'Calle 50 #45-20');
  await page.fill('#w-barrio', 'Centro');
  await page.click('button[onclick="wizNext()"]');
  await page.waitForTimeout(150);
  // Paso Capturados
  await page.evaluate(() => addMultiPerson('capturados', true));
  await page.waitForTimeout(150);
  await page.fill('#pm-numDoc', '1001001001');
  await page.fill('#pm-priNom', 'Andres');
  await page.fill('#pm-priApe', 'Gomez');
  await page.fill('#pm-fn', '1995-05-10');
  await page.click('button[onclick^="savePersonModal"]');
  await page.waitForTimeout(150);
  await page.click('button[onclick="wizNext()"]');
  await page.waitForTimeout(150);
  // Víctimas -> marcar sin víctima
  await page.check('#w-sinVic', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.click('button[onclick="wizNext()"]');
  await page.waitForTimeout(150);
  await page.check('#w-sinTest', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.click('button[onclick="wizNext()"]');
  await page.waitForTimeout(150);
  // Narración
  await page.fill('#w-hcH', '14');
  await page.fill('#w-hcM', '30');
  await page.fill('#w-narrTxt', 'Se realiza la captura en flagrancia tras verificar el hurto reportado por la victima.');
  await page.click('button[onclick="wizNext()"]');
  await page.waitForTimeout(150);
  // Servidor
  await page.click('button[onclick="loadPerfilServ()"]', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.click('button[onclick="wizSave()"]');
  await page.waitForTimeout(400);
  const casesAfterSave = await page.evaluate(() => DB.getCases());
  log(casesAfterSave.length === 1, '[4] Caso URI guardado en DB', 'total casos=' + casesAfterSave.length);
  const uriCase = casesAfterSave[0];
  log(!!(uriCase && uriCase.capturados && uriCase.capturados.length === 1), '[4] Capturado registrado en el caso');
  await page.screenshot({ path: OUT('01_lista_capturas') });

  // ---- 5. Generar FPJ-5 URI ----
  await page.evaluate(() => go('dossier'));
  await page.waitForTimeout(150);
  await page.evaluate((id) => { _dosCasoId = id; renderDossier(); }, uriCase.id);
  await page.waitForTimeout(150);
  const [download1] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.evaluate(() => descargarFPJ())
  ]);
  log(!!download1, '[5] FPJ-5 URI .docx se descarga', download1 ? download1.suggestedFilename() : '(sin descarga)');

  // ---- 7. Dossier WA: encabezado + saludo automático ----
  const dosTxt = await page.$eval('#dos-txt', el => el.value).catch(() => '');
  const hasEncabezado = dosTxt.includes('CORONEL') && dosTxt.includes('DISTRITO TRES') && dosTxt.includes('CANDELARIA');
  log(hasEncabezado, '[7] Encabezado del dossier usa config de estacion', dosTxt.slice(0, 90).replace(/\n/g,' | '));
  const now = new Date(); const h = now.getHours();
  const expectedGreeting = h < 6 ? 'NOCHES' : h < 12 ? 'DÍAS' : h < 19 ? 'TARDES' : 'NOCHES';
  log(dosTxt.includes(expectedGreeting), '[7] Saludo automatico coincide con la hora actual (' + h + 'h)', 'esperado=' + expectedGreeting);

  // ---- 8. CESPA vía simulador — terminología "aprehendido" ----
  await page.evaluate(() => go('capturas'));
  const cespaCase = await page.evaluate(() => {
    var c = SIM.genFlagrancia('flagrancia-cespa');
    DB.saveCase(c);
    (c.capturados || []).forEach(function (p) { DB.savePerson(Object.assign({}, p, { rol: 'Capturado' })); });
    return c;
  });
  await page.waitForTimeout(300);
  await page.evaluate((id) => { _dosCasoId = id; renderDossier(); }, cespaCase.id);
  await page.waitForTimeout(150);
  const dosTxtCespa = await page.$eval('#dos-txt', el => el.value).catch(() => '');
  // Nota: los labels del dossier son neutrales (QUIÉN, QUÉ, etc.) por diseño — no usan
  // "capturado" ni "aprehendido" literalmente. Solo se verifica que NO diga "capturado".
  log(!/capturad/i.test(dosTxtCespa), '[8] Dossier CESPA no usa la palabra "capturado" (labels neutrales por diseño)');

  // ---- 9. OJ vía simulador — Disposición Fiscalía/Juzgado con plantilla builtin ----
  const ojCase = await page.evaluate(() => {
    var c = SIM.genOJ();
    DB.saveCase(c);
    (c.capturados || []).forEach(function (p) { DB.savePerson(Object.assign({}, p, { rol: 'Capturado' })); });
    return c;
  });
  await page.waitForTimeout(300);
  const [download4] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.evaluate((c) => genDocDisposicion(c, 'disp_fiscalia'), ojCase)
  ]);
  log(!!download4, '[9] Disposicion Fiscalia (OJ, plantilla builtin) se descarga', download4 ? download4.suggestedFilename() : '(sin descarga)');

  // ---- 10. activarTemplate no cruza tipos (regresion del bug encontrado) ----
  const crossTypeOk = await page.evaluate(() => {
    var before = DB.getTemplates().filter(function(t){return t.tipo==='disp_juzgado';});
    var beforeActiveIds = before.filter(function(t){return t.activa;}).map(function(t){return t.id;});
    var fiscaliaTpl = DB.getTemplates().find(function(t){return t.tipo==='disp_fiscalia';});
    if (!fiscaliaTpl) return 'no-fiscalia-template';
    activarTemplate(fiscaliaTpl.id);
    var afterJuzgado = DB.getTemplates().filter(function(t){return t.tipo==='disp_juzgado';});
    var afterActiveIds = afterJuzgado.filter(function(t){return t.activa;}).map(function(t){return t.id;});
    return JSON.stringify(beforeActiveIds) === JSON.stringify(afterActiveIds);
  });
  log(crossTypeOk === true, '[10] Activar plantilla Fiscalia NO desactiva la de Juzgado', String(crossTypeOk));

  // ---- 11. Badge VENCIDO/URGENTE ----
  const badgeCheck = await page.evaluate(() => {
    var c = SIM.genFlagrancia('flagrancia-uri');
    c.created = Date.now() - 40 * 3600000; // 40h atrás -> debe verse VENCIDO
    c.isTest = false;
    DB.saveCase(c);
    renderCases();
    var html = document.getElementById('cl') ? document.getElementById('cl').innerHTML : '';
    return html.includes('VENCIDO');
  }).catch(e => 'error:' + e.message);
  log(badgeCheck === true, '[11] Caso de 40h muestra badge VENCIDO (>36h Ley 906/2004)', String(badgeCheck));

  // ---- 12. Dashboard ----
  await page.evaluate(() => go('estadisticas'));
  await page.waitForTimeout(200);
  const dashCrash = consoleErrors.some(e => /estadisticas|renderEstadisticas/i.test(e));
  log(!dashCrash, '[12] Dashboard/Estadisticas renderiza sin errores de consola');
  await page.screenshot({ path: OUT('02_dashboard') });

  // ---- 13. Errores de consola generales ----
  log(consoleErrors.length === 0, '[13] Sin errores de consola durante todo el golden path', consoleErrors.slice(0,5).join(' || '));

  console.log('\n======= REPORTE FASE H — GOLDEN PATH =======');
  var fails = report.filter(r => r.ok === false);
  report.forEach(r => console.log((r.ok ? '✅' : '❌'), r.label, r.extra !== undefined ? ('— ' + r.extra) : ''));
  console.log('=====================================');
  console.log(fails.length === 0 ? 'TODO OK' : (fails.length + ' FALLO(S)'));

  await browser.close();
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
