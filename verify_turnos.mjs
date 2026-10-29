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
    D: tnBloques('2026-10-30', 2, t).length, txt: tnHorasTxt('S', t), mes: tnResumenMes(2026, 9, 2, t) };
});
log(hr.S === 16 && hr.T === 8 && hr.D === 0 && hr.txt === '06:00–13:00 y 21:00–06:00',
  '[C3] Horas del usuario: 2.º 06–13, 3.er 13–21, 4.º/1.er 21–06 (16 h, 8 h, 0 h)', JSON.stringify(hr));
log(hr.mes.T === 11 && hr.mes.S === 10 && hr.mes.D === 10 && hr.mes.horas === 248 && hr.mes.fest === 0,
  '[C4] Octubre en cifras: 11 · 10 · 10 días y 248 h de servicio', JSON.stringify(hr.mes));

/* ═══ D · la pantalla ═══ */
await page.evaluate(() => go('turnos')); await page.waitForTimeout(150);
const vac = await page.evaluate(() => ({ e: !!document.querySelector('#tn-vacio .empty'), cols: getComputedStyle(document.getElementById('tn-cols')).display,
  sh: getComputedStyle(document.getElementById('tn-share')).display, seg: document.querySelectorAll('#tn-seg button').length }));
log(vac.e && vac.cols === 'none' && vac.sh === 'none' && vac.seg === 3, '[D1] Sin sección: pide elegirla y no enseña un calendario a ciegas', JSON.stringify(vac));
await page.click('#tn-seg button:nth-child(2)'); await page.waitForTimeout(400);
const d2 = await page.evaluate(() => {
  const s = document.getElementById('screen-turnos'), r = s.getBoundingClientRect();
  return { enMain: !!s.closest('#main'), alto: r.height, sec: tnCfg().seccion, on: document.querySelector('#tn-seg .on').textContent,
    celdas: document.querySelectorAll('#tn-g .tn-c').length, hoy: document.querySelectorAll('#tn-g .tn-c.hoy').length,
    sub: document.getElementById('tn-sub').textContent, sem: document.querySelectorAll('.tn-sd').length,
    hoyN: document.querySelector('.tn-hoy-n').textContent, otras: document.querySelectorAll('.tn-otra').length };
});
log(d2.enMain && d2.alto > 600 && d2.sec === 2 && d2.on === '2.ª', '[D2] Elegir la sección la guarda y pinta la pantalla (vive en #main y tiene alto real)', JSON.stringify(d2));
log(d2.celdas % 7 === 0 && d2.celdas >= 28 && d2.hoy === 1 && d2.sem === 7 && d2.otras === 2,
  '[D3] Mes en semanas completas, hoy marcado una vez, 7 próximos días y las otras 2 secciones', JSON.stringify(d2));
const hoyCel = await page.evaluate(() => { const h = tnHoy(); return { cel: document.querySelector('#tn-g .tn-c.hoy .tn-c-k').textContent, ab: TN_TURNOS[tnBase(h, 2, tnCfg())].ab }; });
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
await page.evaluate(() => tnElegir('2026-10-12')); await page.waitForTimeout(80);
const dia = await page.evaluate(() => ({ t: document.querySelector('.tn-dia-t').textContent, f: (document.querySelector('.tn-fest') || {}).textContent,
  k: document.querySelector('.tn-dia-k b').textContent, otras: [...document.querySelectorAll('.tn-otra')].map(o => o.innerText.replace(/\s+/g, ' ').trim()) }));
log(/12 de octubre/.test(dia.t) && dia.f === 'Festivo · Día de la Raza' && dia.k === 'Disponible' &&
    JSON.stringify(dia.otras) === JSON.stringify(['1.ª sección Tercero', '3.ª sección Segundo – primero']),
  '[D7] El día elegido dice su turno, su festivo y el de las otras dos secciones', JSON.stringify(dia));

