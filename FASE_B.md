# FASE B — Wizard Completo + Lista de Capturas + Simulador

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: PESADA (~40-45 mensajes · ajustado para ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/verify` `/run`  
**Prerequisito:** Fase A completada — `LexCapture_v8.html` existe

---

## Objetivo
Integrar el wizard de 7 pasos del Motor en v8, activar la lista de capturas real con filtros, implementar el simulador de casos ficticios con selección de tipo (Flagrancia URI/CESPA u Orden Judicial), y corregir los bugs A5, M3 y M4.

---

## Instrucciones de ejecución

### Estrategia de lectura (Motor.html es 1.1MB — leer por secciones)
En lugar de leer Motor.html completo, usa Grep para localizar y luego Read con offset/limit:
1. Busca `function collectStep` para encontrar el wizard
2. Busca `function renderCases` para la lista
3. Busca `function startNewCase` para el flujo de inicio
4. Busca `TPL_URI` y `TPL_CESPA` para las plantillas docx (son bases64 largas — solo necesitas las variables, no su contenido)
5. Busca `DB.saveCase` y `DB.getCases` para la capa de datos

### Paso 1 — Capa de datos
Extrae del Motor y agrega a `LexCapture_v8.html` el objeto `DB` completo con:
- `DB.getCases()` — lee `lc_cases` de localStorage
- `DB.saveCase(c)` — guarda caso (sin cifrado aún — eso es Fase E)
- `DB.getCase(id)` — obtiene un caso por id
- `DB.deleteCase(id)` — elimina caso
- `DB.getPersons()` / `DB.savePerson(p)` / `DB.getPersons()`
- `DB.getConfig()` / `DB.saveConfig(cfg)` — con defaults completos
- Función `genId()` — genera IDs únicos

### Paso 2 — Screen Capturas con lista real
En `screen-capturas`, implementar:
- Header con contador "X capturas"
- 3 filter tabs: Todas | Flagrancia | Orden Judicial
- Función `renderCases(filter)` que muestra cards por caso:
  - Icono y color según tipo (URI=ámbar, CESPA=naranja, OJ=púrpura)
  - Nombre del capturado + tipo de captura
  - Fecha y estado
  - Botón acciones (dossier, editar, eliminar)
- Empty state cuando no hay casos: ilustración + "Sin capturas aún" + botón crear
- FAB llama a `go('nueva')`

### Paso 3 — Screen Nueva Captura (selector de tipo)
En `screen-nueva`, implementar el selector inicial:
- Opción 1: "Flagrancia URI" (adultos → ámbar)
- Opción 2: "Flagrancia CESPA" (menores → naranja)
- Opción 3: "Orden Judicial" (púrpura)
- Botón "Volver" (back a capturas)
- Cada opción llama a `startWizard(tipo)`

### Paso 4 — Wizard 7 pasos (del Motor, rediseñado con CSS v8)
Extraer la lógica del wizard del Motor y rediseñarla con el CSS de v8:
- **Step 1 (URI/CESPA):** NUNC, SPOA, Incidente, Despacho, fecha/hora captura, fecha/hora disposición, conductas (hasta 4)
- **Step 2:** Lugar de los hechos (dirección, barrio, municipio, departamento)
  - Al escribir/seleccionar `municipio`: auto-rellenar `departamento` desde el perfil regional activo (`cfg.perfilesRegionales[cfg.perfilRegionalActivo].departamento`). Si no hay perfil activo, el campo queda editable manualmente.
- **Step 3:** Datos del capturado/aprehendido (campos completos + cámara cédula)
- **Step 4:** Víctima(s) — con opción "Sin víctima directa"
- **Step 5:** Testigo(s) — con opción "Sin testigo"
- **Step 6:** Narración + EMP/EF + cálculo automático tiempo captura→disposición (alerta si >36h)
- **Step 7:** Resumen + botones Guardar / Generar documentos
- Para OJ: adaptar steps con campos de orden judicial

Barra de progreso visual en la parte superior del wizard.

### Paso 5 — Simulador de casos ficticios (Demo Mode)

Extraer el objeto `SIM` de Motor.html (líneas 1562–1618) y enriquecerlo con soporte para Orden Judicial. Agregar la UI de elección al final de `screen-nueva`.

**Fuente en Motor.html:** buscar `// ── SIMULADOR ──` con Grep, leer con Read desde esa línea. El objeto `SIM` incluye pools de nombres, apellidos, conductas, barrios, fiscales, ocupaciones, elementos de prueba y plantillas de narración — trasplantar completo.

**Ampliar `SIM` con pools para OJ:**
```js
OJ_DELITOS: ['Homicidio agravado', 'Hurto agravado con violencia', 'Concierto para delinquir',
             'Tráfico de estupefacientes agravado', 'Extorsión agravada', 'Receptación agravada']
OJ_JUZGADOS: ['Juzgado Tercero Penal Municipal con F.C.G. de Medellín',
              'Juzgado Décimo Penal Municipal con F.C.G. de Medellín',
              'Juzgado Vigésimo Quinto Penal Municipal con F.C.G. de Medellín',
              'Juzgado Vigésimo Noveno Penal Municipal con F.C.G. de Medellín']
OJ_AUTORIDAD: ['Fiscal 10 — Sección Vida', 'Fiscal 28 — Sección Patrimonio',
               'Fiscal 45 — Sección Estupefacientes']
OJ_TPL: 'El día {f}, siendo las {h} horas, el suscrito {s}, en cumplimiento de Orden de Captura N° {on} proferida por el {jz}, por el delito de {d}, procedió a la aprehensión de {c} identificado con CC {doc} expedida en Medellín. La persona fue informada de sus derechos constitucionales conforme al artículo 303 de la Ley 906 de 2004.'
```

**Funciones:**
- `SIM.genFlagrancia(subtipo)` — genera caso URI o CESPA según `subtipo`. URI: capturado adulto (CC), narración Flagrancia. CESPA: capturado menor (TI, año nac. 2008-2010), usa "aprehendido" y "CESPA" como destino. Migrada de `SIM.gen()` original.
- `SIM.genOJ()` — genera caso tipo `'OJ'` con: `numOrden` (formato `XXX-XXXX`), `juzgadoOrden`, `delitoOrden`, `fechaOrden`, `autoridadSolicita`, `destinoOJ: 'FISCALIA_URI'`, capturado adulto, `sinVictima: true`, narración del plantilla `OJ_TPL`.
- `runSimDemo(tipo)` — recibe `'flagrancia-uri'`, `'flagrancia-cespa'` u `'oj'`; llama a la función correspondiente, almacena en `window._simCase` y renderiza la preview.
- `simSavePending()` — guarda `window._simCase` en DB (personas + caso).
- `simEditPending()` — guarda el caso y abre el wizard (`startWizard`) precargado con los datos del caso demo.

**UI — agregar al final de `screen-nueva`, separado de los tipos reales:**
```html
<div class="sim-section">
  <div class="sim-divider">— MODO DEMO —</div>
  <button class="btn bs bbl" onclick="openSimSheet()">
    🎲 Generar caso ficticio
    <div class="txs txd" style="margin-top:4px;font-weight:400">Para verificar funcionalidad de la app</div>
  </button>
</div>
```

Al hacer clic, muestra un bottom sheet con 3 opciones:
- 🟠 **Flagrancia URI** (color `--flag`) → `runSimDemo('flagrancia-uri')`
- 🔴 **Flagrancia CESPA** (color `#f97316`) → `runSimDemo('flagrancia-cespa')`
- 🟣 **Orden Judicial** (color `--oj`) → `runSimDemo('oj')`

**Preview card (reemplaza al bottom sheet tras generar):**
```html
<div class="simr">   <!-- .simr ya existe en Motor.html CSS líneas 417-421, trasplantar al bloque CSS v8 -->
  <h3>[URI / CESPA / OJ] — [conducta o delito]</h3>
  <div class="txs txd">📅 [DD/MM/AAAA] · 🕐 [HH:MM]</div>
  <div class="txs txd">📍 [dirección], [barrio]</div>
  <div class="txs">👤 Cap: [nombre completo] — [CC/TI]: [número]</div>
  <div class="txs txd" style="max-height:80px;overflow-y:auto">[primeros 220 chars de narración]…</div>
</div>
<div class="flx g8" style="flex-wrap:wrap">
  <button class="btn bp bsm" onclick="simSavePending()">💾 Guardar</button>
  <button class="btn bs bsm" onclick="simEditPending()">✏ Editar en wizard</button>
  <button class="btn bs bsm" onclick="openSimSheet()">🔄 Otro</button>
  <!-- Botón Ver Dossier WA se agrega en Fase C -->
</div>
```

**Notas de implementación:**
- Casos demo se marcan con `isTest: true`; en `screen-capturas` mostrar badge 🧪 junto al tipo.
- El CSS de `.simr` ya existe en Motor.html — trasplantar al bloque CSS de v8 junto a `.sim-section` y `.sim-divider` (línea divisoria gris, texto centrado, font-size .75rem).
- El botón "Ver Dossier WA" queda pendiente para Fase C; puede incluirse deshabilitado con `disabled` y `title="Disponible en Fase C"`.

### Paso 6 — Fixes de bugs
**Fix A5 — Fecha en FPJ-5:** Al preparar datos para el template .docx, dividir `fechaProc` en 3 campos: `fechaDia`, `fechaMes`, `fechaAno` (ej: "14", "06", "2026") para llenar las 3 celdas separadas del formulario oficial.

**Fix M3 — Validación NUNC:** Campo NUNC con `pattern="\d{16}"` + maxlength="16" + mensaje de error visual "El NUNC debe tener exactamente 16 dígitos".

**Fix M4 — WhatsApp doble disparo:** La función `shareDosWA()` debe usar ÚNICAMENTE `navigator.share()` como primario y `https://wa.me/?text=...` como fallback. Eliminar el esquema `whatsapp://` que causa el doble disparo.

### Paso 7 — Verificar
Ejecuta `/verify` confirmando:
- Crear captura URI completa (wizard 7 steps)
- Captura se muestra en la lista con filtros funcionando
- Barra de progreso del wizard avanza correctamente
- Validación NUNC rechaza menos de 16 dígitos
- Simulador: generar un caso OJ → badge 🟣 OJ en preview → "Guardar" → aparece en lista con 🧪
- Simulador: generar un caso CESPA → "Editar en wizard" → wizard abre con datos precargados y tipo CESPA

---

## Criterios de éxito
- [ ] Lista de capturas renderiza casos reales del localStorage
- [ ] Filtros Todas/Flagrancia/OJ funcionan
- [ ] Wizard completo crea y guarda un caso en localStorage
- [ ] Fecha FPJ-5 se divide en 3 campos (día/mes/año)
- [ ] NUNC valida exactamente 16 dígitos con mensaje de error
- [ ] WhatsApp usa solo un mecanismo de apertura (sin doble disparo)
- [ ] Simulador genera casos Flagrancia URI, CESPA y OJ correctamente
- [ ] Botón elegir tipo (sheet con 3 opciones) aparece al final de `screen-nueva`
- [ ] Preview del caso demo muestra tipo, conducta, capturado, lugar y narración
- [ ] "Guardar" persiste el caso en localStorage con `isTest: true`
- [ ] "Editar en wizard" abre el wizard precargado con los datos del caso demo
- [ ] Casos demo muestran badge 🧪 en la lista de capturas

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
