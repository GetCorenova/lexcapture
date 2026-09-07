/* MODO COMPARTIR — dos teléfonos se vinculan y se pasan registros ya
   diligenciados: personas y capturas. NO es colaboración en vivo dentro de un
   procedimiento; eso se retiró por decisión del usuario y esta suite comprueba
   además que no quedó ni un resto.

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
  await pg.fill('#pin-a', pin); await pg.fill('#pin-b', pin);
  await pg.click('button[onclick="doSetPin()"]');
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

// [A1] El descriptor se comprime y se vuelve a armar, y el navegador lo acepta.
const a1 = await page.evaluate(async () => {
  const pc = new RTCPeerConnection({ iceServers: [] });
  pc.createDataChannel('x');
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise(r => {
    if (pc.iceGatheringState === 'complete') return r();
    pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && r()); setTimeout(r, 3000);
  });
  const sdp = pc.localDescription.sdp, p = ptSdpPartes(sdp);
  const ida = ptDescBytes(p), vuelta = ptDescDeBytes(ida);
  const rearmado = ptSdpArmar(vuelta, true);
  let acepta = true;
  try { const pc2 = new RTCPeerConnection({ iceServers: [] }); await pc2.setRemoteDescription({ type: 'offer', sdp: rearmado }); pc2.close(); }
  catch (e) { acepta = false; }
  pc.close();
  return { acepta, sdpBytes: sdp.length, compBytes: ida.length,
           mismoUfrag: vuelta.ufrag === p.ufrag, mismaFp: vuelta.fp === p.fp, cands: vuelta.cands.length === p.cands.length };
});
log(a1.acepta && a1.mismoUfrag && a1.mismaFp && a1.cands,
  '[A1] El descriptor se comprime, se rearma y el navegador lo acepta',
  a1.sdpBytes + ' B → ' + a1.compBytes + ' B');

// [A2] El código entero cabe en un QR pequeño — que es lo que decide si se puede
//      leer a la distancia a la que dos personas se enseñan una pantalla.
const a2 = await page.evaluate(async () => {
  const inv = await ptCrearInvitacion();
  const m = ptQrMatriz(inv.bytes);
  ptDesvincular();
  return { bytes: inv.bytes.length, v: m.v, size: m.size };
});
log(a2.v <= 10, '[A2] El código de vínculo cabe en un QR pequeño',
  a2.bytes + ' B → versión ' + a2.v + ' (' + a2.size + '×' + a2.size + ' módulos)');

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

/* ══════════════════════════════════════════════════════════════════════════
   B · EL VÍNCULO ENTRE LOS DOS TELÉFONOS
   ══════════════════════════════════════════════════════════════════════════ */

/* Vínculo completo PASANDO POR EL CÓDIGO: se pinta, se dibuja en un lienzo y se
   vuelve a leer con el propio lector. No se pasan los bytes por debajo — si el
   códec se rompiera, esto tendría que fallar. */
const LEER = () => `(async (bytes) => {
  const svg = ptQrSvg(bytes, 320);
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
  const W = 400, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.drawImage(img, 40, 40, 320, 320);
  return ptQrLeer(g.getImageData(0, 0, W, W).data, W, W);
})`;
async function vincular() {
  const inv = await page.evaluate(async () => {
    const r = await ptCrearInvitacion();
    return r ? Array.from(r.bytes) : null;
  });
  if (!inv) return { ok: false, motivo: 'no se preparó el código' };
  const paso1 = await pageB.evaluate(async ([arr, leerSrc]) => {
    const leer = eval(leerSrc);
    const leido = await leer(Uint8Array.from(arr));
    if (!leido) return { ok: false, motivo: 'no se leyó el código' };
    const r = await ptResponderInvitacion(leido);
    if (!r.ok) return r;
    return { ok: true, bytes: Array.from(r.bytes) };
  }, [inv, LEER()]);
  if (!paso1.ok) return paso1;
  return await page.evaluate(async ([arr, leerSrc]) => {
    const leer = eval(leerSrc);
    const leido = await leer(Uint8Array.from(arr));
    if (!leido) return { ok: false, motivo: 'no se leyó la respuesta' };
    const r = await ptAceptarRespuesta(leido);
    if (!r.ok) return r;
    for (let i = 0; i < 100 && !ptEstado().activa; i++) await new Promise(t => setTimeout(t, 100));
    return { ok: ptEstado().activa };
  }, [paso1.bytes, LEER()]);
}

