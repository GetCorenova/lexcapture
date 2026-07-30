/* Regresión del MODO INVITADO y del encabezado pedido en campo.
   Dos cosas que solo se pueden comprobar de punta a punta:
   1. Un funcionario que NO configura nada (teléfono prestado) puede hacer un
      procedimiento de orden judicial y otro de flagrancia y bajarse los dos
      documentos completos — sin tocar ni ver los datos del dueño del equipo.
   2. Cuando la unidad/dependencia no están configuradas, la app las pide en el
      formulario y las recuerda para el siguiente procedimiento. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8137;
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

/* ═══ Parte A · El dueño del equipo deja su PIN y su configuración ═══ */
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '4321');
await page.fill('#pin-b', '4321');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.ojUnidad = 'UNIDAD DEL DUENO';
  cfg.ojDependencia = 'DEPENDENCIA DEL DUENO';
  cfg.perfiles = [{ id: 'pfd', grado: 'Intendente', nombre: 'Dueno Del Equipo', correo: 'dueno@prueba.test' }];
  cfg.perfilActivo = 'pfd';
  DB.saveConfig(cfg);
});
const antes = await page.evaluate(() => localStorage.getItem('lc_cfg'));
// Huella de TODO el almacenamiento antes de que llegue el invitado: al final
// tiene que estar idéntica (las claves cifradas ya existen desde que se creó el
// PIN, así que lo que se comprueba es que no cambien, no que no existan).
const huellaAntes = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return JSON.stringify(o);
});
log(/UNIDAD DEL DUENO/.test(antes), 'El dueño del equipo tiene su configuración guardada');

/* ═══ Parte B · Llega el invitado: recarga y entra sin el PIN ═══ */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
log(await page.isVisible('#pin-e'), 'Al abrir, la app pide el PIN del dueño');
log(await page.isVisible('div.pin-forget:has-text("Usar como invitado")'), 'La pantalla del PIN ofrece entrar como invitado');
await page.click('div.pin-forget:has-text("Usar como invitado")');
await page.waitForTimeout(400);

log(await page.isVisible('#guest-bar'), 'Se entra sin PIN y queda un aviso permanente de modo invitado');
const aviso = await page.textContent('#guest-bar');
log(/nada se guarda en este equipo/.test(aviso), 'El aviso dice sin rodeos que nada se guarda', aviso.trim().slice(0, 60));
const vePin = await page.isVisible('#pin-e').catch(() => false);
log(vePin === false, 'La pantalla de PIN se cerró');

const aislado = await page.evaluate(() => {
  const cfg = DB.getConfig();
  return { unidad: cfg.ojUnidad, perfiles: (cfg.perfiles || []).length, casos: DB.getCases().length, personas: DB.getPersons().length };
});
log(aislado.unidad === '' && aislado.perfiles === 0,
  'El invitado NO ve la configuración ni el perfil del dueño', JSON.stringify(aislado));
log(aislado.casos === 0 && aislado.personas === 0, 'Ni sus capturas ni sus personas');

/* ═══ Parte C · El invitado hace una captura por orden judicial completa ═══ */
await page.evaluate(() => go('nueva'));
await page.click('button[onclick="startWizard(\'OJ\')"]');
await page.waitForTimeout(250);
log(await page.isVisible('#oj-o-num'), 'El invitado tiene el formulario completo de orden judicial');

const hoy = new Date();
const exp = new Date(hoy.getTime() - 20 * 86400000).toISOString().slice(0, 10);
const fechaDil = hoy.toISOString().slice(0, 10);
await page.fill('#oj-o-num', '778');
await page.selectOption('#oj-o-fin', 'MEDIDA_ASEGURAMIENTO');
await page.fill('#oj-o-fexp', exp);
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
await page.fill('#oj-d-nom', 'Juzgado Treinta y Seis Penal Municipal de Conocimiento de Medellin');
await page.fill('#oj-d-mun', 'Medellin');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
await page.fill('#oj-p-rad', '050016000206202599999');
await page.click('button[onclick="ojListaAgregar(\'delitos\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-delitos-0-nombre', 'Hurto agravado con violencia');
await page.fill('#ojl-delitos-0-articulo', '240');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
await page.fill('#oj-r-pn', 'INVITADO');
await page.fill('#oj-r-pa', 'REQUERIDO');
await page.fill('#oj-r-nd', '99887766');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
await page.fill('#oj-g-fec', fechaDil);
await page.fill('#oj-g-hor', '10:20');
await page.fill('#oj-g-dir', 'Calle 59 con carrera 52');
// Sin perfil configurado no hay funcionario precargado: el invitado lo escribe.
await page.click('button[onclick="ojListaAgregar(\'funcionarios\')"]'); await page.waitForTimeout(150);
await page.fill('#ojl-funcionarios-0-grado', 'Patrullero');
await page.fill('#ojl-funcionarios-0-nombre', 'FUNCIONARIO INVITADO');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(200);
await page.check('#oj-a-dler');
await page.fill('#oj-a-dhor', '10:40');
await page.check('#oj-a-anx0');
await page.check('#oj-a-anx1');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(300);

