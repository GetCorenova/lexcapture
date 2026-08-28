/* Regresión de LA JURISDICCIÓN (2026-08-28).

   Reportado en campo: el wizard de flagrancia preguntaba primero el despacho y
   después dónde había ocurrido el hecho, así que el despacho solo se podía
   proponer a ciegas. Ahora el lugar abre el formulario, el municipio devuelve
   solo el departamento, y de ese municipio sale la fiscalía/URI (o el CESPA)
   que recibe la captura. Lo que hay que comprobar de punta a punta:

   1. Que el LUGAR sea el paso 1 y los datos del caso el paso 2, en los tres
      flujos que usan este wizard (URI, CESPA y las capturas OJ del formato
      anterior), y que eso NO cambie ni un dato del modelo ni del documento.
   2. Que el municipio se pida primero y el departamento se devuelva solo, con
      el catálogo completo del país detrás.
   3. Que un homónimo NO se adivine: se ofrecen sus departamentos y lo elegido
      se aprende.
   4. Que el despacho se resuelva por jurisdicción: único ⇒ sin preguntar;
      predeterminado ⇒ sin preguntar; varios ⇒ se pregunta y no se deja avanzar;
      ninguno ⇒ se ofrece registrarlo, ya con el municipio puesto.
   5. Que el NUNC viaje con el despacho que la jurisdicción resuelve.
   6. Que escribir el destino a mano siga siendo posible y que la app deje de
      proponer cuando el usuario lo hace.
   7. Que cambiar de tipo (URI ⇄ CESPA) no arrastre el despacho del otro.
   8. Que nada de esto altere el FPJ-5: mismo modelo, mismas celdas. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8171;
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
const sec = t => console.log('\n─── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const fuente = await readFile(join(ROOT, 'LexCapture_v8.html'), 'utf8');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
page.on('dialog', d => d.accept());

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(700);

const modelo = () => page.evaluate(() => JSON.parse(JSON.stringify(wc)));
/* ⚠️ El wizard autoguarda un borrador (Ola 1) y `startWizard` pregunta antes de
   pisarlo. En una suite que abre el wizard una y otra vez eso deja un modal
   delante del formulario, así que se descarta antes de cada arranque. */
const nuevaCaptura = async (tipo) => {
  await page.evaluate(async (t) => { wc = null; await wizCerrarBorrador(); startWizard(t); }, tipo);
  await page.waitForTimeout(400);
};
const sembrar = (lista, defecto) => page.evaluate(({ lista, defecto }) => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = lista;
  cfg.despachoDefecto = defecto || {};
  DB.saveConfig(cfg);
}, { lista, defecto });

/* ═══ A · El orden de los pasos ════════════════════════════════════════════ */
sec('A — el lugar abre el formulario');
const pasos = await page.evaluate(() => {
  const out = {};
  ['URI', 'CESPA'].forEach(t => { wc = { tipo: t }; out[t] = getWizConfig().steps.slice(); });
  wc = { tipo: 'OJ' }; out.OJlegado = getWizConfig().steps.slice();
  wc = null;
  return out;
});
log(pasos.URI[0] === 'Lugar' && pasos.URI[1] === 'Caso',
  'URI: paso 1 = Lugar, paso 2 = Caso', pasos.URI.slice(0, 3).join(' · '));
log(pasos.CESPA[0] === 'Lugar' && pasos.CESPA[1] === 'Caso' && pasos.CESPA[2] === 'Aprehendidos',
  'CESPA hace lo mismo y conserva su terminología de menores', pasos.CESPA.slice(0, 3).join(' · '));
log(pasos.OJlegado[0] === 'Lugar' && pasos.OJlegado[1] === 'Caso',
  'Y las capturas OJ del formato anterior, que comparten este wizard', pasos.OJlegado.slice(0, 3).join(' · '));
log(pasos.URI.length === 9 && pasos.OJlegado.length === 7,
  '⚠️ No se añadió ni se quitó ningún paso: solo cambió el orden', pasos.URI.length + ' / ' + pasos.OJlegado.length);
// El orden de EMP y EF respecto de testigos y vehículos es el del formato.
log(pasos.URI.indexOf('EMP y EF') === pasos.URI.indexOf('Testigos') + 1 &&
    pasos.URI.indexOf('Vehículos') === pasos.URI.indexOf('EMP y EF') + 1,
  'El numeral 7 sigue entre testigos y vehículos, como en el formato');
