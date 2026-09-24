import type { Captura } from "./services/sesionesService";

/**
 * Lo que se le muestra al docente cuando la captura de una sesión no estuvo
 * funcionando.
 *
 * Es una señal y no una prueba: puede haber un motivo técnico legítimo, y por eso
 * el texto siempre termina en que conviene revisarla con el alumno, sin acusar. No
 * hay ningún índice ni puntaje: es una marca que está o no está.
 */

export interface AvisoDeCaptura {
  /** Lo que dice la marca en la lista de sesiones. */
  corto: string;
  /** La explicación, para el detalle de la sesión. */
  detalle: string;
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** null cuando la captura estuvo bien: no hay nada que marcar. */
export function avisoDeCaptura(captura: Captura | undefined): AvisoDeCaptura | null {
  if (!captura || captura.state === "ok") return null;

  switch (captura.state) {
    case "none":
      return {
        corto: "Sin captura",
        detalle:
          "Esta sesión no recibió eventos de la captura. Puede ser una falla técnica o que la captura se haya desactivado. Conviene revisarla con el alumno.",
      };
    case "gap": {
      const minutos = captura.gap_minutes ?? 0;
      const desde = captura.last_event_at ? new Date(captura.last_event_at) : null;
      const rango =
        desde && !Number.isNaN(desde.getTime())
          ? `entre las ${hora(desde.toISOString())} y las ${hora(new Date(desde.getTime() + minutos * 60_000).toISOString())}`
          : `durante ${minutos} minutos`;
      return {
        corto: "Sin señales",
        detalle: `No se recibieron señales ${rango} mientras el examen seguía en curso (${minutos} minutos). Puede ser una falla técnica o que la captura se haya desactivado. Conviene revisarla con el alumno.`,
      };
    }
    case "js_disabled":
      return {
        corto: "Sin captura",
        detalle:
          "Una página del examen se cargó con JavaScript desactivado, así que la captura no pudo funcionar. Conviene revisarla con el alumno.",
      };
    case "no_start":
      return {
        corto: "Sin captura",
        detalle:
          "Una página del examen se cargó y la captura no llegó a arrancar. Puede ser una falla técnica o que se haya bloqueado. Conviene revisarla con el alumno.",
      };
    default:
      return null;
  }
}
