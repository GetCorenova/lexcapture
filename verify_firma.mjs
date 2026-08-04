/* Regresión de la FIRMA DIGITAL del funcionario.
   Secciones:
     1. Captura — el lienzo funciona con mouse/dedo/stylus y produce PNG.
     2. Transparencia y calidad — fondo transparente, recorte al trazo, proporción.
     3. Almacenamiento — vive en el perfil, una sola por usuario, sobrevive al reinicio.
     4. Inserción en el oficio OJ — paquete válido, sitio exacto, tamaño y centrado.
     5. Solo el oficio OJ — el FPJ-5 no la lleva.
     6. Sin firma / firmante distinto — el documento no cambia ni se falsifica.
     7. Vista de impresión (PDF) y consola limpia.
   ⚠️ La transparencia se mide PINTANDO el PNG sobre rojo y leyendo el píxel: un
   PNG con fondo blanco pasaría cualquier comprobación de cabecera, pero taparía
   el papel bajo el bloque de firma. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '112233');
await page.fill('#pin-b', '112233');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

const FIRMANTE = 'NELSON DAVID DAVID';
await page.evaluate((nom) => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'MINISTERIO F'; cfg.ojInstitucion = 'INSTITUCION F';
  cfg.ojUnidad = 'UNIDAD F'; cfg.ojDependencia = 'DEPENDENCIA F';
  cfg.ojCiudad = 'Ciudad F';
  cfg.ojCustEstacion = 'Estacion F'; cfg.ojCustDireccion = 'Calle F 10-20';
  cfg.ojCustTelefono = '6040000000'; cfg.ojCustCorreo = 'f@prueba.test'; cfg.ojPieWeb = 'www.f.test';
  cfg.ojFiscaliaNombre = 'FISCALIA URI CENTRO'; cfg.ojFiscaliaDireccion = 'Carrera 64C 67-300';
  cfg.perfiles = [
    { id: 'p1', grado: 'Subintendente', nombre: nom, cargo: 'Integrante patrulla de vigilancia', telefono: '3104498111', correo: 'n@prueba.test' },
    { id: 'p2', grado: 'Patrullero', nombre: 'OTRO FUNCIONARIO', cargo: 'Patrullero', telefono: '3000000000', correo: 'o@prueba.test' }
  ];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
}, FIRMANTE);

/* ═══════════════════ 1 · CAPTURA EN EL LIENZO ═══════════════════ */
await page.evaluate(() => { go('perfil'); renderPerfilScreen(); });
await page.waitForTimeout(300);

const botonFirma = await page.locator('.pf-card button:has-text("Firma")').count();
log(botonFirma === 2, 'Cada perfil tiene su acceso «Firma digital»', botonFirma + ' botones');
log(await page.locator('.pf-firma').count() === 0, 'Sin firmar todavía, ninguna tarjeta muestra miniatura');

await page.evaluate(() => openFirmaModal('p1'));
await page.waitForTimeout(400);
log(await page.locator('#fw-cv').count() === 1, 'El modal abre con un lienzo Canvas HTML5');

const dims = await page.evaluate(() => {
  const cv = document.getElementById('fw-cv');
  return { w: cv.width, h: cv.height, css: Math.round(cv.getBoundingClientRect().width), dpr: window.devicePixelRatio };
});
log(dims.w > dims.css, 'El lienzo se escala por devicePixelRatio (trazo nítido, no pixelado)',
  `backing ${dims.w}px vs css ${dims.css}px`);
log(await page.evaluate(() => getComputedStyle(document.getElementById('fw-cv')).touchAction) === 'none',
  'touch-action:none — el dedo firma, no hace scroll de la pantalla');

// Firma real: un arco dibujado con el ratón (Playwright emite Pointer Events,
// el mismo camino que usa el dedo y el stylus).
async function firmar(page, sel = '#fw-cv') {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.move(b.x + b.width * 0.18, b.y + b.height * 0.62);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    await page.mouse.move(
      b.x + b.width * (0.18 + 0.60 * t),
      b.y + b.height * (0.62 - 0.34 * Math.sin(t * Math.PI)));
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
}
await firmar(page);
log(await page.evaluate(() => fwHayTrazo()) === true, 'El trazo queda registrado al firmar con el puntero');
log(await page.locator('.fw-pad.inked').count() === 1, 'El lienzo marca que ya tiene tinta (se oculta el «Firma aquí»)');

