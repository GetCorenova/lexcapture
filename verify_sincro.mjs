/* SINCRONIZACIÓN DE LOS DOCUMENTOS POSTERIORES — dos teléfonos vinculados se
   ponen al día solos con lo que cada uno diligencia DESPUÉS de la captura: acta
   de derechos, cadena de custodia, rótulo, acta de incautación y acta de entrega.

   ⚠️ LO QUE ESTA SUITE PROTEGE NO ES SOLO QUE LLEGUE, sino que NO llegue lo que
   no debe: el formulario de la captura no se propaga (decisión del usuario), una
   actualización automática no puede CREAR una captura ni un capturado, y nada de
   esto revierte lo que el otro escribió.

   ⚠️ Se abren DOS CONTEXTOS de navegador, no dos pestañas: cada lado tiene su
   propio almacenamiento y su propia identidad de equipo, que es lo que los
   convierte en dos teléfonos y no en dos vistas del mismo. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8144, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');

const browser = await chromium.launch({ headless: true });
async function abrirEquipo(pin) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
  const pg = await ctx.newPage();
  const er = [];
  pg.on('pageerror', e => er.push(String(e.message).slice(0, 90)));
  pg.on('console', m => { if (m.type() === 'error') er.push(m.text().slice(0, 90)); });
  await pg.goto('http://localhost:8144/LexCapture_v8.html', { waitUntil: 'load' });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForTimeout(400);
  await pg.fill('#pin-a', pin); await pg.fill('#pin-b', pin);
  await pg.click('button[onclick="doSetPin()"]');
  await pg.waitForTimeout(800);
  return { ctx, pg, er };
}
const A = await abrirEquipo('123456');
const B = await abrirEquipo('654321');
const page = A.pg, pageB = B.pg;
const errs = [];
A.er.forEach(e => errs.push('A: ' + e)); B.er.forEach(e => errs.push('B: ' + e));
page.on('pageerror', e => errs.push('A: ' + String(e.message).slice(0, 90)));
pageB.on('pageerror', e => errs.push('B: ' + String(e.message).slice(0, 90)));

/* Vínculo completo PASANDO POR EL CÓDIGO, igual que la suite del Modo compartir:
   si el códec se rompiera, esto tendría que fallar. */
const LEER = () => `(async (bytes) => {
  const svg = ptQrSvg(bytes, 320);
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
  const W = 400, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.drawImage(img, 40, 40, 320, 320);
  return ptQrLeer(g.getImageData(0, 0, W, W).data, W, W);
})`;
async function vincular() {
  const inv = await page.evaluate(async () => {
    const r = await ptCrearInvitacion();
    return r ? Array.from(r.bytes) : null;
  });
  if (!inv) return { ok: false, motivo: 'no se preparó el código' };
  const paso1 = await pageB.evaluate(async ([arr, leerSrc]) => {
    const leer = eval(leerSrc);
    const leido = await leer(Uint8Array.from(arr));
    if (!leido) return { ok: false, motivo: 'no se leyó el código' };
    const r = await ptResponderInvitacion(leido);
    if (!r.ok) return r;
    return { ok: true, bytes: Array.from(r.bytes) };
  }, [inv, LEER()]);
  if (!paso1.ok) return paso1;
  return await page.evaluate(async ([arr, leerSrc]) => {
    const leer = eval(leerSrc);
    const leido = await leer(Uint8Array.from(arr));
    if (!leido) return { ok: false, motivo: 'no se leyó la respuesta' };
    const r = await ptAceptarRespuesta(leido);
    if (!r.ok) return r;
    for (let i = 0; i < 100 && !ptEstado().activa; i++) await new Promise(t => setTimeout(t, 100));
    return { ok: ptEstado().activa };
  }, [paso1.bytes, LEER()]);
}
async function aceptarEnReceptor(rx) {
  try { await rx.waitForSelector('#modal-c .cf-res, #modal-c .cf-dups', { timeout: 6000 }); }
  catch (e) { return false; }
  await rx.click('button[onclick="ptConfAceptar()"]');
  await rx.waitForTimeout(250);
  return true;
}
const enviarCaso = async (pg, idCaso, rx) => {
  const prom = pg.evaluate(async (id) => {
    const casos = DB.getCases().filter(c => c.id === id);
    return await new Promise((res) => {
      const r = ptEnviarRegistros([], casos, res);
      if (!r.ok) res({ ok: false, motivo: r.motivo });
    });
  }, idCaso);
  if (rx) await aceptarEnReceptor(rx);
  return await prom;
};
/* Diligenciar un documento posterior: mutar su rama y guardar, que es justo lo
   que hacen los cinco guardados reales. El check [A11] comprueba aparte que esos
   cinco avisan de verdad, y [A2] lo hace por el camino real del modal. */
