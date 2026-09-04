/* Mejora 6 — SEGUNDO DOCUMENTO (2026-08-28). Diecisiete observaciones de campo
   con un hilo unico: la app se llenó de avisos, estados y campos que no comunican
   nada y que tapan lo que sí importa. Aqui se mide, sobre la app real en un
   telefono (384x800, touch), que ese ruido desaparecio SIN perder ninguna
   funcion — y que los datos que se dejaron de pedir se ponen solos.

   ⚠️ El archivo «Mejora 6.docx» del repositorio fue REEMPLAZADO por el usuario:
   su contenido anterior (menu ⋮ / expediente) esta implementado y verificado en
   verify_mejora6.mjs, que sigue en verde. Este es el segundo documento. */
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
await new Promise(r => server.listen(8151, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 384, height: 800 }, hasTouch: true, isMobile: true, acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });

await page.goto('http://localhost:8151/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '246801');
await page.fill('#pin-b', '246801');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(900);

/* Perfil con COMPANERO de patrulla: es la semilla de las observaciones 7 y 12
   (los dos funcionarios salen de aqui y no se vuelven a pedir).
   ⚠️ El companero tiene un rango MAYOR que el titular a proposito: asi se mide
   que el dossier ordena por la piramide de rangos y no por orden de registro. */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id:'p1', grado:'Subintendente', nombre:'Nelson David David',
    cedula:'1035302775', telefono:'3104498111', cargo:'Integrante patrulla', entidad:'Institucion (DEMO)',
    correo:'nd@correo.test',
    companero:{ grado:'Intendente', nombre:'Ana Maria Perez', cedula:'43567890', cargo:'Comandante patrulla', entidad:'' } }];
  cfg.perfilActivo = 'p1';
  cfg.nombreEstacion = 'CANDELARIA'; cfg.ojCustCiudad = 'Medellin';
  DB.saveConfig(cfg);
});

/* Dos capturas de flagrancia: una CON elementos en el numeral 7 y otra SIN
   ninguno — que es el caso del reporte (obs. 2). Y una de orden judicial. */
const ids = await page.evaluate(async () => {
  const con = SIM.genFlagrancia('URI'); con.isTest = false;
  con.elementos = [{ id:'e1', cant:'2', desc:'celulares marca Samsung' }];
  await DB.saveCase(con);
  const sin = SIM.genFlagrancia('URI'); sin.isTest = false;
  sin.elementos = []; sin.narracion = sin.narracion || {}; sin.narracion.emp = '';
  await DB.saveCase(sin);
  const oj = SIM.genOJ(); oj.isTest = false; await DB.saveCase(oj);
  go('capturas');
  return { con: con.id, sin: sin.id, oj: oj.id };
});
await page.waitForTimeout(500);

console.log('\n══ Obs. 1 y 9 · el documento sale en Word y el papel no se pregunta ══');

const exp = await page.evaluate(() => ({
  ojSoloWord: lcExportSoloWord('OJ'),
  todosSoloWord: Object.keys(LC_DOCS).every(k => LC_DOCS[k].soloWord || LC_DOCS[k].esPDF),
  papelFijo: lcPapelCfg(),
  efectivoOJ: lcPapelEfectivo('OJ'),
  efectivoFPJ: lcPapelEfectivo('FPJ'),
  sinDialogo: typeof window.lcExportConfirmar === 'undefined' && typeof window._lcExportPintar === 'undefined',
  sinAjustesPapel: typeof window.ajSetPapel === 'undefined' && typeof window.lcGuardarPapel === 'undefined'
}));
log(exp.ojSoloWord === true, '[1] El oficio de orden judicial es SOLO WORD: ya no se ofrece PDF');
log(exp.todosSoloWord === true, '[2] Los seis formatos tienen una sola salida posible cada uno');
log(exp.papelFijo === 'CARTA' && exp.efectivoOJ === 'CARTA' && exp.efectivoFPJ === 'CARTA',
  '[3] El papel es Carta fijo, sin preguntarlo ni guardarlo', exp.efectivoOJ);
