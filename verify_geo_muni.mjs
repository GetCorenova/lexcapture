/* Regresión de «Municipio ⇒ departamento: el error de Bogotá ⇒ Amazonas»
   (2026-10-27). Reportado en campo: en la autoridad solicitante del formulario
   de orden judicial, «Bogotá» quedó con «Amazonas» debajo. Se mide en TODOS los
   pares municipio/departamento de la app:
     A · El motor: nombres de uso común, catálogo por delante de lo aprendido
     B · Lo aprendido equivocado no se usa ni se vuelve a guardar
     C · El caso del pantallazo, en el formulario de orden judicial
     D · Homónimos: se ofrecen sus departamentos, en cada formulario
     E · Flagrancia, personas y despachos se comportan igual
     F · Lo que no se pisa: persona extranjera, departamento escrito a mano
     G · Se ve bien, en los dos temas */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8171;
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
  console.log((ok ? 'OK  ' : 'FALLO'), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}
const sec = t => console.log('\n── ' + t + ' ──');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window._lcListo === true);
await page.waitForTimeout(300);

const val = id => page.inputValue('#' + id);
const ops = sel => page.$$eval(sel + ' .lc-geo-op', e => e.map(x => x.textContent.trim()));
const nuevoOJ = async (paso) => {
  await page.evaluate(async () => { wc = null; await DB.clearDraft(); closeModal(); startWizard('OJ'); });
  await page.waitForTimeout(250);
  await page.evaluate(p => wizGoto(p), paso); await page.waitForTimeout(350);
};
const escribe = async (id, txt) => {
  await page.fill('#' + id, '');
  await page.click('#' + id); await page.keyboard.type(txt); await page.waitForTimeout(120);
};

/* ═════════════════════════════════════════════════════════════════════════ */
sec('A · EL MOTOR');
const m = await page.evaluate(() => ({
  bogota: lcGeoDepto('Bogotá'), sinTilde: lcGeoDepto('bogota'), dc: lcGeoDepto('Bogotá, D.C.'),
  dc2: lcGeoDepto('Bogotá D.C.'), santafe: lcGeoDepto('Santa Fe de Bogotá'),
  cartagena: lcGeoDepto('Cartagena de Indias'), cucuta: lcGeoDepto('San José de Cúcuta'),
  cali: lcGeoDepto('Santiago de Cali'), medellin: lcGeoDepto('Medellín'),
  barbosa: lcGeoDepto('Barbosa'), barbosaDs: lcGeoDeptos('Barbosa'), inventado: lcGeoDepto('Municipio Inventado'),
  compDC: lcGeoCompatible('Bogotá', 'Bogotá D.C.'), compCun: lcGeoCompatible('Bogotá', 'Cundinamarca'),
  compAma: lcGeoCompatible('Bogotá', 'Amazonas'), compValle: lcGeoCompatible('Cali', 'Valle'),
  compNoSe: lcGeoCompatible('Vereda La Cristalina', 'Antioquia'),
  deptos: lcGeoDeptoLista().length
}));
log(m.bogota === 'Cundinamarca', '«Bogotá» ⇒ Cundinamarca (decisión del usuario)', m.bogota);
log(m.sinTilde === 'Cundinamarca' && m.dc === 'Cundinamarca' && m.dc2 === 'Cundinamarca' && m.santafe === 'Cundinamarca',
  'Sin tilde, «Bogotá, D.C.», «Bogotá D.C.» y «Santa Fe de Bogotá» también', [m.sinTilde, m.dc, m.dc2, m.santafe].join(' · '));
log(m.cartagena === 'Bolívar' && m.cucuta === 'Norte de Santander' && m.cali === 'Valle del Cauca',
  'Los nombres de uso común de otras capitales', [m.cartagena, m.cucuta, m.cali].join(' · '));
log(m.medellin === 'Antioquia', 'Lo que ya funcionaba sigue igual (Medellín ⇒ Antioquia)');
log(m.barbosa === '' && m.barbosaDs.length === 2, 'Un homónimo no se adivina, pero se conocen sus departamentos', m.barbosaDs.join(' / '));
log(m.inventado === '', 'Un municipio que no está en el catálogo no inventa departamento');
log(m.compDC === true && m.compCun === true && m.compAma === false,
  '«Bogotá D.C.» como departamento se sigue aceptando; Amazonas no corresponde');
