/*
 * Las explicaciones reales que escribe el motor (rama `feature/textos-claros-para-el-docente`) para
 * las sesiones de referencia del «Segundo Parcial (réplica del campus)», copiadas tal como quedaron
 * en `session_alerts.explanation` de la réplica local después de volver a analizarlas.
 */

/** Intento 453: la alerta de toda la sesión. El pegado se dice una sola vez y nombra a la otra alerta. */
export const MODELO_453 = [
  "Este examen se rindió de una forma un poco distinta a lo habitual.",
  "En qué se diferenció de lo habitual:",
  "• Pegó texto una sola vez: el texto largo de la pregunta 3 que describe la otra alerta.",
  "• Se tomó más tiempo que lo habitual en cada pregunta.",
].join("\n");

/** Intento 453: la alerta de un momento de la sesión, con la pregunta en la que pasó. */
export const EVENTO_453 =
  "En la pregunta 3, pegó de una sola vez un texto largo en una respuesta que todavía estaba vacía, algo poco común en un examen.";

/** Intento 454: la alerta de toda la sesión, de nivel alto. */
export const MODELO_454 = [
  "Este examen se rindió de una forma muy distinta a lo habitual.",
  "En qué se diferenció de lo habitual:",
  "• En total, estuvo unos ocho minutos fuera de la ventana del examen.",
  "• Pasó a otra ventana 11 veces.",
  "• La vez que más tiempo estuvo fuera de la ventana del examen fue de 45 segundos.",
].join("\n");

/** Intento 457: el motivo de la sesión que no se pudo analizar. */
export const SIN_EVIDENCIA_457 =
  "Se registró menos de un minuto del examen, y con tan poco tiempo no se puede analizar.";

/** El motivo de «no disponible». */
export const NO_DISPONIBLE = "El análisis no está disponible en este momento.";
