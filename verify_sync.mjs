/* SINCRONIZACIÓN ENTRE LOS EQUIPOS DEL USUARIO — lo que registra en el teléfono
   aparece en el computador, cifrado en su propio Google Drive.

   ⚠️ Esta suite NO toca Google. Lo que se puede comprobar de verdad —la clave,
   el sobre cifrado, qué viaja, la fusión entre dos equipos y las guardas— no
   necesita red, y atarlo a una cuenta real dejaría la regresión sin poder
   correr. Lo que sí depende de Google (pedir el permiso, subir y bajar) se
   prueba a mano con una cuenta, una vez, y está anotado en CLAUDE.md.

   ⚠️ Se abren DOS CONTEXTOS de navegador, no dos pestañas: cada lado con su
   propio almacenamiento y su propio PIN, que es lo que los convierte en dos
   equipos y no en dos vistas del mismo. */
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
await new Promise(r => server.listen(8137, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

const browser = await chromium.launch({ headless: true });
const errs = [];
async function abrirEquipo(pin, tag) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(tag + ': ' + String(e.message).slice(0, 90)));
  pg.on('console', m => { if (m.type() === 'error') errs.push(tag + ': ' + m.text().slice(0, 90)); });
  await pg.goto('http://localhost:8137/LexCapture_v8.html', { waitUntil: 'load' });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForTimeout(400);
  await pg.fill('#pin-a', pin); await pg.fill('#pin-b', pin);
  await pg.click('button[onclick="doSetPin()"]');
  await pg.waitForTimeout(800);
  return pg;
}
const A = await abrirEquipo('123456', 'A');
const B = await abrirEquipo('654321', 'B');

/* ══════════════════════════════════════════════════════════════════════════
   A · LA CLAVE Y SU CÓDIGO
   ⚠️ El código se teclea a mano en el equipo que no tiene cámara, así que lo
   que se mide aquí no es solo que la ida y vuelta funcione: es que tolere los
   errores que comete una persona copiando 26 caracteres de una pantalla. */

const a1 = await A.evaluate(() => {
  const k = syClaveNueva();
  return { k, n: k.length, limpio: /^[0-9A-HJKMNP-TV-Z]+$/.test(k) };
});
log(a1.n === 26, '[A1] la clave nueva son 26 caracteres', a1.n);
log(a1.limpio, '[A2] usa el alfabeto Crockford (sin I, L, O ni U)', a1.k);

const a3 = await A.evaluate(() => {
  const k = syClaveNueva();
  return syB32Enc(syB32Dec(k)) === k;
});
log(a3, '[A3] el código va y vuelve sin perder un bit');

/* Los cuatro errores de transcripción que de verdad se cometen. */
const a4 = await A.evaluate(() => {
  const k = syClaveNueva();
  const bien = Array.from(syB32Dec(k)).join(',');
  const como = s => Array.from(syB32Dec(s) || []).join(',');
  return {
    minus:   como(k.toLowerCase()) === bien,
    guiones: como(syCodigoBonito(k)) === bien,
    espacios:como(k.replace(/(.{4})/g, '$1 ')) === bien,
    // I y L se leen como 1, O como 0: es la gracia del alfabeto
    confuso: como(k.replace(/1/g, 'I').replace(/0/g, 'O')) === bien
  };
});
log(a4.minus, '[A4] tecleado en minúsculas, vale igual');
log(a4.guiones, '[A5] con los guiones que muestra la pantalla, vale igual');
log(a4.espacios, '[A6] con espacios de más, vale igual');
log(a4.confuso, '[A7] confundir I/L con 1 y O con 0 no rompe el código');

const a8 = await A.evaluate(async () => {
  const r = await syVincular('ABC');            // muy corto para ser una clave
  return { ok: r.ok, motivo: r.motivo };
});
log(!a8.ok, '[A8] un código que no tiene forma de clave se rechaza', a8.motivo);

/* La misma clave tiene que dar la MISMA clave AES en los dos equipos: si no,
   el segundo equipo no abriría nada de lo que subió el primero. */
