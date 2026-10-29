/* Regresión de «Revisión de la captura por orden judicial, sin saturación»
   (2026-10-26). Nueve observaciones del usuario sobre el paso 4 del formulario
   de orden judicial, más su extensión al paso 2, a la confirmación de orden
   vencida y al paso «Servidor» de flagrancia.
     A · lo que se retiró y lo que quedó en la revisión
     B · las faltas y advertencias, ordenadas
     C · lo retirado del formulario sigue llegando al oficio
     D · guardar abre el expediente
     E · el paso «Servidor» resumido
   ⚠️ El modelo del caso no cambió: lo que se mide en C es justo eso. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
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
function log(ok, label, extra) {
  n++; if (ok === false) fails++;
  console.log((ok ? 'OK  ' : 'FALLO'), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window._lcListo === true);
await page.waitForTimeout(300);

// Equipo configurado: membrete, custodia, fiscalía y perfil.
await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'SECTOR DE PRUEBA'; cfg.ojInstitucion = 'INSTITUCION DE PRUEBA';
  cfg.ojUnidad = 'UNIDAD DE PRUEBA'; cfg.ojDependencia = 'DISTRITO DOS DE PRUEBA';
  cfg.nombreEstacion = 'ESTACION DE PRUEBA'; cfg.ojCustEstacion = 'ESTACION DE PRUEBA';
  cfg.ojCustDireccion = 'CL 10 # 20-30'; cfg.ojCustTelefono = '3001112233'; cfg.ojCustCorreo = 'est@prueba.test';
  cfg.perfiles = [{ id: 'p1', nombre: 'FIRMANTE DE PRUEBA', grado: 'Subintendente', cargo: 'Integrante patrulla',
    cedula: '71234567', telefono: '3104445566', correo: 'firma@prueba.test', companero: {} }];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
});

/* Un caso de orden judicial completo, adulto, con la orden vencida. */
const casoBase = await page.evaluate(() => {
  let c;
  for (let i = 0; i < 40; i++) { c = SIM.genOJ(); if (!ojEsAdolescente(c)) break; }
  c.oj.orden.fechaExpedicion = '2023-01-01';
  /* Sin prórroga: el escenario antiguo del simulador trae una que vence en el
     futuro, y con ella la orden ya no estaba vencida (fallaba ~1 de 6 corridas). */
  c.oj.orden.prorrogas = [];
  c.oj.encabezado = { ministerio: '', institucion: '', unidad: '', dependencia: '' };
  c.oj.custodia = { estacion: '', direccion: '', barrio: '', ciudad: '', telefono: '', correo: '', web: '' };
  c.oj.firma = { grado: '', nombre: '', cargo: '', telefono: '', correo: '' };
  window.__caso = JSON.parse(JSON.stringify(c));
  return c.id;
});
const abrir = async (ajuste) => page.evaluate((aj) => {
  wc = ojNormalizar(JSON.parse(JSON.stringify(window.__caso)));
  if (aj) (new Function('wc', aj))(wc);
  ws = 3; document.getElementById('wz-title').textContent = 'Captura por orden judicial';
  go('wizard'); renderWiz();
}, ajuste || '');

/* ═══════════ A · La revisión ═══════════ */
await abrir();
await page.waitForTimeout(250);
const A = await page.evaluate(() => {
  const panel = document.querySelector('#wz-panels .wpn');
  const aviso = panel.querySelector('.oj-aviso.dura');
  const sel = document.getElementById('oj-x-via');
  const txt = panel.textContent;
  return {
    aviso: aviso ? aviso.textContent : '',
    avisoBtn: aviso ? (aviso.querySelector('button') || {}).getAttribute?.('onclick') : '',
    sel: sel ? sel.tagName : '', opciones: sel ? [...sel.options].filter(o => o.value).map(o => o.textContent) : [],
    via: wc.oj.destino.via,
    txt,
    v01EnLista: [...panel.querySelectorAll('.oj-av-it')].some(e => /VENCIDA/.test(e.textContent)),
    bloques: panel.querySelectorAll('.oj-blk').length
  };
});
const avisoTxt = A.aviso.replace('Revisar fecha', '').trim();
log(/figura vencida/i.test(A.aviso) && avisoTxt.length <= 110,
  '[1] El aviso de orden vencida es una línea puntual', avisoTxt.length + ' caracteres');
log(/wizGoto\(1\)/.test(A.avisoBtn || ''), '[1] Y trae el botón para revisar la fecha de expedición');
log(!A.v01EnLista, '[1] La lista de advertencias no repite el aviso de vencimiento');
log(A.sel === 'SELECT' && A.opciones.join(',') === 'Fiscalía,Juzgado',
  '[2] A quién se remite es una lista desplegable: Fiscalía o Juzgado', A.opciones.join(' / '));
