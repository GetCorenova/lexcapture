/* Regresión del «Acta de incautación de elementos».

   ⚠️ ESTE FORMATO YA NO LO DIBUJA LA APP: SE RELLENA SOBRE EL ARCHIVO OFICIAL.
   Hasta el 2026-08-25 lo componía la app en OOXML, que era lo único posible
   mientras del formato solo existiera la fotografía de uno diligenciado a mano.
   El 2026-08-26 el usuario aportó el archivo en blanco
   (`Documentos/Otro/ACTA DE INCAUTACION DE ELEMENTOS.docx`), que se embebe como
   `TPL_ACTA` y se rellena por índice de celda y por renglón, igual que el FPJ-5
   y el acta de derechos. Eso cambia de raíz qué hay que comprobar: ahora SÍ hay
   original, así que lo que se exige es que **no se haya movido nada de él**.

     A. Arquitectura — el registro, el expediente y el menú.
     B. La plantilla — es el archivo del usuario, limpio y sin referencias de red.
     C. Geometría INTACTA — cero diferencias contra la plantilla en blanco.
     D. Mapeo — los campos del formato salen del caso; nada se vuelve a pedir.
     E. Los renglones, escritos sobre la línea del formato sin borrarla.
     F. Los elementos: transcritos del numeral 7 y numerados como se pidió.
     G. Quién firma: perfil, compañero de patrulla u otro funcionario.
     H. Editable — ni un `lineRule="exact"`, que RECORTA lo que se escriba.
     I. Un solo cuerpo de letra para todo lo que rellena la app.
     J. Lo que NO se inventa: firmas, huella, expediente CAD, consecutivo.
     K. Persistencia, modo invitado y consola limpia.

   Los .docx se escriben en el TEMPORAL del sistema y no en el directorio del
   proyecto: abrir uno en Word lo deja bloqueado y la siguiente corrida moriría
   con EBUSY antes de comprobar nada (lección de verify_fpj6).                */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
/* ⚠️ Cada corrida escribe en SU PROPIO directorio. Abrir uno de estos .docx en
   Word lo deja bloqueado, y con un nombre fijo la corrida siguiente muere con
   EBUSY antes de comprobar nada — le pasó a verify_fpj6 y volvió a pasar aquí. */
const SALIDA = join(tmpdir(), 'lc_incautacion_' + Date.now().toString(36));
await mkdir(SALIDA, { recursive: true });
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

/* Lector de .docx. ⚠️ Tanto `_buildZip` como la plantilla embebida escriben
   STORED (sin compresión), así que las partes se leen directo del archivo sin
   inflar — igual que hace `unzipDocx` dentro de la app. */
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
/* Todo el texto de un `w:t`, en orden de documento.
   ⚠️ El nombre del elemento tiene que terminar aquí: `<w:t[^>]*>` engancha
   también `<w:tblPr>`, `<w:tcPr>` y `<w:trPr>`. */
const runs = xml => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]);
const celdasDe = xml => [...xml.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(m => m[1]);

/* ⚠️ LA GEOMETRÍA DEL FORMATO, para compararla contra la plantilla en blanco.
   Es la comprobación que este módulo no podía hacer cuando la app dibujaba el
   acta: ahora hay original, y lo único que puede cambiar es el TEXTO. */
function geometria(xml) {
  const tbls = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map(m => m[1]);
  return {
    tablas: tbls.length,
    filas: tbls.map(t => (t.match(/<w:tr[ >]/g) || []).length).join(','),
    celdas: (xml.match(/<w:tc>|<w:tc /g) || []).length,
    gridCol: [...xml.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => m[1]).join(','),
    tcW: [...xml.matchAll(/<w:tcW w:w="(\d+)" w:type="(\w+)"/g)].map(m => m[1] + m[2]).join(','),
    trHeight: [...xml.matchAll(/<w:trHeight ([^>]*)\/>/g)].map(m => m[1]).join(','),
    tblW: [...xml.matchAll(/<w:tblW w:w="(\d+)" w:type="(\w+)"/g)].map(m => m[1] + m[2]).join(','),
    tblInd: [...xml.matchAll(/<w:tblInd w:w="(-?\d+)"/g)].map(m => m[1]).join(','),
    gridSpan: [...xml.matchAll(/<w:gridSpan w:val="(\d+)"/g)].map(m => m[1]).join(','),
    pgSz: (/<w:pgSz [^>]*>/.exec(xml) || [''])[0],
    pgMar: (/<w:pgMar [^>]*>/.exec(xml) || [''])[0],
    pgBorders: (/<w:pgBorders[\s\S]*?<\/w:pgBorders>/.exec(xml) || [''])[0],
    tcBorders: (xml.match(/<w:tcBorders>/g) || []).length,
    imagen: (xml.match(/<v:imagedata [^>]*>/g) || []).join(',')
  };
}
function difGeom(a, b) {
  return Object.keys(a).filter(k => String(a[k]) !== String(b[k]));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true });
const errores = [];
page.on('pageerror', e => errores.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '445566');
await page.fill('#pin-b', '445566');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

const EMP1 = 'cheques de Bancolombia, uno identificado con el número KL614882 y otro con el número KL614883, ambos girados el 20/08/2026';
const EMP2 = 'celular marca Samsung Galaxy XY A20S color azul, IMEI 1 354260112921 80, IMEI 2 354261111292488';
const EMP3 = 'cuchillo tipo carnicero con cachas de madera';

/* ══ A · ARQUITECTURA ══════════════════════════════════════════════════════ */
console.log('\n── A · Registro de documentos, expediente y menú ──');

const reg = await page.evaluate(() => Object.keys(LC_DOCS));
log(reg.includes('INCAU'), 'El acta es una entrada del registro de documentos, no un motor paralelo', reg.join(','));
/* ⚠️ ESTE ES EL CAMBIO DE FONDO. Era el único formato oficial que se ofrecía en
   PDF, y solo era defendible mientras lo compusiera la app dentro del
   subconjunto que el traductor OOXML→HTML implementa. El archivo real usa
   `w:trHeight`, `w:vMerge`, `w:tcW` y el escudo en VML — las construcciones por
   las que el FPJ-5 y el FPJ-6 quedaron en solo-Word. */
log(await page.evaluate(() => LC_DOCS.INCAU.soloWord === true && lcExportSoloWord('INCAU') === true),
  '⚠️ Ahora es SOLO WORD, como los otros formatos oficiales que se rellenan');
log(await page.evaluate(() => LC_DOCS.INCAU.anchoFijo === true && lcPapelesDe('INCAU').join(',') === 'CARTA,OFICIO'),
  '⚠️ anchoFijo: solo se le ofrecen tamaños de 8,5" — sus casillas son geometría del formulario',
  await page.evaluate(() => lcPapelesDe('INCAU').join(',')));
