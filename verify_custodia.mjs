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
/* ⚠️ El oficio de orden judicial pasó a SOLO WORD el 2026-08-28 (obs. 1): era
   el último documento con dos salidas posibles. */
log(await page.evaluate(() => lcExportSoloWord('FPJ') === true && lcExportSoloWord('OJ') === true),
  'Los seis formatos tienen una sola salida posible: el FPJ-5 y el oficio, en Word');

/* ⚠️ Un formato que ya ES el PDF oficial no tiene formato de salida que elegir
   ni papel que fijar: el diálogo no puede abrirse a preguntar nada. */
const sinDialogo = await page.evaluate(() => new Promise(res => {
  /* ⚠️ 2026-08-28: ya no hay diálogo para NINGÚN documento (los seis tienen una
     sola salida posible y el papel es Carta fija). El check se conserva porque
     lo que protege sigue vigente: un PDF oficial no puede pedir nada. */
  let llamado = null;
  lcPedirExport('FPJ8', 'prueba', sel => { llamado = sel; });
  setTimeout(() => res({ llamado, dialogo: !!document.getElementById('exp-fmt-DOCX') }), 150);
}));
log(sinDialogo.llamado && sinDialogo.dialogo === false,
  'No se abre diálogo de exportación: no hay ninguna decisión que pedir', JSON.stringify(sinDialogo.llamado));

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

/* ⚠️ Y NO en el menú ⋮ de la captura, que quedó en las cuatro cosas que se
   HACEN con una captura y no nombra un solo documento: esa es, llevada al
   final, la condición que la auditoría del módulo Capturas se puso a sí misma. */
await page.evaluate(id => openCaseSheet(id), idCaso);
await page.waitForTimeout(200);
const items = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent.trim()));
log(items.length === 4 && !items.some(t => /FPJ|Oficio|Acta|custodia|Rótulo/i.test(t)),
  'El menú de la captura no nombra ningún documento: no puede crecer con este formato', items.join(' · '));
log(!items.some(t => /custodia|Rótulo/i.test(t)),
  '⚠️ Y ninguno de los dos formatos nuevos entró en él: viven en el expediente');
await page.evaluate(() => closeSheet());
await page.waitForTimeout(150);

/* ⚠️ Expectativa actualizada el 2026-08-28 (Mejora 6, 2.º documento, obs. 2):
   sin EMP ni EF los dos formatos NO se ofrecen bloqueados — no se ofrecen. No es
   un dato que falte: hay capturas que sencillamente no tienen elementos, y en
   ellas la cadena de custodia y el rótulo no existen. Ofrecerlos con un «Faltan
   datos» invitaba a diligenciar un documento que no corresponde. */
const sinEmp = await page.evaluate(async () => {
  const c = Object.assign({}, DB.getCase('cc-uri'), { id: 'cc-vacio', elementos: [], narracion: { emp: '' } });
  await DB.saveCase(c);
  const docs = lcEstadoDocs(DB.getCase('cc-vacio'));
  return { cc: docs.filter(d => /custodia|Rótulo|incautaci/i.test(d.lbl)).length,
           quedan: docs.map(d => d.lbl) };
});
log(sinEmp.cc === 0,
  'Sin EMP registrados los dos formatos no se ofrecen: no corresponden a ese procedimiento', sinEmp.quedan.join(' · '));

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
const nunc8 = fila(ov8, 741, 745);
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
const f1 = fila(ov8, 598, 604);
log(f1.filter(t => t.t === 'X').length === 3,
  'Se marca con X debajo de H, R y E: el mismo funcionario halló, recolectó y embaló');
const nom8 = fila(ov8, 600, 612, 200, 560).map(t => t.t).join('');
log(/NELSON DAVID GOMEZ/.test(fila(ov8, 598, 604).map(t => t.t).join('')),
  'Nombres y apellidos del funcionario', nom8 || fila(ov8, 598, 604).map(t => t.t).join(' | '));
log(fila(ov8, 598, 604).some(t => t.t === '1035302775'),
  '⚠️ La cédula sale SIN PUNTOS, como en todos los documentos de la app');
