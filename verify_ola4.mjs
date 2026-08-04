/* Regresión de la OLA 4 — tres pantallas + revisión, agrupadas por FUENTE del
   dato en vez de por capítulo jurídico.
   Comprueba que la reestructuración no perdió nada: los mismos bloques, los
   mismos datos en el documento, y la recolección funcionando aunque una
   pantalla contenga varios bloques a la vez. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8144;
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '778899');
await page.fill('#pin-b', '778899');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.ojMinisterio = 'MIN'; cfg.ojInstitucion = 'INST'; cfg.ojUnidad = 'UNI'; cfg.ojDependencia = 'CANDELARIA';
  cfg.ojCustEstacion = 'La Candelaria'; cfg.ojCustDireccion = 'Calle 48 55-50';
  cfg.perfiles = [{ id: 'p1', grado: 'Subintendente', nombre: 'JUAN PEREZ', cargo: 'Patrullero' }];
  cfg.perfilActivo = 'p1';
  DB.saveConfig(cfg);
});

/* ─────────── 1. Cuatro pantallas, agrupadas por fuente ─────────── */
await page.evaluate(() => startWizard('OJ'));
await page.waitForTimeout(250);
const estructura = await page.evaluate(() => ({
  nombres: OJ_STEPS,
  puntos: document.querySelectorAll('#wz-prog .wd').length,
  paneles: ojWizConfig().panels.length
}));
log(estructura.puntos === 4 && estructura.paneles === 4, 'El wizard tiene 4 pantallas', estructura.puntos);
/* ⚠️ Mejora 2 (obs. 2) rebautizó y reordenó las pantallas: ya no se agrupan por
   «fuente del dato» sino por los numerales del formato, que es el orden en que
   el informe se lee. Los BLOQUES siguen siendo los mismos y se recomponen. */
log(estructura.nombres.join(' · ') === 'El capturado · El proceso judicial · La materialización · Revisión',
  'Nombradas como los numerales del formato, en su orden', estructura.nombres.join(' · '));

/* ⚠️ Mejora 3 (obs. 1): la pantalla 1 sigue siendo el numeral 1, pero se
   presenta como la tarjeta del capturado — sus campos viven en un modal, igual
   que en flagrancia. */
const pantallaA = await page.evaluate(() => ({
  requerido: !!document.querySelector('.oj-persona.vacia, .pcard'),
  sinOrden: !document.getElementById('oj-o-num')
}));
log(pantallaA.requerido && pantallaA.sinOrden,
  'Pantalla 1 es el numeral 1 del formato: la identificación del capturado');

const pantallaB = await page.evaluate(() => {
  ws = 1; renderWiz();
  return { orden: !!document.getElementById('oj-o-num'),
           despacho: !!document.getElementById('oj-d-nom'),
           proceso: !!document.getElementById('oj-p-rad') };
});
log(pantallaB.orden && pantallaB.despacho && pantallaB.proceso,
  'Pantalla 2 es el numeral 2 completo: orden, proceso y autoridad solicitante');

/* ⚠️ Mejora 3 (obs. 4): de «la actuación» solo queda el relato de los hechos —
   los derechos se derivan y lo demás se cuenta ahí mismo. */
const pantallaC = await page.evaluate(() => {
  ws = 2; renderWiz();
  return { diligencia: !!document.getElementById('oj-g-fec'), actuacion: !!document.getElementById('oj-a-obs') };
});
log(pantallaC.diligencia && pantallaC.actuacion,
  'Pantalla C reúne todo lo que acaba de pasar: materialización y relato');

/* ─────────── 2. La recolección ya no depende del número de paso ─────────── */
const recoleccion = await page.evaluate(() => {
  wc = ojNuevoCaso(); ws = 1; go('wizard'); renderWiz();   // numeral 2 del formato
  document.getElementById('oj-o-num').value = 'A-1';
  document.getElementById('oj-d-nom').value = 'DESPACHO A';
  document.getElementById('oj-p-rad').value = 'RAD-1';
  ojCollect();
  return { orden: wc.oj.orden.numero, despacho: wc.oj.despacho.nombre, proceso: wc.oj.proceso.radicado };
});
log(recoleccion.orden === 'A-1' && recoleccion.despacho === 'DESPACHO A' && recoleccion.proceso === 'RAD-1',
  'Una sola llamada recolecta los tres bloques de la pantalla', Object.values(recoleccion).join(' · '));

