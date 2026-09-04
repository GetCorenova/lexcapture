/* Regresión de la MEJORA 8 — «Documentos/Otro/Mejora 8.docx».

   El requerimiento recorre el dossier de arriba abajo diciendo de dónde tiene
   que salir cada dato y cómo se escribe. Lo que se comprueba aquí es
   exactamente eso, sobre el TEXTO QUE SE VA A MANDAR, no sobre el código:

     I    · Encabezado — el rango, el saludo por la hora de la CAPTURA y las dos
            líneas de la unidad, cada una de su campo de Ajustes.
     II   · QUÉ / CUÁNDO / DÓNDE — captura o aprehensión, sin artículo del C.P.
     III  · QUIÉN y VÍCTIMA — los seis datos, en su orden, con la numeración
            «Capturado 1 / Capturado 2» solo cuando hay más de una persona.
     IV   · El orden de las secciones: VÍCTIMA después de QUIÉN.
     V    · Incautaciones y recuperaciones — el punto que el usuario pidió
            analizar con cuidado.
     VI   · Conocieron el caso · VERDE 3 · DIAMANTE 3 — grado abreviado con
            punto, mayor rango primero, un funcionario por renglón.
     VII  · Lo que NO podía romperse: el modelo, los documentos oficiales y la
            integridad histórica de la Fase F. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8188;
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
const sec = t => console.log('\n─── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

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

/* ═══ SIEMBRA ══════════════════════════════════════════════════════════════
   Un equipo configurado como el del requerimiento: distrito, estación,
   patrulla, los dos oficiales del mando y un perfil con su compañero. */
await page.evaluate(async () => {
  const c = DB.getConfig();
  c.rangoComandante = 'CORONEL';
  c.ojDependencia = 'Distrito tres de policía';
  c.nombreEstacion = 'CANDELARIA';
  c.patrullaNum = '32';
  c.patrullaUnidad = 'CAI Parque Bolívar';
  c.dosVerde3 = 'Teniente Coronel Jin Eduardo Moreno Padilla';
  c.dosDiamante3 = 'Teniente Coronel William Quintero';
  c.perfiles = [{
    id: 'p1', grado: 'Subintendente', nombre: 'Nelson David David', cedula: '111',
    cargo: '', entidad: '', correo: '',
    companero: { grado: 'Patrullero', nombre: 'Juan Córdoba García', cedula: '222' }
  }];
  c.perfilActivo = 'p1';
  delete c.dossierSecciones; delete c.dossierSeccionesV;
  await DB.saveConfig(c);
});

/* Caso base: flagrancia de mayores, hurto, un capturado, una víctima, EMP. */
const CASO = (extra = {}) => Object.assign({
  id: 'c1', tipo: 'URI', created: Date.now(), nunc: '0500160000002026' + '', destino: 'Fiscalía URI Medellín',
  spoa: '858418739876920263241', numIncidente: '797788',
  conductas: ['Hurto calificado y agravado'], articulosCP: ['239'],
  lugar: { dir: 'Calle 45 con carrera 43', barrio: 'Prado', muni: 'Medellín', depto: 'Antioquia' },
  narracion: {
    fechaCapD: '28', fechaCapM: '08', fechaCapA: '2026', horaCapH: '09', horaCapM: '37',
    texto: 'El día 28 de agosto de 2026, siendo las 09:37 horas, el suscrito Intendente Jefe Estiven Jhon González Sánchez, adscrito a CANDELARIA, en patrullaje por Prado, fue alertado por una ciudadana que señaló que un sujeto le hurtó su bolso. Al recorrer las inmediaciones se ubicó a Andrea Cardona Rodríguez, quien fue capturada en flagrancia y a quien se le halló el bolso de la afectada.'
  },
  capturados: [{
    id: 'x1', priNom: 'Andrea', segNom: '', priApe: 'Cardona', segApe: 'Rodríguez',
    tipoDoc: 'CC', numDoc: '1.122.598.923', expEn: 'La Estrella', fn: '1999-01-11',
    lugNac: 'Sabaneta, Antioquia', ecivil: 'Soltero/a', escol: 'Bachiller',
    ocup: 'Estudiante', correo: 'andrea.cardona49@ejemplo.test', alias: 'La Flaca'
  }],
  victimas: [{
    id: 'v1', priNom: 'Robinson', segNom: 'Natalia', priApe: 'García', segApe: 'González',
    tipoDoc: 'CC', numDoc: '1111613906', expEn: 'Medellín', fn: '1985-09-19',
    lugNac: 'Medellín, Antioquia', ecivil: 'Casado/a', escol: 'Primaria',
    ocup: 'Comerciante', correo: 'robinson.garcia92@ejemplo.test'
  }],
  testigos: [], elementos: [], hayVehiculos: false, vehiculos: []
}, extra);

