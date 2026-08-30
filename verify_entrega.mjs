/* Regresión del «Acta de entrega de elementos» (FPJ-30) y del «Resumen de la
   captura», los dos documentos que pidió el usuario el 2026-08-29.

   El acta de entrega SE RELLENA sobre el formato oficial que él mismo aportó
   (`Documentos/Otro/FPJ 30 Acta De Entrega.docx`), así que lo que hay que
   comprobar es lo mismo que en el acta de incautación: que NO se ha movido nada
   del original y que todo lo que la app escribe sale donde le corresponde.
   El resumen, en cambio, lo compone la app: ahí lo que se comprueba es que no
   inventa un dato y que dice los seis bloques que se pidieron.

     A. Registro, expediente y menú.
     B. La plantilla — es el archivo del usuario, sin referencias de red.
     C. Geometría INTACTA — cero diferencias contra la plantilla en blanco.
     D. Mapeo del acta — cada casilla, con el dato que le toca.
     E. Los elementos: el «No.» se repite por renglón, y las filas se reproducen.
     F. Quién entrega y quién recibe.
     G. Lo que NO se inventa: firmas, huella, consecutivo, actos urgentes.
     H. Un solo cuerpo de letra para todo lo que rellena la app.
     I. El resumen de la captura: los seis bloques, y ni un dato inventado.
     J. Persistencia, perfil, modo invitado y consola limpia.

   Los .docx se escriben en el TEMPORAL del sistema y no en el directorio del
   proyecto: abrir uno en Word lo deja bloqueado y la siguiente corrida moriría
   con EBUSY antes de comprobar nada (lección de verify_fpj6).                */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SALIDA = join(tmpdir(), 'lc_entrega_' + Date.now().toString(36));
await mkdir(SALIDA, { recursive: true });
const PORT = 8181;
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

/* Lector de .docx STORED, igual que `unzipDocx` dentro de la app. */
function leerDocx(buf) {
  const partes = {};
  let i = 0;
  while ((i = buf.indexOf('PK\u0003\u0004', i, 'latin1')) >= 0) {
    const nLen = buf.readUInt16LE(i + 26), eLen = buf.readUInt16LE(i + 28);
    const tam = buf.readUInt32LE(i + 18);
    const nombre = buf.toString('utf8', i + 30, i + 30 + nLen);
    const ini = i + 30 + nLen + eLen;
    partes[nombre.replace(/\\/g, '/')] = buf.slice(ini, ini + tam);
    i = ini + tam;
  }
  return partes;
}
const texto = xml => xml.replace(/<[^>]+>/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
const celdasDe = xml => [...xml.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(m => m[1]);
const tcTexto = xml => celdasDe(xml).map(texto);

/* La geometría del formato, para compararla contra la plantilla en blanco: es
   lo único que este documento NO puede cambiar. */
function geometria(xml) {
  const tbls = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(m => m[1]);
  return {
    tablas: tbls.length,
    filas: tbls.map(t => (t.match(/<w:tr[ >]/g) || []).length).join(','),
    gridCol: [...xml.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => m[1]).join(','),
    tcW: [...xml.matchAll(/<w:tcW w:w="(\d+)" w:type="(\w+)"/g)].map(m => m[1] + m[2]).join(','),
    trHeight: [...xml.matchAll(/<w:trHeight ([^>]*)\/>/g)].map(m => m[1]).join(','),
    tblW: [...xml.matchAll(/<w:tblW w:w="(\d+)" w:type="(\w+)"/g)].map(m => m[1] + m[2]).join(','),
    tblInd: [...xml.matchAll(/<w:tblInd w:w="(-?\d+)"/g)].map(m => m[1]).join(','),
    gridSpan: [...xml.matchAll(/<w:gridSpan w:val="(\d+)"/g)].map(m => m[1]).join(','),
    vMerge: (xml.match(/<w:vMerge/g) || []).length,
    tcBorders: (xml.match(/<w:tcBorders>/g) || []).length,
    pgSz: (/<w:pgSz [^>]*>/.exec(xml) || [''])[0]
  };
}
const difGeom = (a, b) => Object.keys(a).filter(k => String(a[k]) !== String(b[k]));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true });
const errores = [];
page.on('pageerror', e => errores.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '7788');
await page.fill('#pin-b', '7788');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

/* Una descripción larga a propósito: es la que obliga a que el elemento ocupe
   varios renglones y a que el «No.» se repita, que es la regla que fijó el
   usuario para este formato. */
const EMP1 = 'cheques del Banco de Bogotá, uno identificado con el número KL614882 y otro con el número KL614883, ambos girados el 20 de agosto de 2026 a nombre de la sociedad denunciante y hallados en el bolsillo derecho del pantalón';
const EMP2 = 'celular marca Samsung Galaxy A20S color azul, IMEI 1 354260112921801, IMEI 2 354261111292488';
const EMP3 = 'cadena en metal amarillo con dije en forma de cruz';

