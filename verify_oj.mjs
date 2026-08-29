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
  /* Fiscalía destinataria (Mejora 2, obs. 1): se configura UNA vez y de aquí
     sale el encabezado del oficio cuando el informe se remite a la Fiscalía. */
  cfg.ojFiscaliaNombre = 'FISCALIA URI DE PRUEBA';
  cfg.ojFiscaliaDireccion = 'Carrera 64C 67-300, barrio Caribe';
  cfg.ojFiscaliaMunicipio = 'Ciudad Fiscalia';
  cfg.ojFiscaliaDepartamento = 'Departamento Prueba';
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
  /* Orden vencida (Mejora 2, obs. 3): la advertencia se antepone a la regla,
     pero el destinatario SE SIGUE PROPONIENDO. Antes se devolvía R0 a secas y
     el destinatario quedaba vacío → V22 dura → el funcionario se quedaba sin
     documento y sin ninguna vía para desbloquearlo (la prórroga se retiró). */
  c = base(); c.oj.orden.finalidad = 'CONDENA'; c.oj.orden.fechaExpedicion = '2015-01-01';
  const venc = ojResolverDestino(c);
  out.vencida = venc.regla; out.vencidaNombre = venc.nombre;
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
log(destinos.vencida.indexOf('R0-ORDEN-VENCIDA') === 0, 'Orden vencida antepone su advertencia a la regla', destinos.vencida);
log(destinos.vencidaNombre === 'Juzgado de prueba',
  'Pero el destinatario se sigue proponiendo: la vigencia advierte, no deja sin salida', destinos.vencidaNombre);

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
/* ⚠️ V16 (lectura de derechos) salió de la lista con Mejora 3, obs. 4: la
   constancia se deriva de la diligencia y el acta viaja como anexo marcado
   solo, así que bloquear el oficio por una casilla dejó de tener sentido. */
log(['V02', 'V03', 'V04', 'V05', 'V08', 'V09', 'V14', 'V22'].every(id => validaciones.duras.includes(id)),
  'Un caso vacío dispara las validaciones duras de orden, despacho, identidad, lugar y destino',
  validaciones.duras.join(','));
log(validaciones.menor === true, 'Menor de 14 años al momento de los hechos → validación dura');

/* ─────────── 4. Recorrido real del wizard ─────────── */
await page.evaluate(() => go('nueva'));
await page.click('button[onclick="startWizard(\'OJ\')"]');
await page.waitForTimeout(250);
const pasos = await page.$$eval('#wz-prog .wd', els => els.length);
log(pasos === 4, 'El wizard de orden judicial tiene 4 pantallas', pasos);
/* ⚠️ Mejora 2 (obs. 2): el formulario sigue el orden del formato. El informe
   abre por «1. IDENTIFICACIÓN DEL CAPTURADO», así que el paso 1 también. */
const rotulos = await page.evaluate(() => getWizConfig().steps.join(' | '));
log(rotulos === 'El capturado | El proceso judicial | La materialización | Revisión',
  'Y sus pasos son, uno a uno, los numerales del formato', rotulos);
/* ⚠️ Mejora 3 (obs. 1): el paso 1 es la TARJETA del capturado, con «Agregar» y
   «Buscar existente» como en flagrancia; los campos viven en un modal. */
log(await page.isVisible('.oj-persona.vacia') && await page.isVisible('button[onclick="ojAbrirRequerido()"]'),
  'Paso 1 · «1. Identificación del capturado» — tarjeta y dos salidas, como en flagrancia');
await page.click('button[onclick="ojAbrirRequerido()"]'); await page.waitForTimeout(200);
log(await page.isVisible('#oj-r-pn'), 'Los datos se diligencian en un modal enfocado');
// Lo complementario viaja plegado. El test lo abre para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#modal-c details').forEach(d => d.open = true));
await page.fill('#oj-r-pn', 'PRIMERNOMBRE');
await page.fill('#oj-r-sn', 'SEGUNDONOMBRE');
await page.fill('#oj-r-pa', 'PRIMERAPELLIDO');
await page.fill('#oj-r-sa', 'SEGUNDOAPELLIDO');
await page.fill('#oj-r-nd', '1.234.567.890');
await page.fill('#oj-r-fn', '1992-08-14');
// ⚠️ La fecha de nacimiento repinta el formulario del modal (recalcula la edad):
// hay que volver a abrir los bloques plegados antes de seguir.
await page.waitForTimeout(150);
await page.evaluate(() => document.querySelectorAll('#modal-c details').forEach(d => d.open = true));
await page.selectOption('#oj-r-sx', 'M');
await page.fill('#oj-r-madre', 'MADRE DE PRUEBA');
await page.fill('#oj-r-padre', 'PADRE DE PRUEBA');
// La residencia usa el widget de dirección normalizada (consistencia con Mejora 1).
await page.fill('#oj-r-rdir__libre', 'Carrera 100 # 5-10').catch(async () => {
  await page.evaluate(() => lcDirModo('oj-r-rdir', 'libre'));
  await page.fill('#oj-r-rdir__libre', 'Carrera 100 # 5-10');
});
await page.fill('#oj-r-sen', 'Cicatriz en el antebrazo izquierdo');
await page.selectOption('#oj-r-imet', 'BIOMETRICO');
await page.click('button[onclick="ojGuardarRequerido()"]'); await page.waitForTimeout(220);
const tarjeta = await page.textContent('.pcard .pinfo').catch(() => '');
log(/PRIMERNOMBRE/.test(tarjeta) && /PRIMERAPELLIDO/.test(tarjeta),
  'Al guardar, el paso muestra la tarjeta de la persona y ni un campo suelto', tarjeta);

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(220);
log(await page.isVisible('#oj-o-num'), 'Paso 2 · «2. Datos del proceso judicial»');
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
/* Las diez filas del numeral 2 se piden en su orden, y NADA más: se fueron
   la prórroga (obs. 4), el motivo textual duplicado (obs. 5), el medio de
   consulta y el resultado de la verificación (obs. 6). */
const fuera = await page.evaluate(() => ['oj-list-prorrogas', 'oj-o-motivo', 'oj-o-vsis', 'oj-o-vres',
  'oj-o-meses', 'oj-o-estado', 'oj-d-firma', 'oj-d-tipo', 'oj-o-solic']
  .filter(id => !!document.getElementById(id)));
