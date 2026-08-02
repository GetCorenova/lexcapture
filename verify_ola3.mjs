/* Regresión de la OLA 3 — los 36 campos huérfanos.
   Regla: un campo que no sale en ningún entregable no se le pide a un
   funcionario en la calle. Cada uno se IMPRIME, se PLIEGA (alimenta el registro
   de Personas) o se ELIMINA.
   ⚠️ Lo que se imprime va DENTRO de la narración, que es el espacio que el
   formato tiene para los hechos: no se añade ni un apartado, ni una tabla, ni
   una fila — la estructura de «Propuesta Plantilla OJ» queda intacta. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8143;
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '445566');
await page.fill('#pin-b', '445566');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'MINISTERIO X'; cfg.ojInstitucion = 'INSTITUCION X';
  cfg.ojUnidad = 'UNIDAD X'; cfg.ojDependencia = 'CANDELARIA';
  cfg.ojCustEstacion = 'La Candelaria'; cfg.ojCustDireccion = 'Calle 48 55-50';
  cfg.ojCustTelefono = '6041111111'; cfg.ojCustCorreo = 'c@prueba.test';
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'JUAN PEREZ', cargo: 'Patrullero' }];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
});

/* ─────────── 1. Los campos eliminados ya no se piden ─────────── */
const eliminados = [
  ['oj-o-dirig', 'Orden dirigida a', 0],
  ['oj-d-esp', 'Especialidad del despacho', 0],
  ['oj-d-ident', 'Identificación del despacho', 0],
  ['oj-d-resp', 'Funcionario responsable del despacho', 0],
  ['oj-d-juez', 'Nombre del juez', 0],
  ['oj-d-cargo', 'Cargo del juez', 0],
  ['oj-p-fdec', 'Fecha de la decisión judicial', 0],
  ['oj-p-desc', 'Descripción jurídica', 0],
  ['oj-p-pena', 'Descripción de la pena', 0],
  ['oj-p-penam', 'Meses de prisión', 0],
  ['oj-p-penaa', 'Penas accesorias', 0],
  ['oj-r-otros', 'Demás datos identificativos', 1],
  ['oj-g-veh', 'Vehículo institucional', 2]
];
await page.evaluate(() => { wc = ojNuevoCaso(); ws = 0; renderWiz(); });
for (const [id, label, paso] of eliminados) {
  await page.evaluate(p => { ws = p; renderWiz(); }, paso);
  await page.waitForTimeout(60);
  const existe = await page.evaluate(i => !!document.getElementById(i), id);
  log(existe === false, 'Eliminado: ' + label, '#' + id);
}
// El de la pena solo aparecía en condena: se comprueba con esa finalidad puesta.
const penaCondena = await page.evaluate(() => {
  wc.oj.orden.finalidad = 'CONDENA'; ws = 0; renderWiz();
  return !!document.getElementById('oj-p-pena');
});
log(penaCondena === false, 'El bloque de pena tampoco aparece en una captura por condena');

/* ─────────── 2. Los que alimentan el registro quedan plegados ─────────── */
const plegados = await page.evaluate(() => {
  ws = 0; renderWiz();            // Mejora 2: el requerido es el paso 1
  // ⚠️ Ese paso tiene ahora DOS bloques plegados (rasgos físicos y registro):
  // se busca el que contiene los campos que interesan, no «el primero».
  const det = [...document.querySelectorAll('.oj-mas')].find(d => d.querySelector('#oj-r-sx'));
  return {
    hay: !!det,
    abierto: det ? det.open : null,
    resumen: det ? det.querySelector('summary').textContent.trim() : '',
    campos: det ? ['oj-r-sx', 'oj-r-ec', 'oj-r-nac', 'oj-r-ali'].filter(i => det.querySelector('#' + i)).length : 0
  };
});
log(plegados.hay && plegados.abierto === false, 'Sexo, estado civil, nacionalidad y alias quedan plegados');
log(plegados.campos === 4, 'Los cuatro siguen disponibles dentro del bloque', plegados.campos + '/4');
log(/no salen en el oficio/i.test(plegados.resumen), 'Y el bloque dice por qué está ahí', plegados.resumen.slice(0, 60));

