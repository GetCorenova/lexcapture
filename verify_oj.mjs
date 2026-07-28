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
  cfg.ojConsecutivo = 'XXX – YYY – 1.10';
  cfg.ojPieDireccion = 'Calle de prueba 1';
  cfg.ojPieTelefonos = '6040000000';
  cfg.ojPieCorreo = 'correo@prueba.test';
  cfg.ojPieWeb = 'www.prueba.test';
  cfg.ojCodigoFormato = '1DS-OF-0001';
  cfg.ojVersionFormato = 'VER: 6';
  cfg.ojUbicacionTRD = 'XXX-YYY-ZZZ';
  cfg.ojReviso = 'SI Revisor Prueba';
  cfg.perfiles = [{ id: 'pf1', grado: 'Subintendente', nombre: 'Nombre Firmante', cedula: '1.111.111', telefono: '3000000000', correo: 'firmante@prueba.test' }];
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
log(pasos === 7, 'El wizard de orden judicial tiene 7 pasos', pasos);
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

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-d-nom'), 'Paso 2 — despacho judicial');
await page.fill('#oj-d-nom', 'Juzgado Tercero Penal del Circuito de Conocimiento');
await page.selectOption('#oj-d-tipo', 'CONOCIMIENTO');
await page.fill('#oj-d-mun', 'Ciudad Prueba');
await page.fill('#oj-d-dep', 'Departamento Prueba');
await page.fill('#oj-d-dir', 'Palacio de Justicia, oficina 301');
await page.fill('#oj-d-juez', 'Juez de Prueba');
await page.fill('#oj-d-cargo', 'Juez');
await page.click('button[onclick="ojGuardarDespacho()"]'); await page.waitForTimeout(150);
const guardados = await page.evaluate(() => (DB.getConfig().despachosPropios || []).length);
log(guardados === 1, 'El despacho diligenciado a mano queda guardado para reutilizarlo', guardados);

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-p-rad'), 'Paso 3 — proceso');
await page.fill('#oj-p-rad', '050016000206202504471');
await page.fill('#oj-p-fhec', '2024-03-15');
await page.fill('#oj-p-fdec', '2025-11-20');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-0-nombre', 'Hurto calificado y agravado');
await page.fill('#ojl-delitos-0-articulo', '240');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-1-nombre', 'Fabricación y porte de armas');
await page.fill('#ojl-delitos-1-articulo', '365');
const nDelitos = await page.$$eval('#oj-list-delitos .oj-row', e => e.length);
log(nDelitos === 2, 'La lista de delitos admite N registros', nDelitos);

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-r-pn'), 'Paso 4 — persona requerida');
await page.fill('#oj-r-pn', 'PRIMERNOMBRE');
await page.fill('#oj-r-sn', 'SEGUNDONOMBRE');
await page.fill('#oj-r-pa', 'PRIMERAPELLIDO');
await page.fill('#oj-r-sa', 'SEGUNDOAPELLIDO');
await page.fill('#oj-r-nd', '1.234.567.890');
await page.fill('#oj-r-fn', '1992-08-14');
await page.selectOption('#oj-r-sx', 'M');
await page.fill('#oj-r-madre', 'MADRE DE PRUEBA');
await page.fill('#oj-r-padre', 'PADRE DE PRUEBA');
await page.fill('#oj-r-rdir', 'Carrera 100 # 5-10');
await page.fill('#oj-r-sen', 'Cicatriz en el antebrazo izquierdo');
await page.selectOption('#oj-r-imet', 'BIOMETRICO');

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-g-fec'), 'Paso 5 — materialización');
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

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-a-dhor'), 'Paso 6 — actuación policial');
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
await page.check('#oj-a-anx0');
await page.check('#oj-a-anx1');

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(250);
log(await page.isVisible('#oj-x-nom'), 'Paso 7 — puesta a disposición');
const sugerido = await page.inputValue('#oj-x-nom');
log(sugerido === 'Juzgado Tercero Penal del Circuito de Conocimiento',
  'El destinatario se propone solo a partir de la finalidad de la orden', sugerido);
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
    secciones: (xml.match(/D9D9D9/g) || []).length,
    fuenteNoArial: /w:ascii="(?!Arial)/.test(xml)
  };
});
log(!doc.error, 'El oficio se genera', doc.error || doc.fname);
log(doc.malFormado === false, 'word/document.xml es XML bien formado');
log(doc.origen === 'plantilla base', 'Sin plantilla propia se usa la plantilla base embebida', doc.origen);
log(['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml',
  'word/footer1.xml', 'word/header1.xml', 'word/settings.xml', 'word/styles.xml'].every(p => doc.partes.includes(p)),
  'El paquete .docx trae todas las partes obligatorias', doc.partes.length + ' partes');
