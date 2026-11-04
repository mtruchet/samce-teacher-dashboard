# panel docente: estado al cierre del Sprint 3

El panel muestra el análisis de cada sesión: el apartado «Análisis de la sesión» y sus alertas.

- **Nunca muestra el índice** de integridad, ni en el texto de las alertas.
- **«Nivel X desde las HH:MM»**, «sin evidencia suficiente» al lado de una alerta y «no disponible» sin textos técnicos.
- **Accesibilidad:** contraste de los textos atenuados y una región viva que anuncia la alerta nueva.
- **Prueba del registro de eventos** que dice lo que prueba.

**Despliegue:** la producción en Vercel quedó con lo último de `main` el 04/11/2026.

## Pull requests del sprint

Los 7 PR mergeados desde el 15/10/2026 (`gh pr list --state merged`):

- #17: apartado «Análisis de la sesión» (2026-10-23)
- #18: alertas más legibles (titular, tabla de variables y aclaración al pie) (2026-10-23)
- #19: TT_S4_03: el panel no muestra nunca el índice (1.04) (2026-10-28)
- #20: TT_S4_03: la prueba del registro de eventos dice lo que prueba (1.16) (2026-10-28)
- #21: TT_S4_03: contraste de los textos atenuados (1.14) (2026-10-28)
- #22: TT_S4_03: «desde las HH:MM», sin evidencia al lado de una alerta, sin textos técnicos y región viva (1.11, 1.12, 1.13, 1.15) (2026-10-28)
- #24: pruebas del panel sin salir al backend real (2026-11-02)

## Completado después de este cierre

Además del #24, que ya figura en la lista de arriba, después entraron:

- #25: el README y el panorama con el estado final del Sprint 3 (04/11/2026)
- #26: el detalle de la sesión en lenguaje llano (TT_S4_02, 04/11/2026), con diecinueve commits
  hechos el 03 y el 04/11/2026, de `7fd6978` a `0fb3959`:
  - El análisis de la sesión con un veredicto en una frase y una tarjeta por alerta, y los textos de
    las alertas tal cual los escribe el motor, en tres rondas de revisión de los textos (`7fd6978`,
    `ce5abd9`, `5ab53f5`, `2dd4a43`, `625696c`, `e1bf9d2`, `3936ff9` y `eb59760`).
  - El nivel de cada alerta con los nombres del criterio de HU06, «Riesgo bajo», «Riesgo medio» o
    «Riesgo alto», separado de su origen (`6430ea1` y `01b2813`).
  - La ficha de la sesión en una sola línea y la cabecera del detalle (`9dca08a` y `e4578fa`).
  - El registro de eventos sin abreviaturas ni palabras técnicas, que se recorre entero y se lee en el
    teléfono (`932fc76`, `77ee72e`, `ff501ea`, `61f8673`, `5afb3d4` y `7559e26`).
  - Los tamaños de letra del detalle, los mismos de la lista de alumnos (`0fb3959`).

Los textos de las alertas que muestra el detalle son los del motor, que entraron con
`mtruchet/samce-ml-engine#64`.

## Estado final

- **El veredicto cuenta las alertas y nunca dice un nivel:** «Hay 2 alertas para revisar.», «No hay
  alertas para revisar.» o «Esta sesión no se pudo analizar.», con el motivo y la aclaración de que
  eso no indica ningún problema en el examen.
- **Cada alerta dice su nivel y su origen:** «Riesgo bajo», «Riesgo medio» o «Riesgo alto», con un
  medidor de tres segmentos, y «En toda la sesión» o «En un momento de la sesión».
- **El texto de la alerta sale tal cual lo escribe el motor:** el hecho en una oración, con la hora
  y la pregunta de su fila en el registro cuando se trata de un pegado, y, en la alerta de toda la
  sesión, la lista «Lo que más se notó», con cifras que se pueden comprobar en el registro.
- **Nunca muestra el índice** de integridad, ni las métricas, el historial o la cronología.
- **El registro de eventos** dice cuántos eventos hay y entre qué horas, y cada fila está escrita en
  palabras de todos los días.
- **Accesibilidad:** contraste de los textos atenuados y una región viva que anuncia la alerta nueva.
