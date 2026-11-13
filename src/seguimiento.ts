import type { Captura } from "./services/sesionesService";

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

/**
 * Si la sesión dice que una página corrió sin captura, pero el aviso que lo
 * cuenta todavía no llegó al registro.
 *
 * Los diez minutos de `TRAS_EL_CIERRE_MS` no alcanzan siempre: Moodle manda el
 * aviso en una tarea que depende de su cron, y si el servidor de SAMCE no lo
 * acepta la reintenta cada vez más espaciada. La lista de sesiones, que se
 * sigue consultando, ya marca «Captura incompleta», y sin esto el registro
 * abierto se quedaba sin la fila que lo explica. Mientras falte, se sigue
 * preguntando.
 */
export function esperaElAviso(captura: Captura["state"] | undefined, yaLlego: boolean): boolean {
  return (captura === "js_disabled" || captura === "no_start") && !yaLlego;
}

/**
 * Si el registro de una sesión se sigue consultando: abierta, recién cerrada o esperando el aviso de una
 * página sin captura. La usan el ciclo del registro y la cabecera del panel, que la necesita desde el primer
 * cuadro: antes decía «En vivo» al entrar a una sesión cerrada hace rato, hasta que el registro contestaba,
 * y en un teléfono el pulso que desaparecía subía todo 35 px.
 */
export function seSigueConsultando(
  s: { status: string; closed_at?: string; capture?: { state?: Captura["state"] } },
  avisoRecibido = false
): boolean {
  return s.status === "open" || recienCerrada(s.closed_at) || esperaElAviso(s.capture?.state, avisoRecibido);
}
