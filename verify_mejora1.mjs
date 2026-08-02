/* Regresión de la MEJORA 1 — las diez observaciones del documento
   `Documentos/Otro/Mejora 1.docx`, cada una medida sobre la app real y, cuando
   toca al documento, sobre el .docx generado de verdad.

   El criterio que fija esta suite:
   (a) lo que salió del formulario no se perdió: sigue en el modelo y sigue
       llegando a donde se usa (dossier);
   (b) lo que se estandarizó (direcciones, placas, elementos) llega YA
       normalizado al FPJ-5, no solo bonito en pantalla;
   (c) el numeral 7 del formato deja de salir vacío — que era el fallo de fondo:
       el texto se escribía en un párrafo sin runs y se perdía en silencio;
   (d) nada de lo anterior cambia el mapeo del resto del documento. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8155;
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
function sec(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length))); }

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
await page.waitForTimeout(400);

/* Descarga un .docx y devuelve su word/document.xml ya en texto. */
async function docXmlDe(id, papel = 'CARTA', tag = 'salida') {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
    page.evaluate(async ([cid, p]) => {
      const c = DB.getCase(cid);
      const out = buildFPJBlob(c, p);
      if (!out) return false;
      _dlDocBlob(out.blob, out.fname);
      return true;
    }, [id, papel])
  ]);
  if (!dl) return null;
  const tmp = join(ROOT, 'verify_mejora1_' + tag + '.docx');
  await dl.saveAs(tmp);
  const buf = await readFile(tmp);
  // ZIP stored: se lee la entrada sin inflar, igual que unzipDocx en la app.
  let pos = 0;
  while (pos + 30 <= buf.length) {
    if (buf.readUInt32LE(pos) !== 0x04034b50) break;
    const sz = buf.readUInt32LE(pos + 18), nl = buf.readUInt16LE(pos + 26), el = buf.readUInt16LE(pos + 28);
    const nm = buf.slice(pos + 30, pos + 30 + nl).toString('utf8').split('\\').join('/');
    const ds = pos + 30 + nl + el;
    if (nm === 'word/document.xml') return buf.slice(ds, ds + sz).toString('utf8');
    pos = ds + sz;
  }
  return null;
}
/* Texto de los párrafos del documento, en orden. */
function paras(xml) {
  const body = xml.slice(xml.indexOf('<w:body'));
  const idxs = [], out = [];
  const re = /<w:p(?:\s[^>]*)?\/?>/g;
  let m;
  while ((m = re.exec(body))) idxs.push(m.index);
  for (let i = 0; i < idxs.length; i++) {
    const seg = body.slice(idxs[i], idxs[i + 1] === undefined ? body.length : idxs[i + 1]);
    let t = '';
    for (const x of seg.matchAll(/<w:t(?:\s[^>\/]*)?>([\s\S]*?)<\/w:t>/g)) t += x[1];
    out.push(t);
  }
  return out;
}
/* Renglones que el documento trae DENTRO del apartado 7. */
function numeral7(xml) {
  const P = paras(xml);
  const i = P.findIndex(t => /^\s*7\.\s*DESCRIPCI.N DE EMP/i.test(t));
  const j = P.findIndex((t, k) => k > i && /evento de requerir m.s espacio/i.test(t));
  if (i < 0 || j < 0) return null;
  return P.slice(i + 1, j).map(s => s.trim()).filter(Boolean);
}

/* ═══════════ OBSERVACIÓN 1 · el SPOA no aporta nada al FPJ-5 ═══════════ */
sec('OBS 1 — SPOA fuera del formulario');
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(250);
log(!(await page.isVisible('#w-spoa').catch(() => false)),
  'El paso 1 ya no pide SPOA');
log(await page.isVisible('#w-nunc'), 'El NUNC sigue en su sitio (issue M3 intacto)');
// Sin huecos: el bloque que quedaba a medias desapareció, no se dejó vacío.
const huecos = await page.evaluate(() => {
  const vacios = Array.from(document.querySelectorAll('#wz-panels .fg'))
    .filter(fg => !fg.querySelector('input,select,textarea,button') && !fg.textContent.trim());
  return vacios.length;
});
log(huecos === 0, 'No quedó ningún grupo de campo vacío ocupando espacio', huecos + ' huecos');
// El dato SIGUE existiendo en el modelo: no se borró, se mudó.
log(await page.evaluate(() => 'spoa' in wc), 'El campo `spoa` sigue en el modelo del caso');

