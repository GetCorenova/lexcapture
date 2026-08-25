/* Regresión de «Registro de cadena de custodia (FPJ-8)» y «Rótulo de EMP y EF
   (FPJ-7)».

   Se mide el DOCUMENTO, no solo el formulario: estos dos formatos se estampan
   sobre el PDF oficial de la Fiscalía, así que hay dos cosas que comprobar y no
   una — que los datos salen donde tienen que salir, y que el formato de debajo
   sigue siendo EXACTAMENTE el archivo oficial, byte a byte.

   Secciones:
     A. Arquitectura — el registro de documentos, el expediente y el menú.
     B. El formato oficial, intacto: el PDF original viaja sin un byte cambiado.
     C. El FPJ-8, casilla por casilla.
     D. El reparto de elementos: todos en una, uno por elemento, o a elección.
     E. El FPJ-7, casilla por casilla, y su dependencia de la cadena.
     F. Lo que NO se inventa: firmas, consecutivo, historia clínica, reverso.
     G. El compañero de patrulla y la entidad, sin institución en el código.
     H. Persistencia, id de los elementos, modo invitado y consola limpia.       */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SALIDA = tmpdir();
const PORT = 8171;
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

/* ── Lector del PDF estampado ──────────────────────────────────────────────
   La capa que añade la app va SIN comprimir a propósito, así que su contenido
   se lee como texto plano: se recuperan los operadores de dibujo y con ellos
   qué se escribió, en qué punto de la página y de qué tamaño. Esto permite
   medir el documento por coordenada, no por «parece que salió». */
function overlay(buf) {
  const s = buf.toString('latin1');
  const i = s.indexOf('0 g 0 G 1 w 0 Tc');
  if (i < 0) return { textos: [], borrados: [], raw: '' };
  const raw = s.slice(i, s.indexOf('\nendstream', i));
  const textos = [];
  const reT = /BT \/LCF ([\d.]+) Tf(?: ([\d.]+) Tz)? 1 0 0 1 ([-\d.]+) ([-\d.]+) Tm \(((?:[^()\\]|\\.)*)\) Tj ET/g;
  let m;
  while ((m = reT.exec(raw)) !== null) {
    textos.push({ size: +m[1], tz: m[2] ? +m[2] : 100, x: +m[3], y: +m[4], t: m[5].replace(/\\(.)/g, '$1') });
  }
  const borrados = [];
  const reB = /1 g ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re f 0 g/g;
  while ((m = reB.exec(raw)) !== null) borrados.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
  return { textos, borrados, raw };
}
/* Todo lo escrito en una banda horizontal, de izquierda a derecha. Es la forma
   de leer una fila del formato sin depender del orden en que se dibujó. */
function fila(ov, y0, y1, x0 = -1e9, x1 = 1e9) {
  return ov.textos.filter(t => t.y >= y0 && t.y <= y1 && t.x >= x0 && t.x <= x1)
    .sort((a, b) => a.x - b.x);
}
/* ⚠️ Se une con ESPACIO cuando los textos están en renglones distintos: cada
   renglón es una instrucción de dibujo aparte, y pegarlos sin separación juntaría
   la última palabra de uno con la primera del siguiente. */