/* ⚠️ La recolección NO puede depender del índice: `ws===0` dejó de ser «Caso». */
log(!/if\(ws===0\)\{\s*\r?\n?\s*wc\.tipo=v\('w-tipo'\)/.test(fuente) &&
    /if\(stepName==='Caso'\)\{/.test(fuente),
  '⚠️ collectStep recolecta por NOMBRE de paso, no por índice');

await nuevaCaptura('URI');
log(await page.isVisible('#w-muni'), 'Al abrir una captura nueva, lo primero en pantalla es el lugar');
log(!(await page.isVisible('#w-nunc').catch(() => false)), 'Los datos del caso todavía no se piden');
const lbl = await page.textContent('#wz-prog .wz-lbl');
log(/Paso 1 de 9: *Lugar/.test(lbl.replace(/\s+/g, ' ')), 'Y el rótulo lo dice', lbl.replace(/\s+/g, ' ').trim());

/* ═══ B · Municipio ⇒ departamento, con el país entero detrás ══════════════ */
sec('B — catálogo geográfico completo');
const geo = await page.evaluate(() => ({
  deptos: lcGeoDeptoLista().length,
  municipios: Object.keys(LC_GEO).length,
  medellin: lcGeoDepto('Medellín'),
  // Municipios que NO estaban en la tabla corta de la Ola 2:
  chia: lcGeoDepto('Chía'),
  turbo: lcGeoDepto('Apartadó'),
  soacha: lcGeoDepto('Soacha'),
  malambo: lcGeoDepto('Malambo'),
  pitalito: lcGeoDepto('Pitalito'),
  inventado: lcGeoDepto('Municipio Inventado'),
  homonimo: lcGeoDepto('Barbosa'),
  homDeptos: lcGeoDeptos('Barbosa'),
  homCuatro: lcGeoDeptos('La Unión').length
}));
log(geo.deptos === 33, 'El catálogo trae los 32 departamentos + Bogotá D.C.', geo.deptos);
log(geo.municipios > 1000, 'Y más de mil municipios', geo.municipios + ' municipios');
log(geo.chia === 'Cundinamarca' && geo.soacha === 'Cundinamarca' && geo.malambo === 'Atlántico' &&
    geo.pitalito === 'Huila' && geo.turbo === 'Antioquia',
  'Municipios que la tabla corta anterior no conocía, resueltos',
  [geo.chia, geo.malambo, geo.pitalito].join(' · '));
log(geo.medellin === 'Antioquia', 'Y lo que ya funcionaba sigue igual', geo.medellin);
log(geo.inventado === '', '⚠️ Lo que no está en el catálogo NO se inventa', '"' + geo.inventado + '"');
log(geo.homonimo === '' && geo.homDeptos.length === 2 && geo.homCuatro === 4,
  '⚠️ Un homónimo no se adivina, pero la app SÍ sabe cuáles son sus departamentos',
  'Barbosa → ' + geo.homDeptos.join(' / '));

// En el formulario: escribir el municipio devuelve el departamento.
await page.fill('#w-muni', 'Pitalito');
await page.waitForTimeout(250);
log(await page.inputValue('#w-depto') === 'Huila',
  'Escribir el municipio devuelve el departamento sin tocar nada', await page.inputValue('#w-depto'));
const orden = await page.evaluate(() => {
  const ids = Array.from(document.querySelectorAll('#wz-panels .fi')).map(e => e.id);
  return { muni: ids.indexOf('w-muni'), dep: ids.indexOf('w-depto') };
});
log(orden.muni >= 0 && orden.muni < orden.dep, 'El municipio se pide ANTES que el departamento',
  'municipio en ' + orden.muni + ', departamento en ' + orden.dep);
log(!/value="'\+\(l\.depto\|\|'Antioquia'\)\+'"/.test(fuente) && !/l\.muni\|\|'Medellín'/.test(fuente),
  '⚠️ Ninguno de los dos nace ya escrito con un valor de fábrica');

// Homónimo: se ofrece, no se adivina.
await page.fill('#w-muni', 'Barbosa');
await page.waitForTimeout(250);
log(await page.inputValue('#w-depto') === 'Huila',
  'Con un homónimo la app no pisa lo que ya había (solo se pisa a sí misma)');
await page.evaluate(() => { document.getElementById('w-depto').value = ''; lcGeoHomonimos(); });
await page.waitForTimeout(150);
const opsHom = await page.$$eval('#w-geo-hom .lc-geo-op', els => els.map(e => e.textContent.trim()));
log(opsHom.length === 2 && opsHom.includes('Antioquia') && opsHom.includes('Santander'),
  'Se ofrecen sus dos departamentos en un toque', opsHom.join(' / '));
await page.locator('#w-geo-hom .lc-geo-op', { hasText: 'Antioquia' }).first().click();
await page.waitForTimeout(250);
log(await page.inputValue('#w-depto') === 'Antioquia', 'Elegir uno lo escribe en el campo');
log(await page.evaluate(() => lcGeoDepto('Barbosa')) === 'Antioquia',
  '⚠️ Y se APRENDE: a esta jurisdicción no se le vuelve a preguntar');
log(await page.$$eval('#w-geo-hom .lc-geo-op', e => e.length) === 0,
  'Resuelto el homónimo, el aviso desaparece');

/* ═══ C · Jurisdicción con UN despacho ═════════════════════════════════════ */
sec('C — un solo despacho en la jurisdicción');
await sembrar([
  { id: 'm1', clase: 'FISCALIA', nombre: 'URI Medellín', municipio: 'Medellín', nunc: '0500160001202601' },
  { id: 'b1', clase: 'FISCALIA', nombre: 'URI Bogotá Puente Aranda', municipio: 'Bogotá D.C.', nunc: '1100160002202602' },
  { id: 'b2', clase: 'FISCALIA', nombre: 'URI Bogotá Kennedy', municipio: 'Bogotá D.C.', nunc: '1100160003202603' },
  { id: 'c1', clase: 'CESPA', nombre: 'CESPA Medellín', municipio: 'Medellín', nunc: '0500160055202604' }
], {});
await nuevaCaptura('URI');
await page.fill('#w-muni', 'Medellín');
await page.waitForTimeout(250);
await page.evaluate(() => wizNext());
await page.waitForTimeout(400);
log(await page.isVisible('#w-nunc'), 'El paso 2 es «Datos del caso»');
let blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
log(/Fiscalía \/ URI que recibe la captura/.test(blk),
  'Y lo primero que aparece es la fiscalía/URI que recibe', blk.slice(0, 60));
log(/Jurisdicción del hecho: Medellín, Antioquia/.test(blk),
  'Nombrando la jurisdicción de la que sale');
log(/URI Medellín/.test(blk) && /Único registrado en Medellín/.test(blk),
  '⚠️ Con uno solo en el municipio NO se pregunta: se resuelve y se dice por qué', blk.slice(0, 120));
log(await page.inputValue('#w-nunc') === '0500160001202601',
  '⚠️ Y el NUNC viaja con él', await page.inputValue('#w-nunc'));
let m = await modelo();
log(m.destino === 'URI Medellín' && m.despachoId === 'm1',
  'El caso se queda con el despacho y su nombre', JSON.stringify([m.destino, m.despachoId]));

/* ═══ D · Cambiar el municipio cambia el despacho ══════════════════════════ */
sec('D — cambiar de jurisdicción cambia el despacho');
await page.evaluate(() => wizGoto(0));
await page.waitForTimeout(300);
await page.fill('#w-muni', 'Bogotá D.C.');
await page.waitForTimeout(300);
await page.evaluate(() => wizNext());
await page.waitForTimeout(400);
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
const ops = await page.$$eval('.lc-desp-op .oj-dest-nom', els => els.map(e => e.textContent.trim()));
log(/Hay 2 despachos de este tipo en Bogotá D\.C\./.test(blk),
  '⚠️ Con más de uno en la jurisdicción se PREGUNTA', blk.slice(0, 90));
log(ops.length === 2 && ops.includes('URI Bogotá Kennedy'),
  'Y se muestra la lista de los que hay allí, no la de todo el registro', ops.join(' / '));
log(!ops.includes('URI Medellín'), 'La URI de otro municipio no se ofrece como si fuera de este');
log(/Jurisdicción del hecho: Bogotá D.C.[^,]/.test(blk),
  'Bogotá no sale dos veces: donde el municipio ES el departamento se nombra una sola vez');
log(/El NUNC que hay abajo es el de .?URI Medellín.?, de otra jurisdicción/.test(blk),
  '⚠️ Y se avisa de que el NUNC que quedó es el de la jurisdicción anterior: no se borra, se dice de quién es');
// No se deja avanzar sin elegir.
const avance = await page.evaluate(() => { const antes = ws; wizNext(); return { antes, ahora: ws }; });
log(avance.antes === avance.ahora,
  '⚠️ Y no se avanza sin elegir: de ese despacho sale el NUNC del FPJ-5', 'ws ' + avance.ahora);
await page.locator('.lc-desp-op').nth(1).click();
await page.waitForTimeout(450);
m = await modelo();
log(m.despachoId === 'b2' && m.nunc === '1100160003202603',
  'Al elegir, entran el despacho Y su NUNC', JSON.stringify([m.destino, m.nunc]));
log(await page.evaluate(() => { const a = ws; wizNext(); const b = ws; wizGoto(1); return b > a; }),
  'Elegido, ya se avanza');
await page.waitForTimeout(300);

/* ═══ E · El predeterminado evita la pregunta ══════════════════════════════ */
sec('E — el predeterminado, que es lo que pidió el reporte');
await page.evaluate(() => { const c = DB.getConfig(); c.despachoDefecto = { URI: 'b1' }; DB.saveConfig(c); });
await nuevaCaptura('URI');
await page.fill('#w-muni', 'Bogotá D.C.');
await page.waitForTimeout(250);
await page.evaluate(() => wizNext());
await page.waitForTimeout(400);
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
log(/URI Bogotá Puente Aranda/.test(blk) && /Predeterminado para flagrancia/.test(blk),
  '⚠️ Marcado un predeterminado, con dos en la jurisdicción ya NO se pregunta', blk.slice(0, 110));
log(await page.inputValue('#w-nunc') === '1100160002202602', 'Con su NUNC');
log(await page.$$eval('.lc-desp-op', e => e.length) === 0, 'La lista de elección desaparece');
log(await page.isVisible('.lc-desp-pie button[onclick="abrirSelectorDespacho()"]'),
  'Pero se puede elegir otro: la app propone, no impone');
// El predeterminado NO se cuela en otra jurisdicción.
await page.evaluate(() => wizGoto(0));
await page.waitForTimeout(250);
await page.fill('#w-muni', 'Medellín');
await page.waitForTimeout(250);
await page.evaluate(() => wizNext());
await page.waitForTimeout(400);
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
log(/URI Medellín/.test(blk) && !/Puente Aranda/.test(blk),
  '⚠️ El predeterminado de Bogotá no se aplica a una captura de Medellín', blk.slice(0, 90));

/* ═══ F · Jurisdicción sin despacho registrado ═════════════════════════════ */
sec('F — no hay ninguno registrado ahí');
await page.evaluate(() => wizGoto(0));
await page.waitForTimeout(250);
await page.fill('#w-muni', 'Cartago');
await page.waitForTimeout(300);
log(await page.inputValue('#w-depto') === 'Valle del Cauca', 'Departamento resuelto solo');
await page.evaluate(() => wizNext());
await page.waitForTimeout(400);
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
log(/No tienes registrado ningún despacho de este tipo en Cartago/.test(blk),
  '⚠️ Se dice claramente, en vez de proponer el de otra ciudad', blk.slice(0, 100));
log(await page.isVisible('button[onclick="lcDespAgregarParaCaso()"]'),
  'Y se ofrece registrarlo sin salir del procedimiento');
await page.click('.lc-desp-blk button.bp[onclick="lcDespAgregarParaCaso()"]');
await page.waitForTimeout(450);
const pre = await page.evaluate(() => ({
  mun: (document.getElementById('dp-mun') || {}).value,
  dep: (document.getElementById('dp-dep') || {}).value,
  clase: (document.getElementById('dp-clase') || {}).value,
  nunc: !!document.getElementById('dp-nunc')
}));
log(pre.mun === 'Cartago' && pre.dep === 'Valle del Cauca',
  '⚠️ El alta llega con el municipio y el departamento del hecho ya puestos', JSON.stringify(pre));
log(pre.clase === 'FISCALIA' && pre.nunc, 'Y con la clase que corresponde al tipo de captura, con su NUNC');
await page.fill('#dp-nom', 'URI Cartago');
await page.fill('#dp-nunc', '7614760007202607');
await page.click('button[onclick="lcDespGuardarForm()"]');
await page.waitForTimeout(700);
m = await modelo();
const guardados = await page.evaluate(() => DB.getConfig().despachosPropios.map(d => d.nombre));
log(guardados.includes('URI Cartago'), '⚠️ Queda GUARDADO en el registro para siempre', guardados.length + ' despachos');
log(m.destino === 'URI Cartago' && m.nunc === '7614760007202607',
  'Y se asigna de una vez a la captura que se está diligenciando', JSON.stringify([m.destino, m.nunc]));
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
log(/URI Cartago/.test(blk) && !/No tienes registrado/.test(blk), 'El bloque ya lo muestra resuelto');

/* ═══ G · CESPA y escritura a mano ═════════════════════════════════════════ */
sec('G — menores, y el destino escrito a mano');
await nuevaCaptura('URI');
await page.fill('#w-muni', 'Medellín');
await page.waitForTimeout(250);
await page.evaluate(() => wizNext());
await page.waitForTimeout(400);
await page.selectOption('#w-tipo', 'CESPA');
await page.waitForTimeout(500);
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
m = await modelo();
log(/CESPA que recibe la aprehensión/.test(blk) && /CESPA Medellín/.test(blk),
  '⚠️ Con un menor se propone el CESPA de la jurisdicción, no la URI de adultos', blk.slice(0, 90));
log(m.despachoId === 'c1' && m.nunc === '0500160055202604',
  'Cambiar de tipo no arrastra el despacho del otro', JSON.stringify([m.destino, m.nunc]));
await page.selectOption('#w-tipo', 'URI');
await page.waitForTimeout(500);
// Escribir a mano
await page.evaluate(() => lcDestEditar(true));
await page.waitForTimeout(300);
log(await page.isVisible('#w-dest'), 'El destino se puede escribir a mano cuando no está registrado');
await page.evaluate(() => { document.getElementById('w-dest').value = 'Fiscalía 33 Seccional'; lcDestEditar(false); });
await page.waitForTimeout(400);
m = await modelo();
blk = (await page.textContent('.lc-desp-blk')).replace(/\s+/g, ' ').trim();
log(m.destino === 'Fiscalía 33 Seccional' && m.destinoManual === true,
  '⚠️ Lo escrito a mano se conserva y la app deja de proponer', JSON.stringify([m.destino, m.destinoManual]));
log(/Escrito a mano/.test(blk), 'Y lo dice, para que no parezca que la app se equivocó');
await page.evaluate(() => { wizGoto(0); });
await page.waitForTimeout(250);
await page.fill('#w-muni', 'Bogotá D.C.');
await page.waitForTimeout(300);
await page.evaluate(() => wizGoto(1));
await page.waitForTimeout(400);
m = await modelo();
log(m.destino === 'Fiscalía 33 Seccional',
  '⚠️ Ni siquiera cambiar de jurisdicción le pisa lo que escribió el usuario', m.destino);

/* ═══ G2 · Una captura ya guardada no cambia de destino sola ══════════════ */
sec('G2 — no se reescribe lo ya emitido');
const reabierto = await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'x1', clase: 'FISCALIA', nombre: 'URI Medellín', municipio: 'Medellín', nunc: '0500160001202601' }];
  cfg.despachoDefecto = {}; DB.saveConfig(cfg);
  const viejo = { id: 'viejo1', tipo: 'URI', created: Date.now(), nunc: '9988776655443322',
    destino: 'Fiscalía 12 de Ipiales', conductas: ['Hurto'], articulosCP: ['Art. 239'], elementos: [],
    lugar: { depto: 'Antioquia', muni: 'Medellín', dir: 'CL 1', barrio: '', caract: '', localidad: '10', zona: 'Urbana', vereda: 'N/A' },
    capturados: [{ id: 'p9', tipoDoc: 'CC', numDoc: '1', priNom: 'ANA', priApe: 'GIL' }], victimas: [], testigos: [],
    narracion: { texto: '', emp: '' } };
  await DB.saveCase(viejo);
  wc = null; await wizCerrarBorrador(); editCase('viejo1');
  ws = getWizConfig().steps.indexOf('Caso'); renderWiz();
  return { destino: wc.destino, nunc: wc.nunc, manual: wc.destinoManual,
    bloque: (document.querySelector('.lc-desp-blk') || {}).textContent || '' };
});
log(reabierto.destino === 'Fiscalía 12 de Ipiales' && reabierto.nunc === '9988776655443322',
  '⚠️ Reabrir una captura guardada NO le cambia el despacho ni el NUNC con los que se emitió',
  JSON.stringify([reabierto.destino, reabierto.nunc]));
