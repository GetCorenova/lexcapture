/* Regresión — UN SOLO CUERPO DE LETRA (11 pt) EN LOS DATOS DEL FPJ-5.
   Vale para las DOS variantes: mayor de edad (URI) y menor de edad (CESPA).

   Qué fija esta suite, y por qué así:

   (a) El tamaño se resuelve como lo hace WORD —`rPr/sz` → `rStyle` → estilo del
       párrafo con su cadena `basedOn` → `docDefaults`—, no leyendo el atributo
       `w:sz`. Mirar el atributo habría dado verde con el defecto puesto, porque
       el defecto ERA que no existía: un run sin `w:sz` propio salía al
       `docDefaults` de la plantilla, que declara sz 24 = 12 pt.

   (b) «Dato dinámico» no es una lista escrita a mano: se instrumentan las
       primitivas de escritura del FPJ-5 y se marca en el XML cada run que la app
       toca. Así la prueba sigue valiendo si mañana se llena una casilla más, y
       cubre las COPIAS (apartados 4.1/5.1/6.1, filas de vehículo y renglones de
       EMP reproducidos), que no tienen índice fijo en ninguna lista.

   (c) Lo estático se comprueba por DIFERENCIA contra el build anterior: se
       genera el mismo caso con los dos y se exige que todo run no escrito por la
       app sea idéntico byte a byte, y que en los escritos lo único que cambie
       sea `w:sz`/`w:szCs`. Es la garantía de que el formato institucional no se
       movió — no una inspección visual.

   ⚠️ Necesita `LexCapture_prev.html` (copia del build anterior) para la parte
   (c). Sin él esos checks se informan como omitidos, no como fallo. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile, access } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8193;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const d = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
function log(ok, label, extra) {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
}
function sec(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 64 - t.length))); }

const SZ_DATO = 22;          // 11 pt
const SZ_TITULO = 20;        // 10 pt — las barras de apartado del formato

/* ───────────────────────── casos de prueba ───────────────────────── */
const LARGO = 'Siendo las 15:45 horas del día 14 de agosto de 2026, en desarrollo de labores de patrullaje por la calle 52 con carrera 50 del barrio La Candelaria de la ciudad de Medellín, se observó a dos personas que momentos antes habían despojado de sus pertenencias a la ciudadana antes referida, motivo por el cual se procedió a su captura en situación de flagrancia y se les leyeron sus derechos de conformidad con el artículo 303 del Código de Procedimiento Penal, dejándolos a disposición de la autoridad competente dentro del término de las treinta y seis horas siguientes.';

function persona(o) {
  return Object.assign({
    priNom: 'JUAN', segNom: 'CARLOS', priApe: 'PEREZ', segApe: 'GOMEZ', alias: 'EL FLACO',
    tipoDoc: 'CC', numDoc: '71.234.567', expEn: 'MEDELLIN', edad: '32', sexo: 'M', fn: '1994-03-04',
    lugNac: 'MEDELLIN', ecivil: 'SOLTERO', escol: 'BACHILLER', ocup: 'COMERCIANTE',
    correo: 'juan@correo.test', padres: 'PEDRO PEREZ Y ANA GOMEZ', dirRes: 'KR 45 # 10-20',
    tel: '3001234567', senas: 'CICATRIZ EN LA CEJA IZQUIERDA'
  }, o || {});
}
function casoBase(tipo, extra) {
  return Object.assign({
    id: 'T1', tipo, nunc: '1100160000012025', fechaProc: '2026-08-14', destino: 'FISCALIA URI',
    conductas: ['HURTO CALIFICADO Y AGRAVADO', 'PORTE ILEGAL DE ARMAS DE FUEGO'],
    lugar: { dir: 'CL 52 # 50-31', barrio: 'LA CANDELARIA', localidad: '10', vereda: 'N/A', depto: 'ANTIOQUIA', muni: 'MEDELLIN', caract: 'VIA PUBLICA', zona: 'Urbana' },
    capturados: [persona(tipo === 'CESPA' ? { tipoDoc: 'TI', edad: '16', fn: '2010-03-04' } : {})],
    victimas: [persona({ priNom: 'ANA', segNom: 'SOFIA', priApe: 'LOPEZ', segApe: 'MEJIA', sexo: 'F', numDoc: '32.555.444', correo: 'ana@correo.test' })],
    testigos: [persona({ priNom: 'LUIS', segNom: 'FELIPE', priApe: 'ARIAS', segApe: 'MORA', tipoDoc: 'CE', numDoc: '99.888.777', correo: 'luis@correo.test' })],
    hayVehiculos: false, vehiculos: [],
    narracion: {
      fechaCapD: '14', fechaCapM: '08', fechaCapA: '2026', horaCapH: '15', horaCapM: '45',
      fechaDispD: '14', fechaDispM: '08', fechaDispA: '2026', texto: LARGO,
      emp: '02 celulares marca Samsung; 01 arma de fuego tipo revolver calibre 38'
    },
    servidor: { grado: 'PATRULLERO', nombre: 'NELSON DAVID GOMEZ', ident: '1.234.567.890', entidad: 'UNIDAD DEMO', cargo: 'PATRULLERO DE VIGILANCIA', tel: '3011112222', correo: 'servidor@correo.test' }
  }, extra || {});
}
/* Caso «todo a la vez»: varias personas por rol, tres vehículos (la 3.ª fila se
   reproduce), cuatro conductas, muchos EMP (renglones clonados) y un dato largo
   que obliga a Word a partir la línea dentro de la casilla. */