log(m.compValle === true, 'La forma corta «Valle» no se toma por un conflicto');
log(m.compNoSe === null, 'Fuera del catálogo la app no opina');
log(m.deptos === 33, 'La lista de departamentos no cambió (33)', m.deptos);

/* ═════════════════════════════════════════════════════════════════════════ */
sec('B · LO APRENDIDO EQUIVOCADO');
const b = await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.geoPropios = { 'bogota': 'Amazonas', 'medellin': 'Huila', 'barbosa': 'Tolima', 'vereda la cristalina': 'Antioquia' };
  DB.saveConfig(cfg);
  const r = { bogota: lcGeoDepto('Bogotá'), medellin: lcGeoDepto('Medellín'), barbosa: lcGeoDepto('Barbosa'),
    vereda: lcGeoDepto('Vereda La Cristalina') };
  lcGeoRecordar('Bogotá', 'Amazonas');
  lcGeoRecordar('Barbosa', 'Santander');
  lcGeoRecordar('Corregimiento El Llano', 'Antioquia');
  const g = DB.getConfig().geoPropios || {};
  r.guardado = g;
  r.barbosa2 = lcGeoDepto('Barbosa');
  return r;
});
log(b.bogota === 'Cundinamarca', '⚠️ Un «Bogotá ⇒ Amazonas» guardado por el error de antes ya no se usa', b.bogota);
log(b.medellin === 'Antioquia', 'Lo aprendido nunca le gana al catálogo');
log(b.barbosa === '', 'Un homónimo «aprendido» en un departamento donde no existe no se usa');
log(b.vereda === 'Antioquia', 'Lo que el catálogo no conoce sí se sigue aprendiendo');
log(!Object.values(b.guardado).includes('Amazonas') && !b.guardado['medellin'],
  '⚠️ Y al volver a guardar, lo equivocado se limpia y no se escribe otra vez', JSON.stringify(b.guardado));
log(b.barbosa2 === 'Santander' && b.guardado['corregimiento el llano'] === 'Antioquia',
  'Elegir un homónimo y un lugar fuera del catálogo se aprende');
await page.evaluate(() => { const c = DB.getConfig(); c.geoPropios = {}; DB.saveConfig(c); });

/* ═════════════════════════════════════════════════════════════════════════ */
sec('C · EL CASO DEL PANTALLAZO (orden judicial → autoridad solicitante)');
await nuevoOJ(1);
await escribe('oj-d-mun', 'Leticia');
log(await val('oj-d-dep') === 'Amazonas', 'Leticia ⇒ Amazonas');
// Se repinta el paso: antes, la marca «lo puso la app» se perdía aquí.
await page.evaluate(() => { wizGoto(0); }); await page.waitForTimeout(300);
await page.evaluate(() => { wizGoto(1); }); await page.waitForTimeout(350);
await escribe('oj-d-mun', 'Bogotá');
log(await val('oj-d-dep') === 'Cundinamarca', '⚠️ Cambiar a «Bogotá» deja Cundinamarca, no el Amazonas anterior', await val('oj-d-dep'));
await page.click('#oj-d-nom'); await page.waitForTimeout(150);
log(await val('oj-d-mun') === 'Bogotá', 'El municipio se respeta tal como se escribió');
// Un caso guardado con el par equivocado: se ve y se corrige en un toque.
await page.evaluate(() => wizGoto(0)); await page.waitForTimeout(300);
// Se siembra FUERA del paso: al salir, el paso recolecta lo que hay en pantalla.
await page.evaluate(() => { wc.oj.despacho.municipio = 'Bogotá'; wc.oj.despacho.departamento = 'Amazonas'; });
await page.waitForTimeout(300);
await page.evaluate(() => wizGoto(1)); await page.waitForTimeout(400);
const avisoC = await page.textContent('#oj-d-mun-geo').catch(() => '');
log(/no está en «Amazonas»/.test(avisoC), 'Un par guardado equivocado se avisa al abrir el formulario', avisoC.trim().slice(0, 60));
log((await ops('#oj-d-mun-geo')).join() === 'Cundinamarca', 'Con su corrección en un toque');
await page.locator('#oj-d-mun-geo .lc-geo-op').first().click(); await page.waitForTimeout(200);
log(await val('oj-d-dep') === 'Cundinamarca' && (await ops('#oj-d-mun-geo')).length === 0,
  'Tocarla corrige el departamento y el aviso desaparece');