log(exp.sinDialogo, '[4] El dialogo de exportacion ya no existe: no hay nada que preguntar');
log(exp.sinAjustesPapel, '[5] Y tampoco su seccion en Ajustes ni el setter del papel');

/* La prueba que importa: al pedir el documento NO se abre ningun dialogo y el
   .docx llega igual. Se mide sobre la salida real, no sobre la funcion. */
await page.evaluate(() => {
  navigator.canShare = d => !!(d && d.files && d.files.length);
  navigator.share = d => { window._shared = { name:d.files[0].name }; return Promise.resolve(); };
});
await page.evaluate(id => abrirEnvioDoc(id), ids.oj);
await page.waitForTimeout(1800);
const sinDlg = await page.evaluate(() => ({
  dialogo: !!document.getElementById('exp-go'),
  sheet: !!document.querySelector('#share-title'),
  doc: window._shareDoc ? _shareDoc.fname : null
}));
log(sinDlg.dialogo === false, '[6] Enviar el oficio NO abre ningun dialogo de formato ni de papel');
log(/\.docx$/.test(sinDlg.doc || ''), '[7] Y el documento pre-generado es el .docx', sinDlg.doc);
await page.evaluate(() => closeShareSheet());
await page.waitForTimeout(200);

console.log('\n══ Obs. 2 · el expediente sin avisos, y sin los formatos que no existen ══');

const expedCon = await page.evaluate(id => {
  abrirDossierCaso(id);
  const est = document.getElementById('exp-estado');
  return {
    estadoVisible: !!(est && est.style.display !== 'none' && est.innerHTML.trim()),
    txt: document.querySelector('#screen-dossier .pane').textContent,
    docs: [...document.querySelectorAll('#exp-docs .tbt')].map(e => e.textContent),
    reg: lcEstadoDocs(DB.getCase(id)).map(d => d.lbl)
  };
}, ids.con);
log(!/PLAZO VENCIDO|Plazo de 36 horas|Plazo vencido/i.test(expedCon.txt),
  '[8] El expediente ya no muestra el aviso del plazo de 36 horas');
log(!/FALTAN DATOS/i.test(expedCon.txt) || !expedCon.estadoVisible,
  '[9] Ni el bloque «Faltan datos» de Estado');
log(expedCon.estadoVisible === false, '[10] Sin nada que decir, el bloque Estado no se pinta');
/* ⚠️ La cuenta se DERIVA del registro: escrita a mano, cada formato nuevo la
   deja obsoleta (le pasó con el acta de entrega y el resumen, 2026-08-30) y el
   check acaba midiendo un número en vez de la regla, que es que la pantalla
   pinte exactamente lo que dice `lcEstadoDocs`. */
log(expedCon.docs.length === expedCon.reg.length && expedCon.docs.length >= 5,
  '[11] Con EMP registrados se ofrecen todos los documentos del registro', expedCon.docs.join(' · '));

const expedSin = await page.evaluate(id => {
  abrirDossierCaso(id);
  return {
    docs: [...document.querySelectorAll('#exp-docs .tbt')].map(e => e.textContent),
    reg: lcEstadoDocs(DB.getCase(id)).map(d => d.lbl),
    txt: document.getElementById('exp-docs').textContent
  };
}, ids.sin);
/* ⚠️ El resumen de la captura SI se ofrece sin elementos: no es un formato del
   numeral 7 sino la hoja de trabajo del expediente. Lo que se mide es que los
   TRES del numeral 7 desaparezcan, no un numero fijo de tarjetas. */
log(expedSin.docs.length === expedSin.reg.length && expedSin.docs.length < expedCon.docs.length,
  '[12] SIN EMP ni EF no se ofrecen acta de incautacion, cadena, rotulo ni entrega', expedSin.docs.join(' · '));
