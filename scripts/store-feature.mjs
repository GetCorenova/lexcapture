/* Grafico de funciones 1024x500 para Play Store.
   Identidad del icono: monograma F ambar en marco de visor cian.
   NADA de escudos ni nombres de institucion — filtro de Play Store.

   ⚠️ El icono NO se vuelve a dibujar aqui: se lee de icon.svg, que es la
   unica fuente. Dibujarlo dos veces es como acaban divergiendo.

   Uso:  node scripts/store-feature.mjs            */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RAIZ, '..', 'lexcapture-android', 'store', 'feature-graphic-1024x500.png');

const CIAN = '#22d3ee', AMBAR = '#fbbf24';
const icono = readFileSync(path.join(RAIZ, 'icon.svg'), 'utf8')
  .replace('<svg ', '<svg width="250" height="250" ');

const html = `<!doctype html><meta charset="utf-8"><style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{width:1024px;height:500px;overflow:hidden;
   font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;
   background:radial-gradient(120% 140% at 18% 8%, #16273f 0%, #0d1526 48%, #080e1a 100%);
   display:flex;align-items:center;gap:56px;padding:0 76px;position:relative}
 /* retícula muy tenue, coherente con el marco de visor del ícono */
 body::before{content:"";position:absolute;inset:0;opacity:.05;
   background-image:linear-gradient(${CIAN} 1px,transparent 1px),linear-gradient(90deg,${CIAN} 1px,transparent 1px);
   background-size:64px 64px}
 body::after{content:"";position:absolute;right:-180px;top:-140px;width:620px;height:620px;border-radius:50%;
   background:radial-gradient(circle,rgba(34,211,238,.16),transparent 62%)}
 .mark{flex:0 0 auto;position:relative;z-index:1}
 .txt{position:relative;z-index:1}
 h1{font-size:82px;line-height:1;font-weight:700;color:#fff;letter-spacing:-1.5px}
 h1 b{color:${AMBAR};font-weight:700}
 .tag{margin-top:20px;font-size:29px;line-height:1.32;color:#c6d2e4;font-weight:400}
 .chips{margin-top:26px;display:flex;gap:11px}
 .chip{font-size:20px;font-weight:600;color:${CIAN};border:2px solid rgba(34,211,238,.42);
   border-radius:999px;padding:8px 19px;white-space:nowrap}
</style>
<div class="mark">${icono}</div>
<div class="txt">
 <h1><b>F</b>lagrante</h1>
 <div class="tag">Registro de capturas en campo.<br>Documentos oficiales listos para firmar.</div>
 <div class="chips"><span class="chip">100% sin conexión</span><span class="chip">Datos cifrados</span></div>
</div>`;

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })).newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.waitForTimeout(400);
await p.screenshot({ path: OUT });
await b.close();
console.log('feature graphic listo -> ' + OUT);
