# Subir Flagrante a Play Store — punto de partida

> Medido el **2026-09-25** contra el **build 132** y el **`.aab` versionCode 4** (Fase 0 de
> seguridad: **el código web viaja DENTRO del paquete**, ya no se descarga de GitHub — §4).
> Empezar el chat nuevo leyendo **este archivo**, no el `CLAUDE.md` entero (son
> 4 000 líneas de historia del producto; aquí está solo lo que hace falta para
> publicar).
>
> **Primer mensaje sugerido en el chat nuevo:**
> «Lee PUBLICAR.md y sigamos con la subida a Play Store. Voy por el paso N de la
> sección 0.»

---

## 0. LO SIGUIENTE QUE HAY QUE HACER

En este orden. Lo marcado **[USUARIO]** no lo puede hacer el asistente.

| # | Acción | Quién |
|---|---|---|
| 1 | Subir `app-release.aab` (**versionCode 4**, versión 1.2 — sustituye al 3; si el 3 no se llegó a subir, se sube directamente el 4) a **prueba interna** desde el navegador | **[USUARIO]** |
| 2 | Probarlo en un teléfono real — empezar por las barras del sistema (§5) | **[USUARIO]** |
| 3 | Pegar la ficha de `store-listing.md` y subir los gráficos | **[USUARIO]** |
| 4 | **Promover a prueba cerrada e inscribir a los 12 probadores el mismo día** | **[USUARIO]** |
| 5 | Pasar al chat la **huella SHA-1 de Google** (Play Console → Prueba y lanza → Integridad de la app) | **[USUARIO]** |
| 6 | ~~Añadirla al cliente OAuth de Android~~ → **aplazado a la Fase 2**: la copia en Drive quedó apagada en la app de Play por la bandera `syncNativo` (Fase 0) | — |
| 7 | Corregir lo que salga en las pruebas · ⚠️ **desde la Fase 0 cada corrección es un paquete nuevo** (`npm run build:android`, `versionCode` +1): el código ya no se descarga de GitHub | asistente |
| 8 | Cerrados los 14 días con los 12 dentro, **pedir el acceso a producción** | **[USUARIO]** |

⚠️ **El paso 4 es el que manda el calendario.** El reloj de 14 días **solo corre en
prueba cerrada** y arranca cuando los 12 están inscritos a la vez. No esperar a
tener la app «terminada»: se corrige mientras el reloj corre (§5).

⚠️ **La primera subida de una ficha NO se puede hacer por API.** Google responde
403 sin decir que la causa es esa. El paso 1 es **manual, por el navegador**;
`npm run deploy:playstore` sirve a partir de la segunda subida, y además necesita
la clave de servicio, que todavía no existe.

---

## 1. Estado real, medido (no supuesto)

