/* Regresión del módulo «Acta de derechos del capturado — FPJ-6».
   Se mide el DOCUMENTO además del formulario: un acta que se ve bien en
   pantalla pero sale con la fecha en blanco no sirve de nada.

   Secciones:
     A. Arquitectura — el registro de documentos y el aislamiento del módulo.
     B. Reutilización — cuántos campos hay que teclear (deben ser los que NO
        existen en el sistema, y ni uno más).
     C. El documento de una captura en flagrancia, celda por celda.
     D. El documento de una captura por orden judicial, por el MISMO mapeo.
     E. Lo que no se inventa: casillas sin dato, firmas en blanco, sin PDF.
     F. Persistencia: los datos del acta sobreviven a editar la persona.
     G. El flujo de captura no cambió, y la consola queda limpia.                */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';
import { inflateRawSync } from 'zlib';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
/* ⚠️ Los .docx de la corrida van al temporal del sistema, no al directorio del
   proyecto: si se abre uno en Word para revisarlo a ojo, Word lo deja bloqueado
   y la siguiente corrida muere con EBUSY antes de comprobar nada. */
const SALIDA = tmpdir();
const PORT = 8161;
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

/* Lector de .docx propio (el mismo patrón de verify_mejora2): la app empaqueta
   ZIP stored, pero un .docx cualquiera puede venir con deflate. */
