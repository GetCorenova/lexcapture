// MEJORA A — siete observaciones de campo (Mejoras/Mejora A.docx).
// 1 y 4 · las barras del sistema no tapan la app (zona segura arriba y abajo)
// 2 · firma: con firma guardada no hay segundo lienzo; Editar / Eliminar;
//     cancelar la edición conserva la firma; pantalla completa en horizontal
// 3 · Ajustes no muestra datos de muestra en los ejemplos de los campos
// 5 · «¿A quién vas a registrar?» es un panel de pantalla completa
// 6 · Anterior / Siguiente / Guardar no tapan el formulario
// 7 · Compartir todo el expediente, con aviso de lo que falta
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = process.env.SHOTS || process.env.TEMP || '.';
const MIME = { '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.js':'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8131, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });

await page.goto('http://localhost:8131/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForSelector('#pin-box .pin-forget[onclick="syOnboardSalir()"]', { timeout: 2500 })
  .then(() => page.evaluate(() => syOnboardSalir())).catch(() => {});
await page.waitForTimeout(800);

/* ═══ 1 y 4 · zona segura ═══ */
// Lo que inyecta MainActivity en el teléfono: 40 px arriba, 48 px abajo.
await page.evaluate(() => {
  const s = document.documentElement.style;
  s.setProperty('--safe-area-inset-top', '40px'); s.setProperty('--safe-area-inset-bottom', '48px');
  go('capturas');
});
await page.waitForTimeout(300);
const za = await page.evaluate(() => {
  const bb = document.getElementById('bottombar'), tb = document.querySelector('#screen-capturas .topbar');
  return {
    bbPad: parseFloat(getComputedStyle(bb).paddingBottom),
    tbPad: parseFloat(getComputedStyle(tb).paddingTop)
  };
});
log(za.bbPad >= 48 + 8, 'La barra inferior deja sitio a la barra de navegación del teléfono', za.bbPad + ' px');
log(za.tbPad >= 40 + 12, 'La barra superior deja sitio a la hora y la señal', za.tbPad + ' px');
await page.screenshot({ path: SHOTS + '/mA_zona_capturas.png' });

// Perfil: «Guardar perfil» no queda bajo la barra del teléfono.
await page.evaluate(() => { go('perfil'); openPerfilForm && openPerfilForm(); });
await page.waitForTimeout(400);
const gp = await page.evaluate(() => {
  const mc = document.getElementById('modal-c');
  mc.scrollTop = mc.scrollHeight;
  const cs = getComputedStyle(mc);
  return { pad: parseFloat(cs.paddingBottom), maxH: cs.maxHeight };
});
await page.waitForTimeout(200);
const gpb = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#modal-c button')].find(x => /guardar perfil/i.test(x.textContent));
  return b ? b.getBoundingClientRect().bottom : -1;
});
log(gp.pad >= 48 + 20 && gpb > 0 && gpb <= 800 - 48,
  'Formulario del perfil: «Guardar perfil» queda por encima de la barra del teléfono', 'botón hasta y=' + Math.round(gpb));
