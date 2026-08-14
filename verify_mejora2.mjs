/* Regresión de «Mejora 2» — el módulo de orden judicial, rediligenciado contra
   «Documentos/Otro/Propuesta_Plantilla_OJ.docx».
   Una sección por observación del documento de campo:
     1. Destinatario del informe: Juzgado o Fiscalía.
     2. El formulario sigue el orden del formato.
     3. Numerales 2 y 3: solo los datos del formato, en su orden + vigencia.
     4. El apartado de prórroga desapareció.
     5. Información duplicada, unificada.
     6. Información irrelevante, eliminada.
   ⚠️ Las etiquetas esperadas NO están escritas a mano: se leen del .docx real
   de la plantilla, así que si el formato cambia, este test lo dice. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { inflateRawSync } from 'zlib';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8152;
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
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}

/* ═══════════ 0. La plantilla de referencia, leída del .docx real ═══════════ */
function leerDocx(buf, nombre) {
  // Lector mínimo de ZIP: busca la entrada por nombre y la infla si hace falta.
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const metodo = buf.readUInt16LE(i + 8);
    const comp = buf.readUInt32LE(i + 18);
    const nLen = buf.readUInt16LE(i + 26), eLen = buf.readUInt16LE(i + 28);
    const nom = buf.slice(i + 30, i + 30 + nLen).toString('utf8').replace(/\\/g, '/');
    const ini = i + 30 + nLen + eLen;
    if (nom !== nombre) continue;
    const datos = buf.slice(ini, ini + comp);
    return metodo === 8 ? inflateRawSync(datos) : datos;
  }
  return null;
}
const tplBuf = await readFile(join(ROOT, 'Documentos/Otro/Propuesta_Plantilla_OJ.docx'));
const tplXml = leerDocx(tplBuf, 'word/document.xml').toString('utf8');
// Etiquetas = primera celda de cada fila de las tres tablas del formato.
function filasDeTablas(xml) {
  const cuerpo = xml.slice(xml.indexOf('<w:body>'));
  const tablas = [];
  let pos = 0, prof = 0, ini = 0;
  while (pos < cuerpo.length) {
    const lt = cuerpo.indexOf('<', pos); if (lt < 0) break;
    const gt = cuerpo.indexOf('>', lt); if (gt < 0) break;
    const raw = cuerpo.slice(lt + 1, gt);
    const cierra = raw[0] === '/', solo = raw.endsWith('/');
    const nm = raw.replace(/^\//, '').split(/[ >/]/)[0];
    if (nm === 'w:tbl') {
      if (!cierra && !solo) { if (prof === 0) ini = lt; prof++; }
      else if (cierra) { prof--; if (prof === 0) tablas.push(cuerpo.slice(ini, gt + 1)); }
    }
    pos = gt + 1;
  }
  // ⚠️ En el .docx real las etiquetas traen atributos (`<w:tr w:rsidR="…">`):
  // hay que partir por el nombre de la etiqueta, no por la cadena literal.
  const txt = s => (s.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(r => r.replace(/<[^>]+>/g, '')).join('').trim();
  const partir = (s, tag) => s.split(new RegExp('<' + tag + '(?:\\s[^>]*)?>')).slice(1);
  return tablas.map(t => partir(t, 'w:tr').map(fila => txt(partir(fila, 'w:tc')[0] || '')));
}
const tplFilas = filasDeTablas(tplXml);
log(tplFilas.length === 3, 'La plantilla de referencia trae sus 3 tablas', tplFilas.map(f => f.length).join(' + '));
log(tplFilas.map(f => f.length).join(',') === '9,10,3',
  'Con 9 + 10 + 3 filas: el numeral 3 del formato tiene TRES', tplFilas.map(f => f.length).join(' + '));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '112233');
await page.fill('#pin-b', '112233');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'MINISTERIO M2'; cfg.ojInstitucion = 'INSTITUCION M2';
  cfg.ojUnidad = 'UNIDAD M2'; cfg.ojDependencia = 'DEPENDENCIA M2';
  cfg.ojCiudad = 'Ciudad M2';
  cfg.ojCustEstacion = 'Estacion M2'; cfg.ojCustDireccion = 'Calle M2 10-20';
  cfg.ojCustTelefono = '6040000000'; cfg.ojCustCorreo = 'm2@prueba.test'; cfg.ojPieWeb = 'www.m2.test';
  // Obs. 1 — la fiscalía se configura UNA vez.
  cfg.ojFiscaliaNombre = 'FISCALIA URI CENTRO';
  cfg.ojFiscaliaDireccion = 'Carrera 64C 67-300, barrio Caribe';
  cfg.ojFiscaliaMunicipio = 'Medellin'; cfg.ojFiscaliaDepartamento = 'Antioquia';
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'FIRMANTE M2', cargo: 'Patrullero', telefono: '3000000000', correo: 'f@m2.test' }];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
});

