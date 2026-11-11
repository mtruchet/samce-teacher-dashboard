import { describe, expect, it } from "vitest";
import { tramosDeRiesgo } from "./evolucion";
import type { AlertaDeSesion, EntradaDelHistorial } from "./services/sesionesService";

const entrada = (origin: EntradaDelHistorial["origin"], level: EntradaDelHistorial["level"], minuto: number, carried_over = false): EntradaDelHistorial => ({
  origin, level, explanation: "x", recorded_at: `2026-11-10T10:${String(minuto).padStart(2, "0")}:00Z`, carried_over,
});
const alerta = (origin: AlertaDeSesion["origin"], level: AlertaDeSesion["level"]): AlertaDeSesion => ({
  origin, level, explanation: "x", level_since: "2026-11-10T10:00:00Z", created_at: "2026-11-10T10:00:00Z", updated_at: "2026-11-10T10:00:00Z",
});

describe("tramosDeRiesgo", () => {
  it("sin alertas, un solo tramo con el estado del último análisis", () => {
    for (const estado of ["analyzed", "not_analyzed", "insufficient_evidence", "unavailable"] as const) {
      expect(tramosDeRiesgo([], [], estado)).toEqual({ tramos: [{ tipo: "inicio", estado }], sinRegistro: [] });
    }
  });

  it("empieza sin alertas y cada subida es un tramo con la hora del análisis", () => {
    const { tramos } = tramosDeRiesgo([entrada("model", "low", 5), entrada("event", "high", 9)], [], "analyzed");
    expect(tramos).toEqual([
      { tipo: "inicio", estado: "analyzed" },
      { tipo: "nivel", nivel: "low", desde: "2026-11-10T10:05:00Z" },
      { tipo: "nivel", nivel: "high", desde: "2026-11-10T10:09:00Z" },
    ]);
  });

  it("nunca baja: una alerta de nivel menor de otro origen no agrega un tramo", () => {
    const { tramos } = tramosDeRiesgo([entrada("model", "high", 5), entrada("event", "low", 9)], [], "analyzed");
    expect(tramos.map((t) => (t.tipo === "nivel" ? t.nivel : t.tipo))).toEqual(["inicio", "high"]);
  });

  it("con entradas copiadas, sin registro hasta la última copiada y el máximo desde ahí", () => {
    const { tramos } = tramosDeRiesgo(
      [entrada("event", "high", 3, true), entrada("model", "low", 7, true), entrada("model", "medium", 20)],
      [], "analyzed"
    );
    expect(tramos).toEqual([
      { tipo: "sin-registro" },
      { tipo: "nivel", nivel: "high", desde: "2026-11-10T10:07:00Z" },
    ]);
  });

  it("un origen con alerta vigente y sin entradas va aparte, sin hora", () => {
    const { tramos, sinRegistro } = tramosDeRiesgo([entrada("model", "low", 5)], [alerta("model", "low"), alerta("event", "medium")], "analyzed");
    expect(sinRegistro).toEqual([{ origen: "event", nivel: "medium" }]);
    expect(tramos).toHaveLength(2);
  });
});
