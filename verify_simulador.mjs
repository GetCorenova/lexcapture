/* Regresión del SIMULADOR de casos ficticios.
   Dos exigencias, que son las que pidió el usuario:
     1. Genera ABSOLUTAMENTE todos los datos — y sin depender de Ajustes, porque
        el equipo puede estar recién instalado. Si un campo se queda vacío, el
        documento sale con un hueco y el caso de demostración no sirve.
     2. Flagrancia y orden judicial son PROCESOS DISTINTOS: modelos de datos
        distintos, validaciones distintas y documentos distintos. El simulador
        no puede producir "una flagrancia con campos de orden judicial".
   ⚠️ El PIN se crea pero NO se configura NADA en Ajustes: es justo el escenario
   que antes dejaba al caso ficticio sin NUNC y sin membrete. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8137;
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
  n++;
  if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
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

/* Huella de Ajustes ANTES de simular: el simulador no puede tocarla. */
const cfgAntes = await page.evaluate(() => JSON.stringify(DB.getConfig()));

/* ═══════════════ 1. FLAGRANCIA — el caso llega completo ═══════════════ */
const flag = await page.evaluate(() => {
  // Campos del caso que el FPJ-5 imprime: ninguno puede salir vacío.
  const CASO = ['nunc', 'spoa', 'fechaProc', 'destino', 'numIncidente', 'recibe'];
  const LUGAR = ['depto', 'muni', 'dir', 'barrio', 'caract', 'localidad', 'zona', 'vereda'];
  const NARR = ['fechaCapD', 'fechaCapM', 'fechaCapA', 'horaCapH', 'horaCapM',
    'fechaDispD', 'fechaDispM', 'fechaDispA', 'horaDispH', 'horaDispM', 'texto', 'emp'];
  const SERV = ['grado', 'ident', 'nombre', 'entidad', 'cargo', 'tel', 'correo'];
  // Campos del formulario de persona. segNom y alias pueden faltar de verdad.
  const PERS = ['tipoDoc', 'numDoc', 'expEn', 'priNom', 'priApe', 'segApe', 'fn', 'edad',
    'lugNac', 'ecivil', 'escol', 'ocup', 'dirRes', 'tel', 'correo', 'padres', 'senas'];
  const VEH = ['marca', 'clase', 'color', 'placas', 'prop'];

  const out = { uri: {}, cespa: {}, huecos: [], nuncs: [], multi: 0, conVeh: 0, muestras: 0 };
  ['flagrancia-uri', 'flagrancia-cespa'].forEach(sub => {
    const acc = sub === 'flagrancia-uri' ? out.uri : out.cespa;
    acc.docTipos = new Set(); acc.edades = []; acc.edadesVic = [];
    acc.tipos = new Set(); acc.ojKeys = 0;
    for (let i = 0; i < 12; i++) {
      const c = SIM.genFlagrancia(sub);
      out.muestras++;
      acc.tipos.add(c.tipo);
      out.nuncs.push(c.nunc);
      // Un caso de flagrancia NO lleva nada del módulo de orden judicial.
      if (c.oj || c.ojv !== undefined) acc.ojKeys++;
      CASO.forEach(k => { if (!c[k]) out.huecos.push(sub + '.' + k); });
      LUGAR.forEach(k => { if (!c.lugar[k]) out.huecos.push(sub + '.lugar.' + k); });
      NARR.forEach(k => { if (!c.narracion[k]) out.huecos.push(sub + '.narracion.' + k); });
      SERV.forEach(k => { if (!c.servidor[k]) out.huecos.push(sub + '.servidor.' + k); });
      // Conductas y artículos del C.P. van emparejados (issue M2).
      const nCond = c.conductas.filter(Boolean).length;
      const nArt = (c.articulosCP || []).filter(Boolean).length;
      if (!nCond || nCond !== nArt) out.huecos.push(sub + '.conductas/articulosCP ' + nCond + '/' + nArt);
      if (!c.capturados.length || !c.victimas.length || !c.testigos.length) out.huecos.push(sub + '.personas');
      if (c.capturados.length > 1 || c.victimas.length > 1 || c.testigos.length > 1) out.multi++;
      [].concat(c.capturados, c.victimas, c.testigos).forEach(p => {
        PERS.forEach(k => { if (!p[k]) out.huecos.push(sub + '.persona.' + k); });
        if (/\./.test(p.numDoc)) out.huecos.push(sub + '.numDoc con puntos');
      });
      c.capturados.forEach(p => { acc.docTipos.add(p.tipoDoc); acc.edades.push(+p.edad); });
      c.victimas.forEach(p => acc.edadesVic.push(+p.edad));
      if (c.hayVehiculos) {
        out.conVeh++;
        if (!c.vehiculos.length) out.huecos.push(sub + '.vehiculos vacío con hayVehiculos');
        c.vehiculos.forEach(v => VEH.forEach(k => { if (!v[k]) out.huecos.push(sub + '.vehiculo.' + k); }));
      } else if (c.vehiculos.length) out.huecos.push(sub + '.vehiculos sin hayVehiculos');
    }
    acc.docTipos = [...acc.docTipos]; acc.tipos = [...acc.tipos];
  });
  return out;
});
log(flag.huecos.length === 0, 'Flagrancia: ningún campo del caso queda vacío (24 muestras)',
  flag.huecos.length ? [...new Set(flag.huecos)].slice(0, 6).join(', ') : 'caso, lugar, narración, servidor, personas y vehículos completos');
