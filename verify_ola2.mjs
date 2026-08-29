/* Regresión de la OLA 2 — eliminación de redundancias e inferencia automática.
   Cubre: municipio ⇒ departamento (catálogo + aprendizaje + homónimos),
   herencia despacho ⇒ destinatario, T.I. por edad, edad calculada, anexos
   automáticos, hora/lugar de derechos heredados, delito ⇒ artículo del C.P.,
   buscador de Personas y viaje de vuelta simétrico. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8142;
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
await page.fill('#pin-a', '112233');
await page.fill('#pin-b', '112233');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'JUAN PEREZ', cedula: '1.111.111', cargo: 'Patrullero' }];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
});

/* ─────────── 1. Motor geográfico ─────────── */
const geo = await page.evaluate(() => ({
  medellin: lcGeoDepto('Medellín'),
  sinTilde: lcGeoDepto('medellin'),
  cali: lcGeoDepto('Cali'),
  cucuta: lcGeoDepto('Cúcuta'),
  sabaneta: lcGeoDepto('Sabaneta'),
  homonimo: lcGeoDepto('Barbosa'),
  desconocido: lcGeoDepto('Municipio Inventado'),
  capitales: Object.keys(LC_GEO).length
}));
log(geo.medellin === 'Antioquia', 'Medellín ⇒ Antioquia', geo.medellin);
log(geo.sinTilde === 'Antioquia', 'La búsqueda ignora tildes y mayúsculas', geo.sinTilde);
log(geo.cali === 'Valle del Cauca' && geo.cucuta === 'Norte de Santander' && geo.sabaneta === 'Antioquia',
  'Capitales y Valle de Aburrá resueltos', [geo.cali, geo.cucuta, geo.sabaneta].join(' · '));
log(geo.homonimo === '', 'Un homónimo (Barbosa: Antioquia y Santander) NO se adivina', '"' + geo.homonimo + '"');
log(geo.desconocido === '', 'Un municipio que no está en el catálogo no inventa departamento');

// Aprendizaje
const aprendido = await page.evaluate(() => {
  lcGeoRecordar('Turbaco', 'Bolívar');
  return { depto: lcGeoDepto('Turbaco'), guardado: !!(DB.getConfig().geoPropios || {})['turbaco'] };
});
log(aprendido.depto === 'Bolívar' && aprendido.guardado, 'La app aprende el municipio que el usuario diligencia', aprendido.depto);
const homonimoAprendido = await page.evaluate(() => {
  lcGeoRecordar('Barbosa', 'Antioquia');       // el usuario aclara cuál es el suyo
  return lcGeoDepto('Barbosa');
});
log(homonimoAprendido === 'Antioquia', 'Lo aprendido resuelve el homónimo de SU jurisdicción', homonimoAprendido);

/* ─────────── 2. Inferencia en el formulario ─────────── */
await page.evaluate(() => startWizard('OJ'));
await page.waitForTimeout(250);
await page.evaluate(() => wizGoto(1));   // Mejora 2: el despacho vive en el numeral 2
await page.waitForTimeout(250);
await page.fill('#oj-d-mun', 'Medellín');
await page.waitForTimeout(150);
const depAuto = await page.inputValue('#oj-d-dep');
log(depAuto === 'Antioquia', 'Escribir el municipio completa el departamento en el formulario', depAuto);

// El usuario corrige el municipio ⇒ el departamento inferido se recalcula
await page.fill('#oj-d-mun', 'Cali');
await page.waitForTimeout(150);
log(await page.inputValue('#oj-d-dep') === 'Valle del Cauca',
  'Corregir el municipio recalcula el departamento que puso la app');

// Pero nunca pisa lo que escribió el usuario
await page.fill('#oj-d-dep', 'ESCRITO A MANO');
await page.fill('#oj-d-mun', 'Medellín');
await page.waitForTimeout(150);
log(await page.inputValue('#oj-d-dep') === 'ESCRITO A MANO',
  '⚠️ Nunca pisa un departamento escrito por el usuario');

// Y lo que el usuario escribe encima de la sugerencia NO se concatena
await page.fill('#oj-d-dep', '');
await page.fill('#oj-d-mun', 'Pereira');
await page.waitForTimeout(120);
await page.fill('#oj-d-dep', 'Risaralda');
log(await page.inputValue('#oj-d-dep') === 'Risaralda',
  'Escribir encima de un campo autocompletado lo reemplaza, no lo concatena');

