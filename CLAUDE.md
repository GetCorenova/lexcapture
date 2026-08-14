# LexCapture v8.0 RC — Contexto Maestro del Proyecto
<!-- Versión: v8.0 RC | Release Candidate: 2026-07-14 | Fase H re-ejecutada (ver sección Fase H más abajo) -->

## Qué es este proyecto
**LexCapture v8** es una PWA (Progressive Web App) para la Policía Nacional de Colombia que digitaliza el proceso de registro de capturas en campo. Reemplaza el papeleo manual generando automáticamente documentos legales oficiales.

## Estructura de archivos
```
Crear App/
├── CLAUDE.md           ← este archivo (leer siempre al iniciar sesión)
├── FASE_A.md … FASE_I.md  ← instrucciones por fase (leer solo al ejecutar)
├── Esqueleto.html      ← diseño v7 (fuente de CSS y navegación)
├── Motor.html          ← lógica v4/v6 (fuente de JS y funciones)
├── LexCapture_v8.html  ← ARCHIVO OBJETIVO (se crea en Fase A)
└── Documentos/         ← plantillas .docx de referencia legal
```

## Ejecución de fases — CÓMO FUNCIONA
Cuando el usuario diga **"ejecutar fase X"** (ej: "ejecutar fase A", "ejecutar fase B"):
1. Lee el archivo `FASE_X.md` completo
2. Ejecuta sus instrucciones en orden, sin pedir confirmación previa
3. Marca cada criterio de éxito al completarlo
4. Informa al usuario solo cuando la fase esté terminada (o si hay un bloqueador real)

## Contexto legal — Colombia
| Término | Significado |
|---------|-------------|
| **FPJ-5** | Formato de Informe de Captura en Flagrancia — formulario oficial de la Fiscalía |
| **URI** | Unidad de Reacción Inmediata — recibe adultos en flagrancia |
| **CESPA** | Centro de Servicios Judiciales para Adolescentes — recibe menores |
| **OJ** | Orden Judicial — captura por mandato de juez |
| **NUNC** | Número Único de Noticia Criminal (exactamente 16 dígitos) |
| **SPOA** | Sistema de Información de la Fiscalía |
| **Ley 906/2004** | CPP — define los 7 derechos del capturado |
| **Ley 1581/2012** | Habeas Data — protección datos personales (datos del capturado son datos sensibles) |

⚠️ Para menores (CESPA): usar "aprehendido/aprehensión", NO "capturado/captura" — diferencia legal crítica.

## Arquitectura técnica
- **Un solo archivo HTML autónomo** — sin servidor, sin dependencias externas
- **localStorage** para persistencia (3 colecciones: `lc_cases`, `lc_persons`, `lc_cfg`)
- **docx.js** embebido como base64 para generar documentos Word descargables
- **PWA**: manifest.json + Service Worker para uso 100% offline en campo
- **Mobile-first**: la app se usa con teléfono en campo (sin laptop)

## Decisiones de diseño — NO cambiar sin instrucción explícita
### Design System v2 (2026-07-18) — reconstrucción completa del sistema visual
Todos los colores fluyen por tokens CSS; el tema claro solo redefine tokens, no componentes. Los nombres legados (`--acc`, `--bg2`, `--tx`, `--txD`, `--rs`, `--uriT`…) se mantienen como **alias** porque el JS genera HTML que los referencia — no eliminarlos.
| Decisión | Oscuro | Claro |
|----------|--------|-------|
| Acento (índigo, botones primarios, nav activa) | `#8A94F8` (texto `#0E1020`) | `#4E5BD8` (texto blanco) |
| Fondo / superficies | `#0C0E13` · surface-1 `#12151C` · surface-2 `#171C26` · surface-3 `#1E2430` · elev `#1A202B` | `#F4F5F8` · blanco · `#F6F7FA` · `#ECEEF3` |
| Flagrancia (ámbar) | `#D98E35` / `#E8A54F` | `#B45309` |
| OJ (violeta) | `#9E8CF2` / `#B3A6F7` | `#6D3FD4` |
| URI (azul) / CESPA (rosa) | `#5FA8F5` / `#F2879D` | `#1663C7` / `#BE2A55` |
| OK / error | `#5BC98C` / `#F27078` | `#0C7A4F` / `#C7222F` |
| Escalas | Espaciado 4/8/12/16/20/24/32/40/48/64 · radios 6/10/14/20/999 · motion 120/180/240ms `cubic-bezier(.25,.72,.25,1)` |  |
| Iconografía | Familia única SVG stroke (estilo Feather, stroke 1.8–2). **Sin emojis en la UI** (solo en contenido de negocio: dossier WA, toasts de advertencia) |  |
| Prohibido | Gradientes en botones, glassmorphism en cards, glows cian, `Courier New` (mono = `ui-monospace` stack) |  |
| VERDE 3 | Campo `cfg.dosVerde3` = grado + nombre completo del oficial (ej: "Subteniente Juan Martínez López") | |
| DIAMANTE 3 | Campo `cfg.dosDiamante3` = grado + nombre completo del oficial | |
| Saludo dossier | Automático por hora: DÍAS (06-11:59) / TARDES (12-18:59) / NOCHES (19-05:59) | |

## Navegación (2026-07-17) — redistribución profesional
- **Sidebar desktop** agrupado con etiquetas de sección (`.sb-sec`): **Operación** (Capturas, Personas, Dossier) / **Análisis** (Estadísticas) / **Recursos** (Despachos, Plantillas). Perfil y Ajustes van anclados al fondo en `.sb-bottom` (patrón de apps profesionales).
- **Bottom bar móvil** (5 ítems): Capturas · Personas · **Nueva** (botón central circular destacado `.bn-cta`, gradiente ámbar→púrpura) · Dossier · Más. El FAB se eliminó por redundante con el CTA central. Estadísticas vive en el sheet "Más" (que ya no repite Personas).

## Tema claro/oscuro (2026-07-17)
- Oscuro por defecto; el modo claro se activa en **Ajustes → 🎨 Apariencia** (aplica al instante, sin "Guardar ajustes").
- Persistencia: clave `lc_theme` en localStorage **plano** (no cifrada a propósito — debe aplicarse antes de desbloquear el PIN). Script anti-flash inline en el `<head>`.
- Mecanismo: `:root[data-theme="light"]` sobreescribe las variables CSS + overrides puntuales de los colores oscuros hardcodeados, todo en un bloque al final del `<style>`. JS: `getTheme()` / `applyTheme()` / `setTheme()`.
- `--acc-fg` = color de texto sobre fondos `var(--acc)`: `#0E1020` en oscuro, `#fff` en claro. **No hardcodear texto sobre fondos `var(--acc)`** — usar siempre `var(--acc-fg)`.
- El `<meta name="theme-color">` se actualiza dinámicamente (`#0C0E13` oscuro / `#F4F5F8` claro).

## Encabezado del dossier — campos granulares (reemplaza `cfg.dosEncabezado`)
```
cfg.rangoComandante  → ej: "CORONEL" / "MAYOR" / "TENIENTE CORONEL"
cfg.numDistrito      → ej: "TRES" / "UNO" / "DOS" (en texto, no número)
cfg.nombreEstacion   → ej: "CANDELARIA" / "LAURELES" / "BELÉN"
```
Genera: `DIOS Y PATRIA MI [rangoComandante] [saludo automático]` / `DISTRITO [numDistrito] DE POLICÍA` / `ESTACIÓN DE POLICÍA [nombreEstacion]`

## Estado de las fases
Ver cada FASE_X.md para el estado individual. El usuario marca las fases como completas manualmente en la auditoría.

## Issues resueltos en v8.0
| Issue | Descripción | Estado |
|-------|-------------|--------|
| C1 | localStorage sin cifrado por defecto | ✅ AES-GCM implementado (Fase E) |
| A3 | Un solo perfil de funcionario | ✅ Multi-perfil implementado (Fase D) |
| A4 | Sin lista de despachos precargada | ✅ Despachos + favoritos (Fase D) |
| M2 | Sin campo artículo del Código Penal | ✅ articulosCP[] en wizard (Fase D) |
| M3 | NUNC sin validación 16 dígitos | ✅ validateNunc() implementada (Fase B) |
| M4 | WhatsApp doble disparo en desktop | ✅ if/else navigator.share (Fase C) |
| M5 | Debug bar visible en Esqueleto | ✅ Removido (Fase A) |
| A5 | FPJ-5 fecha como string (no celda-por-celda) | ✅ fechaDia/Mes/Ano + setTc por dígito (confirmado en Fase H) |
| S1 | `escape()`/`unescape()` deprecated | ✅ Ya no se usan en el código actual (confirmado en Fase H) |
| C3 | ~~Sin firma digital~~ | **CANCELADO**: documentos se imprimen y firman a mano |

## Publicación en Play Store (2026-07-14) — de-branding institucional
Google Play no permite nombres/símbolos que aludan a una institución (impersonación de entidad gubernamental sin autorización). Se removieron referencias hardcodeadas de "Policía Nacional" y el ícono con forma de escudo/insignia. La app **mantiene toda su funcionalidad y terminología legal** (FPJ-5, NUNC, SPOA, URI, CESPA, "Estación de Policía [nombreEstacion]" en el dossier) porque eso es vocabulario del sistema judicial colombiano, no una marca institucional — el problema era específicamente el nombre propio "Policía Nacional" y el logo tipo escudo.
- `manifest.json` / meta description: ya no mencionan la institución.
- Footer del sidebar y pantalla Ajustes → Info: ya no muestran "Policía Nacional".
- Campo `Entidad` del servidor (wizard paso 7): default vacío en vez de `'Policía Nacional'` hardcodeado — cada usuario escribe su propia institución (se guarda en `cfg.servidor.entidad` y persiste entre capturas).
- Datos de ejemplo del Simulador: `entidad`, `nombre` y `correo` genéricos (antes usaba `demo@policia.gov.co`, un dominio oficial real).
- Emoji `👮` (agente de policía) reemplazado por `👤` en pantallas de Perfil.
- Ícono rediseñado: pasó de un escudo ámbar con "LC" a un monograma **"L"** ámbar dentro de un **marco de visor de captura** cian (sin forma de escudo/insignia). Archivos finales: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (los referenciados por `manifest.json`) + `icon.svg` (fuente vectorial) + `<link rel="icon">`/`apple-touch-icon` en el `<head>`. El maskable tiene el diseño al 80% sobre fondo navy para respetar la zona segura del launcher. Master de alta resolución (1254px, generado con Gemini): `verify_01_carga_inicial.png`.
- **Si se reintroduce texto o un ícono que aluda a la institución, romperá el filtro de Play Store** — no hardcodear el nombre de ninguna institución específica en el código; dejar siempre que sea un campo configurable por el usuario (patrón ya usado en `cfg.rangoComandante`/`cfg.numDistrito`/`cfg.nombreEstacion`).

## Fase H (2026-07-14) — revisión final, bugs reales encontrados y corregidos
Revisión profunda (3 agentes en paralelo + verificación end-to-end con Playwright del golden path real, no solo lectura de código). Historial completo de diffs en `git log`. Hallazgos más severos:
- **Plantillas OJ de Disposición (Fiscalía/Juzgado) no generaban NUNCA el documento** — el .docx builtin embebido tenía rutas internas con `\` en vez de `/` (`word\document.xml`), por lo que el parser de zip nunca encontraba `word/document.xml` y la función abortaba con "Plantilla inválida". Roto desde el primer arranque de la app. Corregido normalizando separadores al leer el zip.
- **`URL.revokeObjectURL()` se llamaba inmediatamente después de `a.click()`** en la descarga de documentos OJ y en las exportaciones — podía cancelar la descarga antes de que el navegador la iniciara. Diferido con `setTimeout`.
- **Guardado cifrado con condición de carrera**: `_lcEncSave` no serializaba escrituras concurrentes a la misma clave de `localStorage`; ahora se serializa por clave y `wizSave()` espera el guardado real antes de confirmar éxito al usuario (antes podía mostrar "Caso guardado ✓" sin haber persistido nada).
- **"Continuar sin PIN" permitía crear capturas con éxito falso** sin cifrar ni persistir nada — eliminado.
- **Badge de plazo legal (Ley 906/2004) invertido**: mostraba "URGENTE" mientras el caso tenía *menos* de 36h y desaparecía justo al vencerse el plazo. Ahora escala a "VENCIDO" pasadas 36h.
- **`activarTemplate` desactivaba plantillas de otros tipos** (activar una de Juzgado rompía la de Fiscalía activa).
- **NUNC vacío se rellenaba con ceros (`padStart`)** en el FPJ-5 en vez de bloquear la generación — un documento legal oficial podía salir con un NUNC fabricado.
- Terminología CESPA (wizard: pasos, encabezado de fecha) y `dosGreeting()` (medianoche-5:59am decía "DÍAS") corregidos.

## FPJ-5 v2 (2026-07-20) — llenado inteligente + formato 100% limpio
Cambios en el motor del FPJ-5 (`buildFPJBlob`) y el wizard, pedidos en `Documentos/FPJ5.docx`. Verificado end-to-end con Playwright (Chromium) generando los .docx reales de URI y CESPA (46 comprobaciones sobre las celdas del documento).

**Contexto crítico del motor:** `setTc(tcs,i,txt)` y `setPar(pars,i,txt)` escriben por **índice plano** en el arreglo de todas las celdas/párrafos del documento en orden. Las plantillas embebidas (`TPL_URI`/`TPL_CESPA`, base64) comparten el **mismo layout de celdas** (308 celdas); solo difieren los índices de párrafo (narración/EMP). **Las plantillas traen datos de una captura de muestra** (DAYNIS GONZALES, servidor "Nelson David", etc.); toda celda que el código no sobrescriba **filtra ese dato de referencia** — por eso el llenado ahora es exhaustivo. Para regenerar la plantilla hay que respetar ZIP **stored** (sin compresión): `unzipDocx` lee el tamaño comprimido y decodifica directo, no infla.

- **Tipo de documento CC/DIE con "X" automática** (`markDocType()`): apartados 4 (capturado), 5 (víctima) y 6 (testigo). Casilla primaria = **C.C. en URI / T.I. en CESPA** (menor). Índices: capturado casilla primaria `89` + celda libre "Otra" `91` (se escribe el tipo real: DIE/CE/…); víctima `143`(C.C.)/`145`(Otra); testigo `198`/`200`.
- **Números de identificación sin puntos** (`sinPuntos()` = `.replace(/\./g,'')`): aplicado al **guardar** (persona, perfil, servidor) y al **generar** todos los documentos (FPJ-5 celdas `93`/`147`/`202`/`298`, Disposición OJ, dossier, acta). Cubre datos nuevos y legados.
- **8. Vehículos implicados**: nuevo **paso del wizard** con pregunta clara "¿Hay vehículos implicados?" (`rStepVeh`, `wc.hayVehiculos`/`wc.vehiculos[]`). Si "Sí" → modal (Marca/Clase/Color/Propietario/Placas), mapeado a celdas `249-253` (veh 1) y `254-258` (veh 2). El formato imprime hasta 2 filas. `collectStep` se refactorizó a **búsqueda por nombre de paso** (no por índice) para tolerar el paso nuevo en los 3 flujos (URI/CESPA/OJ).
- **Narración**: (a) **no se coloca la hora de puesta a disposición del fiscal** (celdas `289-292` en blanco — la escribe a mano el fiscal que recibe); la fecha de disposición sí se llena. (b) **Se elimina la narración de referencia**: el código antes solo sobrescribía el 1er párrafo (`setPar 363`/`366`) y dejaba filtrando 4-5 párrafos de la historia de muestra. Ahora se limpian todos los párrafos entre la narración y "10. ANEXOS".
- **Formato 100% limpio**: se limpian/mapean las celdas de referencia que quedaban sin tocar — género de muestra (`102`/`156`/`211`), correo real filtrado en el testigo (`241` traía `Daniel.romang@correo.policia.gov.co`), lugar de nacimiento país/depto/muni (`173`/`175`/`177`, `228`/`230`/`232`), relación con el indiciado (`187`), zona (`66`) y destino del informe (`57`, traía otra sede). Confirmado: cero rastros de la persona de muestra en documentos nuevos.
- **Diseño preservado 100%**: mismos logos, tipografía y estructura de casillas — los cambios de datos no alteran la identidad visual.

## FPJ-5 v2.1 (2026-07-20) — alineación de impresión + plantilla no corrupta
Segundo pase, sobre las plantillas embebidas `TPL_URI`/`TPL_CESPA` (constantes base64). Verificado abriendo los .docx generados en **Word real** (COM) y comparando el render a PDF/PNG (URI y CESPA, 4 páginas c/u); los 46 checks de datos siguen en verde.
- **Word ya no pide "reparar"**: la parte `word/fontTable.xml` de la plantilla URI venía con un defecto de namespace (`<ns0:fonts … ns1:Ignorable="w14 …">` con `ns1` sin declarar) que Word marcaba como archivo dañado. Corregido renombrando `ns0:`→`w:` y quitando el `Ignorable` inválido. **Al regenerar plantillas, validar SIEMPRE abriendo en Word, no solo el XML.**
- **Alineación a márgenes (las "líneas rojas")**: las 35 tablas del formulario tenían `tblInd` dispares (−4…−134) y anchos totales de 10467 a 10993 (área de contenido = 10631), así que unas se salían del margen derecho y otras no llegaban. Ahora **todas** tienen `tblW=10631` y `tblInd=-70`, escalando los `w:gridCol`. ⚠️ **En CESPA las celdas NO tienen `w:tcW`** (el ancho vive solo en `w:tblGrid`); por eso hay que escalar `gridCol`, no leer `tcW` (un intento previo leyó `tcW` inexistente como 0 y colapsó las celdas de CESPA).
- **Fila "puesto a disposición del Fiscal"**: venía en fuente más pequeña (sz=18 vs 22) y su etiqueta se partía en dos líneas y desalineaba las casillas respecto a la fila de captura. Ahora ambas filas de fecha comparten **geometría idéntica** (misma etiqueta ancha para que quepa en una línea, cajas D/M/A/Hora alineadas verticalmente) y **11pt (sz=22)** uniforme.

## FPJ-5 v2.2 (2026-07-20) — filas repetidas uniformes + sin "sombra" en las cajas + anti-caché
Tercer pase, sobre `TPL_URI`/`TPL_CESPA`. Los 38 checks de datos siguen en verde (celdas 308) tras los cambios.
- **Las 3 filas "Edad/Género/Fecha nacimiento" (21 celdas) ahora son idénticas.** Las tres sumaban 10631 (no se salían del margen) pero tenían **distinta distribución interna** de columnas: la del capturado (índice de tabla 9) rendiza bien "Años" en una línea, pero víctima (17) y testigo (25) daban menos ancho a la celda "años" y **partían el texto a `año`/`s`** ("datos que no encajan en las casillas"). Solución: copiar el **vector exacto de `gridCol` + `tcW` de la fila del capturado** a las de víctima y testigo. ⚠️ **Regla general: para uniformar filas de igual estructura, copiar el vector de la fila de referencia que ya rendiza bien — NO recalcular anchos** (recalcular reintroduce wraps). En CESPA las celdas Edad no tienen `tcW`, solo se copia `gridCol`.
- **Filas de víctima/testigo sin cortes de línea.** Mismo problema en otras filas repetidas: (a) `Lugar de nacimiento / País / Departamento / Municipio` (7 celdas, índices 18 y 26) partía `Departament`/`o` y `Paí`/`s`; (b) `Profesión u oficio` (índice 19) se partía en dos líneas en víctima pero no en testigo. Corregido dando ancho suficiente a las **etiquetas** y quitándoselo a las celdas de **valor de Departamento y Municipio, que el código siempre deja vacías** (`setTc` las limpia: 175/177 y 230/232). Vector único para 18 y 26: `[2450,680,2200,1700,1150,1250,1201]`; fila 19: `[2100,3190,1360,3981]` (ambos suman 10631). Resultado: las secciones 5 (víctima) y 6 (testigo) quedan **idénticas entre sí** y sin una sola palabra partida.
- **"Sombra" debajo de las casillas de fecha eliminada.** Las dos tablas de fecha (índices 32/33) traían `w:tblBorders` completos a `sz=4` (0.5pt) *además* de los bordes propios de cada caja de dígito a `sz=8` (1pt). Como las cajas ya se dibujan 100% con sus `w:tcBorders` (y las celdas-etiqueta anulan el perímetro con `nil`), el `tblBorders` a sz4 era redundante y podía **fantasmear detrás** del borde de la caja → efecto de sombra en pantalla. Se quitó el `tblBorders` de esas dos tablas; las cajas quedan iguales pero limpias. Verificado: quitar el `tblBorders` no cambia nada visible (todo el dibujo lo aportan los bordes de celda).
- **Anti-caché (el usuario veía builds viejos).** El redirect de `index.html` ahora apunta a `LexCapture_v8.html?v=9` (subir el token en cada despliegue fuerza al navegador/CDN a descargar el HTML nuevo) y `sw.js` sube a `cache-v9`. `LexCapture_v8.html` no está en la lista de precache del SW, así que la causa de ver cambios "sin aplicar" solía ser caché HTTP del HTML, no el código.

## FPJ-5 v2.3 (2026-07-21) — alineación de raíz: por qué los bordes NO coincidían
Los pases anteriores igualaron las **tablas** entre sí, pero el documento seguía viéndose torcido. Midiendo el PNG del render (script `measure_lines.ps1`: para cada línea horizontal se toma el x de inicio/fin) aparecieron **tres bordes izquierdos (93/99/107) y tres derechos (1446/1463/1468)** — hasta 22 px ≈ 3 mm de desfase. Causas, todas distintas:
1. **Las barras grises de sección NO son tablas, son párrafos** (`w:shd` D9D9D9 + `w:pBdr`). Por eso nunca se alinearon al normalizar tablas. Su borde llevaba `w:space="4"` (**4 puntos = 80 twips**) y Word dibuja el borde de párrafo **por fuera** del área de texto → sobresalían ~110 twips del margen. Una además tenía `right space="2"` (de ahí el tercer borde).
2. **Las tablas** tenían `tblInd=-70`, así que terminaban 70 twips **antes** del margen derecho.
3. **Sección 3**: la columna de etiquetas medía 1660 y la de "Municipio:" 1125 — insuficientes, y el `:` saltaba de línea en `Municipio:` y `Características:`.

Arreglo: `tblInd = 0` en las 35 tablas (ocupan exactamente el área de contenido, 10631) + `pBdr` left/right `space=0` con `w:ind` left/right = 32 twips en los 10 párrafos de sección (el borde cae justo en el margen) + sección 3 a `[2150,3400,1500,3581]`. Resultado medido: **todo entre x=106..108 y x=1453..1454** (≈0.2 mm). ⚠️ **Al revisar alineación, medir el render, no confiar en el XML**: `tblW`/`tblInd` idénticos no garantizan bordes iguales si hay párrafos con borde propio de por medio.

## Envío de documentos (2026-07-21) — el .docx ahora sí llega adjunto
Al enviar por WhatsApp/correo llegaba **solo el texto** ("📎 Adjunta el archivo…") sin documento. Causa: un fix previo (`53b7347`) bloqueó `navigator.share` en Android por completo, asumiendo que Chrome rechaza `.docx` en Web Share. **La premisa era falsa**: `.docx` está en la lista de tipos permitidos de Chrome/Android. El `NotAllowedError` real venía de llamar a `share()` **fuera de la activación del tap** — el documento se generaba (base64 → unzip → parseo de 308 celdas → rezip) *después* del clic y antes del `share()`, consumiendo la ventana de activación.
- **El .docx se pre-genera al abrir el sheet** (`_pregenShareDoc`), no al tocar WhatsApp/correo → `share()` se invoca de inmediato dentro de la activación. ⚠️ **Regla: nunca poner trabajo async/pesado entre el tap y `navigator.share()`/`window.open()`.**
- `_docShareOk()` ya no discrimina por user-agent; se usa detección real con `navigator.canShare({files:[file]})` sobre el archivo concreto (extensión + MIME).
- Las descripciones del sheet se actualizan al terminar la pre-generación ("Envía el .docx como archivo adjunto" vs. plan B con el clip 📎).
- Plan B intacto para navegadores sin Web Share de archivos (escritorio): descarga + `wa.me`/`mailto` con el mensaje que indica adjuntar desde Descargas.
- Verificado con `verify_envio_doc.mjs` (29 checks, Android + iOS): el `File` que recibe `navigator.share` es el .docx real (~377 KB, MIME `…wordprocessingml.document`) y no se dispara descarga ni `wa.me` solo-texto cuando se puede adjuntar.
- Anti-caché subido a `?v=14` / `cache-v14`.

## Envío de documentos (2026-07-21, 2º pase) — el dispositivo que NO adjunta ya no deja tirado al usuario
En un Samsung real, `navigator.canShare({files})` decía `true` pero `share()` **rechazaba**; el `catch` solo descargaba el .docx y **no abría ni WhatsApp ni el correo** ("no deja enviar"). Al reintentar con el otro botón, Chrome preguntaba "¿Deseas volver a descargar el archivo?". Cambios:
- **El plan B ahora sí abre la app** tras un share fallido. `_openExt()` intenta `window.open` y, si vuelve `null` (popup bloqueado porque el `share()` fallido ya gastó la activación del tap), navega con `_navExt()` → `location.href`. ⚠️ **Un `window.open` que devuelve `null` no es un no-op: sin ese fallback no pasaba nada en pantalla.**
- **El dispositivo se marca** (`localStorage.lc_share_files='off'`, vía `_shareFilesOff()`/`_markShareFilesOff()`): a partir del segundo envío no se vuelve a intentar `share()`, así el tap conserva la activación y `window.open` funciona **sin sacar al usuario de la app**. Para volver a probar el adjunto directo hay que borrar esa clave.
- El toast del fallo incluye el **nombre del error** (`NotAllowedError`, …) — es el único canal de diagnóstico desde un celular en campo.
- **Sin doble descarga** (`out._dl`): el `catch` ya no descarga por su cuenta antes de llamar al plan B.
- WhatsApp/correo quedan **deshabilitados mientras se genera** el .docx (`_shareBusy` + `.sheet-item[disabled]`, descripción "Preparando el documento…"), y si el tap llega antes de tiempo se va directo al plan B en vez de llamar a `share()` fuera de la activación. El mailto pasa por `_navExt` (el `<a>.click()` sintético es menos fiable en Android; además así el test puede interceptarlo).
- `verify_envio_doc.mjs` sube a **41 checks** con el escenario "share rechazado" completo. ⚠️ En los tests, el stub de `window.open` debe devolver **un objeto** (lo que hace un popup permitido); si devuelve `null`, `_openExt` navega de verdad la página de prueba a `wa.me` y el resto de la suite explota.

## Envío de documentos (2026-07-23) — fin del auto-bloqueo y del respaldo de texto-solo
En un Samsung real, el usuario **solo recibía mensajes de texto a sí mismo** ("📎 Adjunta el archivo… carpeta Descargas"), nunca el `.docx`. El diagnóstico del sheet (`build v25 · share:sí · canShare:sí · **marcado:off**`) reveló la causa raíz: el mecanismo de "marca" del 2º pase era **demasiado agresivo** — bastaba **un** rechazo de `share()` por WhatsApp (que es quisquilloso con `.docx`) para poner `lc_share_files='off:N'` y, desde ahí, la app **nunca volvía a abrir la hoja de compartir** para NINGUNA app; se iba directo al respaldo `wa.me`/`mailto` que **solo manda texto** (no adjunta nada). Es decir: el "plan B" para el que se optimizó todo era justo el resultado inútil. Como Gmail y Drive **sí** aceptan el `.docx` por esa misma hoja, el bloqueo estaba tapando la salida que funcionaba.
- **Se eliminó por completo el auto-bloqueo**: `_SHARE_FIX`, `_shareFilesOff()`, `_markShareFilesOff()` y la clave `localStorage.lc_share_files`. `_docShareOk()` ahora es solo `!!(navigator.share && navigator.canShare)`.
- **Se eliminó el respaldo de texto-solo** (`_envioFallback`, `_openExt`, `_navExt`, los mensajes `wa.me`/`mailto` con "Adjunta el archivo…"). Ya no se manda nunca un mensaje que le pide al propio usuario adjuntar a mano.
- **Un solo botón "Compartir documento"** (`#share-it-doc`, ícono share-nodes) reemplaza los dos botones WhatsApp + Correo (que solo se diferenciaban en el texto de respaldo). Abre `navigator.share({files:[file]})` — payload **mínimo, solo el archivo** — y el usuario elige la app destino en la hoja del sistema (**Gmail/Drive adjuntan el `.docx`; WhatsApp puede rechazarlo**). Se conserva "Solo descargar" (`#share-it-dl`). El `.docx` se sigue pre-generando al abrir el sheet (`_pregenShareDoc`) para que `share()` caiga dentro de la activación del tap.
- **`_compartirDoc()`** (reemplaza `_envioConDoc`): si `share()` rechaza (≠ `AbortError`) **no marca el dispositivo ni manda texto** — deja el `.docx` en Descargas (una vez, `out._dl`) y avisa con toast + nombre del error ("Esa app no aceptó el .docx (NotAllowedError). Quedó en Descargas — vuelve a «Compartir» y elige Gmail o Drive"). El siguiente tap **vuelve a intentar** el adjunto (nunca queda condenado al texto). El diagnóstico del sheet (`#share-diag`) sigue mostrando build + resultado del último `share()`.
- ⚠️ **Regla que quedó clara**: WhatsApp es el único quisquilloso; la solución no era pelear más con `share()` sino **dejar de auto-deshabilitarlo** y guiar al usuario a **Gmail/Drive**. Todo sigue **local** (nada se sube a servidores — importante con datos de menores en CESPA / Habeas Data).
- `verify_envio_doc.mjs` reescrito al flujo nuevo (**32 checks**): adjunto directo, share rechazado→descarga sin `wa.me` ni marca, reintento que vuelve a adjuntar, escritorio sin Web Share→descarga, OJ, dossier, ASCII del nombre, consola limpia. Anti-caché a `?v=26` / `cache-v26`, `_BUILD=26`.