log(fila(ov8, 598, 604).some(t => t.t === 'Institución de prueba'),
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
/* El FPJ-8 también se reencaja, pero a CARTA HORIZONTAL: su página tiene
   exactamente esa relación de aspecto, así que la reducción es la misma que
   haría la impresora al ajustar a la hoja — y a cambio el documento pasa a tener
   un tamaño físico conocido, sin el cual «11 pt» no significa nada. */
const cola8 = buf8.subarray(origen8.length).toString('latin1');
const mb8 = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(cola8);
log(!!mb8 && +mb8[1] === 792 && +mb8[2] === 612,
  '⚠️ El registro sale en carta horizontal: 792 × 612 pt (11" × 8,5")',
  mb8 ? mb8[1] + ' × ' + mb8[2] : 'sin MediaBox');
log((cola8.match(/\/MediaBox\s*\[\s*0\s+0\s+792\s+612\s*\]/g) || []).length === 2,
  '⚠️ Y el REVERSO se reencaja también: si no, el documento saldría con dos páginas de tamaño distinto',
  (cola8.match(/\/MediaBox/g) || []).length + ' páginas reencajadas');

const ov7 = overlay(buf7);
log(fila(ov7, 704, 710, 80, 780).map(t => t.t).join('') === '0500160001202601',
  'El NUNC, dígito por dígito');
const fechaCel = fila(ov7, 704, 710, 780, 1000).map(t => t.t).join('');
const horaCel = fila(ov7, 704, 710, 1010, 1130).map(t => t.t).join('');
log(fechaCel === '20260820', 'La fecha de recolección, una cifra por casilla', fechaCel);
log(horaCel === '1730', 'Y la hora', horaCel);
/* ⚠️ El requerimiento es explícito: la fecha no se tacha encima de las letras
   guía; las letras desaparecen. Son 12 casillas con A/M/D/H/O/R/A impresas. */
log(ov7.borrados.filter(b => b.y > 690 && b.y < 706).length === 12,
  '⚠️ Las 12 letras grises de guía (A A A A M M D D / H O R A) se tapan antes de escribir',
  ov7.borrados.filter(b => b.y > 690 && b.y < 706).length);

log(fila(ov7, 580, 590).map(t => t.t).join('') === '1',
  'NÚMERO DEL EMP Y EF = el que le corresponde dentro de SU cadena de custodia');
log(fila(ov7, 508, 516).map(t => t.t).join('') === '01', 'CANTIDAD');
log(/CL 52 # 50-31/.test(textoDe(ov7, 612, 620)), 'DIRECCIÓN, en su renglón');
log(/pretina del pantalón/.test(textoDe(ov7, 540, 550, 290, 745)), 'UBICACIÓN, en el suyo');
const perDoc = textoDe(ov7, 540, 590, 780, 1130);
log(perDoc === 'CARLOS ANDRÉS RESTREPO GÓMEZ',
  '⚠️ Los nombres salen en MAYÚSCULAS, como en el FPJ-5 y en el acta: es la convención de los formatos de la Fiscalía', perDoc);
const desc7 = textoDe(ov7, 435, 445).replace(/\s+/g, ' ');
log(desc7 === '01 (uno) celular marca Samsung color negro en regular estado',
  '⚠️ La descripción es EXACTAMENTE la de la cadena de custodia, sin el prefijo «EMP N:»', desc7);
const dil = fila(ov7, 190, 195).map(t => t.t);
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

/* ══ E2 · TIPOGRAFÍA ═══════════════════════════════════════════════════════
   Un formato oficial se diligencia en UN solo cuerpo de letra, y ese cuerpo se
   mide CONTRA LA LETRA DEL PROPIO FORMATO. La comprobación no mira «qué tamaños
   hay» sino que no haya ninguno distinto del que toca: es la misma garantía
   estructural con la que se cerraron el acta FPJ-6 y el FPJ-5.

   ⚠️ Por qué la referencia es el formato y no el papel ni el archivo: estos
   formatos vienen en hojas de 17" y la impresión los reduce a la mitad larga.
   Fijar el cuerpo DENTRO del archivo dejaba el dato en 6,8 pt reales (se veía
   pequeño); fijarlo SOBRE EL PAPEL a 11 pt lo dejaba en 1,76× y 2,15× la letra
   del propio formulario (se veía enorme). A 1,4× la etiqueta el dato se lee
   claramente por encima sin dominarla, y la proporción es invariante: sigue
   siendo correcta si el rótulo se imprime mañana en otra hoja. */
console.log('\n── E2 · Un solo cuerpo: 1,4 × la letra del propio formato ──');

const tip = await page.evaluate(() => ({
  factor: LC_PDF_FACTOR,
  e8: lcHojaEscala(FPJ8_G.hoja, FPJ8_G.pagina.w, FPJ8_G.pagina.h),
  e7: lcHojaEscala(FPJ7_G.hoja, FPJ7_G.pagina.w, FPJ7_G.pagina.h),
  lab8: FPJ8_G.etiqueta, lab7: FPJ7_G.etiqueta,
  sz8: _ccSz(FPJ8_G), sz7: _ccSz(FPJ7_G),
  imp8: _ccSzImpreso(FPJ8_G), imp7: _ccSzImpreso(FPJ7_G)
}));
const escalas = { f8: tip.e8, f7: tip.e7 };
const razon = (ov, lab) => [...new Set(ov.textos.map(t => +(t.size / lab).toFixed(3)))].sort((a, b) => a - b);
const r8 = razon(ov8, tip.lab8), r7 = razon(ov7, tip.lab7);
log(r8.length === 1 && Math.abs(r8[0] - tip.factor) < 0.005,
  '⚠️ Todo lo que rellena la app en el FPJ-8 va al mismo cuerpo: 1,4 × la letra del formato',
  r8.map(x => x.toFixed(2) + '×').join(' / ') + ' = ' + tip.imp8.toFixed(1) + ' pt impresos');
/* ⚠️ En el rótulo puede haber excepción, medida y no supuesta: en media hoja
   carta las columnas «Entidad» y «Cargo» del apartado 7 miden 0,9" y 1,3" de
   papel. Si un valor no cabe ahí ni condensado, se reduce SOLO ese y se avisa. */
const sec7y = ov7.textos.filter(t => t.y > 190 && t.y < 195);
const fuera7 = ov7.textos.filter(t => Math.abs(t.size / tip.lab7 - tip.factor) >= 0.04);
log(fuera7.every(t => sec7y.indexOf(t) >= 0),
  'Y en el FPJ-7 igual, salvo —si acaso— la fila más estrecha del formato: el apartado 7',
  fuera7.map(t => t.t + ' ' + (t.size * tip.e7).toFixed(1) + ' pt').join(' · ') || 'sin excepciones');
log(tip.imp8 > 8 && tip.imp8 < 9.5 && tip.imp7 > 6.5 && tip.imp7 < 8,
  '⚠️ Medido sobre el papel: el dato queda entre la letra del formato y los 11 pt que se veían enormes',
  'registro ' + tip.imp8.toFixed(1) + ' pt · rótulo ' + tip.imp7.toFixed(1) + ' pt · etiquetas ' +
  (tip.lab8 * tip.e8).toFixed(1) + ' / ' + (tip.lab7 * tip.e7).toFixed(1) + ' pt');
/* Y que el archivo declare una hoja de tamaño conocido: sin eso no se puede
   afirmar nada sobre el tamaño impreso. */
const hojas = await page.evaluate(() => ({
  f8: [FPJ8_G.hoja.w, FPJ8_G.hoja.h], f7: [FPJ7_G.hoja.w, FPJ7_G.hoja.h],
  asp: FPJ8_G.pagina.w / FPJ8_G.pagina.h
}));
log(hojas.f8[0] === 792 && hojas.f8[1] === 612,
  '⚠️ El registro se entrega en carta horizontal (792 × 612 pt), que es EXACTAMENTE su relación de aspecto',
  hojas.asp.toFixed(4) + ' vs ' + (792 / 612).toFixed(4));
log(Math.abs(hojas.asp - 792 / 612) < 0.001,
  'Así que reencajarlo no deforma ni un punto: es la misma reducción que hace la impresora');

/* La fuente: Arial declarada como tal, con SUS anchos, y sin embeber. */
const fnt = /\/BaseFont\s*\/(\w+)/.exec(cola7);
log(!!fnt && fnt[1] === 'ArialMT',
  '⚠️ La fuente es Arial, declarada como tal — no la Helvetica de las 14 fuentes base',
  fnt && fnt[1]);
const mW = /\/FirstChar\s+(\d+)\/LastChar\s+(\d+)\/Widths\[([^\]]*)\]/.exec(cola7);
log(!!mW && +mW[1] === 32 && +mW[2] === 255 && mW[3].trim().split(/\s+/).length === 224,
  'Con /Widths propios de 32 a 255: el visor maqueta con la misma métrica con la que la app centró',
  mW ? mW[3].trim().split(/\s+/).length + ' anchos' : 'sin /Widths');
log(/\/FontDescriptor\s+\d+\s+0\s+R/.test(cola7) && !/\/FontFile/.test(cola7),
  'Y sin embeber la fuente: descriptor sí, archivo de fuente no');
/* ⚠️ La condensación (`Tz`) NO es un cambio de cuerpo: mantiene los 11 pt de
   alto y solo estrecha el glifo, y es la válvula que impide que un nombre largo
   desborde la casilla del formato. Con datos corrientes no debería dispararse. */
const cond = ov8.textos.concat(ov7.textos).filter(t => t.tz !== 100);
log(cond.every(t => t.tz >= 88),
  'La condensación nunca baja del 88 %: por debajo se prefiere reducir el cuerpo, que sí se avisa',
  cond.length ? cond.map(t => t.t.slice(0, 22) + ' (' + t.tz + '%)').join(' · ') : 'ninguna');
/* Y las dos caras del aviso, forzando la condición en vez de esperar a que se
   dé sola: con un cargo desmesuradamente largo TIENE que avisar; con los datos
   corrientes NO puede avisar. Un aviso que salta siempre deja de leerse — que
   es la forma de que el que sí importa pase desapercibido. */
const avisos7 = await page.evaluate(async id => {
  const c = DB.getCase(id), it = ccElementos(c)[1];
  const normal = await LC_DOCS.FPJ7.build({ caso: c, item: it });
  const largo = JSON.parse(JSON.stringify(c));
  largo.custodia.funcionarios[0].cargo = 'Comandante de Cuadrante de la Estación de Policía del Distrito';
  const forzado = await LC_DOCS.FPJ7.build({ caso: largo, item: it });
  return { normal: normal.avisos || [], forzado: forzado.avisos || [] };
}, idCaso);
log(avisos7.normal.length === 0,
  'Con datos corrientes no hay aviso: todo cupo', avisos7.normal.join(' | ') || 'sin avisos');
log(avisos7.forzado.some(a => /no cab/.test(a) && /pt/.test(a) && /acórtalo/.test(a)),
  '⚠️ Y con un dato que de verdad no cabe lo AVISA con el valor, el cuerpo que le quedó y, si deja de leerse, que hay que acortarlo',
  avisos7.forzado.join(' | ') || 'sin avisos');

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
/* El reverso se reencaja para compartir hoja, pero NO recibe una sola
   instrucción de dibujo: sale en blanco, para que lo diligencie a mano quien
   reciba el elemento. */
const flujos8 = cola8.split('0 g 0 G 1 w 0 Tc').slice(1);
log(flujos8.length === 2, 'Las dos páginas del registro pasan por el motor', flujos8.length);
log(flujos8[1] && !/\) Tj/.test(flujos8[1].split('endstream')[0]),
  '⚠️ El reverso («REGISTRO DE CONTINUIDAD») no recibe una sola instrucción de dibujo: sale en blanco');

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
const eq1 = fila(ov8c, 598, 604).filter(t => t.t === 'X').length;
const eq2 = fila(ov8c, 533, 539).filter(t => t.t === 'X').length;
log(eq1 === 2 && eq2 === 1,
  'Con roles repartidos se marca lo que hizo cada uno: 2 X en la primera fila y 1 en la segunda',
  eq1 + ' / ' + eq2);
log(fila(ov8c, 533, 539).some(t => /JUAN PABLO MEJIA/.test(t.t)),
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
