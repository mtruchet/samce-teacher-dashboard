import { describe, expect, it } from "vitest";
import { textoDelResultado } from "./textoDelResultado";

describe("textoDelResultado (D3)", () => {
  it("«N de M sesiones», con el punto de los miles", () => {
    expect(textoDelResultado(16, 245)).toBe("16 de 245 sesiones");
    expect(textoDelResultado(1240, 1245)).toBe("1.240 de 1.245 sesiones");
    expect(textoDelResultado(0, 2)).toBe("0 de 2 sesiones");
  });

  it("con M = 1 el sustantivo concuerda: «0 de 1 sesión», «1 de 1 sesión»", () => {
    expect(textoDelResultado(0, 1)).toBe("0 de 1 sesión");
    expect(textoDelResultado(1, 1)).toBe("1 de 1 sesión");
  });
});
