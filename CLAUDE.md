# LexCapture v8.0 RC — Contexto Maestro del Proyecto
<!-- Versión: v8.0 RC | Release Candidate: 2026-07-14 | Fase H re-ejecutada (ver sección Fase H más abajo) -->

## Qué es este proyecto
**LexCapture v8** es una PWA (Progressive Web App) para la Policía Nacional de Colombia que digitaliza el proceso de registro de capturas en campo. Reemplaza el papeleo manual generando automáticamente documentos legales oficiales.

## Estructura de archivos
```
Crear App/
├── CLAUDE.md           ← este archivo (leer siempre al iniciar sesión)
├── FASE_A.md … FASE_H.md  ← instrucciones por fase (leer solo al ejecutar)
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

## Issues pendientes para v8.1
| Issue | Descripción | Prioridad |
|-------|-------------|-----------|
| C2 | Service Worker requiere HTTPS — sw.js separado no embebido | ALTA |
| A1 | Localidad/zona/vereda hardcodeadas en datalists | MEDIA |
| A2 | NUNC con prefijo Medellín hardcodeado — configurar por regional | MEDIA |
| S2 | innerHTML con datos de usuario sin escapar en atributos `value=""` (perfiles, secciones del dossier). Los 4 `<textarea>` del wizard ya se escapan (Fase H) | BAJA |
| S3 | Backup de capturas (`exportarCapturas`) se exporta en JSON plano sin cifrar — ya muestra advertencia explícita al usuario (Fase H), pero no cifra el archivo | BAJA |