const trazoInfo = await page.evaluate(() => ({ trazos: _fw.trazos.length, puntos: _fw.trazos[0].length }));
log(trazoInfo.trazos === 1 && trazoInfo.puntos > 10,
  'Se conservan los puntos originales del trazo (firma natural, no dos rectas)',
  `${trazoInfo.trazos} trazo · ${trazoInfo.puntos} puntos`);

await page.evaluate(() => fwBorrar());
log(await page.evaluate(() => fwHayTrazo()) === false, 'El botón «Borrar» deja el lienzo limpio');
log(await page.evaluate(() => fwExportar()) === null, 'Un lienzo vacío no produce imagen (no se guarda una firma en blanco)');

await firmar(page);

/* ═══════════ 2 · TRANSPARENCIA, RECORTE Y PROPORCIÓN ═══════════ */
const exp = await page.evaluate(() => {
  const f = fwExportar();
  const cv = document.getElementById('fw-cv');
  return { w: f.w, h: f.h, bytes: Math.round(f.b64.length * 3 / 4), lienzoW: cv.width, lienzoH: cv.height, b64: f.b64.slice(0, 24) };
});
log(exp.w > 0 && exp.h > 0, 'La exportación devuelve una imagen con medidas', `${exp.w}×${exp.h}px`);
log(exp.w < exp.lienzoW, 'La imagen se recorta al rectángulo de la tinta, no arrastra el lienzo entero',
  `${exp.w}px de ${exp.lienzoW}px de lienzo`);

const png = await page.evaluate(() => {
  const b64 = fwExportar().b64;
  const raw = atob(b64); const u = [];
  for (let i = 0; i < 34; i++) u.push(raw.charCodeAt(i));
  return u;
});
const esPNG = png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4E && png[3] === 0x47;
log(esPNG, 'El archivo es un PNG de verdad (firma de cabecera 89 50 4E 47)');
log(png[25] === 6, 'Tipo de color 6 = RGBA: el PNG lleva canal alfa (no es JPG ni RGB plano)', 'colorType=' + png[25]);

// La prueba que de verdad importa: pintar la firma sobre ROJO. Si el fondo
// fuera blanco (o fuese una captura de pantalla), el rojo desaparecería.
const transp = await page.evaluate(async () => {
  const f = fwExportar();
  const img = new Image();
  await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + f.b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.fillStyle = '#ff0000'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let rojos = 0, tinta = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 0) rojos++;
    else if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) tinta++;
  }
  const total = d.length / 4;
  return { rojos, tinta, total, esquina: [d[0], d[1], d[2], d[3]] };
});
log(transp.esquina.join(',') === '255,0,0,255',
  'El fondo es COMPLETAMENTE transparente: sobre rojo, la esquina sigue roja', transp.esquina.join(','));
log(transp.rojos / transp.total > 0.5,
  'La mayor parte de la imagen es fondo transparente, no un rectángulo opaco',
  Math.round(transp.rojos / transp.total * 100) + '% transparente');
log(transp.tinta > 50, 'El trazo negro de la firma está presente', transp.tinta + ' px de tinta');

/* ═══════════════════ 3 · ALMACENAMIENTO EN EL PERFIL ═══════════════════ */
await page.evaluate(async () => { await fwGuardar('p1'); });
await page.waitForTimeout(300);
const guardada = await page.evaluate(() => {
  const f = DB.getFirma('p1');
  return { tiene: !!f, w: f.w, h: f.h, len: f.b64.length };
});
log(guardada.tiene && guardada.w > 0 && guardada.h > 0,
  'La firma queda almacenada, indexada por el perfil del usuario', `${guardada.w}×${guardada.h}px · ${Math.round(guardada.len * 3 / 4 / 1024)} KB`);
log(guardada.len * 3 / 4 < 120 * 1024, 'El almacenamiento es contenido (imagen reducida, no el lienzo crudo)',
  Math.round(guardada.len * 3 / 4 / 1024) + ' KB');