/* ⚠️ El oficio de orden judicial pasó a SOLO WORD el 2026-08-28 (obs. 1): era el
   último documento con dos salidas. Y el papel dejó de elegirse —es Carta fija—,
   así que aquí ya no hay nada que preparar: donde esta suite mide geometría de
   Oficio se lo pasa directamente al motor, que no cambió. */
log(await page.evaluate(() => lcExportSoloWord('FPJ') === true && lcExportSoloWord('OJ') === true && LC_DOCS.FPJ8.esPDF === true),
  'Los seis formatos tienen una sola salida posible cada uno');

/* ── Caso sembrado ── */
const idCaso = await page.evaluate(async ({ e1, e2, e3 }) => {
  const cfg = DB.getConfig();
  cfg.nuncUri = '0500160002062026';
  cfg.perfiles = [{
    id: 'pf-1', grado: 'Subintendente', nombre: 'Nelson David David', cedula: '1.035.302.775',
    cargo: 'Integrante Patrulla Vigilancia', entidad: 'Institución de prueba', correo: 'x@prueba.test',
    companero: { nombre: 'Ana María Restrepo Gil', cedula: '43.567.890', cargo: 'Patrullera', entidad: 'Institución de prueba' }
  }];
  cfg.perfilActivo = 'pf-1';
  DB.saveConfig(cfg);
  const c = {
    id: 'ai-uri', tipo: 'URI', nunc: '0500160002062026', fechaProc: '2026-05-13',
    conductas: ['Hurto calificado y agravado'],
    lugar: { dir: 'CL 52 # 50-31', barrio: 'La Candelaria', muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{
      id: 'per-1', rol: 'Capturado', tipoDoc: 'CC', numDoc: '1.037.949.889', expEn: 'Medellín',
      priNom: 'Robinson', priApe: 'Ramírez', segApe: 'Salazar', lugNac: 'Medellín',
      escol: 'Bachiller', ecivil: 'Soltero', ocup: 'Construcción', padres: 'Mario y Rober',
      dirRes: 'CL 38B # 26 A-09 int 101', tel: '3122681603'
    }],
    victimas: [], testigos: [], sinVictima: true, sinTestigo: true,
    elementos: [{ cant: 2, desc: e1 }, { cant: 1, desc: e2 }, { cant: 1, desc: e3 }],
    narracion: { fechaCapD: '13', fechaCapM: '05', fechaCapA: '2026', horaCapH: '14', horaCapM: '25', texto: 'Relato.' }
  };
  await DB.saveCase(c);
  return c.id;
}, { e1: EMP1, e2: EMP2, e3: EMP3 });
log(!!idCaso, 'Caso de flagrancia con tres EMP sembrado');

const docs = await page.evaluate(id => lcEstadoDocs(DB.getCase(id)).map(d => d.lbl), idCaso);
log(docs.includes('Acta de incautación'), 'Aparece en el expediente, junto a los otros cuatro formatos', docs.join(' · '));

/* ⚠️ Y NO en el menú ⋮: es el punto de extensión que dejó abierto la auditoría
   del módulo Capturas para que el menú no crezca un ítem por documento. */
await page.evaluate(id => openCaseSheet(id), idCaso);
await page.waitForTimeout(200);
const items = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent.trim()));
log(items.length === 4 && !items.some(t => /FPJ|Oficio|Acta|custodia|Rótulo/i.test(t)),
  'El menú de la captura no nombra ningún documento: no puede crecer con este formato', items.join(' · '));
log(!items.some(t => /incauta/i.test(t)), '⚠️ Y el acta no entró en él: vive en el expediente');
await page.evaluate(() => closeSheet());
await page.waitForTimeout(150);

/* ⚠️ La tarjeta tiene que decir lo MISMO que dirá el motor al generar: si la
   pantalla usara un criterio propio, mentiría. */
const faltaCoincide = await page.evaluate(() => {
  const c = DB.getCase('ai-uri');
  const tarjeta = lcEstadoDocs(c).find(d => d.lbl === 'Acta de incautación').falta;
  return JSON.stringify(tarjeta) === JSON.stringify(aiFaltantes(c));
});
log(faltaCoincide, 'Lo que la tarjeta dice que falta es lo mismo que bloquea al generar');

/* ⚠️ Expectativa actualizada el 2026-08-28 (Mejora 6, 2.º documento, obs. 2):
   sin EMP ni EF el acta NO se ofrece bloqueada — no se ofrece. No es un dato que
   falte: hay capturas que sencillamente no tienen elementos, y en ellas el acta
   de incautación no existe. Ofrecerla con un «Faltan datos» invitaba a
   diligenciar un documento que no corresponde a ese procedimiento. */
const sinEmp = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-vacio', elementos: [], narracion: { emp: '' } });
  await DB.saveCase(c);
  const docs = lcEstadoDocs(DB.getCase('ai-vacio'));
  return { acta: docs.some(d => d.lbl === 'Acta de incautación'), quedan: docs.map(d => d.lbl).join(' · ') };
});
log(sinEmp.acta === false,
  'Sin EMP registrados el acta no se ofrece: no corresponde a ese procedimiento', sinEmp.quedan);

/* ══ B · LA PLANTILLA ══════════════════════════════════════════════════════ */
console.log('\n── B · Es el archivo oficial, limpio y sin red ──');

const tpl = await page.evaluate(() => {
  const partes = unzipDocx(TPL_ACTA);
  const out = {};
  for (const k in partes) out[k] = partes[k].length;
  return { partes: out, b64: TPL_ACTA.length };
});
log(Object.keys(tpl.partes).length === 17 && !!tpl.partes['word/document.xml'],
  'La plantilla se desempaqueta: 17 partes del .docx original', Object.keys(tpl.partes).length + ' partes');
log(!!tpl.partes['word/media/image1.jpeg'],
  'Trae el escudo del propio formato — no se añadió ni un byte de imagen al repositorio',
  tpl.partes['word/media/image1.jpeg'] + ' bytes');
/* ⚠️ El archivo original traía el escudo como un campo INCLUDEPICTURE apuntando
   a una URL de Google Images, envuelto en un hiperenlace externo. Word REFRESCA
   esos campos: en un teléfono sin datos el escudo habría desaparecido, y el
   documento habría viajado a un despacho judicial con dos referencias de red
   dentro. Se sustituyó por el mismo JPEG en un run plano. */
