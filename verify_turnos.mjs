// Verificación del módulo Turnos (2026-10-29, build 162; build 174: mirar otra
// sección es una consulta, estadísticas en pantalla propia con cuatro períodos,
// y el 3.º amarillo frente al 2.º–1.º rojo).
// Calendario de las tres secciones de vigilancia: ciclo Tercero → Segundo –
// primero → Disponible desde el 01/01/2026, con horas, novedades
// propias y compartir. El oráculo son los dos documentos del usuario: su tabla
// de enero de 2026 (las tres escuadras) y su calendario de octubre de la 2.ª
// sección. Se mide sobre la app real en un teléfono (384×800, touch), en los
// dos temas, y en escritorio.
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
await new Promise(r => server.listen(8233, r));
const URL = 'http://localhost:8233/LexCapture_v8.html';

let ok = 0, fail = 0;
const log = (c, l, x) => { c ? ok++ : fail++; console.log((c ? 'OK  ' : 'FAIL'), l, x !== undefined && !c ? x : ''); };

const browser = await chromium.launch();
const errs = [];
async function abrir(w, h, tema, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, hasTouch: w < 900, timezoneId: 'America/Bogota' }, extra || {}));
  await ctx.addInitScript(() => {
    window._csp = [];
    document.addEventListener('securitypolicyviolation', e => window._csp.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem('lc_theme', t); }, tema);
  await page.reload();
  await page.waitForFunction(() => window._lcListo === true);
  await page.waitForTimeout(250);
  return { ctx, page };
}

/* Tabla del usuario, enero de 2026 (Escuadra 1 · 2 · 3). S = Segundo – primero. */
const ENERO = ['STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD',
  'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD', 'DST', 'TDS', 'STD'];
/* Su calendario de octubre de 2026, 2.ª sección: TER · 2DO-1RO · DISPONIBLE. */
const OCTUBRE = 'TSDTSDTSDTSDTSDTSDTSDTSDTSDTSDT';

/* ═══ A · el ciclo ═══ */
let { ctx, page } = await abrir(384, 800, 'light');
const ene = await page.evaluate(() => {
  const out = [];
  for (let d = 1; d <= 31; d++) out.push([1, 2, 3].map(s => tnBase('2026-01-' + String(d).padStart(2, '0'), s, { desfase: 0 })).join(''));
  return out;
});
const malos = ene.map((x, i) => x === ENERO[i] ? null : (i + 1) + ':' + x + '≠' + ENERO[i]).filter(Boolean);
log(!malos.length, '[A1] Las 93 casillas de enero coinciden con la tabla del usuario (3 secciones × 31 días)', malos);
const oct = await page.evaluate(() => { let s = ''; for (let d = 1; d <= 31; d++) s += tnBase('2026-10-' + String(d).padStart(2, '0'), 2, { desfase: 0 }); return s; });
log(oct === OCTUBRE, '[A2] Octubre de la 2.ª sección coincide con su calendario', oct);
const dist = await page.evaluate(() => {
  let todos = true;
  for (let i = 0; i < 800; i++) {
    const iso = tnMas('2025-06-01', i), s = [1, 2, 3].map(x => tnBase(iso, x, { desfase: 0 }));
    if (new Set(s).size !== 3) todos = false;
  }
  return todos;
});
log(dist, '[A3] Cada día de 2025 a 2027 las tres secciones tienen turnos distintos (servicio 24/7)');
const cont = await page.evaluate(() => {
  const sig = { T: 'S', S: 'D', D: 'T' };
  return [1, 2, 3].every(s => sig[tnBase('2026-12-31', s, { desfase: 0 })] === tnBase('2027-01-01', s, { desfase: 0 }) &&
    sig[tnBase('2025-12-31', s, { desfase: 0 })] === tnBase('2026-01-01', s, { desfase: 0 }));
});
log(cont, '[A4] El ciclo NO se reinicia el 1 de enero y funciona antes del 01/01/2026');
/* Build 172: el ciclo es fijo. Un desfase guardado por una versión anterior se ignora. */
const cal = await page.evaluate(() => {
  const hoy = '2027-03-14', fijo = [1, 2, 3].map(s => tnBase(hoy, s));
  const conDesfase = [1, 2, 3].map(s => tnBase(hoy, s, tnCfg({ turnos: { seccion: s, desfase: 1 } })));
  return { igual: JSON.stringify(fijo) === JSON.stringify(conDesfase), distintas: new Set(fijo).size === 3,
    sinClave: !('desfase' in tnCfg({ turnos: { seccion: 2, desfase: 2 } })), sinFn: typeof tnDesfasePara === 'undefined' && typeof tnCalElegir === 'undefined' };
});
log(cal.igual && cal.sinClave, '[A5] El ciclo es fijo: un desfase guardado antes no lo corre', JSON.stringify(cal));
log(cal.distintas && cal.sinFn, '[A6] Las tres secciones siguen con turnos distintos y no queda código de calibración', JSON.stringify(cal));

/* ═══ B · festivos ═══ */
const fest = await page.evaluate(() => lcFestivosCO(2026));
const ESPERA = { '2026-01-01': 'Año Nuevo', '2026-01-12': 'Reyes Magos', '2026-03-23': 'San José', '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo', '2026-05-01': 'Día del Trabajo', '2026-05-18': 'Ascensión del Señor', '2026-06-08': 'Corpus Christi',
  '2026-06-15': 'Sagrado Corazón', '2026-06-29': 'San Pedro y San Pablo', '2026-07-20': 'Día de la Independencia',
  '2026-08-07': 'Batalla de Boyacá', '2026-08-17': 'Asunción de la Virgen', '2026-10-12': 'Día de la Raza',
  '2026-11-02': 'Todos los Santos', '2026-11-16': 'Independencia de Cartagena', '2026-12-08': 'Inmaculada Concepción', '2026-12-25': 'Navidad' };
log(JSON.stringify(fest) === JSON.stringify(Object.fromEntries(Object.keys(ESPERA).sort().map(k => [k, ESPERA[k]]))) ||
    Object.keys(ESPERA).every(k => fest[k] === ESPERA[k]) && Object.keys(fest).length === 18,
  '[B1] Los 18 festivos de 2026 con su nombre (Ley 51 de 1983)', fest);
const par = await page.evaluate(() => {
  for (let y = 2026; y <= 2035; y++) {
    const a = Object.keys(ojFestivos(y)).sort().join(), b = Object.keys(lcFestivosCO(y)).sort().join();
    if (a !== b) return y;
  }
  return 0;
});
log(par === 0, '[B2] El motor del oficio (ojFestivos) y el calendario usan la MISMA lista, 2026–2035', par);

/* ═══ C · horas y estado ═══ */
const est = await page.evaluate(() => {
  const t = { seccion: 2, desfase: 0, horas: null, novedades: [] };
  const f = (d, h, m) => { const e = tnEstado(new Date(2026, 9, d, h, m), 2, t); return (e.en ? 'EN:' + e.en.k + '>' + ojHHMM(e.en.fin) : 'PX:' + (e.prox ? e.prox.k + '@' + e.prox.iso + ' ' + ojHHMM(e.prox.ini) : '-')); };
  return [f(29, 5, 59), f(29, 6, 0), f(29, 12, 59), f(29, 13, 0), f(29, 20, 59), f(29, 21, 0), f(29, 23, 59), f(30, 0, 0), f(30, 5, 59), f(30, 6, 0)];
});
log(JSON.stringify(est) === JSON.stringify(['PX:t2@2026-10-29 06:00', 'EN:t2>13:00', 'EN:t2>13:00', 'PX:t41@2026-10-29 21:00',
  'PX:t41@2026-10-29 21:00', 'EN:t41>06:00', 'EN:t41>06:00', 'EN:t41>06:00', 'EN:t41>06:00', 'PX:t3@2026-10-31 13:00']),
  '[C1] Bordes del día de Segundo – primero: 05:59 · 06:00 · 12:59 · 13:00 · 20:59 · 21:00 · 23:59 · 00:00 · 05:59 · 06:00', est);
const frase = await page.evaluate(() => {
  const t = { seccion: 2, desfase: 0, horas: null, novedades: [] }, a = new Date(2026, 9, 30, 2, 15);
  return tnFraseEstado(tnEstado(a, 2, t), a).t;
});
log(/hasta las 06:00 · faltan 3 h 45 min \(turno de anoche\)/.test(frase), '[C2] De madrugada dice que sigue el turno de anoche y cuánto falta', frase);
const hr = await page.evaluate(() => {
  const t = { seccion: 2, desfase: 0, horas: null, novedades: [] };
  return { S: tnBloques('2026-10-29', 2, t).reduce((a, b) => a + b.min, 0) / 60, T: tnBloques('2026-10-31', 2, t).reduce((a, b) => a + b.min, 0) / 60,
    D: tnBloques('2026-10-30', 2, t).length, txt: tnHorasTxt('S', t),
    /* Octubre visto desde el 31 a medianoche: el mes entero ya prestado. */
    oct: tnEstadisticas(2026, Object.assign({ historial: [{ id: 'x', desde: '', seccion: 2 }], servicios: [] }, t), new Date(2026, 10, 1, 6, 0)).meses[9] };
});
log(hr.S === 16 && hr.T === 8 && hr.D === 0 && hr.txt === '06:00–13:00 y 21:00–06:00',
  '[C3] Horas del usuario: 2.º 06–13, 3.er 13–21, 4.º/1.er 21–06 (16 h, 8 h, 0 h)', JSON.stringify(hr));
