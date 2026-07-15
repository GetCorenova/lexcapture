---
name: verify
description: Lanza la app y verifica que los cambios funcionen correctamente en el navegador real. Es el QA automático del proyecto — prueba el golden path completo de LexCapture.
---

# /verify — LexCapture

Lanza la aplicación y observa su comportamiento real para confirmar que los cambios funcionan.

## Uso en este proyecto
```
/verify
```

## Golden path que debe probar
1. Abrir LexCapture_v8.html en el navegador
2. Crear nueva captura (Flagrancia URI)
3. Completar wizard 7 pasos con datos de prueba
4. Generar dossier WA → verificar formato policial correcto
5. Enviar por WhatsApp (sin doble disparo)
6. Descargar FPJ-5.docx → abrir y revisar campos

## Por qué es crítica aquí
No hay tests unitarios en el proyecto. La única forma de confirmar que la fusión Esqueleto+Motor funciona es ejecutarla visualmente. La app se usa en campo bajo luz solar — el contraste y las animaciones deben verse correctas en móvil.

## Cuándo ejecutar
- Al terminar cada fase (A, B, C, D, E, F, G, H)
- Después de cualquier cambio en la generación de documentos .docx
- Antes de entregar al cliente

## Fases principales
- **Fase B**: Verificar wizard completo
- **Fase C**: Verificar dossier WA + generación docx
- **Fase G**: Verificar funcionamiento 100% offline
