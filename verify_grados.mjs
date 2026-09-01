/* Regresión del CATÁLOGO DE GRADOS (Fase E de la auditoría).

   Lo que se está protegiendo, y por qué cada cosa:
   1. La abreviatura se DERIVA, nunca se teclea ni se guarda. Lo que persiste es
      el grado completo; «SI» sale de `lcAbrevGrado` en el momento de usarlo. Si
      alguna vez se guardara la abreviatura, corregir la tabla dejaría de
      corregir los datos ya guardados — que es justo lo que hace valioso tener
      una tabla central.
   2. NUNCA se inventa una abreviatura. Un grado que no está en el catálogo
      devuelve cadena vacía y quien lo consume imprime el grado completo. Un
      grado mal abreviado en un documento judicial es peor que uno sin abreviar.
   3. La escritura libre se conserva. El catálogo alimenta un <datalist>, que
      sugiere sin restringir: los cuatro campos siguen siendo <input> con su
      mismo id, así que los recolectores del modelo no se enteran.
   4. La derivación es VISIBLE. Un dato que la app pone sola y no se ve es
      indistinguible de uno que no puso — la lección de la miniatura de la firma. */
import { chromium } from 'playwright';
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const PORT = 8174;
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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.fill('#pin-a', '2468'); await page.fill('#pin-b', '2468');
await page.click('button[onclick="doSetPin()"]');
await page.waitForTimeout(900);

console.log('\n── I · El catálogo existe y está completo ──\n');
{
  const cat = await page.evaluate(() => ({
    total: LC_GRADOS.length,
    cats: [...new Set(LC_GRADOS.map(x => x.cat))],
    abrevs: LC_GRADOS.map(x => x.ab),
    sinAb: LC_GRADOS.filter(x => !x.ab).length,
    ne: LC_GRADOS.filter(x => x.cat === 'Nivel Ejecutivo').map(x => x.g + '=' + x.ab)
  }));
  log(cat.total >= 20, 'El catálogo cubre la jerarquía completa', cat.total + ' grados');
  log(cat.cats.includes('Oficiales') && cat.cats.includes('Nivel Ejecutivo') && cat.cats.includes('Suboficiales'),
    'Con sus categorías', cat.cats.join(' · '));
  log(cat.sinAb === 0, 'Toda entrada declara su abreviatura', '0 sin abreviatura');
  log(new Set(cat.abrevs).size === cat.abrevs.length,
    'No hay dos grados con la misma abreviatura', 'ninguna colisión');
  log(cat.ne.length >= 6, 'El Nivel Ejecutivo está entero — es donde está casi todo el personal', cat.ne.join(' · '));
}

console.log('\n── II · La abreviatura se deriva, y no se inventa ──\n');
{
  const r = await page.evaluate(() => ({
    si: lcAbrevGrado('Subintendente'),
    pt: lcAbrevGrado('Patrullero'),
    ij: lcAbrevGrado('Intendente Jefe'),
    it: lcAbrevGrado('Intendente'),
    /* Mayúsculas, minúsculas y sin tilde: lo que de verdad se teclea en campo. */
    mayus: lcAbrevGrado('SUBINTENDENTE'),
    minus: lcAbrevGrado('  subintendente '),
    sinTilde: lcAbrevGrado('Capitan'),
    conTilde: lcAbrevGrado('Capitán'),
    /* Una configuración vieja pudo tener la abreviatura escrita en el campo. */
    yaAbrev: lcAbrevGrado('SI'),
    /* Y lo que NO está en el catálogo. */
    inventado: lcAbrevGrado('Comandante Supremo'),
    vacio: lcAbrevGrado(''),
    nulo: lcAbrevGrado(null)
  }));
  log(r.si === 'SI' && r.pt === 'PT' && r.ij === 'IJ' && r.it === 'IT',
    'Deriva los grados del Nivel Ejecutivo', `Subintendente→${r.si} · Patrullero→${r.pt} · Intendente Jefe→${r.ij} · Intendente→${r.it}`);
  log(r.mayus === 'SI' && r.minus === 'SI', 'Es indiferente a mayúsculas y a espacios sobrantes', `"SUBINTENDENTE"→${r.mayus} · "  subintendente "→${r.minus}`);
  log(r.sinTilde === 'CT' && r.conTilde === 'CT', 'Y a las tildes — «Capitan» y «Capitán» son el mismo grado', r.sinTilde);
  log(r.yaAbrev === 'SI', 'Acepta la abreviatura ya escrita, de una configuración anterior', '"SI"→' + r.yaAbrev);
  log(r.inventado === '' && r.vacio === '' && r.nulo === '',
    '⚠️ Un grado que no está en el catálogo NO recibe abreviatura inventada', 'devuelve cadena vacía');
}