const a9 = await A.evaluate(async () => {
  const k = syClaveNueva(), b = syB32Dec(k);
  const k1 = await syClaveAES(b), k2 = await syClaveAES(syB32Dec(syB32Enc(b)));
  const iv = new Uint8Array(12);
  const d = new TextEncoder().encode('prueba');
  const c1 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, d));
  const c2 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k2, d));
  return c1.join(',') === c2.join(',');
});
log(a9, '[A9] la misma clave deriva la misma clave de cifrado en cualquier equipo');

/* ══════════════════════════════════════════════════════════════════════════
   B · EL SOBRE QUE VIVE EN DRIVE */

const b1 = await A.evaluate(async () => {
  const k = await syClaveAES(syB32Dec(syClaveNueva()));
  const bytes = await syCifrar({ hola: 'mundo', n: 7 }, k);
  const marca = String.fromCharCode.apply(null, bytes.slice(0, 5));
  const r = await syDescifrar(bytes, k);
  return { marca, ok: r.ok, n: r.ok ? r.o.n : 0, len: bytes.length };
});
log(b1.marca === 'LXSY1', '[B1] el sobre lleva su marca en claro', b1.marca);
log(b1.ok && b1.n === 7, '[B2] cifra y descifra sin perder el contenido');

const b3 = await A.evaluate(async () => {
  const k1 = await syClaveAES(syB32Dec(syClaveNueva()));
  const k2 = await syClaveAES(syB32Dec(syClaveNueva()));
  const bytes = await syCifrar({ secreto: 'x' }, k1);
  const r = await syDescifrar(bytes, k2);
  return { ok: r.ok, motivo: r.motivo || '' };
});
log(!b3.ok, '[B3] otra clave NO abre el sobre', b3.motivo);

const b4 = await A.evaluate(async () => {
  const k = await syClaveAES(syB32Dec(syClaveNueva()));
  const otro = new Uint8Array(40); otro[0] = 80; otro[1] = 75;     // un .zip cualquiera
  const r = await syDescifrar(otro, k);
  return { ok: r.ok, motivo: r.motivo || '' };
});
log(!b4.ok && /no lo generó esta aplicación/i.test(b4.motivo),
    '[B4] un archivo que no es de la aplicación se rechaza por la marca, sin intentar descifrarlo');

/* Lo que sube a Drive no puede llevar ni un dato legible. */
const b5 = await A.evaluate(async () => {
  const k = await syClaveAES(syB32Dec(syClaveNueva()));
  const bytes = await syCifrar({ casos: [{ id: 'x', nombre: 'DAYNIS GONZALES' }] }, k);
  const txt = String.fromCharCode.apply(null, bytes);
  return txt.indexOf('DAYNIS') < 0 && txt.indexOf('casos') < 0;
});
log(b5, '[B5] el nombre de una persona no se lee en el archivo cifrado');

/* ══════════════════════════════════════════════════════════════════════════
   C · QUÉ VIAJA Y QUÉ NO
   ⚠️ La firma manuscrita es la exclusión que importa: es un rasgo biométrico y
   con ella se suscriben documentos judiciales. Misma política que Modo
   compartir, y aquí no hace falta filtrarla porque vive fuera del paquete —
   pero se comprueba, que es distinto de suponerlo. */

await A.evaluate(async () => {
  await DB.savePersons([{ id: 'p1', priNom: 'ANA', priApe: 'RUIZ', numDoc: '111', tipoDoc: 'CC' }]);
  await DB.saveCases([{ id: 'c1', tipo: 'URI', created: Date.now(), capturados: [{ id: 'x1', priNom: 'LUIS' }],
                        servidor: { nombre: 'PATRULLERO A' } }]);
  await DB.saveFirma('perfil-1', { b64: 'FIRMA_SECRETA_AAA', w: 10, h: 5 });
  const cfg = DB.getConfig();
  cfg.nombreEstacion = 'CANDELARIA'; cfg.despachosMigrados = true; cfg.nuncAno = 2026;
  DB.saveConfig(cfg);
});
const c1 = await A.evaluate(() => {
  const s = sySnapshot(), t = JSON.stringify(s);
  return {
    personas: (s.personas || []).length, casos: (s.casos || []).length,
    tieneCfg: !!s.cfg, estacion: (s.cfg || {}).nombreEstacion,
    firma: t.indexOf('FIRMA_SECRETA_AAA') >= 0,
    migr: ('despachosMigrados' in (s.cfg || {})) || ('nuncAno' in (s.cfg || {})),
    marca: s.lx, ver: s.schemaVersion
  };
});
log(c1.personas === 1 && c1.casos === 1, '[C1] el paquete lleva las personas y las capturas');
log(c1.tieneCfg && c1.estacion === 'CANDELARIA', '[C2] lleva la configuración de la unidad', c1.estacion);
log(!c1.firma, '[C3] la firma manuscrita NO viaja');
log(!c1.migr, '[C4] las marcas de migración NO viajan (revivirían una migración ya hecha)');

