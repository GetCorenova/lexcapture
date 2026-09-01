/* Regresión de «Mejora 3» — el módulo de orden judicial, revisado en campo.
   Una sección por observación de `Documentos/Otro/Mejora 3.docx`:
     1. La persona capturada se toma igual que en flagrancia (tarjeta + modal).
     2. Información repetida: el funcionario que verifica, la fecha y la hora.
     3. «Forma de ubicación» y coordenadas, fuera.
     4. «Actuación policial» (derechos, comunicación, fuerza), fuera.
     5. Ni incautaciones ni cadena de custodia en una captura por orden judicial.
     6. Los anexos, en el orden que pidió el usuario y con el número resuelto.
     7. «Dejando a disposición»: el destinatario deja de estar perdido.
     8. El dossier de orden judicial imprime CUÁNDO, DÓNDE y la patrulla.
   ⚠️ Se mide el DOCUMENTO además del formulario: quitar un campo del wizard no
   puede quitar una frase del oficio si esa frase es una constancia legal. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8153;
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

const browser = await chromium.launch();
// El teléfono de la auditoría: todo lo que se mida de scroll y de controles es
// sobre esta pantalla, no sobre un escritorio.
const page = await browser.newPage({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true });
const errores = [];
page.on('pageerror', e => errores.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

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
  cfg.ojMinisterio = 'MINISTERIO M3'; cfg.ojInstitucion = 'INSTITUCION M3';
  cfg.ojUnidad = 'UNIDAD M3'; cfg.ojDependencia = 'CANDELARIA';
  cfg.ojCiudad = 'Medellin';
  cfg.ojCustEstacion = 'La Candelaria'; cfg.ojCustDireccion = 'Calle 48 No 55-50';
  cfg.ojCustTelefono = '6040000000'; cfg.ojCustCorreo = 'm3@prueba.test'; cfg.ojPieWeb = 'www.m3.test';
  cfg.ojFiscaliaNombre = 'FISCALIA URI CENTRO';
  cfg.ojFiscaliaDireccion = 'Carrera 64C 67-300, barrio Caribe';
  cfg.ojFiscaliaMunicipio = 'Medellin'; cfg.ojFiscaliaDepartamento = 'Antioquia';
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'NELSON DAVID DAVID', cedula: '1035302775', cargo: 'Patrullero', telefono: '3000000000', correo: 'f@m3.test',
    /* ⚠️ 2026-08-28 (obs. 12): «Conocieron el caso» dejo de ser una lista de
       Ajustes y se DERIVA del perfil activo y su companero de patrulla. */
    companero: { grado: 'Patrullero', nombre: 'JUAN CORDOBA', cedula: '71234567', cargo: 'Patrullero' } }];
  cfg.perfilActivo = 'p1';
  cfg.patrullaNum = '32'; cfg.patrullaUnidad = 'CAI Parque Bolivar';
  cfg.conocieronFuncionarios = ['SI Nelson David', 'PT Juan Cordoba'];
  cfg.dosVerde3 = 'T.C Jim Eduardo Padilla'; cfg.dosDiamante3 = 'T.C William Quintero';
  DB.saveConfig(cfg);
});

/* Caso completo por modelo — el tecleo lo cubren las secciones 1 y 7. */
const semilla = () => page.evaluate(() => {
  const hoy = new Date().toISOString().slice(0, 10);
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
  const c = ojNuevoCaso();
  c.oj.orden.numero = '002-2026';
  c.oj.orden.fechaExpedicion = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'CONDENA';
  c.oj.despacho.nombre = 'Juzgado Sexto Penal del Circuito de Copacabana';
  c.oj.despacho.direccion = 'Palacio de Justicia, oficina 301';
  c.oj.despacho.municipio = 'Copacabana'; c.oj.despacho.departamento = 'Antioquia';
  c.oj.proceso.radicado = '4196993675034202654534';
  c.oj.proceso.delitos = [{ nombre: 'Extorsion', articulo: '244' }];
  c.oj.requerido.priNom = 'BRAYAN'; c.oj.requerido.priApe = 'ZAPATA'; c.oj.requerido.segApe = 'ROMERO';
  c.oj.requerido.numDoc = '1123340538'; c.oj.requerido.expedidoEn = 'Itagui';
  c.oj.requerido.fechaNac = '1991-11-28';
  c.oj.requerido.nacMunicipio = 'Bello'; c.oj.requerido.nacDepartamento = 'Antioquia';
  c.oj.requerido.estadoCivil = 'CASADO'; c.oj.requerido.profesion = 'Desempleado';
  c.oj.diligencia.fecha = hoy; c.oj.diligencia.hora = hh;
  c.oj.diligencia.lugarDireccion = 'CL 52 # 50-31';
  c.oj.diligencia.lugarBarrio = 'La Candelaria';
  c.oj.diligencia.lugarMunicipio = 'Medellin'; c.oj.diligencia.lugarDepartamento = 'Antioquia';
  c.oj.diligencia.funcionarios = [{ grado: 'Subintendente', nombre: 'NELSON DAVID DAVID', cedula: '1035302775' }];
  c.oj.actuacion.observaciones = 'Relato del procedimiento escrito por el funcionario.';
  ojAplicarSugerencia(c);
  window.__caso = c;
  return true;
});
await semilla();

