import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { Evento, SesionNumerada } from "../services/sesionesService";

/**
 * Datos de prueba compartidos. Cada archivo pisa solo lo que su caso necesita,
 * así lo que cambia de un caso a otro se ve en el caso y no en una copia entera
 * del objeto.
 */

/** Una sesión abierta de Ana Gómez en el examen 3, con un solo intento. */
export function sesionNumerada(cambios: Partial<SesionNumerada> = {}): SesionNumerada {
  return {
    id: 7,
    moodle_attempt_id: 7001,
    moodle_user_id: 41,
    student_name: "Ana Gómez",
    status: "open",
    started_at: "2026-09-21T14:00:00Z",
    examenId: 3,
    intento: 1,
    intentos: 1,
    ...cambios,
  };
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
