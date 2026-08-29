/* Regresión de «CARRERA SE ABREVIA CR, NO KR» (2026-08-28).

   El usuario lo reportó con el numeral 1 de un informe impreso: la app escribía
   «KR 83 # 47A-91» (la abreviatura catastral del IGAC) y en los despachos
   judiciales se escribe «CR». Pidió que quedara corregido «en todos los
   formularios y por ende en los informes y documentos».

   Lo que fija esta suite:
   (a) el catálogo y el widget solo PRODUCEN «CR»;
   (b) «KR» se sigue RECONOCIENDO al leer — ninguna dirección ya escrita se
       pierde ni se degrada a texto libre;
   (c) la conversión llega a los DOCUMENTOS, incluso en una captura guardada
       antes de este cambio que nadie vuelve a abrir en el formulario;
   (d) NO se reinterpreta de más: lo que no es una vía se queda como está. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8177;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
function log(ok, label, extra) {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}
function sec(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 64 - t.length))); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '2468');
await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(500);

/* Lee word/document.xml de un .docx descargado. ZIP stored, igual que unzipDocx. */
async function docXml(gen, arg, tag) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
    page.evaluate(gen, arg)
  ]);
  if (!dl) return null;
  const tmp = join(tmpdir(), 'verify_via_cr_' + tag + '_' + Date.now() + '.docx');
  await dl.saveAs(tmp);
  const buf = await readFile(tmp);
  let pos = 0;
  while (pos + 30 <= buf.length) {
    if (buf.readUInt32LE(pos) !== 0x04034b50) break;
    const sz = buf.readUInt32LE(pos + 18), nl = buf.readUInt16LE(pos + 26), el = buf.readUInt16LE(pos + 28);
    const nm = buf.slice(pos + 30, pos + 30 + nl).toString('utf8').replace(/[\\]/g, '/');
    const ds = pos + 30 + nl + el;
    if (nm === 'word/document.xml') return buf.slice(ds, ds + sz).toString('utf8');
    pos = ds + sz;
  }
  return null;
}
/* Todo el texto visible del documento, sin marcado. */
function textoDe(xml) {
  let t = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>/]*)?>([\s\S]*?)<\/w:t>/g)) t += m[1] + ' ';
  return t.replace(/\s+/g, ' ');
}
/* «KR» como abreviatura de VÍA — lo único que no puede quedar en un documento.
   No basta con buscar la sigla suelta: aparece dentro de palabras corrientes. */
const RE_KR_VIA = /\bKRA?\.?\s*\d/i;

/* ═══════════ 1 · el catálogo solo produce CR ═══════════ */
sec('El catálogo de vías');
const cat = await page.evaluate(() => ({
  vias: LC_VIA.map(v => v.ab),
  carrera: LC_VIA.filter(v => v.nom === 'Carrera').map(v => v.ab),
  nombreCR: lcViaNombre('CR'),
  aliasKR: LC_VIA_ALIAS.KR,
  cruceCL: LC_VIA_CRUCE.CL,
  cruceCR: LC_VIA_CRUCE.CR
}));
log(cat.carrera.length === 1 && cat.carrera[0] === 'CR', 'Carrera se abrevia CR', cat.carrera.join(','));
log(!cat.vias.includes('KR'), '⚠️ «KR» ya no se OFRECE en ninguna parte del catálogo', cat.vias.join(' '));
log(cat.nombreCR === 'Carrera', 'Y «CR» se lee «Carrera» en la interfaz', cat.nombreCR);
log(cat.aliasKR === 'CR', '⚠️ Pero «KR» se sigue RECONOCIENDO al leer: es un alias, no una vía', 'KR → ' + cat.aliasKR);
log(cat.cruceCL === 'CR' && cat.cruceCR === 'CL', 'El par calle⇄carrera de los cruces usa la abreviatura nueva', cat.cruceCL + ' / ' + cat.cruceCR);

