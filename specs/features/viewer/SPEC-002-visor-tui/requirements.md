# Requirements — SPEC-002

## Objetivo

Reducir el tiempo de lectura de `search` y `tail` en terminal: agrupar, resumir, expandir JSON, filtrar en local, y seleccionar con teclado o ratón, sin reventar la RAM en un follow infinito y sin romper pipes.

## Alcance

- Modelo: hits → grupos por pod → filas (hora, nivel, mensaje) + detalle.
- Caps de memoria distintos para `search` (prefijo) y `tail` (anillo).
- Shell TUI: Ink + ink-mouse. Dominio (parse, cap, filtro, selección) es código nuestro, testeable sin terminal.
- Activación por TTY vs `--output`.

## Fuera de alcance

- Navegador, exportar sesiones, correlacionar traces entre pods.
- Pausar el stream de kubectl (el proceso sigue leyendo; el cap recorta el modelo).
- Reordenar o deduplicar.

## Actores

| Actor | Rol |
|---|---|
| Operador local | Terminal; teclado y/o ratón |
| Script / pipe | stdout plano (`jq`, archivos, CI) |

## Casos de uso

### UC-001 — Search en el visor
**Actor:** Operador
**Precondición:** TTY; sin `--output`; `search` con ≥1 hit
**Flujo:**
1. `klog search "123456" -n …`.
2. El visor se abre al primer hit; llegan más en caliente.
3. Al terminar la búsqueda, la vista queda quieta (se puede seguir navegando).
**Postcondición:** exit code de SPEC-001 al salir (`q` / Ctrl+C).

### UC-002 — Tail en el visor
**Actor:** Operador
**Precondición:** TTY; sin `--output`; `tail`
**Flujo:**
1. `klog tail [query] -n …`.
2. El visor se abre al primer hit (o vacío con “esperando líneas” si aún no hay).
3. Las líneas nuevas se insertan en el modelo; si se supera el tope, desaparece la más antigua.
4. `--follow-pods`: un pod nuevo aparece como grupo.
**Postcondición:** memoria acotada al tope de tail; `q` aborta el follow (SIGINT a los streams, como SPEC-001).

### UC-003 — No romper pipes
**Actor:** Script
**Precondición:** stdout no TTY
**Flujo:** `klog search|tail … | jq` o `> out.txt`
**Postcondición:** salida del `pretty` de SPEC-001; sin `\x1b`, sin Ink, sin ratón.

### UC-004 — Escape hatch `--output`
**Actor:** Operador
**Precondición:** `--output pretty|plain|json`
**Postcondición:** baseline; visor no arranca ni en TTY.

### UC-005 — Agrupar y expandir por pod
**Actor:** Operador
**Flujo:** varios pods → grupos colapsados; un pod → expandido. `enter` o **clic en el encabezado del grupo** alterna.
**Postcondición:** solo filas de grupos expandidos.

### UC-006 — Leer hit JSON
**Actor:** Operador
**Flujo:** fila con hora, nivel, mensaje; panel de detalle con el resto de claves.
**Postcondición:** `trace` / `id_ejemplo` legibles sin escanear la línea cruda.

### UC-007 — Línea no JSON
**Actor:** Operador
**Flujo:** texto, JSON inválido o array → mensaje = crudo; detalle = línea completa; sin claves inventadas.
**Postcondición:** el hit no se descarta.

### UC-008 — Filtrar local
**Actor:** Operador
**Flujo:** `/` + texto; `esc` limpia. Substring case-insensitive. No llama al cluster.
**Postcondición:** conteos de grupo = visibles.

### UC-009 — Teclado
**Actor:** Operador
**Flujo:** `↑`/`↓` selección; `enter` grupo; `/` filtro; `esc` cierra filtro; `q` sale. Tecla desconocida = no-op.
**Postcondición:** el teclado basta aunque no haya ratón.

### UC-010 — Ratón (cursor)
**Actor:** Operador
**Precondición:** terminal con mouse tracking (iTerm2, Terminal.app reciente, Alacritty, etc.)
**Flujo:**
1. Clic en encabezado de grupo → mismo efecto que `enter`.
2. Clic en una fila de hit → esa fila queda seleccionada (detalle).
3. Rueda → desplaza la lista.
**Postcondición:** si el terminal no reporta ratón, no hay error; el teclado sigue igual.

### UC-011 — Salir y restaurar
**Actor:** Operador
**Flujo:** `q`, Ctrl+C, o error de render.
**Postcondición:** Ink `unmount`; mouse tracking off; alt screen off; cursor visible. Una vez, en los tres caminos.

### UC-012 — Tope search (prefijo)
**Actor:** Operador
**Precondición:** `search`; tope N (default 5000; `--viewer-limit` o `viewerLimit` en yaml)
**Flujo:** llegan N+10 hits.
**Postcondición:** se retienen los **primeros** N; `truncated: true`; aviso; la búsqueda no aborta.

