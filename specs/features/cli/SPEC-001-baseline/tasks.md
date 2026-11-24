# Tasks — SPEC-001

El producto ya implementa el baseline. Tras `APROBADO`, `/sdd-p-build SPEC-001` solo cierra huecos de verificación; no añade el visor rico.

- [x] T-001 — Grep `src/` por spawns (`Bun.spawn`, `runBin`, `kubectl`, `gcloud`) y confirmar CA-011 (CA-011) — `test/kubectl-surface.test.ts`
- [x] T-002 — Asegurar `bun run typecheck` y `bun run build` en el flujo de check local / `install.sh` (CA-015) — ya en `package.json` + `install.sh`; contrato en el mismo test
- [x] T-003 — Cubrir CA-014 (`parseSimpleYaml` / `applyConfig` / archivo ausente) si no hay test dedicado (CA-014) — `test/config.test.ts`
- [x] T-004 — Mapear tests existentes a CAs 001–013; añadir solo TCs que falten en la matriz, sin features nuevas (CA-001…CA-013) — `--context 3`, comando desconocido, exit codes del entrypoint
- [x] T-005 — Confirmar exit codes de `src/cli.ts` (0 / 1 / 2 / 130) frente a CA-001, CA-002, CA-003, CA-009, CA-013 — `test/cli-exit.test.ts` (0/2); abort de search en `cancel.test.ts` (130 a nivel proceso no se spawnea)
- [x] T-006 — No implementar visor rico ni cambiar superficie kubectl en este spec
