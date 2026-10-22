// Genera los archivos definitivos del icono a partir de la imagen del usuario.
//   icon.svg · icon-192.png · icon-512.png · icon-maskable-512.png
//   icon-store-512.png · los 15 PNG del lanzador de Android
//   y el logo del sidebar (se escribe directamente en LexCapture_v8.html).
//
// FUENTE: marca/logo-fuente.jpg (2026-10-22, elegido por el usuario): una F
// plateada biselada con un chulo de verificacion, sobre una baldosa azul, todo
// ello fotografiado sobre un fondo gris oscuro.
//
// ⚠️ NO se recorta la baldosa tal cual, por dos razones medidas:
//   1. Las esquinas del recorte traen el gris oscuro del fondo.
//   2. El chulo llega al 92% del radio de la baldosa: en el maskable (circulo
//      del 80%) y en el icono adaptativo de Android (72/108) quedaria cortado.
// Por eso se SEPARA la F y el chulo del fondo azul (sprite con transparencia,
// sombras incluidas) y se recomponen sobre el degradado del propio original,
// ajustado a la zona segura de cada formato. La composicion (la F un poco a la
// izquierda, el chulo abajo a la derecha) se conserva: se escala alrededor del
// centro de la baldosa, no se recentra.
//
// Si el usuario cambia la imagen, basta con reemplazar marca/logo-fuente.jpg:
// la baldosa, el degradado y el contenido se MIDEN, no estan escritos aqui.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = path.join(DIR, 'marca', 'logo-fuente.jpg');
if (!existsSync(FUENTE)) { console.error('ABORTA: falta ' + FUENTE); process.exit(1); }
const AND = path.join(DIR, '..', 'lexcapture-android', 'android', 'app', 'src', 'main', 'res');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');