/* ══ A · REGISTRO, EXPEDIENTE Y MENÚ ═══════════════════════════════════════ */
console.log('\n── A · Registro de documentos, expediente y menú ──');

const reg = await page.evaluate(() => Object.keys(LC_DOCS));
log(reg.includes('F30') && reg.includes('RESUMEN'),
  'Los dos documentos son entradas del registro, no motores paralelos', reg.join(','));
log(await page.evaluate(() => LC_DOCS.F30.soloWord === true && lcExportSoloWord('F30') === true &&
    LC_DOCS.RESUMEN.soloWord === true && lcExportSoloWord('RESUMEN') === true),
  '⚠️ Los dos salen SOLO en Word: la app entrega un único formato por documento');
log(await page.evaluate(() => LC_DOCS.F30.anchoFijo === true && lcPapelesDe('F30').join(',') === 'CARTA,OFICIO'),
  '⚠️ El acta tiene anchoFijo: sus casillas son geometría del formulario',
  await page.evaluate(() => lcPapelesDe('F30').join(',')));

const idCaso = await page.evaluate(async ({ e1, e2, e3 }) => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{
    id: 'pf-1', grado: 'Subintendente', nombre: 'Nelson David Gómez', cedula: '1.035.302.775',
    cargo: 'Integrante Patrulla Vigilancia', entidad: 'Institución de prueba',
    telefono: '3001112233', correo: 'titular@prueba.test',
    companero: { grado: 'Patrullero', nombre: 'Ana María Restrepo Gil', cedula: '43.567.890',
                 cargo: 'Patrullera', telefono: '3004445566', correo: 'companera@prueba.test' }
  }];
  cfg.perfilActivo = 'pf-1';
  cfg.despachosPropios = [{ id: 'dp-1', clase: 'FISCALIA', nombre: 'Fiscalía URI Medellín',
    direccion: 'CR 64C # 67-300', barrio: 'Caribe', municipio: 'Medellín', departamento: 'Antioquia',
    nunc: '0500160002062026' }];
  cfg.despachoDefecto = { URI: 'dp-1' };
  DB.saveConfig(cfg);
  const c = {
    id: 'fe-uri', tipo: 'URI', nunc: '0500160002062026', fechaProc: '2026-05-13',
    despachoId: 'dp-1', destino: 'Fiscalía URI Medellín',
    conductas: ['Hurto calificado y agravado'], articulosCP: ['240'],
    lugar: { dir: 'CR 45 # 12-30', barrio: 'La Candelaria', muni: 'Medellín', depto: 'Antioquia',
             zona: 'Urbana', localidad: '10', vereda: 'N/A', caract: 'Vía pública, sector comercial' },
    capturados: [{
      id: 'per-1', rol: 'Capturado', tipoDoc: 'CC', numDoc: '1.037.949.889', expEn: 'Medellín',
      priNom: 'Robinson', priApe: 'Ramírez', segApe: 'Salazar', sexo: 'M', edad: '32', fn: '1994-03-11',
      nacMuni: 'Medellín', nacDepto: 'Antioquia', nacPais: 'Colombia',
      escol: 'Bachiller', ecivil: 'Soltero', ocup: 'Construcción', padres: 'Mario y Rober',
      dirRes: 'CL 38B # 26 A-09', tel: '3122681603', correo: 'rr@prueba.test', alias: 'El Flaco',
      senas: 'Cicatriz en el pómulo izquierdo'
    }],
    victimas: [{
      id: 'vic-1', rol: 'Víctima', tipoDoc: 'CC', numDoc: '43.111.222', expEn: 'Medellín',
      priNom: 'Natalia', priApe: 'Ardila', segApe: 'Ramírez', sexo: 'F',
      dirRes: 'CL 49 # 54-20', tel: '3159998877', correo: 'natalia@prueba.test'
    }],
    testigos: [{ id: 'tes-1', rol: 'Testigo', tipoDoc: 'CC', numDoc: '71.333.444',
      priNom: 'Jorge', priApe: 'Pérez', tel: '3007776655' }],
    hayVehiculos: true,
    vehiculos: [{ marca: 'Bajaj', clase: 'Motocicleta', color: 'Rojo', prop: 'Robinson Ramírez', placas: 'kmn12e' }],
    elementos: [{ cant: 2, desc: e1 }, { cant: 1, desc: e2 }, { cant: 1, desc: e3 }],
    narracion: { fechaCapD: '13', fechaCapM: '05', fechaCapA: '2026', horaCapH: '14', horaCapM: '25',
                 texto: 'Relato del procedimiento.' }
  };
  await DB.saveCase(c);
  return c.id;
}, { e1: EMP1, e2: EMP2, e3: EMP3 });
log(!!idCaso, 'Caso de flagrancia sembrado (3 EMP · 1 capturado · 1 víctima · 1 testigo · 1 vehículo)');

