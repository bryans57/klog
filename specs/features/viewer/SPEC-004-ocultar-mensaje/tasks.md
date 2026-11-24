# Ocultar un message en el visor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ocultar desde el visor todas las filas con el mismo `message`, y restaurar una elegida de una lista.

**Architecture:** `withoutHidden` filtra hits por igualdad exacta de `parsed.message`. El reducer guarda la lista, la selección de restauración y mueve el cursor si el hit actual desaparece. `ViewerApp` solo traduce teclas y pinta el pie y la lista; no filtra por su cuenta.

**Tech Stack:** TypeScript, Bun test, Ink. Sin dependencias nuevas.

## Global Constraints

- Igualdad exacta de `parsed.message` (mayúsculas y espacios cuentan). No reutiliza el matcher de `/`.
- `message` vacío no se oculta. `x` sobre un grupo no hace nada. Repetir `x` no duplica.
- Mientras `filtering` es true, `x`, `X` y `u` son texto del filtro.
- `esc` fuera de la lista de restauración solo limpia el filtro `/`.
- `replace-hits` conserva `hiddenMessages` y no cierra la lista.
- El clic de fila sigue seleccionando. El clic de grupo sigue abriendo y cerrando.
- Primero se quitan los messages ocultos; después corre el filtro `/`.

---

### Task 1: Filtro y reducer

**Files:**
- Modify: `src/viewer/model.ts`
- Modify: `src/viewer/state.ts`
- Test: `test/viewer-model.test.ts`
- Test: `test/viewer-state.test.ts`

**Interfaces:**
- Consumes: `ViewerHit.parsed.message`, `groupHits`, `createViewerState`, `reduceViewerState`, `visibleItems`
- Produces:
  - `withoutHidden(hits: ViewerHit[], hiddenMessages: string[]): ViewerHit[]`
  - `ViewerState.hiddenMessages: string[]`
  - `ViewerState.unhiding: boolean`
  - `ViewerState.unhideIndex: number`
  - Acciones: `hide-message`, `open-unhide`, `unhide-move` (`delta: -1 | 1`), `restore-hidden`, `clear-hidden`
  - `escape` con `unhiding` cierra la lista y no toca `filter` ni `hiddenMessages`

- [ ] **Step 1: Write the failing model test**

Añadir en `test/viewer-model.test.ts`:

```ts
test('withoutHidden drops an exact message and keeps an empty one', () => {
    const hits = [
        createViewerHit('1', 'pod-a', 'app', '{"msg":"ruido"}'),
        createViewerHit('2', 'pod-a', 'app', '{"msg":"Ruido"}'),
        createViewerHit('3', 'pod-a', 'app', 'plain'),
    ];
    const shown = withoutHidden(hits, ['ruido']);
    expect(shown.map((hit) => hit.id)).toEqual(['2', '3']);
});
```

Importar `withoutHidden` desde `../src/viewer/model`.

- [ ] **Step 2: Run the model test and confirm it fails**

Run: `bun test test/viewer-model.test.ts`

Expected: FAIL porque `withoutHidden` no existe.

- [ ] **Step 3: Implement withoutHidden**

En `src/viewer/model.ts`:

```ts
export function withoutHidden(hits: ViewerHit[], hiddenMessages: string[]): ViewerHit[] {
    if (!hiddenMessages.length) return hits;
    const hidden = new Set(hiddenMessages);
    return hits.filter((hit) => {
        const message = hit.parsed.message;
        return !message || !hidden.has(message);
    });
}
```

- [ ] **Step 4: Write the failing reducer tests**

Añadir en `test/viewer-state.test.ts` un `describe` que use estos hits de un solo pod (empieza expandido):

```ts
const noise = [
    createViewerHit('1', 'pod-a', 'app', '{"msg":"ruido"}'),
    createViewerHit('2', 'pod-a', 'app', '{"msg":"ruido"}'),
    createViewerHit('3', 'pod-a', 'app', '{"msg":"util"}'),
];

function hideFirst(): ViewerState {
    let state = createViewerState(noise);
    state = reduceViewerState(state, { type: 'down' });
    return reduceViewerState(state, { type: 'hide-message' });
}
```

