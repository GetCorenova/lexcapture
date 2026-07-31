/* Regresión del módulo "Captura por orden judicial" (Fase I).
   Cubre: motores de vigencia / plazo de 36 h / destinatario, validación dura y blanda,
   recorrido real del wizard por sus 7 pasos, y el .docx generado (estructura OOXML,
   mapeo de datos, plantilla base limpia y plantilla de membrete personalizada).
   El .docx se deja en disco para abrirlo en Word real. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8131;
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
  n++;
  if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

/* ── Configuración institucional: nada de esto está escrito en el código ── */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'MINISTERIO DE PRUEBA';
  cfg.ojInstitucion = 'INSTITUCION DE PRUEBA';
  cfg.ojUnidad = 'UNIDAD DE PRUEBA';
  cfg.ojDependencia = 'DEPENDENCIA DE PRUEBA';
  cfg.ojCiudad = 'Ciudad Prueba';
  cfg.ojPieWeb = 'www.prueba.test';
  // Los mismos datos de custodia alimentan la constancia de la narración Y el
  // bloque de contacto del final del oficio (en el formato son los mismos).
  cfg.ojCustEstacion = 'Estación de Prueba Custodia';
  cfg.ojCustDireccion = 'Calle de custodia 9';
  cfg.ojCustTelefono = '6041111111';
  cfg.ojCustCorreo = 'custodia@prueba.test';
  cfg.perfiles = [{ id: 'pf1', grado: 'Subintendente', nombre: 'Nombre Firmante', cedula: '1.111.111', telefono: '3000000000', cargo: 'Integrante patrulla de vigilancia', correo: 'firmante@prueba.test' }];
  cfg.perfilActivo = 'pf1';
  DB.saveConfig(cfg);
});

/* ─────────── 1. Motores de cálculo ─────────── */
const motores = await page.evaluate(() => {
  const r = {};
  // Vigencia: 1 año desde la expedición (art. 298 CPP mod. Ley 1453/2011).
  r.vig12 = ojVigencia({ fechaExpedicion: '2026-01-26', vigenciaMeses: 12 }).hasta;
  // Órdenes anteriores a la Ley 1453 de 2011: 6 meses.
  r.vig6 = ojVigencia({ fechaExpedicion: '2010-01-31' }).hasta;
  // Prórroga: manda la fecha más lejana.
  r.vigProrroga = ojVigencia({ fechaExpedicion: '2020-01-01', vigenciaMeses: 12, prorrogas: [{ hasta: '2026-12-31' }] }).hasta;
  r.vencida = ojVigencia({ fechaExpedicion: '2000-01-01' }).estado;
  // Festivos de Colombia calculados (Ley 51 de 1983, traslado al lunes).
  const f2026 = ojFestivos(2026);
  r.reyes2026 = !!f2026['2026-01-12'];      // 6 de enero de 2026 (martes) → lunes 12
  r.trabajo2026 = !!f2026['2026-05-01'];    // 1 de mayo no se traslada
  r.viernesSanto = !!f2026['2026-04-03'];   // Pascua 2026: 5 de abril
  r.noFestivo = !!f2026['2026-01-06'];
  return r;
});
log(motores.vig12 === '2027-01-26', 'Vigencia de 12 meses', motores.vig12);
log(motores.vig6 === '2010-07-31', 'Vigencia de 6 meses para órdenes previas a la Ley 1453/2011', motores.vig6);
log(motores.vigProrroga === '2026-12-31', 'La prórroga extiende la vigencia', motores.vigProrroga);
log(motores.vencida === 'VENCIDA', 'Orden antigua se marca VENCIDA', motores.vencida);
log(motores.reyes2026 === true, 'Festivo trasladado al lunes (Reyes 2026 → 12 de enero)');
log(motores.trabajo2026 === true, 'Festivo fijo (1 de mayo) no se traslada');
log(motores.viernesSanto === true, 'Viernes Santo 2026 calculado (3 de abril)');
log(motores.noFestivo === false, 'El 6 de enero de 2026 no es festivo (se trasladó)');

/* ─────────── 2. Motor de decisión del destinatario ─────────── */
const destinos = await page.evaluate(() => {
  const base = () => {
    const c = ojNuevoCaso();
    c.oj.orden.fechaExpedicion = new Date().toISOString().slice(0, 10);
    c.oj.despacho.nombre = 'Juzgado de prueba';
    c.oj.requerido.fechaNac = '1990-05-05';
    c.oj.proceso.fechaHechos = '2024-01-01';
    return c;
  };
  const out = {};
  let c = base(); c.oj.orden.finalidad = 'IMPUTACION';
  out.imputacion = ojResolverDestino(c).regla;
  c = base(); c.oj.orden.finalidad = 'MEDIDA_ASEGURAMIENTO';
  out.medida = ojResolverDestino(c).regla;
  c = base(); c.oj.orden.tipoOrden = 'LEY600'; c.oj.orden.finalidad = 'INDAGATORIA';
  out.ley600 = ojResolverDestino(c).regla;
  c = base(); c.oj.orden.finalidad = 'EXTRADICION';
  out.extradicion = ojResolverDestino(c).regla;
  c = base(); c.oj.orden.finalidad = 'CONDENA';
  out.condena = ojResolverDestino(c).regla;
  out.condenaFund = ojResolverDestino(c).fundamento;
  // Adolescente al momento de los hechos → SRPA aunque hoy sea mayor.
  c = base(); c.oj.orden.finalidad = 'CONDENA'; c.oj.requerido.fechaNac = '2008-01-01'; c.oj.proceso.fechaHechos = '2024-06-01';
  out.srpa = ojResolverDestino(c).regla;
  out.termino = ojTermino(c).acc;
  // Orden vencida: no se propone destinatario.
  c = base(); c.oj.orden.finalidad = 'CONDENA'; c.oj.orden.fechaExpedicion = '2015-01-01';
  out.vencida = ojResolverDestino(c).regla;
  return out;
});
log(destinos.imputacion === 'R3-FISCAL-INVESTIGACION', 'Imputación → fiscal que dirige la investigación', destinos.imputacion);
log(destinos.medida === 'R3-FISCAL-INVESTIGACION', 'Medida de aseguramiento → fiscal', destinos.medida);
log(destinos.ley600 === 'R2-LEY600', 'Ley 600 → despacho que libró la orden', destinos.ley600);
log(destinos.extradicion === 'R6-EXTRADICION', 'Extradición → ruta propia', destinos.extradicion);
log(/^R4-/.test(destinos.condena), 'Condena → juez de conocimiento / ejecución de penas', destinos.condena);
log(/C-042 de 2018/.test(destinos.condenaFund), 'La ruta de condena cita C-042 de 2018');
log(destinos.srpa === 'R1-SRPA', 'Adolescente al momento de los hechos → SRPA', destinos.srpa);
log(destinos.termino === 'aprehensión', 'Terminología de menores: aprehensión, no captura', destinos.termino);
log(destinos.vencida === 'R0-ORDEN-VENCIDA', 'Orden vencida bloquea la propuesta de destinatario', destinos.vencida);