const docs = await page.evaluate(id => lcEstadoDocs(DB.getCase(id)).map(d => d.lbl), idCaso);
log(docs.includes('Acta de entrega') && docs.includes('Resumen de la captura'),
  'Los dos aparecen en el EXPEDIENTE, junto a los formatos que ya había', docs.join(' · '));

/* ⚠️ Y NO en el menú ⋮: es el punto de extensión que dejó abierto la auditoría
   del módulo Capturas para que el menú no crezca un ítem por documento
   («Esto debe de quedar dentro de expedientes», instrucción del usuario). */
await page.evaluate(id => openCaseSheet(id), idCaso);
await page.waitForTimeout(200);
const items = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent.trim()));
log(items.length === 4 && !items.some(t => /entrega|resumen|FPJ/i.test(t)),
  'El menú de la captura sigue en 4 ítems y no nombra ningún documento', items.join(' · '));
await page.evaluate(() => closeSheet());
await page.waitForTimeout(150);

/* ⚠️ El resumen NUNCA dice «faltan datos»: un dato sin registrar sale en blanco,
   que es justamente para lo que sirve antes de radicar. */
log(await page.evaluate(id => {
  const d = lcEstadoDocs(DB.getCase(id)).find(x => x.lbl === 'Resumen de la captura');
  return d && d.falta.length === 0;
}, idCaso), 'El resumen nunca bloquea: enseña lo que hay y deja en blanco lo que falta');

/* ⚠️ En una captura por ORDEN JUDICIAL no existen los formatos del numeral 7, y
   el acta de entrega es uno de ellos. El resumen sí se ofrece: es la hoja de
   trabajo del expediente, no un formato del numeral 7. */
const oj = await page.evaluate(async () => {
  const c = { id: 'fe-oj', tipo: 'OJ', ojv: 2, nunc: '', capturados: [{ id: 'p', priNom: 'X', priApe: 'Y' }],
              elementos: [], victimas: [], testigos: [] };
  await DB.saveCase(c);
  return lcEstadoDocs(DB.getCase('fe-oj')).map(d => d.lbl);
});
log(!oj.includes('Acta de entrega'), 'Una captura por orden judicial no ofrece el acta de entrega', oj.join(' · '));
log(oj.includes('Resumen de la captura'), 'Pero sí ofrece el resumen: es del expediente, no del numeral 7');

/* ══ B · LA PLANTILLA ══════════════════════════════════════════════════════ */
console.log('\n── B · Es el archivo oficial que aportó el usuario, sin red ──');

const tpl = await page.evaluate(() => {
  const partes = unzipDocx(TPL_F30);
  const dec = new TextDecoder();
  const doc = dec.decode(partes['word/document.xml']);
  return {
    nombres: Object.keys(partes).sort(),
    doc, rels: dec.decode(partes['word/_rels/document.xml.rels']),
    celdas: (doc.match(/<w:tc>|<w:tc /g) || []).length,
    escudo: (partes['word/media/image1.jpeg'] || []).length
  };
});
log(tpl.celdas === 154, 'La plantilla trae las 154 celdas del formato', tpl.celdas);
log(tpl.nombres.includes('word/footer1.xml') && tpl.escudo > 0,
  'Con su pie y su escudo — el del propio formato de la Fiscalía', tpl.escudo + ' bytes');
/* ⚠️ El acta de incautación llegó con un `INCLUDEPICTURE` a una URL de Google y
   hubo que limpiarla: Word REFRESCA esos campos, así que en un teléfono sin
   datos el escudo habría desaparecido y el documento habría viajado a un
   despacho con referencias de red dentro. Aquí se comprobó antes de embeber. */
log(tpl.rels.indexOf('External') < 0 && tpl.doc.indexOf('INCLUDEPICTURE') < 0,
  '⚠️ Ni una referencia externa ni un campo que Word tenga que refrescar');

/* ══ C · GEOMETRÍA INTACTA ═════════════════════════════════════════════════ */
console.log('\n── C · El formato no se mueve: solo cambia el texto ──');

const gen = await page.evaluate(async id => {
  const c = DB.getCase(id);
  const e = feActa(c);
  e.forma = 'D';
  e.recibeTipo = 'VICTIMA'; e.recibeIdx = 0;
  e.entrega = { origen: 'COMPANERO' };
  e.obs = 'Los elementos se entregan en el mismo estado en que fueron recolectados, previa autorización del fiscal del caso, quien la impartió por medio de correo electrónico institucional el mismo día.';
  e.obsElem = {};
  await DB.saveCase(c);
  const out = await buildActaEntregaBlob({ caso: DB.getCase(id) }, 'CARTA');
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  return { b64: btoa(String.fromCharCode.apply(null, buf.subarray(0, 0))) || '', fname: out.fname,
           noPDF: out.noPDF, label: out.label,
           doc: new TextDecoder().decode(out.files['word/document.xml']),
           tpl: new TextDecoder().decode(unzipDocx(TPL_F30)['word/document.xml']),
           bytes: Array.from(buf.subarray(0, 4)) };
}, idCaso);

