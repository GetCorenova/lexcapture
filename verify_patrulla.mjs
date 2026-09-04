// MODO PATRULLA · FASE 1 — identidad del equipo, reloj logico y registro de cambios.
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
const fuera=(src.split('MODO PATRULLA')[0].match(/\bptLimpioJSON\(/g)||[]).length;
log(fuera===2, '[26] Fuera del módulo solo se toca la huella del formulario', fuera+' usos, '+usos+' en total');

// [27] el modulo no toca ningun motor documental
const tocaDocs=/\bpt[A-Z]\w*/.test(src.slice(src.indexOf('function buildFPJBlob'), src.indexOf('function buildFPJBlob')+40000));
log(!tocaDocs, '[27] Ningún motor documental sabe que esta capa existe');

// [28] consola limpia
log(errs.length===0, '[28] Sin errores de consola', errs.slice(0,3).join(' | '));

const ok=R.filter(Boolean).length;
console.log('\n── '+ok+'/'+R.length+' comprobaciones ──');
await browser.close(); server.close();
process.exit(ok===R.length?0:1);