log(fuera.length === 0, 'Y ya no pide prórroga, motivo textual, medio de consulta, resultado ni vigencia manual', fuera.join(',') || 'ninguno');

await page.fill('#oj-o-num', '002');
const hoy = new Date();
const expedicion = new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10);
await page.fill('#oj-o-fexp', expedicion);
await page.waitForTimeout(150);
const vigTxt = await page.textContent('#oj-vig-box');
log(/Vigente hasta/.test(vigTxt), 'El semáforo de vigencia se calcula en vivo, sin pedir meses ni estado', vigTxt.slice(0, 60));

log(await page.isVisible('#oj-p-rad') && await page.isVisible('#oj-p-fdec'),
  'El SPOA, el número interno y la Fecha Decisión están donde el formato los imprime');
await page.fill('#oj-p-rad', '050016000206202504471');
await page.fill('#oj-p-cod', 'INT-2026-77');
await page.fill('#oj-p-fdec', '2024-03-10');
await page.fill('#oj-p-fhec', '2024-03-15');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-0-nombre', 'Hurto calificado y agravado');
await page.fill('#ojl-delitos-0-articulo', '240');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-1-nombre', 'Fabricación y porte de armas');
await page.fill('#ojl-delitos-1-articulo', '365');
const nDelitos = await page.$$eval('#oj-list-delitos .oj-row', e => e.length);
log(nDelitos === 2, 'La lista de delitos admite N registros', nDelitos);

/* Autoridad solicitante = despacho que libró la orden: UN solo campo desde
   Mejora 2 (antes eran dos, uno en cada paso, para el mismo dato). */
log(await page.isVisible('#oj-d-nom'), 'La autoridad solicitante es el dato 8 del numeral 2, en su sitio');
await page.fill('#oj-d-nom', 'Juzgado Tercero Penal del Circuito de Conocimiento');
await page.fill('#oj-d-mun', 'Ciudad Prueba');
await page.fill('#oj-d-dep', 'Departamento Prueba');
await page.click('button[onclick="ojGuardarDespacho()"]'); await page.waitForTimeout(150);
const guardados = await page.evaluate(() => (DB.getConfig().despachosPropios || []).length);
log(guardados === 1, 'El despacho diligenciado a mano queda guardado para reutilizarlo', guardados);
const espejoSolic = await page.evaluate(() => { ojCollect(); return wc.oj.orden.autoridadSolicitante; });
log(espejoSolic === 'Juzgado Tercero Penal del Circuito de Conocimiento',
  'Un solo campo alimenta la autoridad solicitante — sin duplicar la pregunta', espejoSolic);

await page.selectOption('#oj-o-fin', 'CONDENA'); await page.waitForTimeout(200);
/* ⚠️ Mejora 3 (obs. 2): la hora de verificación de la orden ya no se teclea —
   se deriva de la diligencia, porque es el mismo momento y el mismo funcionario. */
const verFuera = await page.evaluate(() => ['oj-o-vfun', 'oj-o-vfec', 'oj-o-vhor', 'oj-o-vobs']
  .filter(id => !!document.getElementById(id)));
log(verFuera.length === 0, 'La verificación de la orden ya no repite funcionario, fecha ni hora',
  verFuera.join(',') || 'ningún duplicado');

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(220);
log(await page.isVisible('#oj-g-fec'), 'Paso 3 · «3. Materialización de la captura»');
// Lo complementario viaja plegado. El test abre todo para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
const fechaDil = hoy.toISOString().slice(0, 10);
await page.fill('#oj-g-fec', fechaDil);
await page.fill('#oj-g-hor', '07:11');
await page.evaluate(() => lcDirModo('oj-g-dir', 'libre'));
await page.fill('#oj-g-dir__libre', 'Calle 53 con carrera 51');
await page.fill('#oj-g-bar', 'Barrio de Prueba');
await page.fill('#oj-g-mun', 'Ciudad Prueba');
await page.fill('#oj-g-dep', 'Departamento Prueba');
await page.click('button[onclick="ojListaAgregar(\'funcionarios\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-funcionarios-1-grado', 'Patrullero');
await page.fill('#ojl-funcionarios-1-nombre', 'ACOMPANANTE DE PRUEBA');
await page.fill('#ojl-funcionarios-1-cedula', '2.222.222');
const reloj = await page.textContent('#wz-panels');
log(/Término de 36 horas/.test(reloj), 'El reloj de 36 horas aparece desde el paso de materialización');

/* ⚠️ Mejora 3 (obs. 4 y 5): el bloque «Actuación policial» y el de elementos
   incautados desaparecieron. Queda el relato y la comprobación de los anexos. */
const actFuera = await page.evaluate(() => ['oj-a-dler', 'oj-a-dhor', 'oj-a-dlug', 'oj-a-cnom',
  'oj-a-fza', 'oj-a-vmed', 'oj-a-nov', 'oj-a-hayinc', 'oj-list-incautaciones']
  .filter(id => !!document.getElementById(id)));
log(actFuera.length === 0, 'Paso 3 · sin actuación policial ni cadena de custodia',
  actFuera.join(',') || 'ninguno de los 19 controles');
// Narración libre: el espacio nace vacío y lo escribe el usuario.
log((await page.inputValue('#oj-a-obs')) === '', 'El espacio de narración de los hechos nace en blanco');
await page.fill('#oj-a-obs', 'RELATO LIBRE ESCRITO POR EL FUNCIONARIO.');
// Los anexos se marcan solos (obs. 6): el del oficio ya trae su número resuelto.
const anx3 = await page.textContent('.oj-chk:has(#oj-a-anx3)').catch(() => '');
log(/Copia orden de captura oficio No\. 002/.test(anx3),
  'El anexo de la copia de la orden ya muestra su número, tomado del paso 2');
const anxAuto = await page.evaluate(() => { ojCollect(); return wc.oj.actuacion.anexos; });
log(anxAuto.length === 4 && anxAuto[1] === 'Acta de derechos del capturado y constancia de buen trato',
  'Y los cuatro que siempre viajan quedan marcados sin tocar una casilla', anxAuto.length + ' anexos');

