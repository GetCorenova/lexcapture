// Genera los archivos definitivos del icono de Flagrante.
//   icon.svg · icon-192.png · icon-512.png · icon-maskable-512.png
//   icon-store-512.png · los 15 PNG del lanzador de Android
//   y el base64 del logo del sidebar.
//
// La F va dibujada como TRAZADOS: no depende de que ninguna fuente este
// instalada, ni en el telefono ni en el equipo que genere los PNG.
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Raiz del repositorio, no una ruta de una maquina concreta.
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const NAVY   = '#111E31';   // el azul de la propuesta del usuario
const ORO_HI = '#F3C983';   // brillo del laton, arriba
const ORO    = '#E8A54F';   // el --flag-2 del Design System, al medio
const ORO_LO = '#C0843A';   // sombra del laton, abajo

// Un SOLO degradado para todo el dibujo, en coordenadas del lienzo
// (userSpaceOnUse). Con el modo por defecto cada pieza de la F tendria su
// propio degradado y la letra se leeria partida en seis trozos.
const ORO_G = 'url(#oro)';
const DEFS =
  '  <defs>\n' +
  '    <linearGradient id="oro" gradientUnits="userSpaceOnUse" x1="256" y1="78" x2="256" y2="434">\n' +
  '      <stop offset="0" stop-color="' + ORO_HI + '"/>\n' +
  '      <stop offset=".46" stop-color="' + ORO + '"/>\n' +
  '      <stop offset="1" stop-color="' + ORO_LO + '"/>\n' +
  '    </linearGradient>\n' +
  '  </defs>\n';

// --- Letra: caja 206 x 226, seis piezas del mismo relleno ---
const PIEZAS = [
  [ 40,   0,  44, 226],  // asta
  [  6,   0, 200,  40],  // brazo alto
  [182,   0,  24,  62],  // terminal del brazo alto
  [ 40,  94, 134,  36],  // brazo medio
  [152,  94,  22,  54],  // terminal del brazo medio
  [  0, 204, 124,  22],  // serifa del pie
];
const F_W = 206, F_H = 226;
const RULE_W = 238, RULE_H = 24, AIRE = 34;   // la regla, MAS ANCHA que la letra
const OFF = (RULE_W - F_W) / 2;
const ESC = 0.88;

const n = (v) => (Math.round(v * 100) / 100).toString();

function marca(tinta, esc) {
  const totalH = F_H + AIRE + RULE_H;
  const x0 = 256 - (RULE_W * esc) / 2;
  const y0 = 256 - (totalH * esc) / 2;
  const r = (x, y, w, h, rx) =>
    '    <rect x="' + n(x0 + x * esc) + '" y="' + n(y0 + y * esc) +
    '" width="' + n(w * esc) + '" height="' + n(h * esc) + '"' +
    (rx ? ' rx="' + n(rx * esc) + '"' : '') + '/>';
  return '  <g fill="' + tinta + '">\n' +
    PIEZAS.map(p => r(p[0] + OFF, p[1], p[2], p[3])).join('\n') + '\n' +
    r(0, F_H + AIRE, RULE_W, RULE_H, 5) + '\n' +
    '  </g>';
}

// Encuadre: margen, grosor, largo del brazo y radio de la esquina.
const ENC = { m: 78, b: 17, l: 52, rr: 26 };

function encuadre(tinta, m, b, l, rr) {
  const M = 512 - m;
  const p = (d) => '    <path d="' + d + '"/>';
  return '  <g fill="none" stroke="' + tinta + '" stroke-width="' + b +
    '" stroke-linecap="round" stroke-linejoin="round">\n' +
    p('M' + m + ' ' + (m+l) + ' V' + (m+rr) + ' A' + rr + ' ' + rr + ' 0 0 1 ' + (m+rr) + ' ' + m + ' H' + (m+l)) + '\n' +
    p('M' + M + ' ' + (m+l) + ' V' + (m+rr) + ' A' + rr + ' ' + rr + ' 0 0 0 ' + (M-rr) + ' ' + m + ' H' + (M-l)) + '\n' +
    p('M' + m + ' ' + (M-l) + ' V' + (M-rr) + ' A' + rr + ' ' + rr + ' 0 0 0 ' + (m+rr) + ' ' + M + ' H' + (m+l)) + '\n' +
    p('M' + M + ' ' + (M-l) + ' V' + (M-rr) + ' A' + rr + ' ' + rr + ' 0 0 1 ' + (M-rr) + ' ' + M + ' H' + (M-l)) + '\n' +
    '  </g>';
}

