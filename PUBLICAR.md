# Subir LexCapture a Play Store — punto de partida

> Escrito el 2026-09-21 contra el **build 113**. Empezar el chat nuevo leyendo
> **este archivo**, no el `CLAUDE.md` entero (son 4 000 líneas de historia del
> producto; aquí está solo lo que hace falta para publicar).
>
> **Primer mensaje sugerido en el chat nuevo:**
> «Lee PUBLICAR.md y ayúdame a subir la app a Play Store. Voy por la fase N.»

---

## 1. Estado real, medido (no supuesto)

| Pieza | Estado |
|---|---|
| Cuenta de Play Console | ✅ **verificada** (21-09-2026). Ya aparece «Crear app» |
| App creada en Play Console | ❌ **no** — es la fase 1 |
| `.aab` firmado | ✅ `lexcapture-android/android/app/build/outputs/bundle/release/app-release.aab` · 6 068 969 B · `jar verified` · versionCode 1 · minSdk 24 · targetSdk 36 |
| Permisos del manifiesto fusionado | `INTERNET`, `ACCESS_NETWORK_STATE`, `CAMERA` (opcional), `com.android.vending.BILLING` |
| Código web publicado | ✅ build 113 en https://getcorenova.github.io/lexcapture/ |
| Ficha de tienda | ✅ `Crear App/store-listing.md` — versionada, se publica con el repo |
| Política de privacidad | ✅ https://getcorenova.github.io/lexcapture/privacy.html (actualizada 21-09) |
| Ícono 512×512 | ✅ `Crear App/icon-512.png` |
| Gráfico de funciones 1024×500 | ✅ `lexcapture-android/store/feature-graphic-1024x500.png` |
| Capturas de teléfono | ✅ 5 en `lexcapture-android/store/` (1080×2400, del build 113) |
| Proyecto en RevenueCat | ❌ **no** — falta, y con él la clave pública |
| Suscripciones en Play Console | ❌ no (no se pueden crear hasta que haya un `.aab` subido) |
| Muro de suscripción en la app | ❌ **no escrito** — el SDK está en el envoltorio, la app web aún no lo llama |
| Clave de la cuenta de servicio | ❌ falta → `npm run deploy:playstore` todavía no sirve |

Comprobar el estado en cualquier momento:

```
npm run build:android:check          # keystore, JDK, SDK, versionCode
npm run deploy:playstore -- --check  # Ruby, Fastlane, clave de servicio, firma
```

---

## 2. El orden. No se puede alterar

**La primera versión de una ficha NO se puede subir por API.** Google responde 403
sin decir que la causa es esa. La fase 3 es **manual, por el navegador**. El
comando `npm run deploy:playstore` sirve **a partir de la segunda** subida.

### Fase 1 · Crear la app en Play Console
⚠️ **Dos decisiones IRREVERSIBLES en esa misma pantalla:**
- **Gratuita o de pago** → marcar **Gratuita**. De gratuita a de pago no se puede
  cambiar nunca una vez publicada; al revés sí. La suscripción es una compra
  dentro de la app, así que la app es gratuita.
- **Nombre del paquete** → lo fija el primer `.aab`: `com.getcorenova.lexcapture`.
  No se puede cambiar después.

### Fase 2 · RevenueCat
1. Crear el proyecto y la app de Android (`com.getcorenova.lexcapture`).
2. Copiar la **clave pública** (empieza por `goog_`).
3. Sin esa clave no hay nada que cablear en el código — mismo caso que
   `SY_CLIENT_ID`. **Pedírsela al usuario antes de escribir una línea.**

### Fase 3 · Ficha + primera subida (MANUAL)
1. Pegar de `store-listing.md`: nombre, descripción breve, descripción completa,
   categoría, contacto y el enlace de la política.
2. Subir el ícono, el gráfico de funciones y las 5 capturas de `store/`.
3. Responder **Seguridad de los datos** con la sección del `store-listing.md`.
   ⚠️ **Declarar el historial de compras es obligatorio** por el permiso BILLING,
   y la copia en Drive hay que declararla como transferencia. La nota de julio
   decía lo contrario y era falsa.
4. Subir `app-release.aab` a **pruebas internas** desde el navegador.

### Fase 4 · Suscripciones (solo después de subir el `.aab`)
Monetizar → Productos → Suscripciones → **una** suscripción `lexcapture_premium`
con **dos planes base**: `mensual` (P1M) y `anual` (P1Y), con sus ofertas de
prueba gratuita y sus precios por país.
⚠️ **El ID de una suscripción no se puede cambiar nunca.**
Los «accesos gratuitos» y los «descuentos» son **códigos promocionales** y
**probadores con licencia**, que ya existen ahí: no se programan dentro de la app.
Eso ya se intentó una vez y se retiró entero — ver la sección «Puntos 2 y 3 ·
RETIRADO» del `CLAUDE.md`.

