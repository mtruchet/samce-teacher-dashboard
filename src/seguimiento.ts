/**
 * Hasta cuándo el panel sigue preguntando por una sesión que ya se cerró.
 *
 * Parte de lo último llega después de la entrega: el aviso de que una página corrió sin
 * captura lo manda Moodle en una tarea programada, y el análisis de la sesión se calcula
 * cuando llegan sus últimos eventos. Por eso el registro de eventos y el análisis siguen
 * consultando unos minutos más y recién ahí dejan de preguntar.
 */
export const TRAS_EL_CIERRE_MS = 10 * 60 * 1000;

/** Si una sesión cerrada todavía puede recibir lo que llega tarde. */
export function recienCerrada(closedAt: string | undefined): boolean {
  if (!closedAt) return false;
  const cierre = Date.parse(closedAt);
  return !Number.isNaN(cierre) && Date.now() - cierre < TRAS_EL_CIERRE_MS;
}