const diligenciar = (pg, id, fn) => pg.evaluate(async ([id, fnSrc]) => {
  const c = DB.getCase(id);
  eval('(' + fnSrc + ')')(c);
  await DB.saveCase(c);
  lcDocGuardado(id);
  await new Promise(r => setTimeout(r, 1800));   // la espera del disparo + el viaje
}, [id, fn.toString()]);

/* ══════════════════════════════════════════════════════════════════════════
   A · LA PROPAGACIÓN, ENTRE DOS TELÉFONOS
   ══════════════════════════════════════════════════════════════════════════ */

const v = await vincular();
log(v.ok, '[A1] Los dos teléfonos quedan vinculados escaneando el código', v.motivo || '');
await page.waitForTimeout(700);

// A arma la captura, con capturado y elementos, y se la pasa a B.
const idCaso = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI');
  c.isTest = false;
  c.capturados = [{ id: 'cap-1', priNom: 'JUAN', priApe: 'GOMEZ', tipoDoc: 'CC', numDoc: '71234567' }];
  c.elementos = [{ id: 'emp-1', cant: '1', desc: 'celular marca Samsung' }];
  delete c.actas; delete c.custodia; delete c.rotulos; delete c.incautacion; delete c.entrega;
  await DB.saveCase(c);
  return c.id;
});
const env = await enviarCaso(page, idCaso, pageB);
await page.waitForTimeout(600);
log(env.ok, '[A2] A le pasa la captura a B con un envío explícito', env.motivo || '');

// [A3] La captura queda marcada como compartida EN LOS DOS.
const a3 = await page.evaluate((id) => {
  const c = DB.getCase(id);
  return { aqui: ptEstaCompartida(c), conQuien: Object.keys((c._sync || {}).devs || {}).length };
}, idCaso);
const a3b = await pageB.evaluate((id) => {
  const c = DB.getCase(id);
  return { aqui: !!c && ptEstaCompartida(c) };
}, idCaso);
log(a3.aqui && a3.conQuien === 1 && a3b.aqui,
  '[A4] La captura queda marcada como compartida en los dos equipos');

/* [A5] EL CAMINO REAL: B abre la cadena de custodia y la guarda con la función
   de siempre. Es lo que prueba que el guardado avisa de verdad, y no solo que el
   canal funciona. */
await pageB.evaluate((id) => abrirCadenaCustodia(id), idCaso);
await pageB.waitForTimeout(500);
const abrioCC = await pageB.evaluate(() => !!document.getElementById('cc-fecha'));
/* Se TECLEA en el formulario del modal y se guarda con la función de siempre:
   `ccGuardar` recolecta del DOM, así que mutar el modelo por debajo no probaría
   el camino que recorre el funcionario. */
await pageB.evaluate(async () => {
  const f = document.querySelector('#cc-funcs .cc-func [data-c="nombre"]');
  if (f) { f.value = 'LUZ MARIN'; f.dispatchEvent(new Event('input', { bubbles: true })); }
  const cg = document.querySelector('#cc-funcs .cc-func [data-c="cargo"]');
  if (cg) { cg.value = 'Patrullero'; cg.dispatchEvent(new Event('input', { bubbles: true })); }
  await ccGuardar();
});
await page.waitForTimeout(2200);
const a5 = await page.evaluate((id) => {
  const c = DB.getCase(id), cu = c.custodia || {}, f = (cu.funcionarios || [])[0];
  return { hay: !!f, nom: f ? f.nombre : '', cargo: f ? f.cargo : '', upd: cu.updated > 0 };
}, idCaso);
log(abrioCC && a5.hay && a5.upd && a5.nom === 'LUZ MARIN' && a5.cargo === 'Patrullero',
  '[A5] La cadena de custodia que diligencia B le llega SOLA a A, por el guardado real', a5.nom);