/* ═══ E · ajustar el ciclo y las horas ═══ */
await page.evaluate(() => tnAjustar()); await page.waitForTimeout(150);
const hoyBase = await page.evaluate(() => tnBase(tnHoy(), 2, tnCfg()));
const otro = { T: 'D', S: 'T', D: 'S' }[hoyBase];
await page.click(`#tn-cal [data-k="${otro}"]`);
await page.fill('#tn-h-t3-a', '1400');
await page.click('#modal .tn-mb .bp'); await page.waitForTimeout(400);
const aj = await page.evaluate(() => { const t = tnCfg(); return { base: tnBase(tnHoy(), 2, t), d: t.desfase, h: tnHoras(t).t3, sub: document.getElementById('tn-sub').textContent, abierto: document.getElementById('modal').classList.contains('open') }; });
log(aj.base === otro && aj.d > 0 && /ajustado/.test(aj.sub) && !aj.abierto, '[E1] Calibrar desde el panel deja hoy en el turno elegido y lo dice', JSON.stringify(aj));
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
const nv = await page.evaluate(h => ({ n: tnCfg().novedades.length, cel: document.querySelector(`#tn-g .tn-c[data-iso="${h}"]`).className,
  k: document.querySelector(`#tn-g .tn-c[data-iso="${h}"] .tn-c-k`).textContent, hoyN: document.querySelector('.tn-hoy-n').textContent,
  bl: tnBloques(h, 2, tnCfg()).length }), hoy);
log(nv.n === 1 && /tn-k-lib/.test(nv.cel) && nv.k === 'VAC' && nv.hoyN === 'Vacaciones' && nv.bl === 0,
  '[F1] Unas vacaciones se pintan encima del ciclo y ese día no hay servicio', JSON.stringify(nv));
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
    /🔴 Jue 29 · Segundo – primero \(06:00–13:00 y 21:00–06:00\)/.test(tx),
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

/* ═══ H · el Inicio ═══ */
await page.evaluate(() => lcVolverInicio()); await page.waitForTimeout(250);
const ini = await page.evaluate(() => {
  const t = document.querySelector('.mod-tile[data-mod="turnos"]'), g = t.closest('.mod-g'), fr = document.querySelector('#ini-turno .tn-fr');
  const r = t.getBoundingClientRect(), gr = g.querySelector('.mod-grid').getBoundingClientRect();
  return { sec: g.querySelector('.mod-sec').textContent, ancho: Math.round(r.width) === Math.round(gr.width), mini: t.querySelectorAll('.tn-mini>span').length,
    dato: t.querySelector('.mod-d').textContent, fr: !!fr && fr.getBoundingClientRect().height > 80,
    orden: [...document.querySelectorAll('#ini-mods .mod-sec')].map(e => e.textContent) };
});
log(ini.sec === 'Servicio' && ini.ancho && ini.mini === 7, '[H1] Mosaico Turnos en «Servicio», a lo ancho, con la semana en miniatura', JSON.stringify(ini));
log(/^2\.ª sección · /.test(ini.dato) && ini.fr, '[H2] Dato vivo del mosaico y franja «Mi turno» arriba del Inicio', JSON.stringify(ini));
log(JSON.stringify(ini.orden) === JSON.stringify(['Operación', 'Gestión', 'Servicio', 'Mi cuenta']), '[H3] Grupos: Operación · Gestión · Servicio · Mi cuenta', ini.orden);
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
    return ['dis', 'ter', 'sp'].map(k => {
      const el = document.querySelector('#tn-g .tn-c.tn-k-' + k + ':not(.fuera):not(.sel) .tn-c-k'), cc = el.closest('.tn-c');
      return { k, txt: g(el).color, tint: g(el).backgroundColor, cel: g(cc).backgroundColor,
        card: g(document.querySelector('.tn-mes')).backgroundColor };
    }).concat([{ k: 'sub', txt: g(document.querySelector('.tn-hoy-h')).color, tint: 'rgba(0,0,0,0)', cel: g(document.querySelector('.tn-hoy')).backgroundColor, card: g(document.querySelector('.tn-hoy')).backgroundColor }]);
  });
  const crs = c.map(x => { const fondo = sobre(x.tint, sobre(x.cel, x.card)); return +cr(x.txt, fondo).toFixed(2); });
  log(crs.every(x => x >= 4.5), `[I3] Contraste AA de los tres turnos sobre su celda (${tema === 'light' ? 'claro' : 'oscuro'})`, crs);
  await ctx.close();
}
({ ctx, page } = await abrir(360, 740, 'light'));
await page.evaluate(async () => { await tnGuardar({ seccion: 3 }); go('turnos'); }); await page.waitForTimeout(300);
const sx = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth,
  c: Math.min(...[...document.querySelectorAll('#tn-g .tn-c')].map(e => e.getBoundingClientRect().width)),
  k: [...document.querySelectorAll('#tn-g .tn-c-k')].every(e => e.scrollWidth <= e.clientWidth + 1) }));
log(sx.x <= 0 && sx.c >= 40 && sx.k, '[I4] A 360 px: sin desborde, celdas de más de 40 px y el código entero', JSON.stringify(sx));
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
