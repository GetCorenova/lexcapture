// Verificación desktop del Design System v2 (contexto propio: PIN + caso demo)
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/cf990097-2c08-4a19-b7c7-b7e35f33cd3a/scratchpad';
const OUT = (n) => resolve(SHOTS, `ds_${n}.png`);
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(8092, r));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:8092/LexCapture_v8.html', { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(600);
await page.evaluate(() => runSimDemo('flagrancia-uri'));
await page.waitForTimeout(500);
await page.evaluate(() => simSavePending());
await page.waitForTimeout(900);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT('19_desktop_capturas_dark') });
await page.evaluate(() => go('estadisticas'));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT('20_desktop_stats_dark') });
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(300);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(300);
await page.screenshot({ path: OUT('21_desktop_capturas_light') });
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT('22_desktop_wizard_light') });
console.log(errors.length ? 'ERRORES: ' + errors.join(' | ') : 'Sin errores de página. 4 capturas desktop generadas.');
await browser.close();
server.close();
