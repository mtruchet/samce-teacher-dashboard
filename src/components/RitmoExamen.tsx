import "./RitmoExamen.css";

/**
 * Lo que ve el modelo: un intento entero contra el ritmo que esperaba.
 *
 * Es el gráfico propio de la detección de anomalías, y es el único que explica
 * el argumento del sistema sin una sola palabra técnica: hay un corredor de lo
 * esperado, el intento va por adentro casi todo el examen, y en cuatro minutos
 * se sale por abajo y por arriba.
 *
 * Las tres señales sueltas (minutos 6, 19 y 47) quedan adentro del corredor a
 * propósito. Esa es la diferencia entre contar acciones y mirar el conjunto.
 */

const DURACION = 52;

/* Actividad de escritura por minuto. Los valores vienen del intento de ejemplo
   que la landing usa en todas sus piezas. */
const ACTIVIDAD = [
  30, 45, 52, 58, 55, 60, 48, 62, 58, 65, 60, 57, 63, 59, 66, 61, 58, 64, 60,
  44, 58, 62, 59, 64, 60, 57, 63, 61, 58, 62, 59, 65, 60, 56, 8, 118, 104, 72,
  60, 57, 63, 59, 62, 58, 64, 60, 57, 46, 61, 58, 63, 59, 55,
];

const ESPERADO = { piso: 32, techo: 88 };
const TRAMO = { desde: 33, hasta: 38 };

const ANCHO = 560;
const ALTO = 210;
const MARGEN = { arriba: 16, abajo: 34 };
const TOPE = 130;

const x = (min: number) => (min / DURACION) * ANCHO;
const y = (valor: number) =>
  ALTO - MARGEN.abajo - (valor / TOPE) * (ALTO - MARGEN.arriba - MARGEN.abajo);

const trazo = (desde: number, hasta: number) =>
  ACTIVIDAD.slice(desde, hasta + 1)
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(desde + i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

const FUERA = [34, 35, 36];

/* Las tres señales sueltas del intento. Quedan adentro del corredor, y por eso
   hay que dibujarlas: sin ellas, la afirmación central de la sección no se ve. */
const SUELTAS = [6, 19, 47];

export function RitmoExamen() {
  return (
    <figure className="ritmo">
      <figcaption className="ritmo__encabezado">
        <span className="ritmo__titulo">Un intento completo</span>
        <span className="ritmo__duracion cifra">52 minutos</span>
      </figcaption>

      <svg
        className="ritmo__grafico"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-labelledby="ritmo-descripcion"
      >
        <title id="ritmo-descripcion">
          Actividad de escritura durante un examen de 52 minutos. El intento se mantiene dentro
          del ritmo que el modelo esperaba, salvo entre el minuto 34 y el 37, donde primero cae a
          cero y después se dispara muy por encima. Las señales de los minutos 6, 19 y 47 quedan
          dentro de ese ritmo y no disparan ninguna alerta.
        </title>

        {/* El corredor de lo esperado */}
        <rect
          className="ritmo__corredor"
          x="0"
          y={y(ESPERADO.techo)}
          width={ANCHO}
          height={y(ESPERADO.piso) - y(ESPERADO.techo)}
          rx="4"
        />

        {/* El intento, primero entero y después el tramo que se sale */}
        <path className="ritmo__linea" d={trazo(0, DURACION)} />
        <path className="ritmo__linea ritmo__linea--fuera" d={trazo(TRAMO.desde, TRAMO.hasta)} />

        {SUELTAS.map((min) => (
          <circle key={min} className="ritmo__suelta" cx={x(min)} cy={y(ACTIVIDAD[min])} r="3" />
        ))}

        {FUERA.map((min) => (
          <circle key={min} className="ritmo__punto" cx={x(min)} cy={y(ACTIVIDAD[min])} r="4.5" />
        ))}

        {/* La anotación: sale del pico y nombra el tramo. */}
        <path
          className="ritmo__guia"
          d={`M ${x(35) + 8} ${y(ACTIVIDAD[35]) - 2} L ${x(41)} ${y(ACTIVIDAD[35]) - 14}`}
        />
        <text className="ritmo__anotacion" x={x(41) + 4} y={y(ACTIVIDAD[35]) - 11}>
          minuto 34 a 37
        </text>

        {/* La regla de minutos, sin línea de eje */}
        {[0, 13, 26, 39, 52].map((min) => (
          <text
            key={min}
            className="ritmo__minuto"
            x={x(min)}
            y={ALTO - 8}
            textAnchor={min === 0 ? "start" : min === DURACION ? "end" : "middle"}
          >
            {min}
          </text>
        ))}
      </svg>

      <p className="ritmo__leyenda">
        <span className="ritmo__clave ritmo__clave--corredor">El ritmo que el modelo esperaba</span>
        <span className="ritmo__clave ritmo__clave--suelta">
          Señales sueltas que no alcanzan para una alerta
        </span>
        <span className="ritmo__clave ritmo__clave--fuera">Los cuatro minutos que se salen</span>
      </p>
    </figure>
  );
}