const tplDoc = await page.evaluate(() => new TextDecoder().decode(unzipDocx(TPL_ACTA)['word/document.xml']));
const tplRels = await page.evaluate(() => new TextDecoder().decode(unzipDocx(TPL_ACTA)['word/_rels/document.xml.rels']));
log(!/INCLUDEPICTURE/.test(tplDoc) && !/w:hyperlink/.test(tplDoc) && !/r:href/.test(tplDoc),
  '⚠️ Sin campo INCLUDEPICTURE, sin hiperenlace y sin imagen enlazada: el escudo es fijo y offline');
log(!/TargetMode="External"/.test(tplRels),
  '⚠️ Y sin una sola relación externa: el acta no lleva enlaces de red a un despacho judicial');
log(/<v:imagedata r:id="rId8"\/>/.test(tplDoc), 'El escudo sigue siendo el JPEG embebido del formato');
log(!/<w:br w:type="page"\/>/.test(tplDoc),
  'Sin el salto de página inerte que la celda del escudo arrastraba desde 2005');

/* ══ C · GEOMETRÍA INTACTA ═════════════════════════════════════════════════ */
console.log('\n── C · El formato no se mueve: cero diferencias con el original ──');

async function generar(id, nombre, papel) {
  const r = await page.evaluate(async ({ id, papel }) => {
    const out = buildActaIncautacionBlob({ caso: DB.getCase(id) }, papel || 'CARTA');
    if (!out) return null;
    const buf = new Uint8Array(await out.blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    return { b64: btoa(s), fname: out.fname, label: out.label, papel: out.papel, noPDF: !!out.noPDF };
  }, { id, papel });
  if (!r) return null;
  const buf = Buffer.from(r.b64, 'base64');
  await writeFile(join(SALIDA, nombre), buf);
  return { ...r, buf, partes: leerDocx(buf) };
}

const doc = await generar(idCaso, 'verify_incautacion.docx');
log(!!doc, 'El acta se genera', doc && doc.fname);
const dx = doc.partes['word/document.xml'].toString('utf8');
const txt = texto(dx);
log(doc.noPDF === true,
  '⚠️ Y sale marcada `noPDF`: la guarda es ESTRUCTURAL, no de interfaz — ninguna ruta futura puede imprimirla');

log(Object.keys(doc.partes).length === Object.keys(tpl.partes).length,
  'El paquete conserva las 17 partes del formato: estilos, numeración, tema, notas y los dos pies',
  Object.keys(doc.partes).length + ' partes');
const intactas = Object.keys(tpl.partes).filter(k => k !== 'word/document.xml')
  .filter(k => doc.partes[k] && doc.partes[k].length === tpl.partes[k]);
log(intactas.length === Object.keys(tpl.partes).length - 1,
  '⚠️ Y todas menos `document.xml` viajan BYTE A BYTE como en el original',
  intactas.length + '/' + (Object.keys(tpl.partes).length - 1));

const gTpl = geometria(tplDoc), gDoc = geometria(dx);
const dif = difGeom(gTpl, gDoc);
log(dif.length === 0,
  '⚠️ CERO diferencias de geometría contra la plantilla en blanco: lo único que cambia es el TEXTO',
  dif.length ? dif.join(', ') : '14 propiedades idénticas');
log(gDoc.tablas === 4 && gDoc.filas === '4,2,10,2' && gDoc.celdas === 86,
  'Sus 4 tablas, 18 filas y 86 celdas, las del formato', `${gDoc.tablas} tablas · ${gDoc.celdas} celdas`);
log(/w:w="12242" w:h="15842"/.test(gDoc.pgSz),
  'Y su tamaño de página, que es el mismo del FPJ-5 y del acta de derechos', gDoc.pgSz);
log(/<w:pgBorders w:offsetFrom="page">/.test(gDoc.pgBorders),
  '⚠️ El recuadro que encierra el formato es el del ARCHIVO, no uno dibujado por la app');

/* Cambiar de Carta a Oficio solo cambia el ALTO de la hoja: ni una tabla se
   recalcula (lección del FPJ-5 v2.2 — recalcular anchos reintroduce cortes). */
const docOf = await generar(idCaso, 'verify_incautacion_oficio.docx', 'OFICIO');
const dxOf = docOf.partes['word/document.xml'].toString('utf8');
const gOf = geometria(dxOf);
log(difGeom(gDoc, gOf).join(',') === 'pgSz',
  '⚠️ En Oficio SOLO cambia el `pgSz`: ni una tabla se recalcula', difGeom(gDoc, gOf).join(',') || 'nada');
log(/w:w="12242" w:h="18722"/.test(gOf.pgSz), 'Con el desfase de 2 twips de la plantilla conservado', gOf.pgSz);

/* ══ D · MAPEO: NADA SE VUELVE A PEDIR ═════════════════════════════════════ */
console.log('\n── D · Los campos del formato salen del caso ──');

const m = await page.evaluate(() => aiMapa(DB.getCase('ai-uri')));
log(m.nunc === '0500160002062026', 'N° Caso: el NUNC del caso, leído con la misma función que el FPJ-6 y el FPJ-8', m.nunc);
log(m.depto === 'Antioquia' && m.muni === 'Medellín', 'Departamento y municipio, del lugar de la captura', m.depto + ' / ' + m.muni);
// ⚠️ «AAAA-MM-DD» por instrucción del usuario, y es el mismo formato del FPJ-8.
log(m.fechaCab === '2026-05-13', 'La fecha de la cabecera va en AAAA-MM-DD', m.fechaCab);
log(m.horaCasillas === '1425' && m.hora === '14:25', 'La hora, en sus cuatro casillas y en el renglón', m.horaCasillas);
log(m.ciudad === 'Medellín' && m.dia === '13' && m.mes === 'mayo' && m.ano === '2026',
  '«En la ciudad de … a los … del mes de … del …» sale de la fecha de la captura', `${m.dia}/${m.mes}/${m.ano}`);
log(m.capNombre === 'ROBINSON RAMÍREZ SALAZAR', 'Nombre del capturado, en mayúsculas como en los demás formatos', m.capNombre);
// ⚠️ Sin puntos, como manda la regla que ya rige todos los documentos.
log(m.capDoc === '1037949889', 'Número de identificación sin puntos', m.capDoc);
log(m.expEn === 'Medellín' && m.lugNac === 'Medellín' && m.escol === 'Bachiller' &&
    m.ecivil === 'Soltero' && m.ocup === 'Construcción' && m.padres === 'Mario y Rober' &&
    m.dirRes === 'CL 38B # 26 A-09 int 101' && m.tel === '3122681603',
  'Expedida en, natural de, estudio, estado civil, ocupación, padres, dirección y teléfono');
log(m.motivo === 'Captura', '⚠️ El motivo de la incautación es SIEMPRE «Captura» — regla del usuario', m.motivo);

/* El acta no le añade un solo campo al wizard: lo único que guarda son las
   observaciones y quién firma, que no existen en ninguna otra parte del caso. */
const claves = await page.evaluate(() => Object.keys(aiEstructura()));
log(claves.join(',') === 'capIdx,obs,firmante,updated',
  '⚠️ El modelo propio del acta son 4 claves: a quién, observaciones, quién firma y la marca', claves.join(','));
const wizIntacto = await page.evaluate(() =>
  [collectStep, wizSave, getWizConfig, startWizard].map(f => f.toString()).join('').indexOf('incautacion') < 0);
log(wizIntacto, 'El wizard no ganó ni un campo, ni un paso, ni una validación por este formato');

/* ⚠️ Consultar no puede ensuciar el caso: si leerlo creara la rama, el
   expediente dejaría el caso modificado con solo pintarse. */
const noMuta = await page.evaluate(() => {
  const c = DB.getCase('ai-uri');
  const antes = JSON.stringify(c);
  aiMapa(c); aiFaltantes(c); lcEstadoDocs(c);
  return JSON.stringify(c) === antes;
});
log(noMuta, '⚠️ Leer el acta NO muta el caso: solo la mutan abrir el formulario y guardarlo');

/* ══ E · LOS RENGLONES, ESCRITOS SOBRE LA LÍNEA ════════════════════════════ */
console.log('\n── E · La línea es del formato; el dato se escribe encima ──');

for (const frase of ['USO EXCLUSIVO POLICIA JUDICIAL', 'Nº CASO', 'No. Expediente CAD',
                     'Dpto.', 'Mpio', 'Ent', 'U. Receptora', 'Año', 'Consecutivo',
                     'ACTA DE INCAUTACION DE ELEMENTOS', 'Este formato será utilizado por Policía Judicial',
                     'Departamento', 'Municipio', 'Fecha', 'Hora:',
                     'En la ciudad de', 'del mes de', 'Siendo las', 'funcionario adscrito a',
                     'Proceder a incautarle al señor', 'identificado con CC.', 'Natural de',
                     'Grado de estudio', 'Estado civil', 'ocupación', 'Hijo de',
                     'Residente en dirección', 'Teléfono',
                     'LOS ELEMENTOS DE LAS SIGUIENTES CARACTERISTICAS ASI:',
                     'MOTIVO DE LA INCAUTACION', 'OBSERVACIONES:', 'Firmas:',
                     'Firma propietario o poseedor', 'Firma Policía', 'NOMBRE', 'CEDULA', 'CARGO'])
  log(txt.includes(frase), `Texto impreso del formato, intacto: «${frase}»`);
/* ⚠️ Incluida la errata: «Proceder a incautarle al señor» es agramatical y así
   está impresa. No se le corrige la redacción a un formato oficial. */

/* ⚠️ Los dígitos se leen de SUS CELDAS (26..46 del arreglo plano), no cortando
   el XML por el título: «ACTA DE INCAUTACION DE ELEMENTOS» viene partido en
   tres runs en la plantilla, así que buscarlo como cadena contigua devuelve −1
   y el corte se lleva el documento entero. */
const celdasDx = celdasDe(dx);
const digitos = celdasDx.slice(26, 47).map(c => runs(c).join('')).join('');
log(digitos === '0500160002062026', 'Los 16 dígitos del NUNC, uno por casilla', digitos);
/* ⚠️ Las 5 del Consecutivo quedan EN BLANCO: ese número lo asigna el SPOA y no
   se conoce en el sitio. Es la regla que ya rige en el FPJ-6 y en el FPJ-8. */
log(digitos.length === 16, '⚠️ Y las 5 del Consecutivo quedan en blanco: ese número lo asigna el SPOA');
const hCas = dx.slice(dx.indexOf('2026-05-13'), dx.indexOf('En la ciudad'));
log(runs(hCas).filter(t => /^\d$/.test(t)).join('') === '1425', 'La hora, en sus cuatro casillas', '1425');
/* ⚠️ El formato viene con un departamento y un municipio de MUESTRA
   («ANTIOQUIA», «MEDELLIN»). Se sobrescriben siempre con los del caso: un acta
   que nombra una jurisdicción que no es la del procedimiento es peor que una
   con el renglón vacío. */
const otroLugar = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-otro-lugar', lugar: { muni: 'Cali', depto: 'Valle del Cauca' } });
  await DB.saveCase(c); return 'ai-otro-lugar';
});
const txtOtro = texto((await generar(otroLugar, 'verify_incautacion_lugar.docx')).partes['word/document.xml'].toString('utf8'));
log(txtOtro.includes('VALLE DEL CAUCA') && txtOtro.includes('CALI') && !txtOtro.includes('ANTIOQUIA'),
  '⚠️ El departamento y el municipio de muestra del formato se SOBRESCRIBEN, no se heredan');

