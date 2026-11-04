/*
 * Las explicaciones reales que escribe el motor (rama `feature/textos-claros-para-el-docente`) para
 * las sesiones de referencia del «Segundo Parcial (réplica del campus)», copiadas tal como quedaron
 * en `session_alerts.explanation` de la réplica local después de volver a analizarlas.
 */

/**
 * Intento 453: la alerta de toda la sesión. El pegado se nombra sin volver a contarlo, con la misma hora y la misma
 * pregunta que la alerta del pegado y sin nombrar «la otra alerta»; el tiempo por pregunta va al final y «en general».
 */
export const MODELO_453 = [
  "Este examen se desarrolló de una forma un poco distinta a lo que suele verse en una evaluación.",
  "Lo que más se notó:",
  "• El texto largo que pegó a las 09:35 en la pregunta 3.",
  "• En general, se tomó más tiempo que la mayoría para responder.",
].join("\n");

/** Intento 453: la alerta de un momento de la sesión, con la hora (la de su fila en el registro) y la pregunta. */
export const EVENTO_453 =
  "A las 09:35, en la pregunta 3, pegó de una sola vez un texto largo en una respuesta que todavía estaba vacía, algo poco común en un examen.";

/** Intento 454: la alerta de toda la sesión, de nivel alto. Las salidas, de lo general a lo particular. */
export const MODELO_454 = [
  "Este examen se desarrolló de una forma muy distinta a lo que suele verse en una evaluación.",
  "Lo que más se notó:",
  "• Pasó a otra ventana 11 veces.",
  "• En total, estuvo unos 8 minutos fuera de la ventana del examen, de los 28 que duró.",
  "• La vez más larga fue de 45 segundos.",
].join("\n");

/** Intento 457: el motivo de la sesión que no se pudo analizar. */
export const SIN_EVIDENCIA_457 =
  "Se registró menos de un minuto del examen, y con tan poco tiempo no alcanza para analizarlo.";

/** El motivo de «no disponible». */
export const NO_DISPONIBLE = "El análisis no está disponible en este momento.";