// Siguen viajando al registro de Personas
const espejo = await page.evaluate(() => {
  wc.oj.requerido.priNom = 'CARLOS'; wc.oj.requerido.priApe = 'GOMEZ';
  wc.oj.requerido.sexo = 'M'; wc.oj.requerido.estadoCivil = 'CASADO'; wc.oj.requerido.alias = 'EL FLACO';
  return ojPersonaEspejo(wc);
});
log(espejo.ecivil === 'Casado(a)' && espejo.alias === 'EL FLACO',
  'Y siguen llegando al registro de Personas', espejo.ecivil + ' · ' + espejo.alias);

/* ─────────── 3. Lo que ahora SÍ se imprime ─────────── */
const doc = await page.evaluate(async () => {
  const c = ojNuevoCaso();
  const hoy = new Date().toISOString().slice(0, 10);
  c.oj.orden.numero = '002';
  c.oj.orden.fechaExpedicion = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'CONDENA';
  c.oj.orden.verificacion = { sistema: 'PDA', fecha: hoy, hora: '07:40', funcionario: 'SI PRUEBA',
    resultado: 'PENDIENTE', observacion: 'Se confirmó por radio con el despacho' };
  c.oj.despacho.nombre = 'Juzgado Quinto de Ejecución de Penas';
  c.oj.despacho.tipo = 'JEPMS';
  c.oj.proceso.radicado = '05001600020620261234';
  c.oj.requerido.priNom = 'CARLOS'; c.oj.requerido.priApe = 'GOMEZ';
  c.oj.requerido.numDoc = '71234567'; c.oj.requerido.fechaNac = '1985-03-20';
  c.oj.diligencia.fecha = hoy; c.oj.diligencia.hora = '07:11';
  c.oj.diligencia.lugarDireccion = 'Calle 53 con carrera 51';
  c.oj.diligencia.funcionarios = [{ grado: 'Subintendente', nombre: 'JUAN PEREZ', cedula: '111' }];
  c.oj.actuacion.derechos = { leidos: true, fecha: hoy, hora: '07:20', lugar: 'el sitio de la captura', observacion: '' };
  // Los tres bloques que antes se perdían
  c.oj.actuacion.comunicacion = { nombre: 'MARIA LOPEZ', parentesco: 'MADRE', telefono: '3001112233', hora: '07:35' };
  c.oj.actuacion.defensor = { tipo: 'PUBLICO', nombre: 'DEFENSOR DE PRUEBA', telefono: '' };
  c.oj.actuacion.valoracion = { realizada: 'SI', entidad: 'Hospital de Prueba', fecha: '', hora: '', renuencia: false };
  c.oj.destino.nombre = 'Juzgado Quinto de Ejecución de Penas';
  c.oj.destino.fechaEntrega = hoy; c.oj.destino.horaEntrega = '09:30';
  c.oj.destino.recibeNombre = 'FUNCIONARIO RECEPTOR'; c.oj.destino.recibeCargo = 'Secretario';
  ojEspejar(c);
  await DB.saveCase(c);
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return { texto: xml.replace(/<[^>]+>/g, ''), duras: ojDuras(c).map(v => v.id) };
});
const tiene = s => doc.texto.includes(s);
log(doc.duras.length === 0, 'El caso de prueba no tiene validaciones duras pendientes', doc.duras.join(',') || 'ninguna');
log(tiene('MARIA LOPEZ') && tiene('art. 303, num. 1 CPP') && tiene('madre') && tiene('3001112233'),
  'La comunicación a un familiar SE IMPRIME, con su fundamento (art. 303 CPP)');
log(tiene('Defensoría Pública'.toLowerCase()) || tiene('defensoría pública'),
  'El defensor designado SE IMPRIME');
log(tiene('DEFENSOR DE PRUEBA'), 'Con su nombre');
log(tiene('valoración médica') && tiene('Hospital de Prueba'), 'La valoración médica SE IMPRIME');
log(tiene('FUNCIONARIO RECEPTOR') && tiene('Secretario') && tiene('09:30'),
  'La constancia de entrega (quién recibe, cuándo) SE IMPRIME');
