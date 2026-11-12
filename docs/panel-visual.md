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

Arriba de la lista va el resumen de la evaluación (HU03_T03), dentro de la
lámina de control que se describe más abajo.

## El orden de la lista

**El orden predeterminado nunca es por riesgo ni por índice.** Una lista ordenada
por índice es un ranking, y el primer puesto de ese ranking es una acusación, con
los colores que sea. El orden lo decide el backend: en curso primero, y dentro de
cada grupo de la más reciente a la más antigua. Dice qué mirar primero, no quién
está peor. El docente puede pedir que se agrupe por nivel; a igual nivel decide la
hora de inicio.

## El resumen de la evaluación

Arriba de la lista de sesiones de un examen hay una sola lámina, la de control
(`.lamina.control`), con tres renglones separados por aire y sin líneas: el
resumen, la barra de filtros y, si hay un filtro, el resultado.

El resumen son siete tarjetas con recuentos sobre **toda** la evaluación (hasta
1000 sesiones), no sobre la página ni el filtro, siempre en este orden: Riesgo
alto, Riesgo medio, Riesgo bajo, Sin alertas, Sin analizar, No se pudo analizar y
Análisis no disponible. Suman el total.

- **Son recuentos:** sin nombres, sin índice y sin promedios, en un orden fijo que
  no depende de los números. Contar y agrupar sí, elegir y comparar no.
- **Dos renglones de sentido:** las tres de nivel llevan la marca de nivel (borde
  de tarjeta, fondo al 8 % del tono y `RotuloNivel`); las cuatro de estado van en
  un renglón más liviano, en `--sup-2` con `--anillo`, sin marca ni tono. A 1280
  px las dos filas usan la misma grilla de cuatro columnas, así todas las tarjetas
  miden lo mismo. Debajo de 760 px los tres niveles van en un renglón y los cuatro
  estados en dos por dos.
- **Cada tarjeta es un filtro:** queda marcada (`aria-pressed`) mientras su
  filtro está en la dirección. Tocar una sin marcar deja solo su filtro y conserva
  el orden, así «N de M sesiones» coincide con el número de la tarjeta. Tocar la
  marcada borra solo su filtro.
- **Tonos:** los de las alertas (`--alerta-tono-*`), como en la lista y el
  detalle, con el número, el rótulo y el medidor al lado, para que no dependan
  solo del color. El tono lo pone `data-nivel` desde `src/styles/nivel.css`, el
  único lugar que asigna `--tono`.
- **No es una región viva:** los números cambian en silencio en cada
  actualización. Lo que se anuncia al elegir una tarjeta es «N de M sesiones».
- **No hay tarjetas de en curso ni de finalizadas:** ese número ya está en la
  cabecera de cada grupo, y repetirlo arriba sería el mismo dato en dos lugares.

## Los filtros de la lista

Debajo del resumen, en la misma lámina, una barra con cuatro controles: «Nivel de
riesgo» (Todos, Riesgo alto, Riesgo medio, Riesgo bajo), «Estado» (en curso o
finalizadas), «Buscar alumno» por nombre o apellido y «Ordenar por» (Hora de
inicio, el predeterminado, o Nivel de riesgo). La barra no tiene lámina propia.

- **El selector y la tarjeta son dos caminos al mismo filtro:** dicen lo mismo
  («Riesgo alto») y se reflejan entre sí.
- **Nivel y análisis se excluyen:** elegir un nivel en el selector borra el
  filtro de estado del análisis, y elegir una tarjeta de estado deja el selector
  en «Todos». Nunca se piden los dos juntos.
- **Todo vive en la dirección de la página** (`filtrosDeLaDireccion.ts`): la
  elección sobrevive a la actualización automática, al botón Atrás y a la vuelta
  por las migas. Otra evaluación abre sin filtros. La búsqueda espera a que el
  docente deje de escribir.
- **El renglón de resultado** solo se dibuja con un filtro activo: «N de M
  sesiones» (N, las que cumplen el filtro; M, el total de la evaluación) y, al
  lado, el único «Quitar filtros», que borra los filtros y conserva el orden. Sin
  filtro no ocupa lugar.
- Con un filtro, cada grupo cuenta sus filas y un grupo vacío no se dibuja. Si
  nada coincide, se lee solo «Ninguna sesión coincide con el filtro.», sin un
  segundo botón.

Todo se resuelve en el backend sobre toda la evaluación. Con una sesión abierta en
el detalle, la lista se pide sin filtrar, para que el detalle no se quede con una
copia vieja.

## El detalle de la sesión

Dos láminas, una debajo de la otra: «Análisis de la sesión», la que manda, y
«Registro de eventos», en segundo plano. Cada dato se lee completo en un solo
lugar.

- **El veredicto** es la frase de arriba («Hay 2 alertas para revisar.») y el
  único lugar que dice que no hay alertas, que la sesión no se pudo analizar o que
  el análisis no está disponible. Ningún apartado de abajo lo repite.
- **Una tarjeta por alerta vigente**, con `RotuloNivel` y el origen al lado, y la
  explicación del motor. Es el único lugar donde se lee completa la explicación
  vigente.
- **«Cómo cambió el riesgo»** es una escalera de pastillas, de izquierda a
  derecha: el primer paso dice desde el inicio («Desde el inicio: sin alertas») y
  cada paso siguiente es una subida del nivel de la sesión, con «Análisis de las
  HH:MM» arriba y el rótulo del nivel debajo. Debajo de 480 px pasa a una
  columna. Es el único lugar que dice cómo cambió el nivel de la sesión.
