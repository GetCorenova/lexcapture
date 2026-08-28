/* Regresión del MÓDULO DESPACHOS.

   La pantalla traía quince fiscalías y juzgados de Medellín con su dirección
   ESCRITA EN EL CÓDIGO, y el usuario lo señaló: la app no consulta ningún
   directorio judicial ni puede verificar una dirección, así que ese listado se
   presentaba como comprobado sin serlo. Ahora el registro es del usuario. Lo que
   hay que comprobar de punta a punta:

   1. Que la lista de Medellín NO exista en ninguna forma (ni la constante, ni la
      pestaña de favoritos, ni la clave `despachosFavoritos`).
   2. Que el usuario pueda agregar, editar y eliminar sus despachos, con nombre,
      dirección, barrio y ciudad, y que se persistan.
   3. Que el NUNC viva EN EL DESPACHO y solo se le pida a quien lo asigna: un
      juzgado no recibe noticia criminal.
   4. Que el registro sea UNO SOLO: lo que se agrega aquí lo ve el módulo de
      orden judicial, y lo que se diligencia allí aparece aquí.
   5. Que el módulo de capturas vaya de la mano: al cambiar el despacho destino
      CAMBIA el NUNC, y el predeterminado precarga los dos al abrir una captura.
   6. Que retirar los cuatro campos de Ajustes no BORRE su configuración: `v()`
      devuelve '' para un elemento inexistente y eso ya se ha pagado antes.
   7. Que la semilla de migración no invente despachos en un equipo recién
      instalado (el error de 'CANDELARIA' en `nombreEstacion`).
   8. Que en modo invitado no se escriba un byte. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/2bc1bb3b-2014-47e2-9d3d-f1ecbf0b9b3c/scratchpad';
const PORT = 8163;
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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
page.on('dialog', d => d.accept());          // los confirm() de eliminar

const despachos = () => page.evaluate(() => (DB.getConfig().despachosPropios || []));
/* ⚠️ La lista se alfabetiza: identificar una tarjeta por su posición hace que la
   prueba edite o borre otra. Se busca por nombre. */
const idxTarjeta = async (nom) => (await page.$$eval('#desp-list .desp-card .desp-nombre',
  (els, nom) => els.findIndex(e => e.textContent.trim().indexOf(nom) === 0) + 1, nom));
const tarjetas  = () => page.$$eval('#desp-list .desp-card .desp-nombre', els => els.map(e => e.textContent.trim()));

/* ═══ Parte A · La lista de Medellín ya no existe ═══════════════════════════ */
log(!/DESPACHOS_MEDELLIN\s*=/.test(fuente), 'La constante DESPACHOS_MEDELLIN no está definida en el archivo');
log(!/URI Centro — Sede Caribe|Palacio de Justicia, Cll 44/.test(fuente),
  'Ni una sola dirección de despacho escrita en el código');
