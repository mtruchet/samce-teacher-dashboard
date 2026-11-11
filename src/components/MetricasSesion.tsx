import { METRICAS, valorDeMetrica } from "../metricas";
import type { EstadoDelAnalisis, Metricas } from "../services/sesionesService";

interface Props {
  metricas: Metricas | null | undefined;
  estado: EstadoDelAnalisis;
  /** La sesión sigue abierta: las métricas son de toda la sesión y recién existen al terminar. */
  abierta: boolean;
}

/**
 * Las métricas observadas durante toda la sesión (HU05, criterio 1): una por dimensión, en lenguaje llano,
 * con el valor del propio alumno. Sin valor esperado, sin comparación con otras sesiones, sin barras y sin
 * porcentajes. Solo con la sesión finalizada y analizada: si no se pudo analizar, no se muestra ninguna,
 * aunque el servidor las mandara, porque quedarían cerca de cero y engañarían.
 */
export function MetricasSesion({ metricas, estado, abierta }: Props) {
  let contenido;
  if (abierta) {
    contenido = <p className="detalle-analisis__nota">Las métricas se muestran cuando la sesión termina.</p>;
  } else if (estado === "insufficient_evidence") {
    contenido = <p className="detalle-analisis__nota">Esta sesión no se pudo analizar.</p>;
  } else if (!metricas) {
    contenido = <p className="detalle-analisis__nota">Las métricas no están disponibles para esta sesión.</p>;
  } else {
    contenido = (
      <dl className="detalle-analisis__metricas">
        {METRICAS.map((m) => (
          <div key={m.clave} className="detalle-analisis__metrica">
            <dt>
              <span className="detalle-analisis__dimension">{m.dimension}</span>
              <span>{m.rotulo}</span>
            </dt>
            <dd className="cifra">{valorDeMetrica(m, metricas)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div className="detalle-analisis__parte">
      <h3 className="detalle-analisis__subtitulo">Métricas de la sesión</h3>
      {contenido}
    </div>
  );
}
