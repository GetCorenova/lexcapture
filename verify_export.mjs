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
log(await page.evaluate(() => lcPapelCfg()) === '', 'El equipo arranca SIN papel elegido');

/* ═══════════ 1. La PRIMERA vez sí se pregunta el papel ═══════════ */
await page.evaluate((id) => lcExportarCaso(id), ids.oj);
await page.waitForTimeout(300);
log(await page.isVisible('#exp-go'), 'Al exportar se abre el diálogo');
log(await page.isDisabled('#exp-go'), 'El botón de generar nace DESHABILITADO: nada sale sin elegir');
log(await page.isVisible('#exp-papel-OFICIO'), 'La primera vez SÍ se pregunta el tamaño del papel');

await page.click('#exp-fmt-DOCX');
await page.waitForTimeout(120);
log(await page.isDisabled('#exp-go'), 'Con solo el formato elegido sigue bloqueado');
log((await page.textContent('#exp-go')).includes('tamaño del papel'), 'Y dice que falta el tamaño');

await page.click('#exp-papel-OFICIO');
await page.waitForTimeout(120);
log(!(await page.isDisabled('#exp-go')), 'Elegidas ambas cosas, se habilita');
log((await page.textContent('#exp-go')).includes('Oficio'), 'El botón nombra lo que va a generar', await page.textContent('#exp-go'));

const [dlOficio] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.click('#exp-go')
]);
log(!!dlOficio, 'Se descarga el .docx en el tamaño elegido', dlOficio ? dlOficio.suggestedFilename() : '(sin descarga)');

/* ═══════════ 2. …y no se vuelve a preguntar nunca más ═══════════ */
log(await page.evaluate(() => lcPapelCfg()) === 'OFICIO',
  'La elección queda guardada como el papel del EQUIPO', await page.evaluate(() => lcPapelCfg()));

await page.evaluate((id) => lcExportarCaso(id), ids.oj);
await page.waitForTimeout(300);
log(await page.isVisible('#exp-go'), 'La segunda exportación sigue abriendo el diálogo (hay formato que elegir)');
log(!(await page.isVisible('#exp-papel-OFICIO').catch(() => false)),
  'Pero YA NO pregunta el tamaño: es del equipo, no del caso');
const lineaPapel = await page.textContent('#exp-papel-actual').catch(() => '');
log(/Oficio/.test(lineaPapel), 'Muestra cuál está en uso, no lo esconde', lineaPapel.replace(/\s+/g, ' ').trim());
log(await page.isVisible('#exp-papel-cambiar'), 'Y deja cambiarlo sin salir del diálogo');
log(await page.isDisabled('#exp-go'), 'El botón sigue esperando a que se elija el formato');
await page.click('#exp-fmt-DOCX');
await page.waitForTimeout(120);
log(!(await page.isDisabled('#exp-go')), 'Con solo elegir formato ya se puede generar: UNA pregunta, no dos');

/* ═══════════ 3. «Cambiar» vuelve a ofrecer los tamaños ═══════════ */
await page.click('#exp-papel-cambiar');
await page.waitForTimeout(200);
log(await page.isVisible('#exp-papel-CARTA'), '«Cambiar» vuelve a mostrar los tamaños');
await page.click('#exp-fmt-DOCX');
await page.click('#exp-papel-CARTA');
await page.waitForTimeout(120);
const [dlCarta] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.click('#exp-go')
]);
log(!!dlCarta, 'Genera con el tamaño nuevo');
log(await page.evaluate(() => lcPapelCfg()) === 'CARTA',
  'Y el cambio queda como el del equipo para la próxima vez', await page.evaluate(() => lcPapelCfg()));
await page.evaluate(() => lcGuardarPapel('OFICIO'));

/* ═══════════ 4. El FPJ-5 NO tiene PDF ═══════════ */
log(await page.evaluate(() => lcExportSoloWord('FPJ')) === true,
  'El FPJ-5 está declarado como documento solo-Word');
log(await page.evaluate(() => lcExportSoloWord('OJ')) === false,
  'El oficio de orden judicial sí ofrece los dos formatos');

/* Con el papel ya elegido y sin formato que preguntar, no queda ninguna
   pregunta: exportar el FPJ-5 descarga directamente. */
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

