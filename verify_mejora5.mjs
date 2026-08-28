/* Regresión de la MEJORA 5 — las siete observaciones del documento
   `Documentos/Otro/Mejora 5.docx`, cada una medida sobre la app real y, cuando
   toca al documento, sobre el .docx que de verdad se genera.

   El hilo que une las siete: la app YA TENÍA el dato y el documento no lo
   enseñaba, o lo enseñaba en la casilla equivocada.
     1 · el numeral 1 del FPJ-5 imprimía el nombre del despacho sin su dirección
     2 · el artículo del C.P. se quedaba en el modelo
     3 · una dirección sin placa («CL 49 # 54») se lee como incompleta
     4 · el lugar de nacimiento entero caía en la casilla «País» de los
         apartados 5 y 6, y Departamento y Municipio quedaban en blanco
     5 · «Señales particulares visibles:» salía en negrita y sin renglón
     6 · el bloque de poblaciones especiales ocupaba media pantalla en TODA acta
     7 · la persona a quien se comunica la captura salía sin parentesco y con un
         número de documento sin decir de qué documento se trata */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SALIDA = tmpdir();                 // ⚠️ nunca en el proyecto: un .docx abierto en Word queda bloqueado
const PORT = 8177;
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
function sec(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length))); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);
// El papel se pregunta UNA vez (Exportación v2): se fija para que el acta salga
// sin abrir el diálogo y la suite mida el documento, no el diálogo.
await page.evaluate(() => { lcGuardarPapel('CARTA'); });

/* ── Utilidades de lectura del .docx ───────────────────────────────────────
   ZIP stored: la entrada se lee sin inflar, igual que `unzipDocx` en la app. */
function docXml(buf) {
  let pos = 0;
  while (pos + 30 <= buf.length) {
    if (buf.readUInt32LE(pos) !== 0x04034b50) break;
    const sz = buf.readUInt32LE(pos + 18), nl = buf.readUInt16LE(pos + 26), el = buf.readUInt16LE(pos + 28);
    const nm = buf.slice(pos + 30, pos + 30 + nl).toString('utf8').split('\\').join('/');
    const ds = pos + 30 + nl + el;
    if (nm === 'word/document.xml') return buf.slice(ds, ds + sz).toString('utf8');
    pos = ds + sz;
  }
  return null;
}
function celdas(xml) {
  const out = [];
  const re = /<w:tc(?:\s[^>]*)?>/g; let m;
  while ((m = re.exec(xml))) {
    const s = xml.slice(m.index);
    const tre = /<w:tc(?:\s[^>]*)?>|<\/w:tc>/g; let t, cur = 0, fin = 0;
    while ((t = tre.exec(s))) { if (t[0] === '</w:tc>') { cur--; if (!cur) { fin = t.index + 7; break; } } else cur++; }
    out.push(s.slice(0, fin));
  }
  return out;
}
function texto(seg) { let t = ''; for (const x of seg.matchAll(/<w:t(?:\s[^>\/]*)?>([\s\S]*?)<\/w:t>/g)) t += x[1]; return t; }
function parrafos(xml) {
  const body = xml.slice(xml.indexOf('<w:body'));
  const idxs = [], out = [];
  const re = /<w:p(?:\s[^>]*)?\/?>/g; let m;
  while ((m = re.exec(body))) idxs.push(m.index);
  for (let i = 0; i < idxs.length; i++)
    out.push(body.slice(idxs[i], idxs[i + 1] === undefined ? body.length : idxs[i + 1]));
  return out;
}
/* Genera el FPJ-5 de un caso ya guardado y devuelve su document.xml. */
async function fpjDe(id, tag) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
    page.evaluate(async cid => {
      const out = buildFPJBlob(DB.getCase(cid), 'CARTA');
      if (!out) return false;
      _dlDocBlob(out.blob, out.fname);
      return true;
    }, id)
  ]);
  if (!dl) return null;
  const ruta = join(SALIDA, 'verify_m5_' + tag + '.docx');
  await dl.saveAs(ruta);
  return docXml(await readFile(ruta));
}
/* Un caso de flagrancia completo, con los datos que cada observación necesita. */
async function sembrar(extra) {
  return page.evaluate(async ex => {
    const c = Object.assign({
      id: 'M5' + Date.now() + Math.random().toString(36).slice(2, 6),
      tipo: 'URI', estado: 'Registrado', nunc: '0500160002062026',
      fechaProc: '2026-08-26', destino: 'Fiscalía URI Medellín',
      conductas: ['Hurto'], articulosCP: ['Art. 239'],
      capturados: [], victimas: [], testigos: [], sinVictima: false, sinTestigo: false,
      lugar: { dir: 'CL 52A # 50-46', barrio: 'La Candelaria', zona: 'Urbana', localidad: '10',
               vereda: 'N/A', depto: 'Antioquia', muni: 'Medellín', caract: 'Tienda' },
      narracion: { texto: 'Relato.', fechaCapD: '26', fechaCapM: '08', fechaCapA: '2026', horaCapH: '13', horaCapM: '25' },
      servidor: { grado: 'PT', nombre: 'X Y', ident: '1', entidad: 'E' },
      hayVehiculos: false, vehiculos: [], elementos: []
    }, ex);
    await DB.saveCase(c);
    return c.id;
  }, extra);
}
const PERSONA = (rol, ex) => Object.assign({
  id: 'P' + rol + Math.random().toString(36).slice(2, 8),
  tipoDoc: 'CC', numDoc: '7129136' + rol.length, expEn: 'Itagüí',
  priNom: 'JUAN', segNom: 'MAURICIO', priApe: 'SALAZAR', segApe: 'ESTRADA',
  alias: 'N/A', fn: '1984-05-03', edad: '42', sexo: 'M',
  ecivil: 'Soltero/a', escol: 'Bachiller', ocup: 'Abogado',
  dirRes: 'CL 51 # 49-11', tel: '3227193717', correo: 'j@correo.test',
  padres: 'ANA y LUIS', senas: 'Tatuaje en la muñeca derecha'
}, ex);

