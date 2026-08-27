# Sistema visual del panel docente

Investigación y decisiones de estética. El objetivo es un panel limpio, simple, informativo y con identidad propia, que no se vea como una plantilla de administración más.

---

## 1. El punto de partida: qué tiene que comunicar

Antes de elegir una tipografía o un color conviene fijar qué debe transmitir la interfaz, porque de ahí sale todo lo demás.

El SAMCE muestra evidencia sobre la conducta de personas durante un examen. El propio proyecto establece que **las alertas son información de apoyo, no sanciones automáticas**, y que la no invasividad es su criterio rector. Eso tiene una consecuencia estética directa: **el panel no puede verse como una herramienta de vigilancia**. Nada de rojos de alarma por todas partes, nada de estética de sala de control, nada de lenguaje que dé por culpable a nadie.

La investigación académica sobre paneles de analítica educativa refuerza esto. La aceptación de estas herramientas depende de que el propósito pedagógico se perciba como legítimo, y se recomienda presentar **indicadores concisos a nivel de sesión** en lugar de volcar datos crudos, porque eso reduce la intrusión sin quitarle utilidad al docente.

Traducido a decisiones: pocos números, bien elegidos y bien explicados. Un tono sobrio y profesional, más cercano a un instrumento de medición que a un tablero de seguridad.

---

## 2. Tipografía

### Por qué importa más de lo que parece

La tipografía es hoy **el principal elemento que separa un diseño con identidad de uno genérico**. Es lo más resistente a la salida automática, porque una combinación distintiva de familia, escala y espaciado requiere criterio. La contracara es que casi toda interfaz moderna usa Inter o la fuente del sistema, y eso produce el aire de plantilla que queremos evitar.

Hay una tensión real: Inter es objetivamente excelente para datos, y a la vez es la más vista.

### Lo que un panel de datos necesita

Tres condiciones técnicas, independientemente del gusto:

**Cifras tabulares.** Que todos los números ocupen el mismo ancho, para que las columnas queden alineadas y no bailen al actualizarse. En un panel que refresca en tiempo cuasi real, sin esto los números tiemblan.

**Altura de equis generosa.** Que las minúsculas sean altas respecto de las mayúsculas, para que las etiquetas pequeñas se lean sin agrandar todo.

**Formas inequívocas.** Que se distingan el uno, la ele y la i mayúscula, y el cero de la o. En una pantalla que muestra legajos, confundir un cero con una o es un problema real.

### Propuesta

**IBM Plex Sans** para todo. Una sola familia en todo el sistema.

El razonamiento: fue diseñada específicamente para interfaces donde la exactitud de los datos importa, y resuelve bien el caso de los caracteres confundibles a tamaño chico. Tiene cifras tabulares. Y tiene algo que Inter deliberadamente no tiene: **carácter propio**. Sus detalles la hacen reconocible sin volverla decorativa, que es exactamente el punto medio que necesitamos.

Los identificadores y los códigos se alinean en columna con las cifras tabulares de la misma familia (`font-variant-numeric: tabular-nums`, la clase `.cifra`). Una segunda tipografía para eso sumaba peso al bundle y otra escala que mantener, sin resolver nada que la primera no resolviera.

La familia completa incluye además una variante con serifas, útil si más adelante hace falta un registro más institucional para documentos exportados.

**Alternativa a considerar:** si se prefiere alinear con el Campus Virtual, ese sitio usa Roboto y Open Sans. Ganaría coherencia institucional, pero son dos de las tipografías más usadas del mundo y el panel se vería considerablemente más común.

### Escala

Un error habitual es usar la misma proporción entre todos los tamaños. Conviene una escala con saltos deliberados: un salto grande entre el título de la página y el resto, y saltos chicos dentro del contenido. Eso crea jerarquía sin necesidad de recargar.

Para el texto grande de la página pública hay que **reducir el espaciado entre letras**, porque el espaciado por defecto, pensado para tamaños de lectura, queda suelto en titulares.

---

## 3. Color

### El problema del semáforo

El impulso natural para tres niveles de riesgo es verde, amarillo y rojo. Es una mala idea por dos razones independientes.

**Accesibilidad.** El rojo y el verde son precisamente la combinación que no distingue la forma más común de daltonismo, que afecta a alrededor de uno de cada doce varones. Un docente con esa condición vería dos estados idénticos.

