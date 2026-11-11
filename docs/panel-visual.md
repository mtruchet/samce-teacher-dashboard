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

## La columna «Análisis»

Desde el Sprint 4 la lista tiene una columna «Análisis», después del alumno. Dice
lo que el docente ve del análisis de cada sesión, y nunca el índice de
integridad, ni en el texto, ni en un `title`, ni en un atributo.

- **Con alertas:** el nivel de riesgo de la sesión, que es el más alto entre los
  de sus alertas («Riesgo alto», «Riesgo medio» o «Riesgo bajo»), con el medidor
  de tres segmentos del detalle, y debajo cuántas alertas tiene y de dónde
  salieron («2 alertas: en toda la sesión y en un momento de la sesión»). Si el
  último cálculo no se pudo hacer, un renglón aparte lo dice, sin ocultar el
  nivel.
- **Sin alertas:** el estado del último análisis, en tinta media y sin medidor:
  «Sin alertas», «Sin analizar», «No se pudo analizar» o «Análisis no
  disponible». Una sesión sin alertas no tiene nivel y nunca se muestra como
  «Riesgo bajo». Toda sesión recién abierta pasa unos dos minutos por «No se pudo
  analizar», hasta su segundo análisis.

La marca no depende solo del color: el rótulo escrito, el medidor con segmentos
llenos (forma, no tono) y un borde a la izquierda de la celda. En escala de
grises se distingue igual. El medidor es decorativo y va oculto para los
lectores de pantalla, porque el rótulo ya lo dice. Pinta con los tonos de las
alertas del detalle (`--alerta-tono-*`), nunca con los `--nivel-*`.

Una alerta nueva se anuncia a los lectores de pantalla con una frase corta («Nueva
alerta en la sesión de Ana Gómez: riesgo medio.»), en una región que solo
contiene esa frase, así no se relee la lista. Una sesión que entra a la lista por
«Ver más sesiones» no se anuncia.

Arriba de la lista va el resumen de la evaluación (HU03_T03), con su propia
sección.

## El orden de la lista

**El orden predeterminado nunca es por riesgo ni por índice.** Una lista ordenada
por índice es un ranking, y el primer puesto de ese ranking es una acusación, con
los colores que sea. El orden lo decide el backend: en curso primero, y dentro de
cada grupo de la más reciente a la más antigua. Dice qué mirar primero, no quién
está peor. El docente puede pedir que se agrupe por nivel; a igual nivel decide la
hora de inicio.

## El resumen de la evaluación

Arriba de la lista de sesiones de un examen, siete tarjetas con recuentos sobre
**toda** la evaluación (hasta 1000 sesiones), no sobre la página ni el filtro:
riesgo alto, medio y bajo, y, de las sesiones sin alertas, sin alertas, sin
analizar, no se pudo analizar y análisis no disponible. Suman el total.

- **Son recuentos:** sin nombres, sin índice y sin promedios, en un orden fijo que
  no depende de los números. Contar y agrupar sí, elegir y comparar no.
- **Cada tarjeta es un filtro:** al tocarla, la lista queda con las sesiones que
  cuenta (deja solo su filtro y conserva el orden elegido); al tocarla de nuevo,
  vuelve a la evaluación completa. La elegida lleva `aria-pressed` y un anillo.
- **Semáforo:** los tres niveles van en rojo, amarillo y verde
  (`--semaforo-*`), con el número, el rótulo y el medidor al lado, para que no
  dependan solo del color. Es la única excepción a «la ausencia de semáforo»,
  pedida por el equipo para ver de un vistazo cómo está el examen, y queda a
  confirmar. La lista y el detalle siguen con los tonos de intensidad.
- **No es una región viva:** los números cambian en silencio en cada
  actualización. Lo que se anuncia al elegir una tarjeta es «N de M sesiones».
- No hay tarjetas de en curso ni de finalizadas: ya están en la cabecera de cada
  grupo.

## Los filtros de la lista

Arriba de la lista, una barra con cuatro controles: nivel de riesgo, estado (en
curso o finalizadas), búsqueda por nombre o apellido y orden (hora de inicio, el
predeterminado, o nivel de riesgo). Todo se resuelve en el backend sobre toda la
evaluación, y el panel guarda la elección en la dirección de la página: sobrevive
a la actualización automática, al botón Atrás y a la vuelta por las migas. Otra
evaluación abre sin filtros. Con un filtro se lee «N de M sesiones», cada grupo
cuenta sus filas y un grupo vacío no se dibuja; si nada coincide, «Ninguna sesión
coincide con el filtro.» con «Quitar filtros». La búsqueda espera a que el
docente deje de escribir. Con una sesión abierta en el detalle, la lista se pide
sin filtrar, para que el detalle no se quede con una copia vieja.

## El alumno se ve por su nombre

Desde el Sprint 2 el panel muestra el nombre del alumno, que es lo que el docente
reconoce (`nombreDeAlumno`). En la base no hay un hash: el id de Moodle y el
nombre se guardan cifrados, y el backend los descifra para el docente autorizado.
Si no hay nombre, la fila muestra el número del aula virtual; si no se pudo
descifrar ninguno de los dos, dice «Alumno sin identificar» y la fila aparece
igual, para que el docente sepa que le falta alguien.

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