function leerDocx(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const total = buf.readUInt16LE(eocd + 10), cdo = buf.readUInt32LE(eocd + 16);
  let p = cdo; const out = {};
  for (let i = 0; i < total; i++) {
    const method = buf.readUInt16LE(p + 10), csz = buf.readUInt32LE(p + 20);
    const fnl = buf.readUInt16LE(p + 28), efl = buf.readUInt16LE(p + 30), fcl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + fnl);
    const lfnl = buf.readUInt16LE(lho + 26), lefl = buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(lho + 30 + lfnl + lefl, lho + 30 + lfnl + lefl + csz);
    out[name] = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
    p += 46 + fnl + efl + fcl;
  }
  return out;
}
const celdas = xml => xml.split('<w:tc>').slice(1)
  .map(t => (t.split('</w:tc>')[0].match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(''));
const textoPlano = xml => (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(' ');

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

// El papel queda elegido de antemano: el diálogo de exportación no es lo que
// se está midiendo aquí (tiene su propia suite).
await page.evaluate(() => { lcGuardarPapel('OFICIO'); });

/* ══ A · ARQUITECTURA ══════════════════════════════════════════════════════ */
console.log('\n── A · Arquitectura: registro de documentos y aislamiento ──');

const reg = await page.evaluate(() => Object.keys(LC_DOCS));
log(reg.includes('FPJ') && reg.includes('OJ') && reg.includes('FPJ6'),
  'El acta es una entrada más del registro de documentos, no un motor paralelo', reg.join(','));
log(await page.evaluate(() => lcExportSoloWord('FPJ6')) === true,
  'FPJ-6 declarado «solo Word» — su maquetación es de la Fiscalía, no de la app');
log(await page.evaluate(() => lcExportSoloWord('FPJ')) === true &&
    await page.evaluate(() => lcExportSoloWord('OJ')) === false,
  'El registro no cambió lo que ya regía para el FPJ-5 ni para el oficio OJ');
log(await page.evaluate(() => lcPapelesDe('FPJ6').join(',')) === 'CARTA,OFICIO',
  'Al acta solo se le ofrecen los tamaños de su mismo ancho');
log(await page.evaluate(() => { lcGuardarPapel('P8X135'); const r = lcPapelEfectivo('FPJ6'); lcGuardarPapel('OFICIO'); return r; }) === 'CARTA',
  'Un ancho que las casillas no admiten cae a Carta, igual que en el FPJ-5');
log(await page.evaluate(() => typeof lcProducirDoc === 'function'),
  'Hay un productor único: descarga, aviso y vista de impresión se heredan');

// El módulo no toca el wizard: sus funciones viven en su propio prefijo.
const wizardIntacto = await page.evaluate(() => {
  const src = String(collectStep) + String(wizSave) + String(getWizConfig) + String(startWizard);
  return !/f6|Acta/.test(src);
});
log(wizardIntacto, 'Ni una referencia al acta dentro del wizard de captura');

/* ══ B · REUTILIZACIÓN ═════════════════════════════════════════════════════ */
console.log('\n── B · Reutilización: qué hay que teclear ──');

// Caso de flagrancia URI, completo, como sale del wizard.
const idUri = await page.evaluate(async () => {
  const c = {
    id: 'f6-uri', tipo: 'URI', nunc: '0500160001202600123', fechaProc: '2026-08-03',
    nunc16: '', destino: 'Fiscalía URI Centro',
    conductas: ['Hurto calificado y agravado', 'Porte ilegal de armas'],
    lugar: { dir: 'CL 52 # 50-31', barrio: 'La Candelaria', muni: 'Medellín', depto: 'Antioquia', zona: 'Urbana' },
    capturados: [{
      id: 'per-1', rol: 'Capturado', tipoDoc: 'CC', numDoc: '71.234.567', expEn: 'Medellín',
      priNom: 'Carlos', segNom: 'Andrés', priApe: 'Restrepo', segApe: 'Gómez',
      alias: 'El Flaco', fn: '1994-03-12', edad: '32', sexo: 'M', lugNac: 'Bello, Antioquia',
      ecivil: 'Unión libre', escol: 'Bachiller', ocup: 'Comerciante',
      dirRes: 'KR 45 # 30-12', tel: '3001234567', correo: 'carlos@prueba.test',
      padres: 'María Gómez y Luis Restrepo', senas: 'Cicatriz en el antebrazo'
    }],
    victimas: [], testigos: [], sinVictima: true, sinTestigo: true,
    narracion: { fechaCapD: '03', fechaCapM: '08', fechaCapA: '2026', horaCapH: '14', horaCapM: '35', texto: 'Relato.' },
    servidor: { grado: 'Subintendente', nombre: 'NELSON DAVID', ident: '1.035.302.775', entidad: 'Institución', cargo: 'Patrullero' }
  };
  c.nunc = '0500160001202601';                 // 16 dígitos, como los valida la app
  await DB.saveCase(c);
  await DB.savePerson(c.capturados[0]);
  return c.id;
});
log(!!idUri, 'Caso de flagrancia sembrado');

await page.evaluate(id => abrirActaDerechos(id), idUri);
await page.waitForTimeout(250);
log(await page.isVisible('#f6-obs'),
  'Con un solo capturado se abre el acta directo, sin lista intermedia');

const controles = await page.$$eval('#modal-c input, #modal-c select, #modal-c textarea',
  els => els.filter(e => e.type !== 'hidden' && e.offsetParent !== null).map(e => e.id));
log(controles.length <= 10,
  'El formulario pide solo lo que el sistema NO tiene', controles.length + ' controles: ' + controles.join(', '));

const yaTiene = await page.$eval('#modal-c details', d => d.textContent);
log(/Restrepo/i.test(yaTiene) && /71234567/.test(yaTiene) && /03\/08\/2026/.test(yaTiene) && /Hurto/i.test(yaTiene),
  'El acta enseña lo que ya trae del caso: nombre, documento, fecha y delito');

// Diligenciar SOLO lo que falta.
await page.fill('#f6-identitario', 'Camila Restrepo');
await page.selectOption('#f6-lgbti', 'SI');
await page.waitForTimeout(80);
log(await page.isVisible('#f6-lgbtiCual'), '«¿Cuál?» aparece solo al marcar SI');
await page.fill('#f6-lgbtiCual', 'Transgénero');
await page.selectOption('#f6-etnia', 'AFRO');
await page.fill('#f6-comunidad', 'Consejo Comunitario San José');
await page.fill('#f6-redes', '@carlosr');
await page.fill('#f6-com-nombre', 'Luz Marina Gómez');
await page.fill('#f6-com-doc', '43.111.222');
await page.fill('#f6-com-tel', '3109998877');
await page.fill('#f6-com-hora', '14:50');
await page.fill('#f6-obs', 'Manifiesta no requerir valoración médica.');

/* ══ C · EL DOCUMENTO DE FLAGRANCIA ════════════════════════════════════════ */
console.log('\n── C · El .docx de la captura en flagrancia ──');

const [dlUri] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.evaluate(async () => { await f6Generar(); })
]);
const rutaUri = join(SALIDA, 'verify_fpj6_uri.docx');
await writeFile(rutaUri, await readFile(await dlUri.path()));
const pkgUri = leerDocx(await readFile(rutaUri));
const xmlUri = pkgUri['word/document.xml'].toString('utf8');
const cUri = celdas(xmlUri);
log(dlUri.suggestedFilename().startsWith('FPJ6_Acta_'), 'El acta se descarga', dlUri.suggestedFilename());
log(cUri.length === 113, 'El formato conserva sus 113 celdas: no se reconstruyó ni una tabla', cUri.length);
log((xmlUri.match(/<w:tbl>/g) || []).length === 5, 'Y sus 5 tablas');

