# Ficha de Play Store — Flagrante

> Actualizada el **2026-09-22** contra el **build 118**, con el nombre **Flagrante**.
> ⚠️ Las URL siguen diciendo `lexcapture` a propósito: el `.aab` ya firmado carga
> desde ese repositorio y renombrarlo dejaría tiesas las apps ya instaladas.
> ⚠️ **Play exige que la ficha, la política de privacidad y el formulario de
> Seguridad de los datos digan lo mismo.** Si se toca una, revisar las tres.
> Política publicada: https://getcorenova.github.io/lexcapture/privacy.html

## Nombre de la app (máx. 30) — 9 usados
Flagrante

## Descripción breve (máx. 80) — 71 usados
Registro de capturas en campo: documentos legales automáticos y offline

## Categoría
Productividad (Productivity)

## Descripción completa (máx. 4000)
> ⚠️ **Versión 1 (build 118):** se retiraron los párrafos de COPIA DE SEGURIDAD y
> SUSCRIPCIÓN. Ninguna de las dos funciona en este build — el identificador de
> Google está vacío y no hay código de compras. Anunciar en la tienda una función
> que la app no tiene es motivo de rechazo por ficha engañosa. **Se reponen cuando
> cada una exista de verdad, y entonces hay que actualizar también Seguridad de
> los datos y la Clasificación del contenido.**
Flagrante es una herramienta de trabajo en campo para digitalizar el registro de capturas y aprehensiones según el procedimiento penal colombiano (Ley 906 de 2004). Está pensada para usarse con el teléfono en la mano, sin conexión a internet.

Reemplaza el llenado manual en papel: se diligencia una sola vez y la aplicación produce los documentos del procedimiento con esos mismos datos.

DOCUMENTOS QUE GENERA
• Informe de Captura en Flagrancia (FPJ-5), en sus dos formatos: para adultos y para adolescentes.
• Acta de Derechos del Capturado (FPJ-6), una por cada persona.
• Acta de Incautación de Elementos.
• Registro de Cadena de Custodia (FPJ-8) y Rótulo de EMP y EF (FPJ-7).
• Acta de Entrega (FPJ-30).
• Oficio de puesta a disposición para capturas por orden judicial.
• Resumen de la captura y mensaje de novedad listo para enviar.

Los formatos oficiales se rellenan sobre el archivo original, así que conservan su diseño, sus casillas y su numeración.

PENSADA PARA EL PROCEDIMIENTO, NO SOLO PARA ESCRIBIR
• Terminología diferenciada para adolescentes: aprehensión, no captura (Ley 1098 de 2006).
• Validación del NUNC de 16 dígitos y actualización automática del año.
• Control del término de 36 horas (artículo 28 de la Constitución).
• Vigencia de la orden de captura y propuesta de la autoridad a la que se deja a disposición, con su fundamento.
• Registro reutilizable de personas, despachos judiciales y perfiles de funcionario.
• Firma manuscrita del funcionario, que se estampa sola en el oficio.

FUNCIONA SIN CONEXIÓN
Toda la información se guarda cifrada (AES-256) en el propio dispositivo y la aplicación arranca y produce documentos sin señal. El acceso se protege con un PIN de 4 dígitos.

TRABAJO EN PAREJA
Dos equipos se vinculan mostrando un código en pantalla y se pasan las personas y las capturas ya registradas, directamente entre los dos teléfonos por la misma red wifi, sin pasar por ningún servidor. También se pueden pasar por archivo cifrado.

Flagrante es una herramienta de productividad personal. No está afiliada, respaldada ni distribuida por ninguna institución: cada usuario configura sus propios datos de entidad, unidad, despacho y encabezado.

## Datos de contacto
- Correo: getcorenova@gmail.com
- Sitio web: https://getcorenova.github.io/lexcapture/
- Política de privacidad: https://getcorenova.github.io/lexcapture/privacy.html

## Recursos gráficos — TODOS LISTOS en `lexcapture-android/store/`
> Se regeneran con `npm run store:assets` y `npm run store:feature`.
- [x] Ícono 512×512 — `Crear App/icon-512.png`
- [x] Gráfico de funciones 1024×500 — `store/feature-graphic-1024x500.png`
- [x] Capturas de teléfono 1080×2400 (5, generadas del build 113 con datos ficticios):
      `store/01_capturas.png` · `02_expediente.png` · `03_personas.png` ·
      `04_estadisticas.png` · `06_wizard.png`

⚠️ Las capturas salen del simulador: nombres, cédulas y direcciones son inventados
y los correos usan el dominio reservado `.test`. **Nunca subir capturas con datos
de un procedimiento real** — son datos personales de un capturado, y en CESPA de
un menor (Ley 1581 de 2012).
⚠️ Si la interfaz cambia, regenerarlas: una ficha que enseña una app que ya no
existe es motivo de rechazo, y las de julio mostraban hasta un error en rojo.

## Formulario «Seguridad de los datos» — cómo responderlo

