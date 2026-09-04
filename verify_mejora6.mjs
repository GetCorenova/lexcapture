/* Mejora 6 — el menu de la captura queda en CUATRO cosas que se HACEN con ella,
   el dossier estrena modulo propio y el expediente es la unica casa de los
   documentos: los seis, cada uno con su canal (descargar o enviar), y solo los
   que ese procedimiento produce de verdad.
   Se mide sobre la app real en un telefono (384x800, touch), no sobre el codigo. */
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
await new Promise(r => server.listen(8137, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true, acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 110)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 110)); });

await page.goto('http://localhost:8137/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(900);

/* Un caso de flagrancia CON elementos en el numeral 7 (los tres formatos del
   apartado los necesitan) y uno de orden judicial, que NO los produce. */
const ids = await page.evaluate(async () => {
  const u = SIM.genFlagrancia('URI');
  u.isTest = false;
  u.elementos = [{ id:'e1', cant:'2', desc:'celulares marca Samsung' },
                 { id:'e2', cant:'1', desc:'arma de fuego tipo revolver' }];
  await DB.saveCase(u);
  const o = SIM.genOJ();
  o.isTest = false;
  await DB.saveCase(o);
  const cfg = DB.getConfig(); cfg.papel = 'CARTA'; DB.saveConfig(cfg);   // papel ya elegido
  go('capturas');
  return { uri: u.id, oj: o.id };
});
await page.waitForTimeout(500);

// Web Share de archivos disponible (es un telefono): asi el canal se ofrece.
await page.evaluate(() => {
  window._shared = null;
  navigator.canShare = d => !!(d && d.files && d.files.length);
  navigator.share = d => { window._shared = { n:d.files.length, name:d.files[0].name, type:d.files[0].type }; return Promise.resolve(); };
});

/* Atraviesa el dialogo de salida eligiendo lo que se ofrezca; con el papel ya
   elegido y un documento de solo-Word no hay dialogo y esto es un no-op. */
const elegir = async (fmt = 'DOCX') => {
  if (!(await page.isVisible('#exp-go').catch(() => false))) return;
  if (await page.isVisible('#exp-fmt-' + fmt).catch(() => false)) await page.click('#exp-fmt-' + fmt);
  if (await page.isVisible('#exp-papel-CARTA').catch(() => false)) await page.click('#exp-papel-CARTA');
  await page.click('#exp-go');
};
const menu = async (id) => {
  await page.evaluate(i => { closeActionSheet(); openCaseSheet(i); }, id);
  await page.waitForTimeout(350);
  return page.evaluate(() => ({
    n: document.querySelectorAll('#act-items .sheet-item').length,
    tit: [...document.querySelectorAll('#act-items .ti')].map(e => e.textContent.trim()),
    alto: document.getElementById('act-sheet').scrollHeight,
    scroll: (() => { const s = document.getElementById('act-sheet'); return s.scrollHeight > s.clientHeight + 1; })()
  }));
};

// ═══ 1 · El menu de la captura: solo VERBOS, y ningun documento ═══
/* ⚠️ Lo que fijo la Mejora 6 no es un numero de entradas: es que el menu deje de
   ser un INDICE DE SALIDAS —un item por documento, que es lo que lo hacia crecer
   sin fin— y pase a listar lo que se HACE con una captura. Los verbos si pueden
   sumar (el modo patrulla anadio «Trabajar con el companero»); lo que no puede
   volver es un documento. Con la cuenta escrita a mano estos checks fallaban por
   un verbo nuevo y dejaban de vigilar lo suyo. El limite real —que no se
   desplace en un telefono— se sigue midiendo abajo. */
const VERBOS = ['Expediente del caso','Dossier','Editar captura','Eliminar'];
const mU = await menu(ids.uri);
log(VERBOS.every(v => mU.tit.includes(v)),
  '[1] El menu de una captura de flagrancia lista lo que se HACE con ella', mU.n + ': ' + mU.tit.join(' | '));
log(mU.tit.indexOf('Expediente del caso') === 0 && mU.tit[mU.tit.length - 1] === 'Eliminar',
  '[1] El expediente abre la lista y Eliminar la cierra', mU.tit.join(' | '));
log(!mU.scroll, '[1] El menu no se desplaza en un telefono', mU.n + ' items · alto ' + mU.alto + 'px');
const mO = await menu(ids.oj);
log(JSON.stringify(mO.tit) === JSON.stringify(mU.tit),
  '[1] Una captura por orden judicial ofrece exactamente las mismas', mO.tit.join(' | '));
const txtMenu = await page.$eval('#act-items', e => e.textContent);
log(!/FPJ-5|Oficio de disposici|Acta de derechos|incautaci|custodia|Rótulo/i.test(txtMenu),
  '[1] Ningun documento se ofrece desde el menu: todos viven en el expediente');
await page.evaluate(() => closeActionSheet());
await page.waitForTimeout(250);

// ═══ 2 · Tocar la tarjeta ya no abre el wizard ═══
const onclick = await page.$eval('#cl .cc', e => e.getAttribute('onclick') || '');
log(/abrirDossierCaso/.test(onclick) && !/editCase/.test(onclick),
  '[2] La tarjeta de la lista abre el expediente, no el formulario de edicion', onclick);
await page.click('#cl .cc');
await page.waitForTimeout(500);
const trasTocar = await page.evaluate(() => ({
  wizard: document.getElementById('screen-wizard').classList.contains('on'),
  exp: document.getElementById('screen-dossier').classList.contains('on'),
  wc: typeof wc !== 'undefined' && !!wc
}));
log(!trasTocar.wizard && trasTocar.exp && !trasTocar.wc,
  '[2] Un toque en la tarjeta no arranca el wizard ni deja una captura a medias abierta', JSON.stringify(trasTocar));
const borrador = await page.evaluate(() => { try { return !!localStorage.getItem('lc_draft'); } catch(e) { return false; } });
log(!borrador, '[2] Y no deja un borrador fantasma: el toque involuntario no toca nada');
// La edicion sigue teniendo dos puertas: el menu y el propio expediente.
const puertas = await page.evaluate(() => {
  const src = document.documentElement.innerHTML;
  return { menu: /actItem\('editCase'/.test(src) || true, exp: !!document.querySelector('#exp-contenido button') };
});
await page.evaluate(i => { openCaseSheet(i); }, ids.uri);
await page.waitForTimeout(300);
const editEnMenu = await page.evaluate(() => [...document.querySelectorAll('#act-items .sheet-item')]
  .some(b => /editCase/.test(b.getAttribute('onclick') || '')));
log(editEnMenu && puertas.exp, '[2] Editar conserva dos puertas: el menu y el boton del expediente');
await page.evaluate(() => closeActionSheet());

// ═══ 3 · El dossier tiene modulo propio y NO esta dentro del expediente ═══
await page.evaluate(i => abrirDossierCaso(i), ids.uri);
await page.waitForTimeout(500);
const exp = await page.evaluate(() => {
  const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  const scr = document.getElementById('screen-dossier');
  return {
    on: scr.classList.contains('on'),
    titulo: scr.querySelector('.ttl h1').textContent.trim(),
    estado: vis('exp-estado'), docs: vis('exp-docs'), cont: vis('exp-contenido'),
    dossierDentro: !!scr.querySelector('#dos-preview-wrap, #dos-actions, #dos-txt'),
    texto: scr.textContent
  };
});
log(exp.on && exp.titulo === 'Expediente', '[3] El expediente se llama Expediente', exp.titulo);
/* ⚠️ Expectativa actualizada el 2026-08-28 (Mejora 6, segundo documento, obs. 2):
   el bloque de ESTADO ya no se pinta en una captura corriente — sus dos avisos
   («plazo de 36 horas» y «faltan datos») se retiraron por ruido y solo queda el
   de la captura de orden judicial del formato anterior, que es la puerta a
   «Completar al formato nuevo». Lo que este check mide sigue siendo lo mismo:
   que el expediente trae LOS DOCUMENTOS y EL CONTENIDO de la captura. */
log(!exp.estado && exp.docs && exp.cont, '[3] Trae documentos y contenido de la captura, sin bloque de avisos', JSON.stringify({ estado: exp.estado, docs: exp.docs, cont: exp.cont }));
log(!exp.dossierDentro, '[3] El dossier NO esta dentro del expediente: ni editor, ni secciones, ni salidas');
log(!/Dossier WhatsApp|Secciones del dossier|Datos del Dossier/.test(exp.texto),
  '[3] Y no queda ni rastro suyo en la pantalla');
const dw = await page.evaluate(i => {
  abrirDossierTexto(i);
  const scr = document.getElementById('screen-dossierwa');
  const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
  return {
    on: scr.classList.contains('on'),
    titulo: scr.querySelector('.ttl h1').textContent.trim(),
    sub: document.getElementById('dw-sub').textContent.trim(),
    editor: vis('dos-preview-wrap'), acciones: vis('dos-actions'),
    texto: (document.getElementById('dos-txt') || {}).value || '',
    secciones: !!document.getElementById('dos-sec-btn'),
    datos: /Datos del Dossier/.test(scr.textContent),
    expApagado: !document.getElementById('screen-dossier').classList.contains('on')
  };
}, ids.uri);
await page.waitForTimeout(300);
log(dw.on && dw.titulo === 'Dossier' && dw.expApagado, '[3] El dossier es una pantalla propia', dw.titulo);
log(dw.editor && dw.acciones && dw.secciones && dw.datos,
  '[3] Y se lleva TODO lo suyo: editor, salidas, secciones y Datos del Dossier — nada se quedo sin puerta');
log(dw.texto.length > 80 && dw.sub.length > 2, '[3] Entra con el caso cargado y su resumen ya redactado', dw.sub);

// El texto que se manda es el que se ve, y es el del caso que se esta viendo.
const mandado = await page.evaluate(async (o) => {
  const ta = document.getElementById('dos-txt');
  ta.value = 'DOSSIER EDITADO A MANO';
  const propio = _dosTexto(_dosCasoId);
  abrirDossierCaso(o);                       // el expediente NO repinta el editor
  const ajeno = _dosTexto(o);
  return { propio, ajenoEditado: /EDITADO A MANO/.test(ajeno) };
}, ids.oj);
log(/EDITADO A MANO/.test(mandado.propio), '[3] Lo que se envia es lo que el funcionario dejo escrito en el editor');
log(!mandado.ajenoEditado, '[3] Y el dossier de OTRO caso no hereda ese texto: se genera el suyo');

// ═══ 4 · El expediente es la casa de los documentos ═══
const docsU = await page.evaluate(i => { _dosCasoId = i; go('dossier');
  return [...document.querySelectorAll('#exp-docs .type-card .tbt')].map(e => e.textContent.trim()); }, ids.uri);
await page.waitForTimeout(400);
/* ⚠️ La expectativa se DERIVA del registro, no se escribe a mano: si no, cada
   formato nuevo la deja obsoleta —le pasó con el acta de entrega y el resumen
   (2026-08-30)— y el check acaba midiendo un número en vez de la regla.
   Lo que se comprueba es que la pantalla pinta EXACTAMENTE lo que dice
   `lcEstadoDocs`, ni uno más ni uno menos, y en su mismo orden. */
const regU = await page.evaluate(i => lcEstadoDocs(DB.getCase(i)).map(d => d.lbl), ids.uri);
log(docsU.length === regU.length && docsU.length >= 5,
  '[4] Flagrancia: el expediente ofrece todos los documentos del registro', docsU.length + ' — ' + docsU.join(' | '));
log(JSON.stringify(docsU) === JSON.stringify(regU),
  '[4] En el orden del numeral 7, tal como los devuelve el registro', docsU.join(' | '));
const docsO = await page.evaluate(i => { _dosCasoId = i; renderDossier();
  return [...document.querySelectorAll('#exp-docs .type-card .tbt')].map(e => e.textContent.trim()); }, ids.oj);
await page.waitForTimeout(300);
/* ⚠️ El resumen de la captura SÍ se ofrece en orden judicial: no es un formato
   del numeral 7 sino la hoja de trabajo del expediente, y ahí imprime lo que
   ese procedimiento sí tiene. Lo que no puede aparecer son los formatos del
   numeral 7, que es lo que mide el check siguiente. */
log(/Oficio de disposición/.test(docsO[0]) && docsO[1] === 'Acta de derechos',
  '[4] Orden judicial: el oficio y el acta de derechos, en ese orden', docsO.join(' | '));
log(!docsO.some(d => /incautaci|custodia|Rótulo/i.test(d)),
  '[4] Los tres formatos del numeral 7 NO existen en un expediente de orden judicial');
/* La pantalla dice lo mismo que el registro: si usara un criterio propio, mentiria. */
const reg = await page.evaluate(o => lcEstadoDocs(DB.getCase(o)).map(d => d.lbl), ids.oj);
log(JSON.stringify(reg) === JSON.stringify(docsO), '[4] Lo pintado sale del registro, no de una lista aparte');

// ═══ 5 · Cada documento da a elegir canal: descargar o enviar ═══
/* ⚠️ La tarjeta se busca POR SU ETIQUETA, no por su posición: insertar un
   formato nuevo en el registro corre los índices de todos los que van detrás y
   el test acabaría abriendo otro documento sin decirlo (le pasó con el resumen
   de la captura, que entra en tercer lugar). */
const abrirDoc = async (i, lbl) => {
  await page.evaluate(x => { _dosCasoId = x; go('dossier'); }, i);
  await page.waitForTimeout(350);
  const n = await page.evaluate(t => {
    const c = [...document.querySelectorAll('#exp-docs .type-card')];
    return c.findIndex(e => new RegExp(t, 'i').test(e.querySelector('.tbt').textContent));
  }, lbl);
  if (n < 0) throw new Error('no hay tarjeta que case con ' + lbl);
  await page.click(`#exp-docs .type-card >> nth=${n}`);
  await page.waitForTimeout(500);
};
/* Los documentos por-persona y por-elemento preguntan primero de cual se trata
   (el caso trae dos capturados y dos EMP), y despues abren su formulario. */
const elegirPrimero = async () => {
  const hay = await page.evaluate(() => !!document.querySelector('#modal-c .exp-opt'));
  if (hay) { await page.click('#modal-c .exp-opt'); await page.waitForTimeout(700); }
};
const generar = async () => {
  await elegirPrimero();
  /* Se busca por la FUNCION que dispara, no por el rotulo: cada formato nombra
     su boton a su manera («Generar acta», «Registro de cadena de custodia — 2
     elementos»), y un rotulo cambia sin que cambie lo que hace. */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#modal-c button')]
      .find(x => /(f6|cc|rt|ai)Generar\(/.test(x.getAttribute('onclick') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(1600);
};
const sheetCanal = () => page.evaluate(() => ({
  on: document.getElementById('share-sheet').classList.contains('on'),
  titulo: document.getElementById('share-title').textContent.trim(),
  dl: !!document.getElementById('share-it-dl'),
  enviar: getComputedStyle(document.getElementById('share-it-doc')).display !== 'none',
  kind: (_shareJob || {}).kind
}));

await abrirDoc(ids.uri, 'Informe FPJ-5');
await elegir();
await page.waitForTimeout(900);
let sh = await sheetCanal();
log(sh.on && sh.dl && sh.enviar && sh.kind === 'FPJ',
  '[5] El informe FPJ-5 ofrece descargar Y enviar', JSON.stringify(sh));
await page.click('#share-it-doc');
await page.waitForTimeout(900);
let env = await page.evaluate(() => window._shared);
log(!!env && /\.docx$/.test(env.name) && /wordprocessingml/.test(env.type),
  '[5] Y lo que se envia es el .docx de verdad, adjunto', JSON.stringify(env));

// 2 · Acta de derechos — el documento que hasta ahora NO tenia ruta de envio
await page.evaluate(() => { window._shared = null; });
await abrirDoc(ids.uri, 'Acta de derechos');
await generar();
await elegir();
await page.waitForTimeout(1600);
sh = await sheetCanal();
log(sh.on && sh.kind === 'FPJ6' && sh.dl && sh.enviar,
  '[5] El acta de derechos estrena canal: descargar o enviar', JSON.stringify(sh));
await page.click('#share-it-doc');
await page.waitForTimeout(1200);
env = await page.evaluate(() => window._shared);
log(!!env && /^FPJ6_.*\.docx$/.test(env.name),
  '[5] Y su .docx sale adjunto por la hoja de compartir', JSON.stringify(env));

// 3 · Cadena de custodia — es PDF oficial: se envia el PDF, no un .docx
await page.evaluate(() => { window._shared = null; });
await abrirDoc(ids.uri, 'cadena de custodia');
await generar();
await page.waitForTimeout(1200);
sh = await sheetCanal();
log(sh.on && sh.kind === 'FPJ8', '[5] La cadena de custodia tambien pasa por el canal', JSON.stringify(sh));
await page.click('#share-it-doc');
await page.waitForTimeout(1200);
env = await page.evaluate(() => window._shared);
log(!!env && /\.pdf$/i.test(env.name) && /pdf/i.test(env.type),
  '[5] Y va como PDF: es el formato oficial estampado, no hay .docx que mandar', JSON.stringify(env));

/* ⚠️ A un formato que YA es el PDF oficial no se le pregunta «Word o PDF»: no
   hay mas que un formato posible. Preguntarlo seria inventar una decision. */
const sinDialogo = await page.evaluate(() => !document.getElementById('exp-go'));
log(sinDialogo, '[5] Al PDF oficial no se le pregunta formato: no hay dos opciones que ofrecer');

// ═══ 6 · Un equipo sin Web Share descarga directo, sin sheet de un boton ═══
const ctxD = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const pageD = await ctxD.newPage();
await pageD.goto('http://localhost:8137/LexCapture_v8.html', { waitUntil: 'load' });
await pageD.evaluate(() => localStorage.clear());
await pageD.reload({ waitUntil: 'load' });
await pageD.waitForTimeout(400);
await pageD.fill('#pin-a', '135790'); await pageD.fill('#pin-b', '135790');
await pageD.click('button[onclick="doSetPin()"]');
await pageD.waitForTimeout(800);
const idD = await pageD.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); c.isTest = false; await DB.saveCase(c);
  const cfg = DB.getConfig(); cfg.papel = 'CARTA'; DB.saveConfig(cfg);
  delete navigator.share; delete navigator.canShare;
  return c.id;
});
const [dl] = await Promise.all([
  pageD.waitForEvent('download', { timeout: 12000 }).catch(() => null),
  pageD.evaluate(i => lcSalidaDoc(i), idD)
]);
const sheetD = await pageD.evaluate(() => document.getElementById('share-sheet').classList.contains('on'));
log(!!dl && !sheetD, '[6] Sin Web Share se descarga directo: no se abre un sheet de un solo boton',
  dl ? dl.suggestedFilename() : '(sin descarga)');
await ctxD.close();

// ═══ 7 · Consola limpia ═══
log(errs.length === 0, '[7] Sin errores de consola en todo el recorrido', errs.join(' | ').slice(0, 200));

await browser.close();
server.close();
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
