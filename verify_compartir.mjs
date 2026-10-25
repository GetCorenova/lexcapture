/* MODO COMPARTIR — lo que queda del módulo tras retirar el vínculo por wifi
   (2026-10-25): el códec y el lector de códigos (los usan el código de compañero
   del buzón y el código de patrulla del Perfil), el ARCHIVO cifrado entre dos
   teléfonos, la revisión antes de importar, la fusión al recibir y la pantalla.
   El envío entre cuentas (buzón) lo miden verify_companeros, verify_envio_buzon
   y verify_cambios_buzon; esta suite comprueba además que del wifi no quedó ni
   un resto.

   ⚠️ Se abren DOS CONTEXTOS de navegador, no dos pestañas: así cada lado tiene
   su propio almacenamiento y su propia identidad de equipo, que es lo que los
   convierte en dos teléfonos y no en dos vistas del mismo. */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'd:/UsurarioDocumentos/Escritorio/Proyectos 2026/APP Capturas/Crear App';
const MIME = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LexCapture_v8.html');
  if (!existsSync(p)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  s.end(readFileSync(p));
});
await new Promise(r => server.listen(8133, r));

const R = [];
const log = (ok, l, x) => { R.push(ok); console.log(ok ? 'OK  ' : 'FAIL', l, x ?? ''); };
const src = readFileSync(join(ROOT, 'LexCapture_v8.html'), 'utf8');
const browser = await chromium.launch({ headless: true });
async function abrirEquipo(pin) {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 800 } });
  const pg = await ctx.newPage();
  const er = [];
  pg.on('pageerror', e => er.push(String(e.message).slice(0, 90)));
  pg.on('console', m => { if (m.type() === 'error') er.push(m.text().slice(0, 90)); });
  await pg.goto('http://localhost:8133/LexCapture_v8.html', { waitUntil: 'load' });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForTimeout(400);
  await pg.waitForFunction(() => window._lcListo === true);
  await pg.waitForTimeout(800);
  return { ctx, pg, er };
}
const A = await abrirEquipo('123456');
const B = await abrirEquipo('654321');
const page = A.pg, pageB = B.pg;
const errs = [];
A.er.forEach(e => errs.push('A: ' + e)); B.er.forEach(e => errs.push('B: ' + e));
A.pg.on('pageerror', e => errs.push('A: ' + String(e.message).slice(0, 90)));
B.pg.on('pageerror', e => errs.push('B: ' + String(e.message).slice(0, 90)));

/* ══════════════════════════════════════════════════════════════════════════
   A · EL CÓDEC DE CÓDIGOS

   ⚠️ Está escrito en la propia aplicación y NO se usa `BarcodeDetector`: existe
   en el WebView del teléfono pero no en el navegador con el que se verifica, así
   que usarlo dejaría la única ruta que va a campo como la única que nadie puede
   comprobar.
   ══════════════════════════════════════════════════════════════════════════ */

