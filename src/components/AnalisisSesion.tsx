import { useEffect, useRef, useState } from "react";
import { horaCorta } from "../eventos";
import { ordenarExplicacion } from "../explicacion";
import { Check, Info, Ojo, Reloj, type Icon } from "../iconos";
import { ORIGENES, PALABRA_DEL_NIVEL, ordenarAlertas, subio } from "../lenguajeAlerta";
import { recienCerrada } from "../seguimiento";
import {
  CADENCIA_MS,
  SesionVencida,
  traerAnalisis,
  type AlertaDeSesion,
  type Analisis,
  type SesionNumerada,
} from "../services/sesionesService";
import { AnuncioVivo, useAnuncio } from "./AnuncioVivo";
import { EvolucionRiesgo } from "./EvolucionRiesgo";
import { HistorialAlertas } from "./HistorialAlertas";
import { MetricasSesion } from "./MetricasSesion";
import { RotuloNivel } from "./RotuloNivel";
import "./AnalisisSesion.css";
import "./DetalleAnalisis.css";

/**
 * El apartado «Análisis de la sesión» (SAMCE-36, TT_S4_02): las alertas vigentes y cómo está el
 * análisis.
 *
 * Va aparte del registro de eventos, que cuenta lo que pasó; acá se lee lo que el análisis
 * encontró. Tiene tres capas: arriba, el veredicto en una frase, con la misma forma en todos los
 * estados («Hay 2 alertas para revisar.», «No hay alertas para revisar.», «Esta sesión no se pudo
 * analizar.»); debajo, una tarjeta por alerta con el hecho en grande; y, en la alerta de toda la
 * sesión, la lista corta de lo que más se notó.
 *
 * Los textos de las alertas y el motivo de una sesión que no se pudo analizar los escribe el
 * motor para el docente, en lenguaje llano, y salen tal cual: el panel no traduce nada
 * (`explicacion.ts` solo los ordena por renglón).
 *
 * No muestra el índice de integridad (decisión vigente), ni las métricas, el historial o la
 * cronología (HU05), ni un nivel de la sesión (HU03): el veredicto cuenta las alertas y dice de qué
 * tratan, pero nunca dice un nivel ni usa su color. El nivel es de cada alerta y va en su tarjeta,
 * con los nombres del criterio de HU06 («Riesgo bajo», `NIVELES`).
 *
 * Mientras la sesión sigue abierta, y unos minutos después de la entrega, vuelve a preguntar
 * cada pocos segundos: el análisis se recalcula con cada tanda de eventos, y una alerta puede
 * aparecer o subir de nivel mientras el docente mira.
 */

interface Props {
  sesion: SesionNumerada;
  /** El token dejó de valer: no se arregla reintentando, lo resuelve el panel. */
  onVencida: () => void;
}

/** Una nota del motor dentro de la tarjeta: el ícono de información y el texto tal cual. */
function Nota({ texto }: { texto: string }) {
  return (
    <p className="analisis__nota">
      <Info size={16} aria-hidden="true" />
      <span>{texto}</span>
    </p>
  );
}

function Alerta({ alerta }: { alerta: AlertaDeSesion }) {
  const e = ordenarExplicacion(alerta.explanation);
  // Un rótulo de lista sin viñetas debajo no abre nada: se muestra como nota, sin perderse.
  const notasAntes =
    e.encabezadoDeLista !== null && e.viñetas.length === 0 ? [...e.notasAntes, `${e.encabezadoDeLista}:`] : e.notasAntes;
  return (
    <li
      className={`analisis__alerta analisis__alerta--${alerta.level}`}
      data-nivel={alerta.level}
      data-origen={alerta.origin}
    >
      <div className="analisis__cuerpo">
        <div className="analisis__cabeza">
          <RotuloNivel nivel={alerta.level} complemento={ORIGENES[alerta.origin]} />
          {/* Sin hora en la cabecera: la que da la API es la del análisis y no la del hecho, y no coincidía con
              el registro (ver `lenguajeAlerta.ts`). Cuándo y dónde fue lo dice el texto del motor, con la hora de
              la fila del registro: «A las 09:35, en la pregunta 3, …». */}
        </div>

        <p className="analisis__hecho">{e.hecho}</p>
        {notasAntes.map((renglon) => <Nota key={renglon} texto={renglon} />)}

        {e.viñetas.length > 0 ? (
          <div className="analisis__atencion">
            {e.encabezadoDeLista ? <h3 className="analisis__subtitulo">{e.encabezadoDeLista}</h3> : null}
            <ul className="analisis__lista">
              {e.viñetas.map((v) => <li key={v}>{v}</li>)}
            </ul>
          </div>
        ) : null}

        {e.notas.map((renglon) => <Nota key={renglon} texto={renglon} />)}
      </div>
    </li>
  );
}