### Fase 5 · Vincular Play Console con RevenueCat
Cuenta de servicio en Google Cloud → darle permisos en Play Console → pegarla en
RevenueCat. El mismo JSON sirve como `google-play-key.json` y desbloquea
`npm run deploy:playstore` para las subidas siguientes.

### Fase 6 · Pruebas cerradas
⚠️ Una cuenta personal necesita **14 días de pruebas cerradas con al menos 12
probadores** antes de publicar en producción. **Son la única ventana para probar
una compra real**: la facturación no se puede probar hasta que la app esté en una
pista de Play.

---

## 3. Lo que falta escribir (código)

**El muro de suscripción no existe todavía.** Cuando llegue la clave de RevenueCat:
- Vive en **`lcProducirDoc`**, el productor único de documentos.
- **Falla ABIERTO**: si no se puede comprobar el derecho, deja pasar.
- **Nunca** bloquea una captura ya empezada, ni leer, ni editar, ni exportar el
  respaldo. El plazo del artículo 28 son 36 horas: dejar a un policía sin su
  FPJ-5 cuesta infinitamente más que una mensualidad sin cobrar.
- La app pregunta **«¿tiene el derecho premium?»**, nunca por un producto
  concreto: así añadir mañana un plan trimestral no toca una línea.
- ⚠️ **En la web de escritorio no existe Play Billing.** Cobrar ahí es otra
  decisión y otra tecnología; no darlo por resuelto con lo mismo.

`SY_CLIENT_ID` sigue vacío: sin él no funciona la copia de seguridad en Drive.

---

## 4. Cosas que ya costaron tiempo. No repetirlas

- ⚠️ **El `.aab` NO lleva el código web dentro.** Capacitor carga la app desde
  `https://getcorenova.github.io/lexcapture/` (ver `capacitor.config.json`). Un
  cambio en la app se publica con `npm run deploy:web` y **llega a los teléfonos
  ya instalados sin recompilar ni pasar por Play Console**. Solo hay que
  recompilar si cambia el envoltorio: permisos, plugins o versión.
- ⚠️ **Cada subida necesita un versionCode MAYOR.** Lo sube `bump_version` de
  Fastlane, que ya escribe el `app/build.gradle` byte a byte (antes lo corrompía
  y de paso le cambiaba los 71 finales de línea).
- ⚠️ **Gradle dice `BUILD SUCCESSFUL` sin compilar nada** si está todo al día:
  comprobar la **fecha del `.aab`**, no el mensaje. Solo `clean bundleRelease`
  prueba algo.
- ⚠️ **El keystore es irremplazable.** Vive en `lexcapture-android/android/`
  (`keystore-RESGUARDAR/` y `keystore.properties`), está en `.gitignore` y **no se
  puede regenerar**: si se pierde, la app no se puede volver a actualizar nunca.
  Guardar una copia fuera de este PC. Las claves de licencia que hay en esa
  carpeta son de un módulo retirado y ya no las lee nada — no confundirlas con el
  keystore de firma.
- ⚠️ **Nunca cometer** la clave de la cuenta de servicio, `*.jks` ni
  `keystore.properties`. Este repositorio **es público** (sirve GitHub Pages). Si
  se comete una credencial no basta con borrarla en otro commit: **hay que
  rotarla** — y el keystore no se puede rotar.
- ⚠️ **La ficha y la política se quedan atrás sin que nada avise**: ninguna suite
  las ejecuta ni las mide. Al añadir cualquier función que mueva datos fuera del
  equipo, tocar `privacy.html` y `store-listing.md` en el mismo trabajo. Ya pasó
  dos veces.
- ⚠️ **Nada de escudos ni nombres de institución** en el ícono, el gráfico de
  funciones, las capturas ni el texto de la ficha: Play lo rechaza por
  impersonación de entidad gubernamental. El vocabulario legal (FPJ-5, NUNC, URI,
  CESPA) sí puede ir — es del sistema judicial, no una marca.
- ⚠️ **Las capturas llevan datos inventados del simulador** (correos en el dominio
  reservado `.test`). **Nunca subir capturas de un procedimiento real**: son datos
  personales de un capturado, y en CESPA de un menor (Ley 1581 de 2012).

---

## 5. Qué hace falta del usuario en el chat nuevo

1. La **clave pública de RevenueCat** — bloquea el muro de suscripción.
2. El **JSON de la cuenta de servicio** — desbloquea las subidas automáticas.
3. El **`SY_CLIENT_ID`** de Google Cloud — bloquea la copia en Drive.
4. Los **precios** de los planes mensual y anual.