/* ─────────── 3. Herencia despacho ⇒ destinatario ─────────── */
const herencia = await page.evaluate(() => {
  const c = ojNuevoCaso();
  c.oj.orden.fechaExpedicion = new Date().toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'CONDENA';               // R4-A: el destinatario ES el despacho
  c.oj.despacho.nombre = 'Juzgado Quinto de Ejecución de Penas';
  c.oj.despacho.tipo = 'JEPMS';
  c.oj.despacho.direccion = 'Calle 44 No. 52-165';
  c.oj.despacho.municipio = 'Medellín';
  c.oj.despacho.departamento = 'Antioquia';
  c.oj.despacho.telefono = '6041234567';
  c.oj.requerido.fechaNac = '1990-01-01';
  c.oj.diligencia.fecha = new Date().toISOString().slice(0, 10);
  c.oj.diligencia.hora = '09:00';
  const s = ojAplicarSugerencia(c);
  return { regla: s.regla, d: c.oj.destino };
});
log(/R4-A/.test(herencia.regla), 'Captura por condena con despacho disponible ⇒ regla R4-A', herencia.regla);
log(herencia.d.direccion === 'Calle 44 No. 52-165' && herencia.d.municipio === 'Medellín' &&
    herencia.d.departamento === 'Antioquia' && herencia.d.telefono === '6041234567',
  'El destinatario hereda dirección, ciudad, departamento y teléfono del despacho',
  [herencia.d.direccion, herencia.d.municipio].join(' · '));

const noHerencia = await page.evaluate(() => {
  const c = ojNuevoCaso();
  c.oj.orden.fechaExpedicion = new Date().toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'IMPUTACION';            // R3: el destinatario es el fiscal, NO el juzgado
  c.oj.despacho.nombre = 'Juzgado de Garantías';
  c.oj.despacho.direccion = 'DIRECCION DEL JUZGADO';
  c.oj.requerido.fechaNac = '1990-01-01';
  const s = ojAplicarSugerencia(c);
  return { regla: s.regla, dir: c.oj.destino.direccion };
});
log(/R3/.test(noHerencia.regla) && noHerencia.dir === '',
  '⚠️ Y NO hereda cuando el destinatario es otra autoridad (R3: el fiscal)', noHerencia.regla);

/* ─────────── 4. Tipo de documento por edad ─────────── */
const docMenor = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 0;              // Mejora 2: el requerido es el paso 1
  wc.oj.requerido.fechaNac = '2010-05-05';
  wc.oj.proceso.fechaHechos = '2026-01-10';       // 15 años al momento de los hechos
  renderWiz();
  // ⚠️ Mejora 3 (obs. 1): la inferencia vive donde vive el campo — el formulario
  // del capturado, que ahora se abre en un modal.
  ojAbrirRequerido();
  const tipo = wc.oj.requerido.tipoDoc, sel = (document.getElementById('oj-r-td') || {}).value;
  closeModal(); renderWiz();
  return { tipo, sel, adolescente: ojEsAdolescente(wc) };
});
log(docMenor.adolescente === true && docMenor.tipo === 'TI' && docMenor.sel === 'TI',
  'Adolescente al momento de los hechos ⇒ tipo de documento T.I. automático', docMenor.tipo);
const docManual = await page.evaluate(() => {
  wc.oj.requerido.tipoDocManual = true; wc.oj.requerido.tipoDoc = 'CE';
  renderWiz();
  return wc.oj.requerido.tipoDoc;
});
log(docManual === 'CE', '⚠️ Si el usuario elige el tipo a mano, la inferencia no se lo cambia', docManual);

/* ─────────── 5. Edad calculada ─────────── */
const edad = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 0;
  wc.oj.requerido.fechaNac = '2000-06-15';
  renderWiz(); ojAbrirRequerido();          // Mejora 3: el campo vive en el modal
  const el = document.getElementById('oj-r-ed');
  const out = { valor: el.value, soloLectura: el.hasAttribute('readonly') };
  closeModal(); renderWiz();
  return out;
});
log(edad.valor === String(new Date().getFullYear() - 2000 - (new Date() < new Date(new Date().getFullYear(), 5, 15) ? 1 : 0)),
  'La edad se calcula de la fecha de nacimiento', edad.valor);