/* El equipo no está configurado: la app pide unidad, dependencia y firma. */
const panel7 = await page.textContent('#wz-panels');
log(/Falta el encabezado/.test(panel7), 'Sin configuración, el paso 7 pide la unidad y la dependencia');
log(/Sin perfil cargado/.test(panel7), 'Y avisa que no hay perfil para la firma');
log((await page.inputValue('#oj-e-uni')) === '', 'La unidad llega vacía: no hereda la del dueño');

const durasAntes = await page.evaluate(() => { ojCollect(); return ojDuras(wc).map(v => v.id); });
log(['V30', 'V31', 'V26', 'V27', 'V28'].every(id => durasAntes.includes(id)),
  'Sin las 4 líneas del membrete ni la firma no se puede generar el oficio', durasAntes.join(','));

await page.fill('#oj-e-min', 'MINISTERIO DE PRUEBA INVITADO');
await page.fill('#oj-e-ins', 'INSTITUCION DE PRUEBA INVITADO');
await page.fill('#oj-e-uni', 'METROPOLITANA DE PRUEBA INVITADO');
await page.fill('#oj-e-dep', 'ESTACION DE PRUEBA INVITADO');
await page.fill('#oj-c-est', 'Estacion de Policia Invitado');
await page.fill('#oj-c-dir', 'Calle 48 No. 55-50');
await page.fill('#oj-c-tel', '3127324069');
await page.fill('#oj-c-cor', 'invitado@prueba.test');
await page.fill('#oj-f-gra', 'Patrullero');
await page.fill('#oj-f-nom', 'Funcionario Invitado');
await page.fill('#oj-f-car', 'Integrante patrulla de vigilancia');
await page.fill('#oj-f-tel', '3100000000');
await page.fill('#oj-f-cor', 'invitado@prueba.test');
const durasDespues = await page.evaluate(() => { ojCollect(); return ojDuras(wc).map(v => v.id); });
log(durasDespues.length === 0, 'Diligenciados a mano, no queda ninguna validación dura', durasDespues.join(',') || 'ninguna');

/* Genera y descarga el oficio: pasa por el diálogo obligatorio de exportación */
await page.click('button[onclick="ojGenerarDesdeWizard()"]');
await page.waitForSelector('#exp-go', { timeout: 8000 });
log(await page.isDisabled('#exp-go'), 'Al invitado también se le piden formato y tamaño antes de producir nada');
await page.click('#exp-fmt-DOCX');
await page.click('#exp-papel-OFICIO');
const [dlOJ] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
  page.click('#exp-go')
]);
log(!!dlOJ && /^OJ_Disposicion_.*\.docx$/.test(dlOJ.suggestedFilename()),
  'El invitado descarga su oficio de orden judicial completo', dlOJ ? dlOJ.suggestedFilename() : '(sin descarga)');

const contenidoOJ = await page.evaluate(async () => {
  const c = DB.getCases()[0];
  const out = await buildOficioOJBlob(c);
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  const files = await _unzipBufAsync(buf);
  const d = n => new TextDecoder().decode(files[n]);
  const xml = d('word/document.xml');
  const ts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('\n');
  return { header: d('word/header1.xml'), texto: ts, tablas: (xml.match(/<w:tbl>/g) || []).length };
});
log(/METROPOLITANA DE PRUEBA INVITADO/.test(contenidoOJ.header) &&
    /ESTACION DE PRUEBA INVITADO/.test(contenidoOJ.header),
  'El membrete del oficio usa la unidad que diligenció el invitado');
log(/UNIDAD DEL DUENO/.test(contenidoOJ.header) === false, 'Y nunca la del dueño del equipo');
log(contenidoOJ.tablas === 3 && /1\.\s+IDENTIFICACIÓN DEL CAPTURADO/.test(contenidoOJ.texto),
  'El oficio del invitado sale con el mismo formato oficial');
