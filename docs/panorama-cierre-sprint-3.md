# panel docente: estado al cierre del Sprint 3

El panel muestra el análisis de cada sesión: el apartado «Análisis de la sesión» y sus alertas.

- **Nunca muestra el índice** de integridad, ni en el texto de las alertas.
- **«Nivel X desde las HH:MM»**, «sin evidencia suficiente» al lado de una alerta y «no disponible» sin textos técnicos.
- **Accesibilidad:** contraste de los textos atenuados y una región viva que anuncia la alerta nueva.
- **Prueba del registro de eventos** que dice lo que prueba.

**Lo que queda abierto:** no pude comprobar desde acá que el despliegue de producción en Vercel esté en la última versión.

## Pull requests del sprint

Los 6 PR mergeados desde el 15/10/2026 (`gh pr list --state merged`):

- #17: apartado «Análisis de la sesión» (2026-10-23)
- #18: alertas más legibles (titular, tabla de variables y aclaración al pie) (2026-10-23)
- #19: TT_S4_03: el panel no muestra nunca el índice (1.04) (2026-10-28)
- #20: TT_S4_03: la prueba del registro de eventos dice lo que prueba (1.16) (2026-10-28)
- #21: TT_S4_03: contraste de los textos atenuados (1.14) (2026-10-28)
- #22: TT_S4_03: «desde las HH:MM», sin evidencia al lado de una alerta, sin textos técnicos y región viva (1.11, 1.12, 1.13, 1.15) (2026-10-28)
- #24: pruebas del panel sin salir al backend real (2026-11-02)
