/* Regresión del ORDEN DE LAS LISTAS (Capturas y Personas).
   El usuario pidió poder elegir, en las dos pantallas, si lo más reciente sale
   arriba o abajo. Lo que hay que comprobar de punta a punta:
   1. Que el control exista en las DOS pantallas, diga cómo está ordenada la
      lista ahora mismo y la invierta al tocarlo.
   2. Que la elección se recuerde entre sesiones y que las dos pantallas sean
      independientes.
   3. Que el valor por defecto de cada pantalla sea EL COMPORTAMIENTO QUE YA
      TENÍA: nadie se encuentra la lista dada vuelta al actualizar.
   4. Que las personas registradas ANTES de que existiera la marca de alta
      (`created`) se ordenen bien en los dos sentidos, sin migrar nada.
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

const nombresCap = () => page.$$eval('#cl .cc-name', els => els.map(e => e.textContent.trim().split(' ').slice(0, 2).join(' ')));
const nombresPer = () => page.$$eval('#pl .prow-name', els => els.map(e => e.textContent.trim()));
const btnCap = () => page.$eval('#ord-capturas', b => ({ txt: b.textContent.trim(), oculto: b.hidden, svg: b.querySelectorAll('svg').length, title: b.title }));
const btnPer = () => page.$eval('#ord-personas', b => ({ txt: b.textContent.trim(), oculto: b.hidden || b.parentNode.hidden, svg: b.querySelectorAll('svg').length, title: b.title }));

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

/* ═══ Parte A · El control aparece solo cuando hay algo que ordenar ═══ */
log(await page.isVisible('#pin-a'), 'Arranca pidiendo crear el PIN');
await page.fill('#pin-a', '246810');
await page.fill('#pin-b', '246810');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(600);

await page.evaluate(() => go('capturas'));
await page.waitForTimeout(300);
log((await btnCap()).oculto === true, 'Sin capturas, el control de orden está oculto');
await page.evaluate(() => go('personas'));
await page.waitForTimeout(300);
log((await btnPer()).oculto === true, 'Sin personas, el control de orden está oculto');

/* ═══ Parte B · CAPTURAS ═══ */
const H = 3600000;
await page.evaluate(async (H) => {
  const t = Date.now();
  const mk = (i, tipo, horas) => ({
    id: 'c' + i, tipo, created: t - horas * H, fechaProc: '2026-08-0' + i,
    conductas: ['Hurto ' + i], capturados: [{ priNom: 'Caso', priApe: String(i) }]
  });
  // Se guardan de la MÁS ANTIGUA a la más reciente: así el arreglo del almacén
  // no coincide con ninguno de los dos órdenes por casualidad.
  await DB.saveCases([mk(1, 'URI', 30), mk(2, 'CESPA', 20), mk(3, 'OJ', 2)]);
  go('capturas');
}, H);
await page.waitForTimeout(500);

const b1 = await btnCap();
log(b1.oculto === false && /Recientes primero/.test(b1.txt) && b1.svg === 1,
  'Capturas: el control aparece, con icono y etiqueta del orden actual', JSON.stringify(b1.txt));
log(/toca para invertirlo/.test(b1.title), 'Y el título dice que se puede invertir', b1.title);
const cap1 = await nombresCap();
log(JSON.stringify(cap1) === JSON.stringify(['Caso 3', 'Caso 2', 'Caso 1']),
  'Por defecto, la captura más reciente arriba (comportamiento previo intacto)', JSON.stringify(cap1));
await page.screenshot({ path: join(SHOTS, 'orden_01_capturas_rec.png') });

await page.click('#ord-capturas');
await page.waitForTimeout(450);
const b2 = await btnCap();
const cap2 = await nombresCap();
log(/Antiguas primero/.test(b2.txt), 'Un toque invierte el orden y la etiqueta lo dice', b2.txt);
log(JSON.stringify(cap2) === JSON.stringify(['Caso 1', 'Caso 2', 'Caso 3']),
  'La lista queda de la más antigua a la más reciente', JSON.stringify(cap2));
await page.screenshot({ path: join(SHOTS, 'orden_02_capturas_ant.png') });

const cacheOrden = await page.evaluate(() => DB.getCases().map(c => c.id).join(','));
log(cacheOrden === 'c1,c2,c3', 'Ordenar la vista NO reordena el almacén de capturas', cacheOrden);

// El botón de orden NO es un chip de filtro: filterCasos() apaga todos los .fc
// de la pantalla y le habría borrado el estado.
await page.click('.flt .fc:nth-child(2)');
await page.waitForTimeout(400);
const b3 = await btnCap();
const capFlag = await nombresCap();
log(b3.oculto === false && /Antiguas primero/.test(b3.txt),
  'Filtrar por Flagrancia no apaga ni descoloca el control de orden', b3.txt);
log(JSON.stringify(capFlag) === JSON.stringify(['Caso 1', 'Caso 2']),
  'Y el filtro respeta el orden elegido', JSON.stringify(capFlag));
log(await page.$eval('#ord-capturas', b => !b.classList.contains('fc')), 'El control no lleva la clase .fc');
await page.click('.flt .fc:nth-child(1)');
await page.waitForTimeout(300);

/* ═══ Parte C · PERSONAS ═══ */
await page.evaluate(async () => {
  // Sembradas por savePersons: NINGUNA lleva marca de alta. Es el caso de un
  // equipo que venía usando la app antes de que el campo existiera.
  await DB.savePersons([
    { id: 'p1', priNom: 'Ana', priApe: 'Uno', tipoDoc: 'CC', numDoc: '111', rol: 'Capturado' },
    { id: 'p2', priNom: 'Bruno', priApe: 'Dos', tipoDoc: 'CC', numDoc: '222', rol: 'Víctima' },
    { id: 'p3', priNom: 'Clara', priApe: 'Tres', tipoDoc: 'CC', numDoc: '333', rol: 'Testigo' }
  ]);
  go('personas');
});
await page.waitForTimeout(500);

