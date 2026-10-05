import type { Evento } from "./services/sesionesService";

/**
 * El registro de una sesión, con sus silencios anunciados.
 *
 * Cada evento es una fila y ninguno se junta con otro: el criterio de HU10 pide
 * los eventos en su forma original, y juntar repeticiones —aunque fuera con una
 * regla pareja para todos los tipos— escondía momentos distintos detrás de un
 * mismo renglón. Tres vueltas a la ventana son tres hechos, no uno con un tres
 * al lado.
 *
 * Lo único que se agrega son los huecos. Sin eso, el ojo lee dos horas seguidas
 * y supone que son contiguas, o sea que la pantalla miente sin querer.
 */

/** Desde cuándo un silencio del registro merece decirse. */
const HUECO_MS = 60_000;

/** Una fila con un evento, tal como llegó. */
export interface FilaDeEvento {
  clase: "evento";
  clave: string;
  evento: Evento;
}

/**
 * Un rato sin que llegara nada. Habla del registro, no del alumno: el servidor
 * pone la hora al guardar, así que esto dice que no llegó nada, no que no pasó
 * nada.
 */
export interface Hueco {
  clase: "hueco";
  clave: string;
  /** `received_at` del último que llegó antes del silencio. */
  desde: string;
  /** `received_at` del primero que llegó después. */
  hasta: string;
}

export type Entrada = FilaDeEvento | Hueco;

function fila(evento: Evento): FilaDeEvento {
  return { clase: "evento", clave: `e${evento.seq}`, evento };
}

/**
 * Los eventos de una sesión, con una entrada de hueco entre los que quedaron
 * separados por más de un minuto.
 *
 * El silencio se mide sobre `received_at`, que es la hora en que el servidor
 * guardó la fila. Por eso el texto dice «sin eventos recibidos» y no «sin
 * eventos»: lo único que el dato sostiene es que no llegó nada.
 */
export function conHuecos(eventos: Evento[]): Entrada[] {
  if (eventos.length === 0) return [];

  const entradas: Entrada[] = [fila(eventos[0])];
  for (let i = 1; i < eventos.length; i++) {
    const anterior = eventos[i - 1];
    const actual = eventos[i];
    // Con una hora inválida la resta da NaN y no hay hueco: inventar un
    // silencio desde 1970 sería peor que no marcar ninguno.
    if (Date.parse(actual.received_at) - Date.parse(anterior.received_at) >= HUECO_MS) {
      entradas.push({
        clase: "hueco",
        clave: `h${anterior.seq}`,
        desde: anterior.received_at,
        hasta: actual.received_at,
      });
    }
    entradas.push(fila(actual));
  }
  return entradas;
}
