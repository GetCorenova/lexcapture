# FASE D — Multi-Perfil + Despachos + Ajustes Completos

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: MEDIA-ALTA (~30-35 mensajes · cómodo en ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/verify` `/run`  
**Prerequisito:** Fase C completada — dossier funcional

---

## Objetivo
Implementar multi-perfil de funcionario, módulo de Despachos con fiscalías/juzgados de Medellín precargados, y la pantalla Ajustes completa migrada de modal a screen. Corregir bugs A3, A4, M2.

---

## Instrucciones de ejecución

### Paso 1 — Multi-perfil de funcionario (Fix A3)
Reemplazar el perfil único de funcionario por un sistema de perfiles:

**Estructura de datos:**
```js
cfg.perfiles = [
  { id: "p1", nombre: "Juan Carlos Martínez López", grado: "Subteniente", 
    cedula: "1234567890", cargo: "Comandante de Cuadrante", 
    telefono: "3001234567", correo: "jcmartinez@policia.gov.co" }
]
cfg.perfilActivo = "p1"  // id del perfil en uso
```

**En screen-perfil:**
- Lista de perfiles guardados (cards con nombre, grado, cargo)
- Botón "Perfil activo" — el perfil marcado como activo se usa en el wizard y dossier
- Botón "Agregar perfil" — formulario para nuevo perfil
- Botón "Editar" en cada card
- Botón "Eliminar" en cada card (protegido: no eliminar el último)
- El Step 7 del wizard (servidor que efectúa la captura) lee `cfg.perfiles[cfg.perfilActivo]` como default, pero permite editar para ese caso específico

### Paso 2 — Módulo Despachos (Fix A4)
Implementar `screen-despachos` con:

**15 fiscalías y juzgados de Medellín precargados:**
```js
const DESPACHOS_MEDELLIN = [
  // FISCALÍA
  { id:'f1', tipo:'Fiscalía', nombre:'URI Centro — Sede Caribe', direccion:'Cra 56 #42-70, Medellín', telefono:'(604) 444 0000' },
  { id:'f2', tipo:'Fiscalía', nombre:'URI Robledo', direccion:'Cll 69 #90-30, Medellín', telefono:'' },
  { id:'f3', tipo:'Fiscalía', nombre:'URI La Candelaria', direccion:'Cll 44 #52-165, Medellín', telefono:'' },
  // CESPA
  { id:'c1', tipo:'CESPA', nombre:'Centro de Servicios Judiciales para Adolescentes', direccion:'Cra 55 #41-73, Medellín', telefono:'' },
  // JUZGADOS (Palacio de Justicia de Medellín)
  { id:'j1', tipo:'Juzgado', nombre:'Juzgado Primero Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j2', tipo:'Juzgado', nombre:'Juzgado Tercero Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j5', tipo:'Juzgado', nombre:'Juzgado Quinto Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j10', tipo:'Juzgado', nombre:'Juzgado Décimo Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j15', tipo:'Juzgado', nombre:'Juzgado Décimo Quinto Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j20', tipo:'Juzgado', nombre:'Juzgado Vigésimo Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j25', tipo:'Juzgado', nombre:'Juzgado Vigésimo Quinto Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j29', tipo:'Juzgado', nombre:'Juzgado Vigésimo Noveno Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  { id:'j30', tipo:'Juzgado', nombre:'Juzgado Trigésimo Penal Municipal con Función de Control de Garantías de Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  // GUARDIA NOCTURNA
  { id:'gn1', tipo:'Guardia', nombre:'Juzgado de Guardia — Turno Nocturno Medellín', direccion:'Palacio de Justicia, Cll 44 #52-165', telefono:'' },
  // PERSONALIZADO
  { id:'custom', tipo:'Otro', nombre:'Otro (escribir manualmente)', direccion:'', telefono:'' }
]
```

**UI de screen-despachos:**
- Tabs: Fiscalías | CESPA | Juzgados | Favoritos
- Cards por despacho: nombre, dirección, teléfono, botón "⭐ Favorito", botón "Usar"
- "Usar" llena el campo despacho en el wizard y navega de regreso
- Sistema de favoritos: `cfg.despachosFavoritos = ['f1', 'j29']`
- Buscador rápido (filtro por texto en nombres)

**En el wizard Step 1:** el campo de despacho pasa a ser un datalist con los nombres de `DESPACHOS_MEDELLIN`, o un botón "Elegir de lista" que abre screen-despachos como selector.

### Paso 3 — Fix M2 — Artículo del Código Penal
En Step 1 del wizard, sección de conductas, agregar junto a cada conducta:
- Campo `articuloCP` — texto corto, ej: "Art. 239" / "Art. 365"
- Placeholder: "Art. 239 (hurto)"
- Opcional pero recomendado — no bloquear guardado si está vacío
- Se incluye en el FPJ-5 generado al lado del nombre de la conducta

### Paso 4 — Screen Ajustes completa (migrar de modal)
Migrar `openSettings()` de modal popup a `screen-ajustes` completa:

**Secciones en screen-ajustes:**
1. **Estación** — rangoComandante, numDistrito, nombreEstacion, dosDir, dosTel
2. **Dossier** — conocieronCaso, dosVerde3, dosDiamante3, destUri, destCespa
3. **Defaults** — nuncUri, nuncCespa, localidadDefault, zonaDefault
4. **Exportar/Importar** — exportar config a JSON, importar desde JSON
5. **Datos** — exportar todas las capturas, importar capturas, limpiar datos (con confirmación)
6. **Info** — versión app, fecha auditoría, créditos
7. **Perfiles Regionales** — el sistema está pensado para funcionar en cualquier parte de Colombia; cada región tiene datos distintos. Este módulo permite guardar uno o más perfiles de zona y activar el que corresponda según dónde se esté trabajando.

   **Estructura de datos:**
   ```js
   cfg.perfilesRegionales = [
     {
       id: 'r1',
       nombre: 'Medellín',
       departamento: 'Antioquia',
       municipio: 'Medellín',
       nuncUri:   '050016001250',   // primeros dígitos del NUNC URI en esta región
       nuncCespa: '050016001250',   // primeros dígitos del NUNC CESPA en esta región
       uriDestino:  'URI Centro — Sede Caribe',
       cespaDestino: 'CESPA Medellín',
       localidadDefault: '10',
       zonaDefault: 'Urbana'
     }
   ]
   cfg.perfilRegionalActivo = 'r1'   // id del perfil en uso
   ```

   **UI del módulo Perfiles Regionales:**
   - Lista de perfiles: card con nombre, departamento, municipio, badge "ACTIVO" si es el activo
   - Botón "Activar" — al activar un perfil: propaga todos sus valores a los defaults del sistema (nuncUri, nuncCespa, localidadDefault, zonaDefault, uriDestino, cespaDestino). Toast: "Perfil [nombre] activado — datos de [departamento] aplicados."
   - Botón "Agregar perfil" — formulario con todos los campos del objeto
   - Botón "Editar" / "Eliminar" en cada card (protegido: no eliminar el último)
   - **Importante:** el campo `departamento` del perfil es el que usa el wizard para el auto-fill de Departamento cuando se elige Municipio (Fix de Fase B)

### Paso 5 — Verificar
Ejecuta `/verify` comprobando:
- Agregar 2 perfiles y cambiar entre ellos — el wizard usa el activo
- Marcar favoritos en despachos y que aparezcan en tab Favoritos
- Buscar "URI" en despachos y filtrar correctamente
- Ajustes guarda y los cambios persisten al recargar

---

## Criterios de éxito
- [ ] Multi-perfil funciona: crear, editar, eliminar, seleccionar activo
- [ ] Wizard usa datos del perfil activo en Step 7
- [ ] 15+ despachos de Medellín precargados y navegables
- [ ] Sistema de favoritos en despachos funciona
- [ ] Campo artículo CP aparece en cada conducta del wizard
- [ ] Screen Ajustes completa (no modal) con todas las secciones
- [ ] Módulo Perfiles Regionales: crear, activar y eliminar perfiles
- [ ] Al activar perfil regional: defaults del sistema se actualizan (nunc, localidad, zona, despachos)

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
