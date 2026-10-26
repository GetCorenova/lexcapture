/* Regresión del CÓMO del dossier (2026-10-26, 2.º pase).

   «La idea es perder tramitar cómo fue que esa persona fue capturada. Por
   ejemplo: “Fue capturado tras ser alertado por la víctima a quien acababa de
   hurtar”.» El CÓMO es UNA frase redactada con plantillas: la modalidad de la
   captura (art. 301 C.P.P.) detectada en el relato + el verbo del delito.

     A · La frase: el relato del pantallazo, cada modalidad, delitos sin
         víctima, concordancia, CESPA, OJ, un relato de tres páginas.
     B · El dossier: usa la frase, respeta lo escrito a mano, no toca lo guardado.
     C · El paso 8: selector preseleccionado, cambiarlo rehace el resumen,
         editar el resumen lo congela, todo se guarda.
     D · El FPJ-5 no cambia. */
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
const RELATO = 'El día 30 de agosto de 2026, siendo las 01:24 horas, el suscrito Intendente Jefe José Andrea Betancur Cardona, adscrito a PATRULLA 32 CAI Parque Bolívar CAI Parque Bolívar, en patrullaje por Colón, fue alertado por Jhon Sánchez Sánchez quien señaló que un sujeto le hurtó su bolso. Al recorrer las inmediaciones se ubicó a Andrés González Ruiz, con características coincidentes, señalado directamente por la víctima. Practicado registro se halló Un (1) revólver calibre .38 con tres cartuchos. Se capturó en flagrancia.';
const CASO = (extra = {}, narr = {}) => Object.assign({
  id: 'RES_1', tipo: 'URI', created: Date.now(),
  conductas: ['Hurto'],
  capturados: [{ id: 'c1', priNom: 'Andrés', priApe: 'González', segApe: 'Ruiz', numDoc: '1', sexo: 'M' }],
  victimas: [{ id: 'v1', priNom: 'Jhon', priApe: 'Sánchez', segApe: 'Sánchez', numDoc: '2' }],
  testigos: [],
  elementos: [{ id: 'e1', cant: '1', desc: 'revólver calibre .38 con tres cartuchos' }],
  narracion: Object.assign({ texto: RELATO, fechaCapD: '30', fechaCapM: '08', fechaCapA: '2026', horaCapH: '01', horaCapM: '24' }, narr)
}, extra);
const res = c => page.evaluate(k => lcResumenComo(k), c);
const modo = (m, extra = {}) => res(CASO(extra, { modo: m, modoManual: true }));

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('A · LA FRASE');
const r1 = await res(CASO());
log(r1 === 'Fue capturado tras ser señalado por la víctima, a quien acababa de hurtar.',
  'El relato del pantallazo → la frase que pidió el usuario', r1);
log(!/suscrito|Colón|alertado|bolso|30 de agosto|01:24|Andrés|Jhon|PATRULLA|CAI/.test(r1),
  'Nada de «el suscrito», lugar, fecha, hora, nombres ni cómo se enteró la patrulla');
log(await page.evaluate(t => lcResDetectar(t), RELATO) === 'SENAL', 'Detecta la modalidad «señalado por la víctima» en el relato');

const esperadas = {
  SOR: 'Fue sorprendido y capturado cuando hurtaba a la víctima.',
  PERS: 'Fue capturado tras una persecución, luego de hurtar a la víctima.',
  OBJ: 'Fue capturado con arma de fuego en su poder, luego de hurtar a la víctima.',
  VIDEO: 'Fue capturado tras ser identificado en cámaras de video cuando hurtaba a la víctima.',
  VEH: 'Fue capturado en el vehículo en que huía, luego de hurtar a la víctima.',
  '': 'Fue capturado en flagrancia por hurto.'
};
for (const [m, e] of Object.entries(esperadas)) {
  const r = await modo(m);
  log(r === e, 'Modalidad «' + (m || 'sin precisar') + '»', r);
}
const objBien = await res(CASO({ elementos: [{ desc: 'revólver calibre .38' }, { desc: 'celular marca Samsung, color negro' }] }, { modo: 'OBJ', modoManual: true }));
log(objBien === 'Fue capturado con celular en su poder, luego de hurtar a la víctima.',
  'Con víctima, el objeto que se nombra es el bien, no el arma', objBien);

const porte = await res(CASO({ conductas: ['Porte ilegal de armas de fuego'], victimas: [], sinVictima: true },
  { texto: 'El suscrito observó a un sujeto en actitud sospechosa. Al realizarle el registro se le encontró un revólver.' }));
