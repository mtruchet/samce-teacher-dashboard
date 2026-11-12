import { horaCorta } from "../eventos";
import { ordenarAlertas } from "../lenguajeAlerta";
import type { SesionNumerada } from "../services/sesionesService";
import { veredictoDe } from "../veredicto";
import { AnuncioVivo } from "./AnuncioVivo";
import { EvolucionRiesgo } from "./EvolucionRiesgo";
import { HistorialAlertas } from "./HistorialAlertas";
import { MetricasSesion } from "./MetricasSesion";
import { TarjetaAlerta } from "./TarjetaAlerta";
import { useAnalisisDeSesion } from "./useAnalisisDeSesion";
import { Veredicto } from "./Veredicto";
import "./AnalisisSesion.css";
import "./DetalleAnalisis.css";

/**
 * El apartado «Análisis de la sesión» (TT_S4_02): la lámina que manda en el detalle, arriba del
 * registro de eventos. Acá se lee lo que el análisis encontró; el registro cuenta lo que pasó.
 *
 * Arriba, el veredicto en una frase, con la misma forma en todos los estados («Hay 2 alertas para revisar.»,
 * «No hay alertas para revisar.», «Esta sesión no se pudo analizar.»); debajo, una tarjeta por alerta vigente,
 * con el hecho en negrita y, en la de toda la sesión, la lista corta de lo que más pesó.
 *
 * Los textos de las alertas y el motivo de una sesión que no se pudo analizar los escribe el motor para el
 * docente, en lenguaje llano, y salen tal cual: el panel no traduce nada (`explicacion.ts` solo los ordena por
 * renglón).
 *
 * No muestra el índice de integridad ni un nivel de la sesión. Debajo de las tarjetas van la evolución, el
 * historial y, con la sesión finalizada, las métricas (HU05).
 *
 * Cada dato se lee completo en un solo lugar: el nivel vigente y su explicación, en la tarjeta; cómo cambió el
 * nivel de la sesión, en la evolución; las explicaciones pasadas, en el historial; y que la sesión no se pudo
 * analizar o que el análisis no está disponible, en el veredicto.
 */

interface Props {
  sesion: SesionNumerada;
  /** El token dejó de valer: no se arregla reintentando, lo resuelve el panel. */
  onVencida: () => void;
}

export function AnalisisSesion({ sesion, onVencida }: Props) {
  const { analisis, sinConexion, anuncio } = useAnalisisDeSesion(sesion, onVencida);
  const abierta = sesion.status === "open";
  const alertas = analisis ? ordenarAlertas(analisis.alerts) : [];
  const veredicto = analisis ? veredictoDe(analisis, alertas, abierta) : null;

  return (
    <section className="lamina lamina--lectura analisis" aria-labelledby="analisis-titulo">
      <header className="analisis__encabezado">
        <h2 className="lamina__titulo" id="analisis-titulo">Análisis de la sesión</h2>
        {/* Solo mientras el alumno rinde, que es cuando el análisis cambia y la hora dice si lo que se ve
            es de recién. Con el examen terminado, la hora no le sirve al docente y confundía: una sesión de
            la mañana analizada de nuevo a la tarde decía «por última vez a las 16:55». Nunca en una sesión
            que no se pudo analizar, porque contradecía al título. Sin segundos. */}
        {abierta && analisis?.calculated_at && analisis.state !== "insufficient_evidence" ? (
          <span className="analisis__ultima">
            Analizada a las{" "}
            <time className="cifra" dateTime={analisis.calculated_at}>{horaCorta(analisis.calculated_at)}</time>
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

      {analisis === null || veredicto === null ? (
        sinConexion ? null : <p className="analisis__estado" role="status">Cargando el análisis…</p>
      ) : (
        <div className="analisis__region">
          <Veredicto veredicto={veredicto} />
          {alertas.length > 0 ? (
            <ul className="analisis__alertas">
              {alertas.map((alerta) => <TarjetaAlerta key={alerta.origin} alerta={alerta} />)}
            </ul>
          ) : null}

          {/* HU05: cómo cambió el riesgo, el historial de las alertas y las métricas del cierre. Con un
              backend sin el historial, no se dibujan la evolución ni el historial. */}
          {analisis.alert_history ? (
            <>
              <EvolucionRiesgo
                historial={analisis.alert_history}
                alertas={alertas}
                estado={analisis.state}
                inicio={sesion.started_at}
              />
              {analisis.alert_history.length > 0 ? (
                <HistorialAlertas historial={analisis.alert_history} alertas={alertas} inicio={sesion.started_at} />
              ) : null}
            </>
          ) : null}
          {"metrics" in analisis ? (
            <MetricasSesion
              metricas={analisis.metrics}
              estado={analisis.state}
              abierta={abierta}
            />
          ) : null}
        </div>
      )}

      {/* Región viva aparte, con solo la frase de lo nuevo: «role=status» lleva aria-atomic verdadero de forma
          implícita, y envolviendo todo el apartado hacía releerlo entero ante cualquier cambio. Lleva nombre
          porque el componente tiene otros dos «role=status» (el aviso sin conexión y «Cargando»). */}
      <AnuncioVivo aviso={anuncio} etiqueta="Alertas de la sesión" />
    </section>
  );
}