const cambio = await page.evaluate(async () => {
  const sel = document.getElementById('oj-x-via');
  sel.value = sel.value === 'FISCALIA' ? 'JUZGADO' : 'FISCALIA';
  sel.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 150));
  return { via: wc.oj.destino.via, sel: document.getElementById('oj-x-via').value };
});
log(cambio.via === cambio.sel && cambio.via !== A.via, '[2] Cambiarla cambia el destinatario y repinta', A.via + ' → ' + cambio.via);
log(!/Por qué se propone/.test(A.txt), '[3] Sin «Por qué se propone este destinatario»');
log(!/36 h ·/.test(A.txt) && (await page.evaluate(() => typeof ojPlazoBarraHtml)) === 'undefined',
  '[4] Sin la barra de las 36 horas');
log(!/Resumen del informe/.test(A.txt) && (await page.evaluate(() => typeof ojResumenHtml)) === 'undefined',
  '[5] Sin «Resumen del informe»');
log(!/Constancia de entrega/.test(A.txt) && !(await page.evaluate(() => !!document.getElementById('oj-x-mot'))),
  '[6] Sin «Constancia de entrega»');
log(!/Encabezado, custodia y firma/.test(A.txt) && A.bloques === 0 &&
    !(await page.evaluate(() => ['oj-e-min', 'oj-c-est', 'oj-f-nom', 'oj-firma-wiz'].some(id => document.getElementById(id)))),
  '[7] Sin «Encabezado, custodia y firma»');
log(!/Generar oficio/.test(A.txt) && !/El informe reúne los datos exigibles/.test(A.txt) &&
    (await page.evaluate(() => typeof ojGenerarDesdeWizard)) === 'undefined',
  '[9] Sin «Listo» ni el botón de generar');

/* ═══════════ B · Faltas y advertencias ═══════════ */
const vacio = await page.evaluate(() => {
  const c = ojNuevoCaso();
  c.oj.encabezado = { ministerio: '', institucion: '', unidad: '', dependencia: '' };
  c.oj.custodia = { estacion: '', direccion: '' }; c.oj.firma = { nombre: '' };
  c.oj.orden.fechaExpedicion = '2015-01-01'; c.oj.destino.via = 'JUZGADO';
  const v = ojValidar(c);
  return { largos: v.filter(x => x.msg.length > 110).map(x => x.id + ':' + x.msg.length),
    ir: v.filter(x => ['V26', 'V27', 'V28', 'V29', 'V30', 'V31'].indexOf(x.id) >= 0).map(x => x.id + '=' + x.ir),
    v23: v.some(x => x.id === 'V23'), total: v.length };
});
log(vacio.largos.length === 0, '[8] Ningún aviso pasa de 110 caracteres', vacio.total + ' avisos · ' + (vacio.largos.join(', ') || 'todos cortos'));
log(vacio.ir.length === 6 && vacio.ir.every(x => /=(ajustes|perfil)$/.test(x)) && vacio.ir.indexOf('V28=perfil') >= 0,
  '[7] Membrete y custodia se corrigen en Ajustes; la firma, en Perfil', vacio.ir.join(' '));
log(!vacio.v23, '[6] El aviso del motivo del cambio se fue con la constancia (no hay dónde escribirlo)');

await abrir("wc.oj.orden.numero=''; wc.oj.diligencia.lugarDireccion=''; wc.oj.requerido.identidadMetodo='';");
await page.waitForTimeout(200);
const B = await page.evaluate(() => {
  const g = det => [...det.querySelectorAll('.oj-av-gr')].map(gr => ({
    hd: gr.querySelector('.oj-av-hd span').textContent,
    ir: (gr.querySelector('.oj-av-ir') || {}).getAttribute?.('onclick') || '',
    n: gr.querySelectorAll('.oj-av-it').length }));
  const dura = document.querySelector('#wz-panels details.oj-estado.dura');
  const blanda = document.querySelector('#wz-panels details.oj-estado.blanda');
  return { dura: dura ? g(dura) : [], blanda: blanda ? g(blanda) : [],
    tDura: dura ? dura.querySelector('summary').textContent : '', tBlanda: blanda ? blanda.querySelector('summary').textContent : '',
    plegada: dura ? !dura.open : null };
});
const pasos = B.dura.filter(x => /^Paso/.test(x.hd)).map(x => parseInt(x.hd.match(/\d+/)[0], 10));
log(B.dura.length >= 2 && pasos.every((p, i) => !i || p >= pasos[i - 1]),
  '[8] Las faltas se agrupan por el sitio donde se corrigen, en el orden del formulario', B.dura.map(x => x.hd + '(' + x.n + ')').join(' · '));
