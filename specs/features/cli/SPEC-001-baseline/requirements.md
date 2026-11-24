# Requirements — SPEC-001

## Objetivo

Documentar y preservar el contrato de la CLI klog tal como existe hoy: búsqueda y tail de logs en varios pods en paralelo, listado de pods/contextos, y cambio de contexto GKE/kubectl sin mutar recursos de cluster.

## Alcance

- Interfaz: `klog <command> …` compilada a `dist/klog` o ejecutada con `bun run src/cli.ts`.
- Descubrimiento de pods: `-n` + uno de `-l` / `--deployment` / `--pod`.
- Motor de coincidencias: substring (default), `-w`, `--regex`, case-insensitive por defecto.
- `search` histórico (sin `-f`); `tail` en vivo (`kubectl logs -f`).
- `use` / `contexts` sobre kubeconfig local.

## Fuera de alcance

- UI TUI/browser y visor estructurado de follow-up.
- Autenticación propia (usa kubectl/gcloud ya configurados).
- Guardar logs en un almacén remoto.

## Actores

| Actor | Rol |
|---|---|
| Operador local | Persona en su laptop con kubectl (y gcloud si GKE) |
| Cluster | API de Kubernetes; klog no es operador |

## Casos de uso

### UC-001 — Ayuda y versión
**Actor:** Operador  
**Precondición:** binario o `bun run src/cli.ts`  
**Flujo:**
1. Invoca `klog --help` / `-h` / sin comando, o `klog --version` / `-V`.
**Postcondición:** help en stdout (texto de `HELP`) o `klog <VERSION>`; exit 0.

### UC-002 — Buscar logs en varios pods
**Actor:** Operador  
**Precondición:** namespace y selector/deployment/pod; query no omitida  
**Flujo:**
1. `klog search <query> -n …` con `-l` o `--deployment` o `--pod`.
2. Descubre pods, lanza hasta `--concurrency` (default 10) streams `kubectl logs`.
3. Imprime matches al llegar (stdout); header y resumen en stderr.
**Postcondición:** exit 0 si hay ≥1 match; exit 1 si cero matches. Pods fallidos no abortan el resto.

### UC-003 — Volcar líneas sin filtro
**Actor:** Operador  
**Precondición:** query explícita `""`  
**Flujo:**
1. `klog search "" …` (o tail sin query).
**Postcondición:** cada línea de log cuenta como hit (query vacía no filtra).

### UC-004 — Modos de coincidencia
**Actor:** Operador  
**Precondición:** search o tail con query no vacía  
**Flujo:**
1. Default: substring, `ignoreCase=true`.
2. `--no-ignore-case` distingue mayúsculas.
3. `-w` / `--word`: token completo (`/ejemplo` no coincide `/ejemplos`).
4. `--regex`: query es regex JavaScript (`i` si ignoreCase).
**Postcondición:** el matcher aplica exactamente una de esas reglas.

### UC-005 — Tail en vivo
**Actor:** Operador  
**Precondición:** mismos requisitos de pods que search  
**Flujo:**
1. `klog tail [query] …` abre `kubectl logs -f`.
2. `--tail` default 10 si no se pasa; no usa `--previous` (solo current).
**Postcondición:** líneas (filtradas si hay query) a stdout hasta Ctrl+C o fin de streams.

### UC-006 — Seguir pods nuevos
**Actor:** Operador  
**Precondición:** `tail --follow-pods` (o `-f`)  
**Flujo:**
1. Reconsulta el selector cada 5s y abre streams de pods/contenedores no vistos.
**Postcondición:** aparece `+ pod <name>` en stderr al enganchar uno nuevo.

### UC-007 — Listar pods
**Actor:** Operador  
**Precondición:** namespace + selector/deployment/pod  
**Flujo:**
1. `klog pods …`
**Postcondición:** stdout con contexto, namespace, cuenta y `name  containers=…`.

### UC-008 — Listar contextos
**Actor:** Operador  
**Precondición:** kubeconfig con contextos  
**Flujo:**
1. `klog contexts` o `klog use` sin argumento.
**Postcondición:** lista numerada; `*` marca el actual. `use` sin argumento no cambia contexto (exit 0).

### UC-009 — Cambiar contexto
**Actor:** Operador  
**Precondición:** pick por índice 1-based, nombre exacto, o fragmento único  
**Flujo:**
1. `klog use 7` / `klog use apis-02` / fragmento.
2. Si el actual ≠ elegido: `kubectl config use-context`.
3. Si GKE: `gcloud container clusters get-credentials` (y `list` para resolver nombre).
4. Ping API: `kubectl get ns` con timeout 8s.
**Postcondición:** contexto actual actualizado si hacía falta; mensaje de switch o `Already using`. Fragmento ambiguo o índice inválido: no switch, exit 2.

