---
name: security-review
description: Auditoría de seguridad del código. Detecta datos sensibles expuestos, fallos de cifrado y vulnerabilidades en localStorage. CRÍTICO para LexCapture — maneja datos biométricos, documentos de identidad y datos penales de capturados.
---

# /security-review — LexCapture

Ejecuta una revisión completa de seguridad del código modificado en la rama actual.

## Uso en este proyecto
```
/security-review
```

## Por qué es crítica aquí
LexCapture almacena datos penales de ciudadanos (documentos de identidad, biometría, información de capturados y víctimas). Cualquier vulnerabilidad viola la **Ley 1581 de Habeas Data de Colombia** y compromete investigaciones activas.

## Qué revisa en LexCapture
- `DB.saveCase()` y `DB.savePerson()` — cifrado AES-GCM activo
- localStorage — sin datos en texto claro
- Exportación de archivos — sin filtración de datos sensibles
- Comunicación WhatsApp — sin leakage de información

## Cuándo ejecutar
- **SIEMPRE antes de cada deploy o entrega de fase**
- Obligatorio al terminar la **Fase E (Cifrado)**
- Revisión final en **Fase H**

## Issue que resuelve
- **C1**: localStorage sin cifrado por defecto