const gA = geometria(gen.tpl), gB = geometria(gen.doc);
const dif = difGeom(gA, gB);
log(dif.length === 0, '⚠️ CERO diferencias de geometría contra la plantilla en blanco',
  dif.length ? dif.join(', ') : '1 tabla · 46 filas · 154 celdas · mismos anchos y altos');
log(gen.noPDF === true, 'El documento viaja marcado noPDF: ninguna ruta futura puede imprimirlo por descuido');
log(/^Acta_entrega_/.test(gen.fname) && /\.docx$/.test(gen.fname), 'Nombre de archivo con quien recibe', gen.fname);

/* ══ D · MAPEO ═════════════════════════════════════════════════════════════ */
console.log('\n── D · Cada casilla, con el dato que le toca ──');

const tc = tcTexto(gen.doc);
const C = await page.evaluate(() => F30_C);
log(tc.slice(C.NUNC[0], C.NUNC[0] + 16).join('') === '0500160002062026',
  'Las 16 casillas del NUNC, dígito a dígito', tc.slice(C.NUNC[0], C.NUNC[0] + 16).join(''));
/* ⚠️ Instrucción explícita del usuario: «los 16 dígitos del spoa dejando en
   consecutivo (los últimos 5 dígitos en blanco)». Ese número lo asigna el SPOA
   y no se conoce en el sitio de la captura: no se fabrica un dígito. */
log(tc.slice(C.NUNC[16], C.NUNC[20] + 1).join('') === '',
  '⚠️ Las 5 del Consecutivo quedan EN BLANCO — las asigna el SPOA');
log(tc[C.DEPTO] === 'ANTIOQUIA', 'Departamento', tc[C.DEPTO]);
log(/^Municipio\s+MEDELLÍN$/.test(tc[C.MUNI]),
  '⚠️ El municipio se AÑADE detrás de la etiqueta del formato, que no se borra', tc[C.MUNI]);
log(tc[C.ANO] === '2026' && tc[C.MES] === '05' && tc[C.DIA] === '13',
  'Fecha en sus tres casillas — las guías AAAA/MM/DD desaparecen',
  [tc[C.ANO], tc[C.MES], tc[C.DIA]].join('-'));
log(C.HORA.map(i => tc[i]).join('') === '1425', 'Hora en sus cuatro casillas', C.HORA.map(i => tc[i]).join(''));
/* «fiscalía / institución debe de quedar siempre como fiscalía» — instrucción
   literal del usuario. No es el nombre del despacho. */
log(tc[C.FISC] === 'Fiscalía', '⚠️ «Fiscalía / Institución» sale SIEMPRE como «Fiscalía»', tc[C.FISC]);
log(/CR 64C # 67-300/.test(tc[C.DIR]) && /Medellín/.test(tc[C.DIR]),
  'La dirección es la del despacho al que se dejó la captura', tc[C.DIR]);

const proc = tc[C.PROC];
log(/adscrito a\s+Institución de prueba/.test(proc),
  'La entidad del perfil, sobre el renglón «adscrito a»', proc.slice(0, 70) + '…');
log(/definitiva\s+X/.test(proc) && !/provisional\s+X/.test(proc),
  '⚠️ La forma de la entrega se marca con una X en su casilla, y solo en la suya');
log(/de lo siguiente:\s*_*\s*$/.test(proc.replace(/\s+$/, '') + ' ') || !/de lo siguiente:\S/.test(proc),
  '⚠️ «de lo siguiente:» se deja EN BLANCO: lo que se entrega va en el recuadro del apartado 2');

/* ══ E · LOS ELEMENTOS ═════════════════════════════════════════════════════ */
console.log('\n── E · El recuadro: el «No.» se repite por renglón ──');

/* ⚠️ El recuadro se localiza POR SU CONTENIDO, no por índices planos: cuando se
   reproduce una fila los índices de todo lo que va detrás se corren, así que
   leer `C.E0 + i*4` sin tope acaba midiendo la nota del formato y el título del
   apartado 4 como si fueran renglones de elementos. */
