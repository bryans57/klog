# Tasks — SPEC-003

Orden TDD. No mezclar con redacción de secretos ni clipboard.

- [x] T-000 — `matchSpans`: query vacía, substring case-insensitive, `-w`, `--no-ignore-case`, regex global, concatenación = original (CA-003)
- [x] T-001 — `formatQueryHeader`: incluye context/ns/target/query/since/until; omite ausentes; cabe con `truncate` (CA-001, CA-002, CA-008)
- [x] T-002 — `ViewerApp` pinta cabecera en el frame (CA-001, CA-002)
- [x] T-003 — Fila: query visible marcada; query vacía sin marca (CA-004)
- [x] T-004 — Detalle: message/campos con query marcada; wrap intacto (CA-005)
- [x] T-005 — Filtro `/` no cambia los spans de la query (CA-006)
- [x] T-006 — Frame 12×60 con cabecera + detalle sigue ≤ viewport (CA-008)
- [x] T-007 — CLI pasa el DTO a `mountViewer`; con visor no duplicar `formatHeader` en stderr (CA-001)
- [x] T-008 — Pipe / `--output` sin cambios; superficie kubectl; typecheck + build (CA-007, CA-009, CA-010)
- [x] T-009 — README + changelog SPEC-003; chrome documentado en design si el número de líneas de cabecera cambia
