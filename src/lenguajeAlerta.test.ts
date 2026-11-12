import { describe, expect, it } from "vitest";
import { NIVELES, PALABRA_DEL_NIVEL, PESO_DEL_NIVEL, nivelMasAlto, ordenarAlertas, subio } from "./lenguajeAlerta";
import { NIVELES_DE_RIESGO } from "./services/sesionesService";
import { alerta } from "./test/fabricas";
import { choquesConLasListas } from "./test/lenguaje";

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

describe("los niveles, en un solo lugar", () => {
  it("el orden es bajo, medio y alto, y el peso es la posición más uno", () => {
    expect(NIVELES_DE_RIESGO).toEqual(["low", "medium", "high"]);
    expect(PESO_DEL_NIVEL).toEqual({ low: 1, medium: 2, high: 3 });
  });

  it("los niveles se escriben siempre «Riesgo …», y la palabra suelta va en minúscula para las frases", () => {
    expect(NIVELES).toEqual({ low: "Riesgo bajo", medium: "Riesgo medio", high: "Riesgo alto" });
    expect(PALABRA_DEL_NIVEL).toEqual({ low: "bajo", medium: "medio", high: "alto" });
    expect(choquesConLasListas([...Object.values(NIVELES), ...Object.values(PALABRA_DEL_NIVEL)])).toEqual([]);
  });

  it("subio: solo cuando el nivel nuevo pesa más", () => {
    expect(subio("low", "medium")).toBe(true);
    expect(subio("medium", "high")).toBe(true);
    expect(subio("low", "high")).toBe(true);
    expect(subio("medium", "medium")).toBe(false);
    expect(subio("high", "low")).toBe(false);
  });

  it("nivelMasAlto: el de más peso, sin contar los vacíos; nulo si no hay ninguno", () => {
    expect(nivelMasAlto(["low", "high", "medium"])).toBe("high");
    expect(nivelMasAlto([null, "medium", undefined, "low"])).toBe("medium");
    expect(nivelMasAlto([])).toBeNull();
    expect(nivelMasAlto([null, undefined])).toBeNull();
  });
});
