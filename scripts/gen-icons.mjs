// Genera los archivos definitivos del icono.
//   icon.svg · icon-192.png · icon-512.png · icon-maskable-512.png
//   icon-store-512.png · los 15 PNG del lanzador de Android
//   y el base64 del logo del sidebar.
//
// ⚠️ El dibujo es el ORIGINAL de la app: monograma de barras redondeadas
// ambar dentro del marco de visor de captura cian, con el punto de captura
// activa arriba, sobre la baldosa azul. Lo UNICO que cambio al renombrar la
// app fue la letra: la L paso a ser F. Colores, marco, punto, degradados y
// geometria son los mismos byte a byte — ver `git show 6519f08:icon.svg`.
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Raiz del repositorio, no una ruta de una maquina concreta.
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFS =
  '  <defs>\n' +
  '    <linearGradient id="bg" x1="80" y1="40" x2="440" y2="480" gradientUnits="userSpaceOnUse">\n' +
  '      <stop offset="0" stop-color="#16273f"/>\n' +
  '      <stop offset="1" stop-color="#0a1120"/>\n' +
  '    </linearGradient>\n' +
  '    <linearGradient id="amber" x1="180" y1="150" x2="330" y2="380" gradientUnits="userSpaceOnUse">\n' +
  '      <stop offset="0" stop-color="#fbbf24"/>\n' +
  '      <stop offset="1" stop-color="#d97706"/>\n' +
  '    </linearGradient>\n' +
  '    <linearGradient id="cyan" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">\n' +
  '      <stop offset="0" stop-color="#22d3ee"/>\n' +
  '      <stop offset="1" stop-color="#00a7b8"/>\n' +
  '    </linearGradient>\n' +
  '  </defs>\n';

// Visor de captura: cuatro escuadras, trazo 24, esquina en curva de radio 24.
const VF_B = 24;
const VISOR =
  '  <!-- Visor / marco de captura -->\n' +
  '  <g fill="none" stroke="url(#cyan)" stroke-width="' + VF_B + '" stroke-linecap="round">\n' +
  '    <path d="M126 176 V150 Q126 126 150 126 H176"/>\n' +
  '    <path d="M386 176 V150 Q386 126 362 126 H336"/>\n' +
  '    <path d="M126 336 V362 Q126 386 150 386 H176"/>\n' +
  '    <path d="M386 336 V362 Q386 386 362 386 H336"/>\n' +
  '  </g>\n' +
  '  <!-- Punto de captura activa -->\n' +
  '  <circle cx="256" cy="126" r="9" fill="url(#cyan)"/>';

// El monograma. La L original eran dos barras: asta 58x178 y pie 118x58.
// La F son tres, con el mismo redondeo (16) y la misma caja: asta, brazo alto
// y brazo medio, este mas corto.
// ⚠️ Los BRAZOS van a 50 y el asta se queda en 58. No es una incoherencia: una
// F mete TRES barras donde la L metia dos, y con las tres a 58 los huecos
// bajan a 34 y 44 y la letra se lee pellizcada (comprobado mirando el render a
// 512, no a tamanio de miniatura). Adelgazar los trazos horizontales respecto
// del vertical es ademas la compensacion optica de cualquier tipografia.
const LETRA =
  '  <!-- Monograma F -->\n' +
  '  <g fill="url(#amber)">\n' +
  '    <rect x="212" y="160" width="58" height="194" rx="16"/>\n' +
  '    <rect x="212" y="160" width="118" height="50" rx="16"/>\n' +
  '    <rect x="212" y="252" width="96" height="50" rx="16"/>\n' +
  '  </g>';

const CAB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n';
const CUERPO = VISOR + '\n' + LETRA;
const FONDO_TILE =
  '  <rect width="512" height="512" rx="116" fill="url(#bg)"/>\n' +
  '  <rect x="10" y="10" width="492" height="492" rx="108" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="2"/>';
const FONDO_SANGRE = '  <rect width="512" height="512" fill="url(#bg)"/>';

// --- Cuanto se aleja del centro el punto mas exterior del dibujo -----------
// La esquina del visor es una curva de Bezier cuadratica, no un arco de
// circunferencia: se MUESTREA en vez de aplicarle la formula del arco, que
// da un valor por debajo del real (la curva sobresale un pelo mas).
const bez = (p0, p1, p2, t) => {
  const u = 1 - t;
  return [u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0], u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1]];
};
let visor = 0;
for (let i = 0; i <= 200; i++) {
  const q = bez([126, 150], [126, 126], [150, 126], i / 200);
  visor = Math.max(visor, Math.hypot(256 - q[0], 256 - q[1]));
}
visor += VF_B / 2;                                        // el trazo sobresale
const punto = (256 - 126) + 9;                            // el circulo de arriba
const letra = Math.hypot(330 - 256, 256 - 160);           // esquina de la F
const lejos = Math.max(visor, punto, letra);
console.log('  visor ' + visor.toFixed(1) + ' · punto ' + punto.toFixed(1) +
            ' · letra ' + letra.toFixed(1) + ' px del centro');

