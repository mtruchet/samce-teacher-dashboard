import { nivelMasAlto, subio } from "./lenguajeAlerta";
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
  /** Desde el inicio hasta la última entrada copiada: lo anterior no quedó registrado. */
  | { tipo: "sin-registro" }
  /** Desde la hora del análisis que registró el cambio. */
  | { tipo: "nivel"; nivel: Nivel; desde: string };

export interface Evolucion {
  tramos: Tramo[];
  /** Orígenes con alerta vigente y ninguna entrada en el historial: se dicen aparte, sin hora. */
  sinRegistro: Array<{ origen: AlertaDeSesion["origin"]; nivel: Nivel }>;
}

export function tramosDeRiesgo(
  historial: EntradaDelHistorial[],
  alertas: AlertaDeSesion[],
  estado: EstadoDelAnalisis
): Evolucion {
  const conEntradas = new Set(historial.map((e) => e.origin));
  const sinRegistro = alertas
    .filter((a) => !conEntradas.has(a.origin))
    .map((a) => ({ origen: a.origin, nivel: a.level }));

  if (historial.length === 0) {
    return { tramos: [{ tipo: "inicio", estado }], sinRegistro };
  }

  // Hasta la última entrada copiada no se sabe nada de antes: cada copia solo dice desde cuándo su
  // alerta está en el nivel actual, y el otro origen pudo estar en un nivel que no quedó registrado.
  const ultimaCopiada = historial.reduce((u, e, i) => (e.carried_over ? i : u), -1);
  const tramos: Tramo[] = [ultimaCopiada >= 0 ? { tipo: "sin-registro" } : { tipo: "inicio", estado: "analyzed" }];

  // El nivel de la sesión hasta la entrada que se está mirando: el más alto de los registrados.
  let maximo: Nivel | null = null;
  historial.forEach((entrada, i) => {
    const antes = maximo;
    maximo = nivelMasAlto([antes, entrada.level]);
    if (i < ultimaCopiada) return;
    if (i === ultimaCopiada) {
      tramos.push({ tipo: "nivel", nivel: maximo ?? entrada.level, desde: entrada.recorded_at });
      return;
    }
    if (antes === null || subio(antes, entrada.level)) {
      tramos.push({ tipo: "nivel", nivel: entrada.level, desde: entrada.recorded_at });
    }
  });
  return { tramos, sinRegistro };
}