// [A3] Ida y vuelta del códec dentro de la propia aplicación, todas las versiones.
const a3 = await page.evaluate(() => {
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
log(a3.ok === a3.tot, '[A3] El códec va y vuelve en las 20 versiones', a3.ok + '/' + a3.tot);

// [A4] Y se lee de una FOTO: la pantalla del otro, en ángulo y con ruido.
//      ⚠️ Es la única condición en que se va a usar de verdad.
const a4 = await page.evaluate(async () => {
  const p = new Uint8Array(160); for (let i = 0; i < 160; i++) p[i] = (i * 91 + 17) & 255;
  const svg = ptQrSvg(p, 300);
  const img = new Image();
  await new Promise(r => { img.onload = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
  /* ⚠️ El lienzo tiene que dar de sí para la DIAGONAL del código girado: con
     300 px girados hacen falta más de 424, y si no las esquinas —donde viven los
     tres buscadores— se recortan y no hay nada que leer. */
  const W = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(0.13); g.transform(1, 0.06, -0.05, 0.94, 0, 0);
  g.drawImage(img, -150, -150, 300, 300);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const d = g.getImageData(0, 0, W, W);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    d.data[i] = Math.max(0, Math.min(255, d.data[i] + n));
    d.data[i + 1] = d.data[i]; d.data[i + 2] = d.data[i];
  }
  const r = ptQrLeer(d.data, W, W);
  return !!(r && r.length === 160 && Array.from(r).every((b, i) => b === p[i]));
});
log(a4, '[A4] El código se lee de una foto en ángulo y con ruido');

// [A5] Y no inventa: ruido puro no produce ninguna lectura.
const a5 = await page.evaluate(() => {
  let falsos = 0;
  for (let t = 0; t < 25; t++) {
    const W = 260, d = new Uint8ClampedArray(W * W * 4);
    for (let i = 0; i < W * W; i++) { const g = (Math.random() * 256) | 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; }
    if (ptQrLeer(d, W, W)) falsos++;
  }
  return falsos;
});
log(a5 === 0, '[A5] Sobre ruido puro no inventa ninguna lectura', a5 + ' falsos de 25');

// [A6] Y el lector LEE ese tamaño en condiciones de campo. ⚠️ Se mide sobre el
//      fotograma que la aplicación analiza de verdad: antes reducía una cámara de
//      1280×720 a 480×270 —270 px de alto para todo el símbolo— y fallaba el
//      100 % de las veces en cuanto el código pasaba de 61 módulos.
const f2 = await page.evaluate(() => {
  function foto(m, FW, FH, frac, ang, blur, ruido) {
    const q = 4, n = m.size + q * 2, lado = Math.round(FH * frac), esc = lado / n;
    const d = new Uint8ClampedArray(FW * FH * 4).fill(230);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    const ox = (FW - lado) / 2, oy = (FH - lado) / 2;
    const rad = ang * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const dx = x - FW / 2, dy = y - FH / 2;
      const rx = dx * cs + dy * sn + FW / 2, ry = -dx * sn + dy * cs + FH / 2;
      let v = 230;
      if (rx >= ox && ry >= oy && rx < ox + lado && ry < oy + lado) {
        const mx = Math.floor((rx - ox) / esc) - q, my = Math.floor((ry - oy) / esc) - q;
        v = (mx >= 0 && my >= 0 && mx < m.size && my < m.size && m.mods[my][mx]) ? 18 : 248;
      }
      const i = (y * FW + x) * 4; d[i] = d[i + 1] = d[i + 2] = v;
    }
    for (let p = 0; p < blur; p++) {
      const c = d.slice();
      for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
        let sm = 0;
        for (let j = -1; j <= 1; j++) for (let i2 = -1; i2 <= 1; i2++) sm += c[((y + j) * FW + (x + i2)) * 4];
        const i = (y * FW + x) * 4; d[i] = d[i + 1] = d[i + 2] = sm / 9;
      }
    }
    if (ruido) for (let i = 0; i < d.length; i += 4) {
      const r = (Math.random() * 2 - 1) * ruido;
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, d[i] + r));
    }
    return d;
  }
  /* El fotograma que analiza la aplicación hoy: una cámara de 1280×720 con el
     lado mayor limitado a PT_QR_MAX_LADO. */
  const esc = Math.min(1, PT_QR_MAX_LADO / 1280);
  const FW = Math.round(1280 * esc), FH = Math.round(720 * esc);
  const out = [];
  for (const v of [7, 8, 9, 10]) {
    const e = PT_QR_EC[v], cap = e[1] * e[2] + e[3] * e[4] - (v <= 9 ? 2 : 3);
    const p = new Uint8Array(cap);
    for (let i = 0; i < cap; i++) p[i] = (i * 53 + v * 7) & 255;
    const m = ptQrMatriz(p);
    let ok = 0; const N = 6;
    for (let t = 0; t < N; t++) {
      let x = null;
      try { x = ptQrLeer(foto(m, FW, FH, 0.80, 5, 1, 10), FW, FH); } catch (e2) {}
      if (x && x.length === cap && Array.from(x).every((b, i) => b === p[i])) ok++;
    }
    out.push({ v, size: m.size, ok, N });
  }
  return { FW, FH, out };
});
log(f2.out.every(x => x.ok === x.N),
  '[A6] El lector lee todos esos tamaños con la cámara en ángulo, movida y con ruido',
  'fotograma ' + f2.FW + '×' + f2.FH + ' · ' + f2.out.map(x => 'v' + x.v + ' ' + x.ok + '/' + x.N).join(' · '));

// [A7] LA GUARDA QUE FALTABA: un vídeo pausado tiene su medida correcta y no
//      entrega un solo fotograma. Sin mirarlo, el lector analiza un lienzo en
//      blanco y no ve nada, sin que nada parezca roto.
const f3 = await page.evaluate(() => {
  const v = { paused: true, ended: false, videoWidth: 1280, videoHeight: 720, play() { this.pidioPlay = true; } };
  const cv = document.createElement('canvas');
  const r = ptQrDeVideo(v, cv);
  return { devuelve: r, pidioPlay: !!v.pidioPlay };
});
log(f3.devuelve === null && f3.pidioPlay,
  '[A7] Un vídeo pausado no se analiza en vano: se reanuda', 'devolvió null y llamó a play()');

/* ══════════════════════════════════════════════════════════════════════════
   C · COMPARTIR POR ARCHIVO — EL REPARTO REAL DE LA PATRULLA

   Uno toma los datos del capturado y el otro los de la víctima, cada uno en SU
   teléfono. Después se los pasan en un archivo cifrado y los dos los tienen. El
   que recibe DECIDE: lo que llega se enseña y no entra hasta que se acepta.
   ══════════════════════════════════════════════════════════════════════════ */

async function aceptarEnReceptor(rx, op) {
  op = op || {};
  try { await rx.waitForSelector('#modal-c .cf-res, #modal-c .cf-dups', { timeout: 6000 }); }
  catch (e) { return false; }
  if (op.dup) {
    for (const [id, v] of Object.entries(op.dup))
      await rx.evaluate(({ id, v }) => ptConfDup(id, v), { id, v });
  }
  await rx.click(op.cancelar ? 'button[onclick="ptConfCancelar()"]' : 'button[onclick="ptConfAceptar()"]');
  await rx.waitForTimeout(250);
  return true;
}
/* Arma el archivo en un teléfono (cifrado, con su clave de 6 dígitos), lo pasa
   como BYTES al otro —lo que haría un chat— y el otro lo abre con la clave, lo
   revisa y lo acepta. Devuelve lo que `ptAplicarPaquete` hizo con él. */