## Envío de documentos (2026-07-23, Capa 1) — la descarga como columna vertebral fiable + guía
En un Samsung real, `navigator.share({files})` devuelve `NotAllowedError` **incluso con el build v26** (nombre ASCII + payload mínimo): el navegador/Android del equipo se niega a entregar el archivo y **la hoja del sistema ni siquiera se abre** (por eso "elige Gmail/Drive" era inaccesible — no hay selector). Es un candado a nivel de Chrome/Android en ese dispositivo, **no algo que el código pueda sortear con `share()`**. Diagnóstico de raíz (senior): fue un **error de arquitectura** atar un entregable legal obligatorio a la primitiva más frágil de la plataforma (Web Share L2 de archivos, opcional e inconsistente entre fabricantes). La corrección de fondo: **la primitiva fiable en el 100% de los equipos es la descarga** (`Blob`→`<a download>`, nunca falla, offline); todo lo demás es *mejora opcional* encima, jamás dependencia.
- **La descarga es ahora el default digno**, no "enviar y fallar". El sheet abre con una **tarjeta guía** (`.share-coach`, siempre visible) que enseña: "El documento se guarda en **Descargas**. Para enviarlo, ábrelo desde ahí en WhatsApp o Correo con el botón de adjuntar (el clip)." Botón primario **"Descargar documento"** (`#share-it-dl`, ícono en acento); **"Compartir directo"** (`#share-it-doc`) pasa a **secundario** ("Un toque si tu equipo lo permite") y se **oculta** en escritorio (`_docShareOk()` falso). Helper `_dlDone(label)` para el toast que guía el envío manual.
- **Rechazo de `share()`**: el toast ya no dice "vuelve a «Compartir»" sino que remite a la vía fiable ("quedó en Descargas — envíalo con el clip 📎"). Sin marca de dispositivo, sin texto-solo.
- **Fix definitivo pendiente = Capa 2 (Capacitor)**: ⚠️ un **TWA** de Play Store NO arregla esto (es el mismo Chrome). El fix real es empaquetar la PWA con **Capacitor + plugin de share nativo** (usa el sistema de intents de Android, ajeno al candado de Web Share) — un toque, sin setup por usuario, funciona en todo equipo. Se descartó el relay per-usuario (Apps Script/Drive) como camino principal: setup frágil, pesadilla de soporte, no escala.
- `verify_envio_doc.mjs`: **32 checks** verdes con el layout nuevo (tarjeta guía, descargar primaria, compartir secundaria+oculta en escritorio). Anti-caché a `?v=27` / `cache-v27`, `_BUILD=27`.

## Envío de documentos (2026-07-23, Capa 2 — hook nativo Capacitor) — el fix definitivo del share
Preparación de la **Capa 2**: dentro de un envoltorio **Capacitor** (Play Store), el compartir de Android usa el **intent `ACTION_SEND`**, que **NO sufre el candado de Web Share de Chrome** (`NotAllowedError`) que bloquea el `.docx` en algunos Samsung. ⚠️ Un **TWA** NO sirve (mismo Chrome); **Capacitor sí** (puente nativo).
- **Hook en el código web** (ya desplegado, `LexCapture_v8.html`): `_capNative()` detecta `window.Capacitor.isNativePlatform()` + plugins `Share`/`Filesystem`. En la PWA web normal es **inerte** (no cambia nada). Dentro del nativo, `_compartirDoc()` toma la rama `_shareNativo(out)`: `_blobToB64` → `Filesystem.writeFile({directory:'CACHE'})` → `getUri` → `Share.share({files:[uri]})`. Se llama a los plugins vía `window.Capacitor.Plugins.*` (no requiere bundling del wrapper npm — funciona con carga remota o bundle). El diagnóstico del sheet muestra `· nativo:sí`.
- **Estrategia de empaquetado (pendiente, en tu máquina)**: Node ya está; falta **Android Studio** (JDK + SDK) — único prerrequisito grande. Deps: `@capacitor/core @capacitor/cli @capacitor/android @capacitor/share @capacitor/filesystem`. Decisión bundle-vs-remote-url al montar (remote-url = updates por `git push` sin recompilar). App id sugerido `com.getcorenova.lexcapture`. ⚠️ Firma: guardar el keystore para siempre. ⚠️ Play: sin "Policía Nacional" ni logo escudo (ya resuelto).
- `verify_envio_doc.mjs`: **37 checks** (nuevo [13] simula `window.Capacitor` → verifica writeFile base64 en CACHE + `Share.share` con `file://` URI, sin tocar `navigator.share`). Anti-caché `?v=28` / `cache-v28`, `_BUILD=28`.

## FPJ-5 v3 (2026-07-26) — apartados 4/5/6 repetibles: N capturados, N víctimas, N testigos
Un caso puede tener **cualquier cantidad** de personas por rol y el formato oficial lo autoriza al pie de cada apartado ("En el evento de existir más capturados se pueden reproducir las casillas cuantas veces sea necesario"). **El wizard siempre permitió agregar N personas** (`rMultiPerson` → `wc.capturados[]`/`victimas[]`/`testigos[]`, sin tope) y la lista de capturas ya mostraba "(+N más)" — pero **al FPJ-5 solo llegaba la primera persona de cada rol; el resto se perdía en silencio**. Ahora la 1ª va en el apartado original y cada persona extra recibe una **copia íntegra** numerada **4.1, 4.2 …** / **5.1 …** / **6.1 …**. Verificado con `verify_multipersona.mjs` (**57 checks**) + apertura en **Word real** (COM).
- **Por qué no salían**: `cloneSection()` buscaba el marcador `"evento de existir mas capturados"` con `.includes()` sobre el texto **con tilde** de la plantilla ("m**á**s") → nunca lo encontraba y retornaba sin hacer nada. Aunque lo hubiera encontrado, clonaba el bloque y **solo reescribía el párrafo de "Senales"**: las 56 celdas de la copia habrían quedado con los datos de la persona anterior. Era código muerto que aparentaba funcionar.
- **Motor nuevo** (reemplaza `cloneSection`): `_fpjBlock(body,num,palabra)` localiza el apartado por texto (título `^N\.` … párrafo-nota "En el evento…") — **no por índices fijos**, porque URI y CESPA tienen el mismo layout de celdas pero **distinta numeración de hijos del body** (capturado termina en el hijo 39 en URI y en el 41 en CESPA). `_fpjRepetir()` clona el bloque con `cloneNode(true)` y lo inserta **antes del párrafo-nota**, que así queda siempre al final del apartado.
- **Clonar, no reconstruir**: la copia hereda barra gris (`shd D9D9D9`), `pBdr`, `tblW`/`tblInd`/`tblGrid` y fuentes. Comprobado en Word: los encabezados 4, 4.1 y 4.2 dan **idéntico** sombreado, borde, negrita, 10pt y sangría 1,6pt; solo cambia el número. El título se renumera derivándolo del original (`replace(/^(\s*)\d+(\.\d+)*\.?\s*/…)`), así **CESPA sigue diciendo "APREHENDIDO"** en 4.1 (terminología legal de menores).
- **Llenado por desplazamiento relativo**: `fpjFillCapturado(tcs,b,p,tf)` / `fpjFillVictima` / `fpjFillTestigo` usan offsets desde la 1ª celda del apartado (`b+1` primer nombre, `b+16` documento, `b+30..39` fecha…). Para la persona 1 `b` = 77/133/188 (celdas del documento original, lo calcula `_fpjBase` leyendo el bloque, con esos valores como respaldo); para cada copia `b` = 0 sobre el arreglo de celdas **del clon**. ⚠️ **Los apartados 5 y 6 comparten offsets exactos** (1..53); la víctima solo añade `b+54` ("Relación con el indiciado").
- ⚠️ **El clon se saca DESPUÉS de llenar a la persona 1**, así que toda celda que el llenado no toque arrastraría el dato del anterior: por eso el llenado es **exhaustivo y siempre escribe** (vacío si no hay dato). De ahí que edad y fecha de nacimiento ahora se limpien celda por celda (`_fpjEdad`/`_fpjFecha`) en vez de saltarse el `if`.
- **`w14:paraId`/`textId` y marcadores se eliminan del clon** (`_fpjLimpiaIds`): Word los exige únicos en el documento y el bloque de la víctima trae un `bookmarkStart` (`_heading=h.…`, residuo del export de Google Docs). Sin esto se duplicarían en cada copia.
- **Si una copia no se pudiera generar, se avisa por toast** en vez de entregar el informe incompleto — en un documento legal una persona que desaparece en silencio es el peor resultado posible (fue justo el bug anterior).
- Correcciones que salieron del mismo paso: la etiqueta del formato recupera la **ñ** ("Se**ñ**ales particulares visibles:", antes se escribía "Senales") y su valor vuelve a su propio run **sin negrita**; sin edad ya **no se imprime "00"** inventado en víctima/testigo vacíos; `dirRes/tel` vacíos ya no dejan " / Tel: " suelto.
- **Regresión de no-cambio**: para un caso de **una sola persona por rol** el `document.xml` generado es **idéntico run por run** al del build anterior (276 de 277 runs iguales; la única diferencia es la ñ de "Señales", intencional) y mantiene **35 tablas**. Con 3 capturados + 2 víctimas + 3 testigos: 77 tablas, 6 páginas, Word abre sin pedir reparar.
- ⚠️ Pendiente relacionado: la **Disposición OJ** (`{{PLANTILLA}}`) y el **dossier de WhatsApp** siguen usando solo `capturados[0]`.
- ⚠️ `verify_fase_h.mjs` está **obsoleto desde antes de este cambio** (falla igual contra el build anterior: espera `#w-hcH` y un servidor externo en :8080). No es una regresión de este trabajo.

### Acabado visual de las copias (mismo día, tras revisar el render)
Dos artefactos que solo se ven **renderizando**, no leyendo el XML. Cómo mirar el render en esta máquina: Word (COM) → `SaveAs` a PDF → captura con Playwright usando **`channel:'msedge'`** (⚠️ el Chromium que trae Playwright **no** tiene visor de PDF: descarga el archivo en vez de mostrarlo; Edge sí lo abre).
- **Línea negra tipo "tachado" antes de 6.1 / 6.2** (`_fpjSeparador`). El apartado de testigos **termina en la tabla con borde** de "Correo electrónico y redes sociales", así que la barra gris de la copia caía pegada a ese borde y los dos trazos se sumaban. Los apartados 4 y 5 no sufrían esto porque **terminan en párrafo vacío**. Ahora, solo cuando el bloque no termina en blanco, se antepone a cada copia el **mismo párrafo vacío que la plantilla ya usa delante del título** — separación del formato original, no inventada. ⚠️ El apretón entre el correo del **último** testigo y la nota "En el evento de existir más testigos…" **es del formato original** (se ve igual en el documento de una sola persona): no tocarlo.
- **Señas del aprehendido en negrita en CESPA** (`_fpjSenas`). Esa plantilla trae "Señales particulares visibles:" en **un único run en negrita** (URI trae dos: etiqueta negrita + valor normal), así que el valor salía resaltado. Ahora, si solo hay un run, se **clona el run quitándole `w:b`/`w:bCs`** y el valor va ahí. Verificado en Word: `etiqueta negrita=True / valor negrita=False` en URI y CESPA, original y copias.
- `verify_multipersona.mjs` sube a **61 checks**: ninguna barra de título con una tabla justo encima (`previo === 'tbl'`) y el reparto de negrita de las señas en ambos formatos. Anti-caché `?v=30` / `cache-v30`, `_BUILD=30`.
- **Cómo zanjar un "esta línea se ve más gruesa"** sin discutir con el ojo: render a PNG (zoom 200) → cargar en `<canvas>` → contar, por fila de píxeles, cuántos son oscuros; una franja de filas contiguas con >50% de oscuros es una línea, y su alto es el grosor. Medido así: **v29 tenía 2 líneas de 4px** (doble) en las uniones antes de 6.1 y 6.2; **v30 deja las 16 líneas de la página en 2px**. Las de **3px** son las barras grises de título y miden 3px también en el documento de **una sola persona** — son del formato, no de la repetición. Comparar siempre contra ese documento de una persona: es el patrón de "original".

## Dossier — "Conocieron el caso" con varios funcionarios + patrulla (2026-07-21)
El campo era un **input único** (`cfg.conocieronCaso`), así que solo cabía un funcionario y no había dónde indicar la patrulla/unidad. Ahora en **Ajustes → Dossier**:
- `cfg.patrullaNum` + `cfg.patrullaUnidad` → ej. `"32"` + `"CAI Parque Bolívar"`. `patrullaLabel()` antepone `PATRULLA ` salvo que el usuario ya la haya escrito (`/patrulla/i`), para no generar "PATRULLA Patrulla 32".
- `cfg.conocieronFuncionarios[]` → lista dinámica de filas (input + ✕) con botón **+ Agregar funcionario**. Las filas no tienen id fijo: `readConocieronRows()` las lee por `querySelectorAll('#aj-con-list .aj-con-inp')` al guardar. Si se borran todas, queda una fila vacía (nunca una lista sin inputs).
- **Compatibilidad**: `getConocieronList()` cae al string legado `cfg.conocieronCaso` si el arreglo está vacío, así que las configuraciones viejas (y los `.json` de "Importar config") siguen imprimiendo su funcionario. `saveAjustes` mantiene `conocieronCaso` sincronizado (`join(', ')`) para no romper exportaciones hacia atrás.
- Salida en el dossier: `✅ *Conocieron el caso* PATRULLA 32 CAI Parque Bolívar — SI Nelson David / PT Juan Pérez`. Cada parte es opcional; sin ninguna, la sección no se imprime (`genDossier` ya omite contenido vacío).
- Se agregó `escAttr()` (escHtml + comillas) porque estas filas se pintan con `innerHTML` y `value="…"` — un nombre con `"` rompía el input (issue S2 aplicado a lo nuevo).
- Verificado con Playwright (21 checks): alta/baja de filas, persistencia tras recargar, migración del valor legado y el texto final del dossier. Anti-caché a `?v=15` / `cache-v15`.

## Dossier colapsado a salida por-caso (2026-07-22) — fin de la duplicación con Capturas
El Dossier era **destino de navegación de primer nivel** (ítem en sidebar + uno de los 5 slots del bottom bar móvil) pero es intrínsecamente **una salida de un caso**: al entrar recibía vacío y obligaba a **volver a elegir un caso** de una lista (`#dos-list`) que replicaba la de Capturas. Además `abrirEnvioDoc` estaba cableado **dos veces** (sheet de la captura "Enviar documento" + botón "Enviar FPJ-5" del Dossier) y dentro del Dossier convivían "Descargar FPJ-5" y "Enviar FPJ-5" (el sheet de Enviar ya descarga). Se colapsó a **una pantalla de salidas por-caso**:
- **Se quitó el Dossier de la navegación** (sidebar y bottom bar). Para no descuadrar el CTA central "Nueva" (el bottom bar es `flex` con `.bn-item{flex:1}`, el CTA solo queda centrado con **5 ítems**), el slot liberado lo ocupa **Estadísticas**, que se retiró del sheet "Más" para no crear una nueva duplicación.
- **Se entra desde la captura**: el sheet de la captura ahora tiene **una sola acción de salida**, "Enviar / Dossier" (`abrirDossierCaso`, ícono/acento de envío), que carga el caso (`_dosCasoId`) y abre la pantalla. Se eliminó el "Enviar documento" separado → `abrirEnvioDoc` queda cableado **una vez** (el botón del hub). ⚠️ **Trade-off**: enviar el .docx queda **un tap más profundo** (captura → Enviar/Dossier → hub → Enviar FPJ-5); si en campo pesa más la velocidad del FPJ-5, reponer el atajo directo en el sheet.
- **La pantalla ya no tiene selector de casos** (`#dos-list` y su render/`selectDosCaso`/CSS `.dos-case-option` eliminados). Topbar con **botón volver** + **subtítulo dinámico** (`#dos-sub` = nombre del capturado). Todas las salidas juntas: Compartir WhatsApp · Copiar · **Enviar FPJ-5/CESPA/OJ** (botón único por tipo, su sheet también descarga) · Descargar Acta. Se quitó el botón "Descargar FPJ-5" redundante (`#dos-btn-fpj`); `descargarFPJ()` **se conserva** como primitiva de descarga directa (sin botón, la usa la regresión `verify_envio_doc.mjs` [9]).
- **Estado vacío** (`#dos-empty`): si se entra a `#dossier` sin caso (p.ej. recarga con ese hash, ya que el boot hace `go(location.hash)`), se muestra "Sin captura seleccionada" + botón "Ir a Capturas" en vez de un callejón sin salida. Sin redirect re-entrante (rompería el hash del `go()` externo).
- Verificado con Playwright (19 checks, `verify_collapse.mjs`): navegación sin Dossier, sheet con acción única, hub cargado con subtítulo, sin `#dos-list`/`#dos-btn-fpj`, estado vacío y cero errores de consola. Tests existentes actualizados al flujo nuevo (`verify_personas.mjs`, `verify_ds.mjs`, `verify_envio_doc.mjs`). Anti-caché a `?v=21` / `cache-v21`.

## Módulo "Captura por Orden Judicial" (2026-07-28) — Fase I
Antes, el flujo OJ era **el de flagrancia con seis campos extra** (`numOrden`, `delitoOrden`,
`juzgadoOrden`, `fechaOrden`, `autoridadSolicita`, `destinoOJ`) y dos banderas que apagaban víctimas
y testigos; el documento salía de un `.docx` con 22 `{{TOKEN}}` que **el usuario tenía que subir**
(sin plantilla activa no se generaba nada). Ahora es un módulo propio, de extremo a extremo.
Referencia de estructura: `Documentos/Propuesta Plantilla OJ.docx` (solo como guía; **ningún dato de
ejemplo suyo llega al código ni al documento**). Verificado con `verify_oj.mjs` (**85 checks**) y
abriendo el `.docx` en **Word real** (COM → PDF → render con Edge).

**Por qué es un módulo aparte y no una rama del wizard de flagrancia:** en flagrancia el policía
documenta **un delito que presenció**; en orden judicial documenta **una diligencia de cumplimiento**
de una decisión que otro funcionario ya tomó. No comparten modelo de datos, ni validaciones, ni
documento. Comparten primitivas (cifrado, personas, zip/docx, sheet de envío) y nada más.

- **Aislamiento**: el módulo vive en el bloque `FASE I` del HTML, todo con prefijo `oj*`/`OJ_*`. Las
  funciones de flagrancia solo reciben un `if (wc.ojv===2) …; return;` al inicio (`getWizConfig`,
  `collectStep`, `validateStep1`, `wizSave`, `startWizard`, `editCase`). `verify_multipersona.mjs`
  (61) y `verify_envio_doc.mjs` (37) siguen en verde **sin tocar sus expectativas**.
- **Modelo** `caso.oj` con `ojv:2`: `orden`, `despacho`, `proceso`, `requerido`, `diligencia`,
  `actuacion`, `destino`. Los casos OJ antiguos (**sin `ojv`**) no se migran: siguen abriendo con el
  flujo anterior y su documento anterior. ⚠️ Al guardar, un caso v2 escribe además un **espejo**
  (`capturados[0]`, `conductas[]`, `fechaProc`, `spoa`) — por eso la lista de capturas, el buscador,
  Personas y el dossier funcionan **sin una sola línea nueva** en esas pantallas.
- **Wizard de 7 pasos** (`OJ_STEPS`): Orden · Despacho · Proceso · Requerido · Materialización ·
  Actuación · Disposición. Un solo motor de listas repetibles (`OJ_LISTS` + `ojLista*`) sirve a
  delitos, prórrogas, funcionarios y elementos incautados: **se lee el DOM antes de cada alta/baja**,
  igual que `readConocieronRows`. Catálogos (`OJ_CAT`) para todo lo normalizable — el formulario
  evita texto libre salvo donde la ley exige literalidad.
- **Las dos verificaciones que definen el módulo:**
  1. **Vigencia de la orden** (art. 298 CPP, mod. Ley 1453/2011 art. 56): 1 año desde la expedición
     (6 meses si es anterior al 24/06/2011) + prórrogas. Semáforo en vivo y **validación dura**: con
     orden vencida no se genera el oficio (CSJ AP4491-2016 — capturar con orden vencida obliga a la
     libertad inmediata).
  2. **Término de 36 horas** (art. 28 C.P.): se calcula desde la hora de la diligencia, se muestra
     desde el paso 5 y se **imprime en el documento**.
- **Motor de destinatario** (`ojResolverDestino`): propone autoridad + **cita su fundamento** y
  guarda la regla aplicada (`destino.reglaAplicada`) para que la decisión sea trazable meses después.
  R0 vencida · R1 SRPA (adolescente **al momento de los hechos** → «aprehensión» y destino CESPA) ·
  R2 Ley 600 (despacho que libró) · R3 imputación/medida (fiscal que dirige, art. 297-298) ·
  R4-A/R4-B condena (juez de conocimiento o JEPMS; si no hay hora hábil dentro del plazo, juez de
  control de garantías de turno, **C-042/2018**) · R6 extradición. La disponibilidad del despacho usa
  jornada hábil configurable + **festivos de Colombia calculados** (Ley 51/1983, traslado al lunes;
  Pascua por algoritmo), no una lista fija que caduque.
- **Motor documental — la decisión de arquitectura importante:** el **cuerpo del oficio lo construye
  la app en OOXML** (`ojx*` + `ojDocCuerpo`); no hay `.docx` embebido en base64 y **la app siempre
  produce documento**. ⚠️ **Superado por «OJ v2» (2026-07-29)**: la rama de plantilla subida
  (`oj_membrete`) se eliminó por completo — el paquete lo arma siempre la app con el formato de
  `Documentos/Propuesta Plantilla OJ.docx`.
