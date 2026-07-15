---
name: loop
description: Ejecuta iteraciones de desarrollo en ciclos controlados. Ideal para las 8 fases de integración de LexCapture — hacer cambio, verificar, corregir y pasar a la siguiente iteración manteniendo el contexto.
---

# /loop — LexCapture

Ejecuta un comando o prompt de forma repetida en ciclos controlados. Mantiene el contexto entre iteraciones.

## Uso en este proyecto
```
/loop
/loop 5m /verify
```

## Casos de uso en LexCapture

### Fusión incremental (Fase A)
```
/loop
```
Iterar: aplicar CSS → verificar layout → corregir → siguiente componente.

### Verificación automática mientras desarrollas
```
/loop 10m /verify
```
Corre `/verify` cada 10 minutos mientras desarrollas para detectar regresiones.

### Ciclo de cifrado (Fase E)
```
/loop
```
Iterar: aplicar cifrado → probar con datos reales → verificar que persiste → corregir errores de encoding.

## Por qué es importante aquí
La fusión Esqueleto+Motor es trabajo **incremental en 8 fases**. El loop mantiene contexto entre iteraciones sin perder el hilo de qué se cambió y qué falta. Es especialmente útil en:
- **Fase A**: Shell unificado (muchas iteraciones CSS pequeñas)
- **Fase E**: Cifrado (prueba → error → corrección → prueba)
- **Fase G**: Service Worker (verificar offline en múltiples intentos)

## Orden de uso recomendado por la auditoría
1. `/init` → Documentar
2. `/code-review ultra` → Entender código
3. `/loop` → Iterar fusión Fases 1 a 3
4. `/run` → Verificar visualmente
5. `/verify` → Confirmar golden path
6. `/simplify` → Limpiar código
7. `/security-review` → ANTES de campo real
