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

### ▶ Estado al 2026-10-24 — empezar por aquí
1. **Play rechazó el versionCode 5** por «Afirmaciones engañosas: falta el enlace a la fuente
   de información gubernamental». Corrección = solo la ficha: la descripción nueva de
   `store-listing.md` (AVISO al principio + FUENTES OFICIALES con enlaces .gov.co comprobados
   + documentos públicos por la Ley 1712 de 2014; 3 915/4 000 caracteres). ✅ **Pegada y
   enviada a revisión el 2026-10-24** junto con los otros 7 cambios de la configuración
   inicial (declaración «apps gubernamentales» = No, comprobado). Sin apelación.
   **Pendiente: el resultado de la revisión.** Si se aprueba → promover a prueba cerrada e
   inscribir a los 12 probadores el mismo día (§0, paso 4).
2. **Firebase en Blaze** (facturación de la cuenta Google nd6753540, compartida con
   getcorenova). Alerta de presupuesto de 10 000 COP creada. Secreto `PRUEBA_HMAC` v2,
   funciones y reglas **desplegadas** (ver la F3 más abajo).
3. ✅ **Play Integrity vinculado el 2026-10-24** al proyecto Flagrante (837685454525), límite
   10 000/día; respuestas por defecto (PLAY_RECOGNIZED + MEETS_DEVICE_INTEGRITY, que es lo que exige
   `prueba.js`). ✅ Formulario de Device Recall enviado el 2026-10-24
   (como getcorenova; caso de uso: prueba gratuita). Si Google lo aprueba escribe a ese
   correo; entonces activarlo en Play Integrity API → Administrar → Cambiar respuestas.
4. ✅ **Resuelto sin la URL de acción (build 142).** Reintentado por API el 2026-10-24: sigue
   `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`; y pedir el enlace con `handleCodeInApp` + `continueUrl`
   **no** lo evita (medido: la página de Google sigue pidiendo la contraseña). Hecho el **flujo de
   contraseña temporal**: en la página de Google se escribe una temporal, y en la app (pantalla
   «Termina en la app») se entra con ella y se cambia en el acto por la llave derivada de la
   nueva; después pide el código. `CU_ACCION_EN_APP = false`; si algún día se libera la
   plantilla, se pone en `true` y el enlace vuelve a abrir la app. `verify_cuenta` 62/62.
   `CU_FB` ya se puede commitear.
5. ✅ **F5 compras hecha en código (rama `f5-compras`, build 143, sin fusionar ni publicar).**
   `verify_compras` 30/30. `.aab` **versionCode 6** compilado y firmado (7,45 MB) con
   `BILLING` y RevenueCat 13.7.3. Lo que falta, en este orden (§6, «F5 — tareas»):
   a. **[USUARIO]** crear el secreto `REVENUECAT_SK` (clave secreta `sk_…` de RevenueCat).
   b. El asistente despliega las funciones (`miDerecho` ahora pregunta a RevenueCat).
   c. **[USUARIO]** subir el versionCode 6 a **prueba interna** (no a producción) y crear la
      suscripción en Play; enlazar los productos en RevenueCat; probar con un probador con licencia.
   Pendiente en el mismo paquete o el siguiente: el AVISO y las fuentes oficiales dentro de
   la app (Ajustes → Info).

En este orden. Lo marcado **[USUARIO]** no lo puede hacer el asistente.

| # | Acción | Quién |
|---|---|---|
| 1 | Subir `app-release.aab` (**versionCode 4**, versión 1.2 — sustituye al 3; si el 3 no se llegó a subir, se sube directamente el 4) a **prueba interna** desde el navegador | **[USUARIO]** |
| 2 | Probarlo en un teléfono real — empezar por las barras del sistema (§5) | **[USUARIO]** |
| 3 | Pegar la ficha de `store-listing.md` y subir los gráficos | **[USUARIO]** |
| 4 | **Promover a prueba cerrada e inscribir a los 12 probadores el mismo día** | **[USUARIO]** |
| 5 | Pasar al chat la **huella SHA-1 de Google** (Play Console → Prueba y lanza → Integridad de la app) | **[USUARIO]** |
| 6 | ~~Añadirla al cliente OAuth de Android~~ → **ya no hace falta**: la copia en Drive se retiró en la F4 (la información viaja con la cuenta) | — |
| 7 | Corregir lo que salga en las pruebas · ⚠️ **desde la Fase 0 cada corrección es un paquete nuevo** (`npm run build:android`, `versionCode` +1): el código ya no se descarga de GitHub | asistente |
| 8 | Cerrados los 14 días con los 12 dentro, **pedir el acceso a producción** | **[USUARIO]** |