/* ─────────── 3. Validación ─────────── */
const validaciones = await page.evaluate(() => {
  const c = ojNuevoCaso();
  const vacio = ojValidar(c);
  const duras = vacio.filter(v => v.nivel === 'DURA').map(v => v.id);
  // Menor de 14 años: no es responsable penalmente.
  const m = ojNuevoCaso();
  m.oj.requerido.fechaNac = '2015-01-01';
  m.oj.proceso.fechaHechos = '2026-01-01';
  const menor = ojValidar(m).some(v => v.id === 'V11' && v.nivel === 'DURA');
  return { duras, menor };
});
log(validaciones.duras.includes('V01') === false, 'Sin fecha de expedición no se inventa una orden vencida');
// V13 (fecha/hora) y V15 (funcionarios) no aparecen porque el caso nuevo ya los
// precarga con la hora actual y el perfil activo: eso es lo esperado.
log(['V02', 'V03', 'V04', 'V05', 'V08', 'V09', 'V14', 'V16', 'V22'].every(id => validaciones.duras.includes(id)),
  'Un caso vacío dispara las validaciones duras de orden, despacho, identidad, lugar, derechos y destino',
  validaciones.duras.join(','));
log(validaciones.menor === true, 'Menor de 14 años al momento de los hechos → validación dura');

/* ─────────── 4. Recorrido real del wizard ─────────── */
await page.evaluate(() => go('nueva'));
await page.click('button[onclick="startWizard(\'OJ\')"]');
await page.waitForTimeout(250);
const pasos = await page.$$eval('#wz-prog .wd', els => els.length);
log(pasos === 4, 'El wizard de orden judicial tiene 4 pantallas (Ola 4: agrupadas por fuente del dato)', pasos);
log(await page.isVisible('#oj-o-num'), 'Paso 1 muestra los campos de la orden');

await page.fill('#oj-o-num', '002');
await page.selectOption('#oj-o-fin', 'CONDENA');
const hoy = new Date();
const expedicion = new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10);
await page.fill('#oj-o-fexp', expedicion);
await page.fill('#oj-o-motivo', 'TEXTO ÍNTEGRO DE LA ORDEN TAL COMO LA EXPIDIÓ EL DESPACHO.');
await page.fill('#oj-o-vhor', '07:40');
await page.waitForTimeout(150);
const vigTxt = await page.textContent('#oj-vig-box');
log(/Vigente hasta/.test(vigTxt), 'El semáforo de vigencia se calcula en vivo', vigTxt.slice(0, 60));

log(await page.isVisible('#oj-d-nom'), 'Pantalla A · el despacho va en la misma pantalla que la orden');
// Ola 4: lo complementario viaja plegado. El test abre todo para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
await page.fill('#oj-d-nom', 'Juzgado Tercero Penal del Circuito de Conocimiento');
await page.selectOption('#oj-d-tipo', 'CONOCIMIENTO');
await page.fill('#oj-d-mun', 'Ciudad Prueba');
await page.fill('#oj-d-dep', 'Departamento Prueba');
await page.fill('#oj-d-dir', 'Palacio de Justicia, oficina 301');
await page.click('button[onclick="ojGuardarDespacho()"]'); await page.waitForTimeout(150);
const guardados = await page.evaluate(() => (DB.getConfig().despachosPropios || []).length);
log(guardados === 1, 'El despacho diligenciado a mano queda guardado para reutilizarlo', guardados);

log(await page.isVisible('#oj-p-rad'), 'Pantalla A · y el proceso también: las tres salen del mismo papel');
await page.fill('#oj-p-rad', '050016000206202504471');
await page.fill('#oj-p-fhec', '2024-03-15');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-0-nombre', 'Hurto calificado y agravado');
await page.fill('#ojl-delitos-0-articulo', '240');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-1-nombre', 'Fabricación y porte de armas');
await page.fill('#ojl-delitos-1-articulo', '365');
const nDelitos = await page.$$eval('#oj-list-delitos .oj-row', e => e.length);
log(nDelitos === 2, 'La lista de delitos admite N registros', nDelitos);

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-r-pn'), 'Pantalla B · la persona requerida');
// Ola 4: lo complementario viaja plegado. El test abre todo para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
await page.fill('#oj-r-pn', 'PRIMERNOMBRE');
await page.fill('#oj-r-sn', 'SEGUNDONOMBRE');
await page.fill('#oj-r-pa', 'PRIMERAPELLIDO');
await page.fill('#oj-r-sa', 'SEGUNDOAPELLIDO');
await page.fill('#oj-r-nd', '1.234.567.890');
await page.fill('#oj-r-fn', '1992-08-14');
// Sexo, estado civil, nacionalidad y alias viven plegados desde la Ola 3: no
// salen en el oficio, alimentan el registro de Personas.
await page.evaluate(() => { const d = document.querySelector('.oj-mas'); if (d) d.open = true; });
await page.selectOption('#oj-r-sx', 'M');
await page.fill('#oj-r-madre', 'MADRE DE PRUEBA');
await page.fill('#oj-r-padre', 'PADRE DE PRUEBA');
await page.fill('#oj-r-rdir', 'Carrera 100 # 5-10');
await page.fill('#oj-r-sen', 'Cicatriz en el antebrazo izquierdo');
await page.selectOption('#oj-r-imet', 'BIOMETRICO');

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-g-fec'), 'Pantalla C · la materialización');
// Ola 4: lo complementario viaja plegado. El test abre todo para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
const fechaDil = hoy.toISOString().slice(0, 10);
await page.fill('#oj-g-fec', fechaDil);
await page.fill('#oj-g-hor', '07:11');
await page.fill('#oj-g-dir', 'Calle 53 con carrera 51');
await page.fill('#oj-g-bar', 'Barrio de Prueba');
await page.fill('#oj-g-mun', 'Ciudad Prueba');
await page.fill('#oj-g-dep', 'Departamento Prueba');
await page.fill('#oj-g-coord', '6.244203, -75.581212');
await page.click('button[onclick="ojListaAgregar(\'funcionarios\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-funcionarios-1-grado', 'Patrullero');
await page.fill('#ojl-funcionarios-1-nombre', 'ACOMPANANTE DE PRUEBA');
await page.fill('#ojl-funcionarios-1-cedula', '2.222.222');
const reloj = await page.textContent('#wz-panels');
log(/Término de 36 horas/.test(reloj), 'El reloj de 36 horas aparece desde el paso de materialización');

