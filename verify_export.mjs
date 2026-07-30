/* Regresión de EXPORTACIÓN: formato de salida + tamaño de papel.
   Comprueba que (a) no sale ningún documento sin que el usuario elija las dos
   cosas, (b) el .docx queda diagramado en el tamaño elegido sin que cambie un
   solo dato, (c) el FPJ-5 sólo acepta tamaños que respetan el ancho de sus
   casillas, y (d) la vista de impresión del PDF sale del mismo XML del .docx. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8141;
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ acceptDownloads: true });
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

/* El diálogo nunca abre el diálogo real de impresión en las pruebas. */
await page.evaluate(() => { window._printed = 0; });

/* ─────────── Semilla: un caso OJ completo y uno de flagrancia ─────────── */
const ids = await page.evaluate(async () => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'MIN'; cfg.ojInstitucion = 'INST';
  cfg.ojUnidad = 'UNIDAD X'; cfg.ojDependencia = 'DEPENDENCIA X';
  cfg.ojCiudad = 'Ciudad'; cfg.ojPieDireccion = 'Calle 1'; cfg.ojPieTelefonos = '600';
  cfg.ojPieCorreo = 'a@b.test'; cfg.ojPieWeb = 'www.b.test';
  cfg.ojCustEstacion = 'Estacion X'; cfg.ojCustDireccion = 'Calle 2';
  cfg.perfiles = [{ id: 'p', grado: 'Patrullero', nombre: 'Firma Prueba', cargo: 'Cargo', telefono: '300', correo: 'f@b.test' }];
  cfg.perfilActivo = 'p';
  DB.saveConfig(cfg);

  const oj = ojNuevoCaso();
  oj.oj.orden.numero = '77';
  oj.oj.orden.fechaExpedicion = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  oj.oj.orden.finalidad = 'IMPUTACION';
  oj.oj.despacho.nombre = 'Juzgado Treinta y Seis Penal Municipal de Conocimiento';
  oj.oj.proceso.radicado = '050016000206202512345';
  oj.oj.proceso.delitos = [{ nombre: 'Hurto agravado', articulo: '240' }];
  oj.oj.requerido.priNom = 'CARLOS'; oj.oj.requerido.priApe = 'DIAZ'; oj.oj.requerido.numDoc = '123456';
  oj.oj.requerido.senales = 'Cicatriz visible en el pomulo derecho, tatuaje en el antebrazo';
  oj.oj.diligencia.lugarDireccion = 'Calle 53 con carrera 51';
  oj.oj.diligencia.funcionarios = [{ grado: 'Patrullero', nombre: 'Firma Prueba' }];
  oj.oj.actuacion.derechos.leidos = true; oj.oj.actuacion.derechos.hora = '10:00';
  oj.oj.actuacion.observaciones = 'RELATO DE PRUEBA. '.repeat(40);
  oj.oj.actuacion.anexos = ['Informe dejando a disposición', 'Acta de derechos del capturado'];
  oj.oj.destino.nombre = 'Fiscalia URI'; oj.oj.destino.direccion = 'Calle 3';
  oj.capturados = [ojPersonaEspejo(oj)];
  await DB.saveCase(oj);

  const fpj = SIM.genFlagrancia('flagrancia-uri');
  fpj.isTest = false; fpj.nunc = '0500160002062026';
  /* ⚠️ Una persona por rol. El simulador reparte 1..3 al azar para ejercitar los
     apartados repetibles (FPJ-5 v3), y cada copia añade tablas: aquí se mide la
     GEOMETRÍA del formato contra su patrón de original, que son 35 tablas.
     Las copias tienen su propia regresión en verify_multipersona.mjs. */
  fpj.capturados = fpj.capturados.slice(0, 1);
  fpj.victimas = fpj.victimas.slice(0, 1);
  fpj.testigos = fpj.testigos.slice(0, 1);
  await DB.saveCase(fpj);
  go('capturas'); renderCases();
  return { oj: oj.id, fpj: fpj.id };
});
log(!!ids.oj && !!ids.fpj, 'Semilla lista: un caso de orden judicial y uno de flagrancia');

