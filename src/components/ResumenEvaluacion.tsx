import { ESTADOS_SIN_ALERTAS, NIVELES } from "../lenguajeAlerta";
import type { FiltrosSesiones, ResumenDeEvaluacion } from "../services/sesionesService";
import { MedidorNivel } from "./MedidorNivel";
import "./ResumenEvaluacion.css";

type Nivel = NonNullable<FiltrosSesiones["nivel"]>;
type EstadoDeAnalisis = NonNullable<FiltrosSesiones["analisis"]>;

/** Las tarjetas, en orden fijo: no depende de los números. Primero los niveles, después los estados. */
const TARJETAS_DE_NIVEL: Array<{ nivel: Nivel; campo: keyof ResumenDeEvaluacion }> = [
  { nivel: "high", campo: "risk_high" },
  { nivel: "medium", campo: "risk_medium" },
  { nivel: "low", campo: "risk_low" },
];

const TARJETAS_DE_ESTADO: Array<{ analisis: EstadoDeAnalisis; campo: keyof ResumenDeEvaluacion; rotulo: string }> = [
  { analisis: "no_alerts", campo: "no_alerts", rotulo: ESTADOS_SIN_ALERTAS.analyzed },
  { analisis: "not_analyzed", campo: "not_analyzed", rotulo: ESTADOS_SIN_ALERTAS.not_analyzed },
  { analisis: "insufficient_evidence", campo: "insufficient_evidence", rotulo: ESTADOS_SIN_ALERTAS.insufficient_evidence },
  { analisis: "unavailable", campo: "unavailable", rotulo: ESTADOS_SIN_ALERTAS.unavailable },
];

const sesiones = (n: number) => (n === 1 ? "1 sesión" : `${n} sesiones`);

interface Props {
  resumen: ResumenDeEvaluacion;
  /** Los filtros vigentes: la tarjeta del filtro elegido queda marcada. */
  filtros: FiltrosSesiones;
  /** La misma función que usa la barra de filtros: escribe en la dirección de la página. */
  onFiltrar: (parciales: Partial<FiltrosSesiones>) => void;
}

/**
 * El resumen de la evaluación (HU03): cuántas sesiones hay en cada nivel de riesgo y, las que no tienen
 * alertas, en cada estado del análisis, para ver de un vistazo cómo está el examen sin entrar a cada
 * sesión. Cuenta toda la evaluación, no la página ni el filtro.
 *
 * Son recuentos, no una lista ordenada ni un puesto uno: sin nombres, sin índice y sin promedios, y el
 * orden de las tarjetas es fijo. Cada tarjeta lleva a las sesiones que cuenta: al tocarla deja solo su
 * filtro (conserva el orden elegido), y al tocarla de nuevo vuelve a la evaluación completa.
 *
 * Los niveles van con los tonos de las alertas, como en la lista y el detalle, siempre con la palabra, el
 * número y el medidor al lado, para que no dependan solo del color. No es una región viva: los números cambian
 * en silencio con cada actualización.
 */
export function ResumenEvaluacion({ resumen, filtros, onFiltrar }: Props) {
  const soloNivel = (nivel: Nivel) =>
    filtros.nivel === nivel && !filtros.estado && !filtros.analisis && !filtros.q;
  const soloEstado = (analisis: EstadoDeAnalisis) =>
    filtros.analisis === analisis && !filtros.nivel && !filtros.estado && !filtros.q;
  const limpio = { nivel: undefined, estado: undefined, analisis: undefined, q: undefined };

  return (
    <section className="resumen" aria-labelledby="resumen-titulo">
      <h2 id="resumen-titulo" className="resumen__titulo">
        Resumen de la evaluación
      </h2>
      <div className="resumen__tarjetas">
        {TARJETAS_DE_NIVEL.map(({ nivel, campo }) => {
          const elegida = soloNivel(nivel);
          return (
            <button
              key={nivel}
              type="button"
              className={`resumen__tarjeta resumen__tarjeta--${nivel}`}
              data-nivel={nivel}
              aria-pressed={elegida}
              aria-label={`${NIVELES[nivel]}: ${sesiones(resumen[campo])}`}
              onClick={() => onFiltrar(elegida ? limpio : { ...limpio, nivel })}
            >
              <span className="resumen__numero cifra">{resumen[campo]}</span>
              <span className="resumen__rotulo">
                <MedidorNivel nivel={nivel} />
                {NIVELES[nivel]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="resumen__tarjetas">
        {TARJETAS_DE_ESTADO.map(({ analisis, campo, rotulo }) => {
          const elegida = soloEstado(analisis);
          return (
            <button
              key={analisis}
              type="button"
              className="resumen__tarjeta resumen__tarjeta--estado"
              aria-pressed={elegida}
              aria-label={`${rotulo}: ${sesiones(resumen[campo])}`}
              onClick={() => onFiltrar(elegida ? limpio : { ...limpio, analisis })}
            >
              <span className="resumen__numero cifra">{resumen[campo]}</span>
              <span className="resumen__rotulo">{rotulo}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
