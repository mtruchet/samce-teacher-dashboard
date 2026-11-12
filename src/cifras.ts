/**
 * Cómo se escriben los números en el panel. Un solo lugar, así una cifra se lee igual en el resumen, en el
 * resultado de un filtro, en las métricas y en el registro.
 */

/** Un número con el punto de los miles: «1.245». */
export function enCifras(n: number): string {
  return n.toLocaleString("es-AR");
}

/** «1 sesión», «16 sesiones», «1.245 sesiones». */
export function cuantasSesiones(n: number): string {
  return n === 1 ? "1 sesión" : `${enCifras(n)} sesiones`;
}
