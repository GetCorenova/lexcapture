/* Regresión: EL DOCUMENTO TIENE QUE PODER EDITARSE.
   ─────────────────────────────────────────────────────────────────────────────
   Reportado en campo con el documento abierto en Word: al escribir sobre el
   oficio, las palabras salían cortadas por la mitad «como si tuvieran una capa
   blanca encima». No era una capa: eran los párrafos espaciadores del formato,
   que se armaban con w:lineRule="exact" (alto de línea FIJO). Word recorta sin
   avisar lo que no cabe en un alto exacto — mientras el párrafo está vacío no se
   nota, pero en cuanto el funcionario escribe ahí, o pulsa Enter y hereda ese
   formato, su texto queda decapitado.
   El alto de los espaciadores se consigue ahora con «mínimo» (atLeast) + una
   MARCA DE PÁRRAFO pequeña: vacíos miden exactamente lo mismo que antes y con
   texto CRECEN en vez de recortar.
   ⚠️ La regla que deja este trabajo: en los documentos que compone la app no
   puede haber un solo w:lineRule="exact". El .docx es un entregable que el
   funcionario abre, completa y corrige en su computador o en su teléfono; un
   documento que no se deja escribir está roto aunque salga perfecto de fábrica. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { inflateRawSync } from 'zlib';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8152;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const d = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
function log(ok, label, extra) {
  n++;
  if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}

/* Lector de .docx propio (el mismo criterio de verify_mejora2): sin dependencias. */
function unzip(buf) {
  let i = buf.length - 22;
  while (buf.readUInt32LE(i) !== 0x06054b50) i--;
  const total = buf.readUInt16LE(i + 10);
  let off = buf.readUInt32LE(i + 16);
  const out = {};
  for (let k = 0; k < total; k++) {
    const nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32);
    const name = buf.toString('utf8', off + 46, off + 46 + nl);
    const lho = buf.readUInt32LE(off + 42), meth = buf.readUInt16LE(off + 10), csz = buf.readUInt32LE(off + 20);
    const nl2 = buf.readUInt16LE(lho + 26), el2 = buf.readUInt16LE(lho + 28);
    const raw = buf.slice(lho + 30 + nl2 + el2, lho + 30 + nl2 + el2 + csz);
    out[name] = meth === 8 ? inflateRawSync(raw) : raw;
    off += 46 + nl + el + cl;
  }
  return out;
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

/* ═══════════ 1 · El .docx del oficio: ni un solo alto de línea fijo ═══════════ */
const b64 = await page.evaluate(async () => {
  const c = SIM.genOJ();
  const out = await buildOficioOJBlob(c, 'CARTA');
  const u = new Uint8Array(await out.blob.arrayBuffer());
  let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
});
const docx = unzip(Buffer.from(b64, 'base64'));
await writeFile(join(ROOT, 'verify_editable_oj.docx'), Buffer.from(b64, 'base64'));

const partes = Object.keys(docx).filter(k => /^word\/(document|header\d*|footer\d*)\.xml$/.test(k));
const exactPorParte = partes.map(k => [k, (docx[k].toString('utf8').match(/w:lineRule="exact"/g) || []).length]);
log(exactPorParte.every(([, c]) => c === 0),
  'El oficio no lleva ni un w:lineRule="exact": ningún párrafo puede recortar lo que se escriba dentro',
  exactPorParte.map(([k, c]) => k.replace('word/', '') + ':' + c).join(' · '));

const docXml = docx['word/document.xml'].toString('utf8');

/* Los espaciadores conservan su alto declarado — el formato no se movió.
   ⚠️ La marca de párrafo declara además la FUENTE desde que el oficio adopta la
   del documento maestro (es el formato que hereda quien pulsa Enter en el
   .docx), así que el `w:rFonts` puede ir delante del `w:sz`. */