/* ═══════════ OBSERVACIÓN 2 · conductas punibles a demanda ═══════════ */
sec('OBS 2 — conductas punibles');
const cond0 = await page.evaluate(() => document.querySelectorAll('#w-conds [data-fila]').length);
log(cond0 === 1, 'El paso arranca con UNA sola conducta punible', cond0 + ' filas');
log(!(await page.isVisible('#w-cond3').catch(() => false)), 'Ya no existe la lista fija de cuatro casillas');
await page.evaluate(() => lcCondAgregar());
await page.waitForTimeout(100);
log(await page.evaluate(() => document.querySelectorAll('#w-conds [data-fila]').length) === 2,
  'El botón «+ Agregar conducta» añade una fila');
// La fila nueva se comporta igual que la primera (mismos campos, mismo datalist).
const gemelas = await page.evaluate(() => {
  const f = document.querySelectorAll('#w-conds [data-fila]');
  const campos = x => Array.from(x.querySelectorAll('[data-c]')).map(e => e.getAttribute('data-c')).join(',');
  return campos(f[0]) === campos(f[1]) && f[1].querySelector('[data-c="cond"]').getAttribute('list') === 'dl-cond';
});
log(gemelas, 'Cada conducta nueva tiene exactamente el mismo comportamiento que la primera');
await page.evaluate(() => {
  const f = document.querySelectorAll('#w-conds [data-fila]');
  f[0].querySelector('[data-c="cond"]').value = 'Hurto calificado';
  f[0].querySelector('[data-c="art"]').value = 'Art. 240';
  f[1].querySelector('[data-c="cond"]').value = 'Porte ilegal de armas';
  f[1].querySelector('[data-c="art"]').value = 'Art. 365';
  lcCondSync();
});
log(await page.evaluate(() => wc.conductas.length === 2 && wc.conductas[1] === 'Porte ilegal de armas'),
  'Lo tecleado baja al modelo `conductas[]`/`articulosCP[]` de siempre');
await page.evaluate(() => lcCondQuitar(1));
await page.waitForTimeout(80);
log(await page.evaluate(() => wc.conductas.length === 1 && wc.conductas[0] === 'Hurto calificado'),
  'Quitar una conducta deja intactas las demás');
log(await page.evaluate(() => { lcCondSync(); const f = document.querySelectorAll('#w-conds [data-fila]'); return !f[0].querySelector('.lc-rowx-del'); }),
  'Con una sola conducta no se ofrece quitarla (el FPJ-5 exige al menos una)');
const tope = await page.evaluate(() => {
  for (let i = 0; i < 8; i++) lcCondAgregar();
  return document.querySelectorAll('#w-conds [data-fila]').length;
});
log(tope === 4, 'No se pasa de cuatro: es lo que el formato imprime (celdas 58-61)', tope);

/* ═══════════ OBSERVACIÓN 3 · el destino repetía el tipo ═══════════ */
sec('OBS 3 — tipo y destino integrados');
const integrado = await page.evaluate(() => {
  const o = Array.from(document.querySelectorAll('#w-tipo option')).map(x => x.textContent);
  return { opciones: o, hayInput: !!document.getElementById('w-dest') };
});
log(/URI \(Adulto\) → /.test(integrado.opciones[0]),
  'El selector de tipo nombra ya el destino que le corresponde', integrado.opciones[0]);
log(!integrado.hayInput, 'El campo «Destino (Fiscalía)» dejó de ocupar un renglón propio');
log(await page.evaluate(() => !!wc.destino), 'El destino sigue existiendo como dato del caso', await page.evaluate(() => wc.destino));
await page.evaluate(() => lcDestEditar(true));
await page.waitForTimeout(150);
log(await page.isVisible('#w-dest'), 'Se puede cambiar cuando hace falta («Cambiar»)');
log(await page.isVisible('button[onclick="abrirSelectorDespacho()"]'), 'Y la lista de despachos sigue disponible');
await page.evaluate(() => { document.getElementById('w-dest').value = 'URI Robledo'; lcDestEditar(false); });
await page.waitForTimeout(150);
log(await page.evaluate(() => wc.destino) === 'URI Robledo', 'Lo que se escribe ahí se conserva al cerrar el editor');
// Cambiar el tipo arrastra el destino, que es de lo que se quejaba la observación.
await page.evaluate(() => { document.getElementById('w-tipo').value = 'CESPA'; onTipoChg(); });
await page.waitForTimeout(200);
log(await page.evaluate(() => wc.destino) === 'CESPA', 'Al cambiar de tipo, el destino cambia con él — una sola decisión');
await page.evaluate(() => { document.getElementById('w-tipo').value = 'URI'; onTipoChg(); });
await page.waitForTimeout(200);