// [A6] El acta de derechos, con los seis atributos que escribe en el capturado.
await diligenciar(pageB, idCaso, (c) => {
  c.actas = [{ personaId: 'cap-1', obs: 'Se le leyeron sus derechos en el sitio', presentoDoc: 'SI' }];
  c.capturados[0].etnia = 'AFROCOLOMBIANO';
  c.capturados[0].lgbti = 'NO';
});
await page.waitForTimeout(900);
const a6 = await page.evaluate((id) => {
  const c = DB.getCase(id), ac = (c.actas || [])[0], cap = (c.capturados || [])[0];
  return { obs: ac ? ac.obs : '', doc: ac ? ac.presentoDoc : '', etnia: cap ? cap.etnia : '', nom: cap ? cap.priNom : '' };
}, idCaso);
log(a6.obs.indexOf('derechos') >= 0 && a6.doc === 'SI' && a6.etnia === 'AFROCOLOMBIANO' && a6.nom === 'JUAN',
  '[A6] El acta de derechos llega, y con ella los atributos que escribe en el capturado');

// [A7] Y va en los DOS sentidos: ahora A diligencia y B recibe.
await diligenciar(page, idCaso, (c) => {
  c.incautacion = { obs: 'Se incauta el celular hallado al capturado', updated: Date.now() };
  c.rotulos = [{ empId: 'emp-1', ubicacion: 'Bolsillo derecho del pantalón' }];
});
await pageB.waitForTimeout(900);
const a7 = await pageB.evaluate((id) => {
  const c = DB.getCase(id);
  return { inc: (c.incautacion || {}).obs || '', rot: ((c.rotulos || [])[0] || {}).ubicacion || '' };
}, idCaso);
log(a7.inc.indexOf('celular') >= 0 && a7.rot.indexOf('Bolsillo') >= 0,
  '[A7] Va en los dos sentidos: lo que diligencia A le llega a B');

/* [A8] ⚠️ EL FORMULARIO DE LA CAPTURA NO VIAJA. Es la decisión del usuario y es
   además lo que impide que esto revierta nada. B cambia un dato del formulario y
   diligencia un acta a la vez: el acta llega, el dato NO. */
await page.evaluate((id) => {
  const c = DB.getCase(id);
  c.spoa = 'SPOA-DE-A';
  c.capturados[0].priNom = 'JUAN';
  return DB.saveCase(c);
}, idCaso);
await diligenciar(pageB, idCaso, (c) => {
  c.spoa = 'SPOA-DE-B';
  c.capturados[0].priNom = 'PEDRO';
  c.entrega = { obs: 'Se entrega el celular a su propietaria', updated: Date.now() };
});
await page.waitForTimeout(900);
const a8 = await page.evaluate((id) => {
  const c = DB.getCase(id);
  return { spoa: c.spoa, nom: (c.capturados[0] || {}).priNom, ent: (c.entrega || {}).obs || '' };
}, idCaso);
log(a8.spoa === 'SPOA-DE-A' && a8.nom === 'JUAN' && a8.ent.indexOf('propietaria') >= 0,
  '[A8] El acta llega, pero el formulario de la captura no se propaga ni revierte nada',
  'spoa=' + a8.spoa + ' nom=' + a8.nom);

/* [A9] ⚠️ NUNCA CREA UNA CAPTURA. Lo que llega solo actualiza lo que este equipo
   ya aceptó: para que una captura entre hace falta un envío, con su diálogo. */
const a9 = await page.evaluate(async () => {
  const antes = DB.getCases().length;
  await ptRecibirAuto([{ id: 'caso-que-no-existe', incautacion: { obs: 'x' } }], _ptPar, 'X');
  return { antes, despues: DB.getCases().length };
});
log(a9.antes === a9.despues, '[A9] Una actualización automática nunca crea una captura');

