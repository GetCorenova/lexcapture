/* Perfil en tres tarjetas (2026-10-24) — el compañero de patrulla sale del
   formulario del perfil a su propia tarjeta, con código QR para llenarlo de un
   escaneo, y el CAI de «Mi jurisdicción» siempre se imprime «CAI <nombre>».

   Dos teléfonos (dos contextos de navegador): A muestra su código de patrulla y
   B lo escanea — el código se DIBUJA y se LEE con el lector de la app, que es
   como viaja en la calle. */
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
await new Promise(r => server.listen(8163, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const sec = t => console.log('\n══ ' + t + ' ══');

const browser = await chromium.launch({ headless: true });
const errs = [];
async function telefono(nombre, cedula) {
  const ctx = await browser.newContext({
    viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  await page.goto('http://localhost:8163/LexCapture_v8.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window._lcListo === true);
  await page.waitForTimeout(600);
  await page.evaluate(([n, c]) => {
    const cfg = DB.getConfig();
    cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: n, cedula: c, telefono: '3001234567',
                      cargo: 'Integrante patrulla de vigilancia', correo: 'yo@prueba.test', entidad: '', companero: {} }];
    cfg.perfilActivo = 'p1';
    DB.saveConfig(cfg);
  }, [nombre, cedula]);
  return page;
}
const compDe = p => p.evaluate(() => JSON.parse(JSON.stringify(ccCompanero() || {})));
async function porElLector(page, bytes) {
  return page.evaluate(async b => {
    const svg = ptQrSvg(Uint8Array.from(b), 320);
    if (!svg) return null;
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
    const W = 400, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, W); x.drawImage(img, 40, 40, 320, 320);
    const r = ptQrLeer(x.getImageData(0, 0, W, W).data, W, W);
    return r ? Array.from(r) : null;
  }, bytes);
}
/* Escanear de verdad: se abre el lector de la app (sin cámara en la prueba) y se
   le entregan los bytes que leyó el lector, como haría el bucle de fotogramas. */
async function escanear(page, bytes) {
  return page.evaluate(async b => {
    navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
    lcCompEscanear();
    const cb = _ptScanCb;
    if (!cb) return { abierto: false };
    const ok = await cb(Uint8Array.from(b));
    if (ok === true) ptScanCerrar();
    return { abierto: true, cierra: ok === true };
  }, bytes);
}

try {
const A = await telefono('Nelson David Gómez Ñáñez', '1.035.302.775');
const B = await telefono('Luz Marina Marín', '43123456');

/* ═══ A · TRES TARJETAS ═══════════════════════════════════════════════════ */
sec('A · La pantalla de Perfil');
await A.evaluate(() => go('perfil'));
await A.waitForTimeout(300);
const est = await A.evaluate(() => {
  const pane = document.querySelector('#screen-perfil .pane');
  const ids = [...pane.children].map(e => e.id).filter(Boolean);
  const c = document.getElementById('perfil-comp');
  const r = c.getBoundingClientRect();
  return { ids, alto: r.height, txt: c.innerText,
           ops: c.querySelectorAll('.pt-op').length,
           abierto: document.getElementById('acc-body-pf-comp').style.display !== 'none' };
});
log(JSON.stringify(est.ids) === JSON.stringify(['perfil-list-wrap', 'perfil-comp', 'perfil-juris']),
  '[A1] Tres tarjetas en orden: perfil · compañero · jurisdicción', JSON.stringify(est.ids));
log(est.alto > 60, '[A2] La tarjeta del compañero SE VE (rectángulo con alto)', est.alto);
log(/compañero de patrulla/i.test(est.txt) && est.ops === 3,
  '[A3] Sin compañero ofrece escanear, mostrar mi código y escribir a mano', est.ops);
log(est.abierto, '[A4] Vacía nace abierta: lo que falta se ve');
await A.evaluate(() => openPerfilForm('p1'));
const form = await A.evaluate(() => ({
  comp: !!document.getElementById('pfm-cnombre') || !!document.getElementById('acc-body-pfm-comp'),
  mis: !!document.getElementById('pfm-nombre') }));
log(!form.comp && form.mis, '[A5] El formulario del perfil ya no pide al compañero');
await A.evaluate(() => closeModal());

/* ═══ B · A MANO ══════════════════════════════════════════════════════════ */
sec('B · Escribir a mano');
await A.evaluate(() => openCompaneroForm());
await A.fill('#pfm-cnombre', 'Juan Pablo Mejía');
await A.fill('#pfm-cgrado', 'Patrullero');
await A.fill('#pfm-ccedula', '1.098.765.432');
await A.fill('#pfm-ccargo', 'Patrullero de Cuadrante');
await A.fill('#pfm-ctel', '3115550000');
await A.fill('#pfm-ccorreo', 'juan@prueba.test');
await A.evaluate(() => saveCompaneroForm());
let co = await compDe(A);
log(co.nombre === 'Juan Pablo Mejía' && co.cedula === '1098765432' && co.correo === 'juan@prueba.test' && co.telefono === '3115550000',
  '[B1] Guarda los seis datos en el perfil activo (cédula sin puntos)', JSON.stringify(co));
const tarjeta = await A.evaluate(() => document.getElementById('perfil-comp').textContent);
log(/Juan Pablo Mejía/.test(tarjeta) && /Editar a mano/.test(tarjeta) && /Quitar compañero/.test(tarjeta),
  '[B2] La tarjeta enseña al compañero y ofrece editar y quitar');
await A.evaluate(() => { openCompaneroForm(); document.getElementById('pfm-cnombre').value = ''; saveCompaneroForm(); });
co = await compDe(A);
log(co.nombre === 'Juan Pablo Mejía', '[B3] Sin nombre no se guarda');
await A.evaluate(() => closeModal());

/* ═══ C · LA TRAMPA DE v() ════════════════════════════════════════════════ */
sec('C · Editar el perfil NO borra al compañero');
await A.evaluate(() => { openPerfilForm('p1'); document.getElementById('pfm-cargo').value = 'Comandante de cuadrante'; savePerfilForm('p1'); });
co = await compDe(A);
const yo = await A.evaluate(() => ccPerfilActivo().cargo);
log(yo === 'Comandante de cuadrante' && co.nombre === 'Juan Pablo Mejía' && co.cedula === '1098765432',
  '[C1] El perfil se edita y el compañero sigue entero', JSON.stringify(co));
await A.evaluate(() => {
  const cfg = DB.getConfig(); cfg.perfiles[0].companero.extra = 'conservar'; DB.saveConfig(cfg);
  openCompaneroForm(); saveCompaneroForm();
});
co = await compDe(A);
log(co.extra === 'conservar', '[C2] Guardar el compañero no borra claves que la tarjeta no pinta');
log(await A.evaluate(() => ccCompanero().nombre === 'Juan Pablo Mejía'),
  '[C3] La cadena de custodia y las actas lo siguen leyendo donde siempre (ccCompanero)');

/* ═══ D · EL CÓDIGO ═══════════════════════════════════════════════════════ */
sec('D · El código de patrulla');
const codA = await A.evaluate(() => Array.from(lcCompCodigo(ccPerfilActivo())));
const ida = await A.evaluate(b => lcCompLeer(Uint8Array.from(b)), codA);
log(ida && ida.nombre === 'Nelson David Gómez Ñáñez' && ida.cedula === '1035302775' && ida.cargo === 'Comandante de cuadrante',
  '[D1] El código lleva los seis datos, tildes y eñes incluidas', JSON.stringify(ida));
const ver = await A.evaluate(b => { const m = ptQrMatriz(Uint8Array.from(b)); return m ? (m.size - 17) / 4 : 0; }, codA);
log(ver > 0 && ver <= 10, '[D2] Cabe en un código legible (versión ≤ 10)', 'v' + ver + ' · ' + codA.length + ' B');
const largo = await A.evaluate(() => Array.from(lcCompCodigo({ nombre: 'X'.repeat(300), grado: 'Y'.repeat(300),
  cedula: '9'.repeat(300), cargo: 'Z'.repeat(300), telefono: '8'.repeat(300), correo: 'w'.repeat(300) })));
const verL = await A.evaluate(b => { const m = ptQrMatriz(Uint8Array.from(b)); return m ? (m.size - 17) / 4 : 0; }, largo);
log(verL > 0 && verL <= 13, '[D3] Con datos desmesurados el código sigue acotado', 'v' + verL + ' · ' + largo.length + ' B');
const leido = await porElLector(B, codA);
log(leido && JSON.stringify(leido) === JSON.stringify(codA), '[D4] Se dibuja y se vuelve a leer con el lector de la app');
await A.evaluate(() => lcCompMostrar());
const modal = await A.evaluate(() => ({ svg: !!document.querySelector('#modal-c .pt-qr svg'), txt: document.getElementById('modal-c').innerText }));
log(modal.svg && /Funciona sin señal/.test(modal.txt), '[D5] «Mostrar mi código» enseña el código y dice que va sin señal');
await A.evaluate(() => closeModal());

sec('E · B escanea a A');
await B.evaluate(() => go('perfil'));
const r1 = await escanear(B, leido);
const coB = await compDe(B);
log(r1.abierto && r1.cierra, '[E1] El lector se abre y se cierra al leer');
log(coB.nombre === 'Nelson David Gómez Ñáñez' && coB.grado === 'Subintendente' && coB.cedula === '1035302775'
    && coB.telefono === '3001234567' && coB.correo === 'yo@prueba.test' && coB.cargo === 'Comandante de cuadrante',
  '[E2] Un escaneo deja los seis datos llenos en el teléfono del compañero', JSON.stringify(coB));
log(/Nelson David Gómez Ñáñez/.test(await B.evaluate(() => document.getElementById('perfil-comp').textContent)),
  '[E3] La tarjeta se repinta con el compañero');
const propio = await B.evaluate(() => Array.from(lcCompCodigo(ccPerfilActivo())));
const r2 = await escanear(B, propio);
log(r2.cierra && (await compDe(B)).nombre === 'Nelson David Gómez Ñáñez', '[E4] El propio código no se registra como compañero');
const flg = [70, 76, 71, 49, 8, ...Buffer.from('uidprueb'), 4, ...new Array(64).fill(7), ...new Array(16).fill(1), 2, 65, 66];
log(await B.evaluate(b => !!bzLeerCodigo(Uint8Array.from(b)), flg), '    (el falso código de Modo compartir es válido para su lector)');
const r3 = await escanear(B, flg);
log(r3.cierra && (await compDe(B)).nombre === 'Nelson David Gómez Ñáñez', '[E5] El código de Modo compartir no se toma por uno de patrulla');
const r4 = await escanear(B, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
log(r4.cierra && (await compDe(B)).nombre === 'Nelson David Gómez Ñáñez', '[E6] Un código ajeno no toca nada');

sec('F · Quitar y varios perfiles');
await B.evaluate(() => { window.confirm = () => true; lcCompQuitar(); });
log(!(await B.evaluate(() => lcCompTiene(ccCompanero()))), '[F1] Quitar deja el perfil sin compañero');
await A.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles.push({ id: 'p2', grado: 'Intendente', nombre: 'Otro Perfil', cedula: '1', companero: { nombre: 'Compa del dos' } });
  cfg.perfilActivo = 'p2'; DB.saveConfig(cfg); renderPerfilScreen();
});
const multi = await A.evaluate(() => document.getElementById('perfil-comp').textContent);
log(/Compa del dos/.test(multi) && /Compañero de Otro Perfil/.test(multi) && !/Juan Pablo/.test(multi),
  '[F2] Con varios perfiles enseña el compañero del perfil activo y dice de cuál');
await A.evaluate(() => { const cfg = DB.getConfig(); cfg.perfilActivo = 'p1'; DB.saveConfig(cfg); renderPerfilScreen(); });

/* ═══ G · EL CAI ══════════════════════════════════════════════════════════ */
sec('G · El CAI se imprime «CAI <nombre>»');
const tabla = await A.evaluate(() => [
  ['San Antonio', 'CAI San Antonio'], ['CAI San Antonio', 'CAI San Antonio'], ['cai  san antonio', 'CAI san antonio'],
  ['C.A.I. Prado', 'CAI Prado'], ['Estación Candelaria', 'Estación Candelaria'], ['Cuadrante 5', 'Cuadrante 5'],
  ['Caicedonia', 'CAI Caicedonia'], ['', '']
].map(([e, s]) => [e, lcCaiLabel(e), s]));
const malos = tabla.filter(x => x[1] !== x[2]);
log(!malos.length, '[G1] lcCaiLabel: antepone CAI, normaliza «cai»/«C.A.I.» y respeta otra unidad', JSON.stringify(malos));
await A.evaluate(() => { const b = document.getElementById('acc-body-pf-juris'); if (b.style.display === 'none') lcAccToggle('pf-juris'); });
await A.fill('#pj-patrulla', '32');
await A.fill('#pj-cai', 'San Antonio');
await A.evaluate(() => document.getElementById('pj-cai').blur());
log(await A.inputValue('#pj-cai') === 'CAI San Antonio', '[G2] Al salir del campo se ve «CAI San Antonio»');
await A.evaluate(() => { document.getElementById('pj-cai').value = 'Belén'; lcJurisGuardar(); });
const cfgA = await A.evaluate(() => ({ u: DB.getConfig().patrullaUnidad, pl: patrullaLabel() }));
log(cfgA.u === 'CAI Belén' && cfgA.pl === 'PATRULLA 32 CAI Belén', '[G3] Se guarda e imprime con CAI', JSON.stringify(cfgA));
await A.evaluate(() => { const c = DB.getConfig(); c.patrullaUnidad = 'San Antonio'; DB.saveConfig(c); });
log(await A.evaluate(() => patrullaLabel()) === 'PATRULLA 32 CAI San Antonio',
  '[G4] Lo guardado antes sin «CAI» también sale con CAI');
log(await A.evaluate(() => dosPatrullaFmt('PATRULLA 32 San Antonio')) === 'CAI San Antonio, Patrulla 32',
  '[G5] El dossier de una captura vieja también lo dice «CAI»');
const dil = await A.evaluate(() => ojNuevoCaso().oj.diligencia.unidad);
log(dil === 'PATRULLA 32 CAI San Antonio', '[G6] El oficio de orden judicial ya no repite el CAI dos veces', dil);
log(await A.evaluate(() => SIM.gUnidad(DB.getConfig())) === 'PATRULLA 32 CAI San Antonio',
  '[G7] El simulador tampoco lo repite');

sec('H · Se ve');
await A.evaluate(() => { go('perfil'); window.scrollTo(0, 0); });
await A.waitForTimeout(300);
await A.screenshot({ path: join(ROOT, 'verify_companero_patrulla_claro.png'), fullPage: true });
await A.evaluate(() => setTheme('dark'));
await A.waitForTimeout(300);
await A.screenshot({ path: join(ROOT, 'verify_companero_patrulla_oscuro.png'), fullPage: true });
await B.evaluate(() => { go('perfil'); lcCompMostrar(); });
await B.waitForTimeout(300);
await B.screenshot({ path: join(ROOT, 'verify_companero_patrulla_codigo.png') });
log(!errs.length, '[H1] Consola limpia', errs.join(' | '));
} catch (e) {
  console.error(e); R.push(false);
} finally {
  await browser.close(); server.close();
}
const ok = R.filter(Boolean).length;
console.log(`\n${ok}/${R.length} comprobaciones`);
process.exit(ok === R.length ? 0 : 1);