function recuadro(xml) {
  const trs = [...xml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map(m => m[1]);
  const enc = trs.findIndex(t => /Descripción/.test(texto(t)) && /Cantidad/.test(texto(t)));
  const fin = trs.findIndex(t => /En el evento de existir/.test(texto(t)));
  return trs.slice(enc + 1, fin).map(t => {
    const c = celdasDe(t).map(texto);
    return { no: c[0] || '', cant: c[1] || '', desc: c[2] || '', obs: c[3] || '' };
  });
}
const filas = recuadro(gen.doc);
const usadas = filas.filter(f => f.desc);
log(usadas.length > 3, 'La descripción larga ocupó varios renglones', usadas.length + ' renglones para 3 elementos');
/* La regla que fijó el usuario: «rellenas con el 1 la casilla de No hasta el
   renglón 4 y después sigue la secuencia normal … cuatro veces 1, 2, 3 y
   terminaría en 4». O sea: el número se repite mientras dure su descripción,
   nunca retrocede, no salta ninguno y hay exactamente uno por elemento. */
const nos = usadas.map(f => f.no);
const ordinal = (() => {
  const vistos = [];
  for (const x of nos) if (!vistos.length || vistos[vistos.length - 1] !== x) vistos.push(x);
  return vistos.join(',') === '1,2,3' &&              // los tres elementos, en orden y sin saltos
         nos.filter(x => x === '1').length > 1;       // el primero ocupó varios renglones
})();
log(ordinal,
  '⚠️ El «No.» se repite en todos los renglones del elemento y luego sigue la secuencia', nos.join(','));
log(usadas[0].cant === '02' && usadas[1].cant === '',
  '⚠️ La cantidad va SOLO en el primer renglón: repetirla se leería como más unidades');
log(usadas.map(f => f.desc).join(' ').indexOf('KL614883') >= 0 &&
    usadas.map(f => f.desc).join(' ').indexOf('cadena en metal amarillo') >= 0,
  'Ni una palabra de la descripción se pierde al partirla en renglones');
/* ⚠️ Las filas que sobran quedan con su «No.» EN BLANCO. El formato las trae
   numeradas 1..7, y un número suelto en una fila vacía se lee como un elemento
   que faltó por escribir — misma regla que las conductas del numeral 2. */
const pocos = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(DB.getCase('fe-uri')));
  c.id = 'fe-pocos';
  c.elementos = [{ id: 'e1', cant: 1, desc: 'un celular' }, { id: 'e2', cant: 1, desc: 'una cadena' }];
  await DB.saveCase(c);
  const out = await buildActaEntregaBlob({ caso: DB.getCase('fe-pocos') }, 'CARTA');
  return new TextDecoder().decode(out.files['word/document.xml']);
});
const sobrantes = recuadro(pocos).slice(2);
log(sobrantes.length === 5 && sobrantes.every(f => !f.no && !f.desc),
  '⚠️ Las filas que sobran quedan sin número: un ordinal suelto se lee como un elemento que falta',
  sobrantes.length + ' filas en blanco de las 7 del formato');

/* Con muchos elementos el recuadro REPRODUCE la fila, como autoriza el propio
   formato al pie («En el evento de existir más registros…»). */
const muchos = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(DB.getCase('fe-uri')));
  c.id = 'fe-muchos';
  c.elementos = [];
  for (let i = 1; i <= 12; i++) c.elementos.push({ id: 'e' + i, cant: 1, desc: 'elemento número ' + i });
  await DB.saveCase(c);
  const out = await buildActaEntregaBlob({ caso: DB.getCase('fe-muchos') }, 'CARTA');
  const doc = new TextDecoder().decode(out.files['word/document.xml']);
  return { filas: (doc.match(/<w:tr[ >]/g) || []).length, doc };
});
log(muchos.filas === 46 + 5, 'Con 12 elementos el recuadro reproduce las filas que hacen falta',
  muchos.filas + ' filas (46 del formato + 5)');
const rMuchos = recuadro(muchos.doc);
log(rMuchos.length === 12 && rMuchos[11].desc.indexOf('elemento número 12') >= 0 &&
    rMuchos.map(f => f.no).join(',') === '1,2,3,4,5,6,7,8,9,10,11,12',
  '⚠️ Ni un elemento se pierde: la lista no se recorta nunca', rMuchos.length + ' renglones');

/* ══ F · QUIÉN ENTREGA Y QUIÉN RECIBE ══════════════════════════════════════ */
console.log('\n── F · Los dos bloques de personas ──');

log(tc[C.ENOM] === 'ANA MARÍA RESTREPO GIL',
  '⚠️ Puede entregar cualquiera de los dos de la patrulla: aquí, la compañera', tc[C.ENOM]);
log(tc[C.EIDE] === '43567890' && tc[C.EENT] === 'Institución de prueba' && tc[C.ECAR] === 'Patrullera',
  'Su identificación, entidad y cargo salen del perfil',
  [tc[C.EIDE], tc[C.EENT], tc[C.ECAR]].join(' · '));
/* El teléfono y el correo del compañero son EL CAMPO QUE PIDIÓ EL USUARIO: el
   formato los imprime y hasta ahora no se guardaban de él. */
log(tc[C.ETEL] === '3004445566' && tc[C.ECOR] === 'companera@prueba.test',
  '⚠️ El teléfono y el correo del compañero, que ahora se registran en el perfil',
  [tc[C.ETEL], tc[C.ECOR]].join(' · '));
log(tc[C.RNOM] === 'NATALIA ARDILA RAMÍREZ',
  '⚠️ Quien recibe es la VÍCTIMA del procedimiento, propuesta por la app', tc[C.RNOM]);