⚠️ **El paso 4 es el que manda el calendario.** El reloj de 14 días **solo corre en
prueba cerrada** y arranca cuando los 12 están inscritos a la vez. No esperar a
tener la app «terminada»: se corrige mientras el reloj corre (§5).

⚠️ **La primera subida de una ficha NO se puede hacer por API.** Google responde
403 sin decir que la causa es esa. El paso 1 es **manual, por el navegador**;
`npm run deploy:playstore` sirve a partir de la segunda subida, y además necesita
la clave de servicio, que todavía no existe.

### La cuenta (F2, rama `f2-cuenta`): lo que hay que hacer en Firebase **[USUARIO]**

El código de la cuenta está hecho y probado contra los emuladores (`verify_cuenta.mjs`).
Mientras `CU_FB` esté vacío en `LexCapture_v8.html`, la cuenta queda «pendiente de
instalación» y la app funciona como antes. Para encenderla:

1. **Crear el proyecto** en https://console.firebase.google.com (sin Google Analytics).
2. **Firestore Database → Crear base de datos → ubicación `southamerica-east1` (São Paulo)**,
   modo producción. ⚠️ **Irreversible**: la ubicación no se puede cambiar después.
3. **Authentication → Método de acceso → Correo electrónico/contraseña: habilitar**
   (solo el primer interruptor; el «vínculo por correo» queda apagado). **No** activar una
   política de contraseñas: la app ya la exige en el teléfono, y Firebase nunca ve la real.
4. **Authentication → Plantillas → cualquier plantilla → «Personalizar URL de acción»** →
   `https://getcorenova.github.io/lexcapture/LexCapture_v8.html`.
   ⚠️ **Obligatorio.** Con la página de Google, quien restablece la contraseña la escribe
   allí, Firebase recibe la contraseña real y la cuenta deja de abrir desde la app.
   ⏳ **2026-10-24: sigue bloqueado** (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, también por la
   API de Identity Toolkit), **también ya en Blaze**. Hoy vale
   `https://flagrante.firebaseapp.com/__/auth/action`. ✅ Ya no bloquea: la app tiene el flujo
   de contraseña temporal (build 142, ver §0 punto 4). Si algún día se libera, poner la URL y
   `CU_ACCION_EN_APP = true`.
5. **Authentication → Configuración → Dominios autorizados**: añadir `getcorenova.github.io`.
6. **Configuración del proyecto → Tus apps → Web (`</>`)**, sin Hosting → pasar al chat
   el bloque `firebaseConfig` **entero** (`apiKey`, `authDomain`, `projectId`, `appId` **y
   `messagingSenderId`**, que es el número del proyecto y lo pide Play Integrity). No es secreto.
7. **Reglas**: las sube el asistente con `npx firebase deploy --only firestore:rules`
   tras un `npx firebase login` que haces tú una vez. (O se pegan a mano desde
   `firebase/firestore.rules` en Firestore → Reglas.)
8. Opcional y recomendable: en Google Cloud → Credenciales, restringir la clave de
   navegador a `https://getcorenova.github.io/*`.

El plan **Blaze** con alerta de presupuesto hace falta en la F3 (Cloud Functions); para
la F2 basta el plan gratuito.

### La prueba de 14 días (F3, rama `f3-derecho`) **[USUARIO]**

El código está hecho y probado contra los emuladores (`verify_prueba.mjs`, con Play
Integrity simulado). ⚠️ **La F3 NO se publica sola**: cierra la app al día 15 y la
compra llega en la F5. Publicarla antes dejaría a los usuarios sin forma de pagar.
Lo que hace falta, además de lo de la cuenta:

1. ✅ **Blaze activo (2026-10-24)**: cuenta de facturación «Flagrante» (013442-035B5A-912A0D),
   **propiedad de la cuenta Google nd6753540** y compartida con getcorenova como «Usuario de la
   cuenta de facturación» (en getcorenova Google Payments da OR-CBAT-14). El presupuesto y el tope
   se configuran desde nd6753540. Antes: en Google Cloud → Facturación →
   Presupuestos, una **alerta** (p. ej. 10 USD). Las funciones no corren sin Blaze.
2. ✅ **Google Cloud (el MISMO proyecto de Firebase) → APIs → habilitar «Google Play
   Integrity API»** — hecho por API el 2026-10-24.