function cuantas(n: number): string {
  return n === 1 ? "Hay 1 alerta para revisar." : `Hay ${n} alertas para revisar.`;
}

/**
 * Con una alerta de cada origen, de qué trata cada una (ronda 3): sin esto, «Hay 2 alertas» con el mismo pegado
 * nombrado en las dos se leía como el mismo hecho contado dos veces. Dice de qué tratan, nunca un nivel.
 */
const UNA_DE_CADA = "Una es sobre toda la sesión y la otra, sobre un momento puntual.";

interface Veredicto {
  icono: Icon;
  frase: string;
  bajadas: string[];
  /** «sin-alertas» le da al ícono un fondo verde suave: «todo bien» se distingue de «no se pudo analizar». */
  tono?: "sin-alertas";
}

/**
 * Que no se pudiera analizar no es una señal sobre el examen: sin esto, el estado se leía como una sanción. En dos
 * frases cortas y sin volver a decir «analizar» (ronda 3).
 */
const SIN_PROBLEMA = "Esto no indica ningún problema en el examen. Abajo está todo lo que se registró.";

/**
 * Qué dice el veredicto de arriba en cada estado: una frase, su ícono y, si hace falta, una bajada.
 * Todos los estados tienen la misma forma y el mismo peso, con el ícono en su cuadro a la izquierda.
 * Los íconos son neutros (ojo, tilde, reloj, información): ninguno es de prohibido ni de advertencia.
 *
 * Nunca dice un nivel ni usa el color de uno: acá sería el nivel de la sesión, que es de HU03.
 * El motivo de una sesión que no se pudo analizar es el del motor, tal cual. El de «no
 * disponible» no se repite, porque dice lo mismo que la frase.
 */
function veredictoDe(analisis: Analisis, alertas: AlertaDeSesion[], abierta: boolean): Veredicto {
  const motivo = analisis.reason?.trim() || null;
  if (alertas.length > 0) {
    const origenes = new Set(alertas.map((a) => a.origin));
    const bajadas =
      analisis.state === "insufficient_evidence"
        ? ["La sesión completa no se pudo analizar, pero hubo un momento que conviene mirar.", ...(motivo ? [motivo] : [])]
        : analisis.state === "unavailable"
          ? ["El análisis de la sesión completa no está disponible en este momento."]
          : origenes.has("model") && origenes.has("event")
            ? [UNA_DE_CADA]
            : [];
    return { icono: Ojo, frase: cuantas(alertas.length), bajadas };
  }
  switch (analisis.state) {
    case "analyzed":
      return abierta
        ? {
            icono: Check, frase: "Por ahora no hay alertas para revisar.",
            bajadas: ["La sesión se sigue analizando mientras el alumno rinde."],
            tono: "sin-alertas",
          }
        : {
            icono: Check, frase: "No hay alertas para revisar.",
            // Sin repetir el título («no surgió ninguna alerta» decía lo mismo dos veces).
            bajadas: ["Se analizó todo el examen."],
            tono: "sin-alertas",
          };
    case "not_analyzed":
      return {
        icono: Reloj, frase: "Esta sesión todavía no se analizó.",
        bajadas: abierta ? ["Se va a analizar mientras el alumno rinde. No hace falta recargar la pantalla."] : [],
      };
    case "insufficient_evidence":
      return {
        icono: Info, frase: "Esta sesión no se pudo analizar.",
        bajadas: [...(motivo ? [motivo] : []), SIN_PROBLEMA],
      };
    default:
      return {
        icono: Info, frase: "El análisis no está disponible en este momento.",
        bajadas: ["Los eventos de la sesión se pueden ver igual, más abajo."],
      };
  }
}