const rec = await page.evaluate(() => { ojCollect(); return wc.oj.despacho.departamento; });
log(rec === 'Cundinamarca', 'Y es lo que llega al caso', rec);

/* ═════════════════════════════════════════════════════════════════════════ */
sec('D · HOMÓNIMOS EN CADA FORMULARIO');
await escribe('oj-d-mun', 'Barbosa');
log(await val('oj-d-dep') === '', 'Barbosa: el departamento del municipio anterior se retira, no se adivina');
const opsD = await ops('#oj-d-mun-geo');
log(opsD.length === 2 && opsD.includes('Antioquia') && opsD.includes('Santander'),
  'Se ofrecen sus dos departamentos', opsD.join(' / '));
await page.locator('#oj-d-mun-geo .lc-geo-op', { hasText: 'Santander' }).click(); await page.waitForTimeout(200);
log(await val('oj-d-dep') === 'Santander' && (await ops('#oj-d-mun-geo')).length === 0, 'Elegir uno lo escribe y quita el aviso');
log(await page.evaluate(() => lcGeoDepto('Barbosa')) === 'Santander', 'Y se aprende');
await page.evaluate(() => { const c = DB.getConfig(); c.geoPropios = {}; DB.saveConfig(c); });
// Lugar de la captura (paso 3 de orden judicial).
await page.evaluate(() => wizGoto(2)); await page.waitForTimeout(350);
await escribe('oj-g-mun', 'La Unión');
log((await ops('#oj-g-mun-geo')).length === 4, 'La Unión (cuatro departamentos) también en el lugar de la captura', (await ops('#oj-g-mun-geo')).join(' / '));

/* ═════════════════════════════════════════════════════════════════════════ */
sec('E · FLAGRANCIA, PERSONAS Y DESPACHOS');
await page.evaluate(async () => { wc = null; await DB.clearDraft(); closeModal(); startWizard('URI'); });
await page.waitForTimeout(350);
await escribe('w-muni', 'Pitalito');
log(await val('w-depto') === 'Huila', 'Flagrancia: Pitalito ⇒ Huila');
await page.evaluate(() => { wizGoto(1); }); await page.waitForTimeout(300);
await page.evaluate(() => { wizGoto(0); }); await page.waitForTimeout(300);
await escribe('w-muni', 'Bogotá');
log(await val('w-depto') === 'Cundinamarca', 'Flagrancia, tras repintar: Bogotá ⇒ Cundinamarca', await val('w-depto'));
// El formulario de orden judicial aprende cada par al recolectar (ojAprenderGeo): se limpia.
await page.evaluate(() => { const c = DB.getConfig(); c.geoPropios = {}; DB.saveConfig(c); });
await escribe('w-muni', 'Barbosa');
log(await val('w-depto') === '' && (await ops('#w-geo-hom')).length === 2, 'Flagrancia: Barbosa pregunta entre sus dos');
await page.locator('#w-geo-hom .lc-geo-op', { hasText: 'Antioquia' }).click(); await page.waitForTimeout(200);
log(await val('w-depto') === 'Antioquia', 'Y elegir lo escribe');
await page.evaluate(() => { const c = DB.getConfig(); c.geoPropios = {}; DB.saveConfig(c); });
// Persona: lugar de nacimiento.
await page.evaluate(() => { const c = DB.getConfig(); c.geoPropios = {}; DB.saveConfig(c); });
await page.evaluate(() => openPersonModal('capturados', -1, {}, true)); await page.waitForTimeout(250);
await escribe('pm-nacMuni', 'Leticia');
log(await val('pm-nacDepto') === 'Amazonas' && await val('pm-nacPais') === 'Colombia', 'Persona: Leticia ⇒ Amazonas, Colombia');
await escribe('pm-nacMuni', 'Bogotá');
log(await val('pm-nacDepto') === 'Cundinamarca', 'Persona: cambiar a Bogotá corrige el departamento', await val('pm-nacDepto'));
await escribe('pm-nacMuni', 'Caldas');
log(await val('pm-nacDepto') === '' && (await ops('#pm-nacMuni-geo')).length === 2, 'Persona: Caldas (Antioquia y Boyacá) pregunta');
await page.evaluate(() => closeModal()); await page.waitForTimeout(150);
// Despacho.
await page.evaluate(() => lcDespForm()); await page.waitForTimeout(250);
await escribe('dp-mun', 'Leticia');
log(await val('dp-dep') === 'Amazonas', 'Despacho: Leticia ⇒ Amazonas');
await escribe('dp-mun', 'Bogotá');
log(await val('dp-dep') === 'Cundinamarca', 'Despacho: Bogotá ⇒ Cundinamarca');
await escribe('dp-mun', 'Barbosa');
log((await ops('#dp-mun-geo')).length === 2, 'Despacho: Barbosa pregunta');
await page.evaluate(() => closeModal()); await page.waitForTimeout(150);
// Un despacho registrado como «Bogotá» es de la misma jurisdicción que «Bogotá D.C.».
const jur = await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{ id: 'gb1', clase: 'FISCALIA', nombre: 'URI Bogotá Paloquemao', municipio: 'Bogotá' }];
  DB.saveConfig(cfg);
  const r = lcDespJurisdiccion('URI', { muni: 'Bogotá D.C.' }, DB.getConfig());
  cfg.despachosPropios = []; DB.saveConfig(cfg);
  return r.mismos.map(d => d.id).join();
});
log(jur === 'gb1', 'Un despacho de «Bogotá» se ofrece para una captura en «Bogotá D.C.»', jur);
log(await page.evaluate(() => lcJurisdiccionTexto({ muni: 'Bogotá', depto: 'Bogotá D.C.' })) === 'Bogotá',
  'Donde el municipio ES el departamento se nombra una sola vez');