function casoMulti(tipo) {
  return casoBase(tipo, {
    id: 'T2',
    conductas: ['HURTO CALIFICADO Y AGRAVADO', 'PORTE ILEGAL DE ARMAS DE FUEGO DE DEFENSA PERSONAL', 'LESIONES PERSONALES DOLOSAS', 'FABRICACION Y TRAFICO DE ESTUPEFACIENTES'],
    capturados: [
      persona(tipo === 'CESPA' ? { tipoDoc: 'TI', edad: '16', fn: '2010-03-04' } : {}),
      persona({ priNom: 'MARIA', segNom: 'DEL SOCORRO', priApe: 'RIOS', segApe: 'DIAZ', sexo: 'F', numDoc: '43.111.222', tipoDoc: 'DIE', correo: 'maria@correo.test', dirRes: 'CL 100 # 200-300 APARTAMENTO 1502 TORRE 4 URBANIZACION LOS ALAMOS', senas: 'TATUAJE DE UN ANCLA EN EL ANTEBRAZO DERECHO Y CICATRIZ EN LA RODILLA' }),
      persona({ priNom: 'PEDRO', priApe: 'SALGADO', sexo: 'I', numDoc: '8.111.000' })
    ],
    victimas: [
      persona({ priNom: 'ANA', segNom: 'SOFIA', priApe: 'LOPEZ', segApe: 'MEJIA', sexo: 'F', numDoc: '32.555.444', correo: 'ana@correo.test' }),
      persona({ priNom: 'ROSA', priApe: 'VELEZ', sexo: 'F', numDoc: '21.999.888', correo: 'rosa@correo.test' })
    ],
    testigos: [
      persona({ priNom: 'LUIS', segNom: 'FELIPE', priApe: 'ARIAS', segApe: 'MORA', tipoDoc: 'CE', numDoc: '99.888.777', correo: 'luis@correo.test' }),
      persona({ priNom: 'JORGE', priApe: 'CASTAÑO', numDoc: '70.123.456', correo: 'jorge@correo.test' })
    ],
    hayVehiculos: true,
    vehiculos: [
      { marca: 'YAMAHA', clase: 'MOTOCICLETA', color: 'NEGRO', prop: 'JUAN PEREZ', placas: 'abc12d' },
      { marca: 'CHEVROLET', clase: 'AUTOMOVIL', color: 'BLANCO', prop: 'MARIA RIOS', placas: 'xyz789' },
      { marca: 'HONDA', clase: 'MOTOCICLETA', color: 'ROJO', prop: 'LUIS ARIAS', placas: 'qwe456' }
    ],
    narracion: Object.assign({}, casoBase(tipo).narracion, {
      emp: '02 celulares marca Samsung; 01 arma de fuego tipo revolver calibre 38 con tres cartuchos; 03 documentos de identidad; 01 billetera de cuero color negro; 05 tarjetas debito de distintas entidades bancarias'
    })
  });
}