log(!/function toggleFavorito/.test(fuente), 'El mecanismo de favoritos se retiró (la marca útil es el predeterminado)');
log(/_CFG_MUERTAS=\['despachosFavoritos'/.test(fuente),
  'Y `despachosFavoritos` queda declarada muerta: se purga al leer la configuración');

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(700);

/* ═══ Parte B · Equipo recién instalado: la pantalla arranca VACÍA ══════════ */
await page.evaluate(() => go('despachos'));
await page.waitForTimeout(400);
log((await despachos()).length === 0,
  'Un equipo recién instalado NO tiene despachos inventados: la semilla solo migra lo que el usuario escribió');
log(await page.isVisible('.desp-vacio'), 'Se ve el estado vacío, que explica para qué sirve la pantalla');
log((await page.isHidden('#desp-search')) && (await page.isHidden('#desp-tabs')),
  'Sin nada registrado, el buscador y las pestañas no piden una consulta imposible');
const vacioTxt = await page.textContent('.desp-vacio');
log(/NUNC de 16 dígitos/.test(vacioTxt), 'Y avisa de que el NUNC viaja con el despacho', 'texto del estado vacío');
await page.screenshot({ path: join(SHOTS, 'desp_01_vacio.png') });

/* ═══ Parte C · Alta: nombre, dirección, barrio y ciudad ═══════════════════ */
async function abrirNuevo() {
  await page.click('.desp-vacio .btn');
  await page.waitForTimeout(400);
}
await abrirNuevo();
log(await page.isVisible('#dp-nom'), 'El formulario de alta se abre en un modal');
log(await page.isVisible('#dp-dir__via'), 'La dirección usa el MISMO widget guiado que el resto de la app');
log(await page.isVisible('#dp-nunc'), 'Una fiscalía SÍ tiene casilla de NUNC');

await page.fill('#dp-nom', 'URI Centro');
await page.selectOption('#dp-dir__via', 'KR');
await page.fill('#dp-dir__num', '56');
await page.fill('#dp-dir__cruce', '42');
await page.fill('#dp-dir__placa', '70');
await page.fill('#dp-bar', 'Boston');
await page.fill('#dp-mun', 'Medellín');
await page.fill('#dp-tel', '(604) 444 0000');
await page.fill('#dp-nunc', '0500160001202601');
await page.waitForTimeout(250);
const deptoAuto = await page.inputValue('#dp-dep');
log(deptoAuto === 'Antioquia', 'El departamento se infiere de la ciudad, como en el resto de la app', deptoAuto);
await page.click('button[onclick="lcDespGuardarForm()"]');
await page.waitForTimeout(500);

let l = await despachos();
log(l.length === 1 && l[0].nombre === 'URI Centro', 'El despacho queda guardado', JSON.stringify(l[0] && l[0].nombre));
log(l[0].direccion === 'KR 56 # 42-70' && l[0].barrio === 'Boston' && l[0].municipio === 'Medellín',
  'Con su dirección, barrio y ciudad', JSON.stringify([l[0].direccion, l[0].barrio, l[0].municipio]));
log(l[0].nunc === '0500160001202601', 'Y con SU NUNC de 16 dígitos', l[0].nunc);
log(l[0].clase === 'FISCALIA' && l[0].tipo === 'FISCALIA',
  'La clase se guarda y el `tipo` del módulo de orden judicial se sincroniza', JSON.stringify([l[0].clase, l[0].tipo]));

const card = await page.textContent('#desp-list .desp-card');
log(/KR 56 # 42-70, barrio Boston, Medellín/.test(card),
  'La tarjeta compone la dirección completa sin repetir lo que ya diga', card.replace(/\s+/g, ' ').slice(0, 90));
log(/PREDETERMINADO/.test(card), 'El primero de su clase queda predeterminado: si es el único, no hay elección');
log((await page.isHidden('#desp-search')) === false, 'Con despachos registrados vuelve el buscador');
await page.screenshot({ path: join(SHOTS, 'desp_02_lista.png') });

/* ═══ Parte D · Un juzgado NO tiene NUNC ══════════════════════════════════ */
await page.click('#desp-add');
await page.waitForTimeout(350);
await page.selectOption('#dp-clase', 'JUZGADO');
await page.waitForTimeout(250);
log((await page.$('#dp-nunc')) === null, 'Al elegir «Juzgado» la casilla de NUNC desaparece');
log(/no asigna NUNC/.test(await page.textContent('#dp-nunc-box')),
  'Y se explica por qué, en vez de dejar un hueco sin motivo');
// El repintado es solo de esa casilla: lo tecleado antes tiene que seguir ahí.
await page.fill('#dp-nom', 'Juzgado 3 Penal Municipal');
await page.selectOption('#dp-clase', 'FISCALIA');
await page.waitForTimeout(200);
log((await page.inputValue('#dp-nom')) === 'Juzgado 3 Penal Municipal',
  'Cambiar de tipo repinta SOLO la casilla del NUNC: no borra lo que se está escribiendo');
await page.selectOption('#dp-clase', 'JUZGADO');
await page.waitForTimeout(200);
await page.fill('#dp-mun', 'Medellín');
await page.click('button[onclick="lcDespGuardarForm()"]');
await page.waitForTimeout(500);
l = await despachos();
const juz = l.find(d => d.clase === 'JUZGADO');
log(!!juz && juz.nunc === '', 'El juzgado se guarda sin NUNC', JSON.stringify(juz && juz.nunc));

/* ═══ Parte E · Editar y eliminar ═════════════════════════════════════════ */
const iUri = await idxTarjeta('URI Centro');
await page.click(`#desp-list .desp-card:nth-child(${iUri}) .desp-act`);
await page.waitForTimeout(400);
log((await page.inputValue('#dp-nom')) === 'URI Centro', 'Editar abre el formulario con los datos cargados');
await page.fill('#dp-nom', 'URI Centro — Sede Caribe');
await page.click('button[onclick="lcDespGuardarForm()"]');
await page.waitForTimeout(500);
l = await despachos();
log(l.length === 2 && l.some(d => /Sede Caribe/.test(d.nombre)),
  'La edición actualiza el registro y no crea uno nuevo', l.length + ' despachos');

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(700);
await page.evaluate(() => go('despachos'));
await page.waitForTimeout(400);
log((await despachos()).length === 2, 'Los despachos sobreviven a recargar la app');

const antesDel = (await tarjetas()).length;
const iJuz = await idxTarjeta('Juzgado 3');
await page.click(`#desp-list .desp-card:nth-child(${iJuz}) .desp-act.del`);
await page.waitForTimeout(600);
const trasDel = await despachos();
log(trasDel.length === antesDel - 1 && !trasDel.some(d => /Juzgado 3/.test(d.nombre)),
  'Eliminar quita el despacho de la lista, y quita EL QUE SE ELIGIÓ', trasDel.map(d => d.nombre).join(' | '));

/* ═══ Parte F · Un registro ÚNICO con el módulo de orden judicial ══════════ */
const enOJ = await page.evaluate(() => ojDespachosGuardados().map(d => d.nombre));
log(enOJ.some(x => /Sede Caribe/.test(x)),
  'Lo que se agrega en la pantalla lo ve el módulo de orden judicial', JSON.stringify(enOJ));
const cuerpoSel = fuente.slice(fuente.indexOf('function ojSelectorDespacho('), fuente.indexOf('function ojSelectorDespachoFiltrar'))
  .replace(/\/\*[\s\S]*?\*\//g, '');            // sin comentarios: se mide el CÓDIGO
log(!/DESPACHOS_MEDELLIN|concat\(/.test(cuerpoSel),
  'Su selector ya no concatena ninguna lista escrita en el código');

// El camino de vuelta: un despacho diligenciado dentro del wizard OJ aparece aquí.
const vuelta = await page.evaluate(() => {
  const cfg = DB.getConfig();
  const antes = (cfg.despachosPropios || []).length;
  window.wc = ojNuevoCaso();
  wc.oj.despacho.nombre = 'Juzgado 12 de Ejecución de Penas';
  wc.oj.despacho.municipio = 'Medellín';
  wc.oj.despacho.tipo = 'JEPMS';
  ojGuardarDespacho();
  const l = DB.getConfig().despachosPropios || [];
  const nuevo = l.find(d => /Ejecución de Penas/.test(d.nombre));
  return { antes, ahora: l.length, clase: nuevo && nuevo.clase, tipo: nuevo && nuevo.tipo };
});
log(vuelta.ahora === vuelta.antes + 1 && vuelta.clase === 'JUZGADO',
  'Y lo que se diligencia dentro del wizard de orden judicial aparece en la pantalla', JSON.stringify(vuelta));
log(vuelta.tipo === 'JEPMS',
  '⚠️ Conservando su `tipo` propio, que es el que decide el destinatario del oficio', vuelta.tipo);

// Guardar dos veces el mismo despacho no lo duplica ni le borra el NUNC.
const noPisa = await page.evaluate(() => {
  const cfg = DB.getConfig();
  const uri = (cfg.despachosPropios || []).find(d => d.clase === 'FISCALIA');
  window.wc = ojNuevoCaso();
  wc.oj.despacho.nombre = uri.nombre;
  wc.oj.despacho.direccion = 'CL 1 # 2-3';
  ojGuardarDespacho();
  const l = DB.getConfig().despachosPropios || [];
  const post = l.filter(d => d.nombre === uri.nombre);
  return { copias: post.length, nunc: post[0] && post[0].nunc, dir: post[0] && post[0].direccion };
});
log(noPisa.copias === 1, 'Volver a guardarlo desde otra captura no lo duplica', JSON.stringify(noPisa.copias));
log(noPisa.nunc === '0500160001202601',
  '⚠️ Ni le borra el NUNC: el formulario de orden judicial no lo pide, y lo que no pide no lo pisa', noPisa.nunc);

/* ═══ Parte G · El módulo de capturas va de la mano ════════════════════════ */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [
    { id: 'd1', clase: 'FISCALIA', tipo: 'FISCALIA', nombre: 'URI Centro', municipio: 'Medellín', nunc: '0500160001202601' },
    { id: 'd2', clase: 'FISCALIA', tipo: 'FISCALIA', nombre: 'URI Robledo', municipio: 'Medellín', nunc: '0500160099202602' },
    { id: 'd3', clase: 'CESPA', tipo: 'ADOLESCENTES', nombre: 'CESPA Medellín', municipio: 'Medellín', nunc: '0500160055202603' }
  ];
  cfg.despachoDefecto = { URI: 'd1', CESPA: 'd3' };
  DB.saveConfig(cfg);
});
/* ⚠️ Desde 2026-08-28 el LUGAR abre el formulario: el despacho se resuelve por
   la jurisdicción del hecho, así que primero hay que decir dónde fue. Los
   despachos sembrados son de Medellín y el equipo de la prueba no tiene ciudad
   configurada, así que se escribe. */
await page.evaluate(async () => { wc = null; await wizCerrarBorrador(); startWizard('URI'); });
await page.waitForTimeout(500);
await page.fill('#w-muni', 'Medellín');
await page.waitForTimeout(250);
await page.evaluate(() => wizGoto(getWizConfig().steps.indexOf('Caso')));
await page.waitForTimeout(600);
let dest = await page.textContent('.lc-desp-blk');
let nunc = await page.inputValue('#w-nunc');
log(/URI Centro/.test(dest) && nunc === '0500160001202601',
  'Una captura nueva arranca con el despacho predeterminado Y su NUNC', JSON.stringify([dest.replace(/\s+/g, ' ').trim(), nunc]));

// Cambiar de tipo cambia los dos.
await page.selectOption('#w-tipo', 'CESPA');
await page.waitForTimeout(500);
dest = await page.textContent('.lc-desp-blk');
nunc = await page.inputValue('#w-nunc');
log(/CESPA Medellín/.test(dest) && nunc === '0500160055202603',
  'Cambiar a CESPA repone el destino Y el NUNC de esa unidad', JSON.stringify([dest.replace(/\s+/g, ' ').trim(), nunc]));
await page.selectOption('#w-tipo', 'URI');
await page.waitForTimeout(500);

/* ⚠️ EL PUNTO QUE PIDIÓ EL USUARIO: cambiar de despacho cambia el NUNC.
   Desde 2026-08-28 el despacho tiene bloque propio en el paso, con sus salidas
   («Elegir otro despacho» · «Registrar uno nuevo» · «Escribir a mano») en vez
   del renglón «Destino del informe · Cambiar». */
log(await page.isVisible('.lc-desp-pie button[onclick="abrirSelectorDespacho()"]'),
  'El destino se puede cambiar desde el propio paso de la captura');
await page.click('.lc-desp-pie button[onclick="lcDestEditar(true)"]');   // «Escribir a mano»
await page.waitForTimeout(400);
const avisoNunc = await page.textContent('#wz-panels .lc-dir-prev');
log(/El NUNC cambia con el despacho/.test(avisoNunc),
  'Y se advierte que el NUNC cambiará con él: si no, se leería como un error de la app');
await page.click('button[onclick="abrirSelectorDespacho()"]');
await page.waitForTimeout(450);
const enSelector = await page.$$eval('#dp-res .oj-row', els => els.map(e => e.textContent));
log(enSelector.length === 2 && enSelector.every(t => /URI/.test(t)),
  '⚠️ El selector ofrece SOLO los despachos que reciben ese tipo de captura', enSelector.length + ' opciones');
// ⚠️ Acotado al modal: el botón del topbar tiene el mismo onclick y está oculto.
log(await page.isVisible('#modal-c button[onclick="lcDespForm()"]'),
  'Y deja registrar uno nuevo sin abandonar el procedimiento a medias');
await page.screenshot({ path: join(SHOTS, 'desp_03_selector_wizard.png') });

await page.click('#dp-res .oj-row:nth-child(2)');        // URI Robledo
await page.waitForTimeout(600);
dest = await page.textContent('.lc-desp-blk');
nunc = await page.inputValue('#w-nunc');
log(/URI Robledo/.test(dest), 'Al elegir otro despacho cambia el destino', dest.replace(/\s+/g, ' ').trim());
log(nunc === '0500160099202602',
  '⚠️ Y CAMBIA EL NUNC con él — que es lo que pidió el reporte', nunc);
const guardadoOK = await page.evaluate(() => ({ dest: wc.destino, nunc: wc.nunc }));
log(guardadoOK.dest === 'URI Robledo' && guardadoOK.nunc === '0500160099202602',
  'El caso en curso se queda con los dos', JSON.stringify(guardadoOK));

// Un despacho sin NUNC no BORRA el que ya había: perder un número tecleado es peor.
const sinNunc = await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios.push({ id: 'd4', clase: 'FISCALIA', tipo: 'FISCALIA', nombre: 'URI Nueva', nunc: '' });
  DB.saveConfig(cfg);
  lcUsarDespachoEnCaso(lcDespachoPorId('d4'));
  return { dest: wc.destino, nunc: wc.nunc };
});
log(sinNunc.dest === 'URI Nueva' && sinNunc.nunc === '0500160099202602',
  'Un despacho sin NUNC registrado no borra el que ya estaba: se avisa y queda a la vista', JSON.stringify(sinNunc));

