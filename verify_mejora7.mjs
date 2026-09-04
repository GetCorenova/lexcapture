/* Mejora 7 (2026-08-31) — REORGANIZACION DE AJUSTES Y PERFIL.
   Requerimiento: «Documentos/Otro/Mejora 7.docx». Es una tarea de ARQUITECTURA
   DE INFORMACION, no de funcionalidad: la regla que la gobierna es que la
   aplicacion debe producir EXACTAMENTE los mismos resultados que antes.

   Por eso esta suite tiene dos mitades, y la segunda pesa mas que la primera:
     A. que la jerarquia nueva este donde se pidio (Ajustes sin Dossier, sin
        patrulla y sin valores del lugar; Perfil con «Mi jurisdiccion»; el caret
        > / ⌄; el perfil sin el campo «Entidad»);
     B. que NADA se haya perdido — ni una clave de configuracion, ni un dato ya
        guardado, ni una linea de los documentos que la app genera.

   ⚠️ La comprobacion que de verdad protege este trabajo es la [B4]: se genera un
   dossier y un FPJ-5 ANTES de tocar la interfaz nueva y se comparan con los de
   DESPUES de guardar desde las dos pantallas reorganizadas. Si la reorganizacion
   hubiera movido, borrado o pisado una clave, esos dos documentos cambiarian. */
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
await new Promise(r => server.listen(8157, r));

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

await page.goto('http://localhost:8157/LexCapture_v8.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-a', '246801');
await page.fill('#pin-b', '246801');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(900);

/* ═══════════════════════════════════════════════════════════════════════════
   SEMILLA — un equipo YA CONFIGURADO, como el del usuario que actualiza.
   Es la unica forma de comprobar que la reorganizacion es RETROCOMPATIBLE: con
   una instalacion en blanco, borrar una clave no se notaria.
   ═══════════════════════════════════════════════════════════════════════════ */
await page.evaluate(() => {
  const cfg = DB.getConfig();
  cfg.perfiles = [{ id:'p1', grado:'Subintendente', nombre:'Nelson David Gomez',
    cedula:'1035302775', telefono:'3104498111', cargo:'Integrante de patrulla',
    entidad:'Institucion del usuario (DEMO)', correo:'nd@correo.test',
    companero:{ grado:'Patrullero', nombre:'Juan Pablo Mejia', cedula:'1098765432',
                cargo:'Patrullero de cuadrante', telefono:'3009998877', correo:'jp@correo.test' } }];
  cfg.perfilActivo = 'p1';
  // Lo que la Mejora 7 mueve de pantalla: tiene que sobrevivir intacto.
  cfg.patrullaNum = '32'; cfg.patrullaUnidad = 'CAI Parque Bolivar';
  cfg.localidadDefault = '10'; cfg.zonaDefault = 'Urbana'; cfg.veredaDefault = 'La Loma';
  // Comandante de cada nivel. ⚠️ Los indicativos se dejan a propósito SIN tocar:
  // así se mide que sus valores por defecto reproducen el dossier de siempre.
  cfg.dosVerde3 = 'TC Jin Eduardo Moreno'; cfg.dosDiamante3 = 'TC William Quintero';
  cfg.rangoComandante = 'CORONEL'; cfg.numDistrito = 'TRES';
  cfg.nombreEstacion = 'CANDELARIA'; cfg.ojDependencia = 'Distrito tres de policia';
  cfg.ojCustCiudad = 'Medellin';
  cfg.ojMinisterio = 'Ministerio de prueba (DEMO)';
  cfg.ojInstitucion = 'Institucion de prueba (DEMO)';
  cfg.ojUnidad = 'Metropolitana de prueba (DEMO)';
  cfg.ojPieWeb = 'www.ejemplo.test';
  cfg.ojCustDireccion = 'CL 48 # 55 - 50'; cfg.ojCustBarrio = 'La Candelaria';
  cfg.ojCustTelefono = '6042345678'; cfg.ojCustCorreo = 'unidad@correo.test';
  DB.saveConfig(cfg);
});
await page.waitForTimeout(300);

/* FOTO «ANTES»: el dossier y el paso del servidor tal y como salen hoy. */
const antes = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); c.isTest = false;
  c.id = 'caso-fijo-m7';
  await DB.saveCase(c);
  return { dossier: genDossier(DB.getCase('caso-fijo-m7')),
           servidor: JSON.stringify(lcServidorDefecto(DB.getConfig())),
           cfg: JSON.stringify(DB.getConfig()) };
});

/* ═══════════════════════════════════════════════════════════════════════════
   A · LA JERARQUIA NUEVA
   ═══════════════════════════════════════════════════════════════════════════ */
sec('A · AJUSTES — solo configuracion general de la aplicacion');

