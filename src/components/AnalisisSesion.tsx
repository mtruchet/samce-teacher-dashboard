import { useEffect, useRef, useState } from "react";
import { horaExacta } from "../eventos";
import { recienCerrada } from "../seguimiento";
import {
  CADENCIA_MS,
  SesionVencida,
  traerAnalisis,
  type AlertaDeSesion,
  type Analisis,
  type SesionNumerada,
} from "../services/sesionesService";
import "./AnalisisSesion.css";

/**
 * El apartado «Análisis de la sesión» (SAMCE-36): las alertas vigentes y cómo está el análisis.
 *
 * Va aparte del registro de eventos, que cuenta lo que pasó; acá se lee lo que el análisis
 * encontró. Es la versión mínima: muestra el estado, la hora del último cálculo y las
 * alertas con su nivel y su explicación. No muestra el índice de integridad, las métricas,
 * el historial ni la cronología.
 *
 * Mientras la sesión sigue abierta, y unos minutos después de la entrega, vuelve a preguntar
 * cada pocos segundos: el análisis se recalcula con cada tanda de eventos, y una alerta puede
 * aparecer o subir de nivel mientras el docente mira.
 *
 * Una alerta es una señal para revisar, no una conclusión sobre el alumno: la explicación
 * describe lo observado sin atribuir intención, y el apartado lo aclara cuando hay alertas.
 */

const NIVELES: Record<AlertaDeSesion["level"], string> = {
  low: "Nivel bajo",
  medium: "Nivel medio",
  high: "Nivel alto",
};

const ORIGENES: Record<AlertaDeSesion["origin"], string> = {
  model: "Por el comportamiento de toda la sesión",
  event: "Por un solo hecho puntual",
};

interface Props {
  sesion: SesionNumerada;
  /** El token dejó de valer: no se arregla reintentando, lo resuelve el panel. */
  onVencida: () => void;
}

function Estado({ analisis }: { analisis: Analisis }) {
  const hayAlertas = analisis.alerts.length > 0;
  switch (analisis.state) {
    case "not_analyzed":
      return <p className="analisis__estado">Todavía no se analizó esta sesión.</p>;
    case "analyzed":
      return (
        <p className="analisis__estado">
          {hayAlertas
            ? "La sesión se analizó y tiene alertas."
            : "La sesión se analizó y no tiene alertas."}
        </p>
      );
    case "insufficient_evidence":
      return (
        <p className="analisis__estado">
          No hay evidencia suficiente para analizar esta sesión.
          {analisis.reason ? <span className="analisis__motivo"> {analisis.reason}</span> : null}
        </p>
      );
    default:
      return (
        <p className="analisis__estado">
          El análisis de esta sesión no está disponible.
          {analisis.reason ? <span className="analisis__motivo"> {analisis.reason}</span> : null}
        </p>
      );
  }
}

export function AnalisisSesion({ sesion, onVencida }: Props) {
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  // El aviso de vencida va en una referencia: el panel se redibuja con cada respuesta de su
  // propia consulta y le pasa una función nueva cada vez, y si el efecto dependiera de ella
  // se reiniciaría en cada redibujo.
  const alVencer = useRef(onVencida);
  useEffect(() => {
    alVencer.current = onVencida;
  });

  const examenId = sesion.examenId;
  const sesionId = sesion.id;
  const abierta = sesion.status === "open";
  const cierre = sesion.closed_at;

  useEffect(() => {
    let vigente = true;
    let proxima: number | undefined;

    const ciclo = async () => {
      try {
        const respuesta = await traerAnalisis(examenId, sesionId);
        if (!vigente) return;
        setAnalisis(respuesta);
        setSinConexion(false);
      } catch (error) {
        if (!vigente) return;
        if (error instanceof SesionVencida) {
          alVencer.current();
          return;
        }
        // Se conserva lo último que llegó y se avisa: seguir mostrándolo como si fuera de
        // ahora sería mentir.
        setSinConexion(true);
      }
      if (abierta || recienCerrada(cierre)) proxima = window.setTimeout(ciclo, CADENCIA_MS);
    };
    void ciclo();
    return () => {
      vigente = false;
      window.clearTimeout(proxima);
    };
  }, [examenId, sesionId, abierta, cierre]);

  return (
    <section className="analisis" aria-labelledby="analisis-titulo">
      <header className="analisis__encabezado">
        <h2 className="analisis__titulo" id="analisis-titulo">Análisis de la sesión</h2>
        {analisis?.calculated_at ? (
          <span className="analisis__calculo cifra">
            último cálculo a las {horaExacta(analisis.calculated_at)}
          </span>
        ) : null}
      </header>

      {sinConexion ? (
        <p className="analisis__aviso" role="status">
          {analisis
            ? "No se pudo actualizar el análisis. Lo que se ve es lo último que llegó."
            : "No se pudo traer el análisis de esta sesión."}
        </p>
      ) : null}

      {analisis === null ? (
        sinConexion ? null : <p className="analisis__estado" role="status">Cargando el análisis…</p>
      ) : (
        <>
          <Estado analisis={analisis} />
          {analisis.alerts.length > 0 ? (
            <>
              <ul className="analisis__alertas">
                {analisis.alerts.map((alerta) => (
                  <li key={alerta.origin} className={`analisis__alerta analisis__alerta--${alerta.level}`}>
                    <div className="analisis__cabeza">
                      <span className={`analisis__nivel analisis__nivel--${alerta.level}`}>
                        {NIVELES[alerta.level]}
                      </span>
                      <span className="analisis__origen">{ORIGENES[alerta.origin]}</span>
                    </div>
                    <p className="analisis__explicacion">{alerta.explanation}</p>
                  </li>
                ))}
              </ul>
              <p className="analisis__nota">
                Una alerta señala algo para revisar; no es una conclusión sobre el alumno.
              </p>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
