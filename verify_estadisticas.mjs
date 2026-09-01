// Verificación del módulo Estadísticas rediseñado (2026-08-31).
// Recorre golden path real con Playwright: estado vacío, semilla de datos
// reales (mezcla de tipos, conductas repetidas y empatadas, barrios
// empatados, fechas en varios meses), y comprueba que la nueva arquitectura
// de información (KPI + distribución → rankings → actividad) no fabrica
// comparaciones que los datos no sostienen, usa colores semánticos (no uno
// por fila), no rompe en 360-430px, y no toca ningún otro módulo.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/12d7e14c-cba8-4602-a121-b56b1574b8c0/scratchpad';
const OUT = (n) => resolve(SHOTS, `stats_${n}.png`);
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };

const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(8097, r));

const report = [];
const log = (ok, label, extra) => { report.push(ok); console.log((ok ? 'OK ' : 'FAIL'), label, extra ?? ''); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:8097/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '246810');
await page.fill('#pin-b', '246810');
await page.click('button[onclick="doSetPin()"]');
// El toast "PIN configurado…" dura 4 s (showToast dur=4000) — se deja pasar
// una vez aquí para que no quede flotando sobre las capturas de pantalla.
await page.waitForTimeout(4200);

// ═══ 1. ESTADO VACÍO (0 casos) — el mensaje original se conserva intacto ═══
await page.evaluate(() => go('estadisticas'));
await page.waitForTimeout(300);
log(await page.$eval('#stats-content .empty h3', el => el.textContent.trim()) === 'Sin datos aún', 'Estado vacío: título "Sin datos aún"');
log(await page.$eval('#stats-sub', el => el.textContent.trim()) === 'Sin datos aún', 'Estado vacío: subtítulo de la topbar');
log(await page.$('#stats-content .tabs') === null, 'Estado vacío: sin pestañas de período (no hay nada que filtrar)');
await page.screenshot({ path: OUT('01_vacio_dark_390') });