/* NUNC — mismas casillas que el FPJ-5. En flagrancia son 16 dígitos: los que
   identifican a la unidad y viven en Ajustes. Las 5 últimas (Consecutivo) las
   asigna el SPOA y quedan en blanco: ese número no se conoce en el sitio. */
const nuncDoc = cUri.slice(17, 33).join('');
log(nuncDoc === '0500160001202601', 'El NUNC sale dígito por dígito', nuncDoc);
log(cUri.slice(33, 38).join('') === '',
  'Y las 5 casillas del Consecutivo quedan en blanco — lo asigna el SPOA');

// Fecha, hora y lugar de la lectura de derechos
log(cUri[51] + cUri[52] === '03' && cUri[54] + cUri[55] === '08' && cUri.slice(57, 61).join('') === '2026',
  'La fecha del acta es la de la captura, casilla por casilla');
log(cUri[62] + cUri[63] + ':' + cUri[64] + cUri[65] === '14:35', 'Y la hora');
log(/Lugar:.*CL 52 # 50-31.*Candelaria.*Medellín/.test(cUri[66]),
  'El lugar sale del lugar de los hechos, sin volver a preguntarlo', cUri[66]);

// 1. Mis datos personales
log(cUri[68] === 'Camila Restrepo', 'Nombre identitario (personas trans)');
log(cUri[70] === 'CARLOS ANDRÉS RESTREPO GÓMEZ', 'Nombres y apellidos, en mayúsculas como el FPJ-5', cUri[70]);
log(cUri[72] === 'CC 71234567 de Medellín', 'Identificación sin puntos', cUri[72]);
log(cUri[74] === '12/03/1994', 'Fecha de nacimiento');
log(cUri[76] === 'Bello, Antioquia', 'Lugar de nacimiento');
log(cUri[78] === 'María Gómez y Luis Restrepo', 'Nombre de los padres');
log(cUri[80] === 'Unión libre', 'Estado civil');
log(cUri[82] === 'Comerciante', 'Ocupación u oficio');
log(/KR 45 # 30-12/.test(cUri[84]) && /3001234567/.test(cUri[84]), 'Dirección y teléfono en una sola casilla', cUri[84]);
log(cUri[86] === 'carlos@prueba.test', 'Correo electrónico');
log(cUri[88] === '@carlosr', 'Redes sociales');

// LGBTI y pertenencia étnica: X automática sin borrar la etiqueta del formato
log(/^X\s+SI$/.test(cUri[90]) && cUri[91] === 'NO',
  'La casilla SI se marca con X y la etiqueta del formato se conserva', `[${cUri[90]}] [${cUri[91]}]`);
log(/¿CUAL\?\s+Transgénero/.test(cUri[92]), '«¿CUÁL?» se explica solo', cUri[92]);
/* ⚠️ La X va DELANTE de la etiqueta: medido sobre el render, «AFROCOLOMBIANO»
   ocupa la celda entera y una X al final caía sola en el renglón siguiente. */
log(/^X\s+AFROCOLOMBIANO$/.test(cUri[98]), 'La pertenencia étnica marca su casilla', cUri[98]);
log(cUri[94] === 'INDÍGENA' && cUri[95] === 'NEGRO/A' && cUri[96] === 'RAIZAL' && cUri[99] === 'PALENQUERO/A' && cUri[100] === 'RROM',
  'Las otras cinco casillas quedan con su etiqueta y sin marca');
log(cUri[102] === 'Consejo Comunitario San José', '¿A qué comunidad pertenece?');

// 3. Persona a quien se comunica la captura
log(cUri[106] === 'LUZ MARINA GÓMEZ', 'Persona a quien se comunica la captura');
log(cUri[108] === '43111222', 'Su identificación, sin puntos');
log(cUri[110] === '3109998877' && cUri[112] === '14:50', 'Su teléfono y la hora de la comunicación');

// Observaciones y constancia de buen trato
log(/Manifiesta no requerir valoración médica/.test(textoPlano(xmlUri)), 'Las observaciones se imprimen');
const constancia = textoPlano(xmlUri).replace(/\s+/g, ' ');
log(/En Medellín/.test(constancia), 'Constancia de buen trato: municipio', constancia.slice(constancia.indexOf('En Medell'), constancia.indexOf('En Medell') + 60));
log(/a los ?03/.test(constancia) && /del mes de agosto/.test(constancia) && /del año 2026/.test(constancia),
  'Constancia: día, mes en letras y año');
log(/siendo las 14:35/.test(constancia), 'Constancia: hora');
log(/CARLOS ANDRÉS RESTREPO GÓMEZ/.test(constancia), 'Constancia: nombre del capturado');
log(/C\.C\. ?71234567/.test(constancia), 'Constancia: documento');
log(/de 32 años de edad/.test(constancia), 'Constancia: edad calculada de la fecha de nacimiento');
log(/a los 03 días/.test(constancia) && /En Medellín a los/.test(constancia),
  '⚠️ El valor no queda pegado a la palabra siguiente ni con una cola de guiones detrás');
log(/Hurto calificado y agravado, Porte ilegal de armas/.test(constancia), 'Constancia: los delitos del caso');
log(/indiciado \(a\) ?X/.test(constancia) && !/imputado\(a\) ?X/.test(constancia),
  'En flagrancia se marca «indiciado», nunca «imputado»');

/* ══ D · EL MISMO MAPEO PARA ORDEN JUDICIAL ════════════════════════════════ */
console.log('\n── D · Una captura por orden judicial, por el MISMO mapeo ──');

const idOj = await page.evaluate(async () => {
  const c = SIM.genOJ();
  c.id = 'f6-oj'; c.isTest = false;
  c.oj.orden.finalidad = 'MEDIDA_ASEGURAMIENTO';
  ojEspejar(c);
  await DB.saveCase(c);
  await DB.savePerson(c.capturados[0]);
  return c.id;
});
log(!!idOj, 'Caso de orden judicial sembrado (del módulo actual, ojv:2)');

const mapaOj = await page.evaluate(id => {
  const c = DB.getCase(id);
  return f6Mapa(c, c.capturados[0], f6Estructura(c.capturados[0].id));
}, idOj);
log(!!(mapaOj.fecha.d && mapaOj.fecha.m && mapaOj.fecha.a),
  'La fecha del acta se proyecta desde oj.diligencia sin una línea propia por flujo',
  `${mapaOj.fecha.d}/${mapaOj.fecha.m}/${mapaOj.fecha.a}`);
log(!!mapaOj.hora, 'Y la hora', mapaOj.hora);
log(!!mapaOj.lugar, 'Y el lugar de la diligencia', mapaOj.lugar);
log(!!mapaOj.nombres && !!mapaOj.doc, 'Y la persona requerida, que el módulo OJ ya espeja a capturados[]');
log(mapaOj.calidad === 'IMPUTADO',
  'Con orden por medida de aseguramiento la calidad procesal es «imputado»', mapaOj.calidad);

/* Regla del usuario: orden judicial ⇒ IMPUTADO, porque para librarla ya hubo
   actuación del despacho. Única excepción: la orden que se libra PARA formular
   la imputación — mientras esa audiencia no ocurra sigue siendo indiciado. */
const calidades = await page.evaluate(() => {
  const base = { tipo:'OJ', ojv:2, oj:{ orden:{} } };
  const r = { '(flagrancia)': f6Calidad({ tipo:'URI' }) };
  ['IMPUTACION','MEDIDA_ASEGURAMIENTO','CONDENA','REVOCATORIA','INDAGATORIA','EXTRADICION','OTRA',''].forEach(f => {
    base.oj.orden.finalidad = f; r[f || '(sin finalidad)'] = f6Calidad(base);
  });
  return r;
});
log(calidades['(flagrancia)'] === 'INDICIADO' && calidades.IMPUTACION === 'INDICIADO' &&
    ['MEDIDA_ASEGURAMIENTO','CONDENA','REVOCATORIA','INDAGATORIA','EXTRADICION','OTRA','(sin finalidad)']
      .every(k => calidades[k] === 'IMPUTADO'),
  'Orden judicial ⇒ imputado; flagrancia y orden para imputar ⇒ indiciado',
  JSON.stringify(calidades));
log(Object.values(calidades).every(v => v === 'INDICIADO' || v === 'IMPUTADO'),
  '⚠️ La casilla se marca SIEMPRE: nunca queda para diligenciar a mano');

await page.evaluate(id => abrirActaDerechos(id), idOj);
await page.waitForTimeout(250);
const [dlOj] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.evaluate(async () => { await f6Generar(); })
]);
const rutaOj = join(SALIDA, 'verify_fpj6_oj.docx');
await writeFile(rutaOj, await readFile(await dlOj.path()));
const cOj = celdas(leerDocx(await readFile(rutaOj))['word/document.xml'].toString('utf8'));
log(cOj.length === 113, 'El acta de orden judicial usa el mismo formato íntegro');
log(!!cOj[70] && cOj[51] !== '' && /Lugar:/.test(cOj[66]),
  'Y sale con nombre, fecha y lugar, sin haber pedido nada de eso otra vez');