const dossier = c => page.evaluate(caso => genDossier(caso), c);

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('I · ENCABEZADO');

let d = await dossier(CASO());
let L = d.split('\n');
log(L[0] === '*DIOS Y PATRIA MI CORONEL BUENOS DÍAS*',
  'Línea 1 · rango de Ajustes + saludo', L[0]);
log(L[1] === '*DISTRITO TRES DE POLICÍA*',
  'Línea 2 · sale COMPLETA del campo «Distrito de policía, seccional…»', L[1]);
log(L[2] === '*ESTACIÓN DE POLICÍA CANDELARIA*',
  'Línea 3 · el nombre de la estación de Ajustes', L[2]);

/* ⚠️ Que la línea 2 sea el campo TAL CUAL, y no una frase compuesta, se prueba
   con una unidad que NO es un distrito: antes salía «DISTRITO … DE POLICÍA»
   igual, nombrando como distrito lo que no lo es. */
await page.evaluate(async () => { const c = DB.getConfig(); c.ojDependencia = 'Seccional de investigación criminal'; await DB.saveConfig(c); });
d = await dossier(CASO());
log(d.split('\n')[1] === '*SECCIONAL DE INVESTIGACIÓN CRIMINAL*',
  'Una unidad que no es distrito ya no se nombra como distrito', d.split('\n')[1]);
await page.evaluate(async () => { const c = DB.getConfig(); c.ojDependencia = 'Distrito tres de policía'; await DB.saveConfig(c); });

/* Saludo POR LA HORA DE LA CAPTURA, no por la del envío. */
const saludo = async h => {
  const t = await dossier(CASO({ narracion: Object.assign({}, CASO().narracion, { horaCapH: h }) }));
  return (t.split('\n')[0].match(/MI CORONEL (.+)\*/) || [])[1];
};
const franjas = { '00': 'BUENAS NOCHES', '01': 'BUENOS DÍAS', '06': 'BUENOS DÍAS', '11': 'BUENOS DÍAS', '12': 'BUENAS TARDES', '17': 'BUENAS TARDES', '18': 'BUENAS NOCHES', '19': 'BUENAS NOCHES', '23': 'BUENAS NOCHES' };
let okFr = true, detalle = [];
for (const h of Object.keys(franjas)) {
  const r = await saludo(h);
  if (r !== franjas[h]) { okFr = false; detalle.push(h + 'h→' + r); }
}
log(okFr, 'Las franjas del saludo son las del requerimiento (01/12/18)',
  okFr ? 'DÍAS 01-11 · TARDES 12-17 · NOCHES 18-00' : detalle.join(' '));

/* La prueba de que se mira la captura y no el reloj: dos horas de captura
   distintas dan dos saludos distintos EN EL MISMO INSTANTE. */
log((await saludo('09')) !== (await saludo('20')),
  '⚠️ El saludo lo decide la hora de la CAPTURA, no la de envío', 'dos casos, un mismo reloj');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('II · QUÉ · CUÁNDO · DÓNDE');

