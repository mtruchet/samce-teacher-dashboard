import { useEffect, useRef, useState } from "react";
import { horaCorta } from "../eventos";
import { ordenarExplicacion } from "../explicacion";
import { Alfiler, Capas, Check, Info, NoSePudo, Ojo, Reloj, type Icon } from "../iconos";
import { horaDeLaAlerta, ordenarAlertas } from "../lenguajeAlerta";
import { recienCerrada } from "../seguimiento";
import {
  CADENCIA_MS,
  SesionVencida,
  traerAnalisis,
  type AlertaDeSesion,
  type Analisis,
  type SesionNumerada,
} from "../services/sesionesService";
import { MedidorNivel } from "./MedidorNivel";
import "./AnalisisSesion.css";

/**
 * El apartado «Análisis de la sesión» (SAMCE-36, TT_S4_02): las alertas vigentes y cómo está el
 * análisis.
 *
 * Va aparte del registro de eventos, que cuenta lo que pasó; acá se lee lo que el análisis
 * encontró. Tiene tres capas: arriba, el veredicto en una frase («Hay 2 alertas para revisar.»,
 * «No hay nada para revisar.»); debajo, una tarjeta por alerta con el hecho en grande; y, en la
 * alerta de toda la sesión, la lista corta de lo que más llamó la atención.
 *
 * Los textos de las alertas y el motivo de una sesión que no se pudo analizar los escribe el
 * motor para el docente, en lenguaje llano, y salen tal cual: el panel no traduce nada
 * (`explicacion.ts` solo los ordena por renglón).
 *
 * No muestra el índice de integridad (decisión vigente), ni las métricas, el historial o la
 * cronología (HU05), ni un nivel de la sesión (HU03): el veredicto cuenta las alertas, pero nunca
 * dice un nivel ni usa su color. El nivel es de cada alerta y va en su tarjeta.
 *
 * Mientras la sesión sigue abierta, y unos minutos después de la entrega, vuelve a preguntar
 * cada pocos segundos: el análisis se recalcula con cada tanda de eventos, y una alerta puede
 * aparecer o subir de nivel mientras el docente mira.
 */

const NIVELES: Record<AlertaDeSesion["level"], string> = {
  low: "Nivel bajo",
  medium: "Nivel medio",
  high: "Nivel alto",
};

