/* Regresión de «El formulario de orden judicial, sin lo que no aporta»
   (2026-10-26). Nueve observaciones del usuario sobre siete pantallazos del
   formulario de orden judicial (y de flagrancia, donde aplica lo mismo):
     A · Delitos: solo delito y artículo; el delito bien escrito; el artículo
         solo si es seguro; lo guardado con inciso/numeral/agravación no se pierde
     B · El departamento sale del municipio, en toda la app
     C · La autoridad solicitante ya no se «guarda para reutilizarla»
     D · El motivo de la captura se puede escribir a mano, sin perder la ruta
     E · La hora, siempre en 24 h
     F · «Quién hizo la diligencia» sale del formulario
     G · Se ve bien, en los dos temas
   ⚠️ El modelo del caso no cambia de forma: los mismos campos llegan al oficio. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8164;
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
function log(ok, label, extra) {
  n++; if (ok === false) fails++;
  console.log((ok ? 'OK  ' : 'FALLO'), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}
const sec = t => console.log('\n── ' + t + ' ──');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window._lcListo === true);
await page.waitForTimeout(300);

await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id: 'p1', nombre: 'NELSON DAVID GOMEZ', grado: 'Subintendente', cargo: 'Integrante patrulla',
    cedula: '71234567', companero: { nombre: 'JUAN PEREZ', grado: 'Patrullero', cedula: '1020' } }];
  cfg.perfilActivo = 'p1'; cfg.patrullaNum = '32'; cfg.patrullaUnidad = 'Parque Bolívar';
  DB.saveConfig(cfg);
});
const nuevoOJ = async (paso) => {
  await page.evaluate(async (p) => { wc = null; await DB.clearDraft(); closeModal(); startWizard('OJ'); }, paso);
  await page.waitForTimeout(250);
  if (paso) { await page.evaluate(p => wizGoto(p), paso); await page.waitForTimeout(350); }
};

/* ═════════════════════════════════════════════════════════════════════════ */
sec('A · DELITOS');
await nuevoOJ(1);
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(200);
const campos = await page.$$eval('#oj-list-delitos .oj-row [data-k]', e => e.map(x => x.dataset.k));
log(campos.join(',') === 'nombre,articulo', 'Cada delito pide solo el delito y el artículo', campos.join(','));
const fuera = await page.evaluate(() => ['Inciso', 'Numeral', 'Código del delito', 'circunstancias de agravación']
  .filter(t => document.getElementById('oj-list-delitos').innerText.indexOf(t) >= 0));