log(await page.isVisible('#oj-a-dhor'), 'Pantalla C · y la actuación: todo lo que acaba de pasar, junto');
await page.check('#oj-a-dler');
await page.fill('#oj-a-dfec', fechaDil);
await page.fill('#oj-a-dhor', '08:40');
await page.fill('#oj-a-dlug', 'Instalaciones de la unidad');
await page.fill('#oj-a-cnom', 'FAMILIAR DE PRUEBA');
await page.selectOption('#oj-a-cpar', 'MADRE');
await page.selectOption('#oj-a-fza', 'MEDIOS_RIGIDOS');
await page.check('#oj-a-hayinc');
await page.click('button[onclick="ojListaAgregar(\'incautaciones\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-incautaciones-0-descripcion', 'Un teléfono móvil');
await page.fill('#ojl-incautaciones-0-cantidad', '1');
await page.fill('#ojl-incautaciones-0-rotulo', 'RC-0001');
// Narración libre: el espacio nace vacío y lo escribe el usuario.
log((await page.inputValue('#oj-a-obs')) === '', 'El espacio de narración de los hechos nace en blanco');
await page.fill('#oj-a-obs', 'RELATO LIBRE ESCRITO POR EL FUNCIONARIO.');
// Anexos 0, 1 y 2 del catálogo: informe, acta de derechos y copia de la orden.
const anx2 = await page.textContent('label[for], .oj-chk:has(#oj-a-anx2)').catch(() => '');
log(/Copia orden de captura oficio No\. 002/.test(anx2),
  'El anexo de la copia de la orden ya muestra su número, tomado del paso 1');
await page.check('#oj-a-anx0');
await page.check('#oj-a-anx1');
await page.check('#oj-a-anx2');

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(250);
log(await page.isVisible('#oj-x-nom'), 'Pantalla D · revisión y puesta a disposición');
// Ola 4: lo complementario viaja plegado. El test abre todo para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
const sugerido = await page.inputValue('#oj-x-nom');
log(sugerido === 'Juzgado Tercero Penal del Circuito de Conocimiento',
  'El destinatario se propone solo a partir de la finalidad de la orden', sugerido);
await page.fill('#oj-x-dir', 'Palacio de Justicia, oficina 301');
await page.fill('#oj-x-mun', 'Ciudad Prueba');
await page.fill('#oj-x-dep', 'Departamento Prueba');
// Encabezado, custodia y firma llegan solos desde Ajustes: el usuario que sí
// configuró su equipo no vuelve a escribirlos.
log((await page.inputValue('#oj-e-uni')) === 'UNIDAD DE PRUEBA' &&
    (await page.inputValue('#oj-e-dep')) === 'DEPENDENCIA DE PRUEBA',
  'La unidad y la dependencia se cargan de Ajustes');
log((await page.inputValue('#oj-c-est')) === 'Estación de Prueba Custodia' &&
    (await page.inputValue('#oj-c-cor')) === 'custodia@prueba.test',
  'El lugar de custodia se carga de Ajustes y se puede cambiar aquí');
log((await page.inputValue('#oj-f-nom')) === 'Nombre Firmante' &&
    (await page.inputValue('#oj-f-car')) === 'Integrante patrulla de vigilancia',
  'La firma se carga del perfil activo');
const panel7 = await page.textContent('#wz-panels');
log(/Destinatario propuesto/.test(panel7) && /C-042 de 2018/.test(panel7), 'La propuesta muestra su fundamento legal citado');
log(/Faltan datos obligatorios/.test(panel7) === false, 'Sin validaciones duras pendientes al completar el formulario');

/* ─────────── 5. Guardado y espejo para las pantallas compartidas ─────────── */
await page.click('button[onclick="wizSave()"]');
await page.waitForTimeout(500);
const guardado = await page.evaluate(() => {
  const c = DB.getCases()[0];
  return {
    total: DB.getCases().length, ojv: c.ojv, tipo: c.tipo,
    espejo: (c.capturados || []).length, nombreEspejo: c.capturados[0] && c.capturados[0].priApe,
    conducta: (c.conductas || [])[0], personas: DB.getPersons().length,
    vigencia: c.oj.orden.vigenciaHasta, regla: c.oj.destino.reglaAplicada,
    docSinPuntos: c.oj.requerido.numDoc
  };
});
log(guardado.total === 1 && guardado.ojv === 2 && guardado.tipo === 'OJ', 'El caso se guarda como orden judicial v2');
log(guardado.espejo === 1 && guardado.nombreEspejo === 'PRIMERAPELLIDO', 'Espejo de capturados[0] para la lista y el dossier');
log(guardado.conducta === 'Hurto calificado y agravado', 'Espejo de conductas para la tarjeta de la captura');
log(guardado.personas === 1, 'La persona requerida queda en el módulo de Personas');
log(guardado.docSinPuntos === '1234567890', 'El número de documento se guarda sin puntos');
log(!!guardado.vigencia, 'La vigencia calculada se persiste con el caso', guardado.vigencia);
log(/^R4-/.test(guardado.regla), 'La regla aplicada queda registrada para trazabilidad', guardado.regla);

const listaTxt = await page.textContent('#cl');
log(/PRIMERAPELLIDO/.test(listaTxt), 'La captura aparece en la lista sin tocar el código de flagrancia');

/* ─────────── 6. El documento generado ─────────── */
const doc = await page.evaluate(async () => {
  const c = DB.getCases()[0];
  const out = await buildOficioOJBlob(c);
  if (!out) return { error: 'buildOficioOJBlob devolvió null' };
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  const files = await _unzipBufAsync(buf);
  const dec = n => new TextDecoder().decode(files[n]);
  const xml = dec('word/document.xml');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const ts = parsed.getElementsByTagNameNS(W, 't');
  let texto = ''; for (let i = 0; i < ts.length; i++) texto += ts[i].textContent + '\n';
  return {
    b64, fname: out.fname, origen: out.origen,
    partes: Object.keys(files).sort(),
    malFormado: parsed.getElementsByTagName('parsererror').length > 0,
    texto,
    header: dec('word/header1.xml'),
    footer: dec('word/footer1.xml'),
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    filas: (xml.match(/<w:tr>/g) || []).length,
    anchoTabla: (xml.match(/<w:tblW w:w="9405"/g) || []).length,
    gridEtiqueta: (xml.match(/<w:gridCol w:w="3119"\/>/g) || []).length,
    tramaEtiqueta: (xml.match(/EFEFEF/g) || []).length,
    fileteSeccion: (xml.match(/<w:bottom w:val="single" w:sz="8" w:space="4" w:color="404040"\/>/g) || []).length,
    sectPr: (xml.match(/<w:sectPr>[\s\S]*?<\/w:sectPr>/) || [''])[0],
    fuenteNoArial: /w:ascii="(?!Arial)/.test(xml)
  };
});
log(!doc.error, 'El oficio se genera', doc.error || doc.fname);
log(doc.malFormado === false, 'word/document.xml es XML bien formado');
log(doc.origen === 'formato oficial del módulo', 'El oficio sale siempre del formato del módulo', doc.origen);
log(['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml',
  'word/footer1.xml', 'word/header1.xml', 'word/header2.xml', 'word/settings.xml', 'word/styles.xml'].every(p => doc.partes.includes(p)),
  'El paquete .docx trae todas las partes obligatorias', doc.partes.length + ' partes');