/* ═══ Parte H · Ajustes: los campos se retiran SIN borrar la configuración ═ */
log(!/id="aj-nuncUri"|id="aj-destUri"/.test(fuente),
  'Los cuatro campos duplicados salieron de Ajustes (el dato vive en el despacho)');
const ajustes = await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.nuncUri = '9999999999999999'; cfg.destUri = 'Fiscalía de siempre';
  cfg.nuncCespa = '8888888888888888'; cfg.destCespa = 'CESPA de siempre';
  DB.saveConfig(cfg);
  go('ajustes');
  await new Promise(r => setTimeout(r, 300));
  saveAjustes();
  const c2 = DB.getConfig();
  return { nu: c2.nuncUri, du: c2.destUri, nc: c2.nuncCespa, dc: c2.destCespa };
});
log(ajustes.nu === '9999999999999999' && ajustes.du === 'Fiscalía de siempre' &&
    ajustes.nc === '8888888888888888' && ajustes.dc === 'CESPA de siempre',
  '⚠️ Y guardar Ajustes NO las borra: `v()` devuelve "" para un elemento que no existe', JSON.stringify(ajustes));
await page.waitForTimeout(300);
const derivadas = await page.evaluate(() => ({
  dest: (document.getElementById('aj-dest-auto') || {}).textContent || '',
  nunc: (document.getElementById('aj-nunc-auto') || {}).textContent || ''
}));
log(/URI Centro/.test(derivadas.dest) && /0500160001202601/.test(derivadas.nunc),
  'Ajustes muestra el destino y el NUNC RESUELTOS, con su procedencia', JSON.stringify(derivadas.nunc.slice(0, 60)));