async function pasar(desde, hacia, ids, op) {
  const x = await desde.evaluate(async (s) => {
    const personas = DB.getPersons().filter(p => s.p.indexOf(p.id) >= 0);
    const casos = DB.getCases().filter(c => s.c.indexOf(c.id) >= 0);
    const pin = ptClaveNumerica();
    const bytes = await ptArchivoCifrar(ptPaquete(personas, casos), pin);
    return { b: Array.from(bytes), pin };
  }, ids);
  const prom = hacia.evaluate(async (x) => {
    const r = await ptArchivoAbrir(Uint8Array.from(x.b).buffer, x.pin);
    if (!r.ok) return { ok: false, motivo: r.motivo };
    return await new Promise(res => ptConfirmarImportacion(r, 'el archivo', async (si, dec) => {
      if (!si) { res({ ok: true, cancelado: true }); return; }
      res(await ptAplicarPaquete(r, dec));
    }));
  }, x);
  await aceptarEnReceptor(hacia, op);
  return await prom;
}

// A registra al capturado; B, a la víctima. Cada uno en su teléfono.
await page.evaluate(async () => {
  await DB.savePerson({ id: 'p-cap', priNom: 'JUAN', priApe: 'GOMEZ', tipoDoc: 'CC',
                        numDoc: '71234567', tel: '3001112233', ocup: 'Comerciante' });
});
await pageB.evaluate(async () => {
  await DB.savePerson({ id: 'p-vic', priNom: 'LUZ', priApe: 'MARIN', tipoDoc: 'CC',
                        numDoc: '43987654', escol: 'Universitaria' });
});

// [C1] El CAMINO DE LA PANTALLA de punta a punta: A marca a su capturado y toca
//      «Guardar un archivo»; sale una descarga y una clave. B toca «Recibir un
//      archivo», teclea la clave, revisa y acepta — y se le dice qué llegó.
const descarga = page.waitForEvent('download', { timeout: 15000 });
await page.evaluate(() => { go('personas'); evGestionar('p'); });
await page.click('#ev-gest .pt-op:has-text("Guardar un archivo")');
await page.click('#pl .prow[data-ev="p-cap"]');
await page.click('#ev-personas .ev-sel .bp');
const dl = await descarga;
const c1pin = (await page.textContent('#modal-c .cf-pin-n')).replace(/\D/g, '');
const c1ruta = await dl.path();
const c1bytes = Array.from(readFileSync(c1ruta));
await page.evaluate(() => closeModal());
await pageB.evaluate((arr) => { go('personas'); ptPedirClaveArchivo(Uint8Array.from(arr).buffer, 'Flagrante.lexc'); }, c1bytes);
await pageB.fill('#pt-arch-pin', c1pin);
await pageB.click('#modal-c button:has-text("Abrir")');
await aceptarEnReceptor(pageB);
await pageB.waitForTimeout(500);
const c1 = await pageB.evaluate(() => {
  const p = DB.getPersons().filter(x => x.id === 'p-cap')[0];
  return { p: p ? { nom: fullName(p), tel: p.tel } : null, toast: (document.getElementById('toast') || {}).textContent || '' };
});
log(/\.lexc$/.test(dl.suggestedFilename()) && /^\d{6}$/.test(c1pin) && c1.p && c1.p.nom === 'JUAN GOMEZ' && c1.p.tel === '3001112233'
    && /Te llegó del compañero/.test(c1.toast),
  '[C1] Por la pantalla: se guarda el archivo, se abre con la clave, se revisa y llega completo',
  dl.suggestedFilename() + ' · ' + (c1.p ? c1.p.nom : 'no llegó') + ' · «' + c1.toast + '»');

// [C2] Y B le pasa su víctima a A — el reparto de verdad, en los dos sentidos.
const c2 = await pasar(pageB, page, { p: ['p-vic'], c: [] });
const c2A = await page.evaluate(() => {
  const p = DB.getPersons().filter(x => x.id === 'p-vic')[0];
  return p ? { nom: fullName(p), escol: p.escol, n: DB.getPersons().length } : null;
});
log(c2.ok && c2.p.nuevos === 1 && c2A && c2A.nom === 'LUZ MARIN' && c2A.escol === 'Universitaria' && c2A.n === 2,
  '[C2] La víctima que registró el otro llega y los dos quedan con las dos personas', c2A ? (c2A.n + ' personas') : 'no llegó');

// [C3] LO QUE LLEGA NO BORRA NADA. A le añade el teléfono a la víctima; B le
//      añade el correo y se la vuelve a pasar. A acaba con los dos datos.
await page.evaluate(async () => {
  const a = DB.getPersons().slice();
  a.filter(p => p.id === 'p-vic')[0].tel = '3114445566';
  await DB.savePersons(a);
});
await pageB.evaluate(async () => {
  const a = DB.getPersons().slice();
  a.filter(p => p.id === 'p-vic')[0].correo = 'luz@correo.test';
  await DB.savePersons(a);
});
const c3 = await pasar(pageB, page, { p: ['p-vic'], c: [] });
const c3A = await page.evaluate(() => {
  const p = DB.getPersons().filter(x => x.id === 'p-vic')[0];
  return { tel: p.tel, correo: p.correo, n: DB.getPersons().length };
});
log(c3.ok && c3.p.actualizados === 1 && c3A.tel === '3114445566' && c3A.correo === 'luz@correo.test' && c3A.n === 2,
  '[C3] Recibir una corrección suma el dato nuevo y no borra el que ya había', c3A.tel + ' / ' + c3A.correo);