### UC-013 — Tope tail (anillo)
**Actor:** Operador
**Precondición:** `tail`; tope M (default 2000; mismo flag/config)
**Flujo:** llegan M+50 líneas.
**Postcondición:** el modelo tiene M hits; los 50 más viejos ya no están; aviso `ring` con M. kubectl sigue en follow.

### UC-014 — Cero resultados (search)
**Actor:** Operador
**Precondición:** search con 0 hits al terminar
**Postcondición:** no queda TUI colgada: resumen SPEC-001, exit 1. Si el visor se abrió “esperando” y termina en cero, se cierra solo.

### UC-017 — Línea larga o terminal pequeña
**Actor:** Operador
**Precondición:** hits con mensajes de cientos de caracteres, o terminal angosta/baja (y `rows`/`columns` sin reportar)
**Flujo:** el operador navega y abre el detalle.
**Postcondición:** cada fila ocupa una sola línea (corte con `…`), el marco no excede el viewport (sin frames duplicados), el detalle envuelve el valor en pocas líneas acotadas y el pie muestra el tramo visible.

### UC-018 — Filtrar y seleccionar con el ratón activo
**Actor:** Operador
**Precondición:** visor abierto con tracking de ratón habilitado
**Flujo:** pulsa `/`, escribe, mueve el ratón mientras escribe, navega con `↑`/`↓`, confirma con `enter`, hace clic en una fila y limpia con `esc`.
**Postcondición:** el filtro contiene solo lo escrito, los hits filtrados son seleccionables (detalle incluido), el clic actúa sobre la fila bajo el cursor, `esc` limpia el filtro también después de confirmarlo y el pie dice en qué línea o pod está la selección.

### UC-015 — Terminal degradada
**Actor:** Operador
**Precondición:** `TERM=dumb` o ausente
**Postcondición:** plano; Ink no monta.

### UC-016 — `--output-file` con visor
**Actor:** Operador
**Flujo:** cada hit (el que entra al modelo **y** el que el anillo descarta) se appendea en texto plano.
**Postcondición:** el archivo es el registro completo; sin ANSI. El visor solo muestra el cap.

## Criterios de aceptación

### CA-001 — Default TTY
**Dado** TTY y TERM usable **Cuando** `search` o `tail` sin `--output` **Entonces** `shouldUseViewer` es true.
**Verificable por:** `shouldUseViewer({ command: 'search'|'tail', … })`.

### CA-002 — Pipe sin ANSI
**Dado** stdout no TTY **Cuando** search o tail **Entonces** stdout sin `\x1b` y sin montar Ink.
**Verificable por:** spawn del entrypoint con pipe.

### CA-003 — `--output` manda
**Dado** `--output pretty|plain|json` **Cuando** hay TTY **Entonces** visor off.
**Verificable por:** decisión + formato baseline.

### CA-004 — Grupos
Igual que el draft anterior: 3 pods colapsados; 1 pod expandido; toggle por tecla.
**Verificable por:** modelo + reducer.

### CA-005 — Parser JSON
Línea de ejemplo → `ERROR`, `18:02:11`, `proceso failed`, campos `id_ejemplo` y `trace`.
**Verificable por:** `parse-line`.

### CA-006 — Parser fallback
Texto / JSON roto / array → `message === raw`, `fields` vacío, sin throw.

### CA-007 — Filtro local
Filtro `a1b2` oculta el resto; `esc` restaura; cero llamadas a K8s.

### CA-008 — Teclado
`↑ ↓ enter / esc q` según UC-009; tecla basura = identidad.

### CA-009 — Clic y rueda
**Dado** un harness de ink-mouse (o eventos sintéticos al reducer) **Cuando** llega `click` en un grupo **Entonces** toggle; **cuando** `click` en un hit **Entonces** selección; **cuando** `wheel` **Entonces** el offset de scroll cambia. Sin mouse: esos eventos no llegan y no hay crash.
**Verificable por:** tests del reducer `MouseEvent` + un test de componente Ink que dispara clic si el harness lo permite.

### CA-010 — Restore
`q` / Ctrl+C / throw → unmount + disable mouse + cursor, una vez.
**Verificable por:** doble de `render()`/`unmount` de Ink.

### CA-011 — Cap search prefijo
Tope 5, 15 hits de search → 5 primeros, `truncated: 'prefix'`.

### CA-012 — Cap tail anillo
Tope 5, 8 líneas de tail en orden 1…8 → el modelo queda [4,5,6,7,8] (o ids equivalentes), `truncated: 'ring'`.
**Verificable por:** `pushHit` en modo ring.

### CA-013 — Exit codes
Search 0 matches → 1; ≥1 y `q` → 0; abort durante fetch → 130. Tail + `q` → 0 (SPEC-001 tail ya sale 0).
**Verificable por:** cli-exit + cancel.

### CA-014 — `--output-file`
Append plano de **todas** las líneas emitidas (incluidas las que el anillo tira del visor). Sin `\x1b`.

### CA-015 — TERM dumb
`shouldUseViewer` false; Ink no se llama.