await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(300);
await page.screenshot({ path: join(SHOTS, 'desp_04_ajustes.png'), fullPage: false });

/* ═══ Parte I · La migración de un equipo YA configurado ══════════════════ */
const migrado = await page.evaluate(async () => {
  // Un equipo de la versión anterior: destino y NUNC sueltos, sin registro.
  const previo = JSON.parse(localStorage.getItem('lc_cfg') || '{}');
  localStorage.setItem('lc_cfg', JSON.stringify(Object.assign({}, previo, {
    despachosPropios: [], despachoDefecto: {}, despachosMigrados: false,
    destUri: 'URI La Candelaria', nuncUri: '0500160077202677',
    destCespa: 'CESPA', nuncCespa: ''
  })));
  const cfg = DB.getConfig();
  return {
    n: (cfg.despachosPropios || []).length,
    nom: (cfg.despachosPropios[0] || {}).nombre,
    nunc: (cfg.despachosPropios[0] || {}).nunc,
    def: cfg.despachoDefecto && cfg.despachoDefecto.URI,
    destino: lcDespDestino('URI', cfg)
  };
});
log(migrado.n === 1 && migrado.nom === 'URI La Candelaria' && migrado.nunc === '0500160077202677',
  'Un equipo ya configurado encuentra su destino y su NUNC convertidos en un despacho', JSON.stringify(migrado));