/* ─────────── 1. El diálogo es obligatorio y bloquea hasta elegir ─────────── */
await page.evaluate((id) => lcExportarCaso(id), ids.oj);
await page.waitForTimeout(300);
log(await page.isVisible('#exp-go'), 'Al exportar se abre el diálogo de formato y tamaño');
log(await page.isDisabled('#exp-go'), 'El botón de generar nace DESHABILITADO: nada sale sin elegir');
log(/Elige/.test(await page.textContent('#exp-go')), 'Y dice qué falta elegir', await page.textContent('#exp-go'));

await page.click('#exp-fmt-DOCX');
await page.waitForTimeout(120);
log(await page.isDisabled('#exp-go'), 'Con solo el formato elegido sigue bloqueado');
log((await page.textContent('#exp-go')).includes('tamaño del papel'), 'Ahora pide el tamaño');

await page.click('#exp-papel-OFICIO');
await page.waitForTimeout(120);
log(!(await page.isDisabled('#exp-go')), 'Elegidas AMBAS opciones, se habilita');
log((await page.textContent('#exp-go')).includes('Oficio'), 'El botón nombra lo que va a generar', await page.textContent('#exp-go'));

const [dlOficio] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.click('#exp-go')
]);
log(!!dlOficio, 'Se descarga el .docx en el tamaño elegido', dlOficio ? dlOficio.suggestedFilename() : '(sin descarga)');

/* ─────────── 2. El .docx lleva la geometría del papel elegido ─────────── */
const geo = await page.evaluate(async () => {
  const c = DB.getCases().find(x => x.ojv === 2);
  const out = {};
  for (const papel of ['CARTA', 'OFICIO', 'P8X135']) {
    const o = await buildOficioOJBlob(JSON.parse(JSON.stringify(c)), papel);
    const files = await _unzipBufAsync(new Uint8Array(await o.blob.arrayBuffer()));
    const xml = new TextDecoder().decode(files['word/document.xml']);
    const pg = /<w:pgSz w:w="(\d+)" w:h="(\d+)"\/>/.exec(xml);
    const mar = /<w:pgMar w:top="(\d+)" w:right="(\d+)" w:bottom="(\d+)" w:left="(\d+)"/.exec(xml);
    const anchos = [...xml.matchAll(/<w:tblW w:w="(\d+)"/g)].map(m => +m[1]);
    const ts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('\n');
    out[papel] = {
      w: +pg[1], h: +pg[2],
      mar: mar.slice(1, 5).map(Number),
      anchos: [...new Set(anchos)],
      util: +pg[1] - +mar[4] - +mar[2],
      texto: ts, tablas: anchos.length
    };
  }
  return out;
});
log(geo.CARTA.w === 12240 && geo.CARTA.h === 15840, 'Carta: 12240 × 15840 twips', `${geo.CARTA.w}×${geo.CARTA.h}`);
log(geo.OFICIO.w === 12240 && geo.OFICIO.h === 18720, 'Oficio: 12240 × 18720 twips (8,5 × 13")', `${geo.OFICIO.w}×${geo.OFICIO.h}`);
log(geo.P8X135.w === 11520 && geo.P8X135.h === 19440, '8 × 13,5": 11520 × 19440 twips', `${geo.P8X135.w}×${geo.P8X135.h}`);
log(JSON.stringify(geo.CARTA.mar) === JSON.stringify(geo.OFICIO.mar) &&
    JSON.stringify(geo.CARTA.mar) === JSON.stringify(geo.P8X135.mar),
  'Los márgenes son los mismos en los tres tamaños (medidas absolutas de impresión)', geo.CARTA.mar.join('/'));
log(geo.CARTA.anchos.length === 1 && geo.CARTA.anchos[0] === geo.CARTA.util,
  'Carta: todas las tablas ocupan exactamente el ancho útil', `${geo.CARTA.anchos[0]} = ${geo.CARTA.util}`);
log(geo.OFICIO.anchos.length === 1 && geo.OFICIO.anchos[0] === geo.OFICIO.util,
  'Oficio: idem — ninguna tabla se sale del margen ni se queda corta', `${geo.OFICIO.anchos[0]} = ${geo.OFICIO.util}`);
log(geo.P8X135.anchos.length === 1 && geo.P8X135.anchos[0] === geo.P8X135.util,
  '8 × 13,5": las tablas se reajustan al ancho más angosto', `${geo.P8X135.anchos[0]} = ${geo.P8X135.util}`);
log(geo.CARTA.anchos[0] === geo.OFICIO.anchos[0],
  'Carta y Oficio comparten ancho: cambiar entre ellos no toca ninguna tabla');