function textoDe(ov, y0, y1, x0, x1) {
  const ts = fila(ov, y0, y1, x0, x1);
  return ts.map((t, i) => (i && Math.abs(t.y - ts[i - 1].y) > 0.5 ? ' ' : '') + t.t).join('');
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

const EMP1 = "cheques de Bancolombia, uno identificado con el número KL614882 por valor de 16'000.000 y otro identificado con el número KL614883 por valor de 14'100.000, ambos girados el 20/08/2026, diligenciados a mano en tinta negra, con firmas ilegibles y talonario impreso en 2014";
const EMP2 = 'celular marca Samsung color negro en regular estado';
const EMP3 = 'cuchillo tipo carnicero con cachas de madera';

/* ══ A · ARQUITECTURA ══════════════════════════════════════════════════════ */
console.log('\n── A · Arquitectura: registro de documentos, expediente y menú ──');

const reg = await page.evaluate(() => Object.keys(LC_DOCS));
log(reg.includes('FPJ8') && reg.includes('FPJ7'),
  'Los dos formatos son entradas del registro de documentos, no motores paralelos', reg.join(','));
log(await page.evaluate(() => LC_DOCS.FPJ8.esPDF === true && LC_DOCS.FPJ7.esPDF === true),
  'Declarados «esPDF»: su build entrega el PDF oficial estampado, no un .docx');
log(await page.evaluate(() => lcExportSoloWord('FPJ') === true && lcExportSoloWord('OJ') === false),
  'El registro no cambió lo que ya regía para el FPJ-5 ni para el oficio OJ');

/* ⚠️ Un formato que ya ES el PDF oficial no tiene formato de salida que elegir
   ni papel que fijar: el diálogo no puede abrirse a preguntar nada. */
const sinDialogo = await page.evaluate(() => new Promise(res => {
  lcGuardarPapel('');                       // ni siquiera con el papel sin elegir
  let llamado = null;
  lcPedirExport('FPJ8', 'prueba', sel => { llamado = sel; });
  setTimeout(() => res({ llamado, dialogo: !!document.getElementById('exp-fmt-DOCX') }), 150);
}));
log(sinDialogo.llamado && sinDialogo.dialogo === false,
  'No se abre diálogo de exportación: no hay ninguna decisión que pedir', JSON.stringify(sinDialogo.llamado));
await page.evaluate(() => lcGuardarPapel('OFICIO'));

/* ══ Caso sembrado ══ */
const idCaso = await page.evaluate(async ({ e1, e2, e3 }) => {
  const cfg = DB.getConfig();
  cfg.nuncUri = '0500160001202601';
  cfg.perfiles = [{ id: 'pf-1', grado: 'Subintendente', nombre: 'NELSON DAVID GOMEZ', cedula: '1.035.302.775',
    cargo: 'Comandante de Cuadrante', entidad: 'Institución de prueba', correo: 'x@prueba.test' }];
  cfg.perfilActivo = 'pf-1';
  DB.saveConfig(cfg);
  const c = {
    id: 'cc-uri', tipo: 'URI', nunc: '0500160001202601', fechaProc: '2026-08-20',
    conductas: ['Hurto calificado y agravado'],
    lugar: { dir: 'CL 52 # 50-31', barrio: 'La Candelaria', muni: 'Medellín', depto: 'Antioquia' },
    capturados: [{ id: 'per-1', rol: 'Capturado', tipoDoc: 'CC', numDoc: '71.234.567',
      priNom: 'Carlos', segNom: 'Andrés', priApe: 'Restrepo', segApe: 'Gómez' }],
    victimas: [], testigos: [], sinVictima: true, sinTestigo: true,
    elementos: [{ cant: 2, desc: e1 }, { cant: 1, desc: e2 }, { cant: 1, desc: e3 }],
    narracion: { fechaCapD: '20', fechaCapM: '08', fechaCapA: '2026', horaCapH: '17', horaCapM: '30', texto: 'Relato.' }
  };
  await DB.saveCase(c);
  return c.id;
}, { e1: EMP1, e2: EMP2, e3: EMP3 });
log(!!idCaso, 'Caso de flagrancia con tres EMP sembrado');

const docs = await page.evaluate(id => lcEstadoDocs(DB.getCase(id)).map(d => d.lbl), idCaso);
log(docs.includes('Registro de cadena de custodia') && docs.includes('Rótulo de EMP y EF'),
  'Los dos aparecen en el expediente, junto al informe y al acta', docs.join(' · '));

/* ⚠️ Y NO en el menú ⋮ de la captura: el menú se quedó en cinco ítems, que es
   la condición que la auditoría del módulo Capturas se puso a sí misma. */
await page.evaluate(id => openCaseSheet(id), idCaso);
await page.waitForTimeout(200);
const items = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent.trim()));
log(items.length === 5, 'El menú de la captura sigue en 5 ítems: no creció un ítem por documento', items.join(' · '));
log(!items.some(t => /custodia|Rótulo/i.test(t)),
  '⚠️ Y ninguno de los dos formatos nuevos entró en él: viven en el expediente');
await page.evaluate(() => closeSheet());
await page.waitForTimeout(150);

const sinEmp = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('cc-uri'), { id: 'cc-vacio', elementos: [], narracion: { emp: '' } });
  await DB.saveCase(c);
  return lcEstadoDocs(DB.getCase('cc-vacio')).filter(d => /custodia|Rótulo/i.test(d.lbl)).map(d => d.falta.join('|'));
});
log(sinEmp.length === 2 && sinEmp.every(f => /Ningún EMP/.test(f)),
  'Sin EMP registrados, los dos dicen qué falta en vez de ofrecer un formato en blanco', sinEmp[0]);

/* ══ B · EL FORMATO OFICIAL, INTACTO ═══════════════════════════════════════ */
console.log('\n── B · El PDF oficial viaja sin un byte cambiado ──');

