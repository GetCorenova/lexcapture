// MODO PATRULLA · FASES 1-3 — identidad y reloj, fusion al guardar, y el canal entre los dos equipos.
//
// Dos mitades:
//   A · las primitivas hacen lo que dicen (identidad, reloj, aplanado, diff, fusion)
//   B · EL MODO INDIVIDUAL NO CAMBIA — que es la regla que gobierna toda la ampliacion.
//       Un caso que nunca se comparte se guarda idéntico y produce el mismo .docx.
import { chromium } from 'playwright';
import { createServer } from 'http'; import { readFileSync, existsSync } from 'fs'; import { join, extname } from 'path';
const ROOT='d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME={'.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.js':'text/javascript'};
const server=createServer((q,s)=>{const p=join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')||'LexCapture_v8.html');
if(!existsSync(p)){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});s.end(readFileSync(p));});
await new Promise(r=>server.listen(8133,r));
const R=[]; const log=(ok,l,x)=>{R.push(ok);console.log(ok?'OK  ':'FAIL',l,x??'');};
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:384,height:800}});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,90)));
page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
await page.goto('http://localhost:8133/LexCapture_v8.html',{waitUntil:'load'});
await page.evaluate(()=>localStorage.clear()); await page.reload({waitUntil:'load'}); await page.waitForTimeout(400);
await page.fill('#pin-a','1234'); await page.fill('#pin-b','1234');
await page.click('button[onclick="doSetPin()"]'); await page.waitForTimeout(700);

/* ══════════════════════════════════════════════════════════════════════════
   A · LAS PRIMITIVAS
   ══════════════════════════════════════════════════════════════════════════ */

// [1] identidad del equipo: existe, es opaca y persiste
const t1=await page.evaluate(()=>{ const a=ptDeviceId(); return {a, guardado:localStorage.getItem('lc_device'), fmt:/^d-[a-z0-9]+$/.test(a)}; });
log(t1.fmt && t1.a===t1.guardado, '[1] El equipo tiene identidad propia y persistida', t1.a);

// [2] sobrevive a recargar: dos sesiones, mismo identificador
await page.reload({waitUntil:'load'}); await page.waitForTimeout(300);
await page.fill('#pin-e','1234'); await page.click('button[onclick="doUnlockPin()"]'); await page.waitForTimeout(600);
const t2=await page.evaluate(()=>ptDeviceId());
log(t2===t1.a, '[2] La identidad sobrevive a recargar la aplicación', t2);

// [3] no lleva ningun dato de la persona ni del equipo
const src=readFileSync(join(ROOT,'LexCapture_v8.html'),'utf8');
const blk=src.slice(src.indexOf('MODO PATRULLA'), src.indexOf('// ====== SERVICE WORKER'));
log(!/cedula|numDoc|perfilActivo|nombreEstacion/.test(blk.split('ptDeviceId')[1].slice(0,600)),
    '[3] La identidad es opaca — no deriva de ningún dato del funcionario');

// [4] la identidad NO viaja en la configuracion (que se exporta entre equipos)
const t4=await page.evaluate(()=>{ const c=DB.getConfig(); return JSON.stringify(c).indexOf(ptDeviceId())<0; });
log(t4, '[4] La identidad no entra en la configuración — exportarla no clona el equipo');

// [5] reloj: sellos estrictamente crecientes aunque se pidan en el mismo milisegundo
const t5=await page.evaluate(()=>{ const s=[]; for(let i=0;i<50;i++) s.push(ptSello());
  for(let i=1;i<s.length;i++) if(ptCmp(s[i-1],s[i])>=0) return {ok:false,i};
  return {ok:true, mismoMs: s[0].t===s[49].t}; });
log(t5.ok, '[5] Cincuenta sellos seguidos salen estrictamente ordenados', t5.mismoMs?'(todos en el mismo milisegundo)':'');

// [6] EL PUNTO DEL RELOJ: un sello del otro equipo con la hora adelantada
//     empuja el reloj local, asi lo siguiente que se escriba va DESPUES.
const t6=await page.evaluate(()=>{
  const ajeno={t:Date.now()+600000, c:0, d:'d-otro'};   // compañero 10 min adelantado
  ptObservar(ajeno);
  const mio=ptSello();
  return ptCmp(mio, ajeno)>0;
});
log(t6, '[6] Un cambio recibido de un teléfono adelantado no deja atrás al propio');

// [7] el reloj sobrevive a cerrar la aplicacion
const t7=await page.evaluate(()=>({ guardado: !!localStorage.getItem('lc_hlc'), t: JSON.parse(localStorage.getItem('lc_hlc')||'{}').t }));
await page.reload({waitUntil:'load'}); await page.waitForTimeout(300);
await page.fill('#pin-e','1234'); await page.click('button[onclick="doUnlockPin()"]'); await page.waitForTimeout(600);
const t7b=await page.evaluate((prev)=>ptCmp(ptSello(),{t:prev,c:0,d:''})>0, t7.t);
log(t7.guardado && t7b, '[7] El reloj sobrevive a reiniciar — lo de después no parece anterior');

// [8] orden total y desempate determinista por equipo
const t8=await page.evaluate(()=>{
  const a={t:100,c:1,d:'d-aaa'}, b={t:100,c:1,d:'d-bbb'};
  return ptCmp(a,b)<0 && ptCmp(b,a)>0 && ptCmp(a,{t:100,c:1,d:'d-aaa'})===0;
});
log(t8, '[8] Empate exacto: desempata por equipo, y los dos lados deciden igual');

// [9] aplanado: rutas, listas con identificador, y metadatos fuera
const t9=await page.evaluate(()=>{
  const c={ nunc:'05001', lugar:{muni:'Medellín',dir:'CR 52 # 50-31'},
    capturados:[{id:'a1',priNom:'JUAN'},{id:'b2',priNom:'ANA'}],
    conductas:['Hurto','Lesiones'], _m:{x:1} };
  const p=ptAplanar(c,'',{},'');
  return { rutas:Object.keys(p).sort(), cap:p['capturados/#a1/priNom'], cond:JSON.stringify(p['conductas']) };
});
log(t9.cap==='JUAN' && t9.cond==='["Hurto","Lesiones"]' && !t9.rutas.some(r=>r.indexOf('_m')>=0),
    '[9] Aplana a rutas: personas por identificador, conductas como valor único, metadatos fuera');

// [10] degradacion segura: si a un elemento le falta el identificador, la lista
//      entera se trata como valor unico en vez de fusionarse a medias
const t10=await page.evaluate(()=>{
  const p=ptAplanar({victimas:[{id:'v1',priNom:'A'},{priNom:'SIN ID'}]},'',{},'');
  return Array.isArray(p['victimas']) && !p['victimas/#v1/priNom'];
});
log(t10, '[10] Lista con un elemento sin identificador: se fusiona entera, nunca a medias');

// [11] diff: cambios y borrados
const t11=await page.evaluate(()=>{
  const base={nunc:'1',lugar:{muni:'Medellín',barrio:'X'},capturados:[{id:'a1',tel:'300'}]};
  const act ={nunc:'2',lugar:{muni:'Medellín'},           capturados:[{id:'a1',tel:'300'},{id:'b2',tel:'311'}]};
  const ops=ptDiff(base,act);
  const r=Object.fromEntries(ops.map(o=>[o.r,o.x?'BORRA':o.v]));
  return { n:ops.length, nunc:r['nunc'], barrio:r['lugar/barrio'], nuevo:r['capturados/#b2/tel'], muni:('lugar/muni' in r) };
});
log(t11.nunc==='2' && t11.barrio==='BORRA' && t11.nuevo==='311' && !t11.muni,
    '[11] El diff ve lo que cambió y solo eso — lo igual no genera operación');

// [12] aplicar una ruta crea el camino y el elemento de lista que falte
const t12=await page.evaluate(()=>{
  const c={};
  ptPonerRuta(c,'lugar/muni','Envigado');
  ptPonerRuta(c,'victimas/#v9/priNom','LUZ');
  return { muni:c.lugar&&c.lugar.muni, v:Array.isArray(c.victimas)&&c.victimas[0], };
});
log(t12.muni==='Envigado' && t12.v && t12.v.id==='v9' && t12.v.priNom==='LUZ',
    '[12] Aplicar crea el camino y la persona que el otro equipo acaba de registrar');

