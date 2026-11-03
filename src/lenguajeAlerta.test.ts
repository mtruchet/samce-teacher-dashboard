import { describe, expect, it } from "vitest";
import { horaCorta } from "./eventos";
import { horaDeLaAlerta, ordenarAlertas } from "./lenguajeAlerta";
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

describe("horaDeLaAlerta", () => {
  it("la alerta de toda la sesión no lleva hora", () => {
    expect(
      horaDeLaAlerta({ origin: "model", created_at: "2026-11-03T12:42:50.906Z", level_since: "2026-11-03T12:42:50.906Z" })
    ).toBeNull();
  });

  it("la de un momento dice «Se detectó a las», sin segundos, y nunca «Pasó» ni «Apareció»", () => {
    const h = horaDeLaAlerta({ origin: "event", created_at: "2026-11-03T12:36:55.872Z", level_since: "2026-11-03T12:36:55.872Z" });
    expect(h?.texto).toBe("Se detectó a las");
    expect(h?.hora).toBe(horaCorta("2026-11-03T12:36:55.872Z"));
    expect(h?.hora).not.toMatch(/:\d\d:\d\d/);
  });

  it("si el nivel subió, la hora es desde cuándo tiene este nivel", () => {
    const h = horaDeLaAlerta({ origin: "event", created_at: "2026-11-03T12:36:00.000Z", level_since: "2026-11-03T12:42:00.000Z" });
    expect(h?.texto).toBe("Se detectó a las");
    expect(h?.iso).toBe("2026-11-03T12:42:00.000Z");
  });

  it("sin `level_since` usa la hora de creación", () => {
    const h = horaDeLaAlerta({ origin: "event", created_at: "2026-11-03T12:36:00.000Z", level_since: undefined as unknown as string });
    expect(h?.iso).toBe("2026-11-03T12:36:00.000Z");
  });
});