const texto = (c) => page.evaluate(async (caso) => {
  const out = await buildOficioOJBlob(caso, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(' ');
}, c);

/* ══════ Obs. 1 · La persona capturada, como en flagrancia ══════ */
const p1 = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 0; go('wizard'); renderWiz();
  const panel = document.getElementById('wz-panels');
  const vacio = {
    campos: panel.querySelectorAll('input,select,textarea').length,
    agregar: !!panel.querySelector('[onclick="ojAbrirRequerido()"]'),
    buscar: !!panel.querySelector('[onclick="ojCargarPersona()"]'),
    // ⚠️ 2026-08-28 (obs. 3): el estado vacío son ahora los dos botones.
    estadoVacio: !!panel.querySelector('button[onclick="ojAbrirRequerido()"]'),
    alto: panel.scrollHeight
  };
  // El patrón de flagrancia, para comparar: tarjetas + Agregar + Buscar existente.
  ojAbrirRequerido();
  const modal = document.getElementById('modal-c');
  const enModal = { pn: !!modal.querySelector('#oj-r-pn'), nd: !!modal.querySelector('#oj-r-nd'),
    campos: modal.querySelectorAll('input,select,textarea').length };
  // Se diligencia en el modal y se guarda: la tarjeta tiene que aparecer.
  modal.querySelector('#oj-r-pn').value = 'BRAYAN';
  modal.querySelector('#oj-r-pa').value = 'ZAPATA';
  modal.querySelector('#oj-r-nd').value = '1123340538';
  ojGuardarRequerido();
  const conCard = {
    nombre: (document.querySelector('.pcard .pinfo') || {}).textContent || '',
    doc: (document.querySelector('.pcard .pdoc') || {}).textContent || '',
    campos: document.getElementById('wz-panels').querySelectorAll('input,select,textarea').length,
    modelo: wc.oj.requerido.priNom + ' ' + wc.oj.requerido.numDoc,
    alto: document.getElementById('wz-panels').scrollHeight
  };
  return { vacio, enModal, conCard };
});
log(p1.vacio.campos === 0 && p1.vacio.agregar && p1.vacio.buscar && p1.vacio.estadoVacio,
  'El paso del capturado ya no es un formulario: tarjeta vacía + «Agregar» + «Buscar existente»',
  p1.vacio.campos + ' campos en pantalla');
log(p1.enModal.pn && p1.enModal.nd && p1.enModal.campos > 20,
  'Los datos se diligencian en un modal enfocado, como en flagrancia (openPersonModal)',
  p1.enModal.campos + ' campos en el modal');
log(/BRAYAN ZAPATA/.test(p1.conCard.nombre) && /1123340538/.test(p1.conCard.doc),
  'Al guardar, la tarjeta muestra a la persona con su documento', p1.conCard.nombre + ' · ' + p1.conCard.doc);
log(p1.conCard.modelo === 'BRAYAN 1123340538',
  'Y el modelo recibe lo tecleado en el modal (ojCollectRequerido se autolimita por DOM)', p1.conCard.modelo);
log(p1.conCard.campos === 0,
  'Con la persona registrada, el paso sigue sin un solo campo suelto', p1.conCard.campos + ' campos');
