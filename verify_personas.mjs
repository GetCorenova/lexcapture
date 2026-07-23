// Verificación visual: lista de Personas rediseñada (fila + menú ⋮) y badge de red.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/3477c27d-1721-4254-a1fc-1b5ad0b1ceee/scratchpad';
const OUT = (n) => resolve(SHOTS, `per_${n}.png`);
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };

const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(8093, r));

const report = [];
const log = (ok, label, extra) => { report.push(ok); console.log((ok ? 'OK  ' : 'FAIL'), label, extra ?? ''); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:8093/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(600);

// Sembrar personas de prueba
await page.evaluate(async () => {
  const P = [
    { priNom:'José', segNom:'', priApe:'Torres', segApe:'Rodríguez', tipoDoc:'CC', numDoc:'1126403694', rol:'Capturado', tel:'3001112233' },
    { priNom:'Estiven', priApe:'Zapata', segApe:'Cardona', tipoDoc:'CC', numDoc:'1176328557', rol:'Víctima' },
    { priNom:'Daniel', segNom:'Robinson', priApe:'Zapata', segApe:'Flores', tipoDoc:'CC', numDoc:'1196918109', rol:'Testigo' },
    { priNom:'Carlos', priApe:'Arias', segApe:'Peres', tipoDoc:'CC', numDoc:'1214856214', rol:'Víctima' },
    { priNom:'Daniel', priApe:'García', segApe:'Mesa', tipoDoc:'CC', numDoc:'1108333276', rol:'Capturado' }
  ];
  for (const p of P) { p.id = uid(); DB.savePerson(p); }
  go('personas');
});
await page.waitForTimeout(700);

const rows = await page.$$eval('.prow', els => els.length);
log(rows === 5, 'Se renderizan 5 filas .prow', rows);
const btnsPerRow = await page.$$eval('.prow', els => els.map(e => e.querySelectorAll('button').length));
log(btnsPerRow.every(n => n === 1), 'Cada fila tiene UN solo botón (menú ⋮)', JSON.stringify(btnsPerRow));
log(await page.$('.pcard-actions') === null, 'Ya no hay hilera .pcard-actions en Personas');
const netHidden = await page.$eval('#net-badge', el => el.hidden && getComputedStyle(el).display === 'none');
log(netHidden, 'Badge "En línea" oculto estando online');
await page.screenshot({ path: OUT('01_lista') });

// Abrir menú de desbordamiento de la primera fila
await page.click('.prow .prow-more');
await page.waitForTimeout(450);
log(await page.$eval('#act-sheet', el => el.classList.contains('on')), 'Sheet de acciones abierto');
const items = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent));
log(items.length === 5, 'Sheet con 5 acciones etiquetadas', JSON.stringify(items));
log(await page.$('#act-head .prow-name') !== null, 'Sheet muestra a quién pertenecen las acciones');
await page.screenshot({ path: OUT('02_sheet') });

// Copiar datos desde el sheet (acción real)
await page.click('#act-items .sheet-item:nth-child(4)');
await page.waitForTimeout(500);
log(await page.$eval('#act-sheet', el => !el.classList.contains('on')), 'Sheet se cierra al elegir acción');

// Tap en la fila abre edición
await page.click('.prow .prow-body');
await page.waitForTimeout(500);
const modalOpen = await page.$eval('#modal', el => el.classList.contains('open'));
log(modalOpen, 'Tap en la fila abre el formulario de edición');
await page.screenshot({ path: OUT('03_editar') });
await page.evaluate(() => closeModal());
await page.waitForTimeout(300);

// Offline → badge aparece
await ctx.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await page.waitForTimeout(400);
log(await page.$eval('#net-badge', el => !el.hidden && el.className === 'offline'), 'Badge aparece SOLO al perder señal');
await page.screenshot({ path: OUT('04_offline') });
await ctx.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(400);
log(await page.$eval('#net-badge', el => el.hidden), 'Badge vuelve a ocultarse al recuperar señal');