/* ═══════════════ OBS 1 · el destino del informe, con su dirección ═══════════════
   El numeral 1 imprimía «Fiscalía URI» a secas mientras el paso 1 del wizard ya
   enseñaba la dirección del despacho. Y la ciudad no puede salir dos veces: el
   nombre registrado suele terminar en ella y la dirección también la lleva. */
sec('OBS 1 — el destino del informe sale con su dirección y sin repetir la ciudad');

const idDesp = await page.evaluate(async () => {
  const d = lcDespGuardar({
    nombre: 'Fiscalía URI Medellín', clase: 'FISCALIA',
    direccion: 'KR 64C # 67-300', barrio: 'Caribe', municipio: 'Medellín',
    departamento: 'Antioquia', nunc: '0500160002062026'
  });
  return d.id;
});
const compuesto = await page.evaluate(id => lcDestinoInforme({ destino: 'Fiscalía URI Medellín', despachoId: id }), idDesp);
log(compuesto === 'Fiscalía URI KR 64C # 67-300, barrio Caribe, Medellín',
  'El destino se compone como en la tarjeta del wizard, con una sola vez la ciudad', compuesto);
log(!/Medellín[\s\S]*Medellín[\s\S]*Medellín/.test(compuesto),
  '⚠️ La ciudad aparece UNA vez: sale del nombre porque la dirección ya la lleva');

const sinCola = await page.evaluate(() => [
  _lcSinCola('Fiscalía URI Medellín', 'Medellín'),
  _lcSinCola('Medellín', 'Medellín'),
  _lcSinCola('Fiscalía Medellinense', 'Medellín'),
  _lcSinCola('CESPA Bello', 'Medellín')
]);
log(sinCola[0] === 'Fiscalía URI', 'Quita la ciudad del final del nombre', sinCola[0]);
log(sinCola[1] === 'Medellín', '⚠️ Pero no cuando el nombre ES la ciudad: el destino no puede quedarse vacío', sinCola[1]);
log(sinCola[2] === 'Fiscalía Medellinense', '⚠️ Ni dentro de otra palabra: solo palabra completa al final', sinCola[2]);
log(sinCola[3] === 'CESPA Bello', 'Y no toca un nombre que termina en otra ciudad', sinCola[3]);

