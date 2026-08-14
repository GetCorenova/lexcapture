/* Regresión del ORDEN DE LAS LISTAS (Capturas y Personas).
   El usuario pidió poder elegir, en las dos pantallas, cómo quiere ver la
   información: alfabéticamente (A–Z / Z–A) o por fecha de registro. Lo que hay
   que comprobar de punta a punta:
   1. Que el control exista en las DOS pantallas, diga cómo está ordenada la
      lista ahora mismo y ofrezca las cuatro formas de verla.
   2. Que A–Z alfabetice en español (Á con la A, Ñ después de la N) y que Z–A sea
      su reverso EXACTO.
   3. Que la elección se recuerde entre sesiones y que las dos pantallas sean
      independientes.
   4. Que ordenar sea SOLO ordenar: ni el formulario, ni el modelo, ni el
      almacén cambian por mirar la lista de otra manera.
   5. Que en modo invitado la preferencia no escriba un byte en el equipo. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const SHOTS = 'C:/Users/123/AppData/Local/Temp/claude/d--UsurarioDocumentos-Escritorio-Proyectos-2026-APP-Capturas-Crear-App/032208dd-f406-4dd0-968e-63870fb3a345/scratchpad';
const PORT = 8151;
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
const log = (ok, label, extra) => {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

const nombresCap = () => page.$$eval('#cl .cc-name', els => els.map(e => e.childNodes[0].textContent.trim()));
const nombresPer = () => page.$$eval('#pl .prow-name', els => els.map(e => e.textContent.trim()));
const btnCap = () => page.$eval('#ord-capturas', b => ({ txt: b.textContent.trim(), oculto: b.hidden, title: b.title }));
const btnPer = () => page.$eval('#ord-personas', b => ({ txt: b.textContent.trim(), oculto: b.hidden || b.parentNode.hidden, title: b.title }));
// El orden del selector es el de LC_ORD_OPC: recientes · antiguas · A–Z · Z–A.
const ORD_IDX = { rec: 1, ant: 2, az: 3, za: 4 };
async function elegirOrden(lista, id) {
  await page.click('#ord-' + lista);
  await page.waitForTimeout(400);
  await page.click(`#act-items .sheet-item:nth-child(${ORD_IDX[id]})`);
  await page.waitForTimeout(500);
}

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

/* ═══ Parte A · El control aparece solo cuando hay algo que ordenar ═══ */
log(await page.isVisible('#pin-a'), 'Arranca pidiendo crear el PIN');
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(600);

await page.evaluate(() => go('capturas'));
await page.waitForTimeout(300);
log((await btnCap()).oculto === true, 'Sin capturas, el control de orden está oculto');
await page.evaluate(() => go('personas'));
await page.waitForTimeout(300);
log((await btnPer()).oculto === true, 'Sin personas, el control de orden está oculto');

/* ═══ Parte B · CAPTURAS ═══
   Los nombres ejercitan la ordenación en español: «Álvaro» tiene que ir con la
   A (no al final, que es donde lo manda una comparación de códigos) y «Ñoño»
   entre la N y la O. Se siembran en un orden que no es ninguno de los cuatro. */
const H = 3600000;
await page.evaluate(async (H) => {
  const t = Date.now();
  const mk = (id, nom, tipo, horas) => ({
    id, tipo, created: t - horas * H, fechaProc: '2026-08-01',
    conductas: ['Hurto'], capturados: [{ priNom: nom, priApe: 'Pérez' }]
  });
  await DB.saveCases([
    mk('c1', 'Zulema', 'URI', 30),
    mk('c2', 'Álvaro', 'CESPA', 20),
    mk('c3', 'Ñoño', 'OJ', 10),
    mk('c4', 'Beatriz', 'URI', 2)
  ]);
  go('capturas');
}, H);
await page.waitForTimeout(500);

const b1 = await btnCap();
log(b1.oculto === false && /Recientes/.test(b1.txt),
  'Capturas: el control aparece y dice cómo está ordenada la lista', JSON.stringify(b1.txt));
log(/toca para cambiarlo/.test(b1.title), 'Y anuncia que abre un selector', b1.title);
const cap1 = await nombresCap();
log(JSON.stringify(cap1) === JSON.stringify(['Beatriz Pérez', 'Ñoño Pérez', 'Álvaro Pérez', 'Zulema Pérez']),
  'Por defecto sigue como siempre: la captura más reciente arriba', JSON.stringify(cap1));
await page.screenshot({ path: join(SHOTS, 'orden_01_capturas_rec.png') });

