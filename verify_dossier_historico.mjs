/* Regresión de la INTEGRIDAD HISTÓRICA DEL DOSSIER (Fase F de la auditoría).

   El defecto que se corrigió: «Conocieron el caso», la patrulla, VERDE 3 y
   DIAMANTE 3 se resolvían leyendo `cfg` en el momento de IMPRIMIR, y el caso no
   guardaba nunca esa foto. Un ascenso de grado reescribía, retroactivamente y
   sin avisar, el dossier de todas las capturas anteriores.

   La prueba central de esta suite es la que el propio encargo pedía (§39):
   crear un caso → cambiar el perfil → comprobar que el caso VIEJO no cambió y
   que el NUEVO sí recoge el cambio.

   ⚠️ Y la mitad que se comprueba aparte: que una captura guardada ANTES de esta
   fase —sin foto— siga imprimiendo lo mismo que imprimía. Nada se migra a la
   fuerza. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8176;
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

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.fill('#pin-a', '2468'); await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(900);

/* Siembra: un equipo con dos perfiles y la sección del dossier configurada por
   referencia a uno de ellos. */
const PID = await page.evaluate(async () => {
  const c = DB.getConfig();
  c.perfiles = [
    { id: 'p1', grado: 'Subintendente', nombre: 'NELSON DAVID GOMEZ', cedula: '111', cargo: '', entidad: '', correo: '' },
    { id: 'p2', grado: 'Patrullero', nombre: 'JUAN PEREZ', cedula: '222', cargo: '', entidad: '', correo: '' }
  ];
  c.perfilActivo = 'p1';
  c.conocieronFuncionarios = [{ pid: 'p1', nom: 'SI NELSON DAVID GOMEZ' }, { pid: 'p2', nom: 'PT JUAN PEREZ' }];
  c.dosVerde3 = { pid: 'p1', nom: 'SI NELSON DAVID GOMEZ' };
  c.dosDiamante3 = 'Teniente Laura Gómez Ríos';
  c.patrullaNum = '32'; c.patrullaUnidad = 'CAI Parque Bolívar';
  await DB.saveConfig(c);
  return 'p1';
});

console.log('\n── I · La configuración guarda REFERENCIAS y las resuelve ──\n');
{
  const r = await page.evaluate(() => {
    const c = DB.getConfig();
    return { lista: getConocieronList(c), v3: lcRefTexto(c, c.dosVerde3), d3: lcRefTexto(c, c.dosDiamante3) };
  });
  log(r.lista[0] === 'SI NELSON DAVID GOMEZ' && r.lista[1] === 'PT JUAN PEREZ',
    'Una referencia a un perfil se resuelve con la abreviatura del grado', r.lista.join(' / '));
  log(r.v3 === 'SI NELSON DAVID GOMEZ', 'VERDE 3 por referencia se resuelve igual', r.v3);
  log(r.d3 === 'Teniente Laura Gómez Ríos', 'Y el texto libre se conserva tal cual', r.d3);

  const legado = await page.evaluate(() => {
    const c = JSON.parse(JSON.stringify(DB.getConfig()));
    c.conocieronFuncionarios = ['SI Nelson David', 'PT Juan Pérez'];
    return getConocieronList(c);
  });
  log(legado.join(' / ') === 'SI Nelson David / PT Juan Pérez',
    '⚠️ Una configuración guardada ANTES de la Fase F sigue leyéndose igual', legado.join(' / '));
}

console.log('\n── II · El caso congela la foto al guardarse ──\n');
{
  const caso = await page.evaluate(async () => {
    const c = { id: 'caso-viejo', tipo: 'URI', created: Date.now(),
      capturados: [{ id: 'x1', nombre: 'PEDRO LOPEZ', tipoDoc: 'CC', doc: '999' }],
      conductas: [{ cond: 'Hurto agravado' }], narracion: {}, lugar: {}, destino: 'Fiscalía URI' };
    lcCongelarDossier(c);
    await DB.saveCase(c);
    return DB.getCases().filter(x => x.id === 'caso-viejo')[0];
  });
  log(!!caso.dossierSnap, 'Al guardarse, el caso lleva su foto del dossier', 'caso.dossierSnap');
  log(caso.dossierSnap.patrulla === 'PATRULLA 32 CAI Parque Bolívar',
    'Con la patrulla resuelta', caso.dossierSnap.patrulla);
  log((caso.dossierSnap.conocieron || []).join(' / ') === 'SI NELSON DAVID GOMEZ / PT JUAN PEREZ',
    'Y los funcionarios ya resueltos a texto, no como referencia', (caso.dossierSnap.conocieron || []).join(' / '));
  log(caso.dossierSnap.verde3 === 'SI NELSON DAVID GOMEZ' && caso.dossierSnap.diamante3 === 'Teniente Laura Gómez Ríos',
    'VERDE 3 y DIAMANTE 3 también', caso.dossierSnap.verde3 + ' | ' + caso.dossierSnap.diamante3);
}