log(B.dura.every(x => x.ir), '[8] Cada grupo trae UN botón para ir a corregirlo');
log(/Faltan datos/.test(B.tDura) && /impiden generar/.test(B.tDura) && /Advertencias/.test(B.tBlanda) && /no impiden/.test(B.tBlanda),
  '[8] Cada barra dice qué es y si impide generar', B.tDura.trim() + ' | ' + B.tBlanda.trim());
log(B.plegada === true, '[8] Plegadas: no tapan la decisión del paso');

// Equipo sin el sector configurado: la falta no tiene arreglo en el formulario.
await page.evaluate(() => { const c = DB.getConfig(); c.ojMinisterio = ''; DB.saveConfig(c); });
await abrir();
const grAj = await page.evaluate(() => {
  const gr = [...document.querySelectorAll('#wz-panels .oj-av-gr')].find(x => /Ajustes/.test(x.textContent));
  return gr ? { ir: gr.querySelector('.oj-av-ir').getAttribute('onclick'), txt: gr.textContent } : null;
});
log(!!grAj && /ojIrConfig\('ajustes'\)/.test(grAj.ir) && /sector/.test(grAj.txt),
  '[7] Una falta del membrete lleva a Ajustes · Mi unidad', grAj && grAj.ir);
await page.evaluate(() => { document.querySelector('#wz-panels .oj-av-gr .oj-av-ir[onclick*="ajustes"]').click(); });
await page.waitForTimeout(500);
const trasIr = await page.evaluate(() => ({
  ajustes: document.getElementById('screen-ajustes').classList.contains('on'), wc: wc === null }));
log(trasIr.ajustes && trasIr.wc, '[7] Ir a Ajustes guarda el borrador y sale del formulario sin perder nada');
await page.evaluate(() => { const c = DB.getConfig(); c.ojMinisterio = 'SECTOR DE PRUEBA'; DB.saveConfig(c); DB.clearDraft && DB.clearDraft(); });

// El diálogo de faltantes al generar usa el mismo componente, abierto.
const modal = await page.evaluate(() => {
  const c = JSON.parse(JSON.stringify(window.__caso)); c.oj.orden.numero = '';
  ojModalFaltantes(c.id, ojDuras(ojNormalizar(c)), false);
  const m = document.getElementById('modal-c');
  const det = m.querySelector('details.oj-estado.dura');
  const out = { abierto: !!det && det.open, ir: [...m.querySelectorAll('.oj-av-ir')].map(b => b.getAttribute('onclick')) };
  closeModal(); return out;
});
log(modal.abierto && modal.ir.some(x => /ojCompletarCaso/.test(x)),
  '[8] El diálogo de faltantes al generar usa la misma lista agrupada', modal.ir.join(' · '));

// Confirmación de orden vencida: una línea + la cita.
const conf = await page.evaluate(() => {
  ojConfirmarVigencia(ojNormalizar(JSON.parse(JSON.stringify(window.__caso))), () => {});
  const a = document.querySelector('#modal-c .oj-alert.dura');
  const out = { txt: a ? a.childNodes[0].textContent : '', fund: a ? (a.querySelector('.oj-fund') || {}).textContent : '',
    botones: [...document.querySelectorAll('#modal-c button.btn')].map(b => b.textContent) };
  ojCancelarVencida(); return out;
});
log(conf.txt.length <= 110 && /libertad inmediata/.test(conf.txt) && /AP4491/.test(conf.fund),
  '[ext] La confirmación de orden vencida dice lo justo, con su cita', conf.txt.length + ' caracteres');
log(conf.botones.join('|') === 'Revisar la fecha|Generar de todos modos', '[ext] Y conserva sus dos salidas');

// Paso 2: el mismo aviso de una línea junto a la fecha de expedición.
const p2 = await page.evaluate(() => {
  wc = ojNormalizar(JSON.parse(JSON.stringify(window.__caso))); ws = 1; renderWiz();
  const b = document.getElementById('oj-vig-box');
  return { txt: b.textContent, aviso: !!b.querySelector('.oj-aviso.dura') };
});
log(p2.aviso && /figura vencida/.test(p2.txt) && p2.txt.length <= 110,
  '[ext] El paso 2 avisa la vigencia en una línea', p2.txt.length + ' caracteres');