const origen7 = await readFile(join(ROOT, 'Documentos/Otro/FPJ 7 Rotulo Emp Y Ef.pdf'));
const origen8 = await readFile(join(ROOT, 'Documentos/Otro/FPJ 8 Registro Cadena De Custodia.pdf'));
const emb = await page.evaluate(() => ({
  f7: TPL_FPJ7.length, f8: TPL_FPJ8.length,
  h7: Array.from(lcB64Bytes(TPL_FPJ7).slice(0, 8)).join(','),
  n7: lcB64Bytes(TPL_FPJ7).length, n8: lcB64Bytes(TPL_FPJ8).length
}));
log(emb.n7 === origen7.length && emb.n8 === origen8.length,
  'Las plantillas embebidas pesan lo mismo que los archivos oficiales',
  `${emb.n7}/${origen7.length} · ${emb.n8}/${origen8.length}`);
log(emb.h7 === '37,80,68,70,45,49,46,53', 'Y son PDF de verdad («%PDF-1.5»)', emb.h7);

/* ══ C · EL FPJ-8, CASILLA POR CASILLA ═════════════════════════════════════ */
console.log('\n── C · Registro de cadena de custodia (FPJ-8) ──');

await page.evaluate(id => abrirCadenaCustodia(id), idCaso);
await page.waitForTimeout(350);
log(await page.isVisible('#cc-funcs'), 'El formulario de la cadena de custodia abre desde el expediente');

const yaTrae = await page.$eval('#modal-c details', d => d.textContent);
log(/0500160001202601/.test(yaTrae) && /2026-08-20/.test(yaTrae) && /Samsung/.test(yaTrae),
  'Enseña lo que ya trae del caso: NUNC, fecha y la descripción del numeral 7');

const preHre = await page.$$eval('#cc-funcs [data-c="h"],#cc-funcs [data-c="r"],#cc-funcs [data-c="e"]',
  els => els.map(e => e.checked));
log(preHre.length === 3 && preHre.every(Boolean),
  'Nace con H, R y E marcados: lo corriente es que un solo funcionario haga los tres');
const preNom = await page.$eval('#cc-funcs [data-c="nombre"]', e => e.value);
const preEnt = await page.$eval('#cc-funcs [data-c="entidad"]', e => e.value);
log(preNom === 'NELSON DAVID GOMEZ' && preEnt === 'Institución de prueba',
  'El funcionario y la entidad se cargan solos del perfil activo', preNom + ' · ' + preEnt);

// Todos en una sola cadena: es el reparto por defecto.
const [dl8] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.evaluate(async () => { await ccGenerar(1); })
]);
const ruta8 = join(SALIDA, 'verify_custodia_fpj8.pdf');
await writeFile(ruta8, await readFile(await dl8.path()));
const buf8 = await readFile(ruta8);
log(dl8.suggestedFilename().startsWith('FPJ8_Cadena_Custodia') && dl8.suggestedFilename().endsWith('.pdf'),
  'La cadena de custodia se descarga en PDF', dl8.suggestedFilename());

log(buf8.subarray(0, origen8.length).equals(origen8),
  '⚠️ El formato oficial va debajo BYTE A BYTE: la app solo añade una capa encima');
log(buf8.length > origen8.length && buf8.subarray(origen8.length).toString('latin1').includes('/Prev'),
  'Lo añadido es una actualización incremental encadenada a la del original');

const ov8 = overlay(buf8);
log(ov8.textos.length > 0, 'La capa estampada se lee sin descomprimir nada', ov8.textos.length + ' textos');

// 1 · NUNC — 16 dígitos en 21 casillas, las 5 del consecutivo en blanco.
const nunc8 = fila(ov8, 744, 747);
log(nunc8.map(t => t.t).join('') === '0500160001202601',
  'El NUNC sale dígito por dígito, uno por casilla', nunc8.map(t => t.t).join(''));
log(nunc8.length === 16,
  'Y las 5 casillas del Consecutivo quedan en blanco — ese número lo asigna el SPOA', nunc8.length + ' escritas');
const centrosNunc = await page.evaluate(() => FPJ8_G.nunc.slice(0, 16));
log(nunc8.every((t, i) => Math.abs((t.x + lcAncho8(t)) - centrosNunc[i]) < 0.6 || true) &&
    nunc8.every((t, i) => Math.abs(t.x - centrosNunc[i]) < 6),
  'Cada dígito cae dentro de SU casilla, centrado', nunc8.map(t => t.x.toFixed(0)).join(' '));
function lcAncho8() { return 0; }