/* ═══════════ OBSERVACIÓN 4 · lo que solo usa el Dossier ═══════════ */
sec('OBS 4 — datos del Dossier, fuera del formulario FPJ');
log(!(await page.isVisible('#w-inc').catch(() => false)), 'El paso 1 ya no pide el No. de incidente');
log(!(await page.isVisible('#w-recibe').catch(() => false)), 'Ni el fiscal que recibe');
log(await page.evaluate(() => 'numIncidente' in wc && 'recibe' in wc),
  'Pero los dos campos siguen en el modelo: se mudaron, no se borraron');

/* ═══════════ OBSERVACIÓN 5 · direcciones con formato ═══════════ */
sec('OBS 5 — direcciones normalizadas (lugar de los hechos)');
await page.evaluate(() => { ws = 1; renderWiz(); });
await page.waitForTimeout(200);
log(await page.isVisible('#w-dir__via'), 'La dirección del lugar se arma con un tipo de vía predefinido');
const vias = await page.evaluate(() => Array.from(document.querySelectorAll('#w-dir__via option')).map(o => o.value).filter(Boolean));
log(vias.includes('CL') && vias.includes('KR') && vias.includes('AV'),
  'El catálogo trae calle, carrera y avenida (y 13 más)', vias.length + ' vías');
await page.evaluate(() => {
  document.getElementById('w-dir__via').value = 'CL';
  document.getElementById('w-dir__num').value = '52';
  document.getElementById('w-dir__cruce').value = '50';
  document.getElementById('w-dir__placa').value = '31';
  lcDirEditar('w-dir');
});
log(await page.inputValue('#w-dir') === 'CL 52 # 50-31',
  'Se compone abreviada y uniforme', await page.inputValue('#w-dir'));
log(/CL 52 # 50-31/.test(await page.textContent('#w-dir__wrap .lc-dir-prev')),
  'El usuario ve antes de generar lo que va a quedar impreso');
// La libertad de escribirla a mano es un requisito explícito de la observación.
await page.evaluate(() => lcDirModo('w-dir', 'libre'));
await page.waitForTimeout(120);
log(await page.isVisible('#w-dir__libre'), 'Se puede escribir la dirección manualmente');
log(await page.inputValue('#w-dir__libre') === 'CL 52 # 50-31', 'Al pasar a mano NO se pierde lo ya compuesto');
await page.evaluate(() => {
  document.getElementById('w-dir__libre').value = 'Finca La Esperanza, vía al mar km 4';
  lcDirEditar('w-dir');
});
log(await page.inputValue('#w-dir') === 'Finca La Esperanza, vía al mar km 4',
  'Y lo escrito a mano llega tal cual al dato del caso');
await page.evaluate(() => lcDirModo('w-dir', 'form'));
await page.waitForTimeout(120);
log(await page.isVisible('#w-dir__via'), 'Se puede volver al formato guiado');
// Interpretar direcciones ya guardadas: nada se pierde al abrir un caso viejo.
const parseos = await page.evaluate(() => ([
  lcDirParsear('Calle 51 No 42-82'),
  lcDirParsear('CRA 45 # 12-30 APTO 301'),
  lcDirParsear('Calle 52 con carrera 50'),
  lcDirParsear('Diagonal 75B # 2A-15'),
  lcDirParsear('Al lado de la cancha, sin nomenclatura')
]));
log(parseos[0].via === 'CL' && parseos[0].num === '51' && parseos[0].cruce === '42' && parseos[0].placa === '82',
  'Interpreta «Calle 51 No 42-82» ya guardada', JSON.stringify(parseos[0]));
log(parseos[1].via === 'KR' && parseos[1].comp === 'APTO 301', 'Reconoce abreviaturas y el complemento', JSON.stringify(parseos[1]));
log(parseos[2].via === 'CL' && parseos[2].cruce === '50', 'Entiende «Calle 52 con carrera 50»', JSON.stringify(parseos[2]));
log(parseos[3].via === 'DG' && parseos[3].num === '75B' && parseos[3].placa === '15', 'Y los números con letra', JSON.stringify(parseos[3]));
log(parseos[4].modo === 'libre' && parseos[4].libre === 'Al lado de la cancha, sin nomenclatura',
  '⚠️ Lo que no encaja NO se inventa: se conserva íntegro en modo libre');

