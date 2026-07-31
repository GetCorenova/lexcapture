/* Regresión de la OLA 1 de la auditoría del módulo de orden judicial.
   Cubre las cinco correcciones de riesgo:
     1. Borrador automático del wizard (cifrado, fuera de lc_cases).
     2. Salida del wizard con confirmación — incluido el botón atrás de Android.
     3. Puntos del progreso navegables (salto directo a cualquier paso).
     4. Campos obligatorios marcados EN SU PASO, no solo al final.
     5. Resumen de faltantes al INICIO del paso 7, con salto al paso que falla.
   Más la regresión del bug que la propia ola destapó: las listas repetibles no
   se pueden leer entre el renderWiz() y su pintado diferido. */
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
  n++;
  if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '246813');
await page.fill('#pin-b', '246813');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'FIRMANTE DE PRUEBA', cedula: '1.111.111', cargo: 'Patrullero', telefono: '3000000000', correo: 'f@prueba.test' }];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
});

/* ─────────── 1. Campos obligatorios visibles en su propio paso ─────────── */
await page.evaluate(() => startWizard('OJ'));
await page.waitForTimeout(250);

const reqPaso1 = await page.evaluate(() => {
  const marcas = [...document.querySelectorAll('#wz-panels .req')];
  const etiquetas = marcas.map(m => m.parentElement.textContent.replace('*', '').trim());
  return { total: marcas.length, etiquetas };
});
log(reqPaso1.total >= 3, 'El paso 1 marca sus campos obligatorios con asterisco', reqPaso1.etiquetas.join(' · '));
log(reqPaso1.etiquetas.some(e => /No\. de la orden/.test(e)) &&
    reqPaso1.etiquetas.some(e => /Finalidad/.test(e)) &&
    reqPaso1.etiquetas.some(e => /Fecha de expedición/.test(e)),
  'Son exactamente los que bloquean el documento (V02, V03, V04)');

const avisoPaso = await page.textContent('#wz-prog');
log(/dato.*obligatorio.*sin diligenciar en este paso/i.test(avisoPaso),
  'La barra de progreso dice cuántos obligatorios faltan en el paso actual');

/* ─────────── 2. Los puntos del progreso son botones ─────────── */
const dots = await page.evaluate(() => {
  const els = [...document.querySelectorAll('#wz-prog .wd')];
  return {
    total: els.length,
    botones: els.filter(e => e.tagName === 'BUTTON').length,
    conOnclick: els.filter(e => (e.getAttribute('onclick') || '').startsWith('wizGoto')).length,
    conFalta: els.filter(e => e.classList.contains('falta')).length
  };
});
log(dots.total === 4 && dots.botones === 4, 'Los 4 puntos del progreso son botones', dots.botones + '/' + dots.total);
log(dots.conOnclick === 4, 'Todos saltan a la pantalla con wizGoto()');
log(dots.conFalta >= 3, 'Las pantallas con obligatorios pendientes se marcan en el propio punto', dots.conFalta + ' marcadas');

// Salto directo 1 → 7 en UN toque (antes: 6 toques de «Siguiente»)
await page.evaluate(() => wizGoto(3));
await page.waitForTimeout(250);
log(await page.isVisible('#oj-x-nom'), 'Un solo toque lleva de la primera pantalla a la última');
const pasoTrasSalto = await page.evaluate(() => ws);
log(pasoTrasSalto === 3, 'El wizard queda realmente en la pantalla de revisión', 'ws=' + pasoTrasSalto);

/* ─────────── 3. Faltantes al INICIO del paso 7, con salto ─────────── */
const orden7 = await page.evaluate(() => {
  const panel = document.querySelector('#wz-panels .wpn');
  const alerta = panel.querySelector('.oj-alert.dura');
  const primerBloque = panel.querySelector('.oj-blk');
  if (!alerta || !primerBloque) return { hay: !!alerta, antes: null };
  // ¿La alerta de faltantes va antes del primer bloque de formulario?
  const pos = alerta.compareDocumentPosition(primerBloque);
  return {
    hay: true,
    antes: !!(pos & Node.DOCUMENT_POSITION_FOLLOWING),
    texto: alerta.textContent.slice(0, 60),
    botones: alerta.querySelectorAll('button[onclick^="wizGoto"]').length
  };
});
log(orden7.hay === true, 'El paso 7 lista los datos obligatorios que faltan');
log(orden7.antes === true, 'Y los lista ARRIBA, antes del formulario (no tras 8 pantallas de scroll)');
log(orden7.botones >= 4, 'Cada falta trae su botón para ir a diligenciarla', orden7.botones + ' botones');

await page.evaluate(() => {
  const b = document.querySelector('#wz-panels .oj-alert.dura button[onclick^="wizGoto"]');
  if (b) b.click();
});
await page.waitForTimeout(250);
log(await page.evaluate(() => ws) === 0, 'Tocar una falta abre el paso donde se diligencia');