d = await dossier(CASO());
log(/✅ \*QUÉ\*\nCaptura por Hurto calificado y agravado/.test(d),
  'QUÉ · «Captura por» en una captura de mayores', 'URI');
log(/✅ \*QUÉ\*\nAprehensión por Hurto/.test(await dossier(CASO({ tipo: 'CESPA' }))),
  'QUÉ · «Aprehensión por» cuando es de menores', 'CESPA');
log(/✅ \*QUÉ\*\nCaptura por Hurto simple$/m.test(await dossier(CASO({ conductas: ['Hurto simple Art. 239 C.P.'] }))),
  '⚠️ QUÉ · el delito va SIN artículo del Código Penal', 'no citar artículo, solo el nombre');
log(/✅ \*CUÁNDO\*\n28\/08\/2026 a las 09:37 horas/.test(d), 'CUÁNDO · fecha y hora del registro');
log(/✅ \*DÓNDE\*\nCalle 45 con carrera 43, Barrio Prado, Medellín - Antioquia/.test(d),
  'DÓNDE · la dirección que registra el procedimiento');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('III · QUIÉN Y VÍCTIMA — los seis datos, en su orden');

const bloque = (txt, etq) => {
  const m = new RegExp('✅ \\*' + etq + '\\*\\n([\\s\\S]*?)(?=\\n\\n✅|$)').exec(txt);
  return m ? m[1].split('\n') : [];
};
let q = bloque(d, 'QUIÉN');
const esperado = [
  'Andrea Cardona Rodríguez',
  'CC 1122598923 de La Estrella',
  'F.N 11/Ene/1999 en Sabaneta, Antioquia',
  'Edad 27 años',
  'Estado civil Soltero/a',
  'Ocupación Estudiante'
];
log(q.length === 6, 'Son exactamente SEIS renglones', q.length + ': ' + q.join(' | '));
log(q[0] === esperado[0], '1 · Nombres y apellidos', q[0]);
log(q[1] === esperado[1], '2 · Documento «CC <n> de <lugar>», sin puntos', q[1]);
log(q[2] === esperado[2], '3 · ⚠️ Fecha de nacimiento CON el lugar en la MISMA línea', q[2]);
log(/^Edad \d+ años$/.test(q[3]), '4 · Edad', q[3]);
log(q[4] === esperado[4], '5 · Estado civil', q[4]);
log(q[5] === esperado[5], '6 · Ocupación', q[5]);
log(!/Escolaridad|Correo|Alias|Lugar de nacimiento/.test(q.join('\n')),
  '⚠️ Y NO salen escolaridad, correo, alias ni «Lugar de nacimiento» aparte', 'los cuatro fuera');

let v = bloque(d, 'VÍCTIMA');
log(v.length === 6 && v[0] === 'Robinson Natalia García González' && /^F\.N 19\/Sep\/1985 en Medellín/.test(v[2]),
  'La víctima lleva los MISMOS datos y en el MISMO orden', v.join(' | '));

/* Numeración solo con más de una persona. */
log(!/Capturado 1/.test(d), 'Con UNA sola persona no se numera nada', 'sin «Capturado 1»');
const dos = CASO();
dos.capturados = [dos.capturados[0], Object.assign({}, dos.capturados[0], { id: 'x2', priNom: 'Camilo', priApe: 'Restrepo', numDoc: '71234567' })];
dos.victimas = [dos.victimas[0], Object.assign({}, dos.victimas[0], { id: 'v2', priNom: 'Marta', priApe: 'Ruiz', numDoc: '43111222' })];
let d2 = await dossier(dos);
log(/✅ \*QUIÉN\*\nCapturado 1\n/.test(d2) && /\nCapturado 2\n/.test(d2),
  'Con dos o más se numeran «Capturado 1 / Capturado 2»');