log(geo.CARTA.tablas === geo.OFICIO.tablas && geo.CARTA.tablas === geo.P8X135.tablas,
  'Mismo número de tablas en los tres tamaños', geo.CARTA.tablas);

/* ─────────── 3. El CONTENIDO es idéntico byte a byte entre tamaños ─────────── */
log(geo.CARTA.texto === geo.OFICIO.texto && geo.CARTA.texto === geo.P8X135.texto,
  'El texto del documento es IDÉNTICO en los tres tamaños: solo cambia la diagramación',
  geo.CARTA.texto.length + ' caracteres');

/* ─────────── 4. El FPJ-5 solo admite tamaños de igual ancho ─────────── */
const fpjOfrecidos = await page.evaluate(() => lcPapelesFPJ());
log(fpjOfrecidos.join(',') === 'CARTA,OFICIO',
  'El FPJ-5 solo ofrece los tamaños que respetan el ancho de sus casillas', fpjOfrecidos.join(','));

await page.evaluate((id) => lcExportarCaso(id), ids.fpj);
await page.waitForTimeout(300);
const opcionesFpj = await page.$$eval('[id^="exp-papel-"]', els => els.map(e => e.id.replace('exp-papel-', '')));
log(opcionesFpj.join(',') === 'CARTA,OFICIO', 'Y el diálogo del FPJ-5 no muestra el tamaño más angosto', opcionesFpj.join(','));
const explica = await page.textContent('.modal, #modal').catch(() => '');
log(/formato oficial de la Fiscal/.test(explica), 'Explica por qué, en vez de limitar en silencio');
await page.evaluate(() => lcExportCancelar());
await page.waitForTimeout(200);

const fpjGeo = await page.evaluate(async (id) => {
  const c = DB.getCase(id);
  const out = {};
  for (const papel of ['CARTA', 'OFICIO', 'P8X135']) {
    const o = buildFPJBlob(c, papel);
    const files = await _unzipBufAsync(new Uint8Array(await o.blob.arrayBuffer()));
    const xml = new TextDecoder().decode(files['word/document.xml']);
    const pg = /<w:pgSz[^>]*\/>/.exec(xml)[0];
    const w = /w:w="(\d+)"/.exec(pg), h = /w:h="(\d+)"/.exec(pg);
    const anchos = [...xml.matchAll(/<w:tblW w:w="(\d+)"/g)].map(m => +m[1]);
    const ts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('\n');
    const grids = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => +m[1]).join(',');
    out[papel] = { w: +w[1], h: +h[1], anchos: [...new Set(anchos)], tablas: anchos.length, texto: ts, grids, papelUsado: o.papel };
  }
  return out;
}, ids.fpj);
log(fpjGeo.CARTA.h === 15842 && fpjGeo.OFICIO.h === 18722,
  'FPJ-5: solo cambia el ALTO de la hoja (conserva el desfase de 2 twips de la plantilla)',
  `${fpjGeo.CARTA.h} → ${fpjGeo.OFICIO.h}`);
log(fpjGeo.CARTA.w === fpjGeo.OFICIO.w && fpjGeo.CARTA.w === 12242,
  'FPJ-5: el ancho de página NO se toca', fpjGeo.CARTA.w);
log(fpjGeo.CARTA.anchos.join() === '10631' && fpjGeo.OFICIO.anchos.join() === '10631',
  'FPJ-5: sus 35 tablas siguen exactamente en 10631 twips', fpjGeo.OFICIO.anchos.join());
log(fpjGeo.CARTA.grids === fpjGeo.OFICIO.grids,
  'FPJ-5: ni una sola columna cambió de ancho — cero riesgo de partir palabras en las casillas');
log(fpjGeo.CARTA.tablas === 35 && fpjGeo.OFICIO.tablas === 35, 'FPJ-5: las 35 tablas del formato intactas', fpjGeo.OFICIO.tablas);
log(fpjGeo.CARTA.texto === fpjGeo.OFICIO.texto, 'FPJ-5: contenido idéntico entre tamaños');
log(fpjGeo.P8X135.papelUsado === 'CARTA' && fpjGeo.P8X135.h === 15842,
  'Salvaguarda: si llegara un tamaño de otro ancho, el FPJ-5 lo ignora en vez de deformarse',
  fpjGeo.P8X135.papelUsado);