/* Los valores van subrayados sobre la línea, y detrás sigue la línea impresa. */
const valores = runs(dx);
log(valores.some(t => t === ' ROBINSON RAMÍREZ SALAZAR' || t === 'ROBINSON RAMÍREZ SALAZAR'),
  'Los valores se escriben en su propio run, sobre la línea del formato');
const subrayados = (dx.match(/<w:u w:val="single"\/>/g) || []).length;
log(subrayados >= 15, 'Y van subrayados: la línea queda debajo del dato, no borrada', subrayados + ' runs subrayados');
/* ⚠️ El RESTO del renglón se conserva con los caracteres del formato: así el
   renglón mide y salta de línea igual que en el archivo en blanco. */
log(valores.some(t => /^_+$/.test(t)) || valores.some(t => /_{2,}/.test(t)),
  '⚠️ El resto del renglón se conserva: no se sustituye por un relleno inventado');
/* ⚠️ Y el dato no queda soldado a la palabra que lo precede. */
log(!/a los\d/.test(txt) && !/adscrito a[A-ZÁÉÍÓÚ]/.test(txt) && !/señor[A-ZÁÉÍÓÚ]/.test(txt),
  '⚠️ Con su espacio de separación: nunca «a los26» ni «adscrito aPolicía»',
  (/a los \d+/.exec(txt) || ['—'])[0]);

/* ══ F · LOS ELEMENTOS ═════════════════════════════════════════════════════ */
console.log('\n── F · Los elementos del numeral 7 ──');

/* ⚠️ Se transcriben con la MISMA primitiva que los imprime en el informe: lo
   que dice el acta es palabra por palabra lo que dice el FPJ-5. */
const [lineasActa, lineasNum7] = await page.evaluate(() => {
  const c = DB.getCase('ai-uri');
  return [aiElementosLineas(c), lcEmpLineas(ccElementos(c))];
});
log(lineasActa.length === 3 && lineasNum7.length === 3, 'Los tres elementos llegan al acta', String(lineasActa.length));
log(lineasActa.every((l, i) => l === (i + 1) + '- ' + lineasNum7[i]),
  '⚠️ Palabra por palabra lo del numeral 7, con la numeración «1- », «2- » delante',
  lineasActa[0].slice(0, 42) + '…');