await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(250);
log(await page.isVisible('#oj-x-nom'), 'Paso 4 · revisión y puesta a disposición');
// Lo complementario viaja plegado. El test abre todo para diligenciarlo.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));

/* ── Mejora 2, obs. 1: ¿a quién se remite el informe? ─────────────────────── */
const viaUI = await page.evaluate(() => ({
  botones: [...document.querySelectorAll('.oj-via')].map(b => b.querySelector('b').textContent),
  marcada: (document.querySelector('.oj-via.on') || {}).textContent || '',
  via: wc.oj.destino.via
}));
log(viaUI.botones.join(',') === 'Fiscalía,Juzgado',
  'La app pregunta a quién va dirigido el informe: Fiscalía o Juzgado', viaUI.botones.join(' / '));
log(viaUI.via === 'JUZGADO' && /Juzgado/.test(viaUI.marcada),
  'Y la propone según la regla: captura por condena → el juzgado que libró la orden', viaUI.via);
const sugerido = await page.inputValue('#oj-x-nom');
log(sugerido === 'Juzgado Tercero Penal del Circuito de Conocimiento',
  'Con vía «Juzgado», el destinatario se hereda de la autoridad solicitante — no se vuelve a teclear', sugerido);

/* La Fiscalía sale de Ajustes; el juzgado, de la autoridad solicitante. */
const viaFis = await page.evaluate(async () => {
  ojCambiarVia('FISCALIA');
  await new Promise(r => setTimeout(r, 150));
  const d = wc.oj.destino;
  return { n: d.nombre, dir: d.direccion, mun: d.municipio, pideDir: !!document.getElementById('oj-x-dir') };
});
log(viaFis.n === 'FISCALIA URI DE PRUEBA' && viaFis.dir === 'Carrera 64C 67-300, barrio Caribe' && viaFis.mun === 'Ciudad Fiscalia',
  'Con vía «Fiscalía», nombre y dirección salen de Ajustes: la captura no los vuelve a pedir',
  viaFis.n + ' · ' + viaFis.dir);
await page.evaluate(async () => { ojCambiarVia('JUZGADO'); await new Promise(r => setTimeout(r, 150)); });
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
await page.fill('#oj-x-dir', 'Palacio de Justicia, oficina 301');
await page.fill('#oj-x-mun', 'Ciudad Prueba');
await page.fill('#oj-x-dep', 'Departamento Prueba');
const dirVuelve = await page.evaluate(() => { ojCollect(); return wc.oj.despacho.direccion; });
log(dirVuelve === 'Palacio de Justicia, oficina 301',
  'La dirección del juzgado (que el formato no recoge) vuelve al despacho y queda reutilizable', dirVuelve);
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
/* ⚠️ Mejora 3 (obs. 7): el fundamento de la propuesta pasó a un plegable dentro
   del bloque del destinatario — es justificación, no acción, y era parte de lo
   que sepultaba la decisión. Sigue citado y a un toque. */
const panel7 = await page.textContent('#wz-panels');
log(/Por qué se propone este destinatario/.test(panel7) && /C-042 de 2018/.test(panel7),
  'La propuesta muestra su fundamento legal citado, a un toque del destinatario');
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
    /* Familias declaradas en el cuerpo, el membrete y el pie, y la tabla de
       fuentes del paquete: desde que el oficio adopta el documento maestro son
       DOS (la del cuerpo y la base), no una. */
    fuentes: [...new Set([xml, dec('word/header1.xml'), dec('word/footer1.xml')]
      .flatMap(t => [...t.matchAll(/w:ascii="([^"]+)"/g)].map(m => m[1])))].sort(),
    fontTable: files['word/fontTable.xml'] ? dec('word/fontTable.xml') : ''
  };
});
log(!doc.error, 'El oficio se genera', doc.error || doc.fname);
log(doc.malFormado === false, 'word/document.xml es XML bien formado');
log(doc.origen === 'formato oficial del módulo', 'El oficio sale siempre del formato del módulo', doc.origen);
log(['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml',
  'word/footer1.xml', 'word/header1.xml', 'word/header2.xml', 'word/settings.xml', 'word/styles.xml'].every(p => doc.partes.includes(p)),
  'El paquete .docx trae todas las partes obligatorias', doc.partes.length + ' partes');
/* ⚠️ Antes esta comprobación exigía UNA sola familia (Arial). El documento
   maestro no es así: el cuerpo va en su fuente y el membrete, los anexos y el
   bloque institucional se quedan en la base. Lo que sigue siendo obligatorio es
   la COMPATIBILIDAD: toda familia que no sea la base tiene que traer su
   respaldo declarado en la tabla de fuentes, para que un equipo donde no esté
   instalada caiga en la base y no en la que decida el sistema. */
const fuenteBase = 'Arial';
const noBase = doc.fuentes.filter(f => f !== fuenteBase);
log(doc.fuentes.length === 2 && doc.fuentes.includes(fuenteBase),
  'Dos familias tipográficas, las del documento maestro', doc.fuentes.join(' + '));
log(noBase.every(f => new RegExp('<w:font w:name="' + f + '">\\s*<w:altName w:val="' + fuenteBase + '"').test(doc.fontTable)),
  '⚠️ La fuente del cuerpo trae respaldo declarado: sin ella instalada, el oficio cae en ' + fuenteBase,
  noBase.join(', ') + (doc.fontTable ? ' · fontTable presente' : ' · SIN fontTable'));

/* ── Geometría del formato «Propuesta Plantilla OJ»: si uno de estos valores
      cambia, el documento dejó de ser el formato oficial. ── */
log(doc.tablas === 3, 'Exactamente las 3 tablas del formato (identificación, proceso, materialización)', doc.tablas);
/* ⚠️ Mejora 2 (obs. 3): 9 + 10 + 3. El numeral 3 del formato tiene TRES filas;
   la cuarta que imprimía la app («Forma de ubicación») no existe en la
   plantilla — el dato sigue saliendo, pero en el relato de los hechos. */
