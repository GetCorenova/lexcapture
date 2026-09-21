#!/usr/bin/env node
/**
 * lic:emitir — emite un código de licencia desde la terminal.
 *
 * Existe por el problema del huevo y la gallina: el panel de administración de
 * la app SOLO se ve con una licencia de rol «admin», y esa primera licencia no
 * se puede emitir desde el panel porque todavía no se puede entrar. Este
 * comando la emite.
 *
 * Después de la primera, lo normal es emitir desde el panel de la app, que
 * además lleva el registro de a quién se le dio qué.
 *
 *   npm run lic:emitir -- --correo yo@correo.com --rol admin --meses 120
 *   npm run lic:emitir -- --correo cliente@x.com --plan lexcapture_annual
 *   npm run lic:emitir -- --correo cliente@x.com --vip --meses 6
 */
import { readFileSync, existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAVE = resolve(process.env.LEXCAPTURE_LIC_KEY ||
  join(RAIZ, '..', 'keystore-RESGUARDAR', 'lexcapture-licencias-PRIVADA.json'));

const PLANES = {
  lexcapture_monthly: { lbl: 'Membresía mensual',     meses: 1 },
  lexcapture_annual:  { lbl: 'Membresía anual',       meses: 12 },
  promo:              { lbl: 'Código de promoción',   meses: 3 },
  vip:                { lbl: 'Acceso gratuito (VIP)', meses: 12 },
};

// ── Argumentos ─────────────────────────────────────────────────────────────
const arg = process.argv.slice(2);
const val = (n, d) => { const i = arg.indexOf('--' + n); return i >= 0 ? arg[i + 1] : d; };
const flag = (n) => arg.includes('--' + n);

if (flag('help') || !val('correo')) {
  console.log(`
  Emite un código de licencia de LexCapture.

    --correo <correo>   a quién se emite            (obligatorio)
    --plan <id>         ${Object.keys(PLANES).join(' | ')}
                                                    (por defecto: lexcapture_monthly)
    --meses <n>         vigencia                    (por defecto: la del plan)
    --rol admin         rol de administrador: acceso total + panel
    --vip               acceso gratuito: salta el muro aunque no haya plan
    --nota "<texto>"    etiqueta para tu registro

  Ejemplos:
    npm run lic:emitir -- --correo yo@correo.com --rol admin --meses 120
    npm run lic:emitir -- --correo cliente@x.com --plan lexcapture_annual
`);
  process.exit(val('correo') ? 0 : 1);
}

if (!existsSync(CLAVE)) {
  console.error(`\n  x No se encontró la clave privada en:\n     ${CLAVE}\n`);
  console.error('    Es la que emite las licencias y vive FUERA de todo repositorio.');
  console.error('    Si está en otro sitio: LEXCAPTURE_LIC_KEY="C:/ruta/clave.json"\n');
  process.exit(1);
}

const correo = val('correo');
const plan = val('plan', flag('vip') ? 'vip' : 'lexcapture_monthly');
if (!PLANES[plan]) {
  console.error(`\n  x Plan desconocido: ${plan}\n    Disponibles: ${Object.keys(PLANES).join(', ')}\n`);
  process.exit(1);
}
const meses = parseInt(val('meses', PLANES[plan].meses), 10);
const rol = val('rol') === 'admin' || flag('admin') ? 'admin' : 'user';
const vip = flag('vip') || plan === 'vip';
const nota = val('nota', '');

const exp = (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.getTime(); })();

// ── Firmar ─────────────────────────────────────────────────────────────────
// Mismo formato exacto que verifica la app: LXL1.<contenido>.<firma>, con la
// firma sobre la CADENA del contenido tal como viaja (no sobre el objeto vuelto
// a serializar, que podría ordenar las claves distinto).
const b64u = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const jwk = JSON.parse(readFileSync(CLAVE, 'utf8'));
const key = await webcrypto.subtle.importKey('jwk', jwk,
  { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

const payload = {
  v: 1, sub: correo, plan, rol,
  iat: Date.now(), exp,
  vip, vexp: vip ? exp : null,
  ...(nota ? { nota } : {}),
};
const cuerpo = b64u(new TextEncoder().encode(JSON.stringify(payload)));
const firma = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key,
  new TextEncoder().encode(cuerpo));
const codigo = 'LXL1.' + cuerpo + '.' + b64u(new Uint8Array(firma));

// ── Comprobar contra la pública que lleva la app ───────────────────────────
// Sin esto se podría entregar un código impecablemente firmado con la clave
// equivocada, que ninguna copia de la app aceptaría — y el fallo aparecería en
// el equipo del cliente, no aquí.
const pub = (readFileSync(join(RAIZ, 'LexCapture_v8.html'), 'utf8')
  .match(/var LIC_PUB = (\{[^;]*\});/) || [])[1];
if (pub) {
  const pk = await webcrypto.subtle.importKey('jwk', JSON.parse(pub),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pk,
    firma, new TextEncoder().encode(cuerpo));
  if (!ok) {
    console.error('\n  x La clave privada NO corresponde a la pública embebida en la app.');
    console.error('    Este código no lo aceptaría ninguna copia de LexCapture.\n');
    process.exit(1);
  }
}

const f = (ms) => new Date(ms).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
console.log(`
  Licencia emitida
  ────────────────────────────────────────────────────
    Para      ${correo}
    Plan      ${PLANES[plan].lbl}
    Rol       ${rol}${rol === 'admin' ? '   (acceso total + panel de administración)' : ''}
    VIP       ${vip ? 'sí   (salta el muro de pago)' : 'no'}
    Vence     ${f(exp)}   (${meses} ${meses === 1 ? 'mes' : 'meses'})${nota ? `\n    Nota      ${nota}` : ''}
  ────────────────────────────────────────────────────

${codigo}

  Se activa en la app: Membresía → Activar con un código.
`);