/* [A10] ⚠️ NI UN CAPTURADO. Media persona —con identificador y sin nombre— en el
   apartado 4 de un informe de captura es peor que no sincronizar. */
const a10 = await page.evaluate(async (id) => {
  const antes = DB.getCase(id).capturados.length;
  await ptRecibirAuto([{ id: id, capturados: [{ id: 'cap-fantasma', etnia: 'INDIGENA' }] }], _ptPar, 'X');
  const c = DB.getCase(id);
  return { antes, despues: c.capturados.length, hay: c.capturados.some(p => p.id === 'cap-fantasma') };
}, idCaso);
log(a10.antes === a10.despues && !a10.hay,
  '[A10] Tampoco crea un capturado que aquí no existe');

// [A11] Los cinco guardados avisan, y son exactamente los cinco.
const cinco = ['f6Guardar', 'ccGuardar', 'rtGuardar', 'aiGuardar', 'feGuardar'].filter(f => {
  const i = src.indexOf('function ' + f + '(');
  return i > 0 && src.slice(i, i + 2600).indexOf('lcDocGuardado(') > 0;
});
log(cinco.length === 5, '[A11] Los cinco guardados de documentos avisan al guardar', cinco.join(', '));

/* [A12] ⚠️ SIN ECO. Lo que llega del compañero se guarda con `saveCases`, que no
   dispara el aviso: si lo disparara, cada equipo le devolvería al otro lo que
   acaba de recibir, indefinidamente. */
const a12 = await pageB.evaluate(async (id) => {
  let salidas = 0;
  const real = window.ptEnviar;
  window.ptEnviar = function (o) { if (o && o.t === 'auto') salidas++; return real.apply(this, arguments); };
  await ptRecibirAuto([{ id: id, incautacion: { obs: 'eco ' + Date.now() } }], _ptPar, 'A');
  await new Promise(r => setTimeout(r, 1800));
  window.ptEnviar = real;
  return salidas;
}, idCaso);
log(a12 === 0, '[A12] Lo que llega del compañero no se devuelve en eco', a12 + ' reenvíos');

/* [A13] SE PONEN AL DÍA AL VOLVER A VINCULARSE. Es lo que cubre el caso normal en
   campo: se diligencia sin vínculo y al juntarse otra vez se pone todo al día
   sin que nadie reenvíe la captura. */
await page.evaluate(() => ptDesvincular());
await pageB.evaluate(() => ptDesvincular());
await page.waitForTimeout(400);
await diligenciar(pageB, idCaso, (c) => {
  c.custodia = c.custodia || {};
  c.custodia.reparto = { 'emp-1': '1' };
  c.custodia.hechoSinVinculo = 'SI';
});
const sinVinculo = await page.evaluate((id) => (DB.getCase(id).custodia || {}).hechoSinVinculo || '', idCaso);
const v2 = await vincular();
await page.waitForTimeout(2500);
const a13 = await page.evaluate((id) => (DB.getCase(id).custodia || {}).hechoSinVinculo || '', idCaso);
log(v2.ok && sinVinculo === '' && a13 === 'SI',
  '[A13] Lo diligenciado sin vínculo se pone al día al volver a vincularse');

/* ══════════════════════════════════════════════════════════════════════════
   B · LO QUE NO CAMBIA
   ══════════════════════════════════════════════════════════════════════════ */