/* ═══════════ 2 · la primitiva ═══════════ */
sec('lcDirCR — qué convierte y qué NO toca');
const prim = await page.evaluate(() => ({
  simple: lcDirCR('KR 56 # 42-70'),
  punto: lcDirCR('KR. 56 # 42-70'),
  pegado: lcDirCR('KR56 # 42-70'),
  kra: lcDirCR('KRA 45 No 12-30'),
  minus: lcDirCR('kr 83 # 47A-91'),
  enMedio: lcDirCR('CL 52 con KR 50, barrio Boston'),
  yaCR: lcDirCR('CR 56 # 42-70'),
  idem: lcDirCR(lcDirCR('KR 56 # 42-70')),
  palabra: lcDirCR('KRISTAL 45 con la 30'),
  sinNum: lcDirCR('Detrás del parque KR, sin nomenclatura'),
  libre: lcDirCR('finca La Esperanza, vía al mar km 4'),
  vacio: lcDirCR(''),
  nulo: lcDirCR(null)
}));
log(prim.simple === 'CR 56 # 42-70', 'La dirección corriente se convierte', prim.simple);
log(prim.punto === 'CR 56 # 42-70', 'Con punto de abreviatura, igual', prim.punto);
log(prim.pegado === 'CR 56 # 42-70', 'Y pegada al número, igual', prim.pegado);
log(prim.kra === 'CR 45 No 12-30', '«KRA» es la misma abreviatura y cae con ella', prim.kra);
log(prim.minus === 'CR 83 # 47A-91', 'En minúscula también: es una abreviatura, va en mayúsculas', prim.minus);
log(prim.enMedio === 'CL 52 con CR 50, barrio Boston', 'Y en medio de la frase, no solo al principio', prim.enMedio);
log(prim.yaCR === 'CR 56 # 42-70' && prim.idem === 'CR 56 # 42-70',
  'Es idempotente: aplicarla dos veces no cambia nada', prim.idem);
log(prim.palabra === 'KRISTAL 45 con la 30',
  '⚠️ NO toca «KR» dentro de otra palabra — reinterpretar de más manda al sitio equivocado', prim.palabra);
log(prim.sinNum === 'Detrás del parque KR, sin nomenclatura',
  '⚠️ Ni una sigla suelta que no encabeza el número de la vía', prim.sinNum);
log(prim.libre === 'finca La Esperanza, vía al mar km 4', 'Ni una dirección sin nomenclatura', prim.libre);
log(prim.vacio === '' && prim.nulo === '', 'Vacío y nulo no revientan');

/* ═══════════ 3 · lo ya escrito se sigue leyendo ═══════════ */
sec('Ninguna dirección guardada se pierde');
const par = await page.evaluate(() => ({
  kr: lcDirParsear('KR 45 No 12-30 Apto 301'),
  kra: lcDirParsear('Kra 45 # 12-30'),
  cra: lcDirParsear('Cra 45 # 12-30'),
  cr: lcDirParsear('CR 45 # 12-30'),
  txt: lcDirParsear('Carrera 45 # 12-30')
}));
log(par.kr.via === 'CR' && par.kr.num === '45' && par.kr.comp === 'APTO 301',
  '⚠️ «KR 45 No 12-30» guardada antes se interpreta entera: no cae a texto libre', JSON.stringify(par.kr));
log(par.kra.via === 'CR' && par.cra.via === 'CR' && par.cr.via === 'CR' && par.txt.via === 'CR',
  'Las cuatro formas de escribirla dan la misma vía', [par.kra.via, par.cra.via, par.cr.via, par.txt.via].join(' '));

/* ═══════════ 4 · el formulario ═══════════ */
sec('El formulario — el usuario ve lo que se va a imprimir');
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(300);
const opcCR = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#w-dir__via option')).map(o => o.value + '|' + o.textContent));
log(opcCR.some(o => o.startsWith('CR|') && /Carrera \(CR\)/.test(o)), 'El selector ofrece «Carrera (CR)»',
  (opcCR.find(o => o.startsWith('CR|')) || '').split('|')[1]);
log(!opcCR.some(o => o.startsWith('KR|')), '⚠️ Y ya no ofrece «KR»');

await page.evaluate(() => {
  document.getElementById('w-dir__via').value = 'CR';
  document.getElementById('w-dir__num').value = '83';
  document.getElementById('w-dir__cruce').value = '47A';
  document.getElementById('w-dir__placa').value = '91';
  lcDirEditar('w-dir');
});
log(await page.inputValue('#w-dir') === 'CR 83 # 47A-91', 'El formato guiado compone con CR',
  await page.inputValue('#w-dir'));
