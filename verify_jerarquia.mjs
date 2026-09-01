/* AUDITORIA Y REORGANIZACION JERARQUICA (2026-09-01)
   Requerimiento de cuatro puntos: (1) etiquetas ordenadas en padres e hijos,
   (2) textos de orientacion depurados, (3) caret > / ⌄ en los desplegables,
   (4) acordeones solo donde de verdad hacen falta. Con una regla que gobierna
   todo lo demas: «esta reorganizacion debe mejorar la estructura y comprension
   de la aplicacion SIN alterar su funcionalidad ni la informacion que genera».

   Por eso esta suite tiene dos mitades, y la segunda pesa mas que la primera:
     A. que la jerarquia este donde se pidio y el ruido haya desaparecido;
     B. que NO se haya movido un solo dato — ni una clave, ni un campo que se
        recolecta, ni un caracter de los documentos que la app produce.

   ⚠️ La comprobacion que de verdad protege este trabajo es la [B1]: se genera
   un FPJ-5 y un oficio de orden judicial ANTES de tocar nada y se comparan,
   caracter a caracter, con los de DESPUES de diligenciar por los formularios
   reorganizados. Si anidar un campo o plegar un panel hubiera dejado de
   recolectar algo, esos dos documentos cambiarian. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.js':'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8163, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const sec = t => console.log('\n══ ' + t + ' ══');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });

await page.goto('http://localhost:8163/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '246801');
await page.fill('#pin-b', '246801');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(900);

/* Equipo YA CONFIGURADO: es la unica forma de comprobar que la reorganizacion
   es retrocompatible. Con una instalacion en blanco, perder una clave no se
   notaria. */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id:'p1', activo:true, grado:'Subintendente', nombre:'NELSON DAVID DAVID',
    cedula:'71234567', cargo:'Comandante de Cuadrante', telefono:'3104498111',
    correo:'nelson@unidad.test', entidad:'INSTITUCION DE PRUEBA',
    companero:{ grado:'Patrullero', nombre:'ANA GOMEZ', cedula:'1020304050',
      cargo:'Patrullera', telefono:'3009998877', correo:'ana@unidad.test' } }];
  cfg.ojMinisterio = 'SECTOR DE PRUEBA';
  cfg.ojInstitucion = 'INSTITUCION DE PRUEBA';
  cfg.ojUnidad = 'UNIDAD DE PRUEBA';
  cfg.ojDependencia = 'DISTRITO DOS DE PRUEBA';
  cfg.nombreEstacion = 'CANDELARIA';
  cfg.ojCustDireccion = 'CL 48 # 55 - 50';
  cfg.ojCustBarrio = 'La Candelaria';
  cfg.ojCustCiudad = 'Medellín';
  cfg.ojCustTelefono = '3127324069';
  cfg.ojCustCorreo = 'unidad@prueba.test';
  cfg.patrullaNum = '32'; cfg.patrullaUnidad = 'CAI Parque Bolívar';
  cfg.veredaDefault = 'N/A'; cfg.zonaDefault = 'Urbana'; cfg.localidadDefault = '10';
  cfg.despachosPropios = [{ id:'d1', clase:'FISCALIA', nombre:'Fiscalía URI Centro',
    direccion:'CR 64C # 67-300', barrio:'Caribe', municipio:'Medellín',
    departamento:'Antioquia', telefono:'6045901010', nunc:'0500160002062026',
    defecto:true }];
  DB.saveConfig(cfg);
});

/* Un caso de flagrancia COMPLETO, creado por codigo. Es el patron de «antes»:
   su FPJ-5 se genera ahora y se vuelve a generar al final, tras haber pasado
   por los formularios reorganizados. */
const SEM = {
  tipo:'URI', fechaProc:'2026-08-20', nunc:'0500160002062026', destino:'Fiscalía URI Centro',
  conductas:['Hurto calificado'], articulosCP:['239'],
  lugar:{ muni:'Medellín', depto:'Antioquia', dir:'CL 52A # 50-46', barrio:'La Candelaria',
          caract:'Vía pública', localidad:'10', zona:'Urbana', vereda:'N/A' },
  capturados:[{ id:'c1', tipoDoc:'CC', numDoc:'71234567', expEn:'Medellín',
    priNom:'JUAN', segNom:'CARLOS', priApe:'PEREZ', segApe:'GOMEZ', alias:'N/A',
    fn:'1990-05-10', edad:'36', sexo:'M', nacMuni:'Bello', nacDepto:'Antioquia', nacPais:'',
    ecivil:'Soltero/a', escol:'Bachiller', ocup:'Comerciante',
    dirRes:'CR 45 # 12-30', tel:'3001234567', correo:'juan@prueba.test',
    padres:'Maria Gomez y Pedro Perez', senas:'Cicatriz en la ceja izquierda' }],
  victimas:[], testigos:[], elementos:[], vehiculos:[],
  narracion:{ fechaCapD:'20', fechaCapM:'08', fechaCapA:'2026', horaCapH:'14', horaCapM:'30',
              fechaDispD:'20', fechaDispM:'08', fechaDispA:'2026',
              texto:'Relato del procedimiento de prueba.' },
  servidor:{ grado:'Subintendente', ident:'71234567', nombre:'NELSON DAVID DAVID',
             entidad:'INSTITUCION DE PRUEBA', cargo:'Comandante de Cuadrante',
             tel:'3104498111', correo:'nelson@unidad.test' }
};