log(hr.oct.T === 11 && hr.oct.S === 10 && hr.oct.D === 10 && hr.oct.horas === 248,
  '[C4] Octubre completo: 11 terceros · 10 segundos–primeros · 10 disponibles y 248 h', JSON.stringify(hr.oct));

/* ═══ D · la pantalla ═══ */
await page.evaluate(() => go('turnos')); await page.waitForTimeout(150);
const vac = await page.evaluate(() => ({ e: !!document.querySelector('#tn-vacio .empty'), cols: getComputedStyle(document.getElementById('tn-cols')).display,
  sh: getComputedStyle(document.getElementById('tn-share')).display, sub: !!document.getElementById('tn-sub'),
  b: [...document.querySelectorAll('#tn-vacio .tn-elige button')].map(o => o.textContent),
  fila: !!document.querySelector('#screen-turnos select, #tn-sec-sel, .tn-sec') }));
log(vac.e && vac.cols === 'none' && vac.sh === 'none' && !vac.sub && !vac.fila &&
    JSON.stringify(vac.b) === JSON.stringify(['1.ª', '2.ª', '3.ª']),
  '[D1] Sin sección: la pide con tres botones, sin fila de formulario ni subtítulo, y no enseña un calendario a ciegas', JSON.stringify(vac));
await page.click('#tn-vacio .tn-elige button:nth-child(2)'); await page.waitForTimeout(400);
const d2 = await page.evaluate(() => {
  const s = document.getElementById('screen-turnos'), r = s.getBoundingClientRect();
  return { enMain: !!s.closest('#main'), alto: r.height, sec: tnCfg().seccion,
    celdas: document.querySelectorAll('#tn-g .tn-c').length, hoy: document.querySelectorAll('#tn-g .tn-c.hoy').length,
    bar: document.querySelector('#tn-bar-sec .tn-bar-v').textContent.trim(), sem: document.querySelectorAll('.tn-sd, #tn-sem').length,
    hoyN: document.querySelector('.tn-hoy-n b').textContent, diaFijo: !!document.getElementById('tn-dia') || !!document.querySelector('#screen-turnos .tn-dia') };
});
log(d2.enMain && d2.alto > 600 && d2.sec === 2 && d2.bar === '2.ª sección', '[D2] Elegir la sección la guarda, la barra de la pantalla la dice y pinta el calendario', JSON.stringify(d2));
log(d2.celdas % 7 === 0 && d2.celdas >= 28 && d2.hoy === 1 && d2.sem === 0 && !d2.diaFijo,
  '[D3] Mes en semanas completas, hoy marcado una vez, sin «Próximos días» ni tarjeta fija del día', JSON.stringify(d2));
/* La barra: dos funciones independientes, entre «Hoy» y el mes. */
const bar = await page.evaluate(() => {
  const h = document.getElementById('tn-hoy').getBoundingClientRect(), b = document.getElementById('tn-bar').getBoundingClientRect(), m = document.getElementById('tn-mes').getBoundingClientRect();
  const s = document.getElementById('tn-bar-sec').getBoundingClientRect(), c = document.getElementById('tn-bar-ciclo').getBoundingClientRect();
  return { entre: b.top >= h.bottom && b.bottom <= m.top, lados: Math.abs(s.top - c.top) < 2 && c.left >= s.right - 1, alto: Math.min(s.height, c.height),
    ls: [...document.querySelectorAll('#tn-bar .tn-bar-l')].map(e => e.textContent), ciclo: document.querySelector('#tn-bar-ciclo .tn-bar-v').textContent,
    abajo: [...document.querySelectorAll('#screen-turnos .btn')].map(e => e.textContent.trim()).filter(t => /Compartir mis turnos|Ajustar el ciclo/.test(t)),
    share: getComputedStyle(document.getElementById('tn-share')).display !== 'none' };
});
log(bar.entre && bar.lados && bar.alto >= 44 && JSON.stringify(bar.ls) === JSON.stringify(['Mi sección', 'Horario']) && bar.ciclo === 'Predeterminado',
  '[L1] Entre «Hoy» y el mes, una barra con dos mitades: «Mi sección» y «Horario»', JSON.stringify(bar));
log(!bar.abajo.length && bar.share, '[L2] Sin «Compartir mis turnos» ni «Ajustar el ciclo» al final (compartir sigue en la barra superior)', JSON.stringify(bar.abajo));
await page.click('#tn-bar-sec'); await page.waitForTimeout(350);
const ss = await page.evaluate(() => ({ on: document.getElementById('act-sheet').classList.contains('on'),
  ops: [...document.querySelectorAll('#act-items .tn-secc-op')].map(o => o.querySelector('.ti').textContent + '|' + o.querySelector('.de').textContent + '|' + o.classList.contains('on') + '|' + !!o.querySelector('.tn-secc-ok')),
  hoy: [1, 2, 3].map(s => TN_TURNOS[tnBase(tnHoy(), s, tnCfg())].n), aj: [...document.querySelectorAll('#act-items .sheet-item .ti')].some(e => e.textContent === 'Ajustar el ciclo'),
  mia: (document.querySelector('#act-items #tn-secc-mia .ti') || {}).textContent || '' }));
log(ss.on && ss.ops.length === 3 && ss.ops.every((o, i) => o === (i + 1) + '.ª sección|' + (i === 1 ? 'Tu sección · hoy, ' : 'Hoy · ') + ss.hoy[i] + '|' + (i === 1) + '|' + (i === 1)) &&
    !ss.aj && ss.mia === '¿Cambiaste de sección?',
  '[K1] La hoja de la sección: las tres con su turno de hoy, la propia marcada «Tu sección» con chulo, y la fila para corregirla', JSON.stringify(ss));
/* Build 174 (decisión del usuario): mirar otra sección es una CONSULTA. No
   pregunta desde cuándo, no guarda nada y no toca las estadísticas. */
const antesV = await page.evaluate(() => ({ cfg: JSON.stringify(DB.getConfig().turnos), disco: localStorage.getItem('lc_cfg'),
  st: JSON.stringify(tnStatsRango('2026-01-01', '2026-10-28', tnCfg(), new Date(2026, 9, 28, 12, 0))) }));
await page.click('#act-items .tn-secc-op:nth-child(3)'); await page.waitForTimeout(400);
const vista = await page.evaluate(() => {
  const celdas = [...document.querySelectorAll('#tn-g .tn-c[data-iso]')];
  return { sheet: document.getElementById('act-sheet').classList.contains('on'),
    preguntas: [...document.querySelectorAll('#act-items .sheet-item .ti')].map(e => e.textContent).filter(t => /Desde|Siempre estuve/.test(t)),
    cfg: JSON.stringify(DB.getConfig().turnos), disco: localStorage.getItem('lc_cfg'), sec: tnCfg().seccion,
    st: JSON.stringify(tnStatsRango('2026-01-01', '2026-10-28', tnCfg(), new Date(2026, 9, 28, 12, 0))),
    bar: document.querySelector('#tn-bar-sec .tn-bar-l').textContent + '|' + document.querySelector('#tn-bar-sec .tn-bar-v').textContent,
    banner: document.querySelector('#tn-hoy').innerText.replace(/\s+/g, ' ').trim(), volver: !!document.getElementById('tn-vista-volver'),
    ciclo3: celdas.length > 27 && celdas.every(c => c.dataset.t === tnBase(c.dataset.iso, 3)), ley: !!document.querySelector('.tn-ley-nov') };
});
log(!vista.sheet && !vista.preguntas.length && vista.cfg === antesV.cfg && vista.disco === antesV.disco && vista.sec === 2,
  '[K2] Tocar otra sección no pregunta desde cuándo ni guarda nada (la configuración, en memoria y en disco, queda igual)', JSON.stringify(vista));
log(vista.st === antesV.st, '[K4] Mirar otra sección no toca las estadísticas: siguen la sección propia');
log(vista.bar === 'Viendo|3.ª sección' && /^Viendo la 3\.ª sección Hoy, .+ · la tuya es la 2\.ª Volver a la mía$/.test(vista.banner) && vista.volver && vista.ciclo3 && !vista.ley,
  '[K5] Se ve que es una consulta: «Viendo la 3.ª sección», «Volver a la mía», el ciclo de la 3.ª y sin las novedades propias', JSON.stringify(vista));
await page.evaluate(() => tnDiaSheet(tnHoy())); await page.waitForTimeout(300);
const diaV = await page.evaluate(() => ({ acc: [...document.querySelectorAll('#act-items .sheet-item .ti')].map(e => e.textContent),
  otras: [...document.querySelectorAll('#act-items .tn-otra')].map(o => o.innerText.replace(/\s+/g, ' ').trim()),
  s: document.querySelector('#act-head .tn-ds-s').textContent, txt: tnTextoMes(2026, 9, tnSecVista().sec, tnSecVista().t).split('\n')[0] }));