const manual = await page.evaluate(id => lcDestinoInforme({ destino: 'Fiscalía 45 seccional', despachoId: id, destinoManual: true }), idDesp);
log(manual === 'Fiscalía 45 seccional',
  '⚠️ Un destino escrito a mano se imprime tal cual: la app no tiene su dirección y no se la inventa', manual);
const huerfano = await page.evaluate(() => lcDestinoInforme({ destino: 'Fiscalía URI', despachoId: 'ya-no-existe' }));
log(huerfano === 'Fiscalía URI', 'Y una captura que ya no apunta a ningún despacho registrado, igual', huerfano);

const idC1 = await sembrar({ destino: 'Fiscalía URI Medellín', despachoId: idDesp, capturados: [PERSONA('CAP')], sinVictima: true, sinTestigo: true });
const x1 = await fpjDe(idC1, 'obs1');
log(!!x1, 'El FPJ-5 se genera con el despacho enlazado');
const c1 = x1 && celdas(x1);
log(!!c1 && texto(c1[57]).trim() === 'Fiscalía URI KR 64C # 67-300, barrio Caribe, Medellín',
  'El numeral 1 del documento imprime el despacho entero', c1 && texto(c1[57]).trim());
log(!!x1 && (x1.match(/<w:tbl>/g) || []).length === 35,
  'El formato conserva sus 35 tablas', x1 && (x1.match(/<w:tbl>/g) || []).length);

/* ═══════════════ OBS 2 · el artículo del Código Penal ═══════════════ */
sec('OBS 2 — el artículo del C.P. registrado llega al numeral 2');

const arts = await page.evaluate(() => ['239', 'Art. 239', 'artículo 239', '239 C.P.', 'Art. 239 del Código Penal', '', '   '].map(lcArtCP));
log(arts.slice(0, 5).every(a => a === 'Art. 239 C.P.'),
  '⚠️ Se normaliza en un punto: escriba el usuario como escriba, el renglón se lee igual', JSON.stringify(arts.slice(0, 5)));
log(arts[5] === '' && arts[6] === '', 'Sin artículo no se inventa nada');

const idC2 = await sembrar({
  conductas: ['Hurto', 'Lesiones personales'], articulosCP: ['Art. 239', '111 y 112'],
  capturados: [PERSONA('CAP')], sinVictima: true, sinTestigo: true
});
const x2 = await fpjDe(idC2, 'obs2');
const c2 = x2 && celdas(x2);
log(!!c2 && texto(c2[58]).trim() === '1. Hurto — Art. 239 C.P.',
  'El primer delito sale con su artículo', c2 && texto(c2[58]).trim());
log(!!c2 && texto(c2[59]).trim() === '2. Lesiones personales — Art. 111 y 112 C.P.',
  'Y el segundo, con el suyo', c2 && texto(c2[59]).trim());
log(!!c2 && texto(c2[60]).trim() === '' && texto(c2[61]).trim() === '',
  'Las casillas sobrantes siguen en blanco, sin un ordinal suelto');

// El artículo viaja con SU delito aunque el modelo traiga huecos.
const idC2b = await sembrar({
  conductas: ['', 'Receptación', '', 'Hurto calificado'], articulosCP: ['', '447', '', '239 y 240'],
  capturados: [PERSONA('CAP')], sinVictima: true, sinTestigo: true
});
const c2b = celdas(await fpjDe(idC2b, 'obs2b'));
log(texto(c2b[58]).trim() === '1. Receptación — Art. 447 C.P.' && texto(c2b[59]).trim() === '2. Hurto calificado — Art. 239 y 240 C.P.',
  '⚠️ Al compactar, cada artículo sigue con SU delito y no se corre de renglón',
  texto(c2b[58]).trim() + ' | ' + texto(c2b[59]).trim());

