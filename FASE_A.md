# FASE A — Shell Unificado + CLAUDE.md

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: LIGERA (~20-25 mensajes · bien dentro de ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/init` `/run` `/verify`  
**Prerequisito:** Ninguno — primera fase

---

## Objetivo
Crear `LexCapture_v8.html` como archivo base con el sistema de diseño del Esqueleto transplantado y la navegación funcional. Sin lógica aún — solo el shell visual completo.

---

## Instrucciones de ejecución

### Paso 1 — Leer archivos de referencia
- Lee `Esqueleto.html` completo: extrae TODO el CSS (variables, componentes, animaciones), la función `go()` de navegación, y la estructura HTML de las pantallas y la bottom nav.
- NO leas Motor.html aún — no se necesita en esta fase.

### Paso 2 — Crear LexCapture_v8.html
Crea `LexCapture_v8.html` con:

**CSS (del Esqueleto, sin cambios):**
- Variables CSS: `--bg`, `--flag` (#d97706), `--oj` (#9333ea), `--accent` (#3b82f6), `--ok`, `--err`
- Todos los componentes: cards, badges, pills, bottom-nav, sidebar-desktop, sheets, FAB, toasts, animaciones

**HTML base:**
- `<head>` con meta tags PWA: `apple-mobile-web-app-capable`, `theme-color: #d97706`, viewport
- Bottom nav con 5 tabs: Capturas (🏠), Nueva (➕), Estadísticas (📊), Dossier (📋), Más (⋯)
- Sidebar desktop (visible ≥900px) con los mismos 5 items
- FAB (+) visible en pantalla Capturas
- 8 screens vacías con sus IDs exactos:
  - `screen-capturas` — muestra: `<p>Cargando capturas…</p>` como placeholder
  - `screen-nueva` — muestra: `<p>Flujo de nueva captura — Fase B</p>`
  - `screen-estadisticas` — muestra: `<p>Dashboard — Fase B</p>`
  - `screen-dossier` — muestra: `<p>Dossier — Fase C</p>`
  - `screen-perfil` — muestra: `<p>Perfil — Fase D</p>`
  - `screen-despachos` — muestra: `<p>Despachos — Fase D</p>`
  - `screen-plantillas` — muestra: `<p>Plantillas .docx — disponible en v8</p>`
  - `screen-ajustes` — muestra: `<p>Ajustes — Fase D</p>`

**JS base:**
- Función `go(screenId)` que navega entre screens (oculta todas, muestra la target)
- Función `showToast(msg, dur)` — toast visual en bottom
- Función `markActive(tab)` — actualiza estado activo en bottom nav y sidebar
- Evento DOMContentLoaded: inicializa con `go('capturas')`

### Paso 3 — Fix M5
Confirmar que el archivo nuevo NO tiene ninguna barra de debug (`#debug-bar`, elemento con versión hardcodeada visible, elemento de reloj).

### Paso 4 — Crear CLAUDE.md si no existe
Ejecuta `/init` para documentar el proyecto. Si ya existe CLAUDE.md en el directorio, saltear este paso.

### Paso 5 — Verificar
Ejecuta `/run` para abrir en navegador. Confirma que:
- La bottom nav navega entre screens sin errores en consola
- El FAB es visible
- Las 8 screens muestran sus placeholders
- El diseño visual es idéntico al Esqueleto (colores, fuentes, glassmorphism)

---

## Criterios de éxito
- [ ] `LexCapture_v8.html` existe y abre en el navegador sin errores JS en consola
- [ ] Navegación entre las 8 screens funciona via bottom nav y sidebar
- [ ] FAB visible y clickable (puede mostrar toast "Nueva captura — Fase B")
- [ ] Sin debug bar visible
- [ ] Diseño visual idéntico al Esqueleto.html (paleta ámbar/púrpura)
- [ ] Meta tags PWA presentes en `<head>`

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