- **«Historial de alertas»**: cada aparición o subida de nivel de cada alerta,
  con la hora del análisis en su renglón, el rótulo con el origen y la
  explicación. Si la explicación es idéntica a la vigente, va plegada detrás de
  «Ver la explicación». Si la última entrada de un origen tiene el mismo nivel que
  la alerta vigente y otra explicación, lleva el aviso «Un análisis posterior
  reemplazó esta explicación por otra, sin cambiar el nivel de riesgo.» y queda
  abierta.
- **«Métricas de la sesión»**: seis, como rótulo y valor, sin cajas, solo con la
  sesión analizada y finalizada. Con la sesión abierta, una línea dice que se
  muestran al terminar. Si la sesión no se pudo analizar o no se analizó, el
  apartado no se dibuja, porque el veredicto ya lo dice. Nunca muestran un valor
  esperado ni una comparación.
- **«Momentos para revisar»** va dentro de la lámina del registro, arriba de la
  tabla, como su índice: cada pegado y cada salida de la ventana o de la pantalla
  completa, de lo más viejo a lo más nuevo, con el mismo ícono y el mismo nombre
  que su fila, y «Ver en el registro» para ir a ella.

## Las piezas del panel

Una sola forma para cada cosa. Las clases viven en `src/styles/base.css`, el tono
en `src/styles/nivel.css` y los tokens en `src/styles/tokens.css`; `RotuloNivel` y
`ExplicacionDelMotor` son componentes.

**Tres láminas, y ninguna más.**

- `.lamina`: la principal, en `--sup-1` con `--anillo`, `--elev-2` y
  `--radio-panel`. La usan la lámina de control de la evaluación y cada grupo de
  sesiones.
- `.lamina--lectura`: la que manda en el detalle, con `--radio-lamina` y
  `--elev-1`. Es «Análisis de la sesión».
- `.lamina--apoyo`: el segundo plano, en `--sup-2` con `--anillo` y sin
  elevación. Es el registro de eventos, con «Momentos para revisar» adentro.

Adentro de una lámina no hay más cajas: las métricas son renglones y los momentos
son un apartado.

**La marca de nivel.** `[data-nivel]` asigna `--tono` en `nivel.css`, y todo lo
que dice un nivel pinta con ese tono. La marca es un borde a la izquierda, con
dos anchos: `--marca-renglon` (3 px, la clase `.marca-nivel`) en la celda de la
lista y en los renglones del historial, y `--marca-tarjeta` (4 px) en las
tarjetas de alerta y del resumen. La fila destacada del registro usa el ancho de
renglón en `--tinta-media`, porque un evento no tiene nivel. `RotuloNivel`
es el único rótulo de nivel: el medidor, «Riesgo alto» en `--tinta` y, si hace
falta, una línea vertical y el origen. Las sesiones y las tarjetas sin nivel no
llevan marca ni fondo teñido.

**Los apartados.** `.apartado` agrupa lo que va dentro de una lámina, y
`.apartado__titulo` es su h3: 14 px, 600, en minúscula inicial, como una frase.
`.apartado__nota` es la línea suelta que acompaña.

**La escala de títulos.** `.lamina__titulo` (17 px, 600), `.apartado__titulo` (14
px, 600) y, adentro de una alerta, el rótulo de la lista que escribe el motor
(«Lo que más se notó», 13 px).

**La explicación del motor.** `ExplicacionDelMotor` es la única forma de mostrar
un texto del motor: el hecho en negrita, las notas con el ícono de información,
el rótulo de la lista y sus viñetas. Tiene dos variantes, `tarjeta` y `historial`, que
es un paso de letra más chica con la misma estructura.

**El botón de texto.** `.boton-texto` (13 px, 600, subrayado en
`--tinta-tenue`, fondo `--sup-3` al pasar) es «Ver», «Ver en el registro» y
«Quitar filtros». No pisa el anillo de foco.

**La escalera.** `.pasos` es la lista de pastillas de «Cómo cambió el riesgo»,
unidas por una flecha chica oculta para los lectores de pantalla.

**Las mayúsculas espaciadas** van solo en los encabezados de columna de la tabla
de la lista y en los rótulos de los controles de la barra de filtros. En el
detalle no se usan nunca.

**La escala del panel** es fija, con `--panel-*`: `--panel-pieza` (17 px, títulos
de lámina), `--panel-cuerpo` (14), `--panel-fila` (13), `--panel-nota` (12),
`--panel-rotulo` (11) y `--panel-cifra` (28 px, el número de las tarjetas del
resumen).

**El movimiento** usa solo `--mov-estado`, `--mov-entrada` y `--curva`, que
valen 0 con movimiento reducido.

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

Las cinco primeras se chequean con un grep sobre las hojas del panel. La sexta y
la séptima las comprueba `src/estilos.test.ts`, junto con que nadie apague el
contorno del foco. La octava la cuidan las pruebas del detalle y de la lista.

1. Ninguna línea horizontal de separación.
2. Ningún color literal fuera de los tokens.
3. El celeste solo en acción o estado activo.
4. Ninguna transición sobre `all`: todas enumeran su propiedad.
5. Ninguna declaración de fuente propia.
6. `--tono` solo se asigna en `nivel.css`.
7. Ninguna duración literal en `transition`: solo `--mov-*` y `--curva`.
8. Cada dato completo en un solo lugar: el nivel vigente y su explicación en la
   tarjeta, cómo cambió el nivel en la escalera, las explicaciones pasadas en el
   historial, los estados sin alertas en el veredicto y el total filtrado en «N de
   M sesiones».

La lista de control de accesibilidad (R1 a R15) está en
[`sistema-visual.md`](sistema-visual.md#lista-de-control-de-accesibilidad).