/* Caso completo, montado por modelo: las secciones que siguen miden el
   documento, no el tecleo (eso ya lo cubre verify_oj). */
const semilla = () => page.evaluate(() => {
  const hoy = new Date().toISOString().slice(0, 10);
  const c = ojNuevoCaso();
  c.oj.orden.numero = '671-4737';
  c.oj.orden.fechaExpedicion = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'CONDENA';
  c.oj.orden.verificacion.hora = '07:40';
  c.oj.despacho.nombre = 'Juzgado Tercero Penal Municipal con F.C.G. de Medellin';
  c.oj.despacho.direccion = 'Palacio de Justicia, oficina 301';
  c.oj.despacho.municipio = 'Medellin'; c.oj.despacho.departamento = 'Antioquia';
  c.oj.proceso.radicado = '8303662786793202626398';
  c.oj.proceso.codigoInterno = '2026-671473';
  c.oj.proceso.fechaDecision = '2026-06-12';
  c.oj.proceso.fechaHechos = '2025-01-20';
  c.oj.proceso.delitos = [{ nombre: 'Hurto agravado con violencia', articulo: '239, 240 y 241' }];
  c.oj.requerido.priNom = 'YEISON'; c.oj.requerido.priApe = 'RAMIREZ'; c.oj.requerido.segApe = 'ROMERO';
  c.oj.requerido.numDoc = '1159794405'; c.oj.requerido.fechaNac = '1967-02-17';
  c.oj.requerido.profesion = 'Desempleado';
  c.oj.requerido.madre = 'Paula Ramirez'; c.oj.requerido.padre = 'Felipe Betancur';
  c.oj.requerido.resDireccion = 'Calle 74 No 60-97'; c.oj.requerido.resTelefono = '3169123334';
  c.oj.requerido.senales = 'Estatura 1.64, piel triguena.';
  c.oj.diligencia.fecha = hoy; c.oj.diligencia.hora = '23:06';
  c.oj.diligencia.lugarDireccion = 'Calle 59 con carrera 52';
  c.oj.diligencia.lugarBarrio = 'La Candelaria';
  c.oj.diligencia.lugarMunicipio = 'Medellin'; c.oj.diligencia.lugarDepartamento = 'Antioquia';
  c.oj.diligencia.funcionarios = [{ grado: 'Subintendente', nombre: 'FIRMANTE M2' }];
  c.oj.actuacion.derechos = { leidos: true, fecha: hoy, hora: '23:20', lugar: 'el sitio', observacion: '' };
  window.__caso = c;
  return true;
});
await semilla();