// Sin artículo registrado, el renglón sale exactamente como salía antes.
const idC2c = await sembrar({ conductas: ['Hurto'], articulosCP: [''], capturados: [PERSONA('CAP')], sinVictima: true, sinTestigo: true });
const c2c = celdas(await fpjDe(idC2c, 'obs2c'));
log(texto(c2c[58]).trim() === '1. Hurto',
  '⚠️ Sin artículo el renglón queda como estaba: el cambio no toca una captura que no lo registró', texto(c2c[58]).trim());

/* ═══════════════ OBS 3 · la dirección incompleta, en palabras ═══════════════ */
sec('OBS 3 — un cruce sin placa se escribe «Calle 49 con carrera 54»');

const dirs = await page.evaluate(() => ({
  completa:  lcDirComponer({ via: 'CL', num: '52A', cruce: '50', placa: '46' }),
  cruceCL:   lcDirComponer({ via: 'CL', num: '49', cruce: '54' }),
  cruceKR:   lcDirComponer({ via: 'KR', num: '64C', cruce: '67' }),
  cruceDG:   lcDirComponer({ via: 'DG', num: '75B', cruce: '34' }),
  cruceAV:   lcDirComponer({ via: 'AV', num: '33', cruce: '45' }),
  soloVia:   lcDirComponer({ via: 'CL', num: '49' }),
  conComp:   lcDirComponer({ via: 'CL', num: '49', cruce: '54', comp: 'frente al parque' }),
  vuelta:    lcDirParsear(lcDirComponer({ via: 'CL', num: '49', cruce: '54' }))
}));
log(dirs.completa === 'CL 52A # 50-46',
  '⚠️ Una dirección COMPLETA no cambia: sigue abreviada como hasta ahora', dirs.completa);
log(dirs.cruceCL === 'Calle 49 con carrera 54', 'Sin placa, la calle cruza con carrera', dirs.cruceCL);
log(dirs.cruceKR === 'Carrera 64C con calle 67', 'Y la carrera con calle', dirs.cruceKR);
log(dirs.cruceDG === 'Diagonal 75B con transversal 34', 'Diagonal y transversal, igual', dirs.cruceDG);
log(dirs.cruceAV === 'Avenida 33 con 45',
  '⚠️ Donde ese par no existe se dice «con» y el número: no se inventa un tipo de vía que nadie registró', dirs.cruceAV);
log(dirs.soloVia === 'CL 49', 'Sin cruce no hay nada que expandir', dirs.soloVia);
log(dirs.conComp === 'Calle 49 con carrera 54 FRENTE AL PARQUE', 'El complemento sigue detrás', dirs.conComp);
log(dirs.vuelta.via === 'CL' && dirs.vuelta.num === '49' && dirs.vuelta.cruce === '54' && !dirs.vuelta.placa,
  '⚠️ Y el dato va y vuelve del formulario sin perder nada', JSON.stringify(dirs.vuelta));

const idC3 = await sembrar({
  lugar: { dir: 'Calle 49 con carrera 54', barrio: 'Buenos Aires', zona: 'Urbana', localidad: '10',
           vereda: 'N/A', depto: 'Antioquia', muni: 'Envigado', caract: 'Vía pública' },
  capturados: [PERSONA('CAP')], sinVictima: true, sinTestigo: true
});
const c3 = celdas(await fpjDe(idC3, 'obs3'));
log(texto(c3[63]).trim() === 'Calle 49 con carrera 54',
  'El informe imprime la dirección tal como quedó compuesta', texto(c3[63]).trim());

/* ═══════════════ OBS 4 · el lugar de nacimiento, en sus tres casillas ═══════════════
   El formato pide País · Departamento · Municipio en los apartados 5 y 6, y la
   app volcaba el texto entero en País dejando las otras dos en blanco. */
sec('OBS 4 — País, Departamento y Municipio de nacimiento, cada uno en su casilla');

