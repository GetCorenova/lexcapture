/* Regresión del AÑO DEL NUNC (2026-08-30).

   Reportado en campo: «los SPOA o Número Único de Noticia Criminal (16 dígitos
   para capturas en flagrancia) deben actualizarse cada año como corresponda.
   Por ejemplo el 1 de enero de 2027, en el espacio de año, en TODOS los
   despachos se debe actualizar automáticamente. Esto para captura en
   flagrancia, ya que las de OJ se aplica diferente.»

   Los 4 ÚLTIMOS dígitos del NUNC son el año de la noticia criminal
   (Dpto 2 + Municipio 3 + Entidad 2 + Unidad receptora 5 + Año 4). Los doce
   primeros son fijos de la unidad —por eso el NUNC vive en el despacho—, pero
   el año cambia el 1 de enero, de golpe y en todos.

   Lo que hay que comprobar de punta a punta:
     A. El motor: qué es un año, qué se toca y qué NO se toca nunca.
     B. Que la actualización ocurre AL LEER la configuración, en un solo sitio,
        y sin forzar una escritura.
     C. El 1 de enero de verdad: con el reloj en 2027, todos los despachos
        pasan a 2027, se ve, se avisa UNA vez y se persiste.
     D. Que una captura NUEVA nace con el año en curso y una captura YA GUARDADA
        conserva el suyo aunque se reabra en enero (integridad histórica).
     E. Que una captura por ORDEN JUDICIAL no se toca: ahí el número es el
        RADICADO DEL PROCESO y su año es el del proceso.
     F. Que el año se VE (un número que cambia solo tiene que verse cambiar).
     G. Modo invitado: ni un byte en localStorage.                            */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/ae3a4aed-850d-4b7c-a99f-15e81152c8d9/scratchpad';
const PORT = 8177;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
const log = (ok, label, extra) => {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
};

