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

function formatear(desde: Date, hasta: Date) {
  const total = Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / 1000));
  if (total < 60) return "recién";

  const minutos = Math.floor(total / 60);
  if (minutos < 60) return `${minutos} min`;

  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`;
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

  return <span className="cifra">{formatear(desde, hasta)}</span>;
}