await page.evaluate(() => go('ajustes'));
await page.waitForTimeout(500);

const aj = await page.evaluate(() => ({
  secciones: [...document.querySelectorAll('#screen-ajustes .aj-sec-lbl')].map(e => e.textContent.trim()),
  dossierSec: !!document.getElementById('aj-body-dossier-sec'),
  patrulla: !!document.getElementById('aj-patrulla'),
  cai: !!document.getElementById('aj-unidad'),
  localidad: !!document.getElementById('aj-localidad'),
  zona: !!document.getElementById('aj-zona'),
  vereda: !!document.getElementById('aj-vereda'),
  verde3: !!document.getElementById('aj-verde3'),
  diamante3: !!document.getElementById('aj-diamante3')
}));

log(aj.secciones.length === 4, '[A1] Ajustes pasa de cinco secciones a cuatro', aj.secciones.join(' · '));
log(!aj.secciones.some(s => /dossier/i.test(s)) && !aj.dossierSec,
  '[A2] Punto 10: «Dossier» desaparece como opcion dentro de Ajustes');
log(!aj.patrulla && !aj.cai,
  '[A3] Punto 4: la patrulla y su CAI ya no se configuran aqui');
log(!aj.localidad && !aj.zona && !aj.vereda,
  '[A4] Punto 4: los valores por defecto del lugar tampoco');
log(aj.verde3 && aj.diamante3,
  '[A5] ⚠️ Pero VERDE 3 y DIAMANTE 3 NO se pierden: son el mando de la unidad y se quedan en «Mi unidad»');

/* ⚠️ LA PANTALLA ES LA JERARQUIA. Se mide el ORDEN REAL de los campos en el
   DOM, no que existan: el usuario devolvio el primer intento porque los campos
   estaban, pero repartidos a criterio propio —el sitio web al final, el distrito
   inexistente, y un bloque «Mando» que nadie pidio—. */
const orden = await page.evaluate(() => {
  const ids = ['aj-oj-min','aj-oj-inst','aj-web','aj-oj-uni',
               'aj-oj-dep','aj-ind-dis','aj-diamante3','aj-rango',
               'aj-estacion','aj-ind-est','aj-verde3','aj-dir','aj-bar','aj-ciu','aj-tel','aj-cor',
               'aj-oj-asunto'];
  const campos = [...document.querySelectorAll('#aj-body-unidad-sec input,#aj-body-unidad-sec select')]
    .map(e => e.id).filter(Boolean);
  const t = id => { const i = document.getElementById(id); const l = i && i.closest('.fg') && i.closest('.fg').querySelector('.fl'); return l ? l.textContent.trim() : ''; };
  return { esperado: ids, real: campos,
           lbl: Object.fromEntries(ids.map(i => [i, t(i)])),
           st: [...document.querySelectorAll('#aj-body-unidad-sec .st')].map(e => e.textContent.trim()) };
});
log(orden.real.join(',') === orden.esperado.join(','),
  '[A6] Los campos van en el ORDEN de la maqueta: sector · institucion+web · unidad · DISTRITO · ESTACION · asunto',
  orden.real.join(' → '));
log(orden.real.indexOf('aj-web') === orden.real.indexOf('aj-oj-inst') + 1,
  '[A7] El sitio web va PEGADO a la institucion, como marca la flecha del documento');
log(/distrito de polic/i.test(orden.lbl['aj-oj-dep']) && /seccional/i.test(orden.lbl['aj-oj-dep']),
  '[A8] El distrito tiene campo propio y se llama como pidio el usuario', orden.lbl['aj-oj-dep']);
log(orden.real.indexOf('aj-oj-dep') < orden.real.indexOf('aj-estacion'),
  '[A8b] Y va ANTES de la estacion');
log(orden.lbl['aj-ind-dis'] === 'Indicativo' && orden.lbl['aj-diamante3'] === 'Comandante' &&
    orden.lbl['aj-ind-est'] === 'Indicativo' && orden.lbl['aj-verde3'] === 'Comandante',
  '[A8c] Cada nivel lleva SU indicativo y SU comandante — no hay un bloque «Mando» aparte');
log(orden.st.length === 0,
  '[A8d] ⚠️ Y no queda ningun titulo de seccion: «solo hace ruido»', orden.st.join(' / ') || 'ninguno');

/* ⚠️ ENTIDAD → ATRIBUTO. El usuario marco la pantalla con dos colores: campos de
   nivel superior y atributos que cuelgan de cada uno. Aqui se mide la RELACION,
   no la apariencia: de que padre cuelga cada campo, leido del DOM. */
