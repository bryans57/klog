# CONTEXT

## Qué es

klog es una CLI personal para inspeccionar logs de Kubernetes (GKE / kubectl) de forma local: buscar, seguir (`tail`) y cambiar de contexto de cluster.

Este repositorio es el hogar del código y de las specs SDD personales (mismo root: `src/`, `specs/`, `CONTEXT.md`).

## Para quién

Para quien quiera buscar y seguir logs de Kubernetes en local con kubectl.

## No es

- No es un flujo SDD corporativo ni un servicio compartido.
- No es un operador de cluster: no despliega, no escala, no muta workloads.
- No es un visor de logs en producción ni un recolector tipo Fluent Bit / Loki.

## Lenguaje del dominio

| Término | Significado |
|---|---|
| contexto | Entrada de kubeconfig (`kubectl config current-context` / `use-context`) |
| search | Consulta de logs ya emitidos; solo lectura (`kubectl get` / equivalentes de logs) |
| tail | Seguimiento de logs en vivo; solo lectura (`kubectl logs`) |
| use | Cambio de contexto kubeconfig y, si aplica, `gcloud container clusters get-credentials` |
| kubeconfig | Archivo local de credenciales/contextos de Kubernetes; no se imprime |
| viewer | Capa TUI (Ink) de los hits de search/tail; no consulta el cluster |

## Restricciones

- `search` y `tail` son estrictamente de solo lectura.
- `use` puede ejecutar `kubectl config use-context` y GKE `get-credentials`; nada más de escritura.
- No imprimir secretos ni tokens que aparezcan en logs; redactar en ejemplos y salida.
- Specs primero. SPEC-001 y SPEC-002 están `APROBADO` y cerrados. SPEC-003 (cabecera de consulta + resaltado del match en el visor) está `APROBADO` e implementada, pendiente de validación de uso. No reabrir 001/002 salvo regresión.
- Si el código producto vive en otra ruta (p. ej. un árbol Coordi), no copiar ni escanear ese árbol hasta que el usuario lo indique.
