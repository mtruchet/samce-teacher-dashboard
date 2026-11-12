import { METRICAS, valorDeMetrica } from "../metricas";
import type { EstadoDelAnalisis, Metricas } from "../services/sesionesService";

interface Props {
  metricas: Metricas | null | undefined;
  estado: EstadoDelAnalisis;
  /** La sesión sigue abierta: las métricas son de toda la sesión y recién existen al terminar. */
  abierta: boolean;
  /** El veredicto ya dice que el análisis no está disponible: no se repite acá. */
  veredictoDiceNoDisponible: boolean;
}

/**
 * Las métricas observadas durante toda la sesión (HU05, criterio 1): una por dimensión, en lenguaje llano, con
 * el valor del propio alumno. Sin valor esperado, sin comparación con otras sesiones, sin barras, sin
 * porcentajes y sin cajas: un rótulo y su valor, con una guía fina a la izquierda.
 *
 * Los valores, solo con la sesión finalizada y analizada. Si la sesión no se pudo analizar o todavía no se
 * analizó, el apartado no se dibuja: el veredicto ya lo dice, y las métricas quedarían cerca de cero y
 * engañarían. Si el análisis no está disponible, tampoco, salvo que el veredicto no lo haya dicho.
 */
export function MetricasSesion({ metricas, estado, abierta, veredictoDiceNoDisponible }: Props) {
  if (estado === "insufficient_evidence" || estado === "not_analyzed") return null;
  if (estado === "unavailable" && veredictoDiceNoDisponible) return null;

  let contenido;
  if (abierta) {
    contenido = <p className="apartado__nota">Las métricas se muestran cuando la sesión termina.</p>;
  } else if (estado !== "analyzed" || !metricas) {
    contenido = <p className="apartado__nota">Las métricas no están disponibles para esta sesión.</p>;
  } else {
    contenido = (
      <dl className="metricas">
        {METRICAS.map((m) => (
          <div key={m.clave} className="metricas__metrica" data-clave={m.clave}>
            <dt className="metricas__rotulo">{m.rotulo}</dt>
            <dd className="metricas__valor cifra">{valorDeMetrica(m, metricas)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div className="apartado">
      <h3 className="apartado__titulo">Métricas de la sesión</h3>
      {contenido}
    </div>
  );
}