const b1 = await vincular();
log(b1.ok, '[B1] Los dos teléfonos quedan vinculados escaneando el código de verdad', b1.motivo || '');
await page.waitForTimeout(700);

// [B2] Cada lado sabe que al otro lado hay OTRO equipo, no un reflejo del propio.
const b2 = await page.evaluate(() => ({ par: ptEstado().par, mio: ptDeviceId() }));
const b2b = await pageB.evaluate(() => ({ par: ptEstado().par, mio: ptDeviceId() }));
log(!!b2.par && !!b2b.par && b2.par === b2b.mio && b2b.par === b2.mio && b2.mio !== b2b.mio,
  '[B2] Cada lado reconoce al equipo del compañero', b2.mio + ' ↔ ' + b2b.mio);

// [B3] La identidad no viaja en la configuración, que se exporta entre equipos.
const b3 = await page.evaluate(() => JSON.stringify(DB.getConfig()).indexOf(ptDeviceId()) < 0);
log(b3, '[B3] La identidad del equipo no entra en la configuración exportable');

// [B4] Un código caducado no abre nada.
const b4 = await pageB.evaluate(async () => {
  const sid = new Uint8Array([1, 2, 3, 4]), clave = new Uint8Array(32);
  const falsa = ptInvitacionBytes(sid, Date.now() - PT_INVIT_MS - 60000, clave,
    { ufrag: 'abcd', pwd: 'x'.repeat(24), fp: new Array(32).fill('AA').join(':'), cands: [] });
  return await ptResponderInvitacion(falsa);
});
log(!b4.ok && /caduc/.test(b4.motivo || ''), '[B4] Un código caducado se rechaza', b4.motivo);

// [B5] Y una respuesta que no salió de ESTE código, tampoco.
const b5 = await page.evaluate(async () => {
  const otra = new Uint8Array(32); crypto.getRandomValues(otra);
  const claveAjena = await ptSubclave(otra, 1);
  const bytes = await ptRespuestaBytes(_ptSid, Date.now(), claveAjena,
    { ufrag: 'zzzz', pwd: 'y'.repeat(24), fp: new Array(32).fill('BB').join(':'), cands: [] });
  /* ⚠️ Se levanta la guarda de «un código, una respuesta» para que lo que
     rechace aquí sea LA CLAVE y no esa otra regla: si no, este check pasaría por
     el motivo equivocado y dejaría de comprobar lo que dice. */
  const g = _ptEmparejado; _ptEmparejado = false;
  const r = await ptAceptarRespuesta(bytes);
  _ptEmparejado = g;
  return r;
});
log(!b5.ok && /no coincide/.test(b5.motivo || ''),
  '[B5] Una respuesta que no salió de este código se rechaza', b5.motivo);

// [B6] Un mensaje cifrado con otra clave se descarta sin tocar nada.
const b6 = await pageB.evaluate(async () => {
  const antes = DB.getPersons().length;
  const otra = new Uint8Array(32); crypto.getRandomValues(otra);
  const clave = await ptSubclave(otra, 2);
  const paq = await ptCifrar(clave, new TextEncoder().encode(JSON.stringify(
    { t: 'reg', k: 'p', d: { id: 'INTRUSO', priNom: 'INTRUSO' } })));
  await _ptRecibir(paq.buffer);
  const fin = await ptCifrar(clave, new TextEncoder().encode(JSON.stringify({ t: 'fin', id: 'x' })));
  await _ptRecibir(fin.buffer);
  await new Promise(r => setTimeout(r, 250));
  return { igual: DB.getPersons().length === antes, hay: !!DB.getPersons().filter(p => p.id === 'INTRUSO').length };
});
log(b6.igual && !b6.hay, '[B6] Un mensaje cifrado con otra clave se descarta sin guardar nada');