const c5 = await A.evaluate(() => { const r = ptAbrirPaquete(sySnapshot()); return { ok: r.ok, rech: (r.rechazados || []).length }; });
log(c5.ok && c5.rech === 0, '[C5] el paquete pasa la misma validación que usa Modo compartir');

/* ══════════════════════════════════════════════════════════════════════════
   D · LA FUSIÓN ENTRE DOS EQUIPOS — el escenario del encargo */

const snapA = await A.evaluate(() => JSON.stringify(sySnapshot()));

/* B tenía lo suyo ANTES de vincularse: es el caso real del funcionario que usó
   semanas el computador de la estación antes de activar la sincronización. */
await B.evaluate(async () => {
  await DB.savePersons([{ id: 'p9', priNom: 'CARLOS', priApe: 'MEJIA', numDoc: '999', tipoDoc: 'CC' }]);
  await DB.saveCases([{ id: 'c9', tipo: 'CESPA', created: Date.now(), capturados: [{ id: 'y9', priNom: 'PEDRO' }] }]);
  const cfg = DB.getConfig(); cfg.ojUnidad = 'UNIDAD DE B'; DB.saveConfig(cfg);
});
const d1 = await B.evaluate(async (s) => {
  const r = await syAplicar(JSON.parse(s));
  return {
    ok: r.ok,
    casos: DB.getCases().map(c => c.id).sort().join(','),
    personas: DB.getPersons().map(p => p.id).sort().join(','),
    estacion: DB.getConfig().nombreEstacion,
    unidadB: DB.getConfig().ojUnidad
  };
}, snapA);
log(d1.ok, '[D1] el paquete del otro equipo se aplica');
log(d1.casos === 'c1,c9', '[D2] llega la captura de A y NO se borra la que ya tenía B', d1.casos);
log(d1.personas.indexOf('p1') >= 0 && d1.personas.indexOf('p9') >= 0,
    '[D3] llegan las personas de A y siguen las de B', d1.personas);
log(d1.estacion === 'CANDELARIA', '[D4] la configuración de A llega a B', d1.estacion);
log(d1.unidadB === 'UNIDAD DE B', '[D5] lo que B había configurado y A no, se conserva', d1.unidadB);

/* La marca de migración de A no puede haberle llegado a B: B todavía no ha
   corrido la suya. */
const d6 = await B.evaluate(() => {
  let raw; try { raw = JSON.parse(localStorage.getItem('lc_cfg')) || {}; } catch (e) { raw = {}; }
  return raw.nuncAno;
});
log(d6 !== 2026, '[D6] la marca de migración de A no se le pegó a B', d6);

/* «Quién firma» no se sobrescribe en una captura que este equipo YA tenía. */
await B.evaluate(async () => {
  const c = DB.getCase('c9'); c.servidor = { nombre: 'PATRULLERO B' }; await DB.saveCase(c);
});
const d7 = await B.evaluate(async () => {
  const otro = { lx: 'lexcapture', schemaVersion: 1, app: 0, origen: 'x', ts: Date.now(),
                 personas: [], casos: [{ id: 'c9', servidor: { nombre: 'PATRULLERO A' }, tipo: 'CESPA' }] };
  await syAplicar(otro);
  return (DB.getCase('c9').servidor || {}).nombre;
});
log(d7 === 'PATRULLERO B', '[D7] quién suscribe el informe NO lo cambia lo que llega de otro equipo', d7);