/* ─────────── 5. La vista de impresión sale del mismo XML ─────────── */
const impr = await page.evaluate(async () => {
  const c = DB.getCases().find(x => x.ojv === 2);
  const out = await buildOficioOJBlob(c, 'OFICIO');
  const plan = lcPrintDoc(out);
  return {
    hay: !!plan,
    papel: plan && plan.papel.id,
    cssW: plan && plan.papel.cssW, cssH: plan && plan.papel.cssH,
    bloques: plan ? plan.bloques.length : 0,
    tablas: plan ? plan.bloques.filter(b => b.tipo === 'tbl').length : 0,
    tieneHdr: plan ? /UNIDAD X/.test(plan.hdrFirst) : false,
    tieneFtr: plan ? /Página/.test(plan.ftrDef) : false,
    // El texto de la vista debe ser el mismo que el del .docx.
    textoHtml: plan ? plan.bloques.map(b => b.html).join('').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#8203;/g, ' ').replace(/\s+/g, ' ').trim() : ''
  };
});
log(impr.hay === true, 'La vista de impresión se construye desde el .docx generado');
log(impr.papel === 'OFICIO' && impr.cssW === '8.5in' && impr.cssH === '13in',
  'Y hereda el tamaño elegido para el @page', `${impr.cssW} × ${impr.cssH}`);
log(impr.tablas === 3, 'Traduce las 3 tablas del formato, no las redibuja', impr.tablas);
log(impr.tieneHdr === true, 'El membrete configurado viaja a la vista de impresión');
log(impr.tieneFtr === true, 'Y el pie con la numeración');

/* ⚠️ El sombreado de la columna de etiquetas se perdía al exportar a PDF:
   Chrome NO imprime fondos por defecto («Gráficos de fondo» viene desmarcado).
   El .docx lo conservaba y el PDF no, así que los dos formatos no coincidían.
   Se mide sobre la vista REAL ya paginada, tabla por tabla. */
const trama = await page.evaluate(async () => {
  const c = DB.getCases().find(x => x.ojv === 2);
  const out = await buildOficioOJBlob(c, 'CARTA');
  lcImprimir(out);
  await new Promise(r => setTimeout(r, 1500));
  const d = document.getElementById('lc-print-frame').contentDocument;
  const gris = td => getComputedStyle(td).backgroundColor === 'rgb(239, 239, 239)';
  const porTabla = [...d.querySelectorAll('#hojas table')]
    .map(t => [...t.querySelectorAll('td')].filter(gris).length)
    .filter(n => n > 0);
  const r = {
    css: /print-color-adjust:\s*exact/.test(d.querySelector('style').textContent),
    porTabla, total: porTabla.reduce((a, b) => a + b, 0)
  };
  document.getElementById('lc-print-frame').remove();
  return r;
});
log(trama.css === true, 'La vista declara print-color-adjust:exact — Chrome no puede descartar los fondos');
log(trama.total === 23, 'Las 23 celdas de etiqueta conservan su trama gris en la vista de impresión', trama.total);
log(trama.porTabla.length === 3 && trama.porTabla.join(',') === '9,10,4',
  'Y se conserva en las TRES tablas, no solo en la primera', trama.porTabla.join(' · '));

const textoDocx = await page.evaluate(async () => {
  const c = DB.getCases().find(x => x.ojv === 2);
  const out = await buildOficioOJBlob(c, 'OFICIO');
  const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
  const xml = new TextDecoder().decode(files['word/document.xml']);
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1])
    .join(' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
});
const faltantes = textoDocx.split(' ').filter(w => w.length > 4 && impr.textoHtml.indexOf(w) < 0);
log(faltantes.length === 0,
  'Ni una palabra del .docx falta en la vista de impresión (mismo origen de verdad)',
  faltantes.length ? faltantes.slice(0, 5).join(' | ') : 'ninguna palabra perdida');

