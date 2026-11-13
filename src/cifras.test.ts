import { describe, expect, it } from "vitest";
import { duracion } from "./cifras";

describe("duracion", () => {
  it("bajo la hora va en minutos y desde la hora en horas y minutos, con la unidad pegada", () => {
    expect(duracion(45)).toBe("45 min");
    expect(duracion(120)).toBe("2 h");
    expect(duracion(13245)).toBe("220 h 45 min");
  });

  it("las horas llevan el punto de los miles, como toda cifra del panel", () => {
    expect(duracion(1234 * 60 + 5)).toBe("1.234 h 5 min");
  });
});