log(!/incautaci|custodia|tulo de EMP/i.test(expedSin.txt),
  '[13] No es que salgan bloqueadas: no salen — hay capturas sin elementos');
log(!/Faltan datos/i.test(expedSin.txt),
  '[14] Y por eso ya no hay ningun «Faltan datos» que mostrar');

const expedOJ = await page.evaluate(id => {
  abrirDossierCaso(id);
  return [...document.querySelectorAll('#exp-docs .tbt')].map(e => e.textContent);
}, ids.oj);
/* ⚠️ El oficio y el acta de derechos son los únicos FORMATOS de un expediente
   de orden judicial; el resumen se suma porque es la hoja de trabajo del
   expediente, no un formato del numeral 7. Lo que no puede aparecer ahí es
   ninguno de esos tres —lo mide el check [16]. */
log(/Oficio de disposición/.test(expedOJ[0]) && expedOJ[1] === 'Acta de derechos',
  '[15] Una captura por orden judicial sigue con sus dos documentos', expedOJ.join(' · '));

console.log('\n══ Obs. 3, 4, 5 y 6 · el formulario de orden judicial, sin ruido ══');

await page.evaluate(() => { go('capturas'); startWizard('OJ'); });
await page.waitForTimeout(700);
const p1 = await page.evaluate(() => ({
  aviso: !!document.querySelector('.wz-falta, .wz-ok'),
  txt: document.getElementById('wz-panels').textContent,
  vacio: !!document.querySelector('.oj-persona'),
  botones: [...document.querySelectorAll('#wz-panels button')].map(b => b.textContent.trim()).filter(Boolean),
  puntosRojos: document.querySelectorAll('.wd.falta').length
}));
log(p1.aviso === false, '[16] Paso 1: no hay barra de «N datos obligatorios sin diligenciar»');
log(p1.puntosRojos > 0, '[17] Pero el punto rojo del progreso sigue avisando de lo que falta', p1.puntosRojos);
log(!/verificaci.n central|homonimia/i.test(p1.txt), '[18] Sin el parrafo de introduccion del numeral 1');
log(p1.vacio === false && p1.botones.some(b => /Agregar/.test(b)) && p1.botones.some(b => /Buscar existente/.test(b)),
  '[19] Sin la tarjeta de estado vacio: los dos botones ya lo dicen');

await page.evaluate(() => wizGoto(1));
await page.waitForTimeout(500);
const p2 = await page.evaluate(() => document.getElementById('wz-panels').textContent);
log(!/Se transcribe la orden que tienes en la mano/.test(p2), '[20] Paso 2: sin el parrafo de introduccion');
log(!/el art.culo del C.digo Penal se completa solo/.test(p2), '[21] Sin el aviso de los delitos imputados');
log(!/Sin delitos registrados/.test(p2), '[22] Y sin el «Sin delitos registrados» encima de su propio boton');
log(!/despacho que libr. la orden\. Si el informe/.test(p2), '[23] Sin el aviso de la autoridad solicitante');

await page.evaluate(() => wizGoto(2));
await page.waitForTimeout(500);
const p3 = await page.evaluate(() => ({
  txt: document.getElementById('wz-panels').textContent,
  reloj: typeof window.ojReloj36Html === 'undefined'
}));
log(!/T.RMINO DE 36 HORAS|T.rmino de 36 horas/i.test(p3.txt),
  '[24] Paso 3: sin el cuadro del termino de 36 horas');
log(p3.reloj === true, '[25] La funcion que lo pintaba tampoco quedo como codigo muerto');

console.log('\n══ Obs. 7 · la patrulla se pone sola y el bloque viaja plegado ══');