log(fuera.length === 0, 'Inciso, Numeral, Código SPOA y «agravación» ya no están', fuera.join(',') || 'ninguno');
const btnDebajo = await page.evaluate(() => {
  const l = document.getElementById('oj-list-delitos'), b = document.querySelector('button[onclick="ojListaAgregar(\'delitos\')"]');
  return !!(l && b) && (l.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
});
log(btnDebajo, '«+ Agregar delito» sigue debajo del artículo');

const casos = [
  ['HOMICIDIO AGRAVADO', 'Homicidio agravado'],
  ['trafico de estupefacientes', 'Tráfico de estupefacientes'],
  ['  extorsion ', 'Extorsión'],
  ['omicidio', 'Homicidio'],
  ['FABRICACION ilegal DE ARMAS', 'Fabricación ilegal de armas'],
  ['acceso carnal abusivo con menor de catorce anos', 'Acceso carnal abusivo con menor de catorce años'],
  ['Falsedad en documento privado.', 'Falsedad en documento privado']
];
const norm = await page.evaluate(cs => cs.map(c => lcDelitoNorm(c[0])), casos);
casos.forEach((c, i) => log(norm[i] === c[1], `«${c[0].trim()}» se escribe «${c[1]}»`, norm[i]));

// Al salir del campo: bien escrito y, si es seguro, el artículo.
await page.click('#ojl-delitos-0-nombre'); await page.keyboard.type('extorsion');
await page.click('#oj-d-nom');
log(await page.inputValue('#ojl-delitos-0-nombre') === 'Extorsión' && await page.inputValue('#ojl-delitos-0-articulo') === '244',
  'Al salir, «extorsion» queda «Extorsión» y su artículo 244 (antes la tilde impedía encontrarlo)',
  await page.inputValue('#ojl-delitos-0-articulo'));
// Un delito que la app no conoce: no inventa artículo.
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(200);
await page.click('#ojl-delitos-1-nombre'); await page.keyboard.type('delito raro inventado');
await page.click('#oj-d-nom');
log(await page.inputValue('#ojl-delitos-1-nombre') === 'Delito raro inventado' && await page.inputValue('#ojl-delitos-1-articulo') === '',
  'Si no está seguro, no pone artículo: queda para el funcionario, y no es obligatorio');
// Pasar del delito al artículo no concatena la sugerencia con lo tecleado.
await page.fill('#ojl-delitos-1-nombre', '');
await page.click('#ojl-delitos-1-nombre'); await page.keyboard.type('estafa');
await page.click('#ojl-delitos-1-articulo'); await page.keyboard.type('246 inc. 2');
log(await page.inputValue('#ojl-delitos-1-articulo') === '246 inc. 2', 'Ir del delito al artículo y escribir no se mezcla con la sugerencia',
  await page.inputValue('#ojl-delitos-1-articulo'));
// Lo escrito a mano en el artículo no se pisa.
await page.fill('#ojl-delitos-0-articulo', '244 num. 3');
await page.click('#ojl-delitos-0-nombre'); await page.click('#oj-d-nom');
log(await page.inputValue('#ojl-delitos-0-articulo') === '244 num. 3', 'El artículo escrito por el funcionario no se pisa');
const mod = await page.evaluate(() => { ojCollect(); return wc.oj.proceso.delitos; });
log(mod.length === 2 && mod[0].nombre === 'Extorsión' && Object.keys(mod[0]).sort().join(',') === 'articulo,nombre',
  'En el modelo, cada delito es { nombre, articulo }', JSON.stringify(mod[0]));
const v = await page.evaluate(() => ojValidar(wc).filter(x => /artículo/i.test(x.msg)).length);
log(v === 0, 'El artículo no es obligatorio: ninguna validación lo exige');

// Lo guardado con los campos retirados: mismo texto en el oficio.
const leg = await page.evaluate(() => {
  const d = { nombre: 'Homicidio', articulo: '103', inciso: '2', numeral: '1', agravado: true, codigo: '923' };
  const antes = (d.nombre + (d.agravado ? ' agravado' : '')) + ' (Art. ' + ojEnumerar([d.articulo, 'inc. ' + d.inciso, 'num. ' + d.numeral]) + ' del Código Penal Colombiano)';
  const c = ojNuevoCaso(); c.oj.proceso.delitos = [d, { nombre: 'Hurto agravado', articulo: '239', agravado: true }];
  ojNormalizar(c);
  return { antes, ahora: ojDelitosDoc(c), d: c.oj.proceso.delitos };
});
log(leg.ahora.split('; ')[0] === leg.antes, 'Una captura guardada con inciso/numeral/agravación imprime el mismo texto', leg.ahora);
log(leg.d[0].nombre === 'Homicidio agravado' && leg.d[0].articulo === '103, inc. 2 y num. 1' && !('inciso' in leg.d[0]) && !('codigo' in leg.d[0]),
  '…porque esos datos pasan a los dos campos que quedan', JSON.stringify(leg.d[0]));
log(leg.d[1].nombre === 'Hurto agravado', '«agravado» no se duplica si el nombre ya lo dice', leg.d[1].nombre);

// Flagrancia: la conducta también se escribe bien.
await page.evaluate(async () => { wc = null; await DB.clearDraft(); startWizard('URI'); });
await page.waitForTimeout(250);
await page.evaluate(() => wizGoto(getWizConfig().steps.indexOf('Caso'))); await page.waitForTimeout(300);
const condSel = '#w-conds [data-c="cond"]';
if (await page.$(condSel)) {
  await page.click(condSel); await page.keyboard.type('trafico de estupefacientes'); await page.click('#w-dest, .st');
  log(await page.inputValue(condSel) === 'Tráfico de estupefacientes' && /376/.test(await page.inputValue('#w-conds [data-c="art"]')),
    'En flagrancia la conducta se escribe igual y trae su artículo', await page.inputValue('#w-conds [data-c="art"]'));
} else log(false, 'En flagrancia la conducta se escribe igual', 'no se encontró el campo');

/* ═════════════════════════════════════════════════════════════════════════ */
sec('B · EL DEPARTAMENTO SALE DEL MUNICIPIO');
await nuevoOJ(1);
await page.click('#oj-d-mun'); await page.keyboard.type('medellin'); await page.click('#oj-d-nom');
log(await page.inputValue('#oj-d-mun') === 'Medellín' && await page.inputValue('#oj-d-dep') === 'Antioquia',
  'Escribir «medellin» deja «Medellín» y el departamento Antioquia');
// Despacho traído del registro SIN departamento.
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'dx1', clase: 'JUZGADO', tipo: 'JCG', nombre: 'Juzgado 3 Penal', municipio: 'Envigado', departamento: '' }];
  DB.saveConfig(cfg);
  wc.oj.despacho.departamento = ''; wc.oj.despacho.municipio = '';
  ojSelectorDespacho();
});
await page.waitForTimeout(200);
await page.evaluate(() => ojUsarDespacho(0)); await page.waitForTimeout(300);
log(await page.inputValue('#oj-d-dep') === 'Antioquia', 'Un despacho del registro sin departamento llega con el departamento puesto',
  await page.inputValue('#oj-d-dep'));