// [C4] Recibir lo mismo otra vez no duplica nada.
const c4 = await pasar(pageB, page, { p: ['p-vic'], c: [] });
log(c4.ok && c4.p.nuevos === 0 && c4.p.actualizados === 0,
  '[C4] Recibir lo mismo se confirma como «ya lo tenía», sin duplicar nada');

// [C5] Una CAPTURA entera también se puede pasar, y llega completa.
const casoId = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI');
  c.servidor = c.servidor || {};
  c.servidor.nombre = 'SERVIDOR DE A';
  await DB.saveCase(c);
  return c.id;
});
const c5 = await pasar(page, pageB, { p: [], c: [casoId] });
const c5B = await pageB.evaluate((id) => {
  const c = DB.getCase(id);
  return c ? { cap: (c.capturados || []).length, nunc: c.nunc } : null;
}, casoId);
log(c5.ok && c5.c.nuevos === 1 && c5B && c5B.cap > 0 && !!c5B.nunc,
  '[C5] Una captura completa llega al otro teléfono con todo lo que lleva dentro',
  c5B ? (c5B.cap + ' capturado(s)') : 'no llegó');

// [C6] …y el compañero puede generar SUS documentos con ella. El FPJ-5 sale byte
//      a byte igual en los dos teléfonos.
const huellaFpj = async (pg, id) => pg.evaluate(async (id) => {
  const o = await buildFPJBlob(DB.getCase(id));
  if (!o || !o.blob) return null;
  const u = new Uint8Array(await o.blob.arrayBuffer());
  let h = 0; for (let i = 0; i < u.length; i++) h = (h * 31 + u[i]) >>> 0;
  return { n: u.length, h };
}, id);
const c6 = await huellaFpj(page, casoId), c6B = await huellaFpj(pageB, casoId);
log(!!c6 && !!c6B && c6.n === c6B.n && c6.h === c6B.h,
  '[C6] El FPJ-5 de la captura recibida sale idéntico en los dos teléfonos', c6 ? (c6.n + ' B') : 'sin documento');

// [C7] QUIEN SUSCRIBE NO SE PISA. B pone su servidor; A le vuelve a pasar la
//      captura y el de B se queda: cada equipo firma con su funcionario.
await pageB.evaluate(async (id) => {
  const a = DB.getCases().slice(), c = a.filter(x => x.id === id)[0];
  c.servidor = c.servidor || {}; c.servidor.nombre = 'SERVIDOR DE B';
  await DB.saveCases(a);
}, casoId);
const c7 = await pasar(page, pageB, { p: [], c: [casoId] });
const c7B = await pageB.evaluate((id) => (DB.getCase(id).servidor || {}).nombre, casoId);
log(c7.ok && c7B === 'SERVIDOR DE B', '[C7] Recibir una captura no le cambia al compañero quién firma su informe', c7B);

// [C8] LA FIRMA MANUSCRITA NO VIAJA, y las bases de lo compartido entre cuentas
//      (`bzc`) tampoco: son de quien guarda la captura.
const c8 = await page.evaluate(async (id) => {
  await DB.saveFirma('perfil-1', { b64: 'iVBORw0KGgoAAAANSUhEUg==', ts: Date.now() });
  const a = DB.getCases().slice(), c = a.filter(x => x.id === id)[0];
  c.bzc = { 'uid-x': { b: { id: id }, t: Date.now() } }; await DB.saveCases(a);
  const t = JSON.stringify(ptPaquete(DB.getPersons(), [DB.getCase(id)]));
  return { firma: /iVBORw0KGgo|firmaB64|_firma/.test(t), bzc: /"bzc"/.test(t), guardada: !!DB.getFirma('perfil-1') };
}, casoId);
const c8B = await pageB.evaluate(async () => !!(await lcIdbGet('lc_firmas')) || Object.keys(_firmasCache || {}).length > 0);
log(!c8.firma && !c8.bzc && c8.guardada && !c8B,
  '[C8] Ni la firma manuscrita ni las bases de lo compartido viajan en el archivo');

// [C9] NO SE DUPLICA UNA PERSONA. La misma cédula registrada por los dos, cada
//      uno con su identificador: se pregunta, y por defecto es la misma.
await page.evaluate(async () => {
  await DB.savePerson({ id: 'mia-9', priNom: 'CARLOS', priApe: 'DIAZ', tipoDoc: 'CC', numDoc: '1128456789', tel: '3005550011' });
});
await pageB.evaluate(async () => {
  await DB.savePerson({ id: 'suya-7', priNom: 'CARLOS', priApe: 'DIAZ', tipoDoc: 'CC', numDoc: '1128456789', correo: 'carlos@correo.test' });
});
await pasar(pageB, page, { p: ['suya-7'], c: [] });
const c9 = await page.evaluate(() => {
  const con = DB.getPersons().filter(p => sinPuntos(p.numDoc || '') === '1128456789');
  return { n: con.length, id: con[0] && con[0].id, tel: con[0] && con[0].tel, correo: con[0] && con[0].correo };
});
log(c9.n === 1 && c9.id === 'mia-9' && c9.tel === '3005550011' && c9.correo === 'carlos@correo.test',
  '[C9] La misma persona no entra dos veces: se completa la ficha que ya estaba', c9.n + ' ficha · ' + c9.tel + ' + ' + c9.correo);