await page.evaluate(() => closeActionSheet()); await page.waitForTimeout(200);
log(JSON.stringify(diaV.acc) === JSON.stringify(['Compartir el día']) && diaV.otras.some(o => /^2\.ª .+ \(la tuya\)$/.test(o)) && / · 3\.ª sección$/.test(diaV.s) &&
    diaV.txt === '*Turnos · 3.ª sección*',
  '[K6] El día de otra sección no ofrece registrar novedad ni servicio, marca cuál es la tuya, y compartir manda lo que se ve', JSON.stringify(diaV));
await page.click('#tn-vista-volver'); await page.waitForTimeout(300);
const vuelta = await page.evaluate(() => {
  const a = document.querySelector('#tn-bar-sec .tn-bar-l').textContent;
  tnVerSeccion(1); go('inicio'); go('turnos');
  return { a, b: document.querySelector('#tn-bar-sec .tn-bar-l').textContent + '|' + document.querySelector('#tn-bar-sec .tn-bar-v').textContent, v: _tnSecV };
});
log(vuelta.a === 'Mi sección' && vuelta.b === 'Mi sección|2.ª sección' && vuelta.v === null,
  '[K7] «Volver a la mía» regresa a la propia, y salir del módulo y volver a entrar también', JSON.stringify(vuelta));
const hoyCel = await page.evaluate(() => { const h = tnHoy(); return { cel: document.querySelector('#tn-g .tn-c.hoy').dataset.t, ab: tnBase(h, 2, tnCfg()) }; });
log(hoyCel.cel === hoyCel.ab, '[D4] La celda de hoy dice el turno que da el ciclo', JSON.stringify(hoyCel));
const mv = await page.evaluate(() => { const a = _tnVer.m; tnMesMover(1); const b = _tnVer.m; tnMesMover(-2); const c = _tnVer.m; tnIrHoy(); return [a, b, c, _tnVer.m, !!document.querySelector('.tn-hoyb')]; });
log((mv[1] - mv[0] + 12) % 12 === 1 && (mv[0] - mv[2] + 12) % 12 === 1 && mv[3] === mv[0] && !mv[4], '[D5] Mes siguiente, anterior y «Hoy» vuelve al mes actual', mv);
const sw = await page.evaluate(() => {
  const g = document.getElementById('tn-g'), r = g.getBoundingClientRect(), m0 = _tnVer.m;
  const t = (x, y) => new Touch({ identifier: 1, target: g, clientX: x, clientY: y });
  g.dispatchEvent(new TouchEvent('touchstart', { touches: [t(r.right - 20, r.top + 40)], bubbles: true }));
  g.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t(r.left + 20, r.top + 50)], bubbles: true }));
  const m1 = _tnVer.m; tnIrHoy(); return (m1 - m0 + 12) % 12;
});
log(sw === 1, '[D6] Deslizar el mes hacia la izquierda pasa al siguiente', sw);
await page.click('#tn-g .tn-c[data-iso="2026-10-12"]'); await page.waitForTimeout(350);
const dia = await page.evaluate(() => ({ on: document.getElementById('act-sheet').classList.contains('on'), t: document.querySelector('#act-head .tn-ds-t').textContent,
  f: (document.querySelector('#act-items .tn-ds-fest') || {}).innerText, k: document.querySelector('#act-head .tn-ds-s').textContent,
  otras: [...document.querySelectorAll('#act-items .tn-otra')].map(o => o.innerText.replace(/\s+/g, ' ').trim()),
  alto: document.getElementById('act-sheet').getBoundingClientRect().height }));
log(dia.on && /12 de octubre/.test(dia.t) && /Festivo\s*·\s*Día de la Raza/.test(dia.f) && /^Disponible · /.test(dia.k) &&
    JSON.stringify(dia.otras) === JSON.stringify(['1.ª Tercero', '3.ª Segundo – primero']) && dia.alto < 560,
  '[D7] Tocar un día abre su hoja: turno, festivo y las otras dos secciones, en menos de media pantalla larga', JSON.stringify(dia));