// Lo escrito por el funcionario no se pisa.
await page.fill('#oj-d-mun', 'Girardota'); await page.fill('#oj-d-dep', 'Cundinamarca'); await page.click('#oj-d-mun'); await page.click('#oj-d-nom');
log(await page.inputValue('#oj-d-dep') === 'Cundinamarca', 'Un departamento escrito a mano no se pisa');
// Homónimo: no se adivina.
await page.fill('#oj-d-mun', ''); await page.fill('#oj-d-dep', '');
await page.click('#oj-d-mun'); await page.keyboard.type('Barbosa'); await page.click('#oj-d-nom');
log(await page.inputValue('#oj-d-dep') === '', 'Un municipio homónimo (Barbosa) no se adivina');
// Abrir una captura guardada sin departamento: se completa y NO cuenta como cambio.
const ab = await page.evaluate(async () => {
  closeModal(); wc = null; await DB.clearDraft();
  const c = SIM.genOJ(); c.oj.despacho.municipio = 'Bello'; c.oj.despacho.departamento = '';
  c.oj.diligencia.lugarMunicipio = 'Itagüí'; c.oj.diligencia.lugarDepartamento = '';
  await DB.saveCase(c); editCase(c.id); await new Promise(r => setTimeout(r, 300));
  const a = JSON.parse(_wizBase); collectStep(); const b = JSON.parse(JSON.stringify(wc)); a.updated = b.updated = 0;
  return { dep: wc.oj.despacho.departamento, dil: wc.oj.diligencia.lugarDepartamento, igual: JSON.stringify(a) === JSON.stringify(b) };
});
log(ab.dep === 'Antioquia' && ab.dil === 'Antioquia', 'Una captura abierta para editar trae el departamento de cada municipio', JSON.stringify(ab));
log(ab.igual, '…y abrirla no cuenta como un cambio (no deja un borrador fantasma)');
// Flagrancia: el lugar.
await page.evaluate(async () => { wc = null; await DB.clearDraft(); startWizard('URI'); });
await page.waitForTimeout(250);
await page.evaluate(() => wizGoto(getWizConfig().steps.indexOf('Lugar'))); await page.waitForTimeout(300);
await page.fill('#w-muni', ''); await page.fill('#w-depto', '');
await page.click('#w-muni'); await page.keyboard.type('sabaneta'); await page.click('#w-barrio, .st');
log(await page.inputValue('#w-depto') === 'Antioquia' && await page.inputValue('#w-muni') === 'Sabaneta',
  'Flagrancia: el lugar del hecho también');
