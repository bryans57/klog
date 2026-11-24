# klog

CLI local para buscar y seguir logs de **varios pods de Kubernetes/GKE en paralelo**, usando el `kubectl` y el contexto que ya tienes configurado.

No imprime ni guarda credenciales. Solo ejecuta operaciones de lectura: `kubectl get` y `kubectl logs`.

## Por qué existe

Cuando un deployment tiene ~10 pods, buscar un id de ejemplo o un error implica repetir `kubectl logs | grep` a mano. `klog` descubre los pods, consulta logs con un worker pool y muestra de qué pod salió cada coincidencia.

## Requisitos

- macOS (también Linux)
- `kubectl` en el PATH (GKE: `gke-gcloud-auth-plugin` si ya lo usas)
- [Bun](https://bun.sh) 1.3+ para desarrollar / compilar

Bun arranca más rápido que Node y puede emitir un binario único; no hace falta Go.

## Instalación

```bash
git clone https://github.com/bryans57/klog.git
cd klog
./install.sh
```

Eso compila `dist/klog` y lo copia a `~/.local/bin/klog` (añade ese directorio al PATH si aún no está).

Comprueba:

```bash
klog --version
klog --help
```

## Flags

| Flag                               | Qué hace                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `-n`, `--namespace`                | Namespace                                                                                                                                 |
| `-l`, `--selector`                 | Selector de labels (`app=app-parametros`)                                                                                     |
| `--deployment`                     | Resuelve pods del Deployment                                                                                                              |
| `--pod`                            | Un pod                                                                                                                                    |
| `--since 30s\|10m\|2h\|7d`         | Ventana. **La unidad es obligatoria** (`168` no vale). `7d` se traduce a segundos porque `kubectl` usa el parser de Go, que no acepta `d` |
| `--until`                          | Tope superior                                                                                                                             |
| `--tail N`                         | Últimas N líneas                                                                                                                          |
| `--container` / `--all-containers` | Contenedor                                                                                                                                |
| `--previous` / `--both`            | Logs del contenedor anterior                                                                                                              |
| `-w`, `--word`                     | Token completo: `/ejemplo` no mata `/ejemplos`                                                                                              |
| `--no-ignore-case`                 | Distingue mayúsculas                                                                                                                      |
| `--regex`                          | La query es regex de JavaScript                                                                                                           |
| `--context`                        | Contexto de kubectl (`--kube-context` si quieres evitar ambigüedad)                                                                       |
| `-C`, `--around`                   | Líneas alrededor del match                                                                                                                |
| `--concurrency`                    | Workers (default 10)                                                                                                                      |
| `--output pretty\|plain\|json`     | Formato                                                                                                                                   |
| `--viewer-limit N`                 | Tope del visor: search conserva los primeros N; tail los últimos N                                                                        |
| `--verbose`                        | Error completo de kubectl                                                                                                                 |

### Cambiar de contexto (prod / test / dev)

```bash
klog use              # lista numerada; * es el actual
klog use 7            # cambia, gcloud get-credentials, ping al API
klog use test         # si hay varios test, te los lista
klog use apis-02      # fragmento único
```

Si el endpoint del kubeconfig está viejo, `get-credentials` lo actualiza. Si el API no responde en 8s, falla con el error de `kubectl` (VPN/IAP/IP rota).

## Ejemplos

Equivale a `kubectl config use-context`. Solo cambia el contexto actual; no toca credenciales.

### Alternativas

```bash
# ejecutar sin instalar
bun run src/cli.ts search "123" -n ejemplos -l app=foo

# enlace de desarrollo (necesita bun)
bun link
```

## Configuración opcional

`~/.config/klog/config.yaml`

```yaml
defaultContext: cluster-bryans57-test
defaultNamespace: ejemplos
concurrency: 10
viewerLimit: 2000
```

## Ejemplos

### Búsqueda entre ~10 pods

```bash
klog search "123456" \
  -n ejemplos \
  -l app=app-proceso-ms \
  --since 2h
```

### Deployment

```bash
klog search "123456" -n ejemplos --deployment app-proceso-ms --since 2h
```

### Previous (contenedor anterior tras un restart)

```bash
klog search "123456" -n ejemplos -l app=app-proceso-ms --since 2h --previous
klog search "123456" -n ejemplos -l app=app-proceso-ms --since 2h --both
```

### Regex

```bash
klog search "id_ejemplo=[0-9]+" --regex -n ejemplos -l app=app-proceso-ms --since 2h
```

### Palabra completa vs substring

Por defecto la búsqueda es substring e insensible a mayúsculas: `ejemplo` también encuentra `Ejemplos`.

```bash
# /ejemplo no coincide con /ejemplos
klog search "/ejemplo" -w -n ejemplos -l app=app-parametros --since 7d

# Distinguir Error de error
klog search "Error" --no-ignore-case -n ejemplos -l app=foo --since 2h

# Regex con límite de palabra
klog search "/ejemplo\\b" --regex -n ejemplos -l app=foo --since 7d
```

### Ver logs sin buscar nada

```bash
# en vivo, todos los pods del selector
klog tail -n ejemplos -l app=app-parametros

# volcado sin filtro (query vacía)
klog search "" -n ejemplos -l app=app-parametros --since 10m

# logs del contenedor anterior tras un restart
klog search "" -n ejemplos --pod mi-pod-abc123 --previous
```

### Tail en tiempo real

```bash
klog tail -n ejemplos -l app=app-proceso-ms
klog tail "123456" -n ejemplos -l app=app-proceso-ms
klog tail -n ejemplos -l app=app-proceso-ms --follow-pods
```

### JSON para jq

```bash
klog search "123456" -n ejemplos -l app=foo --since 2h --output json | jq
```

Las coincidencias van a stdout; el encabezado y el resumen van a stderr.

## Visor interactivo

En una terminal, `search` y `tail` abren por defecto un visor TUI:

- agrupa por pod y resume JSON en columnas `time`, `level` y `message`;
- muestra contexto, namespace/target, ventana efectiva y query sobre la lista;
- resalta en amarillo todas las coincidencias de la query en filas y detalle
  (respeta `-w`, `--regex` y mayúsculas/minúsculas);
- `↑`/`↓` mueve la selección, `enter` o clic expande un grupo;
- `/` filtra localmente (el filtro revela los hits que coinciden aunque el pod
  esté colapsado; `enter` confirma y `esc` limpia), la rueda desplaza y `q` sale;
- search conserva por defecto los primeros 5000 hits;
- tail conserva los últimos 2000 en un buffer anillo.

```
klog search · 14 hits in 2 pods
gke_demo · ejemplos/app=adjuntos · since 40m
query: "REPOSITORY_ERROR"
  time     level message
▾ app-adjuntos-ms-6496b8686b-mfkqq · 5 hits
→ 19:35:42 ERROR REPOSITORY_ERROR
  19:35:44 WARN  reintento programado
  19:35:43 INFO  Redis: listo
┌────────────────────────────────────────────────────────────────┐
│ detail · app-adjuntos-ms-6496b8686b-mfkqq/...            │
│ time         19:35:42                                          │
│ level        ERROR                                             │
│ message      REPOSITORY_ERROR                                  │
│ error_message El usuario de base de datos no tiene permisos    │
│ … +2 more fields (use --output json)                           │
└────────────────────────────────────────────────────────────────┘
hit 1 of 14 ▾ · ↑↓ move · enter/click expand · / filter · q quit
```

Cada fila ocupa exactamente una línea: lo que no cabe se corta con `…` y el
marco nunca excede el tamaño de la terminal. El panel inferior detalla la línea
seleccionada (hasta 6 campos, priorizando `error`, `message`, `status`, `trace`);
para la línea completa, `--output json`. El pie dice dónde estás parado:
`hit 7 of 20` si la selección es una línea de log, `pod 2 of 2` si es un
encabezado de pod, con `▴`/`▾` cuando hay más filas fuera de pantalla.

En pipes, redirecciones, `TERM=dumb`, o al pasar `--output pretty|plain|json`,
se mantiene la salida lineal sin secuencias ANSI. `--viewer-limit N` cambia el
tope; `--output-file` conserva todas las líneas aunque tail descarte las más
viejas del visor.

## Comportamiento por defecto

| Tema                  | Default                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| Case                  | insensible (`--no-ignore-case` para cambiar)                                |
| `--since` en `search` | `1h` si no pasas `--since` ni `--tail`                                      |
| Contenedores          | todos menos sidecars conocidos (`istio-proxy`, etc.)                        |
| Concurrencia          | 10                                                                          |
| Contexto kube         | el de `kubectl config current-context`                                      |
| `--context`           | contexto de kubectl; si el valor es un entero, es `-C` (líneas de contexto) |
| Visor                 | TUI en terminal; salida lineal en pipes                                     |

## Arquitectura

```
CLI (src/cli.ts)
  ├── config ~/.config/klog/config.yaml
  ├── KubectlClient     contexto, pods, stream de logs
  ├── search engine     literal / regex / before-after / until
  ├── worker pool       --concurrency
  ├── viewer             Ink TUI + buffer acotado
  └── formatters         pretty / plain / json
```

Comandos actuales: `search`, `tail`, `pods`, `contexts`. Añadir otro comando no requiere tocar el motor de búsqueda.

`--follow-pods` en `tail` reconsulta el selector cada 5s y abre streams nuevos. El resto de la cola de pods queda preparada para el mismo patrón.

## Performance

- **kubectl vs API nativa:** se usa `kubectl`, no client-go / `@kubernetes/client-node`. En GKE la autenticación pasa por `gke-gcloud-auth-plugin`; reutilizar kubectl evita un segundo stack de auth y es estrictamente de lectura.
- El cuello de botella es la API del cluster, no spawnear 10 procesos. El pool limita procesos simultáneos.
- Los logs se leen **línea a línea** (stream). No se carga el historial entero en un string.
- Las coincidencias actualizan el visor al llegar; en pipes se imprimen al llegar.
- `--since` se reenvía a `kubectl` (`--since` / `--since-time`) para no bajar todo el historial.
- `--until` no existe en kubectl: se activan timestamps y se filtra en cliente.
- Ctrl+C aborta el `AbortSignal` y mata los procesos hijos.

## Tests

```bash
bun test
```

Los unitarios usan un cliente Kubernetes falso. No hace falta un cluster.

Integración real (opcional):

```bash
KLOG_INTEGRATION=1 bun test test/integration.test.ts
```

## Seguridad

- No muta recursos (`apply` / `delete` / `exec` no se usan).
- `klog use` solo cambia `current-context` vía `kubectl config use-context`.
- No guarda tokens.
- `--verbose` muestra stderr de kubectl (mensajes de error, no credenciales).