log(migrado.def && migrado.destino === 'URI La Candelaria',
  'Y queda predeterminado, así que no cambia nada de lo que veía');
log(migrado.n === 1,
  '⚠️ El CESPA por defecto («CESPA», sin NUNC) NO se siembra: es un valor de fábrica, no algo que el usuario escribiera');

const noResucita = await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = []; cfg.despachoDefecto = {};
  DB.saveConfig(cfg);
  return (DB.getConfig().despachosPropios || []).length;
});
log(noResucita === 0,
  '⚠️ Borrar todos los despachos NO los resucita en la lectura siguiente (la marca `despachosMigrados`)');

/* ═══ Parte J · Modo invitado ═════════════════════════════════════════════ */
const huellaAntes = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return JSON.stringify(o);
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => guestEntrar());
await page.waitForTimeout(600);
const invitado = await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'g1', clase: 'FISCALIA', tipo: 'FISCALIA', nombre: 'URI prestada', nunc: '0500160011202611' }];
  cfg.despachoDefecto = { URI: 'g1' };
  DB.saveConfig(cfg);
  go('despachos');
  await new Promise(r => setTimeout(r, 300));
  return { n: (DB.getConfig().despachosPropios || []).length, nunc: lcDespNunc('URI') };
});
log(invitado.n === 1 && invitado.nunc === '0500160011202611',
  'El invitado puede registrar sus despachos y usarlos en la sesión', JSON.stringify(invitado));
const huellaDespues = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return JSON.stringify(o);
});
log(huellaDespues === huellaAntes, 'Y no escribe un solo byte en el almacenamiento del dueño');

log(consoleErrors.length === 0, 'Sin errores de consola', consoleErrors.join(' | '));
console.log(`\n${n - fails}/${n} checks OK`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