log(doc.fuenteNoArial === false, 'Tipografía única de amplia compatibilidad (Arial) en todo el documento');

/* ── Geometría del formato «Propuesta Plantilla OJ»: si uno de estos valores
      cambia, el documento dejó de ser el formato oficial. ── */
log(doc.tablas === 3, 'Exactamente las 3 tablas del formato (identificación, proceso, materialización)', doc.tablas);
log(doc.filas === 23, 'Filas fijas 9 + 10 + 4: ninguna se omite aunque el dato esté vacío', doc.filas);
log(doc.anchoTabla === 3, 'Las 3 tablas ocupan el área de contenido (9405 twips)', doc.anchoTabla);
log(doc.gridEtiqueta === 3, 'Columna de etiquetas a 3119 twips como el formato', doc.gridEtiqueta);
log(doc.tramaEtiqueta === 23, 'Trama EFEFEF en todas las celdas de etiqueta', doc.tramaEtiqueta);
log(doc.fileteSeccion === 3, 'Los 3 títulos llevan el filete inferior 404040 del formato', doc.fileteSeccion);
log(/w:pgMar w:top="1985" w:right="1134" w:bottom="1701" w:left="1701"/.test(doc.sectPr) &&
  /w:titlePg/.test(doc.sectPr),
  'Márgenes y primera página distinta, como el formato');

const T = doc.texto;
const tiene = s => T.indexOf(s) >= 0;
log(tiene('MINISTERIO DE PRUEBA') === false, 'El encabezado institucional NO va en el cuerpo (va en el membrete)');
log(/MINISTERIO DE PRUEBA/.test(doc.header) && /INSTITUCION DE PRUEBA/.test(doc.header) &&
  /UNIDAD DE PRUEBA/.test(doc.header) && /DEPENDENCIA DE PRUEBA/.test(doc.header),
  'El membrete arma las 4 líneas jerárquicas desde la configuración');
log(/PAGE/.test(doc.footer) && /NUMPAGES/.test(doc.footer), 'Numeración automática de páginas en el pie');
log(tiene('Ciudad Prueba, ') , 'Ciudad y fecha generadas automáticamente');
log(tiene('Asunto: ') && tiene('Deja a disposición capturado por orden judicial No. 002'), 'Asunto parametrizable resuelto');
log(tiene('Juzgado Tercero Penal del Circuito de Conocimiento'), 'Destinatario tomado del formulario');
log(tiene('PRIMERNOMBRE SEGUNDONOMBRE PRIMERAPELLIDO SEGUNDOAPELLIDO'), 'Nombres y apellidos del requerido');
log(tiene('CC 1234567890'), 'Documento de identidad sin puntos en el documento');
log(tiene('MADRE DE PRUEBA y PADRE DE PRUEBA'), 'Nombres de los padres');
log(tiene('Cicatriz en el antebrazo izquierdo'), 'Señales particulares');
log(tiene('1.  IDENTIFICACIÓN DEL CAPTURADO') && tiene('2.  DATOS DEL PROCESO JUDICIAL') &&
  tiene('3.  MATERIALIZACIÓN DE LA CAPTURA'),
  'Los 3 apartados numerados del formato, con su redacción exacta');
log(tiene('Señor(a)') && tiene('De manera atenta y respetuosa me permito dejar a disposición de ese despacho a la persona capturada que se identifica a continuación:'),
  'Encabezamiento y presentación literales del formato');
log(['Nombres y apellidos','Documento de identidad','Fecha y lugar de nacimiento','Edad','Profesión u ocupación',
     'Nombres de los padres','Residencia','Teléfono','Señales particulares','No. de la orden','Fecha de expedición',
     'Autoridad solicitante','Despacho que la libró','SPOA','Número Interno','Fecha de los Hechos',
     'Delito(s) Imputado(s)','Marco Procesal','Motivo de la Captura','Fecha y hora','Lugar','Tipo de lugar',
     'Forma de ubicación'].every(tiene),
  'Las 23 etiquetas del formato, con su texto exacto');
log(tiene('«TEXTO ÍNTEGRO DE LA ORDEN TAL COMO LA EXPIDIÓ EL DESPACHO.»'), 'El motivo de la orden se cita íntegro y literal');
log(tiene('Hurto calificado y agravado') && tiene('Fabricación y porte de armas'), 'Los N delitos llegan al documento');
log(tiene('Art. 240 del Código Penal'), 'Artículos del Código Penal mapeados');
log(tiene('050016000206202504471'), 'Radicado transcrito completo, sin recortar a 16 dígitos');
log(tiene('6.244203, -75.581212'), 'Coordenadas geográficas');
log(tiene('ACOMPANANTE DE PRUEBA'), 'Los N funcionarios participantes llegan al documento');
log(tiene('RC-0001'), 'Rótulo de cadena de custodia del elemento incautado');
log(/artículo 303 de la Ley 906 de 2004/.test(T), 'Constancia de lectura de derechos (art. 303 CPP)');
log(/treinta y seis \(36\) horas/.test(T) && /artículo 28 de la Constitución/.test(T), 'Vencimiento del término constitucional en el relato');
log(tiene('Subintendente NOMBRE FIRMANTE'), 'Firma: grado como se escribió y nombre en mayúsculas, como el formato');
/* El formato NO lleva consecutivo antes de la fecha ni código/versión/
   clasificación en el pie: eran adiciones del módulo anterior. */
log(T.trim().indexOf('Ciudad Prueba,') === 0, 'El documento ABRE con la ciudad y la fecha, sin consecutivo delante',
  T.trim().slice(0, 34));
log(/INFORMACIÓN PÚBLICA/.test(doc.footer) === false && /1DS-OF/.test(doc.footer) === false,
  'El pie lleva SOLO «Página N de M», como el formato');