const partes = await page.evaluate(() => ({
  estructurada: lcNacPartes({ nacMuni: 'Envigado', nacDepto: 'Antioquia', nacPais: 'Colombia' }),
  soloMuni:     lcNacPartes({ nacMuni: 'Envigado' }),
  legado:       lcNacPartes({ lugNac: 'Sabaneta, Antioquia' }),
  legadoSolo:   lcNacPartes({ lugNac: 'Medellín' }),
  legadoRaro:   lcNacPartes({ lugNac: 'Venezuela- la guaira' }),
  extranjera:   lcNacPartes({ nacMuni: 'La Guaira', nacDepto: 'Vargas', nacPais: 'Venezuela' }),
  vacia:        lcNacPartes({})
}));
log(partes.estructurada.muni === 'Envigado' && partes.estructurada.depto === 'Antioquia' && partes.estructurada.pais === 'Colombia',
  'Con los tres campos diligenciados se usan tal cual');
log(partes.soloMuni.depto === 'Antioquia' && partes.soloMuni.pais === 'Colombia',
  'Con un municipio de Colombia el departamento y el país se deducen', JSON.stringify(partes.soloMuni));
log(partes.legado.muni === 'Sabaneta' && partes.legado.depto === 'Antioquia' && partes.legado.pais === 'Colombia',
  'Una persona registrada antes se interpreta «Municipio, Departamento»', JSON.stringify(partes.legado));
log(partes.legadoSolo.muni === 'Medellín' && partes.legadoSolo.depto === 'Antioquia',
  'Y con solo el municipio, el departamento se completa igual', JSON.stringify(partes.legadoSolo));
log(partes.legadoRaro.muni === 'Venezuela- la guaira' && !partes.legadoRaro.depto,
  '⚠️ Lo que no encaja NO se parte: no se inventa un departamento que nadie escribió', JSON.stringify(partes.legadoRaro));
log(partes.extranjera.pais === 'Venezuela' && partes.extranjera.depto === 'Vargas',
  'Una persona extranjera conserva su ciudad, su estado y su país', JSON.stringify(partes.extranjera));
log(!partes.vacia.muni && !partes.vacia.depto && !partes.vacia.pais, 'Sin dato, las tres partes quedan vacías');

const lineas = await page.evaluate(() => [
  lcNacTexto({ nacMuni: 'Envigado', nacDepto: 'Antioquia', nacPais: 'Colombia' }),
  lcNacTexto({ nacMuni: 'La Guaira', nacDepto: 'Vargas', nacPais: 'Venezuela' }),
  lcNacTexto({})
]);
log(lineas[0] === 'Envigado, Antioquia',
  '⚠️ «Colombia» no se escribe en la línea de una sola casilla: es lo que hay que suponer', lineas[0]);
log(lineas[1] === 'La Guaira, Vargas, Venezuela', 'Pero el país de una persona extranjera sí', lineas[1]);
log(lineas[2] === '', 'Sin dato, la línea queda vacía');

// El formulario de personas pide las tres, con el departamento y el país automáticos.
await page.evaluate(() => openPersonModal('capturados', -1, {}, true));
await page.waitForTimeout(200);
log(await page.isVisible('#pm-nacMuni') && await page.isVisible('#pm-nacDepto') && await page.isVisible('#pm-nacPais'),
  'El formulario de persona pide municipio, departamento y país por separado');
log(!(await page.$('#pm-lugNac')), '⚠️ Y ya no queda el campo cerrado de antes');
await page.fill('#pm-nacMuni', 'Envigado');
await page.waitForTimeout(150);
log(await page.inputValue('#pm-nacDepto') === 'Antioquia' && await page.inputValue('#pm-nacPais') === 'Colombia',
  'Al escribir el municipio, el departamento y el país se completan solos');
await page.fill('#pm-nacPais', 'Venezuela');
await page.fill('#pm-nacDepto', 'Vargas');
await page.fill('#pm-nacMuni', 'La Guaira');
await page.waitForTimeout(150);
log(await page.inputValue('#pm-nacDepto') === 'Vargas' && await page.inputValue('#pm-nacPais') === 'Venezuela',
  '⚠️ Y lo que escribió el usuario no se pisa: una persona extranjera conserva lo suyo');
