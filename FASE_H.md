# FASE H — Revisión Final, Polish y Release Candidate

## Estado
- [x] **COMPLETADA — 2026-06-16**

## Capacidad estimada: LIGERA-MEDIA (~20-25 mensajes · cómodo en ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/code-review ultra` `/simplify` `/security-review` `/verify`  
**Prerequisito:** Fases A–G todas completadas

---

## Objetivo
Revisión técnica profunda, limpieza de código, auditoría de seguridad final y preparación del Release Candidate v8.0. Al terminar esta fase, LexCapture_v8.html está listo para uso en campo real.

---

## Instrucciones de ejecución

### Paso 1 — Code review profundo
Ejecutar `/code-review ultra` sobre `LexCapture_v8.html`. Aplicar todos los hallazgos clasificados como:
- **Bugs de correctitud** — aplicar inmediatamente
- **Reutilización/simplificación** — aplicar si no rompe funcionalidad
- Ignorar sugerencias de refactoring que impliquen cambiar la arquitectura de archivo único

### Paso 2 — Simplificación
Ejecutar `/simplify` sobre el diff acumulado de las fases anteriores. Específicamente:
- Reducir funciones `rStep1()` a `rStep7()` si tienen patrones repetidos
- Consolidar funciones de generación de docx si hay duplicaciones
- Remover CSS no usado
- Consolidar event listeners duplicados

### Paso 3 — Checklist pre-producción
Verificar manualmente cada item:

**Funcionalidad core:**
- [ ] Wizard URI crea caso, genera FPJ-5 .docx correcto
- [ ] Wizard CESPA usa "aprehendido" en todo el documento
- [ ] Wizard OJ genera oficio disposición Fiscalía y Juzgado
- [ ] Dossier WA se genera con todos los campos
- [ ] Acta de Derechos se genera correctamente (sin firma digital — se imprime y firma a mano)
- [ ] Motor de plantillas OJ: genDocOJ() genera .docx con datos regionales correctos
- [ ] Dashboard muestra estadísticas correctas

**Seguridad:**
- [ ] localStorage cifrado (lc_cases, lc_persons en AES-GCM)
- [ ] Ningún dato sensible en texto claro
- [ ] Exportación de config no incluye datos de capturas

**Offline:**
- [ ] Service Worker activo
- [ ] App funciona 100% sin conexión

**Legal/compliance:**
- [ ] Fecha FPJ-5 en 3 celdas separadas (día/mes/año)
- [ ] Cálculo tiempo captura→disposición alerta si >36h
- [ ] 7 derechos del capturado (Ley 906/2004) en el Acta
- [ ] Lenguaje diferenciado URI (capturado) vs CESPA (aprehendido)

**UX en campo:**
- [ ] Bottom nav funciona en pantalla de 5" (móvil pequeño)
- [ ] Sin debug bar ni elementos de desarrollo visibles
- [ ] Textos legibles con luz solar (contraste suficiente)
- [ ] FAB visible y accesible con el pulgar

### Paso 4 — Auditoría de seguridad final
Ejecutar `/security-review`. Todos los issues CRÍTICOS y ALTOS deben estar resueltos antes del release.

### Paso 5 — Actualizar versión y metadatos
En LexCapture_v8.html:
- Título: "LexCapture v8.0 — Gestión de Capturas"
- Meta description: "Aplicación para gestión de capturas - Policía Nacional de Colombia"
- Comentario en `<head>`: `<!-- LexCapture v8.0 | Auditoría: 2026-06-14 | Release: [fecha] -->`
- En Ajustes → Info: mostrar versión "v8.0 RC" y fecha de release

### Paso 6 — Verificar golden path completo
Ejecuta `/verify` con el golden path completo:
1. Configurar PIN → confirmar cifrado activo
2. Configurar estación (rangoComandante, numDistrito, nombreEstacion)
3. Agregar perfil de funcionario
4. Crear captura URI (wizard completo, 7 steps)
5. Generar FPJ-5 URI .docx → verificar campos correctos (fecha en 3 celdas)
6. Generar Acta de Derechos .docx → verificar que se descarga limpia para firmar a mano
6b. Crear captura OJ → generar desde plantilla subida → verificar datos regionales correctos
7. Generar dossier WA → verificar encabezado, saludo automático y secciones configuradas
8. Compartir por WA → sin doble disparo
9. Ver estadísticas en Dashboard
10. Modo offline → repetir pasos 4-8 sin conexión

### Paso 7 — Backup y entrega
- Copiar `LexCapture_v8.html` como `LexCapture_v8.0_RC.html` (backup del RC)
- Documentar en CLAUDE.md los issues pendientes para v8.1 (si los hay)

---

## Criterios de éxito
- [ ] /code-review ultra: todos los bugs de correctitud corregidos
- [ ] /security-review: sin issues CRÍTICOS ni ALTOS sin resolver
- [ ] Golden path completo funciona offline y online
- [ ] Versión actualizada a v8.0 en la app y CLAUDE.md
- [ ] Backup RC guardado

---

## ⚠️ AVISO LEGAL
La app **solo debe usarse en operativos reales** una vez completadas esta fase y las fases C1 (cifrado) y C2 (offline). Los datos de capturados tienen protección especial bajo Ley 1581/2012. Las firmas digitales NO aplican — los documentos se imprimen y firman a mano.

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
