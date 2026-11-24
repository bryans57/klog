# Changelog — SPEC-003

## 2026-09-11

- Creación: una spec para (3) cabecera de consulta en el TUI y (4) resaltado del match de `klog search`/`tail` en fila y detalle. Módulo `viewer`. Estado `LISTO_PARA_REVISION`.
- El filtro `/` no se resalta; pipes sin cambio; sin deps nuevas; matcher = SPEC-001.
- **APROBADO:** aprobación humana exacta; listo para implementar con `/sdd-p-build SPEC-003`.
- **IMPLEMENTADO:** DTO de consulta efectiva, cabecera TUI de máximo dos líneas y resaltado amarillo/bold en fila y detalle. `createMatcher` y `matchSpans` comparten `createMatchRegex`; query vacía no resalta; filtro `/` sigue independiente. `search` muestra el since efectivo (`1h` por defecto) y el visor evita duplicar el bloque largo de stderr. Gates: 164 pass / 1 skip / 0 fail, typecheck, build de 566 módulos, SAST/SCA sin hallazgos, pipe con 0 ANSI y smoke del binario instalado con 5 spans amarillos + un enter/leave de alternate screen.
