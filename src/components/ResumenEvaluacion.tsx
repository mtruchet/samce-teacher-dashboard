import { ESTADOS_SIN_ALERTAS, NIVELES } from "../lenguajeAlerta";
import { NIVELES_FILTRO, type FiltrosSesiones } from "../filtrosDeLaDireccion";
import type { NivelDeRiesgo, ResumenDeEvaluacion } from "../services/sesionesService";
import { RotuloNivel } from "./RotuloNivel";
import "./ResumenEvaluacion.css";

type EstadoDeAnalisis = NonNullable<FiltrosSesiones["analisis"]>;

/** El campo del resumen que cuenta cada nivel. */
const CAMPO_DEL_NIVEL: Record<NivelDeRiesgo, keyof ResumenDeEvaluacion> = {
  high: "risk_high",
  medium: "risk_medium",
  low: "risk_low",
};

/** Las tarjetas de estado, en orden fijo: no depende de los números. */
const TARJETAS_DE_ESTADO: Array<{ analisis: EstadoDeAnalisis; rotulo: string }> = [
  { analisis: "no_alerts", rotulo: ESTADOS_SIN_ALERTAS.analyzed },
  { analisis: "not_analyzed", rotulo: ESTADOS_SIN_ALERTAS.not_analyzed },
  { analisis: "insufficient_evidence", rotulo: ESTADOS_SIN_ALERTAS.insufficient_evidence },
  { analisis: "unavailable", rotulo: ESTADOS_SIN_ALERTAS.unavailable },
];

const sesiones = (n: number) => (n === 1 ? "1 sesión" : `${n} sesiones`);

/** Lo que borra una tarjeta al elegirse: los demás filtros, así la lista muestra justo las que cuenta. */
const SOLO_ESTA = { nivel: undefined, estado: undefined, analisis: undefined, q: undefined };

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
 * orden de las tarjetas es fijo. Va dentro de la lámina de control, sin lámina propia.
 *
 * Cada tarjeta es un camino al mismo filtro que la barra:
 * - queda marcada mientras su filtro está en la dirección, aunque haya otros (el selector de nivel y la
 *   tarjeta se reflejan entre sí);
 * - tocar una sin marcar deja solo su filtro y conserva el orden, así «N de M sesiones» coincide con el
 *   número de la tarjeta;
 * - tocar la marcada borra solo su filtro.
 *
 * Los niveles llevan la marca de todo el panel (`RotuloNivel`, con los tonos de las alertas), siempre con la
 * palabra y el número, para que no dependan solo del color. Los estados van en un renglón más liviano, sin
 * marca ni tono. No es una región viva: los números cambian en silencio con cada actualización.
 */
export function ResumenEvaluacion({ resumen, filtros, onFiltrar }: Props) {
  return (
    <section className="resumen" aria-labelledby="resumen-titulo">
      <h2 id="resumen-titulo" className="lamina__titulo">
        Resumen de la evaluación
      </h2>
      <div className="resumen__tarjetas resumen__tarjetas--niveles">
        {NIVELES_FILTRO.map((nivel) => {
          const elegida = filtros.nivel === nivel;
          const n = resumen[CAMPO_DEL_NIVEL[nivel]];
          return (
            <button
              key={nivel}
              type="button"
              className={`resumen__tarjeta resumen__tarjeta--${nivel}`}
              data-nivel={nivel}
              aria-pressed={elegida}
              aria-label={`${NIVELES[nivel]}: ${sesiones(n)}`}
              onClick={() => onFiltrar(elegida ? { nivel: undefined } : { ...SOLO_ESTA, nivel })}
            >
              <span className="resumen__numero cifra">{n}</span>
              <RotuloNivel nivel={nivel} />
            </button>
          );
        })}
      </div>
      <div className="resumen__tarjetas resumen__tarjetas--estados">
        {TARJETAS_DE_ESTADO.map(({ analisis, rotulo }) => {
          const elegida = filtros.analisis === analisis;
          const n = resumen[analisis];
          return (
            <button
              key={analisis}
              type="button"
              className="resumen__tarjeta resumen__tarjeta--estado"
              aria-pressed={elegida}
              aria-label={`${rotulo}: ${sesiones(n)}`}
              onClick={() => onFiltrar(elegida ? { analisis: undefined } : { ...SOLO_ESTA, analisis })}
            >
              <span className="resumen__numero cifra">{n}</span>
              <span className="resumen__rotulo">{rotulo}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