| Pieza | Estado |
|---|---|
| Cuenta de Play Console | ✅ verificada |
| App creada en Play Console | ✅ sí (22-09). Checklist de «Configura tu app» diligenciado |
| Primera subida | ✅ versionCode **1** lanzado en prueba interna el 23-09. El **2** lo sustituyó; el **3** (Mejora A: barras del sistema) lo sustituye |
| `.aab` listo | ✅ `lexcapture-android/android/app/build/outputs/bundle/release/app-release.aab` · **4 297 168 B** · `jar verified` · **versionCode 4** (1.2) · `com.getcorenova.flagrante` · minSdk 24 · targetSdk 36 · compilado 25-09 11:13 · **lleva dentro el build web 132** (`base/assets/public/index.html`) |
| Copia de seguridad de Android | ⛔ **excluida a propósito** (Fase 0): `allowBackup="false"` + `dataExtractionRules` que excluyen todo. Al cambiar de teléfono Android **no** restaura las capturas |
| Origen del WebView | `server.hostname = getcorenova.github.io` **a propósito**: es el origen de la versión de carga remota, así un teléfono que actualiza desde el 3 conserva sus datos (medido en el emulador) |
| Consola de depuración en el `.aab` | ✅ **NO viaja** — comprobado extrayendo `base/assets/capacitor.config.json` del paquete |
| Permisos del manifiesto fusionado | `INTERNET` · `ACCESS_NETWORK_STATE` · `CAMERA` (hardware **opcional**) · `DUMP`. **Sin `BILLING`** |
| Plugins nativos | filesystem · share · status-bar · browser · app |
| Ícono dentro del `.aab` | ✅ comprobado extrayéndolo: la F ámbar en el visor cian |
| Nombre en Android | ✅ `Flagrante` (`strings.xml`) |
| Código web publicado | ⏳ **build 132** en la rama `fase-0`, **sin publicar** hasta que se apruebe la Fase 0 · en vivo sigue el **131** |
| Sincronización con Drive | ✅ versión web, solo con el botón «Sincronizar ahora» y fusión a tres vías (Fase 0). **Apagada en la app de Play** (bandera `syncNativo`) hasta la Fase 2 |
| Recuperación de la copia | ✅ correo + contraseña de recuperación (build 128) |
| Google Cloud | ✅ proyecto `Flagrante`, Drive API, consentimiento **En producción**, `drive.appdata` (no sensible) |
| Ficha de tienda | ✅ `store-listing.md` — nombre **Flagrante** |
| Política de privacidad | ✅ https://getcorenova.github.io/lexcapture/privacy.html · HTTP 200 |
| Ícono 512×512 de la ficha | ✅ `icon-store-512.png` (a sangre, sin transparencia) |
| Gráfico de funciones 1024×500 | ✅ `lexcapture-android/store/feature-graphic-1024x500.png` |
| Capturas de teléfono | ✅ 5 en `lexcapture-android/store/` a **1080×1920 (9:16 exacto)**. ⚠️ A 1080×2400 la consola las marcaba «Necesita recorte» |
| Repositorio | ✅ `main` al día con `origin/main` |
| Facturación / suscripciones | ⏸️ **fuera del primer paquete a propósito** (§6) |
| Clave de la cuenta de servicio | ❌ falta → `npm run deploy:playstore` todavía no sirve |

Comprobar el estado en cualquier momento:

```
npm run build:android:check          # keystore, JDK, SDK, versionCode
npm run deploy:playstore -- --check  # Ruby, Fastlane, clave de servicio, firma
```

---

## 2. Lo que hace falta del usuario

Es el cuello de botella. Por orden de urgencia:

1. **La huella SHA-1 de Google** (Play Console → Prueba y lanza → Integridad de la app).
   ⚠️ Desde la Fase 0 ya no desbloquea nada por sí sola (la copia en la app de Play
   está apagada por bandera), pero **la Fase 2 la necesita** para el inicio de sesión
   con Firebase — conviene tenerla. Lo que sigue es la historia anterior:
   El cliente OAuth de Android **ya está creado** (23-09) con la huella del
   certificado de carga, así que la sincronización ya funciona en un paquete
   instalado a mano. Falta la huella con la que Google re-firma lo que baja de
   la tienda: se **añade** al mismo cliente, **no exige recompilar** ni tocar el
   código. ⚠️ El día que se añada hay que actualizar `privacy.html`, que hoy dice
   que la copia en Drive existe solo en la versión web.
2. **Los 12 probadores.** El recurso de plazo más largo: todo lo demás depende de
   ti, esto depende de otras doce personas.
3. **El JSON de la cuenta de servicio** — desbloquea las subidas automáticas.
4. Solo cuando se reponga la facturación (§6): clave de RevenueCat, precios y el
   ID de la suscripción, que es **irreversible**.

---

## 3. Lo que NO se puede tocar

### Nombres viejos que se quedan a propósito
La app se llama **Flagrante**. El nombre anterior sobrevive en cuatro sitios
técnicos, ninguno visible para el usuario. **No «corregirlos»:**

