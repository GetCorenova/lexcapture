# Subir Flagrante a Play Store — punto de partida

> Medido el **2026-09-22** contra el **build 118**. Empezar el chat nuevo leyendo
> **este archivo**, no el `CLAUDE.md` entero (son 4 000 líneas de historia del
> producto; aquí está solo lo que hace falta para publicar).
>
> **Primer mensaje sugerido en el chat nuevo:**
> «Lee PUBLICAR.md y ayúdame a subir la app a Play Store. Voy por la fase N.»

⚠️ **La app se llama FLAGRANTE.** El nombre anterior (LexCapture) sobrevive **solo**
en cuatro sitios técnicos que **no se pueden tocar**, y ninguno se le muestra al
usuario — ver «El nombre viejo que queda a propósito», más abajo.

---

## 1. Estado real, medido (no supuesto)

| Pieza | Estado |
|---|---|
| Cuenta de Play Console | ✅ **verificada**. Ya aparece «Crear app» |
| App creada en Play Console | ✅ **sí** (22-09). Checklist de «Configura tu app» diligenciado; falta guardar la ficha y subir el `.aab` |
| `.aab` firmado | ✅ `lexcapture-android/android/app/build/outputs/bundle/release/app-release.aab` · **3 137 757 B** · `jar verified` · versionCode 1 · paquete **`com.getcorenova.flagrante`** · minSdk 24 · targetSdk 36 · compilado 22-09 19:34 · **sin facturación** |
| Ícono dentro del `.aab` | ✅ **comprobado extrayéndolo del paquete**: la F ámbar en el visor cian, capa frontal transparente |
| Nombre en Android | ✅ `Flagrante` (`strings.xml`: `app_name` y `title_activity_main`) |
| Permisos del manifiesto fusionado | `INTERNET`, `ACCESS_NETWORK_STATE`, `CAMERA` (opcional), `DUMP` — **ya NO `com.android.vending.BILLING`** |
| Código web publicado | ✅ **build 119 en vivo** en https://getcorenova.github.io/lexcapture/ |
| Sincronización con Drive | ✅ **funcionando en la versión web** (probada de punta a punta). Oculta en la app de Play: Google bloquea su consentimiento en un WebView |
| Google Cloud | ✅ proyecto `Flagrante`, Drive API, consentimiento **En producción**, `drive.appdata` (no sensible), marca y cliente OAuth |
| `manifest.json` de la PWA | ✅ «Flagrante — Gestión de Capturas» |
| Ficha de tienda | ✅ `Crear App/store-listing.md` — nombre **Flagrante**, 9 caracteres |
| Política de privacidad | ✅ https://getcorenova.github.io/lexcapture/privacy.html · HTTP 200 · dice **Flagrante** |
| Ícono 512×512 para la ficha | ✅ `Crear App/icon-store-512.png` (a sangre, sin transparencia) |
| Gráfico de funciones 1024×500 | ✅ `lexcapture-android/store/feature-graphic-1024x500.png` — **mirado**: dice «Flagrante» con el ícono definitivo |
| Capturas de teléfono | ✅ 5 en `lexcapture-android/store/` (**1080×1920, 9:16 exacto**) — **miradas**: ninguna muestra el nombre (en teléfono no hay barra lateral) y los datos son del simulador. ⚠️ A 1080×2400 la consola las marcaba «Necesita recorte»: 9:16 es el tope |
| Repositorio | ✅ todo pusheado, `main` al día con `origin/main` |
| Proyecto en RevenueCat | ⏸️ **aplazado a propósito**, fuera del primer paquete (ver fase 2) |
| Suscripciones en Play Console | ❌ no (no se pueden crear hasta que haya un `.aab` subido) |
| Muro de suscripción en la app | ❌ **no escrito**, y el SDK **ya no viaja** en el envoltorio |
| Clave de la cuenta de servicio | ❌ falta → `npm run deploy:playstore` todavía no sirve |

Comprobar el estado en cualquier momento:

```
npm run build:android:check          # keystore, JDK, SDK, versionCode
npm run deploy:playstore -- --check  # Ruby, Fastlane, clave de servicio, firma
```

---

## 2. El nombre viejo que queda a propósito

⚠️ **No «corregir» ninguno de estos.** Cada uno rompe algo real:

| Dónde | Por qué NO se toca |
|---|---|
| `getcorenova.github.io/**lexcapture**/` (URL) | El `.aab` ya firmado carga desde ahí (`capacitor.config.json`). Renombrar el repositorio **deja tiesas las apps ya instaladas** |
| `LexCapture_v8.html` (nombre del archivo) | Lo referencian ~40 suites de regresión y el `sw.js` |
| `lexcapture-sync-v1` (HKDF) · `lexcapture-sync.bin` · `PT_MARCA` · canal WebRTC | Cambiarlos **deja ilegible lo sincronizado en el Drive del usuario** y rompe el vínculo entre dos teléfonos con builds distintos |
| alias del keystore | El keystore es **irremplazable** |

⚠️ **Uno cosmético y sin resolver, invisible en la práctica**: el placeholder
`lexcapture-android/www/index.html` conserva `<title>LexCapture</title>`. Con
`server.url` configurado el WebView va directo a la URL remota y **ese archivo no
se carga**; el rótulo que ve el usuario sale de `strings.xml`, que ya dice
Flagrante. Corregirlo obliga a recompilar y volver a verificar el `.aab` que ya
está listo, así que se deja para la próxima vez que haya que recompilar.

---

## 3. El orden. No se puede alterar

**La primera versión de una ficha NO se puede subir por API.** Google responde 403
sin decir que la causa es esa. La fase 3 es **manual, por el navegador**. El
comando `npm run deploy:playstore` sirve **a partir de la segunda** subida.

### Fase 1 · Crear la app en Play Console
Pulsar «Crear app» y llenar:

| Campo | Valor |
|---|---|
| Nombre de la app | `Flagrante` |
| Idioma predeterminado | Español (Latinoamérica) – es-419 |
| App o juego | **App** |
| Gratis o de pago | **Gratis** |
| Declaraciones | marcar las dos (directrices del programa + leyes de exportación de EE. UU.) |

⚠️ **Dos decisiones IRREVERSIBLES:**
- **Gratuita** → de gratuita a de pago no se puede cambiar nunca una vez
  publicada; al revés sí. La suscripción es una compra *dentro* de la app, así que
  la app es gratuita.
- **Nombre del paquete** → lo fija el primer `.aab`: `com.getcorenova.flagrante`.
  No se puede cambiar después, y aparece en la URL de la ficha.

⚠️ Esa pantalla **no pide** el nombre del paquete: se fija al subir el `.aab`.

### Fase 2 · RevenueCat — APLAZADA (decisión del usuario, 2026-09-22)
⚠️ **El primer paquete va SIN facturación.** El `.aab` declaraba
`com.android.vending.BILLING` y llevaba dentro el SDK de RevenueCat (1 475
referencias en el `.dex`) **sin una sola línea que lo llamara**: no hay clave, no
hay muro de pago y no hay productos creados. Play detecta ese permiso y marca la
ficha como «Compras dentro de la aplicación», contra unas respuestas ya enviadas
que dicen **No** a productos digitales y no declaran historial de compras. Es el
mismo criterio con el que se quitó el párrafo de SUSCRIPCIÓN de la descripción:
**no anunciar lo que la app no tiene**.

Qué se hizo: `npm uninstall @revenuecat/purchases-capacitor` + `npx cap sync
android` + recompilar. El paquete pasó de **6 089 660 a 3 137 757 B**, el
manifiesto perdió `BILLING` y el `.dex` quedó en **0** referencias a facturación.
⚠️ De paso desapareció `ACCESS_NETWORK_STATE`, que **llegaba solo por el
manifiesto fusionado del plugin**: se declara ahora en el manifiesto propio, o el
indicador «Sin señal» no volvería a aparecer nunca. **Un permiso que la app
necesita no puede depender de una dependencia que se quita.**

**Para reponerla** (cuando el muro de pago exista de verdad, ver fase 4):
1. `npm install @revenuecat/purchases-capacitor` + `npx cap sync android`.
2. Crear el proyecto y la app de Android en RevenueCat (`com.getcorenova.flagrante`)
   y copiar la **clave pública** (`goog_…`). Sin ella no hay nada que cablear —
   mismo caso que `SY_CLIENT_ID`. **Pedírsela al usuario antes de escribir una línea.**
