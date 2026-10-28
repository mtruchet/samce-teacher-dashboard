import { useEffect, useRef, useState } from "react";
import { horaExacta } from "../eventos";
import { ordenarExplicacion } from "../explicacion";
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
 * describe lo observado sin atribuir intención y termina diciéndolo.
 *
 * La explicación llega del motor con un renglón por cosa y acá se ordena (`ordenarExplicacion`):
 * el titular, las variables que más pesaron en una tabla chica —qué se midió, qué pasó en esta
 * sesión y qué se espera— y la aclaración al final, más discreta. Una explicación sin ese
 * formato se muestra entera como párrafo.
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

function Alerta({ alerta }: { alerta: AlertaDeSesion }) {
  const e = ordenarExplicacion(alerta.explanation);
  const hayLista = e.variables.length > 0 || e.viñetasSinForma.length > 0;
  // Una explicación sin estructura (una alerta guardada en un solo párrafo) no tiene un titular: se
  // muestra como texto común y no en grande y en negrita.
  const sinEstructura = e.detalle.length === 0 && !hayLista && e.despues.length === 0 && e.cierre === null;
  return (
    <li className={`analisis__alerta analisis__alerta--${alerta.level}`}>
      <div className="analisis__cabeza">
        <span className={`analisis__nivel analisis__nivel--${alerta.level}`}>{NIVELES[alerta.level]}</span>
        <span className="analisis__desde">
          desde las <time dateTime={alerta.level_since}>{horaExacta(alerta.level_since)}</time>
        </span>
        <span className="analisis__origen">{ORIGENES[alerta.origin]}</span>
      </div>

      <p className={sinEstructura ? "analisis__detalle" : "analisis__titular"}>{e.titular}</p>
      {e.detalle.map((renglon) => (
        <p className="analisis__detalle" key={renglon}>{renglon}</p>
      ))}

      {hayLista ? (
        <div className="analisis__lista">
          {e.encabezadoDeLista ? <p className="analisis__leyenda">{e.encabezadoDeLista}</p> : null}
          {e.variables.length > 0 ? (
            <table className="analisis__tabla">
              <thead>
                <tr>
                  <th scope="col">Qué se midió</th>
                  <th scope="col">En el momento más marcado</th>
                  <th scope="col">Lo esperado</th>
                </tr>
              </thead>
              <tbody>
                {e.variables.map((v) => (
                  <tr key={v.etiqueta}>
                    <th scope="row">{v.etiqueta}</th>
                    <td className="cifra">{v.observado}</td>
                    <td className="cifra">{v.esperado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="analisis__viñetas">
              {e.viñetasSinForma.map((v) => <li key={v}>{v}</li>)}
            </ul>
          )}
        </div>
      ) : null}

      {e.despues.map((renglon) => (
        <p className="analisis__detalle" key={renglon}>{renglon}</p>
      ))}
      {e.cierre ? <p className="analisis__cierre">{e.cierre}</p> : null}
    </li>
  );
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
      // Con una alerta de un solo evento (el caso típico de abrir, pegar y entregar) la frase no puede
      // sonar a que no hay nada que mirar: se dice qué falta y que igual se detectó algo.
      if (hayAlertas) {
        return (
          <p className="analisis__estado">
            No hay actividad suficiente para analizar el comportamiento de toda la sesión, pero se detectó lo siguiente:
          </p>
        );
      }
      return (
        <p className="analisis__estado">
          No hay evidencia suficiente para analizar esta sesión.
          {analisis.reason ? <span className="analisis__motivo"> {analisis.reason}</span> : null}
        </p>
      );
    default:
      // El motivo de «no disponible» es técnico (el modelo, un archivo...) y no se le muestra al docente.
      return (
        <p className="analisis__estado">
          {hayAlertas
            ? "El análisis del comportamiento de toda la sesión no está disponible, pero se detectó lo siguiente:"
            : "El análisis de esta sesión no está disponible por ahora."}
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
                {analisis.alerts.map((alerta) => <Alerta key={alerta.origin} alerta={alerta} />)}
              </ul>
              {/* Cada explicación nueva termina aclarando que describe lo observado y no atribuye
                  intención. Si alguna no lo dice (una alerta guardada antes del formato nuevo), la
                  aclaración va acá, para que nunca falte. */}
              {analisis.alerts.some((a) => ordenarExplicacion(a.explanation).cierre === null) ? (
                <p className="analisis__nota">
                  Una alerta señala algo para revisar; no es una conclusión sobre el alumno.
                </p>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
