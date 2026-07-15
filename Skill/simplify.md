---
name: simplify
description: Aplica mejoras de reutilización, eficiencia y simplificación al código modificado. No busca bugs — reduce complejidad y mejora legibilidad. Ejecutar después de la Fase 1 de fusión para limpiar duplicaciones.
---

# /simplify — LexCapture

Revisa el código cambiado y aplica mejoras de reutilización, simplificación y eficiencia. No caza bugs — eso es `/code-review`.

## Uso en este proyecto
```
/simplify
```

## Dónde hay más para simplificar en LexCapture
- **rStep1() a rStep7()**: 7 funciones con patrones casi idénticos → extraer función genérica `validateStep(n)`
- **CSS duplicado**: Al fusionar Esqueleto + Motor habrá clases repetidas → unificar
- **Generación de documentos**: `genDocxURI()` y `genDocxCESPA()` comparten 80% del código → función base `genDocxFPJ5(tipo)`
- **Event listeners**: Múltiples `document.addEventListener('click', ...)` anónimos → centralizar

## Cuándo ejecutar
- Después de la **Fase A** (shell fusionado — el CSS va a tener duplicaciones)
- Después de la **Fase B** (wizard — rStep duplicado)
- Al terminar la **Fase H** (limpieza final antes de RC)

## Lo que NO hace esta skill
- No busca vulnerabilidades de seguridad (usar `/security-review`)
- No verifica funcionalidad (usar `/verify`)
- No hace refactors grandes de arquitectura sin pedirlo explícitamente
