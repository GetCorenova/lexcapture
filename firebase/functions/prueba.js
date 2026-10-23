'use strict';
/* La lógica de la prueba que no depende de Firebase ni de Google: qué es un
   correo desechable, a qué uid está atado un token y qué dice un veredicto de
   Play Integrity. Aparte de index.js para poder probarla sin emuladores
   (verify_prueba.mjs, sección S). */
const crypto = require('crypto');

const PAQUETE = 'com.getcorenova.flagrante';
const DIA = 86400000;
const PRUEBA_DIAS = 14;
/* Un token de integridad más viejo que esto no sirve: la integridad se mide en
   el momento de pedir la prueba, no la semana pasada. */
const TOKEN_VIGENCIA = 10 * 60 * 1000;
/* Un teléfono se vende y se reacondiciona: un bit puesto hace más de dos años
   ya no dice nada del dueño de hoy (lo recomienda la propia documentación). */
const RECALL_MESES = 24;
/* Dominios de correo desechable más comunes. No pretende ser exhaustiva: el
   ancla de verdad es el teléfono (puntos 3 y 4); esto solo quita lo más fácil. */
const DESECHABLES = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  'grr.la', '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'temp-mail.io', 'tempmail.com',
  'tempmailo.com', 'tempail.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'trashmail.com',
  'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'mintemail.com', 'fakeinbox.com',
  'throwawaymail.com', 'emailondeck.com', 'moakt.com', 'mohmal.com', 'burnermail.io', 'mailnesia.com',
  'mytemp.email', '1secmail.com', '1secmail.org', '1secmail.net', 'mailcatch.com', 'spamgourmet.com',
  'inboxkitten.com', 'discard.email', 'mail.tm', 'tmpmail.org', 'tmpmail.net', 'emailfake.com',
  'mailpoof.com', 'spambox.us', 'trash-mail.com', 'mvrht.net', 'fakemail.net', 'luxusmail.org'
]);
function desechable(correo) {
  const d = String(correo || '').split('@').pop().toLowerCase();
  if (DESECHABLES.has(d)) return true;
  const partes = d.split('.');
  return partes.length > 2 && DESECHABLES.has(partes.slice(-2).join('.'));
}

/* Lo que el teléfono pone como `requestHash`: atado al uid, sin enseñarlo. */
function hashSolicitud(uid) {
  return crypto.createHash('sha256').update('flagrante|prueba|' + uid).digest('hex');
}
function hashDispositivo(secreto, androidId) {
  return crypto.createHmac('sha256', secreto).update('android|' + PAQUETE + '|' + androidId).digest('hex');
}

function yyyymm(ms) { const d = new Date(ms); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; }
function mesesEntre(ym, ms) {
  const a = Math.floor(ym / 100) * 12 + (ym % 100);
  const d = new Date(ms);
  return d.getUTCFullYear() * 12 + d.getUTCMonth() + 1 - a;
}

/* '' si el token es de esta app, de este usuario, reciente y de un teléfono
   íntegro; si no, el motivo. */
function revisarVeredicto(v, uid, ahora) {
  if (!v || !v.requestDetails) return 'integridad';
  const rd = v.requestDetails;
  if (rd.requestPackageName !== PAQUETE) return 'integridad';
  if (rd.requestHash !== hashSolicitud(uid)) return 'integridad';
  const t = Number(rd.timestampMillis);
  if (!t || Math.abs(ahora - t) > TOKEN_VIGENCIA) return 'integridad-vieja';
  if (!v.appIntegrity || v.appIntegrity.appRecognitionVerdict !== 'PLAY_RECOGNIZED') return 'integridad-app';
  const dv = (v.deviceIntegrity && v.deviceIntegrity.deviceRecognitionVerdict) || [];
  if (dv.indexOf('MEETS_DEVICE_INTEGRITY') < 0) return 'integridad-telefono';
  return '';
}

/* true: el teléfono ya usó una prueba · false: no · null: Device Recall no se
   evaluó (cuenta sin licencia de Play, servicio no habilitado…). */
function recallUsado(v, ahora) {
  const r = v.deviceIntegrity && v.deviceIntegrity.deviceRecall;
  if (!r || !r.values) return null;
  if (r.values.bitFirst !== true) return false;
  const ym = r.writeDates && r.writeDates.yyyymmFirst;
  return !ym || mesesEntre(ym, ahora) <= RECALL_MESES;
}


module.exports = { PAQUETE, DIA, PRUEBA_DIAS, TOKEN_VIGENCIA, RECALL_MESES, desechable, hashSolicitud,
  hashDispositivo, yyyymm, mesesEntre, revisarVeredicto, recallUsado };
