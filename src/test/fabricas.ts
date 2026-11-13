import { act } from "@testing-library/react";
import { vi } from "vitest";
import * as sesionesService from "../services/sesionesService";
import type {
  AlertaDeSesion,
  Analisis,
  EntradaDelHistorial,
  EstadoDelAnalisis,
  Evento,
  Metricas,
  NivelDeRiesgo,
  ResumenDeEvaluacion,
  Sesion,
  SesionNumerada,
} from "../services/sesionesService";
import { MODELO_453 } from "./explicaciones";

/**
 * Datos de prueba compartidos. Cada archivo pisa solo lo que su caso necesita,
 * así lo que cambia de un caso a otro se ve en el caso y no en una copia entera
 * del objeto.
 */

/** Una sesión abierta de Ana Gómez, como la devuelve la lista del backend. */
export function sesion(cambios: Partial<Sesion> = {}): Sesion {
  return {
    id: 7,
    moodle_attempt_id: 7001,
    moodle_user_id: 41,
    student_name: "Ana Gómez",
    status: "open",
    started_at: "2026-09-21T14:00:00Z",
    ...cambios,
  };
}

/** La misma sesión, ya en el examen 3 y con un solo intento. */
export function sesionNumerada(cambios: Partial<SesionNumerada> = {}): SesionNumerada {
  return { ...sesion(), examenId: 3, intento: 1, intentos: 1, ...cambios };
}

/** Un evento con `id` y `seq` iguales, salvo que el caso diga otra cosa. */
export function evento(seq: number, type: string, data: Record<string, unknown> = {}, cambios: Partial<Evento> = {}): Evento {
  return {
    id: seq,
    seq,
    type,
    occurred_at: "2026-09-21T14:05:00.000Z",
    received_at: "2026-09-21T14:05:03.000Z",
    data,
    ...cambios,
  };
}

/** Avanza los relojes falsos y deja que React termine de pintar. */
export const esperar = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/**
 * Una página de la lista como la devuelve `traerSesiones`. Sin total ni resumen es un backend viejo; con
 * `total` es la cabecera X-Total-Count, y con `resumen`, el resumen de la evaluación.
 */
export function pagina(
  sesiones: Sesion[],
  total: number | null = null,
  resumen: ResumenDeEvaluacion | null = null
): sesionesService.PaginaDeSesiones {
  return { sesiones, total, resumen };
}

/**
 * Los cuatro campos del análisis de una sesión en la lista, coherentes entre sí: con un nivel, tantas alertas
 * como orígenes (una de toda la sesión si no se dice otra cosa); sin nivel, ninguna. Se esparce sobre
 * `sesionNumerada`: `sesionNumerada({ id: 2, ...conAnalisis("high", ["model", "event"]) })`.
 */
export function conAnalisis(
  nivel: NivelDeRiesgo | null,
  origenes: Array<AlertaDeSesion["origin"]> = nivel ? ["model"] : [],
  estado: EstadoDelAnalisis = "analyzed"
): Pick<Sesion, "risk_level" | "alerts_count" | "alert_origins" | "analysis_state"> {
  if (Boolean(nivel) !== origenes.length > 0) {
    throw new Error("conAnalisis: una sesión con nivel tiene al menos una alerta, y una sin nivel no tiene ninguna");
  }
  return { risk_level: nivel, alerts_count: origenes.length, alert_origins: origenes, analysis_state: estado };
}

/** La hora del último análisis de las fábricas de abajo. */
export const CALCULO = "2026-10-23T14:30:05.123Z";

/** Una alerta de toda la sesión en riesgo medio, con la explicación real de la 453. */
export function alerta(cambios: Partial<AlertaDeSesion> = {}): AlertaDeSesion {
  return {
    origin: "model",
    level: "medium",
    explanation: MODELO_453,
    level_since: "2026-10-23T14:10:00.000Z",
    created_at: "2026-10-23T14:00:00.000Z",
    updated_at: CALCULO,
    ...cambios,
  };
}

/** La entrada del historial que dejó la alerta de `alerta()` al llegar a su nivel. No es copiada. */
export function entradaDelHistorial(cambios: Partial<EntradaDelHistorial> = {}): EntradaDelHistorial {
  return {
    origin: "model",
    level: "medium",
    explanation: MODELO_453,
    recorded_at: "2026-10-23T14:10:00.000Z",
    carried_over: false,
    ...cambios,
  };
}

/** El análisis de una sesión analizada, sin alertas, con el historial vacío y sin métricas del cierre. */
export function analisis(cambios: Partial<Analisis> = {}): Analisis {
  return {
    state: "analyzed",
    reason: null,
    calculated_at: CALCULO,
    alerts: [],
    alert_history: [],
    metrics: null,
    ...cambios,
  };
}

/** Las ocho métricas del cierre, todas con dato. Las dos proporciones llegan pero el panel no las muestra. */
export function metricasDelCierre(cambios: Partial<Metricas> = {}): Metricas {
  return {
    outside_time_ratio: 0.12,
    outside_longest_s: 95,
    typing_rate_median_per_s: 4.2,
    largest_paste_chars: 1240,
    pasted_chars_ratio: 0.4,
    mouse_idle_longest_s: 300,
    question_time_median_s: 120,
    silence_longest_s: 180,
    ...cambios,
  };
}

/** El resumen de la evaluación con los siete recuentos en 0; el total es la suma, salvo que se diga otro. */
export function resumen(cambios: Partial<ResumenDeEvaluacion> = {}): ResumenDeEvaluacion {
  const r: ResumenDeEvaluacion = {
    total: 0,
    risk_high: 0,
    risk_medium: 0,
    risk_low: 0,
    no_alerts: 0,
    not_analyzed: 0,
    insufficient_evidence: 0,
    unavailable: 0,
    ...cambios,
  };
  if (cambios.total === undefined) {
    r.total = r.risk_high + r.risk_medium + r.risk_low + r.no_alerts + r.not_analyzed + r.insufficient_evidence + r.unavailable;
  }
  return r;
}

/** Simula `traerSesiones` con una lista fija. Devuelve el espía, para preguntarle con qué se llamó. */
export function simularSesiones(sesiones: Sesion[]) {
  return vi.spyOn(sesionesService, "traerSesiones").mockResolvedValue(pagina(sesiones));
}