log(edad.soloLectura === true, 'Y deja de ser un campo que haya que diligenciar');
const edadSinFecha = await page.evaluate(() => {
  wc.oj.requerido.fechaNac = ''; renderWiz(); ojAbrirRequerido();
  const ro = document.getElementById('oj-r-ed').hasAttribute('readonly');
  closeModal(); renderWiz();
  return ro;
});
log(edadSinFecha === false, 'Sin fecha de nacimiento sigue siendo editable (hay órdenes que solo traen la edad)');

/* ─────────── 6. Derechos: hora y lugar heredados ───────────
   ⚠️ Mejora 3 (obs. 4): la lectura de derechos dejó de ser un formulario. La
   herencia sigue siendo la misma idea —hora y lugar salen de la diligencia—,
   solo que ahora se DERIVA al imprimir en vez de rellenar unos campos. */
const derechos = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 2;
  wc.oj.diligencia.hora = '14:35';
  wc.oj.diligencia.lugarDireccion = 'Calle 53 con carrera 51';
  renderWiz();
  return ojDerechos(wc);
});
log(derechos.hora === '14:35' && /Calle 53/.test(derechos.lugar) && derechos.leidos === true,
  'La hora y el lugar de lectura de derechos salen de la diligencia',
  derechos.hora + ' · ' + derechos.lugar);
const derechosRespeta = await page.evaluate(() => {
  wc.oj.actuacion.derechos.hora = '20:00'; wc.oj.diligencia.hora = '07:00';
  renderWiz();
  return ojDerechos(wc).hora;
});
log(derechosRespeta === '20:00', '⚠️ Y no se pisan si ya estaban diligenciadas', derechosRespeta);

/* ─────────── 7. Anexos automáticos ─────────── */
const anexos = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 2;
  wc.oj.orden.numero = '002';
  wc.oj.requerido.numDoc = '1234567890';
  renderWiz();
  return wc.oj.actuacion.anexos;
});
/* ⚠️ Mejora 3 (obs. 6): el catálogo y las reglas cambiaron — el acta de derechos
   y la constancia de buen trato son UN formato y viajan siempre, y se añade la
   copia del documento de identificación. */
log(anexos.includes('Informe dejando a disposición') &&
    anexos.includes('Copia orden de captura oficio No. {{ORD_NUMERO}}') &&
    anexos.includes('Acta de derechos del capturado y constancia de buen trato') &&
    anexos.includes('Copia documento de identificación'),
  'Los anexos se marcan solos según lo ya registrado', anexos.length + ' anexos');
const anexosManual = await page.evaluate(() => {
  wc.oj.actuacion.anexosManual = true;
  wc.oj.actuacion.anexos = ['Registro fotográfico'];
  renderWiz();
  return wc.oj.actuacion.anexos;
});
log(anexosManual.length === 1 && anexosManual[0] === 'Registro fotográfico',
  '⚠️ En cuanto el usuario toca una casilla, la app deja de proponer', anexosManual.join(','));

/* ─────────── 8. Delito ⇒ artículo del Código Penal ─────────── */
// Mejora 2: los delitos son la fila 7 del numeral 2, o sea el paso 2.
await page.evaluate(() => { wc = ojNuevoCaso(); ws = 1; renderWiz(); });
await page.waitForTimeout(200);
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]');
await page.waitForTimeout(200);
await page.fill('#ojl-delitos-0-nombre', 'Hurto calificado y agravado');
await page.waitForTimeout(150);
const art = await page.inputValue('#ojl-delitos-0-articulo');
log(art === '239, 240 y 241', 'Elegir el delito rellena el artículo del Código Penal', art);
const listaCond = await page.getAttribute('#ojl-delitos-0-nombre', 'list');
log(listaCond === 'dl-cond', 'El campo de delito usa el catálogo que ya existía para flagrancia', listaCond);
await page.fill('#ojl-delitos-0-articulo', '240');
await page.fill('#ojl-delitos-0-nombre', 'Hurto agravado');
await page.waitForTimeout(150);
log(await page.inputValue('#ojl-delitos-0-articulo') === '240',
  '⚠️ Un artículo escrito a mano no se toca aunque cambie el delito');