// [B7] UN código, UNA respuesta. Con el vínculo ya abierto un segundo código no
//      entra: es lo que cierra la puerta a un tercer equipo que alcanzara a
//      fotografiar la pantalla. ⚠️ Va DESPUÉS de [B5] a propósito: puesto antes,
//      aquel pasaría por este motivo y dejaría de comprobar lo que dice.
const b7 = await page.evaluate(async () => {
  const otra = new Uint8Array(32); crypto.getRandomValues(otra);
  const bytes = await ptRespuestaBytes(_ptSid || new Uint8Array([9, 9, 9, 9]), Date.now(),
    await ptSubclave(otra, 1),
    { ufrag: 'qqqq', pwd: 'z'.repeat(24), fp: new Array(32).fill('CC').join(':'), cands: [] });
  const r = await ptAceptarRespuesta(bytes);
  return { r, sigue: ptEstado().activa };
});
log(!b7.r.ok && /ya se usó/.test(b7.r.motivo || '') && b7.sigue,
  '[B7] Con el vínculo abierto, una segunda respuesta se rechaza', b7.r.motivo);

// [B8] Ni un servidor: el vínculo se establece sin STUN, TURN ni señalización.
const bloqueCanal = src.slice(src.indexOf('MODO COMPARTIR · EL VÍNCULO'), src.indexOf('MODO COMPARTIR · LA PANTALLA'));
log(/iceServers:\s*\[\]/.test(bloqueCanal) && !/stun:|turn:|fetch\(|XMLHttpRequest|WebSocket/.test(bloqueCanal),
  '[B8] El vínculo no usa ningún servidor: ni STUN, ni TURN, ni señalización');

/* ══════════════════════════════════════════════════════════════════════════
   C · COMPARTIR — EL REPARTO REAL DE LA PATRULLA

   Uno toma los datos del capturado y el otro los de la víctima, cada uno en SU
   teléfono. Después se los pasan y los dos los tienen.
   ══════════════════════════════════════════════════════════════════════════ */

const enviar = (pg, ids) => pg.evaluate(async (s) => {
  const personas = DB.getPersons().filter(p => s.p.indexOf(p.id) >= 0);
  const casos = DB.getCases().filter(c => s.c.indexOf(c.id) >= 0);
  return await new Promise((res) => {
    const r = ptEnviarRegistros(personas, casos, res);
    if (!r.ok) res({ ok: false, motivo: r.motivo });
  });
}, ids);

// A registra al capturado; B, a la víctima. Cada uno en su teléfono.
await page.evaluate(async () => {
  await DB.savePerson({ id: 'p-cap', priNom: 'JUAN', priApe: 'GOMEZ', tipoDoc: 'CC',
                        numDoc: '71234567', tel: '3001112233', ocup: 'Comerciante' });
});
await pageB.evaluate(async () => {
  await DB.savePerson({ id: 'p-vic', priNom: 'LUZ', priApe: 'MARIN', tipoDoc: 'CC',
                        numDoc: '43987654', escol: 'Universitaria' });
});

// [C1] A le pasa su capturado a B.
const c1 = await enviar(page, { p: ['p-cap'], c: [] });
await pageB.waitForTimeout(400);
const c1B = await pageB.evaluate(() => {
  const p = DB.getPersons().filter(x => x.id === 'p-cap')[0];
  return p ? { nom: fullName(p), tel: p.tel, ocup: p.ocup } : null;
});
log(c1.ok && c1.p.nuevos === 1 && c1B && c1B.nom === 'JUAN GOMEZ' && c1B.tel === '3001112233',
  '[C1] El capturado que registró uno llega completo al teléfono del otro', c1B ? c1B.nom : 'no llegó');

// [C2] Y B le pasa su víctima a A — el reparto de verdad, en los dos sentidos.
const c2 = await enviar(pageB, { p: ['p-vic'], c: [] });
await page.waitForTimeout(400);
const c2A = await page.evaluate(() => {
  const p = DB.getPersons().filter(x => x.id === 'p-vic')[0];
  return p ? { nom: fullName(p), escol: p.escol, n: DB.getPersons().length } : null;
});
log(c2.ok && c2A && c2A.nom === 'LUZ MARIN' && c2A.escol === 'Universitaria' && c2A.n === 2,
  '[C2] La víctima que registró el otro llega y los dos quedan con las dos personas', c2A ? (c2A.n + ' personas') : 'no llegó');

// [C3] LO QUE SE ENVÍA NO BORRA NADA. A le añade el teléfono a la víctima; B le
//      añade el correo y se la vuelve a mandar. A acaba con los dos datos.
//      ⚠️ Es la regla que hace que compartir sea seguro: un valor vacío del que
//      envía no pisa lo que el otro ya tenía escrito.
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
const c3 = await enviar(pageB, { p: ['p-vic'], c: [] });
await page.waitForTimeout(400);
const c3A = await page.evaluate(() => {
  const p = DB.getPersons().filter(x => x.id === 'p-vic')[0];
  return { tel: p.tel, correo: p.correo, escol: p.escol, n: DB.getPersons().length };
});
log(c3.ok && c3.p.actualizados === 1 && c3A.tel === '3114445566' && c3A.correo === 'luz@correo.test' && c3A.n === 2,
  '[C3] Recibir una corrección suma el dato nuevo y no borra el que ya había', c3A.tel + ' / ' + c3A.correo);

// [C3b] Y QUE HAYA LLEGADO SE VE. ⚠️ Recibir en silencio es indistinguible de no
//       recibir: la pantalla del que recibe nombra lo que entró.
const c3b = await pageB.evaluate(() => {
  ptAbrirCompartir();
  const t = document.getElementById('cp-pane').innerText;
  /* ⚠️ Sin distinguir mayúsculas: el sistema visual pinta los títulos de sección
     en versalitas, así que `innerText` devuelve el rótulo en mayúsculas. */
  return { hay: /te llegó del compañero/i.test(t), nombra: /JUAN GOMEZ/.test(t) };
});
log(c3b.hay && c3b.nombra, '[C3b] El que recibe ve en pantalla qué le llegó y de quién');

// [C4] El que envía se entera de lo que el compañero hizo con su envío — no lo
//      supone. «Enviado» tiene que significar «llegó y quedó guardado».
const c4 = await enviar(pageB, { p: ['p-vic'], c: [] });
log(c4.ok && c4.p.nuevos === 0 && c4.p.actualizados === 0,
  '[C4] Reenviar lo mismo se confirma como «ya lo tenía», sin duplicar nada');

// [C5] Una CAPTURA entera también se puede pasar, y llega completa.
const casoId = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI');
  c.servidor = c.servidor || {};
  c.servidor.nombre = 'SERVIDOR DE A';
  await DB.saveCase(c);
  return c.id;
});
const c5 = await enviar(page, { p: [], c: [casoId] });
await pageB.waitForTimeout(500);
const c5B = await pageB.evaluate((id) => {
  const c = DB.getCase(id);
  return c ? { cap: (c.capturados || []).length, nunc: c.nunc, srv: (c.servidor || {}).nombre } : null;
}, casoId);
log(c5.ok && c5.c.nuevos === 1 && c5B && c5B.cap > 0 && !!c5B.nunc,
  '[C5] Una captura completa llega al otro teléfono con todo lo que lleva dentro',
  c5B ? (c5B.cap + ' capturado(s)') : 'no llegó');

