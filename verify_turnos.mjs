// Verificación del módulo Turnos (2026-10-29, build 162).
// Calendario de las tres secciones de vigilancia: ciclo Tercero → Segundo –
// primero → Disponible desde el 01/01/2026, calibrable, con horas, novedades
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
const cal = await page.evaluate(() => {
  const hoy = '2027-03-14', r = [];
  [1, 2, 3].forEach(s => ['T', 'S', 'D'].forEach(k => { const d = tnDesfasePara(hoy, s, k); r.push(tnBase(hoy, s, { desfase: d }) === k && d >= 0 && d <= 2); }));
  const d = tnDesfasePara(hoy, 2, 'D');
  return { r, otras: tnBase(hoy, 1, { desfase: d }) !== tnBase(hoy, 2, { desfase: d }) && tnBase(hoy, 3, { desfase: d }) !== 'D' };
});
log(cal.r.every(Boolean), '[A5] Calibrar «hoy mi sección está en X» funciona en las 9 combinaciones', cal.r);
log(cal.otras, '[A6] El desfase corre a las tres secciones a la vez: siguen teniendo turnos distintos');

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
log(bar.entre && bar.lados && bar.alto >= 44 && JSON.stringify(bar.ls) === JSON.stringify(['Mi sección', 'Ciclo y horario']) && bar.ciclo === 'Predeterminado',
  '[L1] Entre «Hoy» y el mes, una barra con dos mitades: «Mi sección» y «Ciclo y horario»', JSON.stringify(bar));
log(!bar.abajo.length && bar.share, '[L2] Sin «Compartir mis turnos» ni «Ajustar el ciclo» al final (compartir sigue en la barra superior)', JSON.stringify(bar.abajo));
await page.click('#tn-bar-sec'); await page.waitForTimeout(350);
const ss = await page.evaluate(() => ({ on: document.getElementById('act-sheet').classList.contains('on'),
  ops: [...document.querySelectorAll('#act-items .tn-secc-op')].map(o => o.querySelector('.ti').textContent + '|' + o.querySelector('.de').textContent + '|' + o.classList.contains('on') + '|' + !!o.querySelector('.tn-secc-ok')),
  hoy: [1, 2, 3].map(s => TN_TURNOS[tnBase(tnHoy(), s, tnCfg())].n), aj: [...document.querySelectorAll('#act-items .sheet-item .ti')].some(e => e.textContent === 'Ajustar el ciclo') }));
log(ss.on && ss.ops.length === 3 && ss.ops.every((o, i) => o.startsWith((i + 1) + '.ª sección|Hoy · ' + ss.hoy[i] + '|' + (i === 1) + '|' + (i === 1))) && !ss.aj,
  '[K1] «Mi sección» abre la hoja de la sección: las tres con su turno de hoy, la elegida con chulo, sin el ajuste del ciclo', JSON.stringify(ss));
await page.click('#act-items .tn-secc-op:nth-child(3)'); await page.waitForTimeout(400);
const desde = await page.evaluate(() => [...document.querySelectorAll('#act-items .sheet-item .ti')].map(e => e.textContent));
await page.click('#act-items .sheet-item:nth-child(1)'); await page.waitForTimeout(400);
const ss2 = await page.evaluate(() => ({ sec: tnCfg().seccion, h: tnCfg().historial.map(x => x.seccion + '@' + (x.desde || '-')), bar: document.querySelector('#tn-bar-sec .tn-bar-v').textContent.trim(),
  on: document.getElementById('act-sheet').classList.contains('on'), ayer: tnTurno(tnMas(tnHoy(), -1), null).sec }));
await page.evaluate(() => tnElegirSeccion(2)); await page.waitForTimeout(300);
log(JSON.stringify(desde) === JSON.stringify(['Desde hoy', 'Desde mañana', 'Desde otra fecha', 'Siempre estuve en la 3.ª']) &&
    ss2.sec === 3 && ss2.bar === '3.ª sección' && !ss2.on && ss2.ayer === 2 && ss2.h.length === 2,
  '[K2] Otra sección pregunta desde cuándo; «Desde hoy» la guarda sin reescribir el pasado (ayer sigue en la 2.ª)', JSON.stringify({ desde, ss2 }));
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

