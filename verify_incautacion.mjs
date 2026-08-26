/* Regresión del «Acta de incautación de elementos».

   ⚠️ ESTE FORMATO ES EL ÚNICO QUE LA APP DIBUJA. Los otros cuatro llegaron como
   archivo —el FPJ-5 y el FPJ-6 como .docx que se rellenan por índice de celda,
   el FPJ-7 y el FPJ-8 como PDF que se estampan— y en todos ellos la maquetación
   ES el archivo oficial. De este solo existe la fotografía de un acta
   diligenciada a mano, así que el documento lo compone la app en OOXML. Eso
   cambia qué hay que comprobar: no se puede medir «el original sigue intacto»,
   porque no hay original. Se mide lo que sí se puede exigir:

     A. Arquitectura — el registro de documentos, el expediente y el menú.
     B. Mapeo — los 17 campos del formato salen del caso; nada se vuelve a pedir.
     C. El documento — sus cuatro bloques, casilla por casilla.
     D. Los elementos: transcritos del numeral 7 y numerados como se pidió.
     E. Editable — ni un `lineRule="exact"`, que RECORTA lo que se escriba.
     F. Dentro del subconjunto del PDF — por eso este formato sí admite PDF.
     G. Un solo cuerpo de letra para todo lo que rellena la app.
     H. Lo que NO se inventa: firmas, huella, expediente CAD, consecutivo.
     I. Persistencia, modo invitado y consola limpia.

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
   EBUSY antes de comprobar nada — le pasó a verify_fpj6 y volvió a pasar aquí.
   Un directorio por corrida hace que ese bloqueo no pueda estorbar nunca. */
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

/* Lector de .docx. ⚠️ `_buildZip` escribe STORED (sin compresión), así que las
   partes se leen directo del archivo sin inflar — igual que hace `unzipDocx`
   dentro de la app. */
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
const texto = xml => xml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/* Todo el texto de un `w:t`, en orden de documento.
   ⚠️ El nombre del elemento tiene que terminar aquí: `<w:t[^>]*>` engancha
   también `<w:tblPr>`, `<w:tcPr>` y `<w:trPr>`, y entonces cada tabla devuelve
   un «texto» de varios miles de caracteres de XML. */