// [C6] …y el compañero puede generar SUS documentos con ella, que es para lo que
//      la necesita. El FPJ-5 sale byte a byte igual en los dos teléfonos.
const c6 = await page.evaluate(async (id) => {
  const o = await buildFPJBlob(DB.getCase(id));
  if (!o || !o.blob) return null;
  const u = new Uint8Array(await o.blob.arrayBuffer());
  let h = 0; for (let i = 0; i < u.length; i++) h = (h * 31 + u[i]) >>> 0;
  return { n: u.length, h };
}, casoId);
const c6B = await pageB.evaluate(async (id) => {
  const o = await buildFPJBlob(DB.getCase(id));
  if (!o || !o.blob) return null;
  const u = new Uint8Array(await o.blob.arrayBuffer());
  let h = 0; for (let i = 0; i < u.length; i++) h = (h * 31 + u[i]) >>> 0;
  return { n: u.length, h };
}, casoId);
log(!!c6 && !!c6B && c6.n === c6B.n && c6.h === c6B.h,
  '[C6] El FPJ-5 de la captura compartida sale idéntico en los dos teléfonos',
  c6 ? (c6.n + ' B') : 'sin documento');

// [C7] QUIEN SUSCRIBE NO SE PISA. B pone su servidor; A le vuelve a mandar la
//      captura y el de B se queda. ⚠️ Cada equipo firma con su funcionario:
//      recibir una corrección no puede poner el nombre de otro en un documento
//      que firma él.
await pageB.evaluate(async (id) => {
  const a = DB.getCases().slice(), c = a.filter(x => x.id === id)[0];
  c.servidor = c.servidor || {}; c.servidor.nombre = 'SERVIDOR DE B';
  await DB.saveCases(a);
}, casoId);
const c7 = await enviar(page, { p: [], c: [casoId] });
await pageB.waitForTimeout(400);
const c7B = await pageB.evaluate((id) => (DB.getCase(id).servidor || {}).nombre, casoId);
log(c7.ok && c7B === 'SERVIDOR DE B',
  '[C7] Recibir una captura no le cambia al compañero quién firma su informe', c7B);