log(p1.vacio.alto < 700 && p1.conCard.alto < 700,
  'El paso 1 cabe en una pantalla de teléfono (antes eran cuatro)',
  p1.vacio.alto + ' px vacío · ' + p1.conCard.alto + ' px con persona');

// «Buscar existente» abre el buscador del registro, no una lista de 60.
const p1b = await page.evaluate(async () => {
  await DB.savePerson({ id: 'per-1', rol: 'Capturado', priNom: 'YEISON', priApe: 'RAMIREZ',
    tipoDoc: 'CC', numDoc: '1159794405', fn: '1967-02-17', dirRes: 'CL 74 # 60-97', tel: '3169123334',
    lugNac: 'Bello, Antioquia', ecivil: 'Casado/a', padres: 'Paula Ramirez y Felipe Betancur' });
  wc = ojNuevoCaso(); ws = 0; renderWiz();
  ojCargarPersona();
  const buscador = !!document.getElementById('oj-per-q');
  ojUsarPersona('per-1');
  return { buscador, nombre: wc.oj.requerido.priNom + ' ' + wc.oj.requerido.priApe,
    dir: wc.oj.requerido.resDireccion, madre: wc.oj.requerido.madre,
    card: (document.querySelector('.pcard .pinfo') || {}).textContent || '' };
});
log(p1b.buscador, 'El picker de personas tiene buscador (no una lista larga)');
log(p1b.nombre === 'YEISON RAMIREZ' && p1b.dir === 'CL 74 # 60-97' && p1b.madre === 'Paula Ramirez',
  'Traer una persona del registro rellena el requerido, con su dirección y sus padres', p1b.nombre);
log(/YEISON RAMIREZ/.test(p1b.card), 'Y la tarjeta lo refleja sin abrir el modal');

/* ══════ Obs. 2 · Información repetida ══════ */
const p2 = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso)); ws = 1; renderWiz();
  const panel = document.getElementById('wz-panels');
  const ids = ['oj-o-vfun', 'oj-o-vfec', 'oj-o-vhor', 'oj-o-vobs'];
  const ver = ojVerificacion(wc);
  return {
    presentes: ids.filter(i => !!document.getElementById(i)),
    /* ⚠️ AUDITORIA 2026-09-01 (punto 2) — este check exigia una nota .oj-auto de
       143 caracteres al pie del paso, avisando de que la constancia de
       verificacion «no hay que escribirla otra vez». La nota se retiro: nadie
       echa de menos un campo que nunca ha visto, y un mes despues de que Mejora
       3 lo quitara lo unico que quedaba era una advertencia sobre algo que no
       esta. Lo que el check protege de verdad —que la constancia se derive y
       SIGA IMPRIMIENDOSE— no dependia de ese parrafo, asi que ahora se mide
       donde tiene efecto: en el oficio. */
    parrafos: panel.querySelectorAll('.oj-auto').length,
    ver, dil: { f: wc.oj.diligencia.fecha, h: wc.oj.diligencia.hora,
      fun: [wc.oj.diligencia.funcionarios[0].grado, wc.oj.diligencia.funcionarios[0].nombre].join(' ') }
  };
});
log(p2.presentes.length === 0,
  'El bloque «Verificación de la orden» ya no pide funcionario, fecha ni hora otra vez',
  p2.presentes.length ? p2.presentes.join(', ') : 'ningún campo duplicado');
log(p2.ver.fecha === p2.dil.f && p2.ver.hora === p2.dil.h && p2.ver.funcionario === p2.dil.fun,
  'Se derivan de la diligencia: quien verifica la orden es quien hace la captura',
  p2.ver.funcionario + ' · ' + p2.ver.fecha + ' ' + p2.ver.hora);
log(p2.parrafos === 0, 'Y el paso no gasta un párrafo en explicar un campo retirado', p2.parrafos + ' notas');

const docBase = await texto(await page.evaluate(() => window.__caso));
log(/Verificada la informaci[oó]n en el sistema de informaci[oó]n institucional/.test(docBase) &&
    /por Subintendente NELSON DAVID DAVID/.test(docBase),
  'La constancia de verificación SIGUE imprimiéndose en el oficio, con su funcionario');
log(/se procedi[oó] a leer y materializar los derechos/.test(docBase) &&
    /art[ií]culo 303 de la Ley 906 de 2004/.test(docBase),
  'Y la constancia del art. 303 CPP también, aunque ya no haya casilla que marcar');