log(doc.filas === 22, 'Filas fijas 9 + 10 + 3, las del formato: ninguna se omite aunque el dato esté vacío', doc.filas);
log(doc.anchoTabla === 3, 'Las 3 tablas ocupan el área de contenido (9405 twips)', doc.anchoTabla);
log(doc.gridEtiqueta === 3, 'Columna de etiquetas a 3119 twips como el formato', doc.gridEtiqueta);
log(doc.tramaEtiqueta === 22, 'Trama EFEFEF en todas las celdas de etiqueta', doc.tramaEtiqueta);
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
/* ⚠️ Las 22 etiquetas de «Propuesta Plantilla OJ», en su orden. «Despacho que
   la libró» y «Forma de ubicación» NO están en el formato: eran adiciones de la
   app — la primera duplicaba «Autoridad solicitante» (obs. 5) y la segunda una
   fila inexistente (obs. 3). «Fecha Decisión» sí está y faltaba. */
log(['Nombres y apellidos','Documento de identidad','Fecha y lugar de nacimiento','Edad','Profesión u ocupación',
     'Nombres de los padres','Residencia','Teléfono','Señales particulares','No. de la orden','Fecha de expedición',
     'SPOA','Número Interno','Fecha Decisión','Fecha de los Hechos','Delito(s) Imputado(s)','Autoridad solicitante',
     'Marco Procesal','Motivo de la Captura','Fecha y hora','Lugar','Tipo de lugar'].every(tiene),
  'Las 22 etiquetas del formato, con su texto exacto');
log(tiene('Despacho que la libró') === false && tiene('Forma de ubicación') === false,
  'Y ninguna fila que el formato no tenga: el informe ES la plantilla');
log(tiene('Cumplimiento de condena ejecutoriada'),
  'El «Motivo de la Captura» sale del único campo que ahora lo pide (finalidad)');
log(tiene('INT-2026-77') && tiene('10 de marzo de 2024'),
  'Número Interno y Fecha Decisión llegan al informe');
log(tiene('Hurto calificado y agravado') && tiene('Fabricación y porte de armas'), 'Los N delitos llegan al documento');
log(tiene('Art. 240 del Código Penal'), 'Artículos del Código Penal mapeados');
log(tiene('050016000206202504471'), 'Radicado transcrito completo, sin recortar a 16 dígitos');
/* ⚠️ Mejora 3 (obs. 3 y 5): coordenadas y cadena de custodia dejaron de pedirse,
   así que un caso diligenciado hoy no las lleva — y el documento no las inventa. */
log(!tiene('6.244203, -75.581212'), 'Sin coordenadas: ya no se piden y el oficio no las inventa');
log(tiene('ACOMPANANTE DE PRUEBA'), 'Los N funcionarios participantes llegan al documento');
log(!/cadena de custodia/.test(T), 'Sin cadena de custodia: no aplica a una captura por orden judicial');
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
log(tiene('Anexos: cuatro (4)'), 'La app cuenta los anexos y los escribe en letras');
log(tiene('– Informe dejando a disposición') && tiene('– Acta de derechos del capturado y constancia de buen trato') &&
    tiene('– Copia documento de identificación') && tiene('– Copia orden de captura oficio No. 002'),
  'Anexos en el orden que fijó el usuario (Mejora 3, obs. 6), con el No. de la orden resuelto');
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

/* ─────────── 7. Las plantillas subidas ya no existen ───────────
   Antes, una plantilla activa de tipo oj_membrete aportaba el paquete del
   documento; OJ v2 dejó de leerla y ahora se retiró el subsistema entero
   (pantalla, API de DB y las dos plantillas de Disposición embebidas). La
   garantía de que el diseño del oficio no se puede alterar pasa de ser una
   rama que se ignora a no existir código que la lea. */
const custom = await page.evaluate(async () => {
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
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    // Ni una sola vía sobreviviente para inyectar un .docx propio.
    api: ['getTemplates', 'saveTemplate', 'saveTemplates', 'getActiveTemplate'].filter(k => typeof DB[k] === 'function'),
    ui: ['renderPlantillas', 'openSubirPlantilla', 'genDocDisposicion', 'initDefaultTemplates'].filter(k => typeof window[k] === 'function'),
    pantalla: screens.indexOf('plantillas'),
    seccion: !!document.getElementById('screen-plantillas'),
    // Y la clave que se comía ~3,6 MB de cuota queda purgada.
    purgada: localStorage.getItem('lc_templates') === null
  };
});
log(custom.origen === 'formato oficial del módulo' && custom.tablas === 3,
  'El oficio sale del formato del módulo', custom.origen);
log(custom.api.length === 0 && custom.ui.length === 0 && custom.pantalla < 0 && custom.seccion === false,
  'El subsistema de plantillas subidas ya no existe: ni API, ni pantalla, ni motor de inyección',
  custom.api.concat(custom.ui).join(',') || 'nada');
log(custom.purgada === true, 'La clave lc_templates queda purgada del localStorage');
log(custom.tieneNuevo === true && custom.repiteViejo === 0,
  'El cuerpo lo sigue generando la app con los datos del caso');

/* ─────────── 8. Orden vencida: advertencia, no callejón sin salida ───────────
   Mejora 2 (obs. 3 y 4). La verificación de vigencia es la misma; lo que cambia
   es la consecuencia: se advierte tres veces (cuadro en el paso 2, banner en la
   revisión y confirmación al generar) y ya no bloquea — con el apartado de
   prórroga retirado, bloquear dejaba al funcionario sin ninguna salida. */
const bloqueo = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(DB.getCases()[0]));
  c.oj.orden.fechaExpedicion = '2010-01-01';            // orden vencida
  const todas = ojValidar(c);
  const v01 = todas.find(v => v.id === 'V01');
  const files = await (async () => {
    const out = await buildOficioOJBlob(c, 'CARTA');
    const f = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
    return new TextDecoder().decode(f['word/document.xml']);
  })();
  return {
    duras: ojDuras(c).map(v => v.id),
    nivelV01: v01 && v01.nivel,
    avisa: !!v01 && /VENCIDA/.test(v01.msg),
    aviso: !!ojVigenciaVencida(c),
    // El relato no puede afirmar «confirmada la vigencia» si estaba vencida.
    relatoHonesto: files.indexOf('Confirmada la vigencia de la orden') < 0 &&
                   files.indexOf('vigencia expirada al momento de la diligencia') >= 0
  };
});
log(bloqueo.nivelV01 === 'BLANDA' && bloqueo.avisa === true,
  'Una orden vencida se ADVIERTE con todas sus letras (art. 298 CPP · AP4491-2016)', bloqueo.nivelV01);