console.log('\n── III · Composición para el dossier ──\n');
{
  const r = await page.evaluate(() => ({
    normal: lcGradoNombre('Subintendente', 'Nelson David'),
    desconocido: lcGradoNombre('Comandante Supremo', 'Nelson David'),
    sinGrado: lcGradoNombre('', 'Nelson David'),
    sinNombre: lcGradoNombre('Patrullero', '')
  }));
  log(r.normal === 'SI Nelson David', 'Grado + nombre se componen con la abreviatura', JSON.stringify(r.normal));
  log(r.desconocido === 'Comandante Supremo Nelson David',
    '⚠️ Con un grado fuera del catálogo se imprime ENTERO — se degrada, no se rompe', JSON.stringify(r.desconocido));
  log(r.sinGrado === 'Nelson David' && r.sinNombre === 'Patrullero',
    'Sin una de las dos partes no quedan espacios ni restos sueltos', JSON.stringify(r.sinGrado) + ' / ' + JSON.stringify(r.sinNombre));
}

console.log('\n── IV · El datalist y los cuatro campos ──\n');
{
  const dl = await page.evaluate(() => {
    const el = document.getElementById('dl-grado');
    return el ? { n: el.querySelectorAll('option').length, primero: el.querySelector('option') ? el.querySelector('option').value : null } : null;
  });
  log(dl && dl.n >= 20, 'El datalist se pinta al arrancar', dl ? dl.n + ' opciones' : 'NO EXISTE');

  /* Los cuatro campos: perfil, servidor del FPJ-5, firmante del oficio y
     funcionarios de la diligencia. Se comprueban donde de verdad se pintan. */
  await page.evaluate(() => go('perfil'));
  await page.waitForTimeout(400);
  await page.evaluate(() => openPerfilForm(null));
  await page.waitForTimeout(500);
  const perfil = await page.evaluate(() => {
    const i = document.getElementById('pfm-grado');
    return i ? { list: i.getAttribute('list'), tag: i.tagName, hint: !!document.getElementById('pfm-grado-ab') } : null;
  });
  log(perfil && perfil.list === 'dl-grado' && perfil.tag === 'INPUT',
    'Perfil: el campo sigue siendo <input> con el mismo id, ahora con catálogo', 'list=' + (perfil && perfil.list));
  log(perfil && perfil.hint, '  …y tiene su pista de abreviatura', '#pfm-grado-ab');

  /* ⚠️ El compañero de patrulla es el QUINTO campo de grado y vive en el mismo
     formulario. Se le pasa por alto con facilidad justo porque está plegado
     dentro del perfil, y es el que alimenta la cadena de custodia. */
  const comp = await page.evaluate(() => {
    const i = document.getElementById('pfm-cgrado');
    return i ? { list: i.getAttribute('list'), hint: !!document.getElementById('pfm-cgrado-ab') } : null;
  });
  log(comp && comp.list === 'dl-grado' && comp.hint,
    'El compañero de patrulla usa el mismo catálogo', '#pfm-cgrado');
}

console.log('\n── V · La pista se ve, y se ve desde el primer pintado ──\n');
{
  /* Un grado del catálogo, escrito a mano: la pista tiene que reaccionar. */
  await page.fill('#pfm-grado', 'Subintendente');
  await page.waitForTimeout(300);
  const vivo = await page.$eval('#pfm-grado-ab', e => ({ t: e.textContent.trim(), ok: e.classList.contains('ok') }));
  log(vivo.t === 'Se abrevia SI' && vivo.ok, 'Al teclear un grado del catálogo, la pista lo dice', JSON.stringify(vivo.t));

  await page.fill('#pfm-grado', 'Comandante Supremo');
  await page.waitForTimeout(300);
  const raro = await page.$eval('#pfm-grado-ab', e => ({ t: e.textContent.trim(), ok: e.classList.contains('ok') }));
  log(/Sin abreviatura/.test(raro.t) && !raro.ok,
    'Y con uno que no está, avisa de que se imprimirá completo', JSON.stringify(raro.t));

  /* Y lo que de verdad importa: al REABRIR un perfil ya guardado, la pista tiene
     que estar puesta sin tocar nada — se pinta al construir el campo. */
  await page.fill('#pfm-grado', 'Intendente Jefe');
  await page.fill('#pfm-nombre', 'ANA MARIA TORRES');
  await page.fill('#pfm-cedula', '43.123.456');
  await page.click('button:has-text("Guardar perfil")').catch(() => {});
  await page.waitForTimeout(800);
  const guardado = await page.evaluate(() => {
    const c = DB.getConfig(); const p = (c.perfiles || [])[0] || {};
    return { grado: p.grado, cedula: p.cedula, id: p.id };
  });
  log(guardado.grado === 'Intendente Jefe',
    '⚠️ Lo que se GUARDA es el grado completo, no la abreviatura', JSON.stringify(guardado.grado));
  log(guardado.cedula === '43123456', '  …y la cédula sigue guardándose sin puntos, como antes', guardado.cedula);

  await page.evaluate((id) => openPerfilForm(id), guardado.id);
  await page.waitForTimeout(500);
  const alReabrir = await page.$eval('#pfm-grado-ab', e => ({ t: e.textContent.trim(), ok: e.classList.contains('ok') }));
  log(alReabrir.t === 'Se abrevia IJ' && alReabrir.ok,
    'Al reabrir el perfil la pista YA está puesta, sin tocar el campo', JSON.stringify(alReabrir.t));
  await page.evaluate(() => closeModal());
  await page.waitForTimeout(400);
}