- **Encabezado institucional** (4 líneas jerárquicas) y pie salen **solo de `cfg`**
  (`ojMinisterio`/`ojInstitucion`/`ojUnidad`/`ojDependencia`, `ojPie*`, `ojClasificacion`…).
  ⚠️ **Ningún nombre de institución está escrito en el código** (ni en los `placeholder` de Ajustes):
  es el mismo patrón de `cfg.nombreEstacion` y lo exige el filtro de Play Store. El asunto también es
  parametrizable (`cfg.ojAsunto`, marcadores `{{TERMINO}}`, `{{ORD_NUMERO}}`, `{{REQ_NOMBRE}}`,
  `{{RADICADO}}`, `{{DESPACHO}}`). Una plantilla propia puede usar `{{ENC_UNIDAD}}`, `{{PIE_*}}`, etc.
- **Estructura del oficio** (⚠️ **reemplazada por la del formato en «OJ v2»**, 2026-07-29): tenía
  seis apartados romanos I–VI más el bloque Elaboró/Revisó. Ver la sección OJ v2 para la actual.
- **Lo que la app NO hace**: no produce órdenes de captura (solo las transcribe) y **no genera el
  acta de derechos** — se diligencia aparte y viaja como anexo; el oficio deja la constancia con hora
  y lugar. Tampoco hay función de difusión de datos de la orden (C-276/2019).
- ⚠️ **Lecciones de OOXML que costaron tiempo y hay que respetar al tocar `ojx*`:**
  - El **orden de los hijos** de `w:pPr` (`keepNext → pBdr → shd → spacing → ind → jc`) y de `w:rPr`
    (`rFonts → b → i → caps → color → sz → u`) **lo fija el esquema**. Invertirlo hace que Word abra
    el documento "dañado". Mismo criterio en `w:tcPr` y `w:tblPr`.
  - Un `*/` dentro de un comentario `/* … */` (p. ej. escribir `ojStep*/ojCollect`) **cierra el
    comentario** y rompe todo el `<script>`. Comprobar siempre con `node --check` sobre el script
    extraído del HTML.
  - **El cuerpo no puede terminar en `<w:tbl>`**: Word añade un párrafo implícito de tamaño normal y
    aparece **una página en blanco al final**. Se cierra con `ojxCierre()` (párrafo de altura ~0).
  - Barras de sección y subtítulos llevan `w:keepNext`, si no quedan huérfanos al pie de página.
  - `mc:Ignorable` solo puede nombrar prefijos **declarados** (lección heredada del FPJ-5 v2.1).
- **Despachos**: los que se diligencian a mano se guardan en `cfg.despachosPropios` y se reutilizan
  desde el mismo selector, que también alimenta el destinatario del paso 7.
- Anti-caché a `?v=31` / `cache-v31`, `_BUILD=31`.

### "No deja descargar el informe" (mismo día) — tres caminos que dejaban al usuario sin documento
Reportado en campo. Reproducidos los tres con Playwright antes de tocar nada; ahora son checks fijos
de `verify_oj.mjs` (**95 checks**). Anti-caché a `?v=32` / `cache-v32`, `_BUILD=32`.
- **Capturas OJ creadas antes del módulo** (`ojv` ausente) caían en `genDocOJ`, que exige una
  plantilla `.docx` subida: toast *"Sin plantilla activa — ve a Plantillas"* + redirección, y **nunca
  descargaban**. Ahora `ojDesdeLegado()` las adapta **al vuelo, sobre una copia** (el caso guardado no
  se toca) y sí generan el oficio nuevo; se avisa que salió con los datos del formato anterior. ⚠️ Si
  el usuario tiene una plantilla `fpj5_oj` activa se respeta su ruta de siempre: la migración nunca
  le quita su formato. El sheet de la captura ofrece además **"Completar al formato nuevo"**.
- **Bloqueo por validación dura sin explicación**: era un toast que nombraba **una** de las faltas y
  se iba. Ahora `ojModalFaltantes()` lista **todas** con su paso y un botón que abre el wizard
  **justo en el paso que falla** (`ojCompletarCaso(id,paso)`).
- ⚠️ **Descargar y enviar aplicaban criterios distintos**: `abrirEnvioDoc` **sí pre-generaba** el
  oficio al que le faltaban datos obligatorios mientras `descargarDocCaso` lo bloqueaba — se podía
  mandar al juzgado por una vía lo que la otra consideraba inválido. Las dos comparten ahora el mismo
  chequeo, y el early-return limpia `_shareDoc`/`_shareCasoId` para no dejar vivo el `.docx`
  pre-generado de otro caso.

## OJ v2 (2026-07-29) — el oficio ES «Propuesta Plantilla OJ», y modo invitado
Rediligenciado a partir de `Documentos/Pormt OJ.docx` (instrucciones + 10 pantallazos con recuadro
rojo numerado sobre `Documentos/Propuesta Plantilla OJ.docx`). Verificado con `verify_oj.mjs`
(**110 checks**), `verify_invitado.mjs` (**32 checks**, nuevo) y abriendo los `.docx` en **Word real**
(COM → PDF → render con Edge, 3 páginas).

- **Se acabaron las plantillas subidas para orden judicial.** `ojPaquete()` ya no tiene rama de
  plantilla: devuelve siempre el paquete del formato. Se eliminaron `ojTokensMembrete`, la opción
  `oj_membrete`/`fpj5_oj` del selector de «Cargar plantilla» y el motor muerto `genDocOJ`/
  `buildDocOJBlob`. **Todo caso `tipo==='OJ'` (v2 o legado) pasa por `ojDescargarOficio`** —
  descargar, enviar y el botón del wizard viejo usan la misma ruta. Que el diseño no se pueda
  alterar ya no es una política: no existe un archivo intermedio que lo altere.
- **El cuerpo replica el formato hijo por hijo**, con sus valores de XML medidos sobre el original:
  Arial 11 pt (`sz 22`), `line 240 atLeast`, `after 120`; tablas `tblW 9405` / `gridCol 3119+6286`,
  bordes exteriores `sz6 #808080` e interiores `sz4 #BFBFBF`, `tblCellMar 26/113`, etiquetas con
  trama `EFEFEF` en 10 pt; títulos con estilo `Ttulo1` + filete inferior `sz8 #404040` y **dos
  espacios tras el punto** («1.  IDENTIFICACIÓN…»); página `pgMar 1985/1134/1701/1701` con
  `titlePg`. Estructura: fecha · destinatario · asunto · presentación · **1** identificación (9
  filas) · **2** proceso (10 filas) · **3** materialización (4 filas) · narración · firma · anexos ·
  bloque de contacto. Se fueron los seis apartados romanos, las tablas de delitos/funcionarios/
  incautaciones y el bloque Elaboró/Revisó (con sus campos `ojUbicacionTRD`/`ojReviso` de Ajustes).
- ⚠️ **Las 23 filas son fijas y siempre se imprimen**: un dato que el usuario no registró queda **en
  blanco**. Nada se inventa y ninguna fila se oculta — el despacho tiene que poder ver qué falta.
- ⚠️ **Lo que salió de las tablas NO se perdió, se pasó a la narración**: el texto íntegro de la
  orden se cita entre comillas, y los elementos incautados se relacionan **con su rótulo de cadena
  de custodia**. Al quitar el apartado V hubo que arreglar la frase que remitía «al numeral V del
  presente informe», que había quedado apuntando a nada.
- **Encabezado (`cfg.ojUnidad`/`ojDependencia`) y logo.** El membrete es la tabla del formato
  (1560 + 7845, sin bordes) con el logo a 723900 EMU a la izquierda. **La celda del logo se mantiene
  aunque no haya logo**: el texto ocupa la misma posición con y sin él. El logo lo carga el usuario
  en Ajustes (`cfg.ojLogoB64`, ≤400 KB) y se embebe como `word/media/logo.*`. ⚠️ **Ningún escudo ni
  nombre institucional vive en el código** — el `.docx` de referencia trae un logo de 1,37 MB que
  NO se embebió a propósito (filtro de Play Store).
- **Lo que la app pide cuando el equipo no está configurado.** `caso.oj` gana `encabezado`,
  `custodia` y `firma`, precargados de Ajustes por `ojPrellenarDeCfg()` y **diligenciables en el
  paso 7**. Se guardan **en el caso** (`ojCfgDoc()` los antepone a la config al generar), así el
  oficio se reimprime igual meses después aunque el usuario cambie de unidad; y `ojRecordarEncabezado()`
  los devuelve a Ajustes como valor por defecto — se pregunta una vez, no en cada procedimiento.
  Validaciones duras nuevas: `V26` unidad, `V27` dependencia, `V28` quién firma.
- **Constancia de custodia** (`ojCustodiaTexto`): la narración cierra diciendo dónde quedó el
  capturado, con dirección, abonado telefónico y correo. Solo imprime lo que exista (sin correo no
  queda un «y correo electrónico» suelto). Los 4 datos se configuran en Ajustes y se pueden cambiar
  por procedimiento — el capturado no siempre queda en la misma estación.
- **Anexos**: la app cuenta y escribe la cantidad en letras («Anexos: tres (3)», `ojNumPalabra`),
  respetando el orden del catálogo y detrás los que el usuario escriba. El catálogo trae
  `'Copia orden de captura oficio No. {{ORD_NUMERO}}'`, resuelto con el No. de la orden del paso 1
  (`ojAnexoTexto`) tanto en el documento como en el propio checkbox.
- **Narración de los hechos**: el paso 6 tiene un textarea grande y limpio (mapea a
  `actuacion.observaciones`), que se imprime al final bajo la etiqueta en negrita «Observaciones:».
- **Modo invitado** (`_guest`, `guestEntrar()`): para el teléfono prestado. Se entra **sin el PIN del
  dueño** desde ambas pantallas de PIN. `DB.getConfig/saveConfig/getTemplates` y `_lcEncSave` tienen
  rama de invitado: config propia en memoria (`_cfgConDefaults({})`, extraído de `DB.getConfig`),
  cachés en memoria y **cero escrituras en localStorage** — verificado comparando la huella completa
  del almacenamiento antes y después. Tiene los formularios completos de OJ y flagrancia y descarga
  los dos documentos. ⚠️ **Honestidad obligatoria** (lección del «Continuar sin PIN» borrado en la
  Fase H): barra ámbar permanente `#guest-bar`, y `guestToastGuardado()` reemplaza «Caso guardado ✓»
  por «Listo en esta sesión — recuerda descargar el documento».
- El sheet de envío nombra «Oficio de disposición» para **toda** captura OJ (antes decía «Documento
  OJ» en las del formato anterior, que ahora producen el mismo oficio).
- Anti-caché a `?v=33` / `cache-v33`, `_BUILD=33`.
- ⚠️ `verify_fase_g.mjs` está obsoleto igual que `verify_fase_h.mjs`: espera un servidor externo en
  `:8080` que él no levanta. No es una regresión de este trabajo.

## Exportación (2026-07-29) — formato de salida y tamaño de papel obligatorios
⚠️ **Superado en parte por «Exportación v2» (2026-07-31)**: el FPJ-5 ya **no se ofrece en PDF**, y el
tamaño de papel se pregunta **una sola vez** (`cfg.papel`) en vez de en cada exportación. Todo lo que
sigue sobre **cómo** se aplica el papel a cada motor (anchos, márgenes, `pgSz`) y sobre la vista de
impresión del oficio OJ **sigue vigente**.

Antes de producir cualquier documento final la app pide **siempre** dos cosas y no genera nada hasta
tener ambas: **formato** (Word `.docx` / PDF) y **tamaño de papel**. La adaptación toca únicamente la
diagramación física — el contenido es idéntico entre tamaños (comprobado comparando el texto extraído
del `document.xml`). Verificado con `verify_export.mjs` (**44 checks**, nuevo) y abriendo los tres
tamaños en **Word real**.

- **Diálogo** `lcPedirExport(kind,nombre,cb)`: nace **sin selección** y con el botón deshabilitado;
  el rótulo va diciendo qué falta («Elige el formato…» → «Elige el tamaño…» → «Generar Word en
  Oficio»). Cablea **todas** las salidas: `descargarDocCaso`/`lcExportarCaso`, `descargarFPJ`,
  `ojDescargarOficio`, `ojGenerarDesdeWizard` y `abrirEnvioDoc` (que si se elige PDF va directo a la
  vista de impresión, porque no hay archivo que adjuntar hasta que el usuario lo guarde).
- **Tamaños** (`LC_PAPEL`): Carta 12240×15840 · Oficio 12240×**18720** (8,5 × 13", el oficio
  colombiano) · 8 × 13,5" 11520×19440.
- ⚠️ **Lo que manda es el ANCHO, no el alto.** Carta y Oficio comparten 8,5": cambiar entre ellos
  solo altera cuántas líneas caben por hoja y **no toca una sola tabla**. Solo un tamaño más angosto
  obliga a reescalar.
- **Márgenes constantes** en todos los tamaños (`OJX_MAR`): son medidas absolutas de impresión, no
  proporciones. El ancho útil se recalcula (`ojxSetPapel`) y **todas** las tablas, el membrete y el
  pie lo siguen, así ninguna se sale del margen ni se queda corta.
- ⚠️ **La columna de etiquetas NO se escala** (`OJX_ET=min(3119, 42 % del ancho)`). Escalarla
  proporcionalmente parte «Fecha y lugar de nacimiento» en dos líneas en cuanto la hoja se estrecha
  — la misma lección del FPJ-5 v2.2: *recalcular anchos reintroduce wraps*. Quien absorbe el cambio
  es la columna de valores, que sí puede fluir.
- ⚠️ **El pie no usa tabuladores.** Con un tabulador central, en hoja angosta el texto de la
  izquierda lo desborda y se pega al número («INFORMACIÓN PÚBLICAPágina 1 de 2»). Ahora son dos
  líneas centradas (metadatos del formato + «Página N de M»), que se comportan igual en cualquier
  ancho — y se parecen más al formato original, que solo lleva la línea de página.
- **FPJ-5: solo tamaños de igual ancho.** `fpjAplicarPapel()` cambia **únicamente el alto** del
  `pgSz`, conservando el desfase de 2 twips de la plantilla (15842 → 18722). El ancho de página no se
  toca y sus **35 tablas siguen en 10631 twips con sus `gridCol` byte a byte idénticos**: cero riesgo
  de partir palabras en las casillas del formato oficial de la Fiscalía. El diálogo solo ofrece Carta
  y Oficio para este documento **y explica por qué**; `lcPapelSirveFPJ()` es además una salvaguarda
  en el motor: si llegara otro ancho, cae a Carta en vez de deformarse.

### PDF por vista de impresión — un solo origen de verdad
El PDF **no se dibuja aparte**: se traduce a HTML el **mismo `word/document.xml`** que acabó de
producir el `.docx` (`lcPrintDoc` → `lcPaginar` → `lcImprimir`). Así el **FPJ-5 nunca se redibuja a
mano**: sus 35 tablas se transcriben con los anchos que ya trae el XML (`tblGrid`/`tcW`), sus bordes,
tramas y tipografía. Lo que cambia entre `.docx` y PDF es el motor que lo pinta, no el documento.
- Traductor OOXML→HTML del subconjunto real: `w:p` (jc, spacing/lineRule, ind+hanging, pBdr, shd,
  keepNext), `w:r` (rFonts, b, i, caps, color, sz, u), `w:br`/`w:tab`, `w:tbl` (tblBorders,
  tblCellMar, gridCol, gridSpan, vMerge, tcBorders, shd, vAlign) e imágenes (`a:blip` → data URI).
- **Paginación propia**: Chrome no sabe repetir membrete/pie con numeración («Página N de M» no
  existe en su CSS de paginación). El contenido se reparte en cajas de página de medida exacta
  midiendo bloque por bloque; las tablas largas se cortan **por fila**, nunca dentro de una fila; los
  párrafos con `keepNext` viajan con el bloque siguiente; y los campos `PAGE`/`NUMPAGES` (que el XML
  trae cacheados como «1») se marcan `.fld-num`/`.fld-tot` y se rellenan al final con el número real.
- Se imprime desde un **iframe**, no una ventana nueva: los bloqueadores de pop-ups las matan en
  móvil. Las imágenes del membrete se precargan antes de medir (si no, el logo mide 0 px y el alto
  útil sale mal).
- **Fidelidad medida**: para el mismo caso, la vista pagina **igual que Word** (Carta 3 hojas, Oficio
  2) y no falta ni una palabra del `.docx` (check [35] compara palabra por palabra).
- ⚠️ **El PDF lo guarda el usuario** desde el diálogo de impresión del sistema («Guardar como PDF»);
  la app no escribe el archivo. Es la única vía offline sin incrustar un motor PDF, que daría un
  dibujo aproximado del formato en vez del formato.
- Anti-caché a `?v=34` / `cache-v34`, `_BUILD=34`.

## Exportación v2 (2026-07-31) — el FPJ-5 sale solo en Word, y el papel se pregunta UNA vez
Reportado en campo: «los formatos en PDF salen con demasiados errores, cosa que no ocurre con Word».
Se midió en vez de opinarlo: extrayendo `TPL_URI`/`TPL_CESPA` del base64 y comparando lo que las
plantillas usan contra lo que implementa el traductor OOXML→HTML (`lcRunHtml`/`lcParHtml`/`lcTablaHtml`).
Verificado con `verify_export.mjs` (**74 checks**, antes 47).

| Construcción | El FPJ-5 la usa | ¿Traductor? | Efecto en el PDF |
|---|---|---|---|
| `w:trHeight` | **30 filas** (63–629 twips) | **No** (ni lee `trPr`) | Las casillas colapsan al alto del texto |
| `w:vMerge` | 3 | **No** — salta la continuación sin poner `rowspan` | Esas filas quedan con **una celda de menos** |
| `w:tblHeader` | **55** (CESPA) | **No** (el comentario decía que sí) | No repite encabezado al cortar tabla |
| `w:noWrap` | 2 | **No** | Parte texto donde Word no lo parte |
| `w:numPr` | 2 | **No** | Se pierde el marcador |
| `w:tabs`/`w:tab` | 2 / 6 | Tabulador fijo de 36 px | Ignora las paradas reales |
| `w:tcW` | **308 celdas** | **No** — solo `tblGrid` | Donde difieran, Word obedece `tcW` |
| Borde `sz=4` vs `sz=8` | ambos | Se aplastan **los dos a 1 px** | Se pierde la distinción del pase v2.2 |

- ⚠️ **Diagnóstico de raíz: dos motores para un mismo documento.** El comentario «un solo origen de
  verdad» es cierto para el **contenido** (se traduce el mismo `word/document.xml`), pero el origen de
  verdad de un formato oficial es la **geometría**, y ahí hay dos motores: Word, y Chrome + el
  traductor. El FPJ-5 se calibró a nivel de twip en tres pases (v2.1–v2.3); el PDF **repetía esa
  calibración desde cero en un motor que no lee el 40 % de las instrucciones de la plantilla**. Ese
  trabajo no tiene final: cada construcción que se implemente destapa la siguiente, y el salto de
  línea del navegador nunca va a coincidir con el de Word.
- **El FPJ-5 ya no se ofrece en PDF.** Un PDF que se *parece* al formato oficial de la Fiscalía es
  **peor** que no tener PDF: quien lo recibe no puede distinguirlo del bueno. Sale en `.docx` y se
  imprime desde Word, que sí lo maqueta. La guarda es **estructural**, no de UI: `buildFPJBlob`
  marca `out.noPDF` y `lcImprimir()` lo rechaza, así ninguna ruta futura puede imprimirlo por
  descuido. `lcExportSoloWord(kind)` es el único punto que decide qué documento tiene PDF.
- **El oficio OJ conserva el PDF** y es defendible: lo compone la app y está **dentro del subconjunto
  por construcción** — cero `trHeight`, `vMerge`, `noWrap`, `tblHeader`, `numPr` y tabuladores
  (comprobado). Sus `docDefaults` (Arial 11 pt, `after 120`) coinciden con los del CSS de impresión.
  ⚠️ Al tocar `ojx*`, **no introducir ninguna de esas construcciones**: romperían el PDF en silencio.
- ⚠️ **El tamaño de papel NO es diferible al momento de imprimir.** Queda escrito dentro del `.docx`
  (`w:pgSz`), Word imprime a tamaño real por defecto, y un documento de Oficio impreso en Carta **se
  corta**. Dejarlo «para la impresora» es más trabajo y más frágil, al final de la cadena.
- **Pero se pregunta UNA vez.** Es propiedad del **equipo** (el papel de su impresora), no del caso —
  la misma lección de la Ola 4 con el membrete, la custodia y la firma, que a la auditoría se le
  escapó. Nuevo `cfg.papel` + `lcPapelCfg()`/`lcGuardarPapel()`/`lcPapelEfectivo(kind)` como **único
  punto que lo resuelve**, para que descargar, enviar y el botón del wizard no puedan discrepar.
  `lcPapelEfectivo('FPJ')` nunca devuelve un ancho que las casillas no admiten: cae a Carta.
- **El diálogo quedó en una sola pregunta legítima: Word o PDF.** El papel se ve en una línea
  («Papel: Oficio · Cambiar») y se cambia sin salir. ⚠️ Si no queda **ninguna** pregunta (FPJ-5 con
  papel ya elegido) **no se abre diálogo**: se genera. El tamaño usado se nombra siempre en el aviso
  final, así la decisión recordada nunca es invisible. Se añadió **Ajustes → Documentos**, que aplica
  al instante sin pasar por «Guardar ajustes» (igual que el tema).
- ⚠️ **Esto revisa una decisión deliberada** documentada en el código: *«se arranca SIEMPRE sin
  selección: la elección tiene que ser un acto del usuario, no un valor por defecto que se cuela sin
  que lo mire»*. Se revisó porque un valor **que el usuario eligió una vez, ve y puede cambiar** no es
  un default que se cuela — el riesgo que esa regla evitaba no aparece. La regla **sigue vigente para
  el formato**, que nace sin selección.
- **El recorte silencioso, corregido.** `.pg` lleva `overflow:hidden`: un bloque más alto que la hoja
  se colocaba igual y el navegador lo **cortaba sin avisar**. En un documento legal, perder texto sin
  señal es el peor resultado posible. `lcPaginar` ahora cuenta los desbordes y **devuelve
  `{paginas, desbordes}`** (⚠️ antes devolvía un número: hay dos llamadores), y `lcImprimir` lo
  convierte en aviso con la salida por el Word. La cuenta la lleva solo `poner()` — `ponerTabla` no
  suma para no duplicar, porque una fila demasiado alta llega sola a `vaciar()` → `poner()`.
- ⚠️ **Las suites tenían un helper `elegirExport` que daba por hecho dos preguntas siempre.** Ahora es
  tolerante en las cuatro (`oj`, `envio_doc`, `personas`, `export`): pulsa lo que se ofrezca y es
  no-op si no hay diálogo. Y en `verify_envio_doc` el disparo tuvo que entrar **dentro del
  `Promise.all`**: sin diálogo, la descarga del FPJ-5 sale **síncrona** dentro del `evaluate` y
  `waitForEvent` se enganchaba tarde.
- **Lo que sigue pendiente** si el PDF del FPJ-5 llega a hacer falta de verdad (en el teléfono un
  `.docx` es opaco): el patrón canónico para un formato de tamaño fijo es un **PDF AcroForm** del
  formato oficial relleno con pdf-lib — riesgo de maquetación **cero**, offline, porque la
  maquetación *es* el archivo original. Es un proyecto aparte, pero acotado y con final. ⚠️ La vía
  habitual de la industria (conversión con LibreOffice/Word en servidor) **está vedada aquí**: exige
  subir datos de un capturado, de un menor en CESPA — Habeas Data y operación offline.
- Regresiones en verde: **export 74** · OJ 138 · envío 39 · personas 24 · invitado 33 · simulador 41 ·
  multipersona 61 · ola1 38 · ola2 34 · ola3 33 · ola4 21 · DS 10.
  Anti-caché `?v=42` / `cache-v42`, `_BUILD=42`.

## OJ v2.1 (2026-07-29) — cuatro desviaciones del formato, reportadas en campo
El usuario detectó que el oficio **no respetaba 100 %** «Propuesta Plantilla OJ»: agregaba cosas que
el formato no tiene y **excluía** bloques que sí tiene. Las cuatro venían del mismo error de criterio:
hacer **condicional** lo que en el formato es **fijo**, y arrastrar añadidos del módulo anterior.
Reproducidas generando el documento como un usuario que no ha tocado Ajustes. `verify_oj.mjs` sube a
**115 checks**.

- **El membrete salía mutilado.** `ojMinisterio` y `ojInstitucion` (líneas 1 y 2) solo existían en
  Ajustes y nacían vacías: **nunca se le pedían a nadie**, así que el oficio salía con dos renglones
  en blanco arriba — o sin encabezado visible si tampoco había logo. Ahora `caso.oj.encabezado`
  guarda **las cuatro** líneas, el paso 7 las pide todas y hay validación dura por cada una
  (`V30` ministerio, `V31` institución, además de `V26`/`V27`).
- **«INFORMACIÓN PÚBLICA» en el pie.** Venía de `ojClasificacion`, que tenía ese **valor por
  defecto**, junto a código y versión del formato. ⚠️ El pie de «Propuesta Plantilla OJ» lleva
  **exclusivamente** «Página N de M» centrado. Se quitó la línea entera y sus tres campos de Ajustes.
- **Consecutivo antes de la fecha.** El documento abría con `No. ____ / MEVAL – ESCAN – 1.10`; el
  formato abre con la ciudad y la fecha. Eliminado, con su campo de Ajustes.
- **Anexos y bloque de contacto se excluían.** El bloque de anexos desaparecía entero si no se
  marcaba ninguno, y el de contacto si sus campos de Ajustes estaban vacíos (que es lo normal en un
  equipo recién configurado). ⚠️ **Ambos se imprimen SIEMPRE**, con sus renglones en blanco si no hay
  dato — misma regla que las 23 filas de las tablas. Excluir parte del documento está prohibido.
- **El bloque de contacto ya no depende de Ajustes**: usa los **mismos datos de custodia** que se
  piden en el paso 7 (en el formato son los mismos), más el sitio web. Se eliminaron los campos
  duplicados `ojPieDependencia/ojPieDireccion/ojPieTelefonos/ojPieCorreo` de la UI y `custodia` gana
  `web`. Sin datos de custodia ahora hay validación **dura** (`V29`), porque de ahí salen dos partes
  del documento.