/* ─────────── 4. Borrador automático ─────────── */
await page.fill('#oj-o-num', '7788');
await page.fill('#oj-o-fexp', new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10));
await page.selectOption('#oj-o-fin', 'CONDENA');
await page.fill('#oj-d-nom', 'Juzgado Cuarto Penal del Circuito de Prueba');
await page.click('button[onclick="wizNext()"]');
await page.waitForTimeout(300);

const trasPaso = await page.evaluate(() => ({
  hayBorrador: !!DB.getDraft(),
  enLista: DB.getCases().length,
  personas: DB.getPersons().length,
  claveCifrada: !!localStorage.getItem('lc_draft'),
  planoEnDisco: (localStorage.getItem('lc_draft') || '').includes('7788'),
  paso: DB.getDraft() ? DB.getDraft().paso : null
}));
log(trasPaso.hayBorrador === true, 'Cambiar de paso guarda el borrador automáticamente');
log(trasPaso.enLista === 0 && trasPaso.personas === 0,
  'El borrador NO ensucia la lista de capturas ni el registro de personas', trasPaso.enLista + ' casos / ' + trasPaso.personas + ' personas');
log(trasPaso.claveCifrada === true && trasPaso.planoEnDisco === false,
  'Va cifrado en su propia clave lc_draft (datos de una persona, igual que un caso)');
log(trasPaso.paso === 1, 'Recuerda en qué paso iba', 'paso ' + (trasPaso.paso + 1));

// Guardado diferido mientras se escribe dentro de una misma pantalla
await page.fill('#oj-r-pn', 'CARLOS');
await page.waitForTimeout(2900);
const trasEscribir = await page.evaluate(() => {
  const d = DB.getDraft();
  return d && d.caso.oj.requerido.priNom;
});
log(/CARLOS/.test(trasEscribir || ''),
  'Escribir dentro de una pantalla también guarda (sin cambiar de pantalla)', trasEscribir);

/* ─────────── 5. Sobrevive a que el sistema mate la app ─────────── */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-e', '246813');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(600);

const tarjeta = await page.evaluate(() => {
  const el = document.getElementById('draft-slot');
  return { html: el ? el.textContent.trim() : '', botones: el ? el.querySelectorAll('button').length : 0 };
});
log(/Captura sin terminar/.test(tarjeta.html), 'Tras recargar, Capturas ofrece recuperar la captura a medias', tarjeta.html.slice(0, 70));
log(/Paso 2 de 4/.test(tarjeta.html), 'La tarjeta dice en qué pantalla se quedó');
log(tarjeta.botones === 2, 'Con las dos salidas: Continuar y Descartar');

await page.evaluate(() => wizRetomarBorrador());
await page.waitForTimeout(300);
const retomado = await page.evaluate(() => ({
  paso: ws,
  numero: wc.oj.orden.numero,
  despacho: wc.oj.requerido.priNom,
  visible: document.getElementById('screen-wizard').classList.contains('on')
}));
log(retomado.visible && retomado.paso === 1, 'Continuar reabre el wizard en el paso correcto', 'paso ' + (retomado.paso + 1));
log(retomado.numero === '7788' && /CARLOS/.test(retomado.despacho),
  'Y con todo lo diligenciado intacto', retomado.numero + ' · ' + retomado.despacho);

/* ─────────── 6. Las listas repetibles sobreviven al cambio de paso ─────────
   Regresión del bug que destapó esta ola: guardar el borrador después de
   renderWiz() leía las listas antes de su pintado diferido y las vaciaba. */
await page.evaluate(() => wizGoto(2));
await page.waitForTimeout(300);
const funcAntes = await page.evaluate(() => wc.oj.diligencia.funcionarios.length);
await page.evaluate(() => { wizGoto(1); });
await page.waitForTimeout(250);
await page.evaluate(() => { wizGoto(2); });
await page.waitForTimeout(300);
const funcDespues = await page.evaluate(() => ({
  modelo: wc.oj.diligencia.funcionarios.length,
  dom: document.querySelectorAll('#oj-list-funcionarios .oj-row').length
}));
log(funcAntes === 1 && funcDespues.modelo === 1 && funcDespues.dom === 1,
  'Ir y volver de un paso no borra las filas de las listas repetibles',
  funcAntes + ' → ' + funcDespues.modelo + ' (DOM ' + funcDespues.dom + ')');

/* ─────────── 7. Salir del wizard: se pregunta, no se pierde ─────────── */
await page.evaluate(() => cancelWiz());
await page.waitForTimeout(250);
const dialogo = await page.evaluate(() => {
  const m = document.getElementById('modal');
  return {
    abierto: m.classList.contains('open'),
    texto: document.getElementById('modal-c').textContent,
    sigueEnWizard: document.getElementById('screen-wizard').classList.contains('on')
  };
});
log(dialogo.abierto === true, 'Salir con datos diligenciados abre el diálogo en vez de descartar');
log(/Seguir diligenciando/.test(dialogo.texto) && /Guardar borrador y salir/.test(dialogo.texto) && /Descartar y salir/.test(dialogo.texto),
  'Con las tres salidas explícitas');
log(dialogo.sigueEnWizard === true, 'Y mientras se decide no se sale de la captura');