// [13] fusion por CAMPO: corregir el barrio no revierte el municipio del otro
const t13=await page.evaluate(()=>{
  const c={id:'c1',lugar:{muni:'Medellín',barrio:'Prado'}};
  ptSellarCaso(c);
  /* ⚠️ El sello se deriva del RELOJ LÓGICO, no de Date.now(): tras recibir algo de
     un teléfono adelantado el reloj local va por delante de la hora física, que es
     justo lo que garantiza la comprobación [6]. */
  const base=ptSello(); const s={t:base.t+1,c:0,d:'d-otro'};
  ptFusionar(c,[{r:'lugar/barrio',v:'La Candelaria',s}]);
  return c.lugar;
});
log(t13.barrio==='La Candelaria' && t13.muni==='Medellín',
    '[13] Se fusiona por campo: cambiar el barrio no toca el municipio');

// [14] una operacion mas VIEJA que lo que ya hay se descarta
const t14=await page.evaluate(()=>{
  const c={id:'c1',lugar:{muni:'Medellín'}};
  ptSellarCaso(c,{t:5000,c:0,d:'d-mio'});
  const r=ptFusionar(c,[{r:'lugar/muni',v:'Bogotá',s:{t:1000,c:0,d:'d-otro'}}]);
  return {muni:c.lugar.muni, desc:r.descartadas};
});
log(t14.muni==='Medellín' && t14.desc===1, '[14] Un cambio anterior al que ya hay se descarta');

// [15] la identidad de quien suscribe NO la escribe el compañero
const t15=await page.evaluate(()=>{
  const c={id:'c1',servidor:{nombre:'JUAN PÉREZ'},dossierSnap:{verde3:'X'},lugar:{muni:'Medellín'}};
  ptSellarCaso(c,{t:1,c:0,d:'d-mio'});
  const s={t:Date.now()+9999,c:0,d:'d-otro'};
  const r=ptFusionar(c,[{r:'servidor/nombre',v:'OTRO',s},{r:'dossierSnap/verde3',v:'Y',s},{r:'lugar/muni',v:'Itagüí',s}]);
  return {srv:c.servidor.nombre, snap:c.dossierSnap.verde3, muni:c.lugar.muni, rech:r.rechazadas};
});
log(t15.srv==='JUAN PÉREZ' && t15.snap==='X' && t15.muni==='Itagüí' && t15.rech===2,
    '[15] El compañero no puede reescribir quién firma ni la unidad del dossier');

// [16] CONVERGENCIA — el escenario del reporte, en los dos ordenes de llegada.
//      A trabaja el capturado, B la victima, a la vez y sin verse.
const t16=await page.evaluate(()=>{
  const base=()=>({id:'c1',tipo:'URI',lugar:{muni:'Medellín'},capturados:[{id:'a1',priNom:'JUAN'}],victimas:[]});
  const A=base(), B=base();
  ptSellarCaso(A,{t:1,c:0,d:'d-A'}); ptSellarCaso(B,{t:1,c:0,d:'d-A'});
  // A diligencia al capturado
  const opsA=ptSellarOps(A, [{r:'capturados/#a1/tel',v:'3001112233'},{r:'capturados/#a1/dirRes',v:'CL 49 # 54'}]);
  opsA.forEach(o=>ptPonerRuta(A,o.r,o.v));
  // B, a la vez, registra la victima
  const tB=ptSello().t;
  const opsB=[{r:'victimas/#v1/priNom',v:'LUZ',s:{t:tB,c:0,d:'d-B'}},
              {r:'victimas/#v1/tel',   v:'3114445566',s:{t:tB,c:1,d:'d-B'}}];
  opsB.forEach(o=>{ptPonerRuta(B,o.r,o.v); ptMarcas(B)[o.r]=o.s;});
  // se ven: A recibe lo de B y B lo de A
  ptFusionar(A,opsB); ptFusionar(B,opsA);
  // y en el orden inverso, sobre replicas nuevas
  const A2=base(), B2=base(); ptSellarCaso(A2,{t:1,c:0,d:'d-A'}); ptSellarCaso(B2,{t:1,c:0,d:'d-A'});
  opsA.forEach(o=>ptPonerRuta(A2,o.r,o.v)); opsA.forEach(o=>ptMarcas(A2)[o.r]=o.s);
  opsB.forEach(o=>ptPonerRuta(B2,o.r,o.v)); opsB.forEach(o=>ptMarcas(B2)[o.r]=o.s);
  ptFusionar(B2,opsA.slice().reverse()); ptFusionar(A2,opsB.slice().reverse());
  /* ⚠️ Se compara con la huella CANÓNICA, no con JSON.stringify: las dos réplicas
     acaban con el mismo contenido pero con las claves en distinta secuencia —quien
     recibió antes el teléfono lo tiene antes dentro de la persona—. La convergencia
     de la que hablamos es de contenido, no de escritura. */
  const j=x=>ptHuella(x);
  return { iguales:j(A)===j(B), invertido:j(A2)===j(B2), mismoResultado:j(A)===j(A2),
           tel:A.capturados[0].tel, vic:(A.victimas[0]||{}).priNom };
});
log(t16.iguales && t16.invertido && t16.mismoResultado && t16.tel==='3001112233' && t16.vic==='LUZ',
    '[16] A en el capturado y B en la víctima: las dos réplicas convergen, en cualquier orden');

// [17] borrar un elemento de una lista
const t17=await page.evaluate(()=>{
  const c={victimas:[{id:'v1',priNom:'A'},{id:'v2',priNom:'B'}]};
  ptQuitarId(c,'victimas','v1');
  return c.victimas.length===1 && c.victimas[0].id==='v2';
});
log(t17, '[17] Se puede retirar de una lista el elemento que el otro equipo eliminó');

// [17b] ⚠️ RETIRAR A UNA PERSONA ES UNA OPERACIÓN, NO UNA POR CAMPO. Con un
//       borrado por campo, el de su `id` la dejaba sin identificador: la
//       operación siguiente no la encontraba y CREABA otra con el mismo id, así
//       que la lista acababa con la persona original sin id y una segunda vacía
//       — en el apartado 5 del FPJ-5, una víctima fantasma.
const t17b=await page.evaluate(()=>{
  const A={victimas:[{id:'v1',priNom:'LUZ',tel:'311'},{id:'v2',priNom:'ANA'}]};
  const B={victimas:[{id:'v2',priNom:'ANA'}]};
  const ops=ptDiff(A,B);
  const C=JSON.parse(JSON.stringify(A));
  ops.forEach(o=>{ if(o.x) ptPonerRuta(C,o.r,undefined,true); else ptPonerRuta(C,o.r,o.v); });
  return { ops:ops.map(o=>o.r), quedan:C.victimas.length, quien:(C.victimas[0]||{}).id,
           conNombre:C.victimas.every(v=>v.id&&v.priNom) };
});
log(t17b.ops.length===1 && t17b.ops[0]==='victimas/#v1' && t17b.quedan===1 && t17b.quien==='v2' && t17b.conNombre,
    '[17b] Retirar a una persona es UNA operación — sin duplicados ni fantasmas sin nombre');

// [17c] y el identificador nunca se borra por una operación de campo suelta
const t17c=await page.evaluate(()=>{
  const c={victimas:[{id:'v1',priNom:'LUZ'}]};
  const ok=ptPonerRuta(c,'victimas/#v1/id',undefined,true);
  return { rechazado:ok===false, sigue:c.victimas[0].id==='v1' };
});
log(t17c.rechazado && t17c.sigue, '[17c] Una operación suelta no puede dejar a una persona sin identificador');

/* ══════════════════════════════════════════════════════════════════════════
   B · EL MODO INDIVIDUAL NO CAMBIA
   ══════════════════════════════════════════════════════════════════════════ */

// [18] un caso que nunca se comparte NO lleva marcas: ni un byte de más
const t18=await page.evaluate(async()=>{
  const c=SIM.genFlagrancia(); await DB.saveCase(c);
  const g=DB.getCase(c.id);
  return { sinM: !('_m' in g), bytes:new Blob([JSON.stringify(g)]).size };
});
log(t18.sinM, '[18] Un caso que nunca se compartió no lleva marcas de versión', t18.bytes+' B');

// [19] ptLimpio sobre un caso sin marcas devuelve EL MISMO objeto
const t19=await page.evaluate(()=>{ const c={a:1}; return ptLimpio(c)===c && ptLimpioJSON(c)===JSON.stringify(c); });
log(t19, '[19] Sin marcas, descontarlas no cuesta ni una copia');

// [20] y con marcas, la huella es la de antes de ponerlas
const t20=await page.evaluate(()=>{
  const c={id:'x',tipo:'URI',lugar:{muni:'Medellín'}};
  const antes=JSON.stringify(c);
  ptSellarCaso(c);
  return { igual: ptLimpioJSON(c)===antes, tiene: ptTieneMarcas(c) };
});
log(t20.igual && t20.tiene, '[20] Con marcas puestas, la huella del caso sigue siendo la de antes');