// Todo el trabajo de imagen ocurre en un canvas dentro del navegador. Devuelve
// los PNG como base64 y las mediciones para el informe.
const R = await page.evaluate(async ({ b64, conAndroid }) => {
  const im = new Image();
  im.src = 'data:image/jpeg;base64,' + b64;
  await im.decode();
  const W = im.width, H = im.height;
  const src = document.createElement('canvas'); src.width = W; src.height = H;
  const sx = src.getContext('2d'); sx.drawImage(im, 0, 0);
  const D = sx.getImageData(0, 0, W, H).data;
  const px = (i, j) => { const k = (j * W + i) * 4; return [D[k], D[k + 1], D[k + 2]]; };
  const azul = ([r, , b]) => b - r > 35;
  const neutro = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) < 25 && r > 110;

  // --- 1. La baldosa: se mide por la fila y la columna centrales ----------
  let L = -1, Rr = -1, T = -1, B = -1;
  for (let i = 0; i < W; i++) if (azul(px(i, H >> 1))) { if (L < 0) L = i; Rr = i; }
  for (let j = 0; j < H; j++) if (azul(px(W >> 1, j))) { if (T < 0) T = j; B = j; }
  const cx = (L + Rr) / 2, cy = (T + B) / 2, lado = Math.max(Rr - L, B - T) + 1;
  let diag = 0; while (!azul(px(L + diag, T + diag))) diag++;
  const radio = diag * Math.SQRT2 / (Math.SQRT2 - 1);       // esquina redondeada

  // --- 2. El contenido (F + chulo): pixeles neutros dentro de la baldosa ---
  let c0 = W, c1 = 0, r0 = H, r1 = 0;
  for (let j = T; j <= B; j++) for (let i = L; i <= Rr; i++)
    if (neutro(px(i, j))) { if (i < c0) c0 = i; if (i > c1) c1 = i; if (j < r0) r0 = j; if (j > r1) r1 = j; }

  // --- 3. El fondo: plano de minimos cuadrados (c = a + b*x + c*y) ---------
  // ajustado con muestras de la baldosa lejos del contenido y de las esquinas.
  const M = 70;
  const mues = [];
  for (let j = T + 60; j <= B - 60; j += 12) for (let i = L + 60; i <= Rr - 60; i += 12) {
    if (i > c0 - M && i < c1 + M && j > r0 - M && j < r1 + M) continue;
    const dx = Math.max(0, Math.abs(i - cx) - (lado / 2 - radio)), dy = Math.max(0, Math.abs(j - cy) - (lado / 2 - radio));
    if (Math.hypot(dx, dy) > radio - 40) continue;
    mues.push([i, j, px(i, j)]);
  }
  const plano = [0, 1, 2].map(ch => {
    // ecuaciones normales 3x3
    let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
    for (const [i, j, c] of mues) {
      const x = (i - cx) / lado, y = (j - cy) / lado, f = [1, x, y];
      for (let a = 0; a < 3; a++) { v[a] += f[a] * c[ch]; for (let b = 0; b < 3; b++) S[a][b] += f[a] * f[b]; }
    }
    // Gauss
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) { const k = S[b][a] / S[a][a]; for (let c = a; c < 3; c++) S[b][c] -= k * S[a][c]; v[b] -= k * v[a]; }
    }
    const s = [0, 0, 0];
    for (let a = 2; a >= 0; a--) { let t = v[a]; for (let b = a + 1; b < 3; b++) t -= S[a][b] * s[b]; s[a] = t / S[a][a]; }
    return s;
  });
  const fondo = (x, y) => plano.map(p => Math.max(0, Math.min(255, p[0] + p[1] * x + p[2] * y)));
  let resid = 0;
  for (const [i, j, c] of mues) { const f = fondo((i - cx) / lado, (j - cy) / lado); resid += Math.abs(f[0] - c[0]) + Math.abs(f[1] - c[1]) + Math.abs(f[2] - c[2]); }
  resid /= mues.length * 3;

  // --- 4. Sprite: separar F, chulo y sus sombras del fondo azul ----------
  // El fondo es azul saturado y el contenido gris neutro, asi que la
  // "azulidad" (b - r) del pixel frente a la del fondo da el alfa; y el color
  // se des-mezcla: c = (p - (1-a)*fondo) / a. Una sombra (fondo oscurecido)
  // sale como negro semitransparente, que es exactamente lo que es.
  const PAD = 90;
  const sx0 = Math.max(L, c0 - PAD), sy0 = Math.max(T, r0 - PAD);
  const sw = Math.min(Rr, c1 + PAD) - sx0 + 1, sh = Math.min(B, r1 + PAD) - sy0 + 1;
  const spr = document.createElement('canvas'); spr.width = sw; spr.height = sh;
  const spx = spr.getContext('2d'); const out = spx.createImageData(sw, sh);
  // ⚠️ Fuera de la baldosa redondeada esta el gris del fondo de la foto, que
  // es tan neutro como la F: sin esta guarda entra en el sprite como contenido.
  const enBaldosa = (X, Y) => {
    const dx = Math.max(0, Math.abs(X - cx) - (lado / 2 - radio)), dy = Math.max(0, Math.abs(Y - cy) - (lado / 2 - radio));
    return Math.hypot(dx, dy) < radio - 12;
  };
  let lejos = 0;
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const X = sx0 + i, Y = sy0 + j, p = px(X, Y);
    if (!enBaldosa(X, Y)) continue;
    const f = fondo((X - cx) / lado, (Y - cy) / lado);
    const azF = f[2] - f[0], azP = p[2] - p[0];
    let a = azF > 1 ? (azF - azP) / azF : 0;
    a = Math.max(0, Math.min(1, a));
    if (a < 0.07) a = 0;                                    // ruido del fondo
    const k = (j * sw + i) * 4;
    if (a > 0) {
      for (let ch = 0; ch < 3; ch++) out.data[k + ch] = Math.max(0, Math.min(255, (p[ch] - (1 - a) * f[ch]) / a));
      out.data[k + 3] = Math.round(a * 255);
      if (a > 0.5) lejos = Math.max(lejos, Math.hypot(X - cx, Y - cy));
    }
  }
  spx.putImageData(out, 0, 0);

  // --- 5. Composicion ------------------------------------------------------
  // Escala = pixeles de salida por pixel de la fuente, alrededor del centro de
  // la baldosa. El reescalado se hace por mitades sucesivas: un drawImage de
  // 1500 a 48 px de un solo golpe sale con dientes.
  const reduce = (cv, w, h) => {
    let c = cv;
    while (c.width / 2 >= w && c.height / 2 >= h) {
      const n = document.createElement('canvas'); n.width = Math.round(c.width / 2); n.height = Math.round(c.height / 2);
      const nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(c, 0, 0, n.width, n.height); c = n;
    }
    return c;
  };
  const pintaFondo = (ctx, N, esc) => {
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const f = fondo(((i + .5 - N / 2) / esc) / lado, ((j + .5 - N / 2) / esc) / lado), k = (j * N + i) * 4;
      img.data[k] = f[0]; img.data[k + 1] = f[1]; img.data[k + 2] = f[2]; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  const pintaSprite = (ctx, N, esc) => {
    const w = sw * esc, h = sh * esc;
    const r = reduce(spr, Math.ceil(w), Math.ceil(h));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(r, N / 2 + (sx0 - cx) * esc, N / 2 + (sy0 - cy) * esc, w, h);
  };
  // forma: 'tile' (cuadrado redondeado, esquinas transparentes) · 'sangre' ·
  // 'circulo' · 'frente' (solo el sprite, sin fondo)
  const compone = (N, escRel, forma) => {
    const esc = escRel * N / 512;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    if (forma !== 'frente') {
      const f = document.createElement('canvas'); f.width = f.height = N;
      pintaFondo(f.getContext('2d'), N, esc);
      x.save(); x.beginPath();
      if (forma === 'tile') x.roundRect(0, 0, N, N, radio * esc);
      else if (forma === 'circulo') x.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2);
      else x.rect(0, 0, N, N);
      x.clip(); x.drawImage(f, 0, 0); x.restore();
    }
    pintaSprite(x, N, esc);
    return c.toDataURL('image/png').split(',')[1];
  };

  const ESC_TILE = 512 / lado;                        // la baldosa del usuario llena el icono
  const ESC_MASK = Math.min(ESC_TILE, 200 / lejos);   // circulo seguro del maskable: 204.8
  const ESC_ADAPT = Math.min(ESC_TILE, 166 / lejos);  // Android: 72/108 * 256 = 170.7

  const png = {};
  png['icon-192.png'] = compone(192, ESC_TILE, 'tile');
  png['icon-512.png'] = compone(512, ESC_TILE, 'tile');
  png['icon-maskable-512.png'] = compone(512, ESC_MASK, 'sangre');
  png['icon-store-512.png'] = compone(512, ESC_TILE, 'sangre');
  png['sidebar-96.png'] = compone(96, ESC_TILE, 'sangre');
  const and = {};
  if (conAndroid) {
    for (const [d, legado, frente] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
                                       ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
      and[d] = {
        ic_launcher: compone(legado, ESC_TILE, 'tile'),
        ic_launcher_round: compone(legado, ESC_MASK, 'circulo'),
        ic_launcher_foreground: compone(frente, ESC_ADAPT, 'frente'),
      };
    }
  }
  const fc = fondo(0, 0).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return {
    medidas: { W, H, L, R: Rr, T, B, lado, radio: Math.round(radio), contenido: [c0, c1, r0, r1],
               lejos: Math.round(lejos), resid: resid.toFixed(2), muestras: mues.length,
               ESC_TILE: ESC_TILE.toFixed(4), ESC_MASK: ESC_MASK.toFixed(4), ESC_ADAPT: ESC_ADAPT.toFixed(4),
               mask: (lejos * ESC_MASK).toFixed(1), adapt: (lejos * ESC_ADAPT).toFixed(1),
               radioIcono: (radio * ESC_TILE).toFixed(1) },
    png, and, fondoCentro: '#' + fc.toUpperCase(),
  };
}, { b64: readFileSync(FUENTE).toString('base64'), conAndroid: existsSync(AND) });
await browser.close();