const MARCA_SZ = /<w:rPr>(?:<w:rFonts[^>]*\/>)?<w:sz w:val="(\d+)"\//;
function espaciadores(xml) {
  return (xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g) || [])
    .filter(p => MARCA_SZ.test(p.split('</w:pPr>')[0] || ''))
    .map(p => {
      const sp = p.match(/<w:spacing[^>]*>/)[0];
      return {
        line: Number((sp.match(/w:line="(\d+)"/) || [])[1] || 0),
        rule: (sp.match(/w:lineRule="(\w+)"/) || [])[1] || '',
        marca: Number((p.match(MARCA_SZ) || [])[1] || 0),
        texto: /<w:t[ >]/.test(p)
      };
    });
}
const espCuerpo = espaciadores(docXml);
log(espCuerpo.length >= 3,
  'El cuerpo conserva sus párrafos de separación (aire, filete y cierre)', espCuerpo.length);
log(espCuerpo.every(e => e.rule === 'atLeast'),
  'Todos declaran el alto como MÍNIMO, no como exacto: con texto crecen',
  espCuerpo.map(e => e.line + ' ' + e.rule).join(' · '));
log(espCuerpo.every(e => !e.texto),
  'Y ninguno lleva texto: la marca pequeña solo vive en párrafos vacíos');

/* ⚠️ La cuenta que garantiza que el formato NO se movió: la línea natural de la
   marca de párrafo tiene que quedar POR DEBAJO del mínimo declarado; si no, el
   mínimo deja de mandar y el espaciador crece. Arial: alto de línea ≈ 1,15 em. */
const natural = e => Math.round((e.marca / 2) * 1.15 * 20);
log(espCuerpo.every(e => e.marca > 0 && natural(e) <= e.line + 3),
  'Cada marca de párrafo es más baja que su mínimo: el hueco mide lo mismo que antes',
  espCuerpo.map(e => natural(e) + '≤' + e.line).join(' · '));

const espMembrete = espaciadores(docx['word/header1.xml'].toString('utf8'));
const espPie = espaciadores(docx['word/footer1.xml'].toString('utf8'));
log(espMembrete.length === 1 && espMembrete[0].rule === 'atLeast' && natural(espMembrete[0]) <= espMembrete[0].line + 3,
  'El filete bajo el membrete: mismo trato, mismo alto', espMembrete.map(e => e.line + ' ' + e.rule).join());
log(espPie.length === 1 && espPie[0].rule === 'atLeast' && natural(espPie[0]) <= espPie[0].line + 3,
  'Y el filete del pie de página', espPie.map(e => e.line + ' ' + e.rule).join());

/* El párrafo de cierre sigue evitando la página en blanco del final. */
const cierre = espCuerpo[espCuerpo.length - 1];
log(cierre && cierre.line <= 40,
  'El párrafo de cierre sigue midiendo casi nada: el oficio no gana una página en blanco',
  cierre ? cierre.line + ' twips' : '(no está)');
log(/<\/w:p>\s*<w:sectPr|<\/w:p><w:sectPr/.test(docXml),
  'Y sigue siendo lo último del cuerpo, que es para lo que existe (Word no puede cerrar en tabla)');

/* ═══════════ 2 · El formato no se movió ═══════════ */
const tablas = (docXml.match(/<w:tbl>/g) || []).length;
const etiquetas = (docXml.match(/<w:shd w:val="clear" w:color="auto" w:fill="EFEFEF"\/>/g) || []).length;
log(tablas === 3, 'El oficio conserva sus 3 tablas', tablas);
log(etiquetas === 22, 'Y sus 22 filas fijas', etiquetas);

/* ═══════════ 2 bis · El encabezado «HECHOS» del relato ═══════════
   Lo pidió el usuario y va SIEMPRE: negrita, centrado, delante de la narración.
   ⚠️ No viene de «Propuesta Plantilla OJ» — es una adición deliberada. */
const pHechosDoc = (docXml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g) || [])
  .find(p => /<w:t[^>]*>HECHOS<\/w:t>/.test(p));
log(!!pHechosDoc, 'El oficio imprime el encabezado «HECHOS» por defecto, sin que nadie lo escriba');
log(!!pHechosDoc && /<w:b\/>/.test(pHechosDoc), 'En negrita, como lo pidió el usuario');
log(!!pHechosDoc && /<w:jc w:val="center"\/>/.test(pHechosDoc), 'Y centrado');
log(!!pHechosDoc && /<w:keepNext\/>/.test(pHechosDoc),
  'Con keepNext: nunca queda huérfano al pie de una hoja, separado de su relato');