const arbol = await page.evaluate(() => {
  const out = [];
  let padre = null;
  [...document.querySelectorAll('#aj-body-unidad-sec .fg')].forEach(fg => {
    const inp = fg.querySelector('input,select'); if (!inp) return;
    const lbl = fg.querySelector('.fl');
    const hijo = !!fg.closest('.lc-hijos');
    if (!hijo) { padre = inp.id; out.push({ id: inp.id, de: null, p: lbl && lbl.classList.contains('fl-p') }); }
    else out.push({ id: inp.id, de: padre, p: lbl && lbl.classList.contains('fl-p') });
  });
  const guia = document.querySelector('#aj-body-unidad-sec .lc-hijos');
  const gs = guia ? getComputedStyle(guia) : null;
  return { out, bloques: document.querySelectorAll('#aj-body-unidad-sec .lc-hijos').length,
           borde: gs ? gs.borderLeftWidth : '', sangria: gs ? gs.paddingLeft : '' };
});
const de = id => (arbol.out.find(x => x.id === id) || {}).de;
const esPadre = id => { const x = arbol.out.find(y => y.id === id); return !!x && x.de === null && x.p; };
log(['aj-oj-min','aj-oj-inst','aj-oj-uni','aj-oj-dep','aj-estacion','aj-oj-asunto'].every(esPadre),
  '[A8e] Los seis campos que el usuario marco como PADRE son de nivel superior');
log(de('aj-web') === 'aj-oj-inst',
  '[A8f] El sitio web cuelga de la institucion', de('aj-web'));
log(de('aj-ind-dis') === 'aj-oj-dep' && de('aj-diamante3') === 'aj-oj-dep' && de('aj-rango') === 'aj-oj-dep',
  '[A8g] Indicativo, comandante y rango del saludo cuelgan del DISTRITO');
log(['aj-ind-est','aj-verde3','aj-dir','aj-bar','aj-ciu','aj-tel','aj-cor'].every(i => de(i) === 'aj-estacion'),
  '[A8h] Indicativo, comandante, direccion, barrio, municipio, telefono y correo cuelgan de la ESTACION');
log(arbol.bloques === 3 && arbol.borde !== '0px' && parseFloat(arbol.sangria) > 0,
  '[A8i] La relacion se DIBUJA con sangria y guia vertical — sin titulos ni una linea de texto',
  arbol.bloques + ' bloques · borde ' + arbol.borde + ' · sangria ' + arbol.sangria);

sec('A · EL CARET: > cerrado, ⌄ abierto');

/* ⚠️ La rotacion se mide DESPUES de la transicion: getComputedStyle durante los
   180 ms del giro devuelve el valor INTERPOLADO —al empezar, la identidad— y el
   check habria pasado por el motivo equivocado. Paso justo por ahi. */
const leerCaret = () => page.evaluate(() => {
  const arr = document.getElementById('aj-arr-datos-sec');
  const body = document.getElementById('aj-body-datos-sec');
  const svg = arr && arr.querySelector('svg');
  return { open: arr.classList.contains('open'), vis: body.style.display !== 'none',
           rot: svg ? getComputedStyle(svg).transform : '', svg: !!svg, texto: arr.textContent.trim() };
});
const cerrado = await leerCaret();
await page.evaluate(() => toggleAjSec('datos-sec'));
await page.waitForTimeout(450);
const abierto = await leerCaret();
await page.evaluate(() => toggleAjSec('datos-sec'));
await page.waitForTimeout(450);
const otraVez = await leerCaret();
const caret = { cerrado, abierto, otraVez };
log(caret.abierto.svg, '[A9] El caret es un SVG, no un caracter — el DS v2 no admite emojis en la UI');
log(caret.abierto.texto === '', '  …y no queda ningun glifo escrito a mano', JSON.stringify(caret.abierto.texto));
log(!caret.cerrado.open && !caret.cerrado.vis && caret.abierto.open && caret.abierto.vis && !caret.otraVez.open && !caret.otraVez.vis,
  '[A10] Cerrada → clic → abierta → clic → cerrada');