const fuente = await readFile(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const ANO = new Date().getFullYear();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(700);

/* ═══ Parte A · El motor ═══════════════════════════════════════════════════ */
const M = await page.evaluate(() => {
  const n26 = '0500160008722026', n25 = '0500160008722025';
  return {
    ano:       lcNuncAno(n26),
    unidad:    lcNuncUnidad(n26),
    conAno:    lcNuncConAno(n26, 2027),
    avanza:    lcNuncVigente(n25, 2027),
    noBaja:    lcNuncVigente(n26, 2020),
    corto:     lcNuncVigente('05001600087', 2027),
    noAno:     lcNuncVigente('0500160001202601', 2027),
    vacio:     lcNuncVigente('', 2027),
    nulo:      lcNuncVigente(null, 2027),
    anoRaro:   lcNuncAno('0500160008720000')
  };
});
log(M.ano === 2026, 'El año son los 4 ÚLTIMOS dígitos', M.ano);
log(M.unidad === '050016000872', 'Y los 12 primeros son la unidad: lo estable', M.unidad);
log(M.conAno === '0500160008722027', 'Cambiar el año conserva intactos esos 12 dígitos', M.conAno);
log(M.avanza === '0500160008722027', 'Un NUNC de 2025 pasa a 2027', M.avanza);
log(M.noBaja === '0500160008722026',
  '⚠️ Pero NUNCA retrocede: un teléfono con la fecha mal puesta no puede degradar el número de todas las unidades', M.noBaja);
log(M.corto === '05001600087', 'Un NUNC a medio teclear se devuelve TAL CUAL', M.corto);
log(M.noAno === '0500160001202601',
  '⚠️ Y uno cuyos 4 últimos dígitos no son un año plausible tampoco se toca: no se reinterpreta lo que no se entiende', M.noAno);
log(M.vacio === '' && M.nulo === '', 'Vacío y nulo salen vacíos, sin fabricar nada', JSON.stringify([M.vacio, M.nulo]));
log(M.anoRaro === 0, 'Un «año» 0000 no es un año', M.anoRaro);

const S = await page.evaluate(() => {
  const cfg = {
    despachosPropios: [
      { id: 'a', clase: 'FISCALIA', nombre: 'URI Centro',  nunc: '0500160008722025' },
      { id: 'b', clase: 'CESPA',    nombre: 'CESPA',       nunc: '0500160005502024' },
      { id: 'c', clase: 'JUZGADO',  nombre: 'Juzgado 3',   nunc: '' }
    ],
    nuncUri: '0500160001112023', nuncCespa: ''
  };
  const uno = lcNuncSyncCfg(cfg, 2027);
  const dos = lcNuncSyncCfg(cfg, 2027);
  return { uno, dos, l: cfg.despachosPropios.map(d => d.nunc), legado: cfg.nuncUri };
});
log(S.uno === 3, 'Una sola pasada pone al año a TODOS los despachos y a la clave legada', S.uno + ' ajustados');
log(S.l[0] === '0500160008722027' && S.l[1] === '0500160005502027',
  'Cada uno conserva su unidad y solo cambia el año', JSON.stringify(S.l.slice(0, 2)));
log(S.l[2] === '', 'Un juzgado no tiene NUNC y no se le inventa uno', JSON.stringify(S.l[2]));
log(S.legado === '0500160001112027', 'Las claves legadas de respaldo también entran al año', S.legado);
log(S.dos === 0, 'Y es idempotente: la segunda pasada no cambia nada', S.dos + ' ajustados');

/* ═══ Parte B · Al LEER la configuración, en un solo sitio ═════════════════ */
log(/_lcNuncCambios=lcNuncSyncCfg\(out\);/.test(fuente),
  '⚠️ La actualización vive en `_cfgConDefaults`: ninguna pantalla puede discrepar sobre cuál es el número vigente');
const B = await page.evaluate(() => {
  const crudo = {
    despachosPropios: [
      { id: 'd1', clase: 'FISCALIA', tipo: 'FISCALIA', nombre: 'URI Centro', municipio: 'Medellín', nunc: '0500160008722025' },
      { id: 'd3', clase: 'CESPA', tipo: 'ADOLESCENTES', nombre: 'CESPA Medellín', municipio: 'Medellín', nunc: '0500160005502019' }
    ],
    despachoDefecto: { URI: 'd1', CESPA: 'd3' }, despachosMigrados: true
  };
  localStorage.setItem('lc_cfg', JSON.stringify(crudo));
  const leido = DB.getConfig().despachosPropios.map(d => d.nunc);
  const enDisco = JSON.parse(localStorage.getItem('lc_cfg')).despachosPropios.map(d => d.nunc);
  return { leido, enDisco, uri: lcDespNunc('URI'), cespa: lcDespNunc('CESPA') };
});
log(B.leido.every(x => x.slice(12) === String(ANO)),
  'Al leer, los despachos guardados con el año pasado salen ya con el año en curso', JSON.stringify(B.leido));
log(B.leido[0].slice(0, 12) === '050016000872' && B.leido[1].slice(0, 12) === '050016000550',
  'Sin tocar un solo dígito de la unidad receptora', JSON.stringify(B.leido.map(x => x.slice(0, 12))));
log(B.uri.slice(12) === String(ANO) && B.cespa.slice(12) === String(ANO),
  '`lcDespNunc` —el punto único— entrega el número vigente', JSON.stringify([B.uri, B.cespa]));
log(B.enDisco[0] === '0500160008722025',
  '⚠️ Y NO se fuerza ninguna escritura: lo guardado se persiste con el siguiente guardado, no al leer', B.enDisco[0]);

/* ═══ Parte C · El 1 de enero de 2027 ═════════════════════════════════════ */
await page.clock.setFixedTime(new Date('2027-01-01T09:00:00'));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(900);

const C = await page.evaluate(() => ({
  cfg: DB.getConfig().despachosPropios.map(d => d.nunc),
  disco: JSON.parse(localStorage.getItem('lc_cfg')).despachosPropios.map(d => d.nunc),
  marca: DB.getConfig().nuncAno,
  toast: (document.getElementById('toast') || {}).textContent || ''
}));
log(C.cfg.every(x => x.slice(12) === '2027'),
  '⚠️ EL 1 DE ENERO DE 2027, TODOS LOS DESPACHOS PASAN A 2027 — que es lo que pidió el reporte', JSON.stringify(C.cfg));
log(C.disco.every(x => x.slice(12) === '2027'), 'Y queda PERSISTIDO al desbloquear', JSON.stringify(C.disco));
log(C.marca === 2027, 'Con la marca del año del último ajuste guardado', C.marca);
log(/2027/.test(C.toast) && /NUNC/.test(C.toast),
  '⚠️ Se AVISA: un número que cambia solo tiene que verse cambiar', C.toast);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(900);
const C2 = await page.evaluate(() => ({
  toast: (document.getElementById('toast') || {}).textContent || '',
  n: lcNuncAvisoAno()
}));
log(!/NUNC/.test(C2.toast) && C2.n === 0,
  'El aviso sale UNA vez al año, no en cada arranque', JSON.stringify([C2.toast, C2.n]));

/* ═══ Parte D · Captura nueva vs. captura ya guardada ═════════════════════ */
await page.evaluate(async () => { wc = null; await wizCerrarBorrador(); startWizard('URI'); });
await page.waitForTimeout(500);
await page.fill('#w-muni', 'Medellín');
await page.waitForTimeout(250);
await page.evaluate(() => wizGoto(getWizConfig().steps.indexOf('Caso')));
await page.waitForTimeout(600);
const nuevoNunc = await page.inputValue('#w-nunc');
log(nuevoNunc.slice(12) === '2027' && nuevoNunc.slice(0, 12) === '050016000872',
  'Una captura NUEVA de enero nace con el NUNC de su despacho terminado en 2027', nuevoNunc);
await page.screenshot({ path: join(SHOTS, 'nunc_01_paso_caso.png') });

/* ⚠️ La otra mitad: una captura de DICIEMBRE que se abre en enero conserva su
   número. El paso se repinta y `lcDespSync` reasigna el NUNC del despacho, así
   que sin la guarda del año del procedimiento se llevaría el 2027. */
await page.evaluate(async () => {
  const cases = DB.getCases().slice();
  cases.push({
    id: 'viejo1', tipo: 'URI', fechaProc: '2026-12-28', created: new Date('2026-12-28T20:00:00').getTime(),
    nunc: '0500160008722026', destino: 'URI Centro', despachoId: 'd1',
    lugar: { muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{ priNom: 'JUAN', priApe: 'PEREZ', numDoc: '71234567', tipoDoc: 'CC' }],
    conductas: ['Hurto'], articulosCP: ['239'], victimas: [], testigos: [], elementos: []
  });
  await DB.saveCases(cases);
  wc = null; await wizCerrarBorrador();
  editCase('viejo1');
});
await page.waitForTimeout(700);
await page.evaluate(() => wizGoto(getWizConfig().steps.indexOf('Caso')));
await page.waitForTimeout(600);
const viejoNunc = await page.inputValue('#w-nunc');
log(viejoNunc === '0500160008722026',
  '⚠️ Una captura de diciembre abierta en enero CONSERVA su año: lo ya radicado no se reescribe', viejoNunc);
const modelo = await page.evaluate(() => wc.nunc);
log(modelo === '0500160008722026', 'Y el modelo del caso tampoco cambia', modelo);
const f6viejo = await page.evaluate(() => f6Nunc({ tipo: 'URI', fechaProc: '2026-12-28', nunc: '' }).digitos);
log(f6viejo.slice(12) === '2026',
  'El respaldo del registro también entra con el año del procedimiento, no con el del reloj', f6viejo);
await page.evaluate(async () => { wc = null; await wizCerrarBorrador(); go('capturas'); });
await page.waitForTimeout(300);

/* ═══ Parte E · Orden judicial: no se toca ════════════════════════════════ */
const E = await page.evaluate(() => {
  const oj = { tipo: 'OJ', ojv: 2, oj: { proceso: { radicado: '05001600087220190012345' } } };
  const cfg = { despachosPropios: [], nuncUri: '' };
  return { rad: f6Nunc(oj).digitos, fuente: f6Nunc(oj).fuente, tocado: lcNuncSyncCfg(cfg, 2027) };
});
log(E.rad === '05001600087220190012345' && E.fuente === 'RADICADO',
  '⚠️ En una captura por orden judicial el número es el RADICADO DEL PROCESO y sale intacto — su año es el del proceso', E.rad);
const cuerpoSync = fuente.slice(fuente.indexOf('function lcNuncSyncCfg('), fuente.indexOf('function lcNuncAvisoAno('));
log(!/radicado|proceso/i.test(cuerpoSync),
  'La sincronización anual no conoce el radicado: la separación es estructural, no una condición');
log(/SOLO APLICA A FLAGRANCIA/.test(fuente), 'Y queda escrito en el código por qué');

/* ═══ Parte F · El año se VE ══════════════════════════════════════════════ */
await page.evaluate(() => go('despachos'));
await page.waitForTimeout(500);
const anoVisible = await page.$$eval('#desp-list .desp-nunc .nunc-ano', els => els.map(e => e.textContent));
log(anoVisible.length === 2 && anoVisible.every(x => x === '2027'),
  'La tarjeta del despacho marca el año, para poder comprobar de un vistazo que está al día', JSON.stringify(anoVisible));
const tit = await page.getAttribute('#desp-list .nunc-ano', 'title');
log(/1 de enero/.test(tit || ''), 'Y dice por qué está marcado', tit);
await page.screenshot({ path: join(SHOTS, 'nunc_02_despachos.png') });

const iEd = await page.$$eval('#desp-list .desp-card .desp-nombre',
  els => els.findIndex(e => /URI Centro/.test(e.textContent)) + 1);
await page.click(`#desp-list .desp-card:nth-child(${iEd}) .desp-act`);
await page.waitForTimeout(400);
const pista = await page.textContent('#dp-nunc-box');
log(/4 últimos son el año/.test(pista) && /1 de enero/.test(pista),
  'El formulario del despacho explica que el año se actualiza solo', pista.replace(/\s+/g, ' ').trim().slice(0, 120));
await page.click('button[onclick="closeModal()"]');
await page.waitForTimeout(300);

/* ═══ Parte G · Modo invitado: ni un byte ═════════════════════════════════ */
const huella = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, (localStorage.getItem(k) || '').length])));
const h1 = await huella();
await page.evaluate(() => { _guest = true; _guestCfg = _cfgConDefaults({ despachosPropios: [{ id: 'g', clase: 'FISCALIA', nombre: 'X', nunc: '0500160008722020' }] }); });
const G = await page.evaluate(() => ({ nunc: DB.getConfig().despachosPropios[0].nunc, aviso: lcNuncAvisoAno() }));
const h2 = await huella();
log(G.nunc.slice(12) === '2027', 'El invitado también ve el número vigente (su configuración vive en memoria)', G.nunc);
log(h1 === h2, '⚠️ Y no se escribe un byte en localStorage', h1 === h2 ? 'huella idéntica' : 'CAMBIÓ');
await page.evaluate(() => { _guest = false; });

/* ═══ Parte H · El simulador arma el NUNC con su estructura ═══════════════ */
const H = await page.evaluate(() => ({ inv: SIM.rNunc(''), respeta: SIM.rNunc('0500160008722021') }));
log(H.inv.length === 16 && H.inv.slice(12) === '2027',
  'El NUNC inventado del simulador lleva el año AL FINAL, como el real', H.inv);
log(H.respeta === '0500160008722021', 'Y respeta el que ya venga del registro', H.respeta);

/* ═══ Parte I · Consola limpia ════════════════════════════════════════════ */
log(consoleErrors.length === 0, 'Cero errores de consola en todo el recorrido',
  consoleErrors.slice(0, 3).join(' | ') || 'ninguno');

console.log(`\n${fails === 0 ? '✅ TODO EN VERDE' : '❌ ' + fails + ' FALLOS'} — ${n - fails}/${n}`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
