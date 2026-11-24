---
id: SPEC-003
title: Cabecera de consulta y resaltado del match en el visor
module: viewer
status: APROBADO
created: 2026-09-11
---

# SPEC-003 — Cabecera de consulta y resaltado del match

## Objetivo

En el TUI, el operador debe ver **qué está consultando** (contexto, namespace, target, query, ventana de tiempo) y **dónde encaja esa query** en cada línea: resaltado en la fila y en el panel de detalle. Hoy el visor solo dice `klog search · N hits` y las filas no marcan el match.

## Alcance

- Cabecera de consulta en el visor TTY de `search` y `tail` (SPEC-002).
- Resaltado de la query de `klog` (substring / `-w` / `--regex` / `--no-ignore-case`) en la fila y en el detalle de la línea seleccionada.
- El frame sigue cabiendo en el viewport (CA-020 de SPEC-002).

## Fuera de alcance

- Cambiar pipes, `--output pretty|plain|json`, o `--output-file`.
- Resaltar el filtro local `/` (es otro mecanismo; no se mezcla con la query).
- Redacción de secretos (siguiente spec, no esta).
- Copiar al clipboard.
- Cabecera en `pods` / `contexts` / `use` (no usan visor).

## Módulo

`viewer` — presentación. El matcher de coincidencias sigue en `search` (se reutiliza, no se duplica la semántica).

## Dependencias de otras specs

- SPEC-001 (`APROBADO`): query, `-w`, `--regex`, `--no-ignore-case`, `--since`, target de pods.
- SPEC-002 (`APROBADO · cerrada`): visor TTY, layout acotado, detalle, filtro `/`.

## Supuestos

- Los campos de cabecera son los que ya conoce `runSearch` / `runTail` tras resolver contexto (no se vuelve a consultar el cluster desde `src/viewer/`).
- Query vacía (`search ""` o `tail` sin query): cabecera sí; **cero** resaltado.
- `--until` se muestra en cabecera si el operador lo pasó.
- El resaltado es visual (color); no altera `parsed` ni `--output-file`.
- Varias coincidencias en la misma línea: se marcan **todas**.

## Criterios de aprobación humana

- [x] Objetivo y límites claros
- [x] UCs y CAs verificables
- [x] Diseño y plan de pruebas alineados
- [x] Palabra exacta `APROBADO` (ok/dale/listo no cuentan)