/* ══════════ Obs. 1 · Destinatario del informe: Juzgado o Fiscalía ══════════ */
const via = await page.evaluate(async () => {
  const armar = async (v) => {
    const c = JSON.parse(JSON.stringify(window.__caso));
    c.oj.destino.via = v;
    ojDestinoDesdeVia(c, true);
    ojAplicarSugerencia(c);
    const out = await buildOficioOJBlob(c, 'CARTA');
    const xml = new TextDecoder().decode(out.files['word/document.xml']);
    return { destino: c.oj.destino, parrafos: (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')) };
  };
  const fis = await armar('FISCALIA'), juz = await armar('JUZGADO');
  // ¿Qué líneas del documento cambian entre una vía y la otra?
  const distintas = [];
  const max = Math.max(fis.parrafos.length, juz.parrafos.length);
  for (let i = 0; i < max; i++) if (fis.parrafos[i] !== juz.parrafos[i]) distintas.push([fis.parrafos[i], juz.parrafos[i]]);
  return { fis: fis.destino, juz: juz.destino, distintas, nFis: fis.parrafos.length, nJuz: juz.parrafos.length };
});
log(via.fis.nombre === 'FISCALIA URI CENTRO' && via.fis.direccion === 'Carrera 64C 67-300, barrio Caribe' &&
    via.fis.municipio === 'Medellin',
  'Fiscalía: nombre y dirección salen de Ajustes, no de la captura', via.fis.nombre + ' · ' + via.fis.direccion);
log(via.juz.nombre === 'Juzgado Tercero Penal Municipal con F.C.G. de Medellin' &&
    via.juz.direccion === 'Palacio de Justicia, oficina 301',
  'Juzgado: se reutiliza la autoridad solicitante del numeral 2 con su dirección', via.juz.nombre);
log(via.nFis === via.nJuz,
  'El informe tiene la MISMA estructura en las dos vías: solo cambia el contenido de unas líneas',
  via.nFis + ' vs ' + via.nJuz + ' fragmentos');
log(via.distintas.length <= 5,
  'Y solo cambian el encabezado del destinatario y la frase de la puesta a disposición',
  via.distintas.length + ' líneas distintas');
log(via.distintas.some(p => /puesto a disposici[oó]n de la Fiscal/.test(p[0]) && /puesto a disposici[oó]n del despacho judicial/.test(p[1])),
  'La narración nombra a la Fiscalía o al despacho judicial según la vía elegida');
log(via.distintas.some(p => /FISCALIA URI CENTRO/.test(p[0]) && /JUZGADO TERCERO/.test(p[1])),
  'Y el encabezado abre con el destinatario correcto en cada caso');

/* ══════════ Obs. 2 · El formulario sigue el orden del formato ══════════ */
const orden = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 0; go('wizard'); renderWiz();
  const bloques = [];
  for (let i = 0; i < 4; i++) {
    ws = i; renderWiz();
    bloques.push({
      // Mejora 3 (obs. 1): el bloque del capturado se presenta como tarjeta y su
      // formulario vive en un modal — sigue siendo el numeral 1 de la pantalla 1.
      requerido: !!document.querySelector('#wz-panels .oj-persona.vacia, #wz-panels .pcard'),
      orden: !!document.getElementById('oj-o-num'),
      proceso: !!document.getElementById('oj-p-rad'),
      solicitante: !!document.getElementById('oj-d-nom'),
      diligencia: !!document.getElementById('oj-g-fec'),
      destino: !!document.getElementById('oj-x-nom')
    });
  }
  return { pasos: OJ_STEPS, bloques };
});
log(orden.bloques[0].requerido && !orden.bloques[0].orden,
  'Paso 1 = numeral 1 del formato (el capturado), y nada de la orden todavía');
log(orden.bloques[1].orden && orden.bloques[1].proceso && orden.bloques[1].solicitante,
  'Paso 2 = numeral 2 completo: orden, proceso y autoridad solicitante');
log(orden.bloques[2].diligencia, 'Paso 3 = numeral 3: la materialización');
log(orden.bloques[3].destino, 'Paso 4 = revisión y destinatario, antes de generar');