/* Una captura guardada con sus propios datos de verificación los conserva. */
const p2b = await page.evaluate(() => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.orden.verificacion = { sistema: '', fecha: '2020-01-02', hora: '05:06',
    funcionario: 'Patrullero VIEJO', resultado: 'POSITIVO', observacion: '' };
  return ojVerificacion(c);
});
log(p2b.funcionario === 'Patrullero VIEJO' && p2b.hora === '05:06',
  'Lo que registró una captura vieja NO se pisa: se imprime tal cual', p2b.funcionario);

/* ══════ Obs. 3 · Forma de ubicación y coordenadas ══════ */
const p3 = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso)); ws = 2; renderWiz();
  return { form: !!document.getElementById('oj-g-form'), coord: !!document.getElementById('oj-g-coord'),
    gps: typeof ojGPS, campos: document.getElementById('wz-panels').querySelectorAll('input,select,textarea').length };
});
log(!p3.form && !p3.coord && p3.gps === 'undefined',
  'Fuera «Forma de ubicación», las coordenadas y el botón de GPS: el informe no los lleva');
log(/en desarrollo de labores propias del servicio de vigilancia y control/.test(docBase),
  'El relato abre con una fórmula fija y cierta, no con un campo que había que elegir');
const p3b = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.diligencia.formaUbicacion = 'ALLANAMIENTO';
  c.oj.diligencia.coordenadas = '6.123456, -75.123456';
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(' ');
});
log(/diligencia de registro y allanamiento/.test(p3b) && /coordenadas 6\.123456/.test(p3b),
  'Una captura guardada que las traiga las sigue imprimiendo: nada se pierde');

/* ══════ Obs. 4 y 5 · Actuación policial e incautaciones ══════ */
const p45 = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso)); ws = 2; renderWiz();
  const ids = ['oj-a-dler', 'oj-a-dfec', 'oj-a-dhor', 'oj-a-dlug', 'oj-a-dobs', 'oj-a-cnom', 'oj-a-cpar',
    'oj-a-ctel', 'oj-a-chor', 'oj-a-dtipo', 'oj-a-dnom', 'oj-a-fza', 'oj-a-fzad', 'oj-a-lhubo',
    'oj-a-ldesc', 'oj-a-vmed', 'oj-a-vent', 'oj-a-nov', 'oj-a-hayinc'];
  return {
    presentes: ids.filter(i => !!document.getElementById(i)),
    relato: !!document.getElementById('oj-a-obs'),
    listaInc: !!document.getElementById('oj-list-incautaciones'),
    catalogo: typeof OJ_LISTS.incautaciones,
    duras: ojDuras(wc).map(v => v.id)
  };
});
log(p45.presentes.length === 0,
  'El bloque «Actuación policial» desapareció entero (19 controles)',
  p45.presentes.length ? p45.presentes.join(', ') : 'ninguno de los 19 sigue en pantalla');
log(p45.relato, 'Queda la narración de los hechos, que es lo que solo puede escribir el funcionario');
log(!p45.listaInc && p45.catalogo === 'undefined',
  'Ni apartado de elementos incautados ni cadena de custodia (obs. 5)');
log(p45.duras.indexOf('V16') < 0 && p45.duras.indexOf('V16b') < 0 && p45.duras.indexOf('V20') < 0,
  'Y con ellos se fueron sus validaciones duras: V16, V16b y V20', p45.duras.join(', ') || 'sin faltas');
const p45b = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.actuacion.comunicacion = { seLogro: true, nombre: 'MARIA PEREZ', parentesco: 'MADRE', telefono: '3001112233', hora: '10:15' };
  c.oj.actuacion.fuerza = { tipo: 'CONTROL_FISICO', descripcion: 'lo estrictamente necesario' };
  c.oj.actuacion.hayIncautacion = true;
  c.oj.actuacion.incautaciones = [{ descripcion: 'un telefono', cantidad: '1', rotulo: '000123-2026', entregadoA: 'policia judicial' }];
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(' ');
});
log(/se comunic[oó] con MARIA PEREZ/.test(p45b) && /control f[ií]sico/.test(p45b) && /r[oó]tulo de cadena de custodia No\. 000123-2026/.test(p45b),
  'Una captura guardada con esos datos los sigue imprimiendo: se dejó de pedir, no de imprimir');