log(porte === 'Fue capturado con arma de fuego en su poder, por porte ilegal de armas de fuego.',
  'Porte de armas sin víctima: la frase nombra el arma', porte);
const droga = await res(CASO({ conductas: ['Tráfico de estupefacientes'], victimas: [], elementos: [{ desc: 'bolsa con marihuana aprox 15g' }] },
  { modo: 'SOR', modoManual: true }));
log(droga === 'Fue sorprendido y capturado con marihuana en su poder, por tráfico de estupefacientes.',
  'Estupefacientes sorprendido en el acto', droga);

const fem = await res(CASO({ capturados: [{ priNom: 'Ana', priApe: 'Ruiz', numDoc: '9', sexo: 'F' }] }));
log(fem === 'Fue capturada tras ser señalada por la víctima, a quien acababa de hurtar.', 'Femenino', fem);
const plu = await res(CASO({ capturados: [{ priNom: 'A', priApe: 'B', numDoc: '1' }, { priNom: 'C', priApe: 'D', numDoc: '2' }] }));
log(plu === 'Fueron capturados tras ser señalados por la víctima, a quien acababan de hurtar.', 'Plural', plu);
const cespa = await res(CASO({ tipo: 'CESPA', capturados: [{ priNom: 'Ana', priApe: 'Ruiz', numDoc: '9', sexo: 'F' }] }));
log(cespa === 'Fue aprehendida tras ser señalada por la víctima, a quien acababa de hurtar.', 'CESPA: «aprehendida»', cespa);
const oj = await res(CASO({ tipo: 'OJ' }));
log(oj === 'Fue capturado en cumplimiento de la orden judicial.', 'Orden judicial', oj);
const sinRel = await res(CASO({}, { texto: '' }));
log(sinRel === 'Fue capturado en flagrancia por hurto.', 'Sin relato: no se afirma ninguna modalidad', sinRel);
const sinDel = await res(CASO({ conductas: [] }, { texto: '' }));
log(sinDel === 'Fue capturado en flagrancia.', 'Sin relato ni delito, igual sale una frase', sinDel);

const largo = RELATO.replace('Se capturó en flagrancia.', '') + ' ' +
  Array(40).fill('Posteriormente se realizaron las labores propias del procedimiento, se diligenciaron las actas correspondientes y se trasladó al capturado hasta las instalaciones.').join(' ');
const rl = await res(CASO({}, { texto: largo }));
log(largo.split(' ').length > 900 && rl === r1, 'Un relato de ~3 páginas da la misma frase', largo.split(' ').length + ' palabras → ' + rl.split(' ').length);
log(rl.split(' ').length <= 120, 'Nunca más de 120 palabras');