- ⚠️ **Regla que quedó clara**: en este oficio, *condicional = excluido*. Si un elemento está en el
  formato, va siempre; lo que falta se deja **en blanco**, nunca se omite el elemento ni se rellena.
  Los checks nuevos generan a propósito un caso sin anexos y sin custodia para probarlo.
- Anti-caché a `?v=35` / `cache-v35`, `_BUILD=35`.

## Simulador (2026-07-30) — datos ficticios completos y dos procesos separados
El simulador generaba casos **a medias** y, sobre todo, seguía produciendo la orden judicial con el
**modelo anterior** (caso legado, sin `ojv`), como si OJ fuera «flagrancia con seis campos extra».
Reescrito en dos generadores independientes. Verificado con `verify_simulador.mjs` (**36 checks**,
nuevo) y abriendo los tres `.docx` en **Word real** (COM).

- ⚠️ **Dependía de Ajustes para datos obligatorios.** `nunc` salía de `cfg.nuncUri/nuncCespa`: en un
  equipo recién instalado el caso ficticio **no podía generar el FPJ-5** (`buildFPJBlob` exige 16
  dígitos, issue M3). Igual el membrete del oficio (V26–V31 son DURAS). **Regla nueva: el simulador
  no depende de Ajustes** — `rNunc()` respeta el NUNC configurado si es válido y si no lo inventa;
  encabezado, custodia y firma se rellenan campo a campo con valores `(DEMO)` cuando faltan. Lo
  configurado siempre manda sobre lo inventado.
- **Campos que nunca se llenaban** y salían en blanco en el documento: `articulosCP[]` (issue M2),
  `hayVehiculos`/`vehiculos[]` (paso 8 del wizard), `correo` de las personas, y **una sola persona
  por rol** pese a que los apartados 4/5/6 del FPJ-5 son repetibles desde FPJ-5 v3. Ahora se sortean
  1–4 conductas con su artículo del C.P., 1–3 capturados / 1–2 víctimas / 1–2 testigos y vehículos
  en la mitad de los casos.
- **Fechas reales, no `2026-mm-dd` al azar.** La captura cae dentro de las **últimas 30 h**, así el
  badge del plazo de 36 h (Ley 906/2004) tiene algo vivo que contar y la disposición nunca queda en
  el futuro.
- **`SIM.genOJ()` produce ahora un caso `ojv:2` del módulo propio**, partiendo de `ojNuevoCaso()` —
  no de una copia a mano del modelo: si `ojEstructura()` gana un campo, el simulador lo hereda.
  Llena las siete ramas (`orden`, `despacho`, `proceso`, `requerido`, `diligencia`, `actuacion`,
  `destino`) más encabezado/custodia/firma: **114 rutas**, todas comprobadas por el test.
- **Seis escenarios coherentes** (`OJ_ESC`) que ejercitan el motor de destinatario: Ley 906
  imputación y medida (R3), condena y revocatoria (R4-A/R4-B), Ley 600 indagatoria (R2) y **SRPA**
  (R1, adolescente **al momento de los hechos** → «aprehensión», T.I. y ruta de adolescentes).
  El escenario de Ley 600 nace con **orden antigua + prórroga**, que es lo que ejercita el cálculo
  de vigencia.
- ⚠️ **La orden simulada nunca nace vencida.** Sería el bloqueo más realista de todos, pero
  `ojDuras()` impediría el oficio y el caso de demostración no serviría para lo que se creó: ver el
  documento salir. El test exige **cero validaciones DURAS** en las 24 muestras.
- **`ojEspejar(c)`** se extrajo de `ojGuardarCaso`: estado derivado (`vigenciaHasta`, `plazoVence`) +
  espejo hacia `capturados[0]`/`conductas[]`/`spoa`… Lo usan los **dos** caminos que crean un caso OJ
  — el wizard y el simulador, que arma el caso entero sin pasar por el formulario.
- ⚠️ **Un caso ficticio no reconfigura la app**: `ojRecordarEncabezado()` ahora sale temprano si
  `c.isTest`. Sin eso, editar y guardar un caso simulado dejaba el membrete `(DEMO)` pegado en los
  Ajustes reales del usuario. El test compara la huella de `DB.getConfig()` antes y después.
- **Vista previa por proceso** (`simResumenFlagrancia` / `simResumenOJ`): la de flagrancia muestra
  NUNC y el conteo de personas/vehículos; la de OJ, número y vigencia de la orden, despacho, plazo
  de 36 h y **qué regla** eligió el destinatario. `simSavePending`/`simEditPending`/`simShowDossier`
  pasan a `async` (antes no esperaban a `DB.saveCase`, que es asíncrono desde la Fase H).
- ⚠️ Ningún dato apunta a una entidad real: los nombres de institución llevan `(DEMO)` y los correos
  usan el TLD reservado `.test` (RFC 2606) — mismo criterio del filtro de Play Store.
- `verify_export.mjs` [27] esperaba **35 tablas** en el FPJ-5 y le llegaban 52: no era una regresión,
  era el generador repartiendo varias personas. Ese check mide **geometría contra el patrón de
  original**, así que su semilla se fija a una persona por rol; las copias ya tienen su regresión en
  `verify_multipersona.mjs`. Regresiones en verde: OJ 128, multipersona 61, envío 38, export 44,
  invitado 33, personas 23, DS 10.
- ⚠️ **`verify_oj.mjs` ya exigía este cambio**: traía el check «El Simulador produce una captura del
  módulo actual, no del formato anterior» (`sim.ojv === 2`), que hasta ahora **no se alcanzaba**
  porque la suite abortaba antes. Con `SIM.genOJ()` en v2 la suite corre entera (128 checks).
- Anti-caché a `?v=36` / `cache-v36`, `_BUILD=36`.

### La otra mitad: la exención de los casos legados tapaba el bug (mismo día)
El usuario volvió a reportar el oficio **sin encabezado**, con «Anexos:» vacío y **sin el bloque de
contacto** — justo lo que «OJ v2.1» decía haber arreglado. No era una regresión del documento: el
motor estaba bien y las validaciones `V26–V31` detectaban las faltas. Lo que fallaba era **quién
llegaba al motor**. `ojProducirOficio` traía `if(!legado){ …validar… }`, así que **una captura del
formato anterior se saltaba TODAS las preguntas** y el oficio salía con el membrete en blanco. Y el
Simulador —la única vía por la que el usuario probaba— **producía justamente casos legados**. Por eso
cada arreglo del generador se veía igual de roto: el generador nunca era el problema.
- ⚠️ **La excepción estaba mal trazada.** Eximir a un caso viejo de aportar **sus datos judiciales**
  es razonable (su formulario nunca los tuvo). Eximirlo del **membrete, la firma y la custodia** no:
  eso no es un dato viejo, **es el formato**, y sale impreso siempre. `OJ_DURAS_DOC` =
  `V26–V31` + `ojBloqueoDoc(caso,legado)` aplican esa distinción, y lo usan **las tres** salidas
  (`ojProducirOficio`, `lcProducir`, `_abrirEnvioSheet`) — antes `_abrirEnvioSheet` ni siquiera
  miraba los casos legados (`if(c.ojv===2)`).
- El modal de faltantes explica el caso legado aparte («este formato no pedía el encabezado; se pide
  una sola vez y queda como valor por defecto»), porque si no parece un requisito nuevo arbitrario.
- ⚠️ **Lección de método, no de código:** verifiqué el documento generando casos **completos** desde
  el wizard, que es el camino que ya funcionaba. El usuario probaba con el **Simulador**, y ahí el
  caso entraba vacío. Un formato correcto alimentado por un caso vacío se ve idéntico a un formato
  roto. **Reproducir por el mismo camino del reporte antes de tocar el motor.**
- `verify_oj.mjs` sube a **128 checks**: siembra un caso legado **con Ajustes en blanco** (el equipo
  del reporte; con Ajustes puestos el prellenado lo tapa y el fallo no se ve), comprueba que bloquea
  y explica, que al completarlo imprime las cuatro líneas del membrete + anexos contados + bloque de
  contacto, y que el Simulador entrega un caso `ojv:2` sin validaciones duras.

### Logo del membrete y trama de las tablas (2026-07-30) — dos pérdidas silenciosas
- **La casilla del logo salía vacía en los casos de demostración.** El logo sale de
  `cfg.ojLogoB64` (lo carga el usuario en Ajustes) y el simulador corre con Ajustes en blanco, así
  que el membrete de demostración no enseñaba cómo queda el oficio — que es para lo único que existe
  el simulador. `ojLogoDemo()` dibuja **con canvas** un marcador («LOGO / DEMO» en recuadro
  punteado) y `ojCfgDoc` lo inyecta **solo si `c.isTest` y no hay logo del usuario**.
  ⚠️ Es un **marcador, no un escudo**: ningún emblema institucional puede vivir en el código (mismo
  filtro de Play Store que los nombres de institución) y **no hay un solo byte de imagen en el
  repositorio**. ⚠️ **Nunca en un oficio real**: un documento que va a un despacho judicial no lleva
  imágenes que el funcionario no cargó — sin logo, la casilla queda vacía. El logo del usuario
  siempre manda, también en los casos simulados.
- ⚠️ **La trama gris de la columna de etiquetas se perdía al exportar a PDF.** El `.docx` la
  conservaba y el PDF no, así que los dos formatos no coincidían — justo lo que la instrucción de
  exportación prohíbe. Causa: **Chrome no imprime fondos por defecto** («Gráficos de fondo» viene
  desmarcado en su diálogo), y la vista de impresión no declaraba `print-color-adjust`. Se agregó
  `-webkit-print-color-adjust:exact; print-color-adjust:exact` en `lcPrintCss`, que obliga al
  navegador a respetar los colores declarados aunque la casilla siga desmarcada. Cubre de una vez
  las **tres** tablas y las barras de sección.
  ⚠️ **Regla general: todo fondo de la vista de impresión hay que declararlo `exact`** — si no,
  existe en pantalla y desaparece en el papel.
- `verify_simulador.mjs` sube a **41 checks** (logo del marcador en `.docx` y en la vista, ninguna
  imagen inventada en un oficio real, y el logo del usuario ganándole al marcador) y
  `verify_export.mjs` a **47** (mide la trama sobre la vista ya paginada, **tabla por tabla**:
  9 · 10 · 4 = 23 celdas). Anti-caché `?v=37` / `cache-v37`, `_BUILD=37`.

### El logo «seguía perdido» + la línea 4 del membrete (2026-07-30)
- ⚠️ **El logo se pedía en un sitio distinto del que se pedía el membrete.** Desde que el encabezado
  es obligatorio (V26–V31), el usuario diligencia las cuatro líneas **en el paso 7 del wizard** — y
  ahí el logo era **una frase** («se carga en Ajustes → Oficio de orden judicial»), no un campo. Quien
  nunca abre Ajustes jamás lo veía y el oficio salía sin escudo sin que nada se lo advirtiera. Ahora
  el control (cargar · miniatura · quitar) vive **dentro del mismo bloque de las 4 líneas**.
  `ojLogoGuardar`/`ojLogoBorrar` son las primitivas comunes de los dos sitios; `ojRefrescarLogoWiz()`
  repinta **solo el bloque del logo** — ⚠️ volver a renderizar el paso entero borraría lo que el
  usuario esté escribiendo en los demás campos. El logo sigue viviendo en `cfg` (es del equipo, no
  del caso) y sigue sin haber **un solo byte de imagen en el repositorio**.
  ⚠️ **Regla: si un dato es obligatorio en el procedimiento, se pide en el procedimiento.** Mandar al
  usuario a otra pantalla equivale a no pedirlo.
- **`ojEstacionLabel(t,caps)`**: «CANDELARIA» → «ESTACIÓN DE POLICÍA CANDELARIA». Mismo criterio que
  `patrullaLabel()`. ⚠️ **No toca** lo que ya trae un tipo de unidad (`OJ_RE_TIPO_DEP`: estación,
  subestación, CAI, seccional, comando, dependencia, dirección, distrito, policía, gaula, URI,
  CESPA…): ahí el nombre ya está completo
  y anteponer algo lo estropearía. Se aplica en tres salidas —línea 4 del membrete (mayúscula),
  constancia de custodia de la narración y bloque de contacto (minúscula)— y **también en el
  formulario, al salir del campo** (`onblur`), en el wizard y en Ajustes: el usuario ve lo que se va
  a imprimir y puede corregirlo, en vez de una transformación silenciosa al generar.
  «Estación de Policía» es vocabulario del sistema judicial, no una marca — mismo criterio ya
  aplicado en el dossier; el nombre de la institución sigue siendo un campo del usuario.
- `verify_oj.mjs` sube a **137 checks** (tabla de `ojEstacionLabel`, el paso 7 con el campo de logo y
  los `onblur`, y una carga **real** del archivo por `setInputFiles` que termina en `word/media/` y en
  la vista de impresión). Anti-caché `?v=39` / `cache-v39`, `_BUILD=39`.

### Escudo embebido (2026-07-30) — DECISIÓN EXPLÍCITA DEL USUARIO que revierte parte del de-branding
⚠️ **Leer junto con «Publicación en Play Store (2026-07-14) — de-branding institucional».** Aquella
sección prohíbe incrustar emblemas institucionales en el código. El usuario, tras advertírselo dos
veces, ordenó lo contrario: *«la aplicación no debe de pedir logo. esto se debe de cargar
automáticamente, el logo tiene que ser exactamente como el de la plantilla OJ»*. Es su decisión y su
riesgo; queda registrada aquí para que nadie la revierta por error **ni la extienda sin preguntar**.
- **`OJ_LOGO_B64`** = el escudo de `Documentos/Propuesta Plantilla OJ.docx` (`word/media/image1.png`,
  1082×1052, **1,37 MB**), **resampleado a 400×389 JPEG q0.9 = 85 KB de base64**. El membrete lo
  imprime a 723900 EMU (≈2 cm) → **~500 dpi**: se ve idéntico al del formato. ⚠️ Incrustar el PNG
  original habría sumado **1,8 MB de base64** al HTML (que ya pesa 5,2 MB) en cada arranque, para
  imprimirlo a 2 cm.
- **La app ya no pide logo.** Se quitó el campo del paso 7 (`ojLogoWizHtml`, `ojWizCargarLogo`,
  `ojWizQuitarLogo`, `ojRefrescarLogoWiz`) y el marcador dibujado con canvas (`ojLogoDemo`), que
  existía justamente porque no había escudo embebido. `ojCfgDoc` inyecta `OJ_LOGO_B64` cuando no hay
  `cfg.ojLogoB64`, **sin distinguir caso real de caso de demostración**.
- **El reemplazo sigue existiendo, pero no pregunta**: Ajustes → Oficio de orden judicial muestra cuál
  está en uso y permite cargar otro («Volver al del formato» restaura el embebido). Una unidad de otra
  institución puede poner el suyo.
- ⚠️ **Lo que sigue vigente del de-branding**: el nombre de la institución **no** está en el código
  (las 4 líneas del membrete las escribe el usuario), y el **ícono de la app** sigue siendo el
  monograma «L», no un escudo. Lo único que cambió es el logo **dentro del documento generado**.

## Auditoría del módulo OJ (2026-07-30) — hallazgos y OLA 1 ejecutada
Auditoría de arquitectura de flujo, UX y eficiencia del módulo «Captura por Orden Judicial»,
**medida** sobre un teléfono (384×800, Playwright con touch), no estimada. Cifras del estado previo:

| Medición | Valor |
|---|---|
| Controles visibles en los 7 pasos | **131** (120 campos + 11 casillas) |
| Scroll vertical de un procedimiento | **32 pantallas de teléfono** (el paso 7 solo: 8) |
| Campos a diligenciar a mano, equipo **sin configurar** | **102** |
| Campos a diligenciar a mano, equipo **totalmente configurado** | **86** (el prellenado cubre 38 de 124) |
| Prosa (hints + alertas) que hay que leer | **6 032 caracteres** ≈ 6 min |
| Rutas del modelo `caso.oj` | **145** |
| Campos que se piden y **no salen en ningún entregable** | **36** |
| Municipio / departamento / dirección pedidos por separado | **5× cada uno**, sin enlazar |
| Fechas / horas / teléfonos / nombre de funcionario | 9× / 6× / 7× / 4× |
| Toques para corregir un dato del paso 1 estando en el 7 | **12** (los puntos no eran botones) |

**Diagnóstico de raíz (tres tesis):** (1) *el formulario no es la preimagen del documento* — pide datos
del acta de derechos y del informe ejecutivo, que la app no genera, de ahí los 36 campos huérfanos;
(2) *los pasos siguen la taxonomía jurídica, no la línea de tiempo del funcionario* — en campo hay
**tres** fuentes físicas (el papel de la orden, la persona, lo que pasó) repartidas en siete pantallas
entrelazadas; (3) *la configuración se coló en el procedimiento* — 14 de los 24 campos del paso 7
(membrete, custodia, firma) son propiedades del equipo, no del caso.
⚠️ **Lo que NO se toca**: `ojVigencia`, `ojPlazo36`, `ojResolverDestino` con sus 7 reglas y fundamentos,
`ojEsAdolescente`/`ojTermino`, el constructor OOXML y la regla «condicional = excluido» del formato.
Ese es el activo del módulo; la auditoría es sobre **cómo se piden los datos**, no sobre qué hace con ellos.

### OLA 1 — riesgo de pérdida de trabajo y ceguera de obligatorios (ejecutada)
El hallazgo más grave no era la longitud del formulario sino que **se podía perder entero**. El wizard
solo persistía en el ÚLTIMO paso: los **dos** botones del topbar (← y ✕) llamaban a `cancelWiz()`, que
hacía `wc=null` **sin preguntar**; `go()` usaba `replaceState` sin manejador de `popstate`, así que el
**botón atrás de Android salía de la app**; y no había `beforeunload`. 30-40 minutos de diligenciamiento
se evaporaban con un gesto. Verificado con `verify_ola1.mjs` (**38 checks**, nuevo).
- **Borrador automático** en clave propia `lc_draft`, **cifrada igual que las capturas** (contiene datos
  de una persona, y en CESPA de un menor). ⚠️ **Fuera de `lc_cases` a propósito**: una captura a medias
  no debe salir en la lista, ni en estadísticas, ni crear una persona en el registro. Se guarda al
  cambiar de paso y **2,5 s después de la última tecla** (`wizAutoguardar`) — el paso 4 tiene 33 campos
  y ahí se pueden pasar diez minutos sin cambiar de pantalla. En **modo invitado** funciona en memoria
  y no escribe un byte (`_lcEncSave` ya cortaba para invitado; la huella de `localStorage` se comprueba).
- ⚠️ **«Sucio» se mide contra una foto inicial** (`_wizBase`), no contra «hay campos no vacíos»: el
  wizard **nace precargado** (fecha, hora, NUNC, perfil, unidad, membrete…). Sin esa foto, abrir y
  cerrar el wizard sin tocar nada dejaría un borrador fantasma en cada intento.
- **Recuperación visible**: tarjeta en la pantalla Capturas con nombre, tipo, paso y antigüedad, y dos
  salidas (Continuar / Descartar). Un borrador invisible no sirve de nada.
- **Salir del wizard pregunta**: diálogo con tres salidas explícitas — seguir diligenciando, guardar
  borrador y salir, descartar y salir. **El botón atrás de Android** se intercepta con `popstate` (`go`
  hace `pushState` solo para `wizard`) y entra por el mismo diálogo.
- **Puntos del progreso navegables** (`wizGoto`): eran `<div>` sin `onclick`; ahora son `<button>`.
  ⚠️ **Estaban ocultos por debajo de 580px** (`.wz-dots{display:none}`), o sea que la navegación habría
  quedado **solo en escritorio, justo donde no se diligencia**. Ahora se ven siempre y se retiró la
  barra de relleno, redundante con ellos. Se mantiene la guarda del NUNC al salir del paso 1 (issue M3).
- **Obligatorios marcados en su propio paso**: `ojwF(...,req)` pinta el asterisco, la barra de progreso
  cuenta cuántos faltan en el paso actual y **cada punto se marca en rojo** si su paso tiene faltas
  (`wizFaltasPorPaso` lee `ojValidar`). Antes no había señal alguna en los pasos 1-6.
- **El resumen de faltantes subió al INICIO del paso 7** (medía 8 pantallas de scroll) y **cada falta
  trae su botón «Ir al paso N»**.
- ⚠️ **Bug que destapó esta ola y que la regresión atrapó**: guardar el borrador **después** de
  `renderWiz()` recolectaba las listas repetibles (funcionarios, delitos, prórrogas, elementos) cuando
  su contenedor aún estaba vacío — se pintan de forma **diferida** (`ojPost`) — y `ojListaLeer` **las
  borraba del modelo**. Corregido en dos niveles: `wizGuardarBorrador(true)` cuando ya se recolectó, y
  `ojListaLeer` ignora un contenedor sin filas si el modelo sí las tiene. **Era un peligro latente
  anterior a este cambio**: cualquier `ojCollect()` en esa ventana borraba las filas.
- Regresiones en verde: OJ 138 · multipersona 61 · envío 38 · export 47 · invitado 33 · simulador 41 ·
  personas 23 · DS 10 · **ola1 38**. Anti-caché `?v=40` / `cache-v40`, `_BUILD=40`.

### OLA 2 — redundancia e inferencia automática (ejecutada, 2026-07-31)
`verify_ola2.mjs` (**34 checks**, nuevo). Regla transversal: **lo que la app puede saber no se
pregunta**, y **lo que el usuario escribió no se pisa nunca**.
- **Catálogo geográfico `LC_GEO` + aprendizaje.** El modelo pedía municipio y departamento por
  separado **cinco veces** sin enlazarlos. Ahora el departamento se infiere del municipio.
  ⚠️ **No se embeben los 1 122 municipios**: una tabla larga escrita de memoria es una tabla con
  errores, y aquí el error se imprime en un documento judicial. Se embeben los verificables sin duda
  (32 capitales + Valle de Aburrá) y **el resto lo aprende la app**: el primer par que el usuario
  diligencia queda en `cfg.geoPropios` (mismo patrón que `despachosPropios`). ⚠️ **Homónimos**
  (Barbosa está en Antioquia y Santander; La Unión en cuatro) se declaran con lista y **no se
  autocompletan** — preguntar es correcto, adivinar no; lo aprendido por el usuario sí los resuelve
  para su jurisdicción.
- ⚠️ **La inferencia se dispara en el `input` del campo ORIGEN, jamás en su `blur`.** En el blur el
  foco todavía no ha llegado al destino (`document.activeElement` es el body), así que rellenar ahí
  escribe en el campo al que el usuario está entrando y **lo que teclea se concatena** con la
  sugerencia: salía «239, 240 y 241240» en el oficio. Lo atrapó `verify_oj.mjs`, no la vista.
  `lcAutoRellenar` marca lo que puso la app (`data-lc-auto`) y solo se pisa a sí mismo.
- **Herencia despacho ⇒ destinatario**: en R2 (Ley 600) y R4-A (condena) el destinatario **es** el
  despacho que libró la orden, pero `ojAplicarSugerencia` copiaba **solo el nombre** y el funcionario
  retecleaba dirección, ciudad y teléfono de un juzgado que la app ya tenía. Ahora hereda todo lo que
  esté vacío — y **no hereda** cuando el destinatario es otra autoridad (R3: el fiscal).
- **T.I. automática** cuando `ojEsAdolescente` (el FPJ-5 ya lo hacía con `markDocType`; OJ no) salvo
  que el usuario haya elegido a mano (`tipoDocManual`). **Edad calculada** y de solo lectura cuando
  hay fecha de nacimiento; editable si no la hay (hay órdenes que solo traen la edad).
- **Derechos**: hora, lugar y fecha se proponen desde la diligencia. **Anexos automáticos** según lo
  registrado (`ojAnexosAuto`); en cuanto el usuario toca una casilla (`anexosManual`) la app deja de
  proponer. **Delito ⇒ artículo del C.P.** (`OJ_ART_CP`) reutilizando el datalist `dl-cond` de
  flagrancia. **Funcionario que verifica** desde el perfil activo.
- **«Cargar desde Personas» con buscador** (listaba 60 sin filtro) y **viaje de vuelta simétrico**:
  `ojPersonaEspejo` guardaba padres, estado civil y lugar de nacimiento y `ojUsarPersona` **no los
  releía** — una persona capturada dos veces perdía datos que la app ya tenía suyos.
- **Línea 3 del membrete desde el perfil regional** (`reg.unidad`). ⚠️ **No se puede embeber una
  tabla municipio→unidad**: los nombres de unidad son nombres institucionales y el filtro de Play
  Store los prohíbe en el código. Lo escribe el usuario una vez, como las otras tres líneas.
- **Medido**: un caso real de captura por condena se completa **tecleando 22 campos** y sale con
  **cero validaciones duras**; el resto (departamentos, destinatario, edad, derechos, anexos,
  funcionario) lo pone la app.

### OLA 3 — los 36 campos huérfanos (ejecutada, 2026-07-31)
`verify_ola3.mjs` (**33 checks**, nuevo). Cada campo que no salía en ningún entregable se
**imprime**, se **pliega** o se **elimina**.
- **Eliminados (13)**: `dirigidaA`, especialidad / identificación / funcionario responsable / nombre
  y cargo del juez del despacho, fecha de la decisión, descripción jurídica, pena (3 campos),
  «demás datos identificativos» y vehículo institucional. Ninguno salía en el oficio ni sostenía una
  validación o una decisión. La **firma de la orden se queda**: sostiene V19 (art. 28 C.P.).
- **Plegados (4)**: sexo, estado civil, nacionalidad y alias — no salen en este oficio pero alimentan
  el registro de Personas y el FPJ-5. Siguen ahí, dejan de costar scroll.
  ⚠️ **Un `<details>` no pliega si una regla de autor fija el `display` de sus hijos**: la regla del
  navegador que oculta el contenido de un `<details>` cerrado es de *user-agent* y pierde contra
  cualquier regla propia — `.fr{display:grid}` la anulaba y los cuatro campos seguían ocupando
  pantalla con el bloque «cerrado». Hace falta `.oj-mas:not([open])>*:not(summary){display:none}`.