/* ══════ Obs. 6 · Anexos ══════ */
const p6 = await page.evaluate(() => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.actuacion.anexos = []; c.oj.actuacion.anexosManual = false;
  ojAnexosAuto(c);
  // Migración de una captura guardada con los literales antiguos.
  const viejo = JSON.parse(JSON.stringify(window.__caso));
  viejo.oj.actuacion.anexos = ['Acta de derechos del capturado', 'Constancia de buen trato', 'Informe dejando a disposición'];
  ojMigrarMejora3(viejo);
  return { cat: OJ_CAT.anexos, auto: c.oj.actuacion.anexos, migrado: viejo.oj.actuacion.anexos };
});
log(p6.cat[0] === 'Informe dejando a disposición' &&
    p6.cat[1] === 'Acta de derechos del capturado y constancia de buen trato' &&
    p6.cat[2] === 'Copia documento de identificación' &&
    p6.cat[3] === 'Copia orden de captura oficio No. {{ORD_NUMERO}}',
  'Los cuatro primeros anexos van en el orden exacto que pidió el usuario', p6.cat.slice(0, 4).join(' | '));
log(p6.cat.indexOf('Acta de incautación / rótulo de cadena de custodia') < 0 &&
    p6.cat.indexOf('Constancia de buen trato') < 0,
  'Fuera el acta de incautación (no aplica) y la constancia de buen trato suelta (es el mismo formato)');
log(p6.auto.length === 4 && p6.auto[1] === 'Acta de derechos del capturado y constancia de buen trato',
  'Se marcan solos los cuatro que siempre viajan con el oficio', p6.auto.length + ' marcados');
log(p6.migrado.length === 2 && p6.migrado[0] === 'Informe dejando a disposición' &&
    p6.migrado[1] === 'Acta de derechos del capturado y constancia de buen trato',
  'Una captura vieja con las dos casillas antiguas queda con UNA, sin duplicar', p6.migrado.join(' | '));
log(/Anexos: cuatro \(4\)/.test(docBase) && /Copia orden de captura oficio No\. 002-2026/.test(docBase),
  'El oficio los cuenta en letras y rellena solo el número de la orden');
log(!/\{\{ORD_NUMERO\}\}/.test(docBase), 'Y no queda ningún marcador sin resolver');

/* ══════ Obs. 7 · «Dejando a disposición» ══════ */
const p7 = await page.evaluate(() => {
  /* ⚠️ Sin el número de la orden hay falta DURA de verdad. Vaciar el
     destinatario no sirve: `ojAplicarSugerencia` lo vuelve a proponer al pintar
     el paso — que es justo lo que se le pide al módulo. */
  wc = JSON.parse(JSON.stringify(window.__caso)); wc.oj.orden.numero = '';
  ws = 3; renderWiz();
  const panel = document.getElementById('wz-panels');
  const hijos = [...panel.querySelector('.wpn').children].map(el => el.className || el.tagName);
  const dest = panel.querySelector('.oj-dest');
  return {
    hijos,
    posicionDest: hijos.findIndex(c => String(c).indexOf('oj-dest') >= 0),
    destArriba: !!dest && dest.getBoundingClientRect().top < 400,
    faltantesPlegado: !!panel.querySelector('details.oj-estado.dura') && !panel.querySelector('details.oj-estado.dura').open,
    alto: panel.scrollHeight
  };
});
log(p7.posicionDest <= 1, 'El destinatario es lo primero de la pantalla, ya no el sexto bloque',
  'posición ' + p7.posicionDest + ' de ' + p7.hijos.length);
log(p7.destArriba, 'Y se ve sin hacer scroll en un teléfono');
log(p7.faltantesPlegado, 'La lista de faltantes va plegada en una barra con su número (era la que lo tapaba)');

const p7b = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso));
  ojCambiarVia('FISCALIA');
  const x = wc.oj.destino;
  const box = document.querySelector('.oj-dest-box .oj-dest-nom');
  const src = document.querySelector('.oj-dest-src');
  return { nombre: x.nombre, dir: x.direccion, mun: x.municipio,
    box: box ? box.textContent : '', src: src ? src.textContent : '' };
});
log(p7b.nombre === 'FISCALIA URI CENTRO' && p7b.dir === 'Carrera 64C 67-300, barrio Caribe' && p7b.mun === 'Medellin',
  'Fiscalía: nombre, dirección y ciudad se cargan solos de Ajustes', p7b.nombre);
