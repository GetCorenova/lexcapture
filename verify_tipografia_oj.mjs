/* Regresión tipográfica del oficio «Dejando a disposición — capturado por orden
   judicial».

   El criterio NO es «se ve bien»: es que cada elemento salga con los parámetros
   del formato institucional de referencia (Documentos/Otro/Propuesta Plantilla
   OJ - copia.docx), que es el estándar aplicable a ESTE documento, y que la
   jerarquía se mantenga idéntica en el .docx y en la vista de impresión (PDF).

   ⚠️ La comprobación de fondo es ESTRUCTURAL: ningún run que lleve texto puede
   quedarse sin declarar fuente y tamaño. Un run sin `w:sz` no hereda el tamaño
   del formato que lo rodea — hereda el del estilo por defecto (11 pt), y por ahí
   se coló el defecto de los números de página. Mirar solo «los tamaños que hay»
   no lo habría detectado: el defecto era la AUSENCIA de la declaración.

   Secciones:
     A. Estándar: fuente única, márgenes y jerarquía declarada.
     B. Garantía estructural: cero runs sin fuente/tamaño explícitos.
     C. El documento generado contra el FORMATO DE REFERENCIA, clase por clase.
     D. El pie, run por run (incluidos los campos PAGE/NUMPAGES).
     E. Word ↔ PDF: la vista de impresión da la misma jerarquía.
     F. Los datos variables no alteran la tipografía.                          */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { inflateRawSync } from 'zlib';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
/* ⚠️ DOCUMENTO MAESTRO — fuente única de verdad del formato de este oficio, y
   por tanto de esta suite. Antes había dos referencias (la copia pristina para
   el cuerpo y el archivo reajustado para el membrete); desde que el usuario
   adoptó su propio ajuste como patrón maestro son el mismo archivo, y las
   expectativas se DERIVAN de él en vez de estar escritas a mano: si el maestro
   cambia de fuente o de cuerpo, esta suite lo dice sin tocar una línea. */
const REF = join(ROOT, 'Documentos/Otro/Propuesta_Plantilla_OJ.docx');
const REF_HDR = REF;
const PORT = 8190;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'') || 'LexCapture_v8.html');
    const d = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
function log(ok, label, extra) {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}
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