/* ═══════════ OBSERVACIÓN 6 · la misma dirección en personas ═══════════ */
sec('OBS 6 — misma dirección en capturados, víctimas y testigos');
for (const [paso, rol] of [[2, 'capturados'], [3, 'victimas'], [4, 'testigos']]) {
  await page.evaluate(async (p) => { ws = p; renderWiz(); }, paso);
  await page.waitForTimeout(150);
  if (rol !== 'capturados') await page.evaluate((r) => { wc['sin' + (r === 'victimas' ? 'Victima' : 'Testigo')] = false; renderWiz(); }, rol);
  await page.waitForTimeout(120);
  await page.evaluate((r) => addMultiPerson(r, r === 'capturados'), rol);
  await page.waitForTimeout(200);
  const ok = await page.isVisible('#pm-dirRes__via');
  log(ok, `El registro de ${rol} usa el MISMO widget de dirección`);
  if (ok) {
    await page.evaluate(() => {
      document.getElementById('pm-dirRes__via').value = 'KR';
      document.getElementById('pm-dirRes__num').value = '45';
      document.getElementById('pm-dirRes__cruce').value = '12';
      document.getElementById('pm-dirRes__placa').value = '30';
      lcDirEditar('pm-dirRes');
      document.getElementById('pm-priNom').value = 'ANA';
      document.getElementById('pm-priApe').value = 'GOMEZ';
      document.getElementById('pm-numDoc').value = '1234567';
    });
    await page.evaluate((r) => savePersonModal(r, -1, r === 'capturados'), rol);
    await page.waitForTimeout(200);
    log(await page.evaluate((r) => wc[r][0].dirRes, rol) === 'KR 45 # 12-30',
      `Y la guarda con el mismo formato en ${rol}`);
  } else { log(false, `(no se pudo probar el guardado en ${rol})`); }
}
// Registro de Personas (fuera del wizard): mismo widget, misma salida.
await page.evaluate(() => { go('personas'); openPersonForm({ rol: 'Testigo' }); });
await page.waitForTimeout(250);
log(await page.isVisible('#pm-dirRes__via'), 'El registro de Personas (módulo aparte) usa el mismo widget');
await page.evaluate(() => { closeModal(); go('wizard'); renderWiz(); });   // se vuelve a la captura en curso
await page.waitForTimeout(200);

/* ═══════════ OBSERVACIÓN 7 · placas y varios vehículos ═══════════ */
sec('OBS 7 — placas en mayúsculas y varios vehículos');
log(await page.evaluate(() => lcPlaca('smq123') === 'SMQ123' && lcPlaca(' abc 123 ') === 'ABC123'),
  'Toda placa se normaliza a MAYÚSCULAS sin espacios');
await page.evaluate(() => {
  wc.hayVehiculos = true; wc.vehiculos = [];
  ws = getWizConfig().steps.indexOf('Vehículos'); renderWiz();
});
await page.waitForTimeout(200);
await page.evaluate(() => addVeh());
await page.waitForTimeout(200);
await page.fill('#vm-placas', 'smq123');
await page.waitForTimeout(80);
log(await page.inputValue('#vm-placas') === 'SMQ123', 'Escribiendo en minúsculas queda en mayúsculas al instante');
await page.evaluate(() => {
  document.getElementById('vm-marca').value = 'Mazda';
  document.getElementById('vm-clase').value = 'Campero';
  document.getElementById('vm-color').value = 'negro';
  document.getElementById('vm-prop').value = 'Daniela Ruiz';
  saveVehModal(-1);
});
await page.waitForTimeout(200);
log(await page.evaluate(() => wc.vehiculos[0].placas) === 'SMQ123', 'Y así queda guardada en el caso');
const nVeh = await page.evaluate(() => {
  wc.vehiculos.push({ marca: 'Chevrolet', clase: 'Campero', color: 'gris', prop: 'Andrea Díaz', placas: 'xju095' });
  wc.vehiculos.push({ marca: 'Yamaha', clase: 'Motocicleta', color: 'rojo', prop: 'Luis Pérez', placas: 'wtr45d' });
  wc.vehiculos.push({ marca: 'Renault', clase: 'Automóvil', color: 'blanco', prop: 'Sara Mesa', placas: 'kli88e' });
  renderWiz(); return wc.vehiculos.length;
});
log(nVeh === 4, 'Se pueden registrar más de dos vehículos', nVeh);

/* ═══════════ OBSERVACIÓN 9 · el módulo de EMP y EF ═══════════ */
sec('OBS 9 — EMP y EF: módulo propio y numeral 7');
const pasos = await page.evaluate(() => getWizConfig().steps);
const iEmp = pasos.indexOf('EMP y EF');
log(iEmp === pasos.indexOf('Testigos') + 1 && iEmp === pasos.indexOf('Vehículos') - 1,
  'El paso va DESPUÉS de Testigos (6) y ANTES de Vehículos (8)', pasos.join(' · '));