// [21] EL FORMULARIO NO SE CREE SUCIO. Abrirlo y cerrarlo sin tocar nada no
//      puede dejar un borrador fantasma — es lo que protegía la foto inicial.
await page.evaluate(()=>{ location.hash=''; });
const t21=await page.evaluate(()=>{ startWizard('URI'); const a=wizSucio(); return {a, base:!!_wizBase}; });
log(t21.base && t21.a===false, '[21] Abrir el formulario y no tocar nada: sigue sin cambios');

// [22] y tocar algo SÍ lo marca
const t22=await page.evaluate(()=>{ wc.lugar.barrio='Prado'; return wizSucio(true); });
log(t22, '[22] Tocar un dato sí marca el formulario como pendiente de guardar');

// [23] con marcas de versión puestas, el formulario SIGUE sin creerse sucio
const t23=await page.evaluate(()=>{
  startWizard('URI');                       // foto inicial limpia
  ptSellarCaso(wc);                         // el caso entra en una sesión compartida
  return wizSucio(true)===false;
});
log(t23, '[23] Compartir un caso no hace que el formulario se crea sucio');
await page.evaluate(()=>{ wc=null; go('capturas'); });

// [24] EL DOCUMENTO NO CAMBIA — el FPJ-5 de un caso sellado es idéntico al del
//      mismo caso sin sellar. Es la garantía del punto 20 del encargo.
const t24=await page.evaluate(async()=>{
  const c=SIM.genFlagrancia(); c.tipo='URI';
  const a=await buildFPJBlob(c);
  const c2=JSON.parse(JSON.stringify(c)); ptSellarCaso(c2);
  const b=await buildFPJBlob(c2);
  if(!a||!a.blob||!b||!b.blob) return {ok:false,e:'sin blob'};
  const xa=new Uint8Array(await a.blob.arrayBuffer()), xb=new Uint8Array(await b.blob.arrayBuffer());
  if(xa.length!==xb.length) return {ok:false,e:'tamaños '+xa.length+' vs '+xb.length};
  for(let i=0;i<xa.length;i++) if(xa[i]!==xb[i]) return {ok:false,e:'difiere en el byte '+i};
  return {ok:true, bytes:xa.length};
});
log(t24.ok, '[24] El FPJ-5 sale byte a byte idéntico con el caso compartido', t24.ok?(t24.bytes+' B'):t24.e);

// [25] modo invitado: la identidad y el reloj no escriben NADA en el equipo
const t25=await page.evaluate(()=>{
  const antes=JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,(localStorage.getItem(k)||'').length]));
  const guardado=_guest, devGuardado=_ptDev, hlcGuardado=_ptHlc;
  _guest=true; _ptDev=null; _ptHlc=null;
  const id=ptDeviceId(); ptSello(); ptSello();
  const despues=JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,(localStorage.getItem(k)||'').length]));
  _guest=guardado; _ptDev=devGuardado; _ptHlc=hlcGuardado;
  return { igual: antes===despues, fmt:/^g-/.test(id) };
});
log(t25.igual && t25.fmt, '[25] En modo invitado no se escribe un solo byte en el equipo');

