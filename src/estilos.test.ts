import { describe, expect, it } from "vitest";

/**
 * Reglas de las hojas de estilo que ninguna prueba de componentes ve, porque jsdom no aplica CSS:
 *
 * - `--tono` se asigna en un solo lugar, src/styles/nivel.css, a partir de `data-nivel`. Con una copia en cada
 *   componente, el resumen terminó pintando el mismo nivel con otro color que la lista (D1).
 * - Sin semáforo: los niveles van con los tonos de las alertas.
 * - Nadie apaga el contorno del foco: con colores forzados (Windows) el anillo de sombra desaparece y el
 *   contorno es lo único que queda.
 * - Las transiciones usan las duraciones con nombre (--mov-*), que se apagan con «reducir movimiento».
 *
 * Las hojas se leen como texto con `import.meta.glob` (sin `fs`, como la prueba de contraste lee los tokens).
 */
const HOJAS = import.meta.glob("./**/*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Las líneas de todas las hojas que cumplen `patron`, con la hoja y el número de línea. */
function buscar(patron: RegExp, { comentarios = false, salvo = "" } = {}): string[] {
  const hallados: string[] = [];
  for (const [hoja, css] of Object.entries(HOJAS)) {
    if (hoja === salvo) continue;
    // Los comentarios se reemplazan por espacios del mismo largo de renglones, para no correr los números.
    const texto = comentarios ? css : css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
    texto.split("\n").forEach((linea, i) => {
      if (patron.test(linea)) hallados.push(`${hoja}:${i + 1}: ${linea.trim()}`);
    });
  }
  return hallados;
}

describe("las hojas de estilo", () => {
  it("se leen todas, incluida la del tono", () => {
    expect(Object.keys(HOJAS)).toContain("./styles/nivel.css");
    expect(Object.keys(HOJAS).length).toBeGreaterThan(20);
    // Vitest vacía los CSS salvo los que vite.config.ts deja pasar: una hoja vacía haría pasar todo lo de abajo.
    expect(Object.entries(HOJAS).filter(([, css]) => css.trim() === "").map(([hoja]) => hoja)).toEqual([]);
  });

  it("--tono se asigna solo en styles/nivel.css, una vez por nivel", () => {
    expect(buscar(/--tono\s*:/, { salvo: "./styles/nivel.css" })).toEqual([]);
    // Sin depender del fin de línea con que Git dejó el archivo.
    const enNivel = sinComentarios(HOJAS["./styles/nivel.css"]).replace(/\s+/g, " ");
    for (const nivel of ["low", "medium", "high"]) {
      expect(enNivel).toContain(`[data-nivel="${nivel}"] { --tono: var(--alerta-tono-${nivel}); }`);
    }
  });

  it("ningún token ni regla del semáforo", () => {
    // Sin tilde: así se escribían los tokens (--semaforo-rojo). «Semáforo», con tilde, puede quedar en los
    // comentarios que explican que no hay.
    expect(buscar(/semaforo/i, { comentarios: true })).toEqual([]);
  });

  it("el anillo de foco se escribe una sola vez, en tokens.css (--anillo-foco)", () => {
    expect(buscar(/0 0 0 2px var\(--sup-1\)/, { salvo: "./styles/tokens.css" })).toEqual([]);
    expect(HOJAS["./styles/tokens.css"]).toMatch(/--anillo-foco:/);
  });

  it("nadie apaga el contorno del foco", () => {
    expect(buscar(/outline\s*:\s*(none|0)\b/)).toEqual([]);
  });

  it("ninguna transición lleva una duración escrita a mano", () => {
    const hallados: string[] = [];
    for (const [hoja, css] of Object.entries(HOJAS)) {
      for (const [declaracion] of sinComentarios(css).matchAll(/transition(-duration|-delay)?\s*:[^;]+;/g)) {
        if (/(^|[\s,:(])\d*\.?\d+m?s\b/.test(declaracion)) hallados.push(`${hoja}: ${declaracion.replace(/\s+/g, " ")}`);
      }
    }
    expect(hallados).toEqual([]);
  });
});
