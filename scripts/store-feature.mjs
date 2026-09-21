/* Grafico de funciones 1024x500 para Play Store.
   Identidad del icono: monograma L ambar en marco de visor cian.
   NADA de escudos ni nombres de institucion — filtro de Play Store.
   Uso:  node scripts/store-feature.mjs            */
import { chromium } from 'playwright';
const OUT='d:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/lexcapture-android/store/feature-graphic-1024x500.png';
const html=`<!doctype html><meta charset="utf-8"><style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{width:1024px;height:500px;overflow:hidden;
   font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;
   background:radial-gradient(120% 140% at 18% 8%, #16273f 0%, #0d1526 48%, #080e1a 100%);
   display:flex;align-items:center;gap:56px;padding:0 76px;position:relative}
 /* retícula muy tenue, coherente con el marco de visor del ícono */
 body::before{content:"";position:absolute;inset:0;opacity:.05;
   background-image:linear-gradient(#22d3ee 1px,transparent 1px),linear-gradient(90deg,#22d3ee 1px,transparent 1px);
   background-size:64px 64px}
 body::after{content:"";position:absolute;right:-180px;top:-140px;width:620px;height:620px;border-radius:50%;
   background:radial-gradient(circle,rgba(34,211,238,.16),transparent 62%)}
 .mark{flex:0 0 auto;position:relative;z-index:1}
 .txt{position:relative;z-index:1}
 h1{font-size:82px;line-height:1;font-weight:700;color:#fff;letter-spacing:-1.5px}
 h1 b{color:#fbbf24;font-weight:700}
 .tag{margin-top:20px;font-size:29px;line-height:1.32;color:#c6d2e4;font-weight:400}
 .chips{margin-top:26px;display:flex;gap:11px}
 .chip{font-size:20px;font-weight:600;color:#22d3ee;border:2px solid rgba(34,211,238,.42);
   border-radius:999px;padding:8px 19px;white-space:nowrap}
</style>
<div class="mark">
 <svg width="250" height="250" viewBox="0 0 512 512">
  <defs>
   <linearGradient id="bg" x1="80" y1="40" x2="440" y2="480" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1b2f4d"/><stop offset="1" stop-color="#0a1120"/></linearGradient>
   <linearGradient id="amber" x1="180" y1="150" x2="330" y2="380" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#d97706"/></linearGradient>
   <linearGradient id="cyan" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#00a7b8"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <rect x="10" y="10" width="492" height="492" rx="108" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="2"/>
  <g fill="none" stroke="url(#cyan)" stroke-width="24" stroke-linecap="round">
   <path d="M126 176 V150 Q126 126 150 126 H176"/><path d="M386 176 V150 Q386 126 362 126 H336"/>
   <path d="M126 336 V362 Q126 386 150 386 H176"/><path d="M386 336 V362 Q386 386 362 386 H336"/></g>
  <circle cx="256" cy="126" r="9" fill="url(#cyan)"/>
  <g fill="url(#amber)"><rect x="212" y="168" width="58" height="178" rx="16"/>
   <rect x="212" y="288" width="118" height="58" rx="16"/></g>
 </svg>
</div>
<div class="txt">
 <h1>Lex<b>Capture</b></h1>
 <div class="tag">Registro de capturas en campo.<br>Documentos oficiales listos para firmar.</div>
 <div class="chips"><span class="chip">100% sin conexión</span><span class="chip">Datos cifrados</span></div>
</div>`;
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1024,height:500},deviceScaleFactor:1})).newPage();
await p.setContent(html,{waitUntil:'load'}); await p.waitForTimeout(400);
await p.screenshot({path:OUT}); await b.close();
console.log('feature graphic listo');