/* ═══ E · ajustar el ciclo y las horas ═══ */
await page.click('#tn-bar-ciclo'); await page.waitForTimeout(250);
const hoyBase = await page.evaluate(() => tnBase(tnHoy(), 2, tnCfg()));
const otro = { T: 'D', S: 'T', D: 'S' }[hoyBase];
await page.click(`#tn-cal [data-k="${otro}"]`);
await page.fill('#tn-h-t3-a', '1400');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const aj = await page.evaluate(() => { const t = tnCfg(); return { base: tnBase(tnHoy(), 2, t), d: t.desfase, h: tnHoras(t).t3, sub: document.querySelector('#tn-bar-ciclo .tn-bar-v').textContent, abierto: document.getElementById('modal').classList.contains('open') }; });
log(aj.base === otro && aj.d > 0 && aj.sub === 'Ajustado' && !aj.abierto, '[E1] «Ciclo y horario» abre el ajuste; calibrar deja hoy en el turno elegido y la barra dice «Ajustado»', JSON.stringify(aj));
log(aj.h[0] === '14:00' && aj.h[1] === '21:00', '[E2] La hora se escribe de corrido en 24 h («1400» → 14:00) y se guarda', aj.h);
await page.evaluate(() => tnAjustar()); await page.waitForTimeout(120);
await page.fill('#tn-h-t2-a', '25:00');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(250);
const mal = await page.evaluate(() => ({ open: document.getElementById('modal').classList.contains('open'), err: document.getElementById('tn-h-t2-a').classList.contains('fi-err') }));
log(mal.open && mal.err, '[E3] Una hora imposible no se guarda: se marca en rojo', JSON.stringify(mal));
await page.click('#modal .tn-mb .bs'); await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const rest = await page.evaluate(() => { const t = tnCfg(); return { d: t.desfase, h: t.horas }; });
log(rest.d === 0 && rest.h === null, '[E4] «Restaurar» vuelve al ciclo y las horas predeterminadas', JSON.stringify(rest));

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
log(lin[0] === '*Turnos · 2.ª sección*' && lin.length === 34 && /⚪ Lun 12 · Disponible · Festivo: Día de la Raza/.test(tx) &&
    /🔵 Jue 29 · Segundo – primero \(06:00–13:00 y 21:00–06:00\)/.test(tx),
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
await page.evaluate(() => { _tnVer = { y: 2026, m: 6 }; tnPintarMes(); });
const jul = await page.evaluate(() => ({ d14: document.querySelector('#tn-g .tn-c[data-iso="2026-07-14"]').dataset.t, e14: tnBase('2026-07-14', 2, tnCfg()),
  d15: document.querySelector('#tn-g .tn-c[data-iso="2026-07-15"]').dataset.t, e15: tnBase('2026-07-15', 3, tnCfg()) }));
log(jul.d14 === jul.e14 && jul.d15 === jul.e15, '[M2] El calendario pinta antes del traslado con la sección de entonces', JSON.stringify(jul));
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
await page.click('#tn-stc'); await page.waitForTimeout(350);
const stp = await page.evaluate(() => ({ open: document.getElementById('modal').classList.contains('open'), t: document.querySelector('#modal .lp-top h2').textContent,
  y: document.querySelector('.tn-st-yv b').textContent, sig: document.querySelector('.tn-st-y .tn-nav:last-child').disabled,
  filas: [...document.querySelectorAll('.tn-st-f')].map(f => f.querySelector('.tn-st-fm').innerText.replace(/\s+/g, ' ').trim()),
  m: tnFecha(tnHoy()).getMonth(), sec: document.querySelectorAll('.tn-st-sec .tn-hs-i').length,
  big: document.querySelector('.tn-st-tot b').textContent, sub: document.querySelector('.tn-st-sub b').textContent,
  rh: tnNum(tnEstadisticas(2026).horas), esp: tnEstadisticas(2026).T + tnEstadisticas(2026).S,
  /* Sin muletillas ni rayados (build 169): ni «Hipotético», ni notas al pie, ni barras rayadas. */
  ruido: /Hipotético|No se suman|El número es de turnos/.test(document.getElementById('tn-st').innerText) ||
    !!document.querySelector('#tn-st .tn-st-nota, #tn-st .hip, #tn-st .tn-st-hip') }));
log(stp.open && stp.t === 'Mis turnos' && stp.y === String(new Date().getFullYear()) && stp.sig && stp.big === stp.rh && stp.sub === String(stp.esp) && !stp.ruido,
  '[M8] «Mis turnos en …» abre la ventana: las horas como cifra principal, los turnos debajo y sin textos de relleno', JSON.stringify(stp));
/* El reparto se dibuja por HORAS, cada turno dice turnos y horas, y las franjas del día suman lo mismo. */
const rep = await page.evaluate(() => {
  const r = _tnStR, fl = [...document.querySelectorAll('.tn-st-hero .tn-barra i')].map(i => parseFloat(i.style.flexGrow));
  const kts = [...document.querySelectorAll('.tn-st-kt')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
  const bl = Object.values(r.bl).reduce((a, b) => a + b, 0);
  return { fl, hS: +r.hS.toFixed(2), hT: +r.hT.toFixed(2), suma: Math.abs(r.hS + r.hT - r.horas) < 1e-6, bl: Math.abs(bl - r.horas) < 1e-6,
    kts, fr: document.querySelectorAll('.tn-st-fri').length, chips: [...document.querySelectorAll('.tn-st-chip')].map(c => c.innerText.trim()) };
});
log(rep.fl[0] === rep.hS && rep.fl[1] === rep.hT && rep.suma && rep.bl && rep.fr === 3 && rep.kts.length === 3 &&
    /^2\.º–1\.º \d+ turnos de 16 h [\d.,]+ h$/.test(rep.kts[0]) && /^3\.º \d+ turnos de 8 h [\d.,]+ h$/.test(rep.kts[1]) && /^Disp\. \d+ disponibles/.test(rep.kts[2]),
  '[M14] La barra reparte HORAS, cada turno dice sus turnos y sus horas, y las tres franjas del día suman el total', JSON.stringify(rep));
log(!rep.chips.some(c => /^0\b/.test(c)), '[M15] Las píldoras no pintan ceros (solo «Sin novedades» cuando no hay)', JSON.stringify(rep.chips));
/* Del mes al día: la tabla suma su total, un mes se abre en sus días y sus horas cuadran. */
const mesDia = await page.evaluate(() => {
  const r = _tnStR, n = tnFecha(tnHoy()).getMonth(), filas = [...document.querySelectorAll('.tn-st-f')];
  const tot = [...document.querySelectorAll('.tn-st-ft span')].slice(1, 4).map(s => +s.textContent);
  const sum = [1, 2, 3].map(i => filas.reduce((a, f) => a + +f.children[i].textContent, 0));
  tnStatsMes(0); tnStatsMes(n);
  const abiertos = document.querySelectorAll('.tn-st-f[aria-expanded="true"]').length, dl = document.getElementById('tn-st-d' + n);
  const rows = [...dl.querySelectorAll('.tn-sd')], h = rows.reduce((a, x) => a + (parseFloat((x.querySelector('.tn-sd-n').firstChild.textContent || '').replace(/\./g, '').replace(',', '.')) || 0), 0);
  const prim = rows[0] ? rows[0].innerText.replace(/\s+/g, ' ').trim() : '';
  tnStatsMes(n);
  return { tot, sum, abiertos, n: rows.length, dias: r.meses[n].dias, h: Math.round(h * 10) / 10, mh: Math.round(r.meses[n].horas * 10) / 10, prim, cerrado: dl.hidden };
});
log(JSON.stringify(mesDia.tot) === JSON.stringify(mesDia.sum) && mesDia.abiertos === 1 && mesDia.n === mesDia.dias && Math.abs(mesDia.h - mesDia.mh) < 0.2 && mesDia.cerrado,
  '[M16] Mes a mes suma su total; tocar un mes abre sus días (uno a la vez) y las horas de los días cuadran con el mes', JSON.stringify(mesDia));
log(stp.filas.length === stp.m + 1 && /hasta hoy$/.test(stp.filas[stp.filas.length - 1]) && stp.sec === 2,
  '[M9] Mes a mes hasta el mes actual («hasta hoy») y el tramo de cada sección', JSON.stringify(stp.filas));
await page.click('.tn-st-y .tn-nav:first-child'); await page.waitForTimeout(200);
const y0 = await page.evaluate(() => ({ y: document.querySelector('.tn-st-yv b').textContent, s: document.querySelector('.tn-st-yv span').textContent, filas: document.querySelectorAll('.tn-st-f').length }));
await page.evaluate(() => closeModal()); await page.waitForTimeout(200);
log(y0.y === String(new Date().getFullYear() - 1) && y0.s === 'Año completo' && y0.filas === 12, '[M10] El año anterior se ve completo, sus 12 meses', JSON.stringify(y0));
await page.click('#tn-mtb'); await page.waitForTimeout(350);
await page.click('#tn-pk .tn-pk-y .tn-nav:last-child'); await page.waitForTimeout(100);
await page.click('#tn-pk .tn-pk-m[data-m="0"]'); await page.waitForTimeout(300);
const pk = await page.evaluate(() => ({ v: _tnVer, t: document.getElementById('tn-mtb').innerText.replace(/\s+/g, ' ').trim(), on: document.getElementById('act-sheet').classList.contains('on'),
  dia: document.querySelector('#tn-g .tn-c[data-iso="' + (tnFecha(tnHoy()).getFullYear() + 1) + '-01-01"]') !== null }));
log(pk.v.y === new Date().getFullYear() + 1 && pk.v.m === 0 && /^Enero \d{4}$/.test(pk.t) && !pk.on && pk.dia,
  '[M11] El título del mes abre «Ir a un mes»: se elige el año y el mes (enero del año siguiente)', JSON.stringify(pk));
await page.evaluate(() => tnIrHoy());
/* Un traslado a futuro: hoy sigue la sección de antes y la barra lo anuncia. */
await page.evaluate(async () => { await tnElegirSeccion(2); await tnCambiarSeccion(3, tnMas(tnHoy(), 1)); });
await page.waitForTimeout(250);
const fut = await page.evaluate(() => ({ sec: tnCfg().seccion, n: (document.querySelector('#tn-bar-sec .tn-bar-n') || {}).textContent || '', man: tnTurno(tnMas(tnHoy(), 1), null).sec }));
log(fut.sec === 2 && fut.man === 3 && /^Pasas a la 3\.ª el /.test(fut.n), '[M12] Un traslado desde mañana: hoy sigue la 2.ª y la barra lo anuncia', JSON.stringify(fut));
await page.evaluate(() => tnSeccionSheet()); await page.waitForTimeout(300);
const hs = await page.evaluate(() => [...document.querySelectorAll('#act-items .tn-hs-i')].map(e => e.innerText.replace(/\s+/g, ' ').trim()));
await page.click('#act-items .tn-hs-i .tn-ds-b'); await page.waitForTimeout(350);
const hs2 = await page.evaluate(() => tnCfg().historial.length);
log(hs.length === 2 && /^2\.ª Desde el comienzo hasta el /.test(hs[0]) && /^3\.ª Desde el /.test(hs[1]) && hs2 === 1,
  '[M13] La hoja de la sección lista los cambios y deja quitar uno', JSON.stringify({ hs, hs2 }));
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
log(ini.fr && ini.ver === 'Ver calendario' && /^Hoy · 2\.ª sección$/.test(ini.k) && ini.sig === 2, '[H2] La franja dice de dónde sale, invita a «Ver calendario» y trae mañana y pasado', JSON.stringify(ini));
log(ini.tr <= 6 && ini.ls === '00 06 12 18 24' && (!ini.dot || (ini.dot[0] === ini.dot[1] && ini.dot[0] <= 14)),
  '[H3] La línea de 24 h es fina (≤ 6 px), con las horas debajo y la hora actual como un punto', JSON.stringify(ini));
await page.click('#ini-turno .tn-fr'); await page.waitForTimeout(200);
log(await page.evaluate(() => _lcPantallaActual() === 'turnos'), '[H4] Tocar la franja abre Turnos');
await page.click('#screen-turnos .topbar-back'); await page.waitForTimeout(300);
log(await page.evaluate(() => _lcPantallaActual() === 'inicio'), '[H5] «Volver» regresa a Inicio');
const reloj = await page.evaluate(() => { const a = !!_tnTick; go('capturas'); const b = !!_tnTick; go('turnos'); const c = !!_tnTick; return [a, b, c]; });
log(JSON.stringify(reloj) === '[true,false,true]', '[H6] El reloj solo corre con Inicio o Turnos a la vista', reloj);

/* ═══ I · calidad ═══ */
const largos = await page.evaluate(() => {
  const out = []; const w = document.createTreeWalker(document.getElementById('screen-turnos'), NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const s = w.currentNode.textContent.trim(); if (s.length > 110) out.push(s); }
  return out;
});
log(!largos.length, '[I1] Ningún texto de la pantalla pasa de 110 caracteres', largos);
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