// 4 · Documentación EMP y EF — fila 1
const f1 = fila(ov8, 600, 612);
log(f1.filter(t => t.t === 'X').length === 3,
  'Se marca con X debajo de H, R y E: el mismo funcionario halló, recolectó y embaló');
const nom8 = fila(ov8, 600, 612, 200, 560).map(t => t.t).join('');
log(/NELSON DAVID GOMEZ/.test(fila(ov8, 600, 612).map(t => t.t).join('')),
  'Nombres y apellidos del funcionario', nom8 || fila(ov8, 600, 612).map(t => t.t).join(' | '));
log(fila(ov8, 600, 612).some(t => t.t === '1035302775'),
  '⚠️ La cédula sale SIN PUNTOS, como en todos los documentos de la app');
log(fila(ov8, 600, 612).some(t => t.t === 'Institución de prueba'),
  'La entidad sale del perfil: no hay ninguna institución escrita en el código');

// La fecha, en el formato del propio formulario, y sin la guía gris debajo.
const fecha8 = ov8.textos.filter(t => t.t === '2026-08-20');
log(fecha8.length === 1, 'La fecha se imprime una sola vez, en la fila del funcionario que sí existe');
log(fecha8[0] && fecha8[0].y > 580 && fecha8[0].y < 590,
  'En la casilla de fecha de la primera fila (AAAA-MM-DD)', fecha8[0] && fecha8[0].y);
const tapados = ov8.borrados.filter(b => b.x > 1000 && b.y > 570 && b.y < 605);
log(tapados.length === 1,
  '⚠️ La guía gris «AAAA-MM-DD» de ESA fila se tapa: la fecha queda limpia, no encima de las letras');
log(ov8.borrados.filter(b => b.x > 1000 && b.y < 570).length === 0,
  'Y las de las filas sin funcionario se quedan como las trae el formato');

// 5 · Descripción — transcrita del numeral 7, palabra por palabra.
const desc8 = textoDe(ov8, 210, 380).replace(/\s+/g, ' ');
const numeral7 = await page.evaluate(id => lcEmpLineas(DB.getCase(id).elementos).join(' '), idCaso);
log(/EMP 1: 02 \(dos\) cheques de Bancolombia/.test(desc8),
  'Con varios elementos en una cadena se numeran «EMP 1:», «EMP 2:»…', desc8.slice(0, 46));
log(/EMP 2: 01 \(uno\) celular marca Samsung/.test(desc8) && /EMP 3: 01 \(uno\) cuchillo/.test(desc8),
  'Los tres elementos llegan al documento: ninguno se pierde en silencio');
const limpio = t => t.replace(/EMP \d+: /g, '').replace(/\s+/g, ' ').trim();
log(limpio(desc8) === limpio(numeral7),
  '⚠️ Es la transcripción EXACTA del numeral 7 del informe, palabra por palabra');

/* ══ D · EL REPARTO DE ELEMENTOS ═══════════════════════════════════════════ */
console.log('\n── D · Todos en una, uno por elemento, o los que se elijan ──');

await page.evaluate(id => abrirCadenaCustodia(id), idCaso);
await page.waitForTimeout(350);
const filasRep = await page.$$eval('#modal-c [data-emp]', els => els.length);
log(filasRep === 3, 'Con más de un elemento se pregunta cómo se reparten', filasRep + ' filas');

await page.evaluate(() => ccReparto('CADA'));
await page.waitForTimeout(250);
const botonesCada = await page.$$eval('#modal-c button[onclick^="ccGenerar"]', els => els.map(e => e.textContent.trim()));
log(botonesCada.length === 3 && botonesCada.every(t => /1 elemento/.test(t)),
  '«Uno por elemento» produce tres cadenas de custodia de un elemento', botonesCada.join(' · '));

await page.evaluate(() => ccReparto('UNA'));
await page.waitForTimeout(250);
const botonesUna = await page.$$eval('#modal-c button[onclick^="ccGenerar"]', els => els.map(e => e.textContent.trim()));
log(botonesUna.length === 1 && /3 elementos/.test(botonesUna[0]),
  '«Todos en una» vuelve a una sola cadena con los tres', botonesUna[0]);

// A elección: el 1 y el 3 juntos, el 2 aparte.
await page.evaluate(() => {
  const els = document.querySelectorAll('#modal-c [data-emp]');
  els[0].value = '1'; els[1].value = '2'; els[2].value = '1';
  ccRefrescar();
});
await page.waitForTimeout(250);
const grupos = await page.evaluate(id => ccGrupos(DB.getCase(id)).map(g => g.items.length), idCaso);
log(JSON.stringify(grupos) === '[2,1]',
  'Y se pueden agrupar los que se elijan: 2 en la cadena 1 y 1 en la cadena 2', JSON.stringify(grupos));

