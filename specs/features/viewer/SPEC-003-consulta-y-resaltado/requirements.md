# Requirements — SPEC-003

## Objetivo

Que el visor muestre la consulta en curso y marque el match de esa query en la fila y en el detalle, sin romper el marco acotado ni el modo plano.

## Alcance

- Cabecera de consulta en TUI (`search` y `tail`).
- Resaltado de la query de klog en fila y detalle.
- Reutilizar la semántica del matcher de SPEC-001.

## Fuera de alcance

- Pipes / `--output` / `--output-file`.
- Resaltar el filtro `/`.
- Secretos, clipboard, comandos sin visor.

## Actores

| Actor | Rol |
|---|---|
| Operador | Persona en TTY usando `klog search` o `klog tail` |

## Casos de uso

### UC-001 — Ver la consulta en el visor
**Actor:** Operador
**Precondición:** TTY; `search` o `tail` sin `--output`; visor montado
**Flujo:**
1. Corre `klog search "REPOSITORY_ERROR" -n ejemplos -l app=foo --since 40m`.
2. Abre el visor.
**Postcondición:** la cabecera muestra al menos: comando, contexto kube, namespace, target (`app=foo` o deployment/pod), query, since. El recuento de hits/pods de SPEC-002 sigue visible.

### UC-002 — Tail con y sin query
**Actor:** Operador
**Precondición:** visor de `tail`
**Flujo:**
1. `klog tail -n ejemplos -l app=foo` (sin query).
2. `klog tail "Redis" -n ejemplos -l app=foo`.
**Postcondición:** (1) cabecera sin query o con query vacía explícita; sin resaltado. (2) cabecera con `Redis` y resaltado en filas que coinciden.

### UC-003 — Resaltar el match en la fila
**Actor:** Operador
**Precondición:** query no vacía; hits JSON o texto
**Flujo:** mira la lista.
**Postcondición:** cada ocurrencia de la query en el texto visible de la fila (mensaje o crudo) se distingue del resto. El corte `…` de SPEC-002 se mantiene: una fila = una línea.

### UC-004 — Resaltar el match en el detalle
**Actor:** Operador
**Precondición:** hay un hit seleccionado y query no vacía
**Flujo:** abre/ve el panel detail.
**Postcondición:** en las líneas del detalle (message y campos mostrados, incluidas las de wrap) las ocurrencias de la query se distinguen. El detalle sigue dentro del presupuesto de filas.

### UC-005 — Misma semántica que search
**Actor:** Operador
**Precondición:** `-w` o `--regex` o `--no-ignore-case`
**Flujo:** busca con esas flags.
**Postcondición:** el resaltado marca exactamente lo que el matcher de SPEC-001 consideraría match (token, regex, case). No se resalta un superstring si `-w` lo excluye.

### UC-006 — Filtro `/` no se resalta como query
**Actor:** Operador
**Precondición:** query de klog `ERROR`; filtro local `Redis`
**Flujo:** `/` + `Redis`.
**Postcondición:** se resalta `ERROR` (query), no el texto del filtro. El filtro sigue filtrando la lista.

### UC-007 — Pipe y `--output` intactos
**Actor:** Operador
**Precondición:** stdout no TTY, o `--output pretty|plain|json`
**Flujo:** search/tail.
**Postcondición:** salida lineal SPEC-001; sin cabecera TUI; sin secuencias de color de resaltado en stdout.

### UC-008 — Marco sigue acotado
**Actor:** Operador
**Precondición:** terminal pequeña; query y target largos
**Flujo:** visor con cabecera + detalle.
**Postcondición:** frame ≤ `rows` × `columns`; cabecera truncada con `…`; sin frames duplicados.

## Criterios de aceptación

### CA-001 — Cabecera presente
**Dado** visor montado **Cuando** hay `ViewerQuery` **Entonces** el frame contiene contexto, namespace, target y (si no vacía) la query.
**Verificable por:** `ink-testing-library` `lastFrame()`.

### CA-002 — Since / until
**Dado** `--since 40m` y/o `--until` **Cuando** se pinta la cabecera **Entonces** esos valores aparecen; si no se pasaron, no se inventan.
**Verificable por:** frame con y sin esos flags.

### CA-003 — Spans puros
**Dado** texto y query + flags de matcher **Cuando** `matchSpans(text, query, opts)` **Entonces** devuelve segmentos `{ text, match }` que concatenados reconstruyen `text`; `match=true` solo en lo que el matcher de SPEC-001 acepta.
**Verificable por:** tests puros (substring, `-w`, regex, case, query vacía → un segmento sin match).

### CA-004 — Fila resaltada
**Dado** un hit cuyo mensaje contiene la query **Cuando** se pinta la fila **Entonces** el frame (o el árbol Ink) marca ese substring; con query vacía no hay marca.
**Verificable por:** frame de `ViewerApp` con query.

### CA-005 — Detalle resaltado
**Dado** hit seleccionado **Cuando** el detalle muestra `message` (y campos que contienen la query) **Entonces** esas ocurrencias se marcan. Wrap de SPEC-002 se conserva.
**Verificable por:** frame con selección en el hit.

### CA-006 — Filtro `/` independiente
**Dado** query `ERROR` y filtro `Redis` **Cuando** hay líneas con ambos **Entonces** el resaltado sigue siendo de `ERROR`.
**Verificable por:** frame.

### CA-007 — Pipe sin color de spec
**Dado** stdout no TTY **Cuando** search **Entonces** cero `\x1b` (SPEC-001 / CA-002 de SPEC-002).
**Verificable por:** spawn con pipe (test existente no debe romperse).

### CA-008 — Viewport
**Dado** `rows=12`, `columns=60`, query y target largos, detalle abierto **Cuando** se pinta **Entonces** alto ≤ 12 y ancho ≤ 60.
**Verificable por:** test de frame (extiende CA-020).

### CA-009 — Sin kubectl en viewer
**Dado** `src/viewer/` **Cuando** se implementa esta spec **Entonces** no aparece `Bun.spawn` / kubectl / gcloud.
**Verificable por:** `test/kubectl-surface.test.ts` y grep de superficie.

### CA-010 — Gates
**Dado** el cambio **Cuando** CI local **Entonces** `bun test`, `tsc --noEmit`, `bun run build`.
**Verificable por:** comandos.

## Reglas

- R1. `src/viewer/` no consulta el cluster. La cabecera es un DTO que le pasa el CLI.
- R2. Semántica de match = `createMatcher` de SPEC-001. No un `includes` paralelo que discrepe en `-w`/`regex`.
- R3. Query vacía → ningún span `match`.
- R4. El resaltado no escribe en `--output-file` ni cambia el parseo.
- R5. Cabecera y resaltado cuentan en el presupuesto de filas/columnas de SPEC-002.
- R6. Filtro `/` no alimenta `matchSpans`.

## No-goals

- No correlacionar traces entre pods.
- No temas configurables.
- No resaltar before/after de `-C` como query (el visor no muestra el bloque around; solo el hit).

## Trazabilidad UC → CA

| UC | CAs |
|---|---|
| UC-001 | CA-001, CA-002 |
| UC-002 | CA-001, CA-003, CA-004 |
| UC-003 | CA-003, CA-004 |
| UC-004 | CA-005 |
| UC-005 | CA-003 |
| UC-006 | CA-006 |
| UC-007 | CA-007 |
| UC-008 | CA-008 |
| (transversal) | CA-009, CA-010 |