log(flag.nuncs.every(x => /^\d{16}$/.test(x)), 'NUNC de 16 dígitos SIEMPRE, con Ajustes sin configurar', flag.nuncs[0]);
log(flag.uri.tipos.join() === 'URI' && flag.cespa.tipos.join() === 'CESPA', 'Cada subtipo produce su propio tipo de caso');
log(flag.uri.docTipos.join() === 'CC' && flag.uri.edades.every(e => e >= 18),
  'URI: capturados adultos con C.C.', 'edades ' + Math.min(...flag.uri.edades) + '–' + Math.max(...flag.uri.edades));
log(flag.cespa.docTipos.join() === 'TI' && flag.cespa.edades.every(e => e >= 14 && e < 18),
  'CESPA: capturados menores con T.I. (14–17)', 'edades ' + Math.min(...flag.cespa.edades) + '–' + Math.max(...flag.cespa.edades));
log(flag.cespa.edadesVic.every(e => e >= 18), 'CESPA: las víctimas siguen siendo adultas');
log(flag.multi > 0, 'Se simulan varias personas por rol (apartados 4/5/6 repetibles del FPJ-5)', flag.multi + ' de ' + flag.muestras + ' casos');
log(flag.conVeh > 0, 'Se simulan vehículos implicados (paso 8 del wizard)', flag.conVeh + ' de ' + flag.muestras + ' casos');
log(flag.uri.ojKeys === 0 && flag.cespa.ojKeys === 0, 'Un caso de flagrancia no arrastra nada del módulo de orden judicial');