/* El número del encabezado en orden judicial es el RADICADO del proceso, no el
   NUNC de flagrancia, y llena las 21 casillas — incluida la del Consecutivo. */
const rad21 = await page.evaluate(async () => {
  const c = DB.getCase('f6-oj');
  c.oj.proceso.radicado = '050016000206201900123';      // 21 dígitos exactos
  ojEspejar(c); await DB.saveCase(c);
  const cap = c.capturados[0];
  const out = buildActaBlob({ caso:c, capturado:cap, acta:f6Estructura(cap.id) }, 'OFICIO');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  const cc = xml.split('<w:tc>').slice(1)
    .map(t => (t.split('</w:tc>')[0].match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g,'')).join(''));
  return { casillas: cc.slice(17, 38).join(''), fuente: f6Nunc(c).fuente,
           texto: (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g,'')).join(' ') };
});
log(rad21.fuente === 'RADICADO', 'En orden judicial el número sale del radicado del proceso, no del NUNC');
log(rad21.casillas === '050016000206201900123',
  'Se llenan las 21 casillas, Consecutivo incluido', rad21.casillas);
log(!/Radicado del proceso:/.test(rad21.texto),
  'Con 21 dígitos exactos no se imprime ninguna línea extra');

/* ⚠️ Un radicado de Ley 906 puede traer 23 dígitos y las casillas son 21.
   Medido sobre el render: meter los sobrantes en la última casilla los apila en
   vertical y estira la fila; con `tcFitText` salen ilegibles; y dejar que Word
   los corte es inaceptable (la fila trae `trHeight hRule="exact"`, recorta sin
   avisar). Van completos y legibles en el renglón vacío de debajo. */