const m = R.medidas;
console.log('  fuente ' + m.W + 'x' + m.H + ' · baldosa ' + m.lado + ' px, esquina r=' + m.radio +
            ' · contenido x ' + m.contenido[0] + '-' + m.contenido[1] + ' y ' + m.contenido[2] + '-' + m.contenido[3]);
console.log('  fondo: plano con ' + m.muestras + ' muestras, error medio ' + m.resid + ' niveles · centro ' + R.fondoCentro);
console.log('  contenido llega a ' + m.lejos + ' px del centro de la baldosa (' + (m.lejos / (m.lado / 2) * 100).toFixed(0) + '% del radio)');
console.log('  maskable: escala ' + m.ESC_MASK + ' -> ' + m.mask + ' de 204.8 px seguros');
console.log('  Android:  escala ' + m.ESC_ADAPT + ' -> ' + m.adapt + ' de 170.7 px seguros');
if (+m.mask > 204.8 || +m.adapt > 170.7) { console.error('ABORTA: se sale de la zona segura.'); process.exit(1); }

for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-store-512.png']) {
  const buf = Buffer.from(R.png[f], 'base64');
  writeFileSync(path.join(DIR, f), buf);
  console.log('  ' + f.padEnd(24) + buf.length + ' bytes');
}

// icon.svg: lo consumen el manifiesto, el Service Worker, el build de Android y
// el grafico de la ficha. Ya no es un dibujo vectorial: envuelve el PNG de 512.
const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">\n' +
  '  <image width="512" height="512" href="data:image/png;base64,' + R.png['icon-512.png'] + '"/>\n</svg>\n';