/* Un valor vacío que llega no puede borrar un dato que aquí sí existe. */
const d8 = await B.evaluate(async () => {
  const otro = { lx: 'lexcapture', schemaVersion: 1, app: 0, origen: 'x', ts: Date.now(),
                 personas: [{ id: 'p9', priNom: '', priApe: '', numDoc: '999', tipoDoc: 'CC' }], casos: [] };
  await syAplicar(otro);
  const p = DB.getPerson('p9');
  return p ? p.priNom : '(no está)';
});
log(d8 === 'CARLOS', '[D8] un dato vacío que llega no borra el que ya estaba', d8);

/* La configuración se funde campo a campo: con «gana la última entera» se
   perdería en silencio uno de los dos cambios. */
const d9 = await B.evaluate(async () => {
  const otro = { lx: 'lexcapture', schemaVersion: 1, app: 0, origen: 'x', ts: Date.now(),
                 personas: [], casos: [], cfg: { ojInstitucion: 'INSTITUCION DE A' } };
  await syAplicar(otro);
  const c = DB.getConfig();
  return { inst: c.ojInstitucion, unidad: c.ojUnidad, estacion: c.nombreEstacion };
});
log(d9.inst === 'INSTITUCION DE A' && d9.unidad === 'UNIDAD DE B',
    '[D9] la configuración se funde campo a campo, no gana-todo', JSON.stringify(d9));

/* ══════════════════════════════════════════════════════════════════════════
   E · LAS GUARDAS
   ⚠️ La del wizard abierto no es cosmética: el formulario trabaja sobre una
   COPIA del caso y al guardar reemplaza el original, así que una fusión que
   entrara por debajo mientras está abierto la borraría al terminar. */

const e1 = await A.evaluate(async () => {
  const antes = _sessionKey; _sessionKey = null;
  const r = await sySincronizar(false);
  _sessionKey = antes;
  return { ok: r.ok, motivo: r.motivo };
});
log(!e1.ok && /PIN/i.test(e1.motivo), '[E1] sin sesión abierta no se sincroniza', e1.motivo);

const e2 = await A.evaluate(async () => {
  await syGuardarEstado({ k: syClaveNueva(), fileId: '', ts: 0 });
  wc = { id: 'abierta' };
  const r = await sySincronizar(false);
  wc = null;
  return { ok: r.ok, motivo: r.motivo };
});
log(!e2.ok && /captura abierta/i.test(e2.motivo), '[E2] con una captura abierta no se sincroniza', e2.motivo);

const e3 = await A.evaluate(async () => {
  await syDesvincular();
  const r = await sySincronizar(false);
  return { ok: r.ok, motivo: r.motivo };
});
log(!e3.ok && /vinculado/i.test(e3.motivo), '[E3] sin vincular no se sincroniza', e3.motivo);

const e4 = await A.evaluate(async () => {
  await syGuardarEstado({ k: syClaveNueva(), fileId: '', ts: 0 });
  const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  const r = await sySincronizar(false);
  Object.defineProperty(navigator, 'onLine', real || { configurable: true, get: () => true });
  await syDesvincular();
  return { ok: r.ok, motivo: r.motivo };
});
log(!e4.ok && /conexión/i.test(e4.motivo), '[E4] sin conexión no se sincroniza, y lo dice', e4.motivo);

/* ══════════════════════════════════════════════════════════════════════════
   F · LA PANTALLA
   ⚠️ [F1] mide el RECTÁNGULO, no el DOM. Un check que solo consulta el DOM no
   dice que la interfaz se vea: en el módulo anterior la pantalla se insertó
   fuera de `<main>`, salía en blanco, y la regresión daba verde igual. */

const f1 = await A.evaluate(() => {
  go('sync');
  const s = document.getElementById('screen-sync');
  if (!s) return { hay: false };
  const r = s.getBoundingClientRect();
  return { hay: true, enMain: !!(s.parentElement && s.parentElement.id === 'main'), alto: Math.round(r.height), ancho: Math.round(r.width) };
});
log(f1.hay && f1.enMain && f1.alto > 100, '[F1] la pantalla existe, cuelga de <main> y ocupa espacio real',
    f1.ancho + 'x' + f1.alto);

