/* «ENVIAR A» · sin cuenta (2026-10-25).
   La pantalla «Modo compartir» se retiró: enviar es un botón de Capturas y de
   Personas. Esta suite mide lo que se ve y funciona SIN cuenta —la versión web de
   GitHub—: la barra, el panel, la selección sobre la lista y el archivo con
   clave. Lo que exige la cuenta (vincular, enviar por el buzón, el tope de 3,
   apagar un vinculado) lo miden `verify_companeros` y `verify_envio_buzon`
   contra los emuladores.
   A · la barra · B · el panel · C · la selección y el archivo · D · lo retirado ·
   E · el nombre corto · F · lo que se ve. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.js':'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8131, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const SHOT = process.env.SHOT_DIR || ROOT;

const browser = await chromium.launch({ headless: true });
async function abrir(tema) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
  await page.goto('http://localhost:8131/LexCapture_v8.html', { waitUntil: 'load' });
  await page.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem('lc_theme', t); }, tema);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window._lcListo === true);
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

const { ctx, page, errs } = await abrir('light');
await page.evaluate(async () => {
  for (let i = 0; i < 3; i++) await DB.saveCase(SIM.genFlagrancia(i ? 'URI' : 'CESPA'));
  await DB.savePerson({ id: 'per-a', rol: 'Capturado', priNom: 'Ana', priApe: 'Ruiz', tipoDoc: 'CC', numDoc: '111' });
  await DB.savePerson({ id: 'per-b', rol: 'Víctima', priNom: 'Beto', priApe: 'Paz', tipoDoc: 'CC', numDoc: '222' });
  go('capturas');
});
await page.waitForTimeout(300);

/* ═══ A · la barra ═══ */
const a = await page.evaluate(() => {
  const bar = document.getElementById('ev-capturas'), r = bar.getBoundingClientRect();
  const ord = document.getElementById('ord-capturas');
  return { txt: bar.innerText.replace(/\s+/g, ' ').trim(), alto: r.height, ancho: r.width,
           mismaFila: Math.abs(ord.getBoundingClientRect().top - r.top) < 20 && !ord.hidden,
           enRow: bar.parentElement.id === 'ev-row-capturas', chip: !!bar.querySelector('.ev-chip.acc') };
});
log(/^Enviar a: Vincular$/.test(a.txt) && a.alto > 20 && a.chip, '[A1] Capturas: sin vinculados la barra dice «Enviar a: Vincular»', a.txt);
log(a.enRow && a.mismaFila, '[A2] La barra va en la fila del orden de la lista, a su izquierda');
await page.evaluate(() => go('personas'));
await page.waitForTimeout(250);
const a3 = await page.evaluate(() => {
  const bar = document.getElementById('ev-personas'), s = document.getElementById('p-search');
  return { txt: bar.innerText.replace(/\s+/g, ' ').trim(), debajo: bar.getBoundingClientRect().top > s.getBoundingClientRect().bottom,
           antesOrden: bar.getBoundingClientRect().bottom <= document.getElementById('ord-personas').getBoundingClientRect().top + 1 };
});
log(/^Enviar a: Vincular$/.test(a3.txt) && a3.debajo && a3.antesOrden, '[A3] Personas: la barra va bajo el buscador y encima del orden', a3.txt);

/* ═══ B · el panel ═══ */
await page.click('#ev-personas .ev-chip');
await page.waitForSelector('#ev-gest');
const b = await page.evaluate(() => ({
  txt: document.getElementById('ev-gest').innerText,
  full: document.getElementById('modal').classList.contains('full'),
  ops: [...document.querySelectorAll('#ev-gest .pt-op .ti')].map(e => e.textContent.trim())
}));
log(b.full && /cuenta de Flagrante/.test(b.txt), '[B1] Sin cuenta, el panel dice que vincular necesita la cuenta');
log(b.ops.join('|') === 'Guardar un archivo|Recibir un archivo', '[B2] Y ofrece el archivo con clave: guardar y recibir', b.ops.join(' · '));

