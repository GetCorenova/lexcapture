// Verificación visual del Design System v2 — 2026-07-18
// Recorre el golden path real con Playwright y captura todas las pantallas
// en móvil (390×844) y desktop (1280×900), tema oscuro y claro.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/cf990097-2c08-4a19-b7c7-b7e35f33cd3a/scratchpad';
const OUT = (n) => resolve(SHOTS, `ds_${n}.png`);
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };

const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(8091, r));

const report = [];
const log = (ok, label, extra) => { report.push(ok); console.log((ok ? 'OK ' : 'FAIL'), label, extra ?? ''); };

const browser = await chromium.launch({ headless: true });

// ═══ MÓVIL ═══
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:8091/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// 1. PIN setup
log(await page.$eval('#pin-ov', el => el.classList.contains('on')).catch(() => false), 'PIN overlay visible en primer arranque');
await page.screenshot({ path: OUT('01_pin_dark') });
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(500);
log(await page.$eval('#pin-ov', el => !el.classList.contains('on')), 'PIN configurado, overlay cerrado');

// 2. Capturas vacío
await page.screenshot({ path: OUT('02_capturas_vacio_dark') });

// 3. Nueva captura (type cards con SVG)
await page.evaluate(() => go('nueva'));
await page.waitForTimeout(300);
const svgCount = await page.$$eval('#screen-nueva .type-card .tic svg', els => els.length);
log(svgCount === 3, 'Type cards con iconos SVG', svgCount);
await page.screenshot({ path: OUT('03_nueva_dark') });

// 4. Wizard paso 1
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(300);
await page.screenshot({ path: OUT('04_wizard_dark') });
log(await page.$('#wz-panels .wnav .btn') !== null, 'Wizard renderiza navegación');
await page.evaluate(() => cancelWiz());
await page.waitForTimeout(200);

// 5. Caso demo → lista de capturas
await page.evaluate(() => runSimDemo('flagrancia-uri'));
await page.waitForTimeout(600);
await page.screenshot({ path: OUT('05_sim_resultado_dark') });
await page.evaluate(() => simSavePending());
await page.waitForTimeout(900);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(400);
const ccCount = await page.$$eval('.cc', els => els.length);
log(ccCount >= 1, 'Caso demo guardado y visible en lista', ccCount);
await page.screenshot({ path: OUT('06_capturas_lista_dark') });

// 6. Estadísticas
await page.evaluate(() => go('estadisticas'));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT('07_stats_dark') });

// 7. Dossier con caso seleccionado — modulo propio, se entra desde una captura
await page.evaluate(() => { const cs = DB.getCases(); if (cs[0]) abrirDossierTexto(cs[0].id); });
await page.waitForTimeout(400);
log(await page.$eval('#dos-actions', el => getComputedStyle(el).display) === 'flex', 'Botones de dossier visibles (display:flex)');
await page.screenshot({ path: OUT('08_dossier_dark') });

// 8. Despachos
await page.evaluate(() => go('despachos'));
await page.waitForTimeout(300);
const starSvg = await page.$('.desp-fav svg');
log(starSvg !== null, 'Favorito con estrella SVG');
await page.screenshot({ path: OUT('09_despachos_dark') });

// 9. (La pantalla Plantillas se retiró: ningún documento sale ya de un .docx
//     cargado por el usuario, así que no hay captura que tomar.)

// 10. Ajustes (con secciones SVG)
await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(300);
// Toda sección de Ajustes debe traer su icono SVG (el DS v2 no usa emojis en UI).
const ajSvg = await page.$$eval('.aj-sec-lbl svg', els => els.length);
const ajHdr = await page.$$eval('.aj-sec-hdr', els => els.length);
/* ⚠️ El umbral baja de 5 a 4 el 2026-08-31 (Mejora 7): «Dossier» dejó de ser
   una sección de Ajustes — el módulo sigue intacto, lo que desapareció es su
   entrada en esta jerarquía. Antes bajó de 8 a 5 el 2026-08-28: Ajustes se consolidó de DIEZ
   secciones a CINCO (Mejora 6, 2.º documento, obs. 17). Lo que este check
   protege no cambia y no se relaja — que NINGÚN encabezado se quede sin su icono
   SVG, porque el Design System v2 no admite emojis en la interfaz. */
log(ajSvg === ajHdr && ajHdr >= 4, 'Cada encabezado de Ajustes tiene su SVG', ajSvg + '/' + ajHdr);
await page.screenshot({ path: OUT('11_ajustes_dark') });

// 11. Personas
await page.evaluate(() => go('personas'));
await page.waitForTimeout(300);
await page.screenshot({ path: OUT('12_personas_dark') });

// 12. Sheet "Más"
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(200);
await page.evaluate(() => openSheet());
await page.waitForTimeout(400);
await page.screenshot({ path: OUT('13_sheet_mas_dark') });
await page.evaluate(() => closeSheet());
await page.waitForTimeout(300);

// ═══ TEMA CLARO ═══
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(400);
const metaLight = await page.$eval('meta[name="theme-color"]', el => el.content);
log(metaLight === '#F4F5F8', 'meta theme-color claro', metaLight);
await page.screenshot({ path: OUT('14_capturas_light') });
await page.evaluate(() => go('nueva'));
await page.waitForTimeout(300);
await page.screenshot({ path: OUT('15_nueva_light') });
await page.evaluate(() => { const cs = DB.getCases(); if (cs[0]) _dosCasoId = cs[0].id; go('dossier'); });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT('16_dossier_light') });
await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(300);
await page.screenshot({ path: OUT('17_ajustes_light') });
await page.evaluate(() => go('estadisticas'));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT('18_stats_light') });
await page.evaluate(() => setTheme('dark'));
await page.waitForTimeout(300);

// ═══ DESKTOP ═══
const ctxD = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pageD = await ctxD.newPage();
pageD.on('pageerror', e => errors.push('desktop pageerror: ' + e.message));
await pageD.goto('http://localhost:8091/LexCapture_v8.html', { waitUntil: 'load' });
await pageD.waitForTimeout(500);
// desbloquear con el PIN ya creado
const pinVisible = await pageD.$eval('#pin-ov', el => el.classList.contains('on')).catch(() => false);
if (pinVisible) {
  await pageD.fill('.pin-in', '135790').catch(() => {});
  await pageD.click('.pin-btn').catch(() => {});
  await pageD.waitForTimeout(600);
}
await pageD.screenshot({ path: OUT('19_desktop_capturas_dark') });
await pageD.evaluate(() => go('estadisticas'));
await pageD.waitForTimeout(400);
await pageD.screenshot({ path: OUT('20_desktop_stats_dark') });
await pageD.evaluate(() => setTheme('light'));
await pageD.waitForTimeout(300);
await pageD.evaluate(() => go('capturas'));
await pageD.waitForTimeout(300);
await pageD.screenshot({ path: OUT('21_desktop_capturas_light') });
await pageD.evaluate(() => startWizard('URI'));
await pageD.waitForTimeout(400);
await pageD.screenshot({ path: OUT('22_desktop_wizard_light') });
await pageD.evaluate(() => setTheme('dark'));

log(errors.length === 0, 'Sin errores de consola/página', errors.slice(0, 5).join(' | ') || '—');
console.log('\nResultado:', report.filter(Boolean).length + '/' + report.length, 'checks OK');
await browser.close();
server.close();
process.exit(report.every(Boolean) ? 0 : 1);
