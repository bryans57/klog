# Design — ocultar un message en el visor

Estado: APROBADO.

## Comportamiento

Con un hit seleccionado y el filtro `/` cerrado, `x` oculta todas las filas cuyo `parsed.message` sea exactamente ese texto. Vale para las filas ya cargadas y para las que entren después en `tail`. `X` vacía la lista completa. El clic de fila sigue seleccionando; el clic de grupo sigue abriendo y cerrando.

`u` abre la lista de textos ocultos para elegir cuál restaurar. Si no hay ninguno, `u` no hace nada. En esa lista, `↑`/`↓` mueven la selección, `enter` restaura el texto elegido y lo saca de la lista, y `esc` cierra la lista sin restaurar nada más. Si `enter` vacía la lista, la lista se cierra sola. `q` sigue saliendo del visor. El resto de teclas, incluido `/` y `x`, no hacen nada mientras la lista está abierta.

Comparación: igualdad de string, con mayúsculas y espacios. No usa el matcher de `/` ni `-w` / `--regex`.

Un `message` vacío no se oculta. `x` sobre un grupo no hace nada. `x` repetida sobre el mismo texto no duplica la entrada. Mientras se escribe `/`, `x`, `X` y `u` son texto del filtro.

`esc` fuera de esa lista sigue limpiando solo el filtro `/`. Los dos filtros se aplican juntos: primero se descartan los messages ocultos, después corre el filtro `/` sobre lo que queda.

## Estado

`ViewerState.hiddenMessages: string[]`, en orden de alta.

`ViewerState.unhiding: boolean` y `unhideIndex: number`. `u` pone `unhiding` en true e `unhideIndex` en 0. `enter` quita `hiddenMessages[unhideIndex]` y deja el índice en el ítem que queda en esa posición, o en el último si se borró el final. `esc` y `X` ponen `unhiding` en false.

`visibleItems` y el conteo del pie usan los hits que pasan ambos filtros. Un pod sin hits visibles no pinta fila de grupo.

Si el hit seleccionado desaparece, la selección pasa al siguiente ítem visible; si era el último, al anterior; si no queda nada, a un grupo vacío inexistente (`pod: ''`), igual que hoy cuando no hay hits.

`replace-hits` conserva `hiddenMessages`. No cierra la lista de restauración.

## Pie y lista

Junto a las teclas actuales: `x hide message`. Si hay ocultos: `hiding N · u choose · X clear`. `N` es la cantidad de textos distintos.

Con la lista abierta, el panel de detalle se reemplaza por una fila por texto oculto, truncada al ancho, con `→` en la seleccionada. El pie pasa a `unhide · ↑↓ · enter restore · esc back`.

## Pruebas

Reducer puro, sin Ink:

- `x` en un hit quita todos los hits con ese `message` y deja el resto.
- Un hit nuevo con el mismo `message` no aparece; uno distinto sí.
- `message` vacío y selección de grupo no cambian el estado.
- `u` abre la lista. `enter` restaura solo el texto seleccionado y deja los demás ocultos. `esc` cierra sin restaurar. Con la lista vacía, `u` no cambia nada.
- `X` restaura todas las filas y cierra la lista. `esc` fuera de la lista no toca los ocultos.
- El filtro `/` y los ocultos se combinan.
- La selección no apunta a un hit que acaba de ocultarse.
