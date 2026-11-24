# Technical context

## Stack

- Runtime / toolchain: [Bun](https://bun.sh) 1.3+ (`bun.lock`, `bun test`, `bun build --compile`)
- TypeScript (`typescript` en devDependencies, `tsconfig.json` strict, `noEmit`)
- TUI: Ink 6 + React 19; ratón mediante `@ink-tools/ink-mouse`
- Binario CLI: `src/cli.ts` (`package.json` `bin.klog`); build a `dist/klog`
- Kubernetes: `kubectl` en PATH; GKE `gke-gcloud-auth-plugin` / `gcloud container clusters get-credentials` solo en `use`
- Config de ejemplo: `config.example.yaml` (no commitear kubeconfig ni credenciales)

## Arquitectura

- Un binario CLI en el root del repo, junto a `specs/`.
- Comandos previstos: `search`, `tail`/`-f`, `use` (ver README).
- `search` / logs: solo lectura (`kubectl get`, `kubectl logs`).
- `use`: `kubectl config use-context` y, si hace falta, GKE `get-credentials`; no muta workloads.
- Tests en `test/` con Bun. Fakes no sustituyen typecheck ni el compile del entrypoint.
- `src/viewer/` no consulta Kubernetes: recibe eventos estructurados de `search`/`tail`.
- Memoria del visor acotada: search conserva los primeros 5000; tail usa un anillo de 2000 (configurable con `--viewer-limit` / `viewerLimit`).

## Comandos

| Acción | Comando |
|---|---|
| Typecheck | `bun run typecheck` (`tsc --noEmit`) |
| Tests | `bun test` |
| Gates locales | `bun run check` (typecheck + test) |
| Binario | `bun run build` → `dist/klog` |
| Instalar en PATH | `./install.sh` o `bun run install:global` → `~/.local/bin/klog` |
| Dev sin instalar | `bun run src/cli.ts …` |

## Quality gates

1. `bun run typecheck` — un import faltante no puede pasar solo porque un test mockea kubectl.
2. `bun run build` del entrypoint real (`src/cli.ts`), no solo tests con fakes.
3. `bun test` — CAs de cada spec mapeados a TCs.
4. Specs: cada UC → ≥1 CA → ≥1 TC antes de pedir `APROBADO`.
5. No imprimir secretos en logs de tests ni en ejemplos de specs.
6. Pipes sin ANSI; restauración idempotente de alternate screen.
7. Dependencias runtime del visor limitadas a `ink`, `react`, `@ink-tools/ink-mouse`.

## Secretos y kubeconfig

- No commitear kubeconfig, `.env`, ni credenciales GKE.
- `node_modules/` y `dist/` están en `.gitignore`.
- Los tests no deben volcar contenido crudo de logs que parezca token/password.
- `use` limita la superficie de escritura a contexto kubeconfig y `get-credentials`.