/* ⚠️ 2026-08-28 (obs. 14): la fiscalia sale del REGISTRO DE DESPACHOS —el
   mismo que resuelve el numeral 1 del FPJ-5— y, si el equipo no tiene ninguno
   registrado, de la clave legada de Ajustes. La tarjeta sigue diciendo de donde
   salio, que es lo que este check protege. */
log(/FISCALIA URI CENTRO/.test(p7b.box) && /despacho|Ajustes/i.test(p7b.src),
  'Se muestra resuelta en una tarjeta que dice de dónde salió', p7b.src);

const p7c = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso));
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'd9', nombre: 'Juzgado Segundo de Ejecucion de Penas de Medellin',
    direccion: 'Carrera 52 No 42-73', municipio: 'Medellin', departamento: 'Antioquia', telefono: '6042221111' }];
  DB.saveConfig(cfg);
  ojCambiarVia('JUZGADO');
  /* ⚠️ El selector se acota a la clase de despacho que corresponde a la via
     (2026-08-28, obs. 14): un boton que dice «Elegir juzgado» y ofrece fiscalias
     invita a mandar el oficio a quien no corresponde. */
  const btn = !!document.querySelector('.oj-dest .btn.bp[onclick*="ojSelectorDestino"]');
  ojSelectorDestino('JUZGADO');
  ojUsarDespacho(0);
  const x = wc.oj.destino;
  return { btn, nombre: x.nombre, dir: x.direccion, mun: x.municipio, tel: x.telefono };
});
log(p7c.btn, 'Juzgado: la acción principal es «Elegir juzgado de los registrados»');
log(p7c.nombre === 'Juzgado Segundo de Ejecucion de Penas de Medellin' && p7c.dir === 'Carrera 52 No 42-73' &&
    p7c.mun === 'Medellin' && p7c.tel === '6042221111',
  'Al seleccionarlo se carga todo lo registrado: el usuario no teclea nada', p7c.nombre);

const p7d = await page.evaluate(() => {
  // Los 4 campos siguen en el DOM aunque el bloque esté plegado: si no,
  // ojCollectDisposicion dejaría de recolectar el membrete, la custodia y la firma.
  wc = JSON.parse(JSON.stringify(window.__caso)); ws = 3; renderWiz();
  const det = document.querySelector('.oj-dest-mas');
  const nom = document.getElementById('oj-x-nom');
  document.getElementById('oj-e-uni').value = 'UNIDAD TECLEADA';
  ojCollectDisposicion();
  return { plegado: det && !det.open, existe: !!nom, unidad: wc.oj.encabezado.unidad,
    nombre: wc.oj.destino.nombre };
});
log(p7d.plegado && p7d.existe && p7d.unidad === 'UNIDAD TECLEADA' && !!p7d.nombre,
  'Plegar no es borrar: con el bloque cerrado se sigue recolectando todo el paso',
  'unidad=' + p7d.unidad);

/* ══════ Obs. 8 · El dossier ══════ */
const p8 = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  ojEspejar(c);
  await DB.saveCase(c);
  const dos = genDossier(c);
  // Y una captura guardada ANTES de Mejora 3: sin `lugar` ni `narracion`.
  const viejo = JSON.parse(JSON.stringify(window.__caso));
  ojEspejar(viejo); delete viejo.lugar; delete viejo.narracion;
  return { dos, viejo: genDossier(viejo), lugar: c.lugar, narr: c.narracion };
});
const cuando = (p8.dos.match(/\*CUÁNDO\*\n([^\n]*)/) || [])[1] || '';
const donde = (p8.dos.match(/\*DÓNDE\*\n([^\n]*)/) || [])[1] || '';
log(!/\?\?/.test(cuando) && /a las \d{2}:\d{2} horas/.test(cuando),
  'CUÁNDO ya no sale «??/??/?? a las ??:?? horas»', cuando);
log(!/^—, Barrio —/.test(donde) && /CL 52 # 50-31, Barrio La Candelaria, Medellin - Antioquia/.test(donde),
  'DÓNDE imprime la dirección, el barrio, el municipio y el departamento', donde);
