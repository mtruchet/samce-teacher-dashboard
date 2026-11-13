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
 * - El texto del panel usa el ancho de su lámina (--medida-panel), no la medida de la landing.
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

  it("sobre las superficies oscuras el foco usa --anillo-foco-oscuro, y el celeste no marca el foco ahí (A1)", () => {
    const base = sinComentarios(HOJAS["./styles/base.css"]).replace(/\s+/g, " ");
    expect(base).toContain(".barra :focus-visible, .pie :focus-visible, .decision :focus-visible { box-shadow: var(--anillo-foco-oscuro); }");
    for (const hoja of ["./components/BarraPanel.css", "./components/Pie.css"]) {
      expect(sinComentarios(HOJAS[hoja])).not.toMatch(/outline\s*:[^;]*var\(--celeste\)/);
    }
  });

  it("un solo foco: las fichas de examen y las migas usan el anillo, sin un contorno celeste propio", () => {
    for (const hoja of ["./components/Fichas.css", "./components/Migas.css"]) {
      expect(sinComentarios(HOJAS[hoja])).not.toMatch(/outline\s*:[^;]*var\(--celeste\)/);
    }
  });

  it("--radio-panel queda para la landing: ninguna pieza del panel deriva su radio de él", () => {
    // Un rol, un radio (tokens.css, «Radios»): las cajas anidadas van con --radio-ficha.
    const delPanel = (l: string) => l.startsWith("./components/") || l.startsWith("./pages/");
    expect(buscar(/calc\(var\(--radio-panel\)/).filter(delPanel)).toEqual([]);
  });

  it("dos pesos en el panel: ninguna hoja del panel usa 700", () => {
    // 400 y 600; el 500 queda para la barra y el botón secundario (docs/sistema-visual.md, «Escala»).
    const delPanel = (l: string) => !l.startsWith("./pages/Landing.css");
    expect(buscar(/font-weight\s*:\s*(700|bold)\b/).filter(delPanel)).toEqual([]);
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

  it("el texto del panel usa --medida-panel: --medida (68ch) queda para la landing", () => {
    // Con --medida, las explicaciones del detalle saltaban de renglón a unos 520 px, a mitad de una lámina de
    // 1030 px (problema 3 del 13/11).
    expect(HOJAS["./styles/tokens.css"]).toMatch(/--medida-panel:\s*62rem/);
    const fuera = (l: string) => !l.startsWith("./pages/Landing.css") && !l.startsWith("./styles/base.css");
    expect(buscar(/var\(--medida\)/).filter(fuera)).toEqual([]);
  });

  it("ninguna regla del panel corta el texto con una medida en ch, salvo el pie", () => {
    // El pie va en columnas angostas a propósito. El título del examen lleva su tope dentro de min(), que no
    // es una medida suelta: ver «.panel__curso» en Panel.css.
    const delPanel = (l: string) =>
      (l.startsWith("./components/") || l.startsWith("./pages/Panel.css")) && !l.startsWith("./components/Pie.css");
    expect(buscar(/max-(width|inline-size):\s*\d+ch/).filter(delPanel)).toEqual([]);
  });

  it("la frase del veredicto tiene su paso (--panel-frase, 15 px), entre el título de la lámina y la bajada", () => {
    // Con los 17 px de una pieza empataba con «Análisis de la sesión», el título de su propia lámina.
    expect(HOJAS["./styles/tokens.css"]).toMatch(/--panel-frase:\s*15px/);
    const regla = sinComentarios(HOJAS["./components/AnalisisSesion.css"]).match(/\.veredicto__frase\s*\{([^}]*)\}/);
    expect(regla).not.toBeNull();
    expect(regla![1]).toMatch(/font-size:\s*var\(--panel-frase\)/);
    expect(regla![1]).toMatch(/line-height:\s*var\(--panel-alto\)/);
  });

  it("el panel mide como máximo 1080 px: ese tope es lo que deja el texto en un largo legible", () => {
    // Si se ensancha el panel, el texto vuelve a necesitar una medida propia (docs/sistema-visual.md).
    expect(HOJAS["./styles/tokens.css"]).toMatch(/--ancho-panel:\s*1080px/);
  });

  it("la lista ocupada se atenúa a 0,8 o más: se sigue leyendo y usando, y el texto cumple 4,5:1", () => {
    // Con 0,55, el texto secundario (--tinta-media) quedaba en 2,7:1 mientras la respuesta del filtro llegaba.
    const regla = sinComentarios(HOJAS["./pages/Panel.css"]).match(/\.panel__listas\[aria-busy="true"\]\s*\{([^}]*)\}/);
    expect(regla).not.toBeNull();
    const opacidad = regla![1].match(/opacity:\s*([\d.]+)/);
    expect(opacidad).not.toBeNull();
    expect(Number(opacidad![1])).toBeGreaterThanOrEqual(0.8);
  });
});