/* ═══ C · la selección y el archivo ═══ */
await page.click('#ev-gest .pt-op:has-text("Guardar un archivo")');
await page.waitForTimeout(250);
const c1 = await page.evaluate(() => ({
  modal: document.getElementById('modal').classList.contains('open'),
  sel: !!document.querySelector('#ev-personas .ev-sel'),
  filas: document.querySelectorAll('#pl .prow.ev-on').length,
  menus: document.querySelectorAll('#pl .prow-more').length,
  chk: document.querySelectorAll('#pl .ev-chk').length,
  dis: document.querySelector('#ev-personas .ev-sel .bp').disabled
}));
log(!c1.modal && c1.sel && c1.filas === 2 && c1.chk === 2 && c1.menus === 0 && c1.dis,
  '[C1] «Guardar un archivo» abre la selección sobre la lista: casillas, sin menú ⋮ y «Guardar» apagado', JSON.stringify(c1));
await page.click('#pl .prow[data-ev="per-b"]');
await page.waitForTimeout(150);
const c2 = await page.evaluate(() => ({
  si: document.querySelector('#pl .prow[data-ev="per-b"]').classList.contains('ev-si'),
  no: document.querySelector('#pl .prow[data-ev="per-a"]').classList.contains('ev-si'),
  btn: document.querySelector('#ev-personas .ev-sel .bp').innerText.trim(),
  dis: document.querySelector('#ev-personas .ev-sel .bp').disabled,
  modal: document.getElementById('modal').classList.contains('open')
}));
log(c2.si && !c2.no && /Guardar \(1\)/.test(c2.btn) && !c2.dis && !c2.modal,
  '[C2] Tocar una fila la marca (no abre la ficha) y el botón cuenta lo marcado', c2.btn);
await page.click('#ev-personas .ev-sel .btn:has-text("Todas")');
await page.waitForTimeout(150);
const c3 = await page.evaluate(() => document.querySelectorAll('#pl .prow.ev-si').length);
log(c3 === 2, '[C3] «Todas» marca las dos');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
  page.click('#ev-personas .ev-sel .bp')]);
