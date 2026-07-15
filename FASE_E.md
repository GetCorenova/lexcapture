# FASE E — Cifrado AES-GCM Automático + Auditoría de Seguridad

## Estado
- [ ] Pendiente → cambiar a [x] cuando esté completa

## Capacidad estimada: MEDIA (~20-25 mensajes · cómodo en ventana 5h)
**Modelo:** claude-sonnet-4-6  
**Skills:** `/security-review` `/verify`  
**Prerequisito:** Fase D completada

---

## Objetivo
Activar el cifrado AES-GCM automático en localStorage para todos los datos sensibles (Fix C1). Implementar flujo de clave maestra. Ejecutar auditoría de seguridad al terminar.

---

## Instrucciones de ejecución

### Paso 1 — Extraer funciones de cifrado del Motor
El Motor.html ya tiene `encryptData()` y `decryptData()` implementadas con AES-GCM. Localízalas con Grep (`function encryptData` o `function decryptData`) y extrae el código completo.

### Paso 2 — Clave maestra (primera ejecución)
Implementar flujo de configuración de clave:
- En el primer uso (cuando no existe `lc_key_hash` en localStorage), mostrar modal de "Configurar PIN de seguridad":
  - Campo: "PIN (mínimo 6 dígitos)" + confirmación
  - El PIN se usa para derivar la clave AES via PBKDF2: `crypto.subtle.importKey` + `crypto.subtle.deriveKey`
  - Solo se guarda el hash del PIN (para verificación), nunca el PIN en texto claro
  - La clave derivada se mantiene en memoria (variable JS) — se pide el PIN cada sesión
- Modal de "Ingresar PIN" al abrir la app si ya fue configurado

### Paso 3 — Cifrado automático en todas las operaciones DB
Modificar el objeto `DB` para cifrar/descifrar automáticamente:

```js
// ANTES (Fase B):
DB.saveCase(c) { localStorage.setItem('lc_cases', JSON.stringify(getCases())) }

// DESPUÉS (Fase E):
DB.saveCase(c) { 
  const data = JSON.stringify(getCases())
  const encrypted = await encryptData(data, sessionKey)
  localStorage.setItem('lc_cases', encrypted)
}
```

Aplicar a: `lc_cases`, `lc_persons`. NO cifrar `lc_cfg` (la config no es sensible y se necesita sin PIN para mostrar nombre de estación etc.).

### Paso 4 — Exportación segura de config
La función de exportar config en Ajustes debe:
- Excluir automáticamente datos de capturas y personas del export
- Mostrar aviso: "Esta config puede contener datos del funcionario — comparte solo por canales oficiales"
- NO exportar `lc_cases` ni `lc_persons` cifradas

### Paso 5 — Pantalla de bienvenida con PIN
Al iniciar la app:
- Si no hay clave configurada → mostrar pantalla "Configurar seguridad" (Step 2)
- Si hay clave configurada → mostrar pantalla "Ingresar PIN" antes de acceder a datos
- Si el usuario cancela el PIN → la app funciona pero los datos cifrados no son accesibles (mostrar "Ingresa tu PIN para acceder a las capturas")
- Botón "Olvidé mi PIN" → RESET TOTAL (borrar todo y empezar de nuevo, con confirmación doble)

### Paso 6 — Ejecutar /security-review
Ejecutar `/security-review` sobre los cambios de esta fase. Revisar los hallazgos y corregir los críticos antes de marcar la fase como completa.

### Paso 7 — Verificar
Ejecuta `/verify`:
- Crear captura → verificar en DevTools (Application → localStorage) que `lc_cases` está cifrado (no texto legible)
- Recargar app → pedir PIN → descifrar y mostrar capturas
- Verificar que config (`lc_cfg`) sigue legible (no cifrada)

---

## Criterios de éxito
- [ ] `lc_cases` en localStorage contiene datos cifrados (no JSON en texto claro)
- [ ] `lc_persons` en localStorage contiene datos cifrados
- [ ] `lc_cfg` NO está cifrado (config legible)
- [ ] Flujo de configuración de PIN funciona en primera ejecución
- [ ] Flujo de ingreso de PIN funciona en ejecuciones siguientes
- [ ] /security-review no reporta issues CRÍTICOS sin corregir
- [ ] La exportación de config no incluye datos de capturas ni personas

---

## Instrucciones adicionales del usuario
<!-- El Panel de Comandos de la auditoría agrega comandos aquí automáticamente -->

---

## Notas
_Espacio para notas del usuario_