const leido = await page.evaluate(() => lcNacLeer('pm'));
log(leido.nacMuni === 'La Guaira' && leido.nacDepto === 'Vargas' && leido.nacPais === 'Venezuela'
    && leido.lugNac === 'La Guaira, Vargas, Venezuela',
  'Se guardan los tres campos y además la línea compuesta', JSON.stringify(leido));
await page.evaluate(() => closeModal());
await page.waitForTimeout(150);

const idC4 = await sembrar({
  capturados: [PERSONA('CAP', { nacMuni: 'Sabaneta', nacDepto: 'Antioquia', nacPais: 'Colombia' })],
  victimas: [PERSONA('VIC', { nacMuni: 'Envigado', nacDepto: 'Antioquia', nacPais: 'Colombia' })],
  testigos: [PERSONA('TES', { nacMuni: 'La Guaira', nacDepto: 'Vargas', nacPais: 'Venezuela' })],
  sinVictima: false, sinTestigo: false
});
const x4 = await fpjDe(idC4, 'obs4');
const c4 = x4 && celdas(x4);
log(!!c4 && texto(c4[173]).trim() === 'Colombia' && texto(c4[175]).trim() === 'Antioquia' && texto(c4[177]).trim() === 'Envigado',
  'Apartado 5 (víctimas): País, Departamento y Municipio, cada uno en su casilla',
  c4 && [texto(c4[173]), texto(c4[175]), texto(c4[177])].join(' | '));
log(!!c4 && texto(c4[228]).trim() === 'Venezuela' && texto(c4[230]).trim() === 'Vargas' && texto(c4[232]).trim() === 'La Guaira',
  'Apartado 6 (testigos): igual, y una persona extranjera sale completa',
  c4 && [texto(c4[228]), texto(c4[230]), texto(c4[232])].join(' | '));
log(!!c4 && texto(c4[118]).trim() === 'Sabaneta, Antioquia',
  '⚠️ El apartado 4 lo sigue imprimiendo en UNA línea, que es lo que pide el formato', c4 && texto(c4[118]).trim());

// Una persona registrada antes de esta mejora también sale en las tres casillas.
const idC4b = await sembrar({
  capturados: [PERSONA('CAP')], sinVictima: true,
  testigos: [PERSONA('TES', { lugNac: 'Bello, Antioquia' })], sinTestigo: false
});
const c4b = celdas(await fpjDe(idC4b, 'obs4b'));
log(texto(c4b[228]).trim() === 'Colombia' && texto(c4b[230]).trim() === 'Antioquia' && texto(c4b[232]).trim() === 'Bello',
  '⚠️ Sin migrar nada: una persona registrada antes se interpreta al imprimir',
  [texto(c4b[228]), texto(c4b[230]), texto(c4b[232])].join(' | '));

/* ═══════════════ OBS 5 · las señales particulares ═══════════════ */
sec('OBS 5 — «Señales particulares visibles» sin negrita y sobre línea continua');

function senasDe(xml) {
  const W = 'w';
  return parrafos(xml).filter(p => /ales particulares visibles/.test(texto(p))).map(p => {
    const rs = [...p.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)].map(x => x[0]).filter(r => /<w:t/.test(r));
    return {
      runs: rs.length,
      negritas: rs.filter(r => /<w:b(?:\s|\/)/.test(r)).length,
      valorSubrayado: rs[1] ? /<w:u\s/.test(rs[1]) : false,
      etiquetaSubrayada: rs[0] ? /<w:u\s/.test(rs[0]) : false,
      txt: texto(p)
    };
  });
}
for (const [tipo, tag] of [['URI', 'obs5uri'], ['CESPA', 'obs5cespa']]) {
  const id = await sembrar({
    tipo, capturados: [PERSONA('CAP', { senas: 'Tatuaje mano derecha altura de la muñeca' }),
                       PERSONA('CA2', { senas: 'Cicatriz en la ceja izquierda' })],
    sinVictima: true, sinTestigo: true
  });
  const s = senasDe(await fpjDe(id, tag));
  log(s.length === 2, `[${tipo}] las dos personas traen su renglón de señas`, s.length);
  log(s.every(x => x.negritas === 0),
    `[${tipo}] ⚠️ NI la etiqueta ni la descripción van en negrita`, JSON.stringify(s.map(x => x.negritas)));
  log(s.every(x => x.valorSubrayado && !x.etiquetaSubrayada),
    `[${tipo}] la descripción se escribe encima de una línea continua, y la etiqueta no`);
  log(s.every(x => /^Señales particulares visibles: /.test(x.txt)),
    `[${tipo}] la etiqueta conserva la ñ y los dos puntos del formato`);
  log(/Tatuaje mano derecha/.test(s[0].txt) && /Cicatriz en la ceja/.test(s[1].txt),
    `[${tipo}] ⚠️ y cada copia trae SUS señas, no las de la persona anterior`);
}

