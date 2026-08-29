/* Regresión de EXPORTACIÓN: qué se pregunta, qué se recuerda y qué formatos
   existen para cada documento.

   El criterio que fija esta suite:
   (a) el tamaño de papel se pregunta UNA vez —es del equipo, no del caso— y
       desde ahí se recuerda, se ve y se puede cambiar;
   (b) el oficio de orden judicial sale en Word o PDF; el FPJ-5 SOLO en Word,
       porque su maquetación es del formato oficial de la Fiscalía y la vista de
       impresión del navegador no la reproduce;
   (c) el .docx queda diagramado en el tamaño elegido sin que cambie un dato;
   (d) la vista de impresión del oficio sale del mismo XML del .docx, y si algo
       no cabe en la hoja se AVISA en vez de recortarlo en silencio. */
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

/* ═══════════ 1 a 4 · SECCIÓN REESCRITA el 2026-08-28 ═══════════════════════
   Mejora 6 (2.º documento), obs. 1 y 9. Aquí se medía, paso a paso, un DIÁLOGO
   DE EXPORTACIÓN que ya no existe. Sus dos preguntas se quedaron sin respuestas
   posibles:

     · «¿Word o PDF?» — el oficio de orden judicial era el ÚNICO documento con
       dos salidas. El usuario pidió retirarle el PDF («esto lo único que hace es
       generar traumatismo y el archivo de Word se adapta a las configuraciones
       de cualquier impresora»), y con eso los seis formatos pasaron a tener
       exactamente una salida posible cada uno.
     · «¿Qué tamaño de papel?» — retirada por instrucción explícita. Con la
       sección Ajustes → Documentos fuera, no queda ninguna pantalla desde la que
       verlo ni cambiarlo, y un tamaño invisible que decide cómo se imprime un
       documento judicial es el «dato que se hereda en silencio» que este
       proyecto tiene prohibido. Por eso es una CONSTANTE: Carta.

   Lo que estas comprobaciones protegían sigue vigente y se mide igual de
   estricto, solo que sobre el resultado en vez de sobre el diálogo: que exportar
   ENTREGA el documento, que el FPJ-5 nunca sale en PDF, y que a ningún motor le
   llega un ancho que sus casillas no admiten. Y se añade lo que antes no podía
   comprobarse: que nada precede a la entrega. ═════════════════════════════ */
log(await page.evaluate(() => lcPapelCfg()) === 'CARTA',
  'El papel es una constante del equipo: Carta', await page.evaluate(() => lcPapelCfg()));

/* ═══════════ 1. Exportar entrega el documento, sin nada por delante ═══════ */
const [dlOficio] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.evaluate((id) => lcExportarCaso(id), ids.oj)
]);
await page.waitForTimeout(400);
log(!!dlOficio && /\.docx$/.test(dlOficio.suggestedFilename()),
  'Exportar el oficio entrega el .docx', dlOficio ? dlOficio.suggestedFilename() : '(sin descarga)');
log(!(await page.isVisible('#exp-go').catch(() => false)),
  'Sin ningún diálogo por delante: no hay decisión que pedir');
log(await page.evaluate(() => typeof window.lcExportConfirmar === 'undefined' &&
    typeof window.lcExportCancelar === 'undefined' && typeof window.lcGuardarPapel === 'undefined'),
  'El diálogo no quedó como código muerto: sus funciones se retiraron');

/* ═══════════ 2. Una segunda exportación se comporta igual ═══════════ */
const [dlOficio2] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.evaluate((id) => lcExportarCaso(id), ids.oj)
]);
log(!!dlOficio2, 'La segunda exportación entrega igual', dlOficio2 ? dlOficio2.suggestedFilename() : '(sin descarga)');
log(await page.evaluate(() => lcPapelCfg()) === 'CARTA',
  'Y el papel sigue siendo el mismo: no hay estado que se acumule');
log(await page.evaluate(() => { const c = DB.getConfig(); return !('papel' in c); }),
  '⚠️ La clave `papel` pasa a _CFG_MUERTAS: sin lector ni escritor, ya no viaja en la config');