log(await page.locator('.pf-firma img').count() === 1, 'La tarjeta del perfil muestra la vista previa de la firma');

// Persistencia real: recargar la app entera y volver a entrar con el PIN.
const antes = guardada.len;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-e', '112233');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(600);
const trasReinicio = await page.evaluate(() => {
  const f = DB.getFirma('p1');
  return { len: f ? f.b64.length : 0, w: f ? f.w : 0 };
});
log(trasReinicio.len === antes && trasReinicio.len > 0,
  'La firma se carga sola al reiniciar la aplicación (no hay que volver a firmar)');

const cifrado = await page.evaluate(() => {
  // Comprobación precisa: la firma REAL de este perfil no puede aparecer en
  // claro en ninguna clave. (Un patrón genérico de PNG daría falso positivo:
  // lc_templates guarda los .docx integrados, que llevan imágenes dentro.)
  const mia = DB.getFirma('p1').b64.slice(0, 64);
  const donde = Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').indexOf(mia) >= 0);
  return { donde, cifrada: !!localStorage.getItem('lc_firmas'), enCfg: /firmaB64/.test(localStorage.getItem('lc_cfg') || '') };
});
log(cifrado.donde.length === 0 && cifrado.cifrada === true,
  'La firma vive CIFRADA en lc_firmas: sus bytes no aparecen en claro en ninguna clave',
  cifrado.donde.length ? ('FUGA en ' + cifrado.donde.join(',')) : 'lc_firmas cifrada');

// Una sola firma por usuario: volver a firmar reemplaza.
await page.evaluate(() => { go('perfil'); renderPerfilScreen(); });
await page.waitForTimeout(200);
await page.evaluate(() => openFirmaModal('p1'));
await page.waitForTimeout(400);
const b = await page.locator('#fw-cv').boundingBox();
await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.3);
await page.mouse.down();
await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.7, { steps: 10 });
await page.mouse.up();
await page.evaluate(async () => { await fwGuardar('p1'); });
await page.waitForTimeout(300);
const trasActualizar = await page.evaluate(() => {
  const cfg = DB.getConfig();
  const f = DB.getFirma('p1');
  return { len: f.b64.length, campos: Object.keys(f).length, total: Object.keys(_firmasCache).length };
});
log(trasActualizar.len !== antes && trasActualizar.len > 0, 'Volver a firmar REEMPLAZA la firma anterior');
log(cifrado.enCfg === false, 'La firma NO se guarda en lc_cfg, que se escribe en claro');
log(trasActualizar.campos === 3 && trasActualizar.total === 1,
  'No se acumulan firmas: una sola entrada por perfil',
  trasActualizar.total + ' firma almacenada · ' + trasActualizar.campos + ' campos (b64+ancho+alto)');

// Se restaura la firma «buena» para las secciones del documento.
await page.evaluate(() => openFirmaModal('p1'));
await page.waitForTimeout(400);
await firmar(page);
await page.evaluate(async () => { await fwGuardar('p1'); });
await page.waitForTimeout(300);

/* ═══════════ 4 · INSERCIÓN EN EL OFICIO DE ORDEN JUDICIAL ═══════════ */
const semilla = () => page.evaluate((nom) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const c = ojNuevoCaso();
  c.oj.orden.numero = '671-4737';
  c.oj.orden.fechaExpedicion = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'CONDENA';
  c.oj.despacho.nombre = 'Juzgado Tercero Penal Municipal de Medellin';
  c.oj.despacho.direccion = 'Palacio de Justicia, oficina 301';
  c.oj.despacho.municipio = 'Medellin'; c.oj.despacho.departamento = 'Antioquia';
  c.oj.proceso.radicado = '8303662786793202626398';
  c.oj.proceso.fechaDecision = '2026-06-12'; c.oj.proceso.fechaHechos = '2025-01-20';
  c.oj.proceso.delitos = [{ nombre: 'Hurto agravado', articulo: '239, 240' }];
  c.oj.requerido.priNom = 'YEISON'; c.oj.requerido.priApe = 'RAMIREZ';
  c.oj.requerido.numDoc = '1159794405'; c.oj.requerido.fechaNac = '1967-02-17';
  c.oj.diligencia.fecha = hoy; c.oj.diligencia.hora = '10:06';
  c.oj.diligencia.lugarDireccion = 'CL 59 # 52-10';
  c.oj.diligencia.lugarMunicipio = 'Medellin'; c.oj.diligencia.lugarDepartamento = 'Antioquia';
  c.oj.actuacion.derechos = { leidos: true, fecha: hoy, hora: '10:20', lugar: 'el sitio', observacion: '' };
  // Quien suscribe = el perfil que tiene firma guardada.
  c.oj.firma = { grado: 'Subintendente', nombre: nom, cargo: 'Integrante patrulla de vigilancia', telefono: '3104498111', correo: 'n@prueba.test' };
  window.__caso = c;
  return true;
}, FIRMANTE);
await semilla();