3. **Play Console → Protegido por Play → Play Integrity API → Vincular el proyecto de
   Cloud** (el de Firebase). Sin esto el token no se puede descifrar en el servidor.
4. **Device Recall (beta)**: pedirlo en el formulario de interés
   (https://forms.gle/2d24B4gNyoVrqztG6); cuando lo aprueben, Play Console → Protegido
   por Play → Play Integrity API → Administrar → Cambiar respuestas → **Device recall:
   activado**. ⚠️ Activarlo borra las respuestas de prueba que hubiera configuradas.
   Mientras no esté, el respaldo por ANDROID_ID ya impide repetir la prueba (no tras
   restablecer de fábrica).
5. ✅ **Secreto creado (2026-10-24, versión 2; la 1 se destruyó)**; copia en `../keystore-RESGUARDAR/flagrante-PRUEBA_HMAC-PRIVADO.txt` (nunca al repo). Antes: `npx firebase functions:secrets:set PRUEBA_HMAC` con un
   valor largo al azar. ⚠️ **No cambiarlo nunca**: con otro secreto, todos los teléfonos
   que ya usaron la prueba quedarían «nuevos».
6. ✅ **Desplegado el 2026-10-24**: `miDerecho`, `iniciarPrueba`, `alBorrarUsuario` + reglas, con
   política de limpieza de imágenes (1 día) en southamerica-east1. ⚠️ En Windows el primer
   despliegue falla por tiempo: usar `FUNCTIONS_DISCOVERY_TIMEOUT=60`. Antes: **Desplegar** (lo hace el asistente tras `npx firebase login`):
   `cd firebase/functions && npm install` y luego
   `npx firebase deploy --only functions,firestore:rules`.
7. La app de Android que se suba tiene que traer el complemento de Play Integrity
   (**versionCode 6** en adelante).

⚠️ La prueba **solo se inicia desde la app instalada desde Google Play** (prueba cerrada
o producción): un APK de depuración, un emulador o un teléfono con root reciben «no».
Para probarla en un teléfono real hay que instalarla desde la pista de prueba.

### La nube (F4, rama `f4-nube`, construida ENCIMA de `f3-derecho`)

Capturas, personas, firmas y ajustes viajan registro por registro a Firestore
(`users/{uid}/reg/*`), cifrados con la llave de la cuenta. Probado contra los emuladores
(`verify_nube.mjs`). **La copia en Drive se retiró** (código, pantalla, menú, script de
Google y la puerta de retorno del manifiesto de Android). No hace falta ninguna tarea
nueva de consola: las reglas de los registros van en `firebase/firestore.rules` y se
suben con el mismo `npx firebase deploy --only firestore:rules` de la cuenta.
- ⚠️ **Lo que sobra en Google Cloud tras retirar Drive** (opcional, no rompe nada si se
  deja): la **Drive API** y los dos **clientes OAuth** (web y Android) del proyecto
  `Flagrante`. La app ya no los usa.
- ⚠️ **App Check** se dejó para la F6: hace falta registrar la app con la huella SHA-256
  de Play Console y una clave de reCAPTCHA Enterprise para la web.
- La versión nativa **cambió de complementos**: salen `@capacitor/browser` y
  `@capacitor/app` (solo los usaba Drive). Va en el mismo **versionCode 6** de la F3,
  que todavía no se ha subido.

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
| Plugins nativos | filesystem · share · status-bar · device (F3) — `browser` y `app` salieron en la F4 con la copia en Drive |
| Ícono dentro del `.aab` | ✅ comprobado extrayéndolo: la F ámbar en el visor cian |
| Nombre en Android | ✅ `Flagrante` (`strings.xml`) |
| Código web publicado | ⏳ **build 132** en la rama `fase-0`, **sin publicar** hasta que se apruebe la Fase 0 · en vivo sigue el **131** |
| Sincronización con Drive | ⛔ **retirada en la F4** (rama `f4-nube`): la información viaja con la cuenta, registro por registro y cifrada (§0, «La nube») |
| Google Cloud | proyecto `Flagrante`: la Drive API y los clientes OAuth quedan **sin uso** desde la F4 |
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
| `PT_MARCA` (`lexcapture`) | Es la marca del sobre de Modo compartir (buzón y archivo `.lexc`): cambiarla deja de abrir los archivos ya exportados y lo que haya en el buzón. El canal WebRTC se retiró el 2026-10-25, y los dos de Drive (`lexcapture-sync-v1`, `lexcapture-sync.bin`) en la F4 |
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
3. La nube de la cuenta (F4) entre el teléfono y la versión web.
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
derecho `flagrante_pro`?», nunca por un producto concreto.
⚠️ **En la web de escritorio no existe Play Billing**: cobrar ahí es otra decisión.

### F5 — tareas para terminarla (2026-10-24)
El código está hecho (ver «La suscripción (F5)» en `CLAUDE.md`). Cómo funciona: la app
compra con Google Play mediante RevenueCat (usuario de RevenueCat = uid de Firebase) y
después pregunta a `miDerecho`; **la función consulta la API de RevenueCat con la clave
secreta** y escribe `entitlements/{uid}` con `plan: 'pagado'`. El teléfono nunca se escribe
el plan. Sin webhook: la app siempre pregunta al servidor cuando tiene señal.

1. **[USUARIO] Secreto `REVENUECAT_SK`.** RevenueCat → Project settings → API keys →
   «+ New secret API key» (permisos de lectura de clientes, v1). Luego, en
   `Crear App/firebase`: `npx firebase functions:secrets:set REVENUECAT_SK` y pegar la
   clave **en la terminal**, nunca en el chat. Copia en `../keystore-RESGUARDAR/`.
   ⚠️ Sin este secreto el despliegue de las funciones **falla** (lo exige `miDerecho`).
2. **Desplegar** (asistente): `FUNCTIONS_DISCOVERY_TIMEOUT=60 npx firebase deploy --only functions`.
3. **[USUARIO] Subir `app-release.aab` versionCode 6 a prueba interna.** Play no deja crear
   suscripciones hasta que haya un paquete con `BILLING`. ⚠️ **No a producción ni a prueba
   cerrada todavía**: falta la F6 (formularios, ficha, App Check).
4. **[USUARIO] Play Console → Monetizar → Suscripciones**: una suscripción
   `lexcapture_premium` con dos planes base, `mensual` (P1M, renovación automática) y `anual`
   (P1Y), precios en COP, **sin oferta de prueba** (la prueba la da el servidor). Activarlos.
5. **[USUARIO] RevenueCat → Products**: los productos `lexcapture_premium:mensual` y
   `lexcapture_premium:anual` enlazados al entitlement `flagrante_pro` y en la oferta
   `default` (paquetes Monthly y Annual). Revisar lo que dejó el asistente (abajo).
6. **[USUARIO] Probadores con licencia** (Play Console → Configuración → Probar licencias):
   añadir los correos de prueba. Compran sin cobro real.
7. Recomendado: RevenueCat → Project settings → **Transfer behavior**: «Transfer to new App
   User ID» (por defecto). Y terminar *Google developer notifications* (abajo) para que
   RevenueCat se entere de renovaciones y cancelaciones sin esperar.

### RevenueCat — lo ya configurado (2026-10-23)
- Proyecto **Flagrante**, app de Play Store `com.getcorenova.flagrante`
  (App ID `app0a5deea47b`).
- **Clave pública del SDK (Android):** `goog_vKJzoidrLNxFALSmhtZbOEvvcOa`. Es pública
  (va dentro de la app); la de «Test Store» (`test_…`) es solo para pruebas y no se usa.
- **Credenciales de servicio:** cuenta `revenuecat@flagrante.iam.gserviceaccount.com`
  (roles Administrador de Pub/Sub y Visualizador de Monitoring), invitada en Play
  Console con los tres permisos de la cuenta (ver info de la app · datos financieros ·
  gestionar pedidos y suscripciones). Su clave JSON está en
  `../keystore-RESGUARDAR/flagrante-revenuecat-PRIVADA.json` — **nunca al repo ni al chat**.
  Subida a RevenueCat el 2026-10-23; Google tarda hasta 36 h en validarla («Check again»).
- **Entitlement:** identificador **`flagrante_pro`** (nombre visible «Flagrante Pro»;
  el identificador no se puede renombrar). La app consulta SOLO este entitlement, nunca
  un producto concreto. Oferta **`default`** con 2 paquetes (mensual y anual).
- ⚠️ **Revisar al crear las suscripciones en Play**: los 2 productos que el asistente de
  RevenueCat dejó enlazados al entitlement tienen que coincidir con los IDs reales de
  Play (`lexcapture_premium` con sus planes base mensual/anual), o el entitlement no se
  concederá nunca.
- **Pendiente:** conectar *Google developer notifications* (tema de Pub/Sub) cuando las
  credenciales salgan en verde.

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