log(reabierto.manual === true && /Escrito a mano/.test(reabierto.bloque),
  'Y se dice que ese destino no viene del registro, en vez de proponer otro por debajo');
const reAtado = await page.evaluate(async () => {
  const c = DB.getCase('viejo1'); c.destino = 'URI Medellín'; delete c.despachoId; delete c.destinoManual;
  await DB.saveCase(c);
  wc = null; await wizCerrarBorrador(); editCase('viejo1');
  return { id: wc.despachoId, elegido: wc.despachoElegido, manual: wc.destinoManual };
});
log(reAtado.id === 'x1' && reAtado.elegido === true && reAtado.manual === false,
  'Si su destino SÍ está en el registro, se ata a él y se puede cambiar con un toque', JSON.stringify(reAtado));

/* ═══ H · Nada de esto toca el documento ═══════════════════════════════════ */
sec('H — el FPJ-5 no se entera');
const doc = await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'm1', clase: 'FISCALIA', nombre: 'URI Medellín', municipio: 'Medellín', nunc: '0500160001202601' }];
  cfg.despachoDefecto = {};
  DB.saveConfig(cfg);
  wc = null; await wizCerrarBorrador(); startWizard('URI');
  wc.lugar = { depto: 'Antioquia', muni: 'Medellín', dir: 'CL 52 # 50-31', barrio: 'Prado', caract: '', localidad: '10', zona: 'Urbana', vereda: 'N/A' };
  lcDespSync(wc);
  wc.conductas = ['Hurto calificado']; wc.articulosCP = ['Art. 240'];
  wc.capturados = [{ id: 'p1', tipoDoc: 'CC', numDoc: '71234567', priNom: 'JUAN', priApe: 'PEREZ', sexo: 'M' }];
  wc.narracion.texto = 'Relato de prueba.';
  wc.narracion.horaCapH = '14'; wc.narracion.horaCapM = '30';
  const out = await buildFPJBlob(wc);
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  return { ok: !!out.blob, bytes: buf.length, nombre: out.fname, claves: Object.keys(wc).length };
});
log(doc.ok && doc.bytes > 100000, 'El FPJ-5 se genera igual que siempre', Math.round(doc.bytes / 1024) + ' KB');
log(/\.docx$/.test(doc.nombre), 'Con su nombre de archivo de siempre', doc.nombre);
const campos = await page.evaluate(() => ({
  tieneLugar: !!(wc.lugar && wc.lugar.muni), tieneDestino: !!wc.destino, tieneNunc: (wc.nunc || '').length === 16,
  nuevos: ['despachoId', 'despachoElegido', 'destinoManual'].filter(k => k in wc)
}));
log(campos.tieneLugar && campos.tieneDestino && campos.tieneNunc,
  '⚠️ El modelo del caso es el mismo: lugar, destino y NUNC en sus claves de siempre');
