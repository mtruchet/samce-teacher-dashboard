import { describe, expect, it } from "vitest";
import { ordenarExplicacion } from "./explicacion";
import { EVENTO_453, MODELO_453, MODELO_454 } from "./test/explicaciones";

describe("ordenarExplicacion", () => {
  it("la alerta de toda la sesión de la 453: el hecho, el rótulo sin los dos puntos y las viñetas tal cual", () => {
    const e = ordenarExplicacion(MODELO_453);

    expect(e.hecho).toBe("Este examen se rindió de una forma un poco distinta a la mayoría de los exámenes.");
    expect(e.encabezadoDeLista).toBe("Lo que más se notó");
    expect(e.viñetas).toEqual(MODELO_453.split("\n").filter((r) => r.startsWith("• ")).map((r) => r.slice(2)));
    expect(e.viñetas.length).toBeGreaterThan(0);
    expect(e.notasAntes).toEqual([]);
  });

  it("la alerta de toda la sesión de la 454: lo mismo, con su titular de nivel alto", () => {
    const e = ordenarExplicacion(MODELO_454);

    expect(e.hecho).toBe("Este examen se rindió de una forma muy distinta a la mayoría de los exámenes.");
    expect(e.encabezadoDeLista).toBe("Lo que más se notó");
    expect(e.viñetas).toEqual([
      "Pasó a otra ventana 11 veces.",
      "En total, estuvo unos 8 minutos fuera de la ventana del examen, de los 28 que duró.",
      "La vez más larga fue de 45 segundos.",
    ]);
    for (const v of e.viñetas) expect(v).not.toMatch(/^•/);
  });

  it("la alerta de un momento de la 453 es una sola oración: solo el hecho, sin lista ni notas", () => {
    const e = ordenarExplicacion(EVENTO_453);

    expect(e.hecho).toBe(EVENTO_453);
    expect(e.encabezadoDeLista).toBeNull();
    expect(e.viñetas).toEqual([]);
    expect(e.notas).toEqual([]);
  });

  it("las notas que siguen a la lista (la combinación, la conexión) salen tal cual y en orden", () => {
    const combinacion = "Ninguna de estas cosas es rara por sí sola. Lo poco común es que se den juntas.";
    const conexion = "Parte de esto puede deberse a cortes de la conexión a internet, que no dependen del alumno.";
    const e = ordenarExplicacion([
      "Este examen se rindió de una forma bastante distinta a la mayoría de los exámenes.",
      "Lo que más se notó:",
      "• La conexión a internet se cortó más veces que en la mayoría.",
      combinacion,
      conexion,
    ].join("\n"));

    expect(e.viñetas).toEqual(["La conexión a internet se cortó más veces que en la mayoría."]);
    expect(e.notas).toEqual([combinacion, conexion]);
  });

  it("un renglón que no conoce no se descarta: sale como nota, idéntico", () => {
    const raro = "Un renglón que el motor todavía no escribía (con 3 cifras: 1, 2 y 3).";
    const e = ordenarExplicacion(["Pegó de una sola vez un texto largo.", raro].join("\n"));

    expect(e.hecho).toBe("Pegó de una sola vez un texto largo.");
    expect(e.notas).toEqual([raro]);
  });

  it("sin rótulo, las viñetas igual forman la lista", () => {
    const e = ordenarExplicacion(["Algo pasó.", "• Una cosa.", "• Otra cosa."].join("\n"));

    expect(e.encabezadoDeLista).toBeNull();
    expect(e.viñetas).toEqual(["Una cosa.", "Otra cosa."]);
  });

  it("si el motor no manda lista, no hay lista", () => {
    const e = ordenarExplicacion("Este examen se rindió de una forma un poco distinta a la mayoría de los exámenes.");

    expect(e.encabezadoDeLista).toBeNull();
    expect(e.viñetas).toEqual([]);
    expect(e.notas).toEqual([]);
  });

  it("una alerta vieja sin volver a analizar: el cierre se oculta y lo demás sale tal cual", () => {
    const e = ordenarExplicacion([
      "Esta sesión se aparta levemente de lo habitual.",
      "Menos del 5 % de las sesiones esperadas llega a comportarse así.",
      "Lo que más pesó:",
      "• Pegado más largo: 301 caracteres (lo esperado: 0 caracteres)",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n"));

    expect(e.hecho).toBe("Esta sesión se aparta levemente de lo habitual.");
    expect(e.notasAntes).toEqual(["Menos del 5 % de las sesiones esperadas llega a comportarse así."]);
    expect(e.encabezadoDeLista).toBe("Lo que más pesó");
    expect(e.viñetas).toEqual(["Pegado más largo: 301 caracteres (lo esperado: 0 caracteres)"]);
    expect(JSON.stringify(e)).not.toMatch(/no atribuye intención/);
  });

  it("nunca muestra el índice: el renglón propio de una alerta vieja se descarta", () => {
    const e = ordenarExplicacion([
      "Esta sesión se aparta de lo habitual.",
      "El índice de la sesión es 60 de 100.",
      "Esto describe lo observado y no atribuye intención: la revisión es del docente.",
    ].join("\n"));

    expect(e.hecho).toBe("Esta sesión se aparta de lo habitual.");
    expect(JSON.stringify(e)).not.toMatch(/índice|60 de 100/);
  });

  it("en una alerta vieja de un solo renglón se quita la cláusula del índice y queda la frase con mayúscula", () => {
    const e = ordenarExplicacion(
      "El índice de la sesión es 60 de 100: su comportamiento se parece al de menos del 1 % de las sesiones esperadas."
    );
    expect(e.hecho).toBe("Su comportamiento se parece al de menos del 1 % de las sesiones esperadas.");
  });

  it("tolera renglones en blanco, espacios sobrantes y saltos de línea de Windows", () => {
    const e = ordenarExplicacion("  Algo pasó.  \r\n\r\nLo que más se notó:\r\n•   Una cosa.  \r\n");

    expect(e.hecho).toBe("Algo pasó.");
    expect(e.encabezadoDeLista).toBe("Lo que más se notó");
    expect(e.viñetas).toEqual(["Una cosa."]);
  });

  it("un texto vacío no rompe nada", () => {
    expect(ordenarExplicacion("")).toEqual({ hecho: "", notasAntes: [], encabezadoDeLista: null, viñetas: [], notas: [] });
  });
});