log(/\nVíctima 1\n/.test(d2) && /\nVíctima 2\n/.test(d2), 'Y las víctimas igual');
const d2c = await dossier(Object.assign({}, dos, { tipo: 'CESPA' }));
log(/\nAprehendido 1\n/.test(d2c) && !/Capturado 1/.test(d2c),
  '⚠️ En una captura de menores son «Aprehendido 1 / Aprehendido 2»');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('IV · EL ORDEN DE LAS SECCIONES');

const orden = t => (t.match(/✅ \*([^*]+)\*/g) || []).map(x => x.replace(/✅ \*|\*/g, ''));
let o = orden(d);
log(JSON.stringify(o.slice(0, 6)) === JSON.stringify(['QUÉ', 'CUÁNDO', 'DÓNDE', 'QUIÉN', 'VÍCTIMA', 'CÓMO']),
  '⚠️ VÍCTIMA va DESPUÉS de QUIÉN y antes de CÓMO', o.slice(0, 6).join(' → '));
log(o.indexOf('ES DEJADO A DISPOSICIÓN') > o.indexOf('CÓMO'), 'La disposición, después del relato');
log(o[o.length - 3] === 'Conocieron el caso' && o[o.length - 2] === 'VERDE 3' && o[o.length - 1] === 'DIAMANTE 3',
  'Y el cierre: conocieron · VERDE 3 · DIAMANTE 3', o.slice(-3).join(' → '));

/* La migración: un equipo con el orden ANTERIOR guardado adopta el nuevo sin
   perder lo que había decidido apagar ni sus secciones propias. */
const mig = await page.evaluate(async () => {
  const c = DB.getConfig();
  c.dossierSecciones = [
    { id: 'que', label: 'QUÉ', activa: true, orden: 1, tipo: 'conductas' },
    { id: 'cuando', label: 'CUÁNDO', activa: true, orden: 2, tipo: 'fecha_hora' },
    { id: 'donde', label: 'DÓNDE', activa: false, orden: 3, tipo: 'lugar' },
    { id: 'quien', label: 'QUIÉN', activa: true, orden: 4, tipo: 'capturado' },
    { id: 'como', label: 'CÓMO', activa: true, orden: 5, tipo: 'narracion' },
    { id: 'victima', label: 'VÍCTIMA', activa: true, orden: 6, tipo: 'victima' },
    { id: 'disposicion', label: 'ES DEJADO A DISPOSICIÓN', activa: true, orden: 7, tipo: 'despacho' },
    { id: 'conocieron', label: 'Conocieron el caso', activa: true, orden: 8, tipo: 'conocieron' },
    { id: 'verde3', label: 'VERDE 3', activa: true, orden: 9, tipo: 'verde3' },
    { id: 'diamante3', label: 'DIAMANTE 3', activa: true, orden: 10, tipo: 'diamante3' },
    { id: 'custom_x', label: 'MI NOTA', activa: true, orden: 11, tipo: 'texto_fijo', textoFijo: 'Texto propio' }
  ];
  delete c.dossierSeccionesV;
  await DB.saveConfig(c);
  const s = getDosierSecciones().sort((a, b) => a.orden - b.orden);
  return { ids: s.map(x => x.id), donde: s.filter(x => x.id === 'donde')[0].activa, nota: s.filter(x => x.id === 'custom_x')[0] };
});
log(mig.ids.indexOf('victima') === 4 && mig.ids.indexOf('como') === 5 && mig.ids.indexOf('emp') === 6,
  '⚠️ Un equipo con el orden viejo guardado adopta el nuevo', mig.ids.join(' → '));
log(mig.donde === false, '  …conservando lo que el usuario había DESACTIVADO', 'DÓNDE sigue apagada');
log(!!mig.nota && mig.nota.textoFijo === 'Texto propio', '  …y su sección personalizada, intacta');
await page.evaluate(async () => { const c = DB.getConfig(); delete c.dossierSecciones; delete c.dossierSeccionesV; await DB.saveConfig(c); });

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('V · INCAUTACIONES Y RECUPERACIONES');

