# Design — SPEC-003

## Resumen

El CLI ya conoce contexto, namespace, target, query y flags de matcher. Se los pasa al visor como un DTO inmutable. Una función pura parte el texto en spans de match reutilizando `createMatchRegex`, la fuente compartida por `createMatcher`. Ink solo pinta: cabecera truncada + `Text` con color en los spans `match`.

## Stack (solo lo ya en technical-context.md)

Sin dependencias nuevas. Ink ya permite varios `<Text>` en una fila. `createMatcher` vive en `src/search/engine.ts`.

## Componentes

| Pieza | Responsabilidad | Archivos |
|---|---|---|
| Query DTO | `{ command, context, namespace, target, query, since?, until?, ignoreCase, word, regex }` | `src/viewer/query.ts` (tipo + `formatQueryHeader` → 1–2 strings truncables) |
| Spans | `matchSpans(text, query, opts) → { text, match }[]` | `src/viewer/highlight.ts` — usa `createMatchRegex`, compartido con el matcher de búsqueda |
| App | Cabecera bajo `klog search`; fila y detalle pintan spans | `src/viewer/app.tsx` |
| Mount | Recibe el DTO y lo pasa a `ViewerApp` | `src/viewer/mount.tsx` |
| CLI | Arma el DTO desde flags + contexto ya resuelto | `src/cli.ts` / `search.ts`/`tail.ts` (pasar target/contexto al mount; **no** kubectl extra) |

`formatQueryHeader` no duplica el bloque stderr de `formatHeader` (ese sigue en search no-visor). En visor, stderr no necesita el bloque largo: la TUI lo sustituye. **Decisión:** con visor, no imprimir el `formatHeader` de 8 líneas en stderr (duplicaría la cabecera). El resumen al salir (SPEC-001) se mantiene.

## Flujo

```
runSearch/runTail ──► resuelve context/target
                    └──► mountViewer({ query: ViewerQuery, … })
                              │
hits ──► App: header(query) + rows(matchSpans(message)) + detail(matchSpans(field))
```

**Cabecera (máx. 2 líneas, `truncate` por `columns`):**

1. `ctx · ns/target · since`
2. `query: "…" · -w/--regex` si aplica

Si algo falta (sin since), se omite el segmento. No se inventa `1h` en la línea 1 si el default de search no se pasó explícito: se muestra el valor efectivo que usa kubectl (search default `1h` **sí** es el since efectivo — mostrarlo, porque es lo que se consulta).

**Spans:** concatenación = texto original. Pintura: `match` → `Text` color yellow (o bold yellow); no invert que rompa el contraste cyan de la fila seleccionada. Fila seleccionada: el match sigue yellow sobre cyan del resto, o yellow + bold. Una sola convención: **yellow** para match, cyan para selección de fila.

**Regex:** `RegExp` con `g` y `i` según flags; índices de `exec`. `-w`: la misma frontera que `createMatcher`. Substring: `indexOf` en bucle (case fold si ignoreCase) sobre el texto original, preservando mayúsculas en el span.

**Query vacía / inválida:** un span `{ text, match: false }`. Regex inválida no debería llegar (parse de SPEC-001); si llega, cero resaltado y no throw en el pintado.

## Errores y timeouts

| Situación | Comportamiento |
|---|---|
| Query vacía | cabecera sin `query:`; spans sin match |
| Regex catastrófica | no se añade timeout nuevo; es el mismo matcher que ya corre en search |
| Target muy largo | `truncate` en cabecera; el frame no crece de ancho |
| Chrome extra (2 líneas) | `fitRows` resta esas líneas; CA-008 |

## Calidad (gates)

- Typecheck + `bun run build` del entrypoint.
- Tests puros de `matchSpans` (CA-003) **antes** de Ink.
- Frames de cabecera, fila, detalle, viewport 12×60.
- Tests de pipe existentes siguen en verde (CA-007).
- Fakes no cubren: que stderr deje de duplicar `formatHeader` en TTY real (smoke opcional con `script`).

## Seguridad

El DTO no incluye kubeconfig ni tokens. La query puede ser un secreto mecanografiado por el operador; se muestra porque él la escribió. No se extrae de los logs para la cabecera.

## Invariantes de estado persistente

No aplica: la cabecera y el resaltado son efímeros. `--output-file` sigue plano, sin marcas.

## No hacer

- No segundo matcher “aproximado” en el visor.
- No resaltar el filtro `/`.
- No nuevas deps.
- No pintar cabecera fuera de TTY.