/* ═══ J · rediseño del calendario (build 163) ═══ */
const rd = await page.evaluate(() => {
  const g = e => getComputedStyle(e), fuera = [...document.querySelectorAll('#tn-g .tn-c.fuera')], card = document.querySelector('.tn-mes');
  /* Cada día dice su turno con texto: la etiqueta de TODA celda con turno es la del ciclo. */
  const cel = [...document.querySelectorAll('#tn-g .tn-c[data-t]:not(.fuera)')].filter(c => c.dataset.t);
  const mk = { ok: cel.length > 20 && cel.every(c => { const l = c.querySelector('.tn-lb'); return l && l.textContent === TN_TURNOS[c.dataset.t].ab; }),
    barras: document.querySelectorAll('#tn-g .tn-mk').length, ab: TN_CICLO.map(k => TN_TURNOS[k].ab) };
  const ley = [...document.querySelectorAll('.tn-ley .tn-ley-i')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
  const fc = document.querySelector('#tn-g .tn-c.fest'), fi = fc && fc.querySelector('.tn-ind .f');
  const otras = document.querySelector('.tn-otras'), lh = parseFloat(g(otras).lineHeight);
  return {
    fueraSolo: fuera.every(c => c.children.length === 1 && c.textContent.trim() === c.querySelector('.tn-c-n').textContent),
    fueraSinColor: fuera.every(c => g(c).backgroundColor === 'rgba(0, 0, 0, 0)' && !/tn-k-/.test(c.className) && c.tagName === 'SPAN'),
    pastillas: document.querySelectorAll('#tn-g .tn-c-k').length, mk, ley,
    sinBorde: [...document.querySelectorAll('#tn-g .tn-c:not(.fuera)')].every(c => g(c).borderTopWidth === '0px'),
    hoyAlto: document.querySelector('.tn-hoy').getBoundingClientRect().height,
    sin24: !document.querySelector('#tn-hoy .tn-24') && !document.querySelector('#tn-hoy .tn-man'),
    otrasLineas: Math.round(otras.getBoundingClientRect().height / lh),
    fest: !!fi && fi.getBoundingClientRect().height >= 4 && fi.getBoundingClientRect().width >= 20 && fi.getBoundingClientRect().top - fc.getBoundingClientRect().top <= 6,
    festLab: fc && fc.querySelector('.tn-lb').textContent === TN_TURNOS[fc.dataset.t].ab
  };
});
log(rd.fueraSolo && rd.fueraSinColor, '[J1] Días de otro mes: solo el número, sin color, sin turno y no se eligen', JSON.stringify(rd));
log(rd.pastillas === 0 && rd.sinBorde, '[J2] Sin pastillas ni bordes en las celdas');
log(rd.mk.ok && rd.mk.barras === 0 && JSON.stringify(rd.mk.ab) === JSON.stringify(['3.º', '2.º–1.º', 'Disp.']),
  '[J3] Cada día dice su turno escrito (3.º · 2.º–1.º · Disp.), sin la barrita', JSON.stringify(rd.mk));
log(JSON.stringify(rd.ley) === JSON.stringify(['3.º Tercero', '2.º–1.º Segundo – primero', 'Disp. Disponible', 'Festivo', 'Novedad: ninguna']),
  '[J4] La leyenda: los tres turnos con su MISMA etiqueta; a la derecha, festivo y, sin novedades registradas, «Novedad: ninguna»', JSON.stringify(rd.ley));
log(rd.hoyAlto < 90 && rd.sin24, '[J5] La tarjeta de hoy es compacta: dos renglones, sin línea de 24 h ni «Mañana»', rd.hoyAlto);
log(rd.otrasLineas === 1, '[J6] Las otras secciones caben en una sola línea', rd.otrasLineas);
log(rd.fest && rd.festLab, '[J7] El festivo es una barra roja arriba de la celda, y la celda sigue diciendo su turno', JSON.stringify(rd));
await page.evaluate(() => closeActionSheet()); await page.waitForTimeout(250);
/* Registro de servicio. */
await page.evaluate(() => tnServicioForm('2026-10-11')); await page.waitForTimeout(150);
await page.click('#tn-sv-ops [data-k="especial"]');
const svDet = await page.evaluate(() => ({ v: !document.getElementById('tn-sv-det').hidden, l: document.getElementById('tn-sv-det-l').textContent }));
await page.fill('#tn-sv-detalle', 'Escolta de valores');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
await page.evaluate(() => tnServicioForm('2026-10-14')); await page.waitForTimeout(150);
await page.click('#tn-sv-ops [data-k="centinela"]');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
await page.evaluate(() => tnDiaSheet('2026-10-14')); await page.waitForTimeout(150);
const sv = await page.evaluate(() => {
  const t = tnCfg(), r = tnEstadisticas(2026, t, new Date(2026, 11, 31, 23, 0));
  return { n: t.servicios.length, a: tnServicio('2026-10-11', t), reg: r.especiales, dia: document.querySelector('.tn-srv b') && document.querySelector('.tn-srv b').textContent,
    texto: tnTextoMes(2026, 9, 2, t).split('\n').filter(l => /Centinela|Otro servicio/.test(l)).length };
});
log(svDet.v && svDet.l === 'Cuál', '[J8] «Otro servicio especial» pide cuál', JSON.stringify(svDet));
log(sv.n === 2 && sv.a.tipo === 'especial' && sv.a.detalle === 'Escolta de valores' && sv.dia === 'Centinela',
  '[J9] Registrar lo que se hizo un día lo guarda y el día elegido lo enseña', JSON.stringify(sv));
log(sv.reg === 2 && sv.texto === 2, '[J10] Las estadísticas del año y el mes por chat cuentan lo registrado', JSON.stringify(sv));
await page.evaluate(() => tnServicioForm('2026-10-14')); await page.waitForTimeout(150);
await page.click('#tn-sv-ops [data-k="noprestado"]'); await page.fill('#tn-sv-detalle', 'Citado a juicio');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
await page.evaluate(() => tnDiaSheet('2026-10-14')); await page.waitForTimeout(150);
const sv2 = await page.evaluate(() => ({ n: tnCfg().servicios.length, t: tnServicio('2026-10-14').tipo, no: !!document.querySelector('#act-items .tn-srv .tn-ds-i.no') }));
await page.evaluate(() => closeActionSheet());
log(sv2.n === 2 && sv2.t === 'noprestado' && sv2.no, '[J11] Editar un día lo reemplaza (uno por día) y «No lo presté» se marca distinto', JSON.stringify(sv2));
await page.evaluate(() => tnServicioQuitar('2026-10-14')); await page.evaluate(() => tnServicioQuitar('2026-10-11')); await page.waitForTimeout(300);
log(await page.evaluate(() => { tnDiaSheet('2026-10-14'); const r = tnCfg().servicios.length === 0 && !document.querySelector('#act-items .tn-srv'); closeActionSheet(); return r; }), '[J12] Quitar el registro lo borra');
await page.evaluate(() => tnIrHoy()); await page.waitForTimeout(100);

/* ═══ E · el horario de los turnos (el ciclo ya no se elige) ═══ */
await page.click('#tn-bar-ciclo'); await page.waitForTimeout(250);
const pan = await page.evaluate(() => ({ titulo: document.querySelector('#modal .mo-t, #modal .mo-title, #modal h2, #modal h3')?.textContent.trim() || '',
  sinCiclo: !document.getElementById('tn-cal') && !/Tu ciclo|¿qué turno tiene/.test(document.getElementById('modal').innerText), horas: document.querySelectorAll('#modal .tn-hr').length }));
const hoyBase = await page.evaluate(() => tnBase(tnHoy(), 2));
await page.fill('#tn-h-t3-a', '1400');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const aj = await page.evaluate(() => { const t = tnCfg(); return { base: tnBase(tnHoy(), 2, t), h: tnHoras(t).t3, sub: document.querySelector('#tn-bar-ciclo .tn-bar-v').textContent, abierto: document.getElementById('modal').classList.contains('open') }; });
log(pan.sinCiclo && pan.horas === 3 && aj.base === hoyBase && aj.sub === 'Ajustado' && !aj.abierto, '[E1] «Horario» abre solo las horas (sin «Tu ciclo»); guardar no mueve el ciclo y la barra dice «Ajustado»', JSON.stringify({ pan, aj }));
log(aj.h[0] === '14:00' && aj.h[1] === '21:00', '[E2] La hora se escribe de corrido en 24 h («1400» → 14:00) y se guarda', aj.h);
await page.evaluate(() => tnAjustar()); await page.waitForTimeout(120);
await page.fill('#tn-h-t2-a', '25:00');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(250);
const mal = await page.evaluate(() => ({ open: document.getElementById('modal').classList.contains('open'), err: document.getElementById('tn-h-t2-a').classList.contains('fi-err') }));
log(mal.open && mal.err, '[E3] Una hora imposible no se guarda: se marca en rojo', JSON.stringify(mal));
await page.click('#modal .tn-mb .bs'); await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const rest = await page.evaluate(() => { const t = tnCfg(); return { h: t.horas, sub: document.querySelector('#tn-bar-ciclo .tn-bar-v').textContent }; });
log(rest.h === null && rest.sub === 'Predeterminado', '[E4] «Restaurar» vuelve a las horas predeterminadas', JSON.stringify(rest));

/* ═══ F · novedades ═══ */
const hoy = await page.evaluate(() => tnHoy());
const fin = await page.evaluate(h => tnMas(h, 3), hoy);
await page.evaluate(h => tnNovedadForm(null, h), hoy); await page.waitForTimeout(150);
await page.click('#tn-nv-tipos [data-k="vacaciones"]');
await page.fill('#tn-nv-hasta', fin);
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const nv = await page.evaluate(h => { const c = document.querySelector(`#tn-g .tn-c[data-iso="${h}"]`), b = tnBase(h, 2, tnCfg());
  return { n: tnCfg().novedades.length, cel: c.className, base: TN_TURNOS[b].c, k: c.querySelector('.tn-lb').textContent, ab: TN_TURNOS[b].ab,
    ind: !!c.querySelector('.tn-ind .n'), nov: c.dataset.nov, hoyN: document.querySelector('.tn-hoy-n b').textContent,
    ley: document.querySelector('.tn-ley-nov').innerText.trim(), bl: tnBloques(h, 2, tnCfg()).length }; }, hoy);
log(nv.n === 1 && nv.cel.includes('tn-k-' + nv.base) && nv.k === nv.ab && nv.ind && nv.nov === 'vacaciones' && nv.hoyN === 'Vacaciones' && nv.bl === 0,
  '[F1] Unas vacaciones: la celda sigue diciendo el turno del ciclo, con la barra fucsia arriba, y ese día no hay servicio', JSON.stringify(nv));
log(/^Vacaciones/.test(nv.ley), '[K3] La leyenda nombra la novedad del mes («Vacaciones»), no «Novedad»', nv.ley);
await page.evaluate(() => lcVolverInicio()); await page.waitForTimeout(250);
const fr = await page.evaluate(() => document.querySelector('#ini-turno .tn-fr-n').textContent);
log(fr === 'Vacaciones', '[F2] La franja del Inicio también la respeta', fr);
await page.evaluate(() => go('turnos')); await page.waitForTimeout(150);
const id = await page.evaluate(() => tnCfg().novedades[0].id);
await page.evaluate(i => tnNovedadForm(i), id); await page.waitForTimeout(120);
await page.click('#tn-nv-tipos [data-k="cambio"]');
await page.click('#tn-nv-turnos [data-k="D"]');
await page.fill('#tn-nv-con', 'PT Juan Pérez');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const cb = await page.evaluate(h => { const t = tnCfg(); return { n: t.novedades.length, ef: tnTurno(h, 2, t).ef, con: t.novedades[0].con, tipo: t.novedades[0].tipo }; }, hoy);
log(cb.n === 1 && cb.ef === 'D' && cb.con === 'PT Juan Pérez' && cb.tipo === 'cambio', '[F3] Editar la convierte en un cambio de turno que manda sobre el ciclo', JSON.stringify(cb));
await page.evaluate(i => tnNovedadForm(null, '2026-12-01'), id); await page.waitForTimeout(120);
await page.fill('#tn-nv-hasta', '2026-11-20');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(250);
log(await page.evaluate(() => document.getElementById('modal').classList.contains('open') && tnCfg().novedades.length === 1),
  '[F4] Una fecha final anterior a la inicial no se guarda');
await page.click('#modal .tn-mb .bs'); await page.waitForTimeout(100);
await page.reload(); await page.waitForFunction(() => window._lcListo === true); await page.waitForTimeout(200);
const pers = await page.evaluate(() => { const t = tnCfg(); return { s: t.seccion, n: t.novedades.length, enc: !/novedades/.test(localStorage.getItem('lc_cfg') || '') }; });
log(pers.s === 2 && pers.n === 1 && pers.enc, '[F5] Sección y novedades sobreviven a recargar, y van cifradas', JSON.stringify(pers));
const fus = await page.evaluate(() => {
  const n1 = { id: 'a1', tipo: 'permiso', desde: '2026-11-03', hasta: '2026-11-03' }, n2 = { id: 'b2', tipo: 'vacaciones', desde: '2026-12-01', hasta: '2026-12-10' };
  const conf = [], r = lcFundir3({ turnos: { seccion: 2, novedades: [] } }, { turnos: { seccion: 2, novedades: [n1] } }, { turnos: { seccion: 2, novedades: [n2] } }, '', conf);
  return { ids: r.turnos.novedades.map(n => n.id).join(','), conf: conf.length };
});
log(fus.ids === 'a1,b2' && fus.conf === 0, '[F6] Dos equipos que agregan novedades distintas: la nube junta las dos', JSON.stringify(fus));
await page.evaluate(() => go('turnos')); await page.waitForTimeout(150);
await page.evaluate(i => tnNovedadQuitar(i), id); await page.waitForTimeout(300);
log(await page.evaluate(() => tnCfg().novedades.length === 0), '[F7] Quitar la novedad devuelve el día al ciclo');

/* ═══ G · compartir ═══ */
const tx = await page.evaluate(() => tnTextoMes(2026, 9, 2, tnCfg()));
const lin = tx.split('\n');
log(lin[0] === '*Turnos · 2.ª sección*' && lin.length === 34 && /🟢 Lun 12 · Disponible · Festivo: Día de la Raza/.test(tx) &&
    /🔴 Jue 29 · Segundo – primero \(06:00–13:00 y 21:00–06:00\)/.test(tx) && /🟡 Jue 01 · Tercero \(13:00–21:00\)/.test(tx),
  '[G1] El mes por chat: un renglón por día, con turno, horas y festivo', lin.slice(0, 4));
const td = await page.evaluate(() => tnTextoDia('2026-10-12', 2, tnCfg()));
log(/Lunes 12 de octubre de 2026/.test(td) && /1\.ª sección: Tercero/.test(td) && /3\.ª sección: Segundo – primero/.test(td), '[G2] El día por chat dice también las otras secciones', td);
const ics = await page.evaluate(() => tnIcsTexto(2, tnCfg(), '2026-10-29', 3));
const ev = (ics.match(/BEGIN:VEVENT/g) || []).length;
log(ev === 3 && /DTSTART;TZID=America\/Bogota:20261029T210000\r\nDTEND;TZID=America\/Bogota:20261030T060000/.test(ics) &&
    /DTSTART;TZID=America\/Bogota:20261031T130000/.test(ics) && ics.split('\r\n').every(l => l.length <= 75) && /\r\n$/.test(ics),
  '[G3] .ics: un evento por bloque, en hora de Bogotá, el de 21–06 termina al día siguiente', ev);
const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => tnIcs())]);
log(/^Turnos_seccion2_\d{4}-\d{2}\.ics$/.test(dl.suggestedFilename()), '[G4] En el navegador el .ics se descarga con nombre ASCII', dl.suggestedFilename());
await page.evaluate(() => tnCompartir()); await page.waitForTimeout(250);
const sh = await page.evaluate(() => [...document.querySelectorAll('#act-items .sheet-item .ti')].map(e => e.textContent));
log(JSON.stringify(sh) === JSON.stringify(['Enviar el mes', 'Copiar el mes', 'Agregar a mi calendario']), '[G5] La hoja de compartir ofrece mes por chat, copiar y calendario', sh);
await page.evaluate(() => closeActionSheet());