/* ─────────── 6. Paginación real: sin cortes ni páginas desbordadas ─────────── */
const pag = await page.evaluate(async (papelId) => {
  const c = DB.getCases().find(x => x.ojv === 2);
  const out = await buildOficioOJBlob(c, papelId);
  const plan = lcPrintDoc(out);
  // Se pagina en un iframe real para medir de verdad, sin abrir el diálogo.
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-99999px;width:1400px;height:2200px;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write('<!doctype html><html><head><style>' + lcPrintCss(plan.papel, plan.M) + '</style></head><body>' +
    '<div id="medidor" style="position:absolute;left:-99999px;top:0;visibility:hidden"></div>' +
    '<div id="hojas"></div></body></html>');
  d.close();
  const total = lcPaginar(f.contentWindow, plan);
  const hojas = Array.from(d.querySelectorAll('.pg'));
  const alturaHoja = hojas[0].getBoundingClientRect().height;
  const desborde = hojas.map(pg => {
    const bd = pg.querySelector('.bd');
    const ft = pg.querySelector('.ft');
    const fin = bd.getBoundingClientRect().bottom - pg.getBoundingClientRect().top;
    const topPie = ft.getBoundingClientRect().top - pg.getBoundingClientRect().top;
    return { fin: Math.round(fin), topPie: Math.round(topPie), alto: Math.round(alturaHoja) };
  });
  const nums = hojas.map(pg => {
    const a = pg.querySelector('.fld-num'), b = pg.querySelector('.fld-tot');
    return a ? (a.textContent + '/' + (b ? b.textContent : '?')) : '';
  });
  // Ninguna fila de tabla puede quedar partida entre dos hojas.
  const filasPartidas = hojas.some(pg => Array.from(pg.querySelectorAll('tr')).some(tr => {
    const r = tr.getBoundingClientRect(), p = pg.getBoundingClientRect();
    return r.bottom > p.bottom + 1 || r.top < p.top - 1;
  }));
  f.remove();
  return { total, desborde, nums, filasPartidas };
}, 'OFICIO');
log(pag.total >= 1, 'La vista se pagina en hojas de medida exacta', pag.total + ' páginas');
log(pag.desborde.every(x => x.fin <= x.topPie + 1),
  'Ninguna hoja desborda: el contenido nunca invade el pie',
  pag.desborde.map(x => `${x.fin}≤${x.topPie}`).join(' · '));
log(pag.desborde.every(x => x.fin <= x.alto),
  'Ni se sale de la hoja', pag.desborde.map(x => `${x.fin}/${x.alto}`).join(' · '));
log(pag.filasPartidas === false, 'Ninguna fila de tabla queda partida entre dos hojas');
log(pag.nums.every((s, i) => s === (i + 1) + '/' + pag.total),
  'Numeración «Página N de M» real en cada hoja', pag.nums.join(' '));

/* ─────────── 7. El FPJ-5 también se pagina bien ─────────── */
const pagFpj = await page.evaluate(async (id) => {
  const out = buildFPJBlob(DB.getCase(id), 'CARTA');
  const plan = lcPrintDoc(out);
  if (!plan) return { error: 'sin plan' };
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-99999px;width:1400px;height:2200px;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write('<!doctype html><html><head><style>' + lcPrintCss(plan.papel, plan.M) + '</style></head><body>' +
    '<div id="medidor" style="position:absolute;left:-99999px;top:0;visibility:hidden"></div>' +
    '<div id="hojas"></div></body></html>');
  d.close();
  const total = lcPaginar(f.contentWindow, plan);
  const hojas = Array.from(d.querySelectorAll('.pg'));
  const partidas = hojas.some(pg => Array.from(pg.querySelectorAll('tr')).some(tr => {
    const r = tr.getBoundingClientRect(), p = pg.getBoundingClientRect();
    return r.bottom > p.bottom + 1;
  }));
  const texto = d.getElementById('hojas').textContent.replace(/\s+/g, ' ');
  f.remove();
  return { total, partidas, tieneNombre: /DAYNIS|[A-ZÁÉÍÓÚÑ]{3,}/.test(texto), largo: texto.length };
}, ids.fpj);
log(!pagFpj.error && pagFpj.total >= 1, 'El FPJ-5 también se traduce y pagina', pagFpj.total + ' páginas');
log(pagFpj.partidas === false, 'Sin filas partidas en el FPJ-5 (35 tablas)');
log(pagFpj.largo > 500, 'Y llega con su contenido, no una hoja vacía', pagFpj.largo + ' caracteres');

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fails ? `\n❌ ${fails} de ${n} comprobaciones fallaron` : `\n✅ ${n} comprobaciones, todas en verde`);
process.exit(fails ? 1 : 0);