log(/\{\{/.test(T) === false, 'Cero marcadores sin resolver en el documento final');
log(/SANTANDER|VIDAL|Wesner|Nelson|DAYNIS|Velásquez/i.test(T) === false, 'Cero rastros de datos de ejemplo: el formato sale limpio');

/* ── Constancia de custodia, bloque de contacto y conteo de anexos ── */
log(/Finalmente, se deja constancia de que el capturado quedó bajo custodia en /.test(T),
  'La narración cierra diciendo dónde quedó el capturado');
log(tiene('Estación de Prueba Custodia') && tiene('Calle de custodia 9') &&
    /abonado telefónico 6041111111 y correo electrónico custodia@prueba.test/.test(T),
  'La constancia usa la estación, dirección, teléfono y correo diligenciados');
log(tiene('Teléfono: 6041111111 · custodia@prueba.test') && tiene('www.prueba.test'),
  'El bloque de contacto del final usa los mismos datos de la custodia');
log(tiene('Anexos: tres (3)'), 'La app cuenta los anexos y los escribe en letras');
log(tiene('– Informe dejando a disposición') && tiene('– Acta de derechos del capturado') &&
    tiene('– Copia orden de captura oficio No. 002'),
  'Anexos en el orden marcado, con el No. de la orden ya resuelto');
log(T.indexOf('– Informe dejando a disposición') < T.indexOf('– Copia orden de captura oficio No. 002'),
  'Se respeta el orden en que el usuario los señaló');

/* ── Nada del formato se excluye nunca ──────────────────────────────────────
   Antes, el bloque de anexos desaparecía entero si no se marcaba ninguno, y el
   de contacto si no se habían llenado sus campos en Ajustes. Excluir parte del
   documento está prohibido: la estructura va siempre, con los datos en blanco. */
const sinDatos = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(DB.getCases()[0]));
  c.oj.actuacion.anexos = [];                       // el usuario no marcó ninguno
  c.oj.custodia = { estacion: '', direccion: '', telefono: '', correo: '', web: '' };
  const out = await buildOficioOJBlob(c, 'CARTA');
  const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
  const xml = new TextDecoder().decode(files['word/document.xml']);
  const ts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]);
  return {
    texto: ts.join('\n'),
    // El filete que separa el bloque de contacto sigue ahí
    filete: /<w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"\/>/.test(xml),
    // Y sus 4 renglones centrados también
    centrados: (xml.match(/<w:jc w:val="center"\/>/g) || []).length
  };
});
log(/Anexos:/.test(sinDatos.texto),
  'Sin marcar anexos, el bloque «Anexos:» sigue en el documento (no se excluye)');
log(sinDatos.filete === true && sinDatos.centrados >= 4,
  'Sin datos de custodia, el bloque de contacto conserva su filete y sus 4 renglones',
  sinDatos.centrados + ' renglones centrados');

/* ─────────── 7. Las plantillas subidas quedaron descartadas ───────────
   Antes, una plantilla activa de tipo oj_membrete aportaba el paquete del
   documento. Ahora el oficio sale SIEMPRE del formato del módulo: es la
   garantía por construcción de que su diseño no se puede alterar. */
const custom = await page.evaluate(async ([b64]) => {
  DB.saveTemplate({ id: 'tpl_oj_test', nombre: 'Membrete de prueba', tipo: 'oj_membrete', activa: true, docxBase64: b64 });
  DB.saveTemplate({ id: 'tpl_fpj_oj', nombre: 'FPJ-5 OJ de prueba', tipo: 'fpj5_oj', activa: true, docxBase64: b64 });
  const c = DB.getCases()[0];
  c.oj.requerido.priApe = 'APELLIDONUEVO';
  const out = await buildOficioOJBlob(c);
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  const files = await _unzipBufAsync(buf);
  const xml = new TextDecoder().decode(files['word/document.xml']);
  // Y el botón de descarga tampoco se desvía a la ruta de plantillas.
  const tiposOfrecidos = (function () {
    openSubirPlantilla();
    const sel = document.getElementById('tpl-tipo');
    const v = sel ? Array.from(sel.options).map(o => o.value) : [];
    closeModal();
    return v;
  })();
  return {
    origen: out.origen,
    tieneNuevo: xml.indexOf('APELLIDONUEVO') >= 0,
    repiteViejo: (xml.match(/PRIMERAPELLIDO/g) || []).length,
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    tiposOfrecidos
  };
}, [doc.b64]);
log(custom.origen === 'formato oficial del módulo' && custom.tablas === 3,
  'Una plantilla subida NO altera el oficio: se ignora por completo', custom.origen);
log(custom.tiposOfrecidos.indexOf('oj_membrete') < 0 && custom.tiposOfrecidos.indexOf('fpj5_oj') < 0,
  'Cargar plantillas ya no ofrece los tipos de orden judicial', custom.tiposOfrecidos.join(','));
log(custom.tieneNuevo === true && custom.repiteViejo === 0,
  'El cuerpo lo sigue generando la app con los datos del caso');

/* ─────────── 8. Bloqueo por validación dura ─────────── */
const bloqueo = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(DB.getCases()[0]));
  c.oj.orden.fechaExpedicion = '2010-01-01';            // orden vencida
  const duras = ojDuras(c).map(v => v.id);
  return { duras, tieneV01: duras.includes('V01') };
});
log(bloqueo.tieneV01 === true, 'Una orden vencida produce validación dura que impide generar', bloqueo.duras.join(','));

/* ─────────── 8b. Salidas del caso (descarga y envío) ─────────── */
await page.evaluate(() => { DB.saveTemplates(DB.getTemplates().filter(t => t.id !== 'tpl_oj_test')); });
const idCaso = await page.evaluate(() => DB.getCases()[0].id);
/* Toda salida pasa antes por el diálogo de salida; el helper lo atraviesa
   eligiendo Word/Carta, que es lo que estas pruebas miden.
   ⚠️ Ya no siempre hay dos preguntas: el tamaño de papel es propiedad del EQUIPO
   y solo se pregunta la primera vez; el FPJ-5 tampoco tiene formato que elegir.
   Si no queda nada que preguntar no hay diálogo, y esto es un no-op. */
async function elegirExport(fmt = 'DOCX', papel = 'CARTA') {
  if (!(await page.isVisible('#exp-go').catch(() => false))) return;
  if (await page.isVisible('#exp-fmt-' + fmt).catch(() => false)) await page.click('#exp-fmt-' + fmt);
  if (await page.isVisible('#exp-papel-' + papel).catch(() => false)) await page.click('#exp-papel-' + papel);
  await page.click('#exp-go');
}
await page.evaluate(id => abrirEnvioDoc(id), idCaso);
await page.waitForTimeout(200);
log(await page.isVisible('#exp-go'), 'Enviar pide primero formato y tamaño de papel');
await elegirExport();
await page.waitForTimeout(1200);
const sheet = await page.evaluate(() => ({
  titulo: (document.getElementById('share-title') || {}).textContent,
  doc: window._shareDoc ? _shareDoc.fname : null
}));
log(/Oficio de disposición/.test(sheet.titulo || ''), 'El sheet de envío nombra el oficio de orden judicial', sheet.titulo);
log(/^OJ_Disposicion_/.test(sheet.doc || ''), 'El .docx se pre-genera al abrir el sheet (share dentro del tap)', sheet.doc);
await page.evaluate(() => closeShareSheet());

/* El dossier de WhatsApp es una pantalla compartida: debe seguir funcionando
   sobre un caso de orden judicial gracias al espejo, sin código propio. */
const dossier = await page.evaluate(() => {
  try { return { ok: true, txt: genDossier(DB.getCases()[0]) }; }
  catch (e) { return { ok: false, txt: e.message }; }
});
log(dossier.ok === true, 'El dossier de texto no se rompe con un caso de orden judicial', dossier.ok ? '' : dossier.txt);
log(dossier.ok && /PRIMERAPELLIDO|APELLIDONUEVO/.test(dossier.txt), 'El dossier toma la persona del espejo');

