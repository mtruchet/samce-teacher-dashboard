import { horaCorta } from "./eventos";
import type { AlertaDeSesion } from "./services/sesionesService";

/**
 * El orden y la hora de las alertas de una sesión (TT_S4_02).
 *
 * Acá no se traduce ningún texto: las frases que lee el docente las escribe el motor, en lenguaje
 * llano, y el panel las muestra tal cual (`explicacion.ts` solo las ordena por renglón).
 *
 * Todo es puro, sin React, para poder probarlo sin montar la pantalla.
 */

// ---- Orden de las alertas --------------------------------------------------------------------

const PESO: Record<AlertaDeSesion["level"], number> = { low: 1, medium: 2, high: 3 };

/**
 * Las alertas de una sesión, de mayor a menor nivel; si empatan, primero la de toda la
 * sesión. Son a lo sumo dos y de la misma sesión: ordenarlas no compara alumnos. No cambia el
 * arreglo que recibe.
 */
export function ordenarAlertas(alertas: AlertaDeSesion[]): AlertaDeSesion[] {
  return [...alertas].sort(
    (a, b) => PESO[b.level] - PESO[a.level] || Number(a.origin !== "model") - Number(b.origin !== "model")
  );
}

// ---- La hora de la alerta --------------------------------------------------------------------

export interface HoraDeAlerta {
  /** «Apareció a las» o «Con este nivel desde las». */
  texto: string;
  /** La marca de tiempo que se muestra, para el `dateTime`. */
  iso: string;
  /** Hora y minutos, sin segundos. */
  hora: string;
}

/** Por debajo de esto, `level_since` y `created_at` son el mismo momento. */
const MISMO_MOMENTO_MS = 2000;

/**
 * Qué hora mostrar en la cabecera de una alerta.
 *
 * Si el nivel nunca cambió, la alerta «apareció» a esa hora. Si subió, lo que importa es desde
 * cuándo tiene este nivel. Un backend que todavía no mande `level_since` usa la hora de creación.
 */
export function horaDeLaAlerta(alerta: Pick<AlertaDeSesion, "level_since" | "created_at">): HoraDeAlerta {
  const desde = alerta.level_since ?? alerta.created_at;
  const subio = Math.abs(Date.parse(desde) - Date.parse(alerta.created_at)) >= MISMO_MOMENTO_MS;
  return {
    texto: subio ? "Con este nivel desde las" : "Apareció a las",
    iso: desde,
    hora: horaCorta(desde),
  };
}