const frases = async c => (await page.evaluate(x => dosEmpFrases(x), c));

log((await dossier(CASO())).indexOf('INCAUTACIÓN DE') < 0,
  'Sin EMP ni EF registrados la sección NO se imprime', 'el dossier de siempre');

const conArma = CASO({ conductas: ['Fabricación, tráfico y porte de armas de fuego'],
  elementos: [{ cant: 1, desc: 'revólver calibre 38 con tres cartuchos' }, { cant: 1, desc: 'cuchillo de cachas negras' }] });
let f = await frases(conArma);
log(JSON.stringify(f) === JSON.stringify(['INCAUTACIÓN DE ARMA DE FUEGO', 'INCAUTACIÓN DE ARMA CORTOPUNZANTE']),
  'Armas de fuego y cortopunzantes, con el nombre del requerimiento', f.join(' · '));

f = await frases(CASO({ conductas: ['Tráfico, fabricación o porte de estupefacientes'],
  elementos: [{ cant: 50, desc: 'bolsas de marihuana' }, { cant: 20, desc: 'papeletas de basuco' }, { cant: 5, desc: 'gramos de clorhidrato de cocaína' }] }));
log(JSON.stringify(f) === JSON.stringify(['INCAUTACIÓN DE MARIHUANA', 'INCAUTACIÓN DE BASUCO', 'INCAUTACIÓN DE CLORHIDRATO DE COCAÍNA']),
  'Cada sustancia con SU nombre, no un genérico', f.join(' · '));

/* El punto que el usuario pidió analizar: el mismo elemento cambia de verbo
   según el delito del caso. */
const moto = e => ({ conductas: [e], elementos: [], hayVehiculos: true, vehiculos: [{ clase: 'Motocicleta', marca: 'Bajaj', placas: 'ABC12D' }] });
f = await frases(CASO(moto('Hurto calificado')));
log(JSON.stringify(f) === JSON.stringify(['RECUPERACIÓN DE MOTOCICLETA']),
  '⚠️ La moto de un HURTO se RECUPERA', f.join(' · '));
f = await frases(CASO(moto('Tráfico, fabricación o porte de estupefacientes')));
log(JSON.stringify(f) === JSON.stringify(['INCAUTACIÓN DE MOTOCICLETA']),
  '⚠️ La misma moto en otro delito se INCAUTA', f.join(' · '));

f = await frases(CASO({ conductas: ['Hurto calificado'], elementos: [
  { cant: 2, desc: 'celulares marca Samsung' }, { cant: 1, desc: 'cadena de oro' },
  { cant: 1, desc: 'dinero en efectivo' }, { cant: 1, desc: 'revólver' }] }));
log(JSON.stringify(f) === JSON.stringify(['INCAUTACIÓN DE ARMA DE FUEGO', 'RECUPERACIÓN DE CELULAR', 'RECUPERACIÓN DE JOYAS', 'RECUPERACIÓN DE DINERO']),
  '⚠️ En un hurto: el arma se INCAUTA y lo hurtado se RECUPERA — en el mismo caso', f.join(' · '));

f = await frases(CASO({ conductas: ['Hurto calificado'],
  elementos: [{ cant: 1, desc: 'celular marca Samsung' }, { cant: 1, desc: 'celular marca Nokia' }] }));
log(JSON.stringify(f) === JSON.stringify(['RECUPERACIÓN DE CELULAR']),
  'Dos elementos del mismo tipo se funden en una sola línea', f.join(' · '));

f = await frases(CASO({ conductas: ['Daño en bien ajeno'], elementos: [{ cant: 1, desc: 'extintor de incendios, marca XYZ' }] }));
log(JSON.stringify(f) === JSON.stringify(['INCAUTACIÓN DE EXTINTOR DE INCENDIOS']),
  '⚠️ Lo que la app no reconoce conserva SU descripción, no cae en un genérico', f.join(' · '));