// [C10] …y si el funcionario dice que son DOS personas distintas, entran las dos.
await pageB.evaluate(async () => {
  await DB.savePerson({ id: 'suya-8', priNom: 'CARLOS A', priApe: 'DIAZ', tipoDoc: 'CC', numDoc: '1128456789' });
});
await pasar(pageB, page, { p: ['suya-8'], c: [] }, { dup: { 'suya-8': 'aparte' } });
const c10 = await page.evaluate(() => DB.getPersons().filter(p => sinPuntos(p.numDoc || '') === '1128456789').length);
log(c10 === 2, '[C10] Si el funcionario dice que son distintas, entran las dos', c10 + ' fichas');

// [C11] SE CONFIRMA ANTES DE IMPORTAR, y si se rechaza NO entra nada.
await pageB.evaluate(async () => {
  await DB.savePerson({ id: 'f7-no', priNom: 'NO', priApe: 'ENTRA', tipoDoc: 'CC', numDoc: '99887766' });
});
const c11env = await pasar(pageB, page, { p: ['f7-no'], c: [] }, { cancelar: true });
const c11 = await page.evaluate(() => DB.getPersons().filter(p => p.id === 'f7-no').length);
log(c11 === 0 && c11env.cancelado, '[C11] Lo que llega no entra hasta que se acepta');

// [C12] Un paquete malformado se rechaza con su motivo y no toca el almacén.
const f8 = await page.evaluate(async () => {
  const antesP = DB.getPersons().length, antesC = DB.getCases().length;
  const malos = [
    { lx: 'lexcapture', schemaVersion: 1, personas: [{ id: 'z', capturados: 'no-es-lista' }], casos: [] },
    { lx: 'lexcapture', schemaVersion: 1, personas: [], casos: [{ id: 'z2', capturados: 'texto' }] },
    { lx: 'lexcapture', schemaVersion: 1, personas: [{ priNom: 'SIN ID' }], casos: [] },
    { lx: 'lexcapture', schemaVersion: 99, personas: [], casos: [] },
    { lx: 'otra-app', schemaVersion: 1, personas: [], casos: [] },
    null, 42, 'texto suelto'
  ];
  const res = [];
  for (const m of malos) {
    const a = ptAbrirPaquete(m);
    let entro = 0;
    if (a.ok) { const r = await ptAplicarPaquete(a, {}); entro = r.p.nuevos + r.c.nuevos; }
    res.push({ ok: a.ok, motivo: a.motivo || '', rech: (a.rechazados || []).length, entro });
  }
  return { res, dP: DB.getPersons().length - antesP, dC: DB.getCases().length - antesC };
});
log(f8.dP === 0 && f8.dC === 0 && f8.res.every(r => !r.ok || r.rech > 0 || r.entro === 0),
  '[C12] Un paquete malformado se rechaza con su motivo y no toca el almacén',
  f8.res.filter(r => !r.ok).length + ' rechazados de ' + f8.res.length + ' · nada entró');
// [C13] Un registro desmedido o demasiado anidado se rechaza.
const f9 = await page.evaluate(() => {
  const enorme = { id: 'gordo', priNom: 'X'.repeat(600 * 1024) };
  const a = ptAbrirPaquete({ lx: 'lexcapture', schemaVersion: 1, personas: [enorme], casos: [] });
  const hondo = { id: 'hondo' }; let cur = hondo;
  for (let i = 0; i < 30; i++) { cur.mas = {}; cur = cur.mas; }
  const b = ptAbrirPaquete({ lx: 'lexcapture', schemaVersion: 1, personas: [hondo], casos: [] });
  return { gordo: a.personas.length === 0 && a.rechazados.length === 1,
           motivo: a.rechazados[0] && a.rechazados[0].motivo,
           hondo: b.personas.length === 0 && b.rechazados.length === 1 };
});
log(f9.gordo && f9.hondo, '[C13] Un registro desmedido o demasiado anidado se rechaza', f9.motivo);
// [C14] El archivo va CIFRADO, se abre con su clave y rechaza la equivocada.
const f10 = await page.evaluate(async () => {
  const p = { id: 'arch-1', priNom: 'ELENA', priApe: 'TORRES', tipoDoc: 'CC', numDoc: '77665544', tel: '3019998877' };
  const pin = ptClaveNumerica();
  const bytes = await ptArchivoCifrar(ptPaquete([p], []), pin);
  /* Que esté cifrado se comprueba buscando el dato dentro del archivo, no
     confiando en que la función se llame «cifrar». */
  let txt = ''; for (let i = 0; i < bytes.length; i++) txt += String.fromCharCode(bytes[i]);
  const bien = await ptArchivoAbrir(bytes.buffer, pin);
  const mal = await ptArchivoAbrir(bytes.buffer, pin === '000000' ? '111111' : '000000');
  const otra = await ptArchivoAbrir(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer, pin);
  return {
    pinOk: /^\d{6}$/.test(pin),
    claro: txt.indexOf('ELENA') >= 0 || txt.indexOf('77665544') >= 0,
    abre: bien.ok && bien.personas.length === 1 && bien.personas[0].priNom === 'ELENA',
    rechazaClave: !mal.ok, rechazaAjeno: !otra.ok, motivoAjeno: otra.motivo
  };
});
log(f10.pinOk && !f10.claro && f10.abre && f10.rechazaClave && f10.rechazaAjeno,
  '[C14] El archivo va cifrado, se abre con su clave y rechaza la equivocada',
  'clave de 6 dígitos · nada legible dentro');