// [26] el modulo esta AISLADO: nada de lo existente llama a estas primitivas
//      salvo los dos puntos de compatibilidad declarados.
const usos=[...src.matchAll(/\bpt(?:Limpio|LimpioJSON|Sello|Fusionar|Diff|SellarCaso)\b/g)].length;
// Se cuentan LLAMADAS reales, no menciones en un comentario.
const fuera=(src.split('MODO PATRULLA · FASE 1')[0].match(/\bptLimpioJSON\(/g)||[]).length;
log(fuera===2, '[26] Fuera del módulo solo se toca la huella del formulario', fuera+' usos, '+usos+' en total');

// [27] el modulo no toca ningun motor documental
const tocaDocs=/\bpt[A-Z]\w*/.test(src.slice(src.indexOf('function buildFPJBlob'), src.indexOf('function buildFPJBlob')+40000));
log(!tocaDocs, '[27] Ningún motor documental sabe que esta capa existe');

/* ══════════════════════════════════════════════════════════════════════════
   C · FASE 2 — EL GUARDADO DEJA DE REEMPLAZAR EL CASO
   ══════════════════════════════════════════════════════════════════════════ */

// [29] un caso normal no entra por la rama nueva: mismo camino, mismo resultado
const t29=await page.evaluate(async()=>{
  const c=SIM.genFlagrancia(); await DB.saveCase(c);
  const antes=JSON.stringify(DB.getCase(c.id));
  const g=DB.getCase(c.id); g.spoa='123456'; await DB.saveCase(g);
  const d=DB.getCase(c.id);
  return { sinM:!('_m' in d), sinFoto:!ptFotoDe(c.id), sinCola:ptPendientes(c.id)===0,
           guardo:d.spoa==='123456', cambio:antes!==JSON.stringify(d) };
});
log(t29.sinM && t29.sinFoto && t29.sinCola && t29.guardo && t29.cambio,
    '[29] Un caso que no se comparte no genera marcas, ni foto, ni cola');

// [30] compartir un caso lo sella y toma su foto de partida
const t30=await page.evaluate(async()=>{
  const c=SIM.genFlagrancia(); c.victimas=[]; await DB.saveCase(c);
  const v=DB.getCase(c.id); ptCompartir(v); await DB.saveCase(v);
  window.__caso=c.id;
  return { compartido:ptCompartido(DB.getCase(c.id)), foto:!!ptFotoDe(c.id),
           marcas:Object.keys(DB.getCase(c.id)._m||{}).length };
});
log(t30.compartido && t30.foto && t30.marcas>10, '[30] Compartir un caso lo sella entero y guarda su punto de partida', t30.marcas+' rutas selladas');

// [31] EL ESCENARIO DEL ENCARGO. A trabaja el capturado sobre su copia; mientras
//      tanto llega la víctima que registró B; A guarda. La víctima sobrevive.
const t31=await page.evaluate(async()=>{
  const id=window.__caso;
  const copiaA=JSON.parse(JSON.stringify(DB.getCase(id)));      // A abre el wizard
  const baseA=JSON.parse(JSON.stringify(ptLimpio(copiaA)));     // su foto inicial
  copiaA.capturados[0].tel='3001112233';                        // A diligencia
  copiaA.capturados[0].dirRes='CL 49 # 54-20';
  // …y mientras tanto llega lo de B
  const s=ptSello(); const sB={t:s.t+1,c:0,d:'d-B'};
  ptAplicarRemoto(id,[{r:'victimas/#v1/priNom',v:'LUZ',s:sB},
                      {r:'victimas/#v1/tel',v:'3114445566',s:{t:s.t+1,c:1,d:'d-B'}}]);
  await DB.saveCase(copiaA, baseA);                             // A guarda
  const f=DB.getCase(id);
  return { tel:(f.capturados[0]||{}).tel, vic:(f.victimas[0]||{}).priNom, vicTel:(f.victimas[0]||{}).tel,
           nVic:(f.victimas||[]).length };
});
log(t31.tel==='3001112233' && t31.vic==='LUZ' && t31.vicTel==='3114445566' && t31.nVic===1,
    '[31] A guarda su capturado y la víctima que registró B sigue ahí');

// [32] …y SIN pasar la base se reproduce el defecto: el guardado la borraría.
//      Es la prueba de que el arreglo hace algo, no de que el escenario es fácil.
const t32=await page.evaluate(async()=>{
  /* ⚠️ Sobre un caso PROPIO: reproducir el defecto en el caso principal dejaría
     sus operaciones de borrado en la cola y contaminaría las comprobaciones
     siguientes. */
  const c=SIM.genFlagrancia(); c.victimas=[]; await DB.saveCase(c);
  const v=DB.getCase(c.id); ptCompartir(v); await DB.saveCase(v);
  const copia=JSON.parse(JSON.stringify(DB.getCase(c.id)));   // copia de antes
  const s=ptSello();
  ptAplicarRemoto(c.id,[{r:'victimas/#v9/priNom',v:'MARTA',s:{t:s.t+1,c:0,d:'d-B'}}]);
  const llego=(DB.getCase(c.id).victimas||[]).length===1;
  copia.recibe='FISCAL 3';
  await DB.saveCase(copia);                  // sin base: se compara contra la foto
  return { llego, perdida:(DB.getCase(c.id).victimas||[]).length===0 };
});
log(t32.llego && t32.perdida, '[32] Sin la foto de partida el defecto reaparece — el arreglo es el que lo evita');

// [33] las salidas documentales no pasan base y NO hace falta: leen el caso
//      fresco, así que la foto del último guardado es su punto de partida real
const t33=await page.evaluate(async()=>{
  const id=window.__caso;
  const c=DB.getCase(id);                       // referencia viva, como f6Guardar
  c.spoa='9988776655'; c.numIncidente='INC-7';
  await DB.saveCase(c);
  const f=DB.getCase(id);
  return { spoa:f.spoa, inc:f.numIncidente, vic:(f.victimas[0]||{}).priNom,
           marca:!!(f._m||{})['spoa'] };
});
log(t33.spoa==='9988776655' && t33.inc==='INC-7' && t33.vic==='LUZ' && t33.marca,
    '[33] Una salida documental muta el caso vivo y su cambio queda registrado');

// [34] la cola acumula lo propio y NO lo que llega del compañero
const t34=await page.evaluate(()=>{
  const id=window.__caso, rutas=(_ptCola[id]||[]).map(o=>o.r);
  return { n:rutas.length, mio:rutas.indexOf('spoa')>=0,
           ajeno:rutas.some(r=>r.indexOf('victimas/')===0) };
});
log(t34.mio && !t34.ajeno, '[34] La cola lleva lo que escribió este equipo, no lo que le mandaron', t34.n+' operaciones');

// [35] la cola sobrevive a cerrar la aplicación
const t35a=await page.evaluate(()=>ptPendientes(window.__caso));
await page.reload({waitUntil:'load'}); await page.waitForTimeout(300);
await page.fill('#pin-e','1234'); await page.click('button[onclick="doUnlockPin()"]'); await page.waitForTimeout(700);
const t35=await page.evaluate((n)=>{ const casos=DB.getCases().filter(c=>ptCompartido(c));
  return { total:ptPendientes(), casos:casos.length, esperado:n }; }, t35a);
log(t35.total>=t35.esperado && t35.casos>=1, '[35] Los cambios pendientes sobreviven a cerrar la aplicación', t35.total+' en cola');

// [36] al reabrir, el caso compartido sigue siéndolo
const t36=await page.evaluate(()=>{
  const c=DB.getCases().filter(x=>ptCompartido(x))[0];
  window.__caso=c.id;
  return { compartido:true, vic:(c.victimas[0]||{}).priNom, spoa:c.spoa };
});
log(t36.vic==='LUZ' && t36.spoa==='9988776655', '[36] Y conserva lo fusionado de los dos equipos');

// [37] ptEspejar: el llamador se queda con el caso al día, no con su copia vieja
const t37=await page.evaluate(async()=>{
  const id=window.__caso;
  const copia=JSON.parse(JSON.stringify(DB.getCase(id)));
  const base=JSON.parse(JSON.stringify(ptLimpio(copia)));
  copia.recibe='FISCAL 22';
  const s=ptSello();
  ptAplicarRemoto(id,[{r:'testigos/#t1/priNom',v:'PEDRO',s:{t:s.t+1,c:0,d:'d-B'}}]);
  await DB.saveCase(copia, base);
  // el objeto que pasó el llamador tiene que traer ya lo del compañero
  const buscar=a=>(a||[]).filter(t=>t.id==='t1')[0]||null;
  return { enLaCopia:!!buscar(copia.testigos), enElAlmacen:!!buscar(DB.getCase(id).testigos),
           suyo:copia.recibe==='FISCAL 22' };
});
log(t37.enLaCopia && t37.enElAlmacen && t37.suyo,
    '[37] Tras guardar, el objeto del llamador ya trae lo que llegó del compañero');

// [38] lo remoto no se reenvía a sí mismo
const t38=await page.evaluate(()=>{
  const id=window.__caso, antes=ptPendientes(id);
  const s=ptSello();
  ptAplicarRemoto(id,[{r:'testigos/#t1/tel',v:'3009998877',s:{t:s.t+1,c:0,d:'d-B'}}]);
  const t=(DB.getCase(id).testigos||[]).filter(x=>x.id==='t1')[0]||{};
  return { antes, despues:ptPendientes(id), aplicado:t.tel==='3009998877' };
});
log(t38.antes===t38.despues && t38.aplicado, '[38] Lo que llega del compañero no vuelve a salir por la cola');

// [39] EL WIZARD REAL, de punta a punta
const t39=await page.evaluate(async()=>{
  const id=window.__caso;
  editCase(id);                                  // abre con su foto inicial
  if(!wc||wc.id!==id) return {ok:false,e:'no abrió'};
  /* ⚠️ El paso «Lugar» recolecta del DOM y REEMPLAZA wc.lugar entero, así que
     escribir en el modelo no sobrevive a collectStep(): hay que escribir donde
     escribe el funcionario. */
  const el=document.getElementById('w-barrio'); if(el) el.value='La Candelaria';
  wc.capturados[0].ocup='Comerciante';       // esta rama no la recolecta este paso
  const s=ptSello();                             // …y llega algo de B a media edición
  ptAplicarRemoto(id,[{r:'victimas/#v1/ocup',v:'Docente',s:{t:s.t+1,c:0,d:'d-B'}}]);
  await wizSave();
  const f=DB.getCase(id);
  return { ok:true, barrio:f.lugar.barrio, ocup:(f.capturados[0]||{}).ocup,
           vic:(f.victimas[0]||{}).ocup, vicNom:(f.victimas[0]||{}).priNom };
});
log(t39.ok && t39.barrio==='La Candelaria' && t39.ocup==='Comerciante' && t39.vic==='Docente' && t39.vicNom==='LUZ',
    '[39] Guardar desde el formulario conserva lo que el compañero escribió mientras tanto');

// [40] el formulario NO se cree sucio por las marcas que se movieron durante la edición
const t40=await page.evaluate(()=>{
  const id=window.__caso; editCase(id);
  const s=ptSello();
  ptAplicarRemoto(id,[{r:'victimas/#v1/escol',v:'Universitaria',s:{t:s.t+1,c:0,d:'d-B'}}]);
  const sucio=wizSucio();
  wc=null; go('capturas');
  return sucio===false;
});
log(t40, '[40] Que llegue algo del compañero no marca el formulario como sin guardar');

// [41] EL DOCUMENTO NO CAMBIA: el FPJ-5 de un caso trabajado a cuatro manos es
//      el mismo que el del caso equivalente sin compartir
const t41=await page.evaluate(async()=>{
  const c=DB.getCase(window.__caso);
  const gemelo=JSON.parse(JSON.stringify(ptLimpio(c)));   // mismo contenido, sin marcas
  const a=await buildFPJBlob(c), b=await buildFPJBlob(gemelo);
  if(!a||!a.blob||!b||!b.blob) return {ok:false,e:'sin blob'};
  const xa=new Uint8Array(await a.blob.arrayBuffer()), xb=new Uint8Array(await b.blob.arrayBuffer());
  if(xa.length!==xb.length) return {ok:false,e:'tamaños '+xa.length+' vs '+xb.length};
  for(let i=0;i<xa.length;i++) if(xa[i]!==xb[i]) return {ok:false,e:'byte '+i};
  return {ok:true,bytes:xa.length};
});
log(t41.ok, '[41] El FPJ-5 del caso compartido sale byte a byte igual que el del caso normal', t41.ok?(t41.bytes+' B'):t41.e);

// [42] terminar la sesión no borra el caso ni su historia
const t42=await page.evaluate(()=>{
  const id=window.__caso, r=ptTerminarSesion(id);
  const c=DB.getCase(id);
  return { existe:!!c, marcas:ptCompartido(c), vic:(c.victimas[0]||{}).priNom, pend:typeof r.pendientes==='number' };
});
log(t42.existe && t42.marcas && t42.vic==='LUZ' && t42.pend,
    '[42] Terminar la colaboración cierra la sesión, no el procedimiento');

// [43] modo invitado: la cola tampoco escribe un byte
const t43=await page.evaluate(async()=>{
  const antes=JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,(localStorage.getItem(k)||'').length]));
  const g=_guest; _guest=true;
  ptEncolar('caso-invitado',[{r:'lugar/muni',v:'X',s:ptSello()}]);
  await new Promise(r=>setTimeout(r,120));
  const despues=JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,(localStorage.getItem(k)||'').length]));
  _guest=g; ptVaciarCola('caso-invitado');
  return antes===despues;
});
log(t43, '[43] En modo invitado la cola vive en memoria y no toca el equipo');

