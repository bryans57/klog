# Design — SPEC-002

## Resumen

`runSearch` / `runTail` no cambian su contrato de kubectl. En modo visor, `onMatch`/`onLine` empujan un **modelo acotado**. Ink pinta ese modelo a pantalla completa. El dominio (parse, anillo, filtro, qué está seleccionado) es TypeScript puro. Ink y ink-mouse son el adaptador de terminal (teclado, ratón, restore).

## Stack

Lo de `technical-context.md` más, **solo en este spec**:

| Paquete | Rol |
|---|---|
| `ink` ^6 | Render React→terminal, `useInput`, `unmount`, `alternateScreen` |
| `react` ^19 | peer de Ink |
| `@ink-tools/ink-mouse` | clic / rueda / hit-testing |
| `ink-testing-library` (dev) | `lastFrame()` en tests |

Sin OpenTUI ni blessed. `bun run build` sigue siendo gate. El spike T-000 confirmó que Ink 6.8 se compila directamente con Bun 1.3.13, sin workaround de `yoga.wasm`.

## Componentes

| Pieza | Responsabilidad | Archivos |
|---|---|---|
| Parser | línea → `{ time, level, message, fields, raw }` | `src/viewer/parse-line.ts` |
| Buffer | `pushHit(mode: 'prefix'\|'ring', limit)` | `src/viewer/buffer.ts` |
| Modelo | grupos, conteos, truncated | `src/viewer/model.ts` |
| Reducer | tecla \| mouse → estado | `src/viewer/state.ts` |
| Surface | `shouldUseViewer` | `src/viewer/surface.ts` |
| Layout | `truncate`, `wrapValue`, `fitRows`, `clampScroll`, `clampViewport`: el frame cabe en el viewport y una fila = una línea | `src/viewer/layout.ts` |
| Input | `isMouseReport` / `sanitizeTypedText` (los reportes SGR llegan a `useInput` y no deben ensuciar el filtro) e `isRowClick` (el hit-test de ink-mouse incluye el borde inferior, así que dos filas contiguas dan positivo) | `src/viewer/input.ts` |
| App Ink | Box/Text, lista, detalle, footer de teclas | `src/viewer/app.tsx` |
| Mount | enter screen + `render(<App/>)` + MouseProvider + restore | `src/viewer/mount.ts` |
| Screen | par ANSI estándar para entrar/salir de alternate screen, idempotente | `src/viewer/screen.ts` |
| CLI | elige visor vs pretty | `src/cli.ts` |
| Formato plano | sin cambios | `src/output/format.ts` |

`kubectl.ts` no se toca. `tail.ts` / `search.ts` siguen emitiendo líneas; el visor se engancha por IO callbacks.

## Flujo

```
search|tail ──► onHit ──► output-file (siempre, plano)
                    └──► buffer.push (prefix|ring) ──► model
                                                          │
                    mouse/key ──► reduce ──► App (Ink) ◄──┘
```

`shouldUseViewer`: `isTTY` && sin `--output` && TERM usable && command ∈ {search, tail}.

**Search:** `mode=prefix`, default limit 5000.
**Tail:** `mode=ring`, default limit 2000.
`--viewer-limit N` pisa ambos. `viewerLimit` en yaml pisa el default si el flag no vino.

**Fila:** `ts`/`time`/`@timestamp` → hora; `level`/`severity` → mayúsculas; `msg`/`message` → mensaje. Resto → detalle.

**Ratón:** eventos `{ type: 'click', target: { kind: 'group', pod } | { kind: 'hit', id } } | { type: 'wheel', delta }`. El reducer no importa si vinieron de Ink o de un test.

## Errores y timeouts

| Situación | Comportamiento |
|---|---|
| `render()` de Ink lanza | unmount si hay instancia, restaurar alternate screen; stderr; exit 1 |
| stdin sin raw mode | no visor; pretty |
| Ctrl+C en visor | unmount; abort de tail/search; 130 si la búsqueda no había acabado, 0 si tail/search ya estable |
| Resize | `mount` escucha `process.stdout.on('resize')` y repinta con el nuevo `rows`/`columns`; el modelo no se pierde |
| Terminal sin tamaño (`rows`/`columns` en 0) | `clampViewport` cae a 24×80 con mínimos 8×40; nunca se pinta un frame de ancho 0 |
| Terminal sin ratón | MouseProvider no entrega clics; teclado ok |
| Viewport < 10×40 | cabecera + aviso; sin throw |

Sin timeouts de red extra.

## Calidad (gates)

- Typecheck + `bun run build` del entrypoint real (el binario tiene que incluir Ink).
- **Anti-ANSI en pipe.**
- **Restore:** unmount en q / señal / throw.
- **Anillo:** test de buffer que demuestra que el tamaño no crece tras el tope.
- **Deps allowlist** (CA-017).
- Superficie kubectl (CA-018).
- ink-testing-library para un frame de lista, no para simular el cluster.

## Seguridad

Igual que SPEC-001: no spawnea, no lee kubeconfig, `--output-file` es opt-in. El visor no ejecuta el JSON como código (`JSON.parse` a objeto plano solamente).

## Invariantes de estado persistente

| Estado | Qué debe pasar |
|---|---|
| Terminal Ink | unmount restaura; mouse off |
| `--output-file` | append de **todas** las líneas, también las que el anillo ya no muestra |
| Buffer visor | search: ≤ limit, primeros; tail: ≤ limit, más recientes |
| Vista | efímera |

## No hacer

- No abrir visor en pipes ni con `--output`.
- No acumular tail sin anillo.
- No añadir OpenTUI/blessed “por si Ink falla” en el mismo PR: se refina el spec.
- No escribir ANSI desde `buffer`/`parse-line`/`state`.
