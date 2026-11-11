import { duracion } from "./eventos";
import type { Metricas } from "./services/sesionesService";

/**
 * Las métricas de una sesión finalizada (HU05, criterio 1): el valor del propio alumno, sin lo esperado,
 * sin comparación y sin el aporte de cada dimensión. Una por dimensión, con los rótulos provisorios de la
 * decisión 9 del Sprint 4, que se cierran con la consulta técnica y la revisión de textos. Respetan las
 * reglas de las rondas con los docentes: sin «%», «proporción», «caracteres», «habitual», «fuera del
 * examen», «salida más larga», «portapapeles» ni «captura».
 *
 * La proporción de tiempo en otra ventana y la de texto pegado no se muestran: no tienen una forma llana
 * sin porcentaje, y pasarlas a minutos pediría la duración observada.
 */

export interface Metrica {
  dimension: string;
  rotulo: string;
  clave: keyof Metricas;
  formato: (valor: number) => string;
}

const unidad = (n: number, singular: string, plural: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? singular : plural}`;

export const minutosYSegundos = (segundos: number) => duracion(segundos * 1000);
export const porSegundo = (valor: number) =>
  `${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${valor === 1 ? "tecla" : "teclas"} por segundo`;
export const letras = (valor: number) => unidad(Math.round(valor), "letra", "letras");

export const METRICAS: Metrica[] = [
  { dimension: "Atención a la ventana", rotulo: "La vez que más tiempo estuvo en otra ventana o pestaña", clave: "outside_longest_s", formato: minutosYSegundos },
  { dimension: "Tecleo", rotulo: "Velocidad de escritura", clave: "typing_rate_median_per_s", formato: porSegundo },
  { dimension: "Pegado de texto", rotulo: "El texto pegado más largo", clave: "largest_paste_chars", formato: letras },
  { dimension: "Mouse", rotulo: "El mayor tiempo sin mover el mouse", clave: "mouse_idle_longest_s", formato: minutosYSegundos },
  { dimension: "Ritmo de respuesta", rotulo: "Tiempo típico por pregunta", clave: "question_time_median_s", formato: minutosYSegundos },
  { dimension: "Continuidad del registro", rotulo: "El mayor tiempo sin recibir datos del examen", clave: "silence_longest_s", formato: minutosYSegundos },
];

/** El texto de una métrica: su valor, o que no hubo dato (por ejemplo, sin tecleo). */
export function valorDeMetrica(metrica: Metrica, metricas: Metricas): string {
  const valor = metricas[metrica.clave];
  return valor === null || valor === undefined || !Number.isFinite(valor) ? "Sin dato en esta sesión" : metrica.formato(valor);
}
