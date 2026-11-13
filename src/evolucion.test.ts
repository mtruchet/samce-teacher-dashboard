import { describe, expect, it } from "vitest";
import { historialEnOrden, tramosDeRiesgo } from "./evolucion";
import type { AlertaDeSesion, EntradaDelHistorial } from "./services/sesionesService";
import { alerta as alertaVigente, entradaDelHistorial } from "./test/fabricas";

/** Una entrada del historial a los `minuto` minutos de las 10. */
const entrada = (origin: EntradaDelHistorial["origin"], level: EntradaDelHistorial["level"], minuto: number, carried_over = false) =>
  entradaDelHistorial({ origin, level, recorded_at: `2026-11-10T10:${String(minuto).padStart(2, "0")}:00Z`, carried_over });
const alerta = (origin: AlertaDeSesion["origin"], level: AlertaDeSesion["level"]) => alertaVigente({ origin, level });

describe("tramosDeRiesgo (pendiente 10, HU05_T02)", () => {
  it("sin alertas, un solo tramo con el estado del último análisis", () => {
    for (const estado of ["analyzed", "not_analyzed", "insufficient_evidence", "unavailable"] as const) {
      expect(tramosDeRiesgo([], [], estado)).toEqual({ tramos: [{ tipo: "inicio", estado }], sinRegistro: [] });
    }
  });

  it("con alertas y sin historial no hay escalera: cada origen va aparte, sin repetir «sin registro» (H17)", () => {
    for (const estado of ["analyzed", "insufficient_evidence", "unavailable"] as const) {
      expect(tramosDeRiesgo([], [alerta("model", "high")], estado)).toEqual({
        tramos: [],
        sinRegistro: [{ origen: "model", nivel: "high" }],
      });
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
      [entrada("event", "medium", 3, true), entrada("model", "low", 7, true), entrada("model", "high", 20)],
      [], "analyzed"
    );
    expect(tramos).toEqual([
      { tipo: "sin-registro" },
      { tipo: "nivel", nivel: "medium", desde: "2026-11-10T10:07:00Z" },
      { tipo: "nivel", nivel: "high", desde: "2026-11-10T10:20:00Z" },
    ]);
  });

  it("una copiada que ya está en alto fija desde cuándo: el tramo alto empieza en ella (sesión 527)", () => {
    // El historial dice «alto a las 07:29»; antes, la evolución decía «alto desde las 07:37» (la última copiada).
    const { tramos } = tramosDeRiesgo(
      [entrada("event", "high", 29, true), entrada("model", "low", 37, true), entrada("model", "medium", 50)],
      [], "analyzed"
    );
    expect(tramos).toEqual([
      { tipo: "sin-registro" },
      { tipo: "nivel", nivel: "high", desde: "2026-11-10T10:29:00Z" },
    ]);
  });

  it("toda la sesión en alto y después un momento en alto: un solo tramo alto", () => {
    const { tramos } = tramosDeRiesgo([entrada("model", "high", 5), entrada("event", "high", 9)], [], "analyzed");
    expect(tramos).toEqual([
      { tipo: "inicio", estado: "analyzed" },
      { tipo: "nivel", nivel: "high", desde: "2026-11-10T10:05:00Z" },
    ]);
  });

  it("sin copiadas, el primer tramo es «sin alertas» (analizada), aunque el último análisis no se haya podido hacer", () => {
    const { tramos } = tramosDeRiesgo([entrada("model", "low", 5)], [], "insufficient_evidence");
    expect(tramos[0]).toEqual({ tipo: "inicio", estado: "analyzed" });
  });

  it("una sola copiada en bajo da un tramo bajo desde ella", () => {
    const { tramos } = tramosDeRiesgo([entrada("model", "low", 5, true)], [alerta("model", "low")], "analyzed");
    expect(tramos).toEqual([{ tipo: "sin-registro" }, { tipo: "nivel", nivel: "low", desde: "2026-11-10T10:05:00Z" }]);
  });

  it("si el nivel vigente supera al más alto registrado de su origen, va aparte como sin registro", () => {
    // Se perdió una entrada: la tarjeta dice «Riesgo medio» y el historial llega hasta bajo.
    const { tramos, sinRegistro } = tramosDeRiesgo([entrada("model", "low", 5)], [alerta("model", "medium")], "analyzed");
    expect(sinRegistro).toEqual([{ origen: "model", nivel: "medium" }]);
    expect(tramos.map((t) => (t.tipo === "nivel" ? t.nivel : t.tipo))).toEqual(["inicio", "low"]);
  });

  it("un origen con alerta vigente y sin entradas va aparte, sin hora", () => {
    const { tramos, sinRegistro } = tramosDeRiesgo([entrada("model", "low", 5)], [alerta("model", "low"), alerta("event", "medium")], "analyzed");
    expect(sinRegistro).toEqual([{ origen: "event", nivel: "medium" }]);
    expect(tramos).toHaveLength(2);
  });
});

describe("historialEnOrden (V3)", () => {
  const en = (origin: EntradaDelHistorial["origin"], level: EntradaDelHistorial["level"], iso: string) =>
    entradaDelHistorial({ origin, level, recorded_at: iso });

  it("en el mismo minuto, entre orígenes distintos, va primero el nivel más alto, como las tarjetas", () => {
    const medio = en("model", "medium", "2026-11-04T03:53:02.627Z");
    const alto = en("event", "high", "2026-11-04T03:53:02.678Z");
    expect(historialEnOrden([medio, alto])).toEqual([alto, medio]);
  });

  it("a igual nivel y mismo minuto, primero el de toda la sesión", () => {
    const evento = en("event", "low", "2026-11-04T03:53:02.100Z");
    const modelo = en("model", "low", "2026-11-04T03:53:02.200Z");
    expect(historialEnOrden([evento, modelo])).toEqual([modelo, evento]);
  });

  it("entre minutos distintos no cambia el orden cronológico, y un mismo origen tampoco se reordena", () => {
    const a = en("model", "high", "2026-11-04T03:50:00Z");
    const b = en("event", "low", "2026-11-04T03:53:00Z");
    const c = en("event", "medium", "2026-11-04T03:53:10Z");
    expect(historialEnOrden([a, b, c])).toEqual([a, b, c]);
  });
});