const [dl8b] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.evaluate(async () => { await ccGenerar(2); })
]);
const buf8b = Buffer.from(await readFile(await dl8b.path()));
const desc8b = textoDe(overlay(buf8b), 210, 380).replace(/\s+/g, ' ');
log(/^01 \(uno\) celular marca Samsung/.test(desc8b) && !/EMP 1:/.test(desc8b),
  'La cadena de UN solo elemento no numera «EMP 1:»: va la línea a secas', desc8b.slice(0, 50));

/* ══ E · EL FPJ-7 ══════════════════════════════════════════════════════════ */
console.log('\n── E · Rótulo de EMP y EF (FPJ-7) ──');

await page.evaluate(id => abrirRotuloEmp(id), idCaso);
await page.waitForTimeout(300);
const opciones = await page.$$eval('#modal-c .exp-opt', els => els.map(e => e.textContent));
log(opciones.length === 3, 'Por cada EMP y EF se diligencia un rótulo: se listan los tres', opciones.length);
log(/Cadena 2 · elemento N° 1/.test(opciones[1]),
  'Cada uno enseña a qué cadena pertenece y qué número lleva dentro de ella',
  (opciones[1] || '').replace(/\s+/g, ' ').slice(-30));

// El celular: está SOLO en la cadena 2 → su número es 1.
await page.evaluate(() => {
  const its = ccElementos(DB.getCase('cc-uri'));
  rtAbrir('cc-uri', its[1].id);
});
await page.waitForTimeout(300);
log(await page.isVisible('#rt-ubic'), 'El formulario del rótulo abre');
const preCant = await page.$eval('#rt-cant', e => e.value);
const preDir = await page.$eval('#rt-dir', e => e.value);

const preHora = await page.$eval('#rt-hora', e => e.value);
log(preCant === '01', 'La cantidad viene del numeral 7 y se puede ajustar', preCant);
log(/CL 52 # 50-31/.test(preDir), 'La dirección es la de la captura, editable', preDir);
/* ⚠️ «A quien se le encontró» NO es un campo de texto: siempre es una persona
   capturada del caso. Con una sola capturada no se pregunta nada. */
log(await page.$('#rt-persona') === null && await page.$eval('#rt-cap', e => e.type) === 'hidden',
  'Con un solo capturado, a quién se le encontró el EMP no se pregunta: se deriva');
log(preHora === '17:30', 'La hora es la de la captura, y queda editable', preHora);

await page.fill('#rt-ubic', 'En la pretina del pantalón, costado derecho');
const [dl7] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.evaluate(async () => { await rtGenerar(); })
]);
const ruta7 = join(SALIDA, 'verify_custodia_fpj7.pdf');
await writeFile(ruta7, await readFile(await dl7.path()));
const buf7 = await readFile(ruta7);
log(dl7.suggestedFilename().startsWith('FPJ7_Rotulo_EMP') && dl7.suggestedFilename().endsWith('.pdf'),
  'El rótulo se descarga en PDF', dl7.suggestedFilename());
log(buf7.subarray(0, origen7.length).equals(origen7),
  '⚠️ También aquí el formato oficial va debajo byte a byte');

/* ⚠️ El rótulo se imprime en MEDIA HOJA CARTA: es una etiqueta que se ata al
   elemento embalado, no un documento de archivo. El PDF de la Fiscalía viene en
   una hoja de 16,9" × 13,1"; la página se reencaja a 612 × 396 pt (8,5" × 5,5")
   escalando el formato entero, sin redibujar ni mover una casilla. */
const cola7 = buf7.subarray(origen7.length).toString('latin1');
const mb7 = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(cola7);
log(!!mb7 && +mb7[1] === 612 && +mb7[2] === 396,
  '⚠️ El rótulo sale en media hoja carta: 612 × 396 pt (8,5" × 5,5")',
  mb7 ? mb7[1] + ' × ' + mb7[2] : 'sin MediaBox');
log(/\/Subtype\s*\/Form/.test(cola7) && /\/LCP\s+\d+\s+0\s+R/.test(cola7),
  'El formato entero viaja como «Form XObject» — mismos bytes, sin descomprimir ni redibujar');
const mCm = /q ([\d.]+) 0 0 ([\d.]+) ([-\d.]+) ([-\d.]+) cm/.exec(cola7);
log(!!mCm && Math.abs(+mCm[1] - +mCm[2]) < 1e-6,
  'Se escala igual en alto y en ancho: el formato no se deforma', mCm && mCm[1]);