/* ═══════════ C · Lo retirado sigue llegando al oficio ═══════════ */
const C = await page.evaluate(async () => {
  wc = ojNormalizar(JSON.parse(JSON.stringify(window.__caso)));
  wc.oj.destino.fechaEntrega = '2026-10-20'; wc.oj.destino.recibeNombre = 'RECIBE DE PRUEBA';
  wc.oj.destino.horaEntrega = '10:00'; wc.oj.destino.recibeCargo = 'Asistente';
  ws = 3; renderWiz(); ojCollect();
  const caso = JSON.parse(JSON.stringify(wc));
  const out = await buildOficioOJBlob(caso, 'CARTA');
  const dec = p => out.files[p] ? new TextDecoder().decode(out.files[p]).replace(/<[^>]+>/g, '') : '';
  const doc = dec('word/document.xml'), hdr = Object.keys(out.files).filter(k => /header/.test(k)).map(dec).join(' ');
  return { e: caso.oj.encabezado, cu: caso.oj.custodia, fi: caso.oj.firma, d: caso.oj.destino, doc, hdr };
});
log(C.e.ministerio === 'SECTOR DE PRUEBA' && C.e.unidad === 'UNIDAD DE PRUEBA' && /UNIDAD DE PRUEBA/.test(C.hdr),
  '[7] El membrete llega de Ajustes al caso y al oficio sin pedirse', C.e.unidad);
log(C.cu.direccion === 'CL 10 # 20-30' && /CL 10 # 20-30/.test(C.doc), '[7] La custodia llega de Ajustes al oficio', C.cu.direccion);
log(C.fi.nombre === 'FIRMANTE DE PRUEBA' && /FIRMANTE DE PRUEBA/.test(C.doc), '[7] Quien firma llega del perfil al oficio', C.fi.nombre);
log(C.d.recibeNombre === 'RECIBE DE PRUEBA' && /RECIBE DE PRUEBA/.test(C.doc),
  '[6] Una constancia de entrega ya guardada no se borra y se sigue imprimiendo');
log(!!C.d.reglaAplicada, '[3] La regla aplicada se sigue guardando para trazabilidad', C.d.reglaAplicada);

/* ═══════════ D · Guardar abre el expediente ═══════════ */
const D = await page.evaluate(async () => {
  wc = ojNormalizar(JSON.parse(JSON.stringify(window.__caso))); ws = 3; go('wizard'); renderWiz();
  await ojGuardarYSalir();
  await new Promise(r => setTimeout(r, 300));
  return { exp: document.getElementById('screen-dossier').classList.contains('on'), id: _dosCasoId,
    tarjeta: /Oficio de disposición/.test(document.getElementById('screen-dossier').textContent) };
});
log(D.exp && D.id === casoBase, '[9] Guardar abre el expediente de la captura');
log(D.tarjeta, '[9] Y ahí está la tarjeta del oficio: queda a un toque');

/* ═══════════ E · El paso «Servidor» de flagrancia ═══════════ */
const E = await page.evaluate(async () => {
  const c = SIM.genFlagrancia();
  const antes = JSON.parse(JSON.stringify(c.servidor));
  wc = c; ws = getWizConfig().steps.indexOf('Servidor'); go('wizard'); renderWiz();
  const res = document.getElementById('w-serv-res');
  const det = res && res.nextElementSibling;
  const out = { tarjeta: res ? res.textContent : '', plegado: det && det.tagName === 'DETAILS' && !det.open,
    campos: ['w-sNombre', 'w-sGrado', 'w-sId', 'w-sEntidad', 'w-sCargo', 'w-sTel', 'w-sCorreo'].filter(id => document.getElementById(id)).length };
  collectStep();
  out.igual = JSON.stringify(wc.servidor) === JSON.stringify(antes);
  out.antes = antes;
  const n = document.getElementById('w-sNombre'); n.value = 'OTRO NOMBRE DE PRUEBA';
  n.dispatchEvent(new Event('input', { bubbles: true }));
  out.repinta = /OTRO NOMBRE DE PRUEBA/.test(document.getElementById('w-serv-res').textContent);
  out.generar = /Generar oficio/.test(document.getElementById('wz-panels').textContent);
  return out;
});
log(E.antes.nombre && E.tarjeta.indexOf(E.antes.nombre) >= 0, '[ext] El paso Servidor resume en una tarjeta quién firma', E.tarjeta.slice(0, 60));
log(E.plegado && E.campos === 7, '[ext] Los siete campos quedan plegados en «Corregir para este informe»');
log(E.igual, '[ext] Plegar no es borrar: se recolectan los siete datos con el bloque cerrado');
log(E.repinta, '[ext] Corregir un dato actualiza la tarjeta al instante');
const legado = await page.evaluate(() => {
  const c = SIM.genFlagrancia(); c.tipo = 'OJ'; delete c.ojv;
  wc = c; ws = getWizConfig().steps.indexOf('Servidor'); renderWiz();
  return /Generar oficio/.test(document.getElementById('wz-panels').textContent);
});
log(!E.generar && !legado, '[ext] Ni el paso Servidor ofrece generar: el oficio sale del expediente');

log(errs.length === 0, 'Consola limpia en todo el recorrido', errs.join(' | ') || 'sin errores');

console.log(`\nRESULTADO: ${n - fails}/${n} comprobaciones`);
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
