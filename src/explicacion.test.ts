import { describe, expect, it } from "vitest";
import { ordenarExplicacion } from "./explicacion";

const DEL_MOTOR = [
  "Esta sesión se aparta levemente de lo habitual.",
  "Su índice es 99,5 de 100: menos del 5 % de las sesiones esperadas se comporta así.",
  "Lo que más pesó:",
  "• Mayor hueco sin eventos: 45 segundos (lo esperado: 20 segundos)",
  "• Pausa más larga al teclear: 0 segundos (lo esperado: 3,73 segundos)",
  "• Velocidad de tecleo máxima: 10,8 caracteres por segundo (lo esperado: 5,6 caracteres por segundo)",
  "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
].join("\n");

describe("ordenarExplicacion", () => {
  it("separa el titular, la aclaración, las variables y el cierre de una alerta de modelo", () => {
    const e = ordenarExplicacion(DEL_MOTOR);

    expect(e.titular).toBe("Esta sesión se aparta levemente de lo habitual.");
    expect(e.detalle).toEqual(["Su índice es 99,5 de 100: menos del 5 % de las sesiones esperadas se comporta así."]);
    expect(e.encabezadoDeLista).toBe("Lo que más pesó:");
    expect(e.variables).toEqual([
      { etiqueta: "Mayor hueco sin eventos", observado: "45 segundos", esperado: "20 segundos" },
      { etiqueta: "Pausa más larga al teclear", observado: "0 segundos", esperado: "3,73 segundos" },
      { etiqueta: "Velocidad de tecleo máxima", observado: "10,8 caracteres por segundo", esperado: "5,6 caracteres por segundo" },
    ]);
    expect(e.viñetasSinForma).toEqual([]);
    expect(e.despues).toEqual([]);
    expect(e.cierre).toBe("Esto describe lo observado y no atribuye intención: la revisión es del docente.");
  });

  it("una alerta de evento no tiene lista: titular, aclaración y cierre", () => {
    const e = ordenarExplicacion([
      "Se pegó un bloque de 4.370 caracteres en una respuesta en la que no se había escrito nada antes.",
      "En las sesiones esperadas, el pegado más largo no pasó de 90 caracteres.",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n"));

    expect(e.titular).toContain("4.370 caracteres");
    expect(e.detalle).toEqual(["En las sesiones esperadas, el pegado más largo no pasó de 90 caracteres."]);
    expect(e.variables).toEqual([]);
    expect(e.encabezadoDeLista).toBeNull();
    expect(e.cierre).toContain("no atribuye intención");
  });

  it("lo que viene después de la lista (que ninguna variable se aparta sola) queda aparte del cierre", () => {
    const e = ordenarExplicacion([
      "Esta sesión se aparta de lo habitual.",
      "Su índice es 60 de 100: menos del 1 % de las sesiones esperadas se comporta así.",
      "Lo que más pesó:",
      "• Mouse quieto: 0,3 (lo esperado: 0,1)",
      "Ninguna de estas variables se aparta por sí sola de lo esperado, pero la combinación de variables es poco habitual.",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n"));

    expect(e.variables).toHaveLength(1);
    expect(e.despues).toEqual([
      "Ninguna de estas variables se aparta por sí sola de lo esperado, pero la combinación de variables es poco habitual.",
    ]);
    expect(e.cierre).toContain("no atribuye intención");
  });

  it("una explicación en un solo párrafo, como la de las alertas viejas, sale entera como titular", () => {
    const vieja =
      "El índice de la sesión es 60 de 100: su comportamiento se parece al de menos del 1 % de las sesiones esperadas. " +
      "Lo que más pesó: tecleo; mouse. Esto describe lo observado y no atribuye intención: la revisión es del docente.";
    const e = ordenarExplicacion(vieja);

    expect(e.titular).toBe(vieja);
    expect(e.detalle).toEqual([]);
    expect(e.variables).toEqual([]);
    expect(e.cierre).toBeNull();
  });

  it("si alguna viñeta no tiene la forma esperada no se pierde ninguna: todas salen como lista", () => {
    const e = ordenarExplicacion([
      "Esta sesión se aparta de lo habitual.",
      "Lo que más pesó:",
      "• Mayor hueco sin eventos: 45 segundos (lo esperado: 20 segundos)",
      "• Algo con otro formato",
    ].join("\n"));

    expect(e.variables).toEqual([]);
    expect(e.viñetasSinForma).toEqual([
      "Mayor hueco sin eventos: 45 segundos (lo esperado: 20 segundos)",
      "Algo con otro formato",
    ]);
  });

  it("tolera renglones en blanco, espacios sobrantes y saltos de línea de Windows", () => {
    const e = ordenarExplicacion(DEL_MOTOR.replace(/\n/g, "\r\n  ").replace("Lo que", "\r\n\r\nLo que"));
    expect(e.variables).toHaveLength(3);
    expect(e.titular).toBe("Esta sesión se aparta levemente de lo habitual.");
    expect(e.cierre).not.toBeNull();
  });

  it("un texto vacío no rompe nada", () => {
    expect(ordenarExplicacion("")).toMatchObject({ titular: "", variables: [], cierre: null });
    expect(ordenarExplicacion("  \n \n")).toMatchObject({ titular: "" });
  });
});
