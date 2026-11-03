import { describe, expect, it } from "vitest";
import { ordenarAlertas } from "./lenguajeAlerta";
import type { AlertaDeSesion } from "./services/sesionesService";

function alerta(cambios: Partial<AlertaDeSesion>): AlertaDeSesion {
  return {
    origin: "model",
    level: "low",
    explanation: "",
    level_since: "2026-11-03T12:42:50.906Z",
    created_at: "2026-11-03T12:42:50.906Z",
    updated_at: "2026-11-03T12:42:50.906Z",
    ...cambios,
  };
}

describe("ordenarAlertas", () => {
  it("un momento de la sesión con nivel alto va antes que toda la sesión con nivel bajo", () => {
    const ordenadas = ordenarAlertas([alerta({ origin: "model", level: "low" }), alerta({ origin: "event", level: "high" })]);
    expect(ordenadas.map((a) => a.origin)).toEqual(["event", "model"]);
  });

  it("con el mismo nivel, primero la de toda la sesión", () => {
    const ordenadas = ordenarAlertas([alerta({ origin: "event", level: "low" }), alerta({ origin: "model", level: "low" })]);
    expect(ordenadas.map((a) => a.origin)).toEqual(["model", "event"]);
  });

  it("no cambia el arreglo que recibe", () => {
    const original = [alerta({ origin: "model", level: "low" }), alerta({ origin: "event", level: "high" })];
    ordenarAlertas(original);
    expect(original.map((a) => a.origin)).toEqual(["model", "event"]);
  });
});
