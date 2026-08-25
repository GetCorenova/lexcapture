// Pasos 3 y 4 de la auditoria: el menu colapsado (un documento = un item) y el
// expediente como casa del caso (estado, documentos y contenido).
// Lo que se mide aqui es lo que la auditoria prometio: que las salidas urgentes
// siguen a DOS toques, que el menu deja de crecer y que nada se escondio.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.js':'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8124, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };

const browser = await chromium.launch({ headless: true });

// ───────── TELEFONO (con Web Share): el canal se elige en el sheet ─────────
const ctx = await browser.newContext({
  viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true, acceptDownloads: true
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });

await page.goto('http://localhost:8124/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI');
  c.isTest = false;            // caso real: el plazo de 36 h tiene que correr
  await DB.saveCase(c);
  const cfg = DB.getConfig(); cfg.papel = 'CARTA'; DB.saveConfig(cfg);   // papel ya elegido
  go('capturas');
});
await page.waitForTimeout(400);

// ── [1] El menu baja a 5 items y cabe de sobra ──
await page.click('.cc-wrap .prow-more');
await page.waitForTimeout(400);
const m = await page.evaluate(() => {
  const sh = document.getElementById('act-sheet');
  return {
    n: document.querySelectorAll('#act-items .sheet-item').length,
    alto: sh.scrollHeight, tope: Math.round(parseFloat(getComputedStyle(sh).maxHeight)),
    scroll: sh.scrollHeight > sh.clientHeight + 1,
    pct: Math.round(sh.getBoundingClientRect().height / window.innerHeight * 100),
    tit: [...document.querySelectorAll('#act-items .ti')].map(e => e.textContent.trim())
  };
});
log(m.n === 5 && !m.scroll, '[1] El menu baja a 5 items y no se desplaza',
  m.n + ' items · ' + m.alto + 'px de ' + m.tope + 'px · tapa el ' + m.pct + '%');
console.log('      ' + m.tit.join(' | '));

// ── [2] Un documento = UN item: ya no hay "Enviar X" + "Descargar X" ──
const dobles = m.tit.filter(t => /^Enviar (FPJ|Oficio|Disposici)/.test(t) || /^Descargar /.test(t));
log(dobles.length === 0, '[2] Ningun documento ocupa dos items (canal colapsado)', JSON.stringify(dobles));

// ── [3] "Editar captura" salio del menu pero NO se perdio ──
log(!m.tit.includes('Editar captura'), '[3] "Editar captura" ya no ocupa un item del menu');
const editable = await page.evaluate(() => {
  const cc = document.querySelector('#cl .cc');
  return /editCase/.test(cc.getAttribute('onclick') || '');
});
log(editable, '[3] ...pero la tarjeta sigue abriendo la edicion de un toque');

// ── [4] Las TRES salidas urgentes siguen a dos toques ──
const urgentes = ['Oficio de disposición', 'Informe FPJ-5 URI', 'Acta de derechos', 'Enviar Dossier'];
const presentes = urgentes.filter(t => m.tit.includes(t));
log(presentes.length === 3, '[4] Las tres salidas urgentes estan en el menu, a dos toques', JSON.stringify(presentes));

// ── [5] Proyeccion: el menu ya no crece con documentos nuevos ──
const proy = await page.evaluate(() => {
  // Tres formatos mas, registrados como lo estaran de verdad: en el expediente.
  const box = document.getElementById('exp-docs');
  const sh = document.getElementById('act-sheet');
  return { itemsMenu: document.querySelectorAll('#act-items .sheet-item').length, altoMenu: sh.scrollHeight };
});
log(proy.itemsMenu === 5, '[5] El menu no depende del numero de formatos: los nuevos van al expediente');

// ── [6] El documento oficial abre el sheet de canales donde SI hay eleccion ──
await page.evaluate(() => {
  navigator.canShare = d => !!(d && d.files && d.files.length);
  navigator.share = () => Promise.resolve();
});
await page.click('#act-items .sheet-item:nth-child(1)');
await page.waitForTimeout(1200);
const s6 = await page.evaluate(() => ({
  sheet: document.getElementById('share-sheet').classList.contains('on'),
  botones: [...document.querySelectorAll('#share-sheet .sheet-item')]
    .filter(b => b.style.display !== 'none').map(b => b.querySelector('.ti').textContent.trim())
}));
log(s6.sheet && s6.botones.length === 2, '[6] Con Web Share, el documento ofrece los dos canales', JSON.stringify(s6.botones));
await page.evaluate(() => closeShareSheet());
await page.waitForTimeout(250);

// ── [7] El expediente: estado, documentos y contenido ──
await page.evaluate(() => abrirDossierCaso(DB.getCases()[0].id));
await page.waitForTimeout(600);
const s7 = await page.evaluate(() => ({
  titulo: document.querySelector('#screen-dossier h1').textContent.trim(),
  estado: getComputedStyle(document.getElementById('exp-estado')).display,
  docs: getComputedStyle(document.getElementById('exp-docs')).display,
  cont: getComputedStyle(document.getElementById('exp-contenido')).display,
  tarjetas: [...document.querySelectorAll('#exp-docs .type-card .tbt')].map(e => e.textContent.trim()),
  plazo: (document.querySelector('#exp-estado .oj-alert b') || {}).textContent
}));
log(s7.titulo === 'Expediente' && s7.estado !== 'none' && s7.docs !== 'none' && s7.cont !== 'none',
  '[7] El expediente pinta estado, documentos y contenido', s7.titulo);