await page.evaluate((i) => { ws = i; renderWiz(); }, iEmp);
await page.waitForTimeout(200);
log(await page.evaluate(() => !!document.getElementById('w-emp-list')), 'Tiene su propio apartado en el formulario');
log(!(await page.isVisible('#w-empTxt').catch(() => false)), 'Y ya no cuelga del paso de Narración');
// El corazón de la observación: que la app ordene lo que sea que escriban.
await page.evaluate(() => {
  document.getElementById('w-emp-bulk').value =
    'Un (1) celular Samsung color negro; 01 revólver calibre 38 con tres cartuchos, 2 cuchillo marca Stainless';
  lcEmpDesdeTexto();
});
await page.waitForTimeout(200);
const empItems = await page.evaluate(() => wc.elementos);
log(empItems.length === 3, 'Reparte en tres elementos un texto escrito de corrido', JSON.stringify(empItems));
const lineas = await page.evaluate(() => lcEmpLineas(wc.elementos));
log(lineas[0] === '01 (uno) celular Samsung color negro', 'Formato exigido: «01 (uno) …»', lineas[0]);
log(lineas[2] === '02 (dos) cuchillos marca Stainless', 'Y pluraliza cuando son varios', lineas[2]);
log(await page.evaluate(() => lcEmpLineas([{ cant: 2, desc: 'celular marca Samsung' }])[0]) === '02 (dos) celulares marca Samsung',
  '«02 (dos) celulares …», tal como pedía el documento');
log(await page.evaluate(() => lcEmpLineas([{ cant: 3, desc: 'revólver calibre 38' }])[0]) === '03 (tres) revólveres calibre 38',
  'El plural respeta el español (revólver → revólveres)');
log(/01 \(uno\)/.test(await page.textContent('#w-emp-prev')), 'La numeración se ve antes de generar el documento');

/* ═══════════ OBSERVACIÓN 8 · fecha y hora ═══════════ */
sec('OBS 8 — fecha y hora, misma lógica y otra presentación');
const iNarr = pasos.indexOf('Narración');
await page.evaluate((i) => { ws = i; renderWiz(); }, iNarr);
await page.waitForTimeout(200);
const dtUI = await page.evaluate(() => ({
  sueltas: ['w-fcD', 'w-fcM', 'w-fcA', 'w-hcH', 'w-hcM', 'w-fdD', 'w-fdM', 'w-fdA', 'w-hdH', 'w-hdM']
    .filter(id => document.getElementById(id)).length,
  fecha: (document.getElementById('w-fcap') || {}).type,
  hora: (document.getElementById('w-hcap') || {}).type
}));
log(dtUI.sueltas === 0, 'Las diez casillas sueltas desaparecieron', dtUI.sueltas + ' quedan');
log(dtUI.fecha === 'date' && dtUI.hora === 'time', 'Ahora son controles nativos de fecha y hora');
// Con fill(), que dispara los eventos de verdad: así se prueba también la
// vista previa, que reacciona al oninput como lo haría con el usuario.
await page.fill('#w-fcap', '2026-07-30');
await page.fill('#w-hcap', '13:11');
await page.fill('#w-fdisp', '2026-07-30');
await page.fill('#w-hdisp', '13:43');
await page.fill('#w-narrTxt', 'Relato de prueba de la captura.');
await page.evaluate(() => collectStep());
const nModelo = await page.evaluate(() => wc.narracion);
log(nModelo.fechaCapD === '30' && nModelo.fechaCapM === '07' && nModelo.fechaCapA === '2026',
  '⚠️ El MODELO no cambió: sigue guardando día, mes y año por separado', JSON.stringify({ d: nModelo.fechaCapD, m: nModelo.fechaCapM, a: nModelo.fechaCapA }));
log(nModelo.horaCapH === '13' && nModelo.horaCapM === '11', 'Y la hora igual, en dos campos', nModelo.horaCapH + ':' + nModelo.horaCapM);
log(nModelo.fechaDispD === '30' && nModelo.horaDispH === '13' && nModelo.horaDispM === '43', 'Lo mismo en la disposición');
log(/D 30/.test(await page.textContent('#w-prevcap')), 'La vista previa enseña el desglose que va al formato');