// Personas: lugar de nacimiento, en el formulario abierto con el municipio ya escrito.
await page.evaluate(() => openPersonModal('capturados', -1, { nacMuni: 'Envigado' }));
await page.waitForTimeout(200);
const nac = await page.evaluate(() => [(document.getElementById('pm-nacDepto') || {}).value, (document.getElementById('pm-nacPais') || {}).value]);
log(nac[0] === 'Antioquia' && nac[1] === 'Colombia', 'Personas: el lugar de nacimiento también (Envigado → Antioquia, Colombia)', JSON.stringify(nac));
await page.evaluate(() => closeModal());
// Despachos: el formulario del registro.
await page.evaluate(() => { wc = null; go('despachos'); lcDespForm(null, { municipio: 'Cali' }); });
await page.waitForTimeout(200);
log(await page.inputValue('#dp-dep') === 'Valle del Cauca', 'Despachos: el formulario del registro también', await page.inputValue('#dp-dep'));
await page.evaluate(() => closeModal());

/* ═════════════════════════════════════════════════════════════════════════ */
sec('C · LA AUTORIDAD SOLICITANTE NO SE «GUARDA PARA REUTILIZAR»');
await nuevoOJ(1);
log(!(await page.$('button[onclick="ojGuardarDespacho()"]')) && await page.evaluate(() => typeof ojGuardarDespacho === 'undefined'),
  'Sin el botón «Guardar este despacho para reutilizarlo» (ni su función)');
const reg = await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'dn', clase: 'JUZGADO', tipo: 'JCG', nombre: 'Juzgado 9 Penal', municipio: 'Medellín', nunc: '0500160001202601', barrio: 'Centro' }];
  DB.saveConfig(cfg);
  wc.oj.destino.nombre = 'Juzgado 9 Penal'; wc.oj.destino.direccion = 'CL 44 # 52-165';
  ojDespachoAlRegistro(wc.oj.destino);
  return DB.getConfig().despachosPropios;
});
log(reg.length === 1 && reg[0].nunc === '0500160001202601' && reg[0].barrio === 'Centro' && reg[0].direccion === 'CL 44 # 52-165',
  'El destinatario (con dirección) sí se registra, y fusiona: no duplica ni borra el NUNC', JSON.stringify(reg[0]));

/* ═════════════════════════════════════════════════════════════════════════ */
sec('D · EL MOTIVO, ESCRITO A MANO');
const ops = await page.$$eval('#oj-o-fin option', o => o.map(x => x.textContent));
log(ops[ops.length - 1] === 'Escribir a mano', 'La última opción es «Escribir a mano»', ops[ops.length - 1]);
const hint = await page.evaluate(() => /De aquí sale la fila/.test(document.getElementById('wz-panels').innerText));
log(!hint, 'Sin la nota «De aquí sale la fila «Motivo de la Captura»…»');
await page.selectOption('#oj-o-fin', 'IMPUTACION'); await page.waitForTimeout(200);
await page.selectOption('#oj-o-fin', 'OTRA'); await page.waitForTimeout(200);
log(await page.inputValue('#oj-o-fino') === 'Comparecencia a formulación de imputación',
  'El campo nace con la opción que estaba elegida, para escribirla de otra manera');