/* Genera el .docx marcando cada run que escribe la app y devuelve los XML. */
async function generar(page, caso) {
  return await page.evaluate(async (caso) => {
    function marcar(nodo, quien) {
      if (!nodo || !nodo.getElementsByTagNameNS) return;
      const rs = nodo.getElementsByTagNameNS(FPJ_W, 'r');
      for (let i = 0; i < rs.length; i++) {
        const ts = rs[i].getElementsByTagNameNS(FPJ_W, 't');
        let txt = ''; for (let j = 0; j < ts.length; j++) txt += (ts[j].textContent || '');
        if (txt) rs[i].setAttribute('lcw', quien);
      }
    }
    const _setTc = setTc, _spn = _setParNode, _spf = _setParForce, _senas = _fpjSenas;
    setTc = function (tcs, i, t) { _setTc(tcs, i, t); if (t) marcar(tcs[i], 'celda:' + i); };
    _setParNode = function (p, t) { const r = _spn(p, t); if (t) marcar(p, 'parrafo'); return r; };
    _setParForce = function (p, t) { const r = _spf(p, t); if (t) marcar(p, 'parrafo+'); return r; };
    _fpjSenas = function (nodes, p) {
      const r = _senas(nodes, p);
      for (const nd of nodes) if (nd.localName === 'p' && /senales particulares/i.test(_noAcc(_getElText(nd, FPJ_W)))) marcar(nd, 'senas');
      return r;
    };
    let out;
    try { out = buildFPJBlob(caso, 'CARTA'); }
    finally { setTc = _setTc; _setParNode = _spn; _setParForce = _spf; _fpjSenas = _senas; }
    if (!out) return null;
    const dec = new TextDecoder();
    const tpl = unzipDocx(caso.tipo === 'CESPA' ? TPL_CESPA : TPL_URI);
    return {
      doc: dec.decode(out.files['word/document.xml']),
      styles: dec.decode(out.files['word/styles.xml']),
      tpl: dec.decode(tpl['word/document.xml'])
    };
  }, caso);
}

