'use strict';
/* ═══ FUNCIONES DEL SERVIDOR DE FLAGRANTE (F3 del plan de cuenta, 2026-10-23) ═══

   Qué hacen, y qué NO:
   · `iniciarPrueba` concede los 14 días de prueba. La prueba la da SIEMPRE el
     servidor, nunca el teléfono: el teléfono solo pide.
   · `miDerecho` dice el derecho de uso de la cuenta y la HORA DEL SERVIDOR, para
     que el teléfono no dependa de su propio reloj (que el usuario puede atrasar).
   · `alBorrarUsuario` limpia en el servidor lo de una cuenta eliminada, aunque el
     borrado que empezó el teléfono se haya cortado a la mitad.
   ⚠️ Ninguna recibe ni ve datos de capturas ni de personas: esos viajan cifrados
   con una llave que solo tiene el usuario (ver «La cuenta» en CLAUDE.md).

   CÓMO SE IMPIDE REPETIR LA PRUEBA (como las apps que no piden tarjeta):
   1. Cuenta con el correo VERIFICADO, y sin dominios desechables.
   2. Play Integrity (petición estándar, `requestHash` atado al uid): la app es la
      de Play y el teléfono pasa la integridad. Emuladores, teléfonos con root o
      APK modificados → no hay prueba (sí pueden comprar).
   3. Device Recall de Play Integrity: 3 bits por teléfono guardados por Google,
      que sobreviven a reinstalar y a restablecer de fábrica. Bit 1 = «este
      teléfono ya usó una prueba».
   4. Respaldo si Device Recall no se evalúa: el ANDROID_ID, cifrado con HMAC y
      un secreto del servidor (`dispositivosPrueba/{hash}`). Sobrevive a
      reinstalar, no a restablecer de fábrica.
   5. Una prueba por cuenta: `entitlements/{uid}` no se vuelve a crear.
   Límite aceptado y dicho: quien tenga DOS teléfonos físicos tiene dos pruebas.

   ⚠️ SIMULACIÓN SOLO EN EL EMULADOR. Play Integrity no se puede pedir desde un
   navegador ni desde un emulador de Android, así que las pruebas automáticas
   mandan un token simulado («SIM.» + JSON). Esa rama solo existe si
   FUNCTIONS_EMULATOR === 'true', que lo pone el emulador de Firebase y nunca
   Cloud Functions. */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const functionsV1 = require('firebase-functions/v1');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const REGION = 'southamerica-east1';
setGlobalOptions({ region: REGION, maxInstances: 10 });

const HMAC = defineSecret('PRUEBA_HMAC');
const EMULADOR = process.env.FUNCTIONS_EMULATOR === 'true';
const { PAQUETE, DIA, PRUEBA_DIAS, desechable, hashSolicitud, hashDispositivo, yyyymm,
        revisarVeredicto, recallUsado } = require('./prueba');
const ALCANCE = 'https://www.googleapis.com/auth/playintegrity';

/* Un «no» del servidor. El motivo va también en `details`: el SDK web añade el
   estado HTTP al mensaje («correo-sin-verificar [400]»), así que el teléfono
   lee el motivo de ahí y no del texto. */
function no(codigo, motivo) { return new HttpsError(codigo, motivo, { motivo: motivo }); }

let _cliente = null;
async function clienteGoogle() {
  if (!_cliente) {
    const { GoogleAuth } = require('google-auth-library');
    _cliente = await new GoogleAuth({ scopes: [ALCANCE] }).getClient();
  }
  return _cliente;
}

/* ── Play Integrity ───────────────────────────────────────────────────────── */
async function decodificar(token) {
  if (EMULADOR) {
    /* En el emulador solo hay tokens simulados: no se le habla a Google. */
    if (!token.startsWith('SIM.')) { const e = new Error('token no simulado en el emulador'); e.invalido = true; throw e; }
    return JSON.parse(Buffer.from(token.slice(4), 'base64url').toString('utf8'));
  }
  const c = await clienteGoogle();
  const r = await c.request({
    url: `https://playintegrity.googleapis.com/v1/${PAQUETE}:decodeIntegrityToken`,
    method: 'POST', data: { integrity_token: token }
  });
  return r.data && r.data.tokenPayloadExternal;
}

/* El veredicto, con el Device Recall del teléfono. En el emulador el recall se
   guarda en `_simRecall/{teléfono}` (colección que las reglas cierran). */
async function veredicto(token) {
  const v = await decodificar(token);
  if (EMULADOR && v && v._sim) {
    v.deviceIntegrity = v.deviceIntegrity || {};
    if (v._sim.recall === false) delete v.deviceIntegrity.deviceRecall;
    else {
      const s = await db.doc('_simRecall/' + v._sim.telefono).get();
      v.deviceIntegrity.deviceRecall = s.exists ? s.data() : { values: {}, writeDates: {} };
    }
  }
  return v;
}

async function recallMarcar(token, v) {
  if (EMULADOR && v._sim) {
    if (v._sim.recall === false) return false;
    await db.doc('_simRecall/' + v._sim.telefono).set(
      { values: { bitFirst: true }, writeDates: { yyyymmFirst: yyyymm(Date.now()) } }, { merge: true });
    return true;
  }
  const c = await clienteGoogle();
  await c.request({
    url: `https://playintegrity.googleapis.com/v1/${PAQUETE}/deviceRecall:write`,
    method: 'POST', data: { integrityToken: token, newValues: { bitFirst: true } }
  });
  return true;
}