log(bloqueo.duras.includes('V01') === false,
  'Pero ya no bloquea: al retirarse la prórroga, bloquear dejaba al funcionario sin salida', bloqueo.duras.join(',') || 'ninguna dura');
log(bloqueo.aviso === true, 'Y las tres salidas piden confirmarlo antes de producir el oficio');
log(bloqueo.relatoHonesto === true,
  '⚠️ El relato NO dice «confirmada la vigencia» cuando estaba vencida: deja la constancia de que lo estaba');

/* ─────────── 8b. Salidas del caso (descarga y envío) ─────────── */
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
/* El canal (descargar o compartir) solo se ofrece donde el equipo puede
   adjuntar de verdad; sin Web Share de archivos se descarga directo y no se
   abre un sheet de un solo boton. Aqui se mide el sheet, asi que se declara la
   capacidad que tiene cualquier telefono. */
await page.evaluate(() => {
  navigator.canShare = d => !!(d && d.files && d.files.length);
  navigator.share = () => Promise.resolve();
});
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
  caso.oj.custodia = { estacion: 'Estación W', direccion: 'Calle 48 # 55-50', barrio: '', ciudad: 'Ciudad W', telefono: '3127324069', correo: 'w@ejemplo.test', web: 'www.ejemplo.test' };
  caso.oj.actuacion.anexos = ['Informe dejando a disposición', 'Acta de derechos del capturado y constancia de buen trato', 'Copia orden de captura oficio No. {{ORD_NUMERO}}'];
  caso.oj.actuacion.anexosManual = true;   // los fija el test, no el automatismo
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
log(viejaOk.cola.slice(-4).join('|') === 'Estación W|Calle 48 # 55-50, Ciudad W|Teléfono: 3127324069 · w@ejemplo.test|www.ejemplo.test',
  'Y las cuatro líneas del bloque de contacto del cierre', viejaOk.cola.slice(-4).join(' | '));

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

/* ─────────── 10. Bloque de contacto: dirección + barrio + ciudad ───────────
   El formato imprime «Calle 48 # 55–50, barrio La Candelaria, Medellín» bajo el
   nombre de la unidad. Los tres datos se piden UNA vez en Ajustes y bajan solos
   al oficio; y lo mismo se escribe en la constancia de custodia de la narración,
   que en el formato es el mismo dato. */