// ═══ 2. SEMBRAR DATOS REALES ═══
// 11 casos: mezcla URI/CESPA/OJ desigual, conductas con variación real Y
// empates, 9 barrios TODOS distintos (para forzar el empate — todos a 1,
// que es el caso que debe SUPRIMIR la barra proporcional), fechas repartidas
// en varios meses (hoy, días recientes, y dos casos de hace 1-2 meses).
const seedInfo = await page.evaluate(async () => {
  function pad(n){ return String(n).padStart(2,'0'); }
  function daysAgo(n){
    var d = new Date(); d.setDate(d.getDate()-n);
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  function baseCase(tipo, fechaProc, conductas, barrio){
    return {
      id: uid(), tipo: tipo, nunc: tipo!=='OJ' ? '05001700000020260001'.slice(0,16) : '',
      spoa:'', fechaProc: fechaProc, conductas: conductas, articulosCP: conductas.map(function(){return '';}),
      elementos: [], destino:'', numIncidente:'', recibe:'',
      lugar: {depto:'Antioquia', muni:'Medellín', dir:'', barrio: barrio||'', caract:'', localidad:'', zona:'', vereda:''},
      capturados: [{priNom:'Persona', priApe:'De Prueba'}], victimas: [], testigos: [], sinVictima:true, sinTestigo:true,
      hayVehiculos:false, vehiculos: [],
      narracion: {texto:''}, servidor: {}, created: Date.now(), isTest: true
    };
  }
  var seed = [
    baseCase('URI',   daysAgo(0),  ['Hurto'], 'Boston'),
    baseCase('URI',   daysAgo(2),  ['Hurto','Lesiones personales'], 'San Benito'),
    baseCase('URI',   daysAgo(5),  ['Hurto'], 'Candelaria'),
    baseCase('URI',   daysAgo(10), ['Hurto'], 'Villanueva'),
    baseCase('URI',   daysAgo(20), ['Fabricación, tráfico y porte de armas de fuego'], 'La Candelaria'),
    baseCase('CESPA', daysAgo(3),  ['Lesiones personales'], 'Buenos Aires'),
    baseCase('CESPA', daysAgo(45), ['Concierto para delinquir'], 'El Chagualo'),
    baseCase('OJ',    daysAgo(1),  ['Falsedad en documento privado'], ''),
    baseCase('OJ',    daysAgo(60), ['Fabricación, tráfico y porte de armas de fuego'], 'Prado'),
    baseCase('OJ',    daysAgo(4),  ['Extorsión'], ''),
    baseCase('URI',   daysAgo(0),  ['Amenazas'], 'Guayaquil')
  ];
  await DB.saveCases(seed);
  return { n: seed.length };
});
log(seedInfo.n === 11, 'Semilla guardada (11 casos)', seedInfo.n);

// ═══ 3. FUNCIONES PURAS — antes de tocar el DOM ═══
const unit = await page.evaluate(() => {
  var cases = DB.getCases();
  var cond = lcStatsFrecuencia(cases, function(c){ return c.conductas||[]; });
  var barr = lcStatsFrecuencia(cases, function(c){ return c.lugar&&c.lugar.barrio; });
  var condHurto = cond.arr.filter(function(x){ return x.lbl==='Hurto'; })[0];
  var rankCondHtml = lcStatsRankingHtml(cond.arr, cond.total);
  var rankBarrHtml = lcStatsRankingHtml(barr.arr, barr.total);
  return {
    condDistinct: cond.arr.length, condTotalOcurrencias: cond.total,
    hurtoCount: condHurto ? condHurto.n : 0,
    barrDistinct: barr.arr.length, barrTotal: barr.total,
    barrAllOnes: barr.arr.every(function(x){ return x.n===1; }),
    condHasBar: rankCondHtml.indexOf('stat-rank-barfill') >= 0,
    barrHasBar: rankBarrHtml.indexOf('stat-rank-barfill') >= 0,
    condFirstRank: cond.arr[0].lbl
  };
});
log(unit.hurtoCount === 4, 'Multi-conducta: "Hurto" cuenta 4 (no solo conductas[0])', unit.hurtoCount);
log(unit.condTotalOcurrencias === 12, 'Total de ocurrencias de conducta = 12 (11 casos, uno con 2 conductas)', unit.condTotalOcurrencias);
log(unit.condDistinct === 7, '7 conductas distintas registradas', unit.condDistinct);
log(unit.barrDistinct === 9, '9 barrios distintos (los 2 casos OJ sin barrio no cuentan)', unit.barrDistinct);
log(unit.barrAllOnes, 'Los 9 barrios están todos empatados en 1');
log(unit.condFirstRank === 'Hurto', 'Conductas: "Hurto" encabeza el ranking (4 > todas)');
log(unit.condHasBar === true, 'Conductas CON variación real → SÍ pinta la barra proporcional');
log(unit.barrHasBar === false, 'Barrios TODOS empatados → NO pinta ninguna barra (sin ranking falso)');

// ═══ 4. RENDER COMPLETO, período "Todo" (por defecto) ═══
await page.evaluate(() => go('estadisticas'));
await page.waitForTimeout(300);
log(await page.$eval('#stats-content .stat-per .tab.on', el => el.textContent.trim()) === 'Todo', 'Pestaña activa por defecto: "Todo"');
log(await page.$eval('.stat-hero-num', el => el.textContent.trim()) === '11', 'KPI principal = 11');
log((await page.$eval('#stats-sub', el => el.textContent)).indexOf('11 casos') === 0, 'Subtítulo topbar arranca con "11 casos"');

const distRows = await page.$$eval('.stat-dist-row', els => els.map(el => ({
  lbl: el.querySelector('.stat-dist-lbl').textContent.trim(),
  n: el.querySelector('.stat-dist-n').textContent.trim(),
  pct: el.querySelector('.stat-dist-pct').textContent.trim(),
  color: getComputedStyle(el.querySelector('.stat-dot')).backgroundColor
})));
log(distRows.length === 3, 'Distribución: 3 filas (URI/CESPA/Orden judicial)', distRows.length);
log(distRows[0].lbl === 'URI' && distRows[0].n === '6' && distRows[0].pct === '55%', 'URI = 6 (55%)', JSON.stringify(distRows[0]));
log(distRows[1].lbl === 'CESPA' && distRows[1].n === '2' && distRows[1].pct === '18%', 'CESPA = 2 (18%)', JSON.stringify(distRows[1]));
log(distRows[2].lbl === 'Orden judicial' && distRows[2].n === '3' && distRows[2].pct === '27%', 'Orden judicial = 3 (27%)', JSON.stringify(distRows[2]));
const distColorsDistinct = new Set(distRows.map(r => r.color)).size === 3;
log(distColorsDistinct, 'Distribución: los 3 tipos usan 3 colores SEMÁNTICOS distintos (URI/CESPA/OJ)');
const segCount = await page.$$eval('.stat-dist-bar .stat-dist-seg', els => els.length);
log(segCount === 3, 'Barra segmentada: 3 segmentos (ninguno en 0%)', segCount);

// Rankings: orden y "+N más"
const rankCards = await page.$$eval('.stat-rank-card', els => els.map(el => ({
  titulo: el.querySelector('.st').textContent.trim(),
  filas: Array.from(el.querySelectorAll('.stat-rank-row')).map(r => ({
    n: r.querySelector('.stat-rank-n').textContent.trim(),
    name: r.querySelector('.stat-rank-name').textContent.trim(),
    count: r.querySelector('.stat-rank-count b').textContent.trim(),
    hasBar: !!r.querySelector('.stat-rank-bartrack')
  })),
  more: el.querySelector('.stat-rank-more') ? el.querySelector('.stat-rank-more').textContent.trim() : null
})));
log(rankCards.length === 2, 'Dos tarjetas de ranking (conductas, sectores)', rankCards.length);
log(rankCards[0].titulo === 'Conductas más frecuentes', 'Tarjeta 1: "Conductas más frecuentes"');
log(rankCards[0].filas.length === 5, 'Conductas: 5 filas visibles (7 distintas, tope 5)', rankCards[0].filas.length);
log(rankCards[0].filas[0].n === '01' && rankCards[0].filas[0].name === 'Hurto' && rankCards[0].filas[0].count === '4', 'Fila 01 = Hurto (4)', JSON.stringify(rankCards[0].filas[0]));
log(rankCards[0].filas[1].name === 'Fabricación, tráfico y porte de armas de fuego', 'Fila 02 = el delito de nombre largo (empate resuelto alfabéticamente)', rankCards[0].filas[1].name);
log(rankCards[0].filas[0].hasBar === true, 'Fila 01 (Hurto) SÍ trae barra — hay variación real');
log(rankCards[0].more === '+2 más', 'Conductas: nota "+2 más" (7 registradas − 5 visibles)', rankCards[0].more);
log(rankCards[1].titulo === 'Sectores con más registros', 'Tarjeta 2: "Sectores con más registros"');
log(rankCards[1].filas.every(f => f.count === '1'), 'Sectores: las 5 filas visibles muestran 1 (empatadas de verdad)');
log(rankCards[1].filas.every(f => f.hasBar === false), 'Sectores: NINGUNA fila trae barra (empate ⇒ sin comparación falsa)');
log(rankCards[1].more === '+4 más', 'Sectores: nota "+4 más" (9 registrados − 5 visibles)', rankCards[1].more);

// Ninguna fila de ranking usa un color por fila: toda barra visible comparte el MISMO acento.
const fillColors = await page.$$eval('.stat-rank-barfill', els => els.map(el => getComputedStyle(el).backgroundColor));
log(fillColors.length >= 1 && new Set(fillColors).size === 1, 'Rankings: todas las barras (las que existen) comparten UN solo color de énfasis, no uno por fila', fillColors);

// El nombre largo no rompe el layout: la página no se desborda horizontalmente.
const noHScroll390 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
log(noHScroll390, 'Sin scroll horizontal en 390px con el delito de nombre largo visible');

// Actividad: existe, y responder al tacto actualiza el pie de la gráfica.
const actColsCount = await page.$$eval('.stat-act-col', els => els.length);
log(actColsCount >= 1, 'Actividad: histograma con al menos 1 columna', actColsCount);
const capAntes = await page.$eval('#stat-act-cap', el => el.textContent.trim());
await page.click('.stat-act-col:first-child');
await page.waitForTimeout(100);
const capDespues = await page.$eval('#stat-act-cap', el => el.textContent.trim());
log(capDespues.length > 0 && capDespues !== '', 'Actividad: tocar una columna deja un pie de gráfica no vacío', capDespues);
log(capDespues !== capAntes || actColsCount === 1, 'Actividad: el pie cambia al tocar una columna distinta a la del pico (o hay una sola columna)', capAntes + ' -> ' + capDespues);

// Nada de emojis ni marcado decorativo ajeno al sistema.
const innerHtmlStats = await page.$eval('#stats-content', el => el.innerHTML);
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
log(!emojiRe.test(innerHtmlStats), 'Sin emojis en el HTML generado (Design System v2)');
log(innerHtmlStats.indexOf('<canvas') < 0 && innerHtmlStats.indexOf('<svg') < 0, 'Sin canvas ni SVG añadidos — histograma en HTML/CSS puro, sin dependencias nuevas');

// El tap sobre la columna de actividad (arriba) desplazó la página al llevar
// ese botón a la vista — se vuelve al tope para que la captura muestre el
// módulo completo desde el encabezado, como lo ve el usuario al entrar.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(150);
await page.screenshot({ path: OUT('02_todo_dark_390') });

// ═══ 5. CAMBIO DE PERÍODO ═══
await page.click('#stats-content .stat-per .tab:has-text("Este mes")');
await page.waitForTimeout(250);
log(await page.$eval('#stats-content .stat-per .tab.on', el => el.textContent.trim()) === 'Este mes', 'Pestaña activa cambia a "Este mes"');
const esteMesN = await page.evaluate(() => lcStatsFiltrar(DB.getCases(), 'mes').length);
const heroEsteMes = await page.$eval('.stat-hero-num', el => el.textContent.trim());
log(heroEsteMes === String(esteMesN), 'KPI de "Este mes" coincide con lcStatsFiltrar("mes")', heroEsteMes + ' vs ' + esteMesN);
log(esteMesN < 11 && esteMesN > 0, '"Este mes" es un subconjunto real (excluye los casos de hace 45/60 días)', esteMesN);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: OUT('03_este_mes_dark_390') });