const sim = await page.evaluate(() => {
  const malos = [];
  for (let i = 0; i < 30; i++) {
    const c = SIM.genFlagrancia(i % 2 ? 'flagrancia-cespa' : 'flagrancia-uri');
    const r = lcResumenComo(c);
    if (!/^Fue(ron)? (capturad|aprehendid|sorprendid)/.test(r) || r.split(' ').length > 30 || /\d{1,2}:\d{2}|suscrito/.test(r)) malos.push(r);
  }
  return malos;
});
log(sim.length === 0, '30 capturas del simulador: una frase corta y bien formada', sim.slice(0, 2).join(' | ') || 'todas bien');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('B · EL DOSSIER');
const bloque = (txt, etq) => {
  const L = txt.split('\n'); const i = L.findIndex(l => l.indexOf('*' + etq + '*') >= 0);
  if (i < 0) return [];
  const out = []; for (let k = i + 1; k < L.length && L[k].trim() && L[k].indexOf('✅') < 0; k++) out.push(L[k]);
  return out;
};
const d1 = await page.evaluate(c => genDossier(c), CASO());
log(bloque(d1, 'CÓMO').join(' ') === r1, 'El CÓMO del dossier es la frase, no el relato');
const d2 = await page.evaluate(c => genDossier(c), CASO({}, { resumen: 'Resumen propio del funcionario.', resumenManual: true }));
log(bloque(d2, 'CÓMO').join(' ') === 'Resumen propio del funcionario.', 'Si el funcionario escribió su resumen, manda el suyo');
const d3 = await page.evaluate(c => genDossier(c), CASO({}, { resumen: 'Viejo resumen automático.', resumenManual: false }));
log(bloque(d3, 'CÓMO').join(' ') === r1, 'Un resumen automático guardado se recalcula al imprimir');
const d4 = await page.evaluate(c => genDossier(c), CASO({}, { modo: 'PERS', modoManual: true }));
log(bloque(d4, 'CÓMO').join(' ') === esperadas.PERS, 'La modalidad elegida a mano manda al imprimir');
const intacto = await page.evaluate(c => { const a = JSON.stringify(c); genDossier(c); return JSON.stringify(c) === a; }, CASO());
log(intacto, 'Generar el dossier no toca lo guardado');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('C · EL PASO 8');
await page.evaluate(c => { wc = JSON.parse(JSON.stringify(c)); wc.narracion = { texto: '' }; ws = getWizConfig().steps.indexOf('Narración'); go('wizard'); renderWiz(); }, CASO());
await page.waitForTimeout(300);
log(await page.isVisible('#w-narrModo') && await page.isVisible('#w-narrRes'), 'El paso 8 tiene «¿Cómo fue la captura?» y el resumen');
await page.fill('#w-narrTxt', RELATO);
log(await page.inputValue('#w-narrModo') === 'SENAL', 'Al escribir el relato, la modalidad se preselecciona sola');
log(await page.inputValue('#w-narrRes') === r1, 'Y el resumen se propone solo');
await page.selectOption('#w-narrModo', 'PERS');
log(await page.inputValue('#w-narrRes') === esperadas.PERS, 'Cambiar la modalidad rehace el resumen');
await page.fill('#w-narrTxt', 'El suscrito observó cuando el sujeto le hurtaba el celular a la víctima.');
log(await page.inputValue('#w-narrModo') === 'PERS', 'Una modalidad elegida a mano no la pisa el relato');
await page.fill('#w-narrRes', 'Corregido por el funcionario.');
await page.fill('#w-narrTxt', RELATO);
log(await page.inputValue('#w-narrRes') === 'Corregido por el funcionario.', 'Un resumen corregido no lo pisa la app');
const g1 = await page.evaluate(() => { collectStep(); return wc.narracion; });
log(g1.resumen === 'Corregido por el funcionario.' && g1.resumenManual === true && g1.modo === 'PERS' && g1.modoManual === true && g1.texto === RELATO,
  'collectStep guarda relato, resumen, modalidad y qué escribió el funcionario');
await page.click('text=Volver a proponer');
log(await page.inputValue('#w-narrRes') === esperadas.PERS, '«Volver a proponer» rehace el resumen con la modalidad elegida');
await page.evaluate(() => { collectStep(); ws = getWizConfig().steps.indexOf('Servidor'); renderWiz(); });
await page.evaluate(() => { ws = getWizConfig().steps.indexOf('Narración'); renderWiz(); });
log(await page.inputValue('#w-narrModo') === 'PERS' && await page.inputValue('#w-narrRes') === esperadas.PERS,
  'Al volver al paso 8, la modalidad y el resumen se conservan');
const ayudas = await page.evaluate(() => Array.from(document.querySelectorAll('#wz-panels .oj-hint')).map(e => e.textContent.trim().length));
log(ayudas.every(x => x <= 110), 'Las ayudas no pasan de 110 caracteres', ayudas.join(','));
await page.evaluate(() => document.getElementById('w-narrModo').scrollIntoView({ block: 'start' }));
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'verify_resumen_como_paso8.png') });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await page.screenshot({ path: join(ROOT, 'verify_resumen_como_paso8_oscuro.png') });
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); wc = null; go('capturas'); });

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('D · EL FPJ-5 NO CAMBIA');
const fpj = await page.evaluate(async c => {
  const xml = async k => { const o = await buildFPJBlob(k, 'CARTA'); return o ? new TextDecoder().decode(o.files['word/document.xml']) : null; };
  c.nunc = '0500160000002026'; c.destino = 'Fiscalía URI';
  const a = await xml(JSON.parse(JSON.stringify(c)));
  const k = JSON.parse(JSON.stringify(c)); Object.assign(k.narracion, { resumen: 'Otro.', resumenManual: true, modo: 'PERS', modoManual: true });
  const b = await xml(k);
  return { igual: a === b, conRelato: !!a && a.indexOf('inmediaciones') >= 0 };
}, CASO());
log(fpj.igual, 'El FPJ-5 sale idéntico con o sin resumen y modalidad');
log(fpj.conRelato, 'Y sigue imprimiendo el relato completo');

log(consoleErrors.length === 0, 'Consola sin errores', consoleErrors.slice(0, 3).join(' | ') || 'limpia');
console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
