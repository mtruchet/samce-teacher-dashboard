import { describe, expect, it } from "vitest";
import tokens from "./styles/tokens.css?raw";

/**
 * El texto atenuado del apartado «Análisis de la sesión» (la hora, el origen, las bajadas del veredicto y las notas del motor)
 * tiene que leerse sobre su fondo: relación de contraste de al menos 4,5:1 (WCAG 2.1, AA para texto normal). Los
 * trazos que dicen el nivel de una alerta (el borde, el medidor y el ícono de origen) piden al menos 3:1 (WCAG 2.1, 1.4.11).
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

/**
 * `color-mix(in srgb, a t, b)`: cada canal, `a` en la proporción `t` y `b` en el resto, redondeado a un entero
 * como lo pinta el navegador.
 */
function mezclar(a: string, b: string, t: number): string {
  const canal = (hex: string, desde: number) => parseInt(hex.slice(desde, desde + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((i) => Math.round(canal(a, i) * t + canal(b, i) * (1 - t)).toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("contraste del texto atenuado y de los trazos del análisis", () => {
  const mapa = declaraciones();
  // Texto: la tinta atenuada sobre la lámina (--sup-1), sobre las tarjetas de las alertas y la lámina del registro
  // (--sup-2) y sobre el cuadro del ícono grande (--sup-3); y la palabra del nivel y el hecho, en --tinta, sobre la tarjeta.
  const pares: Array<[string, string]> = [
    ["--analisis-tinta-atenuada", "--sup-1"],
    ["--analisis-tinta-atenuada", "--sup-2"],
    ["--analisis-tinta-atenuada", "--sup-3"],
    ["--tinta", "--sup-2"],
    ["--tinta-media", "--sup-1"],
    ["--tinta-media", "--sup-2"],
    ["--tinta-media", "--sup-3"],
    ["--celeste-hondo", "--sup-1"],
    // El rótulo del nivel y los renglones de la columna «Análisis» de la lista, sobre su fondo.
    ["--tinta", "--sup-1"],
    ["--tinta-media", "--sup-1"],
    // El tilde del veredicto sin alertas sobre su cuadro verde suave (ronda 3).
    ["--veredicto-bien-tinta", "--veredicto-bien-fondo"],
  ];

  it.each(pares)("%s sobre %s tiene al menos 4,5:1", (tinta, fondo) => {
    expect(contraste(resolver(mapa, tinta), resolver(mapa, fondo))).toBeGreaterThanOrEqual(4.5);
  });

  // Trazos y rellenos que dicen el nivel (WCAG 1.4.11, 3:1): el borde de la tarjeta y el medidor (también el contorno
  // de sus segmentos vacíos, que va en el tono de la tarjeta) sobre la tarjeta (--sup-2, la misma en los tres niveles).
  const graficos: Array<[string, string]> = [
    ["--alerta-tono-low", "--sup-2"],
    ["--alerta-tono-medium", "--sup-2"],
    ["--alerta-tono-high", "--sup-2"],
    // La marca de la columna «Análisis» de la lista: el borde y el medidor sobre el fondo de la lista (--sup-1).
    ["--alerta-tono-low", "--sup-1"],
    ["--alerta-tono-medium", "--sup-1"],
    ["--alerta-tono-high", "--sup-1"],
    // El borde de los controles (selectores, búsqueda y botón secundario) sobre la lámina y sobre la página: con
    // --sup-4 daba 1,2:1 y el control no se distinguía de su fondo.
    ["--borde-control", "--sup-1"],
    ["--borde-control", "--sup-2"],
  ];

  it.each(graficos)("el trazo %s sobre %s tiene al menos 3:1", (trazo, fondo) => {
    expect(contraste(resolver(mapa, trazo), resolver(mapa, fondo))).toBeGreaterThanOrEqual(3);
  });

  // Las tarjetas de nivel del resumen de la evaluación (D1): los mismos tonos, sobre su fondo teñido, que es el tono
  // al 8 % sobre --sup-1 (`color-mix`), y no sobre --sup-1. El borde contra ese fondo; el segmento lleno del medidor
  // contra el vacío, que es el tono al 14 % sobre el mismo fondo; y el número y la palabra, en --tinta.
  const TARJETAS_DEL_RESUMEN: Array<[string, string, number, number]> = [
    ["bajo", "--alerta-tono-low", 3.55, 3.05],
    ["medio", "--alerta-tono-medium", 4.1, 3.49],
    ["alto", "--alerta-tono-high", 4.45, 3.73],
  ];

  it.each(TARJETAS_DEL_RESUMEN)(
    "la tarjeta de riesgo %s del resumen (%s): borde a %s:1 y medidor a %s:1 sobre su fondo teñido",
    (_nombre, token, borde, medidor) => {
      const tono = resolver(mapa, token);
      const fondo = mezclar(tono, resolver(mapa, "--sup-1"), 0.08);
      const vacio = mezclar(tono, fondo, 0.14);

      expect(contraste(tono, fondo)).toBeGreaterThanOrEqual(3);
      expect(contraste(tono, vacio)).toBeGreaterThanOrEqual(3);
      expect(contraste(resolver(mapa, "--tinta"), fondo)).toBeGreaterThanOrEqual(4.5);
      // Los valores medidos, con dos decimales: si un tono cambia, la prueba lo dice.
      expect(Math.abs(contraste(tono, fondo) - borde)).toBeLessThan(0.01);
      expect(Math.abs(contraste(tono, vacio) - medidor)).toBeLessThan(0.01);
    }
  );

  it("los tres tonos del nivel van de apagado a intenso: más nivel, más contraste", () => {
    const [bajo, medio, alto] = ["--alerta-tono-low", "--alerta-tono-medium", "--alerta-tono-high"].map((t) =>
      contraste(resolver(mapa, t), resolver(mapa, "--sup-2"))
    );
    expect(bajo).toBeLessThan(medio);
    expect(medio).toBeLessThan(alto);
  });

  // Las superficies oscuras (la barra y el pie, en --pizarra): el texto chico del pie en --tinta-clara-suave
  // (blanco con transparencia) y la capa de afuera del anillo de foco de esas superficies (A1, A8).
  it("sobre la pizarra, el texto chico del pie llega a 4,5:1 y el anillo de foco a 3:1", () => {
    const pizarra = resolver(mapa, "--pizarra");
    const suave = /^rgb\(255 255 255 \/ (\d+)%\)$/.exec(mapa.get("--tinta-clara-suave") ?? "");
    expect(suave).not.toBeNull();
    expect(contraste(mezclar("#ffffff", pizarra, Number(suave![1]) / 100), pizarra)).toBeGreaterThanOrEqual(4.5);

    const anillo = /0 0 0 2px var\(--sup-5\), 0 0 0 4px var\((--[\w-]+)\)/.exec(mapa.get("--anillo-foco-oscuro") ?? "");
    expect(anillo).not.toBeNull();
    expect(contraste(resolver(mapa, anillo![1]), pizarra)).toBeGreaterThanOrEqual(3);
  });

  it("la fórmula da 21:1 para negro sobre blanco y 1:1 para el mismo color", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#114c5e", "#114c5e")).toBeCloseTo(1, 5);
  });
});