// [B1] `DB.saveCase` sigue sin una sola rama del módulo.
const saveCaseSrc = src.slice(src.indexOf('saveCase: function('), src.indexOf('delCase: function('));
log(!/\bpt[A-Z]\w*\(/.test(saveCaseSrc) && !/lcDocGuardado/.test(saveCaseSrc),
  '[B1] El guardado de una captura sigue sin ninguna rama de sincronización');

/* [B2] ⚠️ El aviso es NEUTRO: fuera del módulo no aparece una sola llamada `pt…`
   que no sea de su propia pantalla. La dependencia va al revés, y por eso el
   módulo sigue aislado. */
const antes = src.slice(0, src.indexOf('MODO COMPARTIR · LOS DATOS'));
const permitidas = ['ptAbrirCompartir', 'renderCompartir', 'ptScanCerrar', 'ptUiMostrar',
  'ptUiEscanear', 'ptUiMarcar', 'ptUiEnviar', 'ptUiCancelar', 'ptUiDesvincular',
  'ptUiDesvincularSi', 'ptUiEscanearRespuesta', 'ptUiMarcarTodo', 'ptArchivoElegido',
  'ptUiExportar', 'ptImportarArchivo', 'ptConfAceptar', 'ptConfCancelar', 'ptConfDup',
  'ptUiExportarDesdeModal', 'ptAbrirArchivoConClave',
  /* La insignia y el renglón del expediente preguntan si la captura se comparte.
     Son consultas de solo lectura, no acoplamiento: van protegidas por `typeof`
     para que el día que el módulo no esté, la lista y el expediente se pinten
     igual. */
  'ptEstaCompartida', 'ptUltimaAuto', 'ptHace', 'ptEstado', 'ptSuscritoCon'];
const llamadas = [...antes.matchAll(/\b(pt[A-Z]\w*|renderCompartir)\s*\(/g)].map(m => m[1]);
const intrusas = llamadas.filter(n => permitidas.indexOf(n) < 0);
log(intrusas.length === 0, '[B2] Fuera del módulo solo se le llama desde su pantalla y para consultar el estado',
  intrusas.join(', ') || 'limpio');

// [B3] Las consultas del expediente y la lista van protegidas por `typeof`.
log(/typeof ptEstaCompartida !== 'function'/.test(src),
  '[B3] La lista y el expediente se pintan igual aunque el módulo no esté');

// [B4] Ningún motor documental sabe que esto existe.
const motor = src.slice(src.indexOf('function buildFPJBlob'), src.indexOf('function buildFPJBlob') + 40000);
log(!/\bpt[A-Z]\w*/.test(motor) && !/lcDocGuardado/.test(motor),
  '[B4] Ningún motor documental sabe que esta capa existe');

/* [B5] ⚠️ LA MARCA NO VIAJA. `_sync` empieza por guion bajo, así que `ptCanon` y
   `ptAplanar` la saltan: es estado local de cada teléfono y no contenido del
   procedimiento. */
const b5 = await page.evaluate((id) => {
  const c = DB.getCase(id);
  const enviado = ptParaEnviar(c), recorte = ptRecorte(c);
  return { local: !!c._sync, enviado: '_sync' in enviado, rec: '_sync' in recorte,
           huella: (ptHuella(c) || '').indexOf('_sync') >= 0 };
}, idCaso);
log(b5.local && !b5.enviado && !b5.rec && !b5.huella,
  '[B5] La marca de «compartida» no sale del teléfono ni entra en la huella');

// [B6] El recorte lleva las cinco ramas y nada del formulario.
const b6 = await page.evaluate((id) => {
  const r = ptRecorte(DB.getCase(id));
  const cap = (r.capturados || [])[0] || {};
  return { claves: Object.keys(r).sort(), capClaves: Object.keys(cap).sort() };
}, idCaso);
const esperado = ['actas', 'capturados', 'custodia', 'entrega', 'id', 'incautacion', 'rotulos'];
log(JSON.stringify(b6.claves) === JSON.stringify(esperado) &&
    b6.capClaves.indexOf('priNom') < 0 && b6.capClaves.indexOf('numDoc') < 0,
  '[B6] Lo que sale son las cinco ramas y seis atributos del capturado, nada más',
  b6.claves.join(',') + ' · capturado: ' + b6.capClaves.join(','));

// [B7] El informe de una captura sincronizada sale igual que el de una normal.
const b7 = await page.evaluate(async (id) => {
  const c = DB.getCase(id), copia = JSON.parse(JSON.stringify(c));
  delete copia._sync; copia.id = 'sin-sync';
  await DB.saveCase(copia);
  const a = await buildFPJBlob(c), b = await buildFPJBlob(copia);
  if (!a || !b || !a.blob || !b.blob) return { ok: false };
  const x = new Uint8Array(await a.blob.arrayBuffer()), y = new Uint8Array(await b.blob.arrayBuffer());
  return { ok: true, igual: x.length === y.length, n: x.length };
}, idCaso);
log(b7.ok && b7.igual, '[B7] El informe de una captura sincronizada sale igual de tamaño', b7.n + ' B');

/* [B8] ⚠️ LA FIRMA MANUSCRITA NO VIAJA. Es un rasgo biométrico y con ella se
   suscriben documentos judiciales. Vive en `lc_firmas`, fuera de lo que sale. */
const b8 = await page.evaluate((id) => {
  const r = JSON.stringify(ptRecorte(DB.getCase(id)));
  return r.indexOf('firma') < 0 && r.indexOf('data:image') < 0;
}, idCaso);
log(b8, '[B8] La firma manuscrita no sale en lo que se sincroniza');

// [B9] Sin vínculo, guardar un documento no rompe nada ni deja nada colgado.
await page.evaluate(() => ptDesvincular());
const b9 = await page.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.incautacion = { obs: 'sin vinculo', updated: Date.now() };
  await DB.saveCase(c);
  lcDocGuardado(id);
  await new Promise(r => setTimeout(r, 1600));
  return { guardo: (DB.getCase(id).incautacion || {}).obs === 'sin vinculo', pend: Object.keys(_ptAutoPend).length };
}, idCaso);
log(b9.guardo && b9.pend === 0, '[B9] Sin vínculo, el documento se guarda igual y no queda nada colgado');