const dil = await page.evaluate(() => {
  const det = [...document.querySelectorAll('#wz-panels details')]
    .find(d => /Qui.n hizo la diligencia/i.test(d.querySelector('summary').textContent));
  return {
    hay: !!det,
    plegado: det ? !det.open : null,
    resumen: det ? det.querySelector('summary').textContent : '',
    funcs: (wc.oj.diligencia.funcionarios || []).map(f => f.grado + ' ' + f.nombre),
    // ⚠️ Plegar NO es borrar: los campos siguen en el DOM y se recolectan.
    enDom: !!document.getElementById('oj-g-uni'),
    agregar: !!det && /Agregar funcionario/.test(det.textContent)
  };
});
log(dil.funcs.length === 2, '[26] Los dos funcionarios entran solos: titular y companero', dil.funcs.join(' · '));
log(/Nelson David/.test(dil.funcs[0] || '') && /Ana Maria/.test(dil.funcs[1] || ''),
  '[27] Salen del perfil, sin teclear nada');
log(dil.plegado === true, '[28] El bloque «Quien hizo la diligencia» viaja plegado');
log(/Nelson David/.test(dil.resumen), '[29] Y su resumen dice quienes van, sin abrirlo', dil.resumen.trim().slice(0, 60));
log(dil.enDom === true, '[30] Plegar no es borrar: los campos siguen en el DOM y se recolectan');
log(dil.agregar === true, '[31] Se conserva la opcion de registrar cualquier otro funcionario');

// Recolectar con el bloque CERRADO no puede vaciar la lista.
const trasCollect = await page.evaluate(() => { ojCollect(); return (wc.oj.diligencia.funcionarios || []).length; });
log(trasCollect === 2, '[32] Recolectar con el bloque cerrado conserva los dos funcionarios', trasCollect);

await page.evaluate(() => { wc = null; go('capturas'); });
await page.waitForTimeout(300);

console.log('\n══ Obs. 8 · los predeterminados primero, con marca verde fosforescente ══');

const desp = await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.despachosPropios = [
    { id:'d1', clase:'FISCALIA', nombre:'Zzz Fiscalia Ultima', municipio:'Medellin', nunc:'0500160002062026' },
    { id:'d2', clase:'FISCALIA', nombre:'Aaa Fiscalia Primera', municipio:'Medellin', nunc:'0500160002062027' },
    { id:'d3', clase:'CESPA', nombre:'Mmm CESPA', municipio:'Medellin', nunc:'0500160012502026' }
  ];
  cfg.despachoDefecto = { URI:'d1', CESPA:'d3' };
  DB.saveConfig(cfg);
  go('despachos'); renderDespachos('todos');
  const cards = [...document.querySelectorAll('.desp-card')];
  const badge = document.querySelector('.desp-def');
  const cs = badge ? getComputedStyle(badge) : null;
  return {
    orden: cards.map(c => c.querySelector('.desp-nombre').textContent),
    primeroEsDefecto: !!(cards[0] && cards[0].querySelector('.desp-def')),
    color: cs ? cs.color : '', fondo: cs ? cs.backgroundColor : '',
    neon: getComputedStyle(document.documentElement).getPropertyValue('--neon').trim()
  };
});
log(desp.primeroEsDefecto === true,
  '[33] El predeterminado encabeza la lista aunque alfabeticamente vaya ultimo', desp.orden[0]);
/* ⚠️ Hay DOS predeterminados (uno de fiscalia y uno de CESPA): los dos suben, y
   entre ellos se ordenan alfabeticamente — «Mmm» antes que «Zzz»—; el que no lo
   es se va al final aunque empiece por A. Eso es exactamente el criterio pedido:
   primero lo que la app usa sin preguntar, y dentro de cada grupo, alfabetico. */
log(desp.orden.join('|') === 'Mmm CESPA|Zzz Fiscalia Ultima|Aaa Fiscalia Primera',
  '[34] Y dentro de cada grupo se conserva el orden alfabetico en espanol', desp.orden.join(' · '));
log(/#4CFF88/i.test(desp.neon) || /4cff88/i.test(desp.neon),
  '[35] La marca usa el token de verde fosforescente, no el acento indigo', desp.neon);
log(desp.color !== '' && desp.fondo !== '', '[36] Y se pinta resuelta en pantalla', desp.color);