const runs = xml => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]);
// Las filas de una tabla, y las celdas de una fila.
const filas = tbl => [...tbl.matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)].map(m => m[1]);
const celdas = tr => [...tr.matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map(m => m[1]);

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
log(await page.evaluate(() => LC_DOCS.INCAU.soloWord !== true && LC_DOCS.INCAU.esPDF !== true),
  'No es «soloWord» ni «esPDF»: la compone la app, así que sí puede salir en PDF');
log(await page.evaluate(() => LC_DOCS.INCAU.anchoFijo === true && lcPapelesDe('INCAU').join(',') === 'CARTA,OFICIO'),
  '⚠️ anchoFijo: solo se le ofrecen tamaños de 8,5" — sus 21 casillas son geometría del formulario',
  await page.evaluate(() => lcPapelesDe('INCAU').join(',')));
log(await page.evaluate(() => lcExportSoloWord('FPJ') === true && lcExportSoloWord('OJ') === false && LC_DOCS.FPJ8.esPDF === true),
  'El registro no cambió lo que ya regía para los otros cuatro formatos');

await page.evaluate(() => lcGuardarPapel('OFICIO'));

/* ── Caso sembrado ── */
const idCaso = await page.evaluate(async ({ e1, e2, e3 }) => {
  const cfg = DB.getConfig();
  cfg.nuncUri = '0500160002062026';
  cfg.nombreEstacion = 'CANDELARIA';
  cfg.perfiles = [{ id: 'pf-1', grado: 'Subintendente', nombre: 'JUAN CARLOS CONTRERAS', cedula: '1.035.302.775',
    cargo: 'Integrante de patrulla', entidad: 'Institución de prueba', correo: 'x@prueba.test' }];
  cfg.perfilActivo = 'pf-1';
  DB.saveConfig(cfg);
  const c = {
    id: 'ai-uri', tipo: 'URI', nunc: '0500160002062026', fechaProc: '2026-05-13',
    conductas: ['Hurto calificado y agravado'],
    lugar: { dir: 'CL 52 # 50-31', barrio: 'La Candelaria', muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{ id: 'per-1', rol: 'Capturado', tipoDoc: 'CC', numDoc: '1.037.949.889', expEn: 'Medellín',
      priNom: 'Robinson', priApe: 'Ramírez', segApe: 'Salazar', lugNac: 'Medellín',
      escol: 'Bachiller', ecivil: 'Soltero', ocup: 'Construcción', padres: 'Mario y Rober',
      dirRes: 'CL 38B # 26 A-09 int 101', tel: '3122681603' }],
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
log(items.length === 5, 'El menú de la captura sigue en 5 ítems: no creció con este formato', items.join(' · '));
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

const sinEmp = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-vacio', elementos: [], narracion: { emp: '' } });
  await DB.saveCase(c);
  return lcEstadoDocs(DB.getCase('ai-vacio')).find(d => d.lbl === 'Acta de incautación').falta.join('|');
});
log(/EMP/.test(sinEmp), 'Sin EMP registrados dice qué falta, en vez de ofrecer un acta en blanco', sinEmp);

/* ══ B · MAPEO: NADA SE VUELVE A PEDIR ═════════════════════════════════════ */
console.log('\n── B · Los campos del formato salen del caso ──');

const m = await page.evaluate(() => aiMapa(DB.getCase('ai-uri')));
log(m.nunc === '0500160002062026', 'N° Caso: el NUNC del caso, leído con la misma función que el FPJ-6 y el FPJ-8', m.nunc);
log(m.depto === 'Antioquia' && m.muni === 'Medellín', 'Departamento y municipio, del lugar de la captura', m.depto + ' / ' + m.muni);
// ⚠️ «AAAA-MM-DD» por instrucción del usuario, y es el mismo formato del FPJ-8.
log(m.fechaCab === '2026-05-13', 'La fecha de la cabecera va en AAAA-MM-DD', m.fechaCab);
log(m.horaCasillas === '1425' && m.hora === '14:25', 'La hora, en sus cuatro casillas y en el renglón', m.horaCasillas);
log(m.ciudad === 'Medellín' && m.dia === '13' && m.mes === 'mayo' && m.ano === '2026',
  '«En la ciudad de … a los … del mes de … del …» sale de la fecha de la captura', `${m.dia}/${m.mes}/${m.ano}`);
log(/Candelaria/i.test(m.unidad), 'La unidad del funcionario, del punto único que ya usan el oficio y el dossier', m.unidad);
log(m.capNombre === 'ROBINSON RAMÍREZ SALAZAR', 'Nombre del capturado, en mayúsculas como en los demás formatos', m.capNombre);
// ⚠️ Sin puntos, como manda la regla que ya rige todos los documentos.
log(m.capDoc === '1037949889', 'Número de identificación sin puntos', m.capDoc);
log(m.expEn === 'Medellín' && m.lugNac === 'Medellín' && m.escol === 'Bachiller' &&
    m.ecivil === 'Soltero' && m.ocup === 'Construcción' && m.padres === 'Mario y Rober' &&
    m.dirRes === 'CL 38B # 26 A-09 int 101' && m.tel === '3122681603',
  'Expedida en, natural de, estudio, estado civil, ocupación, padres, dirección y teléfono');
log(m.motivo === 'Captura', '⚠️ El motivo de la incautación es SIEMPRE «Captura» — regla del usuario', m.motivo);
log(m.funNombre === 'JUAN CARLOS CONTRERAS' && m.funCargo === 'Integrante de patrulla',
  'Nombre y cargo de quien firma por la policía, del perfil activo');

/* El acta no le añade un solo campo al wizard: lo único que guarda son las
   observaciones, que no existen en ninguna otra parte del caso. */
const claves = await page.evaluate(() => Object.keys(aiEstructura()));
log(claves.join(',') === 'capIdx,obs,updated',
  '⚠️ El modelo propio del acta son 3 claves: a quién, las observaciones y la marca', claves.join(','));
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

/* ══ C · EL DOCUMENTO ══════════════════════════════════════════════════════ */
console.log('\n── C · El .docx generado ──');

async function generar(id, nombre, papel) {
  const b64 = await page.evaluate(async ({ id, papel }) => {
    const out = buildActaIncautacionBlob({ caso: DB.getCase(id) }, papel || 'CARTA');
    if (!out) return null;
    const buf = new Uint8Array(await out.blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    return { b64: btoa(s), fname: out.fname, label: out.label, papel: out.papel, noPDF: !!out.noPDF };
  }, { id, papel });
  if (!b64) return null;
  const buf = Buffer.from(b64.b64, 'base64');
  await writeFile(join(SALIDA, nombre), buf);
  return { ...b64, buf, partes: leerDocx(buf) };
}

const doc = await generar(idCaso, 'verify_incautacion.docx');
log(!!doc, 'El acta se genera', doc && doc.fname);
const dx = doc.partes['word/document.xml'].toString('utf8');
const txt = texto(dx);

log(!!doc.partes['[Content_Types].xml'] && !!doc.partes['word/styles.xml'] &&
    !!doc.partes['word/settings.xml'] && !!doc.partes['word/footer1.xml'] && !!doc.partes['word/fontTable.xml'],
  'El paquete trae sus partes obligatorias', Object.keys(doc.partes).length + ' partes');

/* ⚠️ El escudo va en el CUERPO (la casilla del título), así que su relación
   vive en document.xml.rels — no en un header*.xml.rels como en el oficio. */
const rels = doc.partes['word/_rels/document.xml.rels'].toString('utf8');
const escudoParte = Object.keys(doc.partes).find(k => /^word\/media\/escudo\./.test(k));
log(!!escudoParte && /rId5"[^>]*image/.test(rels) && new RegExp('r:embed="rId5"').test(dx),
  'El escudo se embebe, se declara y se referencia — sin relación rota', escudoParte);
log(/<Default Extension="jpeg"/.test(doc.partes['[Content_Types].xml'].toString('utf8')),
  'Su extensión está declarada en [Content_Types].xml, una sola vez');

/* ⚠️ EL ESCUDO ES EL DE COLOMBIA, NO EL DE LA POLICÍA. Este es un formato de
   Policía Judicial y lleva el escudo nacional, igual que los de la Fiscalía. Se
   comprueba por IDENTIDAD, no de vista: tiene que ser byte a byte el mismo que
   trae `TPL_FPJ6` —la plantilla oficial del acta de derechos que la app ya
   embebe— y NO el `OJ_LOGO_B64`, que es el escudo de la Policía Nacional del
   membrete del oficio. Así no se añade una sola imagen al repositorio. */
const escudo = await page.evaluate(() => {
  const partes = unzipDocx(TPL_FPJ6);
  let dela = '';
  for (const k in partes) if (/^word\/media\//.test(k)) { dela = _b64FromBytes(partes[k]); break; }
  return { acta: aiCfgDoc()._escudoB64, plantilla: dela, policia: OJ_LOGO_B64 };
});
log(!!escudo.acta && escudo.acta === escudo.plantilla,
  '⚠️ Es byte a byte el escudo de Colombia de la plantilla oficial del FPJ-6',
  escudo.acta.length + ' car. de base64');
log(escudo.acta !== escudo.policia,
  '⚠️ Y NO es OJ_LOGO_B64, que es el escudo de la POLICÍA del membrete del oficio');
log(Buffer.from(escudo.acta, 'base64').equals(doc.partes[escudoParte]),
  'El que viaja dentro del .docx es exactamente ese');
/* Y el logo de unidad que el usuario haya cargado en Ajustes NO lo sustituye:
   el escudo es del FORMATO, no del equipo. */
const noPisa = await page.evaluate(() => {
  const cfg = DB.getConfig(); cfg.ojLogoB64 = 'AAAA'; cfg.ojLogoMime = 'image/png'; DB.saveConfig(cfg);
  const r = aiCfgDoc()._escudoB64;
  delete cfg.ojLogoB64; delete cfg.ojLogoMime; DB.saveConfig(cfg);
  return r;
});
log(noPisa === escudo.plantilla,
  '⚠️ El logo de la unidad (Ajustes) no lo pisa: el escudo es del formato, no del equipo');

/* ── El recuadro que encierra el formato ── */
const sectPr = dx.slice(dx.lastIndexOf('<w:sectPr>'));
log(/<w:pgBorders w:offsetFrom="text">/.test(sectPr),
  '⚠️ El formato va encerrado en un RECUADRO — es lo que lo hace un formulario y no una carta');
log(['top', 'left', 'bottom', 'right'].every(l => new RegExp('<w:' + l + ' w:val="single"').test(sectPr)),
  'Los cuatro lados', (sectPr.match(/w:space="(\d+)"/g) || []).join(' '));
/* ⚠️ El lado inferior lleva MÁS separación que los otros tres, y no es un
   descuido: es lo que deja el pie del formato DENTRO del recuadro. La cuenta se
   hace con los valores REALES del documento, en distancias al borde de la hoja:
     · el texto acaba a `pgMar/bottom`
     · la línea del marco cae a `pgMar/bottom − space` (space va en puntos)
     · el pie se apoya a `pgMar/footer`
   Para que el pie quede dentro, la línea tiene que caer POR DEBAJO de él, o sea
   más cerca del borde: `pgMar/bottom − space·20 < footer`. */
const espAbajo = +(/<w:bottom w:val="single"[^>]*w:space="(\d+)"/.exec(sectPr) || [])[1];
const espLado = +(/<w:left w:val="single"[^>]*w:space="(\d+)"/.exec(sectPr) || [])[1];
const marBot = +(/w:bottom="(\d+)"/.exec(sectPr) || [])[1];
const marFoot = +(/w:footer="(\d+)"/.exec(sectPr) || [])[1];
const lineaMarco = marBot - espAbajo * 20;
log(espAbajo > espLado && lineaMarco < marFoot,
  '⚠️ El lado de abajo se separa lo justo para que el pie quede DENTRO del recuadro',
  `marco a ${lineaMarco} tw del borde · pie a ${marFoot} tw · lados ${espLado} pt`);

const tablas = (dx.match(/<w:tbl>/g) || []).length;
log(tablas === 4, 'Cuatro tablas: N° Caso, título, recuadro de elementos y firmas', String(tablas));
log((dx.match(/<w:gridCol /g) || []).length === 22 + 11 + 1 + 3,
  'Y su rejilla es la del formato: 22 + 11 + 1 + 3 columnas',
  String((dx.match(/<w:gridCol /g) || []).length));

/* — El N° CASO, dígito por dígito en sus 21 casillas — */
const cabecera = runs(dx.slice(0, dx.indexOf('ACTA DE INCAUTACION')));
const digitos = cabecera.filter(t => /^\d$/.test(t)).join('');
log(digitos === '0500160002062026', 'Los 16 dígitos del NUNC, uno por casilla', digitos);
/* ⚠️ Las 5 del Consecutivo quedan EN BLANCO: ese número lo asigna el SPOA y no
   se conoce en el sitio. Es la regla que ya rige en el FPJ-6 y en el FPJ-8. */
log(digitos.length === 16, '⚠️ Y las 5 del Consecutivo quedan en blanco: ese número lo asigna el SPOA');
log(['Dpto.', 'Mplo', 'Ent', 'U. Receptora', 'Año', 'Consecutivo'].every(r => txt.includes(r)),
  'Los seis rótulos del N° Caso, con sus anchos de grupo');
log(txt.includes('USO EXCLUSIVO POLICIA JUDICIAL') && txt.includes('Nº CASO') && txt.includes('No. Expediente CAD'),
  'Los tres rótulos de la cabecera');

/* — Título y fila de cabecera — */
log(txt.includes('ACTA DE INCAUTACION DE ELEMENTOS') &&
    txt.includes('Este formato será utilizado por Policía Judicial'),
  'El título y su subtítulo, literales');
log(txt.includes('Antioquia') && txt.includes('Medellín') && txt.includes('2026-05-13'),
  'Departamento, municipio y fecha en la fila de cabecera');
const hCas = dx.slice(dx.indexOf('2026-05-13'), dx.indexOf('En la ciudad'));
log(runs(hCas).filter(t => /^\d$/.test(t)).join('') === '1425', 'La hora, en sus cuatro casillas', '1425');

/* — Los renglones, con la redacción del formato — */
for (const frase of ['En la ciudad de', 'del mes de', 'Siendo las', 'horas el suscrito funcionario adscrito a',
                     'Proceder a', 'incautar al señor', 'identificado con CC.', 'Natural de',
                     'Grado de estudio', 'Estado civil', 'ocupación', 'Hijo de',
                     'Residente en dirección', 'Teléfono',
                     'LOS ELEMENTOS DE LAS SIGUIENTES CARACTERISTICAS ASI:',
                     'MOTIVO DE LA INCAUTACION', 'OBSERVACIONES:', 'Firmas:',
                     'Firma propietario o poseedor', 'Firma Policía', 'NOMBRE:', 'CEDULA:', 'CARGO:'])
  log(txt.includes(frase), `Renglón del formato presente: «${frase}»`);
log(texto(doc.partes['word/footer1.xml'].toString('utf8')).includes('Versión 18/11/05'),
  'El pie lleva la versión del formato', 'Versión 18/11/05');
log(/Hoja No\./.test(doc.partes['word/footer1.xml'].toString('utf8')) &&
    /PAGE/.test(doc.partes['word/footer1.xml'].toString('utf8')) &&
    /NUMPAGES/.test(doc.partes['word/footer1.xml'].toString('utf8')),
  '«Hoja No. N de M» son campos de Word, no un número escrito a mano');

/* — Los valores, sobre su línea — */
const nbsp = '\u00A0';
log(runs(dx).some(t => t.startsWith('ROBINSON RAMÍREZ SALAZAR') && t.includes(nbsp)),
  '⚠️ Los valores van SOBRE LA LÍNEA: subrayado prolongado con espacios DUROS');
log(!runs(dx).some(t => /_{3,}/.test(t)),
  '⚠️ Y no con guiones bajos: con ellos, cada letra que se teclee empuja un guion');
const subrayados = (dx.match(/<w:u w:val="single"\/>/g) || []).length;
log(subrayados >= 15, 'Todos los renglones diligenciables llevan su línea', subrayados + ' runs subrayados');

/* ══ D · LOS ELEMENTOS ═════════════════════════════════════════════════════ */
console.log('\n── D · Los elementos del numeral 7 ──');

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

/* El recuadro trae los ocho renglones del formato aunque sobren, y crece si
   hacen falta más — nunca se recorta la lista. */
function filasRecuadro(xml) {
  const i = xml.indexOf('LOS ELEMENTOS DE LAS SIGUIENTES');
  const t = xml.slice(xml.indexOf('<w:tbl>', i), xml.indexOf('</w:tbl>', i));
  return (t.match(/<w:tr>/g) || []).length;
}
log(filasRecuadro(dx) === 8, 'Con tres elementos el recuadro conserva sus ocho renglones', String(filasRecuadro(dx)));
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

/* ══ E · EL DOCUMENTO TIENE QUE PODER EDITARSE ═════════════════════════════ */
console.log('\n── E · Editable: ni un solo lineRule="exact" ──');

/* ⚠️ «Exacto» fija el alto de la línea y Word RECORTA lo que no quepa. Mientras
   el párrafo está vacío no se nota; en cuanto el funcionario escribe ahí, su
   texto sale cortado por la mitad. Es el defecto que se corrigió en el oficio. */
for (const parte of ['word/document.xml', 'word/footer1.xml']) {
  const x = doc.partes[parte].toString('utf8');
  log(!/lineRule="exact"/.test(x), `Sin lineRule="exact" en ${parte.replace('word/', '')}`);
}
log((dx.match(/w:lineRule="atLeast"/g) || []).length > 20,
  'El alto se consigue con «mínimo»: vacío mide igual y con texto CRECE',
  (dx.match(/w:lineRule="atLeast"/g) || []).length + ' párrafos');
/* Y el cuerpo no termina en tabla: Word añadiría un párrafo implícito y saldría
   una página en blanco al final. */
log(/<\/w:tbl>\s*<w:p>[\s\S]*?<\/w:p>\s*<w:sectPr>/.test(dx),
  '⚠️ El cuerpo no termina en <w:tbl>: si no, sale una página en blanco al final');

/* ══ F · DENTRO DEL SUBCONJUNTO DEL PDF ════════════════════════════════════ */
console.log('\n── F · Por qué este formato sí admite PDF ──');

/* ⚠️ El FPJ-5 y el FPJ-6 se quedaron en solo-Word porque sus plantillas usan
   construcciones que el traductor OOXML→HTML no implementa. Este documento lo
   compone la app, así que puede —y debe— mantenerse fuera de todas ellas. */
for (const [ctor, nombre] of [['w:trHeight', 'altos de fila fijos'], ['w:vMerge', 'celdas fusionadas'],
                              ['w:noWrap', 'no-wrap'], ['w:tblHeader', 'encabezado repetido'],
                              ['w:numPr', 'listas automáticas'], ['w:tab', 'tabuladores']]) {
  const x = dx + doc.partes['word/footer1.xml'].toString('utf8');
  log(!new RegExp('<' + ctor).test(x), `Sin ${nombre} (<${ctor}>), que el traductor no reproduce`);
}
const plan = await page.evaluate(async id => {
  const out = buildActaIncautacionBlob({ caso: DB.getCase(id) }, 'CARTA');
  const p = lcPrintDoc(out);
  return p ? { paginas: p.bloques ? p.bloques.length : 0, ok: true } : { ok: false };
}, idCaso);
log(plan.ok, 'La vista de impresión traduce el mismo document.xml del .docx');

/* ⚠️ El recuadro tiene que salir TAMBIÉN en el PDF. Si el .docx lo llevara y la
   vista no, los dos formatos del mismo documento se verían distintos — que es
   exactamente la divergencia que la regla de exportación prohíbe. */
const marcoPdf = await page.evaluate(id => {
  const out = buildActaIncautacionBlob({ caso: DB.getCase(id) }, 'CARTA');
  const p = lcPrintDoc(out);
  return { marco: p.marco, css: lcPrintCss(p.papel, p.M, p.marco).indexOf('.pg::before') >= 0 };
}, idCaso);
log(!!marcoPdf.marco && marcoPdf.css,
  '⚠️ Y el recuadro también se dibuja en la vista de impresión: .docx y PDF no divergen',
  marcoPdf.marco ? `${marcoPdf.marco.grosor}px · top ${Math.round(marcoPdf.marco.top)}px · bottom ${Math.round(marcoPdf.marco.bottom)}px` : 'sin marco');
log(!!marcoPdf.marco && marcoPdf.marco.bottom < marcoPdf.marco.top,
  'Con el mismo criterio del .docx: la línea de abajo cae más cerca del borde, para dejar el pie dentro');

/* La vista no puede perder una palabra: es la regla del recorte silencioso. */
const cotejo = await page.evaluate(async id => {
  const out = buildActaIncautacionBlob({ caso: DB.getCase(id) }, 'CARTA');
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(out.files['word/document.xml']), 'application/xml');
  const ts = [...doc.getElementsByTagName('w:t')].map(t => t.textContent).join(' ');
  const pal = ts.replace(/\u00A0/g, ' ').split(/\s+/).filter(w => /\w/.test(w));
  const plan = lcPrintDoc(out);
  const html = (plan.bloques || []).map(b => b.html).join(' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const faltan = pal.filter(w => html.indexOf(w) < 0);
  return { total: pal.length, faltan: faltan.slice(0, 5), nFaltan: faltan.length };
}, idCaso);
log(cotejo.nFaltan === 0, 'Y no pierde una sola palabra del .docx',
  `${cotejo.total} palabras · faltan ${cotejo.nFaltan}` + (cotejo.nFaltan ? ' → ' + cotejo.faltan.join(',') : ''));

/* ⚠️ EL ACTA DE PAPEL ES UNA HOJA, y esa es la comprobación que ninguna medida
   del XML da: hay que PAGINAR. Se monta el mismo iframe que arma `lcImprimir` y
   se llama al `lcPaginar` de verdad —sin disparar el diálogo de impresión—, así
   la cuenta es la de la app y no una réplica.
   Se mide contra Word: los mismos cinco documentos dan 1 página en Word real. */
await page.evaluate(() => {
  window._lcPaginas = function (out) {
    var plan = lcPrintDoc(out);
    if (!plan) return null;
    var vieja = document.getElementById('lc-test-frame'); if (vieja) vieja.remove();
    var f = document.createElement('iframe');
    f.id = 'lc-test-frame';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0';
    document.body.appendChild(f);
    var d = f.contentDocument;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><style>' + lcPrintCss(plan.papel, plan.M, plan.marco) +
      '</style></head><body><div id="medidor" style="position:absolute;left:-99999px;top:0;visibility:hidden"></div>' +
      '<div id="hojas"></div></body></html>');
    d.close();
    var r = lcPaginar(f.contentWindow, plan);
    f.remove();
    return r;
  };
});
async function paginas(id, etiqueta, tope) {
  const r = await page.evaluate(id => window._lcPaginas(buildActaIncautacionBlob({ caso: DB.getCase(id) }, 'CARTA')), id);
  log(r && r.paginas <= (tope || 1) && r.desbordes === 0,
    `⚠️ El acta cabe en ${tope > 1 ? tope + ' hojas' : 'UNA hoja'} (${etiqueta}) y no recorta nada`,
    r ? `${r.paginas} pág · ${r.desbordes} desbordes` : 'sin plan');
}
await paginas(idCaso, 'tres elementos');
/* ⚠️ Con doce elementos el recuadro crece cuatro renglones y el acta pasa a DOS
   hojas — medido en Word real y en esta vista, que ahora coinciden. Es correcto
   y el formato lo contempla: por eso su pie dice «Hoja No. N de M». Lo que se
   exige es que ninguna de las dos pierda texto (`desbordes` en cero). */
await paginas(doce, 'doce elementos', 2);

/* ══ G · UN SOLO CUERPO DE LETRA ═══════════════════════════════════════════ */
console.log('\n── G · Un solo cuerpo para todo lo que rellena la app ──');

/* ⚠️ Un run sin `w:sz` propio no hereda el del bloque que lo rodea: hereda el
   del estilo por defecto. Es lo que sacaba el acta FPJ-6 a tres cuerpos
   distintos, y lo que aquí no puede volver a pasar. La comprobación es
   ESTRUCTURAL: cero runs con texto sin tamaño ni fuente propios. */
const sinSz = [...dx.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)]
  .filter(r => /<w:t[ >]/.test(r[1]) && !/<w:sz /.test(r[1])).length;
const sinFuente = [...dx.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)]
  .filter(r => /<w:t[ >]/.test(r[1]) && !/<w:rFonts /.test(r[1])).length;
log(sinSz === 0, '⚠️ Ni un solo run con texto sin `w:sz` propio', String(sinSz));
log(sinFuente === 0, 'Ni sin `w:rFonts`: nada queda a merced del estilo por defecto', String(sinFuente));

/* Y los datos que rellena la app van TODOS al mismo cuerpo. Los textos impresos
   del formato tienen los suyos (título, rótulos de casilla, pie), que son otra
   cosa: son el formulario, no el dato. */
const datos = ['ROBINSON RAMÍREZ SALAZAR', '1037949889', 'Bachiller', 'Soltero', 'Construcción',
               '3122681603', 'Captura', 'mayo', '14:25'];
const cuerpos = new Set();
for (const d of datos) {
  const i = dx.indexOf('>' + d);
  if (i < 0) continue;
  const r = dx.lastIndexOf('<w:r>', i);
  const sz = /<w:sz w:val="(\d+)"/.exec(dx.slice(r, i));
  if (sz) cuerpos.add(sz[1]);
}
log(cuerpos.size === 1 && [...cuerpos][0] === '20',
  '⚠️ Todos los datos diligenciados salen a 10 pt: uno solo, no tres', [...cuerpos].join('/'));

/* ══ H · LO QUE NO SE INVENTA ══════════════════════════════════════════════ */
console.log('\n── H · Lo que se deja en blanco a propósito ──');

/* ⚠️ El acta se imprime para firmarse y estamparse a mano: escribir sobre esas
   líneas le quitaría el sitio a la firma. Misma regla que el acta de derechos. */
const bloqueFirmas = dx.slice(dx.indexOf('Firmas:'));
log(!/JUAN CARLOS CONTRERAS[\s\S]{0,80}<w:drawing>/.test(bloqueFirmas) && !/firma\.png/.test(dx),
  '⚠️ La firma manuscrita del perfil NO se estampa aquí: en un acta firman las dos partes');
log(await page.evaluate(() => buildActaIncautacionBlob.toString().indexOf('lcFirmaDe') < 0),
  'Y el motor ni siquiera la busca: solo el oficio de puesta a disposición la lleva');
/* La casilla de la huella existe —con su recuadro— y va vacía. */
const filaPie = bloqueFirmas.slice(bloqueFirmas.lastIndexOf('<w:tr>'));
log(/CEDULA:/.test(filaPie) && /CARGO:/.test(filaPie) && (filaPie.match(/<w:tc>/g) || []).length === 3,
  'La fila del pie de firmas tiene sus tres casillas: cédula, huella y cargo');
/* ⚠️ Se mide LA CASILLA, no el texto del documento: la fila de rótulos va justo
   debajo de la de dígitos, así que buscar «un número cerca de Expediente CAD»
   encontraría el propio NUNC y la prueba pasaría o fallaría por casualidad. */
const filaDigitos = filas(dx.slice(0, dx.indexOf('</w:tbl>')))[2];
log(runs(celdas(filaDigitos)[0]).join('') === '',
  '⚠️ La casilla del «No. Expediente CAD» va vacía: la app no conoce ese número');

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
const txtPelado = texto(docPelado.partes['word/document.xml'].toString('utf8'));
log(['Natural de', 'Grado de estudio', 'Estado civil', 'ocupación', 'Hijo de',
     'Residente en dirección', 'Teléfono'].every(t => txtPelado.includes(t)),
  '⚠️ Sin esos datos, los renglones se imprimen IGUAL, en blanco: no se omite ninguno');
log(!/N\/A|_{2,}|undefined|null/.test(txtPelado), 'Y sin rellenos inventados', 'sin N/A ni undefined');
await paginas(pelado, 'sin los datos opcionales');

/* Terminología: un menor lleva T.I., y el renglón impreso lo dice. Es el mismo
   criterio con el que el acta de derechos cambia C.C. por T.I. */
const menor = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('ai-uri'), { id: 'ai-menor', tipo: 'CESPA' });
  c.capturados = [Object.assign({}, c.capturados[0], { tipoDoc: 'TI' })];
  await DB.saveCase(c); return aiMapa(DB.getCase('ai-menor')).tipoDoc;
});
log(menor === 'TI', '⚠️ A un menor no se le anota su T.I. sobre un renglón rotulado C.C.', menor);

