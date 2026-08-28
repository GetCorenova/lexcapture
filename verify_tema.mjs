/* Regresión del SISTEMA DE APARIENCIA (claro · oscuro · sistema) y de las dos
   fugas de color que la auditoría midió.

   Contexto de lo que se está protegiendo:
   1. El modo Sistema es un TERCER estado de la PREFERENCIA, no un tercer aspecto.
      El CSS sigue conociendo dos: data-theme="light" o ningún atributo. Por eso
      esta suite comprueba las dos cosas por separado — lo que se guarda y lo que
      se pinta— y que el botón marcado sea el de la preferencia, no el del
      aspecto: con Sistema activo sobre un teléfono en claro, lo marcado tiene
      que seguir siendo «Sistema» o la elección parecerá haberse perdido.
   2. ⚠️ Sin clave guardada se resuelve OSCURO. Sistema NO es el nuevo defecto:
      un equipo que nunca abrió Ajustes no puede cambiar de aspecto al
      actualizar. Es la misma regla con la que se eligieron los defectos del
      orden de las listas: el defecto es el comportamiento que ya había.
   3. El aspecto se resuelve ANTES de pintar (script del <head>), o el usuario ve
      un fogonazo del tema contrario en cada arranque.
   4. Los contrastes se MIDEN sobre el color computado real, no se leen del CSS:
      la fuga de #guest-bar consistía justamente en que el valor declarado era
      correcto en oscuro y quedaba congelado en claro. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8163;
const BASE = `http://localhost:${PORT}/LexCapture_v8.html`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

let fails = 0, n = 0;
const log = (ok, label, extra) => {
  n++; if (ok === false) fails++;
  console.log((ok === true ? '✅' : ok === false ? '❌' : 'ℹ️ '), `[${n}]`, label, extra !== undefined ? ('— ' + extra) : '');
};

/* ── Contraste WCAG 2, calculado sobre el color COMPUTADO por el navegador ── */
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = (c) => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contraste = (a, b) => { const l1 = lum(rgb(a)), l2 = lum(rgb(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

/* Abre la app con un esquema de sistema dado y, opcionalmente, una preferencia
   ya guardada — así se prueba el arranque en frío, que es donde vive el
   anti-parpadeo. */
async function abrir({ colorScheme = 'dark', pref = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  if (pref !== null) await page.addInitScript(p => { try { localStorage.setItem('lc_theme', p); } catch (e) {} }, pref);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}
const estado = (page) => page.evaluate(() => ({
  attr: document.documentElement.getAttribute('data-theme'),
  meta: (document.querySelector('meta[name="theme-color"]') || {}).content,
  pref: (function () { try { return localStorage.getItem('lc_theme'); } catch (e) { return null; } })(),
  fondo: getComputedStyle(document.body).backgroundColor,
  texto: getComputedStyle(document.body).color
}));

console.log('\n── I · Las tres preferencias existen y se distinguen ──\n');
{
  const { ctx, page } = await abrir();
  await page.waitForTimeout(500);
  const btns = await page.$$eval('.theme-seg button', els => els.map(e => ({ id: e.id, txt: e.textContent.trim(), on: e.classList.contains('on'), ap: e.getAttribute('aria-pressed') })));
  log(btns.length === 3, 'Ajustes → Apariencia ofrece las tres opciones', btns.map(b => b.txt).join(' · '));
  log(btns.some(b => b.id === 'th-system'), 'El modo Sistema tiene su propio control', '#th-system');
  log(btns.every(b => b.ap === (b.on ? 'true' : 'false')), 'Cada botón declara aria-pressed acorde a su estado', 'accesible por teclado y lector');
  await ctx.close();
}

console.log('\n── II · Preferencia guardada → aspecto pintado ──\n');
{
  const casos = [
    { pref: 'dark',   os: 'light', attr: null,    meta: '#0C0E13', marca: 'th-dark',   d: 'Oscuro explícito ignora un sistema en claro' },
    { pref: 'light',  os: 'dark',  attr: 'light', meta: '#F4F5F8', marca: 'th-light',  d: 'Claro explícito ignora un sistema en oscuro' },
    { pref: 'system', os: 'light', attr: 'light', meta: '#F4F5F8', marca: 'th-system', d: 'Sistema en claro pinta claro' },
    { pref: 'system', os: 'dark',  attr: null,    meta: '#0C0E13', marca: 'th-system', d: 'Sistema en oscuro pinta oscuro' }
  ];
  for (const c of casos) {
    const { ctx, page } = await abrir({ colorScheme: c.os, pref: c.pref });
    await page.waitForTimeout(500);
    const e = await estado(page);
    const marcado = await page.$eval('.theme-seg button.on', b => b.id).catch(() => '—');
    log(e.attr === c.attr && e.meta === c.meta, c.d, `data-theme=${e.attr} · theme-color=${e.meta}`);
    log(marcado === c.marca, '  …y el botón marcado es el de la PREFERENCIA, no el del aspecto', marcado);
    await ctx.close();
  }
}

console.log('\n── III · El defecto no cambia para quien nunca abrió Ajustes ──\n');
{
  for (const os of ['light', 'dark']) {
    const { ctx, page } = await abrir({ colorScheme: os });
    await page.waitForTimeout(400);
    const e = await estado(page);
    log(e.attr === null && e.meta === '#0C0E13',
      `Sin clave guardada y sistema en ${os}: sigue siendo OSCURO`, 'el comportamiento anterior se conserva');
    log(e.pref === null, '  …y no se escribe ninguna preferencia por el mero hecho de arrancar', 'lc_theme sin sembrar');
    await ctx.close();
  }
}

console.log('\n── IV · Se resuelve ANTES de pintar (anti-parpadeo) ──\n');
{
  /* Se lee el atributo en el primer instante en que existe <html>: si el tema se
     aplicara desde el script principal, aquí todavía no estaría puesto y el
     usuario vería un fogonazo oscuro antes del claro. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('lc_theme', 'system'); } catch (e) {} });
  await page.goto(BASE, { waitUntil: 'commit' });
  const temprano = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log(temprano === 'light', 'Con Sistema + SO claro, el atributo ya está puesto al confirmarse el documento', 'sin fogonazo');
  await ctx.close();
}

console.log('\n── V · El cambio del sistema en caliente ──\n');
{
  const { ctx, page } = await abrir({ colorScheme: 'dark', pref: 'system' });
  await page.waitForTimeout(500);
  const antes = await estado(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(400);
  const despues = await estado(page);
  log(antes.attr === null && despues.attr === 'light',
    'Con Sistema activo, cambiar el SO repinta la app sin recargar', 'oscuro → claro en caliente');
  log(despues.meta === '#F4F5F8', '  …y el color de la barra del navegador acompaña', despues.meta);

  /* Y lo contrario: una preferencia explícita NO puede moverse sola. */
  await page.evaluate(() => setTheme('dark'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(400);
  const fijo = await estado(page);
  log(fijo.attr === null, 'Con Oscuro explícito, cambiar el SO NO mueve la app', 'la elección del usuario manda');
  await ctx.close();
}

console.log('\n── VI · La preferencia se recuerda ──\n');
{
  const { ctx, page } = await abrir({ colorScheme: 'light' });
  await page.waitForTimeout(400);
  await page.evaluate(() => setTheme('system'));
  await page.waitForTimeout(300);
  const guardado = await page.evaluate(() => localStorage.getItem('lc_theme'));
  log(guardado === 'system', 'Elegir Sistema lo guarda', 'lc_theme=' + guardado);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const e = await estado(page);
  const marcado = await page.$eval('.theme-seg button.on', b => b.id).catch(() => '—');
  log(e.attr === 'light' && marcado === 'th-system', 'Y sobrevive a la recarga, con su botón marcado', marcado);
  const nota = await page.$eval('#th-nota', el => el.textContent.trim());
  log(/dispositivo/i.test(nota) && /claro/i.test(nota),
    'La pantalla dice qué está siguiendo y cómo se está viendo ahora', JSON.stringify(nota));
  await ctx.close();
}

console.log('\n── VII · Las dos fugas de color medidas ──\n');
{
  /* La barra de invitado: el defecto era que #0E1020 (el --acc-fg del OSCURO)
     quedaba escrito a pelo, así que en claro daba 3,11:1 sobre el ámbar oscuro. */
  for (const tema of ['dark', 'light']) {
    const { ctx, page } = await abrir({ pref: tema });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const b = document.getElementById('guest-bar');
      if (!b) return null;
      b.classList.add('on');
      const cs = getComputedStyle(b);
      const btn = b.querySelector('.gb-btn');
      return { fg: cs.color, bg: cs.backgroundColor, btnFg: btn ? getComputedStyle(btn).color : null };
    });
    if (!m) { log(false, `Barra de invitado en ${tema}`, 'no se encontró #guest-bar'); }
    else {
      const c = contraste(m.fg, m.bg);
      log(c >= 4.5, `Barra de modo invitado en ${tema}: cumple AA para texto normal`, c.toFixed(2) + ':1');
      log(m.btnFg === m.fg, `  …y su botón usa el mismo color de primer plano`, m.btnFg);
    }
    await ctx.close();
  }

  /* El texto guía del lienzo de firma vive sobre un blanco FIJO en los dos
     temas, así que se mide una sola vez y contra blanco, no contra el token. */
  const { ctx, page } = await abrir({ pref: 'dark' });
  await page.waitForTimeout(400);
  const ph = await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<div class="fw-pad"><div class="fw-ph">Firma</div></div>';
    document.body.appendChild(d);
    const el = d.querySelector('.fw-ph'), pad = d.querySelector('.fw-pad');
    const r = { fg: getComputedStyle(el).color, bg: getComputedStyle(pad).backgroundColor };
    d.remove(); return r;
  });
  const cph = contraste(ph.fg, ph.bg);
  log(cph >= 4.5, 'Texto guía del lienzo de firma sobre su fondo blanco fijo', cph.toFixed(2) + ':1');
  await ctx.close();
}

console.log('\n── VIII · Tokens nuevos y --text-3 corregido ──\n');
{
  for (const tema of ['dark', 'light']) {
    const { ctx, page } = await abrir({ pref: tema });
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const g = (k) => cs.getPropertyValue(k).trim();
      return { info: g('--info'), infoBg: g('--info-bg'), sel: g('--surface-selected'), dis: g('--surface-disabled'),
               t3: g('--text-3'), s3: g('--surface-3'), bg: g('--bg'), s2: g('--surface-2') };
    });
    log(!!t.info && !!t.infoBg && !!t.sel && !!t.dis,
      `Los tokens de estado existen en tema ${tema}`, `--info ${t.info} · --surface-selected ${t.sel}`);

    /* --text-3 se mide contra las TRES superficies sobre las que se usa. El caso
       que fallaba en los dos temas era surface-3. */
    const medir = await page.evaluate((tt) => {
      const d = document.createElement('div'); document.body.appendChild(d);
      const out = {};
      for (const s of ['--bg', '--surface-2', '--surface-3']) {
        d.style.color = 'var(--text-3)'; d.style.backgroundColor = 'var(' + s + ')';
        const cs = getComputedStyle(d); out[s] = { fg: cs.color, bg: cs.backgroundColor };
      }
      d.remove(); return out;
    }, t);
    for (const s of ['--bg', '--surface-2', '--surface-3']) {
      const c = contraste(medir[s].fg, medir[s].bg);
      log(c >= 4.5, `  --text-3 sobre ${s} en ${tema}`, c.toFixed(2) + ':1');
    }
    await ctx.close();
  }
}