const f2 = await A.evaluate(() => ({
  sidebar: !!document.querySelector('.sb-item[data-screen="sync"]'),
  sheet: Array.from(document.querySelectorAll('.sheet-item .ti')).some(e => /Sincronizaci/i.test(e.textContent)),
  enScreens: screens.indexOf('sync') >= 0
}));
log(f2.sidebar, '[F2] tiene su entrada en el panel lateral');
log(f2.sheet, '[F3] tiene su entrada en el sheet «Más» del teléfono');
log(f2.enScreens, '[F4] está registrada como pantalla navegable');

/* Sin identificador de Google la pantalla lo dice, en vez de ofrecer un botón
   que no puede funcionar. */
const f5 = await A.evaluate(() => {
  SY_CLIENT_ID = '';
  go('sync');
  return (document.getElementById('sy-pane') || {}).innerText || '';
});
log(/paso de instalación/i.test(f5) && !/Activar en este equipo/.test(f5),
    '[F5] sin el identificador de Google lo dice, y no ofrece un botón que no puede funcionar',
    f5.slice(0, 50).replace(/\s+/g, ' '));

/* ⚠️ Los TRES estados, no solo el que sale de fábrica: los textos del estado
   vinculado no los mediría nadie, y son los que el funcionario ve a diario. */
const estados = await A.evaluate(async () => {
  const out = {};
  SY_CLIENT_ID = 'prueba.apps.googleusercontent.com';
  await syDesvincular(); go('sync');
  out.sinVincular = (document.getElementById('sy-pane') || {}).innerText || '';
  await syGuardarEstado({ k: syClaveNueva(), fileId: '', ts: Date.now() - 3600000 });
  renderSync(); syUiVerCodigo();
  out.vinculado = (document.getElementById('sy-pane') || {}).innerText || '';
  out.qr = !!document.querySelector('#sy-codigo .pt-qr svg');
  out.codigo = !!document.querySelector('#sy-codigo .sy-code');
  const largos = Array.from(document.querySelectorAll('#sy-pane .oj-hint, #sy-pane p'))
    .map(e => (e.textContent || '').trim()).filter(t => t.length > 110);
  await syDesvincular(); go('sync');
  const largos2 = Array.from(document.querySelectorAll('#sy-pane .oj-hint, #sy-pane p'))
    .map(e => (e.textContent || '').trim()).filter(t => t.length > 110);
  out.largos = largos.concat(largos2);
  SY_CLIENT_ID = '';
  return out;
});
log(/Activar en este equipo/.test(estados.sinVincular) && /Ya lo activé en otro equipo/.test(estados.sinVincular),
    '[F6] sin vincular ofrece las dos salidas: activar aquí, o unirse a lo que ya existe');
/* ⚠️ Sin distinguir mayúsculas: el sistema visual pinta los títulos de sección
   en versalitas y `innerText` los devuelve en mayúsculas. Es el mismo tropiezo
   que ya dejó anotado la suite de Modo compartir. */
log(/sincronizaci[oó]n activa/i.test(estados.vinculado) && /[uú]ltima vez/i.test(estados.vinculado),
    '[F7] vinculado muestra el estado y cuándo fue la última vez',
    estados.vinculado.slice(0, 55).replace(/\s+/g, ' '));
log(estados.qr && estados.codigo, '[F8] el código se muestra como QR y escrito, para el equipo sin cámara');
log(estados.largos.length === 0, '[F9] ningún texto de orientación pasa de 110 caracteres (regla de la Mejora 6)',
    estados.largos.length ? estados.largos[0].slice(0, 55) : '');