// ═══ CAPTURAS: mismo patrón ⋮ ═══
await page.evaluate(() => runSimDemo('flagrancia-uri'));
await page.waitForTimeout(700);
await page.evaluate(() => simSavePending());
await page.waitForTimeout(1100);
await page.evaluate(() => runSimDemo('flagrancia-cespa'));
await page.waitForTimeout(700);
await page.evaluate(() => simSavePending());
await page.waitForTimeout(1100);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(600);
const ccN = await page.$$eval('.cc', els => els.length);
log(ccN >= 2, 'Capturas de prueba en la lista', ccN);
const ccBtns = await page.$$eval('.cc', els => els.map(e => e.querySelectorAll('button').length));
log(ccBtns.every(n => n === 1), 'Cada captura tiene UN solo botón (menú ⋮)', JSON.stringify(ccBtns));
log(await page.$('.cc-act') === null, 'Ya no hay iconos .cc-act sueltos');
await page.screenshot({ path: OUT('07_capturas') });

await page.click('.cc .prow-more');
await page.waitForTimeout(450);
const ccItems = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent));
log(ccItems.length === 6, 'Sheet de captura con 6 acciones etiquetadas', JSON.stringify(ccItems));
log(await page.$('#act-head .prow-name') !== null, 'Sheet de captura identifica el caso');
await page.screenshot({ path: OUT('08_capturas_sheet') });

// Terminología CESPA: "aprehensión", no "captura"
await page.evaluate(() => closeActionSheet());
await page.waitForTimeout(350);
const cespaIdx = await page.$$eval('.cc', els => els.findIndex(e => e.textContent.includes('CESPA')));
log(cespaIdx >= 0, 'Hay una captura CESPA en la lista', cespaIdx);
await page.$$eval('.cc .prow-more', (els, i) => els[i].click(), cespaIdx);
await page.waitForTimeout(450);
const cespaDel = await page.$eval('#act-items .sheet-item.danger .de', e => e.textContent);
log(/aprehensión/.test(cespaDel), 'CESPA usa "aprehensión" en el texto de eliminar', cespaDel);

// El sheet de la captura ofrece las salidas directas (documento + dossier)
const actAll = await page.$eval('#act-items', el => el.textContent);
log(/Enviar FPJ-5/.test(actAll) && /Descargar FPJ-5/.test(actAll) && /Enviar Dossier/.test(actAll) && /Copiar Dossier/.test(actAll),
  'Sheet ofrece enviar/descargar documento y enviar/copiar dossier');
// La 1ª acción ("Enviar FPJ-5") abre el sheet de envío del documento
await page.click('#act-items .sheet-item:nth-child(1)');
await page.waitForTimeout(500);
const sendOk = await page.evaluate(() => document.getElementById('share-sheet').classList.contains('on') && !!_shareCasoId);
log(sendOk, 'Acción "Enviar FPJ-5" abre el sheet de envío del documento');
await page.evaluate(() => closeShareSheet());
await page.screenshot({ path: OUT('09_dossier') });
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(400);

// Tap en la tarjeta abre la edición
await page.click('.cc .cc-name');
await page.waitForTimeout(600);
log(await page.evaluate(() => document.getElementById('screen-wizard').classList.contains('on')), 'Tap en la tarjeta abre el wizard de edición');
await page.evaluate(() => cancelWiz());
await page.waitForTimeout(400);

// Tema claro
await page.evaluate(() => go('personas'));
await page.waitForTimeout(400);
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT('05_lista_claro') });

// Desktop
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', e => errors.push('desktop pageerror: ' + e.message));
await p2.goto('http://localhost:8093/LexCapture_v8.html', { waitUntil: 'load' });
await p2.waitForTimeout(500);
await p2.fill('#pin-a', '135790'); await p2.fill('#pin-b', '135790');
await p2.click('button[onclick="doSetPin()"]');
await p2.waitForTimeout(600);
await p2.evaluate(() => {
  ['Ana|Ríos|Capturado','Luis|Peña|Testigo'].forEach(s => { const [n,a,r]=s.split('|'); DB.savePerson({id:uid(),priNom:n,priApe:a,tipoDoc:'CC',numDoc:'1020304050',rol:r}); });
  go('personas');
});
await p2.waitForTimeout(600);
await p2.screenshot({ path: OUT('06_desktop') });

log(errors.length === 0, 'Sin errores de consola', errors.join(' | '));
console.log('\n' + report.filter(Boolean).length + '/' + report.length + ' checks OK');
await browser.close();
server.close();
process.exit(report.every(Boolean) ? 0 : 1);
