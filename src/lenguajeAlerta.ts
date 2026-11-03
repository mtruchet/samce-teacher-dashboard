import type { AlertaDeSesion } from "./services/sesionesService";

/**
 * El orden de las alertas de una sesión (TT_S4_02).
 *
 * Las alertas no llevan hora. La API da la hora en que el análisis encontró el hecho, no la del
 * hecho: en la 453, la alerta decía «Se detectó a las 09:36» y el pegado figura en el registro a las
 * 09:35:08, y los docentes buscaban 09:36 y no lo encontraban (ronda 2). Para ubicarlo alcanza con
 * la pregunta, que el texto del motor dice con el mismo número que el registro. La hora del hecho
 * no viaja hoy al panel.
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
