import { describe, expect, it } from "vitest";
import { Check, Info, Ojo, Reloj } from "./iconos";
import { alerta, analisis } from "./test/fabricas";
import { choquesConLasListas } from "./test/lenguaje";
import { veredictoDe } from "./veredicto";

describe("veredictoDe", () => {
  it("con alertas cuenta cuántas hay y, con una de cada origen, de qué trata cada una", () => {
    const dos = [alerta({ origin: "model" }), alerta({ origin: "event" })];
    expect(veredictoDe(analisis({ alerts: dos }), dos, false)).toMatchObject({
      icono: Ojo,
      frase: "Hay 2 alertas para revisar.",
      bajadas: ["Una es sobre toda la sesión y la otra, sobre un momento puntual."],
    });
    const una = [alerta()];
    expect(veredictoDe(analisis({ alerts: una }), una, false).frase).toBe("Hay 1 alerta para revisar.");
  });

  it("sin alertas, cada estado con su frase y su ícono", () => {
    expect(veredictoDe(analisis(), [], false)).toMatchObject({ icono: Check, frase: "No hay alertas para revisar.", tono: "sin-alertas" });
    expect(veredictoDe(analisis(), [], true).frase).toBe("Por ahora no hay alertas para revisar.");
    expect(veredictoDe(analisis({ state: "not_analyzed" }), [], false)).toMatchObject({ icono: Reloj, bajadas: [] });
    expect(veredictoDe(analisis({ state: "insufficient_evidence", reason: "Motivo." }), [], false)).toMatchObject({
      icono: Info,
      frase: "Esta sesión no se pudo analizar.",
      bajadas: ["Motivo.", "Esto no indica ningún problema en el examen. Abajo está todo lo que se registró."],
    });
  });

  it("dice que el análisis no está disponible, con alertas o sin ellas (por eso las métricas no lo repiten)", () => {
    const sin = veredictoDe(analisis({ state: "unavailable" }), [], false);
    expect(sin).toMatchObject({ frase: "El análisis no está disponible en este momento." });
    const con = [alerta({ origin: "event" })];
    const conAlerta = veredictoDe(analisis({ state: "unavailable", alerts: con }), con, false);
    expect(conAlerta.bajadas).toEqual(["El análisis de la sesión completa no está disponible en este momento."]);
  });

  it("nunca dice un nivel, y sus textos pasan las listas de las rondas", () => {
    const casos = [
      veredictoDe(analisis({ alerts: [alerta({ level: "high" })] }), [alerta({ level: "high" })], false),
      veredictoDe(analisis(), [], true),
      veredictoDe(analisis({ state: "not_analyzed" }), [], true),
      veredictoDe(analisis({ state: "insufficient_evidence" }), [], false),
      veredictoDe(analisis({ state: "unavailable" }), [], false),
    ];
    const textos = casos.flatMap((v) => [v.frase, ...v.bajadas]);
    for (const t of textos) expect(t).not.toMatch(/riesgo (bajo|medio|alto)|nivel/i);
    expect(choquesConLasListas(textos)).toEqual([]);
  });
});