Casos:

```ts
test('x hides every hit with that message and keeps the rest', () => {
    const state = hideFirst();
    expect(state.hiddenMessages).toEqual(['ruido']);
    expect(visibleItems(state).filter((item) => item.kind === 'hit').map((item) => item.id)).toEqual(['3']);
});

test('a later hit with the same message stays hidden', () => {
    const opened = reduceViewerState(hideFirst(), { type: 'open-unhide' });
    const state = reduceViewerState(opened, {
        type: 'replace-hits',
        hits: [...noise, createViewerHit('4', 'pod-a', 'app', '{"msg":"ruido"}')],
    });
    expect(visibleItems(state).some((item) => item.kind === 'hit' && item.id === '4')).toBe(false);
    expect(state.hiddenMessages).toEqual(['ruido']);
    expect(state.unhiding).toBe(true);
});

test('empty message and a group selection do not hide', () => {
    const state = createViewerState(noise);
    expect(reduceViewerState(state, { type: 'hide-message' }).hiddenMessages).toEqual([]);

    const blank = createViewerHit('9', 'pod-a', 'app', '');
    expect(blank.parsed.message).toBe('');
    const selected = reduceViewerState(
        { ...createViewerState([blank]), selected: { kind: 'hit', pod: 'pod-a', id: '9' } },
        { type: 'hide-message' },
    );
    expect(selected.hiddenMessages).toEqual([]);
});

test('hiding the same message twice keeps a single entry', () => {
    const once = hideFirst();
    const twice = reduceViewerState(
        { ...once, selected: { kind: 'hit', pod: 'pod-a', id: '1' } },
        { type: 'hide-message' },
    );
    expect(twice.hiddenMessages).toEqual(['ruido']);
});

test('a pod with no visible hits disappears', () => {
    const hits = [
        createViewerHit('1', 'pod-a', 'app', '{"msg":"ruido"}'),
        createViewerHit('2', 'pod-b', 'app', '{"msg":"util"}'),
    ];
    let state = createViewerState(hits);
    state = reduceViewerState(state, { type: 'enter' });
    state = reduceViewerState(state, { type: 'down' });
    state = reduceViewerState(state, { type: 'hide-message' });
    expect(visibleItems(state).map((item) => item.kind === 'group' && item.pod)).toEqual(['pod-b']);
});

test('escape clears the slash filter and keeps hidden messages', () => {
    let state = hideFirst();
    state = reduceViewerState(state, { type: 'start-filter' });
    state = reduceViewerState(state, { type: 'text', value: 'util' });
    state = reduceViewerState(state, { type: 'escape' });
    expect(state.filter).toBe('');
    expect(state.hiddenMessages).toEqual(['ruido']);
});

test('u selects which hidden message to restore', () => {
    let state = hideFirst();
    state = reduceViewerState(state, { type: 'down' });
    state = reduceViewerState(state, { type: 'hide-message' });
    expect(state.hiddenMessages).toEqual(['ruido', 'util']);

    state = reduceViewerState(state, { type: 'open-unhide' });
    state = reduceViewerState(state, { type: 'unhide-move', delta: 1 });
    state = reduceViewerState(state, { type: 'restore-hidden' });
    expect(state.hiddenMessages).toEqual(['ruido']);
    expect(state.unhiding).toBe(true);

    state = reduceViewerState(state, { type: 'escape' });
    expect(state.unhiding).toBe(false);
    expect(state.hiddenMessages).toEqual(['ruido']);
    expect(state.filter).toBe('');
});

test('enter on the last hidden message closes the list', () => {
    let state = reduceViewerState(hideFirst(), { type: 'open-unhide' });
    state = reduceViewerState(state, { type: 'restore-hidden' });
    expect(state.hiddenMessages).toEqual([]);
    expect(state.unhiding).toBe(false);
});

test('open-unhide on an empty list is a no-op', () => {
    const state = createViewerState(noise);
    expect(reduceViewerState(state, { type: 'open-unhide' })).toEqual(state);
});

test('X clears every hidden message and closes the list', () => {
    let state = reduceViewerState(hideFirst(), { type: 'open-unhide' });
    state = reduceViewerState(state, { type: 'clear-hidden' });
    expect(state.hiddenMessages).toEqual([]);
    expect(state.unhiding).toBe(false);
    expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(3);
});

test('the slash filter still applies after hidden messages', () => {
    let state = hideFirst();
    state = reduceViewerState(state, { type: 'start-filter' });
    state = reduceViewerState(state, { type: 'text', value: 'ruido' });
    expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(0);
});

test('hiding the selected hit moves the selection onto a remaining row', () => {
    const state = hideFirst();
    expect(state.selected).toEqual({ kind: 'hit', pod: 'pod-a', id: '3' });
});
```