- **Impresos (14)**: comunicación a un tercero (art. 303.1 CPP, con su fundamento), defensor,
  valoración médica, constancia de entrega (fecha, hora, quién recibe y su cargo) y el resultado de
  la verificación cuando no fue positivo. Su ausencia en el informe es un **defecto del documento**,
  no un dato de relleno.
  ⚠️ **Van DENTRO de la narración**, que es el espacio que el formato tiene para los hechos — igual
  que ya se hacía con la fuerza, las lesiones y las incautaciones. **No se añadió ni un apartado, ni
  una tabla, ni una fila**: el oficio conserva sus 3 tablas y sus 23 filas fijas (regla «el oficio ES
  el formato», OJ v2.1). Hay un check que lo mide.

### OLA 4 — tres pantallas + revisión (ejecutada, 2026-07-31)
`verify_ola4.mjs` (**21 checks**, nuevo). Los siete pasos seguían la taxonomía jurídica; en la calle
el funcionario tiene **tres fuentes** delante (el papel de la orden, la persona, lo que acaba de
pasar) y el formulario le hacía recorrerlas en siete pantallas entrelazadas.
- `OJ_STEPS` pasa a **`['La orden','El requerido','El procedimiento','Revisión']`**. Los bloques no
  se tocaron: se componen (`ojPantallaA` = orden + despacho + proceso; `ojPantallaC` = diligencia +
  actuación). `OJ_PANT` mapea bloque→pantalla y **`ojValidar` etiqueta sus faltas con ese mapa**, así
  que el punto rojo del progreso, el modal de faltantes y «Ir al paso N» siguen funcionando.
- ⚠️ **`ojCollect` recolecta por PRESENCIA EN EL DOM**, no por índice ni por nombre de paso: siete
  recolectores independientes que se autolimitan comprobando su primer campo. Antes bastaba mirar el
  paso activo porque cada bloque tenía su pantalla; ahora una pantalla trae varios. **Fusionar o
  partir pantallas ya no obliga a tocar esa función.**
- ⚠️ **Plegar no es borrar**: cada recolector comprueba si su bloque está en pantalla antes de leerlo.
  Sin eso, recolectar con un `<details>` cerrado habría vaciado sexo/alias, comunicación y valoración.
  Hay tres checks dedicados a esto.
- **Divulgación progresiva**: verificación de la orden, comunicación y defensa, fuerza/salud/novedades,
  incautaciones, anexos, constancia de entrega y el bloque de membrete/custodia/firma viajan plegados
  y se abren solos si ya traen datos o si faltan obligatorios. **El membrete, la custodia y la firma
  son propiedades del equipo**, no del caso: se piden una vez y desde la segunda captura no estorban.
- **Medido (mismo teléfono de la auditoría)**: **131 → 89 controles**, **120 → 74 campos visibles**,
  **32 → 26 pantallas de scroll**, y **6 toques de «Siguiente» → 3**. El paso 7 dejó de ser un
  formulario de 24 campos: es una revisión de 19 con el resumen de faltantes arriba.
- ⚠️ Las suites que recorrían siete pasos (`verify_oj`, `verify_ola1`, `verify_ola2`, `verify_ola3`,
  `verify_invitado`) se adaptaron al recorrido de cuatro y a abrir los bloques plegados. **Ninguna
  bajó su número de comprobaciones.**
- Regresiones en verde: OJ 138 · ola1 38 · ola2 34 · ola3 33 · **ola4 21** · multipersona 61 ·
  envío 38 · export 47 · invitado 33 · simulador 41 · personas 23 · DS 10.
  Anti-caché `?v=41` / `cache-v41`, `_BUILD=41`.

### Lo que queda por delante
Las cuatro olas de la auditoría están ejecutadas. Pendientes de otro orden:
- **Un «Modo 36 horas» explícito**: hoy la divulgación progresiva ya deja a la vista casi solo lo
  obligatorio, pero no hay un botón que diga «emite el oficio con lo mínimo y completa el resto antes
  de enviarlo». Las validaciones DURAS por caso son exactamente **14 datos**.
- **Flagrancia (URI/CESPA) no recibió ninguna de las cuatro olas**: sigue en 8 pasos, con
  `lugar.muni`/`lugar.depto` fijos en Medellín/Antioquia (issue A1) y sin catálogo geográfico. El
  borrador automático y los puntos navegables de la Ola 1 sí la cubren (viven en el wizard común).
- **Los 5 pares municipio/departamento del modelo siguen existiendo** aunque ya no se tecleen: son
  datos distintos (despacho, residencia, nacimiento, lugar de la diligencia, destinatario) y el
  formato los imprime por separado. No se fusionan.

## Mejora 1 (2026-08-01) — el formulario de flagrancia, revisado de raíz
Diez observaciones de campo sobre el wizard de flagrancia (`Documentos/Otro/Mejora 1.docx`, texto +
10 pantallazos con recuadro rojo numerado). No eran retoques visuales: cada una señalaba un dato que
se pedía donde no correspondía, o que se pedía y **no llegaba al documento**. Verificado con
`verify_mejora1.mjs` (**93 checks**, nuevo) y abriendo los `.docx` en **Word real** (COM → PDF →
render con Edge). Regresiones: las 12 suites previas siguen en verde **sin tocar sus expectativas**.

- ⚠️ **El hallazgo de fondo: los EMP y EF NUNCA se imprimieron en el numeral 7.** El código escribía
  `setPar(pars, 301)` (303 en CESPA) y **el índice era correcto** — el fallo estaba una capa más
  abajo. Los tres renglones que la plantilla deja en blanco en ese apartado **no traen ni `<w:r>` ni
  `<w:t>`**, y `_setParNode` arranca con `if(!ts.length) return false`; `setPar` **no mira el valor
  devuelto**, así que el texto se descartaba en silencio. Un elemento material probatorio que
  desaparece de un informe de captura es el mismo tipo de fallo que el de las personas que no se
  reproducían (FPJ-5 v3): el documento *parece* correcto. Nuevo `_setParForce`, que crea el run
  heredando el `rPr` del párrafo. ⚠️ **Se deja aparte de `_setParNode` a propósito**: `buildFPJBlob`
  usa `setPar` también para **borrar** la narración de muestra, y si esa limpieza empezara a crear
  runs vacíos cambiaría el XML de cualquier caso.
- **`_fpjEmp` localiza el apartado POR TEXTO**, nunca por índice (URI y CESPA no comparten
  numeración de párrafos: 301 vs 303), escribe un elemento por renglón y, si hay más elementos que
  renglones, **clona el último** — que es justo lo que el formato autoriza al pie del apartado. Un
  párrafo clonado hereda anchos y bordes: la calibración de las 35 tablas no se toca (medido: siguen
  siendo 35 en ambos formatos).
- ⚠️ **Con cero elementos NO se toca el apartado**, para que el documento de una captura sin EMP
  salga exactamente como salía antes.
- **`keepNext` solo en el título del apartado.** Encadenar también los renglones entre sí obliga al
  bloque entero a saltar de página y **costaba una hoja de más en cada captura con elementos** (3 → 4
  páginas, medido sobre el render). Que la relación continúe en la página siguiente no es un defecto
  —el formato lo contempla—; un encabezado huérfano sí, y eso es lo que se evita.
- **Vehículos sin tope** (`_fpjVehiculos`): el formato trae dos filas y del tercero en adelante se
  **reproduce la fila**, igual que los apartados 4/5/6 con varias personas. Antes, del tercer
  vehículo en adelante se perdían en silencio. Las **placas van siempre en MAYÚSCULAS** (`lcPlaca`),
  normalizadas al teclear, al guardar y al imprimir — los tres, porque un caso puede venir del
  simulador o de un import y no pasar por el formulario.
- **Direcciones normalizadas** (`LC_VIA`, `lcDirWidget`/`lcDirComponer`/`lcDirParsear`), con la
  abreviatura del IGAC (CL, KR, AV…) que es corta y cabe en la casilla del formato: «CL 52 # 50-31».
  Mismo widget en **lugar de los hechos, capturados, víctimas, testigos y el registro de Personas**.
  ⚠️ **El MODELO no cambia**: el widget escribe en un `<input type="hidden">` con el **id de siempre**
  (`w-dir`, `pm-dirRes`), así `collectStep`, `savePersonModal` y el mapeo al FPJ-5 no se enteran.
  ⚠️ La escritura libre se conserva (requisito explícito), y **lo que no encaja no se inventa**:
  `lcDirParsear` devuelve modo `libre` con el texto íntegro. Una dirección mal interpretada manda a
  la policía judicial al sitio equivocado.
- **Conductas punibles a demanda**: el paso nacía con cuatro parejas fijas. Ahora arranca con una y
  se agregan hasta cuatro (lo que imprime el formato, celdas 58-61). ⚠️ **`lcCondFilas` NO recorta
  las filas vacías**: si lo hiciera, «+ Agregar» crearía una fila que el propio render se llevaría
  por delante. La limpieza es cosa de `editCase` (migración) y de `lcLimpiarListas` (guardado).
- ⚠️ **Las listas repetibles leen el DOM ANTES de crecer o encoger, y quien acaba de tocar el modelo
  NO vuelve a leerlo.** `lcEmpQuitar`/`lcEmpDesdeTexto` llamaban a `lcEmpSync()` después de mutar y
  el DOM todavía era el de antes: deshacían justo lo que acababan de hacer. De ahí la separación
  `lcEmpSync` (DOM→modelo) / `lcEmpAplicar` (modelo→`narracion.emp`).
- **Normalización de los elementos**: `lcEmpParsear` reparte lo que el funcionario escriba —«01», «Un
  (1)», «dos», separado por `;`, coma o salto de línea, o todo de corrido— y `lcEmpLineas` imprime
  «01 (uno) celular marca Samsung» / «02 (dos) celulares…», pluralizando en español.
  ⚠️ **La frontera de corte es estrecha a propósito**: con `\d+ palabra` a secas, «revólver calibre
  38 con tres cartuchos» se partía en dos elementos por el «38 con». Inventar un elemento probatorio
  es peor que no separarlo.
- **Fecha y hora**: diez casillas sueltas → cuatro controles nativos (`type=date`/`type=time`), que
  en el teléfono abren el selector del sistema. ⚠️ **El modelo sigue guardando dd/mm/aaaa y hh/mm por
  separado** —`lcDtPartes`/`lcHrPartes` son el único puente— porque así los imprime el FPJ-5, una
  casilla por dígito. Hay vista previa del desglose para que el cambio sea comprobable.
- **Tipo y destino, un solo control**: el selector nombra ya el destino («URI (Adulto) → Fiscalía
  URI») y el destino se edita ahí mismo con «Cambiar», que conserva el botón «Lista» de despachos.
  Cambiar de tipo arrastra el destino.
- ⚠️ **SPOA, No. de incidente y fiscal que recibe salieron del formulario, NO del modelo.** Están en
  el dossier (sección «ES DEJADO A DISPOSICIÓN» y línea «Recibe») pero **no existen en ninguna casilla
  del FPJ-5** — comprobado sobre las dos plantillas embebidas y sobre el documento generado. Se
  diligencian en **Dossier → «Datos del Dossier»**, que es donde se usan. El SPOA venía de la
  observación 1 («eliminar») y recibe el mismo trato que los otros dos porque es el mismo caso: dato
  del dossier, no del formato. Borrarlo habría roto el dossier.
- **Entidad por defecto en el perfil**: `rStep7` ya sabía leerla del perfil activo, pero **el
  formulario del perfil nunca la pedía**, así que salía siempre vacía. Nuevo campo + `lcServidorDefecto`
  como punto único (wizard, paso «Servidor» y «Cargar perfil activo» no pueden discrepar).
  ⚠️ Sigue sin haber ninguna institución escrita en el código — la regla del filtro de Play Store.
- **Migración de casos guardados**: `editCase` compacta conductas, interpreta los EMP del textarea
  antiguo (`lcEmpDeCaso`) y corrige las placas. Una captura vieja sale numerada en el numeral 7 sin
  que el funcionario reescriba nada, y su dirección antigua se lee en el widget nuevo.
- Regresiones en verde: **mejora1 93** · OJ 138 · export 74 · envío 39 · invitado 33 · simulador 41 ·
  multipersona (todo OK) · personas 24 · ola1 38 · ola2 34 · ola3 33 · ola4 21 · DS 10.
  Anti-caché `?v=43` / `cache-v43`, `_BUILD=43`.

### Numeral 2 — los delitos, numerados y en orden (2026-08-02)
Reportado en campo con el documento impreso a la vista: el apartado «2. PRESUNTA CONDUCTA PUNIBLE»
salía desordenado — el primer delito con un «1.» seguido de una tabulación larga, y los otros dos
sin número ninguno. `verify_mejora1.mjs` sube a **115 checks** (12 nuevos); verificado además
abriendo los `.docx` de URI y CESPA en **Word real** (COM → PDF → render con Edge).
- ⚠️ **La plantilla no numera igual sus cuatro casillas.** La primera (celda `58`) trae una **lista
  automática de Word** (`w:numPr` → `numId 2`), que imprime el ordinal y su tabulación **por fuera
  del texto**; las otras tres (`59`-`61`) traen el ordinal **escrito a mano como texto normal**
  («2.», «3.», «4.»). El llenado hacía `setTc` con el nombre del delito y **pisaba esos ordinales**,
  así que solo sobrevivía el de la lista automática. Nada estaba «mal escrito»: eran dos mecanismos
  de numeración distintos en la misma columna.
- **Ahora numera siempre la app** (`_fpjConductas`): se retira el `w:numPr` de la primera casilla
  —comprobado sobre las dos plantillas: **ningún otro párrafo usa ese `numId`**; el `numId 1` es el
  del apartado 9 y no se toca— y se escribe «N. delito» como texto en las cuatro, con el mismo
  `w:ind` y el mismo cuerpo de letra. Sin tabulación: el delito arranca justo tras el punto.
- ⚠️ **Las conductas se compactan antes de numerar.** Un hueco en medio del arreglo dejaría un
  ordinal sin delito o se saltaría un número — que es el desorden que se está corrigiendo.
- ⚠️ **Las casillas sobrantes quedan en blanco, sin el ordinal suelto.** Un «4.» solo en un renglón
  vacío se lee como un delito que faltó por escribir.
- ⚠️ **El apartado 2 NO es repetible**: a diferencia de los apartados 4/5/6 y del 7, el formato no
  trae al pie la nota que autoriza reproducir las casillas. Son cuatro. Lo que no quepa **se avisa
  por toast** (misma regla de honestidad que los vehículos), no se inventa una fila.
- **CESPA**: el run de esa casilla viene vacío y **sin `w:sz`**, mientras el párrafo sí lo declara en
  su `pPr>rPr`; escribir ahí el delito lo sacaba con el cuerpo por defecto de Word, distinto del de
  las casillas 2-4. `_fpjRunCuerpo` le copia el tamaño del párrafo. ⚠️ Se inserta respetando el
  **orden de hijos de `w:rPr`** que fija el esquema (`_fpjRprPon`): alterarlo hace que Word abra el
  documento «dañado» — la misma lección de `ojx*`.
- Sin efectos colaterales medidos: **35 tablas** en ambos formatos y 3 páginas, igual que antes.
  Regresiones en verde: **mejora1 115** · export 74 · envío 39 · simulador 41 · multipersona (todo
  OK). Anti-caché `?v=44` / `cache-v44`, `_BUILD=44`.

### Género con «X» en los apartados 4, 5 y 6 (2026-08-02)
El formato trae dos casillas —«M» y «F»— que se marcan con una X, y la app **no guardaba el género
en ninguna parte**: el formulario de persona nunca lo pedía y el motor se limitaba a **limpiar** la
casilla M (donde la plantilla traía la X de la captura de muestra), así que las dos salían en blanco
para diligenciarlas a mano. `verify_mejora1.mjs` sube a **129 checks** (14 nuevos); verificado
abriendo los `.docx` en Word real (capturado M, víctima F, testigo sin dato).
- **El dato se pide donde se piden los demás**: `openPersonModal` gana un selector de Género, así que
  lo tienen a la vez el wizard (capturados, víctimas, testigos) y el registro de Personas. Va en el
  renglón de edad y fecha de nacimiento porque es el mismo renglón del formato.
- **Vocabulario único**: el campo es `sexo` con los códigos que ya usa el módulo de orden judicial
  (`OJ_CAT.sexo`: M / F / I). Una persona capturada por flagrancia y luego por orden judicial —o al
  revés— no cambia de campo por el camino: `ojPersonaEspejo` lo escribe y `ojUsarPersona` lo relee
  (la simetría del viaje de vuelta, lección de la Ola 2).
- ⚠️ **`lcSexo` normaliza por palabra, nunca por inicial.** «Mujer» empieza por M: leer solo la
  primera letra la habría marcado como masculina en un documento judicial. Acepta lo que venga de un
  caso viejo, de un import o del simulador (`M`, `Masculino`, `Hombre`, `F`, `Femenino`, `Mujer`, `I`)
  y ante cualquier otra cosa devuelve vacío.
- ⚠️ **Se escriben SIEMPRE las dos casillas**, la que no corresponde en blanco. Las copias
  4.1 / 5.1 / 6.1 se clonan **después** de llenar a la primera persona: una X sin limpiar viajaría a
  la siguiente y le cambiaría el género — la misma razón por la que edad y fecha de nacimiento se
  limpian celda por celda (FPJ-5 v3). Hay un check con tres capturados (M, F, I) que lo mide.
- ⚠️ **Con «Intersexual / no informa» o sin dato, las dos quedan en blanco**: el formato solo tiene
  esas dos casillas y aquí no se inventa ninguna. El formulario lo dice en una línea, para que no se
  lea como un fallo.
- ⚠️ **Las dos casillas no tienen el mismo XML.** La de M trae el run de la captura de muestra con su
  `w:sz`; la de F viene vacía —**sin ningún run en URI**, con un run **sin `w:sz` en CESPA**—, así que
  escribir la X «a pelo» la sacaba con el cuerpo por defecto de Word. `_fpjMarcaX` combina
  `_fpjRunCuerpo` (le copia el tamaño al run que ya existe) y `_setParForce` (crea el run heredando
  el `pPr` cuando no hay ninguno). Índices: capturado `b+25`/`b+27`, víctima y testigo `b+23`/`b+25`.
- El simulador reparte género a sus personas, para que el caso de demostración enseñe la marca.
- Regresiones en verde: **mejora1 129** · OJ 138 · export 74 · simulador 41 · personas 24 ·
  invitado 33 · multipersona (todo OK). Anti-caché `?v=45` / `cache-v45`, `_BUILD=45`.

## Mejora 2 (2026-08-02) — el módulo OJ, rediligenciado contra su propio formato
Seis observaciones de campo sobre el wizard de orden judicial (`Documentos/Otro/Mejora 2.docx`,
texto + 6 pantallazos con recuadro rojo numerado). No eran retoques: el formulario pedía datos que
el informe no imprime, imprimía filas que el formato no tiene, y no preguntaba lo único que de
verdad cambia entre un informe y otro. Verificado con `verify_mejora2.mjs` (**38 checks**, nuevo) y
abriendo los `.docx` en **Word real** (COM → PDF → render con Edge, 2 páginas, 3 tablas, sin pedir
reparar).

- ⚠️ **El hallazgo de fondo: el formulario no era la preimagen del documento.** La Ola 4 agrupó los
  pasos por «fuente del dato»; era mejor que la taxonomía jurídica anterior, pero seguía siendo un
  orden propio de la app. El informe abre por el capturado y el formulario abría por la orden. Ahora
  las tres pantallas de diligenciamiento **son** los tres numerales de «Propuesta Plantilla OJ»:
  `OJ_STEPS = ['El capturado','El proceso judicial','La materialización','Revisión']`, con
  `OJ_PANT = {requerido:0, orden:1, despacho:1, proceso:1, diligencia:2, actuacion:2, disposicion:3}`.
  Los **bloques no se reescribieron**: se recomponen — `ojCollect` recolecta por presencia en el DOM
  (Ola 4), así que repartir las pantallas de otro modo no obligó a tocarlo.

### Obs. 1 · Destinatario del informe: Juzgado o Fiscalía
La app **nunca preguntaba** a quién iba dirigido, y es lo único que cambia de verdad entre un informe
y otro. Nuevo `caso.oj.destino.via` (`FISCALIA` / `JUZGADO` / `ADOLESCENTES`), con selector de
botones grandes en la revisión (`.oj-vias`, `ojDestinatarioHtml`).
- **FISCALÍA** → nombre y dirección salen de **Ajustes → Oficio de orden judicial → Fiscalía
  destinataria** (`cfg.ojFiscalia*`, con caída a `cfg.destUri`): se pregunta **una vez**, no en cada
  captura. Mismo criterio que el membrete y la custodia (Ola 4).
- **JUZGADO** → es la **autoridad solicitante del numeral 2**. El formato solo recoge su *nombre*,
  así que la dirección se pide aquí y `ojCollectDisposicion` la **devuelve al despacho**, que va al
  registro reutilizable (`despachosPropios`): se escribe una vez por juzgado, no una por captura.
- La vía **la propone el motor**: cada una de las siete reglas de `ojResolverDestino` declara ahora
  su `via` (R3/R6 → Fiscalía; R2 según el nombre del despacho; R4-A/R4-B → juzgado; R1 →
  adolescentes). El funcionario confirma o cambia, y el cambio queda trazable.
- ⚠️ **Medido: el documento es el mismo en las dos vías salvo 3 líneas** — el encabezado del
  destinatario y la frase de la puesta a disposición («de la Fiscalía General de la Nación» / «del
  despacho judicial que libró la orden»). Hay un check que genera las dos y las compara fragmento a
  fragmento.
- ⚠️ **Los cuatro campos del destinatario se pintan SIEMPRE**, con vía o sin ella: si `#oj-x-nom`
  desapareciera, `ojCollectDisposicion` —que se autolimita mirando ese id— dejaría de recolectar
  también el membrete, la custodia y la firma. Plegar no es borrar; no pintar, tampoco.

### Obs. 3 · Numerales 2 y 3: los datos del formato, en su orden
- **Numeral 2**: se imprimían **«Despacho que la libró»** (fila que el formato NO tiene, duplicaba
  «Autoridad solicitante») y **faltaba «Fecha Decisión»** (que sí está). Las diez filas quedaron en
  el orden exacto del formato, y el paso 2 las pide en ese mismo orden.
- **Numeral 3**: el formato tiene **TRES** filas (Fecha y hora · Lugar · Tipo de lugar). La app
  imprimía una cuarta, «Forma de ubicación». El dato **no se perdió**: abre el relato de los hechos
  («en desarrollo de …»), que es donde el formato lo pone. Total de filas: **23 → 22**.
- ⚠️ **`verify_mejora2.mjs` lee las etiquetas del `.docx` REAL** de `Documentos/Otro/Propuesta
  Plantilla OJ.docx` (lector ZIP propio con `inflateRawSync`) y las compara una a una con las del
  documento generado. No hay lista escrita a mano: si el formato cambia, el test lo dice.
- **La vigencia se conserva intacta** (`ojVigencia` sin tocar) y se calcula sola: se retiraron los
  campos «Vigencia (meses)» y «Estado», que pedían a mano un dato que fija la ley.

### Obs. 4 · Prórroga eliminada — y qué pasó con el bloqueo por orden vencida
El apartado se eliminó del formulario, del catálogo `OJ_LISTS` y del modelo.
⚠️ **`ojVigencia` sigue leyendo `o.prorrogas`**: una captura guardada con prórroga conserva
exactamente la vigencia con la que se emitió (hay un check).
- ⚠️ **Consecuencia que había que resolver, no ignorar:** la prórroga era la **única** vía para
  levantar el bloqueo por orden vencida (V01 era DURA). Sin ella, una orden vencida dejaba al
  funcionario **sin documento y sin salida**, en un procedimiento ya realizado. Y `ojResolverDestino`
  devolvía R0 sin destinatario, lo que además disparaba V22.
- **V01 pasa a BLANDA**, y a cambio la advertencia es imposible de no ver: cuadro rojo en el paso 2,
  banner en la revisión con botón «Revisar la fecha», y **confirmación obligatoria** antes de
  producir el oficio (`ojConfirmarVigencia`), citando art. 298 CPP y CSJ AP4491-2016. Rige en las
  **tres** salidas (descargar, imprimir y enviar) — descargar y enviar no pueden discrepar, misma
  lección que las validaciones duras.
- **R0 pasa a ser un prefijo**, no una regla terminal: `'R0-ORDEN-VENCIDA · R4-A-JUEZ-DISPONIBLE'`.
  El destinatario se sigue proponiendo.
- ⚠️ **El relato no miente**: con orden vencida, la narración NO dice «Confirmada la vigencia de la
  orden» — deja constancia de que figuraba vencida y de que se comunicó a quien la libró.

### Obs. 5 · Información duplicada, unificada
- **Finalidad + «Motivo — texto íntegro de la orden»**: dos campos para la fila «Motivo de la
  Captura». Ahora es uno: selector del catálogo, y la opción **«Otra prevista en la ley»** abre un
  campo para escribirlo a mano (`orden.finalidadOtra`, `ojMotivoTexto`). El textarea de seis líneas
  desapareció. `ojMigrarMejora2` pasa el `motivoTextual` de una captura guardada a `finalidadOtra`.
- **«Autoridad solicitante» + «Despacho que libró la orden»**: dos campos en dos pasos distintos
  para el mismo despacho. Se unificó en `caso.oj.despacho` —que además trae dirección y el registro
  reutilizable— y `orden.autoridadSolicitante` se mantiene **sincronizado** para no romper el
  simulador, el espejo del dossier ni las capturas ya guardadas.

