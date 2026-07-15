# LexCapture v8.0 RC — Contexto Maestro del Proyecto
<!-- Versión: v8.0 RC | Release Candidate: 2026-06-16 | Fase H completada -->

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
| Decisión | Valor |
|----------|-------|
| Color Flagrancia | `#d97706` (ámbar) |
| Color OJ | `#9333ea` (púrpura) |
| Color acción/acento | `#00c9db` (cian) |
| Color OK | `#10b981` (verde) |
| Color error | `#ef4444` (rojo) |
| Fondo principal | `#0f172a` (del Esqueleto) |
| VERDE 3 | Campo `cfg.dosVerde3` = grado + nombre completo del oficial (ej: "Subteniente Juan Martínez López") |
| DIAMANTE 3 | Campo `cfg.dosDiamante3` = grado + nombre completo del oficial |
| Saludo dossier | Automático por hora: DÍAS (06-11:59) / TARDES (12-18:59) / NOCHES (19-05:59) |

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
| C3 | ~~Sin firma digital~~ | **CANCELADO**: documentos se imprimen y firman a mano |

## Issues pendientes para v8.1
| Issue | Descripción | Prioridad |
|-------|-------------|-----------|
| C2 | Service Worker requiere HTTPS — sw.js separado no embebido | ALTA |
| A1 | Localidad/zona/vereda hardcodeadas en datalists | MEDIA |
| A2 | NUNC con prefijo Medellín hardcodeado — configurar por regional | MEDIA |
| A5 | FPJ-5 fecha como string en informe generado (no celda-por-celda del formato oficial) | MEDIA |
| S1 | `escape()`/`unescape()` deprecated en exportConfig/importConfig | BAJA |
| S2 | innerHTML con datos de usuario sin sanitizar (riesgo bajo en app interna) | BAJA |
