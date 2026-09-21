<!--
Convenciones del proyecto (borrar este comentario al abrir el PR):
- Rama: <feature|fix|docs|chore>/<IDS>-<descripcion-en-ingles>, con los ids de Jira en mayúscula.
  Varias tareas seguidas: SAMCE-25-to-30. Si la tarea todavía no tiene id en Jira, el código de la historia (HU10).
- Título: "SAMCE-<id>: <frase en castellano>", con los mismos ids que la rama.
- Un PR por cambio. Se mergea a main recién cuando está aprobado.
-->

## Tareas de Jira

- SAMCE-XX: título de la tarea

## Resumen

Qué resuelve y por qué. Lo que un compañero necesita saber para revisarlo sin haber estado en la conversación.

## Qué cambia

-

## Depende de / relacionado

Otros PRs (repo#número) que tienen que entrar antes o junto con éste, o "Nada".

## Cómo se probó

- [ ] `npm test` en verde
- [ ] `npm run lint` y `npx tsc --noEmit` limpios
- [ ] `npm run build` compila
- [ ] Visto en el navegador, en escritorio y en móvil, si cambia una pantalla

Evidencia (salida, capturas, caso de prueba):

## Qué no se pudo verificar

Lo que solo se puede comprobar en el entorno real, o "Nada".

## Notas de despliegue

Variables de entorno nuevas, SQL a aplicar a mano, versión a subir, copia vendorizada a actualizar. O "Nada".