**Tono.** El rojo de alarma contradice el planteo del proyecto. Un nivel alto no significa que alguien copió: significa que conviene mirar esa sesión.

### El criterio correcto

Los niveles tienen que distinguirse **por luminosidad, no solo por tono**. La prueba práctica es convertir la interfaz a escala de grises: si los tres niveles siguen siendo distinguibles, funciona.

Y el color **nunca puede ser el único portador del significado**. Cada nivel lleva además su etiqueta escrita y su icono. Así funciona para quien no distingue colores, para quien imprime en blanco y negro, y para quien mira la pantalla de reojo.

La combinación segura para todos los tipos de daltonismo es azul y naranja, no rojo y verde.

### Propuesta

Una escala de un solo tono que se intensifica, en lugar de tres colores distintos:

| Nivel | Tratamiento | Icono | Luminosidad |
|---|---|---|---|
| Bajo | Fondo muy claro, texto oscuro, sin borde | Círculo | Muy alta |
| Medio | Fondo tenue con borde definido | Círculo con punto | Media |
| Alto | Fondo saturado, texto claro, borde marcado | Círculo con anillo | Baja |

Esto se lee como una progresión de intensidad, que es exactamente lo que un índice de integridad es. Y evita el gesto de "esto está mal" que carga el rojo.

**Color de marca:** el celeste institucional del Campus Virtual, `#008cb2`. No es una elección arbitraria ni genérica: es el color real de la casa. Da coherencia con el entorno del que el docente viene, y ancla el panel en la institución en lugar de en cualquier plantilla.

Para el énfasis y las acciones, el azul profundo del pie del campus, `#114C5E`, funciona como color de apoyo.

El naranja queda reservado para lo que requiere atención, sin ser una falla.

---

## 4. Iconos

Tres familias serias, con perfiles distintos:

**Lucide** es la más extendida y viene por defecto con el conjunto de componentes más popular. Precisamente por eso es la que más contribuye al aire genérico.

**Tabler** está pensada para paneles de administración, con trazo consistente y algo más fino, lo que da una sensación más liviana.

**Phosphor** ofrece seis pesos por icono, desde muy fino hasta relleno, además de una variante de dos tonos. Esa variedad permite construir jerarquía con los propios iconos: finos para lo secundario, rellenos para lo que importa.

**Propuesta: Phosphor**, en peso regular como base y relleno para los estados activos. La razón no es el tamaño del catálogo sino los pesos: dan una herramienta de jerarquía que las otras no tienen, y alejan el resultado del aspecto por defecto.

**Regla de uso:** los iconos acompañan al texto, no lo reemplazan. Un icono solo, sin etiqueta, obliga a adivinar. La única excepción razonable son las acciones universalmente conocidas.

---

## 5. Lo que separa un diseño cuidado de uno genérico

Cinco cosas concretas, que valen más que cualquier elección de paleta:

**Espaciado con intención.** El sello del diseño automático es que todo tiene el mismo relleno y el mismo redondeo. Un sistema real varía deliberadamente: más aire alrededor de lo importante, menos entre elementos relacionados. El espacio en blanco agrupa mejor que las líneas divisorias.

**Restricción.** Lo simple se percibe como más cuidado que lo decorado. Menos bordes, menos sombras, menos cajas dentro de cajas. Si algo se puede quitar sin perder claridad, se quita.

**Jerarquía por tamaño y peso, no por color.** El color se reserva para el significado, que en este panel es el nivel de riesgo. Si además se usa para decorar, el significado se diluye.

**Asimetría cuando ayuda.** Todo centrado y en cuadrícula perfecta se ve inerte. Romper la simetría donde mejora la lectura da vida sin costar usabilidad.

**Movimiento breve y con motivo.** Una transición corta al cambiar de estado ayuda a entender qué pasó. La animación decorativa sobra, y en un panel que se actualiza solo, molesta.

---

## 6. La página pública

Es la primera impresión del proyecto y la que se muestra en la defensa, así que merece más cuidado que una pantalla interna.

Una idea que la diferencia: **mostrar el sistema en lugar de describirlo**. En vez de un bloque de texto explicando qué es un índice de integridad, una muestra real de cómo se ve una sesión en el panel, con datos de ejemplo. Se entiende en dos segundos lo que tres párrafos no logran.

