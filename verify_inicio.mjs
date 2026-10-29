// Verificación del Inicio por módulos (2026-10-29, build 161).
// La app abre en un lanzador de seis módulos con dato vivo, en tres grupos de
// dos; la barra inferior lleva destinos globales (Inicio · Buscar · Nueva ·
// Pendientes · Perfil). Se mide sobre la app real en un teléfono (384×800,
// touch) y en escritorio (1440×900): arranque, orden, dato vivo, navegación y
// botón atrás, Buscar, Pendientes, desborde, contraste y consola.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'D:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((q, r) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  r.end(readFileSync(p));
});
await new Promise(r => server.listen(8229, r));
const URL = 'http://localhost:8229/LexCapture_v8.html';

let ok = 0, fail = 0;
const log = (c, l, x) => { c ? ok++ : fail++; console.log((c ? 'OK  ' : 'FAIL'), l, x !== undefined && !c ? x : ''); };

const browser = await chromium.launch();
const errs = [];
async function abrir(w, h, tema) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem('lc_theme', t); }, tema);
  await page.reload();
  await page.waitForFunction(() => window._lcListo === true);
  await page.waitForTimeout(300);
  return { ctx, page };
}
const actual = p => p.evaluate(() => _lcPantallaActual());

/* ═══ A · arranque ═══ */
let { ctx, page } = await abrir(384, 800, 'light');
const a = await page.evaluate(() => {
  const s = document.getElementById('screen-inicio'), r = s.getBoundingClientRect();
  return { on: _lcPantallaActual(), hash: location.hash, enMain: !!s.closest('#main'), alto: r.height,
    mods: [...document.querySelectorAll('.mod-tile')].map(t => t.dataset.mod),
    secs: [...document.querySelectorAll('#ini-mods .mod-sec')].map(t => t.textContent.trim()),
    grupos: [...document.querySelectorAll('#ini-mods .mod-g')].map(g => [...g.querySelectorAll('.mod-tile')].map(t => t.dataset.mod).join('+')) };
});
log(a.on === 'inicio' && a.hash === '#inicio', '[A1] La app arranca en Inicio, no en Capturas', JSON.stringify(a));
log(a.enMain && a.alto > 400, '[A2] El Inicio se VE (vive en #main y tiene alto real)', a.alto);
log(JSON.stringify(a.mods) === JSON.stringify(['capturas', 'personas', 'estadisticas', 'despachos', 'perfil', 'ajustes']),
  '[A3] Seis módulos en el orden fijado', a.mods);
log(JSON.stringify(a.secs) === JSON.stringify(['Operación', 'Gestión', 'Mi cuenta']) &&
    JSON.stringify(a.grupos) === JSON.stringify(['capturas+personas', 'estadisticas+despachos', 'perfil+ajustes']),
  '[A4] Tres grupos de dos: Operación · Gestión · Mi cuenta', JSON.stringify(a.grupos));
const fr = await page.evaluate(() => [[0, 30], [1, 0], [11, 59], [12, 0], [17, 59], [18, 0], [23, 59]]
  .map(([h, m]) => lcSaludo(new Date(2026, 9, 29, h, m))));
log(JSON.stringify(fr) === JSON.stringify(['Buenas noches', 'Buenos días', 'Buenos días', 'Buenas tardes', 'Buenas tardes', 'Buenas noches', 'Buenas noches']),
  '[A5] El saludo usa las franjas del dossier (01 / 12 / 18)', fr);
const sinNombre = await page.evaluate(() => document.getElementById('ini-hola').innerText);
log(/Buen/.test(sinNombre) && !/,/.test(sinNombre.split('\n').pop()), '[A6] Sin perfil saluda sin inventar un nombre', sinNombre);