### Obs. 6 · Información irrelevante, eliminada
Fuera del formulario y del modelo: **sistema o medio de consulta** y **resultado de la verificación**
(el resultado solo se imprimía cuando NO era positivo; el medio se sustituye por «el sistema de
información institucional», que es cierto sin inventar nada — y si una captura vieja trae el medio,
se sigue imprimiendo tal cual), **tipo de despacho**, **firma que trae la orden** (con V19),
**teléfono y correo del despacho**, **vigencia en meses** y **estado de la orden**. Con ellos se
retiraron los catálogos `OJ_CAT.especialidad` y `OJ_CAT.firmaOrden`: no queda código muerto.
Los **cinco rasgos físicos** se plegaron (son UNA fila del formato, se pedían con seis controles).

### Revisión técnica — lo que salió del análisis, no del documento
- **La fila «Edad» salía en blanco** en toda captura que no hubiera pasado por el formulario
  (simulador, import, caso guardado antes de que el campo existiera): la edad se calculaba solo **al
  pintar** el paso. Ahora se deriva de la fecha de nacimiento **al imprimir**, que es donde se usa.
- **Los anexos automáticos se recalculaban solo al pintar el paso**: marcar «se leyeron los
  derechos» y generar sin volver a renderizar dejaba el acta de derechos fuera de la lista del
  oficio. `ojAnexosAuto` corre también al recolectar (y sigue sin tocar nada si el usuario ya marcó
  a mano).
- **`cfg.destUriDir` se leía y nunca se escribía**: el oficio de Disposición de flagrancia
  (`genDocDisposicion`, token `{{DESTINATARIO_DIR}}`) salía con esa línea en blanco desde siempre.
  Ahora la dirección de la fiscalía vive en `cfg.ojFiscaliaDireccion`, con campo en Ajustes.
- **Direcciones normalizadas en OJ** (`lcDirWidget`, Mejora 1): la residencia del requerido y el
  lugar de la diligencia usan el mismo widget que flagrancia y el registro de Personas — el módulo
  de orden judicial era el único que seguía pidiéndolas como texto suelto. ⚠️ **El modelo no
  cambia**: el widget escribe en un `<input type="hidden">` con el id de siempre, así `ojCollect`
  no se entera.
- ⚠️ **`lcProducir` y `ojProducirOficio` se partieron en dos** (`…Ahora`) porque la confirmación de
  vigencia es asíncrona por callback y no se puede `await` en medio de un `async` que ya empezó a
  generar. Mismo patrón en `_abrirEnvioSheet` / `_abrirEnvioSheetAhora`.
- **Medido**: 4 pantallas, **65 campos visibles** (eran 74 tras la Ola 4, 120 antes de la auditoría)
  y **17 pantallas de scroll** (eran 20 tras la Ola 4, 32 antes).
- Regresiones en verde: **mejora2 38** · OJ 151 · ola1 38 · ola2 34 · ola3 33 · ola4 22 ·
  invitado 33 · simulador 41 · export 74 · envío 39 · mejora1 129 · multipersona (todo OK) ·
  personas 24 · DS 10. Anti-caché `?v=46` / `cache-v46`, `_BUILD=46`.

## Firma digital del funcionario (2026-08-04) — manuscrita en el teléfono, solo en el oficio OJ
El bloque de firma del oficio de orden judicial dejaba **tres renglones en blanco** para firmar a
mano. Ahora el funcionario firma **una vez** con el dedo, un lápiz táctil o el mouse, y esa firma se
imprime sola encima de su nombre en cada oficio. Verificado con `verify_firma.mjs` (**53 checks**,
nuevo) y abriendo el `.docx` en **Word real** (COM → PDF → render con Edge).

- **Dónde se firma**: Perfil → botón **«Firma»** de cada tarjeta (`openFirmaModal`). Lienzo
  `<canvas>` con **Pointer Events**, que unifica mouse, dedo y stylus en un solo camino — sin ramas
  por dispositivo y sin librerías. Botones Borrar / Guardar (que dice «Actualizar firma» si ya hay
  una) / Eliminar, y vista previa de la guardada. La tarjeta del perfil enseña la miniatura.
- ⚠️ **`touch-action:none` en el canvas es lo que hace que se pueda firmar en Android**: sin eso el
  dedo hace scroll de la pantalla y el trazo se corta.
- ⚠️ **El lienzo se escala por `devicePixelRatio`** (backing store) o el trazo sale pixelado en
  cualquier teléfono. El trazo se **repinta entero** desde los puntos guardados en cada movimiento:
  el suavizado por puntos medios (`quadraticCurveTo`) necesita el punto anterior y el siguiente, y
  así la firma queda curva y natural en vez de una polilínea con picos. La presión del stylus
  modula el grosor; con dedo o mouse queda constante. Un toque sin arrastre es un punto legítimo
  (la tilde, el punto de una i) y se conserva.
- **PNG transparente, recortado y reducido** (`fwExportar`): se recorre el canal alfa para hallar el
  rectángulo de la tinta, se recorta con 6 px de aire y se reduce a 1000 px de ancho como máximo.
  ⚠️ **Sin recorte la firma arrastraría todo el margen vacío del lienzo** y en el documento saldría
  diminuta y descentrada. El lienzo **nunca se rellena**, así que el fondo es transparente de
  verdad — comprobado pintando el PNG **sobre rojo** y leyendo el píxel (un fondo blanco pasaría
  cualquier chequeo de cabecera pero taparía el papel).
- ⚠️ **NO vive en `cfg.perfiles[]`: `lc_cfg` se guarda en localStorage EN CLARO.** Una firma
  manuscrita es un rasgo biométrico y con ella se suscriben documentos judiciales, así que va en su
  propia clave **`lc_firmas`, cifrada con AES-GCM** igual que las capturas, con caché en memoria
  (`_firmasCache`) cargada al desbloquear — mismo patrón que `_casesCache`/`_personsCache`, que es
  lo que permite que `DB.getFirma` sea síncrona. En **modo invitado** no se escribe un solo byte
  (comprobado con la huella completa de `localStorage`). Al borrar un perfil se borra su firma.
- **Una sola firma por usuario**: `DB.saveFirma(idPerfil, …)` reemplaza. `fwGuardar` **espera al
  guardado real** antes de decir «Firma guardada ✓» (lección de la Fase H, cuando `wizSave`
  confirmaba éxito sin haber persistido nada).
- ⚠️ **La firma se busca por el NOMBRE de quien suscribe** (`lcFirmaDe`), no por el perfil activo:
  `caso.oj.firma` se puede diligenciar a mano y ser otra persona. **Estampar la firma manuscrita de
  un funcionario en un documento que suscribe otro sería falsificarla** — ante la duda no se pone
  ninguna y el espacio queda en blanco, como se hacía antes. La comparación normaliza acentos y
  espacios sobrantes.
- **Colocación en el oficio** (`ojxFirmaImg`, referencia visual del requerimiento): va **encima del
  nombre y centrada respecto a él**. ⚠️ La caja se mide con el **ancho real del nombre** en Arial
  11 pt negrita (`lcAnchoTexto`, medido con canvas), no con una fracción del ancho de página: así
  «ocupa aproximadamente el ancho del nombre» con cualquier nombre y cualquier tamaño de hoja, y el
  centrado se reduce a una **sangría** (`w:ind`) — sin cajas flotantes, que en Word se despegan del
  párrafo al repaginar y acabarían sobre el texto. La proporción no se toca: se ajusta al ancho y,
  si eso la haría más alta que `OJX_FIRMA_MAXH` (850 tw ≈ 1,5 cm), se recalcula el ancho desde el
  alto. `keepNext` impide que la firma y el nombre se separen en un salto de página.
- ⚠️ **Sin firma guardada el bloque queda EXACTAMENTE como estaba** (`ojxVacio(3)`): no se embebe
  imagen, no se declara la extensión `png` y no queda ninguna relación rota. El documento no puede
  fallar porque el funcionario no haya firmado.
- **Solo el oficio OJ.** El FPJ-5 se compone de las plantillas de la Fiscalía, cuyas casillas se
  firman a mano, y ninguna otra salida la toca (hay un check que lo mide).
- **Paquete**: `word/media/firma.png` + relación **rId6** en `word/_rels/document.xml.rels` (⚠️ la
  del logo vive en `header1.xml.rels` porque el logo va en el encabezado; la firma va en el cuerpo)
  + `Default Extension="png"` en `[Content_Types].xml`, **declarada una sola vez** aunque el logo ya
  sea png — repetirla deja el paquete inválido y Word pide reparar. `ojCfgDoc` resuelve la firma en
  `cfg._firma`, el único punto donde se arma la configuración efectiva, para que el paquete y el
  cuerpo no puedan discrepar.
- **La vista de impresión (PDF) la pinta sola**: `lcRunHtml` ya traducía `w:drawing` → `<img>` con
  data URI, así que no hizo falta tocar el traductor.
- **Medido en Word real**: 2 páginas, 1 imagen en el cuerpo de 152,8 × 42,5 pt (= los 3056 × 850
  twips calculados), Word abre sin pedir reparar. Regresiones en verde: **firma 53** · OJ 151 ·
  mejora1 129 · mejora2 38 · export 74 · envío 39 · invitado 33 · simulador 41 · personas 24 ·
  ola1 38 · ola2 34 · ola3 33 · ola4 22 · multipersona · DS 10.
  Anti-caché `?v=47` / `cache-v47`, `_BUILD=47`.

## Mejora 3 (2026-08-04) — el módulo OJ deja de parecer un formulario de papel
Ocho observaciones de campo sobre el wizard de orden judicial (`Documentos/Otro/Mejora 3.docx`,
texto + 8 pantallazos con recuadro rojo numerado). Verificado con `verify_mejora3.mjs` (**51 checks**,
nuevo) y abriendo el `.docx` en **Word real** (COM → PDF → render con Edge, 3 páginas, 3 tablas, sin
pedir reparar). Las 13 suites previas siguen en verde.

- ⚠️ **El hilo que une las ocho observaciones**: el formulario pedía cosas que el informe no
  imprime, las pedía **dos veces**, y presentaba de golpe lo que debería revelarse por pasos. El
  usuario lo dijo con una frase que vale como criterio: *«la sensación es de un Word o PDF que
  visualmente se hace aburrido y agotador, es como rellenar información dentro de un documento
  básico»*. La respuesta no fue maquillar: fue **quitar 42 controles** y reordenar lo que queda.
- **Medido en el mismo teléfono de la auditoría (384×800)**: **74 → 25 campos a la vista**,
  **17 → 6,6 pantallas de scroll**, y el paso del capturado pasó de **4 pantallas a media**.

### Obs. 1 · El capturado se toma igual que en flagrancia
El paso 1 desplegaba de golpe los 25 campos de identificación (seis bloques) más un botón «Cargar
desde Personas» que abría una lista. Ahora sigue el patrón que flagrancia ya usaba y que el usuario
reconoce (`rMultiPerson`): **tarjeta + «Agregar» + «Buscar existente»**, y el diligenciamiento
ocurre en un **modal enfocado** (`ojAbrirRequerido` / `ojRequeridoForm` / `ojGuardarRequerido`).
- ⚠️ **La diferencia jurídica se mantiene**: en flagrancia se capturan N personas de un mismo hecho;
  una orden judicial se libra contra UNA y el numeral 1 del formato tiene una sola tabla. Por eso la
  tarjeta es una y los botones desaparecen cuando ya está diligenciada. **No se copió el módulo, se
  copió el patrón.**
- ⚠️ **`ojCollectRequerido` no necesitó cambiar**: se autolimita mirando `#oj-r-pn`, así que fuera
  del modal simplemente no recolecta (Ola 4, «recolectar por presencia en el DOM»).
- ⚠️ **Bug real que destapó el cambio, y que existía desde siempre**: `closeModal()` solo quitaba la
  clase `open` — **el HTML del modal seguía en el DOM**. Era inofensivo mientras los modales solo
  mostraban listas, pero con un formulario dentro, `ojCollect()` encontraba `#oj-r-pn` en el modal
  cerrado y **volcaba al modelo los valores viejos**, pisando (por ejemplo) la persona que se acababa
  de traer del registro. Ahora `closeModal()` **recoge lo tecleado y vacía el contenedor**: un
  formulario que no se ve no puede seguir dictando el modelo, y cerrar tocando fuera no pierde nada.
- ⚠️ **El autoguardado (Ola 1) no cubría los modales**: el listener vivía en `#wz-panels` y los
  modales están fuera. `wizMontarAutoguardado` engancha ahora también `#modal-c` — cubre de paso el
  modal de persona de flagrancia, que tenía el mismo hueco desde la Ola 1.

### Obs. 2 · Lo que se preguntaba dos veces
El bloque «Verificación de la orden antes de materializar» pedía **funcionario, fecha y hora**: los
tres son exactamente los mismos datos del paso 3 (quien verifica la orden **es** quien hace la
captura, y lo hace en ese momento). Se eliminó el bloque; `ojVerificacion(c)` los **deriva**.
- La constancia **sigue imprimiéndose** en el relato con su funcionario y su hora — se dejó de pedir,
  no de imprimir. V17 desapareció: advertir de un dato que la app pone sola es ruido.
- ⚠️ **Lo que registró una captura vieja NO se pisa**: las funciones derivadas anteponen siempre lo
  que traiga el caso guardado y solo rellenan el hueco.

### Obs. 3 · «Forma de ubicación» y coordenadas, fuera
No salen en ninguna fila del formato. La forma de ubicación abría el relato («en desarrollo de …»)
y ahora lo abre una fórmula fija y cierta: **«labores propias del servicio de vigilancia y
control»**. Se fue con ella `ojGPS` y el campo de coordenadas. Una captura guardada que las traiga
las sigue imprimiendo.

### Obs. 4 y 5 · «Actuación policial» e incautaciones
Cuatro bloques y **19 controles** (derechos leídos con fecha/hora/lugar/observación; comunicación y
defensa; uso de la fuerza, lesiones, valoración médica y novedades; elementos incautados y cadena de
custodia). Qué se hizo con cada cosa:
- **Derechos** → se **derivan** (`ojDerechos`): se leen en el sitio y a la hora de la captura, y el
  acta es un documento aparte que viaja como anexo —marcado solo—. La constancia del art. 303 CPP se
  sigue imprimiendo palabra por palabra. **V16 y V16b dejaron de bloquear**: pedir un clic para
  desbloquear algo que la app ya daba por cierto no protegía nada.
- **Comunicación, defensa, fuerza, lesiones, valoración y novedades** → se cuentan en la
  **NARRACIÓN**, que es el espacio que el formato tiene para los hechos. Eran 14 controles para
  alimentar frases que el funcionario escribe mejor con sus palabras.
- **Incautaciones** → *«por lógica las capturas por orden judicial no hay incautaciones ni cadena de
  custodia»*. Fuera el bloque, `OJ_LISTS.incautaciones` y V20. Si en la diligencia aparece algo, es
  un **delito nuevo** y se documenta como captura en flagrancia aparte, con su FPJ-5 y su rótulo.
- ⚠️ **Las claves del modelo se conservan** y `ojRelato` las sigue imprimiendo: una captura guardada
  con esos datos no pierde una línea. Hay un check que lo mide con comunicación, fuerza y rótulo.

### Obs. 6 · Los anexos, en el orden que fijó el usuario
`OJ_CAT.anexos` = informe · **acta de derechos + constancia de buen trato** (⚠️ *«es un solo
formato»*: eran dos casillas para el mismo papel) · **copia documento de identificación** (faltaba y
siempre viaja) · copia de la orden con su número resuelto solo · valoración médico-legal · registro
fotográfico · reseña decadactilar. Los cuatro primeros se marcan solos.
- `OJ_CAT.anexosLegado` + `ojMigrarMejora3` reubican los literales antiguos **sin duplicar**.
- ⚠️ **`ojAnexosAuto` se movió a `ojNormalizar`**: se recalculaba solo al pintar o recolectar el paso
  de la narración, así que un caso que nunca pasó por esa pantalla (el que se genera desde la tarjeta
  de la captura, el del simulador, el importado) llegaba al documento con «Anexos:» y nada debajo.
  Ahora pasa por ahí **todo** camino que abra un caso, `buildOficioOJBlob` incluido.

### Obs. 7 · «Dejando a disposición», rediseñado
*«Es una información sumamente importante […] y queda visualmente perdida en su totalidad»*.
Diagnóstico: la decisión que da sentido a la pantalla —a quién se remite el informe— quedaba en
**sexto lugar**, detrás del reloj de 36 horas, de una lista de diez faltantes de dos renglones cada
una y de un cuadro de fundamento legal. **Todo lo de arriba era ESTADO y lo de abajo, ACCIÓN**: el
orden estaba invertido.
- Nuevo bloque **`.oj-dest`**: abre la pantalla, con borde de acento, el selector Fiscalía/Juzgado y
  el destinatario **resuelto en una tarjeta legible** que dice de dónde salió.
- **Fiscalía** → *«como por lo general es una sola por municipio»*: se carga sola de Ajustes
  (`ojFiscaliaCfg`) y aquí solo se muestra. `ojGuardarFiscaliaDefecto()` es el atajo para quien la
  escribió en la primera captura sin pasar por Ajustes: se pregunta **una vez**, no una por captura.
- **Juzgado** → *«el usuario solo selecciona juzgado y automáticamente se carga»*: la acción
  principal es **«Elegir juzgado de los registrados»** y de la selección salen nombre, dirección,
  ciudad y teléfono sin teclear nada.
- La lista de faltantes pasa a **`.oj-estado`**: una barra roja con el número que se despliega. Sigue
  arriba y cada falta conserva su botón «Ir al paso N» (Ola 1) — lo que cambia es que **desplegada
  eran cuatro pantallas de scroll** por delante de la única decisión del paso. El fundamento de la
  propuesta y el resumen del informe también se pliegan.
- ⚠️ **Plegar no es borrar, y los `<details>` mantienen sus hijos en el DOM**: los cuatro campos del
  destinatario se siguen recolectando con el bloque cerrado — si `#oj-x-nom` desapareciera,
  `ojCollectDisposicion` dejaría de recolectar también el membrete, la custodia y la firma.

### Obs. 8 · El dossier de orden judicial
Salía con **«CUÁNDO ??/??/?? a las ??:?? horas»** y **«DÓNDE —, Barrio —, — - —»**. El dossier es del
módulo de flagrancia y lee `caso.narracion.fechaCap*` y `caso.lugar.*`; el espejo de OJ llenaba el
capturado, los delitos y el destino pero **nunca esas dos ramas** — el módulo guarda esos datos en
`oj.diligencia`, con otros nombres. **No faltaba el dato: faltaba la proyección.**
- `ojEspejarDossier(c)` la hace, dentro de `ojEspejar` — el único punto por el que pasan los dos
  caminos que crean un caso OJ (wizard y simulador). El dossier de flagrancia no se toca.
- ⚠️ **Las capturas ya guardadas también salen bien**: `genDossier` proyecta al leer, **sobre una
  copia** (nada se migra a la fuerza).
- **«CÓMO»** dejó de quedarse fuera: `narracion.texto` recibe el relato del funcionario.
- **La patrulla**: *«si bien el informe lo firma un solo funcionario, en el dossier siempre se
  registran los datos de la patrulla»*. Manda lo configurado en Ajustes (que es lo que ya salía
  bien, con las abreviaturas de la unidad); la patrulla y los funcionarios **del caso** entran solo
  si Ajustes está en blanco. Un equipo configurado no cambia una coma.
- Con un adolescente el dossier dice **«Aprehensión por orden judicial»** (Ley 1098 de 2006).

### Rediseño visual
Cuatro piezas nuevas, todas con tokens del Design System v2 (sin colores hardcodeados, sin
gradientes, sin emojis): `.oj-auto` (la línea «esto lo pone la app» que sustituye a un bloque
retirado), `.oj-persona` (estado vacío del capturado), `.oj-estado` (faltantes y advertencias en una
barra) y `.oj-dest` con su tarjeta. Comprobado en **tema claro y oscuro**.
- ⚠️ **El aviso de progreso ya no dice «van marcados con *» cuando el paso no enseña asteriscos**:
  `renderWiz` pinta los paneles **antes** que la barra para poder mirarlo. Mandar a buscar una marca
  que no está en pantalla es exactamente la incoherencia que hace que una app parezca un formulario.
- ⚠️ **El formato del informe no se tocó**: 3 tablas, 22 filas fijas, sus tres numerales y su pie.
  Hay checks que lo miden.
- Regresiones en verde: **mejora3 51** · OJ 155 · mejora2 38 · mejora1 129 · ola1 38 · ola2 34 ·
  ola3 33 · ola4 22 · invitado 33 · simulador 41 · export 74 · firma 53 · envío 39 · multipersona ·
  personas 24 · DS 10. Anti-caché `?v=48` / `cache-v48`, `_BUILD=48`.

## El documento tiene que poder editarse (2026-08-04) — el texto salía recortado en Word
Reportado en campo con el pantallazo del documento abierto en Word: al escribir sobre el oficio, las
palabras salían **cortadas por la mitad, «como si tuvieran una capa blanca encima»**. Verificado con
`verify_editable.mjs` (**22 checks**, nuevo) y reproducido de raíz en **Word real** (COM → PDF →
render con Edge) contra el build anterior y contra el corregido.

- ⚠️ **No era una capa: era `w:lineRule="exact"`.** Los párrafos espaciadores del oficio (el aire
  entre la última tabla y la narración, los dos filetes del membrete y del pie, y el párrafo de
  cierre que evita la página en blanco) fijaban su alto con **alto de línea EXACTO** de 6 pt, 3 pt y
  1 pt. Word **recorta sin avisar** lo que no cabe en un alto exacto. Mientras el párrafo está vacío
  no se nota — es justo lo que lo hacía invisible en todas las verificaciones anteriores, que
  medían el documento **recién salido de fábrica**. En cuanto el funcionario abre el `.docx` y
  escribe ahí, o pulsa Enter y hereda ese formato del párrafo anterior, su texto de 11 pt queda
  decapitado dentro de una caja de 6 pt.
- **Reproducción exacta del reporte**: el pantallazo del usuario venía de
  `Documentos/Otro/Propuesta Plantilla OJ.docx`, que es una salida de la app que él mismo completó a
  mano. Escribió «HECHOS» en el espaciador que la app deja tras el numeral 3 y Word se lo cortó.
  Reproducido tecleando ese mismo texto por COM sobre el oficio generado con el build anterior: el
  texto sale con la mitad superior comida y encabalgado sobre la última fila de la tabla. Con el
  build corregido, el mismo texto sale entero.
- **El arreglo**: el alto se consigue ahora con **«mínimo» (atLeast) + una MARCA DE PÁRRAFO pequeña**
  (`o.markSz` en `ojxP` → `w:pPr/w:rPr/w:sz`). ⚠️ **La cuenta que garantiza que el formato no se
  movió**: la línea natural de la marca tiene que quedar **por debajo** del mínimo declarado, así
  manda el mínimo y el hueco mide lo mismo al twip (Arial ≈ 1,15 em: marca de 5 pt ⇒ 115 tw < 120 tw;
  de 2 pt ⇒ 46 tw < 60 tw). Vacío mide igual que antes; **con texto crece en vez de recortar**.
- ⚠️ **Regla que deja este trabajo: en los documentos que compone la app no puede haber ni un solo
  `w:lineRule="exact"`.** El `.docx` no es una foto — es un entregable que el funcionario abre,
  completa y corrige en su computador o en su teléfono. Un documento que no se deja escribir está
  roto aunque salga perfecto de fábrica. `verify_editable.mjs` [1] lo vigila en `document.xml`,
  `header*.xml` y `footer*.xml`, y [12-15] escriben de verdad 11 pt dentro de cada espaciador y
  miden que el bloque crece y que no queda una palabra fuera.
- **La vista de impresión (PDF) tenía el mismo defecto latente**: `lcParHtml` traducía `exact` a
  `height` fija, que en el navegador **también recorta**. Ahora los dos modos van a `min-height` —
  el PDF no puede perder una palabra en silencio (misma regla del recorte silencioso de
  «Exportación v2»). Y `lcParHtml` **lee la marca de párrafo** (`pPr/rPr/sz`) para fijar el
  `font-size` del `<p>`: sin eso un espaciador vacío mediría una línea entera de 11 pt en la vista y
  la paginación dejaría de coincidir con la de Word.
- **El documento de referencia del usuario quedó reparado** (13 párrafos en `document.xml`,
  `header1-3` y `footer1-3`), con respaldo `.bak` al lado. Word lo abre sin pedir reparar, sigue en
  2 páginas y «HECHOS» se dibuja entero. `verify_mejora2.mjs` —que lee ese archivo para comparar las
  etiquetas del formato— sigue en verde, así que el rezip no lo estropeó.
- ⚠️ **El FPJ-5 no se toca**: sus plantillas son de la Fiscalía y su geometría está calibrada al twip
  (v2.1–v2.3). Este arreglo es solo del motor OOXML del oficio OJ (`ojx*`), que compone la app.
### El encabezado «HECHOS» del relato (mismo día) — DECISIÓN EXPLÍCITA DEL USUARIO
Del mismo pantallazo salió una segunda petición: *«esa palabra HECHOS debe de quedar por defecto en
el documento, queda predeterminada, tal y como está en negrilla»*. El oficio lo imprime ahora
siempre, antes de la narración: **negrita, centrado, 11 pt**, con `keepNext` para que no quede
huérfano al pie de una hoja (convención del resto del módulo).
- ⚠️ **NO viene de «Propuesta Plantilla OJ»** — comprobado sobre el `document.xml` del formato
  original (`Propuesta Plantilla OJ - copia.docx`), de `Pormt OJ.docx` y de `Mejora 3.docx`: en
  ninguno aparece. Es una **adición pedida por el usuario**, no un elemento del formato que faltara.
  Queda anotado aquí para que nadie la retire creyendo que viola la regla «el oficio ES el formato»
  (mismo criterio con que se registró el escudo embebido).
- ⚠️ **La palabra es neutra a propósito**: no se flexiona por terminología SRPA. En una orden de
  adolescentes el encabezado sigue diciendo «HECHOS» mientras el resto del documento dice
  «aprehensión» — hay un check que lo genera y lo mide, en vez de suponerlo.
