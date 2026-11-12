import { NIVELES_DE_RIESGO, type NivelDeRiesgo } from "./services/sesionesService";

/**
 * Los filtros de la lista de sesiones (HU04) tal como viven en la dirección de la página.
 *
 * Viven ahí y no en un estado interno: sobreviven a la actualización automática, al botón Atrás y a la
 * vuelta por las migas, y un enlace copiado abre la misma vista. Este archivo es el único que sabe cómo se
 * llaman los parámetros, qué valores admiten y en qué orden se escriben. No usa React: el hook
 * `useFiltrosDeLaDireccion` lo conecta con la navegación.
 */

/** Los niveles del filtro, del más alto al más bajo: el mismo orden de las tarjetas del resumen. */
export const NIVELES_FILTRO: readonly NivelDeRiesgo[] = [...NIVELES_DE_RIESGO].reverse();
export const ESTADOS_FILTRO = ["open", "finished"] as const;
/** Los estados del análisis de las sesiones sin alertas. Solo los escriben las tarjetas del resumen. */
export const ANALISIS_FILTRO = ["no_alerts", "not_analyzed", "insufficient_evidence", "unavailable"] as const;
/** Los parámetros de la dirección, en el orden en que se escriben. */
export const PARAMETROS = ["nivel", "estado", "analisis", "q", "orden"] as const;
/** El largo máximo de la búsqueda, en letras (puntos de código), igual que el backend. */
export const LARGO_MAXIMO_BUSQUEDA = 100;

/**
 * Lo que el docente pidió sobre la lista de un examen. Vacío es la lista de siempre. El orden
 * predeterminado (por hora de inicio) no tiene valor: solo se escribe el orden por nivel.
 */
export interface FiltrosSesiones {
  nivel?: NivelDeRiesgo;
  estado?: (typeof ESTADOS_FILTRO)[number];
  analisis?: (typeof ANALISIS_FILTRO)[number];
  q?: string;
  orden?: "risk_level";
}

/** Los filtros leídos de la dirección: las cinco claves siempre presentes, sin valor si no hay filtro. */
export type FiltrosLeidos = { [K in keyof Required<FiltrosSesiones>]: Required<FiltrosSesiones>[K] | undefined };

function uno<T extends string>(valor: string | null | undefined, validos: readonly T[]): T | undefined {
  return validos.find((v) => v === valor);
}

/** La búsqueda sin espacios en los bordes y cortada en 100 letras. Vacía, no hay búsqueda. */
function busqueda(valor: string | null | undefined): string | undefined {
  const recortada = Array.from((valor ?? "").trim()).slice(0, LARGO_MAXIMO_BUSQUEDA).join("").trim();
  return recortada || undefined;
}

/**
 * Los filtros que dice la dirección, siempre con las cinco claves. Un valor que no se conoce (escrito a
 * mano, o de una versión vieja) se ignora.
 */
export function leerFiltros(parametros: URLSearchParams): FiltrosLeidos {
  return {
    nivel: uno(parametros.get("nivel"), NIVELES_FILTRO),
    estado: uno(parametros.get("estado"), ESTADOS_FILTRO),
    analisis: uno(parametros.get("analisis"), ANALISIS_FILTRO),
    q: busqueda(parametros.get("q")),
    orden: parametros.get("orden") === "risk_level" ? "risk_level" : undefined,
  };
}

/**
 * La dirección nueva después de cambiar algunos filtros. Devuelve parámetros nuevos, sin tocar los
 * actuales, y saca `sesion`: cambiar un filtro siempre vuelve a la lista.
 *
 * Nivel y análisis son excluyentes: una sesión con nivel de riesgo tiene alertas, y un estado del análisis
 * es de una sesión sin alertas, así que juntos no coincidirían con ninguna. El que llega con valor borra al
 * otro. Lo predeterminado no se escribe, y los filtros van siempre en el orden de `PARAMETROS`.
 */
export function escribirFiltros(actuales: URLSearchParams, parciales: Partial<FiltrosSesiones>): URLSearchParams {
  const nuevos: FiltrosSesiones = { ...leerFiltros(actuales), ...parciales };
  if (parciales.nivel) nuevos.analisis = undefined;
  if (parciales.analisis) nuevos.nivel = undefined;

  const siguiente = new URLSearchParams(actuales);
  siguiente.delete("sesion");
  for (const p of PARAMETROS) siguiente.delete(p);

  const valores: Record<(typeof PARAMETROS)[number], string | undefined> = {
    nivel: uno(nuevos.nivel, NIVELES_FILTRO),
    estado: uno(nuevos.estado, ESTADOS_FILTRO),
    analisis: uno(nuevos.analisis, ANALISIS_FILTRO),
    q: busqueda(nuevos.q),
    orden: nuevos.orden === "risk_level" ? "risk_level" : undefined,
  };
  for (const p of PARAMETROS) {
    const valor = valores[p];
    if (valor) siguiente.set(p, valor);
  }
  return siguiente;
}

/**
 * Los filtros de una dirección como texto, ya normalizados («nivel=high&orden=risk_level»). Dos direcciones
 * con los mismos filtros dan la misma clave aunque estén escritas distinto, y sin filtros da "".
 */
export function claveDeFiltros(parametros: URLSearchParams): string {
  return escribirFiltros(new URLSearchParams(), leerFiltros(parametros)).toString();
}

/** Si hay algún filtro que recorta la lista. El orden no cuenta: ordenar no deja afuera a nadie. */
export function hayFiltro(filtros: FiltrosSesiones): boolean {
  return Boolean(filtros.nivel || filtros.estado || filtros.analisis || filtros.q);
}

/**
 * Le pasa a `destino` los filtros de la dirección actual, solo si es el mismo examen (la miga del examen, la
 * vuelta del detalle, la corrección de la dirección). Otra evaluación abre sin filtros y con el orden
 * predeterminado: la elección no se guarda como preferencia.
 */
export function conservarFiltros(
  destino: URLSearchParams,
  actuales: URLSearchParams,
  examenActual: string | null
): URLSearchParams {
  const siguiente = new URLSearchParams(destino);
  for (const p of PARAMETROS) siguiente.delete(p);
  const examen = destino.get("examen");
  if (!examen || examen !== examenActual) return siguiente;
  // Se copian ya normalizados: un valor escrito a mano que no se conoce no viaja a la dirección nueva.
  const filtros = escribirFiltros(new URLSearchParams(), leerFiltros(actuales));
  for (const [p, valor] of filtros) siguiente.set(p, valor);
  return siguiente;
}