log(tc[C.RIDE] === 'CC 43111222' && tc[C.RDIR] === 'CL 49 # 54-20' && tc[C.RTEL] === '3159998877',
  'Con su identificación, dirección y teléfono, sin volver a preguntarlos',
  [tc[C.RIDE], tc[C.RDIR], tc[C.RTEL]].join(' · '));

/* «en ocasiones se le entrega a otra persona» — se pregunta siempre. */
const otro = await page.evaluate(async () => {
  const c = DB.getCase('fe-uri');
  const e = feActa(c);
  e.recibeTipo = 'OTRO';
  e.recibe = { nombre: 'Carlos Alberto Mesa', ident: '8.111.222', dir: 'CL 10 # 40-15',
               tel: '3011234567', correo: 'carlos@prueba.test' };
  await DB.saveCase(c);
  const out = await buildActaEntregaBlob({ caso: DB.getCase('fe-uri') }, 'CARTA');
  return new TextDecoder().decode(out.files['word/document.xml']);
});
const tcOtro = tcTexto(otro);
log(tcOtro[C.RNOM] === 'CARLOS ALBERTO MESA' && tcOtro[C.RIDE] === '8111222',
  '⚠️ Y se puede entregar a otra persona, con sus propios datos', tcOtro[C.RNOM]);

/* ══ G · LO QUE NO SE INVENTA ══════════════════════════════════════════════ */
console.log('\n── G · Lo que se deja en blanco a propósito ──');

const tplTc = tcTexto(gen.tpl);
/* Las tres celdas que el formato reserva para firmar y estampar la huella: 135
   (firma de quien entrega), 152 (firma de quien recibe) y 143 (huella). Ninguna
   se escribe nunca — el acta se imprime para firmarse a mano. */
log([135, 143, 152].every(i => tc[i] === tplTc[i] && !tc[i]),
  '⚠️ Las dos casillas de FIRMA y la de la HUELLA quedan como las trae el formato');
/* ⚠️ Ni se estampa aquí la firma manuscrita del perfil: en esta acta firman las
   DOS partes en el mismo papel, y una firma preimpresa junto a una manuscrita no
   es lo que el documento acredita. Solo la lleva el oficio de disposición. */
const imgs = x => (x.match(/<w:drawing>|<w:pict>/g) || []).length;
log(imgs(gen.doc) === imgs(gen.tpl),
  '⚠️ Y no se añade ninguna imagen: el documento trae las mismas que el formato',
  imgs(gen.doc) + ' = ' + imgs(gen.tpl));
log(tc[63] === tplTc[63] && tc[64] === tplTc[64] && tc[66] === tplTc[66] && tc[67] === tplTc[67],
  '⚠️ «Actos Urgentes» y «Orden a Policía Judicial» se dejan al usuario, como pidió');
log(C.RAD.every(i => !tc[i]), 'El radicado interno queda en blanco: lo asigna la unidad receptora');

/* ══ H · UN SOLO CUERPO DE LETRA ═══════════════════════════════════════════ */
console.log('\n── H · Todo lo que rellena la app declara su tamaño ──');

/* ⚠️ La exigencia NO puede ser «cero runs sin w:sz»: la mayoría de los runs son
   los del formato, que no lo declaran y salen al de su propio estilo. Lo que se
   exige es que todo run que la APP escribe declare el suyo — medido POR
   DIFERENCIA contra la plantilla. */
const runsCon = xml => [...xml.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)]
  .map(m => m[1]).filter(r => /<w:t[ >]/.test(r));
const nuevos = (() => {
  const antes = new Set(runsCon(gen.tpl).map(r => r.replace(/\s+/g, '')));
  return runsCon(gen.doc).filter(r => !antes.has(r.replace(/\s+/g, '')));
})();
const sinSz = nuevos.filter(r => !/<w:sz w:val="\d+"/.test(r));
log(nuevos.length > 10 && sinSz.length === 0,
  '⚠️ Cero runs escritos por la app sin `w:sz` propio (el defecto es la AUSENCIA, no el valor)',
  nuevos.length + ' runs nuevos · ' + sinSz.length + ' sin tamaño');
const tam = [...new Set(nuevos.map(r => (/<w:sz w:val="(\d+)"/.exec(r) || [])[1]))].sort();
log(tam.every(t => t === '20' || t === '22'),
  'Y todos al cuerpo del formato que los rodea: 10 pt en la cabecera, 11 pt en el resto',
  tam.map(t => t / 2 + ' pt').join(' · '));

/* ══ I · EL RESUMEN DE LA CAPTURA ══════════════════════════════════════════ */
console.log('\n── I · El resumen: los seis bloques que se pidieron ──');