| Dónde | Qué rompe si se cambia |
|---|---|
| `getcorenova.github.io/lexcapture/` (URL) | Es la **versión web**. El `.aab` ya no carga de ahí desde el versionCode 4, pero los versionCode 1-3 instalados sí: no moverla mientras quede alguno |
| `server.hostname = getcorenova.github.io` (envoltorio) | Es el **origen** del almacenamiento del WebView: cambiarlo deja a cada teléfono con un almacenamiento **vacío** (las capturas siguen ahí, pero la app ya no las ve) |
| `LexCapture_v8.html` | Lo referencian ~40 suites de regresión y el `sw.js` |
| `lexcapture-sync-v1` (HKDF) · `lexcapture-sync.bin` · `PT_MARCA` · canal WebRTC | **Deja ilegible lo sincronizado en el Drive del usuario** y rompe el vínculo entre dos teléfonos |
| alias del keystore | El keystore es **irremplazable** |

### Decisiones irreversibles
- **Gratuita** → de gratuita a de pago no se puede cambiar nunca. La suscripción
  es una compra *dentro* de la app, así que la app es gratuita. Ya está marcado.
- **Nombre del paquete** `com.getcorenova.flagrante` → lo fijó el primer `.aab`.
- **El ID de una suscripción** → decidirlo antes de crearla (§6).

### Credenciales
⚠️ **Nunca cometer** `google-play-key.json`, `*.jks` ni `keystore.properties`.
Este repositorio **es público** (sirve GitHub Pages). Si se comete una credencial
no basta con borrarla en otro commit: **hay que rotarla** — y **el keystore no se
puede rotar**. Si se pierde, la app no se puede volver a actualizar nunca: guardar
una copia fuera de este PC.

---

## 4. Qué obliga a un paquete nuevo y qué no

⚠️ **DESDE LA FASE 0 (2026-09-25) EL `.aab` LLEVA EL CÓDIGO WEB DENTRO.** Antes
Capacitor cargaba la app desde `https://getcorenova.github.io/lexcapture/`: cómodo
para corregir a diario, pero cualquiera con acceso al repositorio podía cambiar el
código que corre en los teléfonos sin pasar por Play. Ahora `npm run build:android`
copia la app al paquete y cada cambio pasa por la revisión de Play. La contracara,
aceptada: **corregir durante las pruebas cuesta un paquete por corrección**.

| Cambio | ¿Nuevo `.aab`? | Cómo se publica |
|---|---|---|
| Formularios, validaciones, textos, los siete documentos, dossier, estadísticas, navegación, CSS, botones, zonas seguras | **Sí** (app de Play) · No (web) | `npm run build:android` + `versionCode` +1 · y `npm run deploy:web` para la versión web |
| Permisos del manifiesto | Sí | Recompilar, `versionCode` +1 |
| Plugin de Capacitor nuevo o retirado | Sí | Ídem |
| Ícono del lanzador, nombre de la app, package | Sí | Ídem |
| `minSdk` / `targetSdk`, tema nativo, splash, `MainActivity.java` | Sí | Ídem |

`npm run build:web` sigue validando la sintaxis de los bloques de script y los tres
tokens anticaché, y `build:android` empaqueta ese mismo HTML: **ese paso no se
salta**. Para probar en el emulador sin firmar: `npm run build:android -- --debug`.

---

## 5. De la prueba cerrada a producción

### Los 12 probadores — lo que Google cuenta de verdad
- Tienen que **aceptar la invitación** abriendo el enlace de participación.
  ⚠️ **Estar en la lista de correos NO basta**, y es el motivo más común de que el
  contador no suba.
- **14 días seguidos inscritos.** Si alguien se sale, el contador baja.
- ⚠️ **La prueba INTERNA no cuenta. Solo la cerrada corre el reloj.**
- Subir versiones nuevas **no reinicia nada**: el reloj cuenta probadores, no
  versiones. Los probadores siguen contando y no tienen que volver a aceptar nada.