El bloque de lo que el sistema **no** hace merece tratamiento visual propio, no una lista al pie. Es el argumento diferencial del proyecto frente a las herramientas de supervisión invasivas, y conviene que se vea.

Sobre el fondo: los degradados suaves y las formas geométricas grandes son el recurso más usado y el más reconocible como plantilla. Un fondo sobrio con una sola idea gráfica fuerte rinde más.

---

## 7. Decisiones a tomar

| Decisión | Propuesta | Alternativa |
|---|---|---|
| Tipografía | IBM Plex Sans | Roboto y Open Sans, por coherencia con el campus |
| Color de marca | Celeste institucional `#008cb2` | Una paleta propia del producto |
| Niveles de riesgo | Escala de intensidad de un tono | Semáforo tradicional, con sus problemas |
| Iconos | Phosphor | Tabler, si se prefiere trazo más fino |
| Componentes | A definir | Escribir los estilos a mano |

La última es la que más conviene resolver antes de escribir pantallas, porque condiciona todo lo que venga después.

---

## Refinamiento de agosto: de landing a documento

Tras relevar galerías de referencia, portales universitarios y sistemas de diseño
institucionales, se aplicaron los siguientes cambios. El diagnóstico de partida fue que la
página estaba bien hecha dentro del género equivocado: su unidad de sentido era el
desplazamiento, cuando debía ser el documento.

**Cuerpo a 19 píxeles, no 16.** Es la decisión de GOV.UK y se nota: el mismo texto se lee
notoriamente más institucional. Las interlíneas van en múltiplos de cinco para que haya un solo
ritmo vertical en toda la página.

**Escala tipográfica fluida declarada por paso**, no por píxel ni por puntos de corte. Los
tamaños se interpolan entre dos extremos, así el resultado no se rompe en la pantalla de una
notebook durante una defensa.

**Tracking escalonado por tamaño.** Los títulos grandes llevan tracking negativo, el cuerpo
nunca. Es lo que separa una tipografía puesta de una compuesta.

**La escalera de superficies.** Cinco escalones derivados del mismo azul institucional. Las
secciones alternan entre ellos, y la banda oscura dejó de ser un elemento aparte para pasar a
ser el extremo de esa escalera. Es lo que separa las secciones sin una sola línea.

**Guías verticales.** La prohibición es de líneas horizontales, así que las verticales quedan
disponibles: separan columnas y dan armazón de grilla. Es el mismo criterio del sistema Geist.

**Elevación en capas con una sola fuente de luz.** Tres niveles, cada uno apilando varias
sombras con desplazamiento horizontal cero y opacidad baja, tintadas hacia el azul y nunca
hacia el negro. Las capturas llevan además un anillo interior semitransparente en lugar de un
borde gris sólido, porque el anillo se adapta al fondo sobre el que esté.

**Cabecera de dos filas que se contrae.** La institucional arriba, la de servicio abajo con la
navegación y el acceso. El acceso vive ahí y está disponible siempre, en vez de ser la
recompensa de llegar al final.

**Estado de sección activa.** La navegación marca cuál se está mirando. Es lo que distingue una
barra de navegación real de un puñado de enlaces, y necesita `scroll-margin-top` en cada
destino para que el título no quede tapado al saltar.

**Pie-directorio de cuatro columnas.** Ninguno de los portales relevados cierra repitiendo el
botón del encabezado: cierran con un directorio. Incluye los responsables reales del proyecto,
los datos de la facultad y la fecha de última actualización, que es la señal más barata de que
hay alguien detrás.

**Epígrafes de procedencia.** Cada captura dice qué es, de dónde salió y con qué versión. Es lo
que convierte una ilustración en un documento.

**Presupuesto de movimiento corto y explícito.** Ciento cuarenta milisegundos para cambios de
estado, doscientos veinte para entradas, nada por encima de trescientos. Las transiciones
enumeran sus propiedades y nunca usan el atajo que las abarca todas.

**Desplazamiento suave solo para quien no pidió movimiento reducido.** Un desplazamiento
animado largo puede provocar mareo real a personas con trastorno vestibular. En un sistema cuyo
argumento es el respeto, esto no es opcional.

**Anillo de foco de dos capas**, con la capa interior del color de la superficie para que se
recorte contra cualquier fondo, incluido el oscuro.
