import { expect } from "vitest";

/**
 * Las listas de las rondas con los docentes y la forma de aplicarlas a una pantalla. Todo texto visible del
 * panel (y los nombres accesibles) tiene que pasar las cinco. Las listas están tal cual se armaron en cada ronda:
 * no se cambian para que pase un texto; se cambia el texto.
 */

/** Lo que Facundo rechazó del primer rediseño: no puede volver a aparecer. */
export const RECHAZADOS =
  /Por cómo se desarrolló|Una alerta señala|no atribuye intención|la revisión es del docente|Las cifras son las del momento|Una sesión habitual|Esta sesión\n/;
/**
 * Lo que los docentes de la ronda 1 marcaron: «lo común» (se dice siempre «lo habitual»), el rótulo
 * «llamó la atención», «por última vez», «Apareció a las», «Esta sesión se rindió», las salidas
 * «del examen» y las «aplicaciones de la computadora», y las cifras sueltas como «1 vez».
 */
export const MARCADOS_EN_LA_RONDA_1 =
  /lo común|llamó la atención|por última vez|Apareció a las|sesión se rindió|aplicaciones|salida más larga|fuera del examen|\b1 vez|\b1 minuto|cuando lo común/i;
/**
 * Lo que marcaron en la ronda 2: «habitual» sin decir contra qué (y repetido tres veces en la tarjeta), la viñeta que
 * remitía a «la otra alerta» (sonaba a nota interna del sistema), «una sola vez» en el pegado, «en cada pregunta», los números en letras al
 * lado de los números en cifras, la hora del análisis («Se detectó a las») y la bajada que repetía el título de la 452.
 */
export const MARCADOS_EN_LA_RONDA_2 =
  /habitual|otra alerta|alerta de (abajo|arriba)|Pegó texto una sola vez|en cada pregunta|\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) (minutos|segundos|veces)\b|Se detectó|no surgió ninguna alerta/i;
/**
 * Lo que marcaron en la ronda 3: «se rindió de una forma» y «la mayoría de los exámenes» en el titular, «tardó más»
 * (sonaba a castigo), «Nivel bajo» y «Nivel alto» solos (se leían como el nivel del alumno o un «nivel de trampa») y
 * la segunda frase de la 457, que giraba sobre sí misma.
 */
export const MARCADOS_EN_LA_RONDA_3 =
  /se rindió de una forma|la mayoría de los exámenes|tardó más|Nivel (bajo|medio|alto)|Que no se haya podido analizar|lo que sí se registró/i;
/** Palabras técnicas que el docente no tiene por qué conocer. */
export const TECNICAS =
  /caracteres|sesiones habituales|sesiones esperadas|99 de cada 100|%|modelo|variable|cálculo|índice|proporción|mediana|percentil|severidad|puntaje|captura|complemento|Moodle|backend/i;

/** Las cinco listas, con el nombre que se dice cuando un texto choca con una. */
export const LISTAS_DE_LAS_RONDAS: ReadonlyArray<readonly [string, RegExp]> = [
  ["RECHAZADOS", RECHAZADOS],
  ["MARCADOS_EN_LA_RONDA_1", MARCADOS_EN_LA_RONDA_1],
  ["MARCADOS_EN_LA_RONDA_2", MARCADOS_EN_LA_RONDA_2],
  ["MARCADOS_EN_LA_RONDA_3", MARCADOS_EN_LA_RONDA_3],
  ["TECNICAS", TECNICAS],
];

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

/** Los choques de una lista de textos con las cinco listas, uno por renglón: «texto» (LISTA: lo que chocó). */
export function choquesConLasListas(textos: Iterable<string>): string[] {
  const choques: string[] = [];
  for (const texto of textos) {
    for (const [nombre, lista] of LISTAS_DE_LAS_RONDAS) {
      const choque = lista.exec(texto);
      if (choque) choques.push(`«${texto}» (${nombre}: «${choque[0]}»)`);
    }
  }
  return choques;
}

/**
 * Aplica las cinco listas a cada texto de la pantalla y, si alguno choca, dice cuál y con qué. `excluir` es un
 * selector: lo que esté adentro no se mira (por ejemplo, un texto del motor que el panel muestra tal cual).
 */
export function expectLenguajeLlano(container: Element, { excluir }: { excluir?: string } = {}): void {
  expect(choquesConLasListas(textosPorElemento(container, excluir))).toEqual([]);
}