// [44] el módulo sigue aislado: fuera de él solo los enganches declarados
const enganches=(src.split('MODO PATRULLA · FASE 1')[0].match(/\bpt(?:Compartido|GuardarLocal|TomarFoto|LimpioJSON)\(/g)||[]).length;
log(enganches===6, '[44] Fuera del módulo solo los enganches declarados en DB.saveCase y el formulario', enganches+' llamadas');

/* ══════════════════════════════════════════════════════════════════════════
   C · FASE 3 — EL CANAL

   ⚠️ Se abre un SEGUNDO CONTEXTO de navegador, no una segunda pestaña: así los
   dos lados tienen su propio almacenamiento y su propia identidad de equipo, que
   es lo que los convierte en dos teléfonos y no en dos vistas del mismo.
   ══════════════════════════════════════════════════════════════════════════ */

const ctxB = await browser.newContext({ viewport: { width: 384, height: 800 } });
const pageB = await ctxB.newPage();
pageB.on('pageerror', e => errs.push('B: ' + String(e.message).slice(0, 90)));
pageB.on('console', m => { if (m.type() === 'error') errs.push('B: ' + m.text().slice(0, 90)); });
await pageB.goto('http://localhost:8133/LexCapture_v8.html', { waitUntil: 'load' });
await pageB.evaluate(() => localStorage.clear()); await pageB.reload({ waitUntil: 'load' }); await pageB.waitForTimeout(400);
await pageB.fill('#pin-a', '4321'); await pageB.fill('#pin-b', '4321');
await pageB.click('button[onclick="doSetPin()"]'); await pageB.waitForTimeout(700);


/* Emparejamiento completo entre los dos equipos, PASANDO POR EL CÓDIGO: se
   pinta, se dibuja en un lienzo y se vuelve a leer con el propio lector. No se
   pasan los bytes por debajo — si el códec se rompiera, esto tendría que fallar. */
const LEER = (nombre) => `(async (bytes) => {
  const svg = ptQrSvg(bytes, 320);
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
  const W = 400, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.drawImage(img, 40, 40, 320, 320);
  return ptQrLeer(g.getImageData(0, 0, W, W).data, W, W);
})`;
const b64 = (u) => Buffer.from(u).toString('base64');
async function emparejar(id) {
  const inv = await page.evaluate(async (i) => {
    const r = await ptCrearInvitacion(i);
    return r ? Array.from(r.bytes) : null;
  }, id);
  if (!inv) return { paso1: { ok: false, motivo: 'no se preparó la invitación' }, ok: false };
  const paso1 = await pageB.evaluate(async ([arr, leerSrc]) => {
    const leer = eval(leerSrc);
    const leido = await leer(Uint8Array.from(arr));
    if (!leido) return { ok: false, motivo: 'no se leyó el código' };
    const r = await ptResponderInvitacion(leido, null);
    if (!r.ok) return r;
    return { ok: true, bytes: Array.from(r.bytes) };
  }, [inv, LEER()]);
  if (!paso1.ok) return { paso1, ok: false, motivo: paso1.motivo };
  const fin = await page.evaluate(async ([arr, leerSrc]) => {
    const leer = eval(leerSrc);
    const leido = await leer(Uint8Array.from(arr));
    if (!leido) return { ok: false, motivo: 'no se leyó la respuesta' };
    const r = await ptAceptarRespuesta(leido);
    if (!r.ok) return r;
    for (let i = 0; i < 100 && !ptEstado().activa; i++) await new Promise(t => setTimeout(t, 100));
    return { ok: ptEstado().activa };
  }, [paso1.bytes, LEER()]);
  return { paso1, ok: fin.ok, motivo: fin.motivo };
}

// [C1] El descriptor se comprime y se vuelve a armar, y el navegador lo acepta.
const c1 = await page.evaluate(async () => {
  const pc = new RTCPeerConnection({ iceServers: [] });
  pc.createDataChannel('x');
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise(r => { if (pc.iceGatheringState === 'complete') return r();
    pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && r()); setTimeout(r, 3000); });
  const sdp = pc.localDescription.sdp, p = ptSdpPartes(sdp);
  const ida = ptDescBytes(p), vuelta = ptDescDeBytes(ida);
  const rearmado = ptSdpArmar(vuelta, true);
  let acepta = true;
  try { const pc2 = new RTCPeerConnection({ iceServers: [] }); await pc2.setRemoteDescription({ type: 'offer', sdp: rearmado }); pc2.close(); }
  catch (e) { acepta = false; }
  pc.close();
  return { acepta, sdpBytes: sdp.length, compBytes: ida.length,
           mismoUfrag: vuelta.ufrag === p.ufrag, mismaFp: vuelta.fp === p.fp,
           cands: p.cands.length === vuelta.cands.length };
});
log(c1.acepta && c1.mismoUfrag && c1.mismaFp && c1.cands,
  '[C1] El descriptor se comprime, se rearma y el navegador lo acepta',
  c1.sdpBytes + ' B → ' + c1.compBytes + ' B');

// [C2] La invitación entera cabe en un QR pequeño — que es lo que decide si se
//      puede leer a la distancia a la que dos personas se enseñan una pantalla.
const c2 = await page.evaluate(async () => {
  const inv = await ptCrearInvitacion('caso-x');
  const m = ptQrMatriz(inv.bytes);
  ptCerrarCanal();
  return { bytes: inv.bytes.length, v: m.v, size: m.size };
});
log(c2.v <= 10, '[C2] La invitación cabe en un QR pequeño',
  c2.bytes + ' B → versión ' + c2.v + ' (' + c2.size + '×' + c2.size + ' módulos)');

// [C3] Ida y vuelta del códec dentro de la propia aplicación, todas las versiones.
const c3 = await page.evaluate(() => {
  let ok = 0, tot = 0;
  for (let v = 1; v <= 20; v++) {
    const e = PT_QR_EC[v], n = e[1] * e[2] + e[3] * e[4] - (v <= 9 ? 2 : 3);
    const p = new Uint8Array(n); for (let i = 0; i < n; i++) p[i] = (i * 37 + v * 11) & 255;
    const m = ptQrMatriz(p);
    const esc = 4, q = 4, W = (m.size + q * 2) * esc;
    const d = new Uint8ClampedArray(W * W * 4).fill(255);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const mx = Math.floor(x / esc) - q, my = Math.floor(y / esc) - q;
      const os = mx >= 0 && my >= 0 && mx < m.size && my < m.size && m.mods[my][mx] === 1;
      const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = os ? 0 : 255; d[i + 3] = 255;
    }
    const r = ptQrLeer(d, W, W);
    tot++;
    if (r && r.length === n && Array.from(r).every((b, i) => b === p[i])) ok++;
  }
  return { ok, tot };
});
log(c3.ok === c3.tot, '[C3] El códec de QR va y vuelve en las 20 versiones', c3.ok + '/' + c3.tot);

// [C4] Y se lee de una FOTO: la pantalla del otro, en ángulo, con ruido.
//      ⚠️ Es la única condición en que se va a usar de verdad.
const c4 = await page.evaluate(async () => {
  const p = new Uint8Array(160); for (let i = 0; i < 160; i++) p[i] = (i * 91 + 17) & 255;
  const svg = ptQrSvg(p, 300);
  const img = new Image();
  await new Promise(r => { img.onload = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
  /* ⚠️ El lienzo tiene que dar de sí para la DIAGONAL del código girado: con
     300 px girados 7 grados hacen falta más de 424, y si no las esquinas —donde
     viven los tres buscadores— se recortan y no hay nada que leer. */
  const W = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(0.13); g.transform(1, 0.06, -0.05, 0.94, 0, 0);
  g.drawImage(img, -150, -150, 300, 300);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const d = g.getImageData(0, 0, W, W);
  for (let i = 0; i < d.data.length; i += 4) {           // ruido de sensor
    const n = (Math.random() - 0.5) * 40;
    d.data[i] = Math.max(0, Math.min(255, d.data[i] + n));
    d.data[i + 1] = d.data[i]; d.data[i + 2] = d.data[i];
  }
  const r = ptQrLeer(d.data, W, W);
  return !!(r && r.length === 160 && Array.from(r).every((b, i) => b === p[i]));
});
log(c4, '[C4] El QR se lee de una foto en ángulo y con ruido');

// [C5] Y no inventa: ruido puro no produce ninguna lectura.
const c5 = await page.evaluate(() => {
  let falsos = 0;
  for (let t = 0; t < 25; t++) {
    const W = 260, d = new Uint8ClampedArray(W * W * 4);
    for (let i = 0; i < W * W; i++) { const g = (Math.random() * 256) | 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; }
    if (ptQrLeer(d, W, W)) falsos++;
  }
  return falsos;
});
log(c5 === 0, '[C5] Sobre ruido puro no inventa ninguna lectura', c5 + ' falsos de 25');

// ── El emparejamiento completo, con el QR de por medio ──────────────────────
// A prepara un caso real y lo mete en una sesión compartida.
const casoId = await page.evaluate(async () => {
  const c = SIM.genFlagrancia(); c.id = 'pt3-' + Date.now();
  c.victimas = [];                       // la víctima la va a registrar el compañero
  await DB.saveCase(c);
  ptCompartir(DB.getCase(c.id));
  await DB.saveCases(DB.getCases());
  return c.id;
});

// A produce la invitación y la pinta; B la «fotografía» y responde.
const par = await emparejar(casoId);
log(par.paso1.ok, '[C6] El compañero lee la invitación de la pantalla y responde', par.paso1.motivo || '');
log(par.ok, '[C7] Escaneada la respuesta, el canal queda abierto entre los dos equipos', par.motivo || '');

await pageB.waitForTimeout(900);

// [C8] El compañero recibe el caso entero, que no tenía.
const c8 = await pageB.evaluate((id) => {
  const c = DB.getCase(id);
  return { tiene: !!c, nom: c && c.capturados && c.capturados[0] ? c.capturados[0].priNom : null };
}, casoId);
log(c8.tiene, '[C8] El compañero recibe el caso completo, que no tenía', c8.nom || '');

// [C9] EL REPARTO REAL DE LA PATRULLA: cada uno escribe en lo suyo, a la vez.
await page.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.capturados[0].senasPart = 'CICATRIZ EN EL POMULO IZQUIERDO';
  await DB.saveCase(c);
}, casoId);
await pageB.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.victimas = [{ id: 'vic-b', priNom: 'LUZ', priApe: 'MARIN', tel: '3115557788' }];
  await DB.saveCase(c);
}, casoId);
await page.waitForTimeout(1400); await pageB.waitForTimeout(1400);