/* ═══════════ 3. El oficio de orden judicial pasa a SOLO WORD ═══════════ */
log(await page.evaluate(() => lcExportSoloWord('OJ')) === true,
  'El oficio de orden judicial es ahora solo-Word (obs. 1)');
log(await page.evaluate(() => Object.keys(LC_DOCS).every(k => LC_DOCS[k].soloWord || LC_DOCS[k].esPDF)),
  'Y con él, los seis formatos tienen una sola salida posible cada uno');
const ojDocx = await page.evaluate(async (id) => {
  const out = await buildOficioOJBlob(ojCasoParaDocumento(DB.getCase(id)), lcPapelEfectivo('OJ'));
  return out ? { papel: out.papel, n: (await out.blob.arrayBuffer()).byteLength } : null;
}, ids.oj);
log(!!ojDocx && ojDocx.papel === 'CARTA' && ojDocx.n > 20000,
  'El motor del oficio no cambió: sigue produciendo el .docx entero', ojDocx && (ojDocx.papel + ' · ' + ojDocx.n + ' bytes'));

/* ═══════════ 4. El FPJ-5 NO tiene PDF, y la guarda es estructural ═══════════ */
log(await page.evaluate(() => lcExportSoloWord('FPJ')) === true,
  'El FPJ-5 está declarado como documento solo-Word');

const [dlFpj] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.evaluate((id) => lcExportarCaso(id), ids.fpj)
]);
log(!!dlFpj && /\.docx$/.test(dlFpj.suggestedFilename()),
  'Exportar el FPJ-5 descarga el .docx sin abrir ningún diálogo', dlFpj ? dlFpj.suggestedFilename() : '(sin descarga)');
log(!(await page.isVisible('#exp-go').catch(() => false)),
  'Ninguna pregunta que hacer = ningún diálogo que mostrar');

const fpjPdf = await page.evaluate(async (id) => {
  const out = buildFPJBlob(DB.getCase(id), 'OFICIO');
  const antes = !!document.getElementById('lc-print-frame');
  const r = lcImprimir(out);                       // guarda estructural
  const despues = !!document.getElementById('lc-print-frame');
  return { noPDF: out.noPDF === true, r, antes, despues };
}, ids.fpj);
log(fpjPdf.noPDF === true, 'El .docx del FPJ-5 viaja marcado como no-imprimible (out.noPDF)');
log(fpjPdf.r === false && fpjPdf.despues === false,
  'lcImprimir() lo rechaza y no llega a construir la vista: ninguna ruta futura puede imprimirlo');

log(await page.evaluate(() => lcPapelesDe('FPJ').join(',')) === 'CARTA,OFICIO',
  'El FPJ-5 solo admite los tamaños que respetan el ancho de sus casillas',
  await page.evaluate(() => lcPapelesDe('FPJ').join(',')));
log(await page.evaluate(() => lcPapelesFPJ().join(',')) === 'CARTA,OFICIO',
  'lcPapelesFPJ() mantiene la lista corta');
log(await page.evaluate(() => lcPapelSirveDoc('FPJ', 'P8X135') === false && lcPapelEfectivo('FPJ') === 'CARTA'),
  'Salvaguarda: un ancho que el FPJ-5 no admite nunca le llega — cae a Carta');


/* ═══════════ 5. El .docx lleva la geometría del papel elegido ═══════════ */
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
log(geo.CARTA.texto === geo.OFICIO.texto && geo.CARTA.texto === geo.P8X135.texto,
  'El texto del documento es IDÉNTICO en los tres tamaños: solo cambia la diagramación',
  geo.CARTA.texto.length + ' caracteres');

/* ═══════════ 6. El FPJ-5 en Word: solo cambia el alto de la hoja ═══════════ */
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
  'Salvaguarda del motor: un ancho ajeno se ignora en vez de deformar el formato', fpjGeo.P8X135.papelUsado);