// [C8] LA FIRMA MANUSCRITA NO VIAJA. Es un rasgo biométrico y con ella se
//      suscriben documentos judiciales: mandarla permitiría firmar por otro.
const c8 = await page.evaluate(async (id) => {
  await DB.saveFirma('perfil-1', { b64: 'iVBORw0KGgoAAAANSUhEUg==', ts: Date.now() });
  const c = ptParaEnviar(DB.getCase(id));
  const p = ptParaEnviar(DB.getPersons()[0]);
  const t = JSON.stringify(c) + JSON.stringify(p);
  return { enElCaso: /iVBORw0KGgo|firmaB64|_firma/.test(t), guardada: !!DB.getFirma('perfil-1') };
}, casoId);
const c8B = await pageB.evaluate(() => localStorage.getItem('lc_firmas'));
log(!c8.enElCaso && c8.guardada && !c8B,
  '[C8] La firma manuscrita no viaja: se queda cifrada en el teléfono de su dueño');

// [C9] Sin vínculo no se envía nada, y se dice por qué.
const c9 = await pageB.evaluate(() => {
  ptDesvincular();
  return ptEnviarRegistros(DB.getPersons(), [], null);
});
log(!c9.ok && /vínculo/.test(c9.motivo || ''), '[C9] Sin vínculo no se envía nada y se explica', c9.motivo);

// [C10] Desvincular no toca lo que ya se recibió: queda guardado como propio.
const c10 = await pageB.evaluate(() => ({
  personas: DB.getPersons().length, casos: DB.getCases().length, activa: ptEstado().activa
}));
log(!c10.activa && c10.personas === 2 && c10.casos === 1,
  '[C10] Desvincular cierra el vínculo, no lo recibido', c10.personas + ' personas · ' + c10.casos + ' captura');

// [C11] Un vínculo que lleva medio día parado no sigue vivo.
const c11 = await page.evaluate(async () => {
  _ptDesde = _ptVisto = Date.now() - PT_SESION_MS - 60000;
  const caducado = ptVinculoCaducado();
  ptDesvincular();
  return { caducado, activa: ptEstado().activa };
});
log(c11.caducado && !c11.activa, '[C11] Un vínculo parado medio día caduca y se cierra');

/* ══════════════════════════════════════════════════════════════════════════
   D · LA PANTALLA
   ══════════════════════════════════════════════════════════════════════════ */

// [D1] La pantalla existe, es un DESTINO PROPIO del panel lateral, y SE VE.
//      ⚠️ Se mide el rectángulo y no solo el contenido del DOM: una pantalla
//      insertada fuera del contenedor no se dibuja y todos los checks de
//      contenido seguirían en verde.
const d1 = await page.evaluate(() => {
  ptAbrirCompartir();
  const s = document.getElementById('screen-compartir');
  const r = s.getBoundingClientRect();
  const item = document.querySelector('.sb-item[data-screen="compartir"]');
  return { existe: !!s, dentro: !!s.closest('#main'), alto: Math.round(r.height), ancho: Math.round(r.width),
           enPanel: !!item, rotulo: item ? item.textContent.trim() : '',
           enScreens: screens.indexOf('compartir') >= 0 };
});
log(d1.existe && d1.dentro && d1.alto > 200 && d1.ancho > 200 && d1.enPanel && d1.enScreens && /Modo compartir/.test(d1.rotulo),
  '[D1] «Modo compartir» es un destino del panel lateral y la pantalla se dibuja',
  d1.ancho + '×' + d1.alto + ' px · «' + d1.rotulo + '»');

// [D2] EL MENÚ DE LA CAPTURA NO LA NOMBRA. Compartir no es una acción de una
//      captura: lo que se le pasa al compañero son sobre todo personas, que
//      muchas veces todavía no están en ninguna.
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
              alto: sh.scrollHeight, comparte: tit.some(t => /compart|compañero/i.test(t)) };
  closeSheet();
  return r;
});
log(!d2.comparte && d2.nombra.length === 0 && !d2.scroll,
  '[D2] El menú de la captura no ofrece compartir ni nombra ningún documento',
  d2.tit.join(' | '));