const cA = await page.evaluate((id) => { const c = DB.getCase(id);
  return { senas: c.capturados[0].senasPart, vic: (c.victimas || []).map(v => v.priNom + '/' + (v.tel || '')) }; }, casoId);
const cB = await pageB.evaluate((id) => { const c = DB.getCase(id);
  return { senas: c.capturados[0].senasPart, vic: (c.victimas || []).map(v => v.priNom + '/' + (v.tel || '')) }; }, casoId);
log(cA.senas === 'CICATRIZ EN EL POMULO IZQUIERDO' && cA.vic.join() === 'LUZ/3115557788',
  '[C9] El equipo que capturó tiene también la víctima que registró el compañero', JSON.stringify(cA));
log(cB.senas === 'CICATRIZ EN EL POMULO IZQUIERDO' && cB.vic.join() === 'LUZ/3115557788',
  '[C10] Y el compañero tiene las señas que registró el otro', JSON.stringify(cB));

// [C11] Las dos réplicas convergen — misma huella, no solo el mismo aspecto.
const hA = await page.evaluate((id) => ptHuella(DB.getCase(id)), casoId);
const hB = await pageB.evaluate((id) => ptHuella(DB.getCase(id)), casoId);
log(hA === hB, '[C11] Las dos réplicas convergen al mismo contenido');

// [C12] Entregado y confirmado, la cola queda vacía en los dos.
const qA = await page.evaluate((id) => ptPendientes(id), casoId);
const qB = await pageB.evaluate((id) => ptPendientes(id), casoId);
log(qA === 0 && qB === 0, '[C12] Confirmada la entrega, no queda nada pendiente', 'A=' + qA + ' B=' + qB);

// [C13] LA FIRMA MANUSCRITA NO VIAJA. Es un rasgo biométrico y con ella se
//       suscriben documentos judiciales: que llegue al otro equipo permitiría
//       firmar un oficio en nombre de quien no lo firmó.
const c13 = await page.evaluate((id) => {
  const c = DB.getCase(id), s = JSON.stringify(c);
  return { enCaso: /data:image\/png|_firma|firmaPng/.test(s), claveAparte: !!localStorage.getItem('lc_firmas') !== null };
}, casoId);
const c13b = await pageB.evaluate(() => localStorage.getItem('lc_firmas'));
log(!c13.enCaso && !c13b, '[C13] La firma manuscrita no viaja: no está en el caso ni llegó al compañero');

// [C14] Una invitación caducada no abre nada.
const c14 = await pageB.evaluate(async () => {
  const sid = new Uint8Array([1, 2, 3, 4]), clave = new Uint8Array(32);
  const falsa = ptInvitacionBytes(sid, Date.now() - PT_INVIT_MS - 60000, clave,
    { ufrag: 'abcd', pwd: 'x'.repeat(24), fp: new Array(32).fill('AA').join(':'), cands: [] });
  const r = await ptResponderInvitacion(falsa, null);
  return r;
});
log(!c14.ok && /caduc/.test(c14.motivo || ''), '[C14] Una invitación caducada se rechaza', c14.motivo);

// [C15] Y una respuesta que no salió de ESTA invitación, tampoco.
const c15 = await page.evaluate(async () => {
  const otra = new Uint8Array(32); crypto.getRandomValues(otra);
  const claveAjena = await ptSubclave(otra, 1);
  const bytes = await ptRespuestaBytes(_ptSid, Date.now(), claveAjena,
    { ufrag: 'zzzz', pwd: 'y'.repeat(24), fp: new Array(32).fill('BB').join(':'), cands: [] });
  /* ⚠️ Se levanta la guarda de «una invitación, una respuesta» para que lo que
     rechace aquí sea LA CLAVE y no esa otra regla: si no, este check pasaría por
     el motivo equivocado y dejaría de comprobar lo que dice. */
  const g = _ptEmparejado; _ptEmparejado = false;
  const r = await ptAceptarRespuesta(bytes);
  _ptEmparejado = g;
  return r;
});
log(!c15.ok && /no coincide/.test(c15.motivo || ''),
  '[C15] Una respuesta que no salió de esta invitación se rechaza', c15.motivo);

// [C16] Un mensaje cifrado con otra clave se descarta sin tocar nada.
const c16 = await page.evaluate(async (id) => {
  const antes = ptHuella(DB.getCase(id));
  const otra = new Uint8Array(32); crypto.getRandomValues(otra);
  const clave = await ptSubclave(otra, 2);
  const payload = await ptCifrar(clave, new TextEncoder().encode(JSON.stringify(
    { t: 'ops', caso: id, ops: [{ r: 'lugar/muni', v: 'INTRUSO', s: ptSello() }] })));
  await _ptRecibir(payload.buffer);
  await new Promise(r => setTimeout(r, 200));
  return { igual: ptHuella(DB.getCase(id)) === antes, muni: DB.getCase(id).lugar.muni };
}, casoId);
log(c16.igual && c16.muni !== 'INTRUSO', '[C16] Un mensaje cifrado con otra clave se descarta sin tocar el caso');

// [C17] UNA invitación, UNA respuesta. Con el canal ya abierto un segundo código
//       no entra: es lo que cierra la puerta a un tercer equipo que alcanzara a
//       fotografiar la pantalla. ⚠️ Va DESPUÉS de [C15] a propósito: puesto antes,
//       aquel pasaría por este motivo y dejaría de comprobar lo que dice.
const c17 = await page.evaluate(async () => {
  const otra = new Uint8Array(32); crypto.getRandomValues(otra);
  const bytes = await ptRespuestaBytes(_ptSid || new Uint8Array([9, 9, 9, 9]), Date.now(),
    await ptSubclave(otra, 1),
    { ufrag: 'qqqq', pwd: 'z'.repeat(24), fp: new Array(32).fill('CC').join(':'), cands: [] });
  const r = await ptAceptarRespuesta(bytes);
  return { r, sigueAbierto: ptEstado().activa };
});
log(!c17.r.ok && /ya se usó/.test(c17.r.motivo || '') && c17.sigueAbierto,
  '[C17] Con el canal abierto, una segunda respuesta se rechaza', c17.r.motivo);

// [C18] Una sesión que lleva medio día parada se cierra sola al ir a mandar algo.
//       ⚠️ Lo pendiente NO se pierde: queda en la cola, que es donde tiene que
//       estar hasta que el compañero vuelva a aparecer.
const c18 = await page.evaluate(async (id) => {
  _ptSesion.desde = _ptSesion.visto = Date.now() - PT_SESION_MS - 60000;
  const c = DB.getCase(id);
  c.narracion = c.narracion || {}; c.narracion.observ = 'SESION VIEJA';
  await DB.saveCase(c);
  return { activa: ptEstado().activa, pendientes: ptPendientes(id),
           guardado: DB.getCase(id).narracion.observ };
}, casoId);
log(!c18.activa && c18.pendientes > 0 && c18.guardado === 'SESION VIEJA',
  '[C18] Una sesión caducada cierra el canal y deja lo pendiente en la cola',
  c18.pendientes + ' pendientes');

// [C19] Desvincular cierra el CANAL, no el procedimiento.
const c19 = await page.evaluate((id) => {
  ptCerrarCanal();
  const c = DB.getCase(id);
  return { canal: ptEstado().activa, caso: !!c, marcas: !!(c && c._m && Object.keys(c._m).length) };
}, casoId);
log(!c19.canal && c19.caso && c19.marcas,
  '[C19] Desvincular cierra el canal y deja el caso y su historial intactos');