/* Ni una palabra técnica: el funcionario no tiene por qué leer «token». */
const f10 = await A.evaluate(async () => {
  SY_CLIENT_ID = 'prueba.apps.googleusercontent.com';
  await syGuardarEstado({ k: syClaveNueva(), fileId: '', ts: Date.now() });
  go('sync'); syUiVerCodigo();
  const t = ((document.getElementById('sy-pane') || {}).innerText || '').toLowerCase();
  await syDesvincular(); SY_CLIENT_ID = '';
  return ['token', 'oauth', 'appdata', 'blob', ' api', 'client id', 'json', 'hkdf', 'aes'].filter(p => t.indexOf(p) >= 0);
});
log(f10.length === 0, '[F10] la pantalla no usa jerga técnica', f10.join(','));

/* La advertencia de pérdida total tiene que estar donde se muestra el código:
   es el único momento en que el funcionario puede actuar sobre ella. */
const f11 = await A.evaluate(async () => {
  SY_CLIENT_ID = 'prueba.apps.googleusercontent.com';
  await syGuardarEstado({ k: syClaveNueva(), fileId: '', ts: Date.now() });
  go('sync'); syUiVerCodigo();
  const t = (document.getElementById('sy-codigo') || {}).innerText || '';
  await syDesvincular(); SY_CLIENT_ID = '';
  return t;
});
log(/no lo recupera nadie/i.test(f11), '[F11] al mostrar el código se advierte que perderlo no tiene vuelta atrás');

/* ══════════════════════════════════════════════════════════════════════════
   G · EL SERVICE WORKER
   ⚠️ Este era un bug real y silencioso: con cache-first sobre CUALQUIER GET, el
   SW se quedaba con la descarga del snapshot de Drive y la sincronización bajaba
   para siempre la MISMA copia vieja. Parecía funcionar y no recibía nada. */

log(/mismoOrigen/.test(sw) && /if \(!mismoOrigen\(req\)\) return/.test(sw),
    '[G1] el Service Worker solo cachea lo de su propio origen');

const g2 = await A.evaluate(() => {
  // se reproduce la decisión del SW con su misma función
  const mismoOrigen = u => { try { return new URL(u).origin === location.origin; } catch (e) { return false; } };
  return {
    propio: mismoOrigen(location.origin + '/icon-192.png'),
    drive: mismoOrigen('https://www.googleapis.com/drive/v3/files/abc?alt=media'),
    gis: mismoOrigen('https://accounts.google.com/gsi/client')
  };
});
log(g2.propio && !g2.drive && !g2.gis,
    '[G2] una descarga de Drive no entra a la caché; un icono propio sí', JSON.stringify(g2));

/* ══════════════════════════════════════════════════════════════════════════
   I · CAMBIAR LA CLAVE
   ⚠️ Con un Drive de mentira —un mapa de id → bytes dentro de la propia
   página—. Es lo único que permite probar la rotación ENTERA (bajar con la
   vieja, subir con la nueva, dejar fuera al equipo que se quedó atrás) sin
   atar la regresión a una cuenta de Google real, que la dejaría sin poder
   correr. Lo que se mide es el módulo de verdad: solo se sustituyen las seis
   funciones que hablan con la red. */

await A.evaluate(() => {
  window.__drive = { n: 0, files: [], subidas: 0, fallaDesde: 0 };
  syToken = () => Promise.resolve('token-de-mentira');
  syListar = async () => window.__drive.files.map(f => ({ id: f.id, createdTime: f.createdTime }));
  syCrear = async () => {
    const id = 'f' + (++window.__drive.n);
    window.__drive.files.push({ id, createdTime: new Date(Date.now() + window.__drive.n).toISOString(), bytes: null });
    return id;
  };
  syDescargar = async (id, key) => {
    const f = window.__drive.files.find(x => x.id === id);
    if (!f || !f.bytes || f.bytes.length < 18) return null;
    return await syDescifrar(new Uint8Array(f.bytes).buffer, key);
  };
  sySubirBytes = async (id, bytes) => {
    window.__drive.subidas++;
    if (window.__drive.fallaDesde && window.__drive.subidas >= window.__drive.fallaDesde)
      throw new Error('No se pudo subir a Drive.');
    const f = window.__drive.files.find(x => x.id === id);
    if (f) f.bytes = Array.from(bytes);
  };
  syBorrar = async (id) => { window.__drive.files = window.__drive.files.filter(x => x.id !== id); };
});