const rad23 = await page.evaluate(async () => {
  const c = DB.getCase('f6-oj');
  c.oj.proceso.radicado = '05001600020620190012300';    // 23 dígitos
  ojEspejar(c); await DB.saveCase(c);
  const cap = c.capturados[0];
  const out = buildActaBlob({ caso:c, capturado:cap, acta:f6Estructura(cap.id) }, 'OFICIO');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  const cc = xml.split('<w:tc>').slice(1)
    .map(t => (t.split('</w:tc>')[0].match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g,'')).join(''));
  const t0 = xml.split('<w:tbl>')[1].split('</w:tbl>')[0];
  return {
    casillas: cc.slice(17, 38).join(''),
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    celdas: cc.length,
    alturas: (t0.match(/<w:trHeight[^>]*>/g) || []).join(' '),
    texto: (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g,'')).join(' ')
  };
});
log(rad23.casillas === '050016000206201900123',
  'Con 23 dígitos, las 21 casillas llevan los 21 primeros, uno por casilla', rad23.casillas);
log(/Radicado del proceso: 05001600020620190012300/.test(rad23.texto),
  'Y el número COMPLETO se imprime en orden, sin casillas, en el renglón de debajo');
log(rad23.tablas === 5 && rad23.celdas === 113,
  'Sin tocar una sola celda del formato', rad23.tablas + ' tablas / ' + rad23.celdas + ' celdas');