const browser = await chromium.launch();
const page = await browser.newPage();
const errores = [];
page.on('pageerror', e => errores.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
await page.goto(`http://localhost:${PORT}/LexCapture_v8.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '445566'); await page.fill('#pin-b', '445566');
await page.click('button[onclick="doSetPin()"]'); await page.waitForTimeout(400);
await page.evaluate(() => lcGuardarPapel('CARTA'));

/* Perfilador compartido: resuelve tamaño y fuente EFECTIVOS igual que Word
   (rPr → rStyle → estilo del párrafo con su cadena basedOn → docDefaults). */
await page.evaluate(() => {
  window.__perf = function(xml, stylesXml) {
    const W = FPJ_W, P = s => new DOMParser().parseFromString(s, 'application/xml');
    const st = P(stylesXml), doc = P(xml);
    const v = (el, a) => el ? (el.getAttributeNS(W, a) || el.getAttribute('w:' + a)) : null;
    const est = {}; let defPar = '';
    Array.from(st.getElementsByTagNameNS(W, 'style')).forEach(s => {
      const rpr = s.getElementsByTagNameNS(W, 'rPr')[0];
      const t = rpr && rpr.getElementsByTagNameNS(W, 'sz')[0];
      const f = rpr && rpr.getElementsByTagNameNS(W, 'rFonts')[0];
      est[v(s, 'styleId')] = { sz: t ? +v(t, 'val') : 0, font: f ? (v(f, 'ascii') || '') : '',
                               b: !!(rpr && rpr.getElementsByTagNameNS(W, 'b')[0]),
                               basedOn: v(s.getElementsByTagNameNS(W, 'basedOn')[0], 'val') || '' };
      if (v(s, 'type') === 'paragraph' && v(s, 'default') === '1') defPar = v(s, 'styleId');
    });
    const cad = (id, c) => { let k = id, i = 0; while (k && est[k] && i++ < 12) { if (est[k][c]) return est[k][c]; k = est[k].basedOn; } return null; };
    const dd = st.getElementsByTagNameNS(W, 'rPrDefault')[0];
    const ddR = dd && dd.getElementsByTagNameNS(W, 'rPr')[0];
    const ddSz = ddR && ddR.getElementsByTagNameNS(W, 'sz')[0];
    const ddF = ddR && ddR.getElementsByTagNameNS(W, 'rFonts')[0];
    const SZ0 = (ddSz ? +v(ddSz, 'val') : 0) || cad(defPar, 'sz') || 20;
    const F0 = (ddF ? v(ddF, 'ascii') : '') || cad(defPar, 'font') || '';
    const raiz = doc.getElementsByTagNameNS(W, 'body')[0] || doc.documentElement;
    const parr = [];
    Array.from(raiz.getElementsByTagNameNS(W, 'p')).forEach(p => {
      const ppr = p.getElementsByTagNameNS(W, 'pPr')[0];
      const pS = ppr && ppr.getElementsByTagNameNS(W, 'pStyle')[0];
      const sid = pS ? v(pS, 'val') : '';
      const jc = ppr && ppr.getElementsByTagNameNS(W, 'jc')[0];
      const runs = Array.from(p.getElementsByTagNameNS(W, 'r')).map(r => {
        const rpr = r.getElementsByTagNameNS(W, 'rPr')[0];
        const szN = rpr && rpr.getElementsByTagNameNS(W, 'sz')[0];
        const fN = rpr && rpr.getElementsByTagNameNS(W, 'rFonts')[0];
        const cN = rpr && rpr.getElementsByTagNameNS(W, 'color')[0];
        const rS = rpr && rpr.getElementsByTagNameNS(W, 'rStyle')[0];
        const txt = Array.from(r.getElementsByTagNameNS(W, 't')).map(x => x.textContent).join('');
        const instr = Array.from(r.getElementsByTagNameNS(W, 'instrText')).map(x => x.textContent).join('');
        const fld = r.getElementsByTagNameNS(W, 'fldChar')[0];
        return {
          txt, instr, fld: fld ? v(fld, 'type') || 'x' : '',
          // ¿aporta texto al documento? (los runs de imagen no cuentan)
          tipografico: !!(txt || instr || fld),
          szPropio: szN ? +v(szN, 'val') : 0,
          fontPropia: fN ? (v(fN, 'ascii') || '') : '',
          color: cN ? v(cN, 'val') : '',
          sz: (szN ? +v(szN, 'val') : 0) || (rS && cad(v(rS, 'val'), 'sz')) || (sid && cad(sid, 'sz')) || SZ0,
          font: (fN ? (v(fN, 'ascii') || '') : '') || (rS && cad(v(rS, 'val'), 'font')) || (sid && cad(sid, 'font')) || F0,
          b: !!(rpr && rpr.getElementsByTagNameNS(W, 'b')[0]) || (sid ? !!cad(sid, 'b') : false)
        };
      });
      let nd = p.parentNode, dentro = false;
      while (nd) { if (nd.localName === 'tc') { dentro = true; break; } nd = nd.parentNode; }
      parr.push({ txt: runs.map(r => r.txt).join(''), estilo: sid, tabla: dentro,
                  jc: jc ? v(jc, 'val') : '', runs });
    });
    const mar = doc.getElementsByTagNameNS(W, 'pgMar')[0];
    return { SZ0, F0, defPar, parr,
             mar: mar ? { top:+v(mar,'top'), right:+v(mar,'right'), bottom:+v(mar,'bottom'), left:+v(mar,'left') } : null };
  };
});

const refPkg = leerDocx(await readFile(REF));
const refStyles = refPkg['word/styles.xml'].toString('utf8');
const perfilar = (xml, styles) => page.evaluate(([a, b]) => window.__perf(a, b), [xml, styles]);

const ref = await perfilar(refPkg['word/document.xml'].toString('utf8'), refStyles);
const refFtr = await perfilar(refPkg['word/footer3.xml'].toString('utf8'), refStyles);
/* ⚠️ El MEMBRETE tiene una referencia propia: el 2026-08-13 el usuario reajustó
   a mano el encabezado de «Propuesta Plantilla OJ.docx» (escudo 723900 → 800100
   EMU y flotante, las cuatro líneas de 10 → 11 pt) y ese archivo pasó a ser el
   estándar de esta parte. El resto del oficio se sigue midiendo contra la copia
   pristina, que no cambió. */
const refHdrPkg = leerDocx(await readFile(REF_HDR));
const refHdr = await perfilar(refHdrPkg['word/header3.xml'].toString('utf8'),
                              refHdrPkg['word/styles.xml'].toString('utf8'));

// ── El documento generado ──
const G = await page.evaluate(async () => {
  const c = SIM.genOJ();
  c.id = 'tip'; c.isTest = false;
  c.oj.orden.finalidad = 'MEDIDA_ASEGURAMIENTO';
  ojEspejar(c); await DB.saveCase(c);
  const out = await buildOficioOJBlob(ojCasoParaDocumento(c), 'CARTA');
  if (!out) return null;
  const dec = new TextDecoder(), f = {};
  Object.keys(out.files).forEach(k => { if (/\.xml$/.test(k)) f[k] = dec.decode(out.files[k]); });
  return { files: f, papel: out.papel };
});
log(!!G, 'El oficio se genera');
const gStyles = G.files['word/styles.xml'];
const gen = await perfilar(G.files['word/document.xml'], gStyles);
const kHdr = Object.keys(G.files).filter(k => /header\d+\.xml$/.test(k));
const kFtr = Object.keys(G.files).filter(k => /footer\d+\.xml$/.test(k));
const genHdr = await perfilar(G.files[kHdr[0]], gStyles);
const genFtr = await perfilar(G.files[kFtr[0]], gStyles);

/* ══ A · ESTÁNDAR ═══════════════════════════════════════════════════════════ */
console.log('\n── A · Estándar tipográfico declarado ──');
const todos = [].concat(gen.parr, genHdr.parr, genFtr.parr);
const runsTip = todos.flatMap(p => p.runs).filter(r => r.tipografico);
const familias = [...new Set(runsTip.map(r => r.font))].sort();
/* ⚠️ El maestro NO usa una sola familia: el cuerpo va en su fuente y el
   membrete, los anexos y el bloque institucional se quedan en la fuente por
   defecto del documento. Esa excepción es del formato, así que la expectativa
   se lee del maestro en vez de fijar un nombre. */
const famRef = [...new Set([].concat(ref.parr, refHdr.parr, refFtr.parr)
  .flatMap(p => p.runs).filter(r => r.tipografico).map(r => r.font))].sort();
log(familias.join() === famRef.join(),
  'Las familias tipográficas son exactamente las del documento maestro',
  `maestro ${famRef.join(' + ')} · generado ${familias.join(' + ')}`);
log(gen.F0 === ref.F0 && gen.SZ0 === ref.SZ0,
  'docDefaults igual al del formato de referencia',
  `generado ${gen.F0} ${gen.SZ0 / 2}pt · referencia ${ref.F0} ${ref.SZ0 / 2}pt`);
const M = gen.mar, cm = t => +(t / 1440 * 2.54).toFixed(2);
log(M.top === ref.mar.top && M.right === ref.mar.right && M.bottom === ref.mar.bottom && M.left === ref.mar.left,
  'Márgenes idénticos a los del formato',
  `sup ${cm(M.top)} · inf ${cm(M.bottom)} · izq ${cm(M.left)} · der ${cm(M.right)} cm`);
log(cm(M.top) >= 3 && cm(M.top) <= 4 && cm(M.bottom) >= 2 && cm(M.bottom) <= 3 &&
    cm(M.left) >= 3 && cm(M.left) <= 4 && cm(M.right) >= 2 && cm(M.right) <= 3,
  'Y dentro de los rangos de la GTC 185 (sup 3-4, inf 2-3, izq 3-4, der 2-3 cm)');
const nivelesGen = [...new Set(runsTip.map(r => r.sz))].sort((a, b) => b - a);
const nivelesRef = [...new Set([].concat(ref.parr, refHdr.parr, refFtr.parr)
  .flatMap(p => p.runs).filter(r => r.tipografico).map(r => r.sz))].sort((a, b) => b - a);
log(nivelesGen.join() === nivelesRef.join(),
  'Los mismos niveles de cuerpo que el maestro, sin añadir ni perder ninguno',
  `maestro ${nivelesRef.map(s => s / 2).join('/')}pt · generado ${nivelesGen.map(s => s / 2).join('/')}pt`);

/* ══ B · GARANTÍA ESTRUCTURAL ═══════════════════════════════════════════════ */
console.log('\n── B · Ningún run se queda sin declarar fuente y tamaño ──');
const sinSz = runsTip.filter(r => !r.szPropio);
const sinFuente = runsTip.filter(r => !r.fontPropia);
log(sinSz.length === 0,
  '⚠️ Cero runs sin `w:sz` propio — un run que hereda sale a 11 pt, no al tamaño de su elemento',
  sinSz.length ? sinSz.slice(0, 4).map(r => JSON.stringify((r.txt || r.instr || '[' + r.fld + ']').slice(0, 18))).join(', ') : `${runsTip.length} runs, todos declarados`);
log(sinFuente.length === 0, 'Cero runs sin `w:rFonts` propio',
  sinFuente.length ? sinFuente.slice(0, 4).map(r => JSON.stringify((r.txt || r.instr).slice(0, 18))).join(', ') : 'todos declarados');

/* ══ C · CONTRA EL FORMATO DE REFERENCIA ════════════════════════════════════ */
console.log('\n── C · Cada clase de elemento, contra el formato de referencia ──');
const buscar = (perfil, re, enTabla) => perfil.parr.find(p =>
  re.test((p.txt || '').trim()) && (enTabla === undefined || p.tabla === enTabla));
const szDe = p => p ? [...new Set(p.runs.filter(r => r.txt).map(r => r.sz))] : null;
const fuDe = p => p ? [...new Set(p.runs.filter(r => r.txt).map(r => r.font))] : null;
const negDe = p => p ? p.runs.filter(r => r.txt).some(r => r.b) : null;

/* ⚠️ «Valor de tabla» busca un VALOR (`CC 1234…`), no una etiqueta. Antes las
   dos entradas apuntaban a celdas de etiqueta y la columna de valores no se
   comprobaba nunca — justo la que cambia con los datos. */
const clases = [
  ['Párrafo de presentación', /^De manera atenta/, false],
  ['Título de numeral',       /IDENTIFICACIÓN DEL (CAPTURADO|APREHENDIDO)/, false],
  ['Etiqueta de tabla',       /^Nombres y apellidos$/, true],
  /* ⚠️ Todos los tipos de documento que puede sacar el simulador, no solo CC:
     en un 15 % de las muestras sale PPT o PA y la comparación se quedaba en
     «no comparable» una corrida de cada siete. */
  ['Valor de tabla',          /^(CC|TI|CE|PPT|PA|RC|NIT) \d/, true],
  ['Bloque de contacto',      /^www\./, false],
  ['Anexos',                  /^Anexos:/, false],
  ['Cargo del firmante',      /^Integrante/, false]
];
clases.forEach(([nombre, re, tabla]) => {
  const a = buscar(ref, re, tabla), b = buscar(gen, re, tabla);
  if (!a || !b) { log(undefined, nombre + ' — no comparable en esta muestra'); return; }
  const sa = szDe(a), sb = szDe(b), fa = fuDe(a), fb = fuDe(b);
  log(sa.join() === sb.join() && fa.join() === fb.join() && negDe(a) === negDe(b),
    nombre + ': misma FUENTE, mismo cuerpo y misma negrita que el maestro',
    `maestro ${fa.join('/')} ${sa.map(s => s / 2).join('/')}pt${negDe(a) ? ' negrita' : ''} · ` +
    `generado ${fb.join('/')} ${sb.map(s => s / 2).join('/')}pt${negDe(b) ? ' negrita' : ''}`);
});
const cuerpoRef = buscar(ref, /^De manera atenta/, false), cuerpoGen = buscar(gen, /^De manera atenta/, false);
log(cuerpoRef.jc === cuerpoGen.jc && cuerpoGen.jc === 'both',
  'El cuerpo va justificado, igual que en el formato', 'jc=' + cuerpoGen.jc);
/* ⚠️ El título del numeral 1 NO siempre dice «CAPTURADO»: si el simulador saca
   el escenario SRPA, el oficio dice «APREHENDIDO» (terminología de menores,
   Ley 1098). Buscar solo «CAPTURADO» dejaba la comparación en `undefined` y la
   suite reventaba en ~1 de cada 5 corridas — fallo preexistente, ajeno a la
   tipografía. Se busca el numeral por su número, que no cambia. */
const tRe = /^1\.\s+IDENTIFICACIÓN DEL/;
const tGen = buscar(gen, tRe, false), tRef = buscar(ref, tRe, false);
log(!!tGen && !!tRef && tGen.estilo === tRef.estilo,
  'Los títulos usan el MISMO estilo de Word que el formato, no formato directo',
  tGen ? 'estilo ' + tGen.estilo + ' · «' + tGen.txt.trim() + '»' : '(sin título)');
const hRef = [...new Set(refHdr.parr.flatMap(p => p.runs).filter(r => r.txt).map(r => r.sz))];
const hGen = [...new Set(genHdr.parr.flatMap(p => p.runs).filter(r => r.txt).map(r => r.sz))];
log(hRef.join() === hGen.join(),
  'Membrete: mismo cuerpo que el formato con el encabezado reajustado (Arial 11)',
  `referencia ${hRef.map(s => s / 2).join('/')}pt · generado ${hGen.map(s => s / 2).join('/')}pt`);
const hFuRef = [...new Set(refHdr.parr.flatMap(p => p.runs).filter(r => r.txt).map(r => r.font))];
const hFuGen = [...new Set(genHdr.parr.flatMap(p => p.runs).filter(r => r.txt).map(r => r.font))];
log(hFuRef.join() === hFuGen.join(),
  '⚠️ Y en la MISMA FUENTE que el maestro: el membrete no sigue a la del cuerpo',
  `maestro ${hFuRef.join('/')} · generado ${hFuGen.join('/')}`);
/* Las 3 tablas, contra las 3 del maestro: fuente y cuerpo. La cifra no se
   escribe aquí — se lee del maestro, que es quien la fija. */
const tblDe = p => [...new Set(p.parr.filter(x => x.tabla).flatMap(x => x.runs)
  .filter(r => r.txt).map(r => r.font + ' ' + r.sz))].sort();
log(tblDe(gen).join() === tblDe(ref).join(),
  'Las 3 tablas del oficio, en la fuente y el cuerpo del maestro',
  `maestro ${tblDe(ref).join(' + ')} · generado ${tblDe(gen).join(' + ')}`);
/* El escudo: medida y anclaje que dejó el usuario en el formato. Flotante para
   que su alto NO arrastre el de la fila del membrete. */
const dib = (t) => {
  const m = t.match(/<wp:(inline|anchor)\b[\s\S]*?<wp:extent cx="(\d+)" cy="(\d+)"/);
  const off = [...t.matchAll(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/g)].map(x => +x[1]);
  return m ? { modo: m[1], cx: +m[2], cy: +m[3], off, wrapNone: /<wp:wrapNone\/>/.test(t) } : null;
};
const eGen = dib(G.files[kHdr[0]]);
const eRef = dib(refHdrPkg['word/header3.xml'].toString('utf8'));
log(!!eGen && !!eRef && eGen.modo === eRef.modo && eGen.cx === eRef.cx && eGen.cy === eRef.cy &&
    eGen.wrapNone === eRef.wrapNone && eGen.off.join() === eRef.off.join(),
  '⚠️ El escudo sale con la medida, el anclaje y el desplazamiento del formato',
  eGen ? `${eGen.modo} ${eGen.cx}×${eGen.cy} EMU off=${eGen.off.join('/')} wrapNone=${eGen.wrapNone}` : '(sin dibujo)');

/* ══ D · EL PIE, RUN POR RUN ════════════════════════════════════════════════ */
console.log('\n── D · El pie de página, incluidos los campos PAGE/NUMPAGES ──');
const rf = refFtr.parr.flatMap(p => p.runs).filter(r => r.tipografico);
const gf = genFtr.parr.flatMap(p => p.runs).filter(r => r.tipografico);
const szRef = [...new Set(rf.map(r => r.sz))], szGen = [...new Set(gf.map(r => r.sz))];
log(szGen.length === 1 && szGen[0] === 18,
  '⚠️ El pie sale a UN solo cuerpo: los números de página ya no salen más grandes que las palabras',
  szGen.map(s => s / 2 + 'pt').join('/'));
log(szRef.join() === szGen.join(), 'Y es el mismo del formato de referencia',
  `referencia ${szRef.map(s => s / 2).join('/')}pt`);
const colGen = [...new Set(gf.map(r => r.color))];
log(colGen.length === 1 && colGen[0] === '404040',
  'Un solo color en el pie, el del formato', colGen.join('/'));
const fuPie = [...new Set(gf.map(r => r.font))];
log(fuPie.join() === [...new Set(rf.map(r => r.font))].join(),
  'Y en la fuente del pie del maestro', fuPie.join('/'));
const campos = gf.filter(r => r.instr || r.fld);
log(campos.length > 0 && campos.every(r => r.szPropio === 18 && r.fontPropia === fuPie[0]),
  '⚠️ Los CINCO runs de cada campo llevan el formato: al repaginar, Word conserva el tamaño',
  campos.length + ' runs de campo');
/* ⚠️ La tabla de fuentes del paquete. El `w:altName` es la sustitución que el
   propio maestro dejó registrada: en un equipo donde la fuente del cuerpo no
   esté instalada, el oficio cae en la fuente base y no en la que el sistema
   escoja. Sin esta parte el nombre de la fuente igual viaja, pero se pierde el
   control de qué pasa cuando falta. */
const ftG = G.files['word/fontTable.xml'] || '';
const refFonts = refPkg['word/fontTable.xml'].toString('utf8');
const altDe = (x, f) => (x.match(new RegExp('<w:font w:name="' + f + '">\\s*<w:altName w:val="([^"]+)"')) || [])[1] || '';
const cuerpoFont = famRef.find(f => f !== gen.F0) || gen.F0;
log(!!ftG && new RegExp('w:name="' + cuerpoFont + '"').test(ftG) && new RegExp('w:name="' + gen.F0 + '"').test(ftG),
  'El paquete declara su tabla de fuentes, con las dos familias del maestro',
  ftG ? 'fontTable.xml presente' : 'FALTA fontTable.xml');
log(altDe(ftG, cuerpoFont) === altDe(refFonts, cuerpoFont) && !!altDe(ftG, cuerpoFont),
  `⚠️ Con el mismo respaldo que registra el maestro para «${cuerpoFont}»`,
  `maestro → ${altDe(refFonts, cuerpoFont) || '(ninguno)'} · generado → ${altDe(ftG, cuerpoFont) || '(ninguno)'}`);

/* ══ E · WORD ↔ PDF ═════════════════════════════════════════════════════════ */
console.log('\n── E · La vista de impresión (PDF) da la misma jerarquía ──');
const V = await page.evaluate(async () => {
  const c = DB.getCase('tip');
  const out = await buildOficioOJBlob(ojCasoParaDocumento(c), 'CARTA');
  const plan = lcPrintDoc(out);
  document.querySelectorAll('#lc-tip-probe').forEach(x => x.remove());
  const cont = document.createElement('div'); cont.id = 'lc-tip-probe';
  const host = document.createElement('div'); host.className = 'pg';
  host.innerHTML = '<style>' + lcPrintCss(plan.papel, plan.M) + '</style>' +
    plan.bloques.map(b => b.html).join('') + plan.ftrDef + plan.hdrFirst;
  cont.appendChild(host); document.body.appendChild(cont);
  const hojas = () => Array.from(host.querySelectorAll('*')).filter(e => e.children.length === 0 && (e.textContent || '').trim());
  function m(re) {
    const el = hojas().find(e => re.test((e.textContent || '').trim()));
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { pt: +(parseFloat(cs.fontSize) * 72 / 96).toFixed(1), fam: cs.fontFamily.split(',')[0].replace(/"/g, ''), peso: cs.fontWeight };
  }
  const r = {
    cuerpo: m(/^De manera atenta/), titulo: m(/IDENTIFICACIÓN DEL (CAPTURADO|APREHENDIDO)/),
    etiqueta: m(/^Nombres y apellidos$/), hechos: m(/^HECHOS$/),
    anexos: m(/^Anexos:/), contacto: m(/^www\./), membrete: m(/^MINISTERIO/),
    piePalabra: m(/^Página$/), pieNumero: null
  };
  const fld = host.querySelector('.fld-num');
  if (fld) r.pieNumero = { pt: +(parseFloat(getComputedStyle(fld).fontSize) * 72 / 96).toFixed(1),
                           fam: getComputedStyle(fld).fontFamily.split(',')[0].replace(/"/g, ''),
                           peso: getComputedStyle(fld).fontWeight };
  cont.remove();
  return r;
});
/* La expectativa del PDF NO se escribe a mano: se lee del MAESTRO, clase por
   clase, igual que la del .docx. Así los dos motores —Word y el navegador— se
   miden contra la misma vara y no pueden divergir en silencio. */
const claseRef = {
  cuerpo:     [ref,    /^De manera atenta/, false],
  titulo:     [ref,    /IDENTIFICACIÓN DEL (CAPTURADO|APREHENDIDO)/, false],
  etiqueta:   [ref,    /^Nombres y apellidos$/, true],
  hechos:     [ref,    /^HECHOS$/, false],
  anexos:     [ref,    /^Anexos:/, false],
  contacto:   [ref,    /^www\./, false],
  membrete:   [refHdr, /^MINISTERIO/, undefined],
  piePalabra: [refFtr, /^Página/, undefined]
};
Object.entries(claseRef).forEach(([k, [perfil, re, tabla]]) => {
  const p = buscar(perfil, re, tabla), v = V[k];
  if (!p) { log(undefined, `PDF · ${k} — no está en el maestro`); return; }
  const pt = szDe(p)[0] / 2, fam = fuDe(p)[0];
  log(!!v && v.pt === pt && v.fam === fam,
    `PDF · ${k}: ${pt} pt en ${fam}, igual que en el maestro y en el .docx`,
    v ? `${v.pt}pt ${v.fam}` : '(no encontrado)');
});
log(!!V.pieNumero && !!V.piePalabra && V.pieNumero.fam === V.piePalabra.fam,
  'PDF · el número de página va en la misma fuente que la palabra «Página»',
  V.pieNumero ? `${V.piePalabra.fam} vs ${V.pieNumero.fam}` : '(sin campo)');
log(V.pieNumero && V.piePalabra && V.pieNumero.pt === V.piePalabra.pt,
  '⚠️ En el PDF el número de página mide lo mismo que la palabra «Página»',
  V.pieNumero ? `${V.piePalabra.pt}pt vs ${V.pieNumero.pt}pt` : '(sin campo)');

/* ══ F · LOS DATOS NO CAMBIAN LA TIPOGRAFÍA ═════════════════════════════════ */
console.log('\n── F · Distintas cantidades de información, misma tipografía ──');
const F = await page.evaluate(async () => {
  async function perfilDe(mut) {
    const c = SIM.genOJ(); c.id = 'tipv'; c.isTest = false;
    c.oj.orden.finalidad = 'MEDIDA_ASEGURAMIENTO';
    mut(c); ojEspejar(c); await DB.saveCase(c);
    const out = await buildOficioOJBlob(ojCasoParaDocumento(c), 'CARTA');
    const dec = new TextDecoder();
    const p = window.__perf(dec.decode(out.files['word/document.xml']), dec.decode(out.files['word/styles.xml']));
    const kf = Object.keys(out.files).find(k => /footer\d+\.xml$/.test(k));
    const pf = window.__perf(dec.decode(out.files[kf]), dec.decode(out.files['word/styles.xml']));
    const rs = [].concat(p.parr, pf.parr).flatMap(x => x.runs).filter(r => r.tipografico);
    return { sizes: [...new Set(rs.map(r => r.sz))].sort((a, b) => a - b).join('/'),
             fuentes: [...new Set(rs.map(r => r.font))].join('/'),
             sinSz: rs.filter(r => !r.szPropio).length,
             paginas: p.parr.length };
  }
  const corto = await perfilDe(c => {
    c.oj.actuacion.observaciones = 'Sin novedad.';
    c.oj.requerido.senalesParticulares = '';
    c.oj.actuacion.anexos = [];
  });
  const largo = await perfilDe(c => {
    c.oj.actuacion.observaciones = ('La persona requerida fue ubicada en la dirección indicada. ').repeat(24);
    c.oj.requerido.senalesParticulares = ('Cicatriz visible en el antebrazo izquierdo. ').repeat(8);
  });
  return { corto, largo };
});
log(F.corto.sizes === F.largo.sizes,
  'Un oficio breve y uno extenso usan exactamente los mismos cuerpos de letra',
  `breve ${F.corto.sizes.split('/').map(s => s / 2).join('/')}pt · extenso ${F.largo.sizes.split('/').map(s => s / 2).join('/')}pt`);
log(F.corto.fuentes === F.largo.fuentes && F.largo.fuentes.split('/').sort().join() === famRef.join(),
  'Y las mismas familias del maestro, con cualquier volumen de datos',
  `breve ${F.corto.fuentes} · extenso ${F.largo.fuentes}`);
log(F.corto.sinSz === 0 && F.largo.sinSz === 0,
  'En ningún caso aparece un run sin tamaño declarado',
  `breve ${F.corto.sinSz} · extenso ${F.largo.sinSz}`);

log(errores.length === 0, 'Consola sin errores', errores.slice(0, 3).join(' | ') || 'ninguno');
console.log(`\n${fails === 0 ? '✅ TODO OK' : '❌ ' + fails + ' FALLO(S)'} — ${n} comprobaciones`);
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