const dEmp = await dossier(CASO({ conductas: ['Hurto calificado'], elementos: [{ cant: 1, desc: 'celular marca Samsung' }] }));
o = orden(dEmp);
log(o[o.indexOf('CÓMO') + 1] === 'RECUPERACIÓN DE CELULAR' && o[o.indexOf('CÓMO') + 2] === 'ES DEJADO A DISPOSICIÓN',
  'En el dossier va DESPUÉS de CÓMO y antes de la disposición', o.slice(5, 8).join(' → '));
log(/✅ \*RECUPERACIÓN DE CELULAR\*/.test(dEmp),
  'Cada frase es su propia línea, sin etiqueta contenedora encima');
log((await dossier(CASO({ conductas: ['Hurto'], hayVehiculos: false, vehiculos: [{ clase: 'Motocicleta' }] }))).indexOf('MOTOCICLETA') < 0,
  'Si el funcionario dijo que NO hay vehículos, no se listan');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('VI · CONOCIERON EL CASO · VERDE 3 · DIAMANTE 3');

d = await dossier(CASO());
let cc = bloque(d, 'Conocieron el caso');
log(cc[0] === 'CAI Parque Bolívar, Patrulla 32',
  'Renglón 1 · la unidad y la patrulla, de Perfil → Mi jurisdicción', cc[0]);
log(cc[1] === 'S.I Nelson David David', '⚠️ Renglón 2 · el de MAYOR rango, abreviado y con punto', cc[1]);
log(cc[2] === 'P.T Juan Córdoba García', 'Renglón 3 · el compañero de patrulla', cc[2]);
log(cc.length === 3, 'Un funcionario POR RENGLÓN, no en una línea corrida', cc.length + ' renglones');

/* El orden por rango no es el de registro: se invierte el perfil y el dossier
   no cambia de orden. */
const inv = await page.evaluate(async () => {
  const c = DB.getConfig();
  c.perfiles[0].grado = 'Patrullero'; c.perfiles[0].nombre = 'Juan Córdoba García';
  c.perfiles[0].companero = { grado: 'Subintendente', nombre: 'Nelson David David' };
  await DB.saveConfig(c);
  return getConocieronList(DB.getConfig());
});
log(inv[0] === 'SI Nelson David David',
  '⚠️ Manda el RANGO, no quién es el titular del perfil', inv.join(' / '));
await page.evaluate(async () => {
  const c = DB.getConfig();
  c.perfiles[0].grado = 'Subintendente'; c.perfiles[0].nombre = 'Nelson David David';
  c.perfiles[0].companero = { grado: 'Patrullero', nombre: 'Juan Córdoba García' };
  await DB.saveConfig(c);
});

d = await dossier(CASO());
log(bloque(d, 'VERDE 3')[0] === 'T.C Jin Eduardo Moreno Padilla',
  'VERDE 3 · comandante de estación, grado abreviado con punto', bloque(d, 'VERDE 3')[0]);
log(bloque(d, 'DIAMANTE 3')[0] === 'T.C William Quintero',
  'DIAMANTE 3 · comandante del distrito, igual', bloque(d, 'DIAMANTE 3')[0]);

const abrev = await page.evaluate(() => ({
  entero: dosGradoPuntos('Teniente Coronel Jin Eduardo Moreno Padilla'),
  yaAb: dosGradoPuntos('SI Nelson David'),
  conPto: dosGradoPuntos('S.I Nelson David'),
  tresPal: dosGradoPuntos('Patrullero de Policía Ana Ruiz'),
  desconocido: dosGradoPuntos('Comisionado Especial Pedro Páez'),
  vacio: dosGradoPuntos('')
}));
log(abrev.entero === 'T.C Jin Eduardo Moreno Padilla', 'Grado escrito entero → abreviado', abrev.entero);
log(abrev.yaAb === 'S.I Nelson David' && abrev.conPto === 'S.I Nelson David',
  'Ya abreviado, con o sin puntos → misma salida', abrev.yaAb + ' · ' + abrev.conPto);
