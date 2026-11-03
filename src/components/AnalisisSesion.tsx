import { useEffect, useRef, useState } from "react";
import { horaCorta } from "../eventos";
import { Check, Info } from "../iconos";
import {
  explicacionLegible,
  horaDeLaAlerta,
  motivoCorto,
  motivoDeAlerta,
  ordenarAlertas,
} from "../lenguajeAlerta";
import { recienCerrada } from "../seguimiento";
import {
  CADENCIA_MS,
  SesionVencida,
  traerAnalisis,
  type AlertaDeSesion,
  type Analisis,
  type SesionNumerada,
} from "../services/sesionesService";
import { Comparacion } from "./Comparacion";
import { MedidorNivel } from "./MedidorNivel";
import "./AnalisisSesion.css";

/**
 * El apartado «Análisis de la sesión» (SAMCE-36, TT_S4_02): las alertas vigentes y cómo está el
 * análisis.
 *
 * Va aparte del registro de eventos, que cuenta lo que pasó; acá se lee lo que el análisis
 * encontró. Arriba, un resumen que en una frase dice si hay algo para revisar y por qué; debajo,
 * una tarjeta por alerta con su nivel, la hora, de dónde sale y su explicación en lenguaje llano
 * (`lenguajeAlerta.ts`), con las cifras que más pesaron puestas al lado de las de una sesión
 * habitual.
 *
 * No muestra el índice de integridad (decisión vigente), ni las métricas, el historial o la
 * cronología (HU05), ni un nivel de la sesión (HU03): el resumen cuenta las alertas y dice de qué
 * tratan, pero nunca muestra un nivel.
 *
 * Mientras la sesión sigue abierta, y unos minutos después de la entrega, vuelve a preguntar
 * cada pocos segundos: el análisis se recalcula con cada tanda de eventos, y una alerta puede
 * aparecer o subir de nivel mientras el docente mira.
 *
 * Una alerta es una señal para revisar, no una conclusión sobre el alumno. El motor cierra cada
 * explicación diciéndolo; acá esa aclaración se dice una sola vez, arriba, en la nota de apoyo,
 * en lugar de repetirse al pie de cada tarjeta.
 */

const NIVELES: Record<AlertaDeSesion["level"], string> = {
  low: "Nivel bajo",
  medium: "Nivel medio",
  high: "Nivel alto",
};

const ORIGENES: Record<AlertaDeSesion["origin"], string> = {
  model: "La sesión en conjunto",
  event: "Un momento puntual",
};

/** La nota de apoyo: una sola vez por pantalla, y solo si hay alertas. */
const NOTA_DE_APOYO =
  "Una alerta señala algo para mirar con atención. Describe lo que se observó y no atribuye intención: la revisión es del docente.";

/** El `id` de la tarjeta de una alerta: a lo sumo hay una de cada origen. */
function idDeAlerta(alerta: AlertaDeSesion): string {
  return `analisis-alerta-${alerta.origin}`;
}

interface Props {
  sesion: SesionNumerada;
  /** El token dejó de valer: no se arregla reintentando, lo resuelve el panel. */
  onVencida: () => void;
}

function Alerta({ alerta }: { alerta: AlertaDeSesion }) {
  const e = explicacionLegible(alerta.explanation);
  const hora = horaDeLaAlerta(alerta);
  return (
    <li
      className={`analisis__alerta analisis__alerta--${alerta.level}`}
      id={idDeAlerta(alerta)}
      // Destino de los motivos del resumen: recibe el foco al seguir el enlace, sin entrar al orden del tabulador.
      tabIndex={-1}
    >
      <div className="analisis__cabeza">
        <span className="analisis__nivel">
          <MedidorNivel nivel={alerta.level} />
          {NIVELES[alerta.level]}
        </span>
        <span className="analisis__hora">
          {hora.texto} <time className="cifra" dateTime={hora.iso}>{hora.hora}</time>
        </span>
        <span className="analisis__origen">{ORIGENES[alerta.origin]}</span>
      </div>

      {/* Una explicación sin estructura (una alerta guardada en un solo párrafo) no tiene un
          titular: se muestra como texto común y no en grande y en negrita. */}
      <p className={e.sinEstructura ? "analisis__detalle" : "analisis__titular"}>{e.titular}</p>
      {e.contexto.map((renglon) => (
        <p className="analisis__detalle" key={renglon}>{renglon}</p>
      ))}

      {e.cifras.length > 0 ? (
        <div className="analisis__pesos">
          <h3 className="analisis__subtitulo">Lo que más pesó</h3>
          <ul className="analisis__cifras">
            {e.cifras.map((cifra) => <Comparacion key={cifra.clave} cifra={cifra} />)}
          </ul>
          {/* Es cierto por construcción: el backend conserva la explicación del peor momento. */}
          <p className="analisis__aclaracion">Las cifras son las del momento de la sesión en que más se notó.</p>
        </div>
      ) : e.viñetasSinForma.length > 0 ? (
        <div className="analisis__pesos">
          {e.conEncabezado ? <h3 className="analisis__subtitulo">Lo que más pesó</h3> : null}
          <ul className="analisis__viñetas">
            {e.viñetasSinForma.map((v) => <li key={v}>{v}</li>)}
          </ul>
        </div>
      ) : null}

      {e.despues.map((renglon) => (
        <p className="analisis__detalle" key={renglon}>{renglon}</p>
      ))}
    </li>
  );
}