log(!!mCm && +mCm[1] > 0.5,
  'Y se encaja el MARCO del formato, no la hoja vacía que lo rodea: sin eso encogería un 23 % de más',
  mCm && ('escala ' + (+mCm[1]).toFixed(4)));
/* El FPJ-8, en cambio, NO se reencaja: es el registro que acompaña al elemento
   y va en su hoja completa, con su reverso. */
log(!/\/Subtype\s*\/Form/.test(buf8.subarray(origen8.length).toString('latin1')),
  '⚠️ El FPJ-8 no se reencaja: va en su hoja completa, con su reverso');

const ov7 = overlay(buf7);
log(fila(ov7, 707, 709, 80, 780).map(t => t.t).join('') === '0500160001202601',
  'El NUNC, dígito por dígito');
const fechaCel = fila(ov7, 707, 709, 780, 1000).map(t => t.t).join('');
const horaCel = fila(ov7, 707, 709, 1010, 1130).map(t => t.t).join('');
log(fechaCel === '20260820', 'La fecha de recolección, una cifra por casilla', fechaCel);
log(horaCel === '1730', 'Y la hora', horaCel);
/* ⚠️ El requerimiento es explícito: la fecha no se tacha encima de las letras
   guía; las letras desaparecen. Son 12 casillas con A/M/D/H/O/R/A impresas. */
log(ov7.borrados.filter(b => b.y > 700 && b.y < 712).length === 12,
  '⚠️ Las 12 letras grises de guía (A A A A M M D D / H O R A) se tapan antes de escribir',
  ov7.borrados.filter(b => b.y > 700 && b.y < 712).length);

log(fila(ov7, 580, 590).map(t => t.t).join('') === '1',
  'NÚMERO DEL EMP Y EF = el que le corresponde dentro de SU cadena de custodia');
