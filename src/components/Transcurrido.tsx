import { useEffect, useState } from "react";

/** Cada cuánto se revisa si cambió el minuto. */
const REVISION = 10000;

/**
 * Cuánto lleva corriendo el intento.
 *
 * Corre contra el reloj del navegador y no le pide nada al servidor.
 *
 * Sin segundos, y con la unidad pegada al número. Los segundos estuvieron un
 * tiempo porque eran la única señal de que la pantalla seguía viva, pero eso
 * lo dice mejor la cuenta regresiva del encabezado, que es una sola: acá se
 * multiplicaban por cada alumno y hacían parpadear toda la tabla sin aportar
 * nada. A nadie le importa el segundo exacto en que arrancó un examen.
 *
 * Tampoco va en mm:ss, porque la columna de al lado es una hora del día y
 * «14:46» junto a «14:43» se lee como otra hora.
 */

function formatear(desde: Date, hasta: Date, cerrada: boolean) {
  const total = Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / 1000));
  // El mismo número encabeza dos columnas distintas. En «Transcurrido», de una
  // sesión abierta, «recién» dice que el intento arrancó hace nada. En
  // «Duración», de una entregada, diría que terminó hace poco, que es otra
  // cosa y además falsa: lo que pasó es que duró poco.
  if (total < 60) return cerrada ? "menos de 1 min" : "recién";

  const minutos = Math.floor(total / 60);
  if (minutos < 60) return `${minutos} min`;

  // «1 h 05» deja los minutos sin unidad y con un cero adelante, y así se lee
  // como una hora del día, que es justo lo que la columna de al lado sí es.
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

interface Props {
  inicio: string;
  /** Si la sesión ya cerró, el reloj se detiene ahí. */
  cierre?: string | null;
}

export function Transcurrido({ inicio, cierre }: Props) {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    if (cierre) return;
    // Cada diez segundos y no cada uno: lo que se muestra cambia una vez por
    // minuto, así que mirar el reloj más seguido sólo hace trabajar de más a
    // cada fila de la tabla.
    const id = window.setInterval(() => setAhora(new Date()), REVISION);
    return () => window.clearInterval(id);
  }, [cierre]);

  const desde = new Date(inicio);
  const hasta = cierre ? new Date(cierre) : ahora;

  return <span className="cifra">{formatear(desde, hasta, Boolean(cierre))}</span>;
}