/* ═══════════ 7. La vista de impresión del oficio sale del mismo XML ═══════════ */
const impr = await page.evaluate(async () => {
  const c = DB.getCases().find(x => x.ojv === 2);
  const out = await buildOficioOJBlob(c, 'OFICIO');
  const plan = lcPrintDoc(out);
  return {
    hay: !!plan,
    papel: plan && plan.papel.id,
    cssW: plan && plan.papel.cssW, cssH: plan && plan.papel.cssH,
    tablas: plan ? plan.bloques.filter(b => b.tipo === 'tbl').length : 0,
    tieneHdr: plan ? /UNIDAD X/.test(plan.hdrFirst) : false,
    tieneFtr: plan ? /Página/.test(plan.ftrDef) : false,
    textoHtml: plan ? plan.bloques.map(b => b.html).join('').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#8203;/g, ' ').replace(/\s+/g, ' ').trim() : ''
  };
});
log(impr.hay === true, 'La vista de impresión se construye desde el .docx generado');
log(impr.papel === 'OFICIO' && impr.cssW === '8.5in' && impr.cssH === '13in',
  'Y hereda el tamaño elegido para el @page', `${impr.cssW} × ${impr.cssH}`);
log(impr.tablas === 3, 'Traduce las 3 tablas del formato, no las redibuja', impr.tablas);
log(impr.tieneHdr === true, 'El membrete configurado viaja a la vista de impresión');
log(impr.tieneFtr === true, 'Y el pie con la numeración');

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

/* ⚠️ El sombreado de la columna de etiquetas se perdía al exportar a PDF:
   Chrome NO imprime fondos por defecto («Gráficos de fondo» viene desmarcado).
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
    .filter(x => x > 0);
  const r = {
    css: /print-color-adjust:\s*exact/.test(d.querySelector('style').textContent),
    porTabla, total: porTabla.reduce((a, b) => a + b, 0)
  };
  document.getElementById('lc-print-frame').remove();
  return r;
});
log(trama.css === true, 'La vista declara print-color-adjust:exact — Chrome no puede descartar los fondos');
/* ⚠️ Mejora 2 (obs. 3): el numeral 3 del formato tiene TRES filas —Fecha y hora,
   Lugar y Tipo de lugar—. La cuarta que imprimía la app («Forma de ubicación»)
   no existe en «Propuesta Plantilla OJ»: 9 + 10 + 3 = 22 etiquetas. */
log(trama.total === 22, 'Las 22 celdas de etiqueta conservan su trama gris en la vista de impresión', trama.total);
log(trama.porTabla.length === 3 && trama.porTabla.join(',') === '9,10,3',
  'Y se conserva en las TRES tablas, no solo en la primera', trama.porTabla.join(' · '));