// [C15] La pantalla y el buzón usan la MISMA revisión y la misma puerta.
const c15 = await page.evaluate(() => {
  const a = ptAbrirArchivoConClave.toString(), b = bzUiRevisar.toString();
  return { a: /ptConfirmarImportacion/.test(a) && /ptAplicarPaquete/.test(a),
           b: /ptConfirmarImportacion/.test(b) && /ptAplicarPaquete/.test(b) };
});
log(c15.a && c15.b, '[C15] El archivo y el buzón entran por la misma revisión y la misma puerta');

// [C16] El error de cámara dice qué HACER, no solo que falló.
const f13 = await page.evaluate(() => ({
  denegado: _ptCamMotivo({ name: 'NotAllowedError' }),
  ocupada: _ptCamMotivo({ name: 'NotReadableError' }),
  otro: _ptCamMotivo({ name: 'LoQueSea' })
}));
log(/ajustes del teléfono/.test(f13.denegado) && /Otra aplicación/.test(f13.ocupada) &&
    /archivo/i.test(f13.otro) && f13.denegado !== f13.ocupada,
  '[C16] Un fallo de cámara se explica y ofrece la salida', f13.ocupada);

/* ══════════════════════════════════════════════════════════════════════════
   D · LA PANTALLA
   ══════════════════════════════════════════════════════════════════════════ */

// [D1] «Modo compartir» ya no es un destino: enviar es la barra «Enviar a» de
//      Capturas y de Personas, y SE VE (se mide el rectángulo, no solo el DOM).
const d1 = await page.evaluate(() => {
  const medir = (pant, id) => { go(pant); const r = document.getElementById(id).getBoundingClientRect();
    return { alto: Math.round(r.height), ancho: Math.round(r.width), dentro: !!document.getElementById(id).closest('#main') }; };
  return { cap: medir('capturas', 'ev-capturas'), per: medir('personas', 'ev-personas'),
           pant: !!document.getElementById('screen-compartir'), item: !!document.querySelector('[data-screen="compartir"]'),
           enScreens: screens.indexOf('compartir') >= 0 };
});
log(!d1.pant && !d1.item && !d1.enScreens && d1.cap.dentro && d1.per.dentro && d1.cap.alto > 20 && d1.per.alto > 20 && d1.cap.ancho > 100,
  '[D1] Sin pantalla «Modo compartir»: «Enviar a» está en Capturas y en Personas y se dibuja',
  d1.cap.ancho + '×' + d1.cap.alto + ' · ' + d1.per.ancho + '×' + d1.per.alto + ' px');

// [D2] EL MENÚ DE LA CAPTURA NO LA NOMBRA: enviar se hace desde la barra, con
//      varias a la vez, no captura por captura.
const d2 = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); await DB.saveCase(c);
  go('capturas');
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('.cc-wrap .prow-more').click();
  await new Promise(r => setTimeout(r, 350));
  const sh = document.getElementById('act-sheet');
  const tit = [...document.querySelectorAll('#act-items .ti')].map(e => e.textContent.trim());
  const docs = lcEstadoDocs(c).map(d => d.lbl || d.nombre || '');
  const nombra = tit.filter(t => docs.some(d => d && t.indexOf(d) >= 0));
  const r = { tit, nombra, scroll: sh.scrollHeight > sh.clientHeight + 1,
              alto: sh.scrollHeight, comparte: tit.some(t => /compart|compañero|enviar a/i.test(t)) };
  closeSheet();
  return r;
});
log(!d2.comparte && d2.nombra.length === 0 && !d2.scroll,
  '[D2] El menú de la captura no ofrece compartir ni nombra ningún documento',
  d2.tit.join(' | '));

// [D3] Sin cuenta, el panel dice que vincular necesita la cuenta y ofrece el
//      archivo, y nada más: ni un código, ni una palabra del wifi.
const d3 = await page.evaluate(() => {
  evGestionar('p');
  const t = document.getElementById('ev-gest').innerText;
  const r = { ops: [...document.querySelectorAll('#ev-gest .pt-op .ti')].map(e => e.textContent.trim()),
              cuenta: /necesita la cuenta/.test(t), qr: !!document.querySelector('#ev-gest .pt-qr'),
              wifi: /wifi|zona wifi|misma red/i.test(t) };
  closeModal();
  return r;
});
log(d3.ops.length === 2 && d3.ops.every(t => /archivo/i.test(t)) && d3.cuenta && !d3.qr && !d3.wifi,
  '[D3] Sin cuenta, el panel ofrece el archivo y explica lo de la cuenta, sin rastro del wifi', d3.ops.join(' | '));