await page.screenshot({ path: SHOTS + '/mA_perfil_form.png' });
await page.evaluate(() => closeModal());
// Sin inyección (navegador): la zona segura vale 0.
await page.evaluate(() => { const s = document.documentElement.style; s.removeProperty('--safe-area-inset-top'); s.removeProperty('--safe-area-inset-bottom'); });
const z0 = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('bottombar')).paddingBottom));
log(z0 === 8, 'En el navegador, sin envoltorio, no cambia un píxel', z0 + ' px');
// El fuente ya no pide a Android reservar la franja (la dejaba NEGRA).
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
log(!/setOverlaysWebView\s*\(\s*\{\s*overlay\s*:\s*false/.test(src), 'La app ya no le pide a Android reservar la franja superior en negro');
const main = readFileSync('d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/lexcapture-android/android/app/src/main/java/com/getcorenova/flagrante/MainActivity.java', 'utf8');
log(/--safe-area-inset-bottom/.test(main) && /setDecorFitsSystemWindows\(w, false\)/.test(main),
  'El envoltorio mide las dos franjas y se las entrega a la página');

/* ═══ 2 · firma ═══ */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id:'p1', grado:'Subintendente', nombre:'PRUEBA UNO', cedula:'1', telefono:'', cargo:'', entidad:'', correo:'' }];
  cfg.perfilActivo = 'p1'; DB.saveConfig(cfg); go('perfil'); renderPerfilScreen();
  openFirmaModal('p1');
});
await page.waitForTimeout(400);
log(await page.locator('#fw-cv').count() === 1, 'Sin firma guardada se abre directo el lienzo');
async function firmar(sel) {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.move(b.x + b.width * .15, b.y + b.height * .6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (.15 + i * .06), b.y + b.height * (.6 - Math.sin(i) * .25));
  await page.mouse.up();
}
await firmar('#fw-cv');
await page.evaluate(async () => { await fwGuardar('p1'); });
await page.waitForTimeout(300);
const firma1 = await page.evaluate(() => DB.getFirma('p1').b64);
await page.evaluate(() => openFirmaModal('p1'));
await page.waitForTimeout(400);
const vista = await page.evaluate(() => ({
  lienzos: document.querySelectorAll('#modal-c canvas').length,
  botones: [...document.querySelectorAll('#fw-zona button')].map(b => b.textContent.trim()),
  img: document.querySelectorAll('#fw-zona img').length
}));
log(vista.lienzos === 0 && vista.img === 1, 'Con firma guardada NO aparece el segundo espacio para firmar', vista.lienzos + ' lienzos');
log(vista.botones.join('|') === 'Editar|Eliminar', 'La firma guardada ofrece Editar y Eliminar', vista.botones.join(', '));
await page.screenshot({ path: SHOTS + '/mA_firma_vista.png' });
await page.evaluate(() => fwEditar());
await page.waitForTimeout(300);
await firmar('#fw-cv');
await page.evaluate(() => fwVista());          // cancelar sin guardar
await page.waitForTimeout(200);
log(await page.evaluate(b => DB.getFirma('p1').b64 === b, firma1), 'Editar y cancelar sin guardar conserva la firma que tenía');
await page.evaluate(() => fwEditar());
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '/mA_firma_editar.png' });
log(await page.locator('#fw-zona button', { hasText: 'Pantalla completa' }).count() === 1, 'Hay opción de firmar a pantalla completa');
await page.evaluate(() => fwPantallaCompleta());
await page.waitForTimeout(700);
const full = await page.evaluate(() => {
  const r = document.getElementById('ff-rot'), cv = document.getElementById('fw-cv-full');
  return { rot: r.classList.contains('rot'), w: cv.clientWidth, h: cv.clientHeight, on: document.getElementById('fw-full').classList.contains('on') };
});
log(full.on && full.rot && full.w > full.h, 'Pantalla completa: con el teléfono en vertical el lienzo se gira a horizontal', full.w + '×' + full.h);
await firmar('#fw-cv-full');
await page.screenshot({ path: SHOTS + '/mA_firma_completa.png' });
await page.evaluate(async () => { await fwGuardarCompleta(); });
await page.waitForTimeout(400);
const f2 = await page.evaluate(() => { const f = DB.getFirma('p1'); return { b: f.b64, w: f.w, h: f.h, on: document.getElementById('fw-full').classList.contains('on') }; });
log(f2.b !== firma1 && !f2.on, 'La firma hecha a pantalla completa se guarda y reemplaza la anterior');
log(f2.w > f2.h, 'Y se guarda derecha (horizontal), aunque se dibujó con el lienzo girado', f2.w + '×' + f2.h);

/* ═══ 3 · ejemplos de Ajustes ═══ */
await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(300);
const phs = await page.evaluate(() => [...document.querySelectorAll('#screen-ajustes input')].map(i => i.placeholder).join(' | '));
const prohibidos = ['Jin Eduardo', 'William Quintero', 'CL 48', 'La Candelaria', 'Medellín', '3126543210', 'CANDELARIA', 'Distrito tres', 'VERDE 3', 'DIAMANTE 3'];
const hay = prohibidos.filter(p => phs.indexOf(p) >= 0);
log(hay.length === 0, 'Ajustes no enseña datos de muestra como ejemplo', hay.join(', ') || 'ninguno');
log(/Ministerio/.test(phs) && /instituci/i.test(phs) && /Sitio web/.test(phs), 'Sector, institución y sitio web conservan su referencia (excepción del usuario)');

/* ═══ 5 · panel de tipo de persona ═══ */
await page.evaluate(() => { go('personas'); openPersonRolePicker(); });
await page.waitForTimeout(400);
const pan = await page.evaluate(() => {
  const mc = document.getElementById('modal-c').getBoundingClientRect();
  return { full: document.getElementById('modal').classList.contains('full'), top: mc.top, h: mc.height, cards: document.querySelectorAll('.rol-card').length };
});
log(pan.full && pan.top === 0 && pan.h >= 790 && pan.cards === 3, '«¿A quién vas a registrar?» abre un panel de pantalla completa', Math.round(pan.h) + ' px de alto');
await page.screenshot({ path: SHOTS + '/mA_panel_persona.png' });
await page.click('.rol-card.r-vic');
await page.waitForTimeout(400);
const tras = await page.evaluate(() => ({ full: document.getElementById('modal').classList.contains('full'), h2: (document.querySelector('#modal-c h2') || {}).textContent }));
log(!tras.full && /Víctima/.test(tras.h2 || ''), 'Elegir un tipo abre el formulario de siempre', tras.h2);
await page.evaluate(() => closeModal());
log(await page.evaluate(() => !document.getElementById('modal').classList.contains('full')), 'Cerrar el panel no deja el contenedor en modo pantalla completa');

