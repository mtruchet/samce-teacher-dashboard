import { enCifras } from "../cifras";

/**
 * El resultado de un filtro (D3): «16 de 245 sesiones», con N las que cumplen el filtro y M el total de la
 * evaluación. El sustantivo concuerda con M, como en el resumen: «0 de 1 sesión». Lo usan el renglón visible
 * (`ResultadoDelFiltro`) y su anuncio, así los dos dicen lo mismo.
 */
export function textoDelResultado(cuantas: number, deCuantas: number): string {
  return `${enCifras(cuantas)} de ${enCifras(deCuantas)} ${deCuantas === 1 ? "sesión" : "sesiones"}`;
}