Importar el tipo `ViewerState` si el helper `hideFirst` lo necesita.

- [ ] **Step 5: Run the reducer tests and confirm they fail**

Run: `bun test test/viewer-state.test.ts`

Expected: FAIL en las acciones nuevas.

- [ ] **Step 6: Implement the reducer**

En `createViewerState`, añadir `hiddenMessages: []`, `unhiding: false`, `unhideIndex: 0`.

`visibleItems` y `selectionLabel` agrupan `withoutHidden(state.hits, state.hiddenMessages)` y después pasan `state.filter` a `groupHits`.

`replaceHits` copia `hiddenMessages`, `unhiding` y `unhideIndex` sin cambiarlos (el spread de `state` ya lo hace si no se pisan).

Ramas nuevas de `reduceViewerState`, antes del `return state` final:

```ts
if (action.type === 'hide-message') return hideMessage(state);
if (action.type === 'open-unhide') {
    if (!state.hiddenMessages.length || state.unhiding) return state;
    return { ...state, unhiding: true, unhideIndex: 0 };
}
if (action.type === 'unhide-move') {
    if (!state.unhiding) return state;
    const last = state.hiddenMessages.length - 1;
    const next = Math.max(0, Math.min(last, state.unhideIndex + action.delta));
    return { ...state, unhideIndex: next };
}
if (action.type === 'restore-hidden') return restoreHidden(state);
if (action.type === 'clear-hidden') return { ...state, hiddenMessages: [], unhiding: false, unhideIndex: 0 };
```

`escape` queda así:

```ts
if (action.type === 'escape') {
    if (state.unhiding) return { ...state, unhiding: false };
    return { ...state, filtering: false, filter: '', scroll: 0 };
}
```

```ts
function hideMessage(state: ViewerState): ViewerState {
    const selected = state.selected;
    if (selected.kind !== 'hit') return state;
    const hit = state.hits.find((candidate) => candidate.id === selected.id);
    const message = hit?.parsed.message ?? '';
    if (!message || state.hiddenMessages.includes(message)) return state;
    const next = { ...state, hiddenMessages: [...state.hiddenMessages, message] };
    return { ...next, selected: selectionAfterHide(state, next) };
}

function restoreHidden(state: ViewerState): ViewerState {
    if (!state.unhiding) return state;
    const hiddenMessages = state.hiddenMessages.filter((_, index) => index !== state.unhideIndex);
    if (!hiddenMessages.length) return { ...state, hiddenMessages, unhiding: false, unhideIndex: 0 };
    return { ...state, hiddenMessages, unhideIndex: Math.min(state.unhideIndex, hiddenMessages.length - 1) };
}

function selectionAfterHide(before: ViewerState, after: ViewerState): ViewerSelection {
    const items = visibleItems(after);
    if (items.some((item) => sameSelection(item, before.selected))) return before.selected;
    const index = visibleItems(before).findIndex((item) => sameSelection(item, before.selected));
    return items[Math.min(Math.max(index, 0), items.length - 1)] ?? { kind: 'group', pod: '' };
}
```

- [ ] **Step 7: Run both test files**

Run: `bun test test/viewer-model.test.ts test/viewer-state.test.ts`

Expected: PASS, incluidos los tests viejos del visor.

- [ ] **Step 8: Commit**