console.log('\n══ Obs. 9 a 17 · Ajustes: cinco secciones, sin datos repetidos ══');

await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(500);
const aj = await page.evaluate(() => ({
  secciones: [...document.querySelectorAll('#screen-ajustes .aj-sec-lbl')].map(e => e.textContent.trim()),
  papel: !!document.getElementById('aj-papel-grid'),
  regionales: !!document.getElementById('rp-list'),
  fiscalia: !!document.getElementById('aj-oj-fnom'),
  jornada: !!document.getElementById('aj-oj-jini'),
  nuncLinea: !!document.getElementById('aj-nunc-auto'),
  conList: !!document.getElementById('aj-con-list'),
  verde3Select: !!document.querySelector('#screen-ajustes select.aj-con-sel'),
  verde3Input: !!document.getElementById('aj-verde3'),
  logo: !!document.getElementById('aj-oj-logo-file'),
  linea4: !!document.getElementById('aj-oj-dep-eco'),
  ciudadEco: !!document.getElementById('aj-oj-ciu-eco')
}));
/* ⚠️ Adaptado en la Mejora 7 (2026-08-31): «Dossier» dejó de ser una sección de
   Ajustes por instrucción del usuario, así que las cinco de esta observación son
   ahora cuatro. Lo que el check protege —que Ajustes no vuelva a llenarse de
   secciones— no se relaja, y se le añade que la que se fue no volvió. */
log(aj.secciones.length === 4 && !aj.secciones.some(s => /dossier/i.test(s)),
  '[37] Ajustes pasa de diez secciones a cinco, y con la Mejora 7 a cuatro', aj.secciones.join(' · '));
log(!aj.papel, '[38] Obs. 9: la seccion «Documentos» (tamano del papel) ya no existe');
log(!aj.regionales, '[39] Obs. 16: «Perfiles Regionales» tampoco');
log(!aj.fiscalia, '[40] Obs. 14: la fiscalia destinataria sale de Despachos, no de Ajustes');
log(!aj.jornada, '[41] Obs. 14: la jornada judicial habil ya no se pide');
log(!aj.nuncLinea, '[42] Obs. 15: la linea del NUNC y el boton a Despachos se retiraron');
log(!aj.conList, '[43] Obs. 12: «Conocieron el caso» dejo de ser una lista que diligenciar');
log(!aj.verde3Select && aj.verde3Input,
  '[44] Obs. 11: VERDE 3 y DIAMANTE 3 vuelven a ser un campo de texto');
log(!aj.logo, '[45] Obs. 13: el escudo del membrete no se carga — viene embebido');
log(!aj.linea4 && !aj.ciudadEco, '[46] Obs. 13: y sus dos lineas derivadas dejaron de ocupar pantalla');

// ⚠️ Ningun aviso de mas de 110 caracteres en toda la pantalla (obs. 10).
const largos = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#screen-ajustes p').forEach(p => {
    const t = p.textContent.trim();
    if (t.length > 110) out.push(t.slice(0, 60));
  });
  return out;
});
log(largos.length === 0, '[47] Obs. 10: ningun aviso pasa de 110 caracteres en Ajustes', largos.join(' | '));

/* El titulo de seccion pesa mas que el aviso que tiene al lado (obs. 10).
   ⚠️ Adaptado en la Mejora 7 (2026-08-31): «Mi unidad» se quedo SIN titulos de
   seccion —el usuario senalo los cuatro uno a uno: «solo hace ruido»—, asi que
   el componente se mide donde sigue usandose. Lo que el check protege es la
   jerarquia visual de `.st`, no que exista uno en esa pantalla concreta. */
