import type { Metricas } from "./services/sesionesService";

/**
 * Las métricas de una sesión finalizada (HU05, criterio 1): el valor del propio alumno, sin lo esperado,
 * sin comparación y sin el aporte de cada dimensión. Una por dimensión, con los rótulos de la decisión 9 del
 * Sprint 4. Respetan las reglas de las rondas con los docentes: sin «%», «proporción», «caracteres»,
 * «habitual», «fuera del examen», «salida más larga», «portapapeles» ni «captura».
 *
 * La proporción de tiempo en otra ventana y la de texto pegado no se muestran: no tienen una forma llana
 * sin porcentaje, y pasarlas a minutos pediría la duración observada. Por eso quedan fuera del tipo.
 *
 * Los formatos son propios y no los del registro (`duracion()` de `eventos.ts`): acá el uno va en letras,
 * como lo escribe el motor («un minuto», «una hora»), porque la ronda 1 marcó «1 minuto» suelto (D5):
 * - duraciones: «menos de un segundo», «45 segundos», «un minuto y 33 segundos», «2 horas y un minuto»;
 * - tecleo, redondeado primero a un decimal: «una tecla por segundo», «2,5 teclas por segundo», «menos de 0,1
 *   teclas por segundo»;
 * - texto pegado: «una letra», «1.241 letras»;
 * - el 0 tiene frase propia en tres métricas: «No estuvo en otra ventana ni en otra pestaña», «No pegó texto» y,
 *   en el mouse, «menos de 15 segundos»;
 * - sin valor (null, NaN o infinito): «Sin dato en esta sesión».
 */

/** Las seis métricas que se muestran: todas menos las dos proporciones. */
export type ClaveDeMetrica = Exclude<keyof Metricas, "outside_time_ratio" | "pasted_chars_ratio">;

export interface Metrica {
  /** De qué parte del examen habla. No se dibuja: queda para las pruebas y para seguir los casos (CP34). */
  dimension: string;
  rotulo: string;
  clave: ClaveDeMetrica;
  formato: (valor: number) => string;
  /**
   * Lo que se dice cuando el valor es 0. El motor manda 0, y no un vacío, cuando la conducta no ocurrió: sin
   * esto, quien nunca salió leía «menos de un segundo» y quien no pegó, «0 letras».
   */
  siEsCero?: string;
}

const enCifras = (n: number) => n.toLocaleString("es-AR");

/** «un minuto», «2 minutos»: el uno en letras, el resto en cifras. */
const cuantos = (n: number, uno: string, plural: string) => (n === 1 ? uno : `${enCifras(n)} ${plural}`);

/**
 * Una duración en segundos: «menos de un segundo», «45 segundos», «un minuto y 33 segundos», «una hora»,
 * «2 horas y un minuto». Pasada la hora se dejan los segundos, como en el registro.
 */
export function duracionDeMetrica(s: number): string {
  const segundos = Math.round(s);
  if (segundos < 1) return "menos de un segundo";
  if (segundos < 60) return cuantos(segundos, "un segundo", "segundos");
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    const resto = segundos % 60;
    const enMinutos = cuantos(minutos, "un minuto", "minutos");
    return resto === 0 ? enMinutos : `${enMinutos} y ${cuantos(resto, "un segundo", "segundos")}`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const enHoras = cuantos(horas, "una hora", "horas");
  return resto === 0 ? enHoras : `${enHoras} y ${cuantos(resto, "un minuto", "minutos")}`;
}

/**
 * La velocidad de escritura, redondeada primero a un decimal: de 0,95 a 1,04 es «una tecla por segundo», y lo
 * que redondea a 0, «menos de 0,1 teclas por segundo».
 */
export function tecleo(v: number): string {
  const redondeado = Math.round(v * 10) / 10;
  if (redondeado === 1) return "una tecla por segundo";
  if (redondeado <= 0) return "menos de 0,1 teclas por segundo";
  return `${redondeado.toLocaleString("es-AR", { maximumFractionDigits: 1 })} teclas por segundo`;
}

/** «una letra», «1.241 letras». */
export function letras(v: number): string {
  return cuantos(Math.round(v), "una letra", "letras");
}

export const METRICAS: Metrica[] = [
  {
    dimension: "Atención a la ventana", rotulo: "El mayor tiempo seguido en otra ventana o pestaña",
    clave: "outside_longest_s", formato: duracionDeMetrica, siEsCero: "No estuvo en otra ventana ni en otra pestaña",
  },
  { dimension: "Tecleo", rotulo: "Velocidad de escritura", clave: "typing_rate_median_per_s", formato: tecleo },
  {
    dimension: "Pegado de texto", rotulo: "El texto pegado más largo",
    clave: "largest_paste_chars", formato: letras, siEsCero: "No pegó texto",
  },
  {
    // El motor solo cuenta los ratos quietos de 15 segundos o más: un 0 es que nunca llegó a eso.
    dimension: "Mouse", rotulo: "El mayor tiempo sin mover el mouse",
    clave: "mouse_idle_longest_s", formato: duracionDeMetrica, siEsCero: "menos de 15 segundos",
  },
  { dimension: "Ritmo de respuesta", rotulo: "Tiempo típico por pregunta", clave: "question_time_median_s", formato: duracionDeMetrica },
  {
    dimension: "Continuidad del registro", rotulo: "El mayor tiempo sin registro de actividad",
    clave: "silence_longest_s", formato: duracionDeMetrica,
  },
];

/** El texto de una métrica: su valor, lo que se dice de su 0, o que no hubo dato (por ejemplo, sin tecleo). */
export function valorDeMetrica(metrica: Metrica, metricas: Metricas): string {
  const valor = metricas[metrica.clave];
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "Sin dato en esta sesión";
  if (valor === 0 && metrica.siEsCero) return metrica.siEsCero;
  return metrica.formato(valor);
}