- El formato no se movió: 3 tablas, 22 filas y 3 páginas, igual que antes.
- Regresiones en verde: **editable 28** · OJ 155 · mejora3 51 · mejora2 38 · mejora1 129 · firma 53 ·
  export 74 · simulador 41 · invitado 33 · multipersona · envío 39 · personas 24 · ola1 38 ·
  ola2 34 · ola3 33 · ola4 22 · DS 10. Anti-caché `?v=49` / `cache-v49`, `_BUILD=49`.

## Acta de derechos del capturado — FPJ-6 (2026-08-04)
El acta se diligenciaba **a mano** aunque la app ya tenía casi todos sus datos: el funcionario volvía
a escribir nombre, documento, fecha de nacimiento, padres, dirección, delito, fecha, hora y lugar solo
para poder imprimirla, hacerla firmar y tomar la huella. Ahora se genera sola desde el caso.
Verificado con `verify_fpj6.mjs` (**81 checks**) y abriendo los `.docx` en **Word real**
(COM → PDF → render con Edge, 2 páginas, 5 tablas, sin pedir reparar).

### La decisión de arquitectura, y por qué NO fue un módulo de primer nivel
Se evaluaron las tres opciones planteadas. El acta es un producto de **un procedimiento sobre una
persona** —la misma persona capturada dos veces tiene dos actas, con distinta fecha, hora, lugar y
delito—, así que:
- **Módulo de primer nivel (opción A): descartado por precedente propio.** Es exactamente lo que se
  hizo con el Dossier y se revirtió el 2026-07-22: entraba vacío y obligaba a **volver a elegir un
  caso** de una lista que duplicaba la de Capturas. Además el bottom bar tiene 5 slots y el CTA
  central solo queda centrado con 5 (`.bn-item{flex:1}`).
- **Dentro de Personas (opción B): imposible.** `DB.persons` no tiene caso: ni fecha, ni hora, ni
  lugar, ni delito. Obligaría a re-preguntar justo lo que el requerimiento prohíbe.
- **Acción contextual del caso (opción C): la elegida.** El acta es otra **salida** del caso, como el
  documento oficial y el dossier, y entra por el mismo sheet (`openCaseSheet` → «Acta de derechos»).
- ⚠️ **El dato que decidió el mapeo:** `caso.capturados[]` **ya es el punto donde convergen los dos
  flujos** — flagrancia lo escribe directo y el módulo OJ lo proyecta con `ojEspejar()`. Un solo
  mapeo (`f6Mapa`) sirve para los dos **sin una línea de código específica por flujo**, y el wizard
  no gana un paso, un campo ni una validación (hay un check que lo mide sobre el código fuente de
  `collectStep`/`wizSave`/`getWizConfig`/`startWizard`).

### Lo extensible no está en la pantalla: `LC_DOCS`
`lcExportarCaso`, `lcProducirAhora` y `_pregenShareDoc` ramificaban con un booleano `esOJ` **repetido
en tres sitios que podían discrepar**. Se sustituyó por un **registro de documentos**: una entrada por
formato con `lbl`, `soloWord`, `anchoFijo` y `build(ctx, papel)`. `lcExportSoloWord`,
`lcPapelesDe`, `lcPapelEfectivo`, `lcDocNota` y el nuevo productor único `lcProducirDoc` leen de ahí.
⚠️ **Agregar otro formato oficial es agregar una entrada y su `build`**: ni el diálogo de exportación,
ni la lista de papeles, ni la descarga cambian. `lcPapelesFPJ()`/`lcPapelSirveFPJ()` se conservan
porque los usan las suites.

### Mapeo — qué se reutiliza y qué se pregunta
De los campos del formato, **el usuario solo teclea 9** (los que no existen en ningún otro sitio):
nombre identitario · LGBTI (SI/NO) y «¿cuál?» · pertenencia étnica y comunidad · redes sociales ·
persona a quien se comunica la captura (nombre, identificación, teléfono y **hora**) · observaciones.
Todo lo demás sale del caso y del capturado, y el modal lo enseña en un `<details>` («Lo que ya trae
el sistema»).
- **Dónde vive cada dato.** Los **atributos de la persona** (identitario, LGBTI, etnia, redes) van en
  `capturados[i]` y en el registro de Personas, así una segunda captura ya no los pregunta; lo del
  **procedimiento** (a quién se comunicó y a qué hora, observaciones) va en `caso.actas[]`, una
  entrada por persona. Ni un solo campo que el caso ya tenga se guarda aquí.
- ⚠️ **Bug latente que este trabajo destapó y corrigió:** `savePersonModal` y `openPersonForm`
  **reconstruían la persona desde cero** (`p = {id:…, …}`) y la sustituían. Cualquier campo que esos
  formularios no pinten se borraba en silencio al editar — o sea, editar a un capturado después de
  diligenciar su acta habría perdido los datos del FPJ-6. Los dos **fusionan** ahora
  (`Object.assign`). Hay un check dedicado.
- ⚠️ **La fecha, la hora y el lugar se leen de `narracion`/`lugar` y, si faltan, de
  `oj.diligencia`** — los casos OJ anteriores a Mejora 3 no proyectan a `narracion`. La proyección se
  hace **al leer**, sobre el mapa, sin migrar nada.
- **Calidad procesal de la Constancia de Buen Trato («indiciado ___ o imputado ____»), regla del
  usuario (2026-08-04):** flagrancia → **indiciado** (nadie ha formulado cargos todavía); orden
  judicial → **imputado** (para librar la orden ya hubo actuación del despacho); **única excepción**,
  la orden cuya finalidad es *formular la imputación* → indiciado, porque esa audiencia aún no
  ocurre. ⚠️ **La casilla se marca SIEMPRE**: dejarla en blanco obliga a diligenciarla a mano, que es
  justo el trabajo que este módulo elimina. Hay un check con la tabla completa de finalidades.

### Motor documental
`TPL_FPJ6` embebida en base64 junto a `TPL_URI`/`TPL_CESPA`, con su escudo (`word/media/image1.jpeg`,
4,7 KB — es el formato de la Fiscalía, mismo criterio que el FPJ-5). Se escribe por **índice plano de
celda** con `setTc` (113 celdas, 5 tablas): **no se reconstruye ni una tabla**, el diseño oficial
queda intacto. Reutiliza `unzipDocx`, `_buildZip`, `setTc`, `_setParForce`, `sinPuntos`, `mayus` y
`fpjAplicarPapel` — la plantilla comparte el `pgSz` del FPJ-5 (12242 × 15842), así que el papel se
aplica con la misma función sin cambios.
- ⚠️ **ZIP stored obligatorio.** `unzipDocx` lee el tamaño comprimido del local header y decodifica
  directo, **no infla**: la plantilla se reempaquetó sin compresión (335 KB → 446 KB de base64).
- ⚠️ **Las casillas de LGBTI y pertenencia étnica traen su PROPIA etiqueta dentro de la celda** («SI»,
  «AFROCOLOMBIANO»…): no hay casilla vacía al lado, así que `_fpjMarcaX` —que escribe solo la X— las
  borraría. `_f6Marca` conserva la etiqueta y **antepone** la X. **Antes y no detrás, medido sobre el
  render**: «AFROCOLOMBIANO» ocupa la celda entera y una X al final se iba sola al renglón siguiente,
  donde podía leerse como marca de la casilla de abajo.
- **Constancia de Buen Trato** (`_f6Blancos`): se rellenan los **13 grupos de guiones bajos** del
  párrafo, en orden, sin reescribir el texto del formato. ⚠️ El guion relleno se sustituye **entero**
  y el espacio se ajusta según lo que tenga delante y detrás — conservar el sobrante dejaba
  «de 32____años de edad», que se lee como si faltara algo por escribir. **Un valor vacío deja el
  guion como está**: el renglón en blanco es el del formato.
- **Las 21 casillas del encabezado** (`f6Nunc` + `_f6Nunc`) llevan números distintos según el tipo:
  - **Flagrancia → el NUNC.** Sus 16 primeros dígitos —Dpto (2) + Municipio (3) + Entidad (2) +
    Unidad receptora (5) + Año (4)— son **fijos de la unidad** y viven en Ajustes, que es de donde el
    wizard los precarga. Las **5 últimas (Consecutivo) quedan en blanco**: las asigna el SPOA y no se
    conocen en el sitio. ⚠️ Si el caso no trae NUNC (importado, del simulador, anterior al campo) se
    **cae a los de Ajustes** — es el mismo número que el wizard le habría puesto, no un dato
    fabricado.
  - **Orden judicial → el radicado del proceso** (`oj.proceso.radicado`, recogido en «El proceso
    judicial»), que llena **las 21 casillas**, Consecutivo incluido.
- ⚠️ **Radicado de más de 21 dígitos (23 es corriente en Ley 906): no cabe, y se comprobó midiendo el
  render, no suponiéndolo.** Meter los sobrantes en la última casilla los **apila en vertical** y
  estira la fila del encabezado; con `w:tcFitText` la fila se conserva pero tres dígitos condensados
  en 2 mm salen **ilegibles**; y dejar que Word los corte es inaceptable — esa fila trae
  `w:trHeight hRule="exact"` y **recorta sin avisar** (misma trampa de «El documento tiene que poder
  editarse»), y perder dígitos de un radicado judicial en silencio es el peor resultado posible.
  Solución: las 21 casillas llevan los 21 primeros y **el número completo se imprime, en orden y sin
  casillas, en el renglón que el formato ya tiene vacío inmediatamente debajo del encabezado**. No se
  toca ni una celda, no se pierde ni un dígito y se lee de corrido. `_f6BajoEncabezado` localiza ese
  párrafo **recorriendo los hijos del `body`**, nunca por índice plano — `pars` incluye los párrafos
  de dentro de las celdas.
- ⚠️ **Sin número el acta SÍ se genera, con las casillas en blanco.** A diferencia del FPJ-5 —que
  bloquea—, el acta se firma en el sitio de la captura, cuando el consecutivo del SPOA puede no
  existir todavía; bloquearla dejaría al funcionario sin el papel que tiene que hacer firmar. Lo
  que tampoco se hace aquí es **inventar dígitos**.
- ⚠️ **Los renglones de firma quedan EXACTAMENTE como los trae el formato** (capturado, huella, dos
  servidores y fiscal). El acta se imprime para firmarse y estamparse a mano; escribir el nombre del
  servidor sobre esa línea le quitaría el espacio a la firma. Hay un check que lo mide.

### Solo Word, como el FPJ-5 — decisión medida, no heredada
El flujo pedido terminaba en «Descargar PDF». Se midió la plantilla antes de decidir: usa **5
`w:trHeight`, 5 `w:vMerge`, `w:tcW` en las 113 celdas, listas `w:numPr` y el escudo en VML
(`<w:pict>`)** — exactamente las construcciones que el traductor OOXML→HTML **no implementa** y por
las que el FPJ-5 quedó en solo-Word («Exportación v2»). Un PDF que se *parece* al formato oficial de
la Fiscalía es peor que no tener PDF. **Confirmado con el usuario antes de implementar.** La guarda
es **estructural**: `buildActaBlob` marca `out.noPDF` y `lcImprimir()` lo rechaza, así ninguna ruta
futura puede imprimirlo por descuido.

- Regresiones en verde: **fpj6 111** · OJ 155 · mejora1 129 · mejora2 38 · mejora3 51 · firma 53 ·
  editable 28 · export 74 · envío 39 · invitado 33 · simulador 41 · personas 24 · multipersona ·
  ola1 38 · ola2 34 · ola3 33 · ola4 22 · DS 10. Anti-caché `?v=50` / `cache-v50`, `_BUILD=50`.
  ⚠️ `verify_personas` subió su sheet de captura de 6 a **7 acciones** (el acta es la nueva salida);
  `verify_fpj6` escribe sus `.docx` en el **temporal del sistema**, no en el directorio del proyecto:
  abrir uno en Word lo deja bloqueado y la siguiente corrida moría con `EBUSY` antes de comprobar nada.

## Mejora 4 (2026-08-04) — el acta deja de deformar el formato
Siete observaciones de campo sobre el FPJ-6 generado (`Documentos/Otro/Mejora 4.docx`: 7 pantallazos
con recuadro rojo numerado, unos del defecto y otros dibujando el resultado esperado). Verificado con
`verify_fpj6.mjs` (**107 checks**, antes 91) y abriendo los `.docx` en **Word real** (COM → PDF →
render con Edge, 2 páginas, 5 tablas, sin pedir reparar).

- ⚠️ **El hilo que une las siete es UNA sola regla**, y de no tenerla escrita venían todas:
  **la línea y la casilla son del FORMATO; el dato se escribe ENCIMA, nunca EN LUGAR DE ellas.**
  El motor trataba cada renglón continuo como si fuera un campo vacío —escribía el valor y se llevaba
  por delante la línea del formato oficial (obs. 3, 6 y 7)— y cada celda como una caja de texto
  suelta, de ahí los dígitos pegados a la izquierda (1), los valores pegados al borde de arriba (4) y
  la X que empujaba el renglón hacia abajo (5).
- **La corrección NO son siete parches sino una capa de maquetación reutilizable** (`_doc*`), que
  trabaja sobre celdas y párrafos de **cualquier** plantilla, no sobre índices del FPJ-6, y decide
  con **métricas tipográficas reales** (`lcAnchoTexto`, que mide con canvas) en vez de constantes a
  ojo: `_docCentrarCasilla` · `_docApoyarEnLinea` · `_docSobreLinea` (+ `_docAnchoRenglon`,
  `_docPartirEnLinea`, `_docRelleno`) · `_docCabeEnUnaLinea` · `_docAnchoUtil` · `_docPon`/`_docProp`
  (que respetan el orden de hijos que fija el esquema — ponerlos donde caiga hace que Word abra el
  documento «dañado», lección ya pagada en `ojx*`).

| Obs. | Causa técnica | Solución |
|---|---|---|
| 1 · dígitos descentrados | la plantilla no declara `jc` ni `vAlign` en las casillas, y Word los pinta arriba a la izquierda | `_docCentrarCasilla` en las 46 casillas (radicado, NUNC, fecha y hora) |
| 2 · las casillas de fecha crecían | la fila trae `trHeight` **sin `hRule`** (= `atLeast`) y el «Lugar:» de dos renglones la estiraba | lo que no cabe **no se parte dentro de la celda**: la continuación va a un párrafo propio bajo la tabla |
| 3 · la línea de «Lugar:» desaparecía | se sustituían los guiones bajos por el texto | el valor va **subrayado** y el subrayado se prolonga hasta donde llegaba la línea |
| 4 · valores pegados arriba | las celdas de valor no declaran `vAlign` | `_docApoyarEnLinea` (`vAlign bottom`) **solo** en las celdas que la app diligencia |
| 5 · la X empujaba el renglón | «AFROCOLOMBIANO» ocupa la casilla entera y la X la partía en dos | la X va **detrás** de la etiqueta y esa etiqueta **reduce su cuerpo** (22 → 20 medios puntos) hasta caber |
| 6 y 7 · líneas perdidas en Observaciones y en la Constancia | mismo error que la 3 | mismo `_docSobreLinea`; en la constancia cada uno de los 13 espacios se sustituye por un **run subrayado propio** |

- ⚠️ **El subrayado se eligió sobre los guiones bajos a propósito**: el usuario pidió poder seguir
  escribiendo sobre la línea desde el computador o el celular «sin que esta se borre o modifique».
  Con subrayado, lo que se teclea dentro del renglón continúa subrayado y **la línea crece con el
  texto**; con guiones bajos, cada letra empuja un guion y descuadra el renglón.
- ⚠️ **El relleno de la línea son espacios DUROS (U+00A0), no espacios normales.** Word descarta el
  espacio en blanco final de un renglón al maquetarlo y con él se iba el subrayado: la línea
  terminaba justo donde acababa el texto. Se vio en el render, no en el XML.
- ⚠️ **Los anchos se leen del `w:tcW`, no del `w:tblGrid`.** Con la tabla en porcentaje —como todas
  las del FPJ-6— Word obedece el `tcW` y los dos valores **no coinciden**: en la celda de «Lugar:»
  difieren 137 twips, suficiente para que una palabra saltara de renglón y estirara la fila. Costó
  dos pasadas de render descubrirlo; ahora `_docAnchoUtil` lo deriva de la plantilla y **no queda ni
  un ancho de columna escrito a mano**.
- ⚠️ **La continuación del «Lugar:» INSERTA un párrafo clonado del que el formato ya tiene ahí**, en
  vez de escribir dentro de él: ese párrafo vacío es la separación con «Se cumple el
  procedimiento…», y ocuparlo la hacía desaparecer. Clonar hereda tipografía y espaciado exactos.
  ⚠️ Eso **corre los índices planos de párrafo**: `F6_P` sigue siendo válido porque `buildActaBlob`
  toma las referencias de nodo ANTES de insertar, pero cualquier medición sobre el XML final tiene
  que localizar por contenido (la suite lo hace).
- **Control de calidad, medido y no supuesto**: el `.docx` generado conserva sus **113 celdas, 5
  tablas** y su **geometría idéntica** a la plantilla —los `gridCol`, `tcW`, `tblW` y `trHeight` se
  comparan byte a byte contra `TPL_FPJ6`—; sin dato, las casillas de etnia y el renglón de
  Observaciones quedan **byte a byte** como en el formato; y no se subraya donde la «línea» es el
  borde de una celda. Solo se reduce el cuerpo de la etiqueta que lo necesita: «INDÍGENA» se queda
  en 22.
### Segundo pase, sobre el propio build de Mejora 4 (mismo día)
Dos defectos reportados en campo con el documento a la vista. `verify_fpj6.mjs` sube a **111 checks**.
- ⚠️ **La segunda línea de la dirección salía 137 twips (2,4 mm) a la izquierda de la primera.** La
  sangría del párrafo de continuación se derivaba del `tblGrid` (4924) mientras Word coloca la celda
  por el `tcW` (4787): **la misma trampa que ya había documentado para el ancho de ajuste de línea y
  que no apliqué aquí**. Ahora `_f6SangriaLugar` la deriva de la celda. Medido sobre el render,
  píxel a píxel: las dos líneas arrancan en el mismo x.
- ⚠️ **Una observación de más de un renglón salía CORTADA a media frase.** `_docSobreLinea` devuelve
  lo que no cupo y ese valor **se estaba descartando**: el acta que firma el capturado perdía texto
  sin avisar — la misma familia de fallo que los EMP que nunca se imprimían (Mejora 1) y las personas
  que no se reproducían (FPJ-5 v3). `_f6Observaciones` añade tantos renglones como haga falta,
  **cada uno con su línea** (que es además lo que pedía la observación 6: «durante todo el texto debe
  de ir línea»), con tope de 20 para que un dato absurdo no dispare el documento.
- **Un renglón en blanco tras «Observaciones:»**, como en el formato diligenciado a mano, y
  `w:keepNext` en el título y en los renglones escritos: el apartado no se parte en el salto de
  página dejando el título huérfano al pie de la hoja anterior.
- Regresiones en verde: **fpj6 111** · OJ 155 · mejora1 129 · mejora2 38 · mejora3 51 · firma 53 ·
  editable 28 · export 74 · envío 39 · invitado 33 · simulador 41 · personas 24 · multipersona ·
  ola1 38 · ola2 34 · ola3 33 · ola4 22 · DS 10. Anti-caché `?v=52` / `cache-v52`, `_BUILD=52`.

## Plantillas subidas: subsistema retirado (2026-08-08) — el HTML pasa de 5,76 MB a 2,16 MB
El usuario preguntó, señalando el ítem del sidebar, «¿para qué ese espacio si no se está
utilizando?». Al medirlo resultó que no era solo espacio de pantalla: era **el 63 % del peso de la
app** sosteniendo una función que ya nadie podía alcanzar.

- ⚠️ **Estaba muerta desde OJ v2 (2026-07-29), pero se quedó cobrando el peaje.** Su único consumidor
  era `genDocDisposicion()`, y a esa función solo se llegaba desde el paso 7 del wizard **viejo**, es
  decir con una captura OJ anterior al módulo (`ojv` ausente). Para esa misma captura, el botón de
  encima ya generaba el oficio bueno con `ojDescargarOficio` — o sea que el formulario ofrecía **dos
  documentos distintos para un mismo procedimiento**, y el de plantilla era el formato descartado.
  Cuando se escribió «se acabaron las plantillas subidas para orden judicial» se cortó la **lectura**
  (`ojPaquete` dejó de tener rama de plantilla) pero no se retiró **el resto del subsistema**.
- **Lo que pesaba, medido, no estimado:** `_BUILTIN_TPL_FISCALIA_B64` (1 843 KB) y
  `_BUILTIN_TPL_JUZGADO_B64` (1 846 KB) = **3,6 MB de base64** en el HTML. Dentro de cada `.docx`,
  `word/media/image3.png` pesa **1,34 MB** y mide **1082×1052** — las mismas dimensiones exactas del
  escudo de «Propuesta Plantilla OJ.docx», que para el oficio OJ se resampleó a 400×389 JPEG (85 KB)
  precisamente para no cargarlo entero. Aquí estaba **dos veces, a resolución completa**, para
  imprimirlo a 2 cm.
- ⚠️ **Y ocupaba cuota de `localStorage`, que es lo escaso.** `initDefaultTemplates()` escribía las
  dos plantillas en la clave `lc_templates` **en claro**, en el mismo origen donde viven las capturas
  cifradas. Nuevo `_lcPurgarPlantillas()` en el arranque: la borra en silencio (no es un dato del
  usuario, son formatos que la app se instalaba sola, y ya no existe la vía que los consumía).
- **Qué se fue**: el ítem del sidebar y del sheet «Más», `#screen-plantillas`, `renderPlantillas` /
  `openSubirPlantilla` / `guardarTemplate` / `activarTemplate` / `delTemplate` / `verCamposTemplate`
  / `checkTplSize` / `_TIPO_LBL`, el motor `genDocDisposicion` + `_dispNarr2` + `normalizeXmlRuns`
  (que solo él usaba), `initDefaultTemplates`, las dos constantes base64, `_guestTpls` y **las siete
  funciones de plantillas de `DB`**. No queda código muerto.
- ⚠️ **La garantía de que el formato del oficio no se puede alterar deja de ser una rama que se
  ignora y pasa a ser código que no existe.** `verify_oj.mjs` lo mide como tal: ninguna función de la
  API, ninguna de la UI, `screens.indexOf('plantillas') < 0`, sin `#screen-plantillas` y con
  `lc_templates` purgada.
- **El sidebar queda con «Recursos → Despachos» como sección de un solo ítem.** Es el patrón que ya
  tenía «Análisis → Estadísticas»: se deja así en vez de rehacer la agrupación, que es una decisión
  de navegación aparte.
- ⚠️ **Dos checks del módulo OJ fallan los sábados, domingos y festivos, y NO son regresión de este
  trabajo**: `verify_oj` [18] («el destinatario se sigue proponiendo») y `verify_ola2` [12]
  («condena con despacho disponible ⇒ R4-A»). `ojResolverDestino` está funcionando bien — en día no
  hábil no hay juzgado disponible y enruta correctamente a **R4-B** (juez de turno, C-042/2018); lo
  que está mal es que las suites **dan por hecho un día hábil**. Comprobado: [18] falla idéntico
  contra el build anterior (155 checks, 1 fallo), y el diff no toca `ojResolverDestino` ni el cálculo
  de disponibilidad. Corregirlas es congelar la fecha en la prueba, no tocar el motor.
- ⚠️ `verify_collapse.mjs`, citado en la sección «Dossier colapsado», **ya no existe en el
  repositorio**. Obsoleto igual que `verify_fase_g.mjs` / `verify_fase_h.mjs`.
- Regresiones en verde: fpj6 111 · OJ 156 (1 fallo de calendario, preexistente) · mejora1 129 ·
  mejora2 38 · mejora3 51 · firma 53 · editable 28 · export 74 · envío 39 · invitado 33 ·
  simulador 41 · personas 24 · multipersona · ola1 38 · ola2 34 (1 fallo de calendario,
  preexistente) · ola3 33 · ola4 22 · DS 10. Anti-caché `?v=53` / `cache-v53`, `_BUILD=53`.

## Acta de derechos — ¿presentó documento de identificación? (2026-08-13)
Reportado en campo con el `.docx` a la vista (pantallazo con recuadro rojo sobre la casilla
«IDENTIFICACION»): el acta nunca preguntaba si el capturado/aprehendido tenía o no su documento
físico encima al momento de la captura, y ese dato se quedaba fuera del formato. Verificado con
`verify_fpj6.mjs` (**115 checks**, antes 111).
- **Nuevo campo `caso.actas[].presentoDoc`** (`'SI' | 'NO' | ''`). Va en el **acta** (dato del
  procedimiento), no en `capturados[i]` (atributo de la persona): la misma persona puede presentar
  el documento en una captura y no tenerlo encima en la siguiente — mismo criterio ya aplicado a
  `comunica`/`obs` en este módulo.
- **Pregunta nueva** en el modal del acta (`f6Abrir`), sección «Documento de identificación», justo
  después de «Lo que ya trae el sistema» — select SI/NO/No informa, igual que el de LGBTI.
- **Se imprime pegado a la identificación** en la misma casilla del formato (`F6_C.DOC`, celda 72):
  «CC 71234567 de Medellín, Presenta documento físico» / «…, No presenta documento físico». Sin
  declarar, no se inventa ninguna de las dos — mismo criterio que las casillas LGBTI y de etnia.
- Regresiones en verde: **fpj6 115** (las 111 previas sin tocar sus expectativas). Anti-caché
  `?v=54` / `cache-v54`, `_BUILD=54`.

## El acta, en un solo cuerpo de letra (2026-08-13) — 12, 11 y 10 pt en el mismo documento
Reportado en campo: en el FPJ-6 los datos rellenados salían a **tres tamaños distintos** —el NUNC a
12 pt, la mayoría a 11 y las observaciones a 10—. Verificado con `verify_fpj6.mjs` (**122 checks**,
antes 115) y abriendo el `.docx` en **Word real** (COM), que ahora reporta 11 pt en las 14 celdas de
valor, en las 21 casillas del encabezado, en las observaciones y en la constancia.