console.log('\n── VI · La tarjeta del perfil enseña la derivación ──\n');
{
  await page.evaluate(() => go('perfil'));
  await page.waitForTimeout(500);
  const card = await page.$eval('.pf-grado', e => e.textContent.trim()).catch(() => '—');
  log(/\(IJ\)/.test(card), 'La tarjeta muestra la abreviatura junto al grado', JSON.stringify(card));
}

console.log('\n── VII · La escritura libre sigue funcionando ──\n');
{
  const libre = await page.evaluate(async () => {
    const c = DB.getConfig();
    c.perfiles.push({ id: 'x-libre', grado: 'Oficial de Enlace', nombre: 'JUAN PEREZ', cedula: '111', cargo: '', entidad: '', correo: '' });
    await DB.saveConfig(c);
    const d = DB.getConfig();
    const p = (d.perfiles || []).filter(x => x.id === 'x-libre')[0];
    return { grado: p ? p.grado : null, ab: lcAbrevGrado(p ? p.grado : ''), compuesto: lcGradoNombre(p.grado, p.nombre) };
  });
  log(libre.grado === 'Oficial de Enlace',
    'Un grado fuera del catálogo se guarda tal cual', JSON.stringify(libre.grado));
  log(libre.ab === '' && libre.compuesto === 'Oficial de Enlace JUAN PEREZ',
    '  …y se imprime entero, sin abreviatura inventada', JSON.stringify(libre.compuesto));
}

console.log('\n── VIII · El modelo no cambió ──\n');
{
  /* La garantía estructural: los cuatro campos siguen siendo <input> con su id de
     siempre, así que collectStep / savePersonModal / ojCollect no se enteran. Si
     alguien los convierte en <select>, la escritura libre desaparece y esta
     comprobación lo dice. */
  const html = await readFile(join(ROOT, 'LexCapture_v8.html'), 'utf8');
  const ids = ['pfm-grado', 'pfm-cgrado', 'w-sGrado', 'oj-f-gra'];
  /* ⚠️ Adaptado en la Mejora 7 (2026-08-31): el formulario del perfil pasó a
     componer sus campos una sola vez (`pfmCampos`) para el titular y para el
     compañero, así que sus dos ids ya no aparecen escritos literalmente — se
     forman con el prefijo. Lo que este check protege NO cambia: que los cuatro
     salgan del MISMO helper. Se mide donde de verdad se ve, en el DOM: la firma
     de `lcGradoInput` es un <input list="dl-grado"> con su pista `<id>-ab` al
     lado, y nada más la produce. */
  await page.evaluate(() => { go('perfil'); openPerfilForm(null); });
  await page.waitForTimeout(450);
  const enDom = await page.evaluate(ids2 => ids2.map(id => {
    const i = document.getElementById(id);
    return !!(i && i.getAttribute('list') === 'dl-grado' && document.getElementById(id + '-ab'));
  }), ['pfm-grado', 'pfm-cgrado']);
  await page.evaluate(() => closeModal());
  const viaHelper = enDom.every(Boolean) &&
    ['w-sGrado', 'oj-f-gra'].every(id => html.includes("lcGradoInput('" + id + "'"));
  log(viaHelper, 'Los cuatro campos con id fijo se construyen por el MISMO punto', ids.join(' · '));
  log(/\{k:'grado',l:'Grado',ph:'Ej: Patrullero',par:'a',lista:'dl-grado'\}/.test(html),
    'Y el de la lista de funcionarios usa el soporte de datalist que el motor ya tenía', "lista:'dl-grado'");
  log(!/<select[^>]*id="(pfm-grado|pfm-cgrado|w-sGrado|oj-f-gra)"/.test(html),
    '⚠️ Ninguno se convirtió en <select> — la escritura libre es un requisito', 'siguen siendo <input>');
  log(html.split('function lcAbrevGrado').length - 1 === 1,
    'La derivación tiene un solo punto de definición', 'lcAbrevGrado()');
  log(!/function lcNormGrado/.test(html),
    'No se creó un segundo normalizador: reutiliza lcNormNom()', 'sin duplicación');
}

log(consoleErrors.length === 0, 'Sin errores de consola en todo el recorrido',
  consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'consola limpia');

await browser.close();
server.close();
console.log(fails === 0 ? `\n✅ TODO EN VERDE — ${n} comprobaciones\n` : `\n❌ ${fails} de ${n} comprobaciones fallaron\n`);
process.exit(fails === 0 ? 0 : 1);
