import type { AlertaDeSesion, EstadoDelAnalisis, Sesion } from "./services/sesionesService";

/**
 * El orden de las alertas de una sesión (TT_S4_02).
 *
 * Las tarjetas no llevan una hora propia. La API da la hora en que el análisis encontró el hecho, no
 * la del hecho: en la 453, la alerta decía «Se detectó a las 09:36» y el pegado figura en el registro
 * a las 09:35:08, y los docentes buscaban 09:36 y no lo encontraban (ronda 2). La hora del hecho la
 * escribe el motor en el texto, con la misma hora y el mismo número de pregunta que la fila del
 * registro: «A las 09:35, en la pregunta 3, …» (ronda 3).
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

// ---- Rótulos del nivel y del origen ----------------------------------------------------------
// Los usan el detalle de la sesión, la columna «Análisis» de la lista y el resumen de la
// evaluación: viven acá para no duplicarlos.

/**
 * El nivel de cada alerta, con los nombres del criterio de HU06 (riesgo bajo, medio o alto). «Riesgo» y no
 * «Nivel»: «Nivel bajo» solo se leía como el nivel del alumno. El medidor de al lado dice lo mismo en dibujo.
 */
export const NIVELES: Record<AlertaDeSesion["level"], string> = {
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto",
};

/**
 * De dónde sale la alerta, escrito. Se elige por `origin`, nunca por el texto. Sin ícono: el de capas
 * y el de ubicación no se entendían sin una leyenda, y el texto ya alcanza.
 */
export const ORIGENES: Record<AlertaDeSesion["origin"], string> = {
  model: "En toda la sesión",
  event: "En un momento de la sesión",
};

/**
 * Lo que se dice de una sesión sin alertas, según su último análisis (decisión 6 del Sprint 4). Una
 * sesión sin alertas no tiene nivel y nunca se muestra como «Riesgo bajo»: «Sin alertas» solo si se
 * analizó. «No se pudo analizar» es el mismo texto del detalle; toda sesión recién abierta pasa unos
 * dos minutos por ese estado, hasta su segundo análisis.
 */
export const ESTADOS_SIN_ALERTAS: Record<EstadoDelAnalisis, string> = {
  analyzed: "Sin alertas",
  not_analyzed: "Sin analizar",
  insufficient_evidence: "No se pudo analizar",
  unavailable: "Análisis no disponible",
};

/**
 * El renglón aparte de una sesión con alertas cuyo último cálculo no se pudo hacer: el nivel sigue
 * a la vista y el estado se agrega, sin ocultarlo. Con `analyzed` no se agrega nada.
 */
export const ULTIMO_ANALISIS: Record<Exclude<EstadoDelAnalisis, "analyzed">, string> = {
  not_analyzed: "Último análisis: sin analizar",
  insufficient_evidence: "Último análisis: no se pudo analizar",
  unavailable: "Último análisis: no disponible",
};

/**
 * Cuántas alertas tiene una sesión y de dónde salieron: «1 alerta: en un momento de la sesión» o
 * «2 alertas: en toda la sesión y en un momento de la sesión». Vacío si no tiene.
 */
export function cantidadYOrigen(sesion: Pick<Sesion, "alerts_count" | "alert_origins">): string {
  const cantidad = sesion.alerts_count ?? 0;
  if (cantidad === 0) return "";
  const origenes = (sesion.alert_origins ?? []).map((o) => ORIGENES[o].toLowerCase());
  const rotulo = cantidad === 1 ? "1 alerta" : `${cantidad} alertas`;
  return origenes.length > 0 ? `${rotulo}: ${origenes.join(" y ")}` : rotulo;
}