log(txt.includes('1- 02 (dos) cheques') && txt.includes('2- 01 (uno) celular') && txt.includes('3- 01 (uno) cuchillo'),
  'Y así salen impresos en el recuadro del acta');

/* Con UN solo elemento no se numera: «si hay más de un EMP y EF se coloca
   enumerados» — con uno solo va la línea a secas. */
const unaLinea = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-uno', elementos: [{ cant: 1, desc: 'machete' }] });
  await DB.saveCase(c);
  return aiElementosLineas(DB.getCase('ai-uno'));
});
log(unaLinea.length === 1 && unaLinea[0] === '01 (uno) machete',
  '⚠️ Con un solo elemento NO se numera: la numeración es para cuando hay varios', unaLinea[0]);

function filasRecuadro(xml) {
  const i = xml.indexOf('LOS ELEMENTOS DE LAS SIGUIENTES');
  const t = xml.slice(xml.indexOf('<w:tbl>', i), xml.indexOf('</w:tbl>', i));
  return (t.match(/<w:tr[ >]/g) || []).length;
}
log(filasRecuadro(dx) === 10, 'Con tres elementos el recuadro conserva sus diez renglones', String(filasRecuadro(dx)));
const doce = await page.evaluate(async () => {
  const els = []; for (let i = 1; i <= 12; i++) els.push({ cant: i, desc: 'elemento número ' + i });
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-doce', elementos: els });
  await DB.saveCase(c); return 'ai-doce';
});
const docDoce = await generar(doce, 'verify_incautacion_doce.docx');
const dxDoce = docDoce.partes['word/document.xml'].toString('utf8');
log(filasRecuadro(dxDoce) === 12, '⚠️ Con doce, el renglón se REPRODUCE: la lista nunca se recorta', String(filasRecuadro(dxDoce)));
log([...Array(12).keys()].every(i => texto(dxDoce).includes((i + 1) + '- ')),
  'Y los doce salen numerados del 1 al 12');
/* ⚠️ La fila reproducida hereda la geometría del formato: lo único que cambia
   respecto del original son las dos filas de más. */
const difDoce = difGeom(gTpl, geometria(dxDoce)).sort().join(',');
log(difDoce === 'celdas,filas,tcW,trHeight',
  '⚠️ Y la copia hereda la geometría: solo cambian el número de filas y de celdas', difDoce);

/* ══ G · QUIÉN FIRMA EL ACTA ═══════════════════════════════════════════════ */
console.log('\n── G · Perfil, compañero de patrulla u otro funcionario ──');

/* ⚠️ Un procedimiento lo hace una patrulla de DOS, y el acta la suscribe uno de
   los dos. Se resuelve con el MISMO resolutor que la cadena de custodia
   (`ccResolverOrigen`): dos criterios distintos acabarían nombrando a una
   persona en la cadena de custodia y a otra en el acta del mismo procedimiento. */
log(await page.evaluate(() => aiFirmanteDatos.toString().includes('ccResolverOrigen')),
  '⚠️ Reutiliza `ccResolverOrigen`, no un resolutor propio');
const fPerfil = await page.evaluate(() => aiFirmanteDatos({ origen: 'PERFIL' }));
log(fPerfil.nombre === 'NELSON DAVID DAVID' && fPerfil.cedula === '1035302775' &&
    fPerfil.cargo === 'Integrante Patrulla Vigilancia',
  'Por defecto firma el titular del perfil, con su cédula sin puntos y su cargo', fPerfil.nombre);
const fComp = await page.evaluate(() => aiFirmanteDatos({ origen: 'COMPANERO' }));
log(fComp.nombre === 'ANA MARÍA RESTREPO GIL' && fComp.cedula === '43567890',
  'El compañero de patrulla sale del perfil: no hay que reescribirlo', fComp.nombre);
const fOtro = await page.evaluate(() => aiFirmanteDatos({
  origen: 'OTRO', nombre: 'Carlos Andrés Muñoz Ríos', cedula: '71.234.567',
  entidad: 'CTI Fiscalía General de la Nación', cargo: 'Investigador criminalístico'
}));
log(fOtro.nombre === 'CARLOS ANDRÉS MUÑOZ RÍOS' && fOtro.cedula === '71234567' &&
    fOtro.entidad === 'CTI Fiscalía General de la Nación',
  'Y cualquier otro funcionario se teclea entero', fOtro.cargo);
/* ⚠️ Lo escrito a mano MANDA sobre el origen: así se corrige un cargo sin ir a
   cambiar el perfil. */
const fMix = await page.evaluate(() => aiFirmanteDatos({ origen: 'PERFIL', cargo: 'Comandante de patrulla' }));
log(fMix.nombre === 'NELSON DAVID DAVID' && fMix.cargo === 'Comandante de patrulla',
  '⚠️ Lo escrito a mano manda sobre lo que resuelve el origen', fMix.cargo);

/* La entidad es lo que el formato imprime en «funcionario adscrito a».
   ⚠️ NINGUNA INSTITUCIÓN ESTÁ ESCRITA EN EL CÓDIGO: sale del perfil del usuario
   —o, en su defecto, de la línea 2 del membrete del oficio—. Es la regla del
   filtro de Play Store, la misma de `cfg.nombreEstacion`. */
log(m.entidad === 'Institución de prueba', 'La entidad sale del perfil del usuario', m.entidad);
log(txt.includes('Institución de prueba'), 'Y se imprime en «el suscrito funcionario adscrito a»');
/* ⚠️ La entidad y el firmante AVISAN, pero no BLOQUEAN. Lo que bloquea son los
   datos del caso que hacen jurídicamente defectuosa el acta que va a firmar el
   capturado; estos dos se piden aquí mismo y, si se dejan en blanco, el formato
   imprime su renglón vacío para diligenciarlo a mano — que es lo que el formato
   en papel contempla. Bloquear dejaría sin documento a quien solo quiere
   imprimirlo. */
const sinPerfil = await page.evaluate(() => {
  const cfg = DB.getConfig(), g = cfg.perfiles; cfg.perfiles = []; DB.saveConfig(cfg);
  const c = DB.getCase('ai-uri');
  const r = { falta: aiFaltantes(c), avisa: aiAvisosFirmante(c) };
  const cfg2 = DB.getConfig(); cfg2.perfiles = g; DB.saveConfig(cfg2);
  return r;
});
log(sinPerfil.falta.length === 0,
  '⚠️ Sin perfil configurado el acta NO se bloquea: se genera con el renglón en blanco',
  sinPerfil.falta.join(' · ') || 'nada bloquea');