await page.click('#stats-content .stat-per .tab:has-text("Últimos 3 meses")');
await page.waitForTimeout(250);
const tresMesesN = await page.evaluate(() => lcStatsFiltrar(DB.getCases(), '3m').length);
const heroTresMeses = await page.$eval('.stat-hero-num', el => el.textContent.trim());
log(heroTresMeses === String(tresMesesN), 'KPI de "Últimos 3 meses" coincide con lcStatsFiltrar("3m")', heroTresMeses + ' vs ' + tresMesesN);

// Volver a "Todo" para las siguientes pruebas.
await page.click('#stats-content .stat-per .tab:has-text("Todo")');
await page.waitForTimeout(200);

// ═══ 6. PERÍODO SIN COINCIDENCIAS — mensaje honesto, nunca una pantalla rota ═══
// El almacén se limpia A PROPÓSITO (única vez que se usa la forma destructiva
// de DB.saveCases en esta suite) para dejar un escenario determinista: UN
// caso de hace 400 días. Así "Todo" lo ve y "Este mes"/"Últimos 3 meses" no,
// sin depender de qué tan poblado quedó el resto de la prueba.
await page.evaluate(async () => {
  function daysAgo(n){ var d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
  await DB.saveCases([]);
  await DB.saveCase({ id: uid(), tipo:'URI', nunc:'', spoa:'', fechaProc: daysAgo(400),
    conductas:['Hurto'], articulosCP:[''], elementos:[], destino:'', numIncidente:'', recibe:'',
    lugar:{depto:'',muni:'',dir:'',barrio:'Solo'}, capturados:[], victimas:[], testigos:[],
    sinVictima:true, sinTestigo:true, hayVehiculos:false, vehiculos:[], narracion:{texto:''},
    servidor:{}, created: Date.now(), isTest:true });
});
await page.evaluate(() => go('estadisticas'));
await page.waitForTimeout(200);
log(await page.$eval('.stat-hero-num', el => el.textContent.trim()) === '1', 'Reinicio determinista: "Todo" ve el único caso (hace 400 días)');
await page.click('#stats-content .stat-per .tab:has-text("Este mes")');
await page.waitForTimeout(200);
log(await page.$('.stat-empty-mini') !== null, 'Período sin datos: aparece la tarjeta de estado vacío');
const emptyTxt = await page.$eval('.stat-empty-mini', el => el.textContent);
log(emptyTxt.indexOf('Sin capturas en este período') >= 0, 'Mensaje explica que no hay capturas EN ESE período');
log(emptyTxt.indexOf('1 captura registrada') >= 0, 'Mensaje indica cuántas hay en el historial completo (1)', emptyTxt);
log(await page.$('#stats-content .stat-per') !== null, 'Las pestañas de período SIGUEN visibles para poder volver');
await page.screenshot({ path: OUT('04_periodo_vacio_dark_390') });

// Se repuebla con los 11 casos originales para las pruebas de viewport/tema/
// escritorio que siguen — necesitan un período "Todo" con datos reales.
await page.evaluate(async () => {
  function pad(n){ return String(n).padStart(2,'0'); }
  function daysAgo(n){ var d=new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function baseCase(tipo, fechaProc, conductas, barrio){
    return { id: uid(), tipo: tipo, nunc:'', spoa:'', fechaProc: fechaProc, conductas: conductas,
      articulosCP: conductas.map(function(){return '';}), elementos: [], destino:'', numIncidente:'', recibe:'',
      lugar: {depto:'Antioquia', muni:'Medellín', dir:'', barrio: barrio||'', caract:'', localidad:'', zona:'', vereda:''},
      capturados: [{priNom:'Persona', priApe:'De Prueba'}], victimas: [], testigos: [], sinVictima:true, sinTestigo:true,
      hayVehiculos:false, vehiculos: [], narracion: {texto:''}, servidor: {}, created: Date.now(), isTest: true };
  }
  var seed = [
    baseCase('URI',   daysAgo(0),  ['Hurto'], 'Boston'),
    baseCase('URI',   daysAgo(2),  ['Hurto','Lesiones personales'], 'San Benito'),
    baseCase('URI',   daysAgo(5),  ['Hurto'], 'Candelaria'),
    baseCase('URI',   daysAgo(10), ['Hurto'], 'Villanueva'),
    baseCase('URI',   daysAgo(20), ['Fabricación, tráfico y porte de armas de fuego'], 'La Candelaria'),
    baseCase('CESPA', daysAgo(3),  ['Lesiones personales'], 'Buenos Aires'),
    baseCase('CESPA', daysAgo(45), ['Concierto para delinquir'], 'El Chagualo'),
    baseCase('OJ',    daysAgo(1),  ['Falsedad en documento privado'], ''),
    baseCase('OJ',    daysAgo(60), ['Fabricación, tráfico y porte de armas de fuego'], 'Prado'),
    baseCase('OJ',    daysAgo(4),  ['Extorsión'], ''),
    baseCase('URI',   daysAgo(0),  ['Amenazas'], 'Guayaquil')
  ];
  await DB.saveCases(seed);
});
await page.evaluate(() => go('estadisticas'));
await page.click('#stats-content .stat-per .tab:has-text("Todo")');
await page.waitForTimeout(200);
log(await page.$eval('.stat-hero-num', el => el.textContent.trim()) === '11', 'Repoblado: "Todo" vuelve a ver los 11 casos de la muestra principal');

log(errors.length === 0, 'Sin errores de consola hasta aquí', errors.slice(0, 5).join(' | ') || '—');

// ═══ 7. BARRIDO DE VIEWPORTS MÓVILES (360 / 375 / 390 / 412 / 430) ═══
const widths = [360, 375, 390, 412, 430];
for (const w of widths) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(150);
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  log(noScroll, `Sin scroll horizontal a ${w}px`, await page.evaluate(() => document.documentElement.scrollWidth));
  await page.screenshot({ path: OUT(`05_viewport_${w}`) });
}
await page.setViewportSize({ width: 390, height: 844 });

// ═══ 8. TEMA CLARO ═══
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: OUT('06_todo_light_390') });
const metaLight = await page.$eval('meta[name="theme-color"]', el => el.content);
log(metaLight === '#F4F5F8', 'Tema claro aplicado (meta theme-color)', metaLight);
await page.evaluate(() => setTheme('dark'));
await page.waitForTimeout(200);

// ═══ 9. DESKTOP (≥900px): los dos rankings pasan a 2 columnas ═══
// Reutiliza la MISMA página/sesión ya sembrada (12 casos, período "Todo") en
// vez de un contexto nuevo — un contexto nuevo tendría almacenamiento propio
// y vacío, y por eso la primera versión de esta prueba fallaba: navegaba a
// Estadísticas sin un solo caso guardado.
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(350);
const gridInfo = await page.$eval('.stat-rank-2col', el => {
  const cs = getComputedStyle(el);
  return { display: cs.display, cols: cs.gridTemplateColumns.split(' ').length };
});
log(gridInfo.display === 'grid' && gridInfo.cols === 2, 'Escritorio (≥900px): los rankings pasan a grid de 2 columnas', JSON.stringify(gridInfo));
await page.screenshot({ path: OUT('07_desktop_1280') });

log(errors.length === 0, 'Sin errores de consola/página en toda la corrida móvil', errors.slice(0, 8).join(' | ') || '—');
console.log('\nResultado:', report.filter(Boolean).length + '/' + report.length, 'checks OK');
await browser.close();
server.close();
process.exit(report.every(Boolean) ? 0 : 1);
