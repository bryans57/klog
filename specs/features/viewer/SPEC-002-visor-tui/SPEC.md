---
id: SPEC-002
title: Visor TUI local de logs (search + tail, Ink)
module: viewer
status: APROBADO
closed: 2026-09-11
created: 2026-09-11
---

# SPEC-002 — Visor TUI local de logs

## Objetivo

Hacer que `klog search` y `klog tail` sean legibles de un vistazo cuando corren en una terminal: agrupar por pod, resumir cada hit (hora, nivel, mensaje), expandir campos JSON, y **seleccionar con teclado o con el ratón**. No reinventar un motor TUI: se usa Ink.

## Alcance

- Capa `viewer` para hits de `search` y de `tail`.
- TUI con Ink (layout, teclado, alt screen, unmount/restore) y ratón vía `@ink-tools/ink-mouse` (clic en fila/grupo, rueda).
- Parseo JSON → fila + detalle; fallback a texto crudo.
- Default en TTY: visor en lugar de `pretty`.
- Límites de memoria explícitos: tope fijo; en `tail`, buffer anillo (se descartan los más viejos).

## Fuera de alcance

- Navegador o servidor HTTP.
- Cambiar la superficie `kubectl` / `gcloud` de SPEC-001.
- Persistir la vista entre ejecuciones.
- Redacción automática de secretos.
- Construir raw mode, renderer o hit-testing de ratón a mano. Solo se permite el par ANSI estándar para entrar/salir de alternate screen porque Ink 6.8 no expone esa opción.
- OpenTUI, Blessed, o un TUI desde cero.

## Módulo

`viewer` — presentación. `cli` sigue dueño de argv, config y `KubectlClient`.

## Dependencias de otras specs

SPEC-001 (`APROBADO`). Sustituye el default de `pretty` en TTY (CA-007 de SPEC-001). Pipes, `--output plain|json` y exit codes del baseline no cambian.

## Decisión de TUI (alternativas)

| Opción | Qué cubre | Por qué no / sí |
|---|---|---|
| Ink 6 + React 19 | Layout flex, teclado (`useInput`), restore (`unmount`), tests (`ink-testing-library`). Usado en CLIs grandes. Bun lo corre. Ink 5/6 declara compile con Bun. | **Elegida** para no pintar frames a mano. |
| `@ink-tools/ink-mouse` | Clic, hover, rueda, hit-testing | **Elegida** para selección con cursor. Ink core no tiene `onClick` estable. |
| OpenTUI | Ratón nativo, hecho para Bun | Pre-1.0; núcleo Zig/FFI; README: no listo para producción. |
| Blessed | Ratón incluido | Casi sin mantenimiento; mala pinta con `bun build --compile`. |
| ANSI a mano | Cero deps | Reinventa layout, restore y ratón; el usuario quiere seleccionar con cursor. |

Si `bun run build` falla por `yoga.wasm` de Ink, el primer task de implementación es un spike de compile (embed/shim documentado por Bun). No se cambia de librería sin refinar este spec.

## Supuestos

- El visor consume hits de `runSearch` / `runTail`; no llama kubectl.
- `--output pretty` es escape hatch al baseline.
- `TERM=dumb` o sin `TERM` → modo plano.
- Ratón: si el terminal no lo reporta, solo teclado; no es error.
- `search` es finito: tope **5000**, se **conservan los primeros**. `tail` es infinito: tope **2000**, buffer **anillo** (cae el más viejo).

## Criterios de aprobación humana

- [x] Objetivo y límites claros
- [x] UCs y CAs verificables
- [x] Diseño y plan de pruebas alineados
- [x] Palabra exacta `APROBADO` (ok/dale/listo no cuentan)
