/**
 * Cómo se escriben los números en el panel. Un solo lugar, así una cifra se lee igual en el resumen, en el
 * resultado de un filtro, en las métricas y en el registro.
 */

/** Un número con el punto de los miles: «1.245». */
export function enCifras(n: number): string {
  return n.toLocaleString("es-AR");
}

/**
 * Una duración en minutos, como la escribe la lista: «45 min», «2 h», «220 h 45 min». Sin «1 h 05»: deja los
 * minutos sin unidad y con un cero adelante, y así se lee como una hora del día.
 */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${enCifras(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${enCifras(horas)} h` : `${enCifras(horas)} h ${resto} min`;
}

/** «1 sesión», «16 sesiones», «1.245 sesiones». */
export function cuantasSesiones(n: number): string {
  return n === 1 ? "1 sesión" : `${enCifras(n)} sesiones`;
}