/* ═══ M · historial de sección, estadísticas del año y selector de año (build 167) ═══ */
const hist = await page.evaluate(async () => {
  const t0 = tnCfg();
  await tnGuardar({ historial: [{ id: 'a', desde: '', seccion: 2 }, { id: 'b', desde: '2026-07-15', seccion: 3 }], novedades: [], servicios: [] });
  const t = tnCfg();
  return { sec: t.seccion, j14: tnTurno('2026-07-14', null, t).sec, j15: tnTurno('2026-07-15', null, t).sec,
    b14: tnTurno('2026-07-14', null, t).base === tnBase('2026-07-14', 2, t), b15: tnTurno('2026-07-15', null, t).base === tnBase('2026-07-15', 3, t),
    legado: tnCfg({ turnos: { seccion: 1 } }).historial.map(h => h.seccion + '@' + (h.desde || '-')).join(), ok0: t0.historial.length === 1 };
});
log(hist.sec === 3 && hist.j14 === 2 && hist.j15 === 3 && hist.b14 && hist.b15 && hist.legado === '1@-',
  '[M1] Cada día usa la sección que tenías ese día; sin historial, la sección guardada vale desde siempre', JSON.stringify(hist));
/* Build 174: el calendario ya no mezcla secciones: pinta el ciclo de la que se
   ve (aquí la propia, la 3.ª desde el 15 de julio). El historial es de las
   estadísticas; el día de antes del cambio solo lo avisa. */
await page.evaluate(() => { _tnVer = { y: 2026, m: 6 }; tnPintarMes(); });
const jul = await page.evaluate(() => {
  const r = { d14: document.querySelector('#tn-g .tn-c[data-iso="2026-07-14"]').dataset.t, e14: tnBase('2026-07-14', 3),
    d15: document.querySelector('#tn-g .tn-c[data-iso="2026-07-15"]').dataset.t, e15: tnBase('2026-07-15', 3) };
  tnDiaSheet('2026-07-14'); r.nota = (document.querySelector('#act-items .tn-ds-hs') || {}).innerText || '';
  tnDiaSheet('2026-07-15'); r.nota15 = !!document.querySelector('#act-items .tn-ds-hs');
  closeActionSheet(); return r;
});
log(jul.d14 === jul.e14 && jul.d15 === jul.e15 && /ese día estabas en la 2\.ª/.test(jul.nota) && !jul.nota15,
  '[M2] El calendario pinta el ciclo de la sección que se ve; un día de antes del cambio avisa en qué sección estabas', JSON.stringify(jul));
/* Oráculo independiente: se recorre el año con tnBase y la regla «cuenta lo ya empezado». */
const stE = await page.evaluate(() => {
  const t = tnCfg(), ahora = new Date(2026, 9, 29, 21, 27), r = tnEstadisticas(2026, t, ahora);
  const ini = { T: '13:00', S: '06:00' }, o = { T: 0, S: 0, D: 0, h: 0 };
  for (let iso = '2026-01-01'; iso <= '2026-10-29'; iso = tnMas(iso, 1)) {
    const k = tnBase(iso, iso < '2026-07-15' ? 2 : 3, { desfase: 0 });
    if (k === 'D') { o.D++; continue; }
    const p = iso.split('-'), a = new Date(+p[0], +p[1] - 1, +p[2], +ini[k].slice(0, 2));
    if (a <= ahora) { o[k]++; }
  }
  return { r: { T: r.T, S: r.S, D: r.D, horas: Math.round(r.horas * 10) / 10, sec: r.secciones.map(s => s.seccion + ':' + s.desde + '>' + s.hasta), curso: r.enCurso, oct: r.meses[9].dias, nov: r.meses[10].dias }, o };
});
log(stE.r.T === stE.o.T && stE.r.S === stE.o.S && stE.r.D === stE.o.D, '[M3] Turnos del 1 de enero a hoy: coinciden con un recuento independiente, con el traslado del 15 de julio', JSON.stringify(stE));
log(stE.r.oct === 29 && stE.r.nov === 0 && JSON.stringify(stE.r.sec) === JSON.stringify(['2:2026-01-01>2026-07-14', '3:2026-07-15>2026-10-29']),
  '[M4] El mes actual llega solo hasta hoy, los meses futuros no cuentan, y cada tramo dice su sección', JSON.stringify(stE.r));
const hoyx = await page.evaluate(() => {
  const t = { historial: [{ id: 'x', desde: '', seccion: 2 }], desfase: 0, horas: null, novedades: [], servicios: [] };   /* el 29/10 la 2.ª está en Segundo – primero */
  const a = tnEstadisticas(2026, t, new Date(2026, 9, 29, 5, 0)), b = tnEstadisticas(2026, t, new Date(2026, 9, 29, 10, 0)), c = tnEstadisticas(2026, t, new Date(2026, 9, 29, 22, 0));
  return { antes: a.S, despues: b.S, hb: Math.round((b.horas - a.horas) * 10) / 10, hc: Math.round((c.horas - a.horas) * 10) / 10, curso: b.enCurso && b.enCurso.iso };
});
log(hoyx.despues === hoyx.antes + 1 && hoyx.hb === 4 && hoyx.hc === 8 && hoyx.curso === '2026-10-29',
  '[M5] El turno de hoy cuenta desde que empieza, con las horas hasta ahora (a las 10:00 lleva 4 h; a las 22:00, 8 h)', JSON.stringify(hoyx));
const exc = await page.evaluate(() => {
  const base = { historial: [{ id: 'x', desde: '', seccion: 2 }], desfase: 0, horas: null, novedades: [], servicios: [] }, A = new Date(2026, 9, 31, 23, 0);
  const r0 = tnEstadisticas(2026, base, A);
  const r1 = tnEstadisticas(2026, Object.assign({}, base, { novedades: [{ id: 'n', tipo: 'vacaciones', desde: '2026-10-01', hasta: '2026-10-02' }],
    servicios: [{ id: 's1', fecha: '2026-10-04', tipo: 'noprestado' }, { id: 's2', fecha: '2026-10-03', tipo: 'guardia' }] }), A);
  return { dT: r0.T - r1.T, dS: r0.S - r1.S, nov: r1.nov.vacaciones, noP: r1.noPrest, apoyo: r1.apoyo, dD: r0.D - r1.D,
    y25: (() => { const r = tnEstadisticas(2025, base, A); return r.T + r.S + r.D + '|' + r.hasta; })(), y27: tnEstadisticas(2027, base, A).futuro };
});
/* 1/10 Tercero y 2/10 Segundo – primero de vacaciones; 4/10 Tercero no prestado; 3/10 Disponible con guardia. */
log(exc.dT === 2 && exc.dS === 1 && exc.nov === 2 && exc.noP === 1 && exc.apoyo === 1 && exc.dD === 0,
  '[M6] Ni las vacaciones ni un «No lo presté» cuentan; un disponible con servicio registrado se cuenta como apoyo', JSON.stringify(exc));
log(exc.y25 === '365|2025-12-31' && exc.y27 === true, '[M7] Un año pasado cuenta entero (365 días); uno que no ha empezado, nada', JSON.stringify(exc));
await page.evaluate(() => tnIrHoy()); await page.waitForTimeout(150);
/* Build 174: las estadísticas son una PANTALLA propia, guiada por las de
   Capturas y por el boceto del usuario (cuatro períodos y el total de turnos
   realizados). */