// [C20] Sin canal se sigue trabajando y la cola crece: la desconexión es el
//       estado normal en campo, no un fallo.
const c20 = await page.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.narracion = c.narracion || {}; c.narracion.barrio = 'SIN CANAL';
  await DB.saveCase(c);
  return { pendientes: ptPendientes(id), guardado: DB.getCase(id).narracion.barrio };
}, casoId);
log(c20.pendientes > 0 && c20.guardado === 'SIN CANAL',
  '[C20] Sin canal se sigue trabajando y lo escrito queda en cola', c20.pendientes + ' pendientes');

// [C21] Ni un servidor: la conexión se establece sin STUN, TURN ni señalización.
const bloque3 = src.slice(src.indexOf('MODO PATRULLA · FASE 3'));
log(/iceServers:\s*\[\]/.test(bloque3) && !/stun:|turn:|fetch\(|XMLHttpRequest|WebSocket/.test(bloque3),
  '[C21] El canal no usa ningún servidor: ni STUN, ni TURN, ni señalización');

/* ⚠️ El segundo equipo NO se cierra aquí: las secciones D y E lo siguen
   necesitando — la reconciliación de la fase 5 es entre dos réplicas de verdad. */

/* ══════════════════════════════════════════════════════════════════════════
   D · FASE 4 — LA INTERFAZ
   ══════════════════════════════════════════════════════════════════════════ */

// [D1] La pantalla existe, está en la navegación Y SE VE.
//      ⚠️ Lo último no es una obviedad: la primera versión quedó fuera de
//      `<main>` —el contenedor de las pantallas— y salía COMPLETAMENTE EN BLANCO,
//      mientras el resto de estos checks seguían en verde porque medían el
//      contenido en el DOM, no que llegara a dibujarse. Se encontró mirando una
//      captura de pantalla, no probando; por eso ahora se mide el rectángulo.
const d1 = await page.evaluate(() => {
  ptAbrirPatrulla(null);
  const s = document.getElementById('screen-patrulla');
  const r = s.getBoundingClientRect(), p = document.getElementById('pt-pane').getBoundingClientRect();
  return { enNav: screens.indexOf('patrulla') >= 0,
           activa: s.classList.contains('on'),
           dentro: !!s.closest('#main'),
           alto: Math.round(r.height), altoPane: Math.round(p.height),
           hash: location.hash };
});
log(d1.enNav && d1.activa && d1.dentro && d1.alto > 200 && d1.altoPane > 100,
  '[D1] La pantalla existe, es un destino de la aplicación y SE DIBUJA',
  d1.hash + ' · ' + d1.alto + 'px (contenido ' + d1.altoPane + 'px)' + (d1.dentro ? '' : ' · FUERA de #main'));

// [D2] Sin caso solo se puede UNIRSE; con caso, además, invitar.
//      ⚠️ Sin la puerta general el compañero no tendría por dónde empezar: no
//      puede abrir el menú de un caso que todavía no está en su teléfono.
const d2 = await page.evaluate((id) => {
  /* Sin sesión de verdad: con una viva la pantalla enseña SU caso —que es lo
     correcto— y entonces este check dejaría de medir lo que dice. */
  ptCerrarCanal(); _ptSesion = null;
  ptAbrirPatrulla(null);
  const sin = document.querySelectorAll('#pt-pane .pt-op').length;
  ptAbrirPatrulla(id);
  const con = document.querySelectorAll('#pt-pane .pt-op').length;
  return { sin, con, sub: document.getElementById('pt-sub').textContent };
}, casoId);
log(d2.sin === 1 && d2.con === 2, '[D2] Sin captura solo se ofrece unirse; con captura, también invitar',
  d2.sin + ' / ' + d2.con);

// [D3] Invitar pinta el código de verdad y dice cuánto le queda.
//      ⚠️ Una invitación caduca a los 3 minutos: sin decirlo, el compañero se
//      encontraría un «caducó» que parece un fallo de la aplicación.
const d3 = await page.evaluate(async (id) => {
  ptAbrirPatrulla(id);
  await ptUiInvitar();
  const svg = document.querySelector('#pt-pane .pt-qr svg');
  const bytes = _ptUiBytes;
  const leido = svg ? null : null;
  return { paso: _ptUiPaso, hayQr: !!svg,
           cuenta: (document.getElementById('pt-cuenta') || {}).textContent || '',
           bytes: bytes ? bytes.length : 0 };
}, casoId);
log(d3.paso === 'invitando' && d3.hayQr && /Caduca en \d+:\d\d/.test(d3.cuenta),
  '[D3] Invitar pinta el código y anuncia su caducidad', d3.cuenta);

// [D4] El código que se enseña ES legible: se vuelve a leer de la propia pantalla.
const d4 = await page.evaluate(async () => {
  const svg = document.querySelector('#pt-pane .pt-qr').innerHTML;
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
  const W = 420, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.drawImage(img, 50, 50, 320, 320);
  const leido = ptQrLeer(g.getImageData(0, 0, W, W).data, W, W);
  return !!(leido && _ptUiBytes && leido.length === _ptUiBytes.length &&
            Array.from(leido).every((b, i) => b === _ptUiBytes[i]));
});
log(d4, '[D4] El código que se muestra en pantalla se vuelve a leer entero');

// [D5] El menú de la captura gana la entrada y NO se desplaza.
//      ⚠️ Es un VERBO, no un documento: los formatos siguen todos en el
//      expediente, así que el menú no vuelve a crecer uno por formato.
const d5 = await page.evaluate((id) => {
  openCaseSheet(id);
  const items = Array.from(document.querySelectorAll('#act-items .ti')).map(e => e.textContent);
  const alto = document.getElementById('act-sheet').getBoundingClientRect().height;
  closeActionSheet();
  return { items, alto: Math.round(alto), presupuesto: Math.round(window.innerHeight * 0.8) };
}, casoId);
log(d5.items.length === 5 && d5.items.some(t => /compañero/i.test(t)) && d5.alto <= d5.presupuesto,
  '[D5] El menú suma la entrada y sigue sin desplazarse',
  d5.items.length + ' ítems · ' + d5.alto + ' px de ' + d5.presupuesto);

// [D6] NI UNA PALABRA TÉCNICA en la pantalla. El funcionario ve «el compañero» y
//      «el código», no una IP ni un canal.
const d6 = await page.evaluate((id) => {
  const malas = /\b(IP|puerto|socket|host|WebRTC|DataChannel|SDP|ICE|API|servidor|base de datos|token|payload|sesión|canal)\b/i;
  const sitios = [];
  ptAbrirPatrulla(id);
  sitios.push(document.getElementById('screen-patrulla').innerText);
  _ptUiPaso = 'invitando'; renderPatrulla(); sitios.push(document.getElementById('pt-pane').innerText);
  _ptUiPaso = 'inicio'; renderPatrulla();
  const enc = sitios.map(t => (t.match(malas) || [null])[0]).filter(Boolean);
  return enc;
}, casoId);
log(d6.length === 0, '[D6] La pantalla no usa una sola palabra técnica', d6.join(', '));

// [D7] Sistema visual: sin emojis y sin colores literales salvo las dos
//      excepciones que existen por una razón medida (el código y el visor de la
//      cámara necesitan blanco y negro fijos, pase lo que pase con el tema).
const bloqueCss = src.slice(src.indexOf('/* ═══ MODO PATRULLA (Fase 4) ═══'), src.indexOf('/* ═══ BANNER MODO INVITADO ═══'));
/* ⚠️ Los colores se miran en el CSS SIN sus comentarios, y los emojis en la
   pantalla YA PINTADA: el «⚠️» con el que este proyecto marca sus avisos vive en
   los comentarios de todo el archivo, y buscarlo ahí daría un fallo por el
   estilo de la casa en vez de por un emoji en la interfaz. */
const cssSinComentarios = bloqueCss.replace(/\/\*[\s\S]*?\*\//g, '');
const literales = (cssSinComentarios.match(/#[0-9a-fA-F]{3,6}\b/g) || []);
const emojis = await page.evaluate((id) => {
  ptAbrirPatrulla(id);
  const t = document.getElementById('screen-patrulla').innerText;
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t);
}, casoId);
/* ⚠️ Los únicos literales admitidos son blanco y negro PUROS, y los dos tienen
   motivo medido: un código se lee por contraste (en tema oscuro, uno claro sobre
   fondo oscuro no lo lee ninguna cámara) y el visor de la cámara es negro con
   texto blanco, igual que el que ya existe para las fotos de cédula. Cualquier
   otro tono sería un color propio fuera del sistema. */
log(literales.length > 0 && literales.every(c => /^#(fff|000|ffffff|000000)$/i.test(c)) && !emojis,
  '[D7] El bloque visual usa tokens: sin emojis y sin ningún color propio',
  'solo blanco y negro (' + literales.length + ')');

// [D8] La franja dice lo que pasa, y solo aparece cuando hay algo que decir.
const d8 = await page.evaluate(() => {
  ptCerrarCanal(); ptVaciarCola();
  ptBarra();
  const oculta = !document.getElementById('pt-barra').classList.contains('on');
  _ptCola['x'] = [{ r: 'a', v: 1 }];
  ptBarra();
  const b = document.getElementById('pt-barra');
  const txt = b.querySelector('.pb-txt').innerText;
  const pend = b.classList.contains('pend');
  const pad = getComputedStyle(document.body).paddingTop;
  ptVaciarCola(); ptBarra();
  return { oculta, visible: !!txt, txt, pend, pad };
});
log(d8.oculta && d8.visible && d8.pend && /sin entregar/i.test(d8.txt),
  '[D8] La franja aparece solo cuando hay algo que decir, y lo dice', d8.txt);

// [D9] En los dos temas.
const d9 = await page.evaluate((id) => {
  const medir = () => {
    ptAbrirPatrulla(id);
    const op = document.querySelector('#pt-pane .pt-op');
    const cs = getComputedStyle(op);
    return cs.color + ' sobre ' + cs.backgroundColor;
  };
  setTheme('dark'); const osc = medir();
  setTheme('light'); const cla = medir();
  setTheme('dark');
  return { osc, cla };
}, casoId);
log(d9.osc !== d9.cla && !/rgba\(0, 0, 0, 0\)/.test(d9.osc),
  '[D9] La pantalla responde a los dos temas', d9.osc + ' | ' + d9.cla);

// [D10] El idioma: español de COLOMBIA y párrafos cortos.
//       ⚠️ Un «podéis» o un «os conectáis» es español peninsular y hace que la
//       aplicación suene ajena a quien la usa; y ningún párrafo pasa de 110
//       caracteres, que es el límite que fijó la Mejora 6 para que los avisos se
//       sigan leyendo.
const d10 = await page.evaluate((id) => {
  const peninsular = /\b(pod[ée]is|ten[ée]is|deb[ée]is|qued[áa]is|os\s+conect|vosotros|quer[áa]is|conectaros)\b/i;
  const largos = [], malas = [];
  const mirar = () => {
    document.querySelectorAll('#screen-patrulla p, #screen-patrulla .de, #screen-patrulla .pe-de')
      .forEach(e => {
        const t = e.textContent.trim();
        if (t.length > 110) largos.push(t.slice(0, 60) + '…(' + t.length + ')');
        const m = t.match(peninsular); if (m) malas.push(m[0]);
      });
  };
  ptAbrirPatrulla(id); mirar();
  _ptUiPaso = 'invitando'; renderPatrulla(); mirar();
  _ptUiPaso = 'respondiendo'; renderPatrulla(); mirar();
  _ptUiPaso = 'inicio'; renderPatrulla();
  return { largos, malas };
}, casoId);
log(d10.largos.length === 0 && d10.malas.length === 0,
  '[D10] Español de Colombia y ningún párrafo de más de 110 caracteres',
  (d10.malas.join(', ') + ' ' + d10.largos.join(' | ')).trim() || 'limpio');

/* ══════════════════════════════════════════════════════════════════════════
   E · FASE 5 — RECUPERACIÓN Y REANUDACIÓN
   ══════════════════════════════════════════════════════════════════════════ */

// [E1] El estado sellado incluye los BORRADOS. ⚠️ Sin ellos, el compañero
//      devolvería el dato que este acaba de retirar y la persona borrada
//      reaparecería en el informe.
const e1 = await page.evaluate((id) => {
  const c = DB.getCase(id);
  const antes = ptEstadoSellado(c).length;
  const v = (c.victimas || [])[0];
  if (!v) return { ok: false, motivo: 'sin víctima' };
  c.victimas = [];
  DB.saveCase(c);
  const ops = ptEstadoSellado(DB.getCase(id));
  const borrados = ops.filter(o => o.x && o.r.indexOf('victimas/') === 0);
  return { ok: borrados.length > 0, borrados: borrados.length, antes, ahora: ops.length };
}, casoId);
log(e1.ok, '[E1] El estado sellado lleva también lo que se borró', e1.borrados + ' borrados');

// [E2] EL CASO QUE JUSTIFICA LA FASE: cada uno trabaja por su lado, sin cola y
//      sin canal —una tarde entera separados—, y al volver a juntarse ninguno
//      pierde nada.
await page.evaluate(() => { ptCerrarCanal(); ptVaciarCola(); });
await pageB.evaluate(() => { ptCerrarCanal(); ptVaciarCola(); });
await page.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.lugar = c.lugar || {}; c.lugar.barrio = 'BARRIO DE A';
  await DB.saveCase(c);
  ptVaciarCola();                       // como si la cola se hubiera perdido
}, casoId);
await pageB.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.narracion = c.narracion || {}; c.narracion.texto = 'RELATO DE B';
  await DB.saveCase(c);
  ptVaciarCola();
}, casoId);
const preA = await page.evaluate((id) => ptHuella(DB.getCase(id)), casoId);
const preB = await pageB.evaluate((id) => ptHuella(DB.getCase(id)), casoId);
log(preA !== preB, '[E2] Trabajando por separado las dos copias divergen', 'huellas distintas');