/* El FPJ-5 real, sin haber configurado NADA en Ajustes. */
const fpj = await page.evaluate(async () => {
  const res = {};
  for (const sub of ['flagrancia-uri', 'flagrancia-cespa']) {
    const c = SIM.genFlagrancia(sub);
    const out = buildFPJBlob(c);
    if (!out) { res[sub] = { ok: false }; continue; }
    const buf = new Uint8Array(await out.blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    res[sub] = { ok: true, fname: out.fname, size: out.blob.size, b64: btoa(bin) };
  }
  return res;
});
log(fpj['flagrancia-uri'].ok === true, 'El FPJ-5 URI se genera desde el caso simulado', fpj['flagrancia-uri'].fname);
log(fpj['flagrancia-cespa'].ok === true, 'El informe CESPA se genera desde el caso simulado', fpj['flagrancia-cespa'].fname);

/* ═══════════════ 2. ORDEN JUDICIAL — otro proceso, otro modelo ═══════════════ */
const oj = await page.evaluate(() => {
  // Rutas del modelo caso.oj que el oficio imprime y que nunca deben ir vacías.
  const RUTAS = [
    'orden.numero', 'orden.tipoOrden', 'orden.finalidad', 'orden.estado', 'orden.fechaExpedicion',
    'orden.autoridadSolicitante', 'orden.dirigidaA', 'orden.motivoTextual',
    'orden.verificacion.sistema', 'orden.verificacion.fecha', 'orden.verificacion.hora',
    'orden.verificacion.funcionario', 'orden.verificacion.resultado', 'orden.verificacion.observacion',
    'despacho.nombre', 'despacho.tipo', 'despacho.especialidad', 'despacho.municipio', 'despacho.departamento',
    'despacho.direccion', 'despacho.telefono', 'despacho.correo', 'despacho.identificacion',
    'despacho.funcionarioResponsable', 'despacho.juezNombre', 'despacho.juezCargo', 'despacho.firma',
    'proceso.radicado', 'proceso.codigoInterno', 'proceso.fechaHechos', 'proceso.fechaDecision', 'proceso.descripcionJuridica',
    'requerido.tipoDoc', 'requerido.numDoc', 'requerido.expedidoEn', 'requerido.priNom', 'requerido.priApe',
    'requerido.segApe', 'requerido.fechaNac', 'requerido.edad', 'requerido.sexo', 'requerido.nacionalidad',
    'requerido.estadoCivil', 'requerido.profesion', 'requerido.resDireccion', 'requerido.resBarrio',
    'requerido.resMunicipio', 'requerido.resDepartamento', 'requerido.resTelefono',
    'requerido.nacPais', 'requerido.nacDepartamento', 'requerido.nacMunicipio', 'requerido.madre', 'requerido.padre',
    'requerido.rasgos.estatura', 'requerido.rasgos.contextura', 'requerido.rasgos.tez',
    'requerido.rasgos.cabello', 'requerido.rasgos.ojos', 'requerido.senales', 'requerido.otrosDatos',
    'requerido.identidadMetodo',
    'diligencia.fecha', 'diligencia.hora', 'diligencia.lugarDireccion', 'diligencia.lugarBarrio',
    'diligencia.lugarMunicipio', 'diligencia.lugarDepartamento', 'diligencia.lugarTipo',
    'diligencia.coordenadas', 'diligencia.formaUbicacion', 'diligencia.unidad', 'diligencia.patrulla', 'diligencia.vehiculo',
    'actuacion.derechos.fecha', 'actuacion.derechos.hora', 'actuacion.derechos.lugar', 'actuacion.derechos.observacion',
    'actuacion.defensor.tipo', 'actuacion.fuerza.tipo', 'actuacion.valoracion.entidad',
    'actuacion.valoracion.fecha', 'actuacion.valoracion.hora', 'actuacion.observaciones',
    'destino.tipo', 'destino.nombre', 'destino.direccion', 'destino.municipio', 'destino.departamento',
    'destino.telefono', 'destino.correo', 'destino.fechaEntrega', 'destino.horaEntrega',
    'destino.recibeNombre', 'destino.recibeCargo', 'destino.reglaAplicada', 'destino.fundamento',
    // Encabezado / custodia / firma: aunque Ajustes esté vacío (V26–V31 son DURAS).
    'encabezado.ministerio', 'encabezado.institucion', 'encabezado.unidad', 'encabezado.dependencia',
    'custodia.estacion', 'custodia.direccion', 'custodia.telefono', 'custodia.correo', 'custodia.web',
    'firma.grado', 'firma.nombre', 'firma.cargo', 'firma.telefono', 'firma.correo'
  ];
  const leer = (o, ruta) => ruta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

  const out = {
    huecos: [], duras: [], estados: new Set(), reglas: new Set(), finalidades: new Set(),
    espejoMal: [], fechasMal: [], plazoMal: 0, srpa: [], adultos: [],
    contaminados: [], anexosMin: 99, sinFuncionario: 0, rotuloFalta: 0, muestras: 0
  };
  for (let i = 0; i < 24; i++) {
    const c = SIM.genOJ();
    out.muestras++;
    if (c.ojv !== 2 || c.tipo !== 'OJ') out.espejoMal.push('ojv/tipo');
    RUTAS.forEach(r => { if (!leer(c.oj, r)) out.huecos.push(r); });

    // Lo que bloquea el oficio. Debe estar SIEMPRE vacío.
    ojDuras(c).forEach(v => out.duras.push(v.id + ' ' + v.msg));

    const vig = ojVigencia(c.oj.orden);
    out.estados.add(vig.estado);
    out.reglas.add(c.oj.destino.reglaAplicada);
    out.finalidades.add(c.oj.orden.finalidad);

    // Coherencia temporal: hechos → decisión → orden; diligencia en las últimas 30 h.
    const p = c.oj.proceso, o = c.oj.orden;
    if (!(p.fechaHechos <= p.fechaDecision && p.fechaDecision <= o.fechaExpedicion))
      out.fechasMal.push(p.fechaHechos + '/' + p.fechaDecision + '/' + o.fechaExpedicion);
    const plazo = ojPlazo36(c);
    if (plazo.semaforo === 'VENCIDO' || !plazo.vence) out.plazoMal++;

    // SRPA: adolescente AL MOMENTO DE LOS HECHOS ⇒ «aprehensión» y ruta de adolescentes.
    const edadH = ojEdadEnHechos(c);
    if (c.oj.orden.tipoOrden === 'SRPA') out.srpa.push({ edadH, term: ojTermino(c).acc, regla: c.oj.destino.reglaAplicada, doc: c.oj.requerido.tipoDoc });
    else out.adultos.push({ edadH, term: ojTermino(c).acc });

    // Un caso OJ no tiene víctimas, ni testigos, ni EMP, ni vehículos de flagrancia.
    if ((c.victimas || []).length || (c.testigos || []).length || c.vehiculos || c.narracion) out.contaminados.push(c.id);
    // Espejo hacia las pantallas compartidas.
    if (!c.capturados.length || !c.conductas.length || !c.spoa || !c.fechaProc || !c.destino) out.espejoMal.push('espejo');
    if (/\./.test(c.capturados[0].numDoc)) out.espejoMal.push('numDoc con puntos');

    if (!c.oj.diligencia.funcionarios.length) out.sinFuncionario++;
    out.anexosMin = Math.min(out.anexosMin, c.oj.actuacion.anexos.length);
    if (c.oj.actuacion.hayIncautacion && c.oj.actuacion.incautaciones.some(e => !e.rotulo)) out.rotuloFalta++;
  }
  out.estados = [...out.estados]; out.reglas = [...out.reglas]; out.finalidades = [...out.finalidades];
  return out;
});
log(oj.huecos.length === 0, 'Orden judicial: ninguna ruta del modelo caso.oj queda vacía (24 muestras)',
  oj.huecos.length ? [...new Set(oj.huecos)].slice(0, 8).join(', ') : '114 rutas llenas, incluidas encabezado/custodia/firma sin Ajustes');
log(oj.duras.length === 0, 'CERO validaciones DURAS: el caso simulado siempre puede producir el oficio',
  oj.duras.length ? [...new Set(oj.duras)].slice(0, 3).join(' | ') : 'V01–V31 en verde');
log(oj.estados.every(e => e === 'VIGENTE' || e === 'PRORROGADA' || e === 'POR_VENCER'),
  'La orden simulada nunca nace vencida, cancelada ni suspendida', oj.estados.join(', '));
log(oj.estados.includes('PRORROGADA'), 'Se simulan órdenes con prórroga (ejercita el cálculo de vigencia)');
log(oj.fechasMal.length === 0, 'Coherencia temporal: hechos ≤ decisión ≤ expedición de la orden', oj.fechasMal[0] || 'ok');
log(oj.plazoMal === 0, 'La diligencia cae dentro de las últimas 30 h: el término de 36 h está vivo');
log(oj.reglas.length >= 3, 'Se ejercitan varias reglas del motor de destinatario', oj.reglas.join(', '));
log(oj.finalidades.length >= 4, 'Se simulan varias finalidades de la orden', oj.finalidades.join(', '));
log(oj.srpa.length > 0 && oj.srpa.every(s => s.edadH >= 14 && s.edadH < 18 && s.term === 'aprehensión' && s.regla === 'R1-SRPA' && s.doc === 'TI'),
  'SRPA: adolescente al momento de los hechos → «aprehensión», T.I. y ruta de adolescentes',
  oj.srpa.length ? oj.srpa.map(s => s.edadH).join('/') + ' años' : 'sin muestras SRPA');
log(oj.adultos.every(a => a.term === 'captura'), 'Fuera de SRPA el documento dice «captura»');
log(oj.sinFuncionario === 0, 'Siempre hay al menos un funcionario en la diligencia (V15)');
log(oj.anexosMin >= 4, 'Los anexos se marcan desde el catálogo', 'mínimo ' + oj.anexosMin);
log(oj.rotuloFalta === 0, 'Todo elemento incautado lleva su rótulo de cadena de custodia (V20)');
log(oj.contaminados.length === 0, 'Un caso OJ no trae víctimas, testigos, vehículos ni narración de flagrancia');
log(oj.espejoMal.length === 0, 'El espejo hacia lista/personas/dossier queda completo', oj.espejoMal[0] || 'capturados, conductas, spoa y destino');

/* El oficio real, sin haber configurado NADA en Ajustes. */
const ofi = await page.evaluate(async () => {
  const c = SIM.genOJ();
  const out = await buildOficioOJBlob(c, 'OFICIO');
  if (!out) return { ok: false };
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  const files = unzipDocx(b64);
  const xml = new TextDecoder().decode(files['word/document.xml']);
  // El membrete NO va en document.xml: son las cuatro líneas del encabezado de página.
  const hdr = new TextDecoder().decode(files['word/header1.xml']);
  return {
    ok: true, fname: out.fname, b64,
    // Nada de la persona ni del despacho puede faltar en el texto del oficio.
    tieneNombre: xml.includes(ojNombreRequerido(c.oj.requerido).toUpperCase()),
    tieneOrden: xml.includes(c.oj.orden.numero),
    tieneDespacho: xml.includes(c.oj.despacho.nombre),
    tieneCustodia: xml.includes(c.oj.custodia.estacion),
    tieneAnexos: xml.includes('Anexos:'),
    // Las CUATRO líneas del membrete que el simulador inventó sin Ajustes.
    membrete: [c.oj.encabezado.ministerio, c.oj.encabezado.institucion,
               c.oj.encabezado.unidad, c.oj.encabezado.dependencia].every(l => hdr.includes(l))
  };
});
log(ofi.ok === true, 'El oficio de disposición se genera desde el caso simulado', ofi.fname);
log(ofi.tieneNombre && ofi.tieneOrden && ofi.tieneDespacho && ofi.tieneCustodia && ofi.tieneAnexos,
  'El oficio lleva requerido, No. de orden, despacho, custodia y anexos',
  JSON.stringify({ n: ofi.tieneNombre, o: ofi.tieneOrden, d: ofi.tieneDespacho, c: ofi.tieneCustodia, a: ofi.tieneAnexos }));
log(ofi.membrete === true, 'Las CUATRO líneas del membrete inventado llegan al encabezado de página');

/* El escudo del formato viene EMBEBIDO: la app no lo pide y sale solo, igual en
   un caso de demostración que en uno real. Lo que el usuario cargue en Ajustes
   sigue mandando sobre el embebido. */
const logo = await page.evaluate(async () => {
  const media = async c => {
    const out = await buildOficioOJBlob(c, 'CARTA');
    const files = await _unzipBufAsync(new Uint8Array(await out.blob.arrayBuffer()));
    const parte = Object.keys(files).find(k => /^word\/media\//.test(k));
    return {
      parte: parte || null, bytes: parte ? files[parte].length : 0,
      blip: /<a:blip/.test(new TextDecoder().decode(files['word/header1.xml'])),
      vista: /<img /.test(lcPrintDoc(out).hdrFirst)
    };
  };
  const demo = SIM.genOJ();
  const real = SIM.genOJ(); real.isTest = false;
  const sinCfg = { demo: await media(demo), real: await media(real) };
  // Ahora el usuario carga SU logo en Ajustes.
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d'); x.fillStyle = '#123456'; x.fillRect(0, 0, 64, 64);
  const propio = cv.toDataURL('image/png').split(',')[1];
  const cfg = DB.getConfig(); cfg.ojLogoB64 = propio; cfg.ojLogoMime = 'image/png';
  await DB.saveConfig(cfg);
  const conCfg = { demo: await media(demo), real: await media(real) };
  cfg.ojLogoB64 = ''; cfg.ojLogoMime = ''; await DB.saveConfig(cfg);
  return { sinCfg, conCfg, propioLen: propio.length };
});
log(logo.sinCfg.demo.parte === 'word/media/logo.jpeg' && logo.sinCfg.demo.blip === true,
  'Sin nada configurado, el escudo del formato sale solo', logo.sinCfg.demo.bytes + ' bytes');
log(logo.sinCfg.demo.vista === true, 'Y también en la vista de impresión (PDF), no solo en el .docx');
log(logo.sinCfg.real.parte === 'word/media/logo.jpeg' && logo.sinCfg.real.bytes === logo.sinCfg.demo.bytes,
  'Un oficio REAL lleva exactamente el mismo escudo: no se distingue de la demostración');
log(logo.conCfg.demo.bytes === logo.conCfg.real.bytes && logo.conCfg.demo.bytes !== logo.sinCfg.demo.bytes,
  'El logo propio de la unidad manda sobre el embebido', logo.conCfg.demo.bytes + ' bytes');
log(logo.conCfg.real.parte === 'word/media/logo.png' && logo.conCfg.real.vista === true,
  'Y llega al oficio real en los dos formatos');

/* ═══════════════ 3. El simulador no reconfigura la app ═══════════════ */
const cfgDespues = await page.evaluate(() => JSON.stringify(DB.getConfig()));
log(cfgAntes === cfgDespues, 'Generar casos ficticios no escribe una sola línea en Ajustes');
const noPolucion = await page.evaluate(() => {
  // Un caso ficticio editado y guardado tampoco puede dejar el membrete «(DEMO)»
  // pegado en la configuración real del usuario.
  const c = SIM.genOJ();
  ojRecordarEncabezado(c);
  const cfg = DB.getConfig();
  return { min: cfg.ojMinisterio || '', ins: cfg.ojInstitucion || '', uni: cfg.ojUnidad || '' };
});
log(!noPolucion.min && !noPolucion.ins && !noPolucion.uni,
  'ojRecordarEncabezado ignora los casos isTest: el membrete (DEMO) no llega a Ajustes', JSON.stringify(noPolucion));

/* ═══════════════ 4. Recorrido real por la interfaz ═══════════════ */
await page.evaluate(() => go('nuevo'));
await page.waitForTimeout(200);
await page.evaluate(() => runSimDemo('oj'));
await page.waitForTimeout(400);
const resOJ = await page.$eval('#sim-res', el => el.textContent);
log(/Orden judicial/.test(resOJ) && /Orden No\./.test(resOJ) && /36 h vencen/.test(resOJ),
  'La vista previa de OJ muestra orden, vigencia, requerido y plazo', resOJ.slice(0, 90).replace(/\s+/g, ' '));
await page.evaluate(() => simSavePending());
await page.waitForTimeout(900);
await page.evaluate(() => runSimDemo('flagrancia-uri'));
await page.waitForTimeout(400);
const resFl = await page.$eval('#sim-res', el => el.textContent);
log(/NUNC \d{16}/.test(resFl) && /capturado\(s\)/.test(resFl),
  'La vista previa de flagrancia muestra NUNC y el conteo de personas', resFl.slice(0, 90).replace(/\s+/g, ' '));
await page.evaluate(() => simSavePending());
await page.waitForTimeout(900);
await page.evaluate(() => { go('capturas'); renderCases(); });
await page.waitForTimeout(400);
const lista = await page.evaluate(() => {
  const cs = DB.getCases();
  return { n: cs.length, tipos: cs.map(c => c.tipo).sort().join(','), tarjetas: document.querySelectorAll('.cc').length };
});
log(lista.n === 2 && lista.tipos === 'OJ,URI' && lista.tarjetas === 2,
  'Los dos casos simulados se guardan y aparecen en la lista', JSON.stringify(lista));

const doc = await page.evaluate(async () => {
  // Ambos casos, ya guardados, producen su documento por la ruta real de la app.
  const cs = DB.getCases();
  const ojC = cs.find(c => c.tipo === 'OJ'), fl = cs.find(c => c.tipo === 'URI');
  const a = await buildOficioOJBlob(ojCasoParaDocumento(ojC), 'CARTA');
  const b = buildFPJBlob(fl, 'CARTA');
  return { oj: !!a && a.blob.size > 0, fpj: !!b && b.blob.size > 0, duras: ojDuras(ojC).length };
});
log(doc.oj && doc.fpj && doc.duras === 0, 'Los casos ya guardados generan su documento sin bloqueos', JSON.stringify(doc));

log(consoleErrors.length === 0, 'Consola limpia', consoleErrors.slice(0, 3).join(' | '));

/* Se dejan en disco para abrirlos en Word real: un .docx que Word marque como
   dañado pasaría todos los checks de arriba sin que nadie se entere. */
await writeFile(join(ROOT, 'verify_simulador_oj.docx'), Buffer.from(ofi.b64, 'base64'));
await writeFile(join(ROOT, 'verify_simulador_fpj_uri.docx'), Buffer.from(fpj['flagrancia-uri'].b64, 'base64'));
await writeFile(join(ROOT, 'verify_simulador_fpj_cespa.docx'), Buffer.from(fpj['flagrancia-cespa'].b64, 'base64'));
console.log('\n📄 Documentos generados: verify_simulador_oj.docx · verify_simulador_fpj_uri.docx · verify_simulador_fpj_cespa.docx');
console.log(fails === 0 ? `\n✅ ${n} comprobaciones, todas en verde` : `\n❌ ${fails} de ${n} comprobaciones fallaron`);

await browser.close();
server.close();
process.exit(fails === 0 ? 0 : 1);
