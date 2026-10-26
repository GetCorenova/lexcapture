/* Regresión del CÓMO del dossier como RESUMEN del relato (2026-10-26).

   «En el dossier lo que se busca es una información muy puntual de cómo
   sucedieron los hechos, un resumen, sin que se plasme toda la narración.»
   El resumen se hace POR REGLAS en el teléfono (lcResumenComo): solo QUITA
   frases y cláusulas del relato del paso 8 y nombra a las personas por su rol.

     A · El resumidor: el texto del pantallazo, abreviaturas, sin EMP, CESPA,
         casos del simulador, y que no invente palabras.
     B · El dossier: usa el resumen, respeta el que escribió el funcionario y
         no toca lo guardado.
     C · El paso 8: lo propone, se congela al editarlo, «Volver a proponer».
     D · El FPJ-5 no cambia: sigue imprimiendo el relato completo. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8193;
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
  n++; if (!ok) fails++;
  console.log((ok ? '✅' : '❌'), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
};
const sec = t => console.log('\n─── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window._lcListo === true);
await page.waitForTimeout(500);

/* El relato EXACTO del pantallazo del usuario. */
const RELATO = 'El día 30 de agosto de 2026, siendo las 01:24 horas, el suscrito Intendente Jefe José Andrea Betancur Cardona, adscrito a PATRULLA 32 CAI Parque Bolívar CAI Parque Bolívar, en patrullaje por Colón, fue alertado por Jhon Sánchez quien señaló que un sujeto le hurtó su bolso. Al recorrer las inmediaciones se ubicó a Andrés González Ruiz, con características coincidentes, señalado directamente por la víctima. Practicado registro se halló Un (1) revólver calibre .38 con tres cartuchos. Se capturó en flagrancia.';
const CASO = (extra = {}) => Object.assign({
  id: 'RES_1', tipo: 'URI', created: Date.now(),
  conductas: ['Hurto'],
  capturados: [{ id: 'c1', priNom: 'Andrés', priApe: 'González', segApe: 'Ruiz', numDoc: '1' }],
  victimas: [{ id: 'v1', priNom: 'Jhon', priApe: 'Sánchez', numDoc: '2' }],
  testigos: [],
  elementos: [{ id: 'e1', cant: '1', desc: 'revólver calibre .38 con tres cartuchos' }],
  narracion: { texto: RELATO, fechaCapD: '30', fechaCapM: '08', fechaCapA: '2026', horaCapH: '01', horaCapM: '24' }
}, extra);

/* Palabras que la app puede poner sin que estén en el relato: los roles. */
const ROLES = ['el', 'la', 'al', 'del', 'capturado', 'aprehendido', 'víctima', 'testigo', 'suscrito'];
const palabras = s => s.toLowerCase().replace(/[^a-záéíóúñü0-9 ]/gi, ' ').split(/\s+/).filter(Boolean);
const noInventa = (res, rel) => {
  const base = new Set(palabras(rel).concat(ROLES));
  return palabras(res).filter(w => !base.has(w));
};

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('A · EL RESUMIDOR');
const r1 = await page.evaluate(c => lcResumenComo(c), CASO());
console.log('   resumen:', r1);
log(r1.length > 0 && r1.length <= 350, 'El texto del pantallazo sale resumido, ≤ 350 caracteres', r1.length + ' de ' + RELATO.length);
log(!/30 de agosto|01:24|horas/.test(r1), 'Sin la fecha ni la hora (ya están en CUÁNDO)');
log(!/Intendente|Betancur|José Andrea|adscrito/.test(r1), 'Sin el grado, el nombre ni «adscrito a» del funcionario (Conocieron el caso)');
log(!/PATRULLA|CAI/.test(r1), 'Sin la patrulla, y con ella el «CAI … CAI …» repetido');
log(!/Andrés|González|Jhon|Sánchez/.test(r1), 'Sin los nombres de las personas (ya están en QUIÉN y VÍCTIMA)');
log(/al capturado/.test(r1) && /la víctima/.test(r1), 'Las personas se nombran por su rol («al capturado», «la víctima»)');
log(!/revólver|registro/i.test(r1), 'Sin el hallazgo: con EMP lo dice la sección de incautaciones');
log(!/flagrancia/i.test(r1), 'Sin el cierre «Se capturó en flagrancia» (ya está en QUÉ)');
log(/patrullaje por Colón/.test(r1) && /hurtó su bolso/.test(r1) && /inmediaciones/.test(r1),
  'Conserva cómo pasó: patrullaje, alerta, hurto y ubicación');