/* ═══ B · dato vivo ═══ */
await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'NELSON DAVID GOMEZ RUIZ' }]; cfg.perfilActivo = 'p1';
  cfg.despachosPropios = [{ id: 'd1', nombre: 'Fiscalía URI Prueba', clase: 'FISCALIA' }];
  await DB.saveConfig(cfg);
  const hoy = new Date(), iso = d => d.toISOString().slice(0, 10);
  const viejo = new Date(hoy.getFullYear() - 1, 0, 15);
  const casos = [
    { id: 'c1', tipo: 'URI', fechaProc: iso(hoy), nunc: '0500160000002026', capturados: [{ id: 'k1', priNom: 'JUAN', priApe: 'PÉREZ', numDoc: '71.234.567' }], conductas: ['Hurto calificado'], lugar: { barrio: 'Prado' } },
    { id: 'c2', tipo: 'CESPA', fechaProc: iso(hoy), capturados: [{ id: 'k2', priNom: 'ANDRÉS', priApe: 'RÍOS', numDoc: '1012345678' }], victimas: [{ id: 'v2', priNom: 'LUZ', priApe: 'MARÍN', numDoc: '43555666' }], conductas: ['Lesiones personales'], lugar: { barrio: 'Colón' } },
    { id: 'c3', tipo: 'URI', fechaProc: iso(viejo), capturados: [{ id: 'k3', priNom: 'CARLOS', priApe: 'TORO', numDoc: '98111222' }], conductas: ['Extorsión'], lugar: { barrio: 'Belén' } }
  ];
  for (const c of casos) { c.created = Date.now(); await DB.saveCase(c); }
  await DB.savePerson({ id: 'pp1', priNom: 'MARÍA', priApe: 'GÓMEZ', numDoc: '43111222', tipoDoc: 'CC', rol: 'Víctima' });
  await DB.savePerson({ id: 'pp2', priNom: 'PEDRO', priApe: 'RUIZ', numDoc: '15999888', tipoDoc: 'CC', rol: 'Testigo' });
  renderInicio();
});
const dato = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.mod-tile')]
  .map(t => [t.dataset.mod, t.querySelector('.mod-d').textContent])));
log(dato.capturas === '3 registradas · 2 este mes', '[B1] Capturas: total y las de este mes', dato.capturas);
log(dato.personas === '2 registradas', '[B2] Personas: cuántas hay', dato.personas);
log(dato.estadisticas === '2 este mes', '[B3] Estadísticas: lo de este mes', dato.estadisticas);
log(dato.despachos === '1 registrado', '[B4] Despachos: cuántos hay', dato.despachos);
log(dato.perfil === 'SI Nelson GOMEZ', '[B5] Perfil: grado abreviado y nombre corto', dato.perfil);
const hola = await page.evaluate(() => document.getElementById('ini-hola').innerText);
log(/SI Nelson GOMEZ/.test(hola), '[B6] El saludo nombra al funcionario del perfil activo', hola);

/* ═══ C · navegación ═══ */
const vis = await page.evaluate(() => ['capturas', 'personas', 'estadisticas', 'despachos', 'perfil', 'ajustes']
  .map(id => { const b = document.querySelector('#screen-' + id + ' .topbar-back'); return b ? getComputedStyle(b).display !== 'none' : false; }));
log(vis.every(Boolean), '[C1] Cada módulo tiene «volver al inicio» en el teléfono', vis);
let ida = [];
for (const m of a.mods) {
  await page.click(`.mod-tile[data-mod="${m}"]`); await page.waitForTimeout(120);
  const llego = await actual(page);
  await page.click(`#screen-${m} .topbar-back`); await page.waitForTimeout(250);
  ida.push(llego === m && (await actual(page)) === 'inicio');
}
log(ida.every(Boolean), '[C2] Cada mosaico abre su pantalla y «volver» regresa a Inicio', ida);
const h0 = await page.evaluate(() => history.length);
for (let i = 0; i < 3; i++) {
  await page.click('.mod-tile[data-mod="personas"]'); await page.waitForTimeout(120);
  await page.goBack(); await page.waitForTimeout(250);
}
const h1 = await page.evaluate(() => history.length);
log((await actual(page)) === 'inicio' && h1 - h0 <= 1, '[C3] El botón atrás vuelve a Inicio y el historial no crece', `${h0}→${h1}`);
await page.click('.mod-tile[data-mod="capturas"]'); await page.waitForTimeout(120);
await page.click('#bottombar [data-screen="buscar"]'); await page.waitForTimeout(120);
await page.goBack(); await page.waitForTimeout(250);
log((await actual(page)) === 'inicio', '[C4] Pasar a otro destino desde un módulo y pulsar atrás también vuelve a Inicio');

const bar = await page.evaluate(() => [...document.querySelectorAll('#bottombar .bn-item')].map(b => {
  const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), s: b.dataset.screen, cx: r.left + r.width / 2 }; }));
log(JSON.stringify(bar.map(b => b.t)) === JSON.stringify(['Inicio', 'Buscar', 'Nueva', 'Pendientes', 'Perfil']),
  '[C5] Barra inferior: Inicio · Buscar · Nueva · Pendientes · Perfil', bar.map(b => b.t));
log(Math.abs(bar[2].cx - 192) <= 2, '[C6] «Nueva» queda en el centro, en la zona del pulgar', bar[2].cx);
log(!bar.some(b => ['capturas', 'estadisticas', 'despachos', 'ajustes', 'personas'].includes(b.s)),
  '[C7] La barra no repite los módulos de Inicio (salvo Perfil, decisión del usuario)');
await page.click('#bottombar [data-screen="perfil"]'); await page.waitForTimeout(150);
log((await actual(page)) === 'perfil' && await page.evaluate(() => document.querySelector('#bottombar [data-screen="perfil"]').classList.contains('on')),
  '[C8] Perfil desde la barra, con su ítem marcado');