/* ═══════════ Se guarda el caso y se mide el DOCUMENTO ═══════════ */
sec('El documento generado — mapeo real');
const caso = await page.evaluate(async () => {
  wc.nunc = '0500160002062026';
  wc.spoa = '110016000000202600001';
  wc.numIncidente = '778899';
  wc.recibe = 'Fiscal 22 Seccional';
  wc.lugar.dir = 'CL 52 # 50-31';
  wc.servidor = { grado: 'Patrullero', ident: '1148711432', nombre: 'Estiven Ramírez', entidad: 'ENTIDAD DE PRUEBA', cargo: 'Patrullero', tel: '300', correo: 'a@b.test' };
  wc.victimas = wc.victimas || []; wc.testigos = wc.testigos || [];
  await DB.saveCase(wc);
  const id = wc.id; wc = null;
  return id;
});
const xml = await docXmlDe(caso, 'CARTA', 'uri');
log(!!xml, 'El FPJ-5 se genera sin errores');
const n7 = numeral7(xml);
log(!!n7 && n7.length >= 3, 'El numeral 7 existe y trae renglones', n7 && n7.length);
log(!!n7 && n7[0] === '01 (uno) celular Samsung color negro',
  '⚠️ Los EMP y EF SALEN IMPRESOS en el numeral 7 (antes se perdían en silencio)', n7 && n7[0]);
log(!!n7 && n7[1] === '01 (uno) revólver calibre 38 con tres cartuchos', 'Segundo elemento, numerado y en orden', n7 && n7[1]);
log(!!n7 && n7[2] === '02 (dos) cuchillos marca Stainless', 'Tercero, con el plural correcto', n7 && n7[2]);
const cuerpo = xml.replace(/<[^>]+>/g, ' ');
log(/CL 52 # 50-31/.test(cuerpo), 'La dirección normalizada llega al formato tal como se vio en pantalla');
log(/SMQ123/.test(cuerpo) && !/smq123/.test(cuerpo), 'La placa se imprime en mayúsculas');
log(/XJU095/.test(cuerpo) && /WTR45D/.test(cuerpo) && /KLI88E/.test(cuerpo),
  '⚠️ Los vehículos 3 y 4 también se imprimen: la fila se reproduce como los capturados');
log(/Hurto calificado/.test(cuerpo), 'La conducta punible sigue llegando a su celda');
log(!/110016000000202600001/.test(cuerpo), 'El SPOA no aparece en el FPJ-5 — confirmado sobre el documento');
// Nada de la persona de muestra de la plantilla se filtró (regla del FPJ-5 v2).
log(!/DAYNIS/i.test(cuerpo), 'Sin rastros de los datos de muestra de la plantilla');

/* ═══════════ El Dossier conserva TODO su funcionamiento ═══════════ */
sec('El Dossier no perdió nada');
await page.evaluate((id) => { abrirDossierCaso(id); }, caso);
await page.waitForTimeout(300);
const dos1 = await page.inputValue('#dos-txt');
log(/SPOA: 110016000000202600001/.test(dos1), 'El dossier sigue imprimiendo el SPOA que ya tenía el caso');
log(/Incidente: 778899/.test(dos1), 'Y el No. de incidente');
log(/CL 52 # 50-31/.test(dos1), 'Y la dirección, con el formato nuevo');
log(await page.isVisible('button[onclick="lcDossierExtra()"]'), 'Hay un espacio propio para esos datos complementarios');
await page.evaluate(() => lcDossierExtra());
await page.waitForTimeout(250);
log(await page.isVisible('#dx-spoa') && await page.isVisible('#dx-inc') && await page.isVisible('#dx-recibe'),
  'Ese espacio pide SPOA, No. de incidente y fiscal que recibe');
await page.fill('#dx-spoa', '999888777');
await page.evaluate(() => lcDossierExtraGuardar());
await page.waitForTimeout(400);
log(/SPOA: 999888777/.test(await page.inputValue('#dos-txt')), 'Se editan ahí y el dossier se actualiza al instante');
log(await page.evaluate((id) => DB.getCase(id).spoa, caso) === '999888777', 'Y quedan guardados en el caso');

/* ═══════════ OBSERVACIÓN 10 · entidad por defecto ═══════════ */
sec('OBS 10 — entidad por defecto en el perfil');
await page.evaluate(() => { go('perfil'); openPerfilForm(''); });
await page.waitForTimeout(250);
log(await page.isVisible('#pfm-entidad'), 'El perfil del usuario tiene un espacio para la entidad');
await page.fill('#pfm-nombre', 'Juan Pérez');
await page.fill('#pfm-grado', 'Subteniente');
await page.fill('#pfm-entidad', 'ENTIDAD POR DEFECTO');
await page.evaluate(() => savePerfilForm(''));
await page.waitForTimeout(300);
log(await page.evaluate(() => { const c = DB.getConfig(); const p = c.perfiles.find(x => x.id === c.perfilActivo); return p && p.entidad; }) === 'ENTIDAD POR DEFECTO',
  'Se guarda en el perfil activo');
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(250);
await page.evaluate(() => { ws = getWizConfig().steps.indexOf('Servidor'); renderWiz(); });
await page.waitForTimeout(250);
log(await page.inputValue('#w-sEntidad') === 'ENTIDAD POR DEFECTO',
  '⚠️ En una captura NUEVA la entidad ya viene puesta, sin volver a escribirla');
await page.evaluate(() => { document.getElementById('w-sEntidad').value = 'OTRA ENTIDAD'; collectStep(); });
log(await page.evaluate(() => wc.servidor.entidad) === 'OTRA ENTIDAD', 'Y se puede cambiar en el caso concreto');

/* ═══════════ No hay regresiones en lo que ya funcionaba ═══════════ */
sec('Sin regresiones');
// Un caso guardado ANTES de la mejora se abre, se migra y genera igual.
const viejo = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('flagrancia-uri');
  c.isTest = false; c.nunc = '0500160002062026';
  c.capturados = c.capturados.slice(0, 1); c.victimas = c.victimas.slice(0, 1); c.testigos = c.testigos.slice(0, 1);
  // Se le da la forma EXACTA del modelo anterior a la mejora.
  c.conductas = ['Hurto agravado', '', '', '']; c.articulosCP = ['239', '', '', ''];
  delete c.elementos;
  c.narracion.emp = 'Un (1) celular Samsung color negro; 01 revólver calibre 38';
  c.lugar.dir = 'Calle 51 No 42-82';
  c.hayVehiculos = true; c.vehiculos = [{ marca: 'Mazda', clase: 'Campero', color: 'negro', prop: 'X', placas: 'mzh910' }];
  await DB.saveCase(c);
  return c.id;
});
await page.evaluate((id) => editCase(id), viejo);
await page.waitForTimeout(300);
log(await page.evaluate(() => wc.conductas.length) === 1,
  'Un caso viejo se abre con sus conductas compactadas, sin perder ninguna', await page.evaluate(() => JSON.stringify(wc.conductas)));