const res = await page.evaluate(async id => {
  const out = await buildResumenBlob({ caso: DB.getCase(id) }, 'CARTA');
  return { fname: out.fname, noPDF: out.noPDF,
           doc: new TextDecoder().decode(out.files['word/document.xml']),
           partes: Object.keys(out.files).sort() };
}, idCaso);
const rt = texto(res.doc);
/* ⚠️ Un espacio, no dos: los títulos llevan dos tras el punto (como el oficio),
   pero `texto()` colapsa el blanco — comparar con dos no encontraría ninguno. */
const seis = ['1. DIRECCIÓN DE LOS HECHOS', '2. DATOS DEL O LOS CAPTURADOS',
  '3. DATOS DE LA O LAS VÍCTIMAS', '4. TESTIGOS',
  '5. ELEMENTOS MATERIALES PROBATORIOS Y EVIDENCIA FÍSICA', '6. VEHÍCULOS IMPLICADOS'];
const faltan6 = seis.filter(s => rt.indexOf(s) < 0);
log(faltan6.length === 0, 'Los seis bloques que pidió el usuario, en su orden',
  faltan6.length ? 'faltan: ' + faltan6.join(' · ') : seis.length + ' apartados');
/* Orden: el documento tiene que leerse en el orden en que se pidieron. */
const pos = seis.map(s => rt.indexOf(s));
log(pos.every((p, i) => i === 0 || p > pos[i - 1]), 'Y en ese orden exacto dentro del documento');

log(rt.indexOf('CR 45 # 12-30') >= 0 && rt.indexOf('La Candelaria') >= 0,
  '1 · La dirección de los hechos, con su barrio y su municipio');
log(rt.indexOf('ROBINSON RAMÍREZ SALAZAR') >= 0 && rt.indexOf('1037949889') >= 0 &&
    rt.indexOf('Cicatriz en el pómulo izquierdo') >= 0,
  '2 · El capturado, con su documento y sus señales particulares');
log(rt.indexOf('NATALIA ARDILA RAMÍREZ') >= 0, '3 · La víctima');
log(rt.indexOf('JORGE PÉREZ') >= 0, '4 · El testigo');
log(rt.indexOf('KL614883') >= 0 && rt.indexOf('cadena en metal amarillo') >= 0,
  '5 · Los EMP y EF, con la misma redacción del numeral 7');
log(rt.indexOf('Motocicleta') >= 0 && rt.indexOf('KMN12E') >= 0,
  '⚠️ 6 · El vehículo, con la placa en mayúsculas como en el resto de la app');
/* ⚠️ La misma primitiva que los imprime en el FPJ-5: lo que dice el resumen es
   palabra por palabra lo que dice el informe. */
const igualEmp = await page.evaluate(id => {
  const c = DB.getCase(id);
  return lcEmpLineas(ccElementos(c))[1];
}, idCaso);
log(rt.indexOf(igualEmp) >= 0, 'Transcritos con `lcEmpLineas`, no con una segunda redacción',
  igualEmp.slice(0, 46) + '…');
log(rt.indexOf('Hurto calificado y agravado — Art. 240 C.P.') >= 0,
  'La conducta punible sale con su artículo del Código Penal, como en el numeral 2');
log(res.noPDF === true && res.partes.indexOf('word/footer1.xml') >= 0 && !res.partes.some(p => /media/.test(p)),
  '⚠️ Paquete propio: sin escudo ni membrete —no reproduce ningún formato aprobado— y con su pie de página',
  res.partes.length + ' partes');
log(!/w:lineRule="exact"/.test(res.doc),
  '⚠️ Ni un `lineRule="exact"`: lo que el funcionario escriba encima CRECE, no se recorta');
/* Un resumen de una captura vacía tiene que decir qué no hay, no romperse. */
const vacio = await page.evaluate(async () => {
  const c = { id: 'fe-vacio', tipo: 'URI', nunc: '', capturados: [], victimas: [], testigos: [],
              elementos: [], vehiculos: [], lugar: {}, narracion: {} };
  await DB.saveCase(c);
  const out = await buildResumenBlob({ caso: DB.getCase('fe-vacio') }, 'CARTA');
  return new TextDecoder().decode(out.files['word/document.xml']);
});
const vt = texto(vacio);
log(vt.indexOf('No hay ninguna persona registrada') >= 0 &&
    vt.indexOf('No se recolectaron EMP ni EF') >= 0 &&
    vt.indexOf('No hay vehículos implicados') >= 0,
  '⚠️ Con la captura vacía dice qué NO hay, en vez de inventarlo o de romperse');
/* En una captura de menores el término jurídico es «aprehendido» (Ley 1098). */
const menor = texto(await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(DB.getCase('fe-uri')));
  c.id = 'fe-cespa'; c.tipo = 'CESPA';
  await DB.saveCase(c);
  const out = await buildResumenBlob({ caso: DB.getCase('fe-cespa') }, 'CARTA');
  return new TextDecoder().decode(out.files['word/document.xml']);
}));
log(menor.indexOf('DATOS DEL O LOS APREHENDIDOS') >= 0 && menor.indexOf('CAPTURADOS') < 0,
  '⚠️ En una aprehensión de menores dice «aprehendidos», como el resto de la app');