// --- Graduaciones: el lado del encuadre ES una regla ---
// Van centradas en la MISMA recta que los brazos del encuadre, asi el borde
// se lee como una sola linea graduada y no como dos elementos superpuestos.
const REG = { paso: 22, n: 4, corto: 11, largo: 20, grosor: 4.5, punto: 4.5, dist: 148 };

function regla(tinta) {
  const m = ENC.m, M = 512 - m, R = REG;
  const seg = [], pt = [];
  for (let k = -R.n; k <= R.n; k++) {
    const p = 256 + k * R.paso;
    const h = (k === 0 ? R.largo : R.corto) / 2;
    seg.push([p, m - h, p, m + h], [p, M - h, p, M + h],
             [m - h, p, m + h, p], [M - h, p, M + h, p]);
  }
  for (const d of [R.dist, 512 - R.dist]) pt.push([d, m], [d, M], [m, d], [M, d]);
  return '  <g stroke="' + tinta + '" stroke-width="' + R.grosor + '">\n' +
    seg.map(s => '    <line x1="' + n(s[0]) + '" y1="' + n(s[1]) +
                 '" x2="' + n(s[2]) + '" y2="' + n(s[3]) + '"/>').join('\n') + '\n' +
    '  </g>\n' +
    '  <g fill="' + tinta + '">\n' +
    pt.map(p => '    <circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + R.punto + '"/>').join('\n') + '\n' +
    '  </g>';
}

// Marco exterior: concentrico con la baldosa (rx = 116 - 46). Es el CANTO de
// la baldosa, no parte del dibujo: por eso no viaja al maskable ni al icono
// adaptativo, donde la baldosa no existe y el marco lo pone la mascara.
const MARCO = '  <rect x="46" y="46" width="420" height="420" rx="70" fill="none" stroke="' +
  ORO_G + '" stroke-width="5" stroke-opacity=".82"/>';

const CAB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n';
const CUERPO = encuadre(ORO_G, ENC.m, ENC.b, ENC.l, ENC.rr) + '\n' +
               regla(ORO_G) + '\n' + marca(ORO_G, ESC);

// Escala del maskable. NO es un numero redondo elegido a ojo: es el mayor que
// deja la esquina del encuadre dentro de la zona segura. Ver la comprobacion.
const ESC_MASK = 0.81;

// Icono normal: baldosa redondeada + hilo blanco que define el canto sobre
// cualquier fondo de pantalla + marco dorado.
const SVG_ICONO = CAB +
  '  <!-- Flagrante · la F del procedimiento, sobre su regla de firma,\n' +
  '       dentro del encuadre graduado de la captura. -->\n' + DEFS +
  '  <rect width="512" height="512" rx="116" fill="' + NAVY + '"/>\n' +
  '  <rect x="11" y="11" width="490" height="490" rx="105" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>\n' +
  MARCO + '\n' + CUERPO + '\n</svg>\n';

// Maskable: fondo a sangre y TODO el dibujo al 81%, encuadre incluido, para
// que la esquina del encuadre caiga dentro de la zona segura (r = 204.8).
const SVG_MASK = CAB + DEFS +
  '  <rect width="512" height="512" fill="' + NAVY + '"/>\n' +
  '  <g transform="translate(256,256) scale(' + ESC_MASK + ') translate(-256,-256)">\n' +
  CUERPO + '\n  </g>\n</svg>\n';

// Ficha de Play: Google aplica SU PROPIO redondeo, asi que va a sangre y sin
// transparencia. Pero su mascara es un cuadrado redondeado generoso, no un
// circulo: cabe el dibujo entero a escala 1, marco dorado incluido.
const SVG_STORE = CAB + DEFS +
  '  <rect width="512" height="512" fill="' + NAVY + '"/>\n' +
  MARCO + '\n' + CUERPO + '\n</svg>\n';

writeFileSync(path.join(DIR, 'icon.svg'), SVG_ICONO);
console.log('  icon.svg          ' + SVG_ICONO.length + ' bytes');

// --- Comprobacion: el dibujo contra la zona segura del lanzador ---
// El punto mas lejano del centro NO es la coordenada (m,m) del trazado: la
// esquina es un arco de radio rr con un trazo de grosor b, asi que sobresale
// por la diagonal. Medirlo sin el trazo da 1.6 px de menos y el encuadre se
// sale sin que nada avise.
const centroArco = Math.SQRT2 * (256 - ENC.m - ENC.rr);
const extremo    = centroArco + ENC.rr + ENC.b / 2;
// Las graduaciones tambien se miden: la de mas afuera esta cerca de la esquina
// del recorrido, no en el centro del lado.
const tick = Math.hypot(REG.n * REG.paso + REG.grosor / 2, 256 - ENC.m + REG.corto / 2);
const dot  = Math.hypot(512 - REG.dist - 256, 256 - ENC.m) + REG.punto;
const lejos = Math.max(extremo, tick, dot);
console.log('  encuadre ' + extremo.toFixed(1) + ' · graduaciones ' + tick.toFixed(1) +
            ' · puntos ' + dot.toFixed(1) + ' px del centro');
console.log('  escala maxima que cabe: ' + (204.8 / lejos).toFixed(4) + '  ·  usada: ' + ESC_MASK);
console.log('  -> en el maskable queda a ' + (lejos * ESC_MASK).toFixed(1) +
            ' px (zona segura 204.8) -> ' + (lejos * ESC_MASK <= 204.8 ? 'CABE' : 'SE SALE'));
if (lejos * ESC_MASK > 204.8) { console.error('ABORTA: el dibujo se sale de la zona segura.'); process.exit(1); }

// --- PNG ---
const browser = await chromium.launch();
const pinta = async (src, size, file, dir) => {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent('<body style="margin:0;padding:0;background:transparent">' +
    src.replace('<svg ', '<svg width="' + size + '" height="' + size + '" style="display:block" ') +
    '</body>', { waitUntil: 'load' });
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(path.join(dir || DIR, file), buf);
  await page.close();
  return buf.length;
};

for (const s of [
  { file: 'icon-192.png',          size: 192, src: SVG_ICONO },
  { file: 'icon-512.png',          size: 512, src: SVG_ICONO },
  { file: 'icon-maskable-512.png', size: 512, src: SVG_MASK  },
  { file: 'icon-store-512.png',    size: 512, src: SVG_STORE },
]) {
  const b = await pinta(s.src, s.size, s.file);
  console.log('  ' + s.file.padEnd(24) + s.size + 'x' + s.size + '  ' + b + ' bytes');
}

// --- Iconos del lanzador de Android -------------------------------------
// ⚠️ El icono que se ve en el telefono NO sale del manifiesto de la PWA: sale
// de los recursos del envoltorio. Si esto no se genera, la app se instala con
// el logo por defecto de Capacitor.
//
// Icono adaptativo: la capa mide 108 dp y el sistema solo garantiza el
// cuadrado central de 72 dp. O sea que el dibujo tiene que caber en un circulo
// de 72/108 del lienzo — bastante mas estrecho que la zona segura de la PWA.
const AND = path.join(DIR, '..', 'lexcapture-android', 'android', 'app', 'src', 'main', 'res');
if (existsSync(AND)) {
  const radioSeguro = (72 / 108) * 256;                                       // 170.7
  const ESC_ADAPT = Math.floor((radioSeguro / lejos) * 1000) / 1000;
  console.log('\n  Android · escala de la capa frontal: ' + ESC_ADAPT +
              '  (' + (lejos * ESC_ADAPT).toFixed(1) + ' de ' + radioSeguro.toFixed(1) + ' px seguros)');

  const FRENTE = CAB + DEFS + '  <g transform="translate(256,256) scale(' + ESC_ADAPT +
    ') translate(-256,-256)">\n' + CUERPO + '\n  </g>\n</svg>\n';
  const REDONDO = CAB + DEFS +
    '  <clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath>\n' +
    '  <g clip-path="url(#c)"><rect width="512" height="512" fill="' + NAVY + '"/>\n' +
    '  <g transform="translate(256,256) scale(' + ESC_MASK + ') translate(-256,-256)">\n' +
    CUERPO + '\n  </g></g>\n</svg>\n';

  const DENS = [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
                ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]];
  for (const [d, legado, frente] of DENS) {
    await pinta(SVG_ICONO, legado, 'ic_launcher.png',            path.join(AND, 'mipmap-' + d));
    await pinta(REDONDO,   legado, 'ic_launcher_round.png',      path.join(AND, 'mipmap-' + d));
    await pinta(FRENTE,    frente, 'ic_launcher_foreground.png', path.join(AND, 'mipmap-' + d));
    console.log('  mipmap-' + d.padEnd(8) + ' ic_launcher ' + legado + '  ·  foreground ' + frente);
  }

  // El fondo del icono adaptativo venia en blanco (el de Capacitor por defecto)
  writeFileSync(path.join(AND, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">' + NAVY + '</color>\n</resources>\n');
  console.log('  ic_launcher_background -> ' + NAVY);
} else {
  console.log('\n  (envoltorio Android no encontrado: se omiten sus iconos)');
}

await browser.close();

// --- base64 del logo del sidebar ---
const b64 = Buffer.from(SVG_ICONO, 'utf8').toString('base64');
writeFileSync(path.join(DIR, '_icono_b64.txt'), b64);
console.log('  base64 del sidebar: ' + b64.length + ' caracteres');
console.log('OK');