### UC-010 — Config opcional
**Actor:** Operador  
**Precondición:** archivo presente o ausente  
**Flujo:**
1. Lee `~/.config/klog/config.yaml` si existe (`defaultContext`, `defaultNamespace`, `concurrency`).
2. Flags de CLI ganan; `concurrency` del archivo solo si el flag sigue en default 10.
**Postcondición:** ausencia del archivo = `{}`. No crea el archivo.

### UC-011 — Validación y cancelación
**Actor:** Operador  
**Precondición:** argv inválido, o SIGINT/SIGTERM durante search/tail  
**Flujo:**
1. Parse error / comando desconocido / search sin query → stderr y exit 2.
2. Namespace faltante o sin `-l`/`--deployment`/`--pod` → error, exit 1.
3. `--since` sin unidad (`168`) rechazado.
4. SIGINT/SIGTERM aborta hijos; exit 130 y `Interrupted.`.
**Postcondición:** no quedan procesos kubectl huérfanos a propósito (kill del spawn).

## Criterios de aceptación

### CA-001 — Help y versión
**Dado** el entrypoint **Cuando** se pasa `-h`/`--help` o no hay comando **Entonces** stdout es el texto de ayuda y exit 0. **Cuando** `-V`/`--version` **Entonces** stdout es `klog ` + versión y exit 0.  
**Verificable por:** `bun test test/help.test.ts` y `bun run src/cli.ts --version`

### CA-002 — Search exige query y target
**Dado** `search` sin query **Cuando** se ejecuta **Entonces** mensaje `search requires a query string…` y exit 2. **Dado** query pero sin `-n` **Entonces** error de namespace. **Dado** `-n` sin `-l`/`--deployment`/`--pod` **Entonces** error `Specify -l/--selector, --deployment, or --pod`.  
**Verificable por:** tests de parse + `search-command`; CLI real con argv corto.

### CA-003 — Search paralelo y streaming
**Dado** varios pods y un fake/client **Cuando** `runSearch` **Entonces** matches de pods distintos se emiten sin esperar al último; pool respeta `concurrency`; header stderr incluye Context/Namespace/Pods/Workers. Exit 0 si matches>0, 1 si 0.  
**Verificable por:** `test/search-command.test.ts`, `test/pool.test.ts`

### CA-004 — Defaults de search
**Dado** search sin `--since` ni `--tail` **Cuando** corre **Entonces** since efectivo `1h`. **Dado** `--tail N` sin `--since` **Entonces** no se fuerza `1h`. Case-insensitive default; sidecars `istio-proxy`, `istio-init`, `linkerd-proxy`, `linkerd-init`, `envoy` omitidos salvo `--container` o `--all-containers`.  
**Verificable por:** `test/search-command.test.ts`, `test/k8s-helpers.test.ts`

### CA-005 — since/until
**Dado** `--since 168` **Cuando** parsea **Entonces** error (unidad obligatoria). **Dado** `--since 7d` **Cuando** se llama kubectl **Entonces** se traduce a `--since=<segundos>s` (Go no acepta `d`). **Dado** `--until` **Cuando** search **Entonces** timestamps en kubectl y filtro en cliente.  
**Verificable por:** `test/parse-since.test.ts`, `test/search-engine.test.ts`

### CA-006 — Matcher
**Dado** query `ejemplo` default **Cuando** la línea tiene `Ejemplos` **Entonces** hay match. **Dado** `-w` y `/ejemplo` **Cuando** la línea tiene `/ejemplos` **Entonces** no match. **Dado** `--regex` **Cuando** la query es regex JS inválida **Entonces** el runtime de RegExp falla (error). Query `""` hace match de toda línea.  
**Verificable por:** `test/search-engine.test.ts`

### CA-007 — Output
**Dado** `--output json` **Cuando** hay hits **Entonces** cada línea stdout es JSON `{pod, container, timestamp, line}`. Matches en stdout; header/resumen search en stderr. `--output-file` appende cada match más newline. `pretty` prefija `[pod]`.  
**Verificable por:** `test/format.test.ts`, `test/search-command.test.ts`

### CA-008 — Tail
**Dado** `tail` con selector **Cuando** corre **Entonces** `follow: true`, `previous` no se usa, `--tail` default 10. Query opcional filtra. `--follow-pods` reconsulta cada 5s.  
**Verificable por:** `test/tail-command.test.ts`