log(sinPerfil.avisa.length === 2,
  'Pero se avisa, para que el renglón en blanco no sea una sorpresa', sinPerfil.avisa.join(' y '));
/* ⚠️ Con límites de palabra: sin ellos, «CTI» engancha dentro de
   `ccPerfilActivo` y la prueba falla por su propia redacción, no por el código. */
const sinEntidadCodigo = await page.evaluate(() =>
  [aiEntidadDefecto, aiFirmanteDatos, aiMapa, buildActaIncautacionBlob, aiFirmanteHtml]
    .map(f => f.toString()).join('')
    .match(/Polic[ií]a Nacional|Fiscal[ií]a General|\bCTI\b|\bSIJIN\b|\bDIJIN\b|\bDIRAN\b/g));
log(sinEntidadCodigo === null,
  '⚠️ Y no hay ni un nombre de institución escrito en el código (filtro de Play Store)',
  sinEntidadCodigo ? sinEntidadCodigo.join(',') : 'ninguno');
const cascada = await page.evaluate(() => {
  const cfg = DB.getConfig(); const g = cfg.perfiles[0].entidad;
  cfg.perfiles[0].entidad = ''; cfg.ojInstitucion = 'Institución del membrete'; DB.saveConfig(cfg);
  const r = aiEntidadDefecto();
  cfg.perfiles[0].entidad = g; delete cfg.ojInstitucion; DB.saveConfig(cfg);
  return r;
});
log(cascada === 'Institución del membrete',
  'Sin entidad en el perfil cae a la línea 2 del membrete del oficio, que también la escribe el usuario', cascada);

/* Las tres firmas salen impresas en el bloque de firmas del formato. */
const conComp = await page.evaluate(async () => {
  const c = DB.getCase('ai-uri');
  c.incautacion = { capIdx: 0, obs: '', firmante: { origen: 'COMPANERO', nombre: '', cedula: '', entidad: '', cargo: '' }, updated: 1 };
  await DB.saveCase(c); return 'ai-uri';
});
const txtComp = texto((await generar(conComp, 'verify_incautacion_companero.docx')).partes['word/document.xml'].toString('utf8'));
log(txtComp.includes('NOMBRE: ANA MARÍA RESTREPO GIL') && txtComp.includes('C.C 43567890') &&
    txtComp.includes('CARGO : Patrullera'),
  '⚠️ Elegir al compañero cambia el bloque de firmas del documento, no solo la pantalla');
log(txtComp.includes('NOMBRE : ROBINSON RAMÍREZ SALAZAR') && txtComp.includes('CEDULA : 1037949889'),
  'La otra firma sigue siendo la del propietario o poseedor: la persona a la que se le incauta');
await page.evaluate(async () => {
  const c = DB.getCase('ai-uri'); c.incautacion = { capIdx: 0, obs: '', firmante: null, updated: 1 };
  await DB.saveCase(c);
});

/* ⚠️ El bloque de firmas no se parte entre dos hojas: los rótulos en una y los
   nombres en la siguiente. Medido en Word con una observación larga. */
log((dx.match(/<w:keepNext\/>/g) || []).length >= 5,
  '⚠️ `keepNext` mantiene «Firmas:» y los rótulos con la fila de nombres',
  (dx.match(/<w:keepNext\/>/g) || []).length + ' párrafos');

/* ══ H · EL DOCUMENTO TIENE QUE PODER EDITARSE ═════════════════════════════ */
console.log('\n── H · Editable: ni un solo lineRule="exact" ──');

/* ⚠️ «Exacto» fija el alto de la línea y Word RECORTA lo que no quepa. Mientras
   el párrafo está vacío no se nota; en cuanto el funcionario escribe ahí, su
   texto sale cortado por la mitad. Es el defecto que se corrigió en el oficio. */
for (const parte of ['word/document.xml', 'word/footer1.xml', 'word/footer2.xml']) {
  const x = doc.partes[parte].toString('utf8');
  log(!/lineRule="exact"/.test(x), `Sin lineRule="exact" en ${parte.replace('word/', '')}`);
}
/* ⚠️ Y ninguna fila con `hRule="exact"`, que recorta igual dentro de la tabla. */
log(!/hRule="exact"/.test(dx), 'Ni una fila con alto EXACTO: todas crecen con lo que se escriba');
/* ⚠️ El párrafo vacío del final se encoge, o Word abre una SEGUNDA HOJA en
   blanco solo para él en cuanto el recuadro de elementos crece. Se le baja el
   cuerpo a la MARCA de párrafo, no al texto: con texto vuelve a crecer. */
const cierre = dx.slice(dx.lastIndexOf('</w:tbl>'));
log(/<w:pPr>[\s\S]*?<w:rPr>[\s\S]*?<w:sz w:val="2"/.test(cierre),
  '⚠️ El párrafo final se encoge por su MARCA de párrafo: sin hoja en blanco y sigue editable');

/* ══ I · UN SOLO CUERPO DE LETRA ═══════════════════════════════════════════ */
console.log('\n── I · Cada dato al cuerpo del formato que lo rodea ──');

/* ⚠️ Un run sin `w:sz` propio no hereda el del bloque que lo rodea: hereda el
   del estilo por defecto, y el `Normal` de esta plantilla declara `sz 24` =
   12 pt. Es lo que sacaba el acta FPJ-6 a tres cuerpos distintos y el FPJ-5 a
   24 y 90 runs sobredimensionados.
   ⚠️ Aquí la exigencia NO puede ser «cero runs sin tamaño», como cuando la app
   DIBUJABA el acta: ahora la mayoría de los runs son los del formato, que no
   declaran ninguno y salen a los 12 pt de su propio estilo. Lo que se exige es
   lo que de verdad importa: **todo run que escribe la app declara el suyo**, y
   ni uno solo del formato se toca. Se mide POR DIFERENCIA contra la plantilla,
   igual que la regresión del FPJ-5. */
