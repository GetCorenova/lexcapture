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

## Issues pendientes para v8.1
| Issue | Descripción | Prioridad |
|-------|-------------|-----------|
| C2 | Service Worker requiere HTTPS — sw.js separado no embebido | ALTA |
| A1 | Localidad/zona/vereda hardcodeadas en datalists | MEDIA |
| A2 | NUNC con prefijo Medellín hardcodeado — configurar por regional | MEDIA |
| S2 | innerHTML con datos de usuario sin escapar en atributos `value=""` (perfiles, secciones del dossier). Los 4 `<textarea>` del wizard ya se escapan (Fase H) | BAJA |
| S3 | Backup de capturas (`exportarCapturas`) se exporta en JSON plano sin cifrar — ya muestra advertencia explícita al usuario (Fase H), pero no cifra el archivo | BAJA |