const prev = await page.textContent('#w-dir__body .lc-dir-prev');
log(/CR 83 # 47A-91/.test(prev), 'Y la vista previa lo enseña antes de generar nada', prev.trim());

/* Escritura libre: la conversión tiene que ser VISIBLE, no silenciosa. */
await page.evaluate(() => lcDirModo('w-dir', 'libre'));
await page.waitForTimeout(200);
await page.fill('#w-dir__libre', 'KR 83 # 47A-91, al lado del CAI');
await page.evaluate(() => lcDirLibreCR('w-dir'));
await page.waitForTimeout(150);
const vistoLibre = await page.inputValue('#w-dir__libre');
log(vistoLibre === 'CR 83 # 47A-91, al lado del CAI',
  '⚠️ En escritura libre el CAMPO enseña la conversión al salir: nada silencioso', vistoLibre);
log(await page.inputValue('#w-dir') === 'CR 83 # 47A-91, al lado del CAI',
  'Y el valor que se guarda es el mismo que se ve', await page.inputValue('#w-dir'));
await page.evaluate(() => { wc = null; go('capturas'); });
await page.waitForTimeout(200);

/* ═══════════ 5 · una captura guardada ANTES del cambio ═══════════ */
sec('Lo ya guardado imprime CR sin volver a abrir su formulario');
/* Se siembra saltándose DB.saveCase —escribiendo la caché a mano y cifrando por
   la vía interna— para que el caso quede EXACTAMENTE como lo dejaba el build
   anterior. Si se sembrara por la vía normal, la normalización del guardado
   taparía justo lo que se quiere medir: que la MIGRACIÓN AL LEER lo cubre. */
const CAP = {
  priNom: 'JUAN', priApe: 'PEREZ', tipoDoc: 'CC', numDoc: '71234567', expEn: 'MEDELLIN',
  edad: '32', sexo: 'M', fn: '1994-03-04', dirRes: 'KR 45 # 10-20', tel: '3001234567',
  id: 'P-VIEJO', rol: 'Capturado'
};
await page.evaluate(async (p) => {
  const c = {
    id: 'VIEJO', tipo: 'URI', nunc: '1100160000012025', fechaProc: '2026-08-14',
    destino: 'Fiscalía URI', created: Date.now(), conductas: ['HURTO CALIFICADO'],
    lugar: {
      dir: 'KR 83 # 47A-91', barrio: 'LA AMERICA', depto: 'ANTIOQUIA', muni: 'MEDELLIN',
      caract: 'VIA PUBLICA', zona: 'Urbana', localidad: '10', vereda: 'N/A'
    },
    capturados: [p], victimas: [], testigos: [], hayVehiculos: false, vehiculos: [],
    narracion: {
      fechaCapD: '14', fechaCapM: '08', fechaCapA: '2026', horaCapH: '15', horaCapM: '45',
      fechaDispD: '14', fechaDispM: '08', fechaDispA: '2026', texto: 'Relato del procedimiento.', emp: ''
    },
    servidor: {
      grado: 'PATRULLERO', nombre: 'NELSON GOMEZ', ident: '1234567890',
      entidad: 'UNIDAD DEMO', cargo: 'PATRULLERO', tel: '3011112222'
    }
  };
  _casesCache = [c];
  _personsCache = [p];
  await _lcEncSave('cases', _casesCache);
  await _lcEncSave('persons', _personsCache);
}, CAP);
/* Un despacho registrado antes del cambio: su dirección es la que imprime el
   numeral 1 «DESTINO DEL INFORME», que es donde el usuario vio el defecto. */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [{
    id: 'D1', clase: 'CESPA', tipo: 'CESPA', nombre: 'Centro de Servicios Judiciales para Adolescentes (CESPA)',
    direccion: 'KR 83 # 47A-91', barrio: 'La América', municipio: 'Medellín',
    departamento: 'Antioquia', nunc: '0500160000012026'
  }];
  cfg.ojCustDireccion = 'KR 48 # 55-50';
  DB.saveConfig(cfg);
});

/* La migración corre al cargar las cachés: se recarga la app y se desbloquea. */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '2468');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(800);

const migrado = await page.evaluate(() => {
  const c = DB.getCase('VIEJO'), cfg = DB.getConfig();
  return {
    dir: c && c.lugar.dir,
    res: c && c.capturados[0].dirRes,
    persona: (DB.getPersons()[0] || {}).dirRes,
    despacho: (cfg.despachosPropios[0] || {}).direccion,
    custodia: cfg.ojCustDireccion
  };
});
log(migrado.dir === 'CR 83 # 47A-91', 'El lugar de los hechos ya dice CR', migrado.dir);
log(migrado.res === 'CR 45 # 10-20', 'La residencia del capturado, también', migrado.res);
log(migrado.persona === 'CR 45 # 10-20', 'Y la del registro de Personas', migrado.persona);
log(migrado.despacho === 'CR 83 # 47A-91', 'El despacho ya registrado, también', migrado.despacho);
log(migrado.custodia === 'CR 48 # 55-50', 'Y el lugar de custodia de la configuración', migrado.custodia);

