/* Regresión de «LA DIRECCIÓN SE DILIGENCIA EN SU PROPIA VENTANA» (2026-10-27).

   El usuario, con el paso «Lugar» de flagrancia a la vista: el bloque de la
   dirección (vía, número, placa, complemento, barrio, características,
   localidad, zona, vereda) era largo y desordenado. Pidió una ventana modal con
   «Guardar», editable en cualquier momento, en TODOS los formularios que piden
   una dirección.

   Lo que fija esta suite:
   A. el componente: tarjeta en el formulario, campos en la ventana, Guardar
      lleva lo escrito, Cancelar lo devuelve, reabrir trae lo guardado, el botón
      atrás de Android la cierra sin salir del formulario;
   B. los nueve formularios lo usan, con los mismos ids de siempre, y lo
      guardado llega al modelo;
   C. la ventana abre ENCIMA de otro modal sin cerrarlo; la inferencia del
      departamento y el aviso de homónimos funcionan dentro;
   D. una dirección escrita a mano se abre en «Escribir a mano», intacta;
   E. aspecto: claro y oscuro, sin desborde a 360 px, consola limpia. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8193;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
function log(ok, label, extra) {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}
function sec(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 64 - t.length))); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window._lcListo === true);
await page.waitForTimeout(400);

const abierta = () => page.evaluate(() => document.getElementById('dir-ov').classList.contains('open'));
const tarjeta = id => page.evaluate(i => {
  const c = document.getElementById(i + '__card');
  return c ? { txt: c.innerText.replace(/\s+/g, ' ').trim(), vacia: c.classList.contains('vacia'), falta: c.classList.contains('falta') } : null;
}, id);
async function abrir(id) { await page.click('#' + id + '__card'); await page.waitForTimeout(250); }
async function guardar() { await page.click('#dir-ov-ok'); await page.waitForTimeout(250); }
async function cancelar() { await page.click('#dir-ov .lc-dirov-pie .btn.bs'); await page.waitForTimeout(250); }
async function guiada(id, via, num, cruce, placa) {
  await page.selectOption('#' + id + '__via', via);
  await page.fill('#' + id + '__num', num);
  await page.fill('#' + id + '__cruce', cruce);
  if (placa !== undefined) await page.fill('#' + id + '__placa', placa);
}

/* ═══════════ A · el componente, sobre el lugar de los hechos ═══════════ */
sec('A · Lugar de los hechos (flagrancia)');
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(400);
log(await page.isVisible('#w-muni') && await page.isVisible('#w-depto'),
  'Municipio y departamento siguen a la vista en el formulario (de ellos sale el despacho)');
log(await page.isVisible('#w-dir__card'), 'La dirección es una tarjeta en el formulario');
log(!(await page.isVisible('#w-dir__via')) && !(await page.isVisible('#w-barrio')) && !(await page.isVisible('#w-caract')),
  'Los campos de la dirección ya no ocupan el formulario');
let t = await tarjeta('w-dir');
log(t.vacia && /^Agregar dirección/.test(t.txt), 'Sin dirección, la tarjeta invita a agregarla (y ya enseña los valores por defecto de Perfil)', t.txt);

await abrir('w-dir');
log(await abierta(), 'Tocar la tarjeta abre la ventana');
log(await page.isVisible('#w-dir__via') && await page.isVisible('#w-barrio') && await page.isVisible('#w-caract') &&
  await page.isVisible('#w-local') && await page.isVisible('#w-zona') && await page.isVisible('#w-vereda'),
  'La ventana trae vía, número, placa, barrio, características, localidad, zona y vereda');
const tit = await page.textContent('#dir-ov .mh h2');
log(/lugar de los hechos/i.test(tit), 'Con su título', tit);

await guiada('w-dir', 'CL', '52', '50', '31');
await page.fill('#w-barrio', 'Prado');
await cancelar();
log(!(await abierta()), 'Cancelar cierra la ventana');
log(await page.inputValue('#w-dir') === '' && await page.inputValue('#w-barrio') === '',
  '⚠️ Cancelar NO lleva nada al formulario', JSON.stringify([await page.inputValue('#w-dir'), await page.inputValue('#w-barrio')]));
log((await tarjeta('w-dir')).vacia, 'La tarjeta sigue vacía');