- Si no se juntan los 12, no se pierde la app ni la prueba: el reloj **arranca
  cuando los 12 están dentro a la vez**.
- El contador de Play Console es la fuente autorizada.
- La solicitud de producción **pregunta qué retroalimentación hubo y qué se hizo
  con ella**: anotarlo desde el primer día.
- ⚠️ **Google revisa esa solicitud y puede tardar días**: el calendario mínimo real
  son ~3 semanas, no 14 días.

### ⚠️ Hueco detectado y NO corregido: la barra de abajo no tiene suelo
La barra inferior, las hojas de acciones y los avisos usan
`env(safe-area-inset-bottom)`, y en Android se le pide al sistema que reserve él la
franja (`lcHuecoBarra` → `setOverlaysWebView({overlay:false})`). **Pero cuando
Android ignora esa petición** —desde su versión 15 fuerza el borde a borde— el
respaldo del CSS existe **solo para arriba** (`body.nat{--sat:max(...,24px)}`).
No hay equivalente para abajo: los cinco botones de la barra inferior podrían
quedar bajo la barra de navegación del teléfono. **Es lo primero que hay que mirar
en un equipo con barra de tres botones.** El arreglo sería CSS, sin paquete nuevo.

### Qué probar en el teléfono
Con dos equipos: uno con barra de tres botones y otro con gestos.

- **Pantalla** — los 5 botones de la barra inferior completos · el título sin
  solaparse con el reloj · el último botón de cada hoja de acciones alcanzable ·
  con el teclado abierto, que se vea el campo en el que se escribe.
- **Recorrido** — una captura de flagrancia entera (9 pasos) · una por orden
  judicial (4 pantallas) · cerrar a media captura y recuperar el borrador · botón
  atrás de Android: que pregunte, no que salga.
- **Documentos** — FPJ-5 URI y CESPA · acta de derechos · acta de incautación ·
  cadena de custodia · rótulo · acta de entrega · oficio de disposición · abrir dos
  **en Word en el teléfono** y que no pida reparar · compartir por Gmail y WhatsApp.
- **Datos** — cerrar del todo, reabrir y desbloquear con el PIN · 10-15 capturas
  seguidas · **modo avión**: diligenciar y generar un documento entero.
- **Permisos** — cámara para el lector de códigos de Modo compartir.
- **Versiones** — uno reciente (14/15) y uno viejo si se consigue, por el WebView.

### Lo que solo aparece instalado desde Play
1. Las zonas seguras. El navegador no lo reproduce.
2. ~~El primer arranque necesita señal~~ — **resuelto en la Fase 0**: el código va
   en el paquete y la app arranca en modo avión desde el primer uso (medido).
3. La sincronización con Drive, apagada en la app de Play hasta la Fase 2.
4. Compartir el documento de Word por el camino nativo.
5. El diálogo del permiso de cámara.
6. El botón atrás de Android · el teclado tapando campos · un System WebView viejo
   en Android 7 (`minSdk` 24).

---

## 6. Reponer la facturación — los cinco pasos van JUNTOS

⚠️ **El primer paquete va SIN facturación, a propósito.** Declaraba
`com.android.vending.BILLING` y llevaba el SDK de RevenueCat **sin una sola línea
que lo llamara**. Play detecta ese permiso y marca la ficha como «Compras dentro de
la aplicación», contra unas respuestas ya enviadas que dicen **No** a productos
digitales. Mismo criterio con el que se quitó el párrafo de SUSCRIPCIÓN de la
descripción: **no anunciar lo que la app no tiene.**

Cuando el muro de pago exista de verdad, **reponer las cinco cosas a la vez**
(reponer una sola vuelve a crear el desajuste, por el otro lado):

1. `npm install @revenuecat/purchases-capacitor` + `npx cap sync android`, subir el
   `versionCode` y **una versión nueva**.