/* ═══════════════ OBS 6 y 7 · el acta de derechos ═══════════════ */
sec('OBS 6 y 7 — el acta de derechos: identidad plegada, y quién es quién');

const idActa = await sembrar({ capturados: [PERSONA('CAP')], sinVictima: true, sinTestigo: true });
await page.evaluate(id => abrirActaDerechos(id), idActa);
await page.waitForTimeout(300);
log(await page.isVisible('#f6-obs'), 'El acta abre');

const plegado = await page.evaluate(() => {
  const d = [...document.querySelectorAll('#modal-c details')]
    .find(x => /Identidad y poblaciones especiales/i.test(x.querySelector('summary').textContent));
  return d ? { existe: true, open: d.open, enDom: !!document.getElementById('f6-identitario') } : { existe: false };
});
log(plegado.existe && !plegado.open,
  '⚠️ El bloque de poblaciones especiales viaja PLEGADO: lo corriente es que no aplique');
log(plegado.enDom, '⚠️ Plegar no es borrar: los campos siguen en el DOM y se siguen recolectando');
log(!(await page.isVisible('#f6-identitario')) && !(await page.isVisible('#f6-etnia')) && !(await page.isVisible('#f6-redes')),
  'Y no ocupan pantalla mientras no se abran');
log(await page.isVisible('#f6-presento'),
  '⚠️ La ÚNICA excepción sigue a la vista: si presentó su documento de identificación físico');

// Obs. 7 — parentesco e identificación completa.
log(await page.isVisible('#f6-com-parentesco') && await page.isVisible('#f6-com-tipoDoc') && await page.isVisible('#f6-com-expEn'),
  'La persona a quien se comunica la captura se pide con parentesco, tipo de documento y lugar de expedición');
const opciones = await page.$$eval('#f6-com-parentesco option', els => els.map(e => e.value));
for (const v of ['Madre', 'Padre', 'Hermano', 'Hermana', 'Tío', 'Tía', 'Primo', 'Prima', 'Hijo', 'Hija', 'Esposa', 'Esposo', 'Compañera sentimental', 'Compañero sentimental'])
  if (!opciones.includes(v)) { log(false, 'Falta el parentesco «' + v + '» del catálogo'); }
log(['Madre', 'Padre', 'Hermano', 'Hermana', 'Tío', 'Tía', 'Primo', 'Prima', 'Hijo', 'Hija', 'Esposa', 'Esposo', 'Compañera sentimental', 'Compañero sentimental']
    .every(v => opciones.includes(v)),
  'El catálogo trae los catorce vínculos que dictó el usuario', opciones.length + ' opciones');
log(opciones.includes('OTRO'), '⚠️ Y la salida para el vínculo que no encaja: la ley no cierra la lista');
log(!(await page.isVisible('#f6-com-parentescoOtro')), 'El campo libre está oculto mientras no se elija «Otro»');
await page.selectOption('#f6-com-parentesco', 'OTRO');
await page.waitForTimeout(120);
log(await page.isVisible('#f6-com-parentescoOtro'), 'Y aparece al elegirlo');
await page.selectOption('#f6-com-parentesco', 'Madre');
await page.waitForTimeout(120);
log(!(await page.isVisible('#f6-com-parentescoOtro')), 'Y vuelve a esconderse');

