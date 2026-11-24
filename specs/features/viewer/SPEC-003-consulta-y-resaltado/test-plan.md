# Test plan — SPEC-003

## Estrategia

Puros primero (`matchSpans`, `formatQueryHeader`). Ink: `lastFrame()` para cabecera, marca visible (el texto de la query sigue en el frame; si Ink no expone color en `lastFrame` de forma estable, asertar que la query aparece y un test de componente/`chalk`/prop de spans). Pipe: tests SPEC-001 existentes. Sin cluster.

No volcar logs que parezcan tokens.

## Casos

### TC-001 — Spans vacíos y substring
**Cubre:** CA-003
**Pasos:** `matchSpans("Redis: listo", "", …)` → un segmento `match:false`. `matchSpans("ERROR Redis", "redis", { ignoreCase: true })` → span match en `Redis`.
**Esperado:** join = original.

### TC-002 — Word y case
**Cubre:** CA-003
**Pasos:** `-w` sobre `/ejemplo` no marca `/ejemplos`. `--no-ignore-case` no marca `error` si query es `ERROR`.
**Esperado:** solo el token/case correcto.

### TC-003 — Regex global
**Cubre:** CA-003
**Pasos:** query `id=\\d+` sobre una línea con dos ids.
**Esperado:** dos spans match; el resto no.

### TC-004 — Cabecera en frame
**Cubre:** CA-001, CA-002
**Pasos:** `ViewerApp` con DTO de search, since 40m, until ausente.
**Esperado:** frame contiene context, namespace, target, query, `40m`; no inventa until.

### TC-005 — Fila
**Cubre:** CA-004
**Pasos:** hit con `msg` que incluye la query.
**Esperado:** la query aparece en la fila; con query `""` no hay distinción de match (un solo estilo de mensaje).

### TC-006 — Detalle
**Cubre:** CA-005
**Pasos:** seleccionar hit; query en `message` y en `error_message`.
**Esperado:** ambos textos visibles; alto del frame ≤ rows.

### TC-007 — Filtro vs query
**Cubre:** CA-006
**Pasos:** query `ERROR`, filtro `Redis`.
**Esperado:** frame con filtro activo; `ERROR` sigue siendo el match de query.

### TC-008 — Viewport
**Cubre:** CA-008
**Pasos:** rows=12, columns=60, target y query largos, detalle abierto.
**Esperado:** líneas ≤ 12; cada línea ≤ 60.

### TC-009 — Pipe
**Cubre:** CA-007
**Pasos:** test de spawn existente (SPEC-001/002).
**Esperado:** 0 `\x1b`.

### TC-010 — Superficie y gates
**Cubre:** CA-009, CA-010
**Pasos:** `kubectl-surface`, `bun test`, `tsc --noEmit`, `bun run build`.
**Esperado:** verde.

## Matriz

| UC | CA | TC |
|---|---|---|
| UC-001 | CA-001, CA-002 | TC-004 |
| UC-002 | CA-001, CA-003, CA-004 | TC-001, TC-004, TC-005 |
| UC-003 | CA-003, CA-004 | TC-001, TC-005 |
| UC-004 | CA-005 | TC-006 |
| UC-005 | CA-003 | TC-002, TC-003 |
| UC-006 | CA-006 | TC-007 |
| UC-007 | CA-007 | TC-009 |
| UC-008 | CA-008 | TC-008 |
| (transversal) | CA-009, CA-010 | TC-010 |
