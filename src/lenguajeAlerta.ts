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
  /** «Se detectó a las». */
  texto: string;
  /** La marca de tiempo que se muestra, para el `dateTime`. */
  iso: string;
  /** Hora y minutos, sin segundos. */
  hora: string;
}

/**
 * Qué hora mostrar en la cabecera de una alerta, o null si no lleva.
 *
 * Solo la de un momento de la sesión lleva hora: es lo que el docente usa para ir a buscar el pegado en
 * el registro. La de toda la sesión no: «Apareció a las 10:00» en una sesión que siguió hasta las
 * 10:12 hacía pensar que algo había pasado a esa hora.
 *
 * Dice «Se detectó» y no «Pasó» a propósito. La API da la hora en que el análisis encontró el pegado,
 * no la del pegado: el análisis corre como mucho una vez por minuto mientras el alumno rinde, así que
 * el pegado fue un rato antes (en la 453, el pegado se registró a las 09:35 y la alerta es de las
 * 09:36). En qué pregunta fue lo dice el texto del motor. Si el nivel subió, la explicación es la del
 * pegado nuevo, así que la hora es desde cuándo tiene este nivel; un backend que todavía no mande
 * `level_since` usa la hora de creación.
 */
export function horaDeLaAlerta(
  alerta: Pick<AlertaDeSesion, "origin" | "level_since" | "created_at">
): HoraDeAlerta | null {
  if (alerta.origin !== "event") return null;
  const desde = alerta.level_since ?? alerta.created_at;
  return { texto: "Se detectó a las", iso: desde, hora: horaCorta(desde) };
}