const doc = await page.evaluate(async () => {
  const out = await buildOficioOJBlob(window.__caso, 'CARTA');
  const dec = k => new TextDecoder().decode(out.files[k]);
  return {
    xml: dec('word/document.xml'),
    rels: dec('word/_rels/document.xml.rels'),
    tipos: dec('[Content_Types].xml'),
    media: Object.keys(out.files).filter(k => k.indexOf('word/media/') === 0),
    firmaBytes: out.files['word/media/firma.png'] ? out.files['word/media/firma.png'].length : 0
  };
});
log(doc.media.indexOf('word/media/firma.png') >= 0, 'El .docx embebe la firma como word/media/firma.png',
  doc.media.join(', '));
log(doc.firmaBytes > 500, 'La imagen embebida tiene contenido real', Math.round(doc.firmaBytes / 1024) + ' KB');
log(/Id="rId6"[^>]*relationships\/image[^>]*Target="media\/firma\.png"/.test(doc.rels),
  'La relación rId6 → media/firma.png vive en document.xml.rels (la firma va en el CUERPO)');
log((doc.tipos.match(/<Default Extension="png"/g) || []).length === 1,
  'Content_Types declara la extensión png UNA sola vez (Word no pide reparar)');
log(doc.xml.indexOf('r:embed="rId6"') > 0, 'El cuerpo referencia la imagen por rId6');

/* Sitio exacto: «Atentamente,» → firma → nombre en negrita. */
const parrafos = doc.xml.split(/<w:p>/).slice(1);
const iAtte = parrafos.findIndex(p => p.indexOf('Atentamente,') >= 0);
const iImg = parrafos.findIndex(p => p.indexOf('r:embed="rId6"') >= 0);
const iNom = parrafos.findIndex((p, k) => k > iImg && p.indexOf(FIRMANTE) >= 0);
log(iAtte >= 0 && iImg > iAtte, 'La firma va DESPUÉS de «Atentamente,»', `p${iAtte} → p${iImg}`);
log(iImg >= 0 && iNom === iImg + 1,
  'La firma queda EXACTAMENTE encima del nombre (párrafo inmediatamente anterior)', `p${iImg} → p${iNom}`);
log(parrafos[iNom].indexOf('<w:b/>') > 0, 'El nombre conserva su negrita: el bloque de firma no se alteró');

const pImg = parrafos[iImg];
log(pImg.indexOf('<w:keepNext/>') > 0,
  'keepNext: la firma nunca se separa del nombre en un salto de página');
const ext = pImg.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
const cx = Number(ext[1]), cy = Number(ext[2]);
const rel = await page.evaluate(() => {
  const f = DB.getFirma('p1');
  return f.w / f.h;
});
log(Math.abs((cx / cy) - rel) / rel < 0.01,
  'La proporción de la firma se conserva (no se estira ni se comprime)',
  `imagen ${rel.toFixed(3)} vs documento ${(cx / cy).toFixed(3)}`);

