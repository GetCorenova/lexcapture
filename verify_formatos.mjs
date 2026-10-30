/* FORMATOS (2026-10-30, build 176) — catálogo de formatos en blanco.

   Se ejerce contra los EMULADORES de Firebase (Firestore + Storage), que la
   propia suite arranca y apaga, y el catálogo lo publica el script REAL de
   administración (scripts/admin-formatos.mjs --emulador): nada toca el proyecto.

   A · el script de administración: valida, publica, es idempotente, retira.
   B · las reglas: lectura pública, ninguna escritura desde un cliente.
   C · navegación: mosaico en «Recursos», panel lateral, volver.
   D · la lista: tarjetas, contador, pestañas, buscador (tildes, código, norma).
   E · el menú ⋮: PDF o Word, y Ver / Descargar / Compartir.
   F · sin señal: catálogo y archivos ya usados desde el teléfono.
   G · favoritos y «Nuevo / Actualizado».
   H · estructura: nada pesado al arrancar, sin CDN, CSP, dos temas, 360 px. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'fs';
import { join, extname } from 'path';
import { tmpdir } from 'os';
import { spawn, spawnSync, execSync } from 'child_process';
import { createHash } from 'crypto';

const ROOT = 'D:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PROY = 'demo-flagrante', BUCKET = PROY + '.appspot.com';
const FS = 'http://127.0.0.1:8085', ST = 'http://127.0.0.1:9199';
const EMU = { host: '127.0.0.1', puerto: 8085, stPuerto: 9199, proyecto: PROY, bucket: BUCKET };
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript' };

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const sha = b => createHash('sha256').update(b).digest('hex');

/* ── Emuladores ─────────────────────────────────────────────────────────── */
const vivo = async u => { try { await fetch(u); return true; } catch (e) { return false; } };
let emu = null;
if (!(await vivo(FS)) || !(await vivo(ST))) {
  emu = spawn(process.execPath, [join(ROOT, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:start',
    '--only', 'firestore,storage', '--project', PROY, '--config', join(ROOT, 'firebase/firebase.json')],
    { cwd: join(ROOT, 'firebase'), stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  emu.stdout.on('data', d => { salida += d; });
  emu.stderr.on('data', d => { salida += d; });
  const t0 = Date.now();
  while (!((await vivo(FS)) && (await vivo(ST)))) {
    if (Date.now() - t0 > 90000) { console.error(salida.slice(-2000)); throw new Error('Los emuladores no arrancaron'); }
    await new Promise(r => setTimeout(r, 500));
  }
}
const apagar = () => { if (emu) { try { execSync('taskkill /pid ' + emu.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} } };
await fetch(`${FS}/emulator/v1/projects/${PROY}/databases/(default)/documents`, { method: 'DELETE' });
const objetos = async () => {
  const r = await fetch(`${ST}/v0/b/${BUCKET}/o?prefix=formatos/`, { headers: { Authorization: 'Bearer owner' } });
  return r.status === 200 ? ((await r.json()).items || []).map(x => x.name) : [];
};
for (const n of await objetos()) await fetch(`${ST}/v0/b/${BUCKET}/o/${encodeURIComponent(n)}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });

/* ── La carpeta de administración (en el temporal) ──────────────────────── */
const DIR = mkdtempSync(join(tmpdir(), 'fm-cat-'));
const OTRO = join(ROOT, 'Documentos', 'Otro');
copyFileSync(join(OTRO, 'FPJ 7 Rotulo Emp Y Ef.pdf'), join(DIR, 'fpj7.pdf'));
copyFileSync(join(OTRO, 'FPJ 8 Registro Cadena De Custodia.pdf'), join(DIR, 'fpj8.pdf'));
copyFileSync(join(OTRO, 'Resumen de la Captura.docx'), join(DIR, 'fpj8.docx'));
copyFileSync(join(OTRO, 'Propuesta_Plantilla_OJ.docx'), join(DIR, 'guia.docx'));
const LOTE = [
  { id: 'fpj-7-rotulo', nombre: 'Rótulo de EMP y EF', codigo: 'FPJ-7', categoria: 'oficial', fuente: 'Fiscalía General de la Nación', norma: 'Ley 906 de 2004', version: '1', orden: 10, pdf: 'fpj7.pdf' },
  { id: 'fpj-8-cadena', nombre: 'Registro de cadena de custodia', codigo: 'FPJ-8', categoria: 'oficial', fuente: 'Fiscalía General de la Nación', norma: 'Ley 906 de 2004', version: '2', enlace: 'https://www.fiscalia.gov.co', orden: 20, pdf: 'fpj8.pdf', docx: 'fpj8.docx' },
  { id: 'guia-oficio', nombre: 'Guía de oficio de puesta a disposición', categoria: 'no_oficial', fuente: 'Práctica policial', norma: 'Código de Procedimiento Penal', docx: 'guia.docx' }
];
const escribirLote = l => writeFileSync(join(DIR, 'formatos.json'), JSON.stringify({ formatos: l }, null, 2));
const admin = (...extra) => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/admin-formatos.mjs'), '--emulador', '--carpeta', DIR, ...extra],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' } });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};
const catalogo = async () => {
  const r = await fetch(`${FS}/v1/projects/${PROY}/databases/(default)/documents/formatos/catalogo`, { headers: { Authorization: 'Bearer owner' } });
  if (r.status !== 200) return null;
  const d = (await r.json()).fields;
  return { version: +d.version.integerValue, n: (d.items.arrayValue.values || []).length };
};

const browser = await chromium.launch({ headless: true });
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  let b = readFileSync(p);
  if (extname(p) === '.html') b = b.toString('utf8').replace("connect-src 'self'", `connect-src 'self' ${FS} ${ST}`);
  s.end(b);
});
await new Promise(r => server.listen(8176, r));
const URL = 'http://localhost:8176/LexCapture_v8.html';
const errs = [];

try {
/* ═══ A · EL SCRIPT DE ADMINISTRACIÓN ═══════════════════════════════════ */
escribirLote([{ id: 'MAL id', nombre: '', categoria: 'otra', pdf: 'no-existe.pdf' }]);
let r = admin('--aplicar');
log(!r.ok && /id inválido/.test(r.out) && /categoria/.test(r.out) && /nombre/.test(r.out), '[A1] un formatos.json con errores no publica nada y los dice todos');
escribirLote(LOTE);
r = admin();
log(r.ok && /Simulación/.test(r.out) && (await catalogo()) === null, '[A2] sin --aplicar solo simula: no escribe el catálogo');
r = admin('--aplicar');
let cat = await catalogo(), objs = await objetos();
log(r.ok && cat && cat.version === 1 && cat.n === 3, '[A3] publica el catálogo: versión 1, tres formatos', r.ok ? JSON.stringify(cat) : r.out.slice(-400));
log(objs.length === 4 && objs.filter(o => o.startsWith('formatos/estandarizados/')).length === 3 && objs.filter(o => o.startsWith('formatos/no_estandarizados/')).length === 1,
  '[A4] los archivos quedan en formatos/estandarizados/ y formatos/no_estandarizados/', objs.join(' '));
r = admin('--aplicar');
log(r.ok && /Sin cambios/.test(r.out) && (await catalogo()).version === 1, '[A5] volver a publicar lo mismo no cambia nada (idempotente)');

/* ═══ B · LAS REGLAS ════════════════════════════════════════════════════ */
const sinAuth = await fetch(`${FS}/v1/projects/${PROY}/databases/(default)/documents/formatos/catalogo`);
log(sinAuth.status === 200, '[B1] el catálogo se lee sin sesión (formatos públicos, también la web sin cuenta)');
const esc = await fetch(`${FS}/v1/projects/${PROY}/databases/(default)/documents/formatos/catalogo`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { version: { integerValue: '99' } } }) });
log(esc.status === 403, '[B2] ningún cliente escribe el catálogo', esc.status);
const sub = await fetch(`${ST}/v0/b/${BUCKET}/o?name=${encodeURIComponent('formatos/estandarizados/intruso.pdf')}&uploadType=media`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: '%PDF-1.4 intruso' });
log(sub.status === 403 || sub.status === 401, '[B3] ningún cliente sube archivos a Storage', sub.status);
const leer = await fetch(`${ST}/v0/b/${BUCKET}/o/${encodeURIComponent(objs[0])}?alt=media`);
log(leer.status === 200, '[B4] los archivos de formatos se leen sin sesión');
const fuera = await fetch(`${ST}/v0/b/${BUCKET}/o?name=${encodeURIComponent('otra/x.txt')}&uploadType=media`, { method: 'POST', body: 'x' });
log(fuera.status === 403 || fuera.status === 401, '[B5] fuera de formatos/ el bucket está cerrado', fuera.status);

/* ═══ C · NAVEGACIÓN ════════════════════════════════════════════════════ */
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, acceptDownloads: true });
await ctx.addInitScript(e => {
  const o = JSON.parse(localStorage.getItem('lc_flags') || '{}'); o.formatosEmulador = e;
  localStorage.setItem('lc_flags', JSON.stringify(o));
  window.__csp = []; document.addEventListener('securitypolicyviolation', v => window.__csp.push(v.blockedURI + ' ' + v.violatedDirective));
  window.__shared = null;
  navigator.canShare = () => true;
  navigator.share = async d => { window.__shared = (d.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })); };
}, EMU);
const page = await ctx.newPage();
const red = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('request', q => red.push({ u: q.url(), t: Date.now() }));
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window._lcListo === true, null, { timeout: 15000 });
await page.waitForTimeout(2000);
const pesados = red.filter(x => /vendor\/(firebase\.js|pdfjs)/.test(x.u) && x.t - t0 < 2500);
log(!pesados.length, '[C1] abrir la app no carga el SDK de Firebase ni el lector de PDF', pesados.map(x => x.u).join(' '));
const c2 = await page.evaluate(() => {
  const t = document.querySelector('.mod-tile[data-mod="formatos"]');
  const g = t && t.closest('.mod-g');
  const sb = document.querySelector('#sidebar .sb-item[data-screen="formatos"]');
  let sec = sb && sb.previousElementSibling; while (sec && !sec.classList.contains('sb-sec')) sec = sec.previousElementSibling;
  const grupos = [...document.querySelectorAll('#ini-mods .mod-sec')].map(x => x.textContent);
  return { tile: !!t, grupo: g && g.querySelector('.mod-sec').textContent, sb: sec && sec.textContent, grupos };
});
log(c2.tile && c2.grupo === 'Recursos' && c2.sb === 'Recursos', '[C2] Formatos tiene mosaico en el grupo «Recursos» del Inicio y en el panel lateral', JSON.stringify(c2));
log(c2.grupos.join('|') === 'Operación|Gestión|Recursos|Mi cuenta', '[C3] Recursos va entre Gestión y Mi cuenta', c2.grupos.join('|'));
await page.click('.mod-tile[data-mod="formatos"]');
await page.waitForSelector('#screen-formatos.on .fm-card', { timeout: 20000 });
log(await page.evaluate(() => window.screens.indexOf('formatos') >= 0 && document.getElementById('screen-formatos').getBoundingClientRect().height > 300), '[C4] la pantalla Formatos se abre y se ve');

/* ═══ D · LA LISTA ══════════════════════════════════════════════════════ */
const d1 = await page.evaluate(() => ({ sub: document.getElementById('fm-sub').textContent,
  n: document.querySelectorAll('#fm-list .fm-card').length, of: document.getElementById('fm-n-oficial').textContent, no: document.getElementById('fm-n-no_oficial').textContent,
  tabs: [...document.querySelectorAll('#fm-tabs .tab')].map(b => b.textContent.replace(/\d+/g, '').trim()),
  tags: [...document.querySelectorAll('.fm-card[data-fm="fpj-8-cadena"] .fm-tag')].map(x => x.textContent),
  meta: (document.querySelector('.fm-card[data-fm="fpj-8-cadena"] .fm-m') || {}).textContent }));
log(d1.sub === '3 documentos' && d1.n === 2 && d1.of === '2' && d1.no === '1', '[D1] contador del catálogo y de cada pestaña; arranca en Oficiales', JSON.stringify(d1));
log(d1.tabs.join('|') === 'Oficiales|No oficiales', '[D2] dos pestañas: Oficiales y No oficiales', d1.tabs.join('|'));
log(d1.tags.join('|') === 'PDF|Word' && /FPJ-8 · Fiscalía/.test(d1.meta), '[D3] la tarjeta dice código, fuente y qué archivos tiene (una sola tarjeta para PDF y Word)', d1.tags.join('|') + ' ' + d1.meta);
await page.click('#fm-tab-no_oficial');
log(await page.evaluate(() => [...document.querySelectorAll('#fm-list .fm-card')].map(c => c.dataset.fm).join()) === 'guia-oficio', '[D4] la pestaña No oficiales muestra solo los no oficiales');
await page.click('#fm-tab-oficial');
const busca = async q => { await page.fill('#fm-q', q); return page.evaluate(() => [...document.querySelectorAll('#fm-list .fm-card')].map(c => c.dataset.fm).join()); };
log(await busca('rotulo') === 'fpj-7-rotulo', '[D5] el buscador ignora tildes y mayúsculas («rotulo» → Rótulo)');
log(await busca('fpj-8') === 'fpj-8-cadena', '[D6] busca por código');
log((await busca('906 ley')).split(',').length === 2, '[D7] busca por norma, con las palabras en cualquier orden');
await busca('guia oficio');
const d8 = await page.evaluate(() => ({ n: document.querySelectorAll('#fm-list .fm-card').length, otra: (document.querySelector('.fm-otra') || {}).textContent || '' }));
log(d8.n === 0 && /1 en No oficiales/.test(d8.otra), '[D8] sin resultados en la pestaña, dice cuántos hay en la otra', d8.otra);
await page.click('.fm-otra button');
log(await page.evaluate(() => _fmTab === 'no_oficial' && document.querySelectorAll('#fm-list .fm-card').length === 1), '[D9] «Ver» lleva a la otra pestaña sin perder la búsqueda');
await page.fill('#fm-q', ''); await page.click('#fm-tab-oficial');

/* ═══ E · EL MENÚ ⋮ ═════════════════════════════════════════════════════ */
await page.click('.fm-card[data-fm="fpj-8-cadena"] .prow-more');
await page.waitForSelector('#act-sheet.on');
const e1 = await page.evaluate(() => [...document.querySelectorAll('#act-items .sheet-item .ti')].map(x => x.textContent));
log(e1[0] === 'PDF' && e1[1] === 'Word', '[E1] con PDF y Word, el menú primero pregunta cuál', e1.join('|'));
await page.click('#act-items .sheet-item:has-text("PDF")');
await page.waitForSelector('#act-items .sheet-item:has-text("Ver")', { timeout: 20000 });
const e2 = await page.evaluate(() => [...document.querySelectorAll('#act-items .sheet-item .ti')].map(x => x.textContent));
log(e2.join('|') === 'Ver|Descargar|Compartir', '[E2] después del archivo, las acciones: Ver · Descargar · Compartir', e2.join('|'));
await page.click('#act-items .sheet-item:has-text("Ver")');
await page.waitForSelector('#fm-ov.on .fm-pag[data-ok="1"]', { timeout: 30000 });
const e3 = await page.evaluate(() => ({ t: document.getElementById('fm-ov-t').textContent, s: document.getElementById('fm-ov-s').textContent,
  w: document.querySelector('.fm-pag canvas').width }));
log(e3.t === 'Registro de cadena de custodia' && /página/.test(e3.s) && e3.w > 300, '[E3] «Ver» abre el visor y dibuja el PDF', JSON.stringify(e3));
log(red.some(x => /vendor\/pdfjs\/pdf\.min\.mjs/.test(x.u)), '[E4] el lector de PDF se carga recién al abrir el visor, desde vendor/ (sin CDN)');
await page.goBack();
await page.waitForTimeout(300);
log(await page.evaluate(() => !fmVisorAbierto() && _on('formatos')), '[E5] el botón atrás cierra el visor y se queda en Formatos');
await page.click('.fm-card[data-fm="fpj-8-cadena"] .prow-more');
await page.click('#act-items .sheet-item:has-text("PDF")');
await page.waitForSelector('#act-items .sheet-item:has-text("Ver")');
await page.click('#act-items .sheet-item:has-text("Ver")');
await page.waitForSelector('#fm-ov.on .fm-pag[data-ok="1"]');
await page.click('#fm-ov .fm-ov-h .topbar-btn[aria-label="Cerrar la vista previa"]');
await page.waitForTimeout(400);
log(await page.evaluate(() => !fmVisorAbierto() && _on('formatos')), '[E6] cerrar el visor no saca de Formatos');
await page.click('.fm-card[data-fm="fpj-8-cadena"] .prow-more');
await page.click('#act-items .sheet-item:has-text("Word")');
await page.waitForSelector('#act-items .sheet-item:has-text("Descargar")');
const e7 = await page.evaluate(() => [...document.querySelectorAll('#act-items .sheet-item .ti')].map(x => x.textContent));
log(e7.join('|') === 'Descargar|Compartir', '[E7] un Word no ofrece vista previa', e7.join('|'));
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#act-items .sheet-item:has-text("Descargar")')]);
const ruta = join(DIR, 'bajado.docx'); await dl.saveAs(ruta);
log(dl.suggestedFilename() === 'FPJ-8 Registro de cadena de custodia.docx' && sha(readFileSync(ruta)) === sha(readFileSync(join(DIR, 'fpj8.docx'))),
  '[E8] Descargar entrega el archivo publicado, idéntico y con su nombre', dl.suggestedFilename());
await page.click('.fm-card[data-fm="fpj-7-rotulo"] .prow-more');
await page.waitForSelector('#act-items .sheet-item:has-text("Compartir")', { timeout: 20000 });
log(await page.evaluate(() => !document.querySelector('#act-items .sheet-item .ti') || [...document.querySelectorAll('#act-items .sheet-item .ti')][0].textContent === 'Ver'),
  '[E9] con un solo archivo no pregunta cuál: va directo a las acciones');
await page.click('#act-items .sheet-item:has-text("Compartir")');
await page.waitForFunction(() => !!window.__shared, null, { timeout: 5000 });
const e10 = await page.evaluate(() => window.__shared);
log(e10.length === 1 && e10[0].type === 'application/pdf' && e10[0].size === readFileSync(join(DIR, 'fpj7.pdf')).length && /\.pdf$/.test(e10[0].name),
  '[E10] Compartir manda el PDF a la hoja del sistema (navigator.share con el archivo)', JSON.stringify(e10));
await page.click('.fm-card[data-fm="fpj-8-cadena"] .prow-more');
const e11 = await page.evaluate(() => (document.querySelector('#act-items .sheet-item:has(.ti) .de') || {}).textContent || '');
log(/Guardado en el teléfono/.test(e11), '[E11] el menú dice qué archivos ya están guardados en el teléfono', e11);
await page.evaluate(() => closeActionSheet());
/* En el envoltorio un <a download> no guarda nada: se escribe con Filesystem en
   Descargas, y si no se puede se abre la hoja de compartir (complemento simulado). */
const e12 = await page.evaluate(async () => {
  const llamadas = [], compartido = [];
  let fallar = false;
  window.Capacitor = { isNativePlatform: () => true, Plugins: {
    Filesystem: { writeFile: async o => { llamadas.push(o.directory + ':' + o.path); if (fallar && o.directory === 'EXTERNAL_STORAGE') throw new Error('no'); return { uri: 'file:///x' }; },
                  getUri: async o => ({ uri: 'file:///cache/' + o.path }) },
    Share: { share: async o => { compartido.push(o.files.length); } } } };
  fmDescargar(); await new Promise(r => setTimeout(r, 300));
  const ok1 = llamadas.slice();
  fallar = true; llamadas.length = 0;
  fmDescargar(); await new Promise(r => setTimeout(r, 600));
  delete window.Capacitor;
  return { ok1, intentos: llamadas.filter(x => /^EXTERNAL_STORAGE/.test(x)).length, compartido: compartido.length };
});
log(e12.ok1.length === 1 && e12.ok1[0] === 'EXTERNAL_STORAGE:Download/FPJ-7 Rótulo de EMP y EF.pdf' && e12.intentos === 3 && e12.compartido >= 1,
  '[E12] en Android, Descargar escribe en la carpeta Descargas; si no puede, ofrece compartir', JSON.stringify(e12));

/* ═══ F · SIN SEÑAL ═════════════════════════════════════════════════════ */
await ctx.setOffline(true);
/* Se olvida lo que hay en memoria: todo sale de IndexedDB, como al abrir la app sin señal. */
await page.evaluate(() => { _fmCat = null; _fmLocalP = null; go('inicio'); go('formatos'); });
await page.waitForSelector('#screen-formatos.on .fm-card', { timeout: 10000 });
log(await page.evaluate(() => navigator.onLine === false && document.querySelectorAll('#fm-list .fm-card').length === 2), '[F1] sin señal, el catálogo sale del teléfono');
log(await busca('cadena') === 'fpj-8-cadena', '[F2] sin señal, el buscador funciona');
await page.fill('#fm-q', '');
await page.click('.fm-card[data-fm="fpj-8-cadena"] .prow-more');
await page.click('#act-items .sheet-item:has-text("PDF")');
await page.waitForSelector('#act-items .sheet-item:has-text("Ver")', { timeout: 10000 });
await page.click('#act-items .sheet-item:has-text("Ver")');
await page.waitForSelector('#fm-ov.on .fm-pag[data-ok="1"]', { timeout: 20000 });
log(true, '[F3] sin señal, un PDF ya usado se abre en el visor');
await page.goBack(); await page.waitForTimeout(300);
await page.click('#fm-tab-no_oficial');
await page.click('.fm-card[data-fm="guia-oficio"] .prow-more');
await page.waitForSelector('#act-items .sheet-item:has-text("Sin conexión")', { timeout: 10000 });
log(true, '[F4] sin señal, un archivo que nunca se abrió lo dice en vez de quedarse cargando');
await page.evaluate(() => closeActionSheet());
await page.click('#fm-tab-oficial');
await ctx.setOffline(false);

/* ═══ G · FAVORITOS Y NOVEDADES ═════════════════════════════════════════ */
await page.click('.fm-card[data-fm="fpj-8-cadena"] .fm-fav');
await page.waitForTimeout(400);
const g1 = await page.evaluate(() => ({ orden: [...document.querySelectorAll('#fm-list .fm-card')].map(c => c.dataset.fm).join(),
  on: document.querySelector('.fm-card[data-fm="fpj-8-cadena"] .fm-fav').getAttribute('aria-pressed'), cfg: (DB.getConfig().formatosFav || {})['fpj-8-cadena'] }));
log(g1.orden === 'fpj-8-cadena,fpj-7-rotulo' && g1.on === 'true' && g1.cfg === 1, '[G1] la estrella marca el favorito y lo sube al principio', JSON.stringify(g1));
await page.waitForFunction(() => !_lcWriteChain || true);
await page.waitForTimeout(800);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window._lcListo === true);
await page.evaluate(() => go('formatos'));
await page.waitForSelector('#screen-formatos.on .fm-card');
log(await page.evaluate(() => document.querySelector('#fm-list .fm-card').dataset.fm === 'fpj-8-cadena'), '[G2] el favorito se recuerda al volver a abrir la app (va en la configuración)');
log(await page.evaluate(() => !document.querySelector('.fm-new')), '[G3] la primera visita no marca nada como nuevo');
/* Se publica una versión nueva del FPJ-7 y un formato nuevo. */
const L2 = LOTE.map(x => x.id === 'fpj-7-rotulo' ? Object.assign({}, x, { version: '3' }) : x);
L2.push({ id: 'fpj-30-entrega', nombre: 'Acta de entrega', codigo: 'FPJ-30', categoria: 'oficial', fuente: 'Fiscalía General de la Nación', pdf: 'fpj7.pdf' });
escribirLote(L2);
r = admin('--aplicar');
cat = await catalogo();
log(r.ok && cat.version === 2 && cat.n === 4, '[G4] publicar un cambio sube la versión del catálogo (sin tocar la app)', JSON.stringify(cat));
await page.evaluate(() => go('inicio'));
await page.evaluate(() => go('formatos'));
await page.waitForFunction(() => document.querySelectorAll('#fm-list .fm-card').length === 3, null, { timeout: 15000 });
const g5 = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#fm-list .fm-card')].map(c => [c.dataset.fm, (c.querySelector('.fm-new') || {}).textContent || ''])));
log(g5['fpj-30-entrega'] === 'Nuevo' && g5['fpj-7-rotulo'] === 'Actualizado' && g5['fpj-8-cadena'] === '', '[G5] lo agregado sale «Nuevo» y lo cambiado «Actualizado»', JSON.stringify(g5));
await page.evaluate(() => { go('inicio'); });
const g6 = await page.evaluate(() => document.querySelector('.mod-tile[data-mod="formatos"] .mod-d').textContent);
log(g6 === '4 formatos', '[G6] tras la visita, el Inicio ya no anuncia novedades', g6);
await page.evaluate(() => go('formatos'));
await page.waitForSelector('#screen-formatos.on .fm-card');
log(await page.evaluate(() => !document.querySelector('.fm-new')), '[G7] en la siguiente visita las marcas desaparecen');
/* Un archivo cambiado se vuelve a bajar (el guardado viejo no vale). */
escribirLote(LOTE.filter(x => x.id !== 'guia-oficio').concat([{ id: 'fpj-30-entrega', nombre: 'Acta de entrega', codigo: 'FPJ-30', categoria: 'oficial', pdf: 'fpj8.pdf' }]));
const antesObjs = await objetos();
r = admin('--aplicar');
const desp = await objetos();
cat = await catalogo();
log(r.ok && cat.n === 3 && !desp.some(o => /guia-oficio/.test(o)) && antesObjs.some(o => /guia-oficio/.test(o)), '[G8] retirar un formato lo saca del catálogo y borra su archivo', desp.join(' '));
await page.evaluate(() => { go('inicio'); go('formatos'); });
await page.waitForFunction(() => _fmCat && _fmCat.version === 3, null, { timeout: 15000 });
const g9 = await page.evaluate(() => ({ guard: Object.keys(_fmGuard).filter(k => /guia-oficio|fpj-30/.test(k)), no: document.getElementById('fm-n-no_oficial').textContent }));
log(g9.no === '0' && !g9.guard.length, '[G9] el teléfono olvida lo retirado y los archivos que cambiaron', JSON.stringify(g9));

/* ═══ H · ESTRUCTURA Y SISTEMA VISUAL ═══════════════════════════════════ */
const csp = (src.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
log(/connect-src[^;]*https:\/\/firebasestorage\.googleapis\.com/.test(csp) && /worker-src 'self'/.test(csp) && !/unsafe-eval/.test(csp), '[H1] la CSP abre solo Storage, el worker es local y sigue sin unsafe-eval');
log(await page.evaluate(() => window.__csp.length === 0), '[H2] ninguna violación de la CSP', await page.evaluate(() => window.__csp.join(' ')));
log(!/cdn\.|unpkg|jsdelivr|cdnjs/.test(src.slice(src.indexOf('FORMATOS (2026-10-30'))) && existsSync(join(ROOT, 'vendor/pdfjs/pdf.worker.min.mjs')), '[H3] pdf.js viaja en vendor/pdfjs/, sin CDN');
log(!/serviceWorker\.register\(/.test(src), '[H4] la app ya no registra un Service Worker (web retirada): el lector viaja dentro del paquete');
log(/vendor', 'pdfjs'/.test(readFileSync(join(ROOT, 'scripts/build-android.mjs'), 'utf8')), '[H5] el paquete de Android lleva el lector de PDF');
const bloque = src.slice(src.indexOf('<section id="screen-formatos"'), src.indexOf('<!-- ====== TURNOS (2026-10-29'));
log(!/\p{Extended_Pictographic}/u.test(bloque) && !/\p{Extended_Pictographic}/u.test(await page.evaluate(() => document.getElementById('screen-formatos').innerText)), '[H6] sin emojis en la pantalla');
const cssFm = src.slice(src.indexOf('/* ═══ FORMATOS (build 176) ═══'), src.indexOf('/* ═══ RESPONSIVE ═══ */'));
const literales = (cssFm.match(/#[0-9a-fA-F]{3,8}\b/g) || []);
log(literales.every(c => /^#fff$/i.test(c)) && !/gradient/.test(cssFm), '[H7] el CSS del módulo usa tokens (solo blanco fijo en el visor y la hoja del PDF)', literales.join(' '));
const lum = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
for (const tema of ['light', 'dark']) {
  await page.evaluate(t => { setTheme(t); go('inicio'); go('formatos'); }, tema);
  await page.waitForSelector('#screen-formatos.on .fm-card');
  await page.screenshot({ path: join(ROOT, `verify_formatos_${tema}.png`) });
  const m = await page.evaluate(() => {
    const cs = e => getComputedStyle(e);
    const fondo = e => { while (e) { const b = cs(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; e = e.parentElement; } return 'rgb(255,255,255)'; };
    const n = document.querySelector('.fm-n'), m = document.querySelector('.fm-m'), tag = document.querySelector('.fm-tag'), fav = document.querySelector('.fm-fav.on');
    return { n: [cs(n).color, fondo(n)], m: [cs(m).color, fondo(m)], tag: [cs(tag).color, fondo(tag)], fav: [cs(fav).color, fondo(fav.parentElement)] };
  });
  const r1 = ratio(...m.n), r2 = ratio(...m.m), r3 = ratio(...m.tag), r4 = ratio(...m.fav);
  log(r1 >= 4.5 && r2 >= 4.5 && r3 >= 4.5 && r4 >= 3, `[H8] contraste AA en tema ${tema === 'light' ? 'claro' : 'oscuro'} (nombre, datos, insignia; estrella ≥3:1)`,
    [r1, r2, r3, r4].map(x => x.toFixed(1)).join(' · '));
}
await page.setViewportSize({ width: 360, height: 760 });
await page.evaluate(() => { go('inicio'); go('formatos'); });
await page.waitForSelector('#screen-formatos.on .fm-card');
log(await page.evaluate(() => document.documentElement.scrollWidth <= 360), '[H9] a 360 px no hay desborde horizontal');
await page.setViewportSize({ width: 1280, height: 800 });
await page.screenshot({ path: join(ROOT, 'verify_formatos_desktop.png') });
log(await page.evaluate(() => document.querySelector('#sidebar .sb-item[data-screen="formatos"]').classList.contains('on')), '[H10] en escritorio el panel lateral marca Formatos');
/* Cortar la red a propósito (sección F) deja avisos del propio navegador: no son de la app. */
const errApp = errs.filter(e => !/ERR_INTERNET_DISCONNECTED/.test(e));
log(!errApp.length, '[H11] consola limpia', errApp.join(' | '));
await ctx.close();
} catch (e) { log(false, 'ERROR', e.stack); }
finally {
  await browser.close(); server.close(); apagar();
  try { rmSync(DIR, { recursive: true, force: true }); } catch (e) {}
}
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