log(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'oj-o-fino', '…y con el cursor puesto');
await page.fill('#oj-o-fino', 'Para que comparezca a la audiencia de imputación de cargos');
const mot = await page.evaluate(() => { ojCollect(); return { txt: ojMotivoTexto(wc), fin: ojFinalidad(wc.oj.orden), cal: f6Calidad(wc), r: ojResolverDestino(wc).regla }; });
log(mot.txt === 'Para que comparezca a la audiencia de imputación de cargos', 'El oficio imprime lo escrito a mano', mot.txt);
log(mot.fin === 'IMPUTACION' && /R3/.test(mot.r) && mot.cal === 'INDICIADO', '…y la ruta procesal sigue siendo la de la opción de la que se partió', mot.r);
await page.selectOption('#oj-o-fin', 'CONDENA'); await page.waitForTimeout(200);
log(!(await page.$('#oj-o-fino')) && await page.evaluate(() => wc.oj.orden.finalidadBase === ''), 'Volver a una opción del catálogo quita el campo y la base');
const desde0 = await page.evaluate(() => { const c = ojNuevoCaso(); c.oj.orden.finalidad = 'OTRA'; c.oj.orden.finalidadOtra = 'Algo distinto'; return [ojFinalidad(c.oj.orden), ojMotivoTexto(c)]; });
log(desde0[0] === 'OTRA' && desde0[1] === 'Algo distinto', 'Escrito a mano desde cero: es «otra» y la ruta no se adivina');

