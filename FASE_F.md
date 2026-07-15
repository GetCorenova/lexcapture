# FASE F — Motor de Plantillas Judiciales (Orden Judicial)

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: MEDIA (~25-30 mensajes · cómodo en ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/verify` `/run`  
**Prerequisito:** Fase D completada — los perfiles regionales deben existir antes de la inyección de datos

---

## Objetivo
Implementar `screen-plantillas` como motor de carga y gestión de plantillas para capturas por Orden Judicial (OJ). El administrador sube el documento Word oficial vigente; el sistema lo usa como esqueleto y genera el documento final inyectando automáticamente los datos del procedimiento y del perfil regional activo, descartando cualquier dato de ejemplo del archivo original.

---

## Contexto clave — por qué este módulo existe (anotación del cliente)
- Los formatos OJ **no son fijos**: cambian en logos, encabezados y pies de página con el tiempo y por región.
- La información textual de los .docx de referencia es **solo de ejemplo** — lo crítico es la estructura/esqueleto.
- Un usuario puede subir una plantilla nacional con datos de Cali, pero si opera en Medellín, el sistema debe generar el documento con datos de Medellín automáticamente.
- Diferencia con flagrancia: en flagrancia el cuerpo es casi siempre el mismo (solo cambian campos configurables por zona). En OJ, el **formato completo puede mutar** → solución: inyección de datos sobre plantilla cargable.

---

## Instrucciones de ejecución

### Paso 1 — Agregar JSZip embebido
Los archivos .docx son ZIPs internamente (contienen `word/document.xml` en XML). Se necesita JSZip para leerlos y modificarlos en el navegador.

Busca con Grep en Motor.html si ya existe JSZip (`jszip` o `JSZip`). Si existe, extráelo al bloque `<script>` de LexCapture_v8.html. Si no existe, descarga la versión minificada de JSZip (jszip.min.js), conviértela a base64 e imbédala como script inline — misma estrategia que docx.js ya embebido en el Motor.

**Patrón de uso que se necesita:**
```js
// Abrir .docx
const zip = await JSZip.loadAsync(arrayBuffer)
const xmlContent = await zip.file('word/document.xml').async('string')
// modificar xmlContent
zip.file('word/document.xml', xmlContentModificado)
const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
```

### Paso 2 — Screen Plantillas (`screen-plantillas`)
Reemplazar el placeholder con la UI completa. La screen tiene 3 zonas:

**Zona 1 — Header:**
- Título "Plantillas Judiciales" + badge "OJ" (color púrpura)
- Subtítulo: "Sube el formato Word oficial vigente. El sistema inyectará los datos del procedimiento y de tu región automáticamente."
- Botón primary "📤 Subir plantilla"

**Zona 2 — Galería de plantillas guardadas:**
- Cards por plantilla:
  - Nombre descriptivo de la plantilla
  - Tipo: FPJ-5 OJ / Oficio de Disposición / Otro
  - Región de origen del archivo (ej: "Nacional", "Antioquia")
  - Fecha de subida
  - Badge "ACTIVA" si es la plantilla por defecto
  - Botones: "Establecer como activa" | "Ver campos" | "Eliminar"
- Empty state: "Sin plantillas — sube el formato Word oficial para habilitar las capturas por Orden Judicial"

**Zona 3 — Modal de carga (se abre con el botón Subir):**
- Input file: `accept=".docx"` — solo Word (PDF no editable, descartar)
- Campo "Nombre descriptivo" (ej: "FPJ-5 OJ Versión 2026 Nacional")
- Selector "Tipo": FPJ-5 OJ | Oficio Disposición | Otro
- Campo "Región de origen": texto libre o dropdown con departamentos colombianos
- Advertencia si el archivo supera 3MB: "El archivo es grande — puede afectar el rendimiento en campo"
- Botón "Cargar" / "Cancelar"

### Paso 3 — Almacenamiento en localStorage (`lc_templates`)
```js
// Estructura de cada plantilla guardada:
{
  id: genId(),
  nombre: "FPJ-5 OJ Versión 2026",
  tipo: "fpj5_oj",          // 'fpj5_oj' | 'oficio' | 'otro'
  regionOrigen: "Nacional",
  fechaSubida: "2026-06-15",
  activa: true,
  docxBase64: "..."         // el .docx completo codificado en base64
}
```

Agregar al objeto `DB`:
- `DB.getTemplates()` — lee `lc_templates`
- `DB.saveTemplate(t)` — guarda/actualiza plantilla
- `DB.deleteTemplate(id)` — elimina
- `DB.getActiveTemplate(tipo)` — retorna la plantilla activa del tipo dado

### Paso 4 — Motor de inyección de datos (`genDocOJ`)
```js
async function genDocOJ(caso, plantillaId) {
  const plantilla = plantillaId
    ? DB.getTemplate(plantillaId)
    : DB.getActiveTemplate('fpj5_oj')

  if (!plantilla) {
    showToast('Sin plantilla activa — ve a Plantillas y sube el formato oficial OJ')
    go('plantillas')
    return
  }

  // 1. Base64 → ArrayBuffer
  const raw = atob(plantilla.docxBase64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)

  // 2. JSZip: leer el .docx
  const zip = await JSZip.loadAsync(buf)
  let xml = await zip.file('word/document.xml').async('string')

  // 3. Normalizar runs XML (Word divide el texto en múltiples <w:r> — consolida para que los placeholders sean encontrables)
  xml = normalizeXmlRuns(xml)

  // 4. Obtener datos del perfil regional activo
  const reg = DB.getPerfilRegionalActivo() || {}
  const perfil = DB.getPerfilActivo() || {}
  const cfg = DB.getConfig()

  // 5. Mapa de sustituciones — placeholder → valor real
  const map = {
    '{{DEPARTAMENTO}}':       reg.departamento || '',
    '{{MUNICIPIO}}':          reg.municipio || '',
    '{{NUNC}}':               caso.nunc || '',
    '{{SPOA}}':               caso.spoa || '',
    '{{INCIDENTE}}':          caso.incidente || '',
    '{{FECHA_DIA}}':          caso.fechaDia || '',
    '{{FECHA_MES}}':          caso.fechaMes || '',
    '{{FECHA_ANO}}':          caso.fechaAno || '',
    '{{HORA_CAPTURA}}':       caso.horaCaptura || '',
    '{{NOMBRE_CAPTURADO}}':   caso.nombreCapturado || '',
    '{{DOC_CAPTURADO}}':      caso.docCapturado || '',
    '{{EDAD_CAPTURADO}}':     caso.edadCapturado || '',
    '{{CONDUCTAS}}':          (caso.conductas || []).join(', '),
    '{{NARRACION}}':          caso.narracion || '',
    '{{DESPACHO}}':           caso.despacho || '',
    '{{NOMBRE_FUNCIONARIO}}': perfil.nombre || '',
    '{{GRADO_FUNCIONARIO}}':  perfil.grado || '',
    '{{CEDULA_FUNCIONARIO}}': perfil.cedula || '',
    '{{ESTACION}}':           `ESTACIÓN DE POLICÍA ${cfg.nombreEstacion || ''}`,
    '{{DISTRITO}}':           `DISTRITO ${cfg.numDistrito || ''} DE POLICÍA`,
  }

  // 6. Aplicar sustituciones (XML-safe: escapar caracteres especiales en el valor)
  Object.entries(map).forEach(([key, val]) => {
    xml = xml.replaceAll(key, escapeXml(String(val)))
  })

  // 7. Reempaquetar y descargar
  zip.file('word/document.xml', xml)
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
  const fecha = `${caso.fechaDia}-${caso.fechaMes}-${caso.fechaAno}`
  downloadBlob(blob, `OJ_${caso.nombreCapturado}_${fecha}.docx`)
}
```

**Funciones auxiliares necesarias:**
```js
// Escapa caracteres XML en los valores inyectados
function escapeXml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Consolida runs XML adyacentes en el mismo párrafo para que los placeholders sean encontrables
// (Word a veces divide "{{NOMBRE" y "_CAPTURADO}}" en distintos <w:r>)
function normalizeXmlRuns(xml) {
  // Une el texto de <w:r> consecutivos dentro del mismo <w:p> si comparten el mismo rStyle
  // Implementar con regex o DOM parser según complejidad detectada en prueba real
  return xml // implementar en la fase si se detectan placeholders partidos
}
```

### Paso 5 — Visor de campos de la plantilla ("Ver campos")
Al hacer clic en "Ver campos" en una card de plantilla:
1. Decodificar el base64 → JSZip → extraer `word/document.xml`
2. Buscar todos los strings que coincidan con `\{\{[A-Z_]+\}\}` (regex)
3. Mostrar modal con la lista de placeholders detectados:
   - Campos reconocidos (color verde): `{{NUNC}}`, `{{DEPARTAMENTO}}`, etc.
   - Campos desconocidos (color amarillo): se muestran como "campo personalizado"
4. Ayuda al usuario a verificar que la plantilla está bien configurada antes de usarla en campo.

### Paso 6 — Integración con el wizard OJ (Step 7)
En el Step 7 del wizard cuando `tipo === 'OJ'`:
- Verificar: `const plantillaOJ = DB.getActiveTemplate('fpj5_oj')`
- **Si existe plantilla:** mostrar botón "📄 Generar OJ desde plantilla oficial" (primary) que llama `genDocOJ(caso)`. Debajo, texto pequeño: "Usando: [nombre de la plantilla]"
- **Si NO existe:** mostrar botón en estado secundario con texto "📤 Subir plantilla OJ primero" que navega a `go('plantillas')` y muestra toast explicativo
- Mantener el botón de generación genérica como fallback opcional para compatibilidad

### Paso 7 — Verificar
Ejecuta `/verify` con esta secuencia:
1. Crear un .docx de prueba en Word con el texto `{{NOMBRE_CAPTURADO}} de {{MUNICIPIO}}, {{DEPARTAMENTO}}`
2. Ir a Plantillas → subir ese .docx → establecer como activa
3. Crear captura OJ en el wizard (wizard completo con perfil regional "Medellín" activo)
4. En Step 7 → clic "Generar OJ desde plantilla oficial"
5. Abrir el .docx descargado → verificar que el texto fue reemplazado correctamente
6. Cambiar perfil regional a "Bogotá" → generar otro OJ → verificar que usa datos de Bogotá
7. Clic "Ver campos" en la plantilla → verificar que detecta `{{NOMBRE_CAPTURADO}}`, `{{MUNICIPIO}}`, `{{DEPARTAMENTO}}`

---

## Criterios de éxito
- [ ] Screen-plantillas permite subir, nombrar, activar y eliminar plantillas .docx
- [ ] La plantilla se almacena en localStorage (`lc_templates`) y persiste entre sesiones
- [ ] `genDocOJ()` descarga un .docx con los datos del caso y la región activa
- [ ] Si la plantilla contenía datos de ejemplo (ej: "Cali"), son reemplazados por los del perfil regional activo
- [ ] El wizard OJ detecta si hay plantilla activa y la usa; sin plantilla redirige a screen-plantillas
- [ ] "Ver campos" detecta y lista los placeholders `{{...}}` de la plantilla subida
- [ ] Si no hay plantilla: mensaje claro invita al usuario a subir el formato oficial

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