log(abrev.tresPal === 'P.P Ana Ruiz', 'Grados de varias palabras se leen enteros', abrev.tresPal);
log(abrev.desconocido === 'Comisionado Especial Pedro Páez',
  '⚠️ Un grado que NO está en el catálogo sale tal cual — no se inventa abreviatura', abrev.desconocido);
log(abrev.vacio === '', 'Y sin nombre no se imprime nada');

/* ═══════════════════════════════════════════════════════════════════════════ */
sec('VII · LO QUE NO PODÍA ROMPERSE');

/* El relato completo: ya no se recorta a 300 caracteres. */
d = await dossier(CASO());
const rel = bloque(d, 'CÓMO').join('\n');
log(rel.length > 300 && !/\.\.\.$/.test(rel) && /halló el bolso de la afectada\.$/.test(rel),
  '⚠️ El relato sale ENTERO: ya no se corta a media palabra', rel.length + ' caracteres');

/* El modelo no cambia: el dossier es solo presentación. */
const modelo = await page.evaluate(c => {
  const antes = JSON.stringify(c);
  genDossier(c);
  return { igual: JSON.stringify(c) === antes };
}, CASO());
log(modelo.igual, 'Generar el dossier no toca ni un campo del caso', 'modelo idéntico');

/* Los documentos oficiales imprimen el grado como siempre: sin puntos. */
const doc = await page.evaluate(() => ({
  grado: lcGradoNombre('Subintendente', 'Nelson David'),
  abrev: lcAbrevGrado('Teniente Coronel'),
  patrulla: patrullaLabel(DB.getConfig())
}));
log(doc.grado === 'SI Nelson David' && doc.abrev === 'TC',
  '⚠️ lcGradoNombre/lcAbrevGrado NO cambian: los formatos oficiales siguen igual', doc.grado);
log(doc.patrulla === 'PATRULLA 32 CAI Parque Bolívar',
  '⚠️ patrullaLabel tampoco: la usan el oficio OJ y la diligencia', doc.patrulla);

/* Integridad histórica (Fase F): la foto congelada manda, y se REFORMATEA sin
   cambiarle el dato. */
await page.evaluate(c => { window.__caso = c; }, CASO());
const histTxt = await page.evaluate(async () => {
  const caso = Object.assign({}, window.__caso, {
    id: 'viejo', dossierSnap: {
      patrulla: 'PATRULLA 32 CAI Parque Bolívar',
      conocieron: ['SI Nelson David David', 'PT Juan Córdoba García'],
      verde3: 'Teniente Coronel Jin Eduardo Moreno Padilla', diamante3: '', ts: 1
    }
  });
  const c = DB.getConfig();
  c.patrullaNum = '47'; c.patrullaUnidad = 'CAI Otro'; c.perfiles[0].grado = 'Intendente';
  await DB.saveConfig(c);
  return genDossier(caso);
});
log(/CAI Parque Bolívar, Patrulla 32/.test(histTxt) && !/Patrulla 47/.test(histTxt),
  '⚠️ La foto del caso sigue mandando tras cambiar la configuración', 'Patrulla 32');
log(/S\.I Nelson David David/.test(histTxt) && !/I\.T Nelson/.test(histTxt),
  '  …con el grado con el que se emitió, ya reformateado con punto', 'S.I');

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | ') || 'sin errores');

await browser.close();
server.close();
console.log(fails === 0 ? `\n✅ TODO EN VERDE — ${n} comprobaciones\n` : `\n❌ ${fails} de ${n} comprobaciones fallaron\n`);
process.exit(fails === 0 ? 0 : 1);