> ⚠️ **PARA EL PRIMER PAQUETE (build de 2026-09-22) NO SE DECLARA NADA DE ESTO.**
> Ese `.aab` **no lleva facturación** —se retiró el plugin, el manifiesto no tiene
> `com.android.vending.BILLING` y el `.dex` tiene 0 referencias— así que **no hay
> historial de compras que declarar**; y **la copia en Drive está oculta en la app
> de Play** (Google bloquea su consentimiento dentro de un WebView), así que **no
> transfiere nada**. La respuesta correcta hoy es **no se recopila ni se transfiere
> ningún dato**, y es cierta. Lo de abajo es el escenario **con** facturación y
> **con** Drive: se aplica cuando se repongan, junto con la sección 8 de
> `privacy.html` y el párrafo de SUSCRIPCIÓN de la descripción.
> ⚠️ **La política, la ficha y este formulario tienen que decir lo mismo.**

⚠️ Esta sección REEMPLAZA la nota de julio, que decía «la app NO envía datos a
servidores» y «no hay SDKs de terceros». **Las dos afirmaciones dejaron de ser
ciertas** con la copia en Drive (2026-09-18) y con RevenueCat (facturación).

Qué declarar:
1. **Información personal y archivos del usuario — se TRANSFIEREN, no se recopilan.**
   Solo si el usuario activa la copia de seguridad, y van **a su propia cuenta de
   Google Drive**, cifradas en el dispositivo antes de salir. El desarrollador no
   tiene acceso ni recibe copia. Marcar «cifrado en tránsito» y «el usuario puede
   solicitar su eliminación» (borra el archivo de su Drive o desactiva la copia).
2. **Compras dentro de la aplicación / historial de compras — SÍ.**
   Es obligatorio por el permiso `com.android.vending.BILLING`. Google Play procesa
   el pago; RevenueCat recibe el comprobante y un identificador de instalación para
   validar la suscripción. No recibe capturas, personas ni documentos.
3. **NO hay** analítica, publicidad, identificadores de publicidad, ubicación,
   contactos, ni recopilación de datos para el desarrollador.
4. **Los datos de trabajo (capturas, personas, documentos) NO se recopilan.** Viven
   cifrados en el dispositivo. El envío de un documento por WhatsApp o correo lo
   dispara el usuario hacia la app que él elige; Flagrante no transmite nada por
   su cuenta.
5. **El paso de datos entre dos equipos (Modo compartir) es directo entre los dos
   teléfonos** por la red local, cifrado, sin servidor intermedio.

## Permisos declarados en el manifiesto, y qué decir de cada uno
| Permiso | Para qué |
|---|---|
| `INTERNET` + `ACCESS_NETWORK_STATE` | Cargar la aplicación y, solo si se activan, la copia en Drive y la comprobación de la suscripción |
| `CAMERA` (+ `uses-feature required="false"`) | **Solo** leer el código de vinculación que otro equipo muestra en pantalla. Opcional: sin él, todo lo demás funciona |
| `com.android.vending.BILLING` | Procesar la suscripción a través de Google Play |

## Clasificación de contenido
Herramienta de productividad, sin contenido generado por usuarios visible para
terceros, sin chat, sin publicidad. El contenido que el usuario escribe es de
trabajo y no sale del dispositivo salvo por las vías que él dispara.

## Acceso a la app (formulario de Play) — ⚠️ CONTESTAR CON INSTRUCCIONES
**Respuesta: «Todas las funciones están disponibles sin acceso especial.»** No hay
cuenta, ni registro, ni credenciales que entregar: el PIN lo crea el propio
revisor en su equipo y solo protege lo que él mismo guarde.

⚠️ **Pero hay que escribir las instrucciones igualmente**, porque **la primera
pantalla que ve quien abre la app es «Configurar seguridad — crea un PIN»**
(comprobado abriéndola como usuario nuevo) y sin una línea de contexto se lee
como un muro de registro. Texto sugerido para el campo de instrucciones:

> La app pide crear un PIN de 4 dígitos la primera vez. Es una clave local que el
> propio usuario elige para cifrar los datos en su dispositivo: no es una cuenta,
> no se registra en ningún servidor y no hace falta ninguna credencial nuestra.
> Escriba cualquier PIN (por ejemplo 1234), confírmelo y entrará a la app.
> Para ver la app con datos, use «GENERAR CASO FICTICIO» en la pantalla inicial:
> crea una captura de demostración con datos inventados.

## Anuncios
**No.** La app no contiene publicidad ni identificadores de publicidad.

## Público objetivo y contenido
**Solo adultos (18+).** Es una herramienta de trabajo para funcionarios de policía
judicial; no está dirigida a menores ni tiene atractivo para ellos.
⚠️ Que la app trate procedimientos con **adolescentes** (CESPA, Ley 1098 de 2006)
**no cambia esta respuesta**: los menores son el sujeto del procedimiento que el
funcionario documenta, nunca el usuario de la app.

## ⚠️ ¿App gubernamental? — NO
Play pregunta si la app está asociada a un gobierno o desarrollada en su nombre.
**La respuesta es NO** y hay que poder sostenerla: la app **no menciona ninguna
institución** — el usuario escribe la suya en Ajustes—, el ícono es un monograma
y no un escudo, y el vocabulario legal (FPJ-5, NUNC, URI, CESPA) es del sistema
judicial colombiano, no la marca de una entidad. Es el de-branding de 2026-07-14.
⚠️ Si alguna vez se reintroduce un nombre de institución o un logo tipo escudo
**en el código**, esta respuesta deja de ser cierta y la ficha se cae.

## Categoría de la ficha y etiquetas
- Categoría: **Productividad**
- ⚠️ Play marcará la ficha como **«Compras dentro de la aplicación»** por el
  permiso `BILLING`, aunque el muro todavía no esté escrito. Es correcto.
