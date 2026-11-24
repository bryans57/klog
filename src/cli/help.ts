export const HELP = `klog — parallel Kubernetes log search

USAGE
  klog search <query> [flags]
  klog tail [query] [flags]
  klog pods [flags]
  klog apps [n|fragment]
  klog contexts
  klog use [n|fragment]
  klog --version
  klog --help

FLAGS (common)
  -n, --namespace NAME       Namespace
  -l, --selector app=foo     Label selector
  --app NAME|n|fragment      Shorthand for -l app=…  (klog apps lists them)
  --deployment NAME          Pods of a Deployment
  --pod NAME                 One pod
  --since 30s|10m|2h|7d|ayer17:00
                             Window (search default: 1h). Unit is required for durations.
                             Clock times are America/Bogota (-05:00): ayer17:00, hoy17:00, 17:00, 09-28 17:00.
                             Tail: without --since, kubectl only gets the last 10 lines then follows.
  --until RFC3339|duration   Upper bound. Stops reading a pod once a line is past it.
  --status CODE              Parsed HTTP status (502). AND with the query.
  --level NAME               Parsed level (error). Case-insensitive.
  --tail N                   Last N lines (search: no default. tail: 10 unless --since is set)
  --container NAME           Container
  --all-containers            All containers
  --previous / --current / --both
  -i                         Case-insensitive (default)
  --no-ignore-case           Case-sensitive
  -w, --word                 Whole token ( /ejemplo  ≠  /ejemplos )
  --regex                    Query is a JS regex
  --context KUBE_CTX         kubectl context
  --kube-context NAME         Same, unambiguous
  -C, --around N             Lines around a match
  --concurrency N            Workers (default 10)
  --output pretty|plain|json
  --output-file PATH
  --viewer-limit N           Viewer memory cap (search 5000, tail 2000)
  --verbose
  --follow-pods              Tail: attach new pods

VIEWER (TTY default for search and tail)
  Structured logs are grouped by pod and navigable with keyboard and mouse.
  ↑/↓ move, enter/click expand, / filter, c collapse repeats, o flip order,
  t filter by correlation id, x hide message, wheel scroll, q quit.
  Pass --output pretty|plain|json to disable the viewer.

SEARCH EXAMPLES
  klog search "123456" -n ejemplos -l app=mi-servicio --since 2h
  klog search "/preproceso/entrega" -n ejemplos --app proceso --since ayer17:00 --until ayer19:00
  klog search "123456" -n ejemplos --deployment app-proceso-ms
  klog search "123456" -n ejemplos --pod my-pod-abc
  klog search "id_ejemplo=[0-9]+" --regex -n ejemplos -l app=foo
  klog search "/ejemplo" -w -n ejemplos -l app=foo --since 7d
  klog search "Error" --no-ignore-case -n ejemplos -l app=foo
  klog search "123456" -n ejemplos -l app=foo --previous
  klog search "error" -n ejemplos -l app=foo -C 3 --output json

NO SEARCH, JUST LOGS
  klog tail -n ejemplos -l app=mi-servicio          live, all pods
  klog search "" -n ejemplos -l app=foo --since 10m dump, no filter
  klog search "" -n ejemplos --pod p1 --previous    logs before a restart

TAIL
  klog tail -n ejemplos -l app=mi-servicio
  klog tail "123456" -n ejemplos -l app=mi-servicio
  klog tail -n ejemplos -l app=foo --follow-pods

CONTEXT
  klog contexts                 numbered list, * = current
  klog use                      same list + examples
  klog use 4                    pick, refresh GKE credentials, ping API
  klog use test                 fragment; if several, lists them
  klog use apis-02              unique fragment
  (writes kubeconfig: current-context + GKE certs via gcloud)

DEFAULT CONTAINER
  Application containers only; skips istio-proxy, istio-init,
  linkerd-proxy, envoy. Override with --container or --all-containers.

CONFIG
  ~/.config/klog/config.yaml

  defaultContext: cluster-bryans57-test
  defaultNamespace: ejemplos
  concurrency: 10
  viewerLimit: 2000

SECURITY
  Logs and discovery are read-only (kubectl get + kubectl logs).
  klog use only runs kubectl config use-context and, for GKE,
  gcloud container clusters get-credentials. Then it pings the API.
`;