await page.evaluate(() => wizSalirGuardando());
await page.waitForTimeout(400);
const trasSalir = await page.evaluate(() => ({
  pantalla: document.getElementById('screen-capturas').classList.contains('on'),
  borrador: !!DB.getDraft(),
  tarjeta: /Captura sin terminar/.test(document.getElementById('draft-slot').textContent)
}));
log(trasSalir.pantalla && trasSalir.borrador && trasSalir.tarjeta,
  '«Guardar borrador y salir» deja el trabajo a un toque de distancia');

/* ─────────── 8. Botón atrás de Android ─────────── */
await page.evaluate(() => wizRetomarBorrador());
await page.waitForTimeout(300);
await page.goBack();
await page.waitForTimeout(350);
const trasAtras = await page.evaluate(() => ({
  sigueEnWizard: document.getElementById('screen-wizard').classList.contains('on'),
  dialogo: document.getElementById('modal').classList.contains('open')
}));
log(trasAtras.sigueEnWizard === true && trasAtras.dialogo === true,
  'El botón atrás estando en el wizard pregunta en vez de tirar el caso');
await page.evaluate(() => closeModal());

/* ─────────── 9. Guardar la captura cierra el borrador ─────────── */
await page.evaluate(() => {
  wc.oj.requerido.priNom = 'NOMBRE'; wc.oj.requerido.priApe = 'APELLIDO';
  wc.oj.requerido.numDoc = '1234567890';
});
await page.evaluate(() => ojGuardarCaso());
await page.waitForTimeout(600);
const trasGuardar = await page.evaluate(() => ({
  casos: DB.getCases().length,
  borrador: !!DB.getDraft(),
  enDisco: !!localStorage.getItem('lc_draft')
}));
log(trasGuardar.casos === 1, 'Guardar convierte el borrador en captura', trasGuardar.casos + ' caso');
log(trasGuardar.borrador === false && trasGuardar.enDisco === false,
  'Y el borrador desaparece: no queda un duplicado fantasma');

await page.evaluate(() => go('capturas'));
await page.waitForTimeout(250);
log(await page.evaluate(() => document.getElementById('draft-slot').textContent.trim() === ''),
  'La tarjeta de recuperación se retira sola');

/* ─────────── 10. Un wizard sin tocar sale sin molestar ─────────── */
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(250);
await page.evaluate(() => cancelWiz());
await page.waitForTimeout(250);
const limpio = await page.evaluate(() => ({
  dialogo: document.getElementById('modal').classList.contains('open'),
  pantalla: document.getElementById('screen-capturas').classList.contains('on'),
  borrador: !!DB.getDraft()
}));
log(limpio.dialogo === false && limpio.pantalla === true && limpio.borrador === false,
  'Abrir un wizard y salir sin escribir nada no pregunta ni deja borrador');

/* ─────────── 11. Se avisa antes de pisar un borrador ajeno ─────────── */
await page.evaluate(() => startWizard('OJ'));
await page.waitForTimeout(250);
await page.fill('#oj-o-num', '9999');
await page.evaluate(() => wizGuardarBorrador());
await page.waitForTimeout(300);
await page.evaluate(() => { wc = null; go('capturas'); });
await page.waitForTimeout(200);
await page.evaluate(() => startWizard('OJ'));
await page.waitForTimeout(250);
const aviso = await page.evaluate(() => ({
  abierto: document.getElementById('modal').classList.contains('open'),
  texto: document.getElementById('modal-c').textContent,
  enWizard: document.getElementById('screen-wizard').classList.contains('on')
}));
log(aviso.abierto === true && /Captura sin terminar/.test(aviso.texto),
  'Empezar otra captura con un borrador vivo pregunta antes de pisarlo');
log(aviso.enWizard === false, 'Y no abre el wizard nuevo hasta que se decide');
await page.evaluate(() => wizEmpezarDeNuevo());
await page.waitForTimeout(300);
const trasNuevo = await page.evaluate(() => ({
  enWizard: document.getElementById('screen-wizard').classList.contains('on'),
  numero: wc ? wc.oj.orden.numero : 'sin wc'
}));
log(trasNuevo.enWizard === true && trasNuevo.numero === '',
  '«Empezar de nuevo» descarta el anterior y abre una captura limpia');

/* ─────────── 12. Modo invitado: el borrador no toca el equipo ─────────── */
await page.evaluate(() => { wc = null; DB.clearDraft(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const huellaAntes = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return JSON.stringify(o);
});
await page.evaluate(() => guestEntrar());
await page.waitForTimeout(300);
await page.evaluate(() => startWizard('OJ'));
await page.waitForTimeout(250);
await page.fill('#oj-o-num', '5555');
await page.click('button[onclick="wizNext()"]');
await page.waitForTimeout(400);
const invitado = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return { huella: JSON.stringify(o), enMemoria: !!DB.getDraft(), enDisco: !!localStorage.getItem('lc_draft') };
});
log(invitado.enMemoria === true, 'En modo invitado el borrador funciona dentro de la sesión');
log(invitado.enDisco === false && invitado.huella === huellaAntes,
  'Pero no escribe un solo byte en el equipo prestado');

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones, todas en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