writeFileSync(path.join(DIR, 'icon.svg'), svg);
console.log('  icon.svg                ' + svg.length + ' bytes');

// Logo del sidebar: se reemplaza en el HTML. La caja (.sb-logo-wrap) ya
// redondea las esquinas, asi que va la version a sangre.
const HTML = path.join(DIR, 'LexCapture_v8.html');
const html = readFileSync(HTML, 'utf8');
const re = /(<div class="sb-logo-wrap"><img src=")data:image\/[^"]+(")/;
if (!re.test(html)) { console.error('ABORTA: no se encontro el logo del sidebar en el HTML.'); process.exit(1); }
writeFileSync(HTML, html.replace(re, '$1data:image/png;base64,' + R.png['sidebar-96.png'] + '$2'));
console.log('  logo del sidebar        ' + R.png['sidebar-96.png'].length + ' caracteres de base64');

// --- Lanzador de Android ----------------------------------------------------
// ⚠️ El icono que se ve en el telefono NO sale del manifiesto de la PWA: sale
// de los recursos del envoltorio, y solo llega al telefono con un .aab nuevo.
if (existsSync(AND)) {
  for (const [d, v] of Object.entries(R.and)) {
    for (const [n, b] of Object.entries(v)) writeFileSync(path.join(AND, 'mipmap-' + d, n + '.png'), Buffer.from(b, 'base64'));
    console.log('  mipmap-' + d);
  }
  // El fondo del icono adaptativo es un COLOR solido (lo referencia
  // mipmap-anydpi-v26/ic_launcher.xml): el del degradado en el centro.
  writeFileSync(path.join(AND, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">' + R.fondoCentro + '</color>\n</resources>\n');
  console.log('  ic_launcher_background -> ' + R.fondoCentro);
} else {
  console.log('  (envoltorio Android no encontrado: se omiten sus iconos)');
}
console.log('OK');