log(doc.fuenteNoArial === false, 'Tipografía única de amplia compatibilidad (Arial) en todo el documento');
log(doc.tablas >= 6, 'El documento usa tablas para los bloques de datos', doc.tablas + ' tablas');
log(doc.secciones >= 6, 'Jerarquía visual: barras de sección numeradas', doc.secciones);

const T = doc.texto;
const tiene = s => T.indexOf(s) >= 0;
log(tiene('MINISTERIO DE PRUEBA') === false, 'El encabezado institucional NO va en el cuerpo (va en el membrete)');
log(/MINISTERIO DE PRUEBA/.test(doc.header) && /INSTITUCION DE PRUEBA/.test(doc.header) &&
  /UNIDAD DE PRUEBA/.test(doc.header) && /DEPENDENCIA DE PRUEBA/.test(doc.header),
  'El membrete arma las 4 líneas jerárquicas desde la configuración');
log(/Calle de prueba 1/.test(doc.footer) && /www.prueba.test/.test(doc.footer), 'El pie toma dirección y contacto de la configuración');
log(/PAGE/.test(doc.footer) && /NUMPAGES/.test(doc.footer), 'Numeración automática de páginas en el pie');
log(tiene('Ciudad Prueba, ') , 'Ciudad y fecha generadas automáticamente');
log(tiene('Asunto: ') && tiene('Deja a disposición capturado por orden judicial No. 002'), 'Asunto parametrizable resuelto');
log(tiene('Juzgado Tercero Penal del Circuito de Conocimiento'), 'Destinatario tomado del formulario');
log(tiene('PRIMERNOMBRE SEGUNDONOMBRE PRIMERAPELLIDO SEGUNDOAPELLIDO'), 'Nombres y apellidos del requerido');
log(tiene('CC 1234567890'), 'Documento de identidad sin puntos en el documento');
log(tiene('MADRE DE PRUEBA y PADRE DE PRUEBA'), 'Nombres de los padres');
log(tiene('Cicatriz en el antebrazo izquierdo'), 'Señales particulares');
log(tiene('I. ORDEN JUDICIAL QUE SE MATERIALIZA') && tiene('II. PROCESO JUDICIAL') &&
  tiene('III. MATERIALIZACIÓN DE LA CAPTURA') && tiene('VI. PUESTA A DISPOSICIÓN'),
  'Estructura documental por secciones tituladas');