/* ═══════════ 8. Paginación real ═══════════ */
async function paginar(papelId, inyectarGigante) {
  return page.evaluate(async ({ papelId, inyectarGigante }) => {
    const c = DB.getCases().find(x => x.ojv === 2);
    const out = await buildOficioOJBlob(c, papelId);
    const plan = lcPrintDoc(out);
    if (inyectarGigante) {
      // Un bloque más alto que la hoja entera: no se puede repartir.
      plan.bloques.push({ tipo: 'p', keep: false, html: '<p style="height:4000px">TEXTO QUE NO CABE</p>' });
    }
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-99999px;width:1400px;height:2200px;border:0';
    document.body.appendChild(f);
    const d = f.contentDocument;
    d.open();
    d.write('<!doctype html><html><head><style>' + lcPrintCss(plan.papel, plan.M) + '</style></head><body>' +
      '<div id="medidor" style="position:absolute;left:-99999px;top:0;visibility:hidden"></div>' +
      '<div id="hojas"></div></body></html>');
    d.close();
    const r = lcPaginar(f.contentWindow, plan);
    const hojas = Array.from(d.querySelectorAll('.pg'));
    const alturaHoja = hojas[0].getBoundingClientRect().height;
    const desborde = hojas.map(pg => {
      const bd = pg.querySelector('.bd'), ft = pg.querySelector('.ft');
      return {
        fin: Math.round(bd.getBoundingClientRect().bottom - pg.getBoundingClientRect().top),
        topPie: Math.round(ft.getBoundingClientRect().top - pg.getBoundingClientRect().top),
        alto: Math.round(alturaHoja)
      };
    });
    const nums = hojas.map(pg => {
      const a = pg.querySelector('.fld-num'), b = pg.querySelector('.fld-tot');
      return a ? (a.textContent + '/' + (b ? b.textContent : '?')) : '';
    });
    const filasPartidas = hojas.some(pg => Array.from(pg.querySelectorAll('tr')).some(tr => {
      const rr = tr.getBoundingClientRect(), p = pg.getBoundingClientRect();
      return rr.bottom > p.bottom + 1 || rr.top < p.top - 1;
    }));
    f.remove();
    return { total: r.paginas, desbordes: r.desbordes, desborde, nums, filasPartidas };
  }, { papelId, inyectarGigante });
}
const pag = await paginar('OFICIO', false);
log(pag.total >= 1, 'La vista se pagina en hojas de medida exacta', pag.total + ' páginas');
log(pag.desborde.every(x => x.fin <= x.topPie + 1),
  'Ninguna hoja desborda: el contenido nunca invade el pie',
  pag.desborde.map(x => `${x.fin}≤${x.topPie}`).join(' · '));
log(pag.desborde.every(x => x.fin <= x.alto), 'Ni se sale de la hoja', pag.desborde.map(x => `${x.fin}/${x.alto}`).join(' · '));
log(pag.filasPartidas === false, 'Ninguna fila de tabla queda partida entre dos hojas');
log(pag.nums.every((s, i) => s === (i + 1) + '/' + pag.total),
  'Numeración «Página N de M» real en cada hoja', pag.nums.join(' '));
log(pag.desbordes === 0, 'Un oficio normal no recorta nada', pag.desbordes);

/* ⚠️ Lo que no cabe se RECORTA (la caja de página es de medida fija). Antes
   ocurría en silencio: en un documento legal, perder texto sin señal es el peor
   resultado posible. Ahora se cuenta y quien llama avisa. */
const pagMal = await paginar('OFICIO', true);
log(pagMal.desbordes === 1,
  'Un bloque que no cabe en una hoja se CUENTA en vez de perderse en silencio', pagMal.desbordes);
const avisa = await page.evaluate(() => {
  const f = String(lcImprimir);
  return /r\.desbordes/.test(f) && /recortad/.test(f);
});
log(avisa === true, 'Y lcImprimir() lo convierte en un aviso al usuario, con la salida por el Word');

/* ═══════════ 9 · SECCIÓN REESCRITA el 2026-08-28 ══════════════════════════
   Mejora 6 (2.º documento), obs. 9: la sección «Documentos» de Ajustes —donde se
   veía y se cambiaba el tamaño del papel— se retiró por instrucción del usuario.
   Con el papel convertido en constante, ya no hay una decisión recordada que
   pueda quedarse invisible, que era exactamente el riesgo que este bloque
   protegía. Lo que se mide ahora es que la constante llegue de verdad hasta el
   motor de cada documento, sin puntos intermedios donde pueda discrepar. */
await page.evaluate(() => { go('ajustes'); loadAjustesFields(); });
await page.waitForTimeout(300);
const ajPapel = await page.evaluate(() => ({
  seccion: !!document.getElementById('aj-papel-grid'),
  secciones: [...document.querySelectorAll('#screen-ajustes .aj-sec-lbl')].map(e => e.textContent.trim())
}));
log(!ajPapel.seccion, 'Ajustes ya no tiene sección de papel: no hay tamaño que elegir', ajPapel.secciones.join(' · '));
log(!ajPapel.secciones.some(t => /Documentos/i.test(t)),
  'Ni queda su entrada en el índice de la pantalla');