await emparejar(casoId);
await page.waitForTimeout(1600); await pageB.waitForTimeout(1600);

const e3A = await page.evaluate((id) => { const c = DB.getCase(id);
  return { b: (c.lugar || {}).barrio, t: (c.narracion || {}).texto, h: ptHuella(c) }; }, casoId);
const e3B = await pageB.evaluate((id) => { const c = DB.getCase(id);
  return { b: (c.lugar || {}).barrio, t: (c.narracion || {}).texto, h: ptHuella(c) }; }, casoId);
log(e3A.b === 'BARRIO DE A' && e3A.t === 'RELATO DE B', '[E3] Al reconectar, el que invitó tiene lo del compañero', JSON.stringify(e3A).slice(0, 80));
log(e3B.b === 'BARRIO DE A' && e3B.t === 'RELATO DE B', '[E4] Y el compañero tiene lo del que invitó', JSON.stringify(e3B).slice(0, 80));
log(e3A.h === e3B.h, '[E5] Las dos copias vuelven a converger sin que quedara nada en cola');

// [E6] Y el borrado de [E1] NO reapareció: es lo que se pierde si el estado
//      sellado no lleva las bajas.
const e6 = await page.evaluate((id) => (DB.getCase(id).victimas || []).length, casoId);
const e6b = await pageB.evaluate((id) => (DB.getCase(id).victimas || []).length, casoId);
log(e6 === 0 && e6b === 0, '[E6] Lo que se borró no reaparece al reconciliar', 'A=' + e6 + ' B=' + e6b);

// [E7] El intercambio se acota a una vuelta por lado: sin el eco, dos réplicas
//      que no llegaran a converger se estarían mandando su estado sin parar.
const e7 = await page.evaluate(() => {
  const src = ptRecibirEstado.toString();
  return /m\.eco/.test(src) && /eco:\s*1/.test(src);
});
log(e7, '[E7] La reconciliación está acotada a una vuelta por lado');

// [E8] REANUDACIÓN: lo que quedó sin entregar sobrevive a cerrar la aplicación y
//      se ANUNCIA al volver a abrirla.
await page.evaluate(async (id) => {
  const c = DB.getCase(id);
  c.lugar = c.lugar || {};
  c.lugar.caracteristicas = 'PENDIENTE DE ENTREGAR';
  await DB.saveCase(c);
  ptCerrarCanal();
}, casoId);
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
await page.fill('#pin-e', '1234'); await page.click('button[onclick="doUnlockPin()"]');
await page.waitForTimeout(900);
const e8 = await page.evaluate(() => {
  const b = document.getElementById('pt-barra');
  return { visible: b.classList.contains('on'), txt: b.querySelector('.pb-txt').innerText,
           pend: ptResumen().pendientes, caso: ptResumen().casoId };
});
log(e8.visible && e8.pend > 0 && /sin entregar/i.test(e8.txt),
  '[E8] Tras cerrar y abrir la aplicación, lo pendiente sigue ahí y se anuncia', e8.txt);

await ctxB.close();

// [45] consola limpia — al final, para que cubra todo lo anterior
log(errs.length===0, '[45] Sin errores de consola', errs.slice(0,3).join(' | '));

const ok=R.filter(Boolean).length;
console.log('\n── '+ok+'/'+R.length+' comprobaciones ──');
await browser.close(); server.close();
process.exit(ok===R.length?0:1);