/* ══════════ Obs. 3 · Numerales 2 y 3: los datos del formato, en su orden ══ */
const tablas = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.destino.via = 'JUZGADO'; ojDestinoDesdeVia(c, true); ojAplicarSugerencia(c);
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  const cuerpo = xml.slice(xml.indexOf('<w:body>'));
  const tbl = [];
  let pos = 0, prof = 0, ini = 0;
  while (pos < cuerpo.length) {
    const lt = cuerpo.indexOf('<', pos); if (lt < 0) break;
    const gt = cuerpo.indexOf('>', lt); if (gt < 0) break;
    const raw = cuerpo.slice(lt + 1, gt);
    const cierra = raw[0] === '/', solo = raw.endsWith('/');
    const nm = raw.replace(/^\//, '').split(/[ />]/)[0];
    if (nm === 'w:tbl') {
      if (!cierra && !solo) { if (prof === 0) ini = lt; prof++; }
      else if (cierra) { prof--; if (prof === 0) tbl.push(cuerpo.slice(ini, gt + 1)); }
    }
    pos = gt + 1;
  }
  const txt = s => (s.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(r => r.replace(/<[^>]+>/g, '')).join('').trim();
  return tbl.map(t => t.split('<w:tr>').slice(1).map(f => txt(f.split('<w:tc>')[1] || '')));
});
const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
for (let i = 0; i < 3; i++) {
  const esperadas = (tplFilas[i] || []).map(norm);
  const reales = (tablas[i] || []).map(norm);
  log(esperadas.join('|') === reales.join('|'),
    'Numeral ' + (i + 1) + ': las etiquetas del informe son EXACTAMENTE las del formato, en su orden',
    reales.length + ' filas');
}

/* La vigencia se conserva y avisa; el resto del formulario sigue funcionando. */
const vigencia = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.orden.fechaExpedicion = '2015-01-01';           // vencida hace años
  const v = ojVigencia(c.oj.orden);
  const val = ojValidar(c).find(x => x.id === 'V01');
  wc = c; ws = 3; go('wizard'); renderWiz();
  const panel = document.getElementById('wz-panels').textContent;
  ws = 1; renderWiz();
  const paso2 = document.getElementById('wz-panels').textContent;
  return {
    estado: v.estado, nivel: val && val.nivel,
    bloquea: ojDuras(c).some(x => x.id === 'V01'),
    avisoRevision: /la orden figura vencida/i.test(panel),
    avisoPaso2: /vigencia de la orden/i.test(paso2) && /venci[oó]/i.test(paso2),
    confirma: !!ojVigenciaVencida(c),
    // Y el resto del formulario sigue diligenciable
    camposVivos: document.querySelectorAll('#wz-panels input:not([disabled])').length
  };
});
log(vigencia.estado === 'VENCIDA', 'La verificación automática de vigencia se conserva intacta', vigencia.estado);
log(vigencia.avisoPaso2 && vigencia.avisoRevision,
  'Una orden no vigente muestra un cuadro de advertencia — en el paso y en la revisión');
log(vigencia.bloquea === false && vigencia.nivel === 'BLANDA' && vigencia.camposVivos > 5,
  'Sin alterar el funcionamiento del resto del formulario', vigencia.camposVivos + ' campos siguen activos');
log(vigencia.confirma === true, 'Pero generar con orden vencida exige confirmarlo');

/* Y ese «confirmarlo» es real: la descarga se detiene en un cuadro que hay que
   aceptar, y solo entonces produce el .docx. */
await page.evaluate(async () => {
  window.__dl = [];
  const od = window._dlDocBlob;
  window._dlDocBlob = function (b, f) { window.__dl.push(f); return od(b, f); };
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.id = 'vencido1';
  c.oj.orden.fechaExpedicion = '2015-01-01';
  c.oj.destino.via = 'JUZGADO'; ojDestinoDesdeVia(c, true); ojAplicarSugerencia(c);
  ojEspejar(c);
  await DB.saveCase(c);
  const cfg = DB.getConfig(); cfg.papel = 'CARTA'; DB.saveConfig(cfg);   // sin diálogo de papel
  descargarDocCaso('vencido1');
});
await page.waitForTimeout(250);
if (await page.isVisible('#exp-go').catch(() => false)) { await page.click('#exp-fmt-DOCX').catch(() => {}); await page.click('#exp-go'); }
await page.waitForTimeout(400);
const cuadro = await page.evaluate(() => ({
  abierto: document.getElementById('modal').classList.contains('open'),
  texto: document.getElementById('modal-c').textContent,
  descargas: window.__dl.length
}));
log(cuadro.abierto === true && /vencid/i.test(cuadro.texto) && cuadro.descargas === 0,
  'Descargar con orden vencida se detiene en el cuadro de advertencia, sin producir nada');