log(!/hRule="atLeast"/.test(rad23.alturas),
  '⚠️ Y sin alterar el alto de las filas del encabezado', rad23.alturas);

/* ══ E · LO QUE NO SE INVENTA ══════════════════════════════════════════════ */
console.log('\n── E · Lo que el acta NO inventa ──');

// Caso mínimo: sin NUNC válido, sin etnia, sin LGBTI, sin persona a comunicar.
const idMin = await page.evaluate(async () => {
  const c = {
    id: 'f6-min', tipo: 'URI', nunc: '', fechaProc: '2026-08-01', conductas: [],
    lugar: { dir: 'CL 10 # 1-1', muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{ id:'per-min', rol:'Capturado', tipoDoc:'CC', numDoc:'99887766', priNom:'Ana', priApe:'Pérez' }],
    narracion: { fechaCapD:'01', fechaCapM:'08', fechaCapA:'2026', horaCapH:'09', horaCapM:'05' }
  };
  await DB.saveCase(c); return c.id;
});
const outMin = await page.evaluate(id => {
  const c = DB.getCase(id), cap = c.capturados[0];
  const out = buildActaBlob({ caso:c, capturado:cap, acta:f6Estructura(cap.id) }, 'OFICIO');
  return out ? { ok:true, noPDF:out.noPDF, papel:out.papel, label:out.label } : { ok:false };
}, idMin);
log(outMin.ok === true, 'Sin NUNC el acta SÍ se genera — se firma en el sitio, cuando el número puede no existir');
const xmlMin = await page.evaluate(id => {
  const c = DB.getCase(id), cap = c.capturados[0];
  const out = buildActaBlob({ caso:c, capturado:cap, acta:f6Estructura(cap.id) }, 'OFICIO');
  return new TextDecoder().decode(out.files['word/document.xml']);
}, idMin);
const cMin = celdas(xmlMin);
log(cMin.slice(17, 38).join('') === '', '…pero las casillas del NUNC quedan EN BLANCO: no se fabrica un número');

/* ⚠️ Sin NUNC en el caso se cae al de Ajustes: es el mismo número que el wizard
   le habría precargado a la captura (los 16 dígitos son fijos de la unidad),
   no un dato inventado. */
const desdeAjustes = await page.evaluate(id => {
  const cfg = DB.getConfig(); cfg.nuncUri = '0500160001202677'; DB.saveConfig(cfg);
  const c = DB.getCase(id), cap = c.capturados[0];
  const out = buildActaBlob({ caso:c, capturado:cap, acta:f6Estructura(cap.id) }, 'OFICIO');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  const cc = xml.split('<w:tc>').slice(1)
    .map(t => (t.split('</w:tc>')[0].match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g,'')).join(''));
  cfg.nuncUri = ''; DB.saveConfig(cfg);
  return cc.slice(17, 38).join('');
}, idMin);
log(desdeAjustes === '0500160001202677',
  'Un caso sin NUNC toma automáticamente el de Ajustes, y el Consecutivo sigue en blanco', desdeAjustes);
