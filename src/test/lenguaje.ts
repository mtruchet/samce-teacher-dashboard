import { expect } from "vitest";
import { choquesConLasListas } from "./listas";

export {
  choquesConLasListas,
  LISTAS_DE_LAS_RONDAS,
  MARCADOS_EN_LA_RONDA_1,
  MARCADOS_EN_LA_RONDA_2,
  MARCADOS_EN_LA_RONDA_3,
  RECHAZADOS,
  TECNICAS,
} from "./listas";

/**
 * La forma de aplicar las listas de las rondas (listas.ts) a una pantalla en las pruebas de componentes. Todo
 * texto visible del panel (y los nombres accesibles) tiene que pasar las cinco.
 */

const espacios = (texto: string) => texto.replace(/\s+/g, " ").trim();

/**
 * Los textos de una pantalla, elemento por elemento: de cada uno, sus nodos de texto propios unidos por un
 * espacio, con los espacios colapsados; y aparte su `aria-label` y su `title`. Por elemento y no el
 * `textContent` entero: pegados sin espacio, el final de un renglón y el principio del siguiente forman
 * palabras que no están en la pantalla, y los nombres accesibles no figuran en el `textContent`.
 */
export function textosPorElemento(container: Element, excluir?: string): string[] {
  const textos: string[] = [];
  for (const elemento of [container, ...container.querySelectorAll("*")]) {
    if (excluir && elemento.closest(excluir)) continue;
    const propio = espacios(
      [...elemento.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join(" ")
    );
    if (propio) textos.push(propio);
    for (const atributo of ["aria-label", "title"]) {
      const valor = espacios(elemento.getAttribute(atributo) ?? "");
      if (valor) textos.push(valor);
    }
  }
  return textos;
}

/**
 * Aplica las cinco listas a cada texto de la pantalla y, si alguno choca, dice cuál y con qué. `excluir` es un
 * selector: lo que esté adentro no se mira (por ejemplo, un texto del motor que el panel muestra tal cual).
 */
export function expectLenguajeLlano(container: Element, { excluir }: { excluir?: string } = {}): void {
  expect(choquesConLasListas(textosPorElemento(container, excluir))).toEqual([]);
}