/* ═══════════ 6 · el documento ═══════════ */
sec('El informe FPJ-5 sale con CR');
const xml = await docXml(async (id) => {
  const c = DB.getCase(id);
  const out = await buildFPJBlob(c, 'CARTA');
  if (!out) return false;
  _dlDocBlob(out.blob, out.fname);
  return true;
}, 'VIEJO', 'fpj5');
log(!!xml, 'El FPJ-5 se genera');
if (xml) {
  const t = textoDe(xml);
  log(/CR 83 # 47A-91/.test(t), 'El lugar de los hechos se imprime con CR');
  log(/CR 45 # 10-20/.test(t), 'Y la residencia del capturado');
  log(!RE_KR_VIA.test(t), '⚠️ En TODO el documento no queda una sola vía escrita «KR»',
    (t.match(RE_KR_VIA) || ['—'])[0]);
}

/* El numeral 1 es donde el usuario vio el defecto: nombre + dirección del
   despacho que recibe la captura. */
sec('Numeral 1 — DESTINO DEL INFORME');
const dest = await page.evaluate(() => {
  const cfg = DB.getConfig(), d = cfg.despachosPropios[0];
  const c = DB.getCase('VIEJO');
  c.despachoId = d.id; c.destino = d.nombre;
  return { linea: lcDestinoInforme(c), dir: lcDespDireccion(d) };
});
log(/CR 83 # 47A-91/.test(dest.linea) && !RE_KR_VIA.test(dest.linea),
  '⚠️ La línea que el usuario señaló sale con CR', dest.linea);
log(/CR 83 # 47A-91/.test(dest.dir), 'Y el compositor de la dirección del despacho, igual', dest.dir);

/* ═══════════ 7 · orden judicial ═══════════ */
sec('El oficio de orden judicial');
const oj = await page.evaluate(async () => {
  const c = SIM.genOJ();
  c.oj.requerido.resDireccion = 'KR 45 # 10-20';
  c.oj.diligencia.lugarDireccion = 'KR 83 # 47A-91';
  c.oj.custodia.direccion = 'KR 48 # 55-50';
  c.oj.despacho.direccion = 'KRA 52 # 42-73';
  await DB.saveCase(c);
  const g = DB.getCase(c.id);
  return {
    id: c.id,
    res: g.oj.requerido.resDireccion,
    lugar: g.oj.diligencia.lugarDireccion,
    cust: g.oj.custodia.direccion,
    desp: g.oj.despacho.direccion
  };
});
log(oj.res === 'CR 45 # 10-20' && oj.lugar === 'CR 83 # 47A-91' && oj.cust === 'CR 48 # 55-50' && oj.desp === 'CR 52 # 42-73',
  '⚠️ Al GUARDAR se normalizan las cuatro direcciones del módulo (cubre simulador e importación)',
  [oj.res, oj.lugar, oj.cust, oj.desp].join(' | '));

const xmlOJ = await docXml(async (id) => {
  const c = DB.getCase(id);
  const out = await buildOficioOJBlob(c, 'CARTA');
  if (!out) return false;
  _dlDocBlob(out.blob, out.fname);
  return true;
}, oj.id, 'oj');
log(!!xmlOJ, 'El oficio se genera');
if (xmlOJ) {
  const t = textoDe(xmlOJ);
  log(!RE_KR_VIA.test(t), '⚠️ Y tampoco él deja una sola vía escrita «KR»', (t.match(RE_KR_VIA) || ['—'])[0]);
  log(/CR 83 # 47A-91/.test(t) || /CR 48 # 55-50/.test(t), 'Las direcciones del procedimiento salen con CR');
}

/* ═══════════ 8 · el resto de la app ═══════════ */
sec('Ni un «KR» de vía en el código ni en la interfaz');
const fuente = await readFile(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const codigo = fuente.split('\n').filter(l => l.length < 600);
const sospechosas = codigo.filter(l => /['"]KR['"]/.test(l) && !/LC_VIA_ALIAS/.test(l));
log(sospechosas.length === 0, '⚠️ «KR» solo sobrevive como ALIAS de lectura, en ningún otro literal',
  sospechosas.length ? sospechosas[0].trim().slice(0, 90) : 'ninguno');

log(consoleErrors.length === 0, 'Consola sin errores', consoleErrors.length ? consoleErrors[0] : 'limpia');

console.log('\n' + (fails ? '❌ ' + fails + ' de ' + n : '✅ ' + n + ' de ' + n) + ' comprobaciones ' + (fails ? 'fallaron' : 'en verde'));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