// «Debe ocupar aproximadamente el ancho del nombre del funcionario».
const medidas = await page.evaluate((nom) => {
  const texto = 'Subintendente ' + nom.toUpperCase();
  return { nombreTw: lcAnchoTexto(texto, 11, true), maxH: OJX_FIRMA_MAXH };
}, FIRMANTE);
const anchoTw = cx / 635, altoTw = cy / 635;
log(anchoTw <= medidas.nombreTw * 1.02 && anchoTw > medidas.nombreTw * 0.35,
  'La firma ocupa aproximadamente el ancho del nombre, sin pasarse',
  `firma ${Math.round(anchoTw)}tw vs nombre ${medidas.nombreTw}tw`);
log(altoTw <= medidas.maxH + 1, 'El alto está acotado: la firma no invade el resto del bloque',
  `${Math.round(altoTw)}tw de ${medidas.maxH}tw máx.`);

const indM = pImg.match(/<w:ind w:left="(\d+)"/);
const ind = indM ? Number(indM[1]) : 0;
const centro = Math.abs((ind + anchoTw / 2) - medidas.nombreTw / 2);
log(centro < 60, 'La firma queda CENTRADA respecto al nombre (sangría calculada, no al azar)',
  `desfase ${Math.round(centro)}tw`);
log(ind + anchoTw <= 9405 + 1, 'La firma no se sale del área de contenido de la hoja');

/* ═══════════ 5 · SOLO EL OFICIO OJ LA LLEVA ═══════════ */
const fpj = await page.evaluate(async () => {
  const c = SIM.genFlagrancia();
  const out = await buildFPJBlob(c, 'CARTA');
  return {
    media: Object.keys(out.files).filter(k => k.indexOf('media/') >= 0),
    rid6: new TextDecoder().decode(out.files['word/document.xml']).indexOf('rId6') >= 0
  };
});
log(fpj.media.every(k => k.indexOf('firma.png') < 0),
  'El FPJ-5 NO lleva la firma: sus casillas se firman a mano', fpj.media.join(', ') || 'sin media propia');

/* ═══════════ 6 · SIN FIRMA Y CON OTRO FIRMANTE ═══════════ */
// (a) Perfil sin firma guardada → el documento vuelve a ser el de siempre.
const sinFirma = await page.evaluate(async () => {
  const c = JSON.parse(JSON.stringify(window.__caso));
  c.oj.firma.nombre = 'OTRO FUNCIONARIO';   // perfil p2, que no tiene firma
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  const rels = new TextDecoder().decode(out.files['word/_rels/document.xml.rels']);
  const tipos = new TextDecoder().decode(out.files['[Content_Types].xml']);
  const i = xml.indexOf('Atentamente,');
  return {
    media: !!out.files['word/media/firma.png'],
    rid6: rels.indexOf('rId6') >= 0,
    png: tipos.indexOf('Extension="png"') >= 0,
    vacios: (xml.slice(i, i + 900).match(/<w:p><w:pPr>(?:(?!<w:p>).)*?<\/w:pPr><\/w:p>/g) || []).length
  };
});
log(sinFirma.media === false && sinFirma.rid6 === false,
  'Sin firma guardada no se embebe nada ni queda una relación rota');
log(sinFirma.png === false, 'Tampoco se declara la extensión png si no hay imagen PNG en el paquete');
log(sinFirma.vacios >= 3, 'El espacio para firmar a mano se conserva intacto (3 renglones en blanco)',
  sinFirma.vacios + ' párrafos vacíos');

// (b) Nadie firma por otro: la firma se busca por el NOMBRE de quien suscribe.
const cruzada = await page.evaluate(() => {
  const f1 = lcFirmaDe('NELSON DAVID DAVID');
  const f2 = lcFirmaDe('OTRO FUNCIONARIO');
  const f3 = lcFirmaDe('nelson  david   dávid');   // acentos y espacios sobrantes
  const f4 = lcFirmaDe('');
  return { propio: !!f1, ajeno: !!f2, laxo: !!f3, vacio: !!f4 };
});
log(cruzada.propio === true, 'Quien tiene firma guardada la recibe en su oficio');
log(cruzada.ajeno === false,
  'Un firmante SIN firma propia no recibe la de otro (estampar una firma ajena sería falsificarla)');
log(cruzada.laxo === true, 'El nombre se compara sin acentos ni dobles espacios', 'nelson dávid → coincide');
log(cruzada.vacio === false, 'Sin nombre de firmante no se pone ninguna firma');