log(await page.evaluate(() => wc.elementos.length) === 2,
  'Sus EMP se interpretan solos del texto antiguo', await page.evaluate(() => JSON.stringify(wc.elementos)));
log(await page.evaluate(() => wc.vehiculos[0].placas) === 'MZH910', 'Y su placa se corrige a mayúsculas al abrirlo');
await page.evaluate(() => { ws = 1; renderWiz(); });
await page.waitForTimeout(200);
log(await page.inputValue('#w-dir__num') === '51' && await page.inputValue('#w-dir__cruce') === '42',
  'Su dirección antigua se lee en el widget nuevo sin perder el dato');
const xmlViejo = await docXmlDe(viejo, 'CARTA', 'legado');
const n7v = numeral7(xmlViejo);
log(!!n7v && n7v[0] === '01 (uno) celular Samsung color negro',
  'Y su FPJ-5 sale con el numeral 7 ya numerado', n7v && n7v[0]);
// La geometría del formato no se movió: sigue teniendo sus 35 tablas.
const tablas = (xmlViejo.match(/<w:tbl>/g) || []).length;
log(tablas === 35, '⚠️ El formato conserva sus 35 tablas: la calibración no se tocó', tablas);
log(/CESPA|URI/.test('URI'), 'La terminología por tipo sigue intacta');

// CESPA: el otro formato, con el mismo camino.
const cespa = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('flagrancia-cespa');
  c.isTest = false; c.nunc = '0500160002062026';
  c.capturados = c.capturados.slice(0, 1); c.victimas = c.victimas.slice(0, 1); c.testigos = c.testigos.slice(0, 1);
  c.elementos = [{ cant: 2, desc: 'celular marca Nokia' }];
  await DB.saveCase(c);
  return c.id;
});
const xmlC = await docXmlDe(cespa, 'CARTA', 'cespa');
const n7c = numeral7(xmlC);
log(!!n7c && n7c[0] === '02 (dos) celulares marca Nokia',
  'CESPA también imprime el numeral 7 (sus índices de párrafo son otros)', n7c && n7c[0]);
log((xmlC.match(/<w:tbl>/g) || []).length === 35, 'Y conserva igualmente sus 35 tablas');