- ⚠️ **La causa no era que alguien hubiera pedido 12 pt en alguna parte: era la AUSENCIA de
  `w:sz`.** Un run sin tamaño propio no hereda el del formato que lo rodea — hereda el del **estilo
  por defecto del documento**, y en esta plantilla `Normal` declara `sz 24` = **12 pt**, mientras las
  etiquetas del formato traen su `sz 22` = 11 pt **escrito en el run**. `setTc` escribe el texto y no
  toca el `rPr`, así que todo lo que pasaba por ahí (NUNC, fecha, hora y las 18 celdas del apartado 1
  y del 3) salía a 12 pt. Por abajo pasaba lo simétrico: quien escribe clonando un run del formato
  hereda el tamaño de **ese** run, y la línea de «Observaciones:» es de 10 pt.
- **El arreglo tiene dos piezas, y la segunda no es opcional:**
  1. `_docSzTexto(nodo, medios)` — primitiva genérica que fija `sz`/`szCs` en los runs **con texto**
     de una celda o párrafo. Se aplica en **una sola pasada al final** (`F6_RELLENA`, 51 celdas),
     no en cada `setTc`: así una celda nueva se une a la lista y no hay forma de escribir a otro
     tamaño por descuido.
  2. `_docSobreLinea` recibe el tamaño **por parámetro** (`medios`). ⚠️ Tenía que ser una entrada y
     no un retoque posterior: esa función **mide** el texto para cortar el renglón y para calcular
     el relleno del subrayado, así que escribir a un tamaño y medir a otro haría que la línea se
     pasara de largo, Word la envolviera y **estirara la fila** — justo lo que prohíbe Mejora 4
     obs. 2. Cubre «Lugar:» y las observaciones.
- ⚠️ **Los runs VACÍOS no se tocan**: una casilla sin dato queda byte a byte como en la plantilla
  (los checks [108] y [109], que comparan contra el original, siguen en verde).
- ⚠️ **Las etiquetas del formato no se tocan** — ya venían a 11 pt. La lista `F6_RELLENA` es solo de
  **celdas de valor**; quedan fuera a propósito `LGBTI_*` y las seis de `ETNIA`, que traen DENTRO la
  etiqueta del formato («SI», «AFROCOLOMBIANO»…).
- ⚠️ **Una excepción, medida y no supuesta: «AFROCOLOMBIANO» marcada se queda en 10 pt.** La
  etiqueta **sola** ocupa 2102 twips y su casilla tiene 2221 útiles: con la X no cabe a 11 pt **con
  ningún espaciado** (se midieron las seis casillas con separadores de 1, 2 y 3 espacios). Reducir el
  cuerpo ahí es la decisión que ya tomó Mejora 4 obs. 5 para que la fila no se estire; forzar 11 pt
  la revertiría. Hay un check que lo fija con esa cifra.
- ⚠️ **La regresión no mira el `w:sz` del run — resuelve el tamaño EFECTIVO como Word**
  (`rPr/sz` → `rStyle` → estilo del párrafo con su cadena `basedOn` → `docDefaults`). Mirar el
  atributo habría dado verde con el defecto puesto, porque el defecto **era** que no existía.
  Comprobado que la guarda no es vacía: vaciando `F6_RELLENA` en caliente salen **62 runs a 12 pt**;
  con el arreglo, 0.
- Regresiones en verde: **fpj6 122** · OJ 156 · mejora1 129 · mejora2 38 · mejora3 51 · firma 53 ·
  editable 28 · export 74 · envío 39 · invitado 33 · simulador 41 · personas 24 · multipersona ·
  ola1 38 · ola2 34 · ola3 33 · ola4 22 · DS 10. Anti-caché `?v=55` / `cache-v55`, `_BUILD=55`.

## Auditoría tipográfica del oficio OJ (2026-08-13) — el estándar, y el único defecto real
Pedida como normalización integral, con la dinámica de «El acta, en un solo cuerpo de letra».
Verificado con `verify_tipografia_oj.mjs` (**36 checks**, nuevo) y abriendo el `.docx` en **Word
real** (COM), que informa el tamaño carácter por carácter.

### Norma aplicable — jerarquía de fuentes
1. **El formato institucional `Documentos/Otro/Propuesta Plantilla OJ - copia.docx`** es el estándar
   de ESTE documento y manda sobre cualquier guía genérica: es la plantilla aprobada, y la regla «el
   oficio ES el formato» (OJ v2.1) ya lo fijó. La auditoría lo **midió**, no lo supuso.
2. **GTC 185 (ICONTEC, documentación organizacional)** — márgenes sup 3-4 / inf 2-3 / izq 3-4 /
   der 2-3 cm, interlineado sencillo, y la regla de que las **líneas especiales** (anexos, datos del
   remitente) van «en la misma fuente pero con un tamaño de letra menor». ⚠️ El PDF de la norma tiene
   protección de copia; no se sorteó — el contenido se tomó de manuales públicos que la desarrollan.
3. **Acuerdo 060 de 2001 (AGN)** — obliga a normalizar formatos y remite a las normas ICONTEC.
4. **Guía de Gestión Documental institucional** — fija el **membrete en Arial 10** en cuatro líneas.

**Estándar resultante (los tres niveles ya eran los correctos):** fuente única **Arial**;
**11 pt** cuerpo, títulos de numeral (estilo `Ttulo1`, negrita), «HECHOS» y nombre del firmante;
**10 pt** tablas (etiqueta negrita + valor), membrete, cargo/contacto del firmante y anexos —las
«líneas especiales» de la GTC 185—; **9 pt** bloque de contacto y pie. Márgenes 3,5 / 3,0 / 3,0 /
2,0 cm (dentro de GTC 185). Cuerpo justificado, interlineado sencillo (`line 240 atLeast`).

### Qué encontró la auditoría
- ⚠️ **El documento ya estaba normalizado.** El perfilado clase por clase contra el formato dio
  coincidencia exacta en cuerpo, negrita, alineación, estilo de Word, márgenes y membrete. **No se
  cambió nada de eso**: inventar cambios para «verse activo» habría roto un formato calibrado.
- ⚠️ **Un defecto real, visible en el pantallazo del usuario: «Página 1 de 2» salía con los números
  más grandes que las palabras.** `ojxCampoNum`/`ojxCampoTot` eran **los dos únicos sitios del motor
  que construían runs de texto a mano**, sin pasar por `ojxRun`, y por tanto sin `rPr`: heredaban el
  estilo por defecto (**11 pt negro**) mientras «Página » y « de » iban a 9 pt gris `404040`. El
  formato de referencia lleva los **doce** runs de su pie a 9 pt `404040`, campos incluidos.
- **Es la misma familia de fallo que el acta**, por otra vía: allí faltaba `w:sz` en runs escritos
  con `setTc`; aquí faltaba el `rPr` entero en runs escritos a mano. En ambos casos **el defecto era
  la ausencia de la declaración**, no un valor equivocado.
- **No hubo divergencia Word ↔ PDF**: la vista de impresión reproducía el mismo 11 pt en el número,
  porque traduce el mismo `document.xml`. Los dos quedaron corregidos a la vez.
- **Descartado tras medirlo**: en el formato, el nombre del firmante trae un run suelto a 10 pt (un
  espacio tecleado a mano) entre runs de 11. La app lo emite uniforme a 11 pt — **más correcto que
  la referencia**; no se copió el artefacto. Es el «no copies ciegamente sus valores» del encargo.

### Qué se cambió
- `ojxRPr(o)` se extrae de `ojxRun`: **único punto** donde se decide la tipografía de este oficio.
- `ojxCampo(instr,o)` sustituye a los dos constructores a mano y pone el mismo `rPr` en **los cinco
  runs** del campo (begin · instrucción · separate · resultado · end). ⚠️ Los cinco, no solo el del
  resultado: cuando Word recalcula el campo al repaginar, el número toma el formato de esos runs —es
  lo que hace el formato de referencia— y así no vuelve a crecer.
- El pie arma un solo objeto de propiedades y lo pasa a palabras y campos: no puede volver a salir a
  dos tamaños.
- ⚠️ **La garantía es estructural, no un valor corregido**: `verify_tipografia_oj.mjs` [7] exige
  **cero runs con texto sin `w:sz` propio** (y [8] sin `w:rFonts`) en `document.xml`, encabezados y
  pies. Mirar «qué tamaños hay» no habría detectado nada, porque el defecto era la ausencia.
  Comprobado que no es vacía: neutralizando `ojxCampo` salen **10 runs sin tamaño**; con el arreglo, 0.
- La suite además compara **clase por clase contra el `.docx` de referencia** (no contra una lista
  escrita a mano: si el formato cambia, el test lo dice), verifica los rangos de la GTC 185, la
  equivalencia Word↔PDF en 9 clases, y que un oficio breve y uno extenso usen los mismos cuerpos.
- **Medido en Word real**: 3 páginas, 3 tablas, márgenes 3,5/3/3/2 cm y el pie `P=9 á=9 … 1=9 … 3=9`.
- Regresiones en verde: **tipografía OJ 36** · OJ 156 · fpj6 122 · export 74 · editable 28 ·
  envío 39 · simulador 41 · firma 53 · mejora2 38 · mejora3 51 · invitado 33.
  Anti-caché `?v=56` / `cache-v56`, `_BUILD=56`.

### Bloque de contacto: dirección, barrio y ciudad (2026-08-13)
El renglón bajo el nombre de la unidad solo imprimía la **dirección**, y el formato lo escribe
completo: «Calle 48 # 55–50, **barrio La Candelaria, Medellín**». Verificado con `verify_oj.mjs`
(**164 checks**, antes 156) y abriendo el `.docx` en Word real.
- `custodia` gana `barrio` y `ciudad`, con su espacio en **Ajustes → Oficio de orden judicial** (se
  piden una vez, como el resto de la custodia) y en el paso 7 por si un procedimiento termina en
  otro sitio. `ojPrellenarDeCfg` los baja al caso y `ojRecordarEncabezado` los devuelve a Ajustes.
- **`ojCustodiaDireccion(cu)` es el único punto donde se componen**, con la redacción de
  `ojLugarTexto` (el «barrio» en minúscula delante del nombre). Lo usan el bloque de contacto **y**
  la constancia de custodia de la narración, que en el formato son el mismo dato y no pueden
  discrepar. Cada parte es opcional: sin barrio ni ciudad no quedan comas sueltas.
- ⚠️ **No se repite lo que la dirección ya diga, y la regresión atrapó el fallo.** Hasta ahora había
  UN solo campo y el ejemplo de Ajustes pedía escribirlo todo dentro; al precargar barrio y ciudad
  sobre una dirección que ya los traía salía «…, barrio La Candelaria, Medellín, barrio La
  Candelaria, Medellín». El compositor se abstiene de añadir un dato ya presente — ⚠️ **no parte ni
  reinterpreta el texto viejo**: una dirección mal interpretada manda al despacho al sitio
  equivocado (misma regla que `lcDirParsear`). Una captura guardada antes sale byte a byte igual.
- El simulador reparte los tres campos por separado, para que el caso de demostración enseñe el
  renglón completo. Anti-caché `?v=57` / `cache-v57`, `_BUILD=57`.

### Un solo sitio: Ajustes → Estación (2026-08-13)
El usuario señaló la sección **Estación** —que ya pedía Dirección y Teléfono— y pidió que el barrio y
la ciudad se recogieran ahí. Al medirlo salió algo peor que una duplicación de pantalla.
`verify_oj.mjs` sube a **176 checks** (antes 164).
- ⚠️ **`cfg.dosDir` no la leía NINGÚN documento.** Aparecía tres veces en todo el archivo: el valor
  por defecto, el `loadAjustesFields` que la pinta y el `saveAjustes` que la guarda. El usuario
  escribía la dirección de su unidad en Ajustes → Estación y **se quedaba ahí**; mientras tanto, el
  oficio pedía esa misma dirección otra vez, en otra sección, con otra clave (`ojCustDireccion`).
  `dosTel` corría mejor suerte por poco: solo la leía el respaldo del teléfono del firmante.
- **El contacto de la unidad se pide una vez, en Ajustes → Estación**: nombre para el oficio,
  dirección, barrio, ciudad, teléfono, correo y sitio web. Los siete campos **escriben en las claves
  que lee el oficio** (`ojCust*` + `ojPieWeb`), así que el motor documental no cambió ni una línea.
  `dosDir`/`dosTel` se mantienen **en espejo** al guardar, para no romper una config exportada antes
  (mismo criterio que `conocieronCaso`).
- **La sección del oficio ya no los vuelve a pedir**: se retiraron sus siete campos duplicados y en
  su lugar queda una línea que dice de dónde salen. ⚠️ Antes había **dos campos «Barrio»** en la
  misma pantalla de Ajustes escribiendo en la misma clave, con dos etiquetas distintas.
- ⚠️ **Lo ya escrito llega al documento sin volver a teclearlo**: `ojPrellenarDeCfg` lee
  `ojCustDireccion || dosDir` y `ojCustTelefono || dosTel`, y el formulario los muestra. Hay un check
  que siembra la configuración legada y comprueba que el oficio sale completo.
- ⚠️ **`nombreEstacion` NO entra en esa cadena** aunque esté en la misma sección: viene sembrada con
  un valor por defecto (`'CANDELARIA'`), así que fabricaría un lugar de custodia en un equipo sin
  configurar y desactivaría la validación dura V29 — que es justo el fallo que se corrigió el
  2026-07-30. Quien quiera otro rótulo lo escribe en «Nombre para el oficio».
- **Seis claves huérfanas eliminadas de la configuración** (`_CFG_MUERTAS`): `ojConsecutivo`,
  `ojCodigoFormato`, `ojVersionFormato`, `ojClasificacion`, `ojUbicacionTRD` y `ojReviso`. Sus campos
  se retiraron en «OJ v2» y «OJ v2.1» y las claves se quedaron sembrándose en cada guardado y
  viajando en cada exportación, **con cero lectores y cero escritores** —auditado clave por clave
  sobre todo el archivo—. `_cfgConDefaults` las borra al leer, así desaparecen también de las
  configuraciones ya guardadas. ⚠️ Las `ojPie*` son **distintas y se quedan**: tampoco tienen campo,
  pero sí se **leen** como respaldo de una config anterior a «OJ v2.1».
- **El escudo del membrete se pliega** (`<details class="oj-mas" id="aj-oj-logo-det">`). Ocupaba
  media pantalla con una miniatura, un selector de archivo abierto y **dos frases que decían «no hay
  que hacer nada»** — para algo que la app ya resuelve sola desde «Escudo embebido» (2026-07-30).
  ⚠️ **No se borró**: es la única vía para que una unidad de otra institución ponga el suyo, y esa
  posibilidad es deliberada. `renderLogoOJ` **lo abre solo si hay un escudo propio cargado**, así
  quien lo cambió ve cuál quedó y puede deshacerlo, y quien usa el del formato no lo ve nunca.
- Regresiones en verde: **OJ 177** · fpj6 122 · mejora1 129 · mejora2 38 · mejora3 51 · firma 53 ·
  editable 28 · export 74 · tipografía OJ 36 · envío 39 · invitado 33 · simulador 41 · personas 24 ·
  multipersona · ola1 38 · ola2 34 · ola3 33 · ola4 22 · DS 10.
  Anti-caché `?v=59` / `cache-v59`, `_BUILD=59`.

### Auditoría de Ajustes → Estación · Oficio de orden judicial (2026-08-13, 2º pase)
Auditoría de las dos secciones, campo por campo, rastreando cada clave por todo el archivo antes de
tocar nada y **reproduciendo cada defecto sobre la app real** con Playwright. `verify_oj.mjs` sube a
**186 checks** (antes 177) y el `.docx` se abrió en **Word real** (3 páginas, 3 tablas, sin reparar).

- ⚠️ **El nombre de la unidad se pedía TRES veces** y la herencia solo corría en un sentido:
  «Nombre de la estación» (`nombreEstacion` → dossier), «Nombre para el oficio» (`ojCustEstacion` →
  bloque de contacto y constancia de custodia) —**los dos en la misma pantalla**— y «Línea 4 —
  estación o dependencia» (`ojDependencia` → membrete), en la otra. Medido: un usuario que
  diligencia la sección Estación **entera** seguía bloqueado por **V27** («Falta la estación o
  dependencia del encabezado») después de haber escrito el nombre de su unidad dos veces.
  `ojPrellenarDeCfg` ya caía `ojCustEstacion || ojDependencia`, pero nada caía hacia el membrete ni
  desde `nombreEstacion`.
- **`lcUnidadNombre(cfg)` / `lcUnidadCiudad(cfg)`** son el punto único de resolución. ⚠️ **Cada
  consumidor consulta su clave propia POR DELANTE** (`ojEncabezadoXml` → `cfg.ojDependencia||…`,
  `ojPrellenarDeCfg` → `cfg.ojCustEstacion||…`, la fecha del oficio → `cfg.ojCiudad||…`): un equipo
  ya configurado imprime **exactamente lo mismo que antes** y la consolidación solo rellena huecos.
  No hay un orden global único a propósito — lo habría cambiado.
- ⚠️ **`nombreEstacion` ya NO nace sembrada con «CANDELARIA»** (una estación real de Medellín). Era
  un dato fabricado que todo equipo recién instalado imprimía en el dossier sin escribirlo, y era
  **el motivo por el que el nombre no se podía compartir**: encadenar un default habría inventado un
  lugar de custodia y desactivado V29 (lección del 2026-07-30). Sin default, la V29 sigue
  protegiendo igual y el dato pasa a ser uno solo. El encabezado del dossier **omite el renglón** si
  no hay unidad, en vez de nombrar una que no es la del usuario, y pasa por `ojEstacionLabel` como
  las otras dos salidas (antes llevaba «ESTACIÓN DE POLICÍA» escrito a pelo, así que una seccional o
  un CAI salían con el rótulo pegado delante).
- **«Ciudad del oficio» era la ciudad de la unidad.** `ojCiudad` (sección del oficio) y
  `ojCustCiudad` (sección Estación) son el mismo dato: el oficio se fecha donde está la unidad que
  lo suscribe. Un solo campo, en Estación.
- **Migración al leer, idempotente y no destructiva** (`_cfgConDefaults`): si `nombreEstacion` está
  vacía se sube lo que haya en `ojCustEstacion`/`ojDependencia`/`ojPieDependencia`, e igual con la
  ciudad. Quien configuró el membrete o la custodia antes ve su unidad en Ajustes y no la reteclea.
  **Ninguna clave se borra**; las legadas siguen mandando en su documento.
- ⚠️ **La regla de propagación al guardar es la pieza delicada.** Las claves legadas se leen primero,
  así que si el usuario cambia el nombre y ellas conservaran el anterior, **ganarían ellas y el
  cambio no se vería**. `saveAjustes`: si el nombre **cambió**, se propaga a las dos; si **no**
  cambió, solo se rellenan las vacías — así una unidad con membrete distinto del lugar de custodia
  (una seccional que retiene en la estación) **no se colapsa** por abrir Ajustes y pulsar Guardar.
  Hay un check dedicado a ese caso.
- ⚠️ **`v(id)` devuelve `''` cuando el elemento no existe**: al retirar `aj-cest`, `aj-oj-dep` y
  `aj-oj-ciu` había que **quitar también sus asignaciones** de `saveAjustes`, o el primer guardado
  habría borrado la configuración del usuario. Es la misma trampa que ya protege el `if
  (document.getElementById('aj-oj-min'))` de esa función.
- **En la sección del oficio, las dos líneas retiradas no desaparecen: se ven resueltas**
  (`renderAjDerivados`, clase `.oj-auto`) con su valor y su procedencia, y se repintan mientras se
  teclea en Estación. Un dato que se hereda en silencio es indistinguible de un dato que falta.
- **Revisado y NO cambiado, con motivo**: `ojFiscaliaNombre` ya cae a `destUri` (fallback existente y
  documentado; son la denominación formal y la etiqueta corta de la misma fiscalía);
  `rangoComandante:'CORONEL'` y `numDistrito:'TRES'` **siguen sembrados** — son datos fabricados del
  mismo tipo, pero no bloqueaban ninguna consolidación y cambiarlos altera la salida del dossier sin
  que nadie lo haya pedido; `ojPieWeb` conserva su nombre legado (renombrarlo rompería una config ya
  exportada). Los campos de Fiscalía, jornada hábil, asunto y escudo tienen un solo consumidor cada
  uno: no sobra ninguno.
- Regresiones en verde: **OJ 186** · fpj6 122 · mejora1 129 · mejora2 38 · mejora3 51 · firma 53 ·
  editable 28 · export 74 · tipografía OJ 36 · envío 39 · invitado 33 · simulador 41 · personas 24 ·
  multipersona · ola1 38 · ola2 34 · ola3 33 · ola4 22 · DS 10.
  Anti-caché `?v=60` / `cache-v60`, `_BUILD=60`.

## Encabezado del oficio OJ reajustado por el usuario (2026-08-13)
El usuario cambió a mano el membrete de `Documentos/Otro/Propuesta Plantilla OJ.docx` y pidió que
**todos** los oficios de dejando a disposición salgan así, sin tocar nada más. Verificado con
`verify_tipografia_oj.mjs` (**39 checks**, antes 36) y abriendo el `.docx` en **Word real**
(COM → PDF → render con Edge).
- **Se midió el archivo, no se estimó**: comparado contra la versión anterior del repositorio, lo
  único que cambió es `word/header3.xml` — `document.xml` y hasta los bytes del escudo
  (`word/media/image1.png`) son idénticos. Dentro de ese header, dos cosas: el escudo pasa de
  `wp:inline` 723900 EMU a **`wp:anchor` de 800100 EMU** (2,22 cm) con `wrapNone` y desplazamiento
  `posOffset` H=43815 / V=−96520, y las cuatro líneas pierden su `w:sz 20` → heredan el
  `docDefaults` de la plantilla, que es **`sz 22` = 11 pt**.
- ⚠️ **El membrete estrena constante propia, `OJX_SZ_MEMBRETE`**. Se imprimía con `OJX_SZ_TABLA`,
  que usan también las 3 tablas, los anexos y el bloque de firma: reutilizarla habría subido a 11 pt
  medio documento. Hay un check que exige que las tablas sigan en 10 pt.
- ⚠️ **El escudo va ANCLADO, no en línea, y eso es lo que preserva el diseño**: 800100 EMU son 63 pt,
  más alto que las cuatro líneas de texto (≈51 pt), así que en línea el membrete entero crecería —
  justo lo que el ajuste del usuario evita. Flotante, su alto no arrastra el de la fila.
- ⚠️ **No se copian los adornos de ida y vuelta de Word** que trae ese dibujo (`wp14:anchorId/editId`,
  `wp14:sizeRelH/V` al 0 %, `a14:useLocalDpi`): no afectan al render y exigirían declarar los
  prefijos `wp14`/`a14` en `OJ_NS_W` y en su `mc:Ignorable`, que solo puede nombrar prefijos
  declarados (lección heredada del FPJ-5 v2.1).
- **La vista de impresión (PDF) aprendió a respetar el anclaje.** `lcRunHtml` ponía toda imagen en
  línea, así que el escudo empujaba el cuerpo de la primera hoja hacia abajo: **divergencia
  PREEXISTENTE**, no de este cambio (cuerpo a 109,7 pt en la vista contra 99,0 pt en Word), que este
  cambio habría agravado a 115,7 pt. Con la rama nueva —contenedor de alto cero + `position:absolute`
  con los `posOffset`— la vista arranca el cuerpo en **99,9 pt**. Solo afecta a imágenes ancladas, que
  en toda la app son únicamente este escudo (la firma y el FPJ-5/FPJ-6 usan `wp:inline` o VML).
- ⚠️ **El contenedor lleva alto cero pero NO ancho cero**: el CSS de impresión trae
  `img{max-width:100%}` y con ancho cero el escudo se quedaba en **0 px de ancho**, con su alto
  intacto — invisible en el XML, solo aparece **midiendo el render**.
- **Medido en Word real**: escudo 63,0 × 63,0 pt en `left=3,5 / top=−7,6` con `wrapNone` y las cuatro
  líneas a 11 pt — **idéntico, valor por valor, al archivo del usuario**; cuerpo arrancando en
  y=99,0 pt; **3 páginas y 3 tablas**, igual que antes.
- ⚠️ **El membrete tiene ahora su propia referencia en la suite**: se compara contra
  `Propuesta Plantilla OJ.docx` (el reajustado), mientras el resto del oficio sigue midiéndose contra
  `Propuesta Plantilla OJ - copia.docx`, que no cambió.
- ⚠️ **Fallo PREEXISTENTE corregido en la suite**: reventaba en ~1 de cada 5 corridas porque buscaba
  «IDENTIFICACIÓN DEL CAPTURADO» y el simulador saca a veces el escenario SRPA, donde el oficio dice
  «APREHENDIDO». Confirmado reproduciéndolo también contra el build anterior (2 fallos en 10
  corridas). Ahora el numeral se busca por su número, que no cambia.
- Regresiones en verde: **tipografía OJ 39** · OJ 186 · fpj6 122 · mejora1 129 · mejora2 38 ·
  mejora3 51 · firma 53 · editable 28 · export 74 · envío 39 · invitado 33 · simulador 41 ·
  personas 24 · multipersona · ola1 38 · ola2 34 · ola3 33 · ola4 22 · DS 10.
  Anti-caché `?v=61` / `cache-v61`, `_BUILD=61`.

## Issues pendientes para v8.1
| Issue | Descripción | Prioridad |
|-------|-------------|-----------|
| C2 | Service Worker requiere HTTPS — sw.js separado no embebido | ALTA |
| A1 | Localidad/zona/vereda hardcodeadas en datalists | MEDIA |
| A2 | NUNC con prefijo Medellín hardcodeado — configurar por regional | MEDIA |
| S2 | innerHTML con datos de usuario sin escapar en atributos `value=""` (perfiles, secciones del dossier). Los 4 `<textarea>` del wizard ya se escapan (Fase H) | BAJA |
| S3 | Backup de capturas (`exportarCapturas`) se exporta en JSON plano sin cifrar — ya muestra advertencia explícita al usuario (Fase H), pero no cifra el archivo | BAJA |
