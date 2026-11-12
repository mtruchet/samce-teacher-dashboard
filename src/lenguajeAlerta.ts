import { NIVELES_DE_RIESGO, type NivelDeRiesgo } from "./niveles";
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

// ---- Los niveles: su peso y sus palabras ------------------------------------------------------
// El orden sale de `NIVELES_DE_RIESGO`; acá se escribe una sola vez cuánto pesa cada nivel y cómo se dice. Lo
// usan el orden de las alertas, la evolución del riesgo, el medidor y los anuncios de la lista y del detalle.

/** Cuánto pesa cada nivel: 1, 2 o 3. Es también cuántos segmentos llena el medidor. */
export const PESO_DEL_NIVEL = Object.fromEntries(NIVELES_DE_RIESGO.map((nivel, i) => [nivel, i + 1])) as Record<
  NivelDeRiesgo,
  number
>;

/** El nivel en una palabra, para las frases: «riesgo alto», «subió a riesgo medio». */
export const PALABRA_DEL_NIVEL: Record<NivelDeRiesgo, string> = { low: "bajo", medium: "medio", high: "alto" };

/** Si el nivel subió de `antes` a `ahora`. El nivel de una alerta no baja: igual o menor es que no subió. */
export function subio(antes: NivelDeRiesgo, ahora: NivelDeRiesgo): boolean {
  return PESO_DEL_NIVEL[ahora] > PESO_DEL_NIVEL[antes];
}

/** El más alto de los niveles que recibe, sin contar los vacíos. Nulo si no hay ninguno. */
export function nivelMasAlto(niveles: Iterable<NivelDeRiesgo | null | undefined>): NivelDeRiesgo | null {
  let mayor: NivelDeRiesgo | null = null;
  for (const nivel of niveles) {
    if (nivel && (mayor === null || subio(mayor, nivel))) mayor = nivel;
  }
  return mayor;
}

// ---- Orden de las alertas --------------------------------------------------------------------

/**
 * Las alertas de una sesión, de mayor a menor nivel; si empatan, primero la de toda la
 * sesión. Son a lo sumo dos y de la misma sesión: ordenarlas no compara alumnos. No cambia el
 * arreglo que recibe.
 */
export function ordenarAlertas(alertas: AlertaDeSesion[]): AlertaDeSesion[] {
  return [...alertas].sort(
    (a, b) => PESO_DEL_NIVEL[b.level] - PESO_DEL_NIVEL[a.level] || Number(a.origin !== "model") - Number(b.origin !== "model")
  );
}

// ---- Rótulos del nivel y del origen ----------------------------------------------------------
// Los usan el detalle de la sesión, la columna «Análisis» de la lista y el resumen de la
// evaluación: viven acá para no duplicarlos.

/**
 * El nivel de cada alerta, con los nombres del criterio de HU06 (riesgo bajo, medio o alto). «Riesgo» y no
 * «Nivel»: «Nivel bajo» solo se leía como el nivel del alumno. El medidor de al lado dice lo mismo en dibujo.
 */
export const NIVELES = Object.fromEntries(
  NIVELES_DE_RIESGO.map((nivel) => [nivel, `Riesgo ${PALABRA_DEL_NIVEL[nivel]}`])
) as Record<NivelDeRiesgo, string>;

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