3. Subir el `versionCode`, recompilar y subir una **versión nueva**.
4. Y **volver a declararlo todo**: «Sí» a productos digitales en la clasificación de
   contenido, «historial de compras» en Seguridad de los datos, la sección 8 de
   `privacy.html` y el párrafo de SUSCRIPCIÓN de `store-listing.md`.

### Fase 3 · Ficha + primera subida (MANUAL)
1. Pegar de `store-listing.md`: nombre, descripción breve, descripción completa,
   categoría, contacto y el enlace de la política.
2. Subir `Crear App/icon-store-512.png`, el gráfico de funciones y las 5 capturas
   de `lexcapture-android/store/`.
3. Responder **Seguridad de los datos**. ⚠️ Con el paquete de hoy la respuesta es
   **no se recopila ni se transfiere nada**, y es cierta: no hay `BILLING` (así que
   no hay historial de compras que declarar) y **la copia en Drive está oculta en la
   app de Play** — solo existe en la versión web. La sección de `store-listing.md`
   describe el escenario CON facturación y CON Drive: aplicará cuando se repongan.
   ⚠️ **La política y este formulario tienen que decir lo mismo.** Por eso
   `privacy.html` §4 dice que la copia en Drive es de la versión web y §8 que esta
   versión no ofrece suscripciones. Si se toca una, revisar las tres.
4. Subir `app-release.aab` a **pruebas internas** desde el navegador.

### Fase 4 · Suscripciones (solo después de subir el `.aab`, y de reponer la fase 2)
Monetizar → Productos → Suscripciones → **una** suscripción `lexcapture_premium`
con **dos planes base**: `mensual` (P1M) y `anual` (P1Y), con sus ofertas de
prueba gratuita y sus precios por país.
⚠️ **El ID de una suscripción no se puede cambiar nunca.** Decidir antes de crearlo
si se deja `lexcapture_premium` (el nombre nunca se le muestra al usuario) o se
estrena `flagrante_premium`.
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

## 4. Lo que falta escribir (código)

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

## 5. Cosas que ya costaron tiempo. No repetirlas

- ⚠️ **El `.aab` NO lleva el código web dentro.** Capacitor carga la app desde
  `https://getcorenova.github.io/lexcapture/` (ver `capacitor.config.json`). Un
  cambio en la app se publica con `npm run deploy:web` y **llega a los teléfonos
  ya instalados sin recompilar ni pasar por Play Console**. Solo hay que
  recompilar si cambia el envoltorio: permisos, plugins, ícono o versión.
- ⚠️ **Cada subida necesita un versionCode MAYOR.** Lo sube `bump_version` de
  Fastlane, que ya escribe el `app/build.gradle` byte a byte (antes lo corrompía
  y de paso le cambiaba los 71 finales de línea).
- ⚠️ **Gradle dice `BUILD SUCCESSFUL` sin compilar nada** si está todo al día:
  comprobar la **fecha del `.aab`**, no el mensaje. Solo `clean bundleRelease`
  prueba algo.
- ⚠️ **El ícono del teléfono NO sale del `manifest.json`**, sale de los recursos
  del envoltorio (`mipmap-*`). Al cambiarlo hay que correr `npm run gen:icons`
  **y recompilar**, y después **extraerlo del `.aab` y mirarlo** — dar por hecho
  que Gradle lo metió ya falló una vez (el `.aab` llevaba el logo por defecto de
  Capacitor).
- ⚠️ **El keystore es irremplazable.** Vive en `lexcapture-android/android/`
  (`keystore-RESGUARDAR/` y `keystore.properties`), está en `.gitignore` y **no se
  puede regenerar**: si se pierde, la app no se puede volver a actualizar nunca.
  Guardar una copia fuera de este PC.
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

## 6. Qué hace falta del usuario en el chat nuevo

1. La **clave pública de RevenueCat** — bloquea el muro de suscripción.
2. El **JSON de la cuenta de servicio** — desbloquea las subidas automáticas.
3. El **`SY_CLIENT_ID`** de Google Cloud — bloquea la copia en Drive.
4. Los **precios** de los planes mensual y anual.
5. Decidir el **ID de la suscripción** antes de crearla (irreversible).