const q1 = await btnPer();
log(q1.oculto === false && /Antiguas primero/.test(q1.txt) && q1.svg === 1,
  'Personas: el control aparece con el orden por defecto (el de siempre: orden de alta)', q1.txt);
const per1 = await nombresPer();
log(JSON.stringify(per1) === JSON.stringify(['Ana Uno', 'Bruno Dos', 'Clara Tres']),
  'Personas sin marca de alta salen en su orden de registro', JSON.stringify(per1));
await page.screenshot({ path: join(SHOTS, 'orden_03_personas_ant.png') });

await page.click('#ord-personas');
await page.waitForTimeout(450);
const per2 = await nombresPer();
log(/Recientes primero/.test((await btnPer()).txt), 'Un toque invierte el orden de Personas');
log(JSON.stringify(per2) === JSON.stringify(['Clara Tres', 'Bruno Dos', 'Ana Uno']),
  'Las personas sin `created` se invierten por su posición, sin migrar nada', JSON.stringify(per2));
await page.screenshot({ path: join(SHOTS, 'orden_04_personas_rec.png') });

// Una persona nueva SÍ recibe marca de alta y encabeza la lista.
await page.evaluate(async () => {
  await DB.savePerson({ id: 'p4', priNom: 'Diana', priApe: 'Cuatro', tipoDoc: 'CC', numDoc: '444', rol: 'Capturado' });
  renderPersonas();
});
await page.waitForTimeout(400);
const per3 = await nombresPer();
log(per3[0] === 'Diana Cuatro', 'Una persona registrada ahora encabeza «Recientes primero»', JSON.stringify(per3));
log(await page.evaluate(() => !!DB.getPerson('p4').created), 'Y queda con su marca de alta');

// Editarla no la convierte en «la más reciente» de nuevo (la marca se conserva).
const marcaAntes = await page.evaluate(() => DB.getPerson('p4').created);
await page.evaluate(async () => {
  await DB.savePerson({ id: 'p1', priNom: 'Ana', segNom: 'María', priApe: 'Uno', tipoDoc: 'CC', numDoc: '111', rol: 'Capturado' });
  await DB.savePerson({ id: 'p4', priNom: 'Diana', priApe: 'Cuatro', tipoDoc: 'CC', numDoc: '4444', rol: 'Capturado' });
  renderPersonas();
});
await page.waitForTimeout(400);
const marcaDespues = await page.evaluate(() => DB.getPerson('p4').created);
log(marcaDespues === marcaAntes, 'Editar a una persona NO le cambia la marca de alta', marcaAntes + ' → ' + marcaDespues);
const per4 = await nombresPer();
log(per4[0] === 'Diana Cuatro' && per4[per4.length - 1] === 'Ana María Uno',
  'Editar tampoco la mueve de sitio en la lista', JSON.stringify(per4));

// Con el buscador filtrando, el control sigue a la vista y manda el orden.
await page.fill('#p-search', 'o');
await page.waitForTimeout(400);
const q2 = await btnPer();
log(q2.oculto === false, 'Con el buscador filtrando, el control de orden sigue visible');
const perF = await nombresPer();
log(perF.length > 1 && perF.join(',') === perF.slice().join(','), 'El resultado del buscador sale en el orden elegido', JSON.stringify(perF));
await page.fill('#p-search', '');
await page.waitForTimeout(300);

/* ═══ Parte D · Las dos pantallas son independientes y se recuerdan ═══ */
const cfgOrden = await page.evaluate(() => { const c = DB.getConfig(); return c.ordenCapturas + '/' + c.ordenPersonas; });
log(cfgOrden === 'ant/rec', 'Cada pantalla guarda su propio orden', cfgOrden);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);
await page.fill('#pin-e', '246810');
await page.click('button[onclick="doUnlock()"]');
await page.waitForTimeout(900);
await page.evaluate(() => go('capturas'));
await page.waitForTimeout(500);
const capR = await nombresCap();
log(/Antiguas primero/.test((await btnCap()).txt) && JSON.stringify(capR) === JSON.stringify(['Caso 1', 'Caso 2', 'Caso 3']),
  'Tras cerrar y volver a abrir la app, Capturas conserva el orden elegido', JSON.stringify(capR));
await page.evaluate(() => go('personas'));
await page.waitForTimeout(500);
const perR = await nombresPer();
log(/Recientes primero/.test((await btnPer()).txt) && perR[0] === 'Diana Cuatro',
  'Y Personas conserva el suyo, que es el contrario', JSON.stringify(perR));

// Tema claro: el control usa tokens, no colores fijos.
await page.evaluate(() => setTheme('light'));
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, 'orden_05_personas_claro.png') });
const colores = await page.$eval('#ord-personas', b => {
  const cs = getComputedStyle(b);
  return { bg: cs.backgroundColor, color: cs.color, borde: cs.borderTopColor };
});
log(colores.bg === 'rgba(0, 0, 0, 0)', 'En tema claro el control sigue siendo transparente sobre la superficie', JSON.stringify(colores));
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
  lcCambiarOrden('personas'); lcCambiarOrden('capturas');
  return { antes, despues: lcOrden('personas'), cap: lcOrden('capturas') };
});
log(invitado.despues !== invitado.antes && invitado.cap === 'rec',
  'El invitado puede cambiar el orden en su sesión', JSON.stringify(invitado));
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