/* ══ I · PERSISTENCIA, INVITADO Y CONSOLA ══════════════════════════════════ */
console.log('\n── I · Formulario, persistencia y modo invitado ──');

await page.evaluate(() => go('capturas'));
await page.waitForTimeout(200);
await page.evaluate(id => abrirActaIncautacion(id), idCaso);
await page.waitForTimeout(400);
log(await page.isVisible('#ai-obs'), 'El formulario del acta abre desde el expediente');
const prev = await page.$$eval('.lc-emp-l', els => els.map(e => e.textContent.trim()));
log(prev.length === 3 && prev[0].startsWith('1- '),
  'Y enseña los elementos ya numerados, como van a salir', prev.length + ' líneas');

await page.fill('#ai-obs', 'Los elementos quedan a disposición del despacho.');
await page.evaluate(() => closeModal());
await page.waitForTimeout(400);
const guardado = await page.evaluate(() => (DB.getCase('ai-uri').incautacion || {}).obs);
log(guardado === 'Los elementos quedan a disposición del despacho.',
  'Cerrar el modal guarda las observaciones: no se pierden por cerrar', guardado);
const docObs = await generar(idCaso, 'verify_incautacion_obs.docx');
log(texto(docObs.partes['word/document.xml'].toString('utf8')).includes('Los elementos quedan a disposición del despacho.'),
  'Y salen impresas sobre los renglones de OBSERVACIONES');