// [D3] Sin vínculo, la pantalla ofrece las DOS mitades y ninguna más.
const d3 = await page.evaluate(() => {
  ptAbrirCompartir();
  return [...document.querySelectorAll('#cp-pane .pt-op .ti')].map(e => e.textContent.trim());
});
log(d3.length === 2 && /Mostrar el código/.test(d3[0]) && /Escanear/.test(d3[1]),
  '[D3] Sin vínculo se ofrece mostrar el código o escanear el del compañero', d3.join(' | '));

// [D4] El código que se enseña ES legible: se vuelve a leer de la propia pantalla.
const d4 = await page.evaluate(async ([leerSrc]) => {
  await ptUiMostrar();
  const svg = document.querySelector('#cp-pane .pt-qr svg');
  if (!svg) return { ok: false, e: 'no se pintó' };
  const leer = eval(leerSrc);
  const leido = await leer(_ptUiBytes);
  const cuenta = (document.getElementById('pt-cuenta') || {}).textContent || '';
  const cab = leido ? ptQrLeeCabecera(leido) : null;
  ptUiCancelar();
  return { ok: !!(cab && cab.rol === 0), cuenta };
}, [LEER()]);
log(d4.ok && /Caduca en \d/.test(d4.cuenta),
  '[D4] El código de la pantalla se lee de verdad y dice cuánto le queda', d4.cuenta);

// [D5] Vinculados: se listan personas y capturas, se marcan, y el botón cuenta.
const d5 = await page.evaluate(() => {
  /* Se pinta el estado «vinculado» sin canal para medir la pantalla, que es lo
     que este check mira; el envío por el canal ya lo miden [C1]-[C7]. */
  _ptUiPaso = 'vinculado';
  const est = { activa: true, rol: 0, par: 'd-x', desde: Date.now(), enviando: 0, recibido: [] };
  document.getElementById('cp-pane').innerHTML = _ptUiVinculado(est);
  const items = document.querySelectorAll('#cp-pane .cp-it');
  const grupos = [...document.querySelectorAll('#cp-pane .card .st')].map(e => e.textContent.trim());
  const antes = document.getElementById('cp-enviar').disabled;
  const id = _ptRegistros('p')[0].id;
  ptUiMarcar('p', id, true);
  document.getElementById('cp-pane').innerHTML = _ptUiVinculado(est);
  const btn = document.getElementById('cp-enviar');
  const r = { items: items.length, grupos, antes, texto: btn.textContent.trim(), activo: !btn.disabled };
  _ptSel = { p: {}, c: {} }; _ptUiPaso = 'inicio'; renderCompartir();
  return r;
});
log(d5.items >= 3 && d5.grupos.indexOf('Personas') >= 0 && d5.grupos.indexOf('Capturas') >= 0
    && d5.antes && d5.activo && /\(1\)/.test(d5.texto),
  '[D5] Vinculados se listan personas y capturas, se marcan y el botón las cuenta',
  d5.items + ' registros · «' + d5.texto + '»');

// [D6] NI UNA PALABRA TÉCNICA en la pantalla, en ninguno de sus estados.
const d6 = await page.evaluate(() => {
  const malas = /\b(IP|puerto|socket|host|WebRTC|DataChannel|SDP|ICE|API|servidor|base de datos|token|payload|sesión|canal)\b/i;
  const sitios = [];
  ptAbrirCompartir();
  sitios.push(document.getElementById('screen-compartir').innerText);
  _ptUiPaso = 'mostrando'; renderCompartir(); sitios.push(document.getElementById('cp-pane').innerText);
  _ptUiPaso = 'respondiendo'; renderCompartir(); sitios.push(document.getElementById('cp-pane').innerText);
  _ptUiPaso = 'vinculado';
  document.getElementById('cp-pane').innerHTML = _ptUiVinculado({ activa: true, enviando: 0, recibido: [] });
  sitios.push(document.getElementById('cp-pane').innerText);
  _ptUiPaso = 'inicio'; renderCompartir();
  return sitios.map(t => (t.match(malas) || [null])[0]).filter(Boolean);
});
log(d6.length === 0, '[D6] La pantalla no usa una sola palabra técnica', d6.join(', '));