function runsConTexto(xml) {
  return [...xml.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)].map(r => {
    const t = [...r[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(a => a[1]).join('');
    return { t, sz: (/<w:sz w:val="(\d+)"/.exec(r[1]) || [])[1] || null, u: /<w:u /.test(r[1]) };
  }).filter(r => r.t.trim());
}
const rTpl = runsConTexto(tplDoc), rDoc = runsConTexto(dx);
const textosTpl = new Set(rTpl.map(r => r.t));
const formatoTxt = rTpl.map(r => r.t).join(' ');
const nuevos = rDoc.filter(r => !textosTpl.has(r.t));
/* ⚠️ Un run «nuevo» no siempre es un dato. Al escribir sobre un renglón, la
   línea del formato se parte —lo que se consume y lo que queda— y las dos
   mitades son texto DEL FORMATO con otro corte: los guiones bajos que sobran,
   « las », «Residente en   dirección». Esos NO llevan tamaño propio, y así tiene
   que ser: heredan el del formato, que es lo que se está conservando. Se
   distinguen porque su texto sigue siendo un trozo del texto de la plantilla. */
const trozoDelFormato = r => r.t.trim().length >= 2 && formatoTxt.includes(r.t);
const datos = nuevos.filter(r => !trozoDelFormato(r));
const sinSz = datos.filter(r => !r.sz);
log(sinSz.length === 0,
  '⚠️ Ni un solo DATO escrito por la app se queda sin `w:sz` propio',
  datos.length + ' runs de datos · ' + sinSz.length + ' sin tamaño' +
  (sinSz.length ? ' → ' + sinSz.map(r => JSON.stringify(r.t.slice(0, 24))).join(',') : ''));
const trozos = nuevos.filter(trozoDelFormato);
log(trozos.every(r => !r.sz),
  '⚠️ Y a los trozos del formato no se les toca el tamaño: siguen heredando el suyo',
  trozos.length + ' trozos, ninguno con `w:sz` propio');

/* Y los datos del CUERPO salen todos al mismo tamaño: el del formato que los
   rodea. Se miden los runs subrayados, que son exactamente los que la app
   escribe sobre los renglones. */
const szCuerpo = new Set(nuevos.filter(r => r.u).map(r => r.sz));
log(szCuerpo.size === 1 && [...szCuerpo][0] === '24',
  '⚠️ Todos los datos del cuerpo salen a 12 pt, que es el cuerpo del formato', [...szCuerpo].join('/'));
const szCasilla = new Set(celdasDx.slice(26, 47).concat(celdasDx.slice(64, 68))
  .map(c => (/<w:sz w:val="(\d+)"/.exec(c) || [])[1]).filter(Boolean));
log(szCasilla.size === 1 && [...szCasilla][0] === '22',
  'Los dígitos de las 21 casillas y de la hora, a 11 pt, como en el acta de derechos', [...szCasilla].join('/'));
const szCab = new Set([58, 60, 62].map(i => (/<w:sz w:val="(\d+)"/.exec(celdasDx[i]) || [])[1]).filter(Boolean));
log(szCab.size === 1 && [...szCab][0] === '20',
  'Y la fila de cabecera a 10 pt, como sus propias etiquetas', [...szCab].join('/'));
const szFirma = new Set(nuevos.filter(r => /^(NOMBRE|CEDULA|CARGO|C\.C)/.test(r.t)).map(r => r.sz));
log(szFirma.size === 1 && [...szFirma][0] === '22',
  'El bloque de firmas, a 11 pt — y en Tahoma, que es la letra que el formato usa ahí',
  [...szFirma].join('/'));
/* Las casillas de un carácter van centradas en los dos ejes, como a mano. */
log((dx.match(/<w:vAlign w:val="center"\/>/g) || []).length >= 25,
  'Las 21 casillas del N° Caso y las 4 de la hora, centradas en los dos ejes',
  (dx.match(/<w:vAlign w:val="center"\/>/g) || []).length + ' celdas');

/* ══ J · LO QUE NO SE INVENTA ══════════════════════════════════════════════ */
console.log('\n── J · Lo que se deja en blanco a propósito ──');

/* ⚠️ El acta se imprime para firmarse y estamparse a mano: escribir sobre esas
   líneas le quitaría el sitio a la firma. Misma regla que el acta de derechos. */
log(!/firma\.png/.test(dx) && !/<w:drawing>/.test(dx),
  '⚠️ La firma manuscrita del perfil NO se estampa aquí: en un acta firman las dos partes');
log(await page.evaluate(() => buildActaIncautacionBlob.toString().indexOf('lcFirmaDe') < 0),
  'Y el motor ni siquiera la busca: solo el oficio de puesta a disposición la lleva');
/* ⚠️ Se mide LA CASILLA, no el texto del documento: la fila de rótulos va justo
   debajo de la de dígitos, así que buscar «un número cerca de Expediente CAD»
   encontraría el propio NUNC y la prueba pasaría o fallaría por casualidad. */
const celdasDoc = celdasDe(dx);
log([18, 19, 20, 21, 22, 23, 24].every(i => runs(celdasDoc[i]).join('') === ''),
  '⚠️ Las 7 casillas del «No. Expediente CAD» van vacías: la app no conoce ese número');

/* Un dato que el caso no tiene queda EN BLANCO sobre su línea: ni se rellena
   con algo inventado, ni se omite el renglón. */
const pelado = await page.evaluate(async () => {
  const c = {
    id: 'ai-pelado', tipo: 'URI', nunc: '0500160002062026', fechaProc: '2026-05-13',
    lugar: { muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{ id: 'p9', rol: 'Capturado', tipoDoc: 'CC', numDoc: '999', priNom: 'Ana', priApe: 'Ruiz' }],
    elementos: [{ cant: 1, desc: 'machete' }],
    narracion: { fechaCapD: '13', fechaCapM: '05', fechaCapA: '2026', horaCapH: '14', horaCapM: '25' }
  };
  await DB.saveCase(c); return 'ai-pelado';
});
const docPelado = await generar(pelado, 'verify_incautacion_pelado.docx');
const dxPelado = docPelado.partes['word/document.xml'].toString('utf8');
const txtPelado = texto(dxPelado);
log(['Natural de', 'Grado de estudio', 'Estado civil', 'ocupación', 'Hijo de',
     'Residente en dirección', 'Teléfono'].every(t => txtPelado.includes(t)),
  '⚠️ Sin esos datos, los renglones se imprimen IGUAL, en blanco: no se omite ninguno');
log(!/N\/A|undefined|null/.test(txtPelado), 'Y sin rellenos inventados', 'sin N/A ni undefined');
log(difGeom(gTpl, geometria(dxPelado)).length === 0,
  'Su geometría también es la del formato, sin una sola diferencia');

/* Terminología: un menor lleva T.I., y el renglón impreso lo dice. Es el mismo
   criterio con el que el acta de derechos cambia C.C. por T.I. */
const menorTxt = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-menor', tipo: 'CESPA' });
  c.capturados = [Object.assign({}, c.capturados[0], { tipoDoc: 'TI' })];
  await DB.saveCase(c);
  return aiMapa(DB.getCase('ai-menor')).tipoDoc;
});
log(menorTxt === 'TI', 'El tipo de documento se flexiona con la persona', menorTxt);
const docMenor = await generar('ai-menor', 'verify_incautacion_menor.docx');
const txtMenor = texto(docMenor.partes['word/document.xml'].toString('utf8'));
log(txtMenor.includes('identificado con TI.') && !txtMenor.includes('identificado con CC.'),
  '⚠️ A un menor no se le anota su T.I. sobre un renglón rotulado C.C.');