### CA-009 — Contextos y use
**Dado** lista de contextos **Cuando** `contexts` **Entonces** líneas `[*| ] <n>  <name>`. **Dado** `use` vacío **Entonces** ayuda+lista, `switched=false`, exit 0. **Dado** índice o fragmento único **Entonces** `use-context` si cambió, luego refresh + ping. Ambiguo o fuera de rango: no `use-context`, exit 2. Ya en ese contexto: `Already using`, igual refresh+ping, exit 0.  
**Verificable por:** `test/context-pick.test.ts`, `test/use-command.test.ts`

### CA-010 — GKE get-credentials
**Dado** contexto `gke_<project>_<location>_<cluster>` **Cuando** `use` elige ese contexto **Entonces** se puede ejecutar `gcloud container clusters get-credentials` (zone vs region según location). **Dado** contexto no GKE **Entonces** skip con `Not a GKE context; skipped get-credentials`. Ping falla a 8s con mensaje de API unreachable (VPN/IAP).  
**Verificable por:** `test/gke.test.ts`, `test/use-command.test.ts`

### CA-011 — Superficie kubectl/gcloud
**Dado** cualquier comando de klog **Cuando** se inspecciona `KubectlClient` **Entonces** los bins son solo `kubectl` y `gcloud`, y los verbos kubectl se limitan a: `config current-context`, `config get-contexts`, `config use-context`, `get` (ns/pods/deploy/pod), `logs`. Prohibido: `apply`, `delete`, `exec`, `patch`, `create`, `replace`, `rollout`, `edit`. gcloud: solo `container clusters list` y `container clusters get-credentials`.  
**Verificable por:** revisión de `src/k8s/kubectl.ts` + grep de `Bun.spawn` / `runBin`; test de contrato si se añade.

### CA-012 — Parse de flags especiales
**Dado** `--context 3` **Cuando** parsea **Entonces** `around=3`, no kubeContext. **Dado** `--context my-ctx` o `--kube-context` **Entonces** kubeContext. **Dado** `--output foo` **Entonces** error. Comando desconocido: `Unknown command`.  
**Verificable por:** `test/parse-argv.test.ts`

### CA-013 — Cancelación
**Dado** search/tail en curso **Cuando** SIGINT/SIGTERM **Entonces** AbortSignal, kill de spawns, exit 130, stderr `Interrupted.`  
**Verificable por:** `test/cancel.test.ts`

### CA-014 — Config yaml
**Dado** archivo ausente **Cuando** `loadConfig` **Entonces** `{}`. **Dado** yaml con las tres claves **Cuando** `applyConfig` **Entonces** namespace/context por defecto; concurrency de archivo si flags.concurrency===10.  
**Verificable por:** tests de `config.ts` (añadir si faltan) o `parseSimpleYaml` unitario.

### CA-015 — Quality gates de CLI compilada
**Dado** el repo **Cuando** `bun run typecheck` **Entonces** exit 0. **Cuando** `bun test` **Entonces** unitarios (fakes) pasan. **Cuando** `bun run build` **Entonces** existe `dist/klog` compilado desde `src/cli.ts`. Los fakes **no** sustituyen typecheck ni el compile.  
**Verificable por:** `bun run check` && `bun run build`

## Reglas

- R1. `search`/`tail`/`pods` son de solo lectura hacia el cluster.
- R2. `use` es la única escritura: kubeconfig `current-context` y, en GKE, certificados vía `get-credentials`. No imprime el contenido del kubeconfig ni tokens.
- R3. `--verbose` puede mostrar stderr de kubectl (errores), no volcar secretos a propósito. Ejemplos en specs y tests redactan tokens.
- R4. `--since` siempre con unidad o RFC3339; número pelado inválido.
- R5. Matches a stdout; metadatos de search (header, resumen, warnings `⚠`) a stderr.
- R6. No cargar el historial entero en un string: stream línea a línea.
- R7. Query omitida en `search` ≠ query vacía: omitida es error; `""` es dump.

## No-goals

- No dashboard, TUI, ni agrupación visual de JSON.
- No sustituir kubectl por client-go.
- No tests de integración contra cluster real como gate obligatorio (`KLOG_INTEGRATION=1` es opcional).

## Trazabilidad UC → CA

| UC | CAs |
|---|---|
| UC-001 | CA-001 |
| UC-002 | CA-002, CA-003, CA-004, CA-007, CA-015 |
| UC-003 | CA-006, CA-002 |
| UC-004 | CA-006 |
| UC-005 | CA-008 |
| UC-006 | CA-008 |
| UC-007 | CA-002, CA-007 |
| UC-008 | CA-009 |
| UC-009 | CA-009, CA-010 |
| UC-010 | CA-014 |
| UC-011 | CA-005, CA-012, CA-013 |
