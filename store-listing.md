# Ficha de Play Store — LexCapture

> Actualizada el 2026-09-21 contra el build 113. La versión de julio quedó en
> `lexcapture-android/store-listing.julio.bak.md` (fuera del repo): describía una app sin sincronización, sin Modo
> compartir, sin suscripción y con solo dos documentos.
> ⚠️ **Play exige que la ficha, la política de privacidad y el formulario de
> Seguridad de los datos digan lo mismo.** Si se toca una, revisar las tres.
> Política publicada: https://getcorenova.github.io/lexcapture/privacy.html

## Nombre de la app (máx. 30) — 10 usados
LexCapture

## Descripción breve (máx. 80) — 71 usados
Registro de capturas en campo: documentos legales automáticos y offline

## Categoría
Productividad (Productivity)

## Descripción completa (máx. 4000)
LexCapture es una herramienta de trabajo en campo para digitalizar el registro de capturas y aprehensiones según el procedimiento penal colombiano (Ley 906 de 2004). Está pensada para usarse con el teléfono en la mano, sin conexión a internet.

Reemplaza el llenado manual en papel: se diligencia una sola vez y la aplicación produce los documentos del procedimiento con esos mismos datos.

DOCUMENTOS QUE GENERA
• Informe de Captura en Flagrancia (FPJ-5), en sus dos formatos: adultos (URI) y adolescentes (CESPA).
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

COPIA DE SEGURIDAD OPCIONAL
Quien quiera puede activar una copia cifrada en su propia cuenta de Google Drive, para tener la misma información en el teléfono y en el computador. Se cifra en el dispositivo antes de subirla y la clave no sale de los equipos del usuario: nadie más puede leerla. Es opcional y viene desactivada.

SUSCRIPCIÓN
La aplicación ofrece una suscripción mensual o anual para generar documentos. La compra se realiza a través de Google Play.

LexCapture es una herramienta de productividad personal. No está afiliada, respaldada ni distribuida por ninguna institución: cada usuario configura sus propios datos de entidad, unidad, despacho y encabezado.

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
   dispara el usuario hacia la app que él elige; LexCapture no transmite nada por
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