/* ── tamaño efectivo, resuelto como Word ── */
function parseStyles(xml) {
  const st = {};
  for (const m of xml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const body = m[2];
    const rPr = (body.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
    st[m[1]] = {
      basedOn: (body.match(/<w:basedOn\s+w:val="([^"]+)"/) || [])[1] || null,
      sz: +((rPr.match(/<w:sz\s+w:val="(\d+)"/) || [])[1] || 0) || null
    };
  }
  const dd = (xml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
  return { st, def: +((dd.match(/<w:sz\s+w:val="(\d+)"/) || [])[1] || 0) || 20,
           defP: (xml.match(/<w:style\b[^>]*w:default="1"[^>]*w:styleId="([^"]+)"/) || [])[1] };
}
function szEstilo(S, id, visto = {}) {
  while (id && S.st[id] && !visto[id]) { visto[id] = 1; if (S.st[id].sz) return S.st[id].sz; id = S.st[id].basedOn; }
  return null;
}
function runs(xml, S) {
  const body = xml.slice(xml.indexOf('<w:body'));
  const out = [], pIdx = [];
  for (const m of body.matchAll(/<w:p(?:\s[^>]*)?>/g)) pIdx.push(m.index);
  for (let i = 0; i < pIdx.length; i++) {
    const seg = body.slice(pIdx[i], pIdx[i + 1] === undefined ? body.length : pIdx[i + 1]);
    const pPr = (seg.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    const pStyle = (pPr.match(/<w:pStyle\s+w:val="([^"]+)"/) || [])[1] || null;
    let pTxt = ''; for (const t of seg.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) pTxt += t[1];
    for (const rm of seg.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)) {
      const r = rm[0];
      let txt = ''; for (const t of r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) txt += t[1];
      if (!txt) continue;
      const rPr = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
      const szA = (rPr.match(/<w:sz\s+w:val="(\d+)"/) || [])[1];
      const rStyle = (rPr.match(/<w:rStyle\s+w:val="([^"]+)"/) || [])[1];
      let sz = szA ? +szA : null, via = szA ? 'run' : null;
      if (sz === null && rStyle) { const v = szEstilo(S, rStyle); if (v) { sz = v; via = 'rStyle'; } }
      if (sz === null && pStyle) { const v = szEstilo(S, pStyle); if (v) { sz = v; via = 'pStyle'; } }
      if (sz === null && S.defP) { const v = szEstilo(S, S.defP); if (v) { sz = v; via = 'estiloNormal'; } }
      if (sz === null) { sz = S.def; via = 'docDefaults'; }
      out.push({ txt, pTxt, sz, via, quien: (r.match(/\blcw="([^"]*)"/) || [])[1] || null, xml: r.replace(/\s*lcw="[^"]*"/, '') });
    }
  }
  return out;
}
/* ⚠️ Qué es «una barra de título de apartado» NO se escribe a mano: se DERIVA de
   la plantilla. Los diez títulos del formato («1. DESTINO DEL INFORME», …,
   «10. ANEXOS») van a 10 pt, y la copia de un apartado repetible hereda ese run
   al clonarlo, así que «4.1» sale idéntico a «4». Eso es estructura del formato,
   no un dato diligenciado: queda fuera de la normalización a propósito. Si el
   formato cambiara sus títulos, esta prueba se entera sola.
   ⚠️ Se compara por PÁRRAFO, no por run: en la plantilla URI el título del
   apartado 5 viene partido en varios runs, mientras que al renumerar la copia
   («5.1 …») todo el texto queda en el primero. Comparar run a run daría un falso
   positivo justo ahí.
   ⚠️ Se normaliza también el paréntesis de reproducción del apartado 4: el formato
   lleva dentro una «s» minúscula —«4. INFORMACIÓN DEL CAPTURADO (s):»— que la
   plantilla de CESPA no trae, y la app le repone (`_fpjTituloApartado4`). Sin esta
   normalización el título reparado dejaría de reconocerse como barra de apartado y
   las copias 4.1/4.2 se contarían como datos diligenciados que salen a 10 pt. */
const sinOrdinal = t => t.replace(/^\s*\d+(\.\d+)*\.?\s*/, '').replace(/\(\s*s?\s*\)/i, '(s)').trim();
function titulosDe(tplXml, S) {
  return new Set(runs(tplXml, S).filter(r => /^\s*\d+\.\s/.test(r.pTxt)).map(r => sinOrdinal(r.pTxt)));
}
const hazEsTitulo = set => r => /^\s*\d+(\.\d+)*\.?\s/.test(r.pTxt) && set.has(sinOrdinal(r.pTxt));

/* ───────────────────────── arranque ───────────────────────── */
async function abrir(archivo) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(`http://localhost:${PORT}/${archivo}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.fill('#pin-a', '2468');
  await page.fill('#pin-b', '2468');
  await page.click('button[onclick="doSetPin()"]');
  await page.waitForTimeout(400);
  return { page, errs };
}

const browser = await chromium.launch({ headless: true });
const { page, errs } = await abrir('LexCapture_v8.html');

let prev = null;
try { await access(join(ROOT, 'LexCapture_prev.html')); prev = (await abrir('LexCapture_prev.html')).page; } catch { }

const RES = {}, TIT = {};
for (const tipo of ['URI', 'CESPA']) {
  for (const [k, caso] of [['simple', casoBase(tipo)], ['multi', casoMulti(tipo)]]) {
    const g = await generar(page, caso);
    RES[tipo + ':' + k] = g && { ...g, S: parseStyles(g.styles) };
  }
  const g = RES[tipo + ':simple'];
  TIT[tipo] = hazEsTitulo(titulosDe(g.tpl, g.S));
}

/* ═══════════ 1 · La causa: docDefaults de las plantillas ═══════════ */
sec('LA CAUSA — un run sin w:sz no sale al tamaño del formato');
{
  const S = RES['URI:simple'].S, S2 = RES['CESPA:simple'].S;
  log(S.def === 24, 'La plantilla URI declara docDefaults sz 24 (12 pt)', 'sz=' + S.def);
  log(S2.def === 24, 'La plantilla CESPA declara docDefaults sz 24 (12 pt)', 'sz=' + S2.def);
  log(null, 'Por eso un dato escrito en un run SIN w:sz salía a 12 pt: el hueco mandaba, no una decisión');
  /* Por qué las barras de apartado quedan FUERA de la normalización: en el
     formato van a 10 pt, y la copia de un apartado repetible hereda ese run. */
  for (const tipo of ['URI', 'CESPA']) {
    const g = RES[tipo + ':simple'];
    /* Se mide el run que ABRE cada título — el que lleva el ordinal y el que
       hereda la copia al renumerarla. El resto del párrafo puede ir a otro
       cuerpo en el propio formato (el «(Indique en la narración…)» del apartado
       5 va a 9 pt) y eso no se toca. */
    const tit = runs(g.tpl, g.S).filter(r => /^\s*\d+\.\s/.test(r.txt));
    log(tit.length === 10 && tit.every(r => r.sz === SZ_TITULO),
      `Los títulos de apartado de la plantilla ${tipo} son del formato y van a 10 pt`,
      tit.length + ' títulos · ' + [...new Set(tit.map(r => r.sz / 2 + 'pt'))].join(','));
  }
}

/* ═══════════ 2 · Todos los datos dinámicos a 11 pt ═══════════ */
for (const tipo of ['URI', 'CESPA']) {
  sec(`FPJ-5 ${tipo === 'URI' ? 'MAYOR DE EDAD (URI)' : 'MENOR DE EDAD (CESPA)'} — 11 pt en todo dato`);
  for (const k of ['simple', 'multi']) {
    const g = RES[tipo + ':' + k];
    if (!g) { log(false, `${k}: no se generó el documento`); continue; }
    const R = runs(g.doc, g.S);
    const esc = R.filter(r => r.quien);
    const mal = esc.filter(r => r.sz !== SZ_DATO && !TIT[tipo](r));
    log(esc.length > 0, `${k}: la app escribe datos en el documento`, esc.length + ' runs con texto');
    log(mal.length === 0, `${k}: 100 % de los datos dinámicos a 11 pt`,
      mal.length ? mal.slice(0, 4).map(r => `${r.sz / 2}pt «${r.txt.slice(0, 26)}»`).join(' · ') : 'ninguno fuera de 11 pt');
    const doce = esc.filter(r => r.sz === 24), diez = esc.filter(r => r.sz === 20 && !TIT[tipo](r));
    log(doce.length === 0, `${k}: ningún dato a 12 pt`, doce.length + ' runs');
    log(diez.length === 0, `${k}: ningún dato a 10 pt`, diez.length + ' runs');
    const sinSz = esc.filter(r => r.via !== 'run');
    log(sinSz.length === 0, `${k}: ningún dato hereda el tamaño (todos lo declaran en su run)`,
      sinSz.length ? sinSz.slice(0, 3).map(r => r.via + ' «' + r.txt.slice(0, 20) + '»').join(' · ') : 'cero herencias');
  }
}

/* ═══════════ 3 · Cobertura por familia de dato ═══════════ */
sec('COBERTURA — qué familias de dato quedaron verificadas');
{
  const g = RES['URI:multi'], R = runs(g.doc, g.S), esc = R.filter(r => r.quien);
  const en = re => esc.filter(r => re.test(r.txt));
  const fam = [
    ['NUNC (16 casillas de un dígito)', esc.filter(r => /^celda:(1[7-9]|2\d|3[0-2])$/.test(r.quien))],
    ['Identificación de personas (nombres, documento)', en(/^(JUAN|CARLOS|PEREZ|GOMEZ|MARIA|RIOS|71234567|43111222)$/)],
    ['Fechas y horas celda por celda', esc.filter(r => /^celda:(5[4-6]|2[6-8]\d)$/.test(r.quien))],
    ['Direcciones', en(/KR 45|CL 52|CL 100/)],
    ['Narración de los hechos', en(/^Siendo las 15:45/)],
    ['EMP y EF del numeral 7', en(/celulares marca Samsung|tarjetas debito/)],
    ['Conductas punibles numeradas', en(/^\d\.\s(HURTO|PORTE|LESIONES|FABRICACION)/)],
    ['Vehículos (incluida la fila reproducida)', en(/^(YAMAHA|CHEVROLET|HONDA|ABC12D|QWE456)$/)],
    ['Marcas «X» de tipo de documento y género', en(/^X$/)],
    ['Señales particulares (párrafo, no celda)', en(/CICATRIZ|TATUAJE DE UN ANCLA/)],
    ['Datos del servidor', en(/PATRULLERO NELSON|servidor@correo.test/)],
    ['Personas reproducidas (apartados 4.1 / 5.1 / 6.1)', en(/^(SALGADO|VELEZ|CASTAÑO)$/)]
  ];
  for (const [nombre, rs] of fam)
    log(rs.length > 0 && rs.every(r => r.sz === SZ_DATO), nombre, rs.length + ' runs, todos a 11 pt');
}

/* ═══════════ 4 · Datos largos que parten línea ═══════════ */
sec('DATOS LARGOS — el salto de línea no cambia el cuerpo');
{
  const g = RES['CESPA:multi'], R = runs(g.doc, g.S), esc = R.filter(r => r.quien);
  const largos = esc.filter(r => r.txt.length > 60 && !TIT.CESPA(r));
  log(largos.length >= 3, 'Hay datos largos en el documento', largos.length + ' runs de más de 60 caracteres');
  log(largos.every(r => r.sz === SZ_DATO), 'Todos los datos largos a 11 pt',
    [...new Set(largos.map(r => r.sz / 2 + 'pt'))].join(' · '));
  const narr = esc.find(r => /^Siendo las 15:45/.test(r.txt));
  log(!!narr && narr.sz === SZ_DATO && narr.txt.length > 400, 'La narración completa va en un solo run a 11 pt',
    narr ? narr.txt.length + ' caracteres a ' + narr.sz / 2 + 'pt' : 'no encontrada');
}

/* ═══════════ 5 · Mismo criterio en las dos variantes ═══════════ */
sec('MISMO CRITERIO EN LAS DOS VARIANTES');
{
  const tam = t => { const g = RES[t + ':multi']; return [...new Set(runs(g.doc, g.S).filter(r => r.quien && !TIT[t](r)).map(r => r.sz))].sort(); };
  const u = tam('URI'), c = tam('CESPA');
  log(u.length === 1 && u[0] === SZ_DATO, 'URI: los datos usan un único cuerpo', u.map(x => x / 2 + 'pt').join(','));
  log(c.length === 1 && c[0] === SZ_DATO, 'CESPA: los datos usan un único cuerpo', c.map(x => x / 2 + 'pt').join(','));
  log(JSON.stringify(u) === JSON.stringify(c), 'Mayor de edad y CESPA comparten el mismo criterio');
}

/* ═══════════ 6 · Lo estático NO se tocó (diff contra el build anterior) ═══════════ */
sec('EL FORMATO INSTITUCIONAL NO SE MOVIÓ');
if (!prev) {
  log(null, 'Sin LexCapture_prev.html: la comparación con el build anterior se omite');
} else {
  for (const tipo of ['URI', 'CESPA']) {
    for (const k of ['simple', 'multi']) {
      const caso = k === 'simple' ? casoBase(tipo) : casoMulti(tipo);
      const gA = await generar(prev, caso), gN = RES[tipo + ':' + k];
      if (!gA || !gN) { log(false, `${tipo}/${k}: no se pudo comparar`); continue; }
      const A = runs(gA.doc, parseStyles(gA.styles)), N = runs(gN.doc, gN.S);
      log(A.length === N.length, `${tipo}/${k}: mismo número de runs con texto que el build anterior`, `${A.length} → ${N.length}`);
      const textoIgual = A.length === N.length && A.every((r, i) => r.txt === N[i].txt);
      log(textoIgual, `${tipo}/${k}: ni una palabra cambió`, textoIgual ? 'texto idéntico run por run' : 'HAY TEXTO DISTINTO');
      if (!textoIgual || A.length !== N.length) continue;
      const distintos = A.map((r, i) => ({ i, a: r, b: N[i] })).filter(x => x.a.xml !== x.b.xml);
      const estaticosTocados = distintos.filter(x => !x.b.quien);
      log(estaticosTocados.length === 0, `${tipo}/${k}: NINGÚN run del formato fue modificado`,
        estaticosTocados.length ? estaticosTocados.slice(0, 3).map(x => '«' + x.b.txt.slice(0, 24) + '»').join(' · ') : `${distintos.length} runs cambiados, todos escritos por la app`);
      // Y en los que sí cambiaron, lo único que cambió es el cuerpo de letra.
      const soloSz = distintos.every(x => x.a.xml.replace(/<w:(sz|szCs)\s+w:val="\d+"\/>/g, '') === x.b.xml.replace(/<w:(sz|szCs)\s+w:val="\d+"\/>/g, '').replace(/<w:rPr\/>/g, '').replace(/(<w:rPr>)(<\/w:rPr>)/g, '') || x.a.xml.replace(/<w:(sz|szCs)\s+w:val="\d+"\/>/g, '').replace(/<w:rPr><\/w:rPr>/g, '').replace(/<w:rPr\/>/g, '') === x.b.xml.replace(/<w:(sz|szCs)\s+w:val="\d+"\/>/g, '').replace(/<w:rPr><\/w:rPr>/g, '').replace(/<w:rPr\/>/g, ''));
      log(soloSz, `${tipo}/${k}: en los datos, lo único que cambió es w:sz/w:szCs`,
        soloSz ? 'ni bordes, ni negrita, ni fuente, ni anchos' : 'HAY OTRO ATRIBUTO CAMBIADO');
      /* Las barras de apartado no se comprueban contra un tamaño escrito a mano:
         un título del formato puede repartir su párrafo en varios cuerpos (el
         «(Indique en la narración…)» del apartado 5 va más pequeño). Lo que se
         exige es que su tipografía sea EXACTAMENTE la del build anterior. */
      const perfil = R => R.filter(r => TIT[tipo](r)).map(r => r.sz).join(',');
      log(perfil(N) === perfil(A) && perfil(N).length > 0,
        `${tipo}/${k}: las barras de apartado conservan su tipografía exacta`,
        [...new Set(perfil(N).split(','))].map(x => x / 2 + 'pt').join(' · '));
      /* Y la copia se ve igual que el original: «4.1» al mismo cuerpo que «4».
         ⚠️ El título hay que desambiguarlo con el conjunto derivado de la
         plantilla: el numeral 2 imprime las conductas punibles numeradas, así
         que «4. FABRICACIÓN Y TRÁFICO…» también empieza por «4.» — y ese SÍ es
         un dato, a 11 pt. */
      const t1 = N.find(r => TIT[tipo](r) && /^\s*4\.\s/.test(r.pTxt));
      const t2 = N.find(r => TIT[tipo](r) && /^\s*4\.1\s/.test(r.pTxt));
      if (t2) log(t1 && t1.sz === t2.sz && t1.sz === SZ_TITULO,
        `${tipo}/${k}: el título de la copia «4.1» sale al mismo cuerpo que «4»`,
        (t1 ? t1.sz / 2 : '?') + 'pt vs ' + t2.sz / 2 + 'pt');
    }
  }
}

/* ═══════════ 7 · El acta FPJ-6 no se vio afectada ═══════════ */
sec('NO HAY DAÑO COLATERAL — el acta FPJ-6 usa las mismas primitivas');
{
  const r = await page.evaluate(() => ({
    fuera: _fpjRec === null,
    tieneGuarda: /_fpjRec\s*=\s*null/.test(String(buildFPJBlob)),
    f6Intacta: typeof F6_RELLENA !== 'undefined' && F6_RELLENA.length > 0
  }));
  log(r.fuera, 'Fuera de buildFPJBlob el registro está cerrado (_fpjRec === null)');
  log(r.tieneGuarda, 'buildFPJBlob cierra el registro en un finally');
  log(r.f6Intacta, 'El acta conserva su propia regla de tamaños (F6_RELLENA)');
}

/* ═══════════ 8 · Consola limpia ═══════════ */
sec('CONSOLA');
log(errs.length === 0, 'Sin errores de consola durante la generación', errs.slice(0, 2).join(' | ') || 'limpia');

console.log(`\n${fails === 0 ? '✅ TODO EN VERDE' : '❌ ' + fails + ' FALLO(S)'} — ${n} comprobaciones\n`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