const jerarquia = await page.evaluate(() => {
  toggleAjSec('unidad-sec');
  const st = [...document.querySelectorAll('.st')].find(e => e.offsetParent !== null)
    || document.querySelector('.st');
  const nota = document.querySelector('#aj-body-unidad-sec .aj-nota');
  if (!st || !nota) return null;
  const a = getComputedStyle(st), b = getComputedStyle(nota);
  return { tSize: parseFloat(a.fontSize), tPeso: parseInt(a.fontWeight, 10),
           nSize: parseFloat(b.fontSize), barra: getComputedStyle(st, '::before').width };
});
log(!!jerarquia && jerarquia.tSize > jerarquia.nSize && jerarquia.tPeso >= 700,
  '[48] El titulo de seccion pesa mas que el aviso que lo rodea',
  jerarquia && (jerarquia.tSize + 'px/' + jerarquia.tPeso + ' vs ' + jerarquia.nSize + 'px'));
log(!!jerarquia && jerarquia.barra !== '0px' && jerarquia.barra !== 'auto',
  '[49] Y estrena una barra de acento que lo separa del texto corrido', jerarquia && jerarquia.barra);

console.log('\n══ Obs. 12 · «Conocieron el caso» se deriva del perfil, por rango ══');

const con = await page.evaluate(() => {
  const cfg = DB.getConfig();
  return {
    lista: getConocieronList(cfg),
    // La piramide sale del indice del catalogo, no de una tabla aparte.
    rangoIT: lcGradoRango('Intendente'), rangoSI: lcGradoRango('Subintendente'),
    rangoRaro: lcGradoRango('Grado que no existe'),
    eco: (document.getElementById('aj-con-auto') || {}).textContent || ''
  };
});
log(con.lista.length === 2, '[50] Se derivan los dos: titular y companero de patrulla', con.lista.join(' / '));
log(con.lista[0] === 'IT Ana Maria Perez',
  '[51] Y el de MAYOR RANGO encabeza, aunque este registrado como companero', con.lista[0]);
log(con.rangoIT < con.rangoSI && con.rangoRaro > con.rangoSI,
  '[52] La piramide de rangos sale del catalogo; un grado desconocido va al final');
log(/Ana Maria/.test(con.eco), '[53] Ajustes lo enseña resuelto, en vez de esconderlo', con.eco.slice(0, 70));

// Y llega al dossier de una captura nueva.
const dossier = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); c.isTest = false;
  delete c.dossierSnap;
  lcCongelarDossier(c, DB.getConfig());
  await DB.saveCase(c);
  return genDossier(DB.getCase(c.id));
});
/* ⚠️ Mejora 8: un funcionario POR RENGLON y el grado abreviado con punto, en vez
   de la linea corrida separada por barras. Lo que este check mide —que los dos
   lleguen al dossier y que el de mayor rango encabece— no cambia. */
log(/I\.T Ana Maria Perez\nS\.I Nelson David David/.test(dossier),
  '[54] El dossier imprime a los dos, en orden de rango');

console.log('\n══ Obs. 14 · la fiscalia destinataria sale del registro de despachos ══');

const fis = await page.evaluate(() => {
  const cfg = DB.getConfig();
  // El equipo NO tiene ojFiscalia* configurado: solo su despacho predeterminado.
  cfg.ojFiscaliaNombre = ''; cfg.ojFiscaliaDireccion = '';
  cfg.despachosPropios = [{ id:'d1', clase:'FISCALIA', nombre:'Fiscalia URI Medellin',
    direccion:'CR 64C # 67-300', barrio:'Caribe', municipio:'Medellin', departamento:'Antioquia',
    nunc:'0500160002062026' }];
  cfg.despachoDefecto = { URI:'d1' };
  DB.saveConfig(cfg);
  return ojFiscaliaCfg(cfg);
});
log(fis.nombre === 'Fiscalia URI Medellin',
  '[55] Se toma del despacho de fiscalia predeterminado', fis.nombre);
log(/CR 64C # 67-300/.test(fis.direccion) && /Caribe/.test(fis.direccion),
  '[56] Con su direccion y barrio, como el numeral 1 del FPJ-5', fis.direccion);