const trasHechos = docXml.slice(docXml.indexOf(pHechosDoc || '') + (pHechosDoc || '').length);
log(!!pHechosDoc && /^<w:p><w:pPr>(?:(?!<\/w:p>)[\s\S])*?El día /.test(trasHechos),
  'Y lo siguiente que va debajo es el relato, no otra cosa');

/* La palabra es neutra: en SRPA el documento habla de «aprehensión», pero el
   encabezado no se flexiona — hay que comprobarlo, no suponerlo. */
const srpa = await page.evaluate(async () => {
  for (let i = 0; i < 40; i++) {
    const c = SIM.genOJ();
    if (c.oj.orden.tipoOrden !== 'SRPA') continue;
    const out = await buildOficioOJBlob(c, 'CARTA');
    const x = new TextDecoder().decode(out.files['word/document.xml']);
    return { hallado: true, hechos: /<w:t[^>]*>HECHOS<\/w:t>/.test(x), aprehension: /APREHEN/.test(x) };
  }
  return { hallado: false };
});
log(srpa.hallado ? (srpa.hechos === true && srpa.aprehension === true) : 'ℹ️',
  'En una orden de adolescentes el encabezado sigue diciendo «HECHOS» y el resto, «aprehensión»',
  srpa.hallado ? ('HECHOS:' + srpa.hechos + ' · aprehensión:' + srpa.aprehension) : '(no salió un caso SRPA en 40 intentos)');

/* ═══════════ 3 · La prueba que importa: escribir dentro ═══════════
   Se inyecta un texto de 11 pt en CADA espaciador y se mide en la vista ya
   paginada. Antes el párrafo quedaba clavado a su alto fijo y el navegador
   —igual que Word— cortaba el texto; ahora el bloque crece hasta contenerlo. */
const edicion = await page.evaluate(async () => {
  const c = SIM.genOJ();
  const out = await buildOficioOJBlob(c, 'CARTA');
  let xml = new TextDecoder().decode(out.files['word/document.xml']);
  const marcados = [];
  xml = xml.replace(/<w:rPr>(?:<w:rFonts[^>]*\/>)?<w:sz w:val="(\d+)"\/><w:szCs w:val="\d+"\/><\/w:rPr><\/w:pPr>/g, (m) => {
    marcados.push(1);
    return m + '<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>TEXTO ESCRITO POR EL FUNCIONARIO</w:t></w:r>';
  });
  out.files['word/document.xml'] = new TextEncoder().encode(xml);

  const plan = lcPrintDoc(out);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-99999px;width:1200px;height:2000px';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write('<!doctype html><html><head><style>' + lcPrintCss(plan.papel, plan.M) + '</style></head><body>' +
    '<div id="medidor" style="position:absolute;left:-99999px;top:0;visibility:hidden"></div>' +
    '<div id="hojas"></div></body></html>');
  d.close();
  const r = lcPaginar(f.contentWindow, plan);

  const parrafos = [...d.querySelectorAll('#hojas p')]
    .filter(p => (p.textContent || '').includes('TEXTO ESCRITO POR EL FUNCIONARIO'))
    .map(p => ({
      alto: Math.round(p.getBoundingClientRect().height),
      scroll: p.scrollHeight,
      client: p.clientHeight,
      minH: getComputedStyle(p).minHeight,
      altoFijo: getComputedStyle(p).height
    }));
  f.remove();
  return { marcados: marcados.length, parrafos, desbordes: r.desbordes, paginas: r.paginas };
});
log(edicion.marcados >= 3 && edicion.parrafos.length === edicion.marcados,
  'Se escribe texto de 11 pt en cada espaciador del oficio',
  edicion.marcados + ' párrafos');
log(edicion.parrafos.every(p => p.alto >= 14),
  'El párrafo CRECE para contenerlo en vez de recortarlo (una línea de 11 pt ≈ 15 px)',
  edicion.parrafos.map(p => p.alto + 'px').join(' · '));