/* ── El derecho de uso ─────────────────────────────────────────────────────── */
/* Lo que recibe el teléfono: el plan, cuándo vence y la hora del servidor. */
function salida(d, ahora) {
  return {
    plan: d && d.plan ? d.plan : null,
    vence: d && d.vence ? d.vence.toMillis() : 0,
    pruebaUsada: !!(d && d.pruebaUsada),
    ahora: ahora
  };
}
function uidDe(req) {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw no('unauthenticated', 'sin-sesion');
  return uid;
}

exports.miDerecho = onCall({ memory: '256MiB', timeoutSeconds: 15 }, async (req) => {
  const uid = uidDe(req);
  const s = await db.doc('entitlements/' + uid).get();
  return salida(s.exists ? s.data() : null, Date.now());
});

exports.iniciarPrueba = onCall({ memory: '256MiB', timeoutSeconds: 30, secrets: [HMAC] }, async (req) => {
  const uid = uidDe(req);
  const ahora = Date.now();
  const ref = db.doc('entitlements/' + uid);

  /* 5 · Una prueba por cuenta. Si la tiene vigente, se devuelve tal cual (pedir
     dos veces no es un error); si ya la tuvo, no se repite. */
  const previo = await ref.get();
  if (previo.exists) {
    const d = previo.data();
    if (d.vence && d.vence.toMillis() > ahora) return salida(d, ahora);
    throw no('failed-precondition', 'cuenta-ya-uso-prueba');
  }

  /* 1 · El correo. El token lo firma Firebase: no se puede falsear. */
  const t = req.auth.token || {};
  if (!t.email_verified) throw no('failed-precondition', 'correo-sin-verificar');
  if (desechable(t.email)) throw no('failed-precondition', 'correo-desechable');

  const datos = req.data || {};
  const token = typeof datos.integridad === 'string' ? datos.integridad : '';
  const androidId = typeof datos.dispositivo === 'string' ? datos.dispositivo.trim() : '';
  if (!token || token.length > 10000) throw no('failed-precondition', 'integridad');
  if (!/^[0-9A-Za-z_-]{8,64}$/.test(androidId)) throw no('failed-precondition', 'sin-dispositivo');

  /* 2 · Play Integrity. Un fallo del servicio de Google no es un «no»: se dice
     que lo intente más tarde. */
  let v;
  try { v = await veredicto(token); }
  catch (e) {
    /* Google responde 400 a un token que no es suyo: eso es un «no», no una
       caída del servicio. */
    if (e.invalido || (e.response && e.response.status === 400)) throw no('failed-precondition', 'integridad');
    logger.warn('integridad: no se pudo decodificar', { motivo: e.message });
    throw no('unavailable', 'integridad-servicio');
  }
  const mal = revisarVeredicto(v, uid, ahora);
  if (mal) throw no('failed-precondition', mal);

  /* 3 · Device Recall. */
  if (recallUsado(v, ahora) === true) throw no('failed-precondition', 'telefono-ya-uso-prueba');

  /* 4 · El respaldo por ANDROID_ID, y la concesión: en UNA transacción, para que
     dos pedidos a la vez no den dos pruebas. ⚠️ El documento del teléfono no
     guarda el uid: no hace falta para impedir la repetición y así no queda un
     vínculo entre el teléfono y la persona. */
  const refTel = db.doc('dispositivosPrueba/' + hashDispositivo(HMAC.value(), androidId));
  const entitlement = {
    plan: 'prueba', pruebaUsada: true,
    inicio: Timestamp.fromMillis(ahora),
    vence: Timestamp.fromMillis(ahora + PRUEBA_DIAS * DIA),
    act: FieldValue.serverTimestamp()
  };
  let resultado = null;
  try {
    resultado = await db.runTransaction(async (tx) => {
      const [e, tel] = await tx.getAll(ref, refTel);
      if (e.exists) return e.data();           // otro pedido ganó la carrera
      if (tel.exists) throw no('failed-precondition', 'telefono-ya-uso-prueba');
      tx.create(ref, entitlement);
      tx.create(refTel, { fecha: Timestamp.fromMillis(ahora) });
      return null;
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error('prueba: la transacción falló', { motivo: e.message });
    throw no('internal', 'servidor');
  }
  if (resultado) {
    if (resultado.vence && resultado.vence.toMillis() > ahora) return salida(resultado, ahora);
    throw no('failed-precondition', 'cuenta-ya-uso-prueba');
  }

  /* El bit del teléfono va DESPUÉS de conceder: si Google falla aquí, la
     prueba ya es del usuario y el respaldo por ANDROID_ID ya quedó escrito. */
  try { await recallMarcar(token, v); }
  catch (e) { logger.warn('device recall: no se pudo marcar', { motivo: e.message }); }

  logger.info('prueba concedida', { uid });
  return salida(entitlement, ahora);
});

/* ── Al eliminar la cuenta ─────────────────────────────────────────────────
   El teléfono borra sus llaves y después el usuario. Si se corta a la mitad,
   esto termina el trabajo: todo lo de users/{uid} (las llaves y, en la F4, los
   registros cifrados) y el derecho de uso. El documento del teléfono de la
   prueba se queda — no tiene el uid y es lo que impide repetirla. */
exports.alBorrarUsuario = functionsV1.region(REGION).auth.user().onDelete(async (user) => {
  await db.recursiveDelete(db.doc('users/' + user.uid));
  await db.doc('entitlements/' + user.uid).delete();
  logger.info('cuenta eliminada: datos del servidor borrados', { uid: user.uid });
});