function Veredicto({ analisis, alertas, abierta }: { analisis: Analisis; alertas: AlertaDeSesion[]; abierta: boolean }) {
  const v = veredictoDe(analisis, alertas, abierta);
  const Icono = v.icono;
  return (
    <div className={v.tono ? `veredicto veredicto--${v.tono}` : "veredicto"}>
      <span className="veredicto__icono" aria-hidden="true">
        <Icono size={28} />
      </span>
      <div className="veredicto__texto">
        <p className="veredicto__frase">{v.frase}</p>
        {v.bajadas.map((b) => <p className="veredicto__bajada" key={b}>{b}</p>)}
      </div>
    </div>
  );
}

/**
 * Lo nuevo de una consulta, para el lector de pantalla: la alerta que apareció o subió de nivel. Solo eso, y
 * no todo el apartado: la región viva contiene solo esta frase.
 */
function novedades(antes: AlertaDeSesion[], ahora: AlertaDeSesion[]): string {
  const frases: string[] = [];
  for (const a of ahora) {
    const previa = antes.find((b) => b.origin === a.origin);
    const donde = ORIGENES[a.origin].toLowerCase();
    if (!previa) frases.push(`Nueva alerta ${donde}: riesgo ${PALABRA_DEL_NIVEL[a.level]}.`);
    else if (subio(previa.level, a.level)) {
      frases.push(`La alerta ${donde} subió a riesgo ${PALABRA_DEL_NIVEL[a.level]}.`);
    }
  }
  return frases.join(" ");
}

export function AnalisisSesion({ sesion, onVencida }: Props) {
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  // La frase del anuncio y las alertas de la consulta anterior, para saber qué cambió.
  // Cada novedad va en un nodo nuevo: dos novedades seguidas con la misma frase se leen las dos veces.
  const [anuncio, anunciar] = useAnuncio();
  const anteriores = useRef<AlertaDeSesion[] | null>(null);
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

  const alertas = analisis ? ordenarAlertas(analisis.alerts) : [];

  useEffect(() => {
    if (!analisis) return;
    // La primera respuesta solo se memoriza: lo que ya estaba al abrir no es nuevo.
    if (anteriores.current !== null) {
      const frase = novedades(anteriores.current, analisis.alerts);
      if (frase) anunciar(frase);
    }
    anteriores.current = analisis.alerts;
  }, [analisis, anunciar]);

  return (
    <section className="analisis" aria-labelledby="analisis-titulo">
      <header className="analisis__encabezado">
        <h2 className="analisis__titulo" id="analisis-titulo">Análisis de la sesión</h2>
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

      {analisis === null ? (
        sinConexion ? null : <p className="analisis__estado" role="status">Cargando el análisis…</p>
      ) : (
        <div className="analisis__region">
          <Veredicto analisis={analisis} alertas={alertas} abierta={abierta} />
          {alertas.length > 0 ? (
            <ul className="analisis__alertas">
              {alertas.map((alerta) => <Alerta key={alerta.origin} alerta={alerta} />)}
            </ul>
          ) : null}

          {/* HU05: cómo cambió el riesgo, el historial de las alertas y las métricas del cierre. Con un
              backend sin el historial, no se dibujan la evolución ni el historial. */}
          {analisis.alert_history ? (
            <>
              <EvolucionRiesgo historial={analisis.alert_history} alertas={alertas} estado={analisis.state} />
              {analisis.alert_history.length > 0 ? (
                <HistorialAlertas historial={analisis.alert_history} alertas={alertas} />
              ) : null}
            </>
          ) : null}
          {"metrics" in analisis ? (
            <MetricasSesion metricas={analisis.metrics} estado={analisis.state} abierta={abierta} />
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