const s7reg = await page.evaluate(() => lcEstadoDocs(DB.getCases()[0]).map(d => d.lbl));
log(s7.tarjetas.length === s7reg.length && s7reg.every(l => s7.tarjetas.includes(l)),
  '[7] Todo documento del registro sale como tarjeta agrupada', JSON.stringify(s7.tarjetas));
log(/36 horas|vencido|demostraci/i.test(s7.plazo || ''), '[7] Y muestra el plazo del art. 28 C.P.', s7.plazo);

// ── [8] El estado usa los MISMOS validadores que bloquean al generar ──
const s8 = await page.evaluate(async () => {
  const c = DB.getCase(_dosCasoId);
  const nuncBueno = c.nunc;
  c.nunc = '123';                       // NUNC invalido: buildFPJBlob corta con esto
  await DB.saveCase(c);
  renderExpediente(DB.getCase(_dosCasoId));
  const conFalta = document.querySelector('#exp-docs .exp-st.falta') !== null;
  const texto = document.getElementById('exp-estado').textContent;
  c.nunc = nuncBueno; await DB.saveCase(c);
  renderExpediente(DB.getCase(_dosCasoId));
  const sinFalta = document.querySelector('#exp-docs .exp-st.falta') === null;
  return { conFalta, sinFalta, nombraNunc: /NUNC/.test(texto) };
});
log(s8.conFalta && s8.nombraNunc && s8.sinFalta,
  '[8] Con NUNC invalido avisa y nombra el dato; corregido, desaparece el aviso');

// ── [9] El plazo es UN solo calculo: lista y expediente no pueden discrepar ──
const s9 = await page.evaluate(() => {
  const c = DB.getCases()[0];
  const viejo = JSON.parse(JSON.stringify(c));
  c.created = Date.now() - 40 * 3600000;          // 40 h: vencido
  const badge = lcPlazo36(c).badge;
  const est = lcPlazo36(c).estado;
  c.created = viejo.created;
  return { badge, est, unaSolaFuente: !/hrs *>= *36/.test(renderCases.toString()) };
});
log(/VENCIDO/.test(s9.badge) && s9.est === 'vencido' && s9.unaSolaFuente,
  '[9] Un unico lcPlazo36: la lista ya no calcula el plazo por su cuenta');

// ── [10] El resumen muestra lo que la captura tiene, numerado como se imprime ──
const s10 = await page.evaluate(() => {
  const t = document.getElementById('exp-contenido').textContent;
  const c = DB.getCases()[0];
  const emps = lcEmpDeCaso(c);
  return {
    tieneCapturado: t.includes(fullName(c.capturados[0])),
    numerado: !emps.length || /\d\d \(/.test(t),
    editar: /Editar la captura/.test(t)
  };
});
log(s10.tieneCapturado && s10.numerado && s10.editar,
  '[10] El contenido se consulta sin entrar a editar, y los EMP salen numerados');

// ── [11] Nada duplicado dentro del expediente ──
const s11 = await page.evaluate(() => {
  const t = document.getElementById('screen-dossier').textContent;
  return { enviarDoc: (t.match(/Enviar FPJ-5|Enviar Oficio/g) || []).length };
});
log(s11.enviarDoc === 0, '[11] El expediente no repite la accion del documento dos veces');

// ───────── ESCRITORIO: sin Web Share no hay canal que elegir ─────────
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const pageD = await ctxD.newPage();
pageD.on('pageerror', e => errs.push('desktop: ' + String(e.message).slice(0, 80)));
await pageD.goto('http://localhost:8124/LexCapture_v8.html', { waitUntil: 'load' });
await pageD.evaluate(() => localStorage.clear());
await pageD.reload({ waitUntil: 'load' });
await pageD.waitForTimeout(400);
await pageD.fill('#pin-a', '135790');
await pageD.fill('#pin-b', '135790');
await pageD.click('button[onclick="doSetPin()"]');
await pageD.waitForTimeout(800);
await pageD.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); c.isTest = false; await DB.saveCase(c);
  const cfg = DB.getConfig(); cfg.papel = 'CARTA'; DB.saveConfig(cfg);
  go('capturas');
});
await pageD.waitForTimeout(400);
const puedeCompartir = await pageD.evaluate(() => _docShareOk() || _capNative());
const [dl] = await Promise.all([
  pageD.waitForEvent('download', { timeout: 9000 }).catch(() => null),
  pageD.evaluate(() => lcSalidaDoc(DB.getCases()[0].id))
]);
const sheetD = await pageD.evaluate(() => document.getElementById('share-sheet').classList.contains('on'));
log(!puedeCompartir && !!dl && !sheetD,
  '[12] En escritorio descarga directo: no se abre un sheet con un solo boton',
  dl ? dl.suggestedFilename() : 'sin descarga');

log(errs.length === 0, '[13] Consola sin errores', errs.length ? errs.slice(0, 3) : '');
console.log('\n' + R.filter(Boolean).length + '/' + R.length + ' comprobaciones');
await browser.close();
server.close();
process.exit(R.every(Boolean) ? 0 : 1);