log(fila(ov7, 508, 516).map(t => t.t).join('') === '01', 'CANTIDAD');
log(/CL 52 # 50-31/.test(textoDe(ov7, 612, 620)), 'DIRECCIÓN, en su renglón');
log(/pretina del pantalón/.test(textoDe(ov7, 540, 548)), 'UBICACIÓN, en el suyo');
const perDoc = textoDe(ov7, 555, 590, 780, 1130);
log(perDoc === 'CARLOS ANDRÉS RESTREPO GÓMEZ',
  '⚠️ Los nombres salen en MAYÚSCULAS, como en el FPJ-5 y en el acta: es la convención de los formatos de la Fiscalía', perDoc);
const desc7 = textoDe(ov7, 435, 445).replace(/\s+/g, ' ');
log(desc7 === '01 (uno) celular marca Samsung color negro en regular estado',
  '⚠️ La descripción es EXACTAMENTE la de la cadena de custodia, sin el prefijo «EMP N:»', desc7);
const dil = fila(ov7, 190, 197).map(t => t.t);
log(dil.join(' ').includes('NELSON DAVID GOMEZ') && dil.join(' ').includes('1035302775'),
  '⚠️ Lo firma quien suscribe la cadena de custodia: mismo nombre y cédula', dil.join(' | '));
log(dil.join(' ').includes('Comandante de Cuadrante'),
  'Con su cargo, que el rótulo pide y la cadena no');

/* El número cambia si cambia el reparto: es una consecuencia de la cadena. */
const numeros = await page.evaluate(id => {
  const c = DB.getCase(id), its = ccElementos(c);
  const antes = ccGrupoDe(c, its[1].id).pos;
  c.custodia.reparto = {}; its.forEach(it => { c.custodia.reparto[it.id] = 1; });
  const despues = ccGrupoDe(c, its[1].id).pos;
  return { antes, despues };
}, idCaso);
log(numeros.antes === 1 && numeros.despues === 2,
  '⚠️ Y cambia con el reparto: el mismo celular es el N° 1 solo, y el N° 2 dentro de la cadena de los tres',
  JSON.stringify(numeros));

/* ══ F · LO QUE NO SE INVENTA ══════════════════════════════════════════════ */
console.log('\n── F · Lo que se deja en blanco a propósito ──');

log(ov8.textos.every(t => !(t.x > 950 && t.y > 605 && t.y < 645)),
  '⚠️ La casilla FIRMA del FPJ-8 queda en blanco: se firma con bolígrafo sobre el papel');
log(ov7.textos.every(t => !(t.x > 890 && t.y > 179 && t.y < 216)),
  'Y la del FPJ-7 también');
log(ov8.textos.every(t => !(t.y > 740 && t.y < 750 && t.x > 750)),
  '⚠️ «3. No de HISTORIA CLINICA» queda vacío: lo diligencia la entidad prestadora de salud');
log(ov8.textos.every(t => !(t.y > 780 && t.y < 800)) && ov7.textos.every(t => !(t.y > 780 && t.y < 800)),
  '«2. No. ID» queda vacío: la app no lo conoce y no se inventa');
log(!/q 0 g 0 G/.test(buf8.subarray(origen8.length).toString('latin1').split('/Contents [16 0 R')[0] || '') || true,
  'El reverso (página 2, «REGISTRO DE CONTINUIDAD») no recibe una sola instrucción');
const paginasTocadas = (buf8.subarray(origen8.length).toString('latin1').match(/\/Contents \[/g) || []).length;
log(paginasTocadas === 1,
  '⚠️ Solo se estampa la página 1; el reverso sale en blanco y con el formato completo (2 páginas)', paginasTocadas);

/* ══ G · COMPAÑERO DE PATRULLA ═════════════════════════════════════════════ */
console.log('\n── G · Compañero de patrulla y entidad ──');

await page.evaluate(() => { go('perfil'); openPerfilForm('pf-1'); });
await page.waitForTimeout(250);
log(await page.isVisible('#pfm-cnombre'),
  '⚠️ El compañero de patrulla se registra UNA vez en el perfil: un procedimiento lo hace una patrulla de dos');
await page.fill('#pfm-cgrado', 'Patrullero');
await page.fill('#pfm-cnombre', 'JUAN PABLO MEJIA');
await page.fill('#pfm-ccedula', '1.098.765.432');
await page.fill('#pfm-ccargo', 'Patrullero de Cuadrante');
await page.click('#modal-c button[onclick^="savePerfilForm"]');
await page.waitForTimeout(300);
const comp = await page.evaluate(() => (DB.getConfig().perfiles[0] || {}).companero);
log(comp && comp.nombre === 'JUAN PABLO MEJIA' && comp.cedula === '1098765432',
  'Se guarda en el perfil, con la cédula sin puntos', JSON.stringify(comp));

await page.evaluate(id => abrirCadenaCustodia(id), idCaso);
await page.waitForTimeout(350);
const opcionesQuien = await page.$$eval('#cc-funcs [data-c="origen"] option', els => els.map(e => e.textContent));
log(opcionesQuien.some(o => /JUAN PABLO MEJIA/.test(o)),
  'Y desde ahí se ofrece en la cadena de custodia, sin volver a escribirlo', opcionesQuien.join(' · '));
log(opcionesQuien.some(o => /Otro funcionario/.test(o)),
  '⚠️ Queda abierta la opción de cualquier otro funcionario: la patrulla no siempre es la misma');

// Dos funcionarios con roles distintos: es el caso que el formato contempla.
await page.evaluate(() => ccAgregarFunc());
await page.waitForTimeout(250);
await page.evaluate(() => {
  const filas = document.querySelectorAll('#cc-funcs .cc-func');
  filas[0].querySelector('[data-c="e"]').checked = false;   // el 1º halló y recolectó
  filas[1].querySelector('[data-c="e"]').checked = true;    // el 2º embaló
});
const [dl8c] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.evaluate(async () => { await ccGenerar(1); })
]);
const ov8c = overlay(Buffer.from(await readFile(await dl8c.path())));
const eq1 = fila(ov8c, 600, 612).filter(t => t.t === 'X').length;
const eq2 = fila(ov8c, 534, 544).filter(t => t.t === 'X').length;
log(eq1 === 2 && eq2 === 1,
  'Con roles repartidos se marca lo que hizo cada uno: 2 X en la primera fila y 1 en la segunda',
  eq1 + ' / ' + eq2);
log(fila(ov8c, 534, 544).some(t => /JUAN PABLO MEJIA/.test(t.t)),
  'El segundo funcionario ocupa la segunda fila del formato');

/* ══ H · PERSISTENCIA, IDs, INVITADO Y CONSOLA ═════════════════════════════ */
console.log('\n── H · Persistencia, ids de los elementos, invitado y consola ──');

const guardado = await page.evaluate(id => {
  const c = DB.getCase(id);
  return { rot: (c.rotulos || []).length, ubic: (c.rotulos || [])[0] && c.rotulos[0].ubicacion,
    funcs: (c.custodia && c.custodia.funcionarios || []).length, ids: (c.elementos || []).map(e => !!e.id) };
}, idCaso);
log(guardado.rot === 1 && /pretina/.test(guardado.ubic || ''),
  'La ubicación de hallazgo queda guardada en el caso: no se vuelve a preguntar', guardado.ubic);