log(/^[A-ZÁÉÍÓÚÑ]/.test(r1) && /\.$/.test(r1), 'Empieza con mayúscula y termina en punto');
log(noInventa(r1, RELATO).length === 0, '⚠️ No inventa: toda palabra está en el relato o es un rol', noInventa(r1, RELATO).join(', ') || 'ninguna');

const r2 = await page.evaluate(c => lcResumenComo(c), CASO({ elementos: [] }));
log(/revólver calibre \.38/.test(r2), 'Sin EMP registrados, el hallazgo SÍ se conserva (no lo dice otra sección)', r2);

const r3 = await page.evaluate(c => lcResumenComo(c), CASO({ tipo: 'CESPA' }));
log(/al aprehendido/.test(r3) && !/capturado/.test(r3), 'En CESPA la persona es «el aprehendido»');

const abrev = await page.evaluate(() => _lcResFrases('El suscrito S.I. Nelson David, realizando control en Prado, observó a un sujeto con un revólver calibre .38 conducta del Art. 365 C.P. vigente. La víctima huyó.'));
log(abrev.length === 2 && /calibre \.38/.test(abrev[0]) && /Art\. 365 C\.P\. vigente/.test(abrev[0]),
  'Las abreviaturas y «.38» no parten la frase', abrev.length + ' frases');
const r4 = await page.evaluate(() => lcResumenComo({ tipo: 'URI', capturados: [], victimas: [], elementos: [],
  narracion: { texto: 'El día 2 de mayo, a las 10:00 horas, el suscrito S.I. Nelson David, realizando control en Prado, observó a un sujeto en actitud sospechosa.' } }));
log(r4 === 'El suscrito, realizando control en Prado, observó a un sujeto en actitud sospechosa.', 'Grado abreviado con puntos también se retira', r4);

const vacio = await page.evaluate(() => lcResumenComo({ tipo: 'URI', narracion: { texto: '' } }));
log(vacio === '', 'Sin relato no hay resumen (la sección no se imprime)');
const corto = await page.evaluate(() => lcResumenComo({ tipo: 'URI', narracion: { texto: 'Relato del procedimiento escrito por el funcionario.' } }));
log(corto === 'Relato del procedimiento escrito por el funcionario.', 'Un relato corto sale igual');

const sim = await page.evaluate(() => {
  const malos = [];
  for (let i = 0; i < 30; i++) {
    const c = SIM.genFlagrancia(i % 2 ? 'flagrancia-cespa' : 'flagrancia-uri');
    const r = lcResumenComo(c);
    const nom = [].concat(c.capturados || [], c.victimas || []).map(fullName).filter(Boolean);
    const serv = c.servidor && c.servidor.nombre;
    const err = [];
    if (!r) err.push('vacío');
    if (r.length > 350) err.push('largo');
    if (/\d{1,2}:\d{2}\s*horas/.test(r)) err.push('hora');
    if (serv && r.indexOf(serv) >= 0) err.push('funcionario');
    nom.forEach(x => { if (r.indexOf(x) >= 0) err.push('nombre ' + x); });
    if (err.length) malos.push(err.join('/') + ' · ' + r);
  }
  return malos;
});
log(sim.length === 0, '30 capturas del simulador: resumen sin hora, funcionario ni nombres', sim.slice(0, 2).join(' | ') || 'todas bien');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('B · EL DOSSIER');
const bloque = (txt, etq) => {
  const L = txt.split('\n'); const i = L.findIndex(l => l.indexOf('*' + etq + '*') >= 0);
  if (i < 0) return [];
  const out = []; for (let k = i + 1; k < L.length && L[k].trim() && L[k].indexOf('✅') < 0; k++) out.push(L[k]);
  return out;
};
const d1 = await page.evaluate(c => genDossier(c), CASO());
log(bloque(d1, 'CÓMO').join(' ') === r1, 'El CÓMO del dossier es el resumen, no el relato');
log(d1.indexOf('CAI Parque Bolívar CAI Parque Bolívar') < 0, 'El dossier ya no repite el CAI');
const d2 = await page.evaluate(c => genDossier(c),
  CASO({ narracion: Object.assign({}, CASO().narracion, { resumen: 'Resumen propio del funcionario.', resumenManual: true }) }));