/* rotate(90deg) resuelve a matrix(0, 1, -1, 0, 0, 0) */
log(/^matrix\(\s*0[.\d]*\s*,\s*1/.test(caret.abierto.rot) && caret.cerrado.rot !== caret.abierto.rot,
  '[A11] Y el caret GIRA 90° al abrirse (> pasa a ⌄)', caret.cerrado.rot + ' → ' + caret.abierto.rot);

sec('A · PERFIL — mis datos · compañero · mi jurisdiccion');

await page.evaluate(() => go('perfil'));
await page.waitForTimeout(500);

const pj = await page.evaluate(() => ({
  hay: !!document.getElementById('perfil-juris'),
  titulo: (document.querySelector('#perfil-juris .lc-acc-tit') || {}).textContent || '',
  resumen: (document.querySelector('#perfil-juris .lc-acc-sum') || {}).textContent || '',
  campos: ['pj-vereda','pj-zona','pj-localidad','pj-patrulla','pj-cai'].map(i => !!document.getElementById(i)),
  etiquetas: ['pj-vereda','pj-zona','pj-localidad','pj-patrulla','pj-cai'].map(i => {
    const e = document.getElementById(i); const l = e && e.closest('.fg') && e.closest('.fg').querySelector('.fl');
    return l ? l.textContent.trim() : '';
  }),
  valores: { vereda: (document.getElementById('pj-vereda')||{}).value,
             zona: (document.getElementById('pj-zona')||{}).value,
             localidad: (document.getElementById('pj-localidad')||{}).value,
             patrulla: (document.getElementById('pj-patrulla')||{}).value,
             cai: (document.getElementById('pj-cai')||{}).value }
}));
log(pj.hay && /jurisdicci/i.test(pj.titulo), '[A12] Perfil estrena el panel «Mi jurisdiccion»', pj.titulo.trim());
log(pj.campos.every(Boolean), '[A13] Con los cinco campos que pidio el usuario');
log(/Vereda/i.test(pj.etiquetas[0]) && /Zona/i.test(pj.etiquetas[1]) && /Localidad o comuna/i.test(pj.etiquetas[2])
    && /^Patrulla$/i.test(pj.etiquetas[3]) && /CAI \(si aplica\)/i.test(pj.etiquetas[4]),
  '[A14] Y con las etiquetas y el orden exactos de la maqueta', pj.etiquetas.join(' · '));
log(pj.valores.patrulla === '32' && pj.valores.cai === 'CAI Parque Bolivar' &&
    pj.valores.vereda === 'La Loma' && pj.valores.localidad === '10' && pj.valores.zona === 'Urbana',
  '[A15] ⚠️ Y llegan con lo que el equipo YA tenia configurado en Ajustes', JSON.stringify(pj.valores));
log(/PATRULLA 32/.test(pj.resumen),
  '[A16] El panel dice lo que hay dentro sin abrirlo', pj.resumen.trim().slice(0, 60));

/* El formulario del perfil: dos paneles, orden de la maqueta, sin «Entidad». */
await page.evaluate(() => openPerfilForm('p1'));
await page.waitForTimeout(350);
const form = await page.evaluate(() => {
  const orden = [...document.querySelectorAll('#acc-body-pfm-mis .fl')].map(e => e.textContent.trim());
  return {
    paneles: [...document.querySelectorAll('#modal-c .lc-acc-tit')].map(e => e.textContent.trim()),
    entidad: !!document.getElementById('pfm-entidad'),
    orden,
    comp: [...document.querySelectorAll('#acc-body-pfm-comp .fl')].map(e => e.textContent.trim()),
    compAbierto: (document.getElementById('acc-body-pfm-comp') || {}).style.display !== 'none',
    // Plegar no es borrar: el campo del compañero sigue en el DOM.
    compEnDom: !!document.getElementById('pfm-cnombre')
  };
});
log(form.paneles.length === 2 && /Mis datos/i.test(form.paneles[0]) && /Compa/i.test(form.paneles[1]),
  '[A17] El formulario se separa en «Mis datos» y «Compañero de patrulla»', form.paneles.join(' · '));
log(!form.entidad, '[A18] Punto 5: el campo «Entidad» ya no se pide en el perfil');
log(/Nombres y apellidos/i.test(form.orden[0]) && /Correo/i.test(form.orden[1]) && /Tel/i.test(form.orden[2])
    && /C[eé]dula/i.test(form.orden[3]) && /Grado/i.test(form.orden[4]) && /Cargo/i.test(form.orden[5]),
  '[A19] En el orden que fijo la maqueta: nombre · correo · telefono · cedula · grado · cargo', form.orden.join(' · '));
log(form.comp.length === form.orden.length && form.comp.every((t, i) => t === form.orden[i]),
  '[A20] «…y los datos del compañero en el mismo orden y con la misma logica»', form.comp.join(' · '));
log(form.compAbierto && form.compEnDom,
  '[A21] El panel del compañero se abre solo cuando ya trae datos (no esconde lo diligenciado)');

/* Un perfil NUEVO: el panel del compañero nace plegado, pero sus campos existen. */
await page.evaluate(() => { closeModal(); openPerfilForm(''); });
await page.waitForTimeout(300);
const nuevo = await page.evaluate(() => ({
  plegado: (document.getElementById('acc-body-pfm-comp') || {}).style.display === 'none',
  enDom: !!document.getElementById('pfm-cnombre'),
  misAbierto: (document.getElementById('acc-body-pfm-mis') || {}).style.display !== 'none'
}));
log(nuevo.plegado && nuevo.misAbierto,
  '[A22] En un perfil nuevo el compañero nace plegado y «Mis datos» abierto');
log(nuevo.enDom, '[A23] ⚠️ PLEGAR NO ES BORRAR: sus campos siguen en el DOM');

/* Y se recolectan con el panel CERRADO. */
const guardaPlegado = await page.evaluate(() => {
  document.getElementById('pfm-nombre').value = 'PRUEBA PLEGADO';
  document.getElementById('pfm-cnombre').value = 'COMPANERO OCULTO';
  document.getElementById('pfm-ccedula').value = '99887766';
  savePerfilForm('');
  const cfg = DB.getConfig();
  const p = cfg.perfiles.find(x => x.nombre === 'PRUEBA PLEGADO');
  return p ? { n: p.companero.nombre, c: p.companero.cedula, id: p.id } : null;
});
log(!!guardaPlegado && guardaPlegado.n === 'COMPANERO OCULTO' && guardaPlegado.c === '99887766',
  '[A24] Guardar con el panel cerrado recoge igual sus campos', JSON.stringify(guardaPlegado));
await page.evaluate(id => { const cfg = DB.getConfig(); cfg.perfiles = cfg.perfiles.filter(p => p.id !== id); cfg.perfilActivo = 'p1'; DB.saveConfig(cfg); }, guardaPlegado.id);

/* ═══════════════════════════════════════════════════════════════════════════
   B · NADA SE PERDIO — la mitad que de verdad protege este trabajo
   ═══════════════════════════════════════════════════════════════════════════ */
sec('B · RETROCOMPATIBILIDAD — ninguna clave se pierde ni se pisa');

/* Guardar desde LAS DOS pantallas reorganizadas, que es el gesto que borraba
   configuracion si una asignacion se hubiera quedado sin su campo. */
await page.evaluate(() => { go('ajustes'); });
await page.waitForTimeout(400);
await page.evaluate(() => saveAjustes());
await page.waitForTimeout(700);
await page.evaluate(() => { go('perfil'); });
await page.waitForTimeout(400);
await page.evaluate(() => lcJurisGuardar());
await page.waitForTimeout(700);

const tras = await page.evaluate(() => {
  const c = DB.getConfig();
  return { patrullaNum:c.patrullaNum, patrullaUnidad:c.patrullaUnidad,
           localidadDefault:c.localidadDefault, zonaDefault:c.zonaDefault, veredaDefault:c.veredaDefault,
           dosVerde3:c.dosVerde3, dosDiamante3:c.dosDiamante3,
           rangoComandante:c.rangoComandante, numDistrito:c.numDistrito,
           entidadPerfil:(c.perfiles.find(p => p.id === 'p1') || {}).entidad,
           ojMinisterio:c.ojMinisterio, ojInstitucion:c.ojInstitucion, ojUnidad:c.ojUnidad,
           ojPieWeb:c.ojPieWeb, nombreEstacion:c.nombreEstacion,
           ojCustDireccion:c.ojCustDireccion, ojCustTelefono:c.ojCustTelefono };
});
log(tras.patrullaNum === '32' && tras.patrullaUnidad === 'CAI Parque Bolivar',
  '[B1] ⚠️ «Guardar ajustes» ya NO borra la patrulla, que perdio su campo ahi', JSON.stringify([tras.patrullaNum, tras.patrullaUnidad]));
log(tras.localidadDefault === '10' && tras.zonaDefault === 'Urbana' && tras.veredaDefault === 'La Loma',
  '[B2] Ni los valores por defecto del lugar', JSON.stringify([tras.localidadDefault, tras.zonaDefault, tras.veredaDefault]));
log(tras.dosVerde3 === 'TC Jin Eduardo Moreno' && tras.dosDiamante3 === 'TC William Quintero',
  '[B3] VERDE 3 y DIAMANTE 3 se siguen guardando desde «Mi unidad»');
log(tras.entidadPerfil === 'Institucion del usuario (DEMO)',
  '[B4] ⚠️ Y la entidad del perfil sobrevive a guardar el perfil sin su campo', tras.entidadPerfil);
log(tras.rangoComandante === 'CORONEL' && tras.numDistrito === 'TRES' && tras.nombreEstacion === 'CANDELARIA' &&
    tras.ojMinisterio === 'Ministerio de prueba (DEMO)' && tras.ojInstitucion === 'Institucion de prueba (DEMO)' &&
    tras.ojUnidad === 'Metropolitana de prueba (DEMO)' && tras.ojPieWeb === 'www.ejemplo.test' &&
    tras.ojCustDireccion === 'CL 48 # 55 - 50' && tras.ojCustTelefono === '6042345678',
  '[B5] Y las nueve claves que se quedaron en Ajustes salen intactas');

sec('B · LOS DOCUMENTOS SALEN IGUAL');

/* ⚠️ Se comparan ANTES de tocar el perfil: cualquier edicion posterior cambia
   legitimamente el servidor del FPJ-5 y el check dejaria de medir lo que dice
   su rotulo. */
const despues = await page.evaluate(() => ({
  dossier: genDossier(DB.getCase('caso-fijo-m7')),
  servidor: JSON.stringify(lcServidorDefecto(DB.getConfig()))
}));
log(despues.dossier === antes.dossier,
  '[B8] ⚠️ El dossier de una captura guardada sale CARACTER POR CARACTER igual que antes de la reorganizacion');
log(despues.servidor === antes.servidor,
  '[B9] Y los datos del servidor del FPJ-5, tambien', despues.servidor === antes.servidor ? '' : despues.servidor);
/* ⚠️ Mejora 8: la patrulla se escribe «CAI …, Patrulla 32» y el grado abreviado
   lleva punto. Lo que estos dos checks protegen —que el traslado de campos de la
   Mejora 7 no dejara ningun dato sin imprimir— no cambia. */
log(/CAI Parque Bolivar, Patrulla 32/.test(despues.dossier),
  '[B10] La patrulla sigue encabezando «Conocieron el caso» desde su pantalla nueva');
log(/T\.C Jin Eduardo Moreno/.test(despues.dossier) && /T\.C William Quintero/.test(despues.dossier),
  '[B11] Y VERDE 3 y DIAMANTE 3 se siguen imprimiendo');
log(/DIOS Y PATRIA MI CORONEL/.test(despues.dossier) && /DISTRITO TRES DE POLIC/.test(despues.dossier),
  '[B12] El encabezado del dossier no cambia una coma');

/* Guardar el perfil desde el formulario reorganizado tampoco puede perder la
   entidad, que es la unica clave del perfil que se quedo sin campo. */
await page.evaluate(() => { openPerfilForm('p1'); });
await page.waitForTimeout(300);
await page.evaluate(() => { document.getElementById('pfm-cargo').value = 'Comandante de cuadrante'; savePerfilForm('p1'); });
await page.waitForTimeout(500);
const trasPerfil = await page.evaluate(() => {
  const p = DB.getConfig().perfiles.find(x => x.id === 'p1');
  return { entidad:p.entidad, cargo:p.cargo, comp:p.companero.nombre, ctel:p.companero.telefono, ccor:p.companero.correo };
});
log(trasPerfil.entidad === 'Institucion del usuario (DEMO)' && trasPerfil.cargo === 'Comandante de cuadrante',
  '[B6] Se edita el perfil y la entidad guardada sigue ahi', trasPerfil.entidad);
log(trasPerfil.comp === 'Juan Pablo Mejia' && trasPerfil.ctel === '3009998877' && trasPerfil.ccor === 'jp@correo.test',
  '[B7] Y el compañero conserva sus seis datos, telefono y correo incluidos');

/* Los valores por defecto del lugar siguen llegando a una captura NUEVA. */
const lugar = await page.evaluate(() => {
  startWizard('URI');
  const s = getWizConfig().steps;
  ws = s.indexOf('Lugar'); renderWiz();
  return { local:(document.getElementById('w-local')||{}).value,
           zona:(document.getElementById('w-zona')||{}).value,
           vereda:(document.getElementById('w-vereda')||{}).value };
});
log(lugar.local === '10' && lugar.zona === 'Urbana' && lugar.vereda === 'La Loma',
  '[B13] Una captura NUEVA sigue naciendo con los valores por defecto del lugar', JSON.stringify(lugar));
await page.evaluate(() => { wc = null; go('capturas'); });
await page.waitForTimeout(300);

sec('B · LA ENTIDAD: se deja de pedir, no de usarse');

/* Un equipo SIN entidad en el perfil —el caso que la retirada del campo tiene
   que resolver— la hereda ahora de la institucion del membrete. */
const heredada = await page.evaluate(() => {
  const cfg = DB.getConfig();
  const p = cfg.perfiles.find(x => x.id === 'p1');
  const guardada = p.entidad;
  p.entidad = '';                       // el equipo que nunca la escribio
  DB.saveConfig(cfg);
  const out = { serv: lcServidorDefecto(DB.getConfig()).entidad,
                cc: ccEntidadDefecto(), ai: aiEntidadDefecto(),
                custodia: ccResolverOrigen('PERFIL').entidad };
  const c2 = DB.getConfig(); c2.perfiles.find(x => x.id === 'p1').entidad = guardada; DB.saveConfig(c2);
  return out;
});
log(heredada.serv === 'Institucion de prueba (DEMO)',
  '[B14] Sin entidad en el perfil, el FPJ-5 la toma de la institucion del membrete', heredada.serv);
log(heredada.cc === 'Institucion de prueba (DEMO)' && heredada.custodia === 'Institucion de prueba (DEMO)',
  '[B15] Y tambien la cadena de custodia, el rotulo y las dos actas', heredada.cc);
log(heredada.ai === 'Institucion de prueba (DEMO)',
  '[B16] El acta de incautacion no cambio: ya encadenaba a esa misma clave');

/* Con entidad en el perfil, MANDA la del perfil: lo ya configurado no cambia. */
const propia = await page.evaluate(() => ({
  serv: lcServidorDefecto(DB.getConfig()).entidad, cc: ccEntidadDefecto() }));
log(propia.serv === 'Institucion del usuario (DEMO)' && propia.cc === 'Institucion del usuario (DEMO)',
  '[B17] ⚠️ Y cuando el perfil SI la trae, sigue mandando ella — el resultado no cambia', propia.serv);

/* Ninguna institucion escrita en el codigo (filtro de Play Store). */
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
log(!/placeholder="[^"]*Polic[ií]a Nacional/i.test(src) && !/entidad\s*[:=]\s*['"]Polic/i.test(src),
  '[B18] Sigue sin haber ninguna institucion escrita en el codigo');

sec('B · EL DOSSIER SIGUE INTACTO COMO MODULO');

const dos = await page.evaluate(() => {
  const puertas = ['abrirDossierTexto','renderDossierWA','enviarDossierCaso','getDosierSecciones',
                   'genDossier','genSeccionContent','toggleSecEditor','lcDossierSnap','lcCongelarDossier'];
  return { existen: puertas.every(f => typeof window[f] === 'function'),
           pantalla: !!document.getElementById('screen-dossierwa'),
           secciones: getDosierSecciones().length,
           esperadas: getDefaultSecciones().length,
           enNav: [...document.querySelectorAll('.sb-item')].map(e => e.dataset.screen).filter(Boolean) };
});
log(dos.existen, '[B19] ⚠️ El modulo del dossier sigue completo: ninguna de sus nueve funciones se retiro');
/* ⚠️ La expectativa se DERIVA del registro (`getDefaultSecciones`) en vez de
   escribirse a mano: la Mejora 8 anadio la seccion de incautaciones y un numero
   fijo dejaria esta prueba obsoleta con la siguiente. Lo que mide sigue siendo
   que el traslado de la Mejora 7 no se llevara ninguna por delante. */
log(dos.pantalla && dos.secciones === dos.esperadas && dos.secciones >= 10,
  '[B20] Su pantalla y todas sus secciones siguen ahi', 'secciones: ' + dos.secciones);
log(dos.enNav.includes('perfil') && dos.enNav.includes('ajustes'),
  '[B21] Y la navegacion no perdio ninguna entrada', dos.enNav.join(' · '));

/* La preferencia se conserva entre recargas (punto 17 del requerimiento). */
await page.evaluate(() => { go('perfil'); });
await page.waitForTimeout(300);
await page.evaluate(() => {
  document.getElementById('pj-patrulla').value = '47';
  document.getElementById('pj-cai').value = 'CAI Prado';
  document.getElementById('pj-vereda').value = 'El Alto';
  lcJurisGuardar();
});
await page.waitForTimeout(700);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.fill('#pin-e', '246801');
await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(1200);
await page.evaluate(() => go('perfil'));
await page.waitForTimeout(500);
const persistido = await page.evaluate(() => ({
  patrulla:(document.getElementById('pj-patrulla')||{}).value,
  cai:(document.getElementById('pj-cai')||{}).value,
  vereda:(document.getElementById('pj-vereda')||{}).value,
  enCfg: DB.getConfig().patrullaNum,
  dossier: genDossier(DB.getCase('caso-fijo-m7')) }));
log(persistido.patrulla === '47' && persistido.cai === 'CAI Prado' && persistido.vereda === 'El Alto' && persistido.enCfg === '47',
  '[B22] Lo diligenciado en «Mi jurisdiccion» sobrevive a cerrar y reabrir la app', JSON.stringify(persistido.patrulla));
log(/PATRULLA 32 CAI Parque Bolivar/.test(persistido.dossier),
  '[B23] ⚠️ Y el dossier de la captura VIEJA sigue diciendo PATRULLA 32: su foto no se reescribe');

sec('B · EL INDICATIVO ES LA ETIQUETA; EL COMANDANTE, EL CONTENIDO');

/* Con los valores por defecto, el dossier sale con las etiquetas de siempre —
   por eso [B8] pudo comparar carácter por carácter. Aquí se mide la otra mitad:
   que escribir otro indicativo SÍ cambia la etiqueta, que es lo que se pidió. */
const ind = await page.evaluate(async () => {
  const antes = genDossier(DB.getCase('caso-fijo-m7'));
  const c = DB.getConfig();
  c.indicativoDistrito = 'HALCON 2'; c.indicativoEstacion = 'CENTAURO 5';
  DB.saveConfig(c);
  const despues = genDossier(DB.getCase('caso-fijo-m7'));
  const sec = getDosierSecciones().find(s => s.tipo === 'diamante3');
  const enEditor = dosSecLabel(sec, DB.getConfig());
  // Se restaura para no arrastrar el cambio al resto del recorrido.
  const c2 = DB.getConfig(); c2.indicativoDistrito = 'DIAMANTE 3'; c2.indicativoEstacion = 'VERDE 3';
  DB.saveConfig(c2);
  return { antes, despues, enEditor };
});
log(/\*VERDE 3\*/.test(ind.antes) && /\*DIAMANTE 3\*/.test(ind.antes),
  '[B25] Por defecto el dossier imprime las dos etiquetas de siempre');
log(/\*CENTAURO 5\*/.test(ind.despues) && /\*HALCON 2\*/.test(ind.despues) &&
    !/\*VERDE 3\*/.test(ind.despues) && !/\*DIAMANTE 3\*/.test(ind.despues),
  '[B26] Y con otro indicativo, la seccion sale con ÉL — que es para lo que se pidió el campo');
log(/T\.C William Quintero/.test(ind.despues) && /T\.C Jin Eduardo Moreno/.test(ind.despues),
  '[B27] El comandante sigue siendo el contenido de su seccion');
log(ind.enEditor === 'HALCON 2',
  '[B28] El editor de secciones enseña la etiqueta resuelta, no el nombre por defecto', ind.enEditor);

/* El distrito es un campo propio: lo que se escriba ahí es la línea 4 del
   membrete, y el nombre de la estación ya no lo pisa al guardar. */
const dep = await page.evaluate(() => {
  const c = DB.getConfig();
  return { dep: c.ojDependencia, est: c.nombreEstacion, cust: c.ojCustEstacion };
});
log(dep.dep === 'Distrito tres de policia' && dep.est === 'CANDELARIA',
  '[B29] ⚠️ El distrito y la estacion son ya DOS datos: guardar Ajustes no los colapsa',
  dep.dep + ' | ' + dep.est);
log(dep.cust === 'CANDELARIA',
  '[B30] Y el lugar de custodia sigue siendo la estacion, no el distrito', dep.cust);

/* ⚠️ Darle campo propio al distrito creó un duplicado nuevo —«Distrito tres de
   policía» y «No. del distrito: TRES» eran el mismo dato—, así que el número se
   deriva y su campo desapareció. Aquí se mide que el encabezado del dossier sale
   igual en los dos casos: cuando el nombre se deja leer y cuando no. */
const num = await page.evaluate(() => {
  const c = DB.getConfig();
  const guardado = c.ojDependencia;
  const out = {};
  out.sinCampo = !document.getElementById('aj-distrito');
  out.derivado = lcNumDistrito(c);
  c.ojDependencia = 'Distrito octavo de policia'; DB.saveConfig(c);
  out.otro = lcNumDistrito(DB.getConfig());
  out.dossier = genDossier(DB.getCase('caso-fijo-m7'));
  // Un nombre que NO se deja leer (una seccional): manda la clave guardada.
  const c2 = DB.getConfig(); c2.ojDependencia = 'Seccional de investigacion criminal'; DB.saveConfig(c2);
  out.respaldo = lcNumDistrito(DB.getConfig());
  const c3 = DB.getConfig(); c3.ojDependencia = guardado; DB.saveConfig(c3);
  return out;
});
log(num.sinCampo, '[B31] El «No. del distrito» dejó de pedirse: era el mismo dato que su nombre');
log(num.derivado === 'TRES' && num.otro === 'OCTAVO',
  '[B32] Se lee del nombre del distrito', num.derivado + ' / ' + num.otro);
log(/DISTRITO OCTAVO DE POLIC/.test(num.dossier),
  '[B33] Y es lo que encabeza el dossier');
log(num.respaldo === 'TRES',
  '[B34] ⚠️ Con un nombre que no se deja leer (una seccional) manda la clave guardada: el encabezado no se rompe', num.respaldo);

log(errs.length === 0, '[B24] Consola limpia', errs.slice(0, 3).join(' | '));

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n─────────────────────────────────────────');
const ok = R.filter(Boolean).length;
console.log(ok + '/' + R.length + (ok === R.length ? '  ✅ TODO EN VERDE' : '  ❌ HAY FALLOS'));
await browser.close();
server.close();
process.exit(ok === R.length ? 0 : 1);