log(campos.nuevos.length === 3,
  'Lo único añadido son tres claves de trabajo del formulario, que ningún documento lee',
  campos.nuevos.join(', '));
log(!/despachoId|despachoElegido|destinoManual/.test(
  fuente.slice(fuente.indexOf('async function buildFPJBlob'), fuente.indexOf('async function buildFPJBlob') + 40000)),
  '⚠️ Comprobado sobre el código: el motor del FPJ-5 no las menciona');

const limpio = await page.evaluate(() => {
  const malos = Object.keys(LC_GEO).filter(m => /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ .,'-]/.test(m));
  return { malos: malos.slice(0, 5), n: malos.length };
});
log(limpio.n === 0, '⚠️ Ningún nombre del catálogo trae caracteres que no sean de un topónimo', limpio.malos.join(' / ') || 'ninguno');
const ojPasos = await page.evaluate(() => { wc = ojNuevoCaso(); const p = getWizConfig().steps.slice(); wc = null; return p; });
log(ojPasos[0] === 'El capturado' && ojPasos.length === 4,
  '⚠️ El módulo de orden judicial v2 tiene su propio wizard y NO se tocó', ojPasos.join(' · '));

/* ═══ I · Consola limpia ═══════════════════════════════════════════════════ */
sec('I — consola');
const ruido = consoleErrors.filter(e => !/favicon|manifest|sw\.js/i.test(e));
log(ruido.length === 0, 'Sin errores de consola', ruido.slice(0, 3).join(' | ') || 'ninguno');

console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n}/${n} comprobaciones en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