console.log('\n── 10 · Bloque de contacto y constancia de custodia ──');
const cust = await page.evaluate(async () => {
  const txt = xml => (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join('');
  const parrafos = xml => xml.split('<w:p ').join('<w:p>').split('<w:p>').slice(1)
    .map(p => txt(p.split('</w:p>')[0]).trim()).filter(Boolean);

  // (a) Configurado UNA vez en Ajustes
  const cfg = DB.getConfig();
  cfg.ojCustEstacion = 'La Candelaria';
  cfg.ojCustDireccion = 'Calle 48 # 55–50';
  cfg.ojCustBarrio = 'La Candelaria';
  cfg.ojCustCiudad = 'Medellín';
  cfg.ojCustTelefono = '312 732 4069';
  cfg.ojCustCorreo = 'unidad@ejemplo.test';
  cfg.ojPieWeb = 'www.ejemplo.test';
  DB.saveConfig(cfg);

  const c = SIM.genOJ(); c.id = 'cust-auto'; c.isTest = false;
  c.oj.custodia = { estacion:'', direccion:'', barrio:'', ciudad:'', telefono:'', correo:'', web:'' };
  ojPrellenarDeCfg(c, DB.getConfig());        // ← lo que hace el wizard al abrir
  ojEspejar(c); await DB.saveCase(c);
  const out = await buildOficioOJBlob(ojCasoParaDocumento(c), 'CARTA');
  const ps = parrafos(new TextDecoder().decode(out.files['word/document.xml']));

  // (b) Un caso ANTERIOR: todo dentro de `direccion`, sin barrio ni ciudad
  const v = SIM.genOJ(); v.id = 'cust-legado'; v.isTest = false;
  v.oj.custodia = { estacion:'La Candelaria', direccion:'Calle 48 # 55–50, barrio La Candelaria, Medellín',
                    telefono:'312 732 4069', correo:'unidad@ejemplo.test', web:'www.ejemplo.test' };
  ojEspejar(v); await DB.saveCase(v);
  const outV = await buildOficioOJBlob(ojCasoParaDocumento(v), 'CARTA');
  const psV = parrafos(new TextDecoder().decode(outV.files['word/document.xml']));

  return {
    compone: ojCustodiaDireccion({ direccion:'Calle 48 # 55–50', barrio:'La Candelaria', ciudad:'Medellín' }),
    soloDir: ojCustodiaDireccion({ direccion:'Calle 48 # 55–50' }),
    vacio: ojCustodiaDireccion({}),
    sinDir: ojCustodiaDireccion({ barrio:'La Candelaria', ciudad:'Medellín' }),
    // Ya escrito dentro de la dirección: no se repite
    yaEscrito: ojCustodiaDireccion({ direccion:'Calle 48 # 55–50, barrio La Candelaria, Medellín',
                                     barrio:'La Candelaria', ciudad:'Medellín' }),
    soloCiudadYa: ojCustodiaDireccion({ direccion:'Calle 48 # 55–50, Medellín',
                                        barrio:'La Candelaria', ciudad:'Medellín' }),
    cierre: ps.slice(-4),
    custodiaNarr: ps.find(p => /bajo custodia/.test(p)) || '',
    cierreLegado: psV.slice(-4),
    campos: c.oj.custodia
  };
});
log(cust.compone === 'Calle 48 # 55–50, barrio La Candelaria, Medellín',
  'Los tres datos se componen como en el formato', cust.compone);
log(cust.soloDir === 'Calle 48 # 55–50' && cust.vacio === '' &&
    cust.sinDir === 'barrio La Candelaria, Medellín',
  '⚠️ Cada parte es opcional: sin barrio ni ciudad no quedan comas sueltas',
  `«${cust.soloDir}» · «${cust.vacio}» · «${cust.sinDir}»`);
log(cust.yaEscrito === 'Calle 48 # 55–50, barrio La Candelaria, Medellín' &&
    cust.soloCiudadYa === 'Calle 48 # 55–50, Medellín, barrio La Candelaria',
  '⚠️ No se repite lo que la dirección ya diga (había UN solo campo y el ejemplo pedía escribirlo todo dentro)',
  `«${cust.yaEscrito}»`);
log(cust.campos.barrio === 'La Candelaria' && cust.campos.ciudad === 'Medellín',
  'Se piden una sola vez en Ajustes y bajan solos al caso',
  `barrio «${cust.campos.barrio}» · ciudad «${cust.campos.ciudad}»`);
log(cust.cierre[1] === 'Calle 48 # 55–50, barrio La Candelaria, Medellín',
  'El bloque de contacto imprime dirección, barrio y ciudad en su renglón',
  cust.cierre[1]);
log(/Estación de Policía La Candelaria/.test(cust.cierre[0]) &&
    /312 732 4069/.test(cust.cierre[2]) && /www\./.test(cust.cierre[3]),
  'Y los otros tres renglones del bloque siguen igual', cust.cierre[0]);
log(cust.custodiaNarr.includes('Calle 48 # 55–50, barrio La Candelaria, Medellín'),
  '⚠️ La constancia de la narración usa la MISMA dirección: no pueden discrepar');
log(cust.cierreLegado[1] === 'Calle 48 # 55–50, barrio La Candelaria, Medellín',
  '⚠️ Un caso guardado antes (todo en «dirección») sale idéntico — no se parte el texto viejo',
  cust.cierreLegado[1]);

/* ─────────── 11. Un solo sitio: Ajustes → Estación ───────────
   La sección «Estación» ya pedía Dirección y Teléfono... y NINGÚN documento las
   leía (`cfg.dosDir` se guardaba y se quedaba ahí). El oficio pedía lo mismo
   otra vez en su propia sección. Ahora el contacto de la unidad —nombre,
   dirección, barrio, ciudad, teléfono, correo y web— se pide UNA vez aquí. */
console.log('\n── 11 · El contacto de la unidad se pide en Ajustes → Estación ──');
const est = await page.evaluate(async () => {
  const txt = xml => (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join('');
  const parrafos = xml => xml.split('<w:p ').join('<w:p>').split('<w:p>').slice(1)
    .map(p => txt(p.split('</w:p>')[0]).trim()).filter(Boolean);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; return !!el; };

  // (a) Una configuración LEGADA: la dirección y el teléfono que el usuario
  //     escribió en esta sección cuando no llegaban a ningún documento.
  let cfg = DB.getConfig();
  ['ojCustEstacion','ojCustDireccion','ojCustBarrio','ojCustCiudad',
   'ojCustTelefono','ojCustCorreo','ojPieWeb'].forEach(k => { cfg[k] = ''; });
  cfg.dosDir = 'Calle 48 # 55–50'; cfg.dosTel = '312 732 4069';
  DB.saveConfig(cfg);

  const leg = SIM.genOJ(); leg.id = 'est-legado'; leg.isTest = false;
  leg.oj.custodia = { estacion:'La Candelaria', direccion:'', barrio:'', ciudad:'', telefono:'', correo:'', web:'' };
  ojPrellenarDeCfg(leg, DB.getConfig());
  const rescate = { dir: leg.oj.custodia.direccion, tel: leg.oj.custodia.telefono };

  // (b) El usuario abre Ajustes: lo legado se ve en el formulario…
  go('ajustes'); loadAjustesFields();
  const vistos = {
    dir: (document.getElementById('aj-dir') || {}).value,
    tel: (document.getElementById('aj-tel') || {}).value
  };
  // …y diligencia los campos nuevos, todos en la misma sección. El nombre de la
  // unidad se escribe en `aj-estacion`: es el ÚNICO campo que lo pide (antes lo
  // pedían también «Nombre para el oficio» aquí y «Línea 4» en la otra sección).
  const hay = ['aj-estacion','aj-dir','aj-bar','aj-ciu','aj-tel','aj-cor','aj-web']
    .every(id => set(id, ''));
  set('aj-estacion', 'La Candelaria'); set('aj-dir', 'Calle 48 # 55–50');
  set('aj-bar', 'La Candelaria');  set('aj-ciu', 'Medellín');
  set('aj-tel', '312 732 4069');   set('aj-cor', 'unidad@ejemplo.test');
  set('aj-web', 'www.ejemplo.test');
  saveAjustes();
  cfg = DB.getConfig();

  // (c) …y baja solo al oficio, sin tocar nada más.
  const c = SIM.genOJ(); c.id = 'est-auto'; c.isTest = false;
  c.oj.custodia = { estacion:'', direccion:'', barrio:'', ciudad:'', telefono:'', correo:'', web:'' };
  ojPrellenarDeCfg(c, cfg); ojEspejar(c); await DB.saveCase(c);
  const out = await buildOficioOJBlob(ojCasoParaDocumento(c), 'CARTA');
  const ps = parrafos(new TextDecoder().decode(out.files['word/document.xml']));

  return {
    rescate, vistos, hay,
    guardado: { est: cfg.ojCustEstacion, dir: cfg.ojCustDireccion, bar: cfg.ojCustBarrio,
                ciu: cfg.ojCustCiudad, tel: cfg.ojCustTelefono, cor: cfg.ojCustCorreo, web: cfg.ojPieWeb },
    // El nombre de la unidad y su ciudad llegan a las TRES claves que los
    // imprimen: una sola pantalla, sin que ninguna quede rezagada y gane luego.
    unaSolaVez: { nombre: cfg.nombreEstacion, membrete: cfg.ojDependencia,
                  custodia: cfg.ojCustEstacion, ciudadOficio: cfg.ojCiudad },
    espejo: { dosDir: cfg.dosDir, dosTel: cfg.dosTel },
    // La sección del oficio ya no vuelve a preguntar lo mismo
    duplicados: ['aj-oj-cest','aj-oj-cdir','aj-oj-cbar','aj-oj-cciu','aj-oj-ctel','aj-oj-ccor','aj-oj-pweb',
                 'aj-cest','aj-oj-dep','aj-oj-ciu']
      .filter(id => document.getElementById(id)),
    cierre: ps.slice(-4),
    narr: ps.find(p => /bajo custodia/.test(p)) || ''
  };
});
log(est.hay, 'Ajustes → Estación pide los siete datos de la unidad (nombre + contacto)');
log(est.duplicados.length === 0,
  '⚠️ Ni esta sección ni la del oficio los vuelven a pedir: sin segundo «Barrio», sin segundo nombre de unidad y sin segunda ciudad',
  est.duplicados.join(', '));
log(est.unaSolaVez.nombre === 'La Candelaria' && est.unaSolaVez.membrete === 'La Candelaria' &&
    est.unaSolaVez.custodia === 'La Candelaria' && est.unaSolaVez.ciudadOficio === 'Medellín',
  '⚠️ Escrito UNA vez, llega a las tres claves que lo imprimen (dossier, membrete y bloque de contacto)',
  JSON.stringify(est.unaSolaVez));
log(est.guardado.est === 'La Candelaria' && est.guardado.dir === 'Calle 48 # 55–50' &&
    est.guardado.bar === 'La Candelaria' && est.guardado.ciu === 'Medellín' &&
    est.guardado.tel === '312 732 4069' && est.guardado.cor === 'unidad@ejemplo.test' &&
    est.guardado.web === 'www.ejemplo.test',
  'Se guardan en las claves que lee el oficio', JSON.stringify(est.guardado));
log(est.espejo.dosDir === 'Calle 48 # 55–50' && est.espejo.dosTel === '312 732 4069',
  'Las claves legadas quedan en espejo (una config exportada antes no se rompe)',
  JSON.stringify(est.espejo));
log(est.rescate.dir === 'Calle 48 # 55–50' && est.rescate.tel === '312 732 4069',
  '⚠️ Lo que el usuario ya había escrito ahí (y no leía ningún documento) llega ahora al oficio',
  `dir «${est.rescate.dir}» · tel «${est.rescate.tel}»`);
log(est.vistos.dir === 'Calle 48 # 55–50' && est.vistos.tel === '312 732 4069',
  'Y se ve en el formulario, sin volver a teclearlo');
log(est.cierre[1] === 'Calle 48 # 55–50, barrio La Candelaria, Medellín',
  'El bloque de contacto sale completo con lo diligenciado en Estación', est.cierre[1]);
log(/Estación de Policía La Candelaria/.test(est.cierre[0]) &&
    /312 732 4069/.test(est.cierre[2]) && /unidad@ejemplo\.test/.test(est.cierre[2]) &&
    /www\.ejemplo\.test/.test(est.cierre[3]),
  'Los otros tres renglones también', est.cierre[0] + ' | ' + est.cierre[2] + ' | ' + est.cierre[3]);
log(est.narr.includes('Calle 48 # 55–50, barrio La Candelaria, Medellín'),
  '⚠️ La constancia de la narración usa el mismo dato: no pueden discrepar');

/* Y la sección del oficio se queda solo con lo que el documento imprime. */
const limpio = await page.evaluate(() => {
  // Se siembra una config con las claves de formatos que ya no se producen…
  const crudo = JSON.parse(JSON.stringify(DB.getConfig()));
  ['ojConsecutivo','ojCodigoFormato','ojVersionFormato','ojClasificacion',
   'ojUbicacionTRD','ojReviso'].forEach(k => { crudo[k] = 'residuo'; });
  DB.saveConfig(crudo);
  const tras = DB.getConfig();
  const campos = [...document.querySelectorAll('#aj-body-oj-sec input')]
    .map(i => i.id).filter(Boolean);

  // El escudo del formato viene embebido: su bloque no debe pedir nada.
  const det = document.getElementById('aj-oj-logo-det');
  const sinPropio = JSON.parse(JSON.stringify(tras)); sinPropio.ojLogoB64 = '';
  renderLogoOJ(sinPropio);
  const abiertoSinPropio = det.open;
  const conPropio = JSON.parse(JSON.stringify(tras));
  conPropio.ojLogoB64 = 'iVBORw0KGgo='; conPropio.ojLogoMime = 'image/png';
  renderLogoOJ(conPropio);
  const escudo = {
    plegado: det.tagName === 'DETAILS' && det.className.includes('oj-mas'),
    abiertoSinPropio, abiertoConPropio: det.open
  };
  renderLogoOJ(sinPropio);

  return {
    muertas: _CFG_MUERTAS.filter(k => k in tras),
    campos, escudo,
    // Lo que el usuario ya tenía configurado no se toca
    intacto: tras.ojMinisterio === crudo.ojMinisterio && tras.ojAsunto === crudo.ojAsunto
  };
});
log(limpio.muertas.length === 0,
  '⚠️ Las seis claves huérfanas (consecutivo, código/versión/clasificación, TRD, revisó) se retiran de la config',
  limpio.muertas.join(', '));
log(limpio.intacto, 'Sin tocar nada de lo que sí se imprime');
log(limpio.escudo.plegado && !limpio.escudo.abiertoSinPropio && limpio.escudo.abiertoConPropio,
  '⚠️ El escudo viene embebido: su bloque va plegado y solo se abre si hay uno propio cargado',
  JSON.stringify(limpio.escudo));
log(limpio.campos.join(',') === 'aj-oj-min,aj-oj-inst,aj-oj-uni,aj-oj-logo-file,' +
    'aj-oj-asunto,aj-oj-fnom,aj-oj-fdir,aj-oj-fmun,aj-oj-fdep,aj-oj-jini,aj-oj-jfin',
  'La sección del oficio se queda solo con campos que el documento imprime o usa Y que no se piden en otra parte',
  limpio.campos.join(', '));

/* ─────────── 12. El nombre de la unidad: un solo dato, tres documentos ───────────
   Se pedía TRES veces —«Nombre de la estación» y «Nombre para el oficio» en la
   misma pantalla, y «Línea 4 — estación o dependencia» en la del oficio— y la
   herencia solo corría en un sentido: quien diligenciaba Estación entera seguía
   bloqueado por V27. Además `nombreEstacion` nacía sembrada con «CANDELARIA»,
   una estación real de Medellín, así que un equipo recién instalado en cualquier
   otra ciudad imprimía esa estación en el dossier sin que nadie la escribiera. */
console.log('\n── 12 · El nombre de la unidad se pide una sola vez ──');
const uni = await page.evaluate(async () => {
  const T = x => (x.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(s => s.replace(/<[^>]*>/g, ''));
  const guardar = c => DB.saveConfig(JSON.parse(JSON.stringify(c)));
  const membrete = async c => {
    const caso = SIM.genOJ(); caso.isTest = false;
    caso.oj.encabezado = { ministerio: '', institucion: '', unidad: '', dependencia: '' };
    caso.oj.custodia = { estacion: '', direccion: '', barrio: '', ciudad: '', telefono: '', correo: '', web: '' };
    ojPrellenarDeCfg(caso, DB.getConfig());
    const out = await buildOficioOJBlob(ojCasoParaDocumento(caso), 'CARTA');
    const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
    return { header: T(new TextDecoder().decode(files['word/header1.xml'])),
             duras: ojDuras(caso).map(v => v.id) };
  };
  const base = JSON.parse(JSON.stringify(DB.getConfig()));
  const limpia = k => { const c = JSON.parse(JSON.stringify(base));
    ['nombreEstacion','ojCustEstacion','ojDependencia','ojPieDependencia','ojCiudad','ojCustCiudad'].forEach(x => { c[x] = ''; });
    Object.keys(k || {}).forEach(x => { c[x] = k[x]; });
    return c; };

  // (a) Equipo NUEVO: ninguna estación inventada, en ninguna de las tres claves.
  localStorage.removeItem('lc_cfg');
  const virgen = DB.getConfig();
  const nuevo = { nombreEstacion: virgen.nombreEstacion, dossier: genDossier({ tipo: 'URI', capturados: [], conductas: [] }) };

  // (b) El usuario escribe la unidad UNA vez y el membrete deja de bloquear.
  guardar(limpia({ nombreEstacion: 'LAURELES', ojMinisterio: 'MIN', ojInstitucion: 'INST', ojUnidad: 'METRO' }));
  const soloEstacion = await membrete();
  const dossierUna = genDossier({ tipo: 'URI', capturados: [], conductas: [] });

  // (c) ⚠️ NO REGRESIÓN: un equipo que ya tenía la línea 4 configurada imprime
  //     exactamente lo mismo que antes — su clave propia manda sobre la nueva.
  guardar(limpia({ nombreEstacion: 'LAURELES', ojDependencia: 'SECCIONAL DE INVESTIGACIÓN CRIMINAL',
                   ojMinisterio: 'MIN', ojInstitucion: 'INST', ojUnidad: 'METRO' }));
  const conLegado = await membrete();

  // (d) …y abrir Ajustes y pulsar «Guardar» SIN tocar el nombre no lo colapsa.
  go('ajustes'); loadAjustesFields();
  const vistoEnAjustes = document.getElementById('aj-estacion').value;
  saveAjustes();
  const trasGuardar = { membrete: DB.getConfig().ojDependencia, nombre: DB.getConfig().nombreEstacion };

  // (e) Migración: quien solo tenía el dato en la clave del oficio lo ve aquí.
  guardar(limpia({ ojDependencia: 'CAI Parque Bolívar' }));
  go('ajustes'); loadAjustesFields();
  const migrado = document.getElementById('aj-estacion').value;

  DB.saveConfig(base);
  return { nuevo, soloEstacion, dossierUna, conLegado, vistoEnAjustes, trasGuardar, migrado };
});
log(uni.nuevo.nombreEstacion === '',
  '⚠️ Un equipo recién instalado no trae ninguna estación sembrada («CANDELARIA» era una estación real)',
  JSON.stringify(uni.nuevo.nombreEstacion));
log(!/ESTACIÓN DE POLICÍA/.test(uni.nuevo.dossier),
  '⚠️ Y su dossier omite el renglón en vez de nombrar una estación que no es la suya',
  uni.nuevo.dossier.split('\n').slice(0, 3).join(' / '));
log(uni.soloEstacion.duras.indexOf('V27') < 0 && uni.soloEstacion.duras.indexOf('V29') < 0,
  '⚠️ Escrito UNA vez en Estación, el membrete y la custodia dejan de bloquear (V27/V29)',
  uni.soloEstacion.duras.join(','));
log(uni.soloEstacion.header.join('|') === 'MIN|INST|METRO|ESTACIÓN DE POLICÍA LAURELES',
  'La línea 4 del membrete sale del nombre de la unidad, con su rótulo completo',
  uni.soloEstacion.header.join(' / '));
log(/ESTACIÓN DE POLICÍA LAURELES/.test(uni.dossierUna),
  'Y el encabezado del dossier imprime esa misma unidad — un dato, tres salidas');
log(uni.conLegado.header[3] === 'SECCIONAL DE INVESTIGACIÓN CRIMINAL',
  '⚠️ NO REGRESIÓN: un equipo con la línea 4 ya configurada imprime lo de siempre',
  uni.conLegado.header[3]);
log(uni.trasGuardar.membrete === 'SECCIONAL DE INVESTIGACIÓN CRIMINAL' && uni.vistoEnAjustes === 'LAURELES',
  '⚠️ Abrir Ajustes y guardar sin tocar el nombre no colapsa un membrete distinto del lugar de custodia',
  JSON.stringify(uni.trasGuardar));
log(uni.migrado === 'CAI Parque Bolívar',
  'Quien solo tenía la unidad en la clave del oficio la ve en Ajustes y no la vuelve a teclear',
  uni.migrado);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

/* Deja el .docx en disco para abrirlo en Word real. */
await writeFile(join(ROOT, 'verify_oj_salida.docx'), Buffer.from(doc.b64, 'base64'));
console.log('\n📄 Documento generado: verify_oj_salida.docx');
console.log(fails === 0 ? `\n✅ ${n} comprobaciones, todas en verde` : `\n❌ ${fails} de ${n} comprobaciones fallaron`);

await browser.close();
server.close();
process.exit(fails === 0 ? 0 : 1);