/* ══ J · PERSISTENCIA, PERFIL E INVITADO ═══════════════════════════════════ */
console.log('\n── J · Persistencia, perfil, invitado y consola ──');

await page.evaluate(id => abrirActaEntrega(id), idCaso);
await page.waitForTimeout(500);
log(await page.$('#fe-obs') !== null, 'El formulario del acta abre desde el expediente');
log(await page.$$eval('#fe-elementos .fe-el-c', e => e.length).then(x => x === 3),
  'Con los tres elementos del numeral 7, cada uno con su casilla y su observación');
await page.fill('#fe-obs', 'Observación de prueba');
await page.selectOption('#fe-forma', 'P');
await page.uncheck('#fe-elementos .fe-el-c >> nth=2');
await page.waitForTimeout(150);
const resumenTxt = await page.textContent('#fe-elem-res');
log(/2 elementos/.test(resumenTxt), 'Al desmarcar un elemento el resumen de arriba se actualiza', resumenTxt);
await page.evaluate(() => closeModal());
await page.waitForTimeout(400);
const guardado = await page.evaluate(() => {
  const e = DB.getCase('fe-uri').entrega || {};
  return { obs: e.obs, forma: e.forma, ex: (e.excluidos || []).length };
});
log(guardado.obs === 'Observación de prueba' && guardado.forma === 'P' && guardado.ex === 1,
  '⚠️ Cerrar el modal guarda lo escrito, no lo tira (como el acta de derechos)',
  JSON.stringify(guardado));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-e', '7788');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(500);
log(await page.evaluate(() => (DB.getCase('fe-uri').entrega || {}).obs === 'Observación de prueba'),
  'Y sobrevive a recargar la app');

/* El perfil pide el teléfono y el correo del compañero: es el campo que pidió
   el usuario («un espacio dentro del perfil del usuario para colocar el correo
   del compañero de patrulla»). */
await page.evaluate(() => openPerfilForm('pf-1'));
await page.waitForTimeout(300);
log(await page.$('#pfm-ccorreo') !== null && await page.$('#pfm-ctel') !== null,
  '⚠️ El perfil tiene ya el correo (y el teléfono) del compañero de patrulla');
log(await page.inputValue('#pfm-ccorreo') === 'companera@prueba.test',
  'Con su valor guardado, y se ofrece solo en cada acta');
await page.evaluate(() => closeModal());
await page.waitForTimeout(200);

/* Los .docx quedan en el temporal por si hay que abrirlos en Word. */
for (const [nombre, kind] of [['acta_entrega', 'F30'], ['resumen', 'RESUMEN']]) {
  const b64 = await page.evaluate(async k => {
    const out = await lcDoc(k).build({ caso: DB.getCase('fe-uri') }, 'CARTA');
    const u8 = new Uint8Array(await out.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  }, kind);
  await writeFile(join(SALIDA, nombre + '.docx'), Buffer.from(b64, 'base64'));
}
console.log('   .docx en', SALIDA);

/* ⚠️ En modo invitado no se escribe un byte: el acta y el resumen funcionan en
   memoria y mueren con la sesión (Habeas Data — datos de un capturado). */
const inv = await page.evaluate(async () => {
  const antes = JSON.stringify(Object.keys(localStorage).map(k => [k, localStorage[k].length]));
  guestEntrar();
  const c = { id: 'g1', tipo: 'URI', nunc: '', capturados: [{ id: 'p', priNom: 'A', priApe: 'B' }],
              victimas: [], testigos: [], elementos: [{ cant: 1, desc: 'un celular' }], lugar: {}, narracion: {} };
  await DB.saveCase(c);
  const c2 = DB.getCase('g1');
  const e = feActa(c2); e.forma = 'D'; e.recibeTipo = 'OTRO';
  e.recibe = { nombre: 'Invitado Prueba', ident: '123' };
  await DB.saveCase(c2);
  const a = await buildActaEntregaBlob({ caso: DB.getCase('g1') }, 'CARTA');
  const r = await buildResumenBlob({ caso: DB.getCase('g1') }, 'CARTA');
  const despues = JSON.stringify(Object.keys(localStorage).map(k => [k, localStorage[k].length]));
  return { igual: antes === despues, acta: !!a, res: !!r };
});
log(inv.acta && inv.res, 'En modo invitado los dos documentos se generan igual');
log(inv.igual, '⚠️ Y sin escribir un byte en localStorage', 'huella idéntica antes y después');



log(errores.length === 0, 'Consola limpia', errores.slice(0, 3).join(' | ') || 'sin errores');

await browser.close();
server.close();
console.log(`\n${fails ? '❌' : '✅'} ${n - fails}/${n} comprobaciones`);
process.exit(fails ? 1 : 0);