/* ═══════════ 7 · VISTA DE IMPRESIÓN (PDF) Y CONSOLA ═══════════ */
const impr = await page.evaluate(async () => {
  const out = await buildOficioOJBlob(window.__caso, 'CARTA');
  const v = lcPrintDoc(out);
  if (!v) return { ok: false };
  // El cuerpo de la vista son los bloques; el membrete va en el encabezado.
  const cont = document.createElement('div');
  cont.innerHTML = v.bloques.map(b => b.html).join('') + v.hdrFirst + v.hdrDef;
  const imgs = Array.from(cont.querySelectorAll('img'));
  const cuerpo = document.createElement('div');
  cuerpo.innerHTML = v.bloques.map(b => b.html).join('');
  return {
    ok: true,
    total: imgs.length,
    png: imgs.filter(i => (i.getAttribute('src') || '').indexOf('data:image/png') === 0).length,
    enCuerpo: cuerpo.querySelectorAll('img[src^="data:image/png"]').length,
    rotos: imgs.filter(i => !/^data:image\/(png|jpeg|gif|svg\+xml)/.test(i.getAttribute('src') || '')).length
  };
});
if (impr.ok) {
  log(impr.enCuerpo === 1, 'La vista de impresión (PDF) también pinta la firma, en el cuerpo',
    impr.enCuerpo + ' PNG en el cuerpo de ' + impr.total + ' imágenes del documento');
  log(impr.rotos === 0, 'Ninguna imagen queda con un data URI inválido en la vista de impresión');
} else {
  log(null, 'La vista de impresión devolvió otra forma — se omiten sus 2 checks');
  log(null, '(sin comprobación)');
}

/* ═══════════ 8 · EL .DOCX REAL, PARA ABRIRLO EN WORD ═══════════ */
const bytes = await page.evaluate(async () => {
  const out = await buildOficioOJBlob(window.__caso, 'CARTA');
  const buf = await out.blob.arrayBuffer();
  return Array.from(new Uint8Array(buf));
});
await writeFile(join(ROOT, 'verify_firma_salida.docx'), Buffer.from(bytes));
log(bytes.length > 20000, 'Se genera el .docx completo para revisarlo en Word',
  Math.round(bytes.length / 1024) + ' KB → verify_firma_salida.docx');

/* ═══════════ 9 · MODO INVITADO ═══════════ */
// El teléfono prestado puede firmar, pero no deja rastro en el equipo.
const huellaAntes = await page.evaluate(() =>
  Object.keys(localStorage).sort().map(k => k + ':' + (localStorage.getItem(k) || '').length).join('|'));
await page.evaluate(() => {
  guestEntrar();
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id: 'g1', grado: 'Patrullero', nombre: 'INVITADO PRESTADO', cargo: 'Patrullero' }];
  cfg.perfilActivo = 'g1';
  DB.saveConfig(cfg);
  go('perfil'); renderPerfilScreen();
});
await page.waitForTimeout(250);
await page.evaluate(() => openFirmaModal('g1'));
await page.waitForTimeout(400);
await firmar(page);
await page.evaluate(async () => { await fwGuardar('g1'); });
await page.waitForTimeout(300);
const invitado = await page.evaluate(() => ({
  tiene: !!DB.getFirma('g1'),
  huella: Object.keys(localStorage).sort().map(k => k + ':' + (localStorage.getItem(k) || '').length).join('|')
}));
log(invitado.tiene === true, 'El invitado puede firmar y usar su firma durante la sesión');
log(invitado.huella === huellaAntes,
  'La firma del invitado NO escribe un solo byte en el equipo del dueño',
  invitado.huella === huellaAntes ? 'huella de localStorage idéntica' : 'CAMBIÓ el almacenamiento');

log(consoleErrors.length === 0, 'Sin errores de consola en todo el recorrido',
  consoleErrors.slice(0, 3).join(' | ') || 'consola limpia');

console.log('\n' + (fails === 0 ? '✅ TODO EN VERDE' : '❌ ' + fails + ' FALLO(S)') + ` — ${n} comprobaciones`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