/* Una observación larga ocupa los renglones que haga falta: lo que no cabe NO
   se descarta —es la familia de fallo de los EMP que nunca se imprimían—. */
const larga = await page.evaluate(async () => {
  const c = DB.getCase('ai-uri');
  c.incautacion.obs = ('Se deja constancia de que los elementos fueron incautados en presencia del capturado ' +
    'y de dos testigos, quienes suscriben el acta, y de que ninguno presentó objeción alguna al procedimiento ' +
    'ni al inventario levantado en el sitio de los hechos.');
  await DB.saveCase(c); return c.incautacion.obs;
});
const docLargo = await generar(idCaso, 'verify_incautacion_obs_largo.docx');
const txtLargo = texto(docLargo.partes['word/document.xml'].toString('utf8')).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ');
const faltantesObs = larga.split(/\s+/).filter(w => !txtLargo.includes(w));
log(faltantesObs.length === 0, '⚠️ Una observación larga se reparte en varios renglones sin perder una palabra',
  `${larga.split(/\s+/).length} palabras · faltan ${faltantesObs.length}`);

/* Modo invitado: no se escribe un solo byte en localStorage. */
const invitado = await page.evaluate(async () => {
  const antes = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, (localStorage[k] || '').length]));
  _guest = true;
  const c = DB.getCase('ai-uri');
  if (c) { c.incautacion = { capIdx: 0, obs: 'prueba invitado', updated: 1 }; await DB.saveCase(c); }
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