log(await page.evaluate(() => lcPapelCfg()) === 'CARTA' &&
    await page.evaluate(() => lcPapelEfectivo('OJ')) === 'CARTA',
  'El papel se resuelve en UN punto y siempre da lo mismo', await page.evaluate(() => lcPapelEfectivo('OJ')));
const dlAj = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.evaluate((id) => lcExportarCaso(id), ids.fpj)
]).then(r => r[0]);
log(!!dlAj, 'El documento sale sin preguntar nada', dlAj ? dlAj.suggestedFilename() : '(sin descarga)');
const fpjPapel = await page.evaluate((id) => buildFPJBlob(DB.getCase(id), lcPapelEfectivo('FPJ')).papel, ids.fpj);
log(fpjPapel === 'CARTA', 'Y el motor recibe ese mismo tamaño, no otro', fpjPapel);

/* ═══════════ 10 · El punto único de la decisión, formato por formato ═══════
   ⚠️ Bloque NUEVO del 2026-08-28. Retirado el diálogo, `lcPedirExport` dejó de
   ser una pantalla y pasó a ser lo que de verdad importa: el ÚNICO sitio donde
   se resuelve con qué formato y en qué papel sale cada documento. Antes eso se
   comprobaba a través de la interfaz —y solo para dos formatos—; ahora se mide
   sobre los seis, que es lo que impide que descargar, imprimir y enviar puedan
   discrepar. */
const decision = await page.evaluate(() => new Promise(res => {
  const kinds = Object.keys(LC_DOCS), out = {};
  let pend = kinds.length;
  kinds.forEach(k => lcPedirExport(k, 'prueba', sel => { out[k] = sel; if (!--pend) res(out); }));
}));
const kinds = await page.evaluate(() => Object.keys(LC_DOCS));
log(kinds.every(k => !!decision[k]),
  'Los seis formatos resuelven su salida por el mismo punto', kinds.join(','));
log(kinds.every(k => decision[k].fmt === 'DOCX' || decision[k].fmt === 'PDF'),
  'Cada uno con un formato concreto, nunca vacío',
  kinds.map(k => k + ':' + decision[k].fmt).join(' · '));
log(decision.FPJ7.fmt === 'PDF' && decision.FPJ8.fmt === 'PDF',
  'Los dos formatos que YA son el PDF oficial se entregan como PDF');
log(decision.OJ.fmt === 'DOCX' && decision.FPJ.fmt === 'DOCX' &&
    decision.FPJ6.fmt === 'DOCX' && decision.INCAU.fmt === 'DOCX',
  'Y los cuatro que se rellenan o se componen, en Word');
log(await page.evaluate(() => Object.keys(LC_DOCS).every(k =>
      !LC_DOCS[k].esPDF ? lcPapelSirveDoc(k, lcPapelEfectivo(k)) : true)),
  '⚠️ A ningún motor le llega un papel que su formato no admita');
log(await page.evaluate(() => Object.keys(LC_DOCS).every(k => typeof LC_DOCS[k].build === 'function')),
  'Todas las entradas del registro tienen su constructor');

/* ⚠️ El callback sigue llegando de forma ASÍNCRONA, y no es un detalle: los
   cinco llamadores se escribieron contando con que la respuesta llega DESPUÉS
   del tap —abren sheets, generan documentos pesados y guardan el caso—.
   Resolver en línea cambiaría el orden en que ocurren esas cosas. */
const asincrono = await page.evaluate(() => new Promise(res => {
  let orden = [];
  lcPedirExport('OJ', 'prueba', () => { orden.push('callback'); res(orden); });
  orden.push('despues-de-llamar');
}));
log(asincrono[0] === 'despues-de-llamar' && asincrono[1] === 'callback',
  '⚠️ La decisión se entrega de forma asíncrona, como esperan los cinco llamadores',
  asincrono.join(' → '));

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fails ? `\n❌ ${fails} de ${n} comprobaciones fallaron` : `\n✅ ${n} comprobaciones, todas en verde`);
process.exit(fails ? 1 : 0);
