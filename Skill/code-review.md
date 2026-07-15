---
name: code-review
description: Revisión profunda del código para correctitud, reutilización y eficiencia. El nivel "ultra" usa múltiples agentes en paralelo — ideal para analizar Motor.html de 2,121 líneas antes de la fusión.
---

# /code-review ultra — LexCapture

Revisión multi-agente a máxima profundidad. Analiza correctitud, reutilización y eficiencia.

## Uso en este proyecto
```
/code-review ultra
```

## Por qué "ultra" y no el nivel básico
Motor.html tiene **2,121 líneas** con:
- Funciones de 100+ líneas (rStep1 a rStep7)
- JS antiguo mezclado con ES2022
- Posibles race conditions en operaciones async
- Patrones repetidos en generación de documentos .docx

El nivel ultra usa múltiples agentes en paralelo para cubrir todo el archivo.

## Qué buscar específicamente en LexCapture
- Race conditions en `DB.saveCase()` con cifrado async
- Fugas de memoria en el wizard (event listeners no removidos)
- Validación incompleta de datos del capturado
- Template literals inseguros en generación de HTML dinámico
- Manejo de errores en generación .docx con docx.js

## Cuándo ejecutar
- **ANTES de iniciar la fusión** (leer código antes de reescribir)
- Al terminar la **Fase H** (revisión final antes de RC)

## Fases
- **Inicio del proyecto**: Entender Motor.html antes de fusionar
- **Fase H**: Revisión final del código fusionado