console.log('\n── III · LA PRUEBA DE CAMBIO DE PERFIL (§39 del encargo) ──\n');
{
  const antes = await page.evaluate(() => genDossier(DB.getCases().filter(x => x.id === 'caso-viejo')[0]));
  log(/SI NELSON DAVID GOMEZ/.test(antes), 'El dossier del caso dice el grado con el que se emitió', 'SI …');

  /* El funcionario asciende: Subintendente → Intendente. */
  await page.evaluate(async () => {
    const c = DB.getConfig();
    c.perfiles.forEach(p => { if (p.id === 'p1') p.grado = 'Intendente'; });
    c.patrullaNum = '47'; c.patrullaUnidad = 'CAI Nuevo';
    await DB.saveConfig(c);
  });

  const despues = await page.evaluate(() => genDossier(DB.getCases().filter(x => x.id === 'caso-viejo')[0]));
  log(despues === antes,
    '⚠️ Tras el ascenso, el dossier del caso VIEJO no cambió ni un carácter', despues === antes ? 'idéntico' : 'CAMBIÓ');
  log(/SI NELSON DAVID GOMEZ/.test(despues) && !/IT NELSON/.test(despues),
    '  …sigue diciendo SI, que es el grado que tenía cuando se emitió', 'sin reescritura retroactiva');
  log(/PATRULLA 32/.test(despues) && !/PATRULLA 47/.test(despues),
    '  …y la patrulla que de verdad conoció el caso', 'PATRULLA 32');

  /* Un caso NUEVO sí recoge el cambio: es la otra mitad. */
  const nuevo = await page.evaluate(async () => {
    const c = { id: 'caso-nuevo', tipo: 'URI', created: Date.now(),
      capturados: [{ id: 'x2', nombre: 'MARIA RUIZ', tipoDoc: 'CC', doc: '888' }],
      conductas: [{ cond: 'Hurto agravado' }], narracion: {}, lugar: {}, destino: 'Fiscalía URI' };
    lcCongelarDossier(c);
    await DB.saveCase(c);
    return genDossier(DB.getCases().filter(x => x.id === 'caso-nuevo')[0]);
  });
  log(/IT NELSON DAVID GOMEZ/.test(nuevo),
    'Una captura NUEVA sí recoge el ascenso — la referencia estaba viva', 'IT …');
  log(/PATRULLA 47/.test(nuevo), '  …y la patrulla nueva', 'PATRULLA 47');
}

console.log('\n── IV · Editar una captura no reescribe su historia ──\n');
{
  const r = await page.evaluate(async () => {
    const c = DB.getCases().filter(x => x.id === 'caso-viejo')[0];
    const antes = JSON.stringify(c.dossierSnap);
    /* Se vuelve a guardar, como haría editCase → wizSave. */
    lcCongelarDossier(c);
    await DB.saveCase(c);
    const d = DB.getCases().filter(x => x.id === 'caso-viejo')[0];
    return { igual: JSON.stringify(d.dossierSnap) === antes, snap: d.dossierSnap };
  });
  log(r.igual, '⚠️ Volver a guardar un caso NO le pisa la foto que ya tenía', 'lcCongelarDossier no sobrescribe');
  log(r.snap.patrulla === 'PATRULLA 32 CAI Parque Bolívar', '  …conserva la patrulla original', r.snap.patrulla);
}

console.log('\n── V · Nada se migra a la fuerza ──\n');
{
  /* Una captura anterior a la Fase F no tiene foto: tiene que seguir imprimiendo
     lo que imprimía, o sea proyectando desde la configuración de hoy. */
  const r = await page.evaluate(async () => {
    const c = { id: 'caso-sin-foto', tipo: 'URI', created: Date.now(),
      capturados: [{ id: 'x3', nombre: 'LUIS DIAZ', tipoDoc: 'CC', doc: '777' }],
      conductas: [{ cond: 'Hurto agravado' }], narracion: {}, lugar: {}, destino: 'Fiscalía URI' };
    await DB.saveCase(c);            // ← se guarda SIN pasar por lcCongelarDossier
    const g = DB.getCases().filter(x => x.id === 'caso-sin-foto')[0];
    return { tieneSnap: !!g.dossierSnap, dossier: genDossier(g) };
  });
  log(!r.tieneSnap, 'Una captura sin foto se queda sin ella — no se migra al leerla', 'sin dossierSnap');
  log(/IT NELSON DAVID GOMEZ/.test(r.dossier) && /PATRULLA 47/.test(r.dossier),
    '  …y proyecta desde la configuración de hoy, como hacía antes', 'comportamiento anterior intacto');
}