/* ─────────── 8c. Que la descarga NUNCA quede muda ───────────
   Tres caminos que dejaban al usuario sin documento y sin explicación:
   un caso OJ anterior al módulo, un caso nuevo incompleto, y el sheet de envío
   que sí generaba el oficio que la descarga bloqueaba. */
await page.evaluate(() => {
  window.__dl = [];
  const od = window._dlDocBlob;
  window._dlDocBlob = function (b, f) { window.__dl.push(f); return od(b, f); };
});
await page.evaluate(async () => {
  const c = {
    id: 'legado1', tipo: 'OJ', fechaProc: '2026-07-01', created: Date.now(),
    capturados: [{ id: 'pl', priNom: 'JUAN', segNom: 'CARLOS', priApe: 'PEREZ', segApe: 'GOMEZ', tipoDoc: 'CC', numDoc: '1.123', dirRes: 'Calle 5', senas: 'lunar' }],
    conductas: ['Hurto'], numOrden: '55', juzgadoOrden: 'Juzgado X', fechaOrden: '2026-05-01', destinoOJ: 'JUZGADO',
    lugar: { dir: 'Cra 10', barrio: 'Centro', muni: 'Medellin', depto: 'Antioquia' },
    servidor: { grado: 'Patrullero', nombre: 'ANA RUIZ', ident: '2.222' },
    narracion: { fechaCapD: '01', fechaCapM: '07', fechaCapA: '2026', horaCapH: '09', horaCapM: '15', texto: 'relato viejo' }
  };
  await DB.saveCase(c);
  window.__dl = [];
  descargarDocCaso('legado1');
  return { paso: 1 };
});
log(await page.isVisible('#exp-go'), 'También al descargar: nada se produce sin elegir formato y tamaño');
await elegirExport();
await page.waitForTimeout(900);
const legado = await page.evaluate(async () => {
  const adaptado = ojDesdeLegado(DB.getCase('legado1'));
  return {
    descargas: window.__dl, pantalla: location.hash,
    numOrden: adaptado.oj.orden.numero, despacho: adaptado.oj.despacho.nombre,
    requerido: ojNombreRequerido(adaptado.oj.requerido),
    hora: adaptado.oj.diligencia.hora, func: adaptado.oj.diligencia.funcionarios.length
  };
});
log(legado.descargas.length === 1, 'Una captura OJ anterior al módulo SÍ descarga su oficio', legado.descargas[0]);
log(legado.pantalla !== '#plantillas', 'Ya no se desvía al usuario a subir una plantilla', legado.pantalla);
log(legado.numOrden === '55' && legado.despacho === 'Juzgado X' && legado.requerido === 'JUAN CARLOS PEREZ GOMEZ' &&
  legado.hora === '09:15' && legado.func === 1, 'La adaptación del caso viejo conserva orden, despacho, persona, hora y funcionario');

const semilla = await page.evaluate(async () => {
  const c = ojNuevoCaso();
  c.oj.requerido.priNom = 'ANA'; c.oj.requerido.priApe = 'GOMEZ'; c.oj.requerido.numDoc = '999';
  c.oj.orden.numero = '7'; c.oj.orden.fechaExpedicion = '2026-07-01'; c.oj.orden.finalidad = 'CONDENA';
  c.oj.despacho.nombre = 'Juzgado Y'; c.oj.diligencia.lugarDireccion = 'Calle 1';
  c.capturados = [{ id: 'x', priNom: 'ANA', priApe: 'GOMEZ' }];
  await DB.saveCase(c);
  window.__dl = [];
  descargarDocCaso(c.id);
  return { id: c.id };
});
// El diálogo sale primero; solo después de elegir se descubre que faltan datos.
await elegirExport();
await page.waitForTimeout(500);
const incompleto = await page.evaluate((id) => {
  const txt = document.getElementById('modal-c').textContent;
  const duras = ojDuras(DB.getCase(id));
  return {
    id: id, abierto: document.getElementById('modal').classList.contains('open'),
    lineas: (txt.match(/Paso \d/g) || []).length, duras: duras.length,
    primerPaso: duras[0].paso, descargas: window.__dl
  };
}, semilla.id);
log(incompleto.abierto === true && incompleto.descargas.length === 0, 'Un caso incompleto no descarga a medias: explica por qué');
log(incompleto.lineas === incompleto.duras, 'El aviso lista TODAS las faltas, no solo la primera',
  incompleto.lineas + '/' + incompleto.duras);

await page.evaluate(id => { closeModal(); abrirEnvioDoc(id); }, incompleto.id);
await elegirExport();
await page.waitForTimeout(900);
const envio = await page.evaluate(async id => {
  return {
    sheet: document.getElementById('share-sheet').classList.contains('on'),
    modal: document.getElementById('modal').classList.contains('open'),
    doc: window._shareDoc ? _shareDoc.fname : null
  };
}, incompleto.id);
log(envio.sheet === false && envio.doc === null, 'Enviar aplica el mismo criterio que descargar: no produce un oficio incompleto');
log(envio.modal === true, 'Y muestra la misma explicación');

const salto = await page.evaluate(async id => {
  closeModal();
  const duras = ojDuras(DB.getCase(id));
  ojCompletarCaso(id, duras[0].paso);
  await new Promise(r => setTimeout(r, 300));
  return { hash: location.hash, paso: ws, esperado: duras[0].paso };
}, incompleto.id);
log(salto.hash === '#wizard' && salto.paso === salto.esperado,
  '«Completar el caso» abre el wizard justo en el paso que falla', 'paso ' + (salto.paso + 1));
await page.evaluate(() => { wc = null; go('capturas'); });

/* ─────────── 8bis. Lo reportado en campo: el oficio salía SIN encabezado,
   con «Anexos:» vacío y sin bloque de contacto. Causa: un caso del formato
   anterior (el que producía el Simulador) quedaba exento de TODA validación,
   incluidas las que piden el membrete y los datos del cierre — que no son
   datos viejos, son el formato. Estos checks fijan las dos mitades. ───────── */
// Se reproduce el equipo REAL del reporte: recién instalado, sin nada de esto
// configurado en Ajustes. Con la config puesta el caso legado se prellena solo
// y no habría nada que pedir — que es justo por qué el fallo no se veía aquí.
const cfgGuardada = await page.evaluate(() => {
  const cfg = DB.getConfig();
  const copia = JSON.parse(JSON.stringify(cfg));
  ['ojMinisterio', 'ojInstitucion', 'ojUnidad', 'ojDependencia', 'ojPieWeb',
   'ojCustEstacion', 'ojCustDireccion', 'ojCustTelefono', 'ojCustCorreo',
   'ojPieDependencia', 'ojPieDireccion', 'ojPieTelefonos', 'ojPieCorreo'].forEach(k => { cfg[k] = ''; });
  DB.saveConfig(cfg);
  return copia;
});