log(/AP4491-2016/.test(cuadro.texto) && /libertad inmediata/i.test(cuadro.texto),
  'Y el cuadro cita la consecuencia legal, no solo «está vencida»');
await page.evaluate(() => ojSeguirVencida());
await page.waitForTimeout(900);
const trasConfirmar = await page.evaluate(() => window.__dl);
log(trasConfirmar.length === 1,
  'Confirmado, el informe SÍ se genera: la advertencia no deja al funcionario sin salida', trasConfirmar[0]);
await page.evaluate(async () => { closeModal(); await DB.delCase('vencido1'); });

/* ══════════ Obs. 4 · El apartado de prórroga desapareció ══════════ */
const prorroga = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 1; go('wizard'); renderWiz();
  document.querySelectorAll('#wz-panels details').forEach(d => d.open = true);
  return {
    enFormulario: !!document.getElementById('oj-list-prorrogas'),
    enTexto: /prórroga|prorroga/i.test(document.getElementById('wz-panels').textContent),
    enCatalogo: !!(typeof OJ_LISTS !== 'undefined' && OJ_LISTS.prorrogas),
    enModelo: 'prorrogas' in ojEstructura().orden,
    // ⚠️ Pero el cálculo las sigue respetando en una captura ya guardada.
    calculo: ojVigencia({ fechaExpedicion: '2020-01-01', vigenciaMeses: 12, prorrogas: [{ hasta: '2030-12-31' }] }).hasta
  };
});
log(prorroga.enFormulario === false && prorroga.enTexto === false && prorroga.enCatalogo === false,
  'El apartado de prórroga se eliminó del formulario por completo');
log(prorroga.enModelo === false, 'Y del modelo de datos de las capturas nuevas');
log(prorroga.calculo === '2030-12-31',
  '⚠️ Pero una captura guardada con prórroga conserva la vigencia con que se emitió', prorroga.calculo);

/* ══════════ Obs. 5 · Información duplicada, unificada ══════════ */
const duplicados = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 1; go('wizard'); renderWiz();
  document.querySelectorAll('#wz-panels details').forEach(d => d.open = true);
  const r = {
    // (a) Finalidad + «motivo — texto íntegro»: eran dos campos para un dato.
    finalidad: !!document.getElementById('oj-o-fin'),
    motivoTextual: !!document.getElementById('oj-o-motivo'),
    // (b) Autoridad solicitante + despacho que libró: dos campos, un despacho.
    solicitante: !!document.getElementById('oj-d-nom'),
    solicitanteLibre: !!document.getElementById('oj-o-solic')
  };
  // La opción «Otra» abre el campo para escribirlo a mano.
  document.getElementById('oj-o-fin').value = 'OTRA';
  ojCollect(); renderWiz();
  document.querySelectorAll('#wz-panels details').forEach(d => d.open = true);
  r.manual = !!document.getElementById('oj-o-fino');
  document.getElementById('oj-o-fino').value = 'Orden de captura por inasistencia alimentaria';
  ojCollect();
  r.motivoDoc = ojMotivoTexto(wc);
  // Y el espejo del despacho ⇒ autoridad solicitante es automático.
  document.getElementById('oj-d-nom').value = 'Juzgado Único de Prueba';
  ojCollect();
  r.espejo = wc.oj.orden.autoridadSolicitante;
  return r;
});
log(duplicados.finalidad && duplicados.motivoTextual === false,
  'El motivo de la captura se pide UNA vez: se elige del catálogo');
log(duplicados.manual === true && duplicados.motivoDoc === 'Orden de captura por inasistencia alimentaria',
  'Y con «Otro motivo» se puede escribir a mano lo que el informe imprimirá', duplicados.motivoDoc);
log(duplicados.solicitante && duplicados.solicitanteLibre === false,
  'La autoridad solicitante también se pide UNA vez, no en dos pasos distintos');
log(duplicados.espejo === 'Juzgado Único de Prueba',
  'Y el modelo mantiene sincronizado su espejo, sin volver a preguntar', duplicados.espejo);

