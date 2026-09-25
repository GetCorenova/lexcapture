/* POLÍTICA DE SEGURIDAD DE CONTENIDO — Fase 0 (2026-09-25).

   Dos mitades, y las dos importan:
   1. Que la política ESTÉ Y MUERDA: un script o una conexión a un sitio ajeno se
      bloquean. Sin esto, una <meta> mal escrita pasaría por buena sin proteger nada.
   2. Que la app NO SE ROMPA con ella: se recorre lo que más recursos toca (PIN,
      documentos Word y PDF estampado, vista de impresión, código QR, pantallas) y
      no puede saltar ni una sola violación.
   El resto de las suites lo completa: cualquier violación sale en su chequeo de
   consola limpia. */
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
await new Promise(r => server.listen(8163, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');

/* ── Estático ─────────────────────────────────────────────────────────── */
const csp = (src.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const dir = Object.fromEntries(csp.split(';').map(s => s.trim()).filter(Boolean)
  .map(s => { const [k, ...v] = s.split(/\s+/); return [k, v]; }));
log(!!csp, '[C1] la página declara una política de seguridad de contenido');
log((dir['default-src'] || []).join(' ') === "'self'", "[C2] por defecto, solo lo propio (default-src 'self')", (dir['default-src'] || []).join(' '));
log(!/unsafe-eval/.test(csp), '[C3] sin unsafe-eval');
log((dir['object-src'] || []).join(' ') === "'none'" && (dir['base-uri'] || []).join(' ') === "'none'",
    "[C4] object-src 'none' y base-uri 'none'");
const conexiones = (dir['connect-src'] || []).filter(x => x !== "'self'");
log(conexiones.every(u => /^https:\/\/([a-z0-9]+\.)?(googleapis\.com|accounts\.google\.com)\//.test(u + (u.endsWith('/') ? '' : '/'))),
    '[C5] las únicas conexiones fuera de la app son las de Google (la copia en Drive)', conexiones.join(' '));
log(!/frame-ancestors/.test(csp), '[C6] no pide en <meta> lo que el navegador ignora ahí (frame-ancestors)');
/* Que la <meta> vaya ANTES de cualquier script: una política declarada después
   no protege lo que ya corrió. */
const iMeta = src.indexOf('http-equiv="Content-Security-Policy"'), iScript = src.indexOf('<script');
log(iMeta > 0 && iMeta < iScript, '[C7] la política va antes del primer <script>');

/* ── En el navegador ──────────────────────────────────────────────────── */
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
await page.addInitScript(() => {
  window.__viol = [];
  document.addEventListener('securitypolicyviolation', e => window.__viol.push(e.violatedDirective + ' ' + e.blockedURI));
});
await page.goto('http://localhost:8163/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '3579'); await page.fill('#pin-b', '3579');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(1200);

/* Lo que más recursos toca: los seis documentos, la vista de impresión, el QR. */
const rec = await page.evaluate(async () => {
  const hechos = [];
  const c = SIM.genFlagrancia ? SIM.genFlagrancia() : null;
  if (c) { await DB.saveCase(c); hechos.push('flagrancia'); }
  for (const s of ['capturas', 'personas', 'estadisticas', 'despachos', 'ajustes', 'perfil', 'compartir', 'sync']) {
    try { go(s); hechos.push(s); } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  try {
    const oj = SIM.genOJ(); oj.isTest = true;
    const out = await buildOficioOJBlob(ojCasoParaDocumento(oj), 'CARTA');
    hechos.push('oficio ' + out.blob.size);
    if (typeof lcImprimir === 'function') { lcImprimir(out); await new Promise(r => setTimeout(r, 1200)); hechos.push('impresión'); }
  } catch (e) { hechos.push('OJ-error ' + e.message); }
  if (c) {
    try { const f = await buildFPJBlob(c); hechos.push('fpj5 ' + (f && f.blob ? f.blob.size : 0)); } catch (e) { hechos.push('fpj-error ' + e.message); }
  }
  try { const svg = ptQrSvg(new Uint8Array(120).fill(7)); const img = new Image();
        await new Promise(r => { img.onload = img.onerror = r; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        hechos.push('qr ' + img.width); } catch (e) { hechos.push('qr-error ' + e.message); }
  return hechos;
});
const v1 = await page.evaluate(() => window.__viol.slice());
log(v1.length === 0, '[C8] recorrer pantallas, documentos, impresión y QR no provoca ni una violación', JSON.stringify({ rec, v1 }));

/* Y MUERDE: un script de otro sitio y una conexión a otro servidor se bloquean. */
const muerde = await page.evaluate(async () => {
  const antes = window.__viol.length;
  const s = document.createElement('script'); s.src = 'https://example.com/malo.js'; document.head.appendChild(s);
  let conecto = true;
  try { await fetch('https://example.com/filtrar?x=1'); } catch (e) { conecto = false; }
  await new Promise(r => setTimeout(r, 300));
  return { nuevas: window.__viol.slice(antes), conecto };
});
log(muerde.nuevas.some(v => /script-src/.test(v)), '[C9] un script de otro sitio se BLOQUEA', JSON.stringify(muerde.nuevas));
log(!muerde.conecto && muerde.nuevas.some(v => /connect-src/.test(v)), '[C10] y una conexión a otro servidor también');

/* Los errores de consola que provoca [C9]/[C10] son los esperados: se descuentan. */
const ajenos = errs.filter(e => !/example\.com|Content Security Policy|Failed to fetch/i.test(e));
log(ajenos.length === 0, '[C11] consola limpia (sin contar lo bloqueado a propósito)', ajenos.slice(0, 3).join(' | '));

await browser.close(); server.close();
const n = R.filter(Boolean).length;
console.log('\n' + n + '/' + R.length + (n === R.length ? '  TODO OK' : '  ⚠️ HAY FALLOS'));
process.exit(n === R.length ? 0 : 1);
