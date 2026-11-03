import { describe, expect, it } from "vitest";
import tokens from "./styles/tokens.css?raw";

/**
 * El texto atenuado del apartado «Análisis de la sesión» (la hora, el origen, «Una sesión habitual», la nota de apoyo)
 * tiene que leerse sobre su fondo: relación de contraste de al menos 4,5:1 (WCAG 2.1, AA para texto normal). Los
 * trazos que dicen el nivel de una alerta (el borde, el medidor y las barras) piden al menos 3:1 (WCAG 2.1, 1.4.11).
 * Se lee de los tokens, resolviendo cada `var(--x)` hasta un hexadecimal, sin `fs`.
 */

const DECLARACION = /(--[\w-]+)\s*:\s*([^;]+);/g;

function declaraciones(): Map<string, string> {
  const mapa = new Map<string, string>();
  // Primero se sacan los comentarios: los de la derecha de una declaración nombran otros tokens («sobre --sup-1: 8,1:1»).
  const sinComentarios = tokens.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, nombre, valor] of sinComentarios.matchAll(DECLARACION)) {
    mapa.set(nombre, valor.trim());
  }
  return mapa;
}

function resolver(mapa: Map<string, string>, nombre: string): string {
  let valor = mapa.get(nombre);
  for (let i = 0; i < 10 && valor !== undefined; i++) {
    const referencia = /^var\((--[\w-]+)\)$/.exec(valor);
    if (!referencia) break;
    valor = mapa.get(referencia[1]);
  }
  if (valor === undefined || !/^#[0-9a-f]{6}$/i.test(valor)) {
    throw new Error(`${nombre} no se resuelve a un hexadecimal de seis dígitos: ${valor}`);
  }
  return valor;
}

function luminancia(hex: string): number {
  const canal = (desde: number) => {
    const c = parseInt(hex.slice(desde, desde + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

describe("contraste del texto atenuado y de los trazos del análisis", () => {
  const mapa = declaraciones();
  // Texto: la tinta atenuada sobre la lámina (--sup-1), sobre las tarjetas de las alertas y la lámina del registro
  // (--sup-2) y sobre la nota de apoyo (--sup-3); y la palabra del nivel y el titular, en --tinta, sobre la tarjeta.
  const pares: Array<[string, string]> = [
    ["--analisis-tinta-atenuada", "--sup-1"],
    ["--analisis-tinta-atenuada", "--sup-2"],
    ["--analisis-tinta-atenuada", "--sup-3"],
    ["--tinta", "--sup-2"],
    ["--celeste-hondo", "--sup-1"],
  ];

  it.each(pares)("%s sobre %s tiene al menos 4,5:1", (tinta, fondo) => {
    expect(contraste(resolver(mapa, tinta), resolver(mapa, fondo))).toBeGreaterThanOrEqual(4.5);
  });

  // Trazos y rellenos que dicen el nivel (WCAG 1.4.11, 3:1): el borde de la tarjeta y el medidor sobre la tarjeta
  // (--sup-2), y las barras sobre su pista (--sup-3).
  const graficos: Array<[string, string]> = [
    ["--alerta-tono-low", "--sup-2"],
    ["--alerta-tono-medium", "--sup-2"],
    ["--alerta-tono-high", "--sup-2"],
    ["--alerta-segmento-vacio", "--sup-2"],
    ["--alerta-tono-low", "--sup-3"],
    ["--alerta-tono-medium", "--sup-3"],
    ["--alerta-tono-high", "--sup-3"],
    ["--alerta-barra-habitual", "--sup-3"],
  ];

  it.each(graficos)("el trazo %s sobre %s tiene al menos 3:1", (trazo, fondo) => {
    expect(contraste(resolver(mapa, trazo), resolver(mapa, fondo))).toBeGreaterThanOrEqual(3);
  });

  it("los tres tonos del nivel van de claro a hondo: más nivel, más contraste", () => {
    const [bajo, medio, alto] = ["--alerta-tono-low", "--alerta-tono-medium", "--alerta-tono-high"].map((t) =>
      contraste(resolver(mapa, t), resolver(mapa, "--sup-2"))
    );
    expect(bajo).toBeLessThan(medio);
    expect(medio).toBeLessThan(alto);
  });

  it("la fórmula da 21:1 para negro sobre blanco y 1:1 para el mismo color", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#114c5e", "#114c5e")).toBeCloseTo(1, 5);
  });
});