await page.click('#tn-stc'); await page.waitForTimeout(400);
const st1 = await page.evaluate(() => {
  const s = document.getElementById('screen-tnstats'), r = s.getBoundingClientRect(), hy = tnFecha(tnHoy()).getFullYear();
  const per = [...document.querySelectorAll('#tns-content .tns-per .tab')];
  const e = tnStatsRango(hy + '-01-01', hy + '-12-31', tnCfg());
  return { pant: _lcPantallaActual(), enMain: !!s.closest('#main'), alto: r.height, modal: document.getElementById('modal').classList.contains('open'),
    titulo: s.querySelector('.ttl h1').textContent, tabs: per.map(b => b.textContent), on: per.filter(b => b.classList.contains('on')).map(b => b.dataset.per),
    visibles: per.length === 4 && per.every(b => { const q = b.getBoundingClientRect(); return q.width > 40 && q.left >= 0 && q.right <= innerWidth; }),
    lbl: document.querySelector('#tns-content .stat-hero-lbl').textContent, total: +document.getElementById('tns-total').textContent, esp: e.T + e.S,
    y: (document.querySelector('.tns-y b') || {}).textContent, sig: document.querySelector('.tns-y .tn-nav:last-child').disabled,
    sub: document.getElementById('tns-sub').textContent, ctx: document.querySelector('#tns-content .stat-hero-ctx').textContent, h: tnNum(e.horas),
    piezas: !!document.querySelector('#tns-content .stat-hero') && !!document.querySelector('#tns-content .stat-dist') && !!document.querySelector('#tns-content .stat-act-bars') };
});
log(st1.pant === 'tnstats' && st1.enMain && st1.alto > 600 && !st1.modal && st1.titulo === 'Mis turnos' && st1.piezas,
  '[M8] «Mis turnos en …» abre una PANTALLA propia hecha con las piezas de Estadísticas de Capturas, no una ventana', JSON.stringify(st1));
log(JSON.stringify(st1.tabs) === JSON.stringify(['Todo el año', 'Últimos 3 meses', 'Este mes', 'Semana pasada']) && JSON.stringify(st1.on) === '["ano"]' && st1.visibles,
  '[M9] Los cuatro períodos del boceto, todos a la vista en el teléfono, con «Todo el año» elegido', JSON.stringify(st1));
log(/^total turnos realizados$/i.test(st1.lbl) && st1.total === st1.esp && st1.y === String(new Date().getFullYear()) && st1.sig &&
    st1.ctx.startsWith(st1.h + ' h de servicio') && st1.sub.startsWith(st1.esp + ' turnos'),
  '[M10] La cifra principal es el TOTAL DE TURNOS REALIZADOS del año, con sus horas debajo', JSON.stringify(st1));
const dsr = await page.evaluate(() => {
  const filas = [...document.querySelectorAll('#tns-content .tns-dist-row')].map(f => ({ k: f.dataset.k, n: +f.querySelector('.stat-dist-n').textContent, p: parseInt(f.querySelector('.stat-dist-pct').textContent, 10) }));
  const segs = [...document.querySelectorAll('#tns-content .stat-dist-seg')].map(s => parseFloat(s.style.width));
  return { filas, segs, total: +document.getElementById('tns-total').textContent,
    ruido: /Hipotético|No se suman|Mes a mes|Por hora del día/.test(document.getElementById('tns-content').innerText) || !!document.querySelector('#tns-content .tn-st-f, #tns-content .tn-sd') };
});
log(dsr.filas.length === 2 && dsr.filas[0].k === 'S' && dsr.filas[1].k === 'T' && dsr.filas[0].n + dsr.filas[1].n === dsr.total &&
    dsr.filas[0].p + dsr.filas[1].p === 100 && dsr.segs[0] === dsr.filas[0].p && dsr.segs[1] === dsr.filas[1].p && !dsr.ruido,
  '[M14] El reparto: 2.º–1.º y 3.º suman el total, sus porcentajes suman 100, la barra los dibuja y no queda nada de la ventana vieja', JSON.stringify(dsr));
const prs = await page.evaluate(() => {
  const out = {};
  for (const id of ['3m', 'mes', 'sem', 'ano']) {
    tnsPer(id);
    const p = tnsPeriodo(id), e = tnStatsRango(p.desde, p.tope, tnCfg());
    const cols = [...document.querySelectorAll('#tns-content .tns-col')];
    out[id] = { desde: p.desde, tope: p.tope, total: +document.getElementById('tns-total').textContent, esp: e.T + e.S, cols: cols.length, gran: p.gran,
      barras: _tnsB.reduce((a, x) => a + x.T + x.S, 0), on: document.querySelector('#tns-content .tns-per .tab.on').dataset.per,
      segs: cols.reduce((a, c) => a + c.querySelectorAll('.tns-seg').length, 0), sub: document.getElementById('tns-sub').textContent };
  }
  const hoy = tnFecha(tnHoy()), lunHoy = tnMas(tnHoy(), -((hoy.getDay() + 6) % 7));
  out.semOk = tnFecha(out.sem.desde).getDay() === 1 && tnFecha(out.sem.tope).getDay() === 0 && tnMas(out.sem.tope, 1) === lunHoy;
  out.mesOk = out.mes.desde.slice(8) === '01' && out.mes.cols === new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  out.anoOk = out.ano.cols === hoy.getMonth() + 1 && out.ano.gran === 'mes';
  out.m3Ok = out['3m'].desde === ojISO(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)) && out['3m'].gran === 'sem';
  return out;
});
const okPer = ['3m', 'mes', 'sem', 'ano'].every(k => prs[k].total === prs[k].esp && prs[k].barras === prs[k].total && prs[k].on === k && prs[k].segs > 0);
log(okPer && prs.semOk && prs.mesOk && prs.anoOk && prs.m3Ok && prs.sem.cols === 7,
  '[M15] Cada período cuenta su rango exacto (la semana pasada, de lunes a domingo) y sus barras suman su total', JSON.stringify(prs));
const tap = await page.evaluate(() => {
  tnsPer('sem');
  const c = document.querySelectorAll('#tns-content .tns-col'); c[0].click();
  const b = document.getElementById('tns-act-cap').textContent;
  /* Las barras van apiladas: abajo el 2.º–1.º, arriba el 3.º, cada uno con su color. */
  tnsPer('ano');
  const col = [...document.querySelectorAll('#tns-content .tns-col')].find(x => x.querySelectorAll('.tns-seg').length === 2);
  const segs = col ? [...col.querySelectorAll('.tns-seg')] : [];
  return { b, sel: c[0].classList.contains('sel'), orden: segs.map(s => s.classList.contains('tn-k-sp') ? 'S' : 'T').join(''),
    arriba: segs.length === 2 && segs[0].getBoundingClientRect().bottom <= segs[1].getBoundingClientRect().top + 1.5,
    colores: segs.length === 2 && getComputedStyle(segs[0]).backgroundColor !== getComputedStyle(segs[1]).backgroundColor };
});
log(/^Lunes \d+ de \w+ — /.test(tap.b) && tap.sel && tap.orden === 'TS' && tap.arriba && tap.colores,
  '[M16] Barras apiladas por turno (3.º arriba, 2.º–1.º abajo); tocar una dice qué pasó ese día, semana o mes', JSON.stringify(tap));
/* El aviso del punto 4 y el editor de las secciones en el tiempo. */
const av1 = await page.evaluate(() => ({ t: document.getElementById('tns-aviso').innerText.replace(/\s+/g, ' ').trim(), b: document.getElementById('tns-aviso-b').textContent }));
log(/^Se calculan con tus cambios: 2\.ª al comienzo · 3\.ª desde el 15 jul\. Editar$/.test(av1.t) && av1.b === 'Editar',
  '[M12] Con cambios registrados, el aviso los dice y ofrece editarlos', JSON.stringify(av1));
await page.click('#tns-aviso-b'); await page.waitForTimeout(350);
const ed1 = await page.evaluate(() => ({ open: document.getElementById('modal').classList.contains('open'), filas: document.querySelectorAll('#tn-se .tn-se-r').length,
  on: [...document.querySelectorAll('#tn-se .tn-se-r')].map(r => (r.querySelector('.tn-se-b.on') || {}).dataset.s), d: (document.getElementById('tn-se-d1') || {}).value }));
await page.click('#tn-se .tn-se-r[data-i="1"] .tn-ds-b'); await page.waitForTimeout(150);
await page.click('#tn-se-ok'); await page.waitForTimeout(400);
const ed2 = await page.evaluate(() => ({ h: tnCfg().historial.map(x => x.seccion + '@' + (x.desde || '-')).join(), sec: tnCfg().seccion,
  av: document.getElementById('tns-aviso').innerText.replace(/\s+/g, ' ').trim(), modal: document.getElementById('modal').classList.contains('open') }));
log(ed1.open && ed1.filas === 2 && JSON.stringify(ed1.on) === '["2","3"]' && ed1.d === '2026-07-15' && ed2.h === '2@-' && ed2.sec === 2 && !ed2.modal &&
    /^Se calculan suponiendo que siempre has estado en la 2\.ª sección\. Corregir$/.test(ed2.av),
  '[M13] El editor lista los tramos; quitar el cambio deja «siempre en la 2.ª» y el aviso lo dice', JSON.stringify({ ed1, ed2 }));
