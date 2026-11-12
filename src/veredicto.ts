import { Check, Info, Ojo, Reloj, type Icon } from "./iconos";
import type { AlertaDeSesion, Analisis } from "./services/sesionesService";

/**
 * Qué dice el veredicto de arriba del apartado «Análisis de la sesión» en cada estado: una frase, su ícono y,
 * si hace falta, una bajada. Puro, sin React, para probarlo aparte.
 *
 * Todos los estados tienen la misma forma y el mismo peso, con el ícono en su cuadro a la izquierda. Los
 * íconos son neutros (ojo, tilde, reloj, información): ninguno es de prohibido ni de advertencia.
 *
 * Nunca dice un nivel ni usa el color de uno: acá sería el nivel de la sesión, que es de HU03. El motivo de una
 * sesión que no se pudo analizar es el del motor, tal cual. El de «no disponible» no se repite, porque dice lo
 * mismo que la frase.
 *
 * Es el único lugar del detalle que dice que la sesión no se pudo analizar o que el análisis no está disponible:
 * las métricas no lo repiten (ver MetricasSesion).
 */

export interface Veredicto {
  icono: Icon;
  frase: string;
  bajadas: string[];
  /** «sin-alertas» le da al ícono un fondo verde suave: «todo bien» se distingue de «no se pudo analizar». */
  tono?: "sin-alertas";
}

function cuantas(n: number): string {
  return n === 1 ? "Hay 1 alerta para revisar." : `Hay ${n} alertas para revisar.`;
}

/**
 * Con una alerta de cada origen, de qué trata cada una (ronda 3): sin esto, «Hay 2 alertas» con el mismo pegado
 * nombrado en las dos se leía como el mismo hecho contado dos veces. Dice de qué tratan, nunca un nivel.
 */
const UNA_DE_CADA = "Una es sobre toda la sesión y la otra, sobre un momento puntual.";

/**
 * Que no se pudiera analizar no es una señal sobre el examen: sin esto, el estado se leía como una sanción. En dos
 * frases cortas y sin volver a decir «analizar» (ronda 3).
 */
const SIN_PROBLEMA = "Esto no indica ningún problema en el examen. Abajo está todo lo que se registró.";

export function veredictoDe(analisis: Analisis, alertas: AlertaDeSesion[], abierta: boolean): Veredicto {
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