await page.waitForTimeout(300);
const c4 = await page.evaluate(() => ({ sel: !!_evSel, pin: (document.querySelector('.cf-pin-n') || {}).innerText || '' }));
log(dl && /\.lexc$/.test(dl.suggestedFilename()) && !c4.sel, '[C4] «Guardar» produce el archivo .lexc y cierra la selección', dl && dl.suggestedFilename());
await page.evaluate(() => closeModal());
// Cancelar y salir de la lista
await page.evaluate(() => { go('capturas'); _evSel = { k: 'c', dest: 'archivo', ids: {} }; renderCases(); });
const c5 = await page.evaluate(() => ({
  sel: !!document.querySelector('#ev-capturas .ev-sel'),
  ord: getComputedStyle(document.getElementById('ord-capturas')).display,
  click: document.querySelector('#cl .cc').getAttribute('onclick')
}));
log(c5.sel && c5.ord === 'none' && /^evMarcar\('c'/.test(c5.click), '[C5] En Capturas igual: la selección ocupa la fila y la tarjeta marca en vez de abrir', JSON.stringify(c5));
await page.evaluate(() => go('personas'));
const c6 = await page.evaluate(() => { go('capturas'); return { sel: _evSel, click: document.querySelector('#cl .cc').getAttribute('onclick') }; });
log(c6.sel === null && /^abrirDossierCaso/.test(c6.click), '[C6] Salir de la lista cancela la selección y la tarjeta vuelve a abrir el expediente');
await page.evaluate(() => { _evSel = { k: 'c', dest: 'archivo', ids: {} }; renderCases(); });
await page.click('#ev-capturas .ev-sel .btn:has-text("Cancelar")');
const c7 = await page.evaluate(() => ({ sel: _evSel, bar: document.getElementById('ev-capturas').innerText.trim() }));
log(c7.sel === null && /Enviar a/.test(c7.bar), '[C7] «Cancelar» vuelve a la barra');

/* ═══ D · lo retirado ═══ */
const d = await page.evaluate(() => ({
  pant: !!document.getElementById('screen-compartir'),
  nav: !!document.querySelector('[data-screen="compartir"]'),
  scr: screens.indexOf('compartir'),
  mas: [...document.querySelectorAll('#sheet .ti')].map(e => e.textContent.trim()).filter(t => /compartir/i.test(t)),
  funcs: ['renderCompartir', 'ptAbrirCompartir', 'ptUiMarcar', 'ptUiExportar', 'bzUiEnvio'].filter(f => typeof window[f] === 'function'),
  cnt: !!document.querySelector('.sb-item[data-screen="capturas"] #bz-cnt-nav'),
  punto: !!document.querySelector('#bottombar [data-screen="capturas"] #bz-punto')
}));
log(!d.pant && !d.nav && d.scr < 0 && !d.mas.length && !d.funcs.length, '[D1] «Modo compartir» ya no existe: ni pantalla, ni menú, ni sus funciones', JSON.stringify(d));
log(d.cnt && d.punto, '[D2] El aviso de «por revisar» pasa al ítem Capturas (panel y barra inferior)');
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
log(!/Modo compartir/.test(src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
  '[D3] Ningún texto de la app nombra «Modo compartir»');

/* ═══ E · el nombre corto ═══ */
const e = await page.evaluate(() => [
  bzNomCorto('PT DAVID NELSON GOMEZ'), bzNomCorto('Patrullero Juan Carlos Pérez López'), bzNomCorto('SI Nelson David'),
  bzNomCorto('Teniente Coronel Ana Ruiz Gómez'), bzNomCorto('María'), bzNomCorto('')
]);
log(e.join('|') === 'David NELSON|Juan PÉREZ|Nelson DAVID|Ana RUIZ|María|tu compañero',
  '[E1] Nombre y primer apellido, sin el grado', e.join(' · '));

/* ═══ F · lo que se ve ═══ */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  // Vinculados simulados solo para pintar la barra (sin cuenta no se envía nada).
  window.bzActiva = () => true;
  window.bzContactos = () => [
    { uid: 'u1', nom: 'PT DAVID NELSON GOMEZ', pub: 'x', confirmado: 1 },
    { uid: 'u2', nom: 'SI LUZ ROJAS MEJIA', pub: 'x', confirmado: 0 }];
  go('capturas');
});
await page.waitForTimeout(200);
const f = await page.evaluate(() => {
  const ok = document.querySelector('#ev-capturas .ev-chip.ok'), cs = ok && getComputedStyle(ok);
  return { txt: document.getElementById('ev-capturas').innerText.replace(/\s+/g, ' ').trim(), color: cs && cs.color,
           ges: !!document.querySelector('#ev-capturas .ev-ges'),
           desborda: document.documentElement.scrollWidth > innerWidth };
});
log(/^Enviar a: David NELSON$/.test(f.txt) && f.ges && !f.desborda,
  '[F1] En la barra solo el vinculado listo, en verde (el que espera confirmación va al panel), sin desbordar', f.txt);
await page.screenshot({ path: join(SHOT, 'verify_enviar_a_capturas.png') });
await page.evaluate(() => { _evSel = { k: 'c', dest: 'u1', ids: {} }; renderCases(); evMarcar('c', DB.getCases()[0].id); });
await page.screenshot({ path: join(SHOT, 'verify_enviar_a_seleccion.png') });
await page.evaluate(() => { evCancelar(); go('personas'); });
await page.waitForTimeout(400);   // la pantalla entra con una transición
await page.screenshot({ path: join(SHOT, 'verify_enviar_a_personas.png') });

const osc = await abrir('dark');
await osc.page.evaluate(() => {
  window.bzActiva = () => true;
  window.bzContactos = () => [{ uid: 'u1', nom: 'PT DAVID NELSON GOMEZ', pub: 'x', confirmado: 1 }];
  go('personas');
});
await osc.page.waitForTimeout(200);
await osc.page.screenshot({ path: join(SHOT, 'verify_enviar_a_oscuro.png') });

log(errs.length === 0 && osc.errs.length === 0, '[F2] Consola sin errores', errs.concat(osc.errs).slice(0, 3).join(' · '));

console.log('\n' + R.filter(Boolean).length + '/' + R.length + ' comprobaciones');
await browser.close(); server.close();
process.exit(R.every(Boolean) ? 0 : 1);