/* Un traslado registrado AQUÍ: la 1.ª al comienzo y la 2.ª desde el 1 de agosto. */
await page.click('#tns-aviso-b'); await page.waitForTimeout(350);
await page.click('#tn-se .tn-se-r[data-i="0"] .tn-se-b[data-s="1"]'); await page.waitForTimeout(100);
await page.click('#tn-se-add'); await page.waitForTimeout(150);
await page.fill('#tn-se-d1', '2026-08-01');
await page.click('#tn-se .tn-se-r[data-i="1"] .tn-se-b[data-s="2"]'); await page.waitForTimeout(100);
await page.click('#tn-se-ok'); await page.waitForTimeout(400);
const tras = await page.evaluate(() => {
  const t = tnCfg(), hy = tnFecha(tnHoy()).getFullYear(); tnsPer('ano');
  let T = 0, S = 0;
  for (let iso = hy + '-01-01'; iso <= hy + '-12-31'; iso = tnMas(iso, 1)) {
    const d = tnStatsRango(iso, iso, t).d[0];
    if (d && d.k === 'T') T++; if (d && d.k === 'S') S++;
  }
  return { h: t.historial.map(x => x.seccion + '@' + (x.desde || '-')).join(), sec: t.seccion, total: +document.getElementById('tns-total').textContent, oraculo: T + S,
    av: document.getElementById('tns-aviso').innerText.replace(/\s+/g, ' ').trim(), jul: tnTurno('2026-07-10', null, t).sec };
});
log(tras.h === '1@-,2@2026-08-01' && tras.sec === 2 && tras.jul === 1 && tras.total === tras.oraculo && /2\.ª desde el 1 ago/.test(tras.av),
  '[M17] Registrar un traslado en las estadísticas las recalcula día por día con la sección de cada tramo', JSON.stringify(tras));
await page.click('#tns-aviso-b'); await page.waitForTimeout(300);
await page.click('#tn-se-add'); await page.waitForTimeout(120);
await page.fill('#tn-se-d2', '2026-08-01');
await page.click('#tn-se-ok'); await page.waitForTimeout(300);
const dup = await page.evaluate(() => ({ open: document.getElementById('modal').classList.contains('open'), n: tnCfg().historial.length }));
await page.evaluate(() => closeModal()); await page.waitForTimeout(150);
log(dup.open && dup.n === 2, '[M18] Dos cambios con la misma fecha no se guardan', JSON.stringify(dup));
/* El calendario no se entera del traslado: sigue pintando la sección propia de hoy. */
await page.evaluate(() => go('turnos')); await page.waitForTimeout(250);
const calT = await page.evaluate(() => { _tnVer = { y: 2026, m: 6 }; tnPintarMes(); const c = document.querySelector('#tn-g .tn-c[data-iso="2026-07-10"]'); const r = { t: c.dataset.t, e: tnBase('2026-07-10', 2) }; tnIrHoy(); return r; });
log(calT.t === calT.e, '[M19] El calendario sigue pintando el ciclo de la sección propia, aunque las estadísticas usen el traslado', JSON.stringify(calT));
/* «Volver» y el botón atrás de Android, de las estadísticas a Turnos. */
await page.click('#tn-stc'); await page.waitForTimeout(300);
await page.goBack(); await page.waitForTimeout(350);
const atras = await page.evaluate(() => _lcPantallaActual());
await page.click('#tn-stc'); await page.waitForTimeout(300);
await page.click('#tns-volver'); await page.waitForTimeout(350);
const volver = await page.evaluate(() => ({ p: _lcPantallaActual(), sb: !!document.querySelector('#sidebar .sb-item[data-screen="turnos"]') }));
log(atras === 'turnos' && volver.p === 'turnos', '[M20] El botón atrás de Android y «Volver» llevan de las estadísticas a Turnos', JSON.stringify({ atras, volver }));
/* Desde la hoja de la sección del calendario se llega al editor de las estadísticas. */
await page.click('#tn-bar-sec'); await page.waitForTimeout(350);
await page.click('#tn-secc-mia'); await page.waitForTimeout(450);
const desdeHoja = await page.evaluate(() => ({ p: _lcPantallaActual(), ed: !!document.querySelector('#modal.open #tn-se') }));
await page.evaluate(() => closeModal()); await page.waitForTimeout(150);
log(desdeHoja.p === 'tnstats' && desdeHoja.ed, '[M21] «¿Cambiaste de sección?» lleva a las estadísticas con el editor abierto', JSON.stringify(desdeHoja));
await page.evaluate(() => go('turnos')); await page.waitForTimeout(200);
await page.click('#tn-stc'); await page.waitForTimeout(300);
await page.evaluate(() => tnsPer('ano')); await page.waitForTimeout(150);
await page.click('.tns-y .tn-nav:first-child'); await page.waitForTimeout(200);
const yPrev = await page.evaluate(() => ({ y: document.querySelector('.tns-y b').textContent, ctx: document.querySelector('#tns-content .stat-hero-ctx').textContent,
  tot: +document.getElementById('tns-total').textContent, esp: (r => r.T + r.S)(tnEstadisticas(new Date().getFullYear() - 1)) }));
await page.click('#tns-volver'); await page.waitForTimeout(300);
await page.click('#tn-stc'); await page.waitForTimeout(300);
const yOtra = await page.evaluate(() => document.querySelector('.tns-y b').textContent);
await page.click('#tns-volver'); await page.waitForTimeout(300);
log(yPrev.y === String(new Date().getFullYear() - 1) && /año completo$/.test(yPrev.ctx) && yPrev.tot === yPrev.esp && yOtra === String(new Date().getFullYear()),
  '[M22] El año anterior se ve completo, y al volver a entrar las estadísticas abren en el año en curso', JSON.stringify({ yPrev, yOtra }));
await page.evaluate(() => go('turnos')); await page.waitForTimeout(200);
await page.click('#tn-mtb'); await page.waitForTimeout(350);
await page.click('#tn-pk .tn-pk-y .tn-nav:last-child'); await page.waitForTimeout(100);
await page.click('#tn-pk .tn-pk-m[data-m="0"]'); await page.waitForTimeout(300);
const pk = await page.evaluate(() => ({ v: _tnVer, t: document.getElementById('tn-mtb').innerText.replace(/\s+/g, ' ').trim(), on: document.getElementById('act-sheet').classList.contains('on'),
  dia: document.querySelector('#tn-g .tn-c[data-iso="' + (tnFecha(tnHoy()).getFullYear() + 1) + '-01-01"]') !== null }));
log(pk.v.y === new Date().getFullYear() + 1 && pk.v.m === 0 && /^Enero \d{4}$/.test(pk.t) && !pk.on && pk.dia,
  '[M11] El título del mes abre «Ir a un mes»: se elige el año y el mes (enero del año siguiente)', JSON.stringify(pk));
await page.evaluate(() => tnIrHoy());
await page.evaluate(async () => { await tnElegirSeccion(2); });

/* ═══ H · el Inicio ═══ */
await page.evaluate(() => lcVolverInicio()); await page.waitForTimeout(250);
const ini = await page.evaluate(() => {
  const fr = document.querySelector('#ini-turno .tn-fr'), tr = fr && fr.querySelector('.tn-24-t'), n = fr && fr.querySelector('.tn-24-n');
  return { tile: !!document.querySelector('.mod-tile[data-mod="turnos"]'), fr: !!fr && fr.getBoundingClientRect().height > 80,
    ver: fr && fr.querySelector('.tn-fr-ver').textContent.trim(), k: fr && fr.querySelector('.tn-fr-k').textContent,
    tr: tr && tr.getBoundingClientRect().height, dot: n ? [n.getBoundingClientRect().width, n.getBoundingClientRect().height] : null,
    ls: fr ? [...fr.querySelectorAll('.tn-24-ls span')].map(e => e.textContent).join(' ') : '', sig: fr ? fr.querySelectorAll('.tn-fr-sig .tn-fr-d').length : 0,
    orden: [...document.querySelectorAll('#ini-mods .mod-sec')].map(e => e.textContent) };
});
log(!ini.tile && JSON.stringify(ini.orden) === JSON.stringify(['Operación', 'Gestión', 'Mi cuenta']), '[H1] Sin mosaico Turnos: la franja es su puerta (grupos Operación · Gestión · Mi cuenta)', JSON.stringify(ini));
log(ini.fr && ini.ver === 'Ver calendario' && /^Hoy · 2\.ª sección$/.test(ini.k) && ini.sig === 0 && !/Mañana/.test(await page.evaluate(() => document.querySelector('#ini-turno').innerText)),
  '[H2] La franja dice de dónde sale e invita a «Ver calendario», sin «Mañana · pasado» (build 174)', JSON.stringify(ini));
log(ini.tr <= 6 && ini.ls === '00 06 12 18 24' && (!ini.dot || (ini.dot[0] === ini.dot[1] && ini.dot[0] <= 14)),
  '[H3] La línea de 24 h es fina (≤ 6 px), con las horas debajo y la hora actual como un punto', JSON.stringify(ini));
await page.click('#ini-turno .tn-fr'); await page.waitForTimeout(200);
log(await page.evaluate(() => _lcPantallaActual() === 'turnos'), '[H4] Tocar la franja abre Turnos');
await page.click('#screen-turnos .topbar-back'); await page.waitForTimeout(300);
log(await page.evaluate(() => _lcPantallaActual() === 'inicio'), '[H5] «Volver» regresa a Inicio');
const reloj = await page.evaluate(() => { const a = !!_tnTick; go('capturas'); const b = !!_tnTick; go('turnos'); const c = !!_tnTick; return [a, b, c]; });
log(JSON.stringify(reloj) === '[true,false,true]', '[H6] El reloj solo corre con Inicio o Turnos a la vista', reloj);