/* Si el equipo aún no ha elegido papel, al FPJ-5 se le pregunta solo eso. */
await page.evaluate(() => { const c = DB.getConfig(); c.papel = ''; DB.saveConfig(c); });
await page.evaluate((id) => lcExportarCaso(id), ids.fpj);
await page.waitForTimeout(300);
log(await page.isVisible('#exp-papel-CARTA'), 'Sin papel elegido, al FPJ-5 se le pregunta el tamaño');
log(!(await page.isVisible('#exp-fmt-PDF').catch(() => false)),
  'Pero NUNCA se le ofrece PDF, ni en la primera exportación');
const explica = await page.textContent('#modal').catch(() => '');
log(/formato oficial de la Fiscal/.test(explica), 'Y explica por qué, en vez de limitar en silencio');
const opcionesFpj = await page.$$eval('[id^="exp-papel-"]', els => els.map(e => e.id.replace('exp-papel-', '')).filter(x => x !== 'actual' && x !== 'cambiar'));
log(opcionesFpj.join(',') === 'CARTA,OFICIO',
  'El FPJ-5 solo ofrece los tamaños que respetan el ancho de sus casillas', opcionesFpj.join(','));
await page.evaluate(() => lcExportCancelar());
await page.waitForTimeout(200);
await page.evaluate(() => lcGuardarPapel('OFICIO'));

log(await page.evaluate(() => lcPapelesFPJ().join(',')) === 'CARTA,OFICIO',
  'lcPapelesFPJ() mantiene la lista corta');
log(await page.evaluate(() => { lcGuardarPapel('P8X135'); const r = lcPapelEfectivo('FPJ'); lcGuardarPapel('OFICIO'); return r; }) === 'CARTA',
  'Salvaguarda: si el equipo elige un ancho que el FPJ-5 no admite, ese formato cae a Carta');

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
log(trama.total === 23, 'Las 23 celdas de etiqueta conservan su trama gris en la vista de impresión', trama.total);
log(trama.porTabla.length === 3 && trama.porTabla.join(',') === '9,10,4',
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

/* ═══════════ 9. El papel es visible y cambiable en Ajustes ═══════════ */
await page.evaluate(() => { lcGuardarPapel('OFICIO'); go('ajustes'); loadAjustesFields(); toggleAjSec('docs-sec'); });
await page.waitForTimeout(300);
log(await page.isVisible('#aj-papel-grid'), 'Ajustes → Documentos muestra el tamaño de papel');
const ajOpts = await page.$$eval('#aj-papel-grid .exp-opt', els => els.map(e => ({ id: e.id.replace('aj-papel-', ''), on: e.classList.contains('on') })));
log(ajOpts.length === 3, 'Con los tres tamaños', ajOpts.map(o => o.id).join(','));
log(ajOpts.filter(o => o.on).map(o => o.id).join() === 'OFICIO',
  'Y marcado el que está en uso: la decisión recordada nunca es invisible',
  ajOpts.filter(o => o.on).map(o => o.id).join() || '(ninguno)');
await page.click('#aj-papel-CARTA');
await page.waitForTimeout(250);
log(await page.evaluate(() => lcPapelCfg()) === 'CARTA',
  'Cambiarlo se aplica al instante, sin pasar por «Guardar ajustes»', await page.evaluate(() => lcPapelCfg()));
log(await page.$eval('#aj-papel-CARTA', e => e.classList.contains('on')), 'Y la selección se repinta');
const dlAj = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.evaluate((id) => lcExportarCaso(id), ids.fpj)
]).then(r => r[0]);
log(!!dlAj, 'El siguiente documento sale ya con el papel de Ajustes, sin volver a preguntar');
const fpjPapel = await page.evaluate((id) => buildFPJBlob(DB.getCase(id), lcPapelEfectivo('FPJ')).papel, ids.fpj);
log(fpjPapel === 'CARTA', 'Y el motor recibe ese mismo tamaño, no otro', fpjPapel);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fails ? `\n❌ ${fails} de ${n} comprobaciones fallaron` : `\n✅ ${n} comprobaciones, todas en verde`);
process.exit(fails ? 1 : 0);