log(/Patrullero FUNCIONARIO INVITADO/.test(contenidoOJ.texto), 'Firmado por quien diligenció');
log(/quedó bajo custodia en Estacion de Policia Invitado/.test(contenidoOJ.texto),
  'Con la constancia del lugar de custodia que indicó');

/* ═══ Parte D · El invitado hace también una captura en flagrancia ═══ */
await page.evaluate(() => go('nueva'));
await page.click('button[onclick="startWizard(\'URI\')"]');
await page.waitForTimeout(250);
log(await page.isVisible('#w-nunc'), 'El invitado también tiene el formulario de flagrancia');
// Se arma el caso por API para no repetir los 8 pasos del wizard de flagrancia:
// lo que se comprueba aquí es que en invitado el FPJ-5 se genera igual.
const flag = await page.evaluate(async () => {
  wc.nunc = '1122334455667788';
  wc.capturados = [{ id: uid(), rol: 'Capturado', tipoDoc: 'CC', numDoc: '5544332211',
    priNom: 'FLAGRANCIA', priApe: 'INVITADO', alias: 'N/A' }];
  wc.servidor = { grado: 'Patrullero', nombre: 'Funcionario Invitado', ident: '111', entidad: 'Entidad Invitado', cargo: '', tel: '', correo: '' };
  const out = buildFPJBlob(wc);
  return out ? { fname: out.fname, size: out.blob.size } : null;
});
log(!!flag && /^FPJ5_URI_/.test(flag.fname) && flag.size > 100000,
  'El invitado genera su FPJ-5 de flagrancia completo', flag ? `${flag.fname} (${flag.size} bytes)` : '(nulo)');

/* ═══ Parte E · Nada quedó escrito en el equipo del dueño ═══ */
const despues = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return { cfg: localStorage.getItem('lc_cfg'), huella: JSON.stringify(o), enMemoria: DB.getCases().length };
});
log(despues.cfg === antes, 'La configuración del dueño quedó intacta, byte por byte');
log(/METROPOLITANA DE PRUEBA INVITADO/.test(despues.cfg || '') === false,
  'La unidad que diligenció el invitado NO se escribió en el equipo');
log(despues.huella === huellaAntes,
  'El almacenamiento del equipo quedó exactamente igual: ni una clave tocada');
log(despues.enMemoria === 1, 'Pero durante la sesión sí funcionó como una app normal', despues.enMemoria + ' caso en memoria');

/* ═══ Parte F · Al recargar, el dueño encuentra su equipo como lo dejó ═══ */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
log(await page.isVisible('#pin-e'), 'Tras recargar vuelve a pedirse el PIN del dueño');
const barraFuera = await page.isVisible('#guest-bar');
log(barraFuera === false, 'La sesión de invitado no sobrevive a la recarga');
await page.fill('#pin-e', '4321');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(500);
const duenoOk = await page.evaluate(() => {
  const cfg = DB.getConfig();
  return { unidad: cfg.ojUnidad, perfil: (cfg.perfiles[0] || {}).nombre, casos: DB.getCases().length };
});
log(duenoOk.unidad === 'UNIDAD DEL DUENO' && duenoOk.perfil === 'Dueno Del Equipo',
  'El dueño recupera su configuración y su perfil');
log(duenoOk.casos === 0, 'Y no ve ninguna captura del invitado', duenoOk.casos);

/* ═══ Parte G · La unidad pedida en campo se recuerda para la próxima ═══ */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.ojUnidad = ''; cfg.ojDependencia = '';       // equipo del dueño sin encabezado
  DB.saveConfig(cfg);
});
const recordo = await page.evaluate(async () => {
  wc = ojNuevoCaso(); ws = 0;
  wc.oj.encabezado = { unidad: 'UNIDAD DILIGENCIADA EN CAMPO', dependencia: 'ESTACION DILIGENCIADA EN CAMPO' };
  wc.oj.requerido.priNom = 'A'; wc.oj.requerido.priApe = 'B';
  ojRecordarEncabezado(wc);
  const cfg = DB.getConfig();
  return { unidad: cfg.ojUnidad, dep: cfg.ojDependencia };
});
log(recordo.unidad === 'UNIDAD DILIGENCIADA EN CAMPO' && recordo.dep === 'ESTACION DILIGENCIADA EN CAMPO',
  'Lo que se diligencia en campo queda como valor por defecto: no se pregunta dos veces',
  recordo.unidad);

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fails ? `\n❌ ${fails} de ${n} comprobaciones fallaron` : `\n✅ ${n} comprobaciones, todas en verde`);
process.exit(fails ? 1 : 0);