log(/\*Conocieron el caso\*\nPATRULLA 32 CAI Parque Bolivar — SI NELSON DAVID DAVID \/ PT JUAN CORDOBA/.test(p8.dos),
  'El dossier sigue registrando la patrulla completa, aunque el oficio lo firme uno solo');
log(/\*CÓMO\*\nRelato del procedimiento escrito por el funcionario\./.test(p8.dos),
  'Y CÓMO trae el relato del funcionario, que antes se quedaba fuera');
log(/\*ES DEJADO A DISPOSICIÓN\*\n[^\n]*SPOA: 4196993675034202654534/.test(p8.dos),
  'La puesta a disposición y el SPOA se siguen imprimiendo igual');
log(!/\?\?/.test(p8.viejo) && /CL 52 # 50-31/.test(p8.viejo),
  'Una captura guardada antes de este cambio también sale completa (se proyecta al leer)');
const p8b = await page.evaluate(() => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.requerido.fechaNac = '2010-05-05'; c.oj.proceso.fechaHechos = '2026-01-10';
  ojEspejar(c);
  return genDossier(c);
});
log(/\*QUÉ\*\nAprehensión por orden judicial/.test(p8b),
  'Con un adolescente el dossier dice «Aprehensión», no «Captura» (Ley 1098 de 2006)');

/* ══════ El documento no cambió de estructura ══════ */
const estructura = await page.evaluate(async () => {
  const out = await buildOficioOJBlob(window.__caso, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  const filas = (xml.match(/<w:tr[ >]/g) || []).length;
  const tablas = (xml.match(/<w:tbl>/g) || []).length;
  return { filas, tablas };
});
log(estructura.tablas === 3 && estructura.filas === 22,
  'El oficio conserva sus 3 tablas y sus 22 filas fijas: el formato es intocable',
  estructura.tablas + ' tablas · ' + estructura.filas + ' filas');
log(/1\. {2}IDENTIFICACIÓN DEL CAPTURADO/.test(docBase) && /2\. {2}DATOS DEL PROCESO JUDICIAL/.test(docBase) &&
    /3\. {2}MATERIALIZACIÓN DE LA CAPTURA/.test(docBase),
  'Y sus tres numerales, en su orden');

/* ══════ El formulario completo, de punta a punta ══════ */
const medida = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso)); ws = 0;
  let controles = 0, campos = 0, visibles = 0, alto = 0;
  const sel = 'input:not([type=hidden]):not([type=checkbox]),select,textarea';
  for (let i = 0; i < OJ_STEPS.length; i++) {
    ws = i; renderWiz();
    const p = document.getElementById('wz-panels');
    controles += p.querySelectorAll('input,select,textarea,button').length;
    campos += p.querySelectorAll(sel).length;
    // Lo que el funcionario ve de verdad: un campo dentro de un bloque plegado
    // está en el DOM (y se sigue recolectando) pero no cuesta ni una pulsación.
    visibles += [...p.querySelectorAll(sel)].filter(el => el.offsetParent !== null).length;
    alto += p.scrollHeight;
  }
  return { pasos: OJ_STEPS.length, controles, campos, visibles, pantallas: Math.round(alto / 800 * 10) / 10 };
});
log(medida.pasos === 4, 'El wizard sigue en 4 pantallas (los tres numerales + la revisión)');
log(medida.visibles < 30, 'Campos a la vista en todo el procedimiento',
  medida.visibles + ' visibles de ' + medida.campos + ' (eran 65 a la vista tras Mejora 2)');
log(medida.pantallas < 12, 'Pantallas de scroll de un procedimiento completo',
  medida.pantallas + ' (eran 17 tras Mejora 2)');

const generar = await page.evaluate(() => {
  wc = JSON.parse(JSON.stringify(window.__caso)); ojAplicarSugerencia(wc);
  return ojDuras(wc).map(v => v.id + ' (paso ' + (v.paso + 1) + ')');
});
log(generar.length === 0, 'Un caso completo no tiene ni una validación dura pendiente',
  generar.join(', ') || 'ninguna');

log(errores.length === 0, 'Consola sin errores', errores.slice(0, 3).join(' | ') || 'limpia');

await browser.close();
server.close();
console.log(`\n${fails === 0 ? '✅ TODO OK' : '❌ ' + fails + ' FALLO(S)'} — ${n} comprobaciones`);
process.exit(fails ? 1 : 0);