// [D4] La selección sobre la lista: «Todas» marca lo que se ve y, sin nada
//      marcado, «Guardar» no hace nada y lo dice.
const d4 = await page.evaluate(async () => {
  go('personas');
  evGestionar('p'); evArchivo();
  const filas = document.querySelectorAll('#pl .prow.ev-on').length;
  await evEnviar();
  const aviso = (document.getElementById('toast') || {}).textContent || '';
  evMarcarTodo('p');
  const marcadas = Object.keys(_evSel.ids).length === DB.getPersons().length;
  evMarcarTodo('p');
  const limpio = Object.keys(_evSel.ids).length === 0;
  evCancelar();
  return { filas, aviso, marcadas, limpio, fuera: _evSel === null };
});
log(d4.filas >= 1 && /Marca al menos/.test(d4.aviso) && d4.marcadas && d4.limpio && d4.fuera,
  '[D4] Se marca sobre la lista; sin nada marcado el archivo dice qué hacer', d4.filas + ' personas');

// [D5] NI UNA PALABRA TÉCNICA en la barra ni en el panel.
const d5 = await page.evaluate(() => {
  const malas = /\b(IP|puerto|socket|host|WebRTC|DataChannel|SDP|ICE|API|servidor|base de datos|token|payload|sesión|canal)\b/i;
  go('personas'); evGestionar('p');
  const t = document.getElementById('ev-personas').innerText + ' ' + document.getElementById('ev-gest').innerText;
  closeModal();
  const m = t.match(malas);
  return m ? m[0] : '';
});
log(!d5, '[D5] La barra y el panel no usan una sola palabra técnica', d5);

// [D7] Sistema visual: sin emojis y sin colores propios fuera de los tokens.
const bloqueCss = src.slice(src.indexOf('/* ═══ MODO COMPARTIR ═══'), src.indexOf('/* ═══ BANNER PWA ═══ */'));
const cssSinComentarios = bloqueCss.replace(/\/\*[\s\S]*?\*\//g, '');
const literales = (cssSinComentarios.match(/#[0-9a-fA-F]{3,6}\b/g) || []);
const emojis = await page.evaluate(() => {
  evGestionar('p');
  const e = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.getElementById('ev-gest').innerText);
  closeModal();
  return e;
});
/* ⚠️ Los únicos literales admitidos son blanco y negro PUROS, y los dos tienen
   motivo medido: un código se lee por contraste (en tema oscuro, uno claro sobre
   fondo oscuro no lo lee ninguna cámara) y el visor de la cámara es negro con
   texto blanco, igual que el que ya existe para las fotos de cédula. */
log(literales.length > 0 && literales.every(c => /^#(fff|000|ffffff|000000)$/i.test(c)) && !emojis,
  '[D7] El bloque visual usa tokens: sin emojis y sin ningún color propio',
  'solo blanco y negro (' + literales.length + ')');

// [D8] En los dos temas.
const d8 = await page.evaluate(() => {
  const medir = () => {
    evGestionar('p');
    const cs = getComputedStyle(document.querySelector('#ev-gest .pt-op'));
    const r = cs.color + ' sobre ' + cs.backgroundColor;
    closeModal();
    return r;
  };
  setTheme('dark'); const osc = medir();
  setTheme('light'); const cla = medir();
  setTheme('dark');
  return { osc, cla };
});
log(d8.osc !== d8.cla && !/rgba\(0, 0, 0, 0\)/.test(d8.osc),
  '[D8] La pantalla responde a los dos temas', d8.osc + ' | ' + d8.cla);

// [D9] El idioma: español de COLOMBIA y párrafos cortos (≤110 caracteres).
const d9 = await page.evaluate(() => {
  const peninsular = /\b(pod[ée]is|ten[ée]is|deb[ée]is|qued[áa]is|os\s+conect|vosotros|quer[áa]is|conectaros|vincularos)\b/i;
  const largos = [], malas = [];
  evGestionar('p');
  document.querySelectorAll('#ev-gest p, #ev-gest .de, #ev-personas').forEach(e => {
    const t = e.textContent.trim();
    if (t.length > 110) largos.push(t.slice(0, 60) + '…(' + t.length + ')');
    const m = t.match(peninsular); if (m) malas.push(m[0]);
  });
  closeModal();
  return { largos, malas };
});
log(d9.largos.length === 0 && d9.malas.length === 0,
  '[D9] Español de Colombia y ningún párrafo de más de 110 caracteres',
  (d9.malas.join(', ') + ' ' + d9.largos.join(' | ')).trim() || 'limpio');

// [D10] La franja del vínculo ya no existe: ni el elemento ni su relleno arriba.
const d10 = await page.evaluate(() => ({
  barra: !!document.getElementById('pt-barra'), pad: getComputedStyle(document.body).paddingTop,
  clase: document.body.classList.contains('pt') }));
log(!d10.barra && !d10.clase && d10.pad === '0px', '[D10] Sin franja de vínculo: nada tapa la barra superior', d10.pad);

/* ══════════════════════════════════════════════════════════════════════════
   E · EL MODO INDIVIDUAL, INTACTO, Y NI UN RESTO DE LO RETIRADO
   ══════════════════════════════════════════════════════════════════════════ */

// [E1] Guardar una captura no deja marcas del módulo.
const saveCaseSrc = src.slice(src.indexOf('saveCase: function('), src.indexOf('delCase: function('));
const e1 = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); await DB.saveCase(c);
  const g = DB.getCase(c.id); g.spoa = '123456'; await DB.saveCase(g);
  const d = DB.getCase(c.id);
  return { sinM: !('_m' in d) && !('_sync' in d), guardo: d.spoa === '123456' };
});
/* El único enganche que admite el guardado es el aviso al buzón (paso 3), por
   su nombre y con su guarda `typeof`. */