/* ═════════════════════════════════════════════════════════════════════════ */
sec('E · LA HORA, SIEMPRE EN 24 H');
await nuevoOJ(2);
const hor = await page.$eval('#oj-g-hor', e => ({ t: e.type, m: e.inputMode, ph: e.placeholder }));
log(hor.t === 'text' && hor.m === 'numeric' && hor.ph === 'HH:MM', 'La hora es un campo numérico «HH:MM», no el reloj del sistema (a. m./p. m.)', JSON.stringify(hor));
const prueba = async (teclas, esperado, etiqueta) => {
  await page.fill('#oj-g-hor', ''); await page.click('#oj-g-hor'); await page.keyboard.type(teclas); await page.click('#oj-g-bar');
  const v = await page.inputValue('#oj-g-hor');
  log(v === esperado, etiqueta, v);
};
await prueba('1741', '17:41', 'Se escribe de corrido: «1741» → 17:41');
await prueba('930', '09:30', '«930» → 09:30');
await prueba('2359', '23:59', '«2359» → 23:59');
await prueba('17', '17:00', '«17» → 17:00');
await page.fill('#oj-g-hor', ''); await page.click('#oj-g-hor'); await page.keyboard.type('174'); await page.click('#oj-g-bar');
log(await page.$eval('#oj-g-hor', e => e.classList.contains('fi-err')), 'Una hora a medias («17:4») se marca en rojo; una imposible ni se deja escribir');
await prueba('0805', '08:05', 'Corregida, deja de estar en rojo');
log(!(await page.$eval('#oj-g-hor', e => e.classList.contains('fi-err'))), '…sin la marca');
log(await page.evaluate(() => { ojCollect(); return wc.oj.diligencia.hora; }) === '08:05', 'El modelo guarda «HH:MM», como siempre');
// Todos los campos de hora de la app.
const horas = await page.evaluate(async () => {
  const out = {};
  wc = null; await DB.clearDraft(); startWizard('URI');
  await new Promise(r => setTimeout(r, 200));
  wizGoto(getWizConfig().steps.indexOf('Narración')); await new Promise(r => setTimeout(r, 300));
  out.flagrancia = ['w-hcap', 'w-hdisp'].map(id => (document.getElementById(id) || {}).type);
  wc = null; go('capturas');
  const c = SIM.genFlagrancia(); await DB.saveCase(c);
  f6Abrir(c.id, 0); await new Promise(r => setTimeout(r, 200));
  out.acta = (document.getElementById('f6-com-hora') || {}).type; closeModal();
  const e = (c.elementos || []).filter(x => x && x.desc)[0];
  if (e) { lcEmpIds(c.elementos); await DB.saveCase(c); rtAbrir(c.id, DB.getCase(c.id).elementos[0].id); await new Promise(r => setTimeout(r, 200));
    out.rotulo = (document.getElementById('rt-hora') || {}).type; closeModal(); }
  out.nativos = document.querySelectorAll('input[type=time]').length;
  return out;
});
log(horas.flagrancia.every(t => t === 'text'), 'Flagrancia: hora de la captura y de la puesta a disposición en 24 h', horas.flagrancia.join(','));
log(horas.acta === 'text', 'Acta de derechos: hora de la comunicación en 24 h', horas.acta);
log(horas.rotulo === undefined || horas.rotulo === 'text', 'Rótulo: hora de recolección en 24 h', String(horas.rotulo));
const fuente = await readFile(join(ROOT, 'LexCapture_v8.html'), 'utf8');
log(!/type=["']time["']/.test(fuente), 'No queda un solo <input type="time"> en la app');

/* ═════════════════════════════════════════════════════════════════════════ */
sec('F · «QUIÉN HIZO LA DILIGENCIA» SALE DEL FORMULARIO');
await nuevoOJ(2);
const q = await page.evaluate(() => ({ txt: /Quién hizo la diligencia/.test(document.getElementById('wz-panels').innerText),
  uni: !!document.getElementById('oj-g-uni'), lista: !!document.getElementById('oj-list-funcionarios'),
  f: wc.oj.diligencia.funcionarios.map(x => x.nombre), u: wc.oj.diligencia.unidad }));
log(!q.txt && !q.uni && !q.lista, 'El paso 3 ya no tiene el bloque ni sus campos');
log(q.f.join('|') === 'NELSON DAVID GOMEZ|JUAN PEREZ' && /32/.test(q.u), 'Los funcionarios y la unidad salen solos del perfil', JSON.stringify(q.f) + ' · ' + q.u);
const conserva = await page.evaluate(async () => {
  wc = null; await DB.clearDraft();
  const c = SIM.genOJ(); c.oj.diligencia.funcionarios = [{ grado: 'Intendente', nombre: 'OTRO FUNCIONARIO', cedula: '9', placa: '' }];
  await DB.saveCase(c); editCase(c.id); await new Promise(r => setTimeout(r, 300));
  wizGoto(2); await new Promise(r => setTimeout(r, 300));
  await ojGuardarCaso(true);
  const k = DB.getCase(c.id); wc = null; go('capturas');
  return k.oj.diligencia.funcionarios.map(x => x.nombre);
});
log(conserva.join('') === 'OTRO FUNCIONARIO', 'Una captura que traía otros funcionarios los conserva al guardarse', conserva.join(','));
const sinF = await page.evaluate(() => {
  const c = ojNuevoCaso(); c.oj.diligencia.funcionarios = [];
  const cfg = DB.getConfig(); const p = cfg.perfiles; cfg.perfiles = []; DB.saveConfig(cfg);
  const vs = ojValidar(c).filter(x => x.id === 'V15');
  cfg.perfiles = p; DB.saveConfig(cfg);
  return vs[0] || null;
});
log(!!sinF && sinF.ir === 'perfil' && /Perfil/.test(sinF.msg), 'Sin perfil, la revisión lo dice y manda a Perfil', sinF && sinF.msg);
const relleno = await page.evaluate(() => { const c = SIM.genOJ(); c.oj.diligencia.funcionarios = []; c.oj.diligencia.unidad = ''; ojNormalizar(c); return c.oj.diligencia.funcionarios.length; });
log(relleno === 2, 'Un caso que no los traía los toma del perfil al abrirse');

/* ═════════════════════════════════════════════════════════════════════════ */
sec('G · SE VE');
await nuevoOJ(1);
await page.evaluate(() => { document.getElementById('oj-list-delitos').scrollIntoView({ block: 'start' }); });
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'verify_formulario_oj_delitos.png') });
await page.evaluate(() => { document.getElementById('oj-d-nom').scrollIntoView({ block: 'start' }); });
await page.screenshot({ path: join(ROOT, 'verify_formulario_oj_motivo.png') });
await page.evaluate(() => wizGoto(2)); await page.waitForTimeout(300);
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await page.screenshot({ path: join(ROOT, 'verify_formulario_oj_paso3_oscuro.png') });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
log(ancho, 'Sin desborde horizontal a 384 px');

log(errs.length === 0, 'Consola sin errores', errs.slice(0, 3).join(' | ') || 'limpia');
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
