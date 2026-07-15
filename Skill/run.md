---
name: run
description: Lanza el proyecto en el navegador real y hace observación visual. Detecta errores de layout, JS roto y problemas de contraste que no se ven leyendo código.
---

# /run — LexCapture

Lanza LexCapture_v8.html en el navegador y observa el comportamiento real de la aplicación.

## Uso en este proyecto
```
/run
```

## Por qué es importante en este proyecto
La app se usa en **campo bajo luz solar directa** — el contraste importa. Los policías operan con guantes, lluvia y urgencia. Las animaciones, el FAB, las bottom sheets deben verse y funcionar correctas en pantalla de móvil real (mobile-first).

## Qué observar en cada ejecución
- **FAB**: gradiente ámbar/púrpura visible, tap funcional
- **Bottom nav**: íconos legibles, navegación fluida
- **Cards de tipo**: Flagrancia (ámbar #d97706) vs OJ (púrpura #9333ea) — diferenciación clara
- **Wizard**: campos legibles, teclado no tapa inputs en móvil
- **Dossier WA**: formato policial correcto, texto seleccionable
- **Debug bar**: NO debe aparecer (M5 — eliminar antes de producción)

## Paleta de colores a verificar visualmente
| Elemento | Color | HEX |
|---------|-------|-----|
| Flagrancia | Ámbar | `#d97706` |
| OJ | Púrpura | `#9333ea` |
| Acción/acento | Cian | `#00c9db` |
| OK | Verde | `#10b981` |
| Error | Rojo | `#ef4444` |
| Fondo | Oscuro | `#0f172a` |

## Cuándo ejecutar
- Al terminar cada fase de la fusión (A a H)
- Especialmente en **Fase A** (primera vez que se ve el shell unificado)
