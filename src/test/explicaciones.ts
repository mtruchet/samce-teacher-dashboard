/*
 * Las explicaciones reales que escribe el motor (rama `feature/textos-claros-para-el-docente`) para
 * las sesiones de referencia del «Segundo Parcial (réplica del campus)», copiadas tal como quedaron
 * en `session_alerts.explanation` de la réplica local después de volver a analizarlas.
 */

/** Intento 453: la alerta de toda la sesión. */
export const MODELO_453 = [
  "Esta sesión se rindió de una forma un poco distinta a lo común en un examen.",
  "Lo que más llamó la atención:",
  "• Pegó un texto largo de una sola vez.",
  "• En todo el examen pegó texto 1 vez.",
  "• Le dedicó unos 3 minutos a cada pregunta, cuando lo común es alrededor de 1 minuto.",
].join("\n");

/** Intento 453: la alerta de un momento de la sesión. */
export const EVENTO_453 =
  "Pegó de una sola vez un texto largo en una respuesta que todavía estaba vacía, algo poco común en un examen.";

/** Intento 454: la alerta de toda la sesión, de nivel alto. */
export const MODELO_454 = [
  "Esta sesión se rindió de una forma muy distinta a lo común en un examen.",
  "Lo que más llamó la atención:",
  "• Estuvo fuera del examen unos 8 minutos en total.",
  "• Pasó a otras aplicaciones de la computadora más veces de lo común.",
  "• Su salida más larga del examen duró 45 segundos.",
].join("\n");

/** Intento 457: el motivo de la sesión que no se pudo analizar. */
export const SIN_EVIDENCIA_457 =
  "Se registró menos de un minuto de esta sesión, y con tan poco tiempo no se puede analizar.";

/** El motivo de «no disponible». */
export const NO_DISPONIBLE = "El análisis no está disponible en este momento.";