await abrir('w-dir');
log(await page.inputValue('#w-dir__num') === '', 'Reabrir tras cancelar trae lo que había (nada)');
await guiada('w-dir', 'CL', '52', '50', '31');
await page.fill('#w-barrio', 'Prado');
await page.fill('#w-caract', 'Vía pública, frente a una panadería');
await page.selectOption('#w-zona', 'Rural');
await page.fill('#w-local', '10');
await page.fill('#w-vereda', 'El Llano');
log(/CL 52 # 50-31/.test(await page.textContent('#w-dir__body .lc-dir-prev')), 'Dentro se sigue viendo «Se imprimirá: …»');
await guardar();
log(!(await abierta()), 'Guardar cierra la ventana');
log(await page.inputValue('#w-dir') === 'CL 52 # 50-31', 'Guardar deja la dirección compuesta en su campo de siempre', await page.inputValue('#w-dir'));
t = await tarjeta('w-dir');
log(!t.vacia && /CL 52 # 50-31/.test(t.txt) && /Barrio Prado/.test(t.txt) && /Rural/.test(t.txt) && /Localidad 10/.test(t.txt) && /Vereda El Llano/.test(t.txt),
  'La tarjeta enseña la dirección y sus detalles en una línea', t.txt);
await page.screenshot({ path: 'verify_direccion_modal_tarjeta_llena.png' });
log(await page.evaluate(() => document.getElementById('w-dir__grp').contains(document.getElementById('w-dir__campos'))),
  'Los campos vuelven a su formulario al cerrar');

await abrir('w-dir');
log(await page.inputValue('#w-dir__num') === '52' && await page.inputValue('#w-barrio') === 'Prado',
  'Se puede reabrir y editar en cualquier momento: trae lo guardado');
await page.fill('#w-barrio', 'Prado Centro');
await guardar();
log(/Prado Centro/.test((await tarjeta('w-dir')).txt), 'Y la corrección se refleja en la tarjeta');

// El botón atrás de Android: cierra la ventana SIN guardar y sin salir del formulario.
await abrir('w-dir');
await page.fill('#w-barrio', 'NO DEBE QUEDAR');
await page.goBack();
await page.waitForTimeout(400);
log(!(await abierta()), 'El botón atrás cierra la ventana');
log(await page.inputValue('#w-barrio') === 'Prado Centro', '⚠️ …sin guardar lo que había en ella', await page.inputValue('#w-barrio'));
log(await page.evaluate(() => !!wc && document.getElementById('screen-wizard').classList.contains('on')),
  '⚠️ …y sin cerrar el formulario de la captura');

// Lo guardado llega al modelo.
await page.evaluate(() => collectStep());
const lugar = await page.evaluate(() => wc.lugar);
log(lugar.dir === 'CL 52 # 50-31' && lugar.barrio === 'Prado Centro' && lugar.caract === 'Vía pública, frente a una panadería' &&
  lugar.zona === 'Rural' && lugar.localidad === '10' && lugar.vereda === 'El Llano',
  'collectStep recoge los seis datos como siempre', JSON.stringify(lugar));

// Tocar fuera no cierra (un toque accidental no puede tirar lo tecleado).
await abrir('w-dir');
await page.mouse.click(190, 20);
await page.waitForTimeout(200);
log(await abierta(), 'Tocar fuera de la ventana NO la cierra');
await cancelar();

// El borrador automático se entera de lo guardado.
await page.evaluate(() => { try { localStorage.removeItem('lc_draft'); } catch (e) {} });
await abrir('w-dir');
await page.fill('#w-vereda', 'La Cuchilla');
await guardar();
await page.waitForTimeout(3200);
log(await page.evaluate(() => !!localStorage.getItem('lc_draft')), 'Guardar en la ventana dispara el borrador automático');

/* ═══════════ B · persona (encima de otro modal) ═══════════ */
sec('B · Persona — la ventana abre ENCIMA del formulario de la persona');
await page.evaluate(() => openPersonModal('capturados', -1, {}, true));
await page.waitForTimeout(300);
log(await page.isVisible('#pm-dirRes__card'), 'El formulario de la persona trae la tarjeta de residencia');
await page.evaluate(() => { const d = document.getElementById('pm-dirRes__card'); d.scrollIntoView(); });
await abrir('pm-dirRes');
log(await abierta() && await page.evaluate(() => document.getElementById('modal').classList.contains('open')),
  'La ventana abre y el formulario de la persona sigue abierto debajo');
const z = await page.evaluate(() => [getComputedStyle(document.getElementById('dir-ov')).zIndex, getComputedStyle(document.getElementById('modal')).zIndex]);
log(+z[0] > +z[1], 'Y queda por encima', z.join(' > '));
await guiada('pm-dirRes', 'CR', '45', '12', '30');
await guardar();
log(await page.evaluate(() => document.getElementById('modal').classList.contains('open')), 'Guardar la dirección NO cierra el formulario de la persona');
log(await page.inputValue('#pm-dirRes') === 'CR 45 # 12-30', 'La residencia queda en su campo', await page.inputValue('#pm-dirRes'));
await page.fill('#pm-priNom', 'Carlos'); await page.fill('#pm-priApe', 'Restrepo');
await page.evaluate(() => savePersonModal('capturados', -1, true));
await page.waitForTimeout(300);
log(await page.evaluate(() => (wc.capturados[0] || {}).dirRes) === 'CR 45 # 12-30', 'Y llega al capturado al guardar la persona');

// Una dirección escrita a mano se abre a mano, intacta.
await page.evaluate(() => openPersonModal('capturados', 0, { priNom: 'Ana', dirRes: 'Finca La Esperanza, vía al mar km 4' }, true));
await page.waitForTimeout(300);
log(/Finca La Esperanza/.test((await tarjeta('pm-dirRes')).txt), 'La tarjeta enseña la dirección libre tal cual');
await page.evaluate(() => lcDirAbrir('pm-dirRes')); await page.waitForTimeout(250);
log(await page.isVisible('#pm-dirRes__libre') && await page.inputValue('#pm-dirRes__libre') === 'Finca La Esperanza, vía al mar km 4',
  'Y la ventana la abre en «Escribir a mano», sin reinterpretarla');
await cancelar();
await page.evaluate(() => closeModal());
await page.evaluate(() => { wc = null; go('capturas'); });
await page.waitForTimeout(200);

/* ═══════════ C · despacho ═══════════ */
sec('C · Despacho — municipio y departamento entran a la ventana');
await page.evaluate(() => lcDespForm());
await page.waitForTimeout(300);
log(await page.isVisible('#dp-dir__card') && !(await page.isVisible('#dp-mun')) && await page.isVisible('#dp-tel'),
  'Dirección, barrio, municipio y departamento en la tarjeta; teléfono y correo a la vista');
await abrir('dp-dir');
await guiada('dp-dir', 'CR', '56', '42', '70');
await page.fill('#dp-bar', 'Boston');
await page.fill('#dp-mun', 'Leticia');
await page.waitForTimeout(150);
log(await page.inputValue('#dp-dep') === 'Amazonas', 'Dentro de la ventana el departamento se completa solo', await page.inputValue('#dp-dep'));
await page.fill('#dp-mun', 'Barbosa');
await page.waitForTimeout(200);
log(await page.isVisible('#dp-mun-geo') && (await page.$$('#dp-mun-geo button')).length >= 2,
  'Y el aviso de homónimos aparece dentro de la ventana');
await page.fill('#dp-mun', 'Medellín');
await page.waitForTimeout(150);
await guardar();
t = await tarjeta('dp-dir');
log(/CR 56 # 42-70/.test(t.txt) && /Boston/.test(t.txt) && /Medellín, Antioquia/.test(t.txt), 'La tarjeta del despacho enseña dirección, barrio y municipio', t.txt);
await page.fill('#dp-nom', 'Fiscalía Prueba Ventana');
await page.evaluate(() => lcDespGuardarForm());
await page.waitForTimeout(300);
const desp = await page.evaluate(() => (DB.getConfig().despachosPropios || []).find(d => d.nombre === 'Fiscalía Prueba Ventana'));
log(desp && desp.direccion === 'CR 56 # 42-70' && desp.barrio === 'Boston' && desp.municipio === 'Medellín' && desp.departamento === 'Antioquia',
  'El despacho se guarda con los cuatro datos', JSON.stringify(desp && [desp.direccion, desp.barrio, desp.municipio, desp.departamento]));
await page.evaluate(() => closeModal());

/* ═══════════ D · orden judicial ═══════════ */
sec('D · Orden judicial — residencia, lugar de la captura y destinatario');
await page.evaluate(() => { DB.clearDraft(); startWizard('OJ'); });
await page.waitForTimeout(400);
await page.evaluate(() => ojAbrirRequerido());
await page.waitForTimeout(300);
log(await page.isVisible('#oj-r-rdir__card') && !(await page.isVisible('#oj-r-rmun')) && await page.isVisible('#oj-r-rtel'),
  'Residencia: tarjeta (dirección, barrio, municipio, departamento) y el teléfono a la vista');
await page.evaluate(() => document.getElementById('oj-r-rdir__card').scrollIntoView());
await abrir('oj-r-rdir');
await guiada('oj-r-rdir', 'CL', '10', '20', '30');
await page.fill('#oj-r-rbar', 'Manrique');
await page.fill('#oj-r-rmun', 'Medellín');
await page.waitForTimeout(150);
await guardar();
await page.evaluate(() => ojCollectRequerido());
let r = await page.evaluate(() => wc.oj.requerido);
log(r.resDireccion === 'CL 10 # 20-30' && r.resBarrio === 'Manrique' && r.resMunicipio === 'Medellín' && r.resDepartamento === 'Antioquia',
  'La residencia del requerido llega al modelo', JSON.stringify([r.resDireccion, r.resBarrio, r.resMunicipio, r.resDepartamento]));
await page.evaluate(() => closeModal());

await page.evaluate(() => wizGoto(2));
await page.waitForTimeout(300);
t = await tarjeta('oj-g-dir');
log(t && t.vacia && t.falta, 'Lugar de la captura: obligatorio y vacío ⇒ la tarjeta lo marca', JSON.stringify(t));
log(await page.isVisible('#oj-g-dir__grp .req'), 'Con su asterisco de obligatorio');
await abrir('oj-g-dir');
log(await page.isVisible('#oj-g-tlug'), 'El tipo de lugar se diligencia con la dirección');
await page.evaluate(() => lcDirModo('oj-g-dir', 'libre'));
await page.fill('#oj-g-dir__libre', 'Calle 53 con carrera 51');
await page.fill('#oj-g-bar', 'Prado');
await page.fill('#oj-g-mun', 'Bogotá');
await page.waitForTimeout(150);
await guardar();
t = await tarjeta('oj-g-dir');
log(!t.falta && /Calle 53 con carrera 51/.test(t.txt) && /Bogotá, Cundinamarca/.test(t.txt), 'Diligenciado, la tarjeta deja de marcarlo', t.txt);
await page.evaluate(() => ojCollect());
const g = await page.evaluate(() => wc.oj.diligencia);
log(g.lugarDireccion === 'Calle 53 con carrera 51' && g.lugarBarrio === 'Prado' && g.lugarMunicipio === 'Bogotá' && g.lugarDepartamento === 'Cundinamarca',
  'El lugar de la captura llega al modelo', JSON.stringify([g.lugarDireccion, g.lugarBarrio, g.lugarMunicipio, g.lugarDepartamento]));

await page.evaluate(() => wizGoto(3));
await page.waitForTimeout(300);
await page.evaluate(() => { const d = document.querySelector('.oj-dest-mas'); if (d) d.open = true; });
log(await page.isVisible('#oj-x-dir__card'), 'Destinatario: la dirección también es tarjeta');
await abrir('oj-x-dir');
await guiada('oj-x-dir', 'CR', '64C', '67', '300');
await page.fill('#oj-x-mun', 'Medellín');
await page.waitForTimeout(150);
await guardar();
await page.evaluate(() => ojCollect());
const x = await page.evaluate(() => wc.oj.destino);
log(x.direccion === 'CR 64C # 67-300' && x.municipio === 'Medellín' && x.departamento === 'Antioquia',
  'El destinatario llega al modelo', JSON.stringify([x.direccion, x.municipio, x.departamento]));
await page.evaluate(() => { wc = null; go('capturas'); });
await page.waitForTimeout(200);

/* ═══════════ E · Ajustes, rótulo y acta de entrega ═══════════ */
sec('E · Ajustes, rótulo y acta de entrega');
await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(300);
log(await page.evaluate(() => !!document.getElementById('aj-dir__card')), 'Ajustes → Estación: la dirección es tarjeta');
await page.evaluate(() => lcDirAbrir('aj-dir'));
await page.waitForTimeout(250);
await guiada('aj-dir', 'CL', '48', '55', '50');
await page.fill('#aj-bar', 'La Candelaria');
await page.fill('#aj-ciu', 'Medellín');
await guardar();
await page.evaluate(() => saveAjustes());
await page.waitForTimeout(400);
const cfg = await page.evaluate(() => { const c = DB.getConfig(); return [c.ojCustDireccion, c.ojCustBarrio, c.ojCustCiudad]; });
log(cfg[0] === 'CL 48 # 55-50' && cfg[1] === 'La Candelaria' && cfg[2] === 'Medellín', 'Se guarda con «Guardar ajustes» como antes', JSON.stringify(cfg));
await page.evaluate(() => { go('capturas'); go('ajustes'); });
await page.waitForTimeout(300);
log(/CL 48 # 55-50/.test((await tarjeta('aj-dir')).txt) && /La Candelaria/.test((await tarjeta('aj-dir')).txt),
  'Y al volver a Ajustes la tarjeta lo enseña');

const idCaso = await page.evaluate(async () => {
  const c = {
    id: 'dir-uri', tipo: 'URI', nunc: '0500160001202601', fechaProc: '2026-10-20',
    conductas: ['Hurto'], lugar: { dir: 'CL 52 # 50-31', barrio: 'La Candelaria', muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{ id: 'per-1', tipoDoc: 'CC', numDoc: '71234567', priNom: 'Carlos', priApe: 'Restrepo' }],
    victimas: [{ id: 'vic-1', tipoDoc: 'CC', numDoc: '43111222', priNom: 'María', priApe: 'Gómez', dirRes: 'CR 70 # 44-10' }],
    testigos: [], sinTestigo: true,
    elementos: [{ cant: 1, desc: 'celular marca Samsung color negro' }],
    narracion: { fechaCapD: '20', fechaCapM: '10', fechaCapA: '2026', horaCapH: '17', horaCapM: '30', texto: 'Relato.' }
  };
  await DB.saveCase(c); return c.id;
});
await page.evaluate(id => { const its = ccElementos(DB.getCase(id)); rtAbrir(id, its[0].id); }, idCaso);
await page.waitForTimeout(300);
log(/CL 52 # 50-31/.test((await tarjeta('rt-dir')).txt), 'Rótulo: la dirección del hallazgo es tarjeta, con la de la captura');
log(await page.isVisible('#rt-ubic'), 'Y la ubicación exacta sigue a la vista');
await page.evaluate(() => document.getElementById('rt-dir__card').scrollIntoView());
await abrir('rt-dir');
await guiada('rt-dir', 'CL', '52', '50', '35');
await guardar();
log(/^CL 52 # 50-35 BARRIO LA CANDELARIA/.test(await page.$eval('#rt-dir', e => e.value)), 'El rótulo lee la dirección corregida, con su complemento intacto', await page.$eval('#rt-dir', e => e.value));
await page.evaluate(() => closeModal());
await page.waitForTimeout(200);

await page.evaluate(id => feAbrir(id), idCaso);
await page.waitForTimeout(400);
log(await page.evaluate(() => !!document.getElementById('fe-dir__card') && !!document.getElementById('fe-rec-dir__card')),
  'Acta de entrega: la de la autoridad y la de quien recibe son tarjetas');
log(/CR 70 # 44-10/.test((await tarjeta('fe-rec-dir')).txt), 'Quien recibe trae la dirección de la víctima');
await page.evaluate(() => lcDirAbrir('fe-dir'));
await page.waitForTimeout(250);
await guiada('fe-dir', 'CR', '64C', '67', '300');
await guardar();
log(await page.$eval('#fe-dir', e => e.value) === 'CR 64C # 67-300', 'La dirección de la autoridad queda en su campo');
await page.evaluate(() => closeModal());
await page.waitForTimeout(200);
const ent = await page.evaluate(id => (DB.getCase(id).entrega || {}).dirAutoridad, idCaso);
log(ent === 'CR 64C # 67-300', 'Y el acta la guarda al cerrar', ent);

/* ═══════════ F · aspecto ═══════════ */
sec('F · Aspecto — claro, oscuro y 360 px');
await page.setViewportSize({ width: 360, height: 760 });
await page.evaluate(() => { DB.clearDraft(); startWizard('URI'); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'verify_direccion_modal_tarjeta_claro.png' });
await abrir('w-dir');
await page.waitForTimeout(250);
const desb = await page.evaluate(() => { const c = document.getElementById('dir-ov-c'); return [c.scrollWidth, c.clientWidth]; });
log(desb[0] <= desb[1], 'A 360 px la ventana no se desborda a lo ancho', desb.join(' ≤ '));
const pie = await page.evaluate(() => { const r = document.querySelector('.lc-dirov-pie').getBoundingClientRect(); return [r.bottom, innerHeight]; });
log(pie[0] <= pie[1] + 1, '«Cancelar» y «Guardar» quedan a la vista abajo', pie.join(' ≤ '));
await page.screenshot({ path: 'verify_direccion_modal_ventana_claro.png' });
await cancelar();
await page.evaluate(() => setTheme('dark'));
await page.waitForTimeout(200);
await page.screenshot({ path: 'verify_direccion_modal_tarjeta_oscuro.png' });
await abrir('w-dir');
await page.screenshot({ path: 'verify_direccion_modal_ventana_oscuro.png' });
await cancelar();

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

console.log(`\n${n - fails}/${n} comprobaciones en verde`);
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