/** Lleva el foco a la tarjeta de una alerta, sin tocar la dirección de la página. */
function irALaAlerta(evento: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const tarjeta = document.getElementById(id);
  if (!tarjeta) return;
  evento.preventDefault();
  tarjeta.focus();
}

function Motivos({ alertas }: { alertas: AlertaDeSesion[] }) {
  return (
    <ul className="resumen__motivos">
      {alertas.map((alerta) => (
        <li key={alerta.origin}>
          <a href={`#${idDeAlerta(alerta)}`} onClick={(ev) => irALaAlerta(ev, idDeAlerta(alerta))}>
            {motivoDeAlerta(alerta)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function cuantas(n: number): string {
  return n === 1 ? "Hay 1 alerta para revisar." : `Hay ${n} alertas para revisar.`;
}

/** Si el motivo de la evidencia insuficiente es la captura y no la poca actividad. */
function porLaCaptura(motivo: string | null): boolean {
  return motivo !== null && /^La captura/.test(motivo);
}

/**
 * El resumen de arriba: una frase grande y, si hace falta, una bajada. Con alertas, la bajada es
 * la lista de motivos, una por alerta y en el orden de las tarjetas, y debajo va la nota de apoyo.
 *
 * Nunca muestra un nivel: un nivel acá sería el nivel de la sesión, que es de HU03.
 */
function Resumen({ analisis, alertas, abierta }: { analisis: Analisis; alertas: AlertaDeSesion[]; abierta: boolean }) {
  if (alertas.length > 0) {
    // El motivo de «no disponible» es técnico (el modelo, un archivo...) y no se le muestra al docente.
    const bajada =
      analisis.state === "insufficient_evidence"
        ? "Hubo poca actividad para analizar la sesión en conjunto, pero se marcó un momento puntual."
        : analisis.state === "unavailable"
          ? "El análisis de la sesión en conjunto no está disponible por ahora, pero se marcó un momento puntual."
          : null;
    return (
      <div className="resumen">
        <p className="resumen__frase">{cuantas(alertas.length)}</p>
        {bajada ? <p className="resumen__bajada">{bajada}</p> : null}
        <Motivos alertas={alertas} />
        <p className="resumen__nota">
          <Info size={18} aria-hidden="true" />
          <span>{NOTA_DE_APOYO}</span>
        </p>
      </div>
    );
  }

  switch (analisis.state) {
    case "analyzed":
      return (
        <div className="resumen resumen--con-icono">
          <Check className="resumen__icono" size={20} aria-hidden="true" />
          <div className="resumen__texto">
            <p className="resumen__frase">
              {abierta ? "Por ahora no se encontró nada fuera de lo habitual." : "No se encontró nada fuera de lo habitual."}
            </p>
            <p className="resumen__bajada">
              {abierta
                ? "El análisis se repite solo mientras el alumno rinde."
                : "La sesión se analizó completa y no tiene alertas."}
            </p>
          </div>
        </div>
      );
    case "not_analyzed":
      return (
        <div className="resumen">
          <p className="resumen__frase">Esta sesión todavía no se analizó.</p>
          {abierta ? (
            <p className="resumen__bajada">
              El análisis se hace solo mientras el alumno rinde, y esta pantalla se actualiza sola.
            </p>
          ) : null}
        </div>
      );
    case "insufficient_evidence": {
      // El umbral del motor («5 eventos de actividad») choca con la cuenta del registro de abajo, que
      // cuenta todo: queda dentro de un desplegable cerrado, para quien quiera saberlo.
      const requisito = motivoCorto(analisis.reason);
      // Con la captura incompleta no fue poca actividad: decirlo así sería falso.
      const captura = porLaCaptura(analisis.reason);
      return (
        <div className="resumen">
          <p className="resumen__frase">
            {captura
              ? "Esta sesión no se pudo analizar porque la captura quedó incompleta."
              : "Hubo muy poca actividad para analizar esta sesión."}
          </p>
          {captura ? null : (
            <p className="resumen__bajada">Con tan pocos datos no se puede decir si se aparta de lo habitual.</p>
          )}
          {requisito ? (
            <details className="resumen__requisito">
              <summary>{captura ? "Qué pasó con la captura" : "Qué hace falta para analizarla"}</summary>
              <p>{requisito}</p>
            </details>
          ) : null}
        </div>
      );
    }
    default:
      return (
        <div className="resumen">
          <p className="resumen__frase">El análisis de esta sesión no está disponible por ahora.</p>
          <p className="resumen__bajada">Los eventos de la sesión se pueden revisar igual, más abajo.</p>
        </div>
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
        // resumen va primero, así es lo primero que se anuncia.
        <div className="analisis__region" role="status" aria-live="polite" aria-label="Alertas de la sesión">
          <Resumen analisis={analisis} alertas={alertas} abierta={abierta} />
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
