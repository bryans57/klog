# Test plan — SPEC-001

## Estrategia

Unitarios con `K8sClient` falso (`bun test`). Typecheck + compile del entrypoint real. Integración contra cluster: opcional, no bloquea el baseline.

No imprimir secretos en fixtures; líneas de log de prueba son texto inocuo (`keep 99`, `id=1`).

## Casos

### TC-001 — Help y versión
**Cubre:** CA-001  
**Pasos:** `parseArgv` / help test; `klog --version` imprime `klog ` + `VERSION`.  
**Esperado:** command help/version, exit 0.

### TC-002 — Search query y target
**Cubre:** CA-002  
**Pasos:** argv `search` sin query; `runSearch` sin namespace; sin selector.  
**Esperado:** errores documentados; CLI search sin query → 2.

### TC-003 — Search pool y resumen
**Cubre:** CA-003, CA-004  
**Pasos:** fake de 10 pods, un match; un pod unavailable.  
**Esperado:** matches parciales, `unavailable` incrementa, header presente.

### TC-004 — since y until
**Cubre:** CA-005  
**Pasos:** `normalizeSince('168')` throw; `toKubectlSinceArg('7d')` es `--since=86400s` (o 7×86400); until descarta líneas con ts posterior.  
**Esperado:** throw o args kubectl correctos.

### TC-005 — Matcher y query vacía
**Cubre:** CA-006  
**Pasos:** engine tests: case, word, regex, `query === ''`.  
**Esperado:** hits según reglas.

### TC-006 — Formato json/pretty
**Cubre:** CA-007  
**Pasos:** `formatHit` json parseable; pretty con `[pod]`.  
**Esperado:** stdout vs stderr según search-command tests.

### TC-007 — Tail y filtro
**Cubre:** CA-008  
**Pasos:** fake stream follow; query filtra; follow-pods engancha pod nuevo si se simula el interval (o se documenta prueba del interval).  
**Esperado:** solo líneas que matchean; previous no enviado.

### TC-008 — Context pick y use
**Cubre:** CA-009, CA-010  
**Pasos:** pick vacío / índice / fragmento ambiguo / GKE vs no GKE.  
**Esperado:** `switched` y mensajes; no use-context en fallo de pick.

### TC-009 — Flags --context numérico
**Cubre:** CA-012  
**Pasos:** `parseArgv(['search','q','--context','3'])` → around 3.  
**Esperado:** kubeContext undefined.

### TC-010 — Abort
**Cubre:** CA-013  
**Pasos:** `test/cancel.test.ts`.  
**Esperado:** workers paran; no hang.

### TC-011 — Config
**Cubre:** CA-014  
**Pasos:** yaml de tres claves; archivo inexistente.  
**Esperado:** defaults aplicados sin crear archivo.

### TC-012 — Gates compile
**Cubre:** CA-015, CA-011  
**Pasos:** `bun run typecheck`; `bun test`; `bun run build`; grep verbos kubectl.  
**Esperado:** exit 0; `dist/klog` existe; lista blanca de verbos.

### TC-013 — pods list
**Cubre:** CA-002 (target), listado  
**Pasos:** `runPods` con fake.  
**Esperado:** nombres y containers en el string.

## Matriz

| UC | CA | TC |
|---|---|---|
| UC-001 | CA-001 | TC-001 |
| UC-002 | CA-002, CA-003, CA-004, CA-007, CA-015 | TC-002, TC-003, TC-006, TC-012 |
| UC-003 | CA-006, CA-002 | TC-002, TC-005 |
| UC-004 | CA-006 | TC-005 |
| UC-005 | CA-008 | TC-007 |
| UC-006 | CA-008 | TC-007 |
| UC-007 | CA-002 | TC-013 |
| UC-008 | CA-009 | TC-008 |
| UC-009 | CA-009, CA-010 | TC-008 |
| UC-010 | CA-014 | TC-011 |
| UC-011 | CA-005, CA-012, CA-013 | TC-004, TC-009, TC-010 |