log(e1.sinM && e1.guardo && !/\bpt[A-Z]\w*\(/.test(saveCaseSrc) && /typeof bzAlGuardarCaso === 'function'/.test(saveCaseSrc),
  '[E1] El guardado de una captura no tiene ramas del módulo ni deja marcas');

// [E2] El formulario compara su huella con JSON.stringify a secas, como siempre.
const e2 = /_wizBase\s*=\s*JSON\.stringify\(wc\)/.test(src) && !/ptLimpio/.test(src);
log(e2, '[E2] El formulario vuelve a medir «sucio» con la huella de siempre');

// [E3] El módulo está AISLADO: fuera de él solo se le llama desde la navegación,
//      los manejadores de su propia pantalla y las dos consultas del buzón.
const antes = src.slice(0, src.indexOf('MODO COMPARTIR · LOS DATOS'));
const llamadas = [...antes.matchAll(/\b(pt[A-Z]\w*|renderCompartir)\s*\(/g)].map(m => m[1]);
const permitidas = ['ptScanCerrar',
  'ptArchivoElegido', 'ptImportarArchivo', 'ptConfAceptar', 'ptConfCancelar', 'ptConfDup',
  'ptAbrirArchivoConClave',
  /* El código de patrulla del Perfil (`lcComp*`) dibuja y lee con el mismo códec
     y el mismo lector: es un consumidor del lector, no una llamada al envío. */
  'ptQrSvg', 'ptScanAbrir'];
const intrusas = llamadas.filter(n => permitidas.indexOf(n) < 0);
log(intrusas.length === 0, '[E3] Fuera del módulo solo se le llama desde su pantalla',
  llamadas.length + ' llamadas' + (intrusas.length ? ' · intrusas: ' + intrusas.join(', ') : ''));

// [E4] Ningún motor documental sabe que esta capa existe.
const motor = src.slice(src.indexOf('function buildFPJBlob'), src.indexOf('function buildFPJBlob') + 40000);
log(!/\bpt[A-Z]\w*/.test(motor), '[E4] Ningún motor documental sabe que este módulo existe');

// [E5] No queda un solo resto del vínculo por wifi ni de lo que viajaba solo.
const restos = ['RTCPeerConnection', 'createDataChannel', 'iceServers', 'ptCrearInvitacion', 'ptResponderInvitacion',
  'ptAceptarRespuesta', 'ptEnviarRegistros', 'ptEstado', 'ptDesvincular', 'ptBarra', 'pt-barra', 'ptAutoDoc',
  'ptRecorte', 'ptPonerseAlDia', 'ptRecibirAuto', 'ptEstaCompartida', 'ptSuscritoCon', 'lcDocGuardado',
  'lcAlGuardarDoc', 'PT_SESION_MS', 'PT_INVIT_MS', 'ptSdpArmar', 'ptDescBytes', '--ok-band',
  /* y lo de la colaboración en vivo, retirada antes */
  'ptGuardarLocal', 'ptCompartido', 'ptTomarFoto', 'ptSello', 'ptObservar', 'ptDiff',
  'ptFusionar', 'ptSellarCaso', '_ptCola', '_ptSesion', 'ptPendientes', 'ptEstadoSellado',
  'ptAbrirPatrulla', 'renderPatrulla', 'lc_hlc'].filter(n => src.indexOf(n) >= 0);
log(restos.length === 0, '[E5] No queda ni un resto del vínculo por wifi ni de la colaboración en vivo', restos.join(', ') || 'limpio');

// [E6] Y la cola cifrada que usaba se purga del equipo al arrancar.
const e6 = await page.evaluate(() => {
  localStorage.setItem('lc_ptcola', 'basura');
  _lcPurgarPlantillas();
  return localStorage.getItem('lc_ptcola');
});
log(e6 === null, '[E6] La cola cifrada del modelo anterior se borra del equipo');

// [E7] La identidad del equipo se escribe UNA vez y no se regenera.
// ⚠️ Sustituye al check del modo invitado, que se retiró entero de la app. Lo
// que importa del mecanismo es que sea estable: si cambiara en cada arranque,
// los dos teléfonos dejarían de reconocerse entre envíos.
const e7 = await page.evaluate(() => {
  const foto = () => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, (localStorage.getItem(k) || '').length]));
  const uno = ptDeviceId();
  const antes = foto();
  _ptDev = null;                 // se olvida la copia en memoria
  const dos = ptDeviceId();      // y la vuelve a leer del equipo
  return { igual: antes === foto(), estable: uno === dos, fmt: /^d-/.test(uno) };
});
log(e7.igual && e7.estable && e7.fmt, '[E7] La identidad del equipo es estable y no se reescribe en cada lectura');

// [E8] La consola, limpia en los dos equipos.
log(errs.length === 0, '[E8] Consola sin errores en los dos teléfonos', errs.slice(0, 3).join(' · '));

console.log('\n' + R.filter(Boolean).length + '/' + R.length + ' comprobaciones');
await A.ctx.close(); await B.ctx.close();
await browser.close();
server.close();
process.exit(R.every(Boolean) ? 0 : 1);
