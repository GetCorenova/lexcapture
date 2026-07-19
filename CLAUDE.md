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

## Issues pendientes para v8.1
| Issue | Descripción | Prioridad |
|-------|-------------|-----------|
| C2 | Service Worker requiere HTTPS — sw.js separado no embebido | ALTA |
| A1 | Localidad/zona/vereda hardcodeadas en datalists | MEDIA |
| A2 | NUNC con prefijo Medellín hardcodeado — configurar por regional | MEDIA |
| S2 | innerHTML con datos de usuario sin escapar en atributos `value=""` (perfiles, secciones del dossier). Los 4 `<textarea>` del wizard ya se escapan (Fase H) | BAJA |
| S3 | Backup de capturas (`exportarCapturas`) se exporta en JSON plano sin cifrar — ya muestra advertencia explícita al usuario (Fase H), pero no cifra el archivo | BAJA |