// El selector: cuatro formas de ver la lista, con la actual marcada.
await page.click('#ord-capturas');
await page.waitForTimeout(450);
const opciones = await page.$$eval('#act-items .sheet-item .ti', els => els.map(e => e.textContent.trim()));
log(JSON.stringify(opciones) === JSON.stringify(['Más recientes primero', 'Más antiguas primero', 'A – Z', 'Z – A']),
  'El selector ofrece las cuatro formas de ver la lista', JSON.stringify(opciones));
const marcada = await page.$$eval('#act-items .sheet-item', els => els.map(e => e.querySelector('.de').textContent.trim()).filter(t => /orden actual/.test(t)).length);
log(marcada === 1, 'Y marca exactamente la que está puesta', marcada);
await page.screenshot({ path: join(SHOTS, 'orden_02_selector.png') });
await page.click('#act-items .sheet-item:nth-child(3)');   // A – Z
await page.waitForTimeout(500);

const capAZ = await nombresCap();
log(JSON.stringify(capAZ) === JSON.stringify(['Álvaro Pérez', 'Beatriz Pérez', 'Ñoño Pérez', 'Zulema Pérez']),
  'A – Z alfabetiza en español: Á con la A y Ñ entre la N y la O', JSON.stringify(capAZ));
log(/A – Z/.test((await btnCap()).txt), 'Y el botón lo dice');
await page.screenshot({ path: join(SHOTS, 'orden_03_capturas_az.png') });

await elegirOrden('capturas', 'za');
const capZA = await nombresCap();
log(JSON.stringify(capZA) === JSON.stringify(capAZ.slice().reverse()),
  'Z – A es el reverso exacto de A – Z', JSON.stringify(capZA));

await elegirOrden('capturas', 'ant');
const capAnt = await nombresCap();
log(JSON.stringify(capAnt) === JSON.stringify(['Zulema Pérez', 'Álvaro Pérez', 'Ñoño Pérez', 'Beatriz Pérez']),
  'Y «más antiguas primero» es el reverso de la fecha, no del alfabeto', JSON.stringify(capAnt));

const cacheOrden = await page.evaluate(() => DB.getCases().map(c => c.id).join(','));
log(cacheOrden === 'c1,c2,c3,c4', 'Ordenar la vista NO reordena el almacén de capturas', cacheOrden);

// El botón de orden NO es un chip de filtro: filterCasos() apaga todos los .fc
// de la pantalla y le habría borrado el estado.
await page.click('.flt .fc:nth-child(2)');
await page.waitForTimeout(400);
const b3 = await btnCap();
const capFlag = await nombresCap();
log(b3.oculto === false && /Antiguas/.test(b3.txt),
  'Filtrar por Flagrancia no apaga ni descoloca el control de orden', b3.txt);
// Flagrancia = URI + CESPA (queda fuera la de orden judicial), y en el orden
// elegido: de la más antigua a la más reciente.
log(JSON.stringify(capFlag) === JSON.stringify(['Zulema Pérez', 'Álvaro Pérez', 'Beatriz Pérez']),
  'Y el filtro respeta el orden elegido', JSON.stringify(capFlag));
log(await page.$eval('#ord-capturas', b => !b.classList.contains('fc')), 'El control no lleva la clase .fc');
await page.click('.flt .fc:nth-child(1)');
await page.waitForTimeout(300);

/* ═══ Parte C · PERSONAS ═══ */
await page.evaluate(async () => {
  await DB.savePersons([
    { id: 'p1', priNom: 'Zulema', priApe: 'Ruiz', tipoDoc: 'CC', numDoc: '111', rol: 'Capturado' },
    { id: 'p2', priNom: 'Álvaro', priApe: 'Ruiz', tipoDoc: 'CC', numDoc: '222', rol: 'Víctima' },
    { id: 'p3', priNom: 'Ñoño', priApe: 'Ruiz', tipoDoc: 'CC', numDoc: '333', rol: 'Testigo' },
    { id: 'p4', priNom: 'Beatriz', priApe: 'Ruiz', tipoDoc: 'CC', numDoc: '444', rol: 'Capturado' }
  ]);
  go('personas');
});
await page.waitForTimeout(500);

const q1 = await btnPer();
log(q1.oculto === false && /Antiguas/.test(q1.txt),
  'Personas: el control aparece con el orden de siempre (el de registro)', q1.txt);
const per1 = await nombresPer();
log(JSON.stringify(per1) === JSON.stringify(['Zulema Ruiz', 'Álvaro Ruiz', 'Ñoño Ruiz', 'Beatriz Ruiz']),
  'Por defecto salen en el orden en que se registraron', JSON.stringify(per1));
await page.screenshot({ path: join(SHOTS, 'orden_04_personas_alta.png') });

