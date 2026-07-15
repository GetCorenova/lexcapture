---
name: init
description: Genera o actualiza CLAUDE.md con documentación permanente del proyecto. Esencial para preservar el contexto legal específico de LexCapture entre sesiones de trabajo.
---

# /init — LexCapture

Genera un archivo CLAUDE.md con documentación completa del proyecto: arquitectura, convenciones, contexto legal y comandos de desarrollo.

## Uso en este proyecto
```
/init
```

## Por qué es crítica en LexCapture
El proyecto tiene contexto legal muy específico de Colombia que no puede derivarse del código:
- **FPJ-5**: Formato oficial de la Fiscalía
- **NUNC**: Exactamente 16 dígitos
- **CESPA vs URI**: Diferencia terminológica legal (aprehendido vs capturado)
- **Ley 906/2004**: 7 derechos del capturado
- **Ley 1581/2012**: Habeas Data — los datos del capturado son datos sensibles
- **36 horas**: Límite legal captura → disposición ante Fiscalía

Sin CLAUDE.md, cada nueva sesión de Claude empieza desde cero y puede cometer errores legales graves.

## Estado actual
El proyecto YA tiene un CLAUDE.md en `Crear App/CLAUDE.md` con la mayoría de este contexto. Usar `/init` si se necesita regenerarlo o expandirlo.

## Cuándo ejecutar
- Si se pierde o corrompe el CLAUDE.md actual
- Al inicio del proyecto (ya ejecutado)
- Después de la **Fase A** para actualizar con la nueva arquitectura v8