log(tiene('«TEXTO ÍNTEGRO DE LA ORDEN TAL COMO LA EXPIDIÓ EL DESPACHO.»'), 'El motivo de la orden se cita íntegro y literal');
log(tiene('Hurto calificado y agravado') && tiene('Fabricación y porte de armas'), 'Los N delitos llegan al documento');
log(tiene('Art. 240 del Código Penal'), 'Artículos del Código Penal mapeados');
log(tiene('050016000206202504471'), 'Radicado transcrito completo, sin recortar a 16 dígitos');
log(tiene('6.244203, -75.581212'), 'Coordenadas geográficas');
log(tiene('ACOMPANANTE DE PRUEBA'), 'Los N funcionarios participantes llegan al documento');
log(tiene('RC-0001'), 'Rótulo de cadena de custodia del elemento incautado');
log(tiene('Acta de derechos del capturado') && tiene('Copia de la orden de captura'), 'Lista de anexos');
log(/artículo 303 de la Ley 906 de 2004/.test(T), 'Constancia de lectura de derechos (art. 303 CPP)');
log(/treinta y seis \(36\) horas/.test(T) && /artículo 28 de la Constitución/.test(T), 'Vencimiento del término constitucional en el relato');
log(tiene('Subintendente Nombre Firmante'.toUpperCase()), 'Firma del funcionario desde el perfil activo');
log(tiene('XXX – YYY – 1.10'), 'Consecutivo y dependencia configurables');
log(tiene('SI Revisor Prueba') && tiene('XXX-YYY-ZZZ'), 'Bloque Elaboró / Revisó / Ubicación');
log(/\{\{/.test(T) === false, 'Cero marcadores sin resolver en el documento final');
log(/SANTANDER|VIDAL|Wesner|Nelson|DAYNIS|Velásquez/i.test(T) === false, 'Cero rastros de datos de ejemplo: la plantilla base es limpia');

/* ─────────── 7. Plantilla de membrete personalizada ─────────── */
const custom = await page.evaluate(async ([b64]) => {
  // Se reutiliza el propio .docx generado como si fuera el membrete del usuario:
  // trae encabezado, pie y estilos, y su cuerpo debe ser descartado por completo.
  DB.saveTemplate({ id: 'tpl_oj_test', nombre: 'Membrete de prueba', tipo: 'oj_membrete', activa: true, docxBase64: b64 });
  const c = DB.getCases()[0];
  c.oj.requerido.priApe = 'APELLIDONUEVO';
  const out = await buildOficioOJBlob(c);
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  const files = await _unzipBufAsync(buf);
  const xml = new TextDecoder().decode(files['word/document.xml']);
  return {
    origen: out.origen,
    tieneNuevo: xml.indexOf('APELLIDONUEVO') >= 0,
    repiteViejo: (xml.match(/PRIMERAPELLIDO/g) || []).length,
    conservaMembrete: !!files['word/header1.xml']
  };
}, [doc.b64]);
log(custom.origen === 'Membrete de prueba', 'Con plantilla activa se usa su paquete', custom.origen);
log(custom.conservaMembrete === true, 'La plantilla propia conserva su membrete y su pie');
log(custom.tieneNuevo === true && custom.repiteViejo === 0,
  'El cuerpo lo sigue generando la app: el de la plantilla se descarta por completo');

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
await page.evaluate(id => abrirEnvioDoc(id), idCaso);
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
const legado = await page.evaluate(async () => {
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
  await descargarDocCaso('legado1');
  await new Promise(r => setTimeout(r, 900));
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

const incompleto = await page.evaluate(async () => {
  const c = ojNuevoCaso();
  c.oj.requerido.priNom = 'ANA'; c.oj.requerido.priApe = 'GOMEZ'; c.oj.requerido.numDoc = '999';
  c.oj.orden.numero = '7'; c.oj.orden.fechaExpedicion = '2026-07-01'; c.oj.orden.finalidad = 'CONDENA';
  c.oj.despacho.nombre = 'Juzgado Y'; c.oj.diligencia.lugarDireccion = 'Calle 1';
  c.capturados = [{ id: 'x', priNom: 'ANA', priApe: 'GOMEZ' }];
  await DB.saveCase(c);
  window.__dl = [];
  await descargarDocCaso(c.id);
  await new Promise(r => setTimeout(r, 400));
  const txt = document.getElementById('modal-c').textContent;
  const duras = ojDuras(DB.getCase(c.id));
  return {
    id: c.id, abierto: document.getElementById('modal').classList.contains('open'),
    lineas: (txt.match(/Paso \d/g) || []).length, duras: duras.length,
    primerPaso: duras[0].paso, descargas: window.__dl
  };
});
log(incompleto.abierto === true && incompleto.descargas.length === 0, 'Un caso incompleto no descarga a medias: explica por qué');
log(incompleto.lineas === incompleto.duras, 'El aviso lista TODAS las faltas, no solo la primera',
  incompleto.lineas + '/' + incompleto.duras);

const envio = await page.evaluate(async id => {
  closeModal();
  abrirEnvioDoc(id);
  await new Promise(r => setTimeout(r, 900));
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