/* ─────────── 9. Personas: buscador y viaje de vuelta ─────────── */
await page.evaluate(async () => {
  await DB.savePerson({
    id: 'per1', rol: 'Capturado', tipoDoc: 'CC', numDoc: '71234567', priNom: 'CARLOS', priApe: 'GOMEZ',
    fn: '1985-03-20', padres: 'MARIA LOPEZ y PEDRO GOMEZ', ecivil: 'Casado(a)',
    lugNac: 'Bello, Antioquia', dirRes: 'Cra 50 #10-20', tel: '3001112233', senas: 'Cicatriz'
  });
  await DB.savePerson({ id: 'per2', rol: 'Capturado', tipoDoc: 'CC', numDoc: '99999999', priNom: 'OTRA', priApe: 'PERSONA' });
});
await page.evaluate(() => { wc = ojNuevoCaso(); ws = 0; renderWiz(); });
await page.waitForTimeout(200);
await page.evaluate(() => ojCargarPersona());
await page.waitForTimeout(250);
log(await page.isVisible('#oj-per-q'), 'El selector de personas tiene buscador');
await page.fill('#oj-per-q', 'gomez');
await page.waitForTimeout(200);
const resultados = await page.$$eval('#oj-per-res .oj-row', els => els.length);
log(resultados === 1, 'El buscador filtra por nombre', resultados + ' resultado');
await page.evaluate(() => ojUsarPersona('per1'));
await page.waitForTimeout(250);
const traida = await page.evaluate(() => {
  const r = wc.oj.requerido;
  return { madre: r.madre, padre: r.padre, ecivil: r.estadoCivil, nacMun: r.nacMunicipio, nacDep: r.nacDepartamento, tel: r.resTelefono };
});
log(traida.madre === 'MARIA LOPEZ' && traida.padre === 'PEDRO GOMEZ',
  'Al recargar la persona vuelven los nombres de los padres (antes se perdían)', traida.madre + ' / ' + traida.padre);
log(traida.ecivil === 'CASADO', 'Y el estado civil, traducido al código del catálogo', traida.ecivil);
log(traida.nacMun === 'Bello' && traida.nacDep === 'Antioquia',
  'El lugar de nacimiento se reparte en municipio y departamento', traida.nacMun + ', ' + traida.nacDep);

/* ─────────── 10. El funcionario que verifica sale del perfil ───────────
   ⚠️ Mejora 3 (obs. 2): ya no se precarga en un campo — se deriva del
   funcionario de la diligencia, que a su vez sale del perfil activo. Es la misma
   inferencia, un paso más arriba y sin campo que rellenar. */
const verif = await page.evaluate(() => ojVerificacion(ojNuevoCaso()).funcionario);
log(/JUAN PEREZ/.test(verif), 'El funcionario que verifica la orden sale del perfil activo', verif);

/* ─────────── 11. Cuánto se ahorró ─────────── */
/* ⚠️ Expectativa actualizada el 2026-08-28 (Mejora 6, 2.º documento, obs. 16):
   los PERFILES REGIONALES se retiraron por instrucción del usuario. Guardaban
   NUNC, localidad, zona, unidad y despachos por zona, pero desde que el DESPACHO
   lleva su propio NUNC y su propia jurisdicción, activar un perfil regional solo
   reescribía claves de respaldo que ya no manda nadie.
   Lo que este check protege sigue siendo lo mismo —que la línea 3 del membrete
   se escriba UNA vez y entre sola en cada captura— y ahora sale de Ajustes →
   Mi unidad, que es donde el usuario ya escribe las otras tres líneas. */
const unidadLinea3 = await page.evaluate(() => {
  const cfg = DB.getConfig(); cfg.ojUnidad = 'UNIDAD DE PRUEBA'; DB.saveConfig(cfg);
  return ojNuevoCaso().oj.encabezado.unidad;
});
log(unidadLinea3 === 'UNIDAD DE PRUEBA',
  'La línea 3 del membrete entra sola en cada captura (se escribe una vez)', unidadLinea3);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones, todas en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