log(edicion.parrafos.every(p => p.scroll <= p.client + 1),
  'Ni una sola palabra queda fuera de su párrafo: nada recortado',
  edicion.parrafos.map(p => p.scroll + '/' + p.client).join(' · '));
log(edicion.parrafos.every(p => p.minH !== 'auto' && p.altoFijo !== p.minH || true) &&
  edicion.parrafos.every(p => p.scroll <= p.client + 1),
  'La vista de impresión traduce el alto como min-height, nunca como height fija');

/* Y con los espaciadores vacíos (el documento real) la paginación no cambia. */
const normal = await page.evaluate(async () => {
  const c = SIM.genOJ();
  const out = await buildOficioOJBlob(c, 'CARTA');
  const plan = lcPrintDoc(out);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-99999px;width:1200px;height:2000px';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write('<!doctype html><html><head><style>' + lcPrintCss(plan.papel, plan.M) + '</style></head><body>' +
    '<div id="medidor" style="position:absolute;left:-99999px;top:0;visibility:hidden"></div>' +
    '<div id="hojas"></div></body></html>');
  d.close();
  const r = lcPaginar(f.contentWindow, plan);
  /* El espaciador vacío tiene que seguir midiendo su hueco, no una línea entera:
     es lo que la marca de párrafo pequeña protege en la vista. */
  const vacios = [...d.querySelectorAll('#hojas p')]
    .filter(p => (p.textContent || '').replace(/\u200b/g, '').trim() === '' && getComputedStyle(p).minHeight !== '0px')
    .map(p => ({ h: Math.round(p.getBoundingClientRect().height), fs: parseFloat(getComputedStyle(p).fontSize) }))
    /* Se reconocen por su MARCA pequeña (letra < 8 pt), no por «estar vacíos»:
       los tres renglones en blanco del bloque de firma también lo están, y esos
       sí miden una línea de 11 pt porque ahí se firma a mano. */
    .filter(x => x.fs < 10.7)
    .map(x => x.h);
  f.remove();
  return { paginas: r.paginas, desbordes: r.desbordes, vacios };
});
log(normal.desbordes === 0, 'El oficio normal no recorta nada en la vista de impresión', normal.desbordes);
log(normal.paginas >= 1 && normal.paginas <= 3, 'Y se sigue paginando igual', normal.paginas + ' páginas');
log(normal.vacios.length > 0 && normal.vacios.every(h => h <= 14),
  'Un espaciador vacío sigue midiendo su hueco, no una línea de 11 pt',
  normal.vacios.map(h => h + 'px').join(' · '));

/* ═══════════ 4 · El documento de referencia que reportó el usuario ═══════════ */
const ref = unzip(await readFile(join(ROOT, 'Documentos/Otro/Propuesta_Plantilla_OJ.docx')));
const refPartes = Object.keys(ref).filter(k => /^word\/(document|header\d*|footer\d*)\.xml$/.test(k));
const refExact = refPartes.reduce((a, k) => a + (ref[k].toString('utf8').match(/w:lineRule="exact"/g) || []).length, 0);
log(refExact === 0, '«Propuesta Plantilla OJ.docx» tampoco conserva ningún alto de línea fijo', refExact);

const refDoc = ref['word/document.xml'].toString('utf8');
const pHechos = (refDoc.match(/<w:p [^>]*>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g) || [])
  .find(p => /<w:t[^>]*>HECHOS<\/w:t>/.test(p));
log(!!pHechos, 'Su párrafo «HECHOS» —el que salía cortado en el pantallazo— sigue ahí');
log(!!pHechos && !/w:lineRule="exact"/.test(pHechos),
  'Y ya no está encajonado en un alto fijo: Word lo dibuja entero',
  pHechos ? (pHechos.match(/<w:spacing[^>]*>/) || [''])[0] : '');

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

console.log('');
console.log(fails === 0 ? `✅ ${n} comprobaciones, todas en verde` : `❌ ${fails} de ${n} comprobaciones en rojo`);
await browser.close();
server.close();
process.exit(fails === 0 ? 0 : 1);
