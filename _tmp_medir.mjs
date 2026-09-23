/* Mide los insets DENTRO del WebView real, por el protocolo de depuración.
   Playwright no habla con un WebView de Android, así que se usa CDP crudo. */
const lista = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const pagina = lista.find(t => t.type === 'page');
if (!pagina) { console.error('no hay página'); process.exit(1); }
console.log('URL:', pagina.url, '\n');

const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0;
const pend = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
const enviar = (method, params) => new Promise(res => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expr) => {
  const r = await enviar('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text };
  return r.result && r.result.result ? r.result.result.value : null;
};

const LEER = `(() => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:1px';
  document.body.appendChild(d);
  const sat = d.getBoundingClientRect().height;
  d.remove();
  const tb = [...document.querySelectorAll('.topbar')].find(e => e.getBoundingClientRect().height > 0);
  const h1 = tb && tb.querySelector('h1');
  return {
    dpr: devicePixelRatio, innerH: innerHeight, outerH: outerHeight,
    screenY: window.screenY, availH: screen.availHeight, screenH: screen.height,
    satMedido: sat,
    satVar: getComputedStyle(document.documentElement).getPropertyValue('--sat').trim(),
    bodyNat: document.body.classList.contains('nat'),
    reserva: (typeof _lcBarraReserva !== 'undefined') ? String(_lcBarraReserva) : 'n/d',
    tema: (typeof lcThemeResuelto === 'function') ? lcThemeResuelto() : '?',
    tituloTop: h1 ? Math.round(h1.getBoundingClientRect().top) : null
  };
})()`;

const ov = (v) => `window.Capacitor.Plugins.StatusBar.setOverlaysWebView({overlay:${v}}).then(()=>'ok').catch(e=>'ERR '+e)`;
const esperar = ms => new Promise(r => setTimeout(r, ms));

console.log('── COMO LO DEJÓ LA APP ──');
console.log(await ev(LEER));

console.log('\n── overlay:true (borde a borde) ──');
console.log('  setOverlays:', await ev(ov(true)));
await esperar(700);
console.log(await ev(LEER));

console.log('\n── overlay:false (Android reserva) ──');
console.log('  setOverlays:', await ev(ov(false)));
await esperar(700);
console.log(await ev(LEER));

ws.close();