log(cMin[90] === 'SI' && cMin[91] === 'NO' && cMin[92] === '¿CUAL?',
  'Sin declaración LGBTI no se marca ninguna casilla y las etiquetas quedan intactas');
log(F6_ETNIA_OK(cMin), 'Sin pertenencia étnica, las seis casillas quedan con su etiqueta y sin X');
function F6_ETNIA_OK(cc) {
  return [94, 95, 96, 98, 99, 100].every(i => !/X/.test(cc[i]) && cc[i].length > 0);
}
log(cMin[106] === '' && cMin[108] === '' && cMin[110] === '' && cMin[112] === '',
  'Sin persona a quien comunicar, las cuatro casillas quedan en blanco');
const txtMin = textoPlano(xmlMin).replace(/\s+/g, ' ');
log(/indiciado \(a\) ___/.test(txtMin) === false && /X o imputado/.test(txtMin) === false ? true : /indiciado \(a\) ?X/.test(txtMin),
  'La calidad procesal se marca en flagrancia (indiciado)');
log(/del delito de _{5,}/.test(txtMin),
  'Sin delitos registrados, el renglón del delito se queda como el del formato');

// Firmas: los renglones oficiales no se tocan.
const firmas = textoPlano(xmlUri).replace(/\s+/g, ' ');
log(/Nombre, cédula y firma del servidor/.test(firmas) && /Firma y\/o huella del capturado/.test(firmas) &&
    /Nombre, código, cargo y firma del Fiscal/.test(firmas),
  'Los pies de firma del formato siguen ahí');
log(!new RegExp('NELSON DAVID').test(firmas),
  '⚠️ Y sus renglones quedan EN BLANCO: el acta se firma y se estampa a mano');

log(outMin.noPDF === true, 'El acta viaja marcada noPDF: ninguna ruta futura puede imprimirla por descuido');
const rechazaPDF = await page.evaluate(id => {
  const c = DB.getCase(id), cap = c.capturados[0];
  const out = buildActaBlob({ caso:c, capturado:cap, acta:f6Estructura(cap.id) }, 'OFICIO');
  const antes = document.querySelectorAll('iframe').length;
  lcImprimir(out);
  return document.querySelectorAll('iframe').length === antes;
}, idMin);
log(rechazaPDF, 'lcImprimir() lo rechaza: la guarda es estructural, no de interfaz');
log(outMin.papel === 'OFICIO', 'El tamaño de papel elegido llega al documento', outMin.papel);

/* ══ F · PERSISTENCIA ══════════════════════════════════════════════════════ */
console.log('\n── F · Los datos del acta no se pierden ──');

const guardado = await page.evaluate(() => {
  const c = DB.getCase('f6-uri'), p = DB.getPerson('per-1');
  const a = (c.actas || [])[0] || {};
  return {
    enCaso: c.capturados[0].lgbti + '/' + c.capturados[0].etnia + '/' + c.capturados[0].nombreIdentitario,
    enPersona: p.lgbti + '/' + p.etnia + '/' + p.redes,
    comunica: a.comunica ? a.comunica.nombre + '|' + a.comunica.hora : '',
    obs: a.obs || ''
  };
});
log(guardado.enCaso === 'SI/AFRO/Camila Restrepo', 'Los atributos de identidad quedan en el capturado del caso', guardado.enCaso);
log(guardado.enPersona === 'SI/AFRO/@carlosr', 'Y en el registro de Personas: una segunda captura ya no los pregunta', guardado.enPersona);
log(guardado.comunica === 'Luz Marina Gómez|14:50' && /valoración médica/.test(guardado.obs),
  'Lo del procedimiento queda en caso.actas[], no mezclado con la persona');

// Reabrir el acta: los datos vuelven al formulario.
await page.evaluate(() => abrirActaDerechos('f6-uri'));
await page.waitForTimeout(250);
log(await page.inputValue('#f6-com-nombre') === 'Luz Marina Gómez' &&
    await page.inputValue('#f6-obs') === 'Manifiesta no requerir valoración médica.',
  'Al reabrirla, el acta trae lo que ya se había diligenciado');