// ⚠️ Y no toca los bloques que no están en pantalla
const noPisa = await page.evaluate(() => {
  wc.oj.requerido.priNom = 'NO SE DEBE BORRAR';
  ws = 1; renderWiz(); ojCollect();
  return wc.oj.requerido.priNom;
});
log(noPisa === 'NO SE DEBE BORRAR',
  '⚠️ Y no borra los bloques que no están en pantalla', noPisa);

/* ─────────── 3. Lo plegado no se pierde al recolectar ─────────── */
const plegado = await page.evaluate(() => {
  wc = ojNuevoCaso();
  wc.oj.requerido.sexo = 'F'; wc.oj.requerido.alias = 'LA FLACA';
  wc.oj.actuacion.comunicacion = { nombre: 'MARIA', parentesco: 'MADRE', telefono: '300', hora: '10:00' };
  wc.oj.actuacion.valoracion = { realizada: 'SI', entidad: 'HOSPITAL', fecha: '', hora: '', renuencia: false };
  ws = 0; renderWiz(); ojCollect();       // pantalla del requerido, bloque plegado
  ws = 2; renderWiz(); ojCollect();       // pantalla del procedimiento, bloques plegados
  return {
    sexo: wc.oj.requerido.sexo, alias: wc.oj.requerido.alias,
    comunicacion: wc.oj.actuacion.comunicacion.nombre,
    valoracion: wc.oj.actuacion.valoracion.entidad
  };
});
log(plegado.sexo === 'F' && plegado.alias === 'LA FLACA',
  '⚠️ Recolectar con el bloque plegado NO borra lo que ya estaba (persona)', plegado.sexo + ' · ' + plegado.alias);
log(plegado.comunicacion === 'MARIA' && plegado.valoracion === 'HOSPITAL',
  '⚠️ Ni lo de comunicación y valoración', plegado.comunicacion + ' · ' + plegado.valoracion);

/* ─────────── 4. Las validaciones apuntan a la pantalla correcta ─────────── */
const validaciones = await page.evaluate(() => {
  const c = ojNuevoCaso();
  const v = ojValidar(c);
  const por = {};
  v.filter(x => x.nivel === 'DURA').forEach(x => { por[x.id] = x.paso; });
  return { por, pantallas: OJ_STEPS.length, max: Math.max(...v.map(x => x.paso)) };
});
log(validaciones.max <= 3, 'Ninguna validación apunta a una pantalla que ya no existe', 'máx ' + validaciones.max);
log(validaciones.por.V02 === 1 && validaciones.por.V05 === 1,
  'La orden y la autoridad solicitante apuntan al numeral 2', 'V02→' + validaciones.por.V02 + ' V05→' + validaciones.por.V05);
log(validaciones.por.V08 === 0, 'El capturado, al numeral 1', 'V08→' + validaciones.por.V08);
/* ⚠️ V16 (lectura de derechos) se retiró con Mejora 3, obs. 4: la constancia se
   deriva de la diligencia y el acta viaja como anexo marcado solo. */
log(validaciones.por.V14 === 2 && validaciones.por.V16 === undefined,
  'El lugar apunta al numeral 3, y los derechos ya no bloquean', 'V14→' + validaciones.por.V14);
log(validaciones.por.V22 === 3, 'El destinatario, a la revisión', 'V22→' + validaciones.por.V22);
// El membrete solo falta si el equipo no está configurado: se fuerza el caso.
const membrete = await page.evaluate(() => {
  const c = ojNuevoCaso();
  c.oj.encabezado = { ministerio: '', institucion: '', unidad: '', dependencia: '' };
  const por = {};
  ojValidar(c).forEach(x => { por[x.id] = x.paso; });
  return por;
});
log(membrete.V26 === 3 && membrete.V30 === 3 && membrete.V27 === 3,
  'Y el membrete también, cuando falta', 'V26→' + membrete.V26 + ' V30→' + membrete.V30);

/* ─────────── 5. Menos scroll ─────────── */
const scroll = await page.evaluate(() => {
  wc = ojNuevoCaso(); go('wizard');
  const out = [];
  for (let i = 0; i < 4; i++) {
    ws = i; renderWiz();
    out.push(document.getElementById('wz-panels').scrollHeight);
  }
  return out;
});
const util = 844 - 190;
const pantallas = scroll.reduce((a, h) => a + Math.max(1, Math.ceil(h / util)), 0);
log(pantallas <= 20, 'El procedimiento entero cabe en ' + pantallas + ' pantallas de scroll (eran 32)',
  scroll.map(h => Math.max(1, Math.ceil(h / util))).join(' · '));