/* Sin vincular no hay clave que cambiar. */
const i1 = await A.evaluate(async () => {
  await syDesvincular();
  const r = await syRotarClave();
  return { ok: r.ok, motivo: r.motivo };
});
log(!i1.ok && /vinculado/i.test(i1.motivo), '[I1] sin vincular no se cambia la clave', i1.motivo);

/* Se activa, y OTRO equipo sube algo que este todavía no tiene. Es justo el
   dato que una rotación mal hecha dejaría ilegible para siempre. */
const i2 = await A.evaluate(async () => {
  await DB.saveCases([{ id: 'cLocal', tipo: 'URI', created: Date.now() }]);
  const r = await syActivarNuevo();
  const k1 = syEstado().k;
  const paq = ptPaquete([{ id: 'pRemota', priNom: 'REMOTA', numDoc: '777', tipoDoc: 'CC' }],
                        [{ id: 'cRemoto', tipo: 'URI', created: Date.now() }]);
  const bytes = await syCifrar(paq, await syClaveAES(syB32Dec(k1)));
  window.__drive.files[0].bytes = Array.from(bytes);
  return { ok: r.ok, k1, archivos: window.__drive.files.length, tieneRemoto: !!DB.getCase('cRemoto') };
});
log(i2.ok && i2.k1 && !i2.tieneRemoto,
    '[I2] equipo vinculado, y en Drive hay algo que este todavía no tiene', JSON.stringify({ archivos: i2.archivos }));

const i3 = await A.evaluate(async () => {
  const r = await syRotarClave();
  return {
    ok: r.ok, motivo: r.motivo, nueva: r.clave, local: syEstado().k,
    remoto: !!DB.getCase('cRemoto'), propio: !!DB.getCase('cLocal'),
    persona: !!DB.getPerson('pRemota'), archivos: window.__drive.files.length
  };
}, i2.k1);
log(i3.ok, '[I3] la clave se cambia', i3.motivo);
log(i3.nueva && i3.nueva !== i2.k1 && i3.local === i3.nueva,
    '[I4] la clave nueva es otra, y es la que queda guardada en el equipo');
log(i3.remoto && i3.persona,
    '[I5] lo que estaba en Drive y aquí no, se bajó ANTES de cambiar la clave — no se pierde nada');
log(i3.propio, '[I6] lo que ya tenía este equipo sigue estando');
log(i3.archivos === 1, '[I7] queda UN solo archivo: no sobra ninguno con la clave vieja', i3.archivos);

/* Lo que quedó en Drive abre con la nueva y NO con la vieja. Es toda la
   función: si la vieja siguiera sirviendo, no se habría revocado nada. */
const i8 = await A.evaluate(async (vieja) => {
  const bytes = new Uint8Array(window.__drive.files[0].bytes).buffer;
  const conNueva = await syDescifrar(bytes, await syClaveAES(syB32Dec(syEstado().k)));
  const conVieja = await syDescifrar(bytes, await syClaveAES(syB32Dec(vieja)));
  return { nueva: conNueva.ok, vieja: conVieja.ok, motivo: conVieja.motivo,
           casos: conNueva.ok ? (conNueva.o.casos || []).map(c => c.id).sort().join(',') : '' };
}, i2.k1);
log(i8.nueva, '[I8] lo que quedó en Drive abre con la clave nueva');
log(!i8.vieja, '[I9] y NO abre con la vieja: el código anterior dejó de servir');
log(i8.casos === 'cLocal,cRemoto', '[I10] y lleva dentro lo de los dos lados', i8.casos);

/* El equipo que se quedó con la clave vieja tiene que entender qué le pasa. */
log(/vuelve a vincular/i.test(i8.motivo) && i8.motivo.length <= 110,
    '[I11] al equipo que quedó atrás se le dice qué hacer, en un renglón', i8.motivo);

/* ⚠️ El orden de los dos últimos pasos: si la subida con la clave nueva falla,
   este equipo NO puede haberse quedado con una clave que no abre lo de Drive. */
