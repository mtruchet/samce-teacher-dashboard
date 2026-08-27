# El panel, visualmente

La landing y el panel son el mismo sistema corriendo en dos escalas. Este
documento existe porque el sistema visual estaba repartido entre los
comentarios de una docena de hojas de estilo, y por eso `Panel.tsx` llegó a
usar dos clases que no existían en ninguna parte —`.contenido` y
`.identificador`— y a fallar en silencio.

## Dos escalas del mismo sistema

**Set expresivo**, la página pública. Cuerpo de 19px, escala tipográfica fluida
(`--paso-*`), aire entre secciones de 72 a 128px.

**Set productivo**, el panel. Cuerpo de 14px, escala fija (`--panel-*`), aire
entre bloques de 32px y filas de 40px.

Un docente entra al panel muchas veces por cuatrimestre a hacer siempre lo
mismo, durante hora y media, con una comisión entera rindiendo. Cuarenta filas a
la altura de la landing miden el doble de una pantalla.

### Lo que no cambia

IBM Plex Sans, que es la única familia del sistema, con los mismos tres pesos.
Los datos que se comparan en columna se alinean con sus cifras tabulares
(`.cifra`), sin necesidad de una segunda tipografía. El celeste `#008cb2` con su rol
único: acción y estado activo, nunca decoración ni texto de cuerpo. En todo el
panel aparece **una sola vez**, en la marca viva del pulso. La pizarra. La
escalera de superficies. Las sombras. La prohibición de líneas horizontales de
separación. La ausencia de semáforo.

### Lo que sí cambia

La escala tipográfica, el ancho de página (1200 a 1440) y el aire vertical.

## Los datos son del backend

El panel no inventa nada. Pide `GET /sessions` cada cinco segundos y muestra lo
que el backend registró: cuando un alumno inicia el intento en el aula virtual,
el complemento avisa y la sesión aparece sola.

El curso no viaja en la URL: sale del JWT de sesión, así que un docente no puede
pedir las sesiones de un curso ajeno cambiando un número.

Ese mismo pedido es la prueba de vida del canal. Si el backend deja de
responder, el estado lo dice en lugar de seguir mostrando datos viejos como si
fueran de ahora.

## Las columnas que faltan

Dos, y faltan a propósito.

El **índice de integridad** no tiene definida su escala, su fórmula ni sus
umbrales en ningún documento del proyecto; los cortes están diferidos a la
calibración del Sprint 4.

El **nivel de atención** vive en la tabla de alertas, que todavía no existe.

Escribir «sin dato» tantas veces como sesiones haya sería peor que no tener la
columna: convierte el vacío en ruido y enseña a ignorar justo la región donde
después va a estar lo importante. El chip de los tres niveles ya está escrito y
guardado, con su glifo ordinal y el orden transmitido por cuatro canales que no
son el color. Vuelve cuando exista el dato.

## El orden de la lista

**Nunca por ningún indicador de riesgo.** Una lista ordenada por índice es un
ranking, y el primer puesto de ese ranking es una acusación, con los colores que
sea. El orden lo decide el backend: abiertas primero, y dentro de cada grupo las
que arrancaron hace más tiempo. Dice qué mirar primero, no quién está peor.

## El alumno es un hash

En la base solo hay un `student_hash`. El panel muestra los seis primeros
caracteres en mayúsculas, con cifras tabulares, y debajo el número de
intento de Moodle.

El seudónimo sirve para hablar de la sesión sin nombrar a nadie. El número de
intento es el puente legítimo hacia Moodle cuando hay motivo para saber quién
es. El panel no revela identidades; el docente ya tiene esa potestad en su
propio campus.

## Accesibilidad, con números

Los datos del panel se leen a 8,10:1 o mejor sobre lámina blanca. `--tinta-suave`
(#6a8189) da 4,11:1, por debajo del 4,5 que pide AA para texto chico, así que
los datos usan `--tinta-media` (#3e535b). **La landing todavía usa
`--tinta-suave` en texto de 12px** y conviene revisarlo.

`--nivel-2-fondo` era `#fbeedd`, con 86,9% de luminancia contra el 85,8% de
`--nivel-1-fondo`: en escala de grises eran el mismo tono, y el nivel 2 resultaba
**más claro** que el 1, o sea que el orden estaba invertido. Se corrigió a
`#f2dcbd` (73,7%), que deja doce puntos de distancia y conserva 5,70:1 contra su
propia tinta.

## Reglas verificables

Las cinco se chequean con un grep sobre las hojas del panel:

1. Ninguna línea horizontal de separación.
2. Ningún color literal fuera de los tokens.
3. El celeste solo en acción o estado activo.
4. Ninguna transición sobre `all`: todas enumeran su propiedad.
5. Ninguna declaración de fuente propia.
