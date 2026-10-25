'use strict';
/* ═══ LA SUSCRIPCIÓN (F5 del plan de cuenta, 2026-10-24) — lógica pura ═══════
   Google Play cobra y RevenueCat valida el recibo. El SERVIDOR pregunta a
   RevenueCat por la cuenta (el `appUserID` es el uid de Firebase) y traduce lo
   que contesta al derecho de uso de siempre: `entitlements/{uid}` con
   `plan: 'pagado'` y su vencimiento. El teléfono nunca se escribe el plan.

   Aquí solo está la traducción, sin red ni Firestore, para probarla sola. */

/* El ÚNICO entitlement que cuenta. Nunca un producto concreto: así añadir un
   plan trimestral no toca una línea de código. */
const ENTITLEMENT = 'flagrante_pro';
const DIA = 86400000;
/* Una compra «para siempre» (sin vencimiento) se guarda a 100 años. */
const SIN_FIN = 100 * 365 * DIA;
/* Con el plan pagado y más de esto por delante, `miDerecho` no vuelve a
   preguntar a RevenueCat: el vencimiento ya guardado basta. */
const MARGEN_RC = 2 * DIA;

function ms(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/* Lo que RevenueCat dice del entitlement: { existe, activo, vence, producto, sandbox }.
   `sub` es `subscriber` de GET /v1/subscribers/{id}. El vencimiento es el mayor
   entre el de la suscripción y el del período de gracia de Google Play (pago
   rechazado que Google sigue reintentando). */
function estadoRC(sub, ahora) {
  const e = sub && sub.entitlements && sub.entitlements[ENTITLEMENT];
  if (!e) return { existe: false, activo: false, vence: 0, producto: '', sandbox: false };
  const sinFin = e.expires_date === null;
  const vence = sinFin ? ahora + SIN_FIN : Math.max(ms(e.expires_date), ms(e.grace_period_expires_date));
  const producto = String(e.product_identifier || '');
  const s = sub.subscriptions && sub.subscriptions[producto];
  return { existe: true, activo: vence > ahora, vence, producto, sandbox: !!(s && s.is_sandbox) };
}

/* ¿Hace falta preguntar a RevenueCat? Siempre, salvo con un plan pagado que
   todavía tiene más de 2 días por delante (o si se pide a la fuerza: justo
   después de comprar, o al tocar «Ya pagué: revisar»). */
function debeConsultar(d, ahora, forzar) {
  if (forzar) return true;
  const vence = d && d.vence ? (typeof d.vence.toMillis === 'function' ? d.vence.toMillis() : Number(d.vence)) : 0;
  return !(d && d.plan === 'pagado' && vence > ahora + MARGEN_RC);
}

/* Qué escribir en `entitlements/{uid}` con lo que dijo RevenueCat, o null si no
   hay nada que cambiar. `d` = lo guardado (vence en milisegundos).
   · Activo → plan pagado con el vencimiento de RevenueCat (aunque estuviera en
     prueba: pagar la reemplaza; `pruebaUsada` se conserva).
   · No activo y estaba pagado → se baja el vencimiento al que diga RevenueCat
     (cancelación con reembolso, revocación). Si RevenueCat ya no conoce el
     entitlement, se da por terminado hoy.
   · Nunca pagó → no se toca: la prueba la maneja `iniciarPrueba`. */
function cambioRC(d, est, ahora) {
  const venceAntes = d && d.vence ? Number(d.vence) : 0;
  if (est.activo) {
    if (d && d.plan === 'pagado' && venceAntes === est.vence && d.producto === est.producto) return null;
    return { plan: 'pagado', vence: est.vence, producto: est.producto, sandbox: est.sandbox,
             pruebaUsada: !!(d && d.pruebaUsada) };
  }
  if (!(d && d.plan === 'pagado')) return null;
  const vence = est.existe ? est.vence : Math.min(venceAntes || ahora, ahora);
  if (vence === venceAntes) return null;
  return { plan: 'pagado', vence, producto: est.producto || (d.producto || ''), sandbox: est.sandbox,
           pruebaUsada: !!d.pruebaUsada };
}

module.exports = { ENTITLEMENT, MARGEN_RC, SIN_FIN, estadoRC, debeConsultar, cambioRC };
