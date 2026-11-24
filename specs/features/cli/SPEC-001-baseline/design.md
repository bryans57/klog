# Design — SPEC-001

## Resumen

klog es un proceso local que traduce flags a `kubectl` (y a veces `gcloud`), busca/sigue líneas en paralelo, y formatea. No hay servidor. El baseline congela este diseño; no propone capas nuevas.

## Stack (solo lo ya en technical-context.md)

Bun 1.3+, TypeScript strict, `bun test`, `tsc --noEmit`, `bun build --compile` → `dist/klog`. kubectl en PATH; gcloud solo en `use` GKE.

## Componentes

| Pieza | Responsabilidad | Archivos |
|---|---|---|
| Entrypoint | parse, señales, exit codes, wiring IO | `src/cli.ts` |
| Parser | argv → command + Flags | `src/cli/parse.ts` |
| Help | texto de ayuda | `src/cli/help.ts` |
| Config | yaml mínimo opcional | `src/config.ts` |
| Search command | resolve pods, jobs, pool, summary | `src/commands/search.ts` |
| Tail command | follow, follow-pods 5s | `src/commands/tail.ts` |
| Meta | pods / contexts / use | `src/commands/meta.ts` |
| Engine | matcher, before/after, until | `src/search/engine.ts` |
| Pool | workers + AbortSignal | `src/concurrency/pool.ts` |
| Format | pretty / plain / json / header / summary | `src/output/format.ts` |
| KubectlClient | spawns permitidos | `src/k8s/kubectl.ts` |
| GKE | parse nombre contexto, map cluster | `src/k8s/gke.ts` |
| Context pick | índice / fragmento | `src/k8s/context-pick.ts` |
| Time | since/until / d→seconds | `src/time.ts` |
| Types | PodInfo, SIDECARS, pickContainers | `src/k8s/types.ts` |
| Stream | líneas + prefix `--all-containers` | `src/k8s/stream.ts` |
| Classify | no_previous / unavailable / failed | `src/k8s/classify.ts` |

## Flujo

```
argv → parseArgv
     → help|version | applyConfig(loadConfig)
     → KubectlClient
     → search | tail | pods | contexts | use
```

**search:** `currentContext` → `resolvePods` → header stderr → `buildJobs` (current/previous/both × containers) → `runPool` → `streamLogs` + `searchLines` → `onMatch` stdout (+ `--output-file`) → `formatSummary` stderr.

**tail:** header stderr → jobs solo current → `logs -f` → opcional interval 5s `--follow-pods`.

**use:** `listContexts` → `resolveContextPick` → tal vez `useContext` → `refreshCredentials` → `pingApi(8)`.

## Errores y timeouts

| Situación | Comportamiento |
|---|---|
| Parse / unknown command / search sin query | stderr, exit 2 |
| Error de negocio (ns, selector, kubectl get) | throw → stderr, exit 1 |
| Search 0 matches | summary, exit 1 |
| Job logs `no_previous` / unavailable | `⚠ pod code` en header stderr; el resto sigue |
| `use` pick inválido | texto de ayuda/lista, exit 2, sin use-context |
| API ping | `kubectl --request-timeout 8s get ns --no-headers`; fallo = error con stderr kubectl |
| SIGINT/SIGTERM | abort, kill spawn, exit 130 |

`--verbose`: concatena el mensaje kubectl en el `⚠`.

## Calidad (gates)

- Typecheck del entrypoint real: `bun run typecheck` (`src` + `test`).
- Tests unitarios con fakes de `K8sClient` (`bun test`).
- Build real: `bun run build` / `install.sh` llama `check` + `build`.
- Qué *no* cubren los fakes: auth GKE real, VPN/IAP, binario compilado mal importado, flags que `tsc` no ve si se mockea el cliente. Por eso el compile del `src/cli.ts` es gate.
- Integración `KLOG_INTEGRATION=1` opcional; no es quality gate de este spec.

## Seguridad

- No mutar recursos de cluster.
- No loguear kubeconfig ni stdout de `get-credentials` más allá del mensaje `Credentials refreshed: <cluster>`.
- No extraer ni reimprimir secretos que vengan en líneas de log (el producto hoy reimprime la línea; el spec de baseline **no exige redaction automática** — solo que klog no añada credenciales propias ni que los ejemplos de spec/tests las muestren). Follow-up puede endurecer redaction.

## Invariantes de estado persistente

Aplica a kubeconfig (via kubectl/gcloud) y a `--output-file` / config yaml del usuario.

| Estado | Qué debe pasar |
|---|---|
| `use` sin pick | No escribe current-context |
| `use` mismo contexto | No llama use-context; sí refresh + ping |
| `use` a medias (use-context ok, get-credentials falla) | throw; current-context puede haber cambiado (kubectl ya escribió). No hay rollback. Documentado, no “transacción”. |
| config.yaml ausente | no se crea |
| `--output-file` | append; no trunca |

## No hacer

- No añadir HTTP server, TUI, ni dependencias Kubernetes JS.
- No ampliar verbos kubectl “por si acaso”.
- No tratar `ok` del usuario como aprobación de este spec.