```bash
git add src/viewer/model.ts src/viewer/state.ts test/viewer-model.test.ts test/viewer-state.test.ts
git commit -m "$(cat <<'EOF'
feat: hide viewer rows by exact log message

EOF
)"
```

---

### Task 2: Teclas, pie y lista

**Files:**
- Modify: `src/viewer/app.tsx`
- Test: `test/viewer-app.test.tsx`

**Interfaces:**
- Consumes: acciones y campos de Task 1. `withoutHidden` para el conteo de pods y hits visibles.
- Produces: teclas `x`, `X`, `u` y el panel que reemplaza el detalle mientras `unhiding` es true.

- [ ] **Step 1: Write the failing UI test**

Añadir en `test/viewer-app.test.tsx`:

```tsx
test('x hides a message and u restores the chosen one', () => {
    const hits = [
        createViewerHit('1', 'pod-a', 'app', '{"level":"info","msg":"ruido"}'),
        createViewerHit('2', 'pod-a', 'app', '{"level":"info","msg":"util"}'),
    ];
    const view = render(<ViewerApp command="tail" hits={hits} />);
    view.stdin.write('\u001B[B');
    view.stdin.write('x');
    let frame = stripAnsi(view.lastFrame() ?? '');
    expect(frame).not.toContain('ruido');
    expect(frame).toContain('util');
    expect(frame).toContain('hiding 1');

    view.stdin.write('u');
    frame = stripAnsi(view.lastFrame() ?? '');
    expect(frame).toContain('ruido');
    expect(frame).toContain('enter restore');

    view.stdin.write('\r');
    frame = stripAnsi(view.lastFrame() ?? '');
    expect(frame).toContain('ruido');
    expect(frame).not.toContain('hiding 1');
});

test('x typed into the slash filter does not hide', () => {
    const hits = [createViewerHit('1', 'pod-a', 'app', '{"msg":"extra"}')];
    const view = render(<ViewerApp command="tail" hits={hits} />);
    view.stdin.write('/');
    view.stdin.write('x');
    const frame = stripAnsi(view.lastFrame() ?? '');
    expect(frame).toContain('filter: x');
    expect(frame).toContain('extra');
    expect(frame).not.toContain('hiding 1');
});
```

- [ ] **Step 2: Run the UI test and confirm it fails**

Run: `bun test test/viewer-app.test.tsx -t "x hides a message"`

Expected: FAIL porque `x` no oculta.

- [ ] **Step 3: Wire keys and render the list**

En `useInput`, después del bloque `if (state.filtering)` y antes de `q`:

```tsx
if (state.unhiding) {
    if (input === 'q') return onQuit(false);
    if (key.escape) return dispatch({ type: 'escape' });
    if (key.upArrow) return dispatch({ type: 'unhide-move', delta: -1 });
    if (key.downArrow) return dispatch({ type: 'unhide-move', delta: 1 });
    if (key.return) return dispatch({ type: 'restore-hidden' });
    if (input === 'X') return dispatch({ type: 'clear-hidden' });
    return;
}
```

En el bloque normal, junto a `/` y `d`:

```tsx
if (input === 'x') return dispatch({ type: 'hide-message' });
if (input === 'X') return dispatch({ type: 'clear-hidden' });
if (input === 'u') return dispatch({ type: 'open-unhide' });
```

El conteo superior usa `groupHits(withoutHidden(state.hits, state.hiddenMessages), state.filter)`.

El pie, cuando `state.unhiding`, es `unhide · ↑↓ · enter restore · esc back · q quit`. Si no, se conserva el texto actual y se le añade ` · x hide message`. Si `hiddenMessages.length > 0`, también ` · hiding N · u choose · X clear`.

Si `state.unhiding`, no se pinta `Detail`. En su lugar, una fila por `hiddenMessages`, truncada a `columns`, con el prefijo `→ ` en `unhideIndex` y `  ` en las demás.

- [ ] **Step 4: Run the UI test and the viewer suite**

Run: `bun test test/viewer-app.test.tsx test/viewer-state.test.ts test/viewer-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/app.tsx test/viewer-app.test.tsx
git commit -m "$(cat <<'EOF'
feat: choose which hidden viewer message to restore

EOF
)"
```