/** De dónde sale la alerta, escrito y con su ícono. Se elige por `origin`, nunca por el texto. */
const ORIGENES: Record<AlertaDeSesion["origin"], { texto: string; icono: Icon }> = {
  model: { texto: "En toda la sesión", icono: Capas },
  event: { texto: "En un momento de la sesión", icono: Alfiler },
};

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
  const hora = horaDeLaAlerta(alerta);
  const origen = ORIGENES[alerta.origin];
  const IconoDeOrigen = origen.icono;
  // Un rótulo de lista sin viñetas debajo no abre nada: se muestra como nota, sin perderse.
  const notasAntes =
    e.encabezadoDeLista !== null && e.viñetas.length === 0 ? [...e.notasAntes, `${e.encabezadoDeLista}:`] : e.notasAntes;
  return (
    <li className={`analisis__alerta analisis__alerta--${alerta.level}`} data-origen={alerta.origin}>
      <span className="analisis__origen-icono" aria-hidden="true">
        <IconoDeOrigen size={18} />
      </span>
      <div className="analisis__cuerpo">
        <div className="analisis__cabeza">
          <span className="analisis__rotulo">
            <MedidorNivel nivel={alerta.level} />
            <span className="analisis__nivel">{NIVELES[alerta.level]}</span>{" "}
            <span className="analisis__separador" aria-hidden="true">·</span>{" "}
            <span className="analisis__origen">{origen.texto}</span>
          </span>
          <span className="analisis__hora">
            {hora.texto} <time className="cifra" dateTime={hora.iso}>{hora.hora}</time>
          </span>
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

interface Veredicto {
  icono: Icon;
  /** Si el ícono va grande, en su cuadro: los estados sin alertas. */
  grande: boolean;
  frase: string;
  bajadas: string[];
}

/**
 * Qué dice el veredicto de arriba en cada estado: una frase, su ícono y, si hace falta, una bajada.
 *
 * Nunca dice un nivel ni usa el color de uno: acá sería el nivel de la sesión, que es de HU03.
 * El motivo de una sesión que no se pudo analizar es el del motor, tal cual. El de «no
 * disponible» no se repite, porque dice lo mismo que la frase.
 */
function veredictoDe(analisis: Analisis, alertas: number, abierta: boolean): Veredicto {
  const motivo = analisis.reason?.trim() || null;
  if (alertas > 0) {
    const bajadas =
      analisis.state === "insufficient_evidence"
        ? ["La sesión completa no se pudo analizar, pero hubo un momento que conviene mirar.", ...(motivo ? [motivo] : [])]
        : analisis.state === "unavailable"
          ? ["El análisis de la sesión completa no está disponible en este momento."]
          : [];
    return { icono: Ojo, grande: false, frase: cuantas(alertas), bajadas };
  }
  switch (analisis.state) {
    case "analyzed":
      return abierta
        ? {
            icono: Check, grande: true, frase: "Por ahora no hay nada para revisar.",
            bajadas: ["La sesión se sigue analizando mientras el alumno rinde."],
          }
        : {
            icono: Check, grande: true, frase: "No hay nada para revisar.",
            bajadas: ["Se analizó la sesión completa y no surgió ninguna alerta."],
          };
    case "not_analyzed":
      return {
        icono: Reloj, grande: true, frase: "Esta sesión todavía no se analizó.",
        bajadas: abierta ? ["Se va a analizar mientras el alumno rinde. No hace falta recargar la pantalla."] : [],
      };
    case "insufficient_evidence":
      return {
        icono: NoSePudo, grande: true, frase: "Esta sesión no se pudo analizar.",
        bajadas: [...(motivo ? [motivo] : []), "Lo que sí se registró está más abajo, en el registro de eventos."],
      };
    default:
      return {
        icono: NoSePudo, grande: true, frase: "El análisis no está disponible en este momento.",
        bajadas: ["Los eventos de la sesión se pueden ver igual, más abajo."],
      };
  }
}

function Veredicto({ analisis, alertas, abierta }: { analisis: Analisis; alertas: number; abierta: boolean }) {
  const v = veredictoDe(analisis, alertas, abierta);
  const Icono = v.icono;
  return (
    <div className={v.grande ? "veredicto veredicto--grande" : "veredicto"}>
      <span className="veredicto__icono" aria-hidden="true">
        <Icono size={v.grande ? 28 : 24} />
      </span>
      <div className="veredicto__texto">
        <p className="veredicto__frase">{v.frase}</p>
        {v.bajadas.map((b) => <p className="veredicto__bajada" key={b}>{b}</p>)}
      </div>
    </div>
  );
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

  const alertas = analisis ? ordenarAlertas(analisis.alerts) : [];

  return (
    <section className="analisis" aria-labelledby="analisis-titulo">
      <header className="analisis__encabezado">
        <h2 className="analisis__titulo" id="analisis-titulo">Análisis de la sesión</h2>
        {/* Sin segundos: a nadie le sirve el segundo exacto, y con ellos parecía un reloj técnico. */}
        {analisis?.calculated_at ? (
          <span className="analisis__ultima">
            Analizada por última vez a las{" "}
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
        // Región viva: un lector de pantalla anuncia la alerta que aparece o sube de nivel mientras se mira. Lleva
        // nombre porque el componente ya tiene otros dos `role="status"` (el aviso sin conexión y «Cargando»). El
        // veredicto va primero, así es lo primero que se anuncia.
        <div className="analisis__region" role="status" aria-live="polite" aria-label="Alertas de la sesión">
          <Veredicto analisis={analisis} alertas={alertas.length} abierta={abierta} />
          {alertas.length > 0 ? (
            <ul className="analisis__alertas">
              {alertas.map((alerta) => <Alerta key={alerta.origin} alerta={alerta} />)}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