const vieja = await page.evaluate(async () => {
  const c = {
    id: uid(), tipo: 'OJ', spoa: '12345', fechaProc: '2026-02-18', conductas: ['Hurto'],
    numOrden: '735-1999', juzgadoOrden: 'Juzgado 3 Penal', delitoOrden: 'Hurto',
    fechaOrden: '2026-01-10', autoridadSolicita: 'Juzgado 3 Penal',
    destinoOJ: 'FISCALIA_URI', destino: 'FISCALÍA URI', recibe: 'FISCALÍA URI',
    lugar: { depto: 'Antioquia', muni: 'Medellín', dir: 'Calle 50', barrio: 'Centro' },
    capturados: [{ priNom: 'Juan', priApe: 'Perez', tipoDoc: 'CC', numDoc: '123' }],
    victimas: [], testigos: [],
    narracion: { fechaCapD: '18', fechaCapM: '02', fechaCapA: '2026', horaCapH: '10', horaCapM: '00', texto: 'relato' },
    servidor: { grado: 'Agente', nombre: 'Usuario Demo', cargo: 'Servicio de vigilancia', tel: '3101234567', correo: 'demo@ejemplo.com' },
    created: Date.now()
  };
  await DB.saveCase(c);
  const caso = ojCasoParaDocumento(c);
  return {
    id: c.id, esLegado: ojEsLegado(c),
    bloqueo: ojBloqueoDoc(caso, true).map(v => v.id),
    // Las de datos judiciales del formato viejo siguen exentas: un caso antiguo
    // no queda secuestrado por campos que su formulario nunca tuvo.
    exentas: ojDuras(caso).map(v => v.id).filter(x => OJ_DURAS_DOC.indexOf(x) < 0)
  };
});
log(vieja.esLegado === true, 'Se siembra una captura OJ del formato anterior (sin ojv)');
log(['V26', 'V27', 'V28', 'V29', 'V30', 'V31'].filter(x => vieja.bloqueo.includes(x)).length === vieja.bloqueo.length && vieja.bloqueo.length > 0,
  'Un caso legado YA NO está exento del membrete ni del cierre: eso es el formato, no un dato viejo', vieja.bloqueo.join(','));
log(vieja.exentas.length > 0, 'Pero sus datos judiciales propios siguen exentos — el caso viejo no queda secuestrado', vieja.exentas.join(','));

await page.evaluate(id => { closeModal(); descargarDocCaso(id); }, vieja.id);
await page.waitForTimeout(250);
await elegirExport('DOCX', 'CARTA');
await page.waitForTimeout(500);
const viejaUI = await page.evaluate(() => ({
  modal: document.getElementById('modal').classList.contains('open'),
  texto: document.getElementById('modal').innerText
}));
log(viejaUI.modal === true, 'Descargar un caso legado sin membrete ya no entrega un oficio en blanco: explica y bloquea');
log(/formato anterior/.test(viejaUI.texto), 'Y le dice al usuario por qué se lo pide ahora si antes no se lo pedía');

