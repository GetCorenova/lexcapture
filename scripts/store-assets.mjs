/* Recursos graficos de la ficha de Play Store: capturas del telefono y
   grafico de funciones 1024x500.
   Se regeneran cuando la interfaz cambia — una ficha que ensena una app que ya
   no existe es motivo de rechazo, y las de julio mostraban hasta un error en rojo.
   Los datos son del SIMULADOR: inventados, con correos en el dominio reservado
   .test. NUNCA subir capturas de un procedimiento real (Ley 1581 de 2012).
   Uso:  node scripts/store-assets.mjs            */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const ROOT='d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const OUT='d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/lexcapture-android/store';
mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.js':'text/javascript'};
const server=createServer((q,r)=>{const p=join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')||'LexCapture_v8.html');
 if(!existsSync(p)){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});r.end(readFileSync(p));});
await new Promise(r=>server.listen(8097,r));
const b=await chromium.launch({headless:true});
const page=await (await b.newContext({viewport:{width:360,height:800},deviceScaleFactor:3,hasTouch:true,isMobile:true})).newPage();
const errs=[]; page.on('console',m=>m.type()==='error'&&errs.push(m.text())); page.on('pageerror',e=>errs.push('PE:'+e.message));
await page.goto('http://localhost:8097/LexCapture_v8.html',{waitUntil:'load'});
await page.evaluate(()=>localStorage.clear()); await page.reload({waitUntil:'load'}); await page.waitForTimeout(500);
await page.fill('#pin-a','2580'); await page.fill('#pin-b','2580');
await page.click('button[onclick="doSetPin()"]'); await page.waitForTimeout(900);

// Perfil + unidad, para que las pantallas no salgan vacias
await page.evaluate(async ()=>{
  const cfg=DB.getConfig();
  cfg.perfiles=[{id:uid(),grado:'Subintendente',nom:'Nelson David Ramírez',cedula:'1017245896',cargo:'Investigador',
    tel:'3001234567',correo:'ndr@unidad.test',entidad:'Policía Judicial (DEMO)',activo:true,
    companero:{grado:'Patrullero',nom:'Luz Marín Ospina',cedula:'1098776554',cargo:'Patrullero'}}];
  cfg.nombreEstacion='CANDELARIA'; cfg.ojCustCiudad='Medellín'; cfg.patrullaNum='32'; cfg.patrullaUnidad='CAI Parque Bolívar';
  await DB.saveConfig(cfg);
  const tp=['flagrancia-uri','flagrancia-uri','flagrancia-cespa','flagrancia-uri'];for(const t of tp){ const c=SIM.genFlagrancia(t); c.isTest=false; await DB.saveCase(c); }
  const o=SIM.genOJ(); o.isTest=false; await DB.saveCase(o);
  const PZ=[['Yeison Felipe','Betancur','Flores','CC','1017245896','Capturado','Medellín'],
    ['María Estiven','Ramírez','Cardona','TI','1098776554','Aprehendido','Bello'],
    ['Laura Daniela','González','Mesa','CC','43987112','Víctima','Envigado'],
    ['Jhon Alexander','Arias','Zapata','CC','71234567','Capturado','Itagüí'],
    ['Sandra Milena','Ospina','Duque','CC','32456789','Testigo','Medellín'],
    ['Carlos Andrés','Moreno','Romero','CC','8412553','Víctima','Sabaneta']];
  for(const [pn,pa,sa,td,nd,rol,exp] of PZ){
    DB.savePerson({id:uid(),priNom:pn.split(' ')[0],segNom:pn.split(' ')[1]||'',priApe:pa,segApe:sa,
      tipoDoc:td,numDoc:nd,rol:rol,expEn:exp,tel:'30'+Math.floor(10000000+Math.random()*89999999)});
  }
});
await page.waitForTimeout(600);

const tiro=async(n,fn)=>{ await fn(); await page.waitForTimeout(700); await page.evaluate(()=>{const t=document.getElementById('toast'); if(t){t.className='toast'; t.style.display='none';}}); await page.waitForTimeout(150); await page.screenshot({path:join(OUT,n+'.png')}); console.log('· '+n); };
await tiro('01_capturas', ()=>page.evaluate(()=>go('capturas')));
await tiro('02_expediente', ()=>page.evaluate(()=>{const c=DB.getCases()[0]; abrirDossierCaso(c.id);}));
await tiro('03_personas', ()=>page.evaluate(()=>go('personas')));
await tiro('04_estadisticas', ()=>page.evaluate(()=>go('estadisticas')));
await tiro('06_wizard', ()=>page.evaluate(()=>{const c=DB.getCases()[1]; editCase(c.id);}));
console.log('errores:',errs.length, errs.slice(0,4));
await b.close(); server.close();