await elegirOrden('personas', 'az');
const perAZ = await nombresPer();
log(JSON.stringify(perAZ) === JSON.stringify(['Álvaro Ruiz', 'Beatriz Ruiz', 'Ñoño Ruiz', 'Zulema Ruiz']),
  'Personas A – Z', JSON.stringify(perAZ));
await page.screenshot({ path: join(SHOTS, 'orden_05_personas_az.png') });

await elegirOrden('personas', 'za');
log(JSON.stringify(await nombresPer()) === JSON.stringify(perAZ.slice().reverse()), 'Personas Z – A');

await elegirOrden('personas', 'rec');
const perRec = await nombresPer();
log(JSON.stringify(perRec) === JSON.stringify(per1.slice().reverse()),
  'Y «más recientes primero» invierte el orden de registro', JSON.stringify(perRec));

/* ⚠️ Ordenar es SOLO ordenar: el modelo de la persona no gana campos ni pierde
   ninguno por mirar la lista de otra manera. */
const modelo = await page.evaluate(() => {
  const p = DB.getPersons();
  return { claves: Object.keys(p[0]).sort().join(','), conMarca: p.filter(x => x.created).length };
});
log(modelo.claves === 'id,numDoc,priApe,priNom,rol,tipoDoc' && modelo.conMarca === 0,
  'El registro de Personas no cambia: ni un campo nuevo, ni marcas inventadas', JSON.stringify(modelo));

// Con el buscador filtrando, el control sigue a la vista y manda el orden.
await page.fill('#p-search', 'ruiz');
await page.waitForTimeout(400);
log((await btnPer()).oculto === false, 'Con el buscador filtrando, el control de orden sigue visible');
log(JSON.stringify(await nombresPer()) === JSON.stringify(perRec), 'Y el resultado del buscador sale en el orden elegido');
await page.fill('#p-search', '');
await page.waitForTimeout(300);

/* ═══ Parte D · Las dos pantallas son independientes y se recuerdan ═══ */
const cfgOrden = await page.evaluate(() => { const c = DB.getConfig(); return c.ordenCapturas + '/' + c.ordenPersonas; });
log(cfgOrden === 'ant/rec', 'Cada pantalla guarda su propio orden', cfgOrden);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(900);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(500);
log(/Antiguas/.test((await btnCap()).txt) && JSON.stringify(await nombresCap()) === JSON.stringify(capAnt),
  'Tras cerrar y volver a abrir la app, Capturas conserva el orden elegido');
await page.evaluate(() => go('personas'));
await page.waitForTimeout(500);
log(/Recientes/.test((await btnPer()).txt), 'Y Personas conserva el suyo, que es otro');

// Tema claro: el control usa tokens, no colores fijos.
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, 'orden_06_personas_claro.png') });
const colores = await page.$eval('#ord-personas', b => getComputedStyle(b).backgroundColor);
log(colores === 'rgba(0, 0, 0, 0)', 'En tema claro el control sigue siendo transparente sobre la superficie', colores);
await page.evaluate(() => setTheme('dark'));
await page.waitForTimeout(300);

/* ═══ Parte E · Con la lista bajo PIN no hay control de orden ═══ */
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(400);
log(await page.$eval('#ord-capturas', b => b.hidden), 'Con las capturas bajo PIN, el control de orden está oculto');

/* ═══ Parte F · Modo invitado: ni un byte en el equipo ═══ */
const huellaAntes = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return JSON.stringify(o);
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);
await page.click('div.pin-forget:has-text("Usar como invitado")');
await page.waitForTimeout(500);
const invitado = await page.evaluate(() => {
  const antes = lcOrden('personas');
  lcAplicarOrden('personas:az'); lcAplicarOrden('capturas:za');
  return { antes, per: lcOrden('personas'), cap: lcOrden('capturas') };
});
// El dueño dejó Personas en 'rec' y Capturas en 'ant': el invitado arranca en
// los valores por defecto, o sea que ni siquiera LEE los del dueño.
log(invitado.antes === 'ant' && invitado.per === 'az' && invitado.cap === 'za',
  'El invitado arranca en los valores por defecto (no en los del dueño) y puede cambiarlos', JSON.stringify(invitado));
const huellaDespues = await page.evaluate(() => {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
  return JSON.stringify(o);
});
log(huellaDespues === huellaAntes, 'Y no escribe un solo byte en el almacenamiento del dueño');
const duenoIntacto = await page.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('lc_cfg')) || {}).ordenPersonas; } catch (e) { return 'ERROR'; }
});
log(duenoIntacto === 'rec', 'La preferencia del dueño queda como estaba', duenoIntacto);

log(consoleErrors.length === 0, 'Sin errores de consola', consoleErrors.join(' | '));
console.log(`\n${n - fails}/${n} checks OK`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