const i12 = await A.evaluate(async () => {
  const antes = syEstado().k;
  window.__drive.subidas = 0; window.__drive.fallaDesde = 2;   // la 1.ª es la del sync previo
  const r = await syRotarClave();
  window.__drive.fallaDesde = 0;
  const bytes = new Uint8Array(window.__drive.files[0].bytes).buffer;
  const abre = await syDescifrar(bytes, await syClaveAES(syB32Dec(syEstado().k)));
  return { ok: r.ok, igual: syEstado().k === antes, abre: abre.ok };
});
log(!i12.ok, '[I12] si la subida falla, la rotación no dice que salió bien');
log(i12.igual && i12.abre,
    '[I13] y el equipo se queda con la clave vieja, que sigue abriendo lo de Drive');

/* El módulo tiene que bajar antes de subir: es lo que hace que no borre nada. */
const iSrc = (src.match(/async function syRotarClave\(\)[\s\S]*?\n\}/) || [''])[0];
log(iSrc.indexOf('sySincronizar') > 0 && iSrc.indexOf('sySincronizar') < iSrc.indexOf('sySubirBytes'),
    '[I14] la rotación sincroniza con la clave vieja ANTES de subir con la nueva');
log(iSrc.indexOf('sySubirBytes') < iSrc.indexOf('syGuardarEstado'),
    '[I15] y sube a Drive ANTES de guardar la clave nueva aquí');

/* La pantalla lo ofrece, y dice la consecuencia antes de hacerlo. */
const i16 = await A.evaluate(() => {
  SY_CLIENT_ID = 'x.apps.googleusercontent.com';
  go('sync'); renderSync();
  const t = (document.getElementById('sy-pane') || {}).innerText || '';
  return { texto: t, tieneBoton: !!document.querySelector('#sy-pane button[onclick="syUiRotar()"]') };
});
log(i16.tieneBoton, '[I16] la pantalla ofrece cambiar la clave');
log(/vuelvas? a vincular|vincules/i.test(i16.texto),
    '[I17] y avisa de que los demás equipos hay que volver a vincularlos');

const i18 = await A.evaluate(() => {
  const pane = document.getElementById('sy-pane');
  return Array.from(pane.querySelectorAll('.oj-hint')).map(p => (p.innerText || '').trim())
    .filter(t => t.length > 110);
});
log(i18.length === 0, '[I18] ningún aviso de la pantalla pasa de 110 caracteres', i18.join(' | '));

await A.evaluate(async () => { await syDesvincular(); });

/* ══════════════════════════════════════════════════════════════════════════
   H · EL MODO SIN SINCRONIZAR NO PAGA NADA
   ⚠️ Es la misma regla con la que se aceptó Modo compartir: quien no usa la
   función no puede notar que existe. */

log(!/function saveCase[\s\S]{0,400}sy[A-Z]/.test(src),
    '[H1] el guardado de una captura no tiene ni una rama del módulo');
log(!/DB\.saveCase\s*=/.test(src) && !/DB\.saveCases\s*=/.test(src),
    '[H2] nadie reemplaza el guardado por debajo');

const h3 = await A.evaluate(async () => {
  await syDesvincular();
  const antes = JSON.stringify(localStorage.getItem('lc_cases'));
  await DB.saveCase({ id: 'zz', tipo: 'URI', created: Date.now() });
  return { cambio: JSON.stringify(localStorage.getItem('lc_cases')) !== antes, sync: localStorage.getItem('lc_sync') };
});
log(h3.cambio && h3.sync === null, '[H3] sin vincular, guardar una captura no escribe nada del módulo');

/* El script de Google se carga solo cuando hace falta: en campo la aplicación
   tiene que arrancar sin red, y esta es su primera dependencia externa. */
const h4 = await A.evaluate(() => !document.querySelector('script[src*="accounts.google.com"]'));
log(h4, '[H4] el script de Google no se carga al abrir la aplicación');

log(errs.length === 0, '[H5] consola limpia', errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
const ok = R.filter(Boolean).length;
console.log('\n' + ok + '/' + R.length + (ok === R.length ? '  TODO OK' : '  ⚠️ HAY FALLOS'));
process.exit(ok === R.length ? 0 : 1);