await page.click('#bottombar [data-screen="inicio"]'); await page.waitForTimeout(250);
log((await actual(page)) === 'inicio', '[C9] El ítem Inicio de la barra vuelve a Inicio');

await page.click('.mod-tile[data-mod="personas"]'); await page.waitForTimeout(120);
await page.evaluate(() => openModal('<div class="mh"><h2>Prueba</h2></div>'));
await page.goBack(); await page.waitForTimeout(250);
const tras = await page.evaluate(() => ({ s: _lcPantallaActual(), m: document.getElementById('modal').classList.contains('open') }));
log(tras.s === 'personas' && !tras.m, '[C10] Con una ventana abierta, atrás la cierra y no cambia de pantalla', JSON.stringify(tras));
await page.click('#screen-personas .topbar-back'); await page.waitForTimeout(250);

await page.click('#bottombar .bn-cta'); await page.waitForTimeout(150);
await page.click('#screen-nueva .topbar-btn'); await page.waitForTimeout(250);
const n1 = await actual(page);
await page.evaluate(() => go('capturas')); await page.waitForTimeout(100);
await page.evaluate(() => go('nueva')); await page.waitForTimeout(100);
await page.click('#screen-nueva .topbar-btn'); await page.waitForTimeout(250);
const n2 = await actual(page);
log(n1 === 'inicio' && n2 === 'capturas', '[C11] «Volver» de Nueva captura regresa a donde se abrió', `${n1} / ${n2}`);
await page.evaluate(() => { go('inicio'); go('nueva'); startWizard('URI'); });
await page.waitForTimeout(200);
await page.evaluate(() => cancelWiz()); await page.waitForTimeout(250);
log((await actual(page)) === 'inicio', '[C12] Cancelar una captura empezada desde Inicio vuelve a Inicio');
const mas = await page.evaluate(() => ({ sheet: !!document.getElementById('sheet'), f: typeof window.openSheet }));
log(!mas.sheet && mas.f === 'undefined', '[C13] La hoja «Más» se retiró: sus destinos están en Inicio', JSON.stringify(mas));

/* ═══ D · Buscar ═══ */
await page.click('#bottombar [data-screen="buscar"]'); await page.waitForTimeout(200);
const foco = await page.evaluate(() => document.activeElement && document.activeElement.id);
const vacio = await page.evaluate(() => document.getElementById('bus-res').innerText);
log(foco === 'bus-q' && /Busca en todo/.test(vacio), '[D1] Buscar abre con el campo listo y dice qué se puede buscar', foco);
async function busca(q) {
  await page.fill('#bus-q', q); await page.waitForTimeout(80);
  return page.evaluate(() => ({ c: [...document.querySelectorAll('#bus-res [data-bus="c"] .cc-name')].map(e => e.textContent),
    p: [...document.querySelectorAll('#bus-res [data-bus="p"] .prow-name')].map(e => e.textContent), t: document.getElementById('bus-res').innerText }));
}
let r = await busca('perez juan');
log(r.c.length === 1 && /JUAN/.test(r.c[0]), '[D2] Por nombre, en cualquier orden y sin tildes', JSON.stringify(r.c));
const r1 = await busca('71.234.567'), r2 = await busca('71234567');
log(r1.c.length === 1 && r2.c.length === 1, '[D3] Por cédula, con puntos o sin ellos', `${r1.c.length}/${r2.c.length}`);
r = await busca('0500160000002026');
log(r.c.length === 1, '[D4] Por NUNC', r.c);
r = await busca('extorsion');
log(r.c.length === 1 && /CARLOS/.test(r.c[0]), '[D5] Por delito, sin tildes', r.c);
r = await busca('43555666');
log(r.c.length === 1 && /ANDR/.test(r.c[0]), '[D6] Por el documento de una víctima encuentra su captura', r.c);
r = await busca('gomez');
log(r.p.length === 1 && /MARÍA/.test(r.p[0]), '[D7] Encuentra personas del registro', r.p);
r = await busca('colon');
log(r.c.length === 1, '[D8] Por barrio', r.c);
r = await busca('zzzz no existe');
log(r.c.length === 0 && r.p.length === 0 && /Sin resultados/.test(r.t), '[D9] Sin coincidencias lo dice');
await busca('rios');
await page.click('#bus-res [data-bus="c"]'); await page.waitForTimeout(250);
const exp = await page.evaluate(() => ({ s: _lcPantallaActual(), id: _dosCasoId }));
log(exp.s === 'dossier' && exp.id === 'c2', '[D10] Tocar una captura abre su expediente', JSON.stringify(exp));
await page.click('#screen-dossier .topbar-btn'); await page.waitForTimeout(200);
log((await actual(page)) === 'buscar' && (await page.inputValue('#bus-q')) === 'rios', '[D11] «Volver» del expediente regresa a Buscar con la búsqueda');

