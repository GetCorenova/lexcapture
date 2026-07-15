# FASE C — Dossier Unificado + Configuración del Dossier

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: MEDIA-ALTA (~30-35 mensajes · cómodo en ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/verify` `/run`  
**Prerequisito:** Fase B completada — wizard y lista de capturas funcionales

---

## Objetivo
Activar la pantalla Dossier como panel unificado (selector de caso + preview WhatsApp + generación docx) y corregir el encabezado del dossier con los 3 campos granulares. Corregir bugs A1 y A2.

---

## Instrucciones de ejecución

### Paso 1 — Screen Dossier unificado
En `screen-dossier`, implementar un panel de 3 zonas:

**Zona 1 — Selector de caso:**
- Dropdown o lista scrollable de capturas guardadas
- Muestra: tipo (icono+color) + nombre capturado + fecha
- Al seleccionar, carga el caso y actualiza Zona 2

**Zona 2 — Preview del dossier WhatsApp:**
- Función `genDossier(caso)` que genera el texto formateado
- Formato exacto según la auditoría (ver sección s6):
  ```
  *DIOS Y PATRIA MI [rangoComandante] [saludo]*
  *DISTRITO [numDistrito] DE POLICÍA*
  *ESTACIÓN DE POLICÍA [nombreEstacion]*
  [dosDir] — Tel: [dosTel]
  
  ✅ *QUÉ:* [conductas]
  ✅ *CUÁNDO:* [fecha] a las [hora] horas
  ✅ *DÓNDE:* [dirección], Barrio [barrio], [municipio] - [departamento]
  ✅ *QUIÉN:* [nombre capturado], CC [doc], Edad [X] años...
  ✅ *CÓMO:* [primeros 300 chars de narración]
  ✅ *VÍCTIMA:* [datos] (o "Sin víctima directa")
  ✅ *ES DEJADO A DISPOSICIÓN:* [despacho], SPOA: [x], Incidente: [x]
  ```
  - **⚠ "Recibe: [fiscal]"** — este campo NO aplica para URI ni CESPA (flagrancia). Solo incluirlo en dossiers de tipo OJ. Para URI/CESPA, omitir completamente esa parte.
  ```
  ✅ *Conocieron el caso* [cfg.conocieronCaso]
  ✅ *VERDE 3* [cfg.dosVerde3]
  ✅ *DIAMANTE 3* [cfg.dosDiamante3]
  ```
- Para OJ: sin sección VÍCTIMA/TESTIGOS, añadir sección AUTORIDAD QUE SOLICITA
- Para CESPA: usar "APREHENDIDO" y "APREHENSIÓN" en todo el texto
- **Saludo automático por hora:** `new Date().getHours()` → <12 DÍAS, 12-18 TARDES, >=19 NOCHES

**Zona 3 — Botones de acción:**
- Botón "📱 Compartir por WhatsApp" (llama shareDosWA corregido)
- Botón "📄 Descargar FPJ-5 URI" / "📄 Descargar FPJ-5 CESPA" (según tipo)
- Botón "📄 Descargar Oficio Disposición" (OJ)
- Botón "📄 Descargar Acta de Derechos"
- Botón "📋 Copiar texto" (copia preview al clipboard)

### Paso 2 — Configuración del encabezado del dossier (3 campos granulares)
Reemplazar el campo monolítico `cfg.dosEncabezado` por 3 campos separados:
- `cfg.rangoComandante` — text input, ej: "CORONEL"
- `cfg.numDistrito` — text input, ej: "TRES"  
- `cfg.nombreEstacion` — text input, ej: "CANDELARIA"

Actualizar `DB.getConfig()` para que los defaults sean `{rangoComandante:'CORONEL', numDistrito:'TRES', nombreEstacion:'CANDELARIA'}`.

### Paso 3 — Fix nomenclatura dossier
- Renombrar `cfg.dosConocidoPor` → `cfg.conocieronCaso` en todos los usos
- Agregar campos con labels descriptivos:
  - "VERDE 3 — Grado y nombre del oficial" (`cfg.dosVerde3`)
  - "DIAMANTE 3 — Grado y nombre del oficial" (`cfg.dosDiamante3`)

### Paso 4 — Fix A1 — Localidad/Zona/Vereda configurables
En Step 2 del wizard (Lugar de los hechos), reemplazar valores hardcodeados:
- `localidad` hardcodeada "10" → campo editable con default desde `cfg.localidadDefault`
- `zona` hardcodeada "Urbana" → selector Urbana/Rural con default configurable
- `vereda` hardcodeada "N/A" → campo editable con default "N/A" configurable

Agregar en Ajustes: defaults de localidad, zona y vereda.

### Paso 5 — Fix A2 — NUNC por defecto vacío
En `DB.getConfig()`, cambiar:
- `cfg.nuncUri` default: `""` (vacío, en lugar del NUNC hardcodeado de Medellín)
- `cfg.nuncCespa` default: `""` (vacío)
- En el wizard Step 1, si hay NUNC en config, pre-rellenar el campo; si no, dejar vacío

### Paso 6 — Módulo editor dinámico del Dossier WhatsApp
El dossier NO es estático — el cliente requiere libertad total para mover, agregar y quitar secciones.

**Estructura de datos:**
```js
cfg.dossierSecciones = [
  { id: 'que',        label: 'QUÉ',                     activa: true,  orden: 1, tipo: 'conductas' },
  { id: 'cuando',     label: 'CUÁNDO',                  activa: true,  orden: 2, tipo: 'fecha_hora' },
  { id: 'donde',      label: 'DÓNDE',                   activa: true,  orden: 3, tipo: 'lugar' },
  { id: 'quien',      label: 'QUIÉN',                   activa: true,  orden: 4, tipo: 'capturado' },
  { id: 'como',       label: 'CÓMO',                    activa: true,  orden: 5, tipo: 'narracion' },
  { id: 'victima',    label: 'VÍCTIMA',                 activa: true,  orden: 6, tipo: 'victima' },
  { id: 'disposicion',label: 'ES DEJADO A DISPOSICIÓN', activa: true,  orden: 7, tipo: 'despacho' },
  { id: 'conocieron', label: 'Conocieron el caso',      activa: true,  orden: 8, tipo: 'conocieron' },
  { id: 'verde3',     label: 'VERDE 3',                 activa: true,  orden: 9, tipo: 'verde3' },
  { id: 'diamante3',  label: 'DIAMANTE 3',              activa: true,  orden: 10, tipo: 'diamante3' }
]
```

**`genDossier(caso)`** debe iterar `cfg.dossierSecciones` ordenadas por `orden`, incluyendo solo las `activa === true`.

**UI en `screen-dossier` (nueva zona 0 — colapsable "Editar secciones"):**
- Lista de secciones con toggle ON/OFF por sección
- Botones ▲ ▼ para reordenar
- Botón "＋ Agregar sección personalizada" → ingresa `label` + `tipo: 'texto_fijo'` con campo de texto libre
- Botón "Restaurar por defecto" (reset a la config original)
- Los cambios se guardan en `cfg.dossierSecciones` automáticamente al modificar

### Paso 7 — Verificar
Ejecuta `/run`, selecciona un caso guardado y verifica:
- Dossier WA se genera con encabezado correcto (CORONEL / DISTRITO TRES / CANDELARIA)
- Saludo cambia según hora actual
- Botones de descarga docx funcionan
- Botón compartir WA abre correctamente sin doble disparo

---

### Paso 8 — Verificar legacy (renombrado desde Paso 6)
Ejecuta `/run`, selecciona un caso guardado y verifica:
- Dossier WA se genera con encabezado correcto (CORONEL / DISTRITO TRES / CANDELARIA)
- Saludo cambia según hora actual
- Botones de descarga docx funcionan
- Botón compartir WA abre correctamente sin doble disparo

---

## Criterios de éxito
- [ ] Dossier WA se genera correctamente para casos URI, CESPA y OJ
- [ ] Saludo automático funciona según hora del día
- [ ] 3 campos granulares (rangoComandante, numDistrito, nombreEstacion) funcionan
- [ ] cfg.conocieronCaso funciona (renombrado desde dosConocidoPor)
- [ ] Labels de VERDE 3 y DIAMANTE 3 son descriptivos
- [ ] Localidad/zona/vereda son editables (no hardcodeadas)
- [ ] NUNC empieza vacío por defecto
- [ ] "Recibe: [fiscal]" NO aparece en dossier URI/CESPA (solo OJ)
- [ ] Editor de secciones del dossier: toggle ON/OFF y reordenar funcionan
- [ ] genDossier() itera cfg.dossierSecciones respetando orden y activa

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