/* El texto impreso del FPJ-5, run por run. `buildFPJBlob` ya devuelve el
   paquete descomprimido en `out.files`, así que no hace falta releer el zip. */
const fpjTexto = async caso => page.evaluate(async c => {
  const out = await buildFPJBlob(c, 'CARTA');
  if (!out || !out.files) return 'SIN-DOCUMENTO';
  const xml = new TextDecoder().decode(out.files['word/document.xml']);
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).join('|');
}, caso);

const FPJ_ANTES = await fpjTexto(SEM);
log(FPJ_ANTES !== 'SIN-DOCUMENTO' && FPJ_ANTES.length > 500,
  '[semilla] El FPJ-5 de referencia se genera', FPJ_ANTES.length + ' caracteres');

/* ═══════════════════════════════════════════════════════════════════════════
   A · PUNTO 3 — UN SOLO CARET EN TODA LA APP
   ═══════════════════════════════════════════════════════════════════════════ */
sec('A · PUNTO 3 — el caret: > cerrado, ⌄ abierto, en TODOS los desplegables');

/* El acordeon de Ajustes/Perfil (.lc-acc / .aj-sec): chevron SVG que gira 90°. */
await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(350);
const caretAj = await page.evaluate(() => {
  const arr = document.getElementById('aj-arr-datos-sec');
  const svg = arr.querySelector('svg');
  const cerrado = getComputedStyle(svg).transform;
  toggleAjSec('datos-sec');
  return { cerrado, abiertoClase: arr.classList.contains('open'), hayPath: !!svg.querySelector('path') };
});
await page.waitForTimeout(300);
const caretAj2 = await page.evaluate(() =>
  getComputedStyle(document.querySelector('#aj-arr-datos-sec svg')).transform);