/* [B10] ⚠️ EL ARCHIVO Y LA SINCRONIZACIÓN CON LOS PROPIOS EQUIPOS NO MARCAN A
   NADIE. Los tres caminos comparten el motor, pero solo el canal sabe que al otro
   lado hay un compañero. Si el compañero se dedujera del paquete, una captura
   bajada del propio computador del funcionario aparecería en su teléfono
   anunciando que se sincroniza con alguien que no existe. */
const b10 = await page.evaluate(async () => {
  const c = { id: 'caso-de-mi-otro-equipo', tipo: 'URI', capturados: [], elementos: [] };
  const abierto = ptAbrirPaquete(ptPaquete([], [c]));
  await ptAplicarPaquete(abierto, null);          // sin compañero: como Drive y como el archivo
  const g = DB.getCase('caso-de-mi-otro-equipo');
  return { entro: !!g, marcado: g ? ptEstaCompartida(g) : true };
});
log(b10.entro && !b10.marcado,
  '[B10] Lo que llega de un archivo o de otro equipo del usuario no se marca como compartido');

// [B11] Y el que sí sabe con quién habla lo pasa explícito, no lo deduce.
log(/ptAplicarPaquete\(abierto, decision, _ptPar\)/.test(src) &&
    /async function ptAplicarPaquete\(abierto, decision, dev\)/.test(src) &&
    !/ptRecibirCasos\(abierto\.casos, abierto\.origen/.test(src),
  '[B11] El compañero se pasa explícito y no se deduce del paquete');

/* ══════════════════════════════════════════════════════════════════════════
   C · LO QUE SE VE
   ══════════════════════════════════════════════════════════════════════════ */

// [C1] La insignia está en la tarjeta de la captura compartida, y solo en ella.
const c1 = await page.evaluate(async (id) => {
  const c = DB.getCase(id), otra = JSON.parse(JSON.stringify(c));
  delete otra._sync; otra.id = 'otra-sin-compartir';
  await DB.saveCase(otra);
  go('capturas'); renderCases();
  const tarjetas = [...document.querySelectorAll('.cc-wrap')];
  let conBadge = 0;
  tarjetas.forEach(t => { if (t.querySelector('.b-sync')) conBadge++; });
  const b = document.querySelector('.b-sync');
  return { tarjetas: tarjetas.length, conBadge, txt: b ? b.textContent.trim() : '', tit: b ? b.getAttribute('title') || '' : '' };
}, idCaso);
log(c1.conBadge === 1 && c1.tarjetas >= 2 && /Sincroniza/i.test(c1.txt),
  '[C1] Solo la captura compartida lleva la insignia en la lista',
  c1.conBadge + ' de ' + c1.tarjetas + ' · «' + c1.txt + '»');

// [C2] Y dice quién la actualizó, que es lo que la hace defendible.
log(/actualizó/i.test(c1.tit) || /sincroniza/i.test(c1.tit),
  '[C2] La insignia dice quién la actualizó y cuándo', c1.tit.slice(0, 70));

// [C3] El expediente lo dice entero, encima de los documentos que se sincronizan.
const c3 = await page.evaluate(async (id) => {
  await abrirDossierCaso(id);
  await new Promise(r => setTimeout(r, 400));
  const box = document.getElementById('exp-docs');
  const s = box ? box.querySelector('.exp-sync') : null;
  const primero = box && box.children[1] === s;
  return { hay: !!s, primero, txt: s ? s.innerText.replace(/\s+/g, ' ').trim() : '' };
}, idCaso);
log(c3.hay && c3.primero && /sincroniza/i.test(c3.txt),
  '[C3] El expediente lo dice encima de los documentos que se sincronizan', c3.txt.slice(0, 80));

// [C4] Y no lo dice en una captura que no se comparte con nadie.
const c4 = await page.evaluate(async () => {
  await abrirDossierCaso('otra-sin-compartir');
  await new Promise(r => setTimeout(r, 400));
  const box = document.getElementById('exp-docs');
  return !!(box && box.querySelector('.exp-sync'));
});
log(!c4, '[C4] Una captura que no se comparte no anuncia nada');

// [C5] La franja nombra al compañero y cuántas capturas están al día.
const v3 = await vincular();
await page.waitForTimeout(1200);
const c5 = await page.evaluate(() => {
  const b = document.getElementById('pt-barra');
  return { on: b.classList.contains('on'), txt: b.innerText.replace(/\s+/g, ' ').trim(), n: ptEstado().compartidas };
});
log(v3.ok && c5.on && c5.n >= 1 && /al día/i.test(c5.txt),
  '[C5] La franja dice con quién se está y cuántas capturas van al día', c5.txt.slice(0, 80));

/* [C6] La pantalla lo explica. ⚠️ Una función que empieza a mandar cosas sola sin
   que nadie la haya anunciado no se distingue de un fallo. */
const c6 = await page.evaluate(() => {
  ptDesvincular(); go('compartir'); renderCompartir();
  return document.getElementById('cp-pane').innerText.replace(/\s+/g, ' ');
});
log(/se ponen al día solas/i.test(c6) && /llega solo/i.test(c6) && /a mano/i.test(c6) &&
    /cadena de custodia/i.test(c6),
  '[C6] La pantalla explica que las actas viajan solas y que la captura no');

// [C7] Ni una palabra técnica, y ningún párrafo por encima de 110 caracteres.
const c7 = await page.evaluate(() => {
  const p = [...document.querySelectorAll('#cp-pane p, #cp-pane .de, #cp-pane .pe-de')]
    .map(x => x.textContent.trim()).filter(Boolean);
  const tec = /canal|sesión|token|webrtc|sdp|payload|socket|blob|snapshot|delta/i;
  return { largos: p.filter(t => t.length > 110), tec: p.filter(t => tec.test(t)) };
});
log(c7.largos.length === 0 && c7.tec.length === 0,
  '[C7] Sin párrafos largos ni jerga en la pantalla',
  (c7.largos[0] || c7.tec[0] || '').slice(0, 60));

// [C8] Y el sistema visual: la insignia y el renglón usan tokens, sin literales.
const bloque = src.slice(src.indexOf('.b-sync{'), src.indexOf('.exp-sync.viva .dot'));
log(!/#[0-9a-fA-F]{3,6}\b/.test(bloque) && /var\(--ok/.test(bloque),
  '[C8] La insignia y el renglón usan los tokens del sistema, sin un color literal');

// [C9] La consola, limpia en los dos teléfonos.
await page.waitForTimeout(400);
log(errs.length === 0, '[C9] Consola sin errores en los dos teléfonos', errs.slice(0, 3).join(' · '));

console.log('\n' + R.filter(Boolean).length + '/' + R.length + ' comprobaciones');
await browser.close(); server.close();
process.exit(R.every(Boolean) ? 0 : 1);