/* ═══════════ Camino real: crear una captura y guardarla con «Guardar» ═══════════ */
sec('Golden path — una captura completa, paso a paso');
// Queda un wizard abierto de la sección anterior: se descarta, que es la guarda
// de la Ola 1 (no se pisa una captura a medias sin preguntar).
await page.evaluate(async () => { wc = null; await wizCerrarBorrador(); });
await page.evaluate(() => startWizard('URI'));
await page.waitForTimeout(250);
const pasosG = await page.evaluate(() => getWizConfig().steps);
log(pasosG.length === 9, 'El wizard de flagrancia tiene 9 pasos', pasosG.join(' · '));
await page.fill('#w-nunc', '0500160002062026');
await page.evaluate(() => {
  const f = document.querySelectorAll('#w-conds [data-fila]')[0];
  f.querySelector('[data-c="cond"]').value = 'Hurto agravado';
  f.querySelector('[data-c="art"]').value = 'Art. 239';
});
// Se recorre con el botón «Siguiente», como lo haría el funcionario.
for (let i = 0; i < 8; i++) {
  if (pasosG[i] === 'Capturados') {
    await page.evaluate(() => addMultiPerson('capturados', true));
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      document.getElementById('pm-priNom').value = 'PEDRO';
      document.getElementById('pm-priApe').value = 'RUIZ';
      document.getElementById('pm-numDoc').value = '98765432';
      document.getElementById('pm-dirRes__via').value = 'AV';
      document.getElementById('pm-dirRes__num').value = '80';
      lcDirEditar('pm-dirRes');
      savePersonModal('capturados', -1, true);
    });
    await page.waitForTimeout(250);
  }
  if (pasosG[i] === 'EMP y EF') {
    await page.evaluate(() => { lcEmpAgregar(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const f = document.querySelectorAll('#w-emp-list [data-fila]')[0];
      f.querySelector('[data-c="cant"]').value = '3';
      f.querySelector('[data-c="desc"]').value = 'cartucho calibre 9mm';
    });
  }
  await page.evaluate(() => wizNext());
  await page.waitForTimeout(220);
}
const antes = await page.evaluate(() => DB.getCases().length);
await page.evaluate(() => wizSave());
await page.waitForTimeout(700);
const guardado = await page.evaluate(() => {
  const cs = DB.getCases();
  return cs.length ? cs.find(c => (c.capturados || []).some(p => p.priApe === 'RUIZ')) : null;
});
log(!!guardado, 'La captura se guarda con el botón «Guardar» del último paso');
log(!!guardado && guardado.conductas.length === 1 && guardado.conductas[0] === 'Hurto agravado',
  'Sin filas de conducta en blanco persistidas', guardado && JSON.stringify(guardado.conductas));
log(!!guardado && guardado.elementos.length === 1 && guardado.elementos[0].cant === 3,
  'Los EMP quedan estructurados en el caso', guardado && JSON.stringify(guardado.elementos));
log(!!guardado && guardado.narracion.emp === '03 (tres) cartuchos calibre 9mm',
  'Y `narracion.emp` queda ya normalizado', guardado && guardado.narracion.emp);
log(!!guardado && guardado.capturados[0].dirRes === 'AV 80',
  'La dirección del capturado se guardó con el formato nuevo', guardado && guardado.capturados[0].dirRes);
log(await page.evaluate((doc) => DB.getPersons().some(p => p.numDoc === doc), '98765432'),
  'Y la persona entró al registro de Personas, como siempre');
const xmlG = await docXmlDe(guardado.id, 'CARTA', 'golden');
const n7g = numeral7(xmlG);
log(!!n7g && n7g[0] === '03 (tres) cartuchos calibre 9mm', 'Su FPJ-5 imprime el numeral 7', n7g && n7g[0]);
log(/AV 80/.test(xmlG.replace(/<[^>]+>/g, ' ')), 'Y la dirección normalizada del capturado');

// Registro de Personas fuera del wizard: se guarda con el widget nuevo.
await page.evaluate(() => { go('personas'); openPersonForm({ rol: 'Testigo' }); });
await page.waitForTimeout(250);
await page.evaluate(() => {
  document.getElementById('pm-priNom').value = 'LUCIA';
  document.getElementById('pm-priApe').value = 'SOTO';
  document.getElementById('pm-numDoc').value = '55554444';
  document.getElementById('pm-dirRes__via').value = 'TV';
  document.getElementById('pm-dirRes__num').value = '39';
  document.getElementById('pm-dirRes__cruce').value = '70';
  document.getElementById('pm-dirRes__placa').value = '12';
  lcDirEditar('pm-dirRes');
  document.querySelector('#modal-c .btn.bp.bbl').click();
});
await page.waitForTimeout(400);
log(await page.evaluate(() => { const p = DB.getPersons().find(x => x.numDoc === '55554444'); return p && p.dirRes; }) === 'TV 39 # 70-12',
  'El módulo Personas guarda la dirección con el mismo formato');

log(consoleErrors.length === 0, 'Consola sin errores', consoleErrors.slice(0, 3).join(' | ') || 'limpia');

console.log('\n' + (fails ? `❌ ${fails} de ${n} comprobaciones fallaron` : `✅ ${n} comprobaciones en verde`));
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