/* ─────────── 6. El documento sigue saliendo idéntico ─────────── */
const doc = await page.evaluate(async () => {
  const c = ojNuevoCaso();
  const hoy = new Date().toISOString().slice(0, 10);
  c.oj.orden.numero = '002';
  c.oj.orden.fechaExpedicion = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  c.oj.orden.finalidad = 'CONDENA';
  c.oj.despacho.nombre = 'Juzgado Quinto de Ejecución de Penas';
  c.oj.despacho.tipo = 'JEPMS';
  c.oj.proceso.radicado = '05001600020620261234';
  c.oj.proceso.delitos = [{ nombre: 'Hurto agravado', articulo: '239 y 241' }];
  c.oj.requerido.priNom = 'CARLOS'; c.oj.requerido.priApe = 'GOMEZ';
  c.oj.requerido.numDoc = '71234567'; c.oj.requerido.fechaNac = '1985-03-20';
  c.oj.diligencia.fecha = hoy; c.oj.diligencia.hora = '07:11';
  c.oj.diligencia.lugarDireccion = 'Calle 53 con carrera 51';
  c.oj.diligencia.funcionarios = [{ grado: 'Subintendente', nombre: 'JUAN PEREZ' }];
  c.oj.actuacion.derechos = { leidos: true, fecha: hoy, hora: '07:20', lugar: 'el sitio', observacion: '' };
  ojAplicarSugerencia(c);
  const out = await buildOficioOJBlob(c, 'CARTA');
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return {
    duras: ojDuras(c).map(v => v.id),
    tablas: (xml.match(/<w:tbl>/g) || []).length,
    filas: (xml.match(/<w:tr>/g) || []).length,
    txt: xml.replace(/<[^>]+>/g, '')
  };
});
log(doc.duras.length === 0, 'Un caso completo no deja validaciones duras', doc.duras.join(',') || 'ninguna');
/* Mejora 2: 9 + 10 + 3 = 22. El numeral 3 del formato tiene TRES filas. */
log(doc.tablas === 3 && doc.filas === 22, 'El oficio conserva sus 3 tablas y las 22 filas del formato', doc.tablas + ' tablas / ' + doc.filas + ' filas');
log(['CARLOS GOMEZ', 'Hurto agravado', '05001600020620261234', 'Juzgado Quinto de Ejecución de Penas']
  .every(s => doc.txt.includes(s)), 'Y todos los datos llegan igual que antes de reagrupar');

/* ─────────── 7. Recorrido completo por la interfaz ─────────── */
await page.evaluate(() => { wc = null; DB.clearDraft(); startWizard('OJ'); });
await page.waitForTimeout(250);
const hoy = new Date().toISOString().slice(0, 10);
// Mejora 3 (obs. 1): el capturado se diligencia en su modal, como en flagrancia.
await page.click('button[onclick="ojAbrirRequerido()"]'); await page.waitForTimeout(200);
await page.fill('#oj-r-pn', 'ANA'); await page.fill('#oj-r-pa', 'RUIZ'); await page.fill('#oj-r-nd', '123456');
await page.click('button[onclick="ojGuardarRequerido()"]'); await page.waitForTimeout(250);
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(250);
await page.fill('#oj-o-num', '900');
await page.fill('#oj-o-fexp', new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10));
await page.selectOption('#oj-o-fin', 'IMPUTACION');
await page.fill('#oj-d-nom', 'Juzgado de Garantías de Prueba');
await page.fill('#oj-p-rad', '999');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(250);
await page.fill('#oj-g-fec', hoy); await page.fill('#oj-g-hor', '08:00');
await page.evaluate(() => lcDirModo('oj-g-dir', 'libre'));
await page.fill('#oj-g-dir__libre', 'Carrera 70 con calle 44');
await page.click('button[onclick="wizNext()"]'); await page.waitForTimeout(300);
// Mejora 3 (obs. 7): el destinatario se muestra resuelto y sus campos viajan
// plegados; el test los abre para escribirlo a mano.
await page.evaluate(() => document.querySelectorAll('#wz-panels details').forEach(d => d.open = true));
await page.fill('#oj-x-nom', 'Fiscalía URI de Prueba');
const recorrido = await page.evaluate(() => { ojCollect(); return { duras: ojDuras(wc).map(v => v.id), paso: ws }; });
log(recorrido.paso === 3, 'Tres toques de «Siguiente» llegan a la revisión (antes seis)', 'ws=' + recorrido.paso);
log(recorrido.duras.length === 0,
  'Y el caso queda completo con lo diligenciado en las tres pantallas', recorrido.duras.join(',') || 'sin faltas');

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones, todas en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