/* ══════════ Obs. 6 · Información irrelevante, eliminada ══════════ */
const irrelevantes = await page.evaluate(() => {
  const ids = {
    'oj-o-vsis': 'Sistema o medio de consulta',
    'oj-o-vres': 'Resultado de la verificación',
    'oj-o-meses': 'Vigencia (meses)',
    'oj-o-estado': 'Estado de la orden',
    'oj-d-tipo': 'Tipo de despacho',
    'oj-d-firma': 'Firma que trae la orden',
    'oj-d-tel': 'Teléfono del despacho',
    'oj-d-cor': 'Correo del despacho',
    'oj-x-tipo': 'Tipo del destinatario'
  };
  const vivos = [];
  for (let i = 0; i < 4; i++) {
    wc = wc || ojNuevoCaso(); ws = i; renderWiz();
    document.querySelectorAll('#wz-panels details').forEach(d => d.open = true);
    Object.keys(ids).forEach(id => { if (document.getElementById(id) && vivos.indexOf(ids[id]) < 0) vivos.push(ids[id]); });
  }
  return { vivos, catalogos: ['especialidad', 'firmaOrden'].filter(k => OJ_CAT[k]) };
});
log(irrelevantes.vivos.length === 0,
  'Los datos señalados como irrelevantes ya no se piden en ninguna pantalla', irrelevantes.vivos.join(', ') || 'ninguno');
log(irrelevantes.catalogos.length === 0,
  'Y sus catálogos se retiraron con ellos: no queda código muerto', irrelevantes.catalogos.join(',') || 'ninguno');

/* ══════════ Lo que NO se podía romper ══════════ */
const intacto = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.destino.via = 'FISCALIA'; ojDestinoDesdeVia(c, true); ojAplicarSugerencia(c);
  ojEspejar(c);
  await DB.saveCase(c);
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  let dossier = '';
  try { dossier = genDossier(DB.getCase(c.id)); } catch (e) { dossier = 'ERROR: ' + e.message; }
  // Y el FPJ-5 de flagrancia, que no comparte una línea con este módulo.
  const f = SIM.genFlagrancia('flagrancia-uri'); f.nunc = '0500160002062026';
  const fpj = buildFPJBlob(f);
  return {
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    filas: (xml.match(/<w:tr>/g) || []).length,
    secciones: (xml.match(/Ttulo1/g) || []).length,
    anchos: (xml.match(/<w:tblW w:w="9405"/g) || []).length,
    etiqueta: (xml.match(/<w:gridCol w:w="3119"\/>/g) || []).length,
    marcadores: /\{\{/.test(xml),
    dossier, fpj: !!fpj
  };
});
log(intacto.tablas === 3 && intacto.filas === 22 && intacto.secciones === 3,
  'La lógica documental del Word no se tocó: 3 tablas, 22 filas, 3 apartados',
  intacto.tablas + ' / ' + intacto.filas + ' / ' + intacto.secciones);
log(intacto.anchos === 3 && intacto.etiqueta === 3,
  'Con la geometría del formato intacta (9405 twips, etiquetas a 3119)');
log(intacto.marcadores === false, 'Cero marcadores sin resolver');
/* ⚠️ La edad se calculaba solo al pintar el formulario: un caso montado por el
   simulador o guardado antes llegaba al informe con la fila «Edad» en blanco. */
const edad = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.requerido.edad = '';                       // nunca pasó por el formulario
  c.oj.destino.via = 'JUZGADO'; ojDestinoDesdeVia(c, true); ojAplicarSugerencia(c);
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return (xml.match(/<w:t[^>]*>(\d+ años)<\/w:t>/) || [])[1] || '';
});
log(/^\d+ años$/.test(edad), 'La fila «Edad» se deriva de la fecha de nacimiento al imprimir, no solo en pantalla', edad);
log(/RAMIREZ/.test(intacto.dossier), 'El Dossier sigue funcionando sobre una captura de orden judicial');
log(intacto.fpj === true, 'Y el FPJ-5 de flagrancia se genera igual que antes');

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones, todas en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
