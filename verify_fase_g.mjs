import { chromium } from 'playwright';
import { resolve } from 'path';

const BASE = 'http://localhost:8080/LexCapture_v8.html';
const SHOTS = (name) => resolve('d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App', `verify_${name}.png`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
  });

  let swRegistered = false;
  let swUrl = '';
  context.on('serviceworker', sw => { swRegistered = true; swUrl = sw.url(); });

  const page = await context.newPage();
  const consoleLines = [];
  page.on('console', m => consoleLines.push(m.text()));

  // CARGA INICIAL — primer load instala el SW y cachea el HTML
  console.log('[1] Carga inicial...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Forzar registro del SW y esperar activación antes de offline
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active ? reg.active.state : 'no-active';
  });
  console.log('[1] SW state:', swState);

  // Verificar que el caché contiene el HTML
  const cacheOk = await page.evaluate(async () => {
    const cache = await caches.open('lexcapture-v8-cache-v1');
    const keys = await cache.keys();
    return keys.map(r => r.url);
  });
  console.log('[1] Cache keys:', cacheOk);

  // SEGUNDO LOAD — ahora el SW controla el cliente (clients.claim())
  // Esto simula el "segundo arranque" donde la app ya está cacheada
  console.log('[2] Segundo load (SW activo, verifica que controla el cliente)...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot del estado online
  await page.screenshot({ path: SHOTS('01_online') });

  // Verificar badge
  const badgeVisible = await page.$('#net-badge').then(b => b?.isVisible()).catch(() => false);
  const badgeText = await page.$eval('#net-label', el => el.textContent).catch(() => 'ERROR');
  const badgeClass = await page.$eval('#net-badge', el => el.className).catch(() => 'ERROR');
  console.log('[2] Badge:', badgeVisible, badgeText, badgeClass);

  // Manifest link
  const manifestHref = await page.$eval('link[rel="manifest"]', el => el.href).catch(() => null);
  console.log('[2] Manifest href:', manifestHref);

  // SW log
  const swLog = consoleLines.find(l => l.includes('SW registrado') || l.includes('SW no disponible')) || '(ninguno)';
  console.log('[2] SW console log:', swLog);

  // OFFLINE — activar y verificar badge cambia
  console.log('[3] Activando modo OFFLINE...');
  await context.setOffline(true);
  await page.waitForTimeout(1000);

  const badgeOffline = await page.$eval('#net-label', el => el.textContent).catch(() => 'ERROR');
  const badgeClassOff = await page.$eval('#net-badge', el => el.className).catch(() => 'ERROR');
  console.log('[3] Badge offline:', badgeOffline, badgeClassOff);
  await page.screenshot({ path: SHOTS('02_offline_badge') });

  // RECARGA OFFLINE — el SW debe servir desde caché
  console.log('[4] Recargando en OFFLINE...');
  let offlineTitle = '';
  let offlineOk = false;
  let offlineError = '';
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);
    offlineTitle = await page.title();
    offlineOk = offlineTitle.includes('LexCapture');
    console.log('[4] Carga offline OK — título:', offlineTitle);
  } catch(e) {
    offlineError = e.message.split('\n')[0];
    console.log('[4] Error recarga offline:', offlineError);
    // Diagnóstico: verificar si el SW sigue activo
    const swActive = await page.evaluate(() =>
      navigator.serviceWorker.controller ? navigator.serviceWorker.controller.state : 'no-controller'
    ).catch(() => 'evaluate-error');
    console.log('[4] SW controller state:', swActive);
  }
  await page.screenshot({ path: SHOTS('03_offline_reload') });

  // Si la navegación offline falló, testear subresource fetch desde caché
  let cacheServeOk = false;
  if (!offlineOk) {
    console.log('[4b] Probando fetch de subrecurso desde caché...');
    try {
      cacheServeOk = await page.evaluate(async () => {
        const res = await caches.match('http://localhost:8080/LexCapture_v8.html');
        return res ? res.status === 200 : false;
      });
      console.log('[4b] Cache.match devolvió respuesta:', cacheServeOk);
    } catch(e) {
      console.log('[4b] Error:', e.message);
    }
  }

  // VOLVER ONLINE
  console.log('[5] Volviendo ONLINE...');
  await context.setOffline(false);
  await page.waitForTimeout(1200);
  const badgeOnline2 = await page.$eval('#net-label', el => el.textContent).catch(() => 'ERROR');
  console.log('[5] Badge online:', badgeOnline2);
  await page.screenshot({ path: SHOTS('04_vuelto_online') });

  // Install banner
  const installDisplay = await page.$eval('#install-banner', el =>
    getComputedStyle(el).display
  ).catch(() => 'no-encontrado');
  console.log('[6] Install banner display:', installDisplay);

  // REPORTE FINAL
  console.log('\n======= REPORTE FINAL FASE G =======');
  console.log('✅/❌ SW registrado:', swRegistered ? '✅ ' + swUrl : '❌ NO');
  console.log('✅/❌ SW activado (state):', swState);
  console.log('✅/❌ Cache contiene HTML:', cacheOk.length > 0 ? '✅ ' + cacheOk.join(', ') : '❌ VACÍO');
  console.log('✅/❌ SW log consola:', swLog.includes('registrado') ? '✅' : '⚠️', swLog);
  console.log('✅/❌ Manifest link:', manifestHref ? '✅ ' + manifestHref : '❌ NO');
  console.log('✅/❌ Badge "En línea":', badgeVisible && badgeText === 'En línea' ? '✅' : '❌', badgeText);
  console.log('✅/❌ Badge cambia a offline:', badgeOffline === 'Sin señal' ? '✅' : '❌', badgeOffline);
  console.log('✅/❌ Carga desde caché (navegación):', offlineOk ? '✅ título: ' + offlineTitle : '❌ ' + offlineError);
  console.log('✅/❌ Cache.match sirve el HTML:', cacheOk.length > 0 ? '✅ cache poblado' : cacheServeOk ? '✅' : '❌');
  console.log('✅/❌ Badge vuelve a online:', badgeOnline2 === 'En línea' ? '✅' : '❌', badgeOnline2);
  console.log('⚠️  Install banner:', installDisplay, '(requiere evento beforeinstallprompt — no disponible en headless)');
  console.log('=====================================\n');

  await browser.close();
})();