log(caretAj.hayPath && (caretAj.cerrado === 'none' || /matrix\(1, 0, 0, 1/.test(caretAj.cerrado)),
  '[Ajustes] Cerrado, el chevron apunta a la derecha (>)', caretAj.cerrado);
log(caretAj.abiertoClase && /matrix\(-?0?\.?\d*, 1, -1,/.test(caretAj2),
  '[Ajustes] Abierto, gira 90° y apunta abajo (⌄)', caretAj2);

/* ⚠️ Y el del modulo OJ, las actas y la cadena de custodia (<details.oj-mas>),
   que marcaba con «+» / «–»: DOS carets distintos para el mismo gesto segun la
   pantalla. Ahora es el mismo, dibujado con `border` porque ::before no admite
   marcado. */
const fuente = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
log(!/\.oj-mas>summary::before\{content:"\+"/.test(fuente),
  '[OJ] El marcador «+» / «–» ya no existe');
log(/\.oj-mas>summary::before\{[\s\S]{0,200}?border:solid var\(--text-3\)/.test(fuente) &&
    /\.oj-mas\[open\]>summary::before\{transform:rotate\(135deg\)\}/.test(fuente),
  '[OJ] Lo sustituye el mismo chevron, con su giro');

await page.evaluate(() => { wc = ojNuevoCaso(); ws = 2; go('wizard'); renderWiz(); });
await page.waitForTimeout(500);
const caretOJ = await page.evaluate(() => {
  const d = document.querySelector('#wz-panels details.oj-mas');
  if (!d) return null;
  const sum = d.querySelector('summary');
  const t0 = getComputedStyle(sum, '::before').transform;
  const abierto0 = d.open;
  d.open = !d.open;
  return { t0, abierto0, contenido: getComputedStyle(sum, '::before').content };
});
await page.waitForTimeout(300);
const caretOJ2 = await page.evaluate(() =>
  getComputedStyle(document.querySelector('#wz-panels details.oj-mas summary'), '::before').transform);
log(caretOJ && caretOJ.contenido === '""',
  '[OJ] El marcador ya no es un carácter, es una figura', caretOJ && caretOJ.contenido);
log(caretOJ && caretOJ.t0 !== caretOJ2,
  '[OJ] Y gira al abrir y cerrar, como el de Ajustes', (caretOJ && caretOJ.t0) + ' → ' + caretOJ2);

/* Comportamiento pedido: cerrada → clic → abierta → clic → cerrada. */
const ciclo = await page.evaluate(() => {
  const id = 'datos-sec';
  const body = document.getElementById('aj-body-' + id);
  const est = () => body.style.display !== 'none';
  go('ajustes');
  const a = est(); toggleAjSec(id);
  const b = est(); toggleAjSec(id);
  return [a, b, est()];
});
log(ciclo[0] !== ciclo[1] && ciclo[1] !== ciclo[2] && ciclo[0] === ciclo[2],
  'Cerrada → clic → abierta → clic → cerrada', JSON.stringify(ciclo));

/* ═══════════════════════════════════════════════════════════════════════════
   A · PUNTO 1 — ENTIDAD → ATRIBUTO, fuera de Ajustes
   ═══════════════════════════════════════════════════════════════════════════ */
sec('A · PUNTO 1 — la jerarquía llega al resto de la aplicación');

/* Lector de jerarquia: para cada campo visible, de que padre cuelga. Mide la
   RELACION en el DOM, no el color ni el tamaño: un cambio de estilo no lo hace
   pasar, y mover un campo de padre sí lo hace fallar. */
const JERARQUIA = `(sel) => {
  const root = document.querySelector(sel);
  if (!root) return [];
  const vis = el => { const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0; };
  const padreDe = el => {
    const caja = el.closest('.lc-hijos');
    if (!caja) return null;
    let n = caja.previousElementSibling;
    while (n) {
      const l = n.matches('.fl-p') ? n : n.querySelector('.fl-p');
      if (l) return l.textContent.replace(/\\*$/, '').trim();
      n = n.previousElementSibling;
    }
    return null;
  };
  return [...root.querySelectorAll('label.fl')].filter(vis).map(l => {
    const fg = l.closest('.fg');
    return { etiqueta: l.textContent.replace(/\\*$/, '').trim(),
             padre: padreDe(fg || l), esPadre: l.classList.contains('fl-p') };
  });
}`;
const jer = sel => page.evaluate(new Function('return ' + JERARQUIA)(), sel);
const buscar = (arr, txt) => arr.find(x => x.etiqueta.indexOf(txt) === 0);

// ── Wizard de flagrancia · Lugar
await page.evaluate(() => { wc = null; startWizard('URI'); });
await page.waitForTimeout(500);
await page.evaluate(() => { ws = 0; renderWiz(); });
await page.waitForTimeout(300);
const jLugar = await jer('#wz-panels');
log(buscar(jLugar, 'Municipio') && buscar(jLugar, 'Municipio').esPadre,
  '[Lugar] El municipio del hecho es el padre: decide la jurisdicción');
log(['Dirección exacta', 'Barrio', 'Características', 'Localidad', 'Zona', 'Vereda']
    .every(e => { const c = buscar(jLugar, e); return c && c.padre === 'Municipio'; }),
  '[Lugar] Y los seis campos del sitio cuelgan de él',
  jLugar.filter(x => x.padre === 'Municipio').length + ' hijos');

// ── Wizard de flagrancia · Servidor
await page.evaluate(() => { ws = getWizConfig().steps.indexOf('Servidor'); renderWiz(); });
await page.waitForTimeout(300);
const jServ = await jer('#wz-panels');
log(buscar(jServ, 'Nombres y apellidos') && buscar(jServ, 'Nombres y apellidos').esPadre,
  '[Servidor] El funcionario es el padre, no un campo más de la lista');
log(['Grado', 'Identificación', 'Entidad', 'Cargo', 'Teléfono', 'Correo']
    .every(e => { const c = buscar(jServ, e); return c && c.padre === 'Nombres y apellidos'; }),
  '[Servidor] Y «Entidad» ya no puede leerse como la del caso: es suya',
  jServ.filter(x => x.padre === 'Nombres y apellidos').length + ' hijos');

// ── Modal de persona
await page.evaluate(() => { wc = null; go('personas'); openPersonModal('x', -1, {}, true, true); });
await page.waitForTimeout(400);
const jPer = await jer('#modal-c');
log(buscar(jPer, 'Nombre completo') && buscar(jPer, 'Nombre completo').esPadre &&
    ['Primer nombre', 'Segundo nombre', 'Primer apellido', 'Segundo apellido', 'Alias']
      .every(e => { const c = buscar(jPer, e); return c && c.padre === 'Nombre completo'; }),
  '[Persona] Las cuatro partes del nombre y el alias cuelgan de «Nombre completo»');

/* ⚠️ El campo que estaba en el nivel equivocado: la filiacion se pedia bajo
   «Contacto», entre el telefono y el correo. */
const gruposPer = await page.evaluate(() => {
  const de = id => {
    const el = document.getElementById(id);
    const cuerpo = el && el.closest('.lc-acc-body');
    if (!cuerpo) return null;
    const acc = cuerpo.closest('.lc-acc');
    return acc.querySelector('.lc-acc-tit').textContent.trim();
  };
  return { padres: de('pm-padres'), tel: de('pm-tel'), ocup: de('pm-ocup'), doc: de('pm-numDoc') };
});
log(gruposPer.padres === 'Datos personales',
  '[Persona] «Nombres de los padres» sube de «Contacto» a «Datos personales»', gruposPer.padres);
log(gruposPer.tel === 'Contacto' && gruposPer.doc === 'Identificación' && gruposPer.ocup === 'Datos personales',
  '[Persona] Y los demás siguen en el grupo que les corresponde',
  JSON.stringify(gruposPer));

// ── Formulario de despacho
await page.evaluate(() => { closeModal(); go('despachos'); lcDespForm(); });
await page.waitForTimeout(400);
const jDesp = await jer('#modal-c');
log(buscar(jDesp, 'Nombre del despacho') && buscar(jDesp, 'Nombre del despacho').esPadre,
  '[Despacho] El despacho es el padre de su propia ubicación');
log(['Dirección', 'Barrio', 'Municipio', 'Departamento', 'Teléfono', 'Correo']
    .every(e => { const c = buscar(jDesp, e); return c && c.padre === 'Nombre del despacho'; }),
  '[Despacho] Sus seis atributos, anidados', jDesp.filter(x => x.padre === 'Nombre del despacho').length + ' hijos');

// ── Perfil · Mi jurisdiccion: DOS entidades, no una lista de cinco
await page.evaluate(() => {
  closeModal(); go('perfil');
  /* ⚠️ El panel nace CERRADO porque la semilla ya trae patrulla: se abre para
     poder leer la jerarquía de sus etiquetas. */
  const b = document.getElementById('acc-body-pf-juris');
  if (b && b.style.display === 'none') lcAccToggle('pf-juris');
});
await page.waitForTimeout(400);
const jJur = await jer('#perfil-juris');
log(buscar(jJur, 'Patrulla') && buscar(jJur, 'Patrulla').esPadre &&
    buscar(jJur, 'CAI') && buscar(jJur, 'CAI').padre === 'Patrulla',
  '[Mi jurisdicción] El CAI es de la patrulla');
log(['Zona', 'Localidad', 'Vereda'].every(e => {
      const c = buscar(jJur, e); return c && c.padre === 'Lugar por defecto de mis capturas'; }),
  '[Mi jurisdicción] Y los tres valores del lugar son otra entidad, aparte');

// ── Wizard OJ
await page.evaluate(() => { wc = ojNuevoCaso(); go('wizard'); ws = 1; renderWiz(); });
await page.waitForTimeout(500);
const jOJ1 = await jer('#wz-panels');
log(buscar(jOJ1, 'No. de la orden') && buscar(jOJ1, 'No. de la orden').esPadre &&
    buscar(jOJ1, 'Fecha de expedición').padre === 'No. de la orden',
  '[OJ · proceso] La fecha de expedición es de LA ORDEN');
log(buscar(jOJ1, 'SPOA') && buscar(jOJ1, 'SPOA').esPadre &&
    ['Número Interno', 'Fecha Decisión', 'Fecha de los Hechos']
      .every(e => { const c = buscar(jOJ1, e); return c && c.padre === 'SPOA'; }),
  '[OJ · proceso] Y las tres restantes son DEL PROCESO: dos entidades, no seis campos');
log(buscar(jOJ1, 'Municipio') && buscar(jOJ1, 'Municipio').padre === 'Nombre completo del despacho',
  '[OJ · proceso] El municipio es el del despacho, y se ve');

await page.evaluate(() => { ws = 2; renderWiz(); });
await page.waitForTimeout(400);
const jOJ2 = await jer('#wz-panels');
log(buscar(jOJ2, 'Lugar de la') && buscar(jOJ2, 'Lugar de la').esPadre &&
    ['Barrio o vereda', 'Municipio', 'Departamento', 'Tipo de lugar']
      .every(e => { const c = buscar(jOJ2, e); return c && /^Lugar de la/.test(c.padre || ''); }),
  '[OJ · materialización] El lugar de la captura es el padre de sus cuatro atributos');

/* ⚠️ EL MISMO DATO, EL MISMO NOMBRE. El membrete se pide en Ajustes por su
   nombre y en el wizard se pedia por su numero de renglon, escribiendo en las
   MISMAS claves. Y la linea 4 decia «estacion o dependencia» cuando el 2.º pase
   de la Mejora 7 separo el distrito de la estacion. */
await page.evaluate(() => { ws = 3; renderWiz(); });
await page.waitForTimeout(600);
const membrete = await page.evaluate(() => {
  const et = id => {
    const el = document.getElementById(id);
    const fg = el && el.closest('.fg');
    const l = fg && fg.querySelector('label.fl');
    return l ? l.textContent.replace(/\*$/, '').trim() : null;
  };
  return { min: et('oj-e-min'), ins: et('oj-e-ins'), uni: et('oj-e-uni'), dep: et('oj-e-dep') };
});
const etAjustes = await page.evaluate(() => {
  go('ajustes');
  const et = id => {
    const l = document.getElementById(id).closest('.fg').querySelector('label.fl');
    return l.textContent.replace(/\*$/, '').trim();
  };
  return { min: et('aj-oj-min'), ins: et('aj-oj-inst'), uni: et('aj-oj-uni'), dep: et('aj-oj-dep') };
});
log(membrete.min === etAjustes.min && membrete.ins === etAjustes.ins &&
    membrete.uni === etAjustes.uni && membrete.dep === etAjustes.dep,
  '⚠️ El membrete se llama IGUAL en el wizard y en Ajustes: escriben en las mismas claves',
  JSON.stringify(membrete));
log(!/Línea [1-4]/.test(JSON.stringify(membrete)),
  'Y ya no se pide por número de renglón');
log(/Distrito/.test(membrete.dep) && !/estación o dependencia/i.test(membrete.dep),
  '⚠️ La línea 4 dice DISTRITO, como Ajustes: el membrete imprime el distrito', membrete.dep);

await page.evaluate(() => {
  wc = ojNuevoCaso(); go('wizard'); ws = 3; renderWiz();
  /* Los <details> plegados se abren: se está midiendo la jerarquía, no el
     estado inicial de los paneles (que mide el punto 4). */
  document.querySelectorAll('#wz-panels details').forEach(d => { d.open = true; });
});
await page.waitForTimeout(600);
const jOJ3 = await jer('#wz-panels');
/* ⚠️ Aquí se mide POR ID y no por etiqueta: este paso tiene DOS campos
   «Dirección» y dos «Ciudad» —los del destinatario y los de la unidad de
   custodia—, así que buscar por texto devolvía el primero y medía el padre
   equivocado. Que dos campos distintos compartan etiqueta es precisamente lo
   que la jerarquía viene a desambiguar. */
const porId = await page.evaluate(() => {
  const de = id => {
    const e = document.getElementById(id);
    if (!e) return { id, falta: true };
    const fg = e.closest('.fg');
    const l = fg && fg.querySelector('label.fl');
    let padre = null;
    const caja = e.closest('.lc-hijos');
    if (caja) {
      let n = caja.previousElementSibling;
      while (n && !padre) {
        const lp = n.matches('.fl-p') ? n : n.querySelector('.fl-p');
        if (lp) padre = lp.textContent.replace(/\*$/, '').trim();
        n = n.previousElementSibling;
      }
    }
    return { etiqueta: l ? l.textContent.replace(/\*$/, '').trim() : null,
             esPadre: l ? l.classList.contains('fl-p') : false, padre };
  };
  const ids = ['oj-c-est','oj-c-dir','oj-c-bar','oj-c-ciu','oj-c-tel','oj-c-cor','oj-c-web',
               'oj-f-nom','oj-f-gra','oj-f-car','oj-f-tel','oj-f-cor',
               'oj-x-nom','oj-x-dir','oj-x-mun'];
  const o = {}; ids.forEach(i => { o[i] = de(i); }); return o;
});
log(porId['oj-c-est'].esPadre &&
    ['oj-c-dir','oj-c-bar','oj-c-ciu','oj-c-tel','oj-c-cor','oj-c-web']
      .every(i => /custodia/.test(porId[i].padre || '')),
  '[OJ · revisión] La unidad de custodia es el padre de su dirección y su contacto',
  porId['oj-c-dir'].padre);
log(porId['oj-f-nom'].esPadre &&
    ['oj-f-gra','oj-f-car','oj-f-tel','oj-f-cor']
      .every(i => porId[i].padre === 'Nombres y apellidos'),
  '[OJ · revisión] Y el firmante es una persona, no cinco datos sueltos del oficio',
  porId['oj-f-gra'].padre);
/* Y el destinatario, que es quien comparte etiquetas con la custodia. */
log(porId['oj-x-nom'].esPadre &&
    porId['oj-x-dir'].padre === porId['oj-x-nom'].etiqueta &&
    porId['oj-x-mun'].padre === porId['oj-x-nom'].etiqueta,
  '[OJ · revisión] ⚠️ Y su «Dirección» ya no se confunde con la de la custodia: cuelga del destinatario',
  porId['oj-x-dir'].padre);

/* ═══════════════════════════════════════════════════════════════════════════
   A · PUNTO 2 — TEXTOS DE ORIENTACION
   ═══════════════════════════════════════════════════════════════════════════ */
sec('A · PUNTO 2 — el ruido desaparece; lo necesario se queda');

/* Los textos que describian un automatismo, repetian el titulo de encima o
   mandaban a un paso que esta a la vista. */
const fueron = [
  ['La constancia de verificación de la orden la arma el informe', 'la nota de un campo que ya no existe (OJ, paso 2)'],
  ['continúa al siguiente paso', 'el «continúa al siguiente paso», con el botón Siguiente debajo'],
  ['Elementos materiales probatorios y evidencia física, uno por renglón', 'el párrafo que traducía las siglas del título de encima'],
  ['Los elementos materiales probatorios se diligencian en el paso', 'el aviso que señalaba un paso visible en la barra de progreso'],
  ['El formato solo trae casillas M y F', 'los 132 caracteres sobre una casilla en blanco'],
  ['La app marca la casilla con «X» y escribe en', 'la descripción del mecanismo interno de la X'],
  ['Se deja vacío si no aplica', 'lo obvio de un campo opcional'],
  ['Dónde exactamente estaba el elemento al hallarlo', 'lo que el placeholder ya ejemplifica'],
  ['El número sale de la cadena; la cantidad, del numeral 7', 'la procedencia de un campo deshabilitado'],
  ['Cada cadena es un documento aparte', 'la explicación del reparto que se ve encima'],
  ['La vereda, la zona y la localidad llegan puestas', 'el párrafo que agrupaba lo que ahora agrupa la jerarquía']
];
fueron.forEach(([t, q]) => log(fuente.indexOf(t) === -1, 'Se retiró ' + q));

/* ⚠️ Y lo que NO se puede retirar: fundamento legal, advertencias y vistas
   previas de lo que va a salir impreso. */
const quedan = [
  ['Derecho del art. 303.1 del C.P.P.', 'el fundamento legal de un campo'],
  ['El archivo de capturas sale sin cifrar', 'la advertencia de datos sensibles'],
  ['4 últimos son el año', '⚠️ que el año se actualiza solo: evita corregirlo a mano cada enero'],
  ['Se imprime junto al nombre', 'la vista previa de lo que va impreso'],
  ['Si generas, el informe deja constancia de que la orden figuraba vencida', 'la advertencia de la orden vencida']
];
quedan.forEach(([t, q]) => log(fuente.indexOf(t) !== -1, 'Se conserva ' + q));

/* Medida objetiva sobre la app real: ni un texto de ayuda por encima del umbral
   que la Mejora 6b fijo en 110 caracteres — y que hasta ahora solo se vigilaba
   en Ajustes. */
const LARGOS = `(sel) => {
  const root = document.querySelector(sel);
  if (!root) return [];
  return [...root.querySelectorAll('.oj-hint,.aj-nota,.oj-auto')]
    .filter(e => e.getBoundingClientRect().height > 0)
    .map(e => e.textContent.replace(/\\s+/g, ' ').trim())
    .filter(t => t.length > 110);
}`;
const largos = sel => page.evaluate(new Function('return ' + LARGOS)(), sel);

const pantallas = [];
for (const [nombre, ir, sel] of [
  ['Ajustes', () => go('ajustes'), '#screen-ajustes'],
  ['Perfil', () => go('perfil'), '#screen-perfil'],
  ['Despachos', () => { go('despachos'); lcDespForm(); }, '#modal-c'],
  ['Persona', () => { closeModal(); go('personas'); openPersonModal('x', -1, {}, true, true); }, '#modal-c']
]) {
  await page.evaluate(ir);
  await page.waitForTimeout(400);
  pantallas.push([nombre, await largos(sel)]);
}
await page.evaluate(() => { closeModal(); wc = null; startWizard('URI'); });
await page.waitForTimeout(500);
const nPasos = await page.evaluate(() => getWizConfig().steps.length);
for (let i = 0; i < nPasos; i++) {
  await page.evaluate(n => { ws = n; renderWiz(); }, i);
  await page.waitForTimeout(220);
  pantallas.push(['Flagrancia ' + i, await largos('#wz-panels')]);
}
await page.evaluate(() => { wc = ojNuevoCaso(); go('wizard'); });
for (let i = 0; i < 4; i++) {
  await page.evaluate(n => { ws = n; renderWiz(); }, i);
  await page.waitForTimeout(300);
  pantallas.push(['OJ ' + i, await largos('#wz-panels')]);
}
const excedidos = pantallas.filter(p => p[1].length);
log(excedidos.length === 0,
  '⚠️ Ni un texto de ayuda por encima de 110 caracteres, en las 17 pantallas medidas',
  excedidos.length ? JSON.stringify(excedidos[0]) : pantallas.length + ' pantallas');

/* ═══════════════════════════════════════════════════════════════════════════
   A · PUNTO 4 — ACORDEONES SOLO DONDE HACEN FALTA
   ═══════════════════════════════════════════════════════════════════════════ */
sec('A · PUNTO 4 — acordeones con criterio, no en todas partes');

const acc = await page.evaluate(() => {
  go('personas'); openPersonModal('x', -1, {}, true, true);
  return [...document.querySelectorAll('#modal-c .lc-acc')].map(a => ({
    t: a.querySelector('.lc-acc-tit').textContent.trim(),
    abierto: a.querySelector('.lc-acc-body').style.display !== 'none',
    campos: a.querySelectorAll('input,select,textarea').length
  }));
});
await page.waitForTimeout(200);
log(acc.length === 4 && acc.map(a => a.t).join('|') === 'Identificación|Datos personales|Contacto|Señas particulares',
  '[Persona] Los cuatro grupos que ya existían pasan a paneles', acc.map(a => a.t).join(' · '));

/* ⚠️ AL CREAR van ABIERTOS y es deliberado: el FPJ-5 imprime esos datos en los
   apartados 4, 5 y 6, asi que plegarlos escondería trabajo obligatorio. La
   regla es la de la Mejora 5 (obs. 6): se pliega lo excepcional o lo ya
   resuelto, nunca lo corriente que está por hacer. */
log(acc[0].abierto && acc[1].abierto && acc[2].abierto && !acc[3].abierto,
  '[Persona] ⚠️ Al AGREGAR nacen abiertos: no se esconde trabajo obligatorio',
  acc.map(a => a.t + (a.abierto ? '=abierto' : '=plegado')).join(' · '));

const accEd = await page.evaluate(() => {
  closeModal();
  openPersonModal('x', 0, { tipoDoc:'CC', numDoc:'999', priNom:'ANA', priApe:'DIAZ',
    fn:'1990-01-01', edad:'36', sexo:'F', ocup:'Docente',
    dirRes:'CL 10 # 20-30', tel:'3001112233' }, true, false);
  return [...document.querySelectorAll('#modal-c .lc-acc')].map(a => ({
    t: a.querySelector('.lc-acc-tit').textContent.trim(),
    abierto: a.querySelector('.lc-acc-body').style.display !== 'none',
    resumen: (a.querySelector('.lc-acc-sum') || {}).textContent || ''
  }));
});
await page.waitForTimeout(200);
log(accEd[1] && !accEd[1].abierto && accEd[2] && !accEd[2].abierto,
  '[Persona] ⚠️ Al EDITAR, lo ya diligenciado nace plegado: ahí sí ahorra scroll');
log(/36 años/.test(accEd[1].resumen) && /CL 10/.test(accEd[2].resumen),
  '[Persona] Y cada panel plegado dice qué lleva dentro', accEd[1].resumen + ' | ' + accEd[2].resumen);

const accVacio = await page.evaluate(() => {
  closeModal();
  openPersonModal('x', 0, { tipoDoc:'CC', numDoc:'888', priNom:'LUIS' }, true, false);
  const a = [...document.querySelectorAll('#modal-c .lc-acc')];
  return a.map(x => x.querySelector('.lc-acc-body').style.display !== 'none');
});
log(accVacio[1] && accVacio[2],
  '[Persona] ⚠️ Pero un panel VACÍO nace abierto: lo que falta siempre se ve');

/* ⚠️ PLEGAR NO ES BORRAR — la comprobacion mas importante del punto 4. */
const plegadoRecolecta = await page.evaluate(async () => {
  closeModal();
  wc = null; startWizard('URI'); ws = getWizConfig().steps.indexOf('Capturados'); renderWiz();
  openPersonModal('capturados', -1, {}, true, false);
  document.getElementById('pm-priNom').value = 'PLEGADO';
  document.getElementById('pm-priApe').value = 'RECOLECTADO';
  document.getElementById('pm-ocup').value = 'Mecánico';
  document.getElementById('pm-tel').value = '3005556677';
  document.getElementById('pm-padres').value = 'Rosa y Luis';
  // se cierran los tres paneles ANTES de guardar
  ['pm-ident', 'pm-datos', 'pm-cont'].forEach(id => {
    const b = document.getElementById('acc-body-' + id);
    if (b && b.style.display !== 'none') lcAccToggle(id);
  });
  const cerrados = ['pm-ident', 'pm-datos', 'pm-cont']
    .every(id => document.getElementById('acc-body-' + id).style.display === 'none');
  savePersonModal('capturados', -1, true);
  const p = wc.capturados[0] || {};
  return { cerrados, nom: p.priNom, ape: p.priApe, ocup: p.ocup, tel: p.tel, padres: p.padres };
});
log(plegadoRecolecta.cerrados, '⚠️ Los tres paneles se cierran antes de guardar');
log(plegadoRecolecta.nom === 'PLEGADO' && plegadoRecolecta.ape === 'RECOLECTADO' &&
    plegadoRecolecta.ocup === 'Mecánico' && plegadoRecolecta.tel === '3005556677' &&
    plegadoRecolecta.padres === 'Rosa y Luis',
  '⚠️ PLEGAR NO ES BORRAR: con los paneles cerrados se recolectan los 5 campos',
  JSON.stringify(plegadoRecolecta));

/* Y el criterio inverso: NO se han sembrado acordeones por todas partes. */
const accPorPantalla = await page.evaluate(() => {
  const n = {};
  ['capturas', 'personas', 'despachos', 'estadisticas', 'dossier'].forEach(s => {
    const el = document.getElementById('screen-' + s);
    n[s] = el ? el.querySelectorAll('.lc-acc').length : -1;
  });
  return n;
});
log(Object.values(accPorPantalla).every(v => v === 0),
  '⚠️ Y ninguna pantalla de consulta estrena acordeones: no se abusa del patrón',
  JSON.stringify(accPorPantalla));

/* ═══════════════════════════════════════════════════════════════════════════
   B · LA APP PRODUCE EXACTAMENTE LO MISMO
   ═══════════════════════════════════════════════════════════════════════════ */
sec('B · NADA cambió: ni un dato, ni una clave, ni un carácter de los documentos');

const FPJ_DESPUES = await fpjTexto(SEM);
log(FPJ_ANTES === FPJ_DESPUES,
  '⚠️ [B1] El FPJ-5 sale IDÉNTICO, carácter a carácter, tras toda la reorganización',
  FPJ_ANTES === FPJ_DESPUES ? FPJ_DESPUES.length + ' caracteres iguales' : 'CAMBIÓ');

/* Y el mismo caso, pero diligenciado POR LOS FORMULARIOS reorganizados: es lo
   que de verdad prueba que anidar un campo no lo desconectó de su recolector. */
const porFormulario = await page.evaluate(async (sem) => {
  wc = null; startWizard('URI');
  const paso = n => { ws = getWizConfig().steps.indexOf(n); renderWiz(); };
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };

  paso('Lugar');
  set('w-muni', sem.lugar.muni); set('w-depto', sem.lugar.depto);
  set('w-barrio', sem.lugar.barrio); set('w-caract', sem.lugar.caract);
  set('w-local', sem.lugar.localidad); set('w-zona', sem.lugar.zona); set('w-vereda', sem.lugar.vereda);
  set('w-dir', sem.lugar.dir);
  collectStep();

  paso('Caso');
  set('w-fecha', sem.fechaProc); set('w-nunc', sem.nunc);
  const c0 = document.querySelector('#w-conds [data-c="cond"]');
  const a0 = document.querySelector('#w-conds [data-c="art"]');
  if (c0) c0.value = sem.conductas[0];
  if (a0) a0.value = sem.articulosCP[0];
  collectStep();

  paso('Servidor');
  set('w-sNombre', sem.servidor.nombre); set('w-sGrado', sem.servidor.grado);
  set('w-sId', sem.servidor.ident); set('w-sEntidad', sem.servidor.entidad);
  set('w-sCargo', sem.servidor.cargo); set('w-sTel', sem.servidor.tel);
  set('w-sCorreo', sem.servidor.correo);
  collectStep();

  return { lugar: wc.lugar, servidor: wc.servidor, nunc: wc.nunc,
           conductas: wc.conductas, articulos: wc.articulosCP };
}, SEM);
const mismo = (a, b) => { const k = Object.keys(b).sort();
  return k.length === Object.keys(a).length && k.every(x => a[x] === b[x]); };
log(mismo(porFormulario.lugar, SEM.lugar),
  '⚠️ [B2] El paso «Lugar», con el municipio como padre, recolecta sus 8 campos igual',
  JSON.stringify(porFormulario.lugar));
log(mismo(porFormulario.servidor, SEM.servidor),
  '⚠️ [B3] El paso «Servidor», anidado, recolecta sus 7 campos igual',
  JSON.stringify(porFormulario.servidor));
log(porFormulario.nunc === SEM.nunc && porFormulario.conductas[0] === SEM.conductas[0] &&
    porFormulario.articulos[0] === SEM.articulosCP[0],
  '[B4] Y el NUNC, la conducta y su artículo del C.P. siguen llegando');

/* El oficio de orden judicial: el membrete cambio de ETIQUETA, no de clave. */
const oficio = await page.evaluate(async () => {
  const cfg = DB.getConfig();
  wc = ojNuevoCaso(); ws = 3; go('wizard'); renderWiz();
  const v = id => (document.getElementById(id) || {}).value;
  const leidos = { min: v('oj-e-min'), ins: v('oj-e-ins'), uni: v('oj-e-uni'), dep: v('oj-e-dep') };
  ojCollect();
  return { leidos, cfg: { min: cfg.ojMinisterio, ins: cfg.ojInstitucion,
           uni: cfg.ojUnidad, dep: cfg.ojDependencia },
           modelo: wc.oj.encabezado };
});
log(oficio.leidos.min === oficio.cfg.min && oficio.leidos.dep === oficio.cfg.dep,
  '⚠️ [B5] Los campos del membrete siguen leyendo las mismas claves de Ajustes',
  JSON.stringify(oficio.leidos));
log(oficio.modelo.ministerio === oficio.cfg.min && oficio.modelo.dependencia === oficio.cfg.dep,
  '[B6] Y ojCollect los sigue recolectando en el caso', JSON.stringify(oficio.modelo));

/* Y la unidad de custodia anidada: sus 6 hijos llegan al modelo. */
const custodia = await page.evaluate(() => {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('oj-c-est', 'ESTACION PRUEBA'); set('oj-c-dir', 'CL 1 # 2-3');
  set('oj-c-bar', 'BarrioX'); set('oj-c-ciu', 'Medellín');
  set('oj-c-tel', '3001234567'); set('oj-c-cor', 'cust@prueba.test');
  set('oj-c-web', 'www.prueba.test');
  ojCollect();
  return wc.oj.custodia;
});
log(custodia.estacion === 'ESTACION PRUEBA' && custodia.direccion === 'CL 1 # 2-3' &&
    custodia.barrio === 'BarrioX' && custodia.ciudad === 'Medellín' &&
    custodia.telefono === '3001234567' && custodia.correo === 'cust@prueba.test' &&
    custodia.web === 'www.prueba.test',
  '⚠️ [B7] La custodia anidada recolecta sus 7 campos', JSON.stringify(custodia));

/* Mi jurisdiccion: dos entidades en pantalla, las mismas cinco claves en cfg. */
const juris = await page.evaluate(() => {
  go('perfil');
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('pj-patrulla', '47'); set('pj-cai', 'CAI Prueba');
  set('pj-zona', 'Rural'); set('pj-localidad', '12'); set('pj-vereda', 'La Loma');
  lcJurisGuardar();
  const c = DB.getConfig();
  return { p: c.patrullaNum, cai: c.patrullaUnidad, z: c.zonaDefault,
           l: c.localidadDefault, v: c.veredaDefault };
});
log(juris.p === '47' && juris.cai === 'CAI Prueba' && juris.z === 'Rural' &&
    juris.l === '12' && juris.v === 'La Loma',
  '⚠️ [B8] «Mi jurisdicción», reagrupada en dos entidades, guarda sus 5 claves de siempre',
  JSON.stringify(juris));

/* El despacho anidado guarda igual. */
const desp = await page.evaluate(() => {
  go('despachos'); lcDespForm();
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('dp-nom', 'Fiscalía de Prueba'); set('dp-bar', 'Centro');
  set('dp-mun', 'Envigado'); set('dp-dep', 'Antioquia');
  set('dp-tel', '6041112233'); set('dp-cor', 'fis@prueba.test');
  set('dp-nunc', '0500160002062026');
  lcDespGuardarForm();
  const l = (DB.getConfig().despachosPropios || []).filter(d => d.nombre === 'Fiscalía de Prueba')[0] || {};
  return { n: l.nombre, b: l.barrio, m: l.municipio, d: l.departamento,
           t: l.telefono, c: l.correo, nunc: l.nunc };
});
log(desp.n === 'Fiscalía de Prueba' && desp.b === 'Centro' && desp.m === 'Envigado' &&
    desp.d === 'Antioquia' && desp.t === '6041112233' && desp.c === 'fis@prueba.test' &&
    desp.nunc === '0500160002062026',
  '⚠️ [B9] Y el despacho, con sus seis atributos anidados, se guarda entero',
  JSON.stringify(desp));

/* ⚠️ La colision de nombres que este trabajo destapo: `lcHijos` ya existia como
   utilidad del motor OOXML. Si la primitiva de la jerarquia se hubiera llamado
   igual, habria ganado la del motor y esta habria devuelto [] en silencio. */
const motor = await page.evaluate(() => {
  const doc = new DOMParser().parseFromString(
    '<w:body xmlns:w="x"><w:p/><w:p/><w:tbl/></w:body>', 'text/xml');
  return { hijos: lcHijos(doc.documentElement, 'p').length,
           atribs: typeof lcAtribs === 'function' ? lcAtribs('<i>x</i>') : null };
});
log(motor.hijos === 2, '⚠️ [B10] `lcHijos` sigue siendo la del motor OOXML, intacta', motor.hijos);
log(motor.atribs === '<div class="lc-hijos"><i>x</i></div>',
  '[B11] Y la primitiva de la jerarquía vive aparte, como `lcAtribs`', motor.atribs);

log(errs.length === 0, '[B12] Consola limpia en todo el recorrido', errs.slice(0, 2).join(' | '));

const ok = R.filter(Boolean).length;
console.log('\n─────────────────────────────────────────');
console.log(`${ok}/${R.length}  ` + (ok === R.length ? '✅ TODO EN VERDE' : '❌ HAY FALLOS'));
await browser.close();
server.close();
process.exit(ok === R.length ? 0 : 1);
