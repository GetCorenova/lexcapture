// Techo de almacenamiento: el cifrado por trozos, la compatibilidad con lo ya
// guardado y la reversion de la cache cuando una escritura falla.
// Antes de este arreglo la app dejaba de guardar entre la captura 23 y la 27, y
// la tarjeta se quedaba en la lista sin haber llegado nunca al disco.
import { chromium } from 'playwright';
import { createServer } from 'http'; import { readFileSync, existsSync } from 'fs'; import { join, extname } from 'path';
const ROOT='d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME={'.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.js':'text/javascript'};
const server=createServer((q,s)=>{const p=join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')||'LexCapture_v8.html');
if(!existsSync(p)){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});s.end(readFileSync(p));});
await new Promise(r=>server.listen(8120,r));
const R=[]; const log=(ok,l,x)=>{R.push(ok);console.log(ok?'OK  ':'FAIL',l,x??'');};
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:384,height:800}});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await page.goto('http://localhost:8120/LexCapture_v8.html',{waitUntil:'load'});
await page.evaluate(()=>localStorage.clear()); await page.reload({waitUntil:'load'}); await page.waitForTimeout(400);
await page.fill('#pin-a','135790'); await page.fill('#pin-b','135790');
await page.click('button[onclick="doSetPin()"]'); await page.waitForTimeout(800);

log(await page.evaluate(()=>!!_sessionKey), '[1] El PIN se configura y hay sesión activa');

// [2] el idiom peligroso ya no existe en el archivo
const src = readFileSync(join(ROOT,'LexCapture_v8.html'),'utf8');
log(!/String\.fromCharCode\(\.\.\./.test(src), '[2] Ni un solo String.fromCharCode(...) con propagación en el archivo');

// [3] cifrado de carga grande
const t3=await page.evaluate(async()=>{ try{ const c=await _lcEncrypt('x'.repeat(3000000)); return {ok:true,len:c.length}; }catch(e){ return {ok:false,e:String(e).slice(0,50)}; } });
log(t3.ok, '[3] Cifra 3 MB sin RangeError', t3.ok?('base64 '+t3.len+' car.'):t3.e);

// [4] ida y vuelta con multibyte
const t4=await page.evaluate(async()=>{ const t='ñÁ€ '.repeat(300000); return (await _lcDecrypt(await _lcEncrypt(t)))===t; });
log(t4, '[4] Ida y vuelta exacta con 1,2 M de caracteres multibyte');

// [5] COMPATIBILIDAD: descifra lo que produjo la versión ANTERIOR
const t5=await page.evaluate(async()=>{
  const txt='captura guardada por el build anterior — ñ á €';
  // reproducción literal del _lcEncrypt viejo
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},_sessionKey,new TextEncoder().encode(txt));
  const buf=new Uint8Array(12+enc.byteLength); buf.set(iv); buf.set(new Uint8Array(enc),12);
  const viejo=btoa(String.fromCharCode(...buf));
  return (await _lcDecrypt(viejo))===txt;
});
log(t5, '[5] Descifra lo cifrado por el código anterior — nada que migrar');

// [6] formato idéntico: mismo tamaño de salida para la misma entrada
const t6=await page.evaluate(async()=>{
  const txt='x'.repeat(5000);
  const nuevo=await _lcEncrypt(txt);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},_sessionKey,new TextEncoder().encode(txt));
  const buf=new Uint8Array(12+enc.byteLength); buf.set(iv); buf.set(new Uint8Array(enc),12);
  return nuevo.length===btoa(String.fromCharCode(...buf)).length;
});
log(t6, '[6] Produce exactamente el mismo formato que antes');

// [7] capacidad real de capturas
const t7=await page.evaluate(async()=>{
  const base=SIM.genFlagrancia('URI'); const arr=[]; let ok=0;
  for(let i=0;i<200;i++){ const c=JSON.parse(JSON.stringify(base)); c.id='c'+i; arr.push(c);
    try{ await DB.saveCases(arr.slice()); ok=i+1; }catch(e){ break; } }
  return {ok, bytes:(localStorage.getItem('lc_cases')||'').length};
});
log(t7.ok>=200, '[7] Guarda 200 capturas (antes fallaba entre la 23 y la 27)', t7.ok+' · '+(t7.bytes/1024|0)+' KB en disco');

// [8] sobreviven a recargar
await page.reload({waitUntil:'load'}); await page.waitForTimeout(500);
await page.fill('#pin-e','135790'); await page.click('button[onclick="doUnlockPin()"]'); await page.waitForTimeout(1400);
log(await page.evaluate(()=>DB.getCases().length)===200, '[8] Las 200 se releen tras recargar y desbloquear');

// [9] REVERSIÓN DE CACHÉ: una escritura que falla no deja la captura en la lista
const t9=await page.evaluate(async()=>{
  const antes=DB.getCases().length;
  const real=window._lcEncSave;
  window._lcEncSave=function(){ return Promise.reject(new Error('QuotaExceededError: simulado')); };
  const c=SIM.genFlagrancia('URI'); c.id='FANTASMA';
  let lanzo=false; try{ await DB.saveCase(c); }catch(e){ lanzo=true; }
  window._lcEncSave=real;
  go('capturas');
  return {lanzo, enLista:!!DB.getCase('FANTASMA'), total:DB.getCases().length, antes};
});
log(t9.lanzo && !t9.enLista && t9.total===t9.antes,
    '[9] Escritura fallida: avisa y NO deja la captura fantasma en la lista', JSON.stringify(t9));

// [10] el aviso nombra la causa correcta
const t10=await page.evaluate(()=>({
  cuota: _lcMsgGuardado({name:'QuotaExceededError'},'la captura'),
  sesion: _lcMsgGuardado(new Error('Sin sesión activa — no se guardó'),'la captura')
}));
log(/memoria del equipo está llena/.test(t10.cuota) && /sesión se cerró/.test(t10.sesion) && !/PIN pudo bloquearse/.test(t10.cuota),
    '[10] El aviso nombra la causa real, ya no culpa siempre al PIN');
console.log('     cuota  →', t10.cuota);
console.log('     sesión →', t10.sesion);

// [11] modo invitado sigue sin escribir un byte
const t11=await page.evaluate(async()=>{
  const huella=()=>Object.keys(localStorage).map(k=>k+':'+localStorage.getItem(k).length).sort().join('|');
  const a=huella(); _guest=true;
  try{ const c=SIM.genFlagrancia('URI'); c.id='INV'; await DB.saveCase(c); }catch(e){}
  const b=huella(); _guest=false;
  return a===b;
});
log(t11, '[11] En modo invitado no se escribe un solo byte en el equipo');

log(errs.length===0, '[12] Consola sin errores', errs.length?errs.slice(0,3):'');
console.log('\n'+R.filter(Boolean).length+'/'+R.length+' comprobaciones');
await browser.close(); server.close();
process.exit(R.every(Boolean)?0:1);