### CA-016 — Gates
`bun run typecheck`, `bun test`, `bun run build` → 0 y existe `dist/klog`.
**Verificable por:** CI local de T-010.

### CA-017 — Dependencias permitidas
`package.json` `dependencies` **solo** puede incluir: `ink`, `react`, `@ink-tools/ink-mouse`. Dev: `@types/react`, `ink-testing-library`. Nada de OpenTUI/blessed.
**Verificable por:** test que lee `package.json`.

### CA-018 — kubectl intacto
`src/viewer/` sin `Bun.spawn` / kubectl / gcloud. `test/kubectl-surface.test.ts` verde.

### CA-019 — Teclado sin ratón
Con mouse tracking off, UC-009 sigue pasando.

### CA-021 — Teclado inmune al tracking del ratón
**Dado** que el tracking del ratón está activo y la terminal envía reportes SGR (`\x1b[<35;85;11M`) por stdin **Cuando** el operador está escribiendo un filtro **Entonces** esos reportes se descartan y el filtro solo recibe texto imprimible; `↑`/`↓` siguen moviendo la selección, `enter` confirma (deja de editar, conserva el filtro) y `esc` limpia; con filtro activo los pods coinciden aunque estuvieran colapsados y el estado vacío dice que es el filtro lo que oculta todo.
**Verificable por:** `input` (`isMouseReport`, `sanitizeTypedText`), reducer (`confirm-filter`, `visibleItems` con filtro) y frames de `ink-testing-library`.

### CA-023 — Salir del filtro y saber dónde estoy
**Dado** un filtro confirmado con `enter` **Cuando** el operador pulsa `esc` (ya fuera del modo de edición) **Entonces** el filtro se limpia y la lista vuelve a mostrar todo; ninguna tecla queda muerta. El pie indica la posición de la **selección**, no números de fila: `hit N of M` cuando la selección es una línea de log y `pod N of M` cuando es un encabezado de pod, más `▴`/`▾` si hay filas fuera de pantalla, y `esc clear filter` en la leyenda solo mientras hay filtro.
**Verificable por:** `selectionLabel` + frames (`enter` conserva el filtro, `esc` lo limpia).

### CA-022 — Clic sobre la fila del cursor
**Dado** que `isPointInRect` de ink-mouse incluye el borde inferior y por tanto dos filas contiguas dan positivo **Cuando** llega un clic en la fila `y` **Entonces** solo actúa el handler cuya fila empieza en `y` (`isRowClick`), nunca la fila vecina.
**Verificable por:** `isRowClick` + clic SGR inyectado en un pty sobre el binario (fila de grupo colapsa solo ese grupo; fila de hit selecciona ese hit).

### CA-020 — Marco acotado al viewport
**Dado** cualquier combinación de hits, líneas largas, filtro, aviso de tope y detalle abierto **Cuando** se pinta el frame **Entonces** el frame tiene **≤ `rows`** líneas y **ninguna** línea excede `columns`; una fila = una línea (corte con `…`); el pie indica el tramo visible (`1-6 of 7`); si la terminal no reporta tamaño se usa 24×80 con mínimos 8×40.
**Verificable por:** `layout` (`truncate`, `wrapValue`, `fitRows`, `clampScroll`, `clampViewport`) + frames de `ink-testing-library` midiendo alto y ancho.

## Reglas

- R1. El visor no consulta el cluster.
- R2. Cero ANSI fuera de TTY; `--output-file` siempre plano.
- R3. Parse, cap, filtro y selección son puros; Ink solo pinta y traduce input → eventos.
- R4. Restore obligatorio (unmount) en error, señal y `q`.
- R5. No se inventan campos JSON.
- R6. `tail` nunca acumula sin tope: el anillo es el único buffer de vista.
- R7. El archivo `--output-file` no se recorta con el anillo: es la traza completa.
- R8. Clic y teclado hacen lo mismo sobre grupos/hits.

## No-goals

- No HTTP, no correlacionar traces, no temas.
- No scroll horizontal (detalle muestra el valor completo).
- No TUI artesanal ni OpenTUI.

## Trazabilidad UC → CA

| UC | CAs |
|---|---|
| UC-001 | CA-001, CA-013 |
| UC-002 | CA-001, CA-012, CA-013 |
| UC-003 | CA-002 |
| UC-004 | CA-003 |
| UC-005 | CA-004, CA-009 |
| UC-006 | CA-005 |
| UC-007 | CA-006 |
| UC-008 | CA-007 |
| UC-009 | CA-008, CA-019 |
| UC-010 | CA-009, CA-019 |
| UC-011 | CA-010 |
| UC-012 | CA-011 |
| UC-013 | CA-012 |
| UC-014 | CA-013 |
| UC-015 | CA-015 |
| UC-016 | CA-014 |
| UC-017 | CA-020 |
| UC-018 | CA-021, CA-022, CA-023 |
| (transversal) | CA-016, CA-017, CA-018 |