// Autoguardado al cerrar
await page.fill('#f6-obs', 'Texto cambiado al cerrar.');
await page.evaluate(() => closeModal());
await page.waitForTimeout(300);
log(await page.evaluate(() => ((DB.getCase('f6-uri').actas || [])[0] || {}).obs) === 'Texto cambiado al cerrar.',
  'Cerrar el modal guarda lo escrito, no lo tira');

/* ⚠️ El bug que este cambio destapó: editar a la persona reconstruía el objeto
   desde cero y borraba en silencio los campos que su formulario no pinta. */
await page.evaluate(() => { editPerson('per-1'); });
await page.waitForTimeout(250);
await page.fill('#pm-ocup', 'Mecánico');
await page.click('#modal-c .btn.bp.bbl');
await page.waitForTimeout(300);
const trasEditar = await page.evaluate(() => {
  const p = DB.getPerson('per-1');
  return p.ocup + '|' + (p.lgbti || '') + '|' + (p.etnia || '') + '|' + (p.nombreIdentitario || '');
});
log(trasEditar === 'Mecánico|SI|AFRO|Camila Restrepo',
  'Editar la persona actualiza lo editado y CONSERVA lo del acta', trasEditar);

/* ══ G · SIN EFECTOS COLATERALES ═══════════════════════════════════════════ */
console.log('\n── G · El resto de la app no cambió ──');

const sheet = await page.evaluate(id => { openCaseSheet(id); return document.getElementById('act-items').textContent; }, idUri);
await page.evaluate(() => closeActionSheet());
log(/Acta de derechos/.test(sheet), 'El acta se ofrece desde el sheet de la captura');
log(/Enviar FPJ-5/.test(sheet) && /Descargar FPJ-5/.test(sheet) && /Enviar Dossier/.test(sheet),
  'Y las salidas que ya existían siguen ahí, sin duplicarse');

// Varias personas capturadas → hay que elegir de quién es el acta.
await page.evaluate(async () => {
  const c = DB.getCase('f6-uri');
  c.capturados.push({ id:'per-2', rol:'Capturado', tipoDoc:'CC', numDoc:'80112233', priNom:'Diego', priApe:'Marín' });
  await DB.saveCase(c);
});
await page.evaluate(() => abrirActaDerechos('f6-uri'));
await page.waitForTimeout(250);
const picker = await page.$eval('#modal-c', el => el.textContent);
log(/De quién es el acta/.test(picker) && /Diego Marín/.test(picker) && /Carlos Andrés Restrepo/.test(picker),
  'Con varias personas capturadas, el acta pregunta de quién es — es individual');
await page.evaluate(() => closeModal());

/* El FPJ-5 del mismo caso sigue saliendo igual que antes de este trabajo.
   ⚠️ Se mide sobre el caso de UNA persona por rol, que es el patrón de
   «original»: con varios capturados el propio motor reproduce los apartados y
   el número de tablas deja de ser comparable (misma razón por la que
   verify_export fija su semilla a una persona). */
const fpj5 = await page.evaluate(() => {
  const c = DB.getCase('f6-min');
  c.nunc = '0500160001202699';
  const out = buildFPJBlob(c, lcPapelEfectivo('FPJ'));
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return { tablas: (xml.match(/<w:tbl>/g) || []).length, celdas: xml.split('<w:tc>').length - 1, label: out.label };
});
log(fpj5.label === 'FPJ-5 URI', 'El FPJ-5 se sigue generando por su ruta de siempre');
log(fpj5.tablas === 35 && fpj5.celdas === 308,
  'Y con su geometría intacta: 35 tablas y 308 celdas', fpj5.tablas + ' tablas / ' + fpj5.celdas + ' celdas');

log(errores.length === 0, 'Consola sin errores', errores.slice(0, 3).join(' | ') || 'ninguno');

console.log(`\n${fails === 0 ? '✅ TODO OK' : '❌ ' + fails + ' FALLO(S)'} — ${n} comprobaciones`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