/* ═══ I · calidad ═══ */
await page.evaluate(() => go('tnstats')); await page.waitForTimeout(250);
const largos = await page.evaluate(() => {
  const out = [];
  ['screen-turnos', 'screen-tnstats'].forEach(id => {
    const w = document.createTreeWalker(document.getElementById(id), NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const s = w.currentNode.textContent.trim(); if (s.length > 110) out.push(s); }
  });
  return out;
});
log(!largos.length, '[I1] Ningún texto de Turnos ni de sus estadísticas pasa de 110 caracteres', largos);
log(await page.evaluate(() => window._csp.length === 0), '[I2] Cero violaciones de la política de seguridad (CSP)', await page.evaluate(() => window._csp));
await ctx.close();

function lum(c) {
  const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]);
}
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function sobre(fg, bg) {   // compone un color con alfa sobre el fondo
  const a = fg.match(/[\d.]+/g).map(Number), b = bg.match(/[\d.]+/g).map(Number), al = a.length > 3 ? a[3] : 1;
  return 'rgb(' + [0, 1, 2].map(i => Math.round(a[i] * al + b[i] * (1 - al))).join(',') + ')';
}
/* Diferencia de color percibida (CIEDE2000) entre dos «rgb(…)»: mide si dos
   turnos se distinguen a simple vista (build 174: el 3.º y el 2.º–1.º se
   confundían, 7,8 en claro). */
function de2000(c1, c2) {
  const lab = c => {
    const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const x = f((r * .4124 + g * .3576 + b * .1805) / .95047), y = f(r * .2126 + g * .7152 + b * .0722), z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2), rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = .5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, C1 = Math.hypot(ap1, b1), C2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { if (!b && !a) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1 = hp(b1, ap1), h2 = hp(b2, ap2);
  let dh = 0; if (C1 * C2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
  let hb = h1 + h2; if (C1 * C2) { if (Math.abs(h1 - h2) > 180) hb += hb < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - .17 * Math.cos((hb - 30) * rad) + .24 * Math.cos(2 * hb * rad) + .32 * Math.cos((3 * hb + 6) * rad) - .2 * Math.cos((4 * hb - 63) * rad);
  const RC = 2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)), RT = -Math.sin(2 * 30 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad) * RC;
  const SL = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + .045 * Cp, SH = 1 + .015 * Cp * T;
  return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2 - C1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2 - C1) / SC) * (dH / SH));
}
for (const tema of ['light', 'dark']) {
  ({ ctx, page } = await abrir(384, 800, tema));
  await page.evaluate(async () => { await tnGuardar({ seccion: 2 }); go('turnos'); });
  await page.waitForTimeout(300);
  const c = await page.evaluate(() => {
    const g = e => getComputedStyle(e), cel = document.querySelector('#tn-g .tn-c:not(.fuera):not(.hoy):not(.sel)');
    /* El número del día sobre el tinte de su turno (texto, 4,5:1), la marca del
       turno sobre ese tinte (gráfico, 3:1) y la abreviatura de una novedad. */
    const card = g(document.querySelector('.tn-mes')).backgroundColor;
    const num = ['dis', 'ter', 'sp'].map(k => {
      const cc = document.querySelector('#tn-g .tn-c.tn-k-' + k + ':not(.hoy):not(.sel)');
      return { k, txt: g(cc.querySelector('.tn-c-n')).color, tint: 'rgba(0,0,0,0)', cel: g(cc).backgroundColor, card, min: 4.5 };
    });
    const mk = ['ter', 'sp', 'dis'].map(k => {
      const cc = document.querySelector('#tn-g .tn-c.tn-k-' + k + ':not(.hoy):not(.sel)');
      return { k: k + '-turno', txt: g(cc.querySelector('.tn-lb')).color, tint: 'rgba(0,0,0,0)', cel: g(cc).backgroundColor, card, min: 4.5 };
    });
    const hoyE = document.querySelector('.tn-hoy .tn-est');
    return num.concat(mk).concat([{ k: 'sub', txt: g(hoyE).color, tint: 'rgba(0,0,0,0)', cel: g(document.querySelector('.tn-hoy')).backgroundColor, card: g(document.querySelector('.tn-hoy')).backgroundColor, min: 4.5 }]);
  });
  /* Las barras de festivo y novedad son un gráfico (3:1) sobre el tinte de cada turno. */
  const cap = await page.evaluate(() => ['ter', 'sp', 'dis'].flatMap(k => { const d = document.createElement('div'); d.className = 'tn-c tn-k-' + k; d.innerHTML = '<span class="tn-ind"><i class="f"></i><i class="n"></i></span>';
    document.getElementById('tn-g').appendChild(d); const g = getComputedStyle, card = g(document.querySelector('.tn-mes')).backgroundColor;
    const r = ['f', 'n'].map(x => ({ k: k + '-' + (x === 'f' ? 'festivo' : 'novedad'), txt: g(d.querySelector('.' + x)).backgroundColor, tint: 'rgba(0,0,0,0)', cel: g(d).backgroundColor, card, min: 3 })); d.remove(); return r; }));
  const crs = c.concat(cap).map(x => { const fondo = sobre(x.tint, sobre(x.cel, x.card)); return { k: x.k, v: +cr(x.txt, fondo).toFixed(2), min: x.min }; });
  log(crs.every(x => x.v >= x.min), `[I3] Contraste AA del número y el turno escrito, y 3:1 de las barras de festivo y novedad, sobre la celda (${tema === 'light' ? 'claro' : 'oscuro'})`, crs);
  const dif = await page.evaluate(() => {
    const g = getComputedStyle, mes = document.querySelector('.tn-mes'), card = g(mes).backgroundColor;
    const tints = ['dis', 'ter', 'sp'].map(k => g(document.querySelector('#tn-g .tn-c.tn-k-' + k + ':not(.hoy):not(.sel)')).backgroundColor);
    const fills = ['dis', 'ter', 'sp'].map(k => { const d = document.createElement('span'); d.className = 'tn-dot tn-k-' + k; mes.appendChild(d); const c = g(d).backgroundColor; d.remove(); return c; });
    return { card, tints, fills };
  });
  const pares = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => +de2000(dif.tints[a], dif.tints[b]).toFixed(1));
  const rell = dif.fills.map(f => +cr(f, dif.card).toFixed(2));
  log(pares.every(x => x >= 15) && rell.every(x => x >= 3) && pares[2] >= 20,
    `[I8] Los tres turnos se distinguen: tintes a ≥ 15 de ΔE2000 (3.º y 2.º–1.º a ≥ 20) y rellenos a ≥ 3:1 (${tema === 'light' ? 'claro' : 'oscuro'})`, JSON.stringify({ pares, rell }));
  await ctx.close();
}
({ ctx, page } = await abrir(360, 740, 'light'));
await page.evaluate(async () => { await tnGuardar({ seccion: 3 }); go('turnos'); }); await page.waitForTimeout(300);
const sx = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth,
  c: Math.min(...[...document.querySelectorAll('#tn-g .tn-c')].map(e => e.getBoundingClientRect().width)),
  n: document.querySelectorAll('#tn-g .tn-lb').length,
  k: [...document.querySelectorAll('#tn-g .tn-lb')].every(e => { const a = e.getBoundingClientRect(), b = e.closest('.tn-c').getBoundingClientRect();
    return e.scrollWidth <= e.clientWidth && a.left >= b.left + 2 && a.right <= b.right - 2; }) }));
log(sx.x <= 0 && sx.c >= 40 && sx.n > 20 && sx.k, '[I4] A 360 px: sin desborde, celdas de más de 40 px y el turno escrito entero dentro de la celda', JSON.stringify(sx));
await ctx.close();
({ ctx, page } = await abrir(384, 800, 'light', { timezoneId: 'Asia/Tokyo' }));
await page.clock.setFixedTime(new Date('2026-10-29T22:30:00-05:00'));   // 12:30 del 30 en Tokio
await page.reload(); await page.waitForFunction(() => window._lcListo === true);
const tz = await page.evaluate(() => ({ hoy: tnHoy(), h: ojHHMM(tnAhora()), local: new Date().getDate() }));
log(tz.hoy === '2026-10-29' && tz.h === '22:30' && tz.local === 30, '[I5] Con el equipo en otra zona horaria manda la hora de Bogotá', JSON.stringify(tz));
await ctx.close();
({ ctx, page } = await abrir(1440, 900, 'light'));
await page.evaluate(async () => { await tnGuardar({ seccion: 1 }); go('turnos'); }); await page.waitForTimeout(300);
const pc = await page.evaluate(() => {
  const m = document.getElementById('tn-mes').getBoundingClientRect(), h = document.getElementById('tn-hoy').getBoundingClientRect();
  return { lado: m.left > h.right - 2, arriba: Math.abs(m.top - h.top) < 4, sb: !!document.querySelector('#sidebar .sb-item[data-screen="turnos"].on') };
});
log(pc.lado && pc.arriba && pc.sb, '[I6] Escritorio: el mes a la derecha y el ítem del panel lateral marcado', JSON.stringify(pc));
await ctx.close();
log(!errs.length, '[I7] Consola limpia', errs.slice(0, 3));

await browser.close(); server.close();
console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