/* ═══ 6 · navegación del wizard ═══ */
await page.evaluate(() => { startWizard('URI'); });
await page.waitForTimeout(500);
const wn = await page.evaluate(() => {
  const n = document.querySelector('#wz-panels .wnav'), cs = getComputedStyle(n);
  const panel = document.querySelector('#wz-panels .wpn');
  return { pos: cs.position, debajo: n.getBoundingClientRect().top >= panel.getBoundingClientRect().bottom - 1,
           vis: n.getBoundingClientRect().top < innerHeight };
});
log(wn.pos === 'static' && wn.debajo, 'Anterior/Siguiente/Guardar van al final del formulario, no flotan encima', wn.pos);
await page.screenshot({ path: SHOTS + '/mA_wizard_arriba.png' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(250);
const alFinal = await page.evaluate(() => {
  const n = document.querySelector('#wz-panels .wnav').getBoundingClientRect();
  const bb = document.getElementById('bottombar').getBoundingClientRect();
  return { bottom: n.bottom, bbTop: bb.top };
});
log(alFinal.bottom <= alFinal.bbTop + 1, 'Al llegar al final los botones se ven enteros, encima de la barra inferior', Math.round(alFinal.bottom) + ' ≤ ' + Math.round(alFinal.bbTop));
await page.screenshot({ path: SHOTS + '/mA_wizard_abajo.png' });
await page.evaluate(() => { wc = null; go('capturas'); });

/* ═══ 7 · compartir expediente ═══ */
const id = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); c.nunc = '123'; await DB.saveCase(c); return c.id;
});
await page.evaluate(i => { abrirDossierCaso(i); }, id);
await page.waitForTimeout(500);
log(await page.locator('#exp-docs .exp-hd button', { hasText: 'Compartir expediente' }).count() === 1, 'El expediente tiene «Compartir expediente» junto a Documentos');
await page.screenshot({ path: SHOTS + '/mA_expediente.png' });
log(await page.evaluate(() => !document.getElementById('modal').classList.contains('open')), 'La advertencia NO sale al entrar: solo al pulsar el botón');
await page.click('#exp-docs .exp-hd button');
await page.waitForTimeout(500);
const adv = await page.evaluate(() => document.getElementById('modal-c').innerText);
log(/Faltan datos en/i.test(adv) && /Informe FPJ-5/i.test(adv) && /NUNC/.test(adv), 'Si falta algo, avisa en qué documento y qué le falta');
await page.screenshot({ path: SHOTS + '/mA_expediente_aviso.png' });
const nListos = await page.evaluate(i => lcExpedienteTrabajos(JSON.parse(JSON.stringify(DB.getCase(i)))).jobs.length, id);
await page.evaluate(() => { const b = [...document.querySelectorAll('#modal-c button')].find(x => /Enviar los/.test(x.textContent)); b.click(); });
await page.waitForSelector('#modal-c button:has-text("Descargar todos")', { timeout: 20000 });
const listos = await page.evaluate(() => (_expOut || []).length);
log(listos === nListos && listos > 3, 'Genera todos los documentos que sí están listos', listos + ' documentos');
const nombres = await page.evaluate(() => (_expOut || []).map(o => o.fname));
log(new Set(nombres.map(n => n.toLowerCase())).size === nombres.length, 'Ningún archivo se pisa con otro (nombres únicos)');
await page.screenshot({ path: SHOTS + '/mA_expediente_listo.png' });
const dls = [];
page.on('download', d => dls.push(d.suggestedFilename()));
await page.evaluate(() => lcExpedienteEnviar('dl'));
await page.waitForTimeout(400 * listos + 1200);
log(dls.length === listos, 'Descargar todos entrega cada documento', dls.length + ' descargas');
// Un expediente completo no pregunta nada: va directo a preparar.
const id2 = await page.evaluate(async () => { const c = SIM.genFlagrancia('URI'); c.elementos = []; if (c.narracion) c.narracion.emp = ''; await DB.saveCase(c); return c.id; });
const t2 = await page.evaluate(i => lcExpedienteTrabajos(JSON.parse(JSON.stringify(DB.getCase(i)))).faltas.length, id2);
log(t2 === 0, 'Un expediente sin faltantes no enseña advertencia', t2 + ' faltas');
// Mirar qué falta no modifica el caso guardado.
const intacto = await page.evaluate(i => { const a = JSON.stringify(DB.getCase(i)); lcCompartirExpediente(i); closeModal(); return a === JSON.stringify(DB.getCase(i)); }, id);
log(intacto, 'Revisar el expediente no modifica la captura');

log(errs.length === 0, 'Consola limpia', errs.join(' / '));
await browser.close(); server.close();
const ok = R.filter(Boolean).length;
console.log('\n' + ok + '/' + R.length + ' comprobaciones');
process.exit(ok === R.length ? 0 : 1);
