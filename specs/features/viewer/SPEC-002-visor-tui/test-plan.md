# Test plan — SPEC-002

## Estrategia

Puros: parser, buffer, modelo, reducer (incl. mouse sintético). Ink: `ink-testing-library` (`lastFrame`). Mount: doble de `render`/`unmount`. Entrypoint: spawn con stdout pipe. Sin cluster.

Fixtures inocuas (`proceso failed`, `id_ejemplo=123456`).

## Casos

### TC-001 — Parser JSON
**Cubre:** CA-005 — línea ejemplo → ERROR / 18:02:11 / mensaje / fields.

### TC-002 — Parser sucio
**Cubre:** CA-006 — texto, JSON roto, array.

### TC-003 — Superficie
**Cubre:** CA-001, CA-003, CA-015 — matriz TTY × output × TERM × command `search`|`tail`|`use`. true solo search/tail + TTY + sin output + TERM usable.

### TC-004 — Grupos
**Cubre:** CA-004 — 3 pods / 1 pod.

### TC-005 — Prefix search
**Cubre:** CA-011 — limit 5, 15 hits → 5 primeros, `truncated: 'prefix'`.

### TC-006 — Ring tail
**Cubre:** CA-012 — limit 5, hits 1..8 → quedan 4..8, `truncated: 'ring'`. Un noveno empuja y sale el 4.

### TC-007 — Teclado + filtro
**Cubre:** CA-007, CA-008 — `↓ enter / a1b2 esc q`; cliente k8s que explota si se llama.

### TC-008 — Tecla desconocida
**Cubre:** CA-008 — identidad.

### TC-009 — Mouse sintético
**Cubre:** CA-009, CA-019 — `click group`, `click hit`, `wheel`; estado sin mouse tracking no requiere esos eventos.

### TC-010 — Frame Ink
**Cubre:** CA-009 — `lastFrame()` contiene encabezado de pod y una fila resumida.

### TC-011 — Restore
**Cubre:** CA-010 — unmount en q, Ctrl+C, throw.

### TC-012 — Pipe
**Cubre:** CA-002 — spawn sin TTY, cero `\x1b`.

### TC-013 — Exit codes
**Cubre:** CA-013 — 0/1/2/130 como SPEC-001.

### TC-014 — output-file vs anillo
**Cubre:** CA-014 — 8 líneas, limit 3 ring → archivo tiene 8, modelo 3.

### TC-016 — Marco acotado
**Cubre:** CA-020 — 40 hits con mensajes de 300+ caracteres en `rows=14, columns=60` (y `rows=12` con detalle abierto): el frame mide ≤ `rows` líneas y ≤ `columns` por línea. Puros: `truncate`, `wrapValue`, `fitRows`, `clampScroll`, `clampViewport`.

### TC-017 — Columnas, tramo y detalle útil
**Cubre:** CA-020, CA-005 — el frame rotula `time`/`level`/`message`, muestra `N-M of T`, y el detalle incluye `message` y prioriza campos `error*`/`status` con nota `… +N more fields`.

### TC-018 — Filtro a prueba de ratón
**Cubre:** CA-021 — `/` + `lista` + payloads SGR (`\u001b[<35;85;11M`, `[<35;84;10M`): el frame muestra `filter: lista` sin restos; `↓` selecciona un hit filtrado y abre el detalle; `enter` confirma; con filtro sin coincidencias el frame dice `No hits match`. Puros: `isMouseReport`, `sanitizeTypedText`, `confirm-filter`, `visibleItems` con filtro.

### TC-020 — Esc tras confirmar y pie legible
**Cubre:** CA-023 — `/` + texto + `enter` deja `filter: x (esc clears)`; `esc` lo borra y la lista vuelve completa. `selectionLabel` da `pod 1 of 2`, `hit 2 of 3` y `no hits`; el frame muestra `pod 1 of 1` y `▾` cuando la lista no cabe. Evidencia en pty: secuencia `/ guardando ⏎ esc` sobre `dist/klog`.

### TC-019 — Clic exclusivo por fila
**Cubre:** CA-022 — `isRowClick(top, y)` acepta solo `top === y`. Evidencia manual reproducible: clic SGR inyectado en pty (`\033[<0;3;N M/m`) sobre `dist/klog` con kubectl falso; fila de grupo colapsa solo ese grupo, fila de hit selecciona ese hit.

### TC-015 — Allowlist + kubectl + build
**Cubre:** CA-016, CA-017, CA-018 — package.json, surface test, `bun run build`.

## Matriz

| UC | CA | TC |
|---|---|---|
| UC-001 | CA-001, CA-013 | TC-003, TC-013 |
| UC-002 | CA-001, CA-012, CA-013 | TC-003, TC-006, TC-013 |
| UC-003 | CA-002 | TC-012 |
| UC-004 | CA-003 | TC-003 |
| UC-005 | CA-004, CA-009 | TC-004, TC-009 |
| UC-006 | CA-005 | TC-001 |
| UC-007 | CA-006 | TC-002 |
| UC-008 | CA-007 | TC-007 |
| UC-009 | CA-008, CA-019 | TC-007, TC-008, TC-009 |
| UC-010 | CA-009 | TC-009, TC-010 |
| UC-011 | CA-010 | TC-011 |
| UC-012 | CA-011 | TC-005 |
| UC-013 | CA-012 | TC-006 |
| UC-014 | CA-013 | TC-013 |
| UC-015 | CA-015 | TC-003 |
| UC-016 | CA-014 | TC-014 |
| UC-017 | CA-020 | TC-016, TC-017 |
| UC-018 | CA-021, CA-022, CA-023 | TC-018, TC-019, TC-020 |
| (transversal) | CA-016, CA-017, CA-018 | TC-015 |
