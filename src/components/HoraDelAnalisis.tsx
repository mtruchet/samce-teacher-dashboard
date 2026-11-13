import { horaCorta } from "../eventos";

interface Props {
  /** Cuándo se calculó el análisis (ISO). */
  iso: string;
  /**
   * Cuándo empezó la sesión (ISO). Si el análisis es de otro día, la hora sola engaña: un recálculo de la
   * madrugada siguiente se leía como anterior al examen. Ahí va también la fecha.
   */
  inicio?: string;
  className: string;
  /** Un renglón propio dentro de un bloque (`p`) o dentro de una pastilla (`span`). */
  como?: "p" | "span";
  id?: string;
}

/** «4/11». El día, sin el año: el de la sesión ya está en la ficha. */
function diaCorto(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" });
}

/** Si el análisis cayó en otro día (local) que el comienzo de la sesión. */
function esDeOtroDia(iso: string, inicio: string | undefined): boolean {
  if (!inicio) return false;
  const a = new Date(iso);
  const b = new Date(inicio);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.toDateString() !== b.toDateString();
}

/**
 * «Análisis de las HH:MM», el renglón de la hora de un análisis en la escalera de «Cómo cambió el riesgo» y en
 * el historial. Un solo componente para que la forma no se separe: va siempre en su propio renglón, arriba
 * del rótulo del nivel, y nunca pegada al medidor con dos puntos.
 *
 * Si el análisis es de otro día que el comienzo de la sesión, dice el día: «Análisis del 4/11 a las 00:53».
 */
export function HoraDelAnalisis({ iso, inicio, className, como: Etiqueta = "p", id }: Props) {
  const hora = <time className="cifra" dateTime={iso}>{horaCorta(iso)}</time>;
  return (
    <Etiqueta className={className} id={id}>
      {esDeOtroDia(iso, inicio) ? (
        <>
          Análisis del <span className="cifra">{diaCorto(iso)}</span> a las {hora}
        </>
      ) : (
        <>Análisis de las {hora}</>
      )}
    </Etiqueta>
  );
}