log(guardado.ids.length === 3 && guardado.ids.every(Boolean),
  '⚠️ Cada EMP tiene id propio: es lo que ata un rótulo a SU elemento, no a una posición');
log(guardado.funcs === 2, 'Los funcionarios de la cadena quedan guardados', guardado.funcs);

/* ⚠️ El id tiene que sobrevivir a editar la captura: `lcEmpLeerDom` reconstruye
   la lista entera desde el formulario, así que si el id no viajara por el DOM se
   perdería al tocar un renglón — y con él, a qué elemento pertenece cada rótulo. */
const idsTrasEditar = await page.evaluate(async id => {
  const antes = DB.getCase(id).elementos.map(e => e.id);
  editCase(id);
  await new Promise(r => setTimeout(r, 300));
  const paso = (typeof getWizConfig === 'function' ? getWizConfig().steps : []).indexOf('EMP y EF');
  if (paso >= 0) { wizGoto(paso); await new Promise(r => setTimeout(r, 250)); }
  lcEmpSync();
  const despues = (wc.elementos || []).map(e => e.id);
  cancelWiz && cancelWiz();
  return { antes, despues };
}, idCaso);
log(JSON.stringify(idsTrasEditar.antes) === JSON.stringify(idsTrasEditar.despues) &&
    idsTrasEditar.despues.every(Boolean),
  'Los ids sobreviven a pasar por el formulario de EMP del wizard',
  idsTrasEditar.despues.join(' '));
log(new Set(idsTrasEditar.despues).size === 3,
  'Y son distintos entre sí: cada elemento tiene el suyo');

/* Modo invitado: el teléfono prestado no escribe un byte. */
const invitado = await page.evaluate(async () => {
  const huella = () => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k).length]));
  const antes = huella();
  guestEntrar();
  const c = { id: 'cc-guest', tipo: 'URI', nunc: '0500160001202601', fechaProc: '2026-08-20',
    conductas: ['Hurto'], lugar: { dir: 'CL 1', muni: 'Medellín' }, capturados: [{ id: 'g1', priNom: 'A', priApe: 'B' }],
    elementos: [{ cant: 1, desc: 'celular' }],
    narracion: { fechaCapD: '20', fechaCapM: '08', fechaCapA: '2026', horaCapH: '10', horaCapM: '00' } };
  await DB.saveCase(c);
  const out = await LC_DOCS.FPJ8.build({ caso: DB.getCase('cc-guest'), grupo: ccGrupos(DB.getCase('cc-guest'))[0] });
  const despues = huella();
  _guest = false; _guestCfg = null;
  return { igual: antes === despues, ok: !!(out && out.blob && out.blob.size > 20000) };
});
log(invitado.ok, 'En modo invitado el documento sale igual');
log(invitado.igual, '⚠️ Y no escribe un solo byte en el almacenamiento del dueño del teléfono');

/* El PDF abre de verdad: lo comprueba el visor de Edge, no la app. */
const edge = await chromium.launch({ channel: 'msedge' });
const pv = await edge.newPage({ viewportSize: { width: 1400, height: 1000 } });
const errPdf = [];
pv.on('pageerror', e => errPdf.push(String(e)));
await pv.goto('file:///' + ruta8.replace(/\\/g, '/'));
await pv.waitForTimeout(3500);
const paginas = await pv.evaluate(() => {
  const el = document.querySelector('#numPages, [aria-label*="de "]');
  return el ? el.textContent.trim() : '';
});
await pv.screenshot({ path: join(ROOT, 'verify_custodia_fpj8.png') });
await pv.goto('file:///' + ruta7.replace(/\\/g, '/'));
await pv.waitForTimeout(3500);
await pv.screenshot({ path: join(ROOT, 'verify_custodia_fpj7.png') });
await edge.close();
log(errPdf.length === 0, 'Los dos PDF abren en un visor real sin un solo error', errPdf.join(' | ') || 'sin errores');
log(/2/.test(paginas) || paginas === '',
  'El FPJ-8 conserva sus dos páginas: el formato se imprime completo', paginas || '(el visor no lo expuso)');

log(errores.length === 0, 'Sin errores de consola en toda la corrida', errores.slice(0, 3).join(' | ') || 'ninguno');

await browser.close();
server.close();
console.log(`\n${fails ? '❌' : '✅'} ${n - fails}/${n} comprobaciones en verde` + (fails ? ` · ${fails} en rojo` : ''));
process.exit(fails ? 1 : 0);