/* ═════════════════════════════════════════════════════════════════════════ */
sec('F · LO QUE NO SE PISA');
await page.evaluate(() => openPersonModal('capturados', -1, {}, true)); await page.waitForTimeout(250);
await page.fill('#pm-nacPais', 'Venezuela'); await page.fill('#pm-nacDepto', 'Táchira');
await escribe('pm-nacMuni', 'San Cristóbal');
log(await val('pm-nacDepto') === 'Táchira' && await val('pm-nacPais') === 'Venezuela',
  '⚠️ Persona extranjera: «San Cristóbal» de Táchira no se vuelve el de Bolívar');
log((await ops('#pm-nacMuni-geo')).length === 0, 'Ni se le avisa de un conflicto que no existe');
await page.evaluate(() => closeModal()); await page.waitForTimeout(150);
await nuevoOJ(1);
await escribe('oj-d-mun', 'Girardota');
await page.fill('#oj-d-dep', 'Cundinamarca'); await page.click('#oj-d-nom'); await page.waitForTimeout(200);
log(await val('oj-d-dep') === 'Cundinamarca', 'Un departamento escrito a mano DESPUÉS del municipio no se pisa');
log(/no está en «Cundinamarca»/.test(await page.textContent('#oj-d-mun-geo')),
  '⚠️ Pero el conflicto se ve, con su corrección', (await ops('#oj-d-mun-geo')).join());
await page.fill('#oj-d-dep', 'Antioquia'); await page.waitForTimeout(150);
log((await ops('#oj-d-mun-geo')).length === 0, 'Escribirlo bien quita el aviso');

/* ═════════════════════════════════════════════════════════════════════════ */
sec('G · SE VE BIEN');
await page.fill('#oj-d-dep', 'Amazonas'); await page.waitForTimeout(150);
for (const tema of ['light', 'dark']) {
  await page.evaluate(t => setTheme(t), tema); await page.waitForTimeout(200);
  await page.locator('#oj-d-mun').scrollIntoViewIfNeeded();
  const r = await page.evaluate(() => { const b = document.querySelector('#oj-d-mun-geo .lc-geo-hom'); const x = b && b.getBoundingClientRect(); return x ? { w: x.width, h: x.height, l: x.left } : null; });
  log(!!r && r.h > 20 && r.l >= 0 && r.l + r.w <= 384, 'El aviso se dibuja dentro de la pantalla en tema ' + tema, JSON.stringify(r));
  await page.screenshot({ path: join(ROOT, `verify_geo_muni_${tema}.png`) });
}
log(errs.length === 0, 'Consola limpia', errs.join(' | ').slice(0, 200));

await browser.close(); server.close();
console.log(`\n${n - fails}/${n} OK`);
process.exit(fails ? 1 : 0);
