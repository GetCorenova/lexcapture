/* Regresión: apartados repetibles del FPJ-5 (4 capturados / 5 víctimas / 6 testigos).
   El formato oficial dice "En el evento de existir más capturados se pueden reproducir las
   casillas cuantas veces sea necesario": con N personas el documento debe traer el apartado
   original (4) más una copia por cada persona extra, numeradas 4.1, 4.2, … y CADA copia con
   TODOS los campos de SU persona, sin heredar los de la anterior ni los de la plantilla.
   Se generan los .docx reales (URI y CESPA) y se inspecciona el word/document.xml resultante. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8129;
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

let fails = 0;
function log(ok, label, extra) {
  if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), label, extra !== undefined ? ('— ' + extra) : '');
}

/* Personas con TODOS los campos distintos entre sí: si una copia hereda datos de otra,
   la comprobación por apartado lo detecta. */
function persona(n, rol) {
  return {
    id: 'p' + rol + n, tipoDoc: n === 3 ? 'CE' : 'CC', numDoc: rol + '00' + n + '999', expEn: 'EXPED' + rol + n,
    priNom: 'NOM' + rol + n, segNom: 'SEG' + rol + n, priApe: 'APE' + rol + n, segApe: 'SGA' + rol + n,
    alias: 'ALIAS' + rol + n, fn: '199' + n + '-0' + n + '-1' + n, edad: String(30 + n),
    lugNac: 'CIUDAD' + rol + n, ecivil: n === 1 ? 'Soltero/a' : 'Casado/a', escol: n === 1 ? 'Bachiller' : 'Técnico',
    ocup: 'OFICIO' + rol + n, dirRes: 'DIRECCION' + rol + n, tel: '31000000' + n,
    correo: 'correo' + rol + n + '@ejemplo.com', padres: 'PADRES' + rol + n, senas: 'SENAS' + rol + n
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.fill('#pin-a', '135790');
await page.fill('#pin-b', '135790');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(400);

/* Genera el .docx y devuelve el documento troceado por apartados (4/4.1/5/5.1/6/6.1…). */
async function inspect(tipo, caps, vics, tests) {
  return page.evaluate(async ([tipo, caps, vics, tests]) => {
    const c = SIM.genFlagrancia(tipo === 'CESPA' ? 'flagrancia-cespa' : 'flagrancia-uri');
    c.nunc = '0500160002062026';
    c.capturados = caps; c.victimas = vics; c.testigos = tests;
    c.sinVictima = !vics.length; c.sinTestigo = !tests.length;
    const out = buildFPJBlob(c);
    if (!out) return { error: 'buildFPJBlob devolvió null' };
    const buf = new Uint8Array(await out.blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const files = unzipDocx(btoa(bin));
    const xml = new TextDecoder().decode(files['word/document.xml']);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return { error: 'XML mal formado' };
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    const txt = el => { const ts = el.getElementsByTagNameNS(W, 't'); let r = ''; for (let i = 0; i < ts.length; i++) r += (ts[i].textContent || ''); return r; };
    const kids = Array.from(body.childNodes).filter(n => n.nodeType === 1);
    // Geometría de una tabla: lo que determina dónde caen sus bordes al imprimir.
    const geo = tbl => {
      const ser = new XMLSerializer();
      const pr = tbl.getElementsByTagNameNS(W, 'tblPr')[0];
      const gr = tbl.getElementsByTagNameNS(W, 'tblGrid')[0];
      return (pr ? ser.serializeToString(pr) : '') + '|' + (gr ? ser.serializeToString(gr) : '');
    };
    // Trocea el cuerpo: cada apartado va desde su barra de título hasta la siguiente.
    const secs = []; let cur = null;
    const notas = [];
    kids.forEach((k, pos) => {
      const t = txt(k);
      if (/evento de existir m[aá]s (capturados|v[ií]ctimas|testigos)/i.test(t)) notas.push({ pos, t: t.trim().slice(0, 40) });
      if (k.localName === 'p' && /^\s*\d+(\.\d+)?[.\s]/.test(t)) { cur = { head: t.trim(), text: '', tbl: 0, geo: [], pos }; secs.push(cur); }
      if (!cur) return;
      cur.text += t + '\n';
      if (k.localName === 'tbl') { cur.tbl++; cur.geo.push(geo(k)); }
    });
    // Word exige identificadores únicos: los clones no pueden repetir marcadores ni paraId.
    const bmk = Array.from(body.getElementsByTagNameNS(W, 'bookmarkStart')).map(b => b.getAttribute('w:name'));
    const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
    const pids = Array.from(body.getElementsByTagNameNS(W, 'p')).map(p => p.getAttributeNS(W14, 'paraId')).filter(Boolean);
    return {
      secs, notas, nTbl: body.getElementsByTagNameNS(W, 'tbl').length, size: buf.length,
      dupBmk: bmk.filter((v, i) => bmk.indexOf(v) !== i),
      dupPid: pids.filter((v, i) => pids.indexOf(v) !== i),
      full: kids.map(txt).join('\n'), fname: out.fname
    };
  }, [tipo, caps, vics, tests]);
}

const caps3 = [persona(1, 'CAP'), persona(2, 'CAP'), persona(3, 'CAP')];
const vics2 = [persona(1, 'VIC'), persona(2, 'VIC')];
const tests3 = [persona(1, 'TES'), persona(2, 'TES'), persona(3, 'TES')];

/* Campos que el formato imprime en cada apartado. */
const CAMPOS_CAP = ['priNom', 'segNom', 'priApe', 'segApe', 'alias', 'numDoc', 'expEn', 'lugNac', 'ecivil', 'escol', 'ocup', 'correo', 'padres', 'dirRes', 'tel', 'senas'];
const CAMPOS_VT = ['priNom', 'segNom', 'priApe', 'segApe', 'numDoc', 'expEn', 'lugNac', 'ecivil', 'ocup', 'dirRes', 'tel', 'correo'];
const MAY = { priNom: 1, segNom: 1, priApe: 1, segApe: 1 };

function chkSeccion(secs, head, p, campos, etq) {
  const s = secs.find(x => x.head.startsWith(head));
  if (!s) { log(false, `${etq} · apartado "${head}" existe`); return; }
  const falta = campos.filter(f => {
    const v = MAY[f] ? String(p[f]).toUpperCase() : String(p[f]);
    return !s.text.includes(v);
  });
  log(falta.length === 0, `${etq} · "${head}" trae los ${campos.length} campos de ${p.priNom}`, falta.length ? 'FALTA: ' + falta.join(',') : 'ok');
  // Fecha de nacimiento: un dígito por casilla → el año debe aparecer partido en el apartado.
  const [y, m, d] = p.fn.split('-');
  log(s.text.replace(/\s/g, '').includes(y.split('').join('')) || s.text.includes(y),
    `${etq} · "${head}" trae la fecha de nacimiento (${d}/${m}/${y})`);
}
function noFiltra(full, valores, etq) {
  const sucio = valores.filter(v => full.includes(v));
  log(sucio.length === 0, `${etq} · no filtra datos de otra persona ni de la plantilla`, sucio.length ? 'APARECE: ' + sucio.join(',') : 'limpio');
}

// ============ 1) URI con 3 capturados, 2 víctimas, 3 testigos ============
const uri = await inspect('URI', caps3, vics2, tests3);
if (uri.error) { log(false, '[URI] documento generado', uri.error); }
else {
  const heads = uri.secs.map(s => s.head.split(' ').slice(0, 2).join(' '));
  log(true, '[URI] apartados encontrados', heads.join(' | ').slice(0, 200));
  ['4.', '4.1', '4.2'].forEach((h, i) => chkSeccion(uri.secs, h, caps3[i], CAMPOS_CAP, '[URI]'));
  ['5.', '5.1'].forEach((h, i) => chkSeccion(uri.secs, h, vics2[i], CAMPOS_VT, '[URI]'));
  ['6.', '6.1', '6.2'].forEach((h, i) => chkSeccion(uri.secs, h, tests3[i], CAMPOS_VT, '[URI]'));
  // El texto del encabezado original debe conservarse íntegro al renumerar.
  const s41 = uri.secs.find(s => s.head.startsWith('4.1'));
  log(!!s41 && /INFORMACI[ÓO]N DEL CAPTURADO/i.test(s41.head), '[URI] 4.1 conserva el título original del apartado', s41 && s41.head);
  const s51 = uri.secs.find(s => s.head.startsWith('5.1'));
  log(!!s51 && /V[ÍI]CTIMAS/i.test(s51.head), '[URI] 5.1 conserva el título original del apartado', s51 && s51.head);
  const s61 = uri.secs.find(s => s.head.startsWith('6.1'));
  log(!!s61 && /TESTIGOS/i.test(s61.head), '[URI] 6.1 conserva el título original del apartado', s61 && s61.head);
  // Cada copia replica la misma estructura de tablas que el apartado original.
  const t4 = uri.secs.find(s => s.head.startsWith('4.'))?.tbl;
  log(uri.secs.filter(s => /^4\.\d/.test(s.head)).every(s => s.tbl === t4), '[URI] las copias de 4 tienen las mismas tablas que el original', 'tablas/apartado=' + t4);
  // 35 tablas base + 9 por capturado extra + 8 por víctima extra + 8 por testigo extra
  log(uri.nTbl === 35 + 2 * 9 + 1 * 8 + 2 * 8, '[URI] total de tablas del documento', uri.nTbl);
  noFiltra(uri.full, ['DAYNIS', 'GONZALES', 'ZAMBRANO', 'Daniel.romang@correo.policia.gov.co', '1055000122', 'Chinchiná'], '[URI]');
  log(!/Senales particulares/.test(uri.full) && /Señales particulares/.test(uri.full), '[URI] la etiqueta "Señales particulares visibles" conserva la ñ del formato');
  log(uri.dupBmk.length === 0, '[URI] las copias no duplican marcadores (Word los exige únicos)', uri.dupBmk.join(',') || 'sin duplicados');
  log(uri.dupPid.length === 0, '[URI] las copias no duplican paraId de párrafo', uri.dupPid.slice(0, 3).join(',') || 'sin duplicados');
  // Misma geometría = los bordes de las copias caen exactamente donde los del apartado original.
  [['4', '4.1'], ['4', '4.2'], ['5', '5.1'], ['6', '6.1'], ['6', '6.2']].forEach(([a, b]) => {
    const sa = uri.secs.find(s => s.head.startsWith(a + '.') && !/^\d\.\d/.test(s.head));
    const sb = uri.secs.find(s => s.head.startsWith(b));
    const ok = sa && sb && sa.geo.length === sb.geo.length && sa.geo.every((g, i) => g === sb.geo[i]);
    log(!!ok, `[URI] ${b} tiene la misma geometría de tablas que ${a} (anchos, sangría, bordes)`, sa && sb ? `${sa.geo.length} vs ${sb.geo.length} tablas` : 'apartado no hallado');
  });
  // La nota del formato ("se pueden reproducir las casillas…") queda una sola vez, al final.
  log(uri.notas.length === 3, '[URI] la nota "se pueden reproducir las casillas" aparece una vez por apartado', uri.notas.length);
  const posNota4 = uri.notas[0].pos, ultima42 = uri.secs.find(s => s.head.startsWith('4.2')).pos;
  log(posNota4 > ultima42, '[URI] la nota del apartado 4 queda después de la última copia (4.2)');
}

// ============ 2) CESPA (menores) con 2 aprehendidos y 2 testigos, sin víctima ============
const cespa = await inspect('CESPA', [persona(1, 'MEN'), persona(2, 'MEN')], [], [persona(1, 'TES'), persona(2, 'TES')]);
if (cespa.error) { log(false, '[CESPA] documento generado', cespa.error); }
else {
  chkSeccion(cespa.secs, '4.', persona(1, 'MEN'), CAMPOS_CAP, '[CESPA]');
  chkSeccion(cespa.secs, '4.1', persona(2, 'MEN'), CAMPOS_CAP, '[CESPA]');
  chkSeccion(cespa.secs, '6.1', persona(2, 'TES'), CAMPOS_VT, '[CESPA]');
  const s41 = cespa.secs.find(s => s.head.startsWith('4.1'));
  log(!!s41 && /APREHENDIDO/i.test(s41.head), '[CESPA] 4.1 mantiene la terminología de menores (aprehendido)', s41 && s41.head);
  const s5 = cespa.secs.find(s => s.head.startsWith('5.'));
  log(!!s5 && !/NOMVIC|NOMMEN/.test(s5.text), '[CESPA] sin víctima: el apartado 5 queda vacío, no repetido');
  log(!cespa.secs.some(s => /^5\.\d/.test(s.head)), '[CESPA] sin víctima no se generan apartados 5.1');
  noFiltra(cespa.full, ['DANIEL', 'ROMAN', 'GIRALDO', 'Daniel.romang@correo.policia.gov.co'], '[CESPA]');
}

// ============ 3) Una sola persona por rol: el documento no cambia de forma ============
const uno = await inspect('URI', [persona(1, 'CAP')], [persona(1, 'VIC')], [persona(1, 'TES')]);
if (uno.error) { log(false, '[1 persona] documento generado', uno.error); }
else {
  log(uno.nTbl === 35, '[1 persona] no se añaden tablas: el formato queda igual que siempre', uno.nTbl);
  log(!uno.secs.some(s => /^\d\.\d/.test(s.head)), '[1 persona] no aparecen apartados 4.1/5.1/6.1');
  chkSeccion(uno.secs, '4.', persona(1, 'CAP'), CAMPOS_CAP, '[1 persona]');
}

// ============ 4) Sin víctima ni testigo (OJ): esos apartados quedan en blanco ============
const solo = await inspect('URI', [persona(1, 'CAP'), persona(2, 'CAP')], [], []);
if (solo.error) { log(false, '[sin víctima/testigo] documento generado', solo.error); }
else {
  const s5 = solo.secs.find(s => s.head.startsWith('5.'));
  const s6 = solo.secs.find(s => s.head.startsWith('6.'));
  log(!!s5 && !/NOM(VIC|CAP|TES)/.test(s5.text), '[sin víctima] apartado 5 en blanco');
  log(!!s6 && !/NOM(VIC|CAP|TES)/.test(s6.text), '[sin testigo] apartado 6 en blanco');
  log(!/Edad:\s*\d/.test((s5 ? s5.text : '') + (s6 ? s6.text : '')), '[sin víctima/testigo] la edad queda en blanco, no imprime un "00" inventado');
  log(solo.secs.some(s => s.head.startsWith('4.1')), '[sin víctima/testigo] el 2º capturado sí se repite');
}

// ============ 5) Muchas personas: sin tope ============
const many = await inspect('URI', Array.from({ length: 6 }, (_, i) => persona(i + 1, 'CAP')), [persona(1, 'VIC')], [persona(1, 'TES')]);
if (many.error) { log(false, '[6 capturados] documento generado', many.error); }
else {
  const nums = many.secs.filter(s => /^4(\.\d)?[.\s]/.test(s.head)).map(s => s.head.split(/\s/)[0]);
  log(nums.length === 6, '[6 capturados] se generan 6 apartados sin tope', nums.join(' '));
  log(/^4\.$|^4$/.test(nums[0]) && nums[1] === '4.1' && nums[5] === '4.5', '[6 capturados] numeración correlativa 4, 4.1 … 4.5', nums.join(' '));
  chkSeccion(many.secs, '4.5', persona(6, 'CAP'), CAMPOS_CAP, '[6 capturados]');
}

log(consoleErrors.length === 0, 'Sin errores de consola', consoleErrors.slice(0, 3).join(' | ') || 'limpio');

await browser.close();
server.close();
console.log('\n' + (fails === 0 ? '✅ TODO OK' : `❌ ${fails} comprobación(es) fallida(s)`));
process.exit(fails === 0 ? 0 : 1);