log(difGeom(gTpl, geometria(docMenor.partes['word/document.xml'].toString('utf8'))).length === 0,
  'Y cambiar la etiqueta no mueve una sola medida del formato');

/* ══ K · FORMULARIO, PERSISTENCIA E INVITADO ═══════════════════════════════ */
console.log('\n── K · Formulario, persistencia y modo invitado ──');

await page.evaluate(() => go('capturas'));
await page.waitForTimeout(200);
await page.evaluate(id => abrirActaIncautacion(id), idCaso);
await page.waitForTimeout(400);
log(await page.isVisible('#ai-obs'), 'El formulario del acta abre desde el expediente');
log(await page.isVisible('#ai-fun-origen'), 'Y pregunta quién firma, con sus tres salidas');
const opciones = await page.$$eval('#ai-fun-origen option', els => els.map(e => e.value));
log(opciones.join(',') === 'PERFIL,COMPANERO,OTRO',
  'Titular del perfil, compañero de patrulla u otro funcionario', opciones.join(' · '));
const prev = await page.$$eval('.lc-emp-l', els => els.map(e => e.textContent.trim()));
log(prev.length === 3 && prev[0].startsWith('1- '),
  'Enseña los elementos ya numerados, como van a salir', prev.length + ' líneas');

/* Cambiar de origen repinta SOLO el bloque de la firma: si repintara el modal
   entero, se perdería lo que se esté escribiendo en las observaciones. */
await page.fill('#ai-obs', 'Los elementos quedan a disposición del despacho.');
await page.selectOption('#ai-fun-origen', 'COMPANERO');
await page.waitForTimeout(250);
log(await page.inputValue('#ai-obs') === 'Los elementos quedan a disposición del despacho.',
  '⚠️ Cambiar de firmante no borra lo que se está escribiendo en las observaciones');
log((await page.inputValue('#ai-fun-nom')).toUpperCase().includes('ANA MARÍA'),
  'Y trae los datos del compañero', await page.inputValue('#ai-fun-nom'));
await page.selectOption('#ai-fun-origen', 'PERFIL');
await page.waitForTimeout(250);

await page.evaluate(() => closeModal());
await page.waitForTimeout(400);
const guardado = await page.evaluate(() => DB.getCase('ai-uri').incautacion || {});
log(guardado.obs === 'Los elementos quedan a disposición del despacho.',
  'Cerrar el modal guarda las observaciones: no se pierden por cerrar', guardado.obs);
log(!!guardado.firmante && guardado.firmante.origen === 'PERFIL',
  'Y guarda quién firma, para que el acta se reimprima igual meses después', guardado.firmante && guardado.firmante.origen);
const docObs = await generar(idCaso, 'verify_incautacion_obs.docx');
log(texto(docObs.partes['word/document.xml'].toString('utf8')).includes('Los elementos quedan a disposición del despacho.'),
  'Y salen impresas sobre los renglones de OBSERVACIONES');

/* Una observación larga ocupa lo que haga falta: lo que no cabe NO se descarta
   —es la familia de fallo de los EMP que nunca se imprimían—. */
const larga = await page.evaluate(async () => {
  const c = DB.getCase('ai-uri');
  c.incautacion.obs = ('Se deja constancia de que los elementos fueron incautados en presencia del capturado ' +
    'y de dos testigos, quienes suscriben el acta, y de que ninguno presentó objeción alguna al procedimiento ' +
    'ni al inventario levantado en el sitio de los hechos.');
  await DB.saveCase(c); return c.incautacion.obs;
});
const docLargo = await generar(idCaso, 'verify_incautacion_obs_largo.docx');
const txtLargo = texto(docLargo.partes['word/document.xml'].toString('utf8'));
const faltantesObs = larga.split(/\s+/).filter(w => !txtLargo.includes(w));
log(faltantesObs.length === 0, '⚠️ Una observación larga no pierde una sola palabra',
  `${larga.split(/\s+/).length} palabras · faltan ${faltantesObs.length}`);
log(difGeom(gTpl, geometria(docLargo.partes['word/document.xml'].toString('utf8'))).length === 0,
  'Y tampoco mueve la geometría del formato');

/* La entidad se pregunta UNA vez: si el perfil no la tiene y se escribe aquí,
   queda como valor por defecto del equipo (mismo criterio que el membrete). */
const recordada = await page.evaluate(() => {
  const cfg = DB.getConfig(); const g = cfg.perfiles[0].entidad;
  cfg.perfiles[0].entidad = ''; DB.saveConfig(cfg);
  aiRecordarEntidad(DB.getCase('ai-uri'), 'Institución escrita en el acta');
  const r = (DB.getConfig().perfiles[0] || {}).entidad;
  const cfg2 = DB.getConfig(); cfg2.perfiles[0].entidad = g; DB.saveConfig(cfg2);
  return r;
});
log(recordada === 'Institución escrita en el acta',
  'La entidad escrita en el acta queda en el perfil: se pregunta una vez', recordada);
/* ⚠️ Un caso de demostración NO reconfigura la app (lección del simulador). */
const noTest = await page.evaluate(() => {
  const cfg = DB.getConfig(); const g = cfg.perfiles[0].entidad;
  cfg.perfiles[0].entidad = ''; DB.saveConfig(cfg);
  aiRecordarEntidad({ id: 'x', isTest: true }, 'Institución de un caso simulado');
  const r = (DB.getConfig().perfiles[0] || {}).entidad;
  const cfg2 = DB.getConfig(); cfg2.perfiles[0].entidad = g; DB.saveConfig(cfg2);
  return r;
});
log(noTest === '', '⚠️ Y un caso de demostración no reconfigura el perfil del usuario', noTest || '(vacío)');

/* Modo invitado: no se escribe un solo byte en localStorage. */
const invitado = await page.evaluate(async () => {
  const antes = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, (localStorage[k] || '').length]));
  _guest = true;
  const c = DB.getCase('ai-uri');
  if (c) { c.incautacion = { capIdx: 0, obs: 'prueba invitado', firmante: null, updated: 1 }; await DB.saveCase(c); }
  const despues = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, (localStorage[k] || '').length]));
  _guest = false;
  return antes === despues;
});
log(invitado, 'En modo invitado el acta no escribe un byte en localStorage');

log(errores.length === 0, 'Consola sin errores', errores.slice(0, 3).join(' | ') || 'limpia');

console.log(`\n${'─'.repeat(58)}`);
console.log(fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n}/${n} comprobaciones en verde`);
console.log(`Documentos en: ${SALIDA}`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