log(bloque(d2, 'CÓMO').join(' ') === 'Resumen propio del funcionario.', 'Si el funcionario escribió su resumen, manda el suyo');
const d3 = await page.evaluate(c => genDossier(c),
  CASO({ narracion: Object.assign({}, CASO().narracion, { resumen: 'Viejo resumen automático.', resumenManual: false }) }));
log(bloque(d3, 'CÓMO').join(' ') === r1, 'Un resumen automático guardado se recalcula al imprimir (sigue al caso)');
const intacto = await page.evaluate(c => { const a = JSON.stringify(c); genDossier(c); return JSON.stringify(c) === a; }, CASO());
log(intacto, 'Generar el dossier no toca lo guardado');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('C · EL PASO 8');
await page.evaluate(c => { wc = JSON.parse(JSON.stringify(c)); wc.narracion = { texto: '' }; ws = getWizConfig().steps.indexOf('Narración'); go('wizard'); renderWiz(); }, CASO());
await page.waitForTimeout(300);
log(await page.isVisible('#w-narrRes'), 'El paso 8 tiene el campo «Resumen para el dossier»');
await page.fill('#w-narrTxt', RELATO);
const prop = await page.inputValue('#w-narrRes');
log(prop === r1, 'Al escribir la narración, el resumen se propone solo', prop.length + ' caracteres');
await page.fill('#w-narrRes', 'Corregido por el funcionario.');
await page.fill('#w-narrTxt', RELATO + ' Frase nueva añadida al final.');
log(await page.inputValue('#w-narrRes') === 'Corregido por el funcionario.', 'Una vez corregido, la app ya no lo pisa');
const guardado = await page.evaluate(() => { collectStep(); return wc.narracion; });
log(guardado.resumen === 'Corregido por el funcionario.' && guardado.resumenManual === true && /Frase nueva/.test(guardado.texto),
  'collectStep guarda el relato, el resumen y que fue escrito a mano');
await page.click('text=Volver a proponer');
const re = await page.inputValue('#w-narrRes');
log(re !== 'Corregido por el funcionario.' && re.length > 0, '«Volver a proponer» lo recalcula', re.slice(0, 60) + '…');
const g2 = await page.evaluate(() => { collectStep(); return wc.narracion; });
log(g2.resumenManual === false, 'Y deja de contar como escrito a mano');
await page.evaluate(() => { ws = getWizConfig().steps.indexOf('Servidor'); renderWiz(); collectStep(); });
log(await page.evaluate(() => wc.narracion.resumenManual === false && !!wc.narracion.texto), 'Cambiar de paso no pierde el relato ni el resumen');
await page.evaluate(() => { wc.narracion.resumen = 'Mío.'; wc.narracion.resumenManual = true; ws = getWizConfig().steps.indexOf('Narración'); renderWiz(); });
log(await page.inputValue('#w-narrRes') === 'Mío.', 'Al reabrir, el resumen escrito a mano se conserva');
const ayudas = await page.evaluate(() => Array.from(document.querySelectorAll('#wz-panels .oj-hint')).map(e => e.textContent.trim().length));
log(ayudas.every(x => x <= 110), 'La ayuda del campo no pasa de 110 caracteres', ayudas.join(','));
await page.screenshot({ path: join(ROOT, 'verify_resumen_como_paso8.png'), fullPage: false });
await page.evaluate(() => { wc = null; go('capturas'); });

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('D · EL FPJ-5 NO CAMBIA');
const fpj = await page.evaluate(async c => {
  const xml = async k => { const o = await buildFPJBlob(k, 'CARTA'); return o ? new TextDecoder().decode(o.files['word/document.xml']) : null; };
  c.nunc = '0500160000002026'; c.destino = 'Fiscalía URI';
  const a = await xml(JSON.parse(JSON.stringify(c)));
  const k = JSON.parse(JSON.stringify(c)); k.narracion.resumen = 'Otro resumen.'; k.narracion.resumenManual = true;
  const b = await xml(k);
  return { igual: a === b, conRelato: !!a && a.indexOf('inmediaciones') >= 0 };
}, CASO());
log(fpj.igual, 'El FPJ-5 sale idéntico con o sin resumen');
log(fpj.conRelato, 'Y sigue imprimiendo el relato completo');

log(consoleErrors.length === 0, 'Consola sin errores', consoleErrors.slice(0, 3).join(' | ') || 'limpia');
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