// [D7] Sistema visual: sin emojis y sin colores propios fuera de los tokens.
const bloqueCss = src.slice(src.indexOf('/* ═══ MODO COMPARTIR ═══'), src.indexOf('/* ═══ BANNER MODO INVITADO ═══'));
const cssSinComentarios = bloqueCss.replace(/\/\*[\s\S]*?\*\//g, '');
const literales = (cssSinComentarios.match(/#[0-9a-fA-F]{3,6}\b/g) || []);
const emojis = await page.evaluate(() => {
  ptAbrirCompartir();
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.getElementById('screen-compartir').innerText);
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
    ptAbrirCompartir();
    const cs = getComputedStyle(document.querySelector('#cp-pane .pt-op'));
    return cs.color + ' sobre ' + cs.backgroundColor;
  };
  setTheme('dark'); const osc = medir();
  setTheme('light'); const cla = medir();
  setTheme('dark');
  return { osc, cla };
});
log(d8.osc !== d8.cla && !/rgba\(0, 0, 0, 0\)/.test(d8.osc),
  '[D8] La pantalla responde a los dos temas', d8.osc + ' | ' + d8.cla);

// [D9] El idioma: español de COLOMBIA y párrafos cortos.
//      ⚠️ Un «podéis» es español peninsular y hace que la aplicación suene ajena
//      a quien la usa; y ningún párrafo pasa de 110 caracteres, que es el límite
//      que fijó la Mejora 6 para que los avisos se sigan leyendo.
const d9 = await page.evaluate(() => {
  const peninsular = /\b(pod[ée]is|ten[ée]is|deb[ée]is|qued[áa]is|os\s+conect|vosotros|quer[áa]is|conectaros|vincularos)\b/i;
  const largos = [], malas = [];
  const mirar = () => {
    document.querySelectorAll('#screen-compartir p, #screen-compartir .de, #screen-compartir .pe-de, #screen-compartir .cp-de')
      .forEach(e => {
        const t = e.textContent.trim();
        if (t.length > 110) largos.push(t.slice(0, 60) + '…(' + t.length + ')');
        const m = t.match(peninsular); if (m) malas.push(m[0]);
      });
  };
  ptAbrirCompartir(); mirar();
  _ptUiPaso = 'mostrando'; renderCompartir(); mirar();
  _ptUiPaso = 'respondiendo'; renderCompartir(); mirar();
  _ptUiPaso = 'vinculado';
  document.getElementById('cp-pane').innerHTML = _ptUiVinculado({ activa: true, enviando: 0, recibido: [] });
  mirar();
  _ptUiPaso = 'inicio'; renderCompartir();
  return { largos, malas };
});
log(d9.largos.length === 0 && d9.malas.length === 0,
  '[D9] Español de Colombia y ningún párrafo de más de 110 caracteres',
  (d9.malas.join(', ') + ' ' + d9.largos.join(' | ')).trim() || 'limpio');

// [D10] La franja solo aparece cuando hay vínculo, y dice qué pasa.
const d10 = await page.evaluate(() => {
  ptDesvincular(); ptBarra();
  const oculta = !document.getElementById('pt-barra').classList.contains('on');
  const guarda = _ptCanal;
  _ptCanal = { readyState: 'open' };            // se simula el vínculo abierto
  ptBarra();
  const b = document.getElementById('pt-barra');
  const r = { oculta, visible: b.classList.contains('on'), txt: b.querySelector('.pb-txt').innerText,
              pad: getComputedStyle(document.body).paddingTop };
  _ptCanal = guarda; ptBarra();
  return r;
});
log(d10.oculta && d10.visible && /Vinculado con el compañero/.test(d10.txt) && d10.pad !== '0px',
  '[D10] La franja aparece solo con el vínculo abierto y dice qué pasa', d10.txt);

/* ══════════════════════════════════════════════════════════════════════════
   E · EL MODO INDIVIDUAL, INTACTO

   La colaboración en vivo se retiró entera. Estos checks miden que no quedó ni
   un resto y que el guardado, el formulario y los documentos volvieron a ser
   exactamente los de antes.
   ══════════════════════════════════════════════════════════════════════════ */

// [E1] `DB.saveCase` no tiene ninguna rama del módulo, y guardar no deja marcas.
const saveCaseSrc = src.slice(src.indexOf('saveCase: function('), src.indexOf('delCase: function('));
const e1 = await page.evaluate(async () => {
  const c = SIM.genFlagrancia('URI'); await DB.saveCase(c);
  const g = DB.getCase(c.id); g.spoa = '123456'; await DB.saveCase(g);
  const d = DB.getCase(c.id);
  return { sinM: !('_m' in d), guardo: d.spoa === '123456' };
});
log(e1.sinM && e1.guardo && !/\bpt[A-Z]\w*\(/.test(saveCaseSrc),
  '[E1] El guardado de una captura no tiene ni una rama del módulo ni deja marcas');

// [E2] El formulario compara su huella con JSON.stringify a secas, como siempre.
const e2 = /_wizBase\s*=\s*JSON\.stringify\(wc\)/.test(src) && !/ptLimpio/.test(src);
log(e2, '[E2] El formulario vuelve a medir «sucio» con la huella de siempre');

// [E3] El módulo está AISLADO: fuera de él solo se le llama desde la navegación.
const antes = src.slice(0, src.indexOf('MODO COMPARTIR · LOS DATOS'));
const llamadas = [...antes.matchAll(/\b(pt[A-Z]\w*|renderCompartir)\s*\(/g)].map(m => m[1]);
const permitidas = ['ptAbrirCompartir', 'renderCompartir', 'ptScanCerrar', 'ptUiMostrar', 'ptUiEscanear', 'ptUiMarcar', 'ptUiEnviar', 'ptUiCancelar', 'ptUiDesvincular', 'ptUiDesvincularSi', 'ptUiEscanearRespuesta', 'ptUiMarcarTodo'];
const intrusas = llamadas.filter(n => permitidas.indexOf(n) < 0);
log(intrusas.length === 0,
  '[E3] Fuera del módulo solo se le llama desde la navegación y la pantalla',
  llamadas.length + ' llamadas: ' + [...new Set(llamadas)].join(', '));

// [E4] Ningún motor documental sabe que esta capa existe.
const motor = src.slice(src.indexOf('function buildFPJBlob'), src.indexOf('function buildFPJBlob') + 40000);
log(!/\bpt[A-Z]\w*/.test(motor), '[E4] Ningún motor documental sabe que este módulo existe');

// [E5] No queda un solo resto de la colaboración en vivo.
const restos = ['ptGuardarLocal', 'ptCompartido', 'ptTomarFoto', 'ptSello', 'ptObservar', 'ptDiff',
                'ptFusionar', 'ptSellarCaso', '_ptCola', '_ptSesion', 'ptPendientes', 'ptEstadoSellado',
                'ptAbrirPatrulla', 'renderPatrulla', 'lc_hlc'].filter(n => src.indexOf(n) >= 0);
log(restos.length === 0, '[E5] No queda ni un resto de la colaboración en vivo', restos.join(', ') || 'limpio');

// [E6] Y la cola cifrada que usaba se purga del equipo al arrancar.
const e6 = await page.evaluate(() => {
  localStorage.setItem('lc_ptcola', 'basura');
  _lcPurgarPlantillas();
  return localStorage.getItem('lc_ptcola');
});
log(e6 === null, '[E6] La cola cifrada del modelo anterior se borra del equipo');

// [E7] Modo invitado: la identidad no escribe un byte.
const e7 = await page.evaluate(() => {
  const foto = () => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, (localStorage.getItem(k) || '').length]));
  const antes = foto();
  const g = _guest, dev = _ptDev;
  _guest = true; _ptDev = null;
  const id = ptDeviceId();
  const despues = foto();
  _guest = g; _ptDev = dev;
  return { igual: antes === despues, fmt: /^g-/.test(id) };
});
log(e7.igual && e7.fmt, '[E7] En modo invitado no se escribe un solo byte en el equipo');

// [E8] La consola, limpia en los dos equipos.
log(errs.length === 0, '[E8] Consola sin errores en los dos teléfonos', errs.slice(0, 3).join(' · '));

console.log('\n' + R.filter(Boolean).length + '/' + R.length + ' comprobaciones');
await A.ctx.close(); await B.ctx.close();
await browser.close();
server.close();
process.exit(R.every(Boolean) ? 0 : 1);