log(tiene('pendiente de confirmar') && tiene('Se confirmó por radio con el despacho'),
  'El resultado de la verificación cuando no fue positivo SE IMPRIME');

/* ─────────── 4. …sin tocar la estructura del formato ─────────── */
const forma = await page.evaluate(async () => {
  const c = DB.getCases()[0];
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return {
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    secciones: (xml.match(/Ttulo1/g) || []).length,
    filas: (xml.match(/<w:tr>/g) || []).length,
    txt: xml.replace(/<[^>]+>/g, '')
  };
});
// El membrete es una tabla aparte, en word/header1.xml: el cuerpo trae 3.
log(forma.tablas === 3, 'El cuerpo conserva sus 3 tablas, una por apartado', forma.tablas);
/* Mejora 2 (obs. 3): 9 + 10 + 3. El numeral 3 del formato tiene TRES filas —
   la cuarta que imprimía la app no existe en «Propuesta Plantilla OJ». */
log(forma.filas === 22, 'Y sus 22 filas fijas (9 + 10 + 3), las del formato: ninguna se añade', forma.filas);
log(forma.secciones === 3, 'Y sus 3 apartados numerados, ni uno más', forma.secciones);
log(['1.  IDENTIFICACIÓN', '2.  DATOS DEL PROCESO JUDICIAL', '3.  MATERIALIZACIÓN']
  .every(s => forma.txt.includes(s)), 'Con la misma redacción del formato');

/* ─────────── 5. Lo eliminado no dejó rastros en el documento ─────────── */
const sinRastro = await page.evaluate(async () => {
  const c = DB.getCases()[0];
  // Si alguien vuelve a diligenciar los campos viejos (caso guardado antes),
  // el documento no debe cambiar ni romperse.
  c.oj.despacho.juezNombre = 'JUEZ VIEJO';
  c.oj.proceso.descripcionJuridica = 'DESCRIPCION VIEJA';
  c.oj.proceso.pena = { descripcion: 'PENA VIEJA', meses: '96', accesorias: '' };
  c.oj.diligencia.vehiculo = 'PLACA VIEJA';
  const out = await buildOficioOJBlob(c, 'CARTA');
  const txt = new TextDecoder().decode(out.files['word/document.xml']).replace(/<[^>]+>/g, '');
  return ['JUEZ VIEJO', 'DESCRIPCION VIEJA', 'PENA VIEJA', 'PLACA VIEJA'].filter(s => txt.includes(s));
});
log(sinRastro.length === 0,
  'Un caso guardado con los campos viejos sigue generando el oficio, sin imprimirlos', sinRastro.join(',') || 'sin rastros');

/* ─────────── 6. Cuánto se recortó el formulario ─────────── */
const conteo = await page.evaluate(() => {
  wc = ojNuevoCaso(); wc.oj.orden.finalidad = 'CONDENA';
  go('wizard');                       // si no está en pantalla, todo mide 0
  const out = [];
  for (let i = 0; i < 4; i++) {
    ws = i; renderWiz();
    const panel = document.getElementById('wz-panels');
    const vis = el => el.offsetParent !== null;
    out.push([...panel.querySelectorAll('input:not([type=checkbox]), select, textarea')].filter(vis).length);
  }
  return { pasos: out, total: out.reduce((a, b) => a + b, 0) };
});
/* La Ola 3 lo dejó en 74; Mejora 2 retiró además la prórroga, el motivo
   textual, el medio y el resultado de la verificación, la vigencia manual, el
   tipo y la firma del despacho, y plegó los cinco rasgos físicos. */
log(conteo.total <= 66, 'El formulario visible baja de 120 campos a ' + conteo.total,
  'por paso: ' + conteo.pasos.join(' · '));
/* ⚠️ 27 controles en la pantalla del capturado, pero CINCO son las casillas
   pequeñas del widget de dirección normalizada (vía · número · cruce · placa ·
   complemento), que ocupan un solo renglón: son el mismo campo que antes se
   escribía a mano suelto. Sin ellas, 23 — con los cinco rasgos físicos y los
   cuatro datos de registro plegados. */
log(conteo.pasos[0] <= 27, 'La pantalla del capturado pliega de verdad sus rasgos y sus campos de registro', conteo.pasos[0]);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones, todas en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
