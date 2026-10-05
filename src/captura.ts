import { horaCorta } from "./eventos";
import type { Captura } from "./services/sesionesService";

/**
 * Lo que se le muestra al docente cuando la captura de una sesión no estuvo
 * funcionando.
 *
 * Es una señal y no una prueba: puede haber un motivo técnico legítimo. Por eso
 * el texto dice qué pasó y qué no quedó registrado, sin acusar ni sugerirle al
 * docente qué hacer. No hay ningún índice ni puntaje: es una marca que está o
 * no está.
 */

export interface AvisoDeCaptura {
  /** Lo que dice la marca en la lista de sesiones. */
  corto: string;
  /** La explicación, para el detalle de la sesión. */
  detalle: string;
}

/** null cuando la captura estuvo bien: no hay nada que marcar. */
export function avisoDeCaptura(captura: Captura | undefined): AvisoDeCaptura | null {
  switch (captura?.state) {
    case "none":
      return {
        corto: "Captura incompleta",
        detalle:
          "No quedó registrada ninguna actividad de esta sesión. Puede deberse a una falla técnica o a que la captura estaba desactivada.",
      };
    case "gap": {
      const minutos = captura.gap_minutes ?? 0;
      const desde = captura.last_event_at ? Date.parse(captura.last_event_at) : NaN;
      const rango = Number.isNaN(desde)
        ? `durante ${minutos} minutos`
        : `entre las ${horaCorta(captura.last_event_at!)} y las ${horaCorta(new Date(desde + minutos * 60_000).toISOString())}`;
      return {
        corto: "Sin eventos recibidos",
        detalle: `No se recibieron eventos ${rango} mientras el examen seguía en curso (${minutos} minutos). Puede deberse a una falla técnica o a que la captura estaba desactivada.`,
      };
    }
    case "js_disabled":
      return {
        corto: "Captura incompleta",
        // Se nombra JavaScript porque es lo que quedó apagado y decirlo de otra
        // forma sería impreciso; se aclara qué es, sin decir quién lo apagó. El
        // evento no lo sabe: también lo apagan una política de la institución,
        // una extensión o el perfil de una máquina de laboratorio. Y cierra con
        // la misma salvedad que los otros tres estados.
        detalle:
          "Una página del examen se abrió con JavaScript desactivado —una opción del navegador— y lo que el alumno hizo en esa página no quedó registrado. Puede deberse a una falla técnica, a una extensión o a la configuración del equipo.",
      };
    case "no_start":
      return {
        corto: "Captura incompleta",
        detalle:
          "Una página del examen se abrió y la captura no llegó a arrancar, así que lo que el alumno hizo en esa página no quedó registrado. Puede deberse a una falla técnica o a un bloqueo del navegador.",
      };
    default:
      return null;
  }
}
