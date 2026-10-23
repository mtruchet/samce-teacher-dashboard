/**
 * Ordena la explicación de una alerta para mostrarla.
 *
 * El motor la escribe con un renglón por cosa (ver el docstring de `alertas.py`): primero el
 * titular y su aclaración; después, si hay variables, la línea «Lo que más pesó:» y una viñeta
 * por variable con la forma `• Nombre: lo observado (lo esperado: lo esperado)`; y al final la
 * aclaración de que describe lo observado sin atribuir intención.
 *
 * Una explicación que no tiene ese formato (las alertas guardadas antes de que existiera, que
 * son un solo párrafo) no se pierde: sale entera como titular. Nunca se descarta ni se corta
 * un renglón por no entenderlo.
 */

export interface VariableExplicada {
  /** Qué se midió, en lenguaje llano. */
  etiqueta: string;
  /** Lo que se observó en la sesión, con su unidad. */
  observado: string;
  /** Lo que se espera de una sesión normal, con su unidad. */
  esperado: string;
}

export interface ExplicacionOrdenada {
  titular: string;
  /** Los renglones que aclaran el titular, antes de la lista. */
  detalle: string[];
  /** «Lo que más pesó:» si hay lista. */
  encabezadoDeLista: string | null;
  variables: VariableExplicada[];
  /**
   * Las viñetas como texto, si alguna no tiene la forma esperada: entonces no se arma la tabla de
   * `variables` y se muestran todas como lista simple, sin perder ni cortar ninguna.
   */
  viñetasSinForma: string[];
  /** Los renglones que siguen a la lista, antes del cierre. */
  despues: string[];
  /** La aclaración de que describe lo observado y no atribuye intención. */
  cierre: string | null;
}

const VIÑETA = "•";
const FORMA = /^•\s+(.+?):\s+(.+?)\s+\(lo esperado:\s+(.+)\)$/;

function esCierre(renglon: string): boolean {
  return renglon.includes("no atribuye intención");
}

export function ordenarExplicacion(texto: string): ExplicacionOrdenada {
  const renglones = texto
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const vacia: ExplicacionOrdenada = {
    titular: "",
    detalle: [],
    encabezadoDeLista: null,
    variables: [],
    viñetasSinForma: [],
    despues: [],
    cierre: null,
  };
  if (renglones.length === 0) return vacia;
  // Un solo renglón: el formato viejo, o una explicación corta. Sale entera.
  if (renglones.length === 1) return { ...vacia, titular: renglones[0] };

  const ultimo = renglones[renglones.length - 1];
  const cierre = esCierre(ultimo) ? ultimo : null;
  const cuerpo = cierre ? renglones.slice(0, -1) : renglones;

  const [titular, ...resto] = cuerpo;
  const primeraViñeta = resto.findIndex((r) => r.startsWith(VIÑETA));
  if (primeraViñeta === -1) {
    return { ...vacia, titular, detalle: resto, cierre };
  }

  // La línea justo antes de la primera viñeta es el encabezado de la lista si termina en «:».
  let inicioDeLista = primeraViñeta;
  let encabezadoDeLista: string | null = null;
  if (primeraViñeta > 0 && resto[primeraViñeta - 1].endsWith(":")) {
    encabezadoDeLista = resto[primeraViñeta - 1];
    inicioDeLista = primeraViñeta - 1;
  }
  const detalle = resto.slice(0, inicioDeLista);

  const viñetas: string[] = [];
  const despues: string[] = [];
  let enLista = true;
  for (const renglon of resto.slice(primeraViñeta)) {
    if (enLista && renglon.startsWith(VIÑETA)) {
      viñetas.push(renglon);
    } else {
      enLista = false;
      despues.push(renglon);
    }
  }

  const armadas = viñetas.map((v) => FORMA.exec(v));
  if (armadas.every((partes) => partes !== null)) {
    const variables = armadas.map((partes) => ({
      etiqueta: partes![1], observado: partes![2], esperado: partes![3],
    }));
    return { titular, detalle, encabezadoDeLista, variables, viñetasSinForma: [], despues, cierre };
  }
  // Alguna viñeta no tiene la forma esperada: se muestran todas tal cual, como lista.
  return {
    titular, detalle, encabezadoDeLista, variables: [],
    viñetasSinForma: viñetas.map((v) => v.replace(/^•\s*/, "")), despues, cierre,
  };
}