// El maskable garantiza un circulo de r = 204.8 (80% del diametro). Este
// dibujo CABE ENTERO sin encoger: el visor esta muy adentro. Se deja a 1
// para que el icono se vea igual en todas partes, y el guard lo comprueba.
const ESC_MASK = Math.min(1, Math.floor((204.8 / lejos) * 1000) / 1000);
console.log('  maskable: escala ' + ESC_MASK + ' -> ' + (lejos * ESC_MASK).toFixed(1) +
            ' de 204.8 px seguros -> ' + (lejos * ESC_MASK <= 204.8 ? 'CABE' : 'SE SALE'));
if (lejos * ESC_MASK > 204.8) { console.error('ABORTA: se sale de la zona segura.'); process.exit(1); }

const escalado = (s) => s === 1 ? CUERPO :
  '  <g transform="translate(256,256) scale(' + s + ') translate(-256,-256)">\n' + CUERPO + '\n  </g>';

const SVG_ICONO = CAB + DEFS + FONDO_TILE + '\n' + CUERPO + '\n</svg>\n';
const SVG_MASK  = CAB + DEFS + FONDO_SANGRE + '\n' + escalado(ESC_MASK) + '\n</svg>\n';
// Ficha de Play: Google aplica SU PROPIO redondeo, asi que va a sangre y sin
// transparencia. Subir el redondeado lo redondea dos veces.
const SVG_STORE = CAB + DEFS + FONDO_SANGRE + '\n' + CUERPO + '\n</svg>\n';

writeFileSync(path.join(DIR, 'icon.svg'), SVG_ICONO);
console.log('  icon.svg          ' + SVG_ICONO.length + ' bytes');

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
  const radioSeguro = (72 / 108) * 256;                                   // 170.7
  const ESC_ADAPT = Math.min(1, Math.floor((radioSeguro / lejos) * 1000) / 1000);
  console.log('\n  Android · escala de la capa frontal: ' + ESC_ADAPT +
              '  (' + (lejos * ESC_ADAPT).toFixed(1) + ' de ' + radioSeguro.toFixed(1) + ' px seguros)');

  const FRENTE  = CAB + DEFS + escalado(ESC_ADAPT) + '\n</svg>\n';
  const REDONDO = CAB + DEFS +
    '  <clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath>\n' +
    '  <g clip-path="url(#c)">\n' + FONDO_SANGRE + '\n' + escalado(ESC_MASK) + '\n  </g>\n</svg>\n';

  const DENS = [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
                ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]];
  for (const [d, legado, frente] of DENS) {
    await pinta(SVG_ICONO, legado, 'ic_launcher.png',            path.join(AND, 'mipmap-' + d));
    await pinta(REDONDO,   legado, 'ic_launcher_round.png',      path.join(AND, 'mipmap-' + d));
    await pinta(FRENTE,    frente, 'ic_launcher_foreground.png', path.join(AND, 'mipmap-' + d));
    console.log('  mipmap-' + d.padEnd(8) + ' ic_launcher ' + legado + '  ·  foreground ' + frente);
  }

  // ⚠️ El fondo del icono adaptativo es un COLOR solido (asi lo referencia
  // mipmap-anydpi-v26/ic_launcher.xml), no el degradado: se usa el tono que
  // el degradado tiene en el centro del lienzo, que es donde cae el dibujo.
  const FONDO_SOLIDO = '#101D30';
  writeFileSync(path.join(AND, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">' + FONDO_SOLIDO + '</color>\n</resources>\n');
  console.log('  ic_launcher_background -> ' + FONDO_SOLIDO);
} else {
  console.log('\n  (envoltorio Android no encontrado: se omiten sus iconos)');
}

await browser.close();

// --- base64 del logo del sidebar ---
const b64 = Buffer.from(SVG_ICONO, 'utf8').toString('base64');
writeFileSync(path.join(DIR, '_icono_b64.txt'), b64);
console.log('  base64 del sidebar: ' + b64.length + ' caracteres');
console.log('OK');
