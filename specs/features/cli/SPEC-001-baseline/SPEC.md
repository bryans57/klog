---
id: SPEC-001
title: Baseline CLI klog (comportamiento actual)
module: cli
status: APROBADO
created: 2026-09-11
---

# SPEC-001 — Baseline CLI klog

## Objetivo

Fijar como fuente de verdad el comportamiento **actual** de la CLI `klog`: comandos, flags, límites de `kubectl`/`gcloud`, códigos de salida y gates de calidad. El código existente implementa este spec; no introduce features nuevas.

## Alcance

Comandos `search`, `tail`, `pods`, `contexts`, `use`, `help`, `version`. Parsing de argv, config opcional `~/.config/klog/config.yaml`, formatos `pretty|plain|json`, pool de concurrencia, y el cliente `KubectlClient` (solo las invocaciones listadas en design).

## Fuera de alcance

- Visor local rico (JSON agrupado, expand/collapse, TUI o browser): spec posterior.
- Client-go, API Kubernetes nativa, o sustituir Bun.
- Mutar workloads (`apply`, `delete`, `exec`, `patch`, `rollout`, etc.).
- Imprimir o persistir tokens de logs o kubeconfig.

## Módulo

`cli` — un binario, un módulo. No se parte por verbo (`search` no es módulo).

## Dependencias de otras specs

Ninguna. Esta es la primera spec.

## Supuestos

- Superficie actual = stdout/stderr de CLI, no TUI ni browser.
- El README y el código coinciden salvo matices documentados en design (p. ej. `use` sí escribe kubeconfig vía `use-context` / `get-credentials`; `gcloud container clusters list` es lectura auxiliar).
- Baseline describe **límites** de lo que kubectl/gcloud pueden hacer, no un catálogo de todos los flags de kubectl.

## Criterios de aprobación humana

- [ ] Objetivo y límites claros
- [ ] UCs y CAs verificables
- [ ] Diseño y plan de pruebas alineados
- [x] Palabra exacta `APROBADO` (ok/dale/listo no cuentan)
