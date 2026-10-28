import { describe, expect, it } from "vitest";
import tokens from "./styles/tokens.css?raw";

/**
 * El texto atenuado del apartado «Análisis de la sesión» (la hora, el origen, «lo esperado», la aclaración de que
 * no atribuye intención) tiene que leerse sobre su fondo: relación de contraste de al menos 4,5:1 (WCAG 2.1, AA para
 * texto normal). Se lee de los tokens, resolviendo cada `var(--x)` hasta un hexadecimal, sin `fs`.
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

describe("contraste del texto atenuado del análisis", () => {
  const mapa = declaraciones();
  const pares: Array<[string, string]> = [
    ["--analisis-tinta-atenuada", "--sup-1"],
    ["--analisis-tinta-atenuada-low", "--nivel-1-fondo"],
    ["--analisis-tinta-atenuada-medium", "--nivel-2-fondo"],
    ["--analisis-tinta-atenuada-high", "--nivel-3-fondo"],
  ];

  it.each(pares)("%s sobre %s tiene al menos 4,5:1", (tinta, fondo) => {
    expect(contraste(resolver(mapa, tinta), resolver(mapa, fondo))).toBeGreaterThanOrEqual(4.5);
  });

  it("la fórmula da 21:1 para negro sobre blanco y 1:1 para el mismo color", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#114c5e", "#114c5e")).toBeCloseTo(1, 5);
  });
});