const viejaOk = await page.evaluate(async id => {
  closeModal();
  const caso = ojDesdeLegado(DB.getCase(id));
  caso.oj.encabezado = { ministerio: 'MINISTERIO X', institucion: 'INSTITUCIÓN Y', unidad: 'UNIDAD Z', dependencia: 'ESTACIÓN W' };
  caso.oj.custodia = { estacion: 'Estación W', direccion: 'Calle 48 # 55-50', telefono: '3127324069', correo: 'w@ejemplo.test', web: 'www.ejemplo.test' };
  caso.oj.actuacion.anexos = ['Informe dejando a disposición', 'Acta de derechos del capturado', 'Copia orden de captura oficio No. {{ORD_NUMERO}}'];
  const out = await buildOficioOJBlob(caso, 'CARTA');
  const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
  const dec = p => new TextDecoder().decode(files[p]);
  const T = x => (x.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(s => s.replace(/<[^>]*>/g, ''));
  return { bloqueo: ojBloqueoDoc(caso, true).length, header: T(dec('word/header1.xml')), cola: T(dec('word/document.xml')).slice(-10) };
}, vieja.id);
log(viejaOk.bloqueo === 0 && viejaOk.header.join('|') === 'MINISTERIO X|INSTITUCIÓN Y|UNIDAD Z|ESTACIÓN W',
  'Completado, el caso legado imprime las CUATRO líneas del membrete', viejaOk.header.join(' / '));
log(viejaOk.cola.includes('Anexos: tres (3)') && viejaOk.cola.includes('– Copia orden de captura oficio No. 735-1999'),
  'Y el bloque de anexos con la cuenta y el No. de la orden resuelto');
log(viejaOk.cola.slice(-4).join('|') === 'Estación W|Calle 48 # 55-50|Teléfono: 3127324069 · w@ejemplo.test|www.ejemplo.test',
  'Y las cuatro líneas del bloque de contacto del cierre');

await page.evaluate(cfg => { closeModal(); DB.saveConfig(cfg); }, cfgGuardada);

/* El Simulador tiene que ejercitar el módulo real: si sigue fabricando casos del
   formato anterior, el usuario prueba con un caso que se salta las preguntas. */
const sim = await page.evaluate(async () => {
  const c = SIM.genOJ();
  const out = await buildOficioOJBlob(c, 'CARTA');
  const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
  const dec = p => new TextDecoder().decode(files[p]);
  const T = x => (x.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(s => s.replace(/<[^>]*>/g, ''));
  const todo = T(dec('word/document.xml'));
  return { ojv: c.ojv, duras: ojDuras(c).map(v => v.id), header: T(dec('word/header1.xml')),
           anexos: todo.find(t => /^Anexos:/.test(t)) || '', cola: todo.slice(-4) };
});
log(sim.ojv === 2, 'El Simulador produce una captura del módulo actual, no del formato anterior', 'ojv=' + sim.ojv);
log(sim.duras.length === 0, 'Y un caso de demostración completo: nada que lo bloquee', sim.duras.join(',') || 'ninguna');
log(sim.header.filter(Boolean).length === 4, 'Su oficio sale con el membrete de cuatro líneas', sim.header.join(' / '));
log(/^Anexos: \w+ \(\d+\)$/.test(sim.anexos), 'Con los anexos contados', sim.anexos);
log(sim.cola.every(Boolean), 'Y el bloque de contacto completo', sim.cola.join(' / '));
await page.evaluate(() => { window._simCase = null; go('capturas'); });

/* ─────────── 8ter. Reportado en campo: el logo «seguía perdido» y la línea 4
   del membrete salía como «CANDELARIA» a secas. El logo vivía SOLO en Ajustes y
   el paso 7 apenas lo mencionaba en una frase: quien diligencia todo en el
   procedimiento nunca lo veía. ───────────────────────────────────────────── */
const etiqueta = await page.evaluate(() => ({
  soloNombre: ojEstacionLabel('CANDELARIA', true),
  yaCompleto: ojEstacionLabel('ESTACIÓN DE POLICÍA CANDELARIA', true),
  otroTipo: ojEstacionLabel('SECCIONAL DE INVESTIGACIÓN CRIMINAL', true),
  cai: ojEstacionLabel('CAI Parque Bolívar', true),
  // ⚠️ La palabra genérica ya nombra el tipo de unidad: no se le antepone nada.
  generica: ojEstacionLabel('DEPENDENCIA DE PRUEBA', true),
  yaDicePolicia: ojEstacionLabel('POLICÍA CANDELARIA', true),
  minuscula: ojEstacionLabel('La Candelaria', false),
  vacio: ojEstacionLabel('', true)
}));
log(etiqueta.soloNombre === 'ESTACIÓN DE POLICÍA CANDELARIA',
  'Con solo el nombre, la app completa el tipo de dependencia', etiqueta.soloNombre);
log(etiqueta.yaCompleto === 'ESTACIÓN DE POLICÍA CANDELARIA' && etiqueta.otroTipo === 'SECCIONAL DE INVESTIGACIÓN CRIMINAL' && etiqueta.cai === 'CAI Parque Bolívar',
  '⚠️ Y NO toca lo que ya trae su tipo de unidad (seccional, CAI, o ya completo)');
log(etiqueta.generica === 'DEPENDENCIA DE PRUEBA' && etiqueta.yaDicePolicia === 'POLICÍA CANDELARIA',
  '⚠️ Ni lo que ya nombra su tipo de otra forma — nada de «ESTACIÓN DE POLICÍA DEPENDENCIA…»');
log(etiqueta.minuscula === 'Estación de Policía La Candelaria' && etiqueta.vacio === '',
  'En la narración y el bloque de contacto va en minúscula; vacío sigue vacío', etiqueta.minuscula);

const paso7 = await page.evaluate(async () => {
  wc = ojNuevoCaso(); ws = 3;          // pantalla D (Revisión) desde la Ola 4
  go('wizard'); renderWiz();
  document.querySelectorAll('#wz-panels details').forEach(d => d.open = true);
  await new Promise(r => setTimeout(r, 300));
  return {
    // ⚠️ La app NO pide logo: el escudo del formato viene embebido.
    pideLogo: !!document.getElementById('oj-e-logo-file'),
    blurDep: (document.getElementById('oj-e-dep') || {}).outerHTML.indexOf('ojCompletarEstacion') >= 0,
    blurCust: (document.getElementById('oj-c-est') || {}).outerHTML.indexOf('ojCompletarEstacion') >= 0
  };
});
log(paso7.pideLogo === false, 'La pantalla de revisión NO pide logo: el escudo del formato viene embebido y se pone solo');
log(paso7.blurDep && paso7.blurCust, 'Los dos campos de estación completan el tipo al salir del campo');

const cargado = await page.evaluate(async () => {
  const c = ojNuevoCaso();
  c.oj.encabezado = { ministerio: 'MINISTERIO DE DEFENSA', institucion: 'INSTITUCIÓN DE PRUEBA',
                      unidad: 'METROPOLITANA DE PRUEBA', dependencia: 'CANDELARIA' };
  c.oj.custodia = { estacion: 'La Candelaria', direccion: 'Calle 48 # 55-50', telefono: '3127324069', correo: 'x@y.test', web: 'www.y.test' };
  const out = await buildOficioOJBlob(c, 'CARTA');
  const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
  const dec = p => new TextDecoder().decode(files[p]);
  const T = v => (v.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(s => s.replace(/<[^>]*>/g, ''));
  const doc = T(dec('word/document.xml'));
  // El mismo caso, con un logo propio cargado en Ajustes: debe ganar.
  const cfg = DB.getConfig();
  const cv = document.createElement('canvas'); cv.width = cv.height = 48;
  const cx = cv.getContext('2d'); cx.fillStyle = '#B00020'; cx.fillRect(0, 0, 48, 48);
  cfg.ojLogoB64 = cv.toDataURL('image/png').split(',')[1]; cfg.ojLogoMime = 'image/png';
  await DB.saveConfig(cfg);
  const out2 = await buildOficioOJBlob(c, 'CARTA');
  const files2 = await _unzipBufAsync(new Uint8Array(await out2.blob.arrayBuffer()));
  cfg.ojLogoB64 = ''; cfg.ojLogoMime = ''; await DB.saveConfig(cfg);
  const propio = Object.keys(files2).find(k => /media/.test(k));
  return {
    media: Object.keys(files).filter(k => /media/.test(k)),
    bytes: files[Object.keys(files).find(k => /media/.test(k))].length,
    header: T(dec('word/header1.xml')),
    vista: /<img /.test(lcPrintDoc(out).hdrFirst),
    narracion: doc.find(t => /bajo custodia en/.test(t)) || '',
    contacto: doc.slice(-4)[0],
    propio: propio || null, propioBytes: propio ? files2[propio].length : 0
  };
});
log(cargado.media.length === 1 && cargado.vista === true,
  'Sin tocar nada, el oficio sale con el escudo — en .docx y en la vista de impresión', cargado.media[0] + ' · ' + cargado.bytes + ' bytes');
log(cargado.propio !== null && cargado.propioBytes !== cargado.bytes,
  'Y un logo propio cargado en Ajustes sigue ganándole al embebido', cargado.propioBytes + ' bytes');
log(cargado.header[3] === 'ESTACIÓN DE POLICÍA CANDELARIA',
  'La línea 4 del membrete sale completa aunque se haya escrito solo «CANDELARIA»', cargado.header[3]);
log(/custodia en Estación de Policía La Candelaria/.test(cargado.narracion) && cargado.contacto === 'Estación de Policía La Candelaria',
  'Y también en la constancia de la narración y en el bloque de contacto');
await page.evaluate(() => {
  const cfg = DB.getConfig(); cfg.ojLogoB64 = ''; cfg.ojLogoMime = ''; DB.saveConfig(cfg);
  wc = null; go('capturas');
});

/* ─────────── 9. Flagrancia intacta ─────────── */
const flagrancia = await page.evaluate(() => {
  const c = SIM.genFlagrancia('flagrancia-uri');
  c.nunc = '0500160002062026';
  const out = buildFPJBlob(c);
  return { ok: !!out, nombre: out && out.fname };
});
log(flagrancia.ok === true, 'El FPJ-5 de flagrancia sigue generándose sin cambios', flagrancia.nombre);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

/* Deja el .docx en disco para abrirlo en Word real. */
await writeFile(join(ROOT, 'verify_oj_salida.docx'), Buffer.from(doc.b64, 'base64'));
console.log('\n📄 Documento generado: verify_oj_salida.docx');
console.log(fails === 0 ? `\n✅ ${n} comprobaciones, todas en verde` : `\n❌ ${fails} de ${n} comprobaciones fallaron`);

await browser.close();
server.close();
process.exit(fails === 0 ? 0 : 1);