/* ═══ E · Pendientes ═══ */
await page.click('#bottombar [data-screen="pendientes"]'); await page.waitForTimeout(150);
const e1 = await page.evaluate(() => ({ t: document.getElementById('pend-cont').innerText, sub: document.getElementById('pend-sub').textContent,
  pt: document.getElementById('bz-punto').style.display, cnt: document.getElementById('bz-cnt-nav').style.display }));
log(/Todo al día/.test(e1.t) && e1.sub === 'Todo al día' && e1.pt === 'none' && e1.cnt === 'none', '[E1] Sin nada pendiente: «Todo al día» y sin contador', JSON.stringify(e1));
await page.evaluate(async () => {
  await DB.saveDraft({ caso: { id: 'bd1', tipo: 'URI' }, paso: 2, ts: Date.now(), tipo: 'URI', etiqueta: 'JUAN NUEVO', tipoLbl: 'Flagrancia URI', pasoNombre: 'Personas', total: 9 });
  renderDraftSlot(); renderPendientes();
});
const e2 = await page.evaluate(() => ({ p: !!document.querySelector('#pend-draft .draft-card'), sub: document.getElementById('pend-sub').textContent,
  pt: document.getElementById('bz-punto').style.display, cnt: document.getElementById('bz-cnt-nav').textContent }));
log(e2.p && e2.sub === '1 por atender' && e2.pt !== 'none' && e2.cnt === '1', '[E2] La captura sin terminar cuenta en Pendientes (tarjeta y contador)', JSON.stringify(e2));
await page.click('#bottombar [data-screen="inicio"]'); await page.waitForTimeout(250);
log(await page.evaluate(() => !!document.querySelector('#ini-draft .draft-card')), '[E3] Y aparece arriba en Inicio, para retomarla');
await page.evaluate(async () => { await DB.clearDraft(); renderDraftSlot(); });
log(await page.evaluate(() => !document.querySelector('#ini-draft .draft-card') && document.getElementById('bz-punto').style.display === 'none'),
  '[E4] Al descartarla, desaparece y el contador se apaga');

/* ═══ F · calidad ═══ */
function lum(c) {
  const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]);
}
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
async function contraste(p) {
  return p.evaluate(() => {
    const t = document.querySelector('.mod-tile'), g = e => getComputedStyle(e);
    return { bg: g(t).backgroundColor, t: g(t.querySelector('.mod-t')).color, d: g(t.querySelector('.mod-d')).color,
      sec: g(document.querySelector('.mod-sec')).color, pbg: g(document.body).backgroundColor };
  });
}
const cl = await contraste(page);
await ctx.close();
({ ctx, page } = await abrir(384, 800, 'dark'));
const cd = await contraste(page);
const crs = [cr(cl.t, cl.bg), cr(cl.d, cl.bg), cr(cl.sec, cl.pbg), cr(cd.t, cd.bg), cr(cd.d, cd.bg), cr(cd.sec, cd.pbg)].map(x => +x.toFixed(2));
log(crs.every(x => x >= 4.5), '[F1] Contraste AA de título, dato y grupo en los dos temas', crs);
await ctx.close();
({ ctx, page } = await abrir(360, 740, 'light'));
const sx = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const alt = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.mod-tile')].map(t => t.getBoundingClientRect().height)));
log(sx <= 0 && alt >= 48, '[F2] A 360 px: sin desborde horizontal y mosaicos de más de 48 px', `${sx} / ${alt}`);
await ctx.close();
({ ctx, page } = await abrir(1440, 900, 'light'));
const pc = await page.evaluate(() => ({
  back: [...document.querySelectorAll('.topbar-back')].every(b => getComputedStyle(b).display === 'none'),
  sb: [...document.querySelectorAll('#sidebar .sb-item[data-screen]')].slice(0, 3).map(i => i.dataset.screen),
  xs: [...new Set([...document.querySelectorAll('.mod-tile')].map(t => Math.round(t.getBoundingClientRect().left)))].length,
  h1: document.querySelector('#screen-inicio h1').innerText.trim()
}));
log(pc.back && JSON.stringify(pc.sb) === JSON.stringify(['inicio', 'buscar', 'pendientes']), '[F3] Escritorio: el panel lateral manda (Inicio, Buscar y Pendientes arriba; sin «volver»)', JSON.stringify(pc));
log(pc.xs === 3 && pc.h1 === 'Inicio', '[F4] Escritorio: los tres grupos lado a lado y el título dice «Inicio»', JSON.stringify(pc));
await ctx.close();
log(!errs.length, '[F5] Consola limpia', errs.slice(0, 3));

await browser.close(); server.close();
console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
