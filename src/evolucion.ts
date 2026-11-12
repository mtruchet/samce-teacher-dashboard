import { PESO_DEL_NIVEL, nivelMasAlto } from "./lenguajeAlerta";
import type { AlertaDeSesion, EntradaDelHistorial, EstadoDelAnalisis, NivelDeRiesgo } from "./services/sesionesService";

/**
 * Cómo cambió el riesgo de una sesión a lo largo del examen (HU05, criterio 4), armado con el historial de
 * sus alertas. Puro, sin React, para probarlo aparte.
 *
 * El nivel de la sesión en cada momento es el más alto entre las alertas registradas hasta ese momento.
 * Como el nivel de una alerta no baja, la evolución tampoco baja. Se expresa en niveles y nunca en índice.
 */

type Nivel = NivelDeRiesgo;

export type Tramo =
  /** Desde el inicio, sin alertas todavía: el estado del análisis si nunca hubo alertas. */
  | { tipo: "inicio"; estado: EstadoDelAnalisis }
  /** Desde el inicio hasta la última entrada copiada. */
  | { tipo: "sin-registro" }
  /** Desde la hora del análisis que registró el cambio. */
  | { tipo: "nivel"; nivel: Nivel; desde: string };

export interface Evolucion {
  tramos: Tramo[];
  /**
   * Orígenes cuyo nivel vigente no tiene entrada en el historial: los que no tienen ninguna y los que están más
   * arriba que la más alta registrada (si se perdió una entrada). Se dicen aparte, sin hora.
   */
  sinRegistro: Array<{ origen: AlertaDeSesion["origin"]; nivel: Nivel }>;
}

export function tramosDeRiesgo(
  historial: EntradaDelHistorial[],
  alertas: AlertaDeSesion[],
  estado: EstadoDelAnalisis
): Evolucion {
  // Un origen va aparte si su nivel vigente no quedó registrado: sin entradas, o con todas por debajo. Así la
  // evolución nunca termina en un nivel menor que el de la tarjeta sin decir por qué.
  const sinRegistro = alertas
    .filter((a) => {
      const registrado = nivelMasAlto(historial.filter((e) => e.origin === a.origin).map((e) => e.level));
      return registrado === null || PESO_DEL_NIVEL[a.level] > PESO_DEL_NIVEL[registrado];
    })
    .map((a) => ({ origen: a.origin, nivel: a.level }));

  if (historial.length === 0) {
    // El tramo con el estado es solo para la sesión sin alertas. Con alertas y sin historial (una entrada que
    // se perdió), decir «sin alertas» contradecía la tarjeta de arriba: no hay registro de cómo se llegó, y
    // cada origen se dice aparte, en `sinRegistro`.
    // Con alertas y sin historial no hay escalera: el renglón de cada origen (`sinRegistro`) ya dice que no quedó
    // registro, y un paso «sin registro» arriba repetía lo mismo.
    return { tramos: alertas.length > 0 ? [] : [{ tipo: "inicio", estado }], sinRegistro };
  }

  // Hasta la última entrada copiada no se sabe nada de antes: cada copia solo dice desde cuándo su
  // alerta está en el nivel actual, y el otro origen pudo estar en un nivel que no quedó registrado.
  const ultimaCopiada = historial.reduce((u, e, i) => (e.carried_over ? i : u), -1);
  if (ultimaCopiada < 0) return { tramos: subidas(historial, [{ tipo: "inicio", estado: "analyzed" }], null), sinRegistro };

  // Una copiada que ya está en riesgo alto fija desde cuándo la sesión está en alto: no hay nivel más arriba
  // que el otro origen pudiera haber tenido antes. Sin esto, la evolución decía «alto desde 07:37» (la última
  // copiada) y el historial, «alto a las 07:29».
  const altaCopiada = historial.findIndex((e, i) => i <= ultimaCopiada && e.carried_over && e.level === "high");
  if (altaCopiada >= 0) {
    return { tramos: [{ tipo: "sin-registro" }, { tipo: "nivel", nivel: "high", desde: historial[altaCopiada].recorded_at }], sinRegistro };
  }

  const hastaLaCopiada = historial.slice(0, ultimaCopiada + 1);
  const maximo = nivelMasAlto(hastaLaCopiada.map((e) => e.level)) as Nivel;
  const tramos: Tramo[] = [
    { tipo: "sin-registro" },
    { tipo: "nivel", nivel: maximo, desde: historial[ultimaCopiada].recorded_at },
  ];
  return { tramos: subidas(historial.slice(ultimaCopiada + 1), tramos, maximo), sinRegistro };
}

/** Agrega a `tramos` un tramo por cada entrada que sube el nivel de la sesión por encima de `desde`. */
function subidas(entradas: EntradaDelHistorial[], tramos: Tramo[], desde: Nivel | null): Tramo[] {
  let maximo = desde;
  for (const entrada of entradas) {
    if (maximo === null || PESO_DEL_NIVEL[entrada.level] > PESO_DEL_NIVEL[maximo]) {
      tramos.push({ tipo: "nivel", nivel: entrada.level, desde: entrada.recorded_at });
      maximo = entrada.level;
    }
  }
  return tramos;
}

/**
 * El historial en el orden en que se muestra. Es el del backend (hora del análisis e id), salvo entre orígenes
 * distintos registrados en el mismo minuto: ahí, como las tarjetas de arriba, primero el nivel más alto y, a igual
 * nivel, el de toda la sesión. En la práctica los dos orígenes se registran en el mismo análisis, separados por
 * milisegundos, y el historial los listaba al revés que las tarjetas. Las entradas de un mismo origen no cambian
 * de orden entre sí.
 */
export function historialEnOrden(historial: EntradaDelHistorial[]): EntradaDelHistorial[] {
  const minuto = (e: EntradaDelHistorial) => Math.floor(Date.parse(e.recorded_at) / 60_000);
  const resultado: EntradaDelHistorial[] = [];
  let i = 0;
  while (i < historial.length) {
    let fin = i + 1;
    while (fin < historial.length && minuto(historial[fin]) === minuto(historial[i])) fin++;
    const grupo = historial.slice(i, fin);
    const origenes = [...new Set(grupo.map((e) => e.origin))];
    const peso = (o: EntradaDelHistorial["origin"]) =>
      Math.max(...grupo.filter((e) => e.origin === o).map((e) => PESO_DEL_NIVEL[e.level]));
    origenes.sort((a, b) => peso(b) - peso(a) || Number(a !== "model") - Number(b !== "model"));
    for (const o of origenes) resultado.push(...grupo.filter((e) => e.origin === o));
    i = fin;
  }
  return resultado;
}