console.log('\n── IX · El CSS no tuvo que cambiar para esto ──\n');
{
  /* La garantía es estructural: si alguien «arregla» el modo Sistema metiendo
     una media query de color en la hoja de estilos, el aspecto pasaría a
     decidirse en DOS sitios —el CSS y applyTheme()— y podrían discrepar. El
     único punto que resuelve preferencia → aspecto es lcThemeResuelto(). */
  const html = await readFile(join(ROOT, 'LexCapture_v8.html'), 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  log(!/prefers-color-scheme/.test(css),
    'La hoja de estilos sigue sin ninguna regla prefers-color-scheme', 'un solo punto decide el aspecto');
  log(/function lcThemeResuelto/.test(html), 'Ese punto único existe y tiene nombre', 'lcThemeResuelto()');
  log(/matchMedia\('\(prefers-color-scheme: light\)'\)/.test(html), 'El sistema operativo se consulta con matchMedia', '');
}

log(consoleErrors.length === 0, 'Sin errores de consola en todo el recorrido',
  consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'consola limpia');

await browser.close();
server.close();
console.log(fails === 0 ? `\n✅ TODO EN VERDE — ${n} comprobaciones\n` : `\n❌ ${fails} de ${n} comprobaciones fallaron\n`);
process.exit(fails === 0 ? 0 : 1);