await page.fill('#f6-com-nombre', 'Natalia Ardila Ramírez');
await page.selectOption('#f6-com-tipoDoc', 'CC');
await page.fill('#f6-com-doc', '1.214.853.698');
await page.fill('#f6-com-expEn', 'Medellín');
await page.fill('#f6-com-tel', '3008561236');
await page.fill('#f6-com-hora', '01:25');

const [dlActa] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.evaluate(async () => { await f6Generar(); })
]);
const rutaActa = join(SALIDA, 'verify_m5_acta.docx');
await dlActa.saveAs(rutaActa);
const xa = docXml(await readFile(rutaActa));
const ca = celdas(xa);
log(ca.length === 113, 'El acta conserva sus 113 celdas: no se reconstruyó ni una tabla', ca.length);
log((xa.match(/<w:tbl>/g) || []).length === 5, 'Y sus 5 tablas');
log(texto(ca[106]).trim() === 'NATALIA ARDILA RAMÍREZ — Madre',
  'El renglón NOMBRES Y APELLIDOS dice quién es esa persona del capturado', texto(ca[106]).trim());
log(texto(ca[108]).trim() === 'CC No 1214853698 de Medellín',
  'Y el de IDENTIFICACION, qué documento es y dónde se expidió', texto(ca[108]).trim());
log(!/1\.214\.853\.698/.test(xa), '⚠️ El número sigue saliendo sin puntos');
log(texto(ca[110]).trim() === '3008561236' && texto(ca[112]).trim() === '01:25',
  'El teléfono y la hora no cambian');

// Los cuatro datos nuevos persisten en el caso, no en la persona.
const guardado = await page.evaluate(id => {
  const c = DB.getCase(id), a = (c.actas || [])[0] || {};
  const p = (c.capturados || [])[0] || {};
  return { com: a.comunica || {}, personaTiene: !!(p.parentesco || p.comunica) };
}, idActa);
log(guardado.com.parentesco === 'Madre' && guardado.com.tipoDoc === 'CC' && guardado.com.expEn === 'Medellín'
    && guardado.com.numDoc === '1214853698',
  'Los cuatro datos nuevos quedan guardados en el acta del caso', JSON.stringify(guardado.com));
log(!guardado.personaTiene,
  '⚠️ Y NO en la persona capturada: quién recibe el aviso es un hecho de ESTE procedimiento');

// Sin parentesco ni lugar de expedición no quedan palabras sueltas.
const sueltos = await page.evaluate(() => [
  f6IdentificacionTexto({ tipoDoc: 'CC', numDoc: '123' }),
  f6IdentificacionTexto({ numDoc: '123', expEn: 'Bogotá' }),
  f6IdentificacionTexto({ tipoDoc: 'CC', expEn: 'Bogotá' }),
  f6IdentificacionTexto({ tipoDoc: 'TI', numDoc: '1465456456', expEn: 'Bogotá' }),
  f6IdentificacionTexto({ tipoDoc: 'CE', numDoc: '11541564564', expEn: 'Colombia' }),
  f6IdentificacionTexto({ tipoDoc: 'DE', numDoc: '12354456', expEn: 'Venezuela' })
]);
log(sueltos[0] === 'CC No 123' && sueltos[1] === '123 de Bogotá' && sueltos[2] === '',
  'Cada parte es opcional y sin número no se imprime nada', JSON.stringify(sueltos.slice(0, 3)));
log(sueltos[3] === 'TI No 1465456456 de Bogotá' && sueltos[4] === 'CE No 11541564564 de Colombia' && sueltos[5] === 'DE No 12354456 de Venezuela',
  'Los cuatro ejemplos que dictó el usuario salen tal cual', JSON.stringify(sueltos.slice(3)));

/* ═══════════════ CONSOLA ═══════════════ */
sec('Consola');
log(consoleErrors.length === 0, 'Sin errores de consola en todo el recorrido', consoleErrors.slice(0, 3).join(' | ') || 'limpia');

console.log(fails ? `\n❌ ${fails} de ${n} comprobaciones fallaron` : `\n✅ TODO EN VERDE — ${n} comprobaciones`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