console.log('\n── VI · La pantalla de Ajustes ──\n');
{
  await page.evaluate(() => go('ajustes'));
  await page.waitForTimeout(800);
  const ui = await page.evaluate(() => {
    const filas = document.querySelectorAll('#aj-con-list .aj-con-row');
    const sel = filas.length ? filas[0].querySelector('.aj-con-sel') : null;
    return {
      filas: filas.length,
      opciones: sel ? [...sel.options].map(o => o.text) : [],
      elegido: sel ? sel.value : null,
      inputOculto: filas.length ? filas[0].querySelector('.aj-con-inp').hidden : null,
      v3: !!document.getElementById('aj-verde3-box'),
      d3: !!document.getElementById('aj-diamante3-box')
    };
  });
  log(ui.filas === 2, 'Las filas de «Conocieron el caso» se pintan', ui.filas + ' filas');
  log(ui.opciones.some(o => /NELSON/.test(o)) && ui.opciones.some(o => /Otro/.test(o)),
    'Cada fila ofrece los perfiles registrados y «Otro»', ui.opciones.join(' | '));
  log(ui.elegido === 'p1', 'Con el perfil ya seleccionado', ui.elegido);
  log(ui.inputOculto === true, '  …y el campo de texto oculto mientras haya perfil elegido', 'sin ruido');
  log(ui.v3 && ui.d3, 'VERDE 3 y DIAMANTE 3 tienen el mismo control', '#aj-verde3-box · #aj-diamante3-box');

  /* Guardar desde la pantalla no puede perder la configuración. */
  await page.evaluate(() => saveAjustes());
  await page.waitForTimeout(700);
  const tras = await page.evaluate(() => {
    const c = DB.getConfig();
    return { n: (c.conocieronFuncionarios || []).length, v3: c.dosVerde3, lista: getConocieronList(c), legado: c.conocieronCaso };
  });
  log(tras.n === 2 && tras.lista.length === 2,
    'Guardar Ajustes conserva las dos referencias', JSON.stringify(tras.lista));
  log(tras.v3 && tras.v3.pid === 'p1', 'Y VERDE 3 sigue siendo una referencia viva', JSON.stringify(tras.v3));
  log(/IT NELSON/.test(tras.legado || ''),
    '⚠️ El campo legado en texto se mantiene sincronizado, para configuraciones exportadas', tras.legado);
}

console.log('\n── VII · Texto libre para quien no tiene perfil ──\n');
{
  const r = await page.evaluate(async () => {
    const c = DB.getConfig();
    c.conocieronFuncionarios = [{ pid: 'p1', nom: 'x' }, 'IJ FUNCIONARIO DE OTRA UNIDAD'];
    await DB.saveConfig(c);
    return getConocieronList(DB.getConfig());
  });
  log(r.length === 2 && r[1] === 'IJ FUNCIONARIO DE OTRA UNIDAD',
    'Una referencia y un texto libre conviven en la misma lista', r.join(' / '));

  /* Un perfil borrado no puede dejar la sección muda ni inventar un nombre. */
  const huerf = await page.evaluate(() => {
    const c = JSON.parse(JSON.stringify(DB.getConfig()));
    c.conocieronFuncionarios = [{ pid: 'NO-EXISTE', nom: 'SI ALGUIEN QUE SE FUE' }, { pid: 'TAMPOCO' }];
    return getConocieronList(c);
  });
  log(huerf.length === 1 && huerf[0] === 'SI ALGUIEN QUE SE FUE',
    '⚠️ Un perfil borrado usa el nombre de respaldo; sin respaldo no se inventa nada', JSON.stringify(huerf));
}

log(consoleErrors.length === 0, 'Sin errores de consola en todo el recorrido',
  consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'consola limpia');

await browser.close();
server.close();
console.log(fails === 0 ? `\n✅ TODO EN VERDE — ${n} comprobaciones\n` : `\n❌ ${fails} de ${n} comprobaciones fallaron\n`);
process.exit(fails === 0 ? 0 : 1);