log(fis.municipio === 'Medellin' && fis.departamento === 'Antioquia',
  '[57] Y su ciudad y departamento');

// ⚠️ Respaldo: una configuracion anterior, sin despachos, sigue funcionando.
const fisLegado = await page.evaluate(() => {
  const cfg = JSON.parse(JSON.stringify(DB.getConfig()));
  cfg.despachosPropios = []; cfg.despachoDefecto = {};
  cfg.ojFiscaliaNombre = 'FISCALIA URI CENTRO'; cfg.ojFiscaliaDireccion = 'CR 52 # 42-73';
  return ojFiscaliaCfg(cfg);
});
log(fisLegado.nombre === 'FISCALIA URI CENTRO',
  '[58] Sin despachos registrados se sigue leyendo la clave legada: nada se pierde', fisLegado.nombre);

console.log('\n══ Lo que NO podia romperse ══');

const intacto = await page.evaluate(() => ({
  // Los motores que son el activo del modulo, sin tocar.
  vigencia: typeof ojVigencia === 'function',
  plazo: typeof ojPlazo36 === 'function' && typeof ojPlazoBarraHtml === 'function',
  destino: typeof ojResolverDestino === 'function',
  jornada: (DB.getConfig().ojJornadaIni || '') === '08:00',
  // El escudo del oficio se sigue poniendo solo.
  escudo: typeof OJ_LOGO_B64 === 'string' && OJ_LOGO_B64.length > 1000,
  // Y las claves legadas NO se borraron.
  claves: (() => { const c = DB.getConfig(); return { fis:'ojFiscaliaNombre' in c, jor:'ojJornadaIni' in c }; })(),
  // Las muertas si.
  muertas: (() => { const c = DB.getConfig(); return !('papel' in c) && !('perfilesRegionales' in c); })()
}));
log(intacto.vigencia && intacto.plazo && intacto.destino,
  '[59] Los tres motores del modulo de orden judicial siguen intactos');
log(intacto.jornada === true,
  '[60] La jornada habil dejo de preguntarse, no de usarse: 08:00 por defecto');
log(intacto.escudo === true, '[61] El escudo del membrete se sigue embebiendo solo');
log(intacto.claves.fis && intacto.claves.jor,
  '[62] Las claves sin campo pero CON lector se conservan (respaldo de config anterior)');
log(intacto.muertas === true,
  '[63] Las que quedaron sin lector NI escritor se limpian: papel, perfilesRegionales');

// El oficio se sigue generando, con todo su formato.
const doc = await page.evaluate(async id => {
  const c = DB.getCase(id);
  const out = await buildOficioOJBlob(ojCasoParaDocumento(c), 'CARTA');
  if (!out) return null;
  const b = new Uint8Array(await out.blob.arrayBuffer());
  return { n: b.length, papel: out.papel, fname: out.fname, noPDF: !!out.noPDF };
}, ids.oj);
log(!!doc && doc.n > 20000, '[64] El oficio se sigue generando entero', doc && (doc.n + ' bytes'));
log(!!doc && doc.papel === 'CARTA', '[65] En Carta, el tamano fijo', doc && doc.papel);

const fpj = await page.evaluate(async id => {
  const out = await buildFPJBlob(DB.getCase(id), lcPapelEfectivo('FPJ'));
  return out ? { papel: out.papel, n: (await out.blob.arrayBuffer()).byteLength } : null;
}, ids.con);
log(!!fpj && fpj.papel === 'CARTA' && fpj.n > 100000,
  '[66] Y el FPJ-5 tambien, con sus casillas en el ancho que admiten', fpj && fpj.papel);

log(errs.length === 0, '[67] Consola limpia en todo el recorrido', errs.slice(0, 3).join(' | '));

console.log('\n' + '═'.repeat(64));
console.log(`RESULTADO: ${R.filter(Boolean).length}/${R.length} comprobaciones`);
console.log('═'.repeat(64));
await browser.close();
server.close();
process.exit(R.every(Boolean) ? 0 : 1);