2. **«Sí» a productos digitales** en la clasificación de contenido.
3. **«Historial de compras»** en Seguridad de los datos.
4. La **sección 8 de `privacy.html`**.
5. El **párrafo de SUSCRIPCIÓN de `store-listing.md`**.

⚠️ Al quitar el plugin desapareció `ACCESS_NETWORK_STATE`, que **llegaba solo por su
manifiesto fusionado**: ahora se declara en el propio. **Un permiso que la app
necesita no puede depender de una dependencia que se quita.**

**Dónde se crean** (solo después de que haya un `.aab` subido): Play Console →
Monetizar → Productos → Suscripciones. **Una** suscripción con **dos planes base**,
mensual (P1M) y anual (P1Y). Los «accesos gratuitos» y los «descuentos» son
**códigos promocionales** y **probadores con licencia**, que ya existen ahí:
⚠️ **no se programan dentro de la app** — eso ya se intentó una vez y se retiró
entero (ver «Puntos 2 y 3 · RETIRADO» en `CLAUDE.md`).

**El muro, cuando se escriba**: vive en `lcProducirDoc` (productor único de
documentos), **falla ABIERTO** (si no se puede comprobar el derecho, deja pasar),
**nunca** bloquea una captura empezada, ni leer, ni editar, ni exportar el
respaldo. El plazo del artículo 28 son 36 horas: dejar a un policía sin su FPJ-5
cuesta infinitamente más que una mensualidad sin cobrar. La app pregunta «¿tiene el
derecho premium?», nunca por un producto concreto.
⚠️ **En la web de escritorio no existe Play Billing**: cobrar ahí es otra decisión.

---

## 7. Trampas que ya costaron tiempo

- ⚠️ **Cada subida necesita un `versionCode` MAYOR.** Lo sube `bump_version` de
  Fastlane, que escribe el `build.gradle` byte a byte (antes lo corrompía y le
  cambiaba los 71 finales de línea).
- ⚠️ **Gradle dice `BUILD SUCCESSFUL` sin compilar nada** si está todo al día:
  comprobar la **fecha del `.aab`**, no el mensaje. Solo `clean bundleRelease`
  prueba algo.
- ⚠️ **La consola de depuración del WebView no puede viajar en la versión pública.**
  Se activa en `capacitor.config.json` (`webContentsDebuggingEnabled`) para medir
  dentro del envoltorio y hay que **quitarla antes de compilar el release**: con
  ella, cualquiera con un cable inspecciona los datos de las capturas. Comprobarlo
  siempre extrayendo `base/assets/capacitor.config.json` del `.aab`.
- ⚠️ **El ícono del teléfono NO sale del `manifest.json`**, sale de los recursos del
  envoltorio (`mipmap-*`). Al cambiarlo, `npm run gen:icons` **y recompilar**, y
  después **extraerlo del `.aab` y mirarlo**: dar por hecho que Gradle lo metió ya
  falló una vez (el paquete llevaba el logo por defecto de Capacitor).
- ⚠️ **La ficha y la política se quedan atrás sin que nada avise**: ninguna suite
  las ejecuta ni las mide. Al añadir cualquier función que mueva datos fuera del
  equipo, tocar `privacy.html` y `store-listing.md` en el mismo trabajo. Ya pasó
  dos veces.
- ⚠️ **Nada de escudos ni nombres de institución** en el ícono, el gráfico, las
  capturas ni el texto de la ficha: Play lo rechaza por impersonación de entidad
  gubernamental. El vocabulario legal (FPJ-5, NUNC, URI, CESPA) sí puede ir — es
  del sistema judicial, no una marca.
- ⚠️ **Las capturas llevan datos inventados del simulador** (correos en el dominio
  reservado `.test`). **Nunca subir capturas de un procedimiento real**: son datos
  personales de un capturado, y en CESPA de un menor (Ley 1581 de 2012).
- ~~`lexcapture-android/www/index.html` con el título `LexCapture`~~ — resuelto en
  la Fase 0: `build:android` escribe ahí la app misma.
