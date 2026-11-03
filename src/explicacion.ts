/**
 * Ordena la explicación de una alerta para mostrarla, sin cambiarle una palabra.
 *
 * El motor escribe cada explicación para el docente, en lenguaje llano, con un renglón por cosa
 * (ver el docstring de `alertas.py`):
 *
 * 1. El primer renglón es el hecho: «Este examen se rindió de una forma un poco distinta a lo
 *    habitual.» o «En la pregunta 3, pegó de una sola vez un texto largo en una respuesta que
 *    todavía estaba vacía, algo poco común en un examen.».
 * 2. Un renglón que termina en «:» abre la lista («En qué se diferenció de lo habitual:»).
 * 3. Los renglones que empiezan con «• » son las viñetas de esa lista («Pegó texto una sola vez:
 *    el texto largo de la pregunta 3 que describe la otra alerta.»).
 * 4. Cualquier otro renglón es una nota y sale tal cual («Ninguna de estas cosas es rara por sí
 *    sola…», el aviso de la conexión).
 *
 * El panel no traduce nada: si el motor cambia una frase, en pantalla se lee la frase nueva.
 * Nunca se descarta un renglón por no entenderlo, con dos excepciones que solo tocan a las
 * alertas guardadas antes de que el motor cambiara sus textos y que nadie volvió a analizar: el
 * cierre «…no atribuye intención…», que ya no se muestra, y la cláusula «el índice … es N de
 * 100», porque el panel no muestra nunca el índice de integridad.
 */

export interface ExplicacionOrdenada {
  /** El renglón 1: lo que pasó, en una oración. */
  hecho: string;
  /** Las notas escritas entre el hecho y la lista. Solo las alertas viejas las traen. */
  notasAntes: string[];
  /** El rótulo de la lista sin los dos puntos («En qué se diferenció de lo habitual»), o null. */
  encabezadoDeLista: string | null;
  /** Las viñetas, sin el «• » de adelante y con el texto tal cual. */
  viñetas: string[];
  /** Las notas que siguen a la lista, o todas si no hay lista. */
  notas: string[];
}

const VIÑETA = /^•\s+/;

// Sin `\b` delante de la «í»: en JavaScript `\b` es ASCII y entre un espacio y la «í» no hay límite de palabra.
const CLAUSULA_DEL_INDICE = /índice[^\n]*\bde 100\b/i;

/** Quita el renglón del índice, o la cláusula del índice de una explicación de un solo renglón. */
function sinElIndice(renglones: string[]): string[] {
  if (renglones.length >= 2) {
    return renglones.filter((r) => !CLAUSULA_DEL_INDICE.test(r));
  }
  if (renglones.length === 1 && CLAUSULA_DEL_INDICE.test(renglones[0])) {
    const dosPuntos = renglones[0].indexOf(":");
    if (dosPuntos === -1) return renglones;
    const resto = renglones[0].slice(dosPuntos + 1).trim();
    return resto ? [resto.charAt(0).toUpperCase() + resto.slice(1)] : [];
  }
  return renglones;
}

/** El cierre que el motor agregaba antes a cada alerta. Las alertas nuevas ya no lo traen. */
function esCierre(renglon: string): boolean {
  return renglon.includes("no atribuye intención");
}

export function ordenarExplicacion(texto: string): ExplicacionOrdenada {
  const renglones = sinElIndice(
    texto
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
  ).filter((r) => !esCierre(r));

  const [hecho = "", ...resto] = renglones;
  const ordenada: ExplicacionOrdenada = { hecho, notasAntes: [], encabezadoDeLista: null, viñetas: [], notas: [] };
  let empezoLaLista = false;

  for (const renglon of resto) {
    if (VIÑETA.test(renglon)) {
      empezoLaLista = true;
      ordenada.viñetas.push(renglon.replace(VIÑETA, ""));
    } else if (!empezoLaLista && renglon.endsWith(":")) {
      empezoLaLista = true;
      ordenada.encabezadoDeLista = renglon.slice(0, -1).trim();
    } else if (!empezoLaLista) {
      ordenada.notasAntes.push(renglon);
    } else {
      ordenada.notas.push(renglon);
    }
  }
  // Sin lista no hay un «antes»: todas las notas van juntas, debajo del hecho.
  if (!empezoLaLista) return { ...ordenada, notasAntes: [], notas: ordenada.notasAntes };
  return ordenada;
}
